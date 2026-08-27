/**
 * Repairs the seed data left behind by the AI Studio import.
 *
 * What is wrong in the live database, and why each matters:
 *
 *  1. Five of the six listings are owned by `demo_manager_123`, which is not a
 *     real Auth uid. Nobody can sign in as that owner, so those listings cannot
 *     be edited and their booking requests can never be confirmed or declined.
 *     They are handed to real accounts per OWNERSHIP below.
 *
 *  2. Two legacy bookings have `managerId: undefined`. The navbar's pending
 *     badge queries `where('managerId','==',uid)`, so a property owner is never
 *     told those requests exist.
 *
 *  3. One of those bookings has no `checkIn` at all, which makes it undateable:
 *     it cannot be placed on a calendar or counted against inventory.
 *
 *  4. No listing has a `status` field. The app reads a missing status as
 *     approved, so this is currently harmless — but it means the moderation
 *     flow has never actually been exercised, and an admin suspending a listing
 *     is the first thing that would write the field.
 *
 * Dry run by default:
 *   node scripts/repair-data.mjs
 *   node scripts/repair-data.mjs --apply
 *
 * `--delete-undateable` additionally removes bookings with no usable dates.
 */
import { db, auth, APPLY, heading, plan, summarise } from './admin.mjs';

const PLACEHOLDER_MANAGER = 'demo_manager_123';
const DELETE_UNDATEABLE = process.argv.includes('--delete-undateable');

/**
 * Who ends up owning which listing, matched on the listing name.
 *
 * The project owner takes the three properties with the strongest photography,
 * including Blue Zebra, which carries the end-to-end test booking — so the
 * confirm and decline flow can be exercised from a real dashboard. The rest go
 * to a second manager, so the platform has more than one owner to test with.
 */
const OWNERSHIP = [
  {
    email: 'johnpaulchirwa@gmail.com',
    listings: ['Blue Zebra Island Lodge', 'Kaya Mawa', 'Pumulani Lodge'],
  },
  {
    email: 'manager@malawiscapes.com',
    listings: ['Sunbird Ku Chawe', 'Mvuu Camp & Lodge'],
  },
];

/** Anything still orphaned after the map above goes here. */
const FALLBACK_OWNER_EMAIL = 'manager@malawiscapes.com';

let changes = 0;

async function requireAccount(email) {
  const account = await auth.getUserByEmail(email).catch(() => null);
  if (account) return account;
  console.error(
    `\nNo Auth account for ${email}.\n` +
    'Run `node scripts/seed-accounts.mjs --apply` first — it creates the test\n' +
    'accounts and their profile documents.\n'
  );
  process.exit(1);
}

// Every email is resolved up front, so a typo fails before anything is written.
const ownerByListing = new Map();
for (const { email, listings } of OWNERSHIP) {
  const account = await requireAccount(email);
  console.log(`${email} -> ${account.uid}  (${listings.length} listing(s))`);
  for (const name of listings) ownerByListing.set(name, { uid: account.uid, email });
}
const fallbackOwner = await requireAccount(FALLBACK_OWNER_EMAIL);

// --- 1. Listings owned by a uid that does not exist -------------------------
heading('Listings with an unreachable owner');
const hotels = await db.collection('hotels').get();
const hotelsById = new Map(hotels.docs.map(d => [d.id, d.data()]));

for (const doc of hotels.docs) {
  const hotel = doc.data();
  if (hotel.managerId !== PLACEHOLDER_MANAGER) continue;

  const owner = ownerByListing.get(hotel.name)
    ?? { uid: fallbackOwner.uid, email: FALLBACK_OWNER_EMAIL };
  plan(`reassign "${hotel.name}" (${doc.id}) -> ${owner.email}`);
  changes++;
  if (APPLY) await doc.ref.update({ managerId: owner.uid });
  hotelsById.set(doc.id, { ...hotel, managerId: owner.uid });
}

// --- 2. Listings with no moderation status ----------------------------------
heading('Listings with no status field');
for (const doc of hotels.docs) {
  if (doc.data().status) continue;
  // Imported listings are already live to visitors, so recording them as
  // approved matches what the app does today rather than changing it.
  plan(`set status="approved" on ${doc.id} "${doc.data().name}"`);
  changes++;
  if (APPLY) await doc.ref.update({ status: 'approved' });
}

// --- 3. Bookings that no manager can see ------------------------------------
heading('Bookings with a missing managerId');
const bookings = await db.collection('bookings').get();

for (const doc of bookings.docs) {
  const booking = doc.data();
  if (booking.managerId) continue;
  const hotel = hotelsById.get(booking.hotelId);
  if (!hotel) {
    console.log(`  skip ${doc.id}: hotel ${booking.hotelId} no longer exists`);
    continue;
  }
  plan(`backfill managerId=${hotel.managerId} on ${booking.reference ?? doc.id}`);
  changes++;
  if (APPLY) await doc.ref.update({ managerId: hotel.managerId });
}

// --- 4. Bookings with no usable dates ---------------------------------------
heading('Bookings with no usable dates');
const isDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

for (const doc of bookings.docs) {
  const booking = doc.data();
  if (isDate(booking.checkIn) && isDate(booking.checkOut)) continue;

  const label = `${booking.reference ?? doc.id} "${booking.guestName}" checkIn=${booking.checkIn ?? 'missing'} checkOut=${booking.checkOut ?? 'missing'}`;
  if (DELETE_UNDATEABLE) {
    plan(`delete undateable booking ${label}`);
    changes++;
    if (APPLY) await doc.ref.delete();
  } else {
    // Deleting a booking is not reversible, so it needs to be asked for.
    console.log(`  found  ${label}`);
    console.log('         (re-run with --delete-undateable to remove it)');
  }
}

summarise(changes);
process.exit(0);
