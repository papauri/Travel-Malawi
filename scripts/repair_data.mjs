/**
 * Repairs seeded Firestore records using the Admin SDK.
 *
 * Two problems, both left behind by the old homepage seed routine:
 *
 * 1. ORPHANED OWNERSHIP (the serious one). Five hotels carry
 *    `managerId: "demo_manager_123"` — a hardcoded placeholder string rather
 *    than a Firebase UID, written because the seed ran while signed out. The
 *    security rules gate every hotel/room write on
 *    `managerId == request.auth.uid`, and no account will ever hold that UID,
 *    so those listings cannot be edited, have their rooms changed, or have
 *    their bookings confirmed by anyone. Reassigning `managerId` is itself a
 *    write the rules forbid, which is why this has to run through the Admin
 *    SDK rather than the client SDK.
 *
 * 2. BROKEN IMAGES. One hotel's `imageUrl` points at a link that now 404s, one
 *    is empty, no hotel has a `galleryUrls` array, and every room_type has an
 *    empty `imageUrl`. The app already tolerates this at render time (see
 *    src/lib/images.ts); this corrects the stored data.
 *
 * The Admin SDK bypasses security rules, so it needs a service account key:
 * Firebase console -> Project settings -> Service accounts -> Generate new
 * private key. Keep the file out of version control.
 *
 *   node scripts/repair_data.mjs --key=./serviceAccount.json
 *       Dry run. Prints exactly what would change.
 *
 *   node scripts/repair_data.mjs --key=./serviceAccount.json --manager-uid=<UID> --apply
 *       Applies image repairs and reassigns orphaned listings to <UID>.
 *
 * Omit --manager-uid to repair images only and leave ownership alone.
 * Only the fields listed below are ever written. Safe to re-run.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const APPLY = process.argv.includes('--apply');
const arg = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const keyPath = arg('key');
const managerUid = arg('manager-uid');

if (!keyPath) {
  console.error('Missing --key=<path to service account json>. See the header of this file.');
  process.exit(1);
}

const config = JSON.parse(readFileSync(new URL('../firebase-applet-config.json', import.meta.url)));
const app = initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf-8'))) });
const db = getFirestore(app, config.firestoreDatabaseId || '(default)');

/** The placeholder the seed routine wrote in place of a real UID. */
const ORPHAN_MANAGER_ID = 'demo_manager_123';
/** Unsplash photo that has since been removed upstream. */
const DEAD_PHOTO_ID = 'photo-1542314831-c6a4d1409e1c';

// Bundled photography of these specific lodges, served from public/hotels.
// Preferred over remote links, which is what broke the listings originally.
const LOCAL = {
  pumulani: ['/hotels/pumulani_main.jpg', '/hotels/pumulani_gal1.jpg', '/hotels/pumulani_gal2.jpg'],
  kaya: ['/hotels/kaya_main.jpg', '/hotels/kaya_gal1.jpg', '/hotels/kaya_gal2.jpg'],
};

const U = (id) => `https://images.unsplash.com/photo-${id}?q=80&w=2400&auto=format&fit=crop`;

// Keyed on a fragment of the hotel name so the plan survives new document ids.
// Every URL here was verified to return 200 before being committed.
const HOTEL_PLAN = {
  pumulani: { gallery: LOCAL.pumulani },
  'kaya mawa': { gallery: LOCAL.kaya },
  'ku chawe': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Mulunguzi_dam_on_Zomba_Plateau.jpg',
    gallery: [U('1523805009345-7448845a9e53'), U('1464822759023-fed622ff2c3b')],
  },
  'blue zebra': { gallery: [U('1504280390367-361c6d9f38f4'), U('1523805009345-7448845a9e53')] },
  mvuu: { gallery: [U('1516426122078-c23e76319801'), U('1614531341773-3bff8b7cb3fc')] },
  'lilongwe grand': {
    // Generic hotel photography: there is no bundled imagery for this property,
    // and reusing another named lodge's photos would misrepresent it.
    image: U('1566073771259-6a8506099945'),
    gallery: [U('1551882547-ff40c63fe5fa'), U('1582719478250-c89cae4dc85b')],
  },
};

const ROOM_IMAGES = {
  'standard suite': U('1582719478250-c89cae4dc85b'),
  'luxury villa': U('1618773928121-c32242e63f39'),
  'executive suite': U('1611892440504-42a792e24d32'),
};
const ROOM_FALLBACK = U('1566073771259-6a8506099945');

const isUsable = (v) => typeof v === 'string' && v.trim() !== '';
const planFor = (name = '') => {
  const n = String(name).toLowerCase();
  const key = Object.keys(HOTEL_PLAN).find((k) => n.includes(k));
  return key ? HOTEL_PLAN[key] : null;
};

async function main() {
  const updates = [];
  const orphanedHotelIds = [];

  const hotels = await db.collection('hotels').get();
  for (const d of hotels.docs) {
    const data = d.data();
    const plan = planFor(data.name);
    const patch = {};

    if (!isUsable(data.imageUrl) && plan?.image) patch.imageUrl = plan.image;
    if (typeof data.imageUrl === 'string' && data.imageUrl.includes(DEAD_PHOTO_ID) && plan?.image) {
      patch.imageUrl = plan.image;
    }
    if ((!Array.isArray(data.galleryUrls) || data.galleryUrls.length === 0) && plan?.gallery) {
      patch.galleryUrls = plan.gallery;
    }

    if (data.managerId === ORPHAN_MANAGER_ID) {
      orphanedHotelIds.push(d.id);
      if (managerUid) patch.managerId = managerUid;
    }

    if (Object.keys(patch).length > 0) {
      updates.push({ ref: d.ref, label: `hotels/${d.id} (${data.name})`, patch });
    }
  }

  const rooms = await db.collection('room_types').get();
  for (const d of rooms.docs) {
    const data = d.data();
    if (isUsable(data.imageUrl)) continue;
    const key = String(data.name || '').toLowerCase();
    const match = Object.keys(ROOM_IMAGES).find((k) => key.includes(k));
    updates.push({
      ref: d.ref,
      label: `room_types/${d.id} (${data.name})`,
      patch: { imageUrl: match ? ROOM_IMAGES[match] : ROOM_FALLBACK },
    });
  }

  if (orphanedHotelIds.length > 0) {
    console.log(
      `\n${orphanedHotelIds.length} hotel(s) own by the placeholder "${ORPHAN_MANAGER_ID}" ` +
        `and are currently uneditable by any account.`
    );
    console.log(
      managerUid
        ? `  -> reassigning to ${managerUid}\n`
        : `  -> pass --manager-uid=<UID> to reassign them; leaving as-is for now\n`
    );
  }

  if (updates.length === 0) {
    console.log('Nothing to repair.');
    return;
  }

  console.log(`${updates.length} record(s) to repair:\n`);
  for (const u of updates) {
    console.log(`  ${u.label}`);
    for (const [k, v] of Object.entries(u.patch)) {
      console.log(`    ${k}: ${Array.isArray(v) ? `[${v.length}] ${v.join(', ')}` : v}`);
    }
  }

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to write these changes.');
    return;
  }

  console.log('\nApplying...');
  const batch = db.batch();
  for (const u of updates) batch.update(u.ref, u.patch);
  await batch.commit();
  console.log(`${updates.length} record(s) updated.`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error('Repair failed:', e.message);
    process.exit(1);
  }
);
