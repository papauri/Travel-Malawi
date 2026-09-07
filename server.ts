import express from 'express';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { getPublicAIStatus, getAdminAIConfig, loadAIConfig, saveAIConfig, AIProviderId } from './server/aiConfig';
import { executeAIGeneration, executeOperationsAssistantChat, testProviderConnection } from './server/aiService';
import { sendOfflineNotification } from './server/notifications';
import { generateAutoReminders, createManualReminder, getRemindersForBooking, deleteReminder, checkAndFireReminders } from './server/reminders';
import { getAdminDocsList, getAdminDocContent } from './server/docUtils';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Setup storage folders
  const UPLOADS_DIR = path.join(process.cwd(), 'images');
  const BACKUPS_DIR = path.join(process.cwd(), 'backup_images');

  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

  // Serve static images directly from the local folder
  app.use('/images', express.static(UPLOADS_DIR));

  // Multer config for file upload
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const folder = req.body.folder || 'uploads';
      const targetDir = path.join(UPLOADS_DIR, folder);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      cb(null, targetDir);
    },
    filename: (req, file, cb) => {
      const ext = file.mimetype.split('/')[1] || 'jpg';
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
      cb(null, uniqueName);
    }
  });

  const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } }); // 8MB limit

  // Parse JSON bodies for API routes
  app.use(express.json());

  // Health check routes for Cloud Run / AI Studio container probes
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', time: new Date().toISOString() });
  });

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', time: new Date().toISOString() });
  });

  // API route for upload
  app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const folder = req.body.folder || 'uploads';
    // Return relative URL so frontend can render it via static middleware
    const imageUrl = `/images/${folder}/${req.file.filename}`;
    res.json({ url: imageUrl });
  });

  // API route to archive (delete) a stay's images
  app.post('/api/hotels/:id/archive-images', (req, res) => {
    const { id } = req.params;
    const hotelDir = path.join(UPLOADS_DIR, 'hotels', id);
    const backupDir = path.join(BACKUPS_DIR, 'hotels', id);

    if (fs.existsSync(hotelDir)) {
      if (!fs.existsSync(path.dirname(backupDir))) {
        fs.mkdirSync(path.dirname(backupDir), { recursive: true });
      }
      // Move the folder
      fs.renameSync(hotelDir, backupDir);
    }
    res.json({ success: true });
  });

  // API route to send offline notifications
  app.post('/api/notify', async (req, res) => {
    try {
      const { email, subject, message } = req.body;
      if (!email || !subject || !message) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      await sendOfflineNotification(email, subject, message);
      res.json({ success: true });
    } catch (err: any) {
      console.error('Notification Error:', err);
      res.status(500).json({ error: 'Failed to send notification' });
    }
  });
  // ----------------------------------------------------
  // AI ASSISTANT API ROUTES (Server-side & Secure)
  // ----------------------------------------------------

  // Public/Manager status check (returns whether AI is enabled and configured, NO secret keys)
  app.get('/api/ai/status', (req, res) => {
    try {
      const status = getPublicAIStatus();
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to check AI status' });
    }
  });

  // AI Content Generation endpoint (used by managers during onboarding & management)
  app.post('/api/ai/generate', async (req, res) => {
    try {
      const status = getPublicAIStatus();
      if (!status.enabled) {
        return res.status(403).json({ error: 'AI Assistant is currently disabled by platform administration.' });
      }
      if (!status.available) {
        return res.status(503).json({ error: 'AI Assistant is not yet configured with an active provider key.' });
      }

      const result = await executeAIGeneration(req.body);
      res.json(result);
    } catch (err: any) {
      console.error('AI Generation Error:', err);
      res.status(500).json({ error: err?.message || 'AI generation failed' });
    }
  });

  // Dedicated Executive Operations Copilot endpoint for Admins & Property Managers
  app.post('/api/ai/operations-chat', async (req, res) => {
    try {
      const status = getPublicAIStatus();
      if (!status.enabled) {
        return res.status(403).json({ error: 'AI Copilot is currently disabled by platform administration.' });
      }
      if (!status.available) {
        return res.status(503).json({ error: 'AI Copilot is not yet configured with an active provider key.' });
      }

      const result = await executeOperationsAssistantChat(req.body);
      res.json(result);
    } catch (err: any) {
      console.error('AI Operations Chat Error:', err);
      res.status(500).json({ error: err?.message || 'Failed to process operations assistant query' });
    }
  });

  // Global Admin AI Configuration (GET: view status & masked keys)
  app.get('/api/admin/ai-config', (req, res) => {
    try {
      const config = getAdminAIConfig();
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to get AI config' });
    }
  });

  // Global Admin AI Configuration (POST: update kill switch, active provider, keys, and models)
  app.post('/api/admin/ai-config', (req, res) => {
    try {
      const current = loadAIConfig();
      const { enabled, activeProvider, providerUpdates } = req.body;

      if (typeof enabled === 'boolean') {
        current.enabled = enabled;
      }
      if (activeProvider && current.providers[activeProvider as AIProviderId]) {
        current.activeProvider = activeProvider as AIProviderId;
      }
      if (providerUpdates && typeof providerUpdates === 'object') {
        Object.entries(providerUpdates).forEach(([pid, update]: [string, any]) => {
          if (current.providers[pid as AIProviderId]) {
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
    } catch (err: any) {
      console.error('Failed to update AI config:', err);
      res.status(500).json({ error: err?.message || 'Failed to update AI config' });
    }
  });

  // Global Admin Test Connection
  app.post('/api/admin/ai-test', async (req, res) => {
    try {
      const { provider } = req.body;
      if (!provider) {
        return res.status(400).json({ error: 'Provider is required' });
      }
      const testResult = await testProviderConnection(provider as AIProviderId);
      res.json(testResult);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Connection test failed' });
    }
  });

  // Menu file upload - temp storage
  const menuUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
  });

  app.post('/api/ai/parse-menu', menuUpload.single('menu'), async (req, res) => {
    try {
      const status = getPublicAIStatus();
      if (!status.enabled || !status.available) {
        return res.status(503).json({ error: 'Menu scanning requires an active AI provider. Please configure one in the Admin Dashboard.' });
      }

      let buffer: Buffer;
      let mimeType: string;
      let fileName: string;

      if (req.file) {
        buffer = req.file.buffer;
        mimeType = req.file.mimetype;
        fileName = req.file.originalname;
      } else if (req.body?.text && typeof req.body.text === 'string' && req.body.text.trim().length > 0) {
        buffer = Buffer.from(req.body.text, 'utf-8');
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

      const { parseMenuContent } = await import('./server/aiService');
      const result = await parseMenuContent(buffer, mimeType, fileName, currencies);
      res.json(result);
    } catch (err: any) {
      console.error('Menu parse error:', err);
      res.status(500).json({ error: err?.message || 'Failed to parse menu' });
    }
  });

  app.post('/api/ai/parse-property-doc', menuUpload.single('document'), async (req, res) => {
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
        buffer = Buffer.from(req.body.text, 'utf-8');
        mimeType = 'text/plain';
        fileName = 'pasted-doc.txt';
      } else {
        return res.status(400).json({ error: 'No file uploaded or text provided' });
      }

      const { parsePropertyDocContent } = await import('./server/aiService');
      const result = await parsePropertyDocContent(buffer, mimeType, fileName);
      res.json(result);
    } catch (err: any) {
      console.error('Property doc parse error:', err);
      res.status(500).json({ error: err?.message || 'Failed to parse property document' });
    }
  });

  // ----------------------------------------------------
  // BOOKING REMINDERS API
  // ----------------------------------------------------

  // Generate auto-reminders when a booking is confirmed
  app.post('/api/reminders/auto-generate', (req, res) => {
    try {
      const reminders = generateAutoReminders(req.body);
      res.json({ success: true, reminders });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to generate reminders' });
    }
  });

  // Get reminders for a specific booking
  app.get('/api/reminders/:bookingId', (req, res) => {
    try {
      const reminders = getRemindersForBooking(req.params.bookingId);
      res.json({ reminders });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to fetch reminders' });
    }
  });

  // Create a manual reminder
  app.post('/api/reminders', (req, res) => {
    try {
      const reminder = createManualReminder(req.body);
      res.json({ success: true, reminder });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to create reminder' });
    }
  });

  // Delete a reminder
  app.delete('/api/reminders/:id', (req, res) => {
    try {
      const deleted = deleteReminder(req.params.id);
      res.json({ success: deleted });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to delete reminder' });
    }
  });

  // Start reminder cron (check every 60 seconds)
  setInterval(() => {
    const { fired } = checkAndFireReminders();
    if (fired.length > 0) {
      console.log(`[Reminders] Fired ${fired.length} reminder(s)`);
    }
  }, 60_000);

  // ----------------------------------------------------
  // GLOBAL ADMIN DOCUMENTATION API (RESTRICTED TO ADMIN)
  // ----------------------------------------------------

  // List available executive documents
  app.get('/api/admin/docs', (req, res) => {
    try {
      const docs = getAdminDocsList();
      res.json({ docs });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to list documents' });
    }
  });

  // Get specific document in readable plain text (.txt) or markdown (.md)
  app.get('/api/admin/docs/:id', (req, res) => {
    try {
      const format = req.query.format === 'md' || req.query.format === 'markdown' ? 'md' : 'text';
      const isDownload = req.query.download === '1' || req.query.download === 'true';
      const docResult = getAdminDocContent(req.params.id, format);

      if (!docResult) {
        return res.status(404).json({ error: 'Document not found' });
      }

      if (isDownload) {
        const mimeType = format === 'text' ? 'text/plain; charset=utf-8' : 'text/markdown; charset=utf-8';
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${docResult.filename}"`);
        return res.send(docResult.content);
      }

      res.json(docResult);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to read document' });
    }
  });

  // Explicitly block any direct public access to internal docs paths or raw markdown files
  app.use((req, res, next) => {
    if (req.path.startsWith('/docs') || req.path.endsWith('.md')) {
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
