/**
 * Booking pricing, references and cancellation policy.
 *
 * Pricing lives here rather than in the page so the figure shown in the
 * breakdown and the figure written to Firestore come from one function and
 * cannot drift apart.
 */

import { Booking, RoomType } from '../types';
import { DateStr, daysUntil, nightsBetween } from './dates';

export interface BookingPricing {
  nights: number;
  basePrice: number;
  extraGuestFee: number;
  baseGuests: number;
  extraGuestsCount: number;
  extraGuestTotal: number;
  accommodationTotal: number;
  packagesTotal: number;
  total: number;
}

export function computeBookingPricing(
  room: RoomType,
  checkIn: DateStr,
  checkOut: DateStr,
  guests: number,
  quantity: number,
  packageIds: string[]
): BookingPricing {
  const nights = nightsBetween(checkIn, checkOut);
  const basePrice = room.price || 0;
  const extraGuestFee = room.extraGuestFee || 0;
  const baseGuests = room.baseGuests || room.maxGuests || 2;
  const extraGuestsCount = Math.max(0, guests - baseGuests);
  const extraGuestTotal = extraGuestsCount * extraGuestFee * nights * quantity;
  const accommodationTotal = basePrice * nights * quantity + extraGuestTotal;

  let packagesTotal = 0;
  for (const pkg of room.packages ?? []) {
    if (!packageIds.includes(pkg.id)) continue;
    if (pkg.type === 'per_person') packagesTotal += pkg.price * guests * nights;
    else if (pkg.type === 'per_room') packagesTotal += pkg.price * nights * quantity;
    else packagesTotal += pkg.price;
  }

  return {
    nights,
    basePrice,
    extraGuestFee,
    baseGuests,
    extraGuestsCount,
    extraGuestTotal,
    accommodationTotal,
    packagesTotal,
    total: accommodationTotal + packagesTotal,
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

/** Formats a money amount for display, without inventing sub-unit precision. */
export function formatMoney(amount: number, currency = 'USD'): string {
  const rounded = Math.round(amount);
  return currency === 'MWK' ? `MWK ${rounded.toLocaleString()}` : `$${rounded.toLocaleString()}`;
}
