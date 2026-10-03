import { Hotel, RoomType, Promotion, SaleType, PromotionTarget, CurrencyCode } from '../types';
import { DateStr } from './dates';
import { roomPrice, roundPrice } from './currency';

/**
 * The largest discount a promotion may take off a price. Applied identically
 * to what is displayed and what is charged, so a 100% promo can never turn a
 * stay into a free one.
 */
export const MAX_PROMO_DISCOUNT_PERCENT = 90;

/** Today's date in Malawi (UTC+2), as YYYY-MM-DD. */
export function malawiToday(): DateStr {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Blantyre', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date()) as DateStr;
}

/** Problems with a promotion's dates or amounts, or null if it can be saved. */
export function validatePromotion(promo: Partial<Promotion>): string | null {
  if (promo.startDate && promo.endDate && promo.endDate < promo.startDate) {
    return 'The end date must be on or after the start date.';
  }
  if (promo.discountType === 'fixed_slash') {
    const amounts = Object.values(promo.fixedSlashAmount ?? {}).filter((v): v is number => typeof v === 'number');
    if (amounts.length === 0 || amounts.some(v => !(v > 0))) return 'Enter a slash amount greater than zero.';
  } else {
    const pct = promo.discountPercentage ?? 0;
    if (!(pct >= 1 && pct <= MAX_PROMO_DISCOUNT_PERCENT)) {
      return `The discount must be between 1% and ${MAX_PROMO_DISCOUNT_PERCENT}%.`;
    }
  }
  return null;
}

export interface SlashedPriceResult {
  originalPrice: number;
  slashedPrice: number;
  slashedAmount: number;
  discountPercentage: number;
  hasDiscount: boolean;
  saleType?: SaleType;
  saleTypeLabel: string;
  badgeText: string;
}

export type SaleTypeIconName = 'Zap' | 'Calendar' | 'CalendarDays' | 'Clock' | 'Leaf' | 'Briefcase' | 'Star' | 'Tag';

export const SALE_TYPE_OPTIONS: {
  value: SaleType;
  label: string;
  description: string;
  badge: string;
  iconName: SaleTypeIconName;
}[] = [
  {
    value: 'flash_sale',
    label: 'Flash Sale',
    description: 'Limited-time price slash to boost immediate reservations',
    badge: 'FLASH SALE',
    iconName: 'Zap',
  },
  {
    value: 'early_bird',
    label: 'Early Bird',
    description: 'Advance booking discounts for organized itineraries',
    badge: 'EARLY BIRD',
    iconName: 'Calendar',
  },
  {
    value: 'weekend_special',
    label: 'Weekend Special',
    description: 'Special weekend getaway rates for leisure travelers',
    badge: 'WEEKEND SPECIAL',
    iconName: 'CalendarDays',
  },
  {
    value: 'last_minute',
    label: 'Last Minute Deal',
    description: 'Fill vacant dates or meeting rooms on short notice',
    badge: 'LAST MINUTE',
    iconName: 'Clock',
  },
  {
    value: 'seasonal',
    label: 'Seasonal Discount',
    description: 'Green season, lake season, or period-tailored promotions',
    badge: 'SEASONAL RATE',
    iconName: 'Leaf',
  },
  {
    value: 'conference_special',
    label: 'Conference & Event Special',
    description: 'Discounted boardroom, banquet hall, and meeting packages',
    badge: 'CONFERENCE SPECIAL',
    iconName: 'Briefcase',
  },
  {
    value: 'holiday_special',
    label: 'Holiday Special',
    description: 'Festive season, Easter, public holiday, or New Year discount',
    badge: 'HOLIDAY SPECIAL',
    iconName: 'Star',
  },
  {
    value: 'custom',
    label: 'Custom Campaign',
    description: 'Custom property rate reduction with a dedicated title',
    badge: 'SPECIAL OFFER',
    iconName: 'Tag',
  },
];

export const PROMOTION_TARGET_OPTIONS: {
  value: PromotionTarget;
  label: string;
  description: string;
}[] = [
  {
    value: 'all',
    label: 'All Rooms & Conference Spaces',
    description: 'Apply slash across every accommodation and event space',
  },
  {
    value: 'rooms_only',
    label: 'Accommodations Only',
    description: 'Slash only bedroom suites and chalets',
  },
  {
    value: 'conferences_only',
    label: 'Conference Spaces Only',
    description: 'Slash only meeting rooms, halls, and boardrooms',
  },
  {
    value: 'specific_rooms',
    label: 'Specific Accommodations',
    description: 'Pick and choose exactly which room types qualify',
  },
];

export function getSaleTypeIconName(saleType?: SaleType): SaleTypeIconName {
  if (!saleType) return 'Tag';
  const found = SALE_TYPE_OPTIONS.find(o => o.value === saleType);
  return found ? found.iconName : 'Tag';
}

export function getSaleTypeLabel(saleType?: SaleType, customLabel?: string): string {
  if (!saleType) return customLabel || 'Special Offer';
  if (saleType === 'custom') return customLabel || 'Special Offer';
  const found = SALE_TYPE_OPTIONS.find(o => o.value === saleType);
  return found ? found.label : (customLabel || 'Special Offer');
}

export function getSaleTypeBadge(saleType?: SaleType, customLabel?: string, discountPct?: number): string {
  if (saleType === 'custom' && customLabel) {
    return `${customLabel.toUpperCase()}${discountPct ? ` · ${discountPct}% OFF` : ''}`;
  }
  const found = SALE_TYPE_OPTIONS.find(o => o.value === saleType);
  const prefix = found ? found.badge : 'SPECIAL OFFER';
  return discountPct ? `${prefix} · ${discountPct}% OFF` : prefix;
}

/**
 * Returns the best active promotion for the hotel on the given date and scope.
 *
 * Pass `pricing` to rank promotions by the amount they actually take off that
 * price, which is the only fair comparison between percentage and fixed-amount
 * promotions. Without it, promotions are ranked by their percentage.
 */
export function getActivePromotion(
  hotel: Hotel,
  checkInDate?: DateStr,
  target: 'all' | 'room' | 'conference' = 'room',
  roomId?: string,
  pricing?: { price: number; currency: CurrencyCode }
): Promotion | null {
  if (!hotel.promotions || hotel.promotions.length === 0) return null;

  const compareDate = checkInDate || malawiToday();

  const active = hotel.promotions.filter(p => {
    if (!p.isActive) return false;
    if (p.startDate && p.startDate > compareDate) return false;
    if (p.endDate && p.endDate < compareDate) return false;

    // Filter by target scope
    if (target === 'room') {
      if (!p.appliesTo || p.appliesTo === 'all' || p.appliesTo === 'rooms_only') return true;
      if (p.appliesTo === 'specific_rooms') {
        if (!roomId) return true; // generic hotel card
        return !!p.targetRoomIds?.includes(roomId);
      }
      return false;
    }

    if (target === 'conference') {
      return !p.appliesTo || p.appliesTo === 'all' || p.appliesTo === 'conferences_only';
    }

    // target === 'all'
    // Default stay overview: do not match conference-only promos if evaluating general hotel stay
    return !p.appliesTo || p.appliesTo === 'all' || p.appliesTo === 'rooms_only';
  });

  if (active.length === 0) return null;

  const value = (p: Promotion) =>
    pricing
      ? calculateSlashedPrice(pricing.price, p, pricing.currency).slashedAmount
      : (p.discountPercentage || 0);
  return active.reduce((prev, current) => (value(current) > value(prev) ? current : prev));
}

export type PromotionStatus = 'active' | 'scheduled' | 'expired' | 'paused';

export function getPromotionStatus(promo: Promotion, compareDate?: DateStr): PromotionStatus {
  if (!promo.isActive) return 'paused';
  const today = compareDate || malawiToday();
  if (promo.startDate && promo.startDate > today) return 'scheduled';
  if (promo.endDate && promo.endDate < today) return 'expired';
  return 'active';
}

/**
 * Uniform Hotel Pricing Summary
 * Calculates the exact lowest base price, lowest effective slashed price,
 * and associated promotion across all rooms of a hotel.
 */
export interface HotelPricingSummary {
  originalPrice: number | null;
  slashedPrice: number | null;
  hasDiscount: boolean;
  slashedAmount: number;
  discountPercentage: number;
  saleType?: SaleType;
  saleTypeLabel: string;
  badgeText: string;
  promo: Promotion | null;
  cheapestRoomId?: string;
}

export function getHotelPricingSummary(
  hotel: Hotel,
  rooms: RoomType[],
  currency: CurrencyCode = 'MWK',
  checkInDate?: DateStr
): HotelPricingSummary {
  const hotelRooms = rooms.filter(r => r.hotelId === hotel.id);
  if (hotelRooms.length === 0) {
    return {
      originalPrice: null,
      slashedPrice: null,
      hasDiscount: false,
      slashedAmount: 0,
      discountPercentage: 0,
      saleTypeLabel: '',
      badgeText: '',
      promo: null,
    };
  }

  let lowestEffective: number | null = null;
  let bestOriginal: number | null = null;
  let bestSlashedResult: SlashedPriceResult | null = null;
  let bestPromo: Promotion | null = null;
  let bestRoomId: string | undefined = undefined;

  for (const room of hotelRooms) {
    const base = roomPrice(room, currency);
    if (base === null || base <= 0) continue;

    const promo = getActivePromotion(hotel, checkInDate, 'room', room.id, { price: base, currency });
    const slashed = calculateSlashedPrice(base, promo, currency);
    const effective = slashed.hasDiscount ? slashed.slashedPrice : base;

    if (lowestEffective === null || effective < lowestEffective) {
      lowestEffective = effective;
      bestOriginal = base;
      bestSlashedResult = slashed;
      bestPromo = promo;
      bestRoomId = room.id;
    }
  }

  if (lowestEffective === null || bestOriginal === null) {
    return {
      originalPrice: null,
      slashedPrice: null,
      hasDiscount: false,
      slashedAmount: 0,
      discountPercentage: 0,
      saleTypeLabel: '',
      badgeText: '',
      promo: null,
    };
  }

  const hasDiscount = !!(bestSlashedResult?.hasDiscount && bestSlashedResult.slashedAmount > 0);

  return {
    originalPrice: bestOriginal,
    slashedPrice: hasDiscount ? lowestEffective : bestOriginal,
    hasDiscount,
    slashedAmount: hasDiscount ? (bestSlashedResult?.slashedAmount ?? 0) : 0,
    discountPercentage: hasDiscount ? (bestSlashedResult?.discountPercentage ?? 0) : 0,
    saleType: bestPromo?.saleType,
    saleTypeLabel: bestSlashedResult?.saleTypeLabel || '',
    badgeText: bestSlashedResult?.badgeText || '',
    promo: bestPromo,
    cheapestRoomId: bestRoomId,
  };
}

/**
 * Returns all active promotions currently running for this hotel.
 */
export function getAllActivePromotions(hotel: Hotel, checkInDate?: DateStr): Promotion[] {
  if (!hotel.promotions || hotel.promotions.length === 0) return [];
  const compareDate = checkInDate || malawiToday();
  return hotel.promotions.filter(p => {
    if (!p.isActive) return false;
    if (p.startDate && p.startDate > compareDate) return false;
    if (p.endDate && p.endDate < compareDate) return false;
    return true;
  });
}

/**
 * Calculate slashed price and breakdown for a given original price and promotion.
 */
export function calculateSlashedPrice(
  originalPrice: number,
  promo: Promotion | null,
  currency: CurrencyCode = 'MWK'
): SlashedPriceResult {
  if (!promo || (!promo.discountPercentage && !promo.fixedSlashAmount)) {
    return {
      originalPrice,
      slashedPrice: originalPrice,
      slashedAmount: 0,
      discountPercentage: 0,
      hasDiscount: false,
      saleType: undefined,
      saleTypeLabel: '',
      badgeText: '',
    };
  }

  // The deepest cut allowed: the price never drops below this floor.
  const maxSlash = originalPrice * (MAX_PROMO_DISCOUNT_PERCENT / 100);
  let requestedSlash = 0;

  if (promo.discountType === 'fixed_slash' && promo.fixedSlashAmount) {
    // No currency conversion: a promotion set only in another currency does
    // not apply to prices in this one.
    requestedSlash = Math.max(0, promo.fixedSlashAmount[currency] ?? 0);
  } else {
    const pct = Math.min(MAX_PROMO_DISCOUNT_PERCENT, Math.max(0, promo.discountPercentage || 0));
    requestedSlash = originalPrice * (pct / 100);
  }

  let slashedPrice = originalPrice;
  if (originalPrice > 0 && requestedSlash > 0) {
    // Rounded to the platform convention (MWK nearest 1,000, USD whole dollars),
    // but never down to zero and never above the original.
    const floor = roundPrice(originalPrice - maxSlash, currency) || originalPrice - maxSlash;
    const rounded = roundPrice(originalPrice - Math.min(requestedSlash, maxSlash), currency);
    slashedPrice = Math.min(originalPrice, Math.max(rounded, floor));
  }
  const slashedAmount = Math.max(0, originalPrice - slashedPrice);
  const discountPercentage = originalPrice > 0 ? Math.round((slashedAmount / originalPrice) * 100) : 0;

  const saleTypeLabel = getSaleTypeLabel(promo.saleType, promo.saleTypeCustomLabel);
  const badgeText = promo.badgeText || getSaleTypeBadge(promo.saleType, promo.saleTypeCustomLabel, discountPercentage);

  return {
    originalPrice,
    slashedPrice,
    slashedAmount,
    discountPercentage,
    hasDiscount: slashedAmount > 0,
    saleType: promo.saleType,
    saleTypeLabel,
    badgeText,
  };
}

/**
 * Applies one editor's changes on top of the promotions currently stored, so
 * two people editing promotions at once do not erase each other's work.
 *
 * `baseline` is what the editor loaded and `next` is what it wants to save:
 * promotions removed since the baseline are deleted, promotions in `next`
 * replace the stored copy with the same id, and anything another editor added
 * meanwhile is kept.
 */
export function mergePromotions(stored: Promotion[], baseline: Promotion[], next: Promotion[]): Promotion[] {
  const nextIds = new Set(next.map(p => p.id));
  const removed = new Set(baseline.map(p => p.id).filter(id => !nextIds.has(id)));
  const byId = new Map(next.map(p => [p.id, p]));
  const merged = stored
    .filter(p => !removed.has(p.id))
    .map(p => byId.get(p.id) ?? p);
  const storedIds = new Set(stored.map(p => p.id));
  for (const p of next) if (!storedIds.has(p.id)) merged.push(p);
  return merged;
}
