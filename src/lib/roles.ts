/**
 * Role helpers.
 *
 * An account can hold several roles at once — the owner of a lodge is usually
 * also someone who books stays. The original model stored a single `role`
 * string, so signing up as a manager silently gave up the ability to book.
 *
 * `roles` is the list; `role` is kept as the first entry for records written
 * before this existed, and so a document is still readable by anything that
 * only knows about the old field. Read through `userRoles` rather than either
 * field directly.
 */

import { Role, User } from '../types';
import { sha256Hex } from './sha256';

export const ALL_ROLES: Role[] = ['traveller', 'hotel_manager', 'admin', 'marketing', 'global_admin'];

/** Roles a user may choose for themselves. `admin`, `marketing`, `global_admin` are granted out of band. */
export const SELF_ASSIGNABLE_ROLES: Role[] = ['traveller', 'hotel_manager'];

export const ROLE_LABELS: Record<Role, string> = {
  traveller: 'Traveller',
  hotel_manager: 'Host / Property Manager',
  admin: 'Administrator',
  marketing: 'Marketing',
  global_admin: 'Global Admin',
};

/**
 * Every role an account holds, tolerating records from before `roles` existed.
 * Never empty for a real user: an account with nothing recorded can still book.
 */
export function userRoles(user: Pick<User, 'role' | 'roles'> | null | undefined): Role[] {
  if (!user) return [];
  const list = Array.isArray(user.roles) ? user.roles.filter(r => ALL_ROLES.includes(r)) : [];
  if (list.length > 0) return list;
  return user.role ? [user.role] : ['traveller'];
}

export function hasRole(user: Pick<User, 'role' | 'roles'> | null | undefined, role: Role): boolean {
  return userRoles(user).includes(role);
}

export const isTraveller = (user: Pick<User, 'role' | 'roles'> | null | undefined) => hasRole(user, 'traveller');
export const isHotelManager = (user: Pick<User, 'role' | 'roles'> | null | undefined) => hasRole(user, 'hotel_manager');
/**
 * Platform owner accounts, always treated as global admins. Kept as salted
 * SHA-256 hashes of the lower-cased address so the owners' emails are not
 * readable in the site's public JavaScript. To add an owner, add
 * sha256Hex(OWNER_HASH_SALT + email-in-lower-case) here, and the plain address
 * to the owner check in firestore.rules (rules are not public).
 */
const OWNER_HASH_SALT = 'travel-malawi-owner:';
const OWNER_EMAIL_HASHES: readonly string[] = [
  'b9128335c84c64d00885cdda19fcc01c1a3306a3b04c0c3147c50f4f8f07b82c',
  '4c188ead6555a64bd66d1b351176dd22cca49ea10eeb32246ec5d3e2bda96aff',
];

export const isOwnerEmail = (email: string | null | undefined): boolean =>
  Boolean(email && OWNER_EMAIL_HASHES.includes(sha256Hex(OWNER_HASH_SALT + email.trim().toLowerCase())));

export const isGlobalAdmin = (user: Pick<User, 'role' | 'roles' | 'email'> | null | undefined) =>
  hasRole(user, 'global_admin') ||
  Boolean(user && 'email' in user && isOwnerEmail(user.email));
// A global admin is also an admin. 
export const isAdmin = (user: Pick<User, 'role' | 'roles' | 'email'> | null | undefined) => hasRole(user, 'admin') || isGlobalAdmin(user);
export const isMarketing = (user: Pick<User, 'role' | 'roles'> | null | undefined) => hasRole(user, 'marketing');

/**
 * Marketing and Global/System Administrators can shadow property managers
 * to troubleshoot, configure stays, inspect integrations, and provide live concierge support.
 */
export const canShadowManager = (user: Pick<User, 'role' | 'roles' | 'email'> | null | undefined): boolean =>
  Boolean(user && (isAdmin(user) || isMarketing(user) || isGlobalAdmin(user)));

/** Human-readable summary for a profile menu, e.g. "Traveller & Property Manager". */
export function describeRoles(user: Pick<User, 'role' | 'roles'> | null | undefined): string {
  const labels = userRoles(user).map(r => ROLE_LABELS[r]);
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(', ')} & ${labels[labels.length - 1]}`;
}

/**
 * Normalises a role selection into the pair of fields written to Firestore:
 * de-duplicated, ordered as ALL_ROLES, and never empty.
 */
export function toRoleFields(selected: Role[]): { role: Role; roles: Role[] } {
  const unique = ALL_ROLES.filter(r => selected.includes(r));
  const roles = unique.length > 0 ? unique : (['traveller'] as Role[]);
  return { role: roles[0], roles };
}
