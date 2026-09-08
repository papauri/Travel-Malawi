import { sendSystemEmail } from './emailConfig';

export async function sendOfflineNotification(email: string, subject: string, message: string) {
  try {
    const result = await sendSystemEmail({
      to: email,
      subject,
      text: message,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 20px; color: #1c1917;">
          <h2 style="color: #1c1917;">Travel Malawi Notification</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #44403c;">${message.replace(/\n/g, '<br/>')}</p>
        </div>
      `,
    });
    return result;
  } catch (err: any) {
    console.warn('[Notifications] Offline notification skipped (SMTP not configured or offline):', err?.message);
    return { success: false, error: err?.message };
  }
}

