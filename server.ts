import 'dotenv/config';
import './server/envSanitizer';
import express from 'express';
import type { Response } from 'express';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import {
  getPublicAIStatus,
  getAdminAIConfig,
  loadAIConfig,
  saveAIConfig,
  AIProviderId,
  getEffectiveApiKey,
  fetchLiveGeminiModels,
  fetchLiveProviderModels,
  fetchAllLiveProviderModels
} from './server/aiConfig';
import {
  executeAIGeneration,
  executeOperationsAssistantChat,
  testProviderConnection,
  generateTripInsights,
  executeTripConciergeChat
} from './server/aiService';
import { sendOfflineNotification } from './server/notifications';
import {
  generateAutoReminders,
  createManualReminder,
  getReminder,
  getRemindersForBooking,
  getRemindersForHotel,
  deleteReminder,
  cancelRemindersForBooking,
  checkAndFireReminders,
  sendReminderEmailNow,
  sendReminderWhatsAppNow,
  sendTestTemplateEmail,
  getAllPendingReminders
} from './server/reminders';
import { getAdminDocsList, getAdminDocContent, saveAdminDoc, resetAdminDoc } from './server/docUtils';
import { getAdminEmailConfig, saveEmailConfig, testSMTPConnection, sendSystemEmail } from './server/emailConfig';
import { OWNER_EMAILS } from './src/lib/roles';
import {
  getAdminWhatsAppConfig,
  getPublicWhatsAppStatus,
  saveWhatsAppConfig,
  testWhatsAppConnection,
  sendWhatsAppMessage
} from './server/whatsappConfig';
import {
  optionalAuth,
  requireAuth,
  requireRole,
  canManageHotel,
  isAdminUser,
  aiRoleFor,
  readDoc,
  queryDocs,
  hotelEmails,
  isSafeId,
  rateLimit,
  clientIp,
  escapeHtml,
  cleanText,
  samePhone,
  AuthUser,
  adminAuth,
  FIRESTORE_BASE,
} from './server/auth';

/** Logs the real error and returns a generic message to the client. */
function sendError(res: Response, err: unknown, publicMessage: string, status = 500) {
  console.error(`[API] ${publicMessage}:`, err);
  res.status(status).json({ error: publicMessage });
}

/** AI failures: rate limits become 429 with a retry hint, everything else is generic. */
function sendAIError(res: Response, err: any, publicMessage: string) {
  if (err?.status === 429) {
    const retryAfter = Number(err.retryAfterSec) > 0 ? Math.ceil(Number(err.retryAfterSec)) : 30;
    res.setHeader('Retry-After', String(retryAfter));
    console.warn('[API] AI rate limited:', err?.message);
    res.status(429).json({ error: 'Ulendo is handling a lot of requests right now. Please try again shortly.', retryAfter });
    return;
  }
  if (err?.status === 504) {
    console.warn('[API] AI request timed out:', err?.message);
    res.status(504).json({ error: 'Ulendo took too long to respond. Please try again.' });
    return;
  }
  sendError(res, err, publicMessage);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const lower = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Behind Cloud Run's front end: take the client address from the proxy hop.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  });

  // Setup storage folders
  const UPLOADS_DIR = path.join(process.cwd(), 'images');
  const BACKUPS_DIR = path.join(process.cwd(), 'backup_images');

  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

  const IMAGE_TYPES: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif)$/i;
  const FOLDER_RE = /^[a-z0-9_-]+(\/[a-z0-9_-]+)*$/;

  /** Resolves a path under base, or null if it would escape it. */
  const safeJoin = (base: string, ...parts: string[]): string | null => {
    const resolved = path.resolve(base, ...parts);
    return resolved === base || resolved.startsWith(base + path.sep) ? resolved : null;
  };

  // Serve uploaded images only. Anything that is not an image file is refused,
  // so an upload can never be served back as a page from this origin.
  app.use('/images', (req, res, next) => {
    if (!IMAGE_EXT_RE.test(req.path)) {
      res.status(404).send('Not Found');
      return;
    }
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");
    next();
  }, express.static(UPLOADS_DIR, { dotfiles: 'deny', index: false }));

  // Multer config for file upload
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const folder = String(req.body?.folder || 'uploads');
      const targetDir = FOLDER_RE.test(folder) ? safeJoin(UPLOADS_DIR, folder) : null;
      if (!targetDir) {
        cb(new Error('INVALID_FOLDER'), '');
        return;
      }
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      cb(null, targetDir);
    },
    filename: (req, file, cb) => {
      const ext = IMAGE_TYPES[file.mimetype] || 'jpg';
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
      cb(null, uniqueName);
    }
  });

  const upload = multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024 }, // 8MB limit
    fileFilter: (req, file, cb) => cb(null, Boolean(IMAGE_TYPES[file.mimetype])),
  });

  // Parse JSON bodies for API routes
  app.use(express.json({ limit: '200kb' }));

  // Rate limiters (in-memory, per instance)
  const aiLimiter = rateLimit({ name: 'ai', windowMs: 60_000, max: 12 });
  const uploadLimiter = rateLimit({ name: 'upload', windowMs: 60_000, max: 30 });
  const notifyAnonLimiter = rateLimit({ name: 'notify-anon', windowMs: 10 * 60_000, max: 5 });
  const notifyUserLimiter = rateLimit({ name: 'notify-user', windowMs: 10 * 60_000, max: 40 });
  const surveyLimiter = rateLimit({ name: 'survey', windowMs: 60 * 60_000, max: 10 });
  const resetIpLimiter = rateLimit({ name: 'reset-ip', windowMs: 60 * 60_000, max: 5 });
  const resetEmailLimiter = rateLimit({
    name: 'reset-email',
    windowMs: 15 * 60_000,
    max: 1,
    key: req => `email:${lower(req.body?.email)}`,
  });

  // Health check routes for Cloud Run / AI Studio container probes
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', time: new Date().toISOString() });
  });

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', time: new Date().toISOString() });
  });

  // Client telemetry: IP address & location resolution for Intune-style audit logs
  app.get('/api/client-telemetry', async (req, res) => {
    try {
      const ip = clientIp(req);

      let geo: {
        city?: string;
        region?: string;
        country?: string;
        countryCode?: string;
        timezone?: string;
        org?: string;
      } = {};

      const isPrivateOrLoopback =
        !ip ||
        ip === 'unknown' ||
        ip === '127.0.0.1' ||
        ip === '::1' ||
        ip.startsWith('10.') ||
        ip.startsWith('192.168.') ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(ip);

      if (!isPrivateOrLoopback) {
        try {
          const geoRes = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
            headers: { 'User-Agent': 'TravelMalawi-Audit/1.0' },
            signal: AbortSignal.timeout(2000),
          });
          if (geoRes.ok) {
            const data = await geoRes.json();
            if (!data.error) {
              geo = {
                city: data.city,
                region: data.region,
                country: data.country_name,
                countryCode: data.country_code,
                timezone: data.timezone,
                org: data.org,
              };
            }
          }
        } catch {
          // ignore lookup error
        }
      }

      res.status(200).json({
        ip: ip || '127.0.0.1',
        geo,
        userAgent: req.headers['user-agent'] || '',
      });
    } catch {
      res.status(200).json({
        ip: '127.0.0.1',
        geo: {},
        userAgent: req.headers['user-agent'] || '',
      });
    }
  });

  // API route for upload (signed-in users, images only, into an allowlisted folder)
  app.post('/api/upload', requireAuth, uploadLimiter, (req, res) => {
    upload.single('image')(req, res, (err: any) => {
      if (err) {
        const message = err?.message === 'INVALID_FOLDER'
          ? 'Invalid upload folder.'
          : err?.code === 'LIMIT_FILE_SIZE'
          ? 'Image is larger than 8 MB.'
          : 'Upload failed.';
        if (!['INVALID_FOLDER'].includes(err?.message) && err?.code !== 'LIMIT_FILE_SIZE') {
          console.error('[API] Upload error:', err);
        }
        return res.status(400).json({ error: message });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded. Only JPEG, PNG, WebP and GIF files are accepted.' });
      }
      const relative = path.relative(UPLOADS_DIR, req.file.path).split(path.sep).join('/');
      // Return relative URL so frontend can render it via static middleware
      res.json({ url: `/images/${relative}` });
    });
  });

  // API route to archive (delete) a stay's images — hotel manager or admin only
  app.post('/api/hotels/:id/archive-images', requireAuth, async (req, res) => {
    try {
      const id = String(req.params.id);
      if (!isSafeId(id)) {
        return res.status(400).json({ error: 'Invalid property id.' });
      }
      if (!(await canManageHotel(req.authUser, id))) {
        return res.status(403).json({ error: 'You do not have permission to do this.' });
      }
      const hotelsBase = path.join(UPLOADS_DIR, 'hotels');
      const backupsBase = path.join(BACKUPS_DIR, 'hotels');
      const hotelDir = safeJoin(hotelsBase, id);
      const backupDir = safeJoin(backupsBase, id);
      if (!hotelDir || !backupDir) {
        return res.status(400).json({ error: 'Invalid property id.' });
      }

      if (fs.existsSync(hotelDir)) {
        if (!fs.existsSync(backupsBase)) {
          fs.mkdirSync(backupsBase, { recursive: true });
        }
        const target = fs.existsSync(backupDir) ? `${backupDir}-${Date.now()}` : backupDir;
        fs.renameSync(hotelDir, target);
      }
      res.json({ success: true });
    } catch (err) {
      sendError(res, err, 'Failed to archive images');
    }
  });

  // ----------------------------------------------------
  // OFFLINE EMAIL NOTIFICATIONS
  // ----------------------------------------------------

  /**
   * Sends a notification email. The recipient must be tied to the request:
   * - admins may notify anyone;
   * - with `bookingId`: the booking's guest or its hotel's contact addresses,
   *   and a signed-in caller must be that guest or the hotel's manager;
   * - with `hotelId` (or nothing): only that hotel's contact addresses, which is
   *   how signed-out guests notify a property about a new booking request.
   */
  app.post(
    '/api/notify',
    optionalAuth,
    (req, res, next) => (req.authUser ? notifyUserLimiter : notifyAnonLimiter)(req, res, next),
    async (req, res) => {
      try {
        const email = lower(cleanText(req.body?.email, 254, true));
        const subject = cleanText(req.body?.subject, 200, true);
        const message = cleanText(req.body?.message, 5000);
        const { hotelId, bookingId } = req.body || {};
        if (!email.includes('@') || !subject || !message) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        const user = req.authUser;
        let allowed = isAdminUser(user);

        if (!allowed && isSafeId(bookingId)) {
          const booking = await readDoc('bookings', bookingId, user?.token);
          if (booking) {
            const hotel = isSafeId(booking.hotelId) ? await readDoc('hotels', booking.hotelId, user?.token) : null;
            const managerAddresses = hotelEmails(hotel);
            if (user) {
              const isParty = booking.guestId === user.uid || (await canManageHotel(user, booking.hotelId));
              allowed = isParty && (managerAddresses.includes(email) || lower(booking.guestEmail) === email);
            } else {
              allowed = managerAddresses.includes(email);
            }
          }
        }

        if (!allowed && isSafeId(hotelId)) {
          allowed = hotelEmails(await readDoc('hotels', hotelId, user?.token)).includes(email);
        }

        if (!allowed && !bookingId && !hotelId) {
          // Legacy callers send only the address: allow it when it is a
          // registered property's manager address.
          const raw = cleanText(req.body?.email, 254, true);
          const matches = [
            ...(await queryDocs('hotels', 'managerEmail', raw, user?.token, 1)),
            ...(raw !== email ? await queryDocs('hotels', 'managerEmail', email, user?.token, 1) : []),
          ];
          allowed = matches.length > 0;
        }

        if (!allowed) {
          return res.status(403).json({ error: 'This notification recipient is not allowed.' });
        }

        const result = await sendOfflineNotification(email, subject, message);
        res.json({ success: true, emailSent: Boolean(result?.success) });
      } catch (err) {
        sendError(res, err, 'Failed to send notification');
      }
    }
  );

  // ----------------------------------------------------
  // AI ASSISTANT API ROUTES (Server-side & Secure)
  // ----------------------------------------------------

  /** Replaces any role the client claims with the verified one. */
  const withVerifiedRole = (body: any, user: AuthUser) => ({
    ...(body && typeof body === 'object' ? body : {}),
    userRole: aiRoleFor(user),
    userId: user.uid,
  });

  // Public status check (returns whether AI is enabled and configured, NO secret keys)
  app.get('/api/ai/status', (req, res) => {
    try {
      const status = getPublicAIStatus();
      res.json(status);
    } catch (err) {
      sendError(res, err, 'Failed to check Ulendo status');
    }
  });

  // AI Content Generation endpoint (used by managers during onboarding & management)
  app.post('/api/ai/generate', requireAuth, aiLimiter, async (req, res) => {
    try {
      const status = getPublicAIStatus();
      if (!status.enabled) {
        return res.status(403).json({ error: 'Ulendo is currently switched off by the platform team.' });
      }
      if (!status.available) {
        return res.status(503).json({ error: 'Ulendo is not set up yet. An administrator needs to add an AI provider key.' });
      }

      const result = await executeAIGeneration(withVerifiedRole(req.body, req.authUser!));
      res.json(result);
    } catch (err: any) {
      sendAIError(res, err, 'Ulendo could not complete that request. Please try again.');
    }
  });

  // Operations assistant for admins & property managers
  app.post('/api/ai/operations-chat', requireRole('hotel_manager', 'admin', 'marketing'), aiLimiter, async (req, res) => {
    try {
      const status = getPublicAIStatus();
      if (!status.enabled) {
        return res.status(403).json({ error: 'Ulendo is currently switched off by the platform team.' });
      }
      if (!status.available) {
        return res.status(503).json({ error: 'Ulendo is not set up yet. An administrator needs to add an AI provider key.' });
      }

      const result = await executeOperationsAssistantChat(withVerifiedRole(req.body, req.authUser!));
      res.json(result);
    } catch (err: any) {
      sendAIError(res, err, 'Ulendo could not answer that right now. Please try again.');
    }
  });

  // AI Trip Planner Insights endpoint for travellers
  app.post('/api/ai/trip-insights', requireAuth, aiLimiter, async (req, res) => {
    try {
      const { stops, travelStyle, durationDays, customPreferences } = req.body || {};
      if (!Array.isArray(stops) || stops.length === 0) {
        return res.status(400).json({ error: 'At least one itinerary stop is required.' });
      }

      const insights = await generateTripInsights({
        stops: stops.slice(0, 20),
        travelStyle,
        durationDays,
        customPreferences: typeof customPreferences === 'string' ? customPreferences.slice(0, 1000) : customPreferences,
      });
      res.json(insights);
    } catch (err: any) {
      sendAIError(res, err, 'Ulendo could not prepare journey insights right now.');
    }
  });

  // AI Trip Planner Concierge Chat endpoint for travellers asking questions about their route
  app.post('/api/ai/trip-chat', requireAuth, aiLimiter, async (req, res) => {
    try {
      const { stops, message, history } = req.body || {};
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required.' });
      }
      if (!Array.isArray(stops) || stops.length === 0) {
        return res.status(400).json({ error: 'At least one itinerary stop is required.' });
      }

      const response = await executeTripConciergeChat({
        stops: stops.slice(0, 20),
        message: message.slice(0, 2000),
        history: Array.isArray(history) ? history.slice(-20) : history,
      });
      res.json(response);
    } catch (err: any) {
      sendAIError(res, err, 'Ulendo could not answer that right now.');
    }
  });

  const adminOnly = requireRole('admin');

  // Global Admin AI Configuration (GET: view status & masked keys)
  app.get('/api/admin/ai-config', adminOnly, (req, res) => {
    try {
      const config = getAdminAIConfig();
      res.json(config);
    } catch (err) {
      sendError(res, err, 'Failed to get AI config');
    }
  });

  // Global Admin AI Configuration (POST: update kill switch, active provider, keys, and models)
  app.post('/api/admin/ai-config', adminOnly, (req, res) => {
    try {
      const current = loadAIConfig();
      const { enabled, activeProvider, providerUpdates } = req.body || {};

      if (typeof enabled === 'boolean') {
        current.enabled = enabled;
      }
      if (activeProvider && current.providers[activeProvider as AIProviderId]) {
        // Automatically ensure selected active provider is enabled
        current.providers[activeProvider as AIProviderId].enabled = true;
        current.activeProvider = activeProvider as AIProviderId;
      }
      if (providerUpdates && typeof providerUpdates === 'object') {
        Object.entries(providerUpdates).forEach(([pid, update]: [string, any]) => {
          if (current.providers[pid as AIProviderId]) {
            if (typeof update.enabled === 'boolean') {
              current.providers[pid as AIProviderId].enabled = update.enabled;
              // If the currently active provider is disabled, auto-switch to another enabled provider if possible
              if (!update.enabled && current.activeProvider === pid) {
                const other = (Object.keys(current.providers) as AIProviderId[]).find(
                  otherPid => otherPid !== pid && current.providers[otherPid]?.enabled !== false && (current.providers[otherPid]?.apiKey?.trim() || getEffectiveApiKey(otherPid))
                );
                if (other) {
                  current.activeProvider = other;
                }
              }
            }
            if (typeof update.apiKey === 'string') {
              const trimmedKey = update.apiKey.trim();
              current.providers[pid as AIProviderId].apiKey = trimmedKey;
              // Reset validity status so the new key can be verified
              current.providers[pid as AIProviderId].isValid = undefined;
              current.providers[pid as AIProviderId].validationError = undefined;
            }
            if (typeof update.model === 'string' && update.model.trim()) {
              current.providers[pid as AIProviderId].model = update.model.trim();
            }
          }
        });
      }

      saveAIConfig(current);
      res.json({ success: true, config: getAdminAIConfig() });
    } catch (err) {
      sendError(res, err, 'Failed to update AI config');
    }
  });

  // Global Admin Test Connection
  app.post('/api/admin/ai-test', adminOnly, async (req, res) => {
    try {
      const { provider, apiKey, model } = req.body || {};
      if (!provider) {
        return res.status(400).json({ error: 'Provider is required' });
      }
      const testResult = await testProviderConnection(provider as AIProviderId, apiKey, model);
      res.json(testResult);
    } catch (err: any) {
      // Admin-only diagnostic: the provider's message helps fix the key.
      res.status(500).json({ error: err?.message || 'Connection test failed' });
    }
  });

  // Check live models for a single provider (Gemini, OpenAI, Groq, Mistral, DeepSeek, Anthropic)
  app.get('/api/admin/live-models', adminOnly, async (req, res) => {
    try {
      const provider = (req.query.provider as AIProviderId) || 'gemini';
      const apiKey = typeof req.query.apiKey === 'string' ? req.query.apiKey : undefined;
      const result = await fetchLiveProviderModels(provider, apiKey);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to fetch live models' });
    }
  });

  // Query live models for ALL providers simultaneously
  app.post('/api/admin/live-models-all', adminOnly, async (req, res) => {
    try {
      const customKeys = (req.body?.customKeys && typeof req.body.customKeys === 'object') ? req.body.customKeys : undefined;
      const results = await fetchAllLiveProviderModels(customKeys);
      res.json({ success: true, providers: results, timestamp: Date.now() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to query all providers' });
    }
  });

  // Backward-compatible alias for Gemini live models
  app.get('/api/admin/gemini-live-models', adminOnly, async (req, res) => {
    try {
      const apiKey = typeof req.query.apiKey === 'string' ? req.query.apiKey : undefined;
      const result = await fetchLiveGeminiModels(apiKey);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to fetch live models' });
    }
  });

  // Menu file upload - temp storage
  const menuUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
  });

  // Dedicated local menu decipher endpoint (100% offline rule-based parser)
  app.post('/api/menu/parse-local', requireAuth, aiLimiter, async (req, res) => {
    try {
      const text = typeof req.body?.text === 'string' ? req.body.text.slice(0, 100_000) : '';
      if (!text.trim()) {
        return res.status(400).json({ error: 'No menu text provided to parse' });
      }
      const currencies = Array.isArray(req.body?.currencies) ? req.body.currencies : ['USD', 'MWK'];
      const { parseMenuText } = await import('./server/localMenuParser');
      const result = parseMenuText(text, currencies);
      res.json({ sections: result.sections, engine: 'local', stats: result.stats });
    } catch (err) {
      sendError(res, err, 'Failed to read the menu text');
    }
  });

  app.post('/api/ai/parse-menu', requireAuth, aiLimiter, menuUpload.single('menu'), async (req, res) => {
    try {
      let buffer: Buffer;
      let mimeType: string;
      let fileName: string;

      if (req.file) {
        buffer = req.file.buffer;
        mimeType = req.file.mimetype;
        fileName = req.file.originalname;
      } else if (req.body?.text && typeof req.body.text === 'string' && req.body.text.trim().length > 0) {
        buffer = Buffer.from(req.body.text.slice(0, 100_000), 'utf-8');
        mimeType = 'text/plain';
        fileName = 'pasted-menu.txt';
      } else {
        return res.status(400).json({ error: 'No file uploaded or text provided' });
      }

      const currencies = (() => {
        try {
          if (Array.isArray(req.body.currencies)) return req.body.currencies;
          return JSON.parse(req.body.currencies || '[]');
        } catch {
          return ['USD', 'MWK'];
        }
      })();

      const isText = mimeType === 'text/plain' || mimeType === 'text/csv' || fileName.endsWith('.txt') || fileName.endsWith('.csv');
      const preferLocal = req.body?.engine === 'local';

      // If client requests local engine or if text is provided and AI is not active:
      const status = getPublicAIStatus();
      if (isText && (preferLocal || !status.enabled || !status.available)) {
        const { parseMenuText } = await import('./server/localMenuParser');
        const textContent = buffer.toString('utf-8');
        const parsed = parseMenuText(textContent, currencies);
        return res.json({ sections: parsed.sections, engine: 'local', stats: parsed.stats });
      }

      // If AI is needed for images/PDFs or user requested AI deep parsing:
      if (!status.enabled || !status.available) {
        return res.status(503).json({ error: 'Scanning images or PDFs requires an active AI provider. For instant free deciphering, paste the menu text or upload a text/CSV file.' });
      }

      try {
        const { parseMenuContent } = await import('./server/aiService');
        const result = await parseMenuContent(buffer, mimeType, fileName, currencies);
        res.json({ ...result, engine: 'ai' });
      } catch (aiErr: any) {
        // If AI fails but we have text, gracefully fallback to local parser
        if (isText) {
          const { parseMenuText } = await import('./server/localMenuParser');
          const textContent = buffer.toString('utf-8');
          const parsed = parseMenuText(textContent, currencies);
          if (parsed.sections && parsed.sections.length > 0) {
            return res.json({ sections: parsed.sections, engine: 'local_fallback', stats: parsed.stats });
          }
        }
        throw aiErr;
      }
    } catch (err: any) {
      sendAIError(res, err, 'Failed to read the menu. Try pasting the menu as text.');
    }
  });

  app.post('/api/ai/parse-property-doc', requireAuth, aiLimiter, menuUpload.single('document'), async (req, res) => {
    try {
      const status = getPublicAIStatus();
      if (!status.enabled || !status.available) {
        return res.status(503).json({ error: 'Property parsing requires an active AI provider. Please configure one in the Admin Dashboard.' });
      }

      let buffer: Buffer;
      let mimeType: string;
      let fileName: string;

      if (req.file) {
        buffer = req.file.buffer;
        mimeType = req.file.mimetype;
        fileName = req.file.originalname;
      } else if (req.body?.text && typeof req.body.text === 'string' && req.body.text.trim().length > 0) {
        buffer = Buffer.from(req.body.text.slice(0, 100_000), 'utf-8');
        mimeType = 'text/plain';
        fileName = 'pasted-doc.txt';
      } else {
        return res.status(400).json({ error: 'No file uploaded or text provided' });
      }

      const { parsePropertyDocContent } = await import('./server/aiService');
      const result = await parsePropertyDocContent(buffer, mimeType, fileName);
      res.json(result);
    } catch (err: any) {
      sendAIError(res, err, 'Failed to read the property document.');
    }
  });

  // ----------------------------------------------------
  // BOOKING REMINDERS API
  // ----------------------------------------------------

  /**
   * Loads a booking the caller manages (hotel manager or admin), reading it with
   * the caller's own token. Sends the error response and returns null otherwise.
   */
  const loadManagedBooking = async (req: express.Request, res: Response, bookingId: unknown, hotelId?: unknown) => {
    if (!isSafeId(bookingId)) {
      res.status(400).json({ error: 'A valid booking id is required.' });
      return null;
    }
    const user = req.authUser!;
    const booking = await readDoc('bookings', bookingId, user.token);
    if (!booking) {
      res.status(404).json({ error: 'Booking not found.' });
      return null;
    }
    if (hotelId && hotelId !== booking.hotelId) {
      res.status(400).json({ error: 'Booking does not belong to this property.' });
      return null;
    }
    if (!(await canManageHotel(user, booking.hotelId))) {
      res.status(403).json({ error: 'You do not have permission to do this.' });
      return null;
    }
    const hotel = isSafeId(booking.hotelId) ? await readDoc('hotels', booking.hotelId, user.token) : null;
    return { booking, hotel };
  };

  // Generate auto-reminders when a booking is confirmed (hotel manager or admin)
  app.post('/api/reminders/auto-generate', requireAuth, async (req, res) => {
    try {
      const body = req.body || {};
      const loaded = await loadManagedBooking(req, res, body.bookingId || body.id, body.hotelId);
      if (!loaded) return;
      const { booking, hotel } = loaded;
      if (!DATE_RE.test(String(booking.checkIn)) || !DATE_RE.test(String(booking.checkOut))) {
        return res.status(400).json({ error: 'Booking dates are missing.' });
      }

      // Contact details and dates come from the stored booking, not the request.
      const reminders = await generateAutoReminders({
        ...body,
        id: booking.id,
        reference: booking.reference || body.reference,
        hotelId: booking.hotelId,
        hotelName: hotel?.name || body.hotelName || 'Your Property',
        guestName: booking.guestName || 'Guest',
        guestEmail: booking.guestEmail || '',
        guestPhone: booking.guestPhone || '',
        guestWhatsapp: booking.guestWhatsapp || booking.guestPhone || '',
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
      });
      res.json({ success: true, reminders });
    } catch (err) {
      sendError(res, err, 'Failed to generate reminders');
    }
  });

  // Check background scheduler daemon status (admin)
  app.get('/api/reminders/scheduler-status', adminOnly, async (req, res) => {
    try {
      const pending = await getAllPendingReminders();
      res.json({
        daemonActive: true,
        intervalSeconds: 60,
        serverTime: new Date().toISOString(),
        pendingCount: pending.length,
        store: process.env.REMINDERS_STORE === 'firestore' ? 'firestore' : 'file',
        message: 'Integrated background daemon running every 60 seconds.'
      });
    } catch (err) {
      sendError(res, err, 'Failed to get scheduler status');
    }
  });

  // Get all scheduled and sent reminders for a property (hotel manager or admin)
  app.get('/api/reminders/hotel/:hotelId', requireAuth, async (req, res) => {
    try {
      const hotelId = String(req.params.hotelId);
      if (!(await canManageHotel(req.authUser, hotelId))) {
        return res.status(403).json({ error: 'You do not have permission to do this.' });
      }
      const reminders = await getRemindersForHotel(hotelId);
      res.json({ reminders });
    } catch (err) {
      sendError(res, err, 'Failed to fetch hotel reminders');
    }
  });

  // Cancel every pending reminder for a booking (guest of the booking, its manager, or admin)
  app.post('/api/reminders/booking/:bookingId/cancel', requireAuth, async (req, res) => {
    try {
      const bookingId = String(req.params.bookingId);
      const user = req.authUser!;
      const booking = isSafeId(bookingId) ? await readDoc('bookings', bookingId, user.token) : null;
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found.' });
      }
      const allowed = booking.guestId === user.uid || (await canManageHotel(user, booking.hotelId));
      if (!allowed) {
        return res.status(403).json({ error: 'You do not have permission to do this.' });
      }
      const cancelled = await cancelRemindersForBooking(bookingId);
      res.json({ success: true, cancelled });
    } catch (err) {
      sendError(res, err, 'Failed to cancel reminders');
    }
  });

  // Get reminders for a specific booking (its guest, its manager, or admin)
  app.get('/api/reminders/:bookingId', requireAuth, async (req, res) => {
    try {
      const bookingId = String(req.params.bookingId);
      const user = req.authUser!;
      const booking = isSafeId(bookingId) ? await readDoc('bookings', bookingId, user.token) : null;
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found.' });
      }
      const isGuest = booking.guestId === user.uid;
      if (!isGuest && !(await canManageHotel(user, booking.hotelId))) {
        return res.status(403).json({ error: 'You do not have permission to do this.' });
      }
      let reminders = await getRemindersForBooking(bookingId);
      if (isGuest && !isAdminUser(user)) {
        reminders = reminders.filter(r => r.recipientType === 'guest');
      }
      res.json({ reminders });
    } catch (err) {
      sendError(res, err, 'Failed to fetch reminders');
    }
  });

  // Create a manual reminder (hotel manager or admin)
  app.post('/api/reminders', requireAuth, async (req, res) => {
    try {
      const body = req.body || {};
      const loaded = await loadManagedBooking(req, res, body.bookingId, body.hotelId);
      if (!loaded) return;
      const { booking, hotel } = loaded;

      const message = cleanText(body.message, 5000);
      const scheduledFor = new Date(body.scheduledFor);
      if (!message || Number.isNaN(scheduledFor.getTime())) {
        return res.status(400).json({ error: 'A message and a valid date are required.' });
      }
      const channel = ['in_app', 'whatsapp_link', 'email'].includes(body.channel) ? body.channel : 'in_app';

      const reminder = await createManualReminder({
        bookingId: booking.id,
        bookingRef: booking.reference || cleanText(body.bookingRef, 40, true) || booking.id.slice(0, 6),
        hotelId: booking.hotelId,
        hotelName: hotel?.name || cleanText(body.hotelName, 200, true),
        guestName: booking.guestName || 'Guest',
        guestEmail: booking.guestEmail || '',
        guestPhone: booking.guestPhone || '',
        guestWhatsapp: booking.guestWhatsapp || booking.guestPhone || '',
        recipientType: body.recipientType === 'manager' ? 'manager' : 'guest',
        channel,
        subject: cleanText(body.subject, 200, true) || undefined,
        message,
        scheduledFor: scheduledFor.toISOString(),
      });
      res.json({ success: true, reminder });
    } catch (err) {
      sendError(res, err, 'Failed to create reminder');
    }
  });

  // Delete a reminder (manager of its property, or admin)
  app.delete('/api/reminders/:id', requireAuth, async (req, res) => {
    try {
      const reminder = await getReminder(String(req.params.id));
      if (!reminder) {
        return res.json({ success: false });
      }
      if (!(await canManageHotel(req.authUser, reminder.hotelId))) {
        return res.status(403).json({ error: 'You do not have permission to do this.' });
      }
      const deleted = await deleteReminder(reminder.id);
      res.json({ success: deleted });
    } catch (err) {
      sendError(res, err, 'Failed to delete reminder');
    }
  });

  // Send an email reminder to the booking's guest now (hotel manager or admin)
  app.post('/api/reminders/send-email', requireAuth, async (req, res) => {
    try {
      const body = req.body || {};
      const loaded = await loadManagedBooking(req, res, body.bookingId, body.hotelId);
      if (!loaded) return;
      const { booking, hotel } = loaded;

      const to = lower(body.guestEmail);
      if (!to || to !== lower(booking.guestEmail)) {
        return res.status(403).json({ error: 'Reminders can only be emailed to the guest on this booking.' });
      }
      const subject = cleanText(body.subject, 200, true);
      const message = cleanText(body.message, 10_000);
      if (!subject || !message) {
        return res.status(400).json({ error: 'Subject and message are required.' });
      }

      const result = await sendReminderEmailNow({
        bookingId: booking.id,
        bookingRef: booking.reference || cleanText(body.bookingRef, 40, true) || booking.id.slice(0, 6),
        hotelId: booking.hotelId,
        hotelName: hotel?.name || cleanText(body.hotelName, 200, true),
        guestName: booking.guestName || 'Guest',
        guestEmail: booking.guestEmail,
        subject,
        message,
      });
      if (!result.success) {
        console.error('[API] Reminder email failed:', result.error);
        return res.status(400).json({ error: 'The email could not be sent. Check the SMTP settings.' });
      }
      res.json({ success: true, reminder: result.reminder });
    } catch (err) {
      sendError(res, err, 'Failed to send email reminder');
    }
  });

  // Send a test template email to the signed-in manager's own inbox
  app.post('/api/reminders/test-template', requireRole('hotel_manager', 'admin', 'marketing'), async (req, res) => {
    try {
      const { toEmail, hotelName, bookingRef, templateTitle, subject, message } = req.body || {};
      const user = req.authUser!;
      if (!toEmail || !subject || !message) {
        return res.status(400).json({ error: 'Recipient email, subject, and message are required.' });
      }
      if (!isAdminUser(user) && lower(toEmail) !== user.email) {
        return res.status(403).json({ error: 'Test emails can only be sent to your own address.' });
      }
      const result = await sendTestTemplateEmail({
        toEmail: lower(toEmail),
        hotelName: cleanText(hotelName, 200, true) || 'Property',
        bookingRef: cleanText(bookingRef, 40, true) || undefined,
        templateTitle: cleanText(templateTitle, 200, true) || 'Email Template',
        subject: cleanText(subject, 200, true),
        message: cleanText(message, 10_000),
      });
      if (!result.success) {
        console.error('[API] Test template email failed:', result.error);
        return res.status(400).json({ error: 'The test email could not be sent. Check the SMTP settings.' });
      }
      res.json({ success: true });
    } catch (err) {
      sendError(res, err, 'Failed to send test email');
    }
  });

  // ----------------------------------------------------
  // ADMIN SMTP & EMAIL CONFIGURATION API
  // ----------------------------------------------------

  // Get current SMTP configuration (masked password)
  app.get('/api/admin/email-config', adminOnly, (req, res) => {
    try {
      const config = getAdminEmailConfig();
      res.json({ config });
    } catch (err) {
      sendError(res, err, 'Failed to fetch email config');
    }
  });

  // Save updated SMTP configuration
  app.post('/api/admin/email-config', adminOnly, (req, res) => {
    try {
      saveEmailConfig(req.body || {});
      const safeConfig = getAdminEmailConfig();
      res.json({ success: true, config: safeConfig });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to save email config' });
    }
  });

  // Test SMTP connection and optional test email
  app.post('/api/admin/email-test', adminOnly, async (req, res) => {
    try {
      const { testEmail, config } = req.body || {};
      const result = await testSMTPConnection(testEmail, config);
      res.json(result);
    } catch (err: any) {
      // Admin-only diagnostic: the SMTP server's reply helps fix the settings.
      res.status(400).json({ error: err?.message || 'SMTP connection test failed' });
    }
  });

  // Password reset email notice via SMTP (aligned with auth flows). Public, so
  // it is rate limited per IP and per address and only ever sends fixed text.
  app.post('/api/auth/notify-password-reset', resetIpLimiter, resetEmailLimiter, async (req, res) => {
    try {
      const cleanEmail = lower(cleanText(req.body?.email, 254, true));
      if (!cleanEmail || !cleanEmail.includes('@')) {
        return res.status(400).json({ error: 'Email is required.' });
      }

      const result = await sendSystemEmail({
        to: cleanEmail,
        subject: 'Security Alert: Password Reset Requested — Travel Malawi',
        text: `Hello,\n\nA password reset request was initiated for your Travel Malawi account (${cleanEmail}).\n\nIf you requested this change, please check your inbox (including Spam/Junk folder) for the reset verification link.\n\nIf you did not make this request, your account remains secure and no action is required.`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 28px 24px; border: 1px solid #e7e5e4; background: #ffffff; color: #1c1917;">
            <h2 style="margin: 0 0 6px; font-size: 20px; font-weight: 600; color: #1c1917;">Password reset requested</h2>
            <p style="margin: 0 0 16px; font-size: 13px; color: #78716c;">Travel Malawi account security</p>
            <p style="margin: 0 0 10px; font-size: 14px; line-height: 1.5; color: #44403c;">
              A password reset request was initiated for <strong>${escapeHtml(cleanEmail)}</strong>.
            </p>
            <p style="margin: 0; font-size: 13px; color: #57534e; line-height: 1.6;">
              Check your inbox for the reset link. If you did not request this, you can ignore this message.
            </p>
          </div>
        `,
      });

      res.json({ success: true, emailSent: result.success });
    } catch (err) {
      console.error('[API] Password reset notice failed:', err);
      res.json({ success: true, emailSent: false });
    }
  });

  // Account status notifications (revoked / restored) — admin only
  app.post('/api/admin/notify-account-status', adminOnly, async (req, res) => {
    try {
      const { email, status, name } = req.body || {};
      const to = lower(cleanText(email, 254, true));
      if (!to.includes('@')) return res.status(400).json({ error: 'Email is required' });

      const displayName = cleanText(name, 120, true) || 'User';
      const isRevoked = status === 'revoked';
      const result = await sendSystemEmail({
        to,
        subject: isRevoked
          ? 'Account Access Suspended — Travel Malawi'
          : 'Account Access Restored — Travel Malawi',
        text: isRevoked
          ? `Hello ${displayName},\n\nYour account access on Travel Malawi has been suspended by an administrator. Please reach out to support if you believe this was in error.`
          : `Hello ${displayName},\n\nYour account access on Travel Malawi has been restored. You may now sign in again.`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 28px 24px; border: 1px solid #e7e5e4; background: #ffffff; color: #1c1917;">
            <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #1c1917;">${isRevoked ? 'Account access suspended' : 'Account access restored'}</h2>
            <p style="font-size: 14px; line-height: 1.6; color: #44403c;">
              Hello ${escapeHtml(displayName)},<br/><br/>
              ${isRevoked
                ? 'Your account access to the Travel Malawi platform has been suspended by an administrator.'
                : 'Your account access to the Travel Malawi platform has been restored.'}
            </p>
          </div>
        `
      });

      res.json({ success: true, emailSent: result.success });
    } catch (err) {
      console.error('[API] Account status email failed:', err);
      res.json({ success: true, emailSent: false });
    }
  });

  // Permanently delete user profile and Auth account (admin only)
  app.post('/api/admin/delete-user', adminOnly, async (req, res) => {
    try {
      const { uid } = req.body || {};
      if (!uid || typeof uid !== 'string') {
        return res.status(400).json({ error: 'UID is required' });
      }

      if (req.authUser?.uid === uid) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
      }

      // Check caller's privileges: only global admin or owner can delete an admin
      const targetUser = await readDoc('users', uid, req.authUser?.token);
      if (targetUser) {
        const targetRoles: string[] = Array.isArray(targetUser.roles)
          ? targetUser.roles
          : [targetUser.role || ''];
        const isCallerGlobal =
          req.authUser?.roles.includes('global_admin') ||
          (req.authUser?.email && OWNER_EMAILS.includes(req.authUser.email.toLowerCase()));

        if ((targetRoles.includes('admin') || targetRoles.includes('global_admin')) && !isCallerGlobal) {
          return res.status(403).json({ error: 'Only a Global Admin can delete an administrator profile' });
        }
      }

      // 1. Delete user document from Firestore REST
      const deleteUrl = `${FIRESTORE_BASE}/users/${encodeURIComponent(uid)}`;
      await fetch(deleteUrl, {
        method: 'DELETE',
        headers: req.authUser?.token ? { Authorization: `Bearer ${req.authUser.token}` } : {},
      }).catch((err) => console.warn('[server] Firestore REST delete warning:', err));

      // 2. Try deleting from Firebase Auth via Admin SDK
      try {
        const auth = adminAuth();
        await auth.deleteUser(uid);
      } catch (authErr: any) {
        console.warn(`[server] Admin Auth deleteUser for ${uid}:`, authErr?.message);
      }

      res.json({ success: true, uid });
    } catch (err: any) {
      console.error('[server] Error in /api/admin/delete-user:', err);
      res.status(500).json({ error: err?.message || 'Failed to delete user' });
    }
  });

  // ----------------------------------------------------
  // ADMIN WHATSAPP & MESSAGING CONFIGURATION API
  // ----------------------------------------------------

  // Public status check (whether WhatsApp is enabled and configured, NO credentials)
  app.get('/api/whatsapp/status', (req, res) => {
    try {
      const status = getPublicWhatsAppStatus();
      res.json(status);
    } catch (err) {
      sendError(res, err, 'Failed to fetch WhatsApp status');
    }
  });

  // Get current WhatsApp configuration (masked access token)
  app.get('/api/admin/whatsapp-config', adminOnly, (req, res) => {
    try {
      const config = getAdminWhatsAppConfig();
      res.json({ config });
    } catch (err) {
      sendError(res, err, 'Failed to fetch WhatsApp config');
    }
  });

  // Save updated WhatsApp configuration
  app.post('/api/admin/whatsapp-config', adminOnly, (req, res) => {
    try {
      saveWhatsAppConfig(req.body || {});
      const safeConfig = getAdminWhatsAppConfig();
      res.json({ success: true, config: safeConfig });
    } catch (err) {
      sendError(res, err, 'Failed to save WhatsApp config');
    }
  });

  // Test WhatsApp connection and optional test message
  app.post('/api/admin/whatsapp-test', adminOnly, async (req, res) => {
    try {
      const { testPhone, config } = req.body || {};
      const result = await testWhatsAppConnection(testPhone, config);
      res.json(result);
    } catch (err: any) {
      // Admin-only diagnostic.
      res.status(400).json({ error: err?.message || 'WhatsApp connection test failed' });
    }
  });

  // Send a WhatsApp reminder to the booking's guest now (hotel manager or admin)
  app.post('/api/reminders/send-whatsapp', requireAuth, async (req, res) => {
    try {
      const body = req.body || {};
      const loaded = await loadManagedBooking(req, res, body.bookingId, body.hotelId);
      if (!loaded) return;
      const { booking, hotel } = loaded;

      const target = body.guestWhatsapp || body.guestPhone;
      if (!target || !(samePhone(target, booking.guestWhatsapp) || samePhone(target, booking.guestPhone))) {
        return res.status(403).json({ error: 'WhatsApp reminders can only go to the guest on this booking.' });
      }
      const message = cleanText(body.message, 4000);
      if (!message) {
        return res.status(400).json({ error: 'Message text is required.' });
      }

      const result = await sendReminderWhatsAppNow({
        bookingId: booking.id,
        bookingRef: booking.reference || cleanText(body.bookingRef, 40, true) || booking.id.slice(0, 6),
        hotelId: booking.hotelId,
        hotelName: hotel?.name || cleanText(body.hotelName, 200, true),
        guestName: booking.guestName || 'Guest',
        guestPhone: booking.guestPhone,
        guestWhatsapp: String(target),
        subject: cleanText(body.subject, 200, true) || undefined,
        message,
      });
      if (!result.success) {
        console.error('[API] WhatsApp reminder failed:', result.error);
        return res.status(400).json({ error: 'The WhatsApp message could not be sent. Check the WhatsApp settings.' });
      }
      res.json(result);
    } catch (err) {
      sendError(res, err, 'Failed to dispatch WhatsApp reminder');
    }
  });

  // Generic send WhatsApp message endpoint (admin only)
  app.post('/api/whatsapp/send', adminOnly, async (req, res) => {
    try {
      const { to, message } = req.body || {};
      if (!to || !message) {
        return res.status(400).json({ error: 'Recipient phone number and message text are required.' });
      }
      const result = await sendWhatsAppMessage(String(to), cleanText(message, 4000));
      if (!result.success) {
        return res.status(400).json({ error: result.error || 'Failed to send WhatsApp message' });
      }
      res.json(result);
    } catch (err) {
      sendError(res, err, 'Failed to send WhatsApp message');
    }
  });

  // Start reminder cron (check every 60 seconds); a pass never overlaps the previous one
  const reminderInterval = setInterval(() => {
    checkAndFireReminders().catch(err => {
      console.warn('[Reminders] Periodic reminder pass caught error:', err?.message || err);
    });
  }, 60_000);

  // ----------------------------------------------------
  // DOCUMENTATION API
  // ----------------------------------------------------

  const docEditors = requireRole('marketing', 'admin');

  // List available documents (marketing / admin)
  app.get('/api/admin/docs', docEditors, (req, res) => {
    try {
      const docs = getAdminDocsList();
      res.json({ docs });
    } catch (err) {
      sendError(res, err, 'Failed to list documents');
    }
  });

  // Get a document as text, markdown, or standalone HTML. Public: these are the
  // partner guides, also linked as plain downloads from the public guide pages.
  app.get('/api/admin/docs/:id', (req, res) => {
    try {
      const rawFormat = String(req.query.format || '').toLowerCase();
      let format: 'text' | 'md' | 'html' = 'text';
      if (rawFormat === 'html') {
        format = 'html';
      } else if (rawFormat === 'md' || rawFormat === 'markdown') {
        format = 'md';
      }

      const isDownload = req.query.download === '1' || req.query.download === 'true';
      const isRawView = req.query.raw === '1' || req.query.raw === 'true';
      const docResult = getAdminDocContent(String(req.params.id), format);

      if (!docResult) {
        return res.status(404).json({ error: 'Document not found' });
      }

      const mimeType = format === 'html'
        ? 'text/html; charset=utf-8'
        : format === 'text'
        ? 'text/plain; charset=utf-8'
        : 'text/markdown; charset=utf-8';

      if (isDownload) {
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${docResult.filename}"`);
        return res.send(docResult.content);
      }

      // If user asks for raw html rendering directly in browser tab
      if (isRawView && format === 'html') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(docResult.content);
      }

      res.json(docResult);
    } catch (err) {
      sendError(res, err, 'Failed to read document');
    }
  });

  // Public alias for accessing current document content
  app.get('/api/docs/:id', (req, res) => {
    try {
      const rawFormat = String(req.query.format || '').toLowerCase();
      let format: 'text' | 'md' | 'html' = 'text';
      if (rawFormat === 'html') format = 'html';
      else if (rawFormat === 'md' || rawFormat === 'markdown') format = 'md';

      const docResult = getAdminDocContent(String(req.params.id), format);
      if (!docResult) {
        return res.status(404).json({ error: 'Document not found' });
      }
      res.json(docResult);
    } catch (err) {
      sendError(res, err, 'Failed to read document');
    }
  });

  // Update document content & metadata (marketing / admin)
  const handleDocSave = (req: express.Request, res: Response) => {
    try {
      const { title, subtitle, category, content, lastEditedBy } = req.body || {};
      const result = saveAdminDoc(String(req.params.id), {
        title,
        subtitle,
        category,
        content,
        lastEditedBy: cleanText(lastEditedBy, 120, true) || req.authUser?.email || 'Marketing / Admin',
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error || 'Failed to save document' });
      }

      res.json({
        success: true,
        doc: result.doc,
        message: 'Document saved and updated successfully',
      });
    } catch (err) {
      sendError(res, err, 'Failed to update document');
    }
  };
  app.put('/api/admin/docs/:id', docEditors, handleDocSave);
  app.post('/api/admin/docs/:id', docEditors, handleDocSave);

  // Reset document to factory default template
  app.post('/api/admin/docs/:id/reset', docEditors, (req, res) => {
    try {
      const result = resetAdminDoc(String(req.params.id));
      if (!result.success) {
        return res.status(400).json({ error: result.error || 'Failed to reset document' });
      }

      res.json({
        success: true,
        doc: result.doc,
        content: result.content,
        message: 'Document restored to original factory defaults',
      });
    } catch (err) {
      sendError(res, err, 'Failed to reset document');
    }
  });

  // Review Scraper endpoint (admin / marketing)
  app.post('/api/admin/scrape-reviews', requireRole('admin', 'marketing'), aiLimiter, async (req, res) => {
    try {
      const status = getPublicAIStatus();
      if (!status.enabled || !status.available) {
        return res.status(503).json({ error: 'AI provider must be active to scrape reviews.' });
      }

      const hotelName = cleanText(req.body?.hotelName, 200, true);
      const location = cleanText(req.body?.location, 200, true);
      if (!hotelName) {
        return res.status(400).json({ error: 'Hotel name is required' });
      }

      const result = await executeAIGeneration(withVerifiedRole({
        action: 'scrape_reviews',
        entityType: 'property',
        details: {
          name: hotelName,
          location
        }
      }, req.authUser!));

      res.json(result);
    } catch (err: any) {
      sendAIError(res, err, 'Failed to look up reviews');
    }
  });

  // ----------------------------------------------------
  // PARTNER SURVEY SUBMISSION API (PUBLIC & ADMIN)
  // ----------------------------------------------------

  const SURVEYS_FILE = path.join(process.cwd(), 'server', 'data', 'surveys.json');

  // Helper to read surveys
  const readSurveys = (): any[] => {
    try {
      if (fs.existsSync(SURVEYS_FILE)) {
        const raw = fs.readFileSync(SURVEYS_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch {
      // fallback
    }
    return [];
  };

  // Helper to save surveys
  const saveSurveys = (surveys: any[]) => {
    const dir = path.dirname(SURVEYS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SURVEYS_FILE, JSON.stringify(surveys, null, 2), 'utf-8');
  };

  const shortList = (value: unknown, maxItems: number) =>
    Array.isArray(value) ? value.slice(0, maxItems).map(v => cleanText(v, 200, true)) : [];

  // Public endpoint for submitting partner surveys, host onboarding requests, and document feedback
  app.post('/api/surveys/submit', surveyLimiter, (req, res) => {
    try {
      const {
        type,
        docType,
        sourceDoc,
        propName,
        propLoc,
        contactName,
        contactEmail,
        contactPhone,
        notes,
        channels,
        painPoints,
        features,
        pilotInterest,
        roomTypes,
        feedback
      } = req.body || {};

      if (!propName && !contactPhone && !contactName && !contactEmail && !feedback && !notes) {
        return res.status(400).json({ error: 'Please provide at least a property name, contact details, or notes.' });
      }

      const safePainPoints: Record<string, number | string> = {};
      if (painPoints && typeof painPoints === 'object' && !Array.isArray(painPoints)) {
        for (const [k, v] of Object.entries(painPoints).slice(0, 20)) {
          safePainPoints[cleanText(k, 60, true)] = typeof v === 'number' ? v : cleanText(v, 200, true);
        }
      }

      const submissionType = cleanText(type || docType || 'concept_survey', 60, true);
      const surveys = readSurveys();
      const newSubmission = {
        id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        type: submissionType,
        sourceDoc: cleanText(sourceDoc, 120, true) || 'Document Hub',
        propName: cleanText(propName, 200, true) || 'Unnamed Stay / Partner',
        propLoc: cleanText(propLoc, 200, true),
        contactName: cleanText(contactName, 120, true),
        contactEmail: cleanText(contactEmail, 254, true),
        contactPhone: cleanText(contactPhone, 40, true),
        notes: cleanText(notes || feedback, 5000),
        roomTypes: cleanText(roomTypes, 500),
        channels: shortList(channels, 20),
        painPoints: safePainPoints,
        features: shortList(features, 20),
        pilotInterest: cleanText(pilotInterest, 60, true) || 'yes',
        status: 'new',
        submittedAt: new Date().toISOString(),
        userAgent: cleanText(req.headers['user-agent'], 300, true),
        ip: clientIp(req),
      };

      surveys.unshift(newSubmission);
      saveSurveys(surveys);

      const { ip: _ip, userAgent: _ua, ...publicSubmission } = newSubmission;
      res.status(201).json({
        success: true,
        id: newSubmission.id,
        message: 'Zikomo kwambiri! Your submission has been received by our hospitality team.',
        submission: publicSubmission
      });
    } catch (err) {
      sendError(res, err, 'Failed to record response');
    }
  });

  // Admin endpoint to view all survey responses
  app.get('/api/admin/surveys', requireRole('admin', 'marketing'), (req, res) => {
    try {
      const surveys = readSurveys();
      res.json({ success: true, count: surveys.length, surveys });
    } catch (err) {
      sendError(res, err, 'Failed to list surveys');
    }
  });

  // Unknown API routes return JSON 404 instead of falling through to the SPA.
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Explicitly block any direct public access to backend code, source maps, internal docs, or markdown files
  app.use((req, res, next) => {
    if (
      req.path === '/server.cjs' ||
      req.path === '/server.cjs.map' ||
      req.path.startsWith('/docs') ||
      req.path.endsWith('.md')
    ) {
      return res.status(404).send('Not Found');
    }
    next();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Graceful shutdown handling for Cloud Run container lifecycle
  const handleShutdown = (signal: string) => {
    console.log(`Received ${signal}, initiating graceful shutdown...`);
    clearInterval(reminderInterval);
    server.close(() => {
      console.log('HTTP server closed successfully.');
      process.exit(0);
    });
    setTimeout(() => {
      console.warn('Forcefully terminating after shutdown timeout.');
      process.exit(0);
    }, 5000);
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
  });
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
}

startServer();
