import fs from 'fs';

/**
 * Checks if GOOGLE_APPLICATION_CREDENTIALS points to an existing file.
 * If it points to a non-existent path or dummy placeholder (e.g. "GOOGLE_APPLICATION_CREDENTIALS"),
 * remove it from process.env so that google-auth-library / grpc will not throw ENOENT on lstat.
 */
export function sanitizeEnvironment(): void {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    try {
      if (!fs.existsSync(credPath) || fs.statSync(credPath).isDirectory()) {
        delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
      }
    } catch {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
  }
}

// Run immediately upon import
sanitizeEnvironment();
