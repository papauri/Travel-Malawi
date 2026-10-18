/**
 * Repairs image fields on existing Firestore records.
 *
 * The seeded data left several listings unusable: one hotel's `imageUrl` points
 * at a link that has since 404'd, one is empty, no hotel has a `galleryUrls`
 * array at all, and every room_type has an empty `imageUrl`.
 *
 * The app tolerates all of that at render time (see src/lib/images.ts), so this
 * script is about correcting the stored data rather than fixing the UI.
 *
 * Only image fields are touched, and only when the current value is unusable —
 * a listing that already has a working image is left alone. Safe to re-run.
 *
 *   node scripts/repair_images.mjs            # dry run, prints the plan
 *   node scripts/repair_images.mjs --apply    # writes the changes
 *
 * Note: the deployed security rules restrict hotel/room writes to the owning
 * manager, so an --apply run may need credentials. Pass them with
 * --email=... --password=... if the anonymous attempt is rejected.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { readFileSync } from 'fs';

const APPLY = process.argv.includes('--apply');
const arg = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const config = JSON.parse(readFileSync(new URL('../firebase-applet-config.json', import.meta.url)));
const app = initializeApp(config);
const db = config.firestoreDatabaseId
  ? getFirestore(app, config.firestoreDatabaseId)
  : getFirestore(app);

const U = (id) => `https://images.unsplash.com/photo-${id}?q=80&w=2400&auto=format&fit=crop`;

// No per-property photo plan: listing photos come only from the owner's own
// uploads (directive D1). A dead main-image link is cleared so the app renders
// its neutral placeholder (src/lib/images.ts); galleries are never invented.

const ROOM_IMAGES = {
  'standard suite': U('1582719478250-c89cae4dc85b'),
  'luxury villa': U('1618773928121-c32242e63f39'),
  'executive suite': U('1611892440504-42a792e24d32'),
};
const ROOM_FALLBACK = U('1566073771259-6a8506099945');

const isUsable = (v) => typeof v === 'string' && v.trim() !== '';

async function main() {
  const email = arg('email');
  const password = arg('password');
  if (email && password) {
    await signInWithEmailAndPassword(getAuth(app), email, password);
    console.log(`Signed in as ${email}\n`);
  }

  const updates = [];

  const hotels = await getDocs(collection(db, 'hotels'));
  for (const d of hotels.docs) {
    const data = d.data();
    const patch = {};

    // A dead link stored as the main image → cleared so the placeholder shows.
    if (typeof data.imageUrl === 'string' && data.imageUrl.includes('photo-1542314831-c6a4d1409e1c')) {
      patch.imageUrl = '';
    }

    if (Object.keys(patch).length > 0) {
      updates.push({ ref: doc(db, 'hotels', d.id), label: `hotels/${d.id} (${data.name})`, patch });
    }
  }

  const rooms = await getDocs(collection(db, 'room_types'));
  for (const d of rooms.docs) {
    const data = d.data();
    if (isUsable(data.imageUrl)) continue;
    const key = String(data.name || '').toLowerCase();
    const image = ROOM_IMAGES[Object.keys(ROOM_IMAGES).find((k) => key.includes(k))] ?? ROOM_FALLBACK;
    updates.push({
      ref: doc(db, 'room_types', d.id),
      label: `room_types/${d.id} (${data.name})`,
      patch: { imageUrl: image },
    });
  }

  if (updates.length === 0) {
    console.log('Nothing to repair — all records already have usable images.');
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
  let ok = 0;
  for (const u of updates) {
    try {
      await updateDoc(u.ref, u.patch);
      console.log(`  OK      ${u.label}`);
      ok++;
    } catch (e) {
      console.log(`  FAILED  ${u.label} -> ${e.code || e.message}`);
    }
  }
  console.log(`\n${ok}/${updates.length} updated.`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error('Repair failed:', e.code || e.message);
    process.exit(1);
  }
);
