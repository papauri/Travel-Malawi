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

export const ALL_ROLES: Role[] = ['traveller', 'hotel_manager', 'admin'];

/** Roles a user may choose for themselves. `admin` is granted out of band. */
export const SELF_ASSIGNABLE_ROLES: Role[] = ['traveller', 'hotel_manager'];

export const ROLE_LABELS: Record<Role, string> = {
  traveller: 'Traveller',
  hotel_manager: 'Hotel Manager',
  admin: 'Administrator',
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
export const isAdmin = (user: Pick<User, 'role' | 'roles'> | null | undefined) => hasRole(user, 'admin');

/** Human-readable summary for a profile menu, e.g. "Traveller & Hotel Manager". */
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
