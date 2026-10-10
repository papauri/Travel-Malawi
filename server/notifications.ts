import { sendSystemEmail } from './emailConfig';
import { escapeHtml } from './auth';

/** Sends a plain-text notification; the text is escaped before it goes into HTML. */
export async function sendOfflineNotification(email: string, subject: string, message: string) {
  try {
    const result = await sendSystemEmail({
      to: email,
      subject,
      text: message,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e7e5e4; border-radius: 12px; background: #ffffff; color: #1c1917;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #78716c; margin-bottom: 6px;">
            Ulendo Travel Malawi
          </div>
          <h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 700; color: #1c1917;">Notification</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #44403c;">${escapeHtml(message).replace(/\n/g, '<br/>')}</p>
          <div style="margin-top: 24px; padding-top: 14px; border-top: 1px solid #f5f5f4; font-size: 11px; color: #a8a29e; text-align: center;">
            Ulendo Travel Malawi · <a href="https://ulendomalawi.com" style="color: #78716c; text-decoration: none;">ulendomalawi.com</a> · <a href="mailto:info@ulendomalawi.com" style="color: #78716c; text-decoration: none;">info@ulendomalawi.com</a>
          </div>
        </div>
      `,
    });
    return result;
  } catch (err: any) {
    console.warn('[Notifications] Offline notification skipped (SMTP not configured or offline):', err?.message);
    return { success: false, error: err?.message };
  }
}
