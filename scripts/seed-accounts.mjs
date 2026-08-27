/**
 * Creates the test accounts and, more importantly, their `users/{uid}` profile
 * documents — in the database the app actually reads.
 *
 * This replaces `create_test_users.js`, which had two problems:
 *
 *  1. It called `getFirestore(app)` with no database id, so every profile
 *     document it wrote landed in `(default)` while the app reads the named
 *     `ai-studio-…` database. The accounts existed in Auth but had no profile,
 *     so signing in created a fresh one defaulted to `traveller` — which is why
 *     the "manager" account could not manage anything.
 *
 *  2. It hard-coded `password123` in source. Passwords now come from the
 *     environment, or are generated and printed once for you to store.
 *
 * A role is deliberately not something a user can set for themselves (the rules
 * forbid it), so it has to be written from here.
 *
 *   node scripts/seed-accounts.mjs            # dry run
 *   node scripts/seed-accounts.mjs --apply
 *
 * Optional: MANAGER_PASSWORD / TRAVELLER_PASSWORD env vars.
 */
import crypto from 'node:crypto';
import { db, auth, APPLY, heading, plan, summarise } from './admin.mjs';

/**
 * `admin` is only ever granted here. The Firestore rules refuse to let an
 * account promote itself, so the project owner needs it written out of band or
 * the admin dashboard is unreachable.
 */
const ROSTER = [
  { email: 'manager@malawiscapes.com', displayName: 'Demo Manager', roles: ['hotel_manager'], passwordEnv: 'MANAGER_PASSWORD' },
  { email: 'traveller@malawiscapes.com', displayName: 'Demo Traveller', roles: ['traveller'], passwordEnv: 'TRAVELLER_PASSWORD' },
  { email: 'manager@example.com', displayName: 'Example Manager', roles: ['hotel_manager'] },
  { email: 'traveller@example.com', displayName: 'Example Traveller', roles: ['traveller'] },
  // The project owner runs the platform and books on it, so they hold both.
  // Add 'admin' here (or pass --grant-admin) to reach the admin dashboard.
  { email: 'johnpaulchirwa@gmail.com', displayName: 'John Paul Chirwa', roles: ['traveller', 'hotel_manager'] },
];

const GRANT_ADMIN = process.argv.includes('--grant-admin');

/** Ordered, de-duplicated, never empty — matches toRoleFields in src/lib/roles. */
const ROLE_ORDER = ['traveller', 'hotel_manager', 'admin'];
function normaliseRoles(roles) {
  const ordered = ROLE_ORDER.filter(r => roles.includes(r));
  return ordered.length ? ordered : ['traveller'];
}

function sameRoles(a = [], b = []) {
  return a.length === b.length && a.every((r, i) => r === b[i]);
}

/** Long, random, and shown once — never written to a file in the repo. */
function generatePassword() {
  return crypto.randomBytes(18).toString('base64url');
}

let changes = 0;
const generated = [];

for (const rosterEntry of ROSTER) {
  const entry = {
    ...rosterEntry,
    roles: normaliseRoles(
      GRANT_ADMIN && rosterEntry.email === 'johnpaulchirwa@gmail.com'
        ? [...rosterEntry.roles, 'admin']
        : rosterEntry.roles
    ),
  };
  heading(`${entry.email}  [${entry.roles.join(', ')}]`);

  let user = await auth.getUserByEmail(entry.email).catch(() => null);

  if (!user) {
    const password = (entry.passwordEnv && process.env[entry.passwordEnv]) || generatePassword();
    plan(`create Auth account (${entry.roles.join(', ')})`);
    changes++;
    if (APPLY) {
      user = await auth.createUser({
        email: entry.email,
        password,
        displayName: entry.displayName,
        emailVerified: true,
      });
      if (!process.env[entry.passwordEnv ?? '']) generated.push({ email: entry.email, password });
    }
  } else {
    console.log(`  auth account exists: ${user.uid}`);
    if (!user.displayName && APPLY) {
      await auth.updateUser(user.uid, { displayName: entry.displayName });
      console.log('  set displayName');
    }
  }

  if (!user) continue; // dry run, nothing to profile yet

  // The profile document is what the app reads for `role`.
  const ref = db.collection('users').doc(user.uid);
  const snap = await ref.get();
  const existing = snap.exists ? snap.data() : null;

  // `role` is written alongside `roles` as the first entry, so anything still
  // reading the old single field keeps working.
  const roleFields = { role: entry.roles[0], roles: entry.roles };

  if (!existing) {
    plan(`create users/${user.uid} with roles=[${entry.roles.join(', ')}]`);
    changes++;
    if (APPLY) {
      await ref.set({
        uid: user.uid,
        email: entry.email,
        displayName: entry.displayName,
        ...roleFields,
        createdAt: Date.now(),
      });
    }
  } else if (!sameRoles(normaliseRoles(existing.roles ?? [existing.role]), entry.roles)) {
    const before = existing.roles?.join(', ') ?? existing.role;
    plan(`change roles [${before}] -> [${entry.roles.join(', ')}] on users/${user.uid}`);
    changes++;
    if (APPLY) await ref.update({ ...roleFields, uid: user.uid, email: entry.email });
  } else {
    console.log(`  profile ok (roles=${entry.roles.join(', ')})`);
  }
}

if (generated.length) {
  heading('Generated passwords — store these now, they are not saved anywhere');
  for (const { email, password } of generated) console.log(`  ${email}  ${password}`);
}

summarise(changes);
process.exit(0);
