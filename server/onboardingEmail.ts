import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { sendSystemEmail, DEFAULT_PLATFORM_DOMAIN, DEFAULT_PLATFORM_EMAIL } from './emailConfig';
import { escapeHtml, FIRESTORE_BASE, adminAuth, queryDocs } from './auth';

export interface OnboardingWelcomeData {
  hotelId: string;
  propertyName: string;
  ownerEmail: string;
  ownerName?: string;
  managerEmail?: string;
  managerName?: string;
  location?: string;
  category?: string;
  stayType?: string;
  origin?: string;
}

interface StoredHostCredential {
  email: string;
  uid: string;
  cipherText: string;
  iv: string;
  authTag: string;
  updatedAt: number;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const HOST_CREDS_FILE = path.join(DATA_DIR, 'host_credentials.json');

function getFirebaseApiKey(): string {
  if (process.env.FIREBASE_API_KEY) return process.env.FIREBASE_API_KEY;
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed.apiKey || '';
  } catch {
    return '';
  }
}

function getVaultKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET || process.env.FIREBASE_PROJECT_ID || 'ulendo-malawi-host-credential-vault-key-v1';
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptPassword(plain: string): { cipherText: string; iv: string; authTag: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getVaultKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    cipherText: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

function decryptPassword(entry: StoredHostCredential): string | null {
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getVaultKey(),
      Buffer.from(entry.iv, 'base64')
    );
    decipher.setAuthTag(Buffer.from(entry.authTag, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(entry.cipherText, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

function loadHostVault(): Record<string, StoredHostCredential> {
  try {
    if (fs.existsSync(HOST_CREDS_FILE)) {
      return JSON.parse(fs.readFileSync(HOST_CREDS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.warn('[OnboardingEmail] Could not read host_credentials.json:', err);
  }
  return {};
}

function saveHostCredential(email: string, uid: string, password: string): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const vault = loadHostVault();
    const enc = encryptPassword(password);
    vault[email.toLowerCase()] = {
      email: email.toLowerCase(),
      uid,
      ...enc,
      updatedAt: Date.now(),
    };
    fs.writeFileSync(HOST_CREDS_FILE, JSON.stringify(vault, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[OnboardingEmail] Could not save host credential:', err);
  }
}

function generateTempPassword(): string {
  const code = crypto.randomInt(1000, 9999);
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `Ulendo-${code}${suffix}!`;
}

async function upsertHostUserDoc(uid: string, email: string, displayName: string, idToken: string): Promise<void> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = displayName.trim() || cleanEmail.split('@')[0] || 'Property Host';
    const body = {
      fields: {
        uid: { stringValue: uid },
        email: { stringValue: cleanEmail },
        displayName: { stringValue: cleanName },
        role: { stringValue: 'hotel_manager' },
        roles: {
          arrayValue: {
            values: [{ stringValue: 'traveller' }, { stringValue: 'hotel_manager' }],
          },
        },
        createdAt: { integerValue: String(Date.now()) },
      },
    };

    // Try creating the user document first
    const createRes = await fetch(
      `${FIRESTORE_BASE}/users?documentId=${encodeURIComponent(uid)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(6000),
      }
    );

    if (!createRes.ok && createRes.status === 409) {
      // Document already exists — patch role & roles to include hotel_manager
      await fetch(
        `${FIRESTORE_BASE}/users/${encodeURIComponent(uid)}?updateMask.fieldPaths=role&updateMask.fieldPaths=roles`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            fields: {
              role: { stringValue: 'hotel_manager' },
              roles: {
                arrayValue: {
                  values: [{ stringValue: 'traveller' }, { stringValue: 'hotel_manager' }],
                },
              },
            },
          }),
          signal: AbortSignal.timeout(6000),
        }
      );
    }
  } catch (err) {
    console.warn('[OnboardingEmail] Could not upsert Firestore host user profile:', err);
  }
}

export interface ProvisionedAccountInfo {
  email: string;
  uid?: string;
  createdNew: boolean;
  tempPassword?: string;
  resetLink?: string;
}

/**
 * Ensures a Firebase Auth account + Firestore `hotel_manager` profile exists for the email.
 * - If the email does not exist yet in Firebase Auth, creates it with a clean temporary password
 *   and initializes `users/{uid}` with `roles: ['traveller', 'hotel_manager']`.
 * - If the email already exists, checks if our stored initial password is still active (and optionally
 *   rotates it when requested via Forgot Password), or attempts to generate a direct reset link.
 */
export async function provisionOrVerifyHostAccount(
  rawEmail: string,
  displayName = 'Property Host',
  options?: { rotatePasswordIfStored?: boolean }
): Promise<ProvisionedAccountInfo> {
  const email = rawEmail.trim().toLowerCase();
  const apiKey = getFirebaseApiKey();
  const result: ProvisionedAccountInfo = { email, createdNew: false };

  if (!email || !email.includes('@') || !apiKey) {
    return result;
  }

  const candidatePassword = generateTempPassword();

  try {
    // 1. Attempt to create the Firebase Auth user via Identity Toolkit REST API
    const signUpRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: candidatePassword,
          displayName: displayName.trim() || email.split('@')[0],
          returnSecureToken: true,
        }),
        signal: AbortSignal.timeout(7000),
      }
    );

    const signUpData: any = await signUpRes.json();

    if (signUpRes.ok && signUpData?.localId && signUpData?.idToken) {
      result.createdNew = true;
      result.uid = signUpData.localId;
      result.tempPassword = candidatePassword;
      saveHostCredential(email, signUpData.localId, candidatePassword);
      await upsertHostUserDoc(signUpData.localId, email, displayName, signUpData.idToken);
      return result;
    }

    // 2. If account already exists, check if we have a valid initial credential stored
    const errMsg = String(signUpData?.error?.message || '');
    if (errMsg.includes('EMAIL_EXISTS')) {
      const vault = loadHostVault();
      const stored = vault[email];
      if (stored) {
        const storedPass = decryptPassword(stored);
        if (storedPass) {
          const signInRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email,
                password: storedPass,
                returnSecureToken: true,
              }),
              signal: AbortSignal.timeout(6000),
            }
          );
          const signInData: any = await signInRes.json();
          if (signInRes.ok && signInData?.idToken && signInData?.localId) {
            result.uid = signInData.localId;
            await upsertHostUserDoc(signInData.localId, email, displayName, signInData.idToken);

            if (options?.rotatePasswordIfStored) {
              const rotatedPassword = generateTempPassword();
              const updateRes = await fetch(
                `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${encodeURIComponent(apiKey)}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    idToken: signInData.idToken,
                    password: rotatedPassword,
                    returnSecureToken: true,
                  }),
                  signal: AbortSignal.timeout(6000),
                }
              );
              if (updateRes.ok) {
                saveHostCredential(email, signInData.localId, rotatedPassword);
                result.tempPassword = rotatedPassword;
              } else {
                result.tempPassword = storedPass;
              }
            } else {
              result.tempPassword = storedPass;
            }
          }
        }
      }

      // 3. Also try Firebase Admin SDK password reset link generation if service account / ADC is available
      try {
        const resetLink = await adminAuth().generatePasswordResetLink(email);
        if (resetLink) {
          result.resetLink = resetLink;
        }
      } catch {
        // Admin SDK generatePasswordResetLink requires service account credentials; ignore in local dev
      }
    }
  } catch (err) {
    console.warn('[OnboardingEmail] Account provisioning check warning:', err);
  }

  return result;
}

/**
 * Dispatches a single onboarding welcome & credentials email to a specific recipient (owner or manager).
 */
async function sendWelcomeEmailToRecipient(params: {
  recipientEmail: string;
  recipientName: string;
  roleLabel: string;
  hotelId: string;
  propertyName: string;
  location: string;
  baseUrl: string;
  domain: string;
}): Promise<{ success: boolean; messageId?: string; error?: string; createdAccount?: boolean }> {
  const {
    recipientEmail,
    recipientName,
    roleLabel,
    hotelId,
    propertyName,
    location,
    baseUrl,
    domain,
  } = params;

  const accountInfo = await provisionOrVerifyHostAccount(recipientEmail, recipientName);
  const encodedEmail = encodeURIComponent(recipientEmail);
  const dashboardUrl = `${baseUrl}/dashboard/hotel/${hotelId}?auth=signin&email=${encodedEmail}`;
  const previewUrl = `${baseUrl}/hotel/${hotelId}`;
  const resetUrl = accountInfo.resetLink || `${baseUrl}/?auth=reset&email=${encodedEmail}`;
  const profileUrl = `${baseUrl}/profile`;

  const subject = `Takulandirani! Login Credentials & Listing Preview — ${propertyName}`;

  const passwordPlainTextSection = accountInfo.tempPassword
    ? `   • Login Email: ${recipientEmail}\n   • Temporary Password: ${accountInfo.tempPassword}\n   (You can change this password anytime in Account Profile -> Security Settings at ${profileUrl})`
    : `   • Login Email: ${recipientEmail}\n   • Password: Use your existing Ulendo account password (or Google Sign-In).\n   • Need a new password? Reset instantly at: ${resetUrl}`;

  const plainText = `Dear ${recipientName},

Takulandirani! Thank you for onboarding ${propertyName} on Ulendo Travel Malawi — The Warm Heart of Africa.

Your property listing has been received and is currently in Pending Verification status (standard verification completes within 24 hours).
IMPORTANT: Even while your listing is Pending Verification, you can view your live property preview and manage all rooms, rates, and photos immediately!

Property Summary:
- Property Name: ${propertyName}
- Location: ${location}
- Listing ID: #${hotelId}
- Assigned Role: ${roleLabel}
- Current Status: Pending Review (Accessible Now in Preview & Management Hub)

Your Account Login Credentials:
${passwordPlainTextSection}

Direct Quick Links:
1. Manage Property & Rooms (Dashboard): ${dashboardUrl}
2. View Your Live Pending Listing Preview: ${previewUrl}
3. Forgot / Reset Password: ${resetUrl}
4. Account Profile & Security Settings: ${profileUrl}

If you have any questions or need assistance, reply directly to this email or reach us at ${DEFAULT_PLATFORM_EMAIL}.

Warm hospitality regards,
The Ulendo Travel Malawi Team
${baseUrl}
`;

  const passwordHtmlBlock = accountInfo.tempPassword
    ? `
      <div style="background: #ffffff; border: 1px solid #e7e5e4; border-radius: 10px; padding: 14px 16px; margin-bottom: 14px;">
        <div style="margin-bottom: 10px;">
          <div style="font-size: 11px; color: #78716c; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Registered Login Email</div>
          <div style="font-size: 15px; font-weight: 700; color: #1c1917; margin-top: 2px;">${escapeHtml(recipientEmail)}</div>
        </div>
        <div style="padding-top: 10px; border-top: 1px dashed #e7e5e4;">
          <div style="font-size: 11px; color: #78716c; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">
            ${accountInfo.createdNew ? 'Your Generated Temporary Password' : 'Your Active Temporary Password'}
          </div>
          <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 16px; font-weight: 800; color: #047857; background: #ecfdf5; border: 1px solid #a7f3d0; display: inline-block; padding: 4px 10px; border-radius: 6px; margin-top: 4px; letter-spacing: 0.04em;">
            ${escapeHtml(accountInfo.tempPassword)}
          </div>
          <div style="font-size: 11px; color: #57534e; margin-top: 6px;">
            Sign in with the email and password above. You can set your own personal password anytime in <a href="${escapeHtml(profileUrl)}" style="color: #b45309; font-weight: 600; text-decoration: underline;">Account Profile &rarr; Security</a>.
          </div>
        </div>
      </div>
    `
    : `
      <div style="background: #ffffff; border: 1px solid #e7e5e4; border-radius: 10px; padding: 14px 16px; margin-bottom: 14px;">
        <div style="margin-bottom: 8px;">
          <div style="font-size: 11px; color: #78716c; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Registered Login Email</div>
          <div style="font-size: 15px; font-weight: 700; color: #1c1917; margin-top: 2px;">${escapeHtml(recipientEmail)}</div>
        </div>
        <div style="padding-top: 8px; border-top: 1px dashed #e7e5e4; font-size: 12px; color: #57534e; line-height: 1.5;">
          <strong>Password:</strong> Sign in with your existing Ulendo password or click <strong>Continue with Google</strong>.<br/>
          Need to set or reset your password? <a href="${escapeHtml(resetUrl)}" style="color: #b45309; font-weight: 700; text-decoration: underline;">Click here to reset your password</a>.
        </div>
      </div>
    `;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 0; border: 1px solid #e7e5e4; border-radius: 16px; background: #ffffff; color: #1c1917; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
      <!-- Header Banner -->
      <div style="background: linear-gradient(135deg, #1c1917 0%, #292524 60%, #44403c 100%); padding: 32px 28px; text-align: center; color: #ffffff;">
        <div style="display: inline-block; padding: 5px 14px; background: rgba(245, 158, 11, 0.2); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #fef3c7; margin-bottom: 12px;">
          The Warm Heart of Africa
        </div>
        <h1 style="margin: 0 0 6px; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">
          Ulendo Travel Malawi
        </h1>
        <p style="margin: 0; font-size: 13px; color: #d6d3d1;">
          Direct Booking &amp; Hospitality Operations Platform
        </p>
      </div>

      <!-- Welcome Message -->
      <div style="padding: 28px 24px 20px;">
        <h2 style="margin: 0 0 10px; font-size: 19px; font-weight: 700; color: #1c1917;">
          Takulandirani, ${escapeHtml(recipientName)}!
        </h2>
        <p style="margin: 0 0 18px; font-size: 14px; line-height: 1.6; color: #44403c;">
          Your property listing for <strong>${escapeHtml(propertyName)}</strong> has been onboarded on <strong>Ulendo Travel Malawi</strong>. Even while our team completes standard verification, <strong>you can view your live listing preview and manage your property right now</strong>.
        </p>

        <!-- Property Summary Card -->
        <div style="background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 12px; padding: 18px; margin-bottom: 22px;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #78716c; margin-bottom: 10px;">
            Property Onboarding Summary
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr>
              <td style="padding: 6px 0; color: #78716c; width: 130px;">Property Name:</td>
              <td style="padding: 6px 0; font-weight: 700; color: #1c1917;">${escapeHtml(propertyName)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #78716c;">Location:</td>
              <td style="padding: 6px 0; color: #292524;">${escapeHtml(location)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #78716c;">Listing ID:</td>
              <td style="padding: 6px 0; font-family: monospace; font-weight: 700; color: #b45309;">#${escapeHtml(hotelId)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #78716c;">Account Role:</td>
              <td style="padding: 6px 0; font-weight: 600; color: #1c1917;">${escapeHtml(roleLabel)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #78716c;">Listing Status:</td>
              <td style="padding: 6px 0;">
                <span style="display: inline-block; padding: 3px 10px; background: #fef3c7; color: #92400e; font-size: 12px; font-weight: 600; border-radius: 9999px;">
                  Pending Verification &bull; Live Preview Ready
                </span>
              </td>
            </tr>
          </table>
        </div>

        <!-- Login Credentials & Direct Access Card -->
        <div style="background: #fdfaf6; border: 1px solid #fed7aa; border-radius: 12px; padding: 20px; margin-bottom: 22px;">
          <h3 style="margin: 0 0 8px; font-size: 15px; font-weight: 700; color: #9a3412;">
            Your Login Credentials &amp; Instant Access
          </h3>
          <p style="margin: 0 0 12px; font-size: 13px; line-height: 1.5; color: #57534e;">
            Use the credentials below to sign in, view your pending listing, and manage rooms, rates, and bookings:
          </p>

          ${passwordHtmlBlock}

          <div style="text-align: center; margin-top: 16px;">
            <a href="${escapeHtml(dashboardUrl)}" style="display: inline-block; padding: 12px 22px; background: #1c1917; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; border-radius: 10px; margin: 4px;">
              Sign In &amp; Manage Property &rarr;
            </a>
            <a href="${escapeHtml(previewUrl)}" style="display: inline-block; padding: 12px 22px; background: #047857; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; border-radius: 10px; margin: 4px;">
              View Pending Listing Preview &rarr;
            </a>
          </div>
        </div>

        <!-- Account Management & Password Recovery Info -->
        <div style="background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 12px; padding: 16px 18px; margin-bottom: 18px;">
          <h4 style="margin: 0 0 8px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #44403c;">
            Account Management &amp; Password Recovery
          </h4>
          <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #57534e; line-height: 1.6;">
            <li><strong>View Listing Anytime:</strong> Your preview link (<a href="${escapeHtml(previewUrl)}" style="color: #047857; text-decoration: underline;">/hotel/${escapeHtml(hotelId)}</a>) works immediately even while pending verification.</li>
            <li><strong>Forgot Password:</strong> Need a password reset link at any time? Use <a href="${escapeHtml(resetUrl)}" style="color: #b45309; text-decoration: underline;">Forgot Password</a> on the login window for an instant email reset.</li>
            <li><strong>Profile &amp; Security Settings:</strong> Update your password, phone, WhatsApp alerts, and preferred currency in <a href="${escapeHtml(profileUrl)}" style="color: #1c1917; text-decoration: underline;">Account Profile</a>.</li>
          </ul>
        </div>
      </div>

      <!-- Footer -->
      <div style="background: #fafaf9; border-top: 1px solid #e7e5e4; padding: 20px 24px; text-align: center; font-size: 11px; color: #78716c; line-height: 1.5;">
        <p style="margin: 0 0 4px; font-weight: 600; color: #44403c;">
          Ulendo Travel Malawi &bull; Connecting Travelers Directly with Malawi's Finest Hospitality
        </p>
        <p style="margin: 0;">
          Need help? Contact support at <a href="mailto:${escapeHtml(DEFAULT_PLATFORM_EMAIL)}" style="color: #b45309; text-decoration: none;">${escapeHtml(DEFAULT_PLATFORM_EMAIL)}</a> &bull; <a href="${escapeHtml(baseUrl)}" style="color: #78716c; text-decoration: none;">${escapeHtml(domain)}</a>
        </p>
      </div>
    </div>
  `;

  try {
    const result = await sendSystemEmail({
      to: recipientEmail,
      subject,
      text: plainText,
      html,
    });
    return { ...result, createdAccount: accountInfo.createdNew };
  } catch (err: any) {
    console.error('[OnboardingEmail] Failed to dispatch welcome email:', err);
    return { success: false, error: err?.message || 'Failed to dispatch welcome email.' };
  }
}

/**
 * Sends a welcome email immediately upon successful property onboarding submission,
 * auto-provisioning Firebase Auth + `hotel_manager` profile credentials for the owner
 * (and manager, if distinct) so they can sign in and view their pending listing right away.
 */
export async function sendOnboardingWelcomeEmail(data: OnboardingWelcomeData): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
  recipients?: string[];
}> {
  const ownerEmail = data.ownerEmail?.trim().toLowerCase() || '';
  const managerEmail = data.managerEmail?.trim().toLowerCase() || '';
  const primaryEmail = ownerEmail || managerEmail;

  if (!primaryEmail || !primaryEmail.includes('@')) {
    return { success: false, error: 'No valid owner or manager email provided.' };
  }

  const domain = DEFAULT_PLATFORM_DOMAIN || 'ulendomalawi.com';
  const baseUrl = data.origin && data.origin.startsWith('http')
    ? data.origin.replace(/\/$/, '')
    : `https://${domain}`;

  const propertyName = data.propertyName?.trim() || 'Your Property';
  const ownerName = data.ownerName?.trim() || 'Valued Property Owner';
  const managerName = data.managerName?.trim() || data.ownerName?.trim() || 'Property Manager';
  const location = data.location?.trim() || 'Malawi';
  const hotelId = data.hotelId;

  const recipientsSent: string[] = [];
  const primaryRes = await sendWelcomeEmailToRecipient({
    recipientEmail: primaryEmail,
    recipientName: ownerName,
    roleLabel: ownerEmail && managerEmail && ownerEmail === managerEmail
      ? 'Property Owner & Manager'
      : ownerEmail
        ? 'Property Owner / Host'
        : 'Designated Property Manager',
    hotelId,
    propertyName,
    location,
    baseUrl,
    domain,
  });

  if (primaryRes.success) {
    recipientsSent.push(primaryEmail);
  }

  // If a separate managerEmail was also specified, provision and email the manager too
  if (managerEmail && managerEmail.includes('@') && managerEmail !== primaryEmail) {
    const mgrRes = await sendWelcomeEmailToRecipient({
      recipientEmail: managerEmail,
      recipientName: managerName,
      roleLabel: 'Designated Property Manager',
      hotelId,
      propertyName,
      location,
      baseUrl,
      domain,
    });
    if (mgrRes.success) {
      recipientsSent.push(managerEmail);
    }
  }

  return {
    success: primaryRes.success,
    messageId: primaryRes.messageId,
    error: primaryRes.error,
    recipients: recipientsSent,
  };
}

/**
 * Handles Forgot Password via our saved SMTP server:
 * - If the email belongs to a property owner/manager in Firestore who never had a Firebase Auth
 *   account created yet, auto-creates their Firebase Auth account with a temporary password!
 * - If the account was provisioned by Ulendo and still uses a managed credential, rotates to a fresh
 *   temporary password and sends it via SMTP so the user can log in immediately.
 * - Also triggers Firebase's password reset link (and includes the direct link if Admin SDK ADC is active).
 */
export async function sendSmtpPasswordResetEmail(
  rawEmail: string,
  origin?: string
): Promise<{ success: boolean; emailSent: boolean }> {
  const cleanEmail = rawEmail.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, emailSent: false };
  }

  const domain = DEFAULT_PLATFORM_DOMAIN || 'ulendomalawi.com';
  const baseUrl = origin && origin.startsWith('http')
    ? origin.replace(/\/$/, '')
    : `https://${domain}`;

  // Check if this email is associated with any hotel in Firestore (ownerEmail, managerEmail, contactEmail)
  let associatedHotel: Record<string, any> | null = null;
  try {
    const [byOwner, byManager, byContact] = await Promise.all([
      queryDocs('hotels', 'ownerEmail', cleanEmail, undefined, 1),
      queryDocs('hotels', 'managerEmail', cleanEmail, undefined, 1),
      queryDocs('hotels', 'contactEmail', cleanEmail, undefined, 1),
    ]);
    associatedHotel = byOwner[0] || byManager[0] || byContact[0] || null;
  } catch {
    // Non-fatal
  }

  // If they are a hotel owner/manager or exist in our host vault, ensure their account is provisioned/rotated
  const vault = loadHostVault();
  let accountInfo: ProvisionedAccountInfo = { email: cleanEmail, createdNew: false };
  if (associatedHotel || vault[cleanEmail]) {
    const displayName =
      associatedHotel?.ownerName ||
      associatedHotel?.managerName ||
      cleanEmail.split('@')[0];
    accountInfo = await provisionOrVerifyHostAccount(cleanEmail, displayName, {
      rotatePasswordIfStored: true,
    });
  } else {
    try {
      const link = await adminAuth().generatePasswordResetLink(cleanEmail);
      if (link) accountInfo.resetLink = link;
    } catch {
      // Ignore when service account is not attached
    }
  }

  // Also trigger Firebase Identity Toolkit PASSWORD_RESET OOB email if we didn't just rotate/create a temp password
  const apiKey = getFirebaseApiKey();
  if (apiKey && !accountInfo.tempPassword) {
    fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType: 'PASSWORD_RESET', email: cleanEmail }),
        signal: AbortSignal.timeout(5000),
      }
    ).catch(() => {});
  }

  const encodedEmail = encodeURIComponent(cleanEmail);
  const signInUrl = associatedHotel?.id
    ? `${baseUrl}/dashboard/hotel/${associatedHotel.id}?auth=signin&email=${encodedEmail}`
    : `${baseUrl}/?auth=signin&email=${encodedEmail}`;
  const actionUrl = accountInfo.resetLink || signInUrl;

  const tempPassText = accountInfo.tempPassword
    ? `\nYour New Temporary Password: ${accountInfo.tempPassword}\nSign in directly at: ${signInUrl}\n(After signing in, you can set a custom password in Account Profile -> Security Settings at ${baseUrl}/profile)\n`
    : accountInfo.resetLink
      ? `\nClick the link below to set a new password:\n${accountInfo.resetLink}\n`
      : `\nPlease check your inbox for the verification link, or sign in at: ${signInUrl}\n`;

  const result = await sendSystemEmail({
    to: cleanEmail,
    subject: 'Password Reset & Account Access — Ulendo Travel Malawi',
    text: `Hello,\n\nA password reset was requested for your Ulendo Travel Malawi account (${cleanEmail}).\n${tempPassText}\nIf you did not request this change, please contact us at ${DEFAULT_PLATFORM_EMAIL}.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 28px 24px; border: 1px solid #e7e5e4; border-radius: 14px; background: #ffffff; color: #1c1917;">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #78716c; margin-bottom: 6px;">
          Ulendo Travel Malawi
        </div>
        <h2 style="margin: 0 0 6px; font-size: 20px; font-weight: 700; color: #1c1917;">Password Reset &amp; Account Recovery</h2>
        <p style="margin: 0 0 16px; font-size: 13px; color: #78716c;">Account Security &bull; ${escapeHtml(domain)}</p>
        <p style="margin: 0 0 14px; font-size: 14px; line-height: 1.5; color: #44403c;">
          A password reset request was received for <strong>${escapeHtml(cleanEmail)}</strong>.
        </p>

        ${accountInfo.tempPassword ? `
          <div style="background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 10px; padding: 16px; margin-bottom: 18px;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #78716c;">
              Your Temporary Recovery Password
            </div>
            <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 17px; font-weight: 800; color: #047857; background: #ecfdf5; border: 1px solid #a7f3d0; display: inline-block; padding: 5px 12px; border-radius: 6px; margin-top: 6px; letter-spacing: 0.04em;">
              ${escapeHtml(accountInfo.tempPassword)}
            </div>
            <p style="margin: 8px 0 0; font-size: 12px; color: #57534e; line-height: 1.5;">
              Use this password with <strong>${escapeHtml(cleanEmail)}</strong> to sign in immediately. Once signed in, you can choose your own custom password under <strong>Profile Settings &rarr; Security &amp; Password</strong>.
            </p>
          </div>
        ` : accountInfo.resetLink ? `
          <p style="margin: 0 0 16px; font-size: 13px; color: #57534e; line-height: 1.6;">
            Click the button below to choose a new password for your account:
          </p>
        ` : `
          <p style="margin: 0 0 16px; font-size: 13px; color: #57534e; line-height: 1.6;">
            Please use the verification link sent to your inbox to choose a new password, or click below to return to the sign-in screen.
          </p>
        `}

        <div style="margin: 18px 0;">
          <a href="${escapeHtml(actionUrl)}" style="display: inline-block; padding: 12px 22px; background: #1c1917; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; border-radius: 10px;">
            ${accountInfo.resetLink ? 'Set New Password &rarr;' : 'Sign In to Your Account &rarr;'}
          </a>
        </div>

        <div style="margin-top: 24px; padding-top: 14px; border-top: 1px solid #f5f5f4; font-size: 11px; color: #a8a29e; text-align: center;">
          Ulendo Travel Malawi &bull; <a href="${escapeHtml(baseUrl)}" style="color: #78716c; text-decoration: none;">${escapeHtml(domain)}</a> &bull; <a href="mailto:${escapeHtml(DEFAULT_PLATFORM_EMAIL)}" style="color: #78716c; text-decoration: none;">${escapeHtml(DEFAULT_PLATFORM_EMAIL)}</a>
        </div>
      </div>
    `,
  });

  return { success: true, emailSent: result.success };
}
