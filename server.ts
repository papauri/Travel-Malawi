import express from 'express';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { getPublicAIStatus, getAdminAIConfig, loadAIConfig, saveAIConfig, AIProviderId } from './server/aiConfig';
import { executeAIGeneration, executeOperationsAssistantChat, testProviderConnection } from './server/aiService';

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
              current.providers[pid as AIProviderId].apiKey = update.apiKey.trim();
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
