import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';

export interface SMTPEmailConfig {
  smtpHost: string;
  smtpPort: number | string;
  smtpSecure: boolean; // true for 465 (SSL), false for 587/25/2525 (STARTTLS)
  smtpUser: string;
  smtpPass: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  updatedAt?: number;
  lastTestedAt?: number;
  lastTestStatus?: 'success' | 'failed';
  lastTestMessage?: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const EMAIL_CONFIG_FILE = path.join(DATA_DIR, 'email_config.json');

// By default, leave configs blank as requested by the user
export const DEFAULT_EMAIL_CONFIG: SMTPEmailConfig = {
  smtpHost: '',
  smtpPort: '',
  smtpSecure: false,
  smtpUser: '',
  smtpPass: '',
  fromName: '',
  fromEmail: '',
  replyTo: '',
};

export function loadEmailConfig(): SMTPEmailConfig {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(EMAIL_CONFIG_FILE)) {
      const raw = fs.readFileSync(EMAIL_CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_EMAIL_CONFIG,
        ...parsed,
      };
    }
  } catch (err) {
    console.error('[EmailConfig] Failed to read email_config.json:', err);
  }
  return { ...DEFAULT_EMAIL_CONFIG };
}

export function saveEmailConfig(config: Partial<SMTPEmailConfig>): SMTPEmailConfig {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const existing = loadEmailConfig();
  
  // If new password is blank or masked string ('********'), keep existing password
  let passwordToSave = config.smtpPass;
  if (!passwordToSave || passwordToSave.trim() === '' || passwordToSave === '********') {
    passwordToSave = existing.smtpPass || '';
  }

  const updated: SMTPEmailConfig = {
    ...existing,
    ...config,
    smtpPass: passwordToSave,
    updatedAt: Date.now(),
  };

  fs.writeFileSync(EMAIL_CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}

/**
 * Returns config safe for client-side consumption (masks the SMTP password).
 */
export function getAdminEmailConfig(): Omit<SMTPEmailConfig, 'smtpPass'> & { hasPassword: boolean; smtpPass: string; isConfigured: boolean } {
  const cfg = loadEmailConfig();
  const isConfigured = Boolean(cfg.smtpHost && cfg.smtpPort && cfg.smtpUser);
  return {
    ...cfg,
    hasPassword: Boolean(cfg.smtpPass && cfg.smtpPass.length > 0),
    smtpPass: cfg.smtpPass ? '********' : '',
    isConfigured,
  };
}

/**
 * Creates a nodemailer transporter from configuration
 */
function createTransporter(config: SMTPEmailConfig) {
  const port = parseInt(String(config.smtpPort || '587'), 10);
  const secure = config.smtpSecure || port === 465;

  return nodemailer.createTransport({
    host: config.smtpHost,
    port: port,
    secure: secure,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
    tls: {
      // Do not fail on invalid certs in staging/development
      rejectUnauthorized: false,
    },
    connectionTimeout: 10000,
    greetingTimeout: 8000,
  });
}

/**
 * Test SMTP configuration and optionally send a test email
 */
export async function testSMTPConnection(
  testEmail?: string,
  candidateConfig?: Partial<SMTPEmailConfig>
): Promise<{ success: boolean; message: string; details?: any }> {
  const savedConfig = loadEmailConfig();
  const activeConfig: SMTPEmailConfig = {
    ...savedConfig,
    ...candidateConfig,
    smtpPass: (candidateConfig?.smtpPass && candidateConfig.smtpPass !== '********')
      ? candidateConfig.smtpPass
      : savedConfig.smtpPass,
  };

  if (!activeConfig.smtpHost || !activeConfig.smtpPort || !activeConfig.smtpUser) {
    throw new Error('SMTP Host, Port, and Username are required to test connection.');
  }

  const transporter = createTransporter(activeConfig);

  try {
    // 1. Verify SMTP connection & credentials
    await transporter.verify();

    // 2. If a test recipient email was provided, send a formatted test email
    if (testEmail && testEmail.trim()) {
      const fromDisplay = activeConfig.fromName 
        ? `"${activeConfig.fromName}" <${activeConfig.fromEmail || activeConfig.smtpUser}>`
        : activeConfig.fromEmail || activeConfig.smtpUser;

      await transporter.sendMail({
        from: fromDisplay,
        to: testEmail.trim(),
        replyTo: activeConfig.replyTo || activeConfig.fromEmail || activeConfig.smtpUser,
        subject: 'Travel Malawi — SMTP Configuration Verified Successfully',
        text: `Hello!\n\nThis is a test email from your Travel Malawi Admin Portal.\n\nYour SMTP settings (${activeConfig.smtpHost}:${activeConfig.smtpPort}) are working properly.\nManager reminder templates and guest emails are now ready to send.\n\nSent at: ${new Date().toLocaleString()}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 28px 24px; border: 1px solid #e7e5e4; border-radius: 16px; background: #ffffff; color: #1c1917;">
            <div style="text-align: center; margin-bottom: 24px;">
              <span style="display: inline-block; padding: 6px 14px; background: #ecfdf5; color: #047857; font-size: 12px; font-weight: 700; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em;">
                SMTP Operational
              </span>
              <h2 style="margin: 14px 0 6px; font-size: 22px; font-weight: 800; color: #1c1917;">Travel Malawi Email Engine</h2>
              <p style="margin: 0; font-size: 14px; color: #78716c;">Connection & Authentication Test</p>
            </div>
            
            <div style="background: #fafaf9; border-radius: 12px; padding: 18px 20px; margin-bottom: 20px; border: 1px solid #f5f5f4;">
              <p style="margin: 0 0 10px; font-size: 14px; line-height: 1.5; color: #44403c;">
                <strong>Congratulations!</strong> Your outgoing SMTP server has been verified and authenticated successfully.
              </p>
              <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #57534e; line-height: 1.6;">
                <li><strong>SMTP Host:</strong> ${activeConfig.smtpHost}</li>
                <li><strong>Port / Security:</strong> ${activeConfig.smtpPort} (${activeConfig.smtpSecure || activeConfig.smtpPort === 465 ? 'SSL/TLS' : 'STARTTLS'})</li>
                <li><strong>Sender:</strong> ${activeConfig.fromName || 'Travel Malawi'} &lt;${activeConfig.fromEmail || activeConfig.smtpUser}&gt;</li>
                <li><strong>Recipient Test:</strong> ${testEmail.trim()}</li>
              </ul>
            </div>

            <p style="font-size: 13px; color: #78716c; line-height: 1.5; margin: 0;">
              All manager reminder templates (3-Day Arrival, 24h Arrival PIN, Deposit details, Check-in WiFi guide, Check-out logistics) can now be dispatched to guests.
            </p>

            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f5f5f4; text-align: center; font-size: 11px; color: #a8a29e;">
              Travel Malawi · Super Admin Settings · Automated Verification Notice
            </div>
          </div>
        `,
      });
    }

    // Record test status
    saveEmailConfig({
      lastTestedAt: Date.now(),
      lastTestStatus: 'success',
      lastTestMessage: testEmail 
        ? `Verified and sent test email to ${testEmail}` 
        : 'SMTP server connection verified successfully',
    });

    return {
      success: true,
      message: testEmail
        ? `SMTP connection verified and test email delivered to ${testEmail}`
        : 'SMTP connection verified successfully.',
    };
  } catch (err: any) {
    console.error('[EmailConfig] SMTP verification failed:', err);
    saveEmailConfig({
      lastTestedAt: Date.now(),
      lastTestStatus: 'failed',
      lastTestMessage: err?.message || 'Connection failed',
    });
    throw new Error(`SMTP Error: ${err?.message || 'Failed to connect to SMTP server'}`);
  }
}

/**
 * Dispatch an email notification / reminder
 */
export async function sendSystemEmail(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const config = loadEmailConfig();

  if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
    return {
      success: false,
      error: 'SMTP email server is not configured in Admin Portal Settings. Please configure it in the Settings tab.',
    };
  }

  try {
    const transporter = createTransporter(config);
    const fromDisplay = config.fromName 
      ? `"${config.fromName}" <${config.fromEmail || config.smtpUser}>`
      : config.fromEmail || config.smtpUser;

    const info = await transporter.sendMail({
      from: fromDisplay,
      to: options.to,
      replyTo: options.replyTo || config.replyTo || config.fromEmail || config.smtpUser,
      subject: options.subject,
      text: options.text || options.html.replace(/<[^>]*>?/gm, ''),
      html: options.html,
    });

    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error('[EmailConfig] Failed to send email:', err);
    return { success: false, error: err?.message || 'Failed to dispatch email' };
  }
}
