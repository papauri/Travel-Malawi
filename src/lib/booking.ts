/**
 * Booking pricing, references and cancellation policy.
 *
 * Pricing lives here rather than in the page so the figure shown in the
 * breakdown and the figure written to Firestore come from one function and
 * cannot drift apart.
 */

import { Booking, CurrencyCode, Hotel, RoomType, Promotion, ChildPolicy } from '../types';
import { normalizeBlockedDates } from './availability';
import { DateStr, daysUntil, nightsBetween } from './dates';
import { packagePrice, roomExtraGuestFee, roomPrice, roomPrimaryCurrency, resolveCurrency, roundPrice } from './currency';
import { calculateSlashedPrice, MAX_PROMO_DISCOUNT_PERCENT } from './promotions';

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
  discountPercentage: number;
  discountAmount: number;
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
  requestedCurrency?: CurrencyCode,
  discountPercentageOrPromo: number | Promotion | null = 0,
  guestBreakdown?: { adults?: number; children?: number },
  childPolicy?: ChildPolicy
): BookingPricing {
  const currency = resolveCurrency(room, requestedCurrency);
  const primary = roomPrimaryCurrency(room);

  const nights = nightsBetween(checkIn, checkOut);
  const basePrice = roomPrice(room, currency) ?? 0;
  const extraGuestFee = roomExtraGuestFee(room, currency);
  const baseGuests = room.baseGuests || room.maxGuests || 2;

  let extraGuestsCount = Math.max(0, guests - baseGuests);
  let extraGuestTotal = extraGuestsCount * extraGuestFee * nights * quantity;

  // If the property manager configured custom child pricing and children are present
  if (childPolicy?.enabled && guestBreakdown && (guestBreakdown.children ?? 0) > 0) {
    const adults = Math.max(1, guestBreakdown.adults ?? (guests - (guestBreakdown.children ?? 0)));
    const children = Math.max(0, guestBreakdown.children ?? 0);

    const extraAdults = Math.max(0, adults - baseGuests);
    const remainingBaseGuests = Math.max(0, baseGuests - adults);
    const extraChildren = Math.max(0, children - remainingBaseGuests);

    let childFee = extraGuestFee;
    if (childPolicy.rateType === 'free') {
      childFee = 0;
    } else if (childPolicy.rateType === 'percentage') {
      const discount = Math.min(100, Math.max(0, childPolicy.discountPercentage ?? 50));
      childFee = roundPrice(extraGuestFee * (1 - discount / 100), currency);
    } else if (childPolicy.rateType === 'fixed') {
      const fixedRate = currency === 'MWK' ? (childPolicy.fixedRateMwk ?? 0) : (childPolicy.fixedRateUsd ?? 0);
      childFee = fixedRate;
    }

    extraGuestsCount = extraAdults + extraChildren;
    extraGuestTotal = (extraAdults * extraGuestFee + extraChildren * childFee) * nights * quantity;
  }

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

  let discountPercentage = 0;
  let discountAmount = 0;

  if (typeof discountPercentageOrPromo === 'number') {
    discountPercentage = Math.max(0, Math.min(MAX_PROMO_DISCOUNT_PERCENT, discountPercentageOrPromo));
    discountAmount = discountPercentage > 0 ? (accommodationTotal * discountPercentage) / 100 : 0;
  } else if (discountPercentageOrPromo) {
    // Same per-night maths as the slashed price shown on the room card, so the
    // promotion charged is exactly the promotion displayed. No currency
    // conversion: a promotion with no amount in this currency does not apply.
    const slashed = calculateSlashedPrice(basePrice, discountPercentageOrPromo, currency);
    discountAmount = Math.min(accommodationTotal, slashed.slashedAmount * nights * quantity);
    discountPercentage = slashed.discountPercentage;
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
    discountPercentage,
    discountAmount,
    total: roundPrice(accommodationTotal - discountAmount + packagesTotal, currency),
    unavailablePackageIds,
  };
}

/** Room id given to the synthetic whole-property unit of an entire-place listing. */
export function entirePlaceRoomId(hotelId: string | undefined): string {
  return hotelId ? `entire-${hotelId}` : 'entire-place-room';
}

/**
 * An entire-place listing with no room types is sold as one synthetic unit.
 * Built here so the property page and the confirm flow price it identically.
 * Only rates the property actually set are offered.
 */
export function entirePlaceRoom(hotel: Hotel): RoomType {
  const ep = hotel.entirePlaceDetails || ({} as NonNullable<Hotel['entirePlaceDetails']>);
  const usd = Number(ep.ratePerNightUsd) > 0 ? Number(ep.ratePerNightUsd) : null;
  const mwk = Number(ep.ratePerNightMwk) > 0 ? Number(ep.ratePerNightMwk) : null;
  const prices: Partial<Record<CurrencyCode, number>> = {};
  if (usd !== null) prices.USD = usd;
  if (mwk !== null) prices.MWK = mwk;
  const currencies = (['USD', 'MWK'] as CurrencyCode[]).filter(c => prices[c] !== undefined);
  return {
    id: entirePlaceRoomId(hotel.id),
    hotelId: hotel.id || '',
    name: ep.propertyType ? `Entire ${ep.propertyType}` : 'Entire Property',
    description: ep.wholeHouseDescription || `${hotel.name} is rented exclusively as an entire private space. Includes all ${ep.bedrooms || 2} bedrooms, private grounds, and amenities.`,
    maxGuests: Number(ep.maxGuests || 6),
    // No rate set means nothing can honestly be charged, so it is not on sale.
    quantity: currencies.length > 0 ? 1 : 0,
    currencies,
    ...(usd !== null ? { price: usd } : {}),
    ...(mwk !== null ? { priceMWK: mwk } : {}),
    prices,
    extraGuestFees: { USD: 0, MWK: 0 },
    amenities: hotel.amenities || [],
    galleryUrls: hotel.galleryUrls || [],
    imageUrl: hotel.imageUrl || '',
    createdAt: hotel.createdAt || Date.now(),
  } as RoomType;
}

/** The room with the property-wide closures (manual and iCal-synced) folded into its blocked dates. */
export function withPropertyBlocks(room: RoomType, hotel: Hotel | null | undefined): RoomType {
  if (!hotel) return room;
  const extra = [...normalizeBlockedDates(hotel.blockedDates), ...normalizeBlockedDates(hotel.icalBlockedDates)];
  if (!extra.length) return room;
  return { ...room, blockedDates: [...new Set([...normalizeBlockedDates(room.blockedDates), ...extra])] };
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
