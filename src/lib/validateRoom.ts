/**
 * Room type validation.
 *
 * The rules existed, but as a run of early returns inside the save handler,
 * each firing a toast and stopping at the first problem. Fixing one revealed
 * the next, and none of them ever marked the field at fault. They are stated
 * here instead, as one pure function returning every problem at once, keyed by
 * the field it belongs to — the same shape the listing wizard uses.
 *
 * These numbers are not cosmetic. The booking maths multiplies the nightly
 * rate by nights and rooms, and divides capacity across the party, so a room
 * with zero capacity, a negative rate or a missing price in a currency it
 * claims to sell in produces a quote nobody can honour.
 */

import { CurrencyCode, PriceMap, RoomType } from '../types';
import { CURRENCIES, CURRENCY_CODES } from './currency';
import { isValidDateStr } from './dates';

export type RoomField =
  | 'name' | 'description' | 'currencies' | 'prices' | 'extraGuestFees'
  | 'maxGuests' | 'baseGuests' | 'quantity' | 'packages' | 'blockedDates';

export type RoomErrors = Partial<Record<RoomField, string>>;

export const ROOM_NAME_MAX = 80;
export const ROOM_DESCRIPTION_MAX = 2000;
/** A single room type holding more than this is a block booking, not a room. */
export const MAX_ROOM_QUANTITY = 500;
export const MAX_ROOM_GUESTS = 30;

/** What the editor holds while a room is being written. */
export interface RoomInput {
  name?: string;
  description?: string;
  currencies?: CurrencyCode[];
  prices?: PriceMap;
  extraGuestFees?: PriceMap;
  maxGuests?: number | string;
  baseGuests?: number | string;
  quantity?: number | string;
  packages?: RoomType['packages'];
  /** The editor keeps these as an array; a legacy record may hold a string. */
  blockedDates?: string[] | string;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : NaN;
}

/** A whole number within bounds, or a message saying why not. */
function countProblem(value: unknown, label: string, min: number, max: number): string | null {
  const parsed = toNumber(value);
  if (Number.isNaN(parsed)) return `${label} must be a number.`;
  if (!Number.isInteger(parsed)) return `${label} must be a whole number.`;
  if (parsed < min) return `${label} must be at least ${min}.`;
  if (parsed > max) return `${label} looks too high — the most is ${max}.`;
  return null;
}

export function validateRoom(input: RoomInput): RoomErrors {
  const errors: RoomErrors = {};

  const name = (input.name ?? '').trim();
  if (!name) errors.name = 'Give the room a name, e.g. "Lake-facing chalet".';
  else if (name.length > ROOM_NAME_MAX) errors.name = `Keep the name under ${ROOM_NAME_MAX} characters.`;

  if ((input.description ?? '').length > ROOM_DESCRIPTION_MAX) {
    errors.description = `That is over the ${ROOM_DESCRIPTION_MAX} character limit.`;
  }

  const currencies = (input.currencies ?? []).filter(c => CURRENCY_CODES.includes(c));
  if (currencies.length === 0) {
    errors.currencies = 'Choose at least one currency to sell this room in.';
  }

  // A currency the room claims to sell in but carries no rate for would show
  // as "rates on request" on a page that is otherwise ready to take money.
  const prices = input.prices ?? {};
  const unpriced = currencies.filter(code => !(toNumber(prices[code]) > 0));
  if (currencies.length > 0 && unpriced.length > 0) {
    const names = unpriced.map(code => CURRENCIES[code].label).join(' and ');
    errors.prices = `Set a nightly rate in ${names}, or remove that currency.`;
  } else {
    const silly = currencies.find(code => toNumber(prices[code]) > 100_000_000);
    if (silly) errors.prices = `That rate in ${CURRENCIES[silly].label} looks like a typo.`;
  }

  // Fees are optional, but a negative one would pay the guest to bring people.
  const fees = input.extraGuestFees ?? {};
  const negativeFee = currencies.find(code => {
    const value = fees[code];
    return value !== undefined && value !== null && String(value) !== '' && toNumber(value) < 0;
  });
  if (negativeFee) {
    errors.extraGuestFees = `The extra-guest fee in ${CURRENCIES[negativeFee].label} cannot be negative.`;
  }

  const maxGuests = countProblem(input.maxGuests ?? 0, 'Max guests', 1, MAX_ROOM_GUESTS);
  if (maxGuests) errors.maxGuests = maxGuests;

  const quantity = countProblem(input.quantity ?? 0, 'Total rooms available', 0, MAX_ROOM_QUANTITY);
  if (quantity) errors.quantity = quantity;

  const baseRaw = input.baseGuests ?? input.maxGuests ?? 0;
  const base = countProblem(baseRaw, 'Guests included in the base price', 1, MAX_ROOM_GUESTS);
  if (base) errors.baseGuests = base;
  else if (!maxGuests && toNumber(baseRaw) > toNumber(input.maxGuests ?? 0)) {
    errors.baseGuests = 'Guests included in the base price cannot exceed max guests.';
  }

  for (const pkg of input.packages ?? []) {
    if (!pkg.name?.trim()) {
      errors.packages = 'Every package needs a name.';
      break;
    }
    const priced = currencies.some(code => toNumber(pkg.prices?.[code]) > 0);
    if (currencies.length > 0 && !priced) {
      errors.packages = `"${pkg.name}" has no price in any currency this room is sold in.`;
      break;
    }
    if (currencies.some(code => toNumber(pkg.prices?.[code]) < 0)) {
      errors.packages = `"${pkg.name}" has a negative price.`;
      break;
    }
  }

  const blocked = Array.isArray(input.blockedDates)
    ? input.blockedDates
    : String(input.blockedDates ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const invalidDate = blocked.find(d => !isValidDateStr(d));
  if (invalidDate) errors.blockedDates = `"${invalidDate}" is not a valid date. Use YYYY-MM-DD.`;

  return errors;
}

export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean);
}

/** The first problem, for a summary line above the form. */
export function firstError(errors: Record<string, string | undefined>): string | null {
  return Object.values(errors).find((value): value is string => !!value) ?? null;
}
