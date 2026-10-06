/**
 * Creates the public `booking_slots/{bookingId}` mirror for every existing
 * booking. Run once, after deploying the app and before deploying the rules
 * that make bookings private (see BUILD.md, "Deploy order").
 *
 * Uses the Admin SDK, so it bypasses the rules and needs a service account:
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json node scripts/backfill-booking-slots.mjs --dry-run
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json node scripts/backfill-booking-slots.mjs
 *
 * Safe to re-run: each slot is overwritten from its booking.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'node:fs';

const dryRun = process.argv.includes('--dry-run');

const config = JSON.parse(fs.readFileSync(new URL('../firebase-applet-config.json', import.meta.url), 'utf-8'));
const firebaseJson = JSON.parse(fs.readFileSync(new URL('../firebase.json', import.meta.url), 'utf-8'));
const databaseId = config.firestoreDatabaseId || firebaseJson.firestore?.[0]?.database || '(default)';

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS || !fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to a valid service-account key file with Firestore access.');
  process.exit(1);
}

const app = initializeApp({ credential: applicationDefault(), projectId: config.projectId });
const db = getFirestore(app, databaseId);

function slotFor(b) {
  return {
    hotelId: String(b.hotelId ?? ''),
    roomTypeId: String(b.roomTypeId ?? ''),
    checkIn: String(b.checkIn ?? ''),
    checkOut: String(b.checkOut ?? ''),
    quantity: typeof b.quantity === 'number' ? b.quantity : 1,
    status: String(b.status ?? 'pending'),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

const snap = await db.collection('bookings').get();
console.log(`database: ${databaseId}  bookings: ${snap.size}${dryRun ? '  (dry run, nothing written)' : ''}`);

let written = 0;
let skipped = 0;
let batch = db.batch();
let inBatch = 0;

for (const d of snap.docs) {
  const b = d.data();
  if (!b.hotelId || !b.roomTypeId || !b.checkIn || !b.checkOut) {
    skipped++;
    console.warn(`  skip ${d.id}: missing hotelId, roomTypeId or dates`);
    continue;
  }
  // The slot's quantity must equal the booking's, and the rules compare them.
  if (typeof b.quantity !== 'number') {
    if (!dryRun) batch.update(d.ref, { quantity: 1 });
    inBatch++;
  }
  if (!dryRun) batch.set(db.collection('booking_slots').doc(d.id), slotFor(b));
  inBatch++;
  written++;

  if (inBatch >= 400) {
    if (!dryRun) await batch.commit();
    batch = db.batch();
    inBatch = 0;
  }
}
if (inBatch > 0 && !dryRun) await batch.commit();

console.log(`slots ${dryRun ? 'to write' : 'written'}: ${written}  skipped: ${skipped}`);
