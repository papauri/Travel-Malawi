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
 * `--reset-passwords` also forces existing accounts to the values in .env.
 * Without it a password is only ever set at account creation, so an account
 * that already existed keeps a password nobody has a record of.
 *
 * Optional password overrides, otherwise one is generated and printed once:
 *   HOST_PASSWORD, MANAGER_PASSWORD, TRAVELLER_PASSWORD, ADMIN_PASSWORD
 */
import crypto from 'node:crypto';
import { db, auth, APPLY, heading, plan, summarise } from './admin.mjs';

/**
 * Test accounts only. No personal account is touched by this script.
 *
 * `admin` is granted here or nowhere: the rules refuse to let an account
 * promote itself, so without this the admin dashboard is unreachable.
 */
const ROSTER = [
  // Holds both roles, and owns listings. This is the account to sign in as when
  // exercising the dual-role behaviour: it can list a property and book a stay
  // somewhere else, which is the normal case for a small operator.
  { email: 'host@malawiscapes.com', displayName: 'Demo Host & Guest', roles: ['traveller', 'hotel_manager'], passwordEnv: 'HOST_PASSWORD' },
  { email: 'manager@malawiscapes.com', displayName: 'Demo Manager', roles: ['hotel_manager'], passwordEnv: 'MANAGER_PASSWORD' },
  { email: 'traveller@malawiscapes.com', displayName: 'Demo Traveller', roles: ['traveller'], passwordEnv: 'TRAVELLER_PASSWORD' },
  { email: 'admin@malawiscapes.com', displayName: 'Demo Admin', roles: ['admin'], passwordEnv: 'ADMIN_PASSWORD' },
  // Pre-existing accounts from the original import, kept so their data still
  // resolves to a real owner.
  { email: 'manager@example.com', displayName: 'Example Manager', roles: ['hotel_manager'] },
  { email: 'traveller@example.com', displayName: 'Example Traveller', roles: ['traveller'] },
];

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

/**
 * A password is only set when an account is created, so an account that already
 * existed keeps whatever it was given originally — which for the accounts from
 * the first import is a password nobody recorded. `--reset-passwords` makes
 * .env authoritative for every account in the roster that has one set.
 */
const RESET_PASSWORDS = process.argv.includes('--reset-passwords');

let changes = 0;
const generated = [];

for (const rosterEntry of ROSTER) {
  const entry = { ...rosterEntry, roles: normaliseRoles(rosterEntry.roles) };
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

    const desired = entry.passwordEnv && process.env[entry.passwordEnv];
    if (RESET_PASSWORDS && desired) {
      plan(`reset password from ${entry.passwordEnv}`);
      changes++;
      if (APPLY) await auth.updateUser(user.uid, { password: desired });
    } else if (desired) {
      // Saying so matters: the value sitting in .env is not the one in force.
      console.log(`  password unchanged (pass --reset-passwords to apply ${entry.passwordEnv})`);
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
