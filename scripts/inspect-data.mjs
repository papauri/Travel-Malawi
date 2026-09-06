/**
 * Read-only inventory of the live Firestore data.
 *
 * Uses the web SDK against the same named database the app talks to, so it sees
 * exactly what a visitor sees. `users` is not listed here: the rules restrict
 * that collection to the account owner and admins, which this script is neither.
 *
 *   node scripts/inspect-data.mjs
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'node:fs';

const config = JSON.parse(fs.readFileSync(new URL('../firebase-applet-config.json', import.meta.url), 'utf-8'));
const app = initializeApp(config);
// The app uses a named database, not (default) — see firebase-applet-config.json.
const db = config.firestoreDatabaseId
  ? getFirestore(app, config.firestoreDatabaseId)
  : getFirestore(app);

async function readAll(name) {
  const snap = await getDocs(collection(db, name));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

const [hotels, rooms, bookings, reviews] = await Promise.all([
  readAll('hotels'),
  readAll('room_types'),
  readAll('bookings'),
  readAll('reviews').catch(() => []),
]);

const byManager = new Map();
for (const h of hotels) {
  const list = byManager.get(h.managerId) ?? [];
  list.push(h);
  byManager.set(h.managerId, list);
}

console.log(`hotels: ${hotels.length}  rooms: ${rooms.length}  bookings: ${bookings.length}  reviews: ${reviews.length}\n`);

console.log('--- listings by managerId ---');
for (const [managerId, list] of byManager) {
  console.log(`${managerId}  (${list.length})`);
  for (const h of list) console.log(`    ${h.id}  ${h.name}  [${h.status ?? 'no status'}]`);
}

console.log('\n--- bookings ---');
for (const b of bookings) {
  console.log(`${b.reference ?? b.id}  ${b.status}  guest=${b.guestId}  manager=${b.managerId}  ${b.checkIn}->${b.checkOut}  ${b.guestName}`);
}

const orphanRooms = rooms.filter(r => !hotels.some(h => h.id === r.hotelId));
console.log(`\n--- rooms whose hotel is missing: ${orphanRooms.length} ---`);
for (const r of orphanRooms) console.log(`    ${r.id}  ${r.name}  hotelId=${r.hotelId}`);

process.exit(0);
