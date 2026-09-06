/**
 * Shared Admin SDK bootstrap for the maintenance scripts in this directory.
 *
 * The Admin SDK bypasses security rules entirely, so these scripts are the only
 * way to repair data that the rules (correctly) stop the app from touching —
 * reassigning a listing's owner, writing a user's role, backfilling a field.
 *
 * Credentials, in order of preference:
 *   1. GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account JSON
 *   2. ./service-account.json in the repo root (gitignored)
 *
 * Get a key from: Firebase Console -> Project settings -> Service accounts ->
 * Generate new private key.
 */
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Test-account passwords live in .env, which is gitignored. Without this the
// seed script generates a fresh password on every run, so the accounts would
// change credentials each time they were re-seeded.
dotenv.config({ path: path.join(repoRoot, '.env'), quiet: true });

const appletConfig = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'firebase-applet-config.json'), 'utf-8')
);

/** The named database the app actually uses — not (default). */
export const DATABASE_ID = appletConfig.firestoreDatabaseId || '(default)';
export const PROJECT_ID = appletConfig.projectId;

function credential() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return applicationDefault();
  }
  const keyPath = path.join(repoRoot, 'service-account.json');
  if (fs.existsSync(keyPath)) {
    return cert(JSON.parse(fs.readFileSync(keyPath, 'utf-8')));
  }
  console.error(
    '\nNo Admin credentials found.\n\n' +
    '  Firebase Console -> Project settings -> Service accounts -> Generate new private key\n' +
    `  Save it as: ${keyPath}\n\n` +
    '  (that filename is already gitignored)\n'
  );
  process.exit(1);
}

const app = initializeApp({ credential: credential(), projectId: PROJECT_ID });

export const db = getFirestore(app, DATABASE_ID);
export const auth = getAuth(app);

/** Scripts here mutate live data, so they only write when told to. */
export const APPLY = process.argv.includes('--apply');

export function heading(text) {
  console.log(`\n${text}\n${'-'.repeat(text.length)}`);
}

export function plan(action) {
  console.log(`${APPLY ? '  APPLY ' : '  would'} ${action}`);
}

export function summarise(changeCount) {
  if (APPLY) {
    console.log(`\nDone. ${changeCount} change(s) written to ${DATABASE_ID}.`);
  } else {
    console.log(
      `\nDry run: ${changeCount} change(s) pending against ${DATABASE_ID}.` +
      '\nRe-run with --apply to write them.'
    );
  }
}
