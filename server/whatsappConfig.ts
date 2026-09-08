import fs from 'fs';
import path from 'path';

export interface WhatsAppConfig {
  enabled: boolean;
  provider: 'cloud_api' | 'direct';
  phoneNumberId: string;
  businessAccountId?: string;
  accessToken: string;
  senderPhoneNumber?: string;
  defaultCountryCode: string;
  updatedAt?: number;
  lastTestedAt?: number;
  lastTestStatus?: 'success' | 'failed';
  lastTestMessage?: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const WHATSAPP_CONFIG_FILE = path.join(DATA_DIR, 'whatsapp_config.json');

// Default config: initially blank/disabled, ready for admin to configure
export const DEFAULT_WHATSAPP_CONFIG: WhatsAppConfig = {
  enabled: false,
  provider: 'cloud_api',
  phoneNumberId: '',
  businessAccountId: '',
  accessToken: '',
  senderPhoneNumber: '',
  defaultCountryCode: '+265',
};

export function normalizeWhatsAppNumber(rawPhone: string, defaultCountryCode = '+265'): string {
  if (!rawPhone) return '';
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) return '';

  const cleanCountryDigits = defaultCountryCode.replace(/\D/g, '') || '265';

  // If starts with 0 (e.g., 0991234567 in Malawi)
  if (digits.startsWith('0')) {
    return `${cleanCountryDigits}${digits.slice(1)}`;
  }

  // If already starts with the country code
  if (digits.startsWith(cleanCountryDigits)) {
    return digits;
  }

  // If it's a short 9-digit local number (e.g. 991234567)
  if (digits.length <= 9) {
    return `${cleanCountryDigits}${digits}`;
  }

  return digits;
}

export function loadWhatsAppConfig(): WhatsAppConfig {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(WHATSAPP_CONFIG_FILE)) {
      const raw = fs.readFileSync(WHATSAPP_CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_WHATSAPP_CONFIG,
        ...parsed,
      };
    }
  } catch (err) {
    console.error('[WhatsAppConfig] Failed to read whatsapp_config.json:', err);
  }
  return { ...DEFAULT_WHATSAPP_CONFIG };
}

export function saveWhatsAppConfig(config: Partial<WhatsAppConfig>): WhatsAppConfig {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const existing = loadWhatsAppConfig();

  // Preserve accessToken if passed as blank or masked string
  let tokenToSave = config.accessToken;
  if (!tokenToSave || tokenToSave.trim() === '' || tokenToSave === '********') {
    tokenToSave = existing.accessToken || '';
  }

  const updated: WhatsAppConfig = {
    ...existing,
    ...config,
    accessToken: tokenToSave,
    updatedAt: Date.now(),
  };

  fs.writeFileSync(WHATSAPP_CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}

export function getAdminWhatsAppConfig(): Omit<WhatsAppConfig, 'accessToken'> & {
  hasToken: boolean;
  accessToken: string;
  isConfigured: boolean;
} {
  const cfg = loadWhatsAppConfig();
  const hasCloudCreds = Boolean(cfg.phoneNumberId && cfg.accessToken);
  const isConfigured = cfg.provider === 'direct' ? true : hasCloudCreds;

  return {
    ...cfg,
    hasToken: Boolean(cfg.accessToken && cfg.accessToken.length > 0),
    accessToken: cfg.accessToken ? '********' : '',
    isConfigured,
  };
}

export function getPublicWhatsAppStatus() {
  const cfg = loadWhatsAppConfig();
  const hasCloudCreds = Boolean(cfg.phoneNumberId && cfg.accessToken);
  const isConfigured = cfg.provider === 'direct' ? true : hasCloudCreds;

  return {
    enabled: Boolean(cfg.enabled),
    provider: cfg.provider || 'cloud_api',
    isConfigured,
    senderPhoneNumber: cfg.senderPhoneNumber || '',
    defaultCountryCode: cfg.defaultCountryCode || '+265',
    lastTestStatus: cfg.lastTestStatus,
  };
}

export async function sendWhatsAppMessage(
  toPhone: string,
  message: string
): Promise<{ success: boolean; messageId?: string; directLink?: string; isDirect?: boolean; error?: string }> {
  const cfg = loadWhatsAppConfig();

  if (!cfg.enabled) {
    return { success: false, error: 'WhatsApp integration is currently disabled in system settings.' };
  }

  const normalized = normalizeWhatsAppNumber(toPhone, cfg.defaultCountryCode);
  if (!normalized || normalized.length < 8) {
    return { success: false, error: `Invalid recipient phone number format: "${toPhone}".` };
  }

  // Direct click-to-chat fallback mode
  if (cfg.provider === 'direct' || !cfg.phoneNumberId || !cfg.accessToken) {
    const directLink = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
    return {
      success: true,
      isDirect: true,
      directLink,
    };
  }

  // Meta WhatsApp Cloud API mode
  try {
    const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(cfg.phoneNumberId)}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: normalized,
        type: 'text',
        text: {
          preview_url: false,
          body: message,
        },
      }),
    });

    const data: any = await response.json();

    if (!response.ok || data.error) {
      const errorMsg = data?.error?.message || `WhatsApp API error (HTTP ${response.status})`;
      console.error('[WhatsApp API] Message send error:', data);
      return { success: false, error: errorMsg };
    }

    const messageId = data?.messages?.[0]?.id || 'sent';
    return { success: true, messageId, isDirect: false };
  } catch (err: any) {
    console.error('[WhatsApp API] Network/Request error:', err);
    return { success: false, error: err.message || 'Failed to dispatch WhatsApp message via Meta Cloud API.' };
  }
}

export async function testWhatsAppConnection(
  testPhone?: string,
  candidateConfig?: Partial<WhatsAppConfig>
): Promise<{ success: boolean; message: string; details?: any }> {
  const saved = loadWhatsAppConfig();
  const active: WhatsAppConfig = {
    ...saved,
    ...candidateConfig,
    accessToken: (candidateConfig?.accessToken && candidateConfig.accessToken !== '********')
      ? candidateConfig.accessToken
      : saved.accessToken,
  };

  const now = Date.now();

  // Test Direct Mode
  if (active.provider === 'direct') {
    const norm = testPhone ? normalizeWhatsAppNumber(testPhone, active.defaultCountryCode) : '265991234567';
    const link = `https://wa.me/${norm}?text=Test%20verification`;
    
    saveWhatsAppConfig({
      lastTestedAt: now,
      lastTestStatus: 'success',
      lastTestMessage: `Direct mode verified. Sample link: ${link}`,
    });

    return {
      success: true,
      message: `Direct Click-to-Chat mode is ready. Sample test URL generated: ${link}`,
      details: { directLink: link, normalizedNumber: norm },
    };
  }

  // Test Cloud API Mode
  if (!active.phoneNumberId) {
    throw new Error('Meta WhatsApp Phone Number ID is required to test Cloud API.');
  }
  if (!active.accessToken) {
    throw new Error('Meta System User Access Token is required to test Cloud API.');
  }

  try {
    // 1. Verify Phone Number ID & Token with Meta Graph API
    const verifyUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(active.phoneNumberId)}?fields=id,verified_name,display_phone_number,quality_rating`;
    const verifyRes = await fetch(verifyUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${active.accessToken}`,
      },
    });

    const verifyData: any = await verifyRes.json();

    if (!verifyRes.ok || verifyData.error) {
      const errMsg = verifyData?.error?.message || `Meta Graph API authentication failed (HTTP ${verifyRes.status})`;
      saveWhatsAppConfig({
        lastTestedAt: now,
        lastTestStatus: 'failed',
        lastTestMessage: errMsg,
      });
      throw new Error(errMsg);
    }

    let sentMessageId: string | undefined;

    // 2. If test phone number is provided, attempt sending actual test message
    if (testPhone && testPhone.trim().length > 0) {
      const norm = normalizeWhatsAppNumber(testPhone, active.defaultCountryCode);
      const sendUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(active.phoneNumberId)}/messages`;
      const sendRes = await fetch(sendUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${active.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: norm,
          type: 'text',
          text: {
            preview_url: false,
            body: `*Travel Malawi* 🇲🇼\nWhatsApp Cloud API connection test successful!\nTimestamp: ${new Date().toLocaleTimeString()} UTC.`,
          },
        }),
      });

      const sendData: any = await sendRes.json();
      if (!sendRes.ok || sendData.error) {
        const warnMsg = sendData?.error?.message || 'Credentials verified, but test message could not be sent to recipient.';
        saveWhatsAppConfig({
          lastTestedAt: now,
          lastTestStatus: 'success',
          lastTestMessage: `Account verified (${verifyData.display_phone_number || verifyData.verified_name || 'Active'}). Test message warning: ${warnMsg}`,
        });
        return {
          success: true,
          message: `Account credentials verified successfully for ${verifyData.display_phone_number || active.phoneNumberId}. (Notice: ${warnMsg})`,
          details: { verifyData, sendData },
        };
      }
      sentMessageId = sendData?.messages?.[0]?.id;
    }

    const successMsg = `Successfully connected to Meta WhatsApp Cloud API! Verified Account: ${verifyData.display_phone_number || verifyData.verified_name || active.phoneNumberId}${sentMessageId ? ` (Test message dispatched: ID ${sentMessageId})` : ''}`;

    saveWhatsAppConfig({
      lastTestedAt: now,
      lastTestStatus: 'success',
      lastTestMessage: successMsg,
    });

    return {
      success: true,
      message: successMsg,
      details: { account: verifyData, messageId: sentMessageId },
    };
  } catch (err: any) {
    saveWhatsAppConfig({
      lastTestedAt: now,
      lastTestStatus: 'failed',
      lastTestMessage: err.message,
    });
    throw err;
  }
}
