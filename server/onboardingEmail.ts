import { sendSystemEmail, DEFAULT_PLATFORM_DOMAIN, DEFAULT_PLATFORM_EMAIL } from './emailConfig';
import { escapeHtml } from './auth';

export interface OnboardingWelcomeData {
  hotelId: string;
  propertyName: string;
  ownerEmail: string;
  ownerName?: string;
  managerEmail?: string;
  location?: string;
  category?: string;
  stayType?: string;
  origin?: string;
}

/**
 * Sends a welcome email immediately upon successful property onboarding submission,
 * detailing submission status, login credentials/method, dashboard link, and next steps.
 */
export async function sendOnboardingWelcomeEmail(data: OnboardingWelcomeData): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const targetEmail = data.ownerEmail?.trim() || data.managerEmail?.trim();
  if (!targetEmail) {
    return { success: false, error: 'No owner or manager email provided.' };
  }

  const domain = DEFAULT_PLATFORM_DOMAIN || 'ulendomalawi.com';
  const baseUrl = data.origin && data.origin.startsWith('http')
    ? data.origin.replace(/\/$/, '')
    : `https://${domain}`;

  const propertyName = data.propertyName?.trim() || 'Your Property';
  const ownerName = data.ownerName?.trim() || 'Valued Property Host';
  const location = data.location?.trim() || 'Malawi';
  const hotelId = data.hotelId;
  const dashboardUrl = `${baseUrl}/dashboard/hotel/${hotelId}`;
  const loginUrl = `${baseUrl}/?auth=signin`;

  const subject = `Takulandirani! Property Submission Confirmation — ${propertyName}`;

  const plainText = `Dear ${ownerName},

Takulandirani! Thank you for listing ${propertyName} on Ulendo Travel Malawi — The Warm Heart of Africa.

Your property submission has been received and is currently under review by our hospitality verification team.

Property Details:
- Name: ${propertyName}
- Location: ${location}
- Listing ID: #${hotelId}
- Status: Pending Review (Standard verification completes within 24 hours)

How to Login & Manage Your Property:
1. Go to: ${loginUrl}
2. Login with your registered email: ${targetEmail}
3. If you signed up via Google, continue with Google. If using email and you need to set or reset your password, click "Forgot Password" on the login screen to receive an instant secure reset link.
4. Direct Dashboard Link: ${dashboardUrl}

Next Steps in Your Management Hub:
- Add or fine-tune your rooms, amenities, and seasonal rates (both MWK & USD).
- Check your direct WhatsApp and phone contact channels for guest inquiries.
- Ulendo, your AI Hospitality Concierge, is available directly inside your dashboard 24/7 to help craft descriptions and assist with property operations.

If you have any questions or require assistance setting up, reply directly to this email or reach us at ${DEFAULT_PLATFORM_EMAIL}.

Warm hospitality regards,
The Ulendo Travel Malawi Team
${baseUrl}
`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 0; border: 1px solid #e7e5e4; border-radius: 16px; background: #ffffff; color: #1c1917; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
      <!-- Header Banner -->
      <div style="background: linear-gradient(135deg, #1c1917 0%, #292524 50%, #451a03 100%); padding: 32px 28px; text-align: center; color: #ffffff;">
        <div style="display: inline-block; padding: 5px 14px; background: rgba(245, 158, 11, 0.2); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #fef3c7; margin-bottom: 12px;">
          🇲🇼 The Warm Heart of Africa
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
          Takulandirani, ${escapeHtml(ownerName)}!
        </h2>
        <p style="margin: 0 0 18px; font-size: 14px; line-height: 1.6; color: #44403c;">
          We are thrilled to confirm that your property listing for <strong>${escapeHtml(propertyName)}</strong> has been successfully submitted to <strong>Ulendo Travel Malawi</strong>.
        </p>

        <!-- Property Summary Card -->
        <div style="background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 12px; padding: 18px; margin-bottom: 22px;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #78716c; margin-bottom: 10px;">
            Submission Summary
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr>
              <td style="padding: 6px 0; color: #78716c; width: 120px;">Property Name:</td>
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
              <td style="padding: 6px 0; color: #78716c;">Status:</td>
              <td style="padding: 6px 0;">
                <span style="display: inline-block; padding: 3px 10px; background: #fef3c7; color: #92400e; font-size: 12px; font-weight: 600; border-radius: 9999px;">
                  Pending Review (Active within 24h)
                </span>
              </td>
            </tr>
          </table>
        </div>

        <!-- How to Login Card -->
        <div style="background: #fdfaf6; border: 1px solid #fed7aa; border-radius: 12px; padding: 20px; margin-bottom: 22px;">
          <h3 style="margin: 0 0 10px; font-size: 15px; font-weight: 700; color: #9a3412; display: flex; align-items: center;">
            🔑 How to Login to Your Account
          </h3>
          <p style="margin: 0 0 12px; font-size: 13px; line-height: 1.5; color: #57534e;">
            You can access your property management dashboard anytime using your registered email:
          </p>
          <div style="background: #ffffff; border: 1px dashed #fdba74; border-radius: 8px; padding: 12px 14px; margin-bottom: 14px;">
            <div style="font-size: 11px; color: #78716c; text-transform: uppercase; font-weight: 600;">Registered Login Email</div>
            <div style="font-size: 14px; font-weight: 700; color: #1c1917; margin-top: 2px;">${escapeHtml(targetEmail)}</div>
          </div>
          <ul style="margin: 0 0 16px; padding-left: 20px; font-size: 13px; color: #57534e; line-height: 1.6;">
            <li><strong>Password Setup / Reset:</strong> If you ever need to set or reset your password, simply click <em>"Forgot Password"</em> on the sign-in modal to receive a secure login link.</li>
            <li><strong>Google Sign-In:</strong> If your email is a Google account, click <em>"Continue with Google"</em> for 1-click access.</li>
          </ul>

          <div style="text-align: center; margin-top: 14px;">
            <a href="${escapeHtml(dashboardUrl)}" style="display: inline-block; padding: 12px 24px; background: #b45309; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; border-radius: 8px; box-shadow: 0 2px 8px rgba(180, 83, 9, 0.25);">
              Open Property Dashboard →
            </a>
          </div>
        </div>

        <!-- Next Steps -->
        <div style="margin-bottom: 20px;">
          <h4 style="margin: 0 0 10px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #78716c;">
            Recommended Next Steps
          </h4>
          <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #57534e; line-height: 1.6;">
            <li><strong>Room &amp; Rate Configuration:</strong> Set up your room types, dual currency pricing (MWK &amp; USD), and guest capacity.</li>
            <li><strong>Direct Contacts:</strong> Ensure your lodge's WhatsApp number and direct phone are active so travelers can reach front desk immediately.</li>
            <li><strong>Ulendo AI Concierge:</strong> Chat with your Malawian AI Concierge in your dashboard for local travel guidance, occupancy suggestions, and rate adjustments.</li>
          </ol>
        </div>
      </div>

      <!-- Footer -->
      <div style="background: #fafaf9; border-top: 1px solid #e7e5e4; padding: 20px 24px; text-align: center; font-size: 11px; color: #78716c; line-height: 1.5;">
        <p style="margin: 0 0 4px; font-weight: 600; color: #44403c;">
          Ulendo Travel Malawi · Connecting Travelers Directly with Malawi's Finest Hospitality
        </p>
        <p style="margin: 0;">
          Need help? Contact support at <a href="mailto:${escapeHtml(DEFAULT_PLATFORM_EMAIL)}" style="color: #b45309; text-decoration: none;">${escapeHtml(DEFAULT_PLATFORM_EMAIL)}</a> · <a href="${escapeHtml(baseUrl)}" style="color: #78716c; text-decoration: none;">${escapeHtml(domain)}</a>
        </p>
      </div>
    </div>
  `;

  try {
    const result = await sendSystemEmail({
      to: targetEmail,
      subject,
      text: plainText,
      html,
    });
    return result;
  } catch (err: any) {
    console.error('[OnboardingEmail] Failed to dispatch welcome email:', err);
    return { success: false, error: err?.message || 'Failed to dispatch welcome email.' };
  }
}
