import express from 'express';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

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
  app.post('/api/hotels/:id/archive-images', express.json(), (req, res) => {
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
