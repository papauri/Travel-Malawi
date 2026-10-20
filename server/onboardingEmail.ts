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

/**
 * Base URL for links in account emails. The origin comes from request
 * headers, so only the platform domain (and subdomains), localhost and the
 * host named in APP_URL are trusted; anything else falls back to the platform
 * domain so a forged header cannot point a password email at another site.
 */
export function resolveBaseUrl(origin: string | undefined, domain: string): string {
  const fallback = `https://${domain}`;
  if (!origin) return fallback;
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return fallback;
    const host = url.hostname.toLowerCase();
    let appHost = '';
    try { appHost = process.env.APP_URL ? new URL(process.env.APP_URL).hostname.toLowerCase() : ''; } catch { /* ignore */ }
    const trusted =
      host === domain || host.endsWith(`.${domain}`) ||
      host === 'localhost' || host === '127.0.0.1' ||
      (!!appHost && host === appHost);
    return trusted ? url.origin : fallback;
  } catch {
    return fallback;
  }
}

// Earlier versions kept a reversible temp-password vault in
// data/host_credentials.json. Passwords are no longer generated for email,
// stored or re-sent; that file (if present) is ignored and left untouched.

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

/**
 * Throwaway password for the sign-up call only: 256 random bits, never stored,
 * logged or emailed. The host sets their real password through the reset link.
 */
function generateUnusablePassword(): string {
  return `${crypto.randomBytes(32).toString('base64url')}!Aa1`;
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
}

/**
 * Ensures a Firebase Auth account + Firestore `hotel_manager` profile exists for the email.
 * A new account gets a random throwaway password nobody knows; the host chooses their own
 * password through the set-your-password (reset) link we email. Existing accounts are untouched.
 */
export async function provisionHostAccount(
  rawEmail: string,
  displayName = 'Property Host'
): Promise<ProvisionedAccountInfo> {
  const email = rawEmail.trim().toLowerCase();
  const apiKey = getFirebaseApiKey();
  const result: ProvisionedAccountInfo = { email, createdNew: false };
  if (!email || !email.includes('@') || !apiKey) return result;

  try {
    const signUpRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: generateUnusablePassword(),
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
      await upsertHostUserDoc(signUpData.localId, email, displayName, signUpData.idToken);
    }
    // EMAIL_EXISTS: the account already exists; the host simply gets a reset link.
  } catch (err) {
    console.warn('[OnboardingEmail] Account provisioning warning:', err);
  }
  return result;
}

/**
 * Server-side set-your-password link from the Admin SDK that returns the user to
 * `continueUrl` (always built from resolveBaseUrl, so on an allowlisted host).
 * Without Admin SDK credentials Firebase is asked to send its own reset email
 * and null is returned (our email then links to the in-app Forgot Password screen).
 */
export async function generateHostResetLink(email: string, continueUrl: string): Promise<string | null> {
  try {
    return await adminAuth().generatePasswordResetLink(email, { url: continueUrl });
  } catch {
    // continueUrl domain not authorised in Firebase → retry with Firebase's default landing page.
    try {
      return await adminAuth().generatePasswordResetLink(email);
    } catch {
      // No service account / ADC (local dev) or unknown user.
    }
  }
  const apiKey = getFirebaseApiKey();
  if (apiKey) {
    fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: 'PASSWORD_RESET', email, continueUrl }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  }
  return null;
}

async function findHotelByEmail(cleanEmail: string): Promise<Record<string, any> | null> {
  try {
    const [byOwner, byManager, byContact] = await Promise.all([
      queryDocs('hotels', 'ownerEmail', cleanEmail, undefined, 1),
      queryDocs('hotels', 'managerEmail', cleanEmail, undefined, 1),
      queryDocs('hotels', 'contactEmail', cleanEmail, undefined, 1),
    ]);
    return byOwner[0] || byManager[0] || byContact[0] || null;
  } catch {
    return null;
  }
}

/** Side effects used by the email senders; tests inject stubs. */
export interface OnboardingDeps {
  sendEmail: (options: { to: string; subject: string; html: string; text?: string }) => Promise<{ success: boolean; messageId?: string; error?: string }>;
  provisionAccount: (email: string, displayName: string) => Promise<ProvisionedAccountInfo>;
  generateResetLink: (email: string, continueUrl: string) => Promise<string | null>;
  findHotelByEmail: (email: string) => Promise<Record<string, any> | null>;
}

const defaultDeps: OnboardingDeps = {
  sendEmail: sendSystemEmail,
  provisionAccount: provisionHostAccount,
  generateResetLink: generateHostResetLink,
  findHotelByEmail,
};

/** Links used by the welcome email; dashboardUrl doubles as the reset link's continueUrl. */
export function welcomeEmailLinks(baseUrl: string, hotelId: string, recipientEmail: string) {
  const encodedEmail = encodeURIComponent(recipientEmail);
  // 'host-onboarding' is the placeholder used when the host has no property
  // yet; /hotel/host-onboarding would be a dead link, so point at the dashboard.
  const hasProperty = Boolean(hotelId) && hotelId !== 'host-onboarding';
  const safeHotelId = encodeURIComponent(hotelId);
  return {
    dashboardUrl: hasProperty
      ? `${baseUrl}/dashboard/hotel/${safeHotelId}?auth=signin&email=${encodedEmail}`
      : `${baseUrl}/dashboard?auth=signin&email=${encodedEmail}`,
    previewUrl: hasProperty ? `${baseUrl}/hotel/${safeHotelId}` : `${baseUrl}/dashboard`,
    forgotUrl: `${baseUrl}/?auth=reset&email=${encodedEmail}`,
    profileUrl: `${baseUrl}/profile`,
  };
}

export interface WelcomeEmailParams {
  recipientEmail: string;
  recipientName: string;
  roleLabel: string;
  hotelId: string;
  propertyName: string;
  location: string;
  baseUrl: string;
  domain: string;
  /** Set-your-password link, or null when it could not be generated server-side. */
  resetLink: string | null;
  createdNew: boolean;
}

/**
 * Built without the platform mode, so it always uses directory wording (D3):
 * no bookings, payments or in-app messages are promised to the host.
 */
const DIRECTORY_NOTE_TEXT =
  'Travel Malawi does not take bookings or payments. Travellers contact you directly using the phone, WhatsApp or email on your listing, so keep them up to date.';

/** Pure builder for the welcome email: no I/O, never includes a password. */
export function buildWelcomeEmail(params: WelcomeEmailParams): { subject: string; text: string; html: string } {
  const {
    recipientEmail,
    recipientName,
    roleLabel,
    hotelId,
    propertyName,
    location,
    baseUrl,
    domain,
    resetLink,
    createdNew,
  } = params;
  const { dashboardUrl, previewUrl, forgotUrl, profileUrl } = welcomeEmailLinks(baseUrl, hotelId, recipientEmail);
  const setPasswordUrl = resetLink || forgotUrl;

  const subject = `Takulandirani! Set Your Password & Listing Preview — ${propertyName}`;

  const accessPlainTextSection = createdNew
    ? `   • Login Email: ${recipientEmail}\n   • We created your Ulendo host account. Choose your password here: ${setPasswordUrl}\n${resetLink ? '   (This link expires after a while; if it has, use Forgot Password at ' + forgotUrl + ')\n' : '   (We also sent a separate set-password email from our sign-in system.)\n'}`
    : `   • Login Email: ${recipientEmail}\n   • Sign in with your existing Ulendo password (or Google Sign-In).\n   • Need to set or reset your password? ${setPasswordUrl}\n`;

  const plainText = `Dear ${recipientName},

Takulandirani! Thank you for onboarding ${propertyName} on Ulendo Travel Malawi — The Warm Heart of Africa.

Your property listing has been received and is waiting for review (our team usually reviews listings within 24 hours).
Even while your listing is waiting for review, you can view your property preview and manage your rooms, rates and photos.

${DIRECTORY_NOTE_TEXT}

Property Summary:
- Property Name: ${propertyName}
- Location: ${location}
- Listing ID: #${hotelId}
- Assigned Role: ${roleLabel}
- Current Status: Waiting for review (preview and dashboard available now)

Your Account Access:
${accessPlainTextSection}
Direct Quick Links:
1. Set Your Password (secure link): ${setPasswordUrl}
2. Manage Property & Rooms (Dashboard): ${dashboardUrl}
3. View Your Live Pending Listing Preview: ${previewUrl}
4. Account Profile & Security Settings: ${profileUrl}

If you have any questions or need assistance, reply directly to this email or reach us at ${DEFAULT_PLATFORM_EMAIL}.

Warm hospitality regards,
The Ulendo Travel Malawi Team
${baseUrl}
`;

  const accessHtmlBlock = `
      <div style="background: #ffffff; border: 1px solid #e7e5e4; border-radius: 10px; padding: 14px 16px; margin-bottom: 14px;">
        <div style="margin-bottom: 8px;">
          <div style="font-size: 11px; color: #78716c; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Registered Login Email</div>
          <div style="font-size: 15px; font-weight: 700; color: #1c1917; margin-top: 2px;">${escapeHtml(recipientEmail)}</div>
        </div>
        <div style="padding-top: 8px; border-top: 1px dashed #e7e5e4; font-size: 12px; color: #57534e; line-height: 1.5;">
          ${createdNew
            ? `We created your Ulendo host account. <strong>Choose your own password</strong> with the button below, then sign in to manage your property.${resetLink ? '' : '<br/>We have also sent a separate set-password email from our sign-in system.'}`
            : `Sign in with your existing Ulendo password or click <strong>Continue with Google</strong>. Need to set or reset your password? Use the button below.`}
        </div>
        <div style="margin-top: 12px;">
          <a href="${escapeHtml(setPasswordUrl)}" style="display: inline-block; padding: 10px 18px; background: #b45309; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; border-radius: 10px;">
            Set Your Password &rarr;
          </a>
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
          Discover places to stay across Malawi
        </p>
      </div>

      <!-- Welcome Message -->
      <div style="padding: 28px 24px 20px;">
        <h2 style="margin: 0 0 10px; font-size: 19px; font-weight: 700; color: #1c1917;">
          Takulandirani, ${escapeHtml(recipientName)}!
        </h2>
        <p style="margin: 0 0 18px; font-size: 14px; line-height: 1.6; color: #44403c;">
          Your property listing for <strong>${escapeHtml(propertyName)}</strong> has been received on <strong>Ulendo Travel Malawi</strong>. While our team reviews it, <strong>you can view your listing preview and manage your property right now</strong>.
        </p>

        <p style="margin: 0 0 18px; font-size: 13px; line-height: 1.6; color: #57534e;">
          ${escapeHtml(DIRECTORY_NOTE_TEXT)}
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
                  Waiting for review &bull; Preview ready
                </span>
              </td>
            </tr>
          </table>
        </div>

        <!-- Account Access Card -->
        <div style="background: #fdfaf6; border: 1px solid #fed7aa; border-radius: 12px; padding: 20px; margin-bottom: 22px;">
          <h3 style="margin: 0 0 8px; font-size: 15px; font-weight: 700; color: #9a3412;">
            Your Account &amp; Instant Access
          </h3>
          <p style="margin: 0 0 12px; font-size: 13px; line-height: 1.5; color: #57534e;">
            Sign in to view your pending listing and manage your rooms, rates and listing details:
          </p>

          ${accessHtmlBlock}

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
            <li><strong>View Listing Anytime:</strong> Your preview link (<a href="${escapeHtml(previewUrl)}" style="color: #047857; text-decoration: underline;">${escapeHtml(previewUrl.slice(baseUrl.length))}</a>) works now, even while your listing is waiting for review.</li>
            <li><strong>Forgot Password:</strong> Need a password reset link at any time? Use <a href="${escapeHtml(forgotUrl)}" style="color: #b45309; text-decoration: underline;">Forgot Password</a> on the login window for an instant email reset.</li>
            <li><strong>Profile &amp; Security Settings:</strong> Update your password, phone and preferred currency in <a href="${escapeHtml(profileUrl)}" style="color: #1c1917; text-decoration: underline;">Account Profile</a>.</li>
          </ul>
        </div>
      </div>

      <!-- Footer -->
      <div style="background: #fafaf9; border-top: 1px solid #e7e5e4; padding: 20px 24px; text-align: center; font-size: 11px; color: #78716c; line-height: 1.5;">
        <p style="margin: 0 0 4px; font-weight: 600; color: #44403c;">
          Ulendo Travel Malawi &bull; Discover places to stay in the Warm Heart of Africa
        </p>
        <p style="margin: 0;">
          Need help? Contact support at <a href="mailto:${escapeHtml(DEFAULT_PLATFORM_EMAIL)}" style="color: #b45309; text-decoration: none;">${escapeHtml(DEFAULT_PLATFORM_EMAIL)}</a> &bull; <a href="${escapeHtml(baseUrl)}" style="color: #78716c; text-decoration: none;">${escapeHtml(domain)}</a>
        </p>
      </div>
    </div>
  `;

  return { subject, text: plainText, html };
}

/**
 * Provisions (or finds) the recipient's account, generates a set-your-password
 * link server-side and sends the welcome email. No password is ever emailed.
 */
async function sendWelcomeEmailToRecipient(
  params: Omit<WelcomeEmailParams, 'resetLink' | 'createdNew'>,
  deps: OnboardingDeps
): Promise<{ success: boolean; messageId?: string; error?: string; createdAccount?: boolean }> {
  try {
    const accountInfo = await deps.provisionAccount(params.recipientEmail, params.recipientName);
    const { dashboardUrl } = welcomeEmailLinks(params.baseUrl, params.hotelId, params.recipientEmail);
    const resetLink = await deps.generateResetLink(params.recipientEmail, dashboardUrl);
    const email = buildWelcomeEmail({ ...params, resetLink, createdNew: accountInfo.createdNew });
    const result = await deps.sendEmail({ to: params.recipientEmail, ...email });
    return { ...result, createdAccount: accountInfo.createdNew };
  } catch (err: any) {
    console.error('[OnboardingEmail] Failed to dispatch welcome email:', err);
    return { success: false, error: err?.message || 'Failed to dispatch welcome email.' };
  }
}

/**
 * Sends a welcome email immediately upon successful property onboarding submission,
 * auto-provisioning a Firebase Auth account + `hotel_manager` profile for the owner
 * (and manager, if distinct) with a set-your-password link instead of a password.
 */
export async function sendOnboardingWelcomeEmail(data: OnboardingWelcomeData, overrides: Partial<OnboardingDeps> = {}): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
  recipients?: string[];
}> {
  const deps: OnboardingDeps = { ...defaultDeps, ...overrides };
  const ownerEmail = data.ownerEmail?.trim().toLowerCase() || '';
  const managerEmail = data.managerEmail?.trim().toLowerCase() || '';
  const primaryEmail = ownerEmail || managerEmail;

  if (!primaryEmail || !primaryEmail.includes('@')) {
    return { success: false, error: 'No valid owner or manager email provided.' };
  }

  const domain = DEFAULT_PLATFORM_DOMAIN || 'ulendomalawi.com';
  const baseUrl = resolveBaseUrl(data.origin, domain);

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
  }, deps);

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
    }, deps);
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

/** Pure builder for the password-reset email: no I/O, never includes a password. */
export function buildPasswordResetEmail(params: {
  email: string;
  baseUrl: string;
  domain: string;
  resetLink: string | null;
  signInUrl: string;
}): { subject: string; text: string; html: string } {
  const { email, baseUrl, domain, resetLink, signInUrl } = params;
  const actionUrl = resetLink || signInUrl;
  const bodyText = resetLink
    ? `\nClick the link below to set a new password:\n${resetLink}\n`
    : `\nPlease use the password reset link sent to your inbox, or sign in at: ${signInUrl}\n`;

  return {
    subject: 'Password Reset & Account Access — Ulendo Travel Malawi',
    text: `Hello,\n\nA password reset was requested for your Ulendo Travel Malawi account (${email}).\n${bodyText}\nIf you did not request this change, you can ignore this email or contact us at ${DEFAULT_PLATFORM_EMAIL}.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 28px 24px; border: 1px solid #e7e5e4; border-radius: 14px; background: #ffffff; color: #1c1917;">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #78716c; margin-bottom: 6px;">
          Ulendo Travel Malawi
        </div>
        <h2 style="margin: 0 0 6px; font-size: 20px; font-weight: 700; color: #1c1917;">Password Reset &amp; Account Recovery</h2>
        <p style="margin: 0 0 16px; font-size: 13px; color: #78716c;">Account Security &bull; ${escapeHtml(domain)}</p>
        <p style="margin: 0 0 14px; font-size: 14px; line-height: 1.5; color: #44403c;">
          A password reset request was received for <strong>${escapeHtml(email)}</strong>.
        </p>

        <p style="margin: 0 0 16px; font-size: 13px; color: #57534e; line-height: 1.6;">
          ${resetLink
            ? 'Click the button below to choose a new password for your account:'
            : 'Please use the password reset link sent to your inbox to choose a new password, or click below to return to the sign-in screen.'}
        </p>

        <div style="margin: 18px 0;">
          <a href="${escapeHtml(actionUrl)}" style="display: inline-block; padding: 12px 22px; background: #1c1917; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; border-radius: 10px;">
            ${resetLink ? 'Set New Password &rarr;' : 'Sign In to Your Account &rarr;'}
          </a>
        </div>

        <p style="margin: 0; font-size: 12px; color: #78716c; line-height: 1.5;">
          If you did not request this change, you can ignore this email.
        </p>

        <div style="margin-top: 24px; padding-top: 14px; border-top: 1px solid #f5f5f4; font-size: 11px; color: #a8a29e; text-align: center;">
          Ulendo Travel Malawi &bull; <a href="${escapeHtml(baseUrl)}" style="color: #78716c; text-decoration: none;">${escapeHtml(domain)}</a> &bull; <a href="mailto:${escapeHtml(DEFAULT_PLATFORM_EMAIL)}" style="color: #78716c; text-decoration: none;">${escapeHtml(DEFAULT_PLATFORM_EMAIL)}</a>
        </div>
      </div>
    `,
  };
}

/**
 * Handles Forgot Password via our saved SMTP server:
 * - If the email belongs to a property owner/manager in Firestore who has no Firebase Auth
 *   account yet, the account is created (with no usable password).
 * - In every case a set-your-password link is generated server-side and emailed; no
 *   password is ever generated for, stored for or sent to the user.
 */
export async function sendSmtpPasswordResetEmail(
  rawEmail: string,
  origin?: string,
  overrides: Partial<OnboardingDeps> = {}
): Promise<{ success: boolean; emailSent: boolean }> {
  const deps: OnboardingDeps = { ...defaultDeps, ...overrides };
  const cleanEmail = rawEmail.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, emailSent: false };
  }

  const domain = DEFAULT_PLATFORM_DOMAIN || 'ulendomalawi.com';
  const baseUrl = resolveBaseUrl(origin, domain);

  const associatedHotel = await deps.findHotelByEmail(cleanEmail);
  if (associatedHotel) {
    const displayName =
      associatedHotel.ownerName ||
      associatedHotel.managerName ||
      cleanEmail.split('@')[0];
    await deps.provisionAccount(cleanEmail, displayName);
  }

  const encodedEmail = encodeURIComponent(cleanEmail);
  const signInUrl = associatedHotel?.id
    ? `${baseUrl}/dashboard/hotel/${encodeURIComponent(associatedHotel.id)}?auth=signin&email=${encodedEmail}`
    : `${baseUrl}/?auth=signin&email=${encodedEmail}`;
  const resetLink = await deps.generateResetLink(cleanEmail, signInUrl);

  const email = buildPasswordResetEmail({ email: cleanEmail, baseUrl, domain, resetLink, signInUrl });
  const result = await deps.sendEmail({ to: cleanEmail, ...email });

  return { success: true, emailSent: result.success };
}
