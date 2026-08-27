/**
 * Booking pricing, references and cancellation policy.
 *
 * Pricing lives here rather than in the page so the figure shown in the
 * breakdown and the figure written to Firestore come from one function and
 * cannot drift apart.
 */

import { Booking, CurrencyCode, RoomType } from '../types';
import { DateStr, daysUntil, nightsBetween } from './dates';
import { packagePrice, roomExtraGuestFee, roomPrice, roomPrimaryCurrency, resolveCurrency } from './currency';

export interface BookingPricing {
  currency: CurrencyCode;
  nights: number;
  basePrice: number;
  extraGuestFee: number;
  baseGuests: number;
  extraGuestsCount: number;
  extraGuestTotal: number;
  accommodationTotal: number;
  packagesTotal: number;
  total: number;
  /** Packages that carry no price in this currency, so cannot be sold in it. */
  unavailablePackageIds: string[];
}

/**
 * Every amount is read in one currency and added up in that currency. Nothing
 * is converted: a package the property never priced in kwacha is excluded from
 * a kwacha booking rather than being given a made-up price.
 */
export function computeBookingPricing(
  room: RoomType,
  checkIn: DateStr,
  checkOut: DateStr,
  guests: number,
  quantity: number,
  packageIds: string[],
  requestedCurrency?: CurrencyCode
): BookingPricing {
  const currency = resolveCurrency(room, requestedCurrency);
  const primary = roomPrimaryCurrency(room);

  const nights = nightsBetween(checkIn, checkOut);
  const basePrice = roomPrice(room, currency) ?? 0;
  const extraGuestFee = roomExtraGuestFee(room, currency);
  const baseGuests = room.baseGuests || room.maxGuests || 2;
  const extraGuestsCount = Math.max(0, guests - baseGuests);
  const extraGuestTotal = extraGuestsCount * extraGuestFee * nights * quantity;
  const accommodationTotal = basePrice * nights * quantity + extraGuestTotal;

  let packagesTotal = 0;
  const unavailablePackageIds: string[] = [];

  for (const pkg of room.packages ?? []) {
    if (!packageIds.includes(pkg.id)) continue;
    const price = packagePrice(pkg, currency, primary);
    if (price === null) {
      unavailablePackageIds.push(pkg.id);
      continue;
    }
    if (pkg.type === 'per_person') packagesTotal += price * guests * nights;
    else if (pkg.type === 'per_room') packagesTotal += price * nights * quantity;
    else packagesTotal += price;
  }

  return {
    currency,
    nights,
    basePrice,
    extraGuestFee,
    baseGuests,
    extraGuestsCount,
    extraGuestTotal,
    accommodationTotal,
    packagesTotal,
    total: accommodationTotal + packagesTotal,
    unavailablePackageIds,
  };
}

/** Days before check-in within which a cancellation is no longer free. */
export const FREE_CANCELLATION_DAYS = 7;

export interface CancellationTerms {
  /** False once the stay has started, or already ended, or is not cancellable. */
  canCancel: boolean;
  /** True while the guest is still outside the free-cancellation window. */
  isFree: boolean;
  reason?: string;
}

/**
 * Whether a guest may still cancel, and whether it is free. Mirrors the policy
 * shown on the property page: free up to seven days before arrival.
 */
export function cancellationTerms(booking: Pick<Booking, 'status' | 'checkIn'>): CancellationTerms {
  if (booking.status === 'cancelled') {
    return { canCancel: false, isFree: false, reason: 'This booking is already cancelled.' };
  }
  if (booking.status === 'rejected') {
    return { canCancel: false, isFree: false, reason: 'This booking was declined by the property.' };
  }
  const days = daysUntil(booking.checkIn);
  if (days < 0) {
    return { canCancel: false, isFree: false, reason: 'This stay has already started.' };
  }
  return { canCancel: true, isFree: days >= FREE_CANCELLATION_DAYS };
}

/** True once the stay is over, which is what makes a guest eligible to review. */
export function isStayComplete(booking: Pick<Booking, 'status' | 'checkOut'>): boolean {
  return booking.status === 'confirmed' && daysUntil(booking.checkOut) < 0;
}

const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1

/**
 * A short code the guest can quote on the phone. Not an identity check — the
 * Firestore document id remains the real key — so collisions are cosmetic.
 */
export function makeBookingReference(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes, b => REFERENCE_ALPHABET[b % REFERENCE_ALPHABET.length]).join('');
  return `TM-${body}`;
}

// `formatMoney` now lives in lib/currency alongside the symbols and precision
// rules; re-exported here so existing imports keep working.
export { formatMoney } from './currency';
