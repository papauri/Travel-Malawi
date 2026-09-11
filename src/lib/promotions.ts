import { Hotel, Promotion, SaleType, PromotionTarget, CurrencyCode } from '../types';
import { DateStr } from './dates';
import { formatMoney } from './currency';

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
 * Returns the highest active promotion for the hotel on the given date and scope.
 */
export function getActivePromotion(
  hotel: Hotel,
  checkInDate?: DateStr,
  target: 'all' | 'room' | 'conference' = 'room',
  roomId?: string
): Promotion | null {
  if (!hotel.promotions || hotel.promotions.length === 0) return null;

  const compareDate = checkInDate || new Date().toISOString().split('T')[0];

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
    return true;
  });

  if (active.length === 0) return null;

  // Return the one with the highest discount
  return active.reduce((prev, current) =>
    (prev.discountPercentage > current.discountPercentage) ? prev : current
  );
}

/**
 * Returns all active promotions currently running for this hotel.
 */
export function getAllActivePromotions(hotel: Hotel, checkInDate?: DateStr): Promotion[] {
  if (!hotel.promotions || hotel.promotions.length === 0) return [];
  const compareDate = checkInDate || new Date().toISOString().split('T')[0];
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

  let slashedPrice = originalPrice;
  let discountPercentage = promo.discountPercentage || 0;
  let slashedAmount = 0;

  if (promo.discountType === 'fixed_slash' && promo.fixedSlashAmount) {
    const slash = promo.fixedSlashAmount[currency] ?? (
      currency === 'USD'
        ? Math.round((promo.fixedSlashAmount['MWK'] || 0) / 1750)
        : (promo.fixedSlashAmount['USD'] || 0) * 1750
    );
    slashedAmount = Math.min(originalPrice, Math.max(0, slash));
    slashedPrice = Math.max(0, originalPrice - slashedAmount);
    discountPercentage = originalPrice > 0 ? Math.round((slashedAmount / originalPrice) * 100) : 0;
  } else {
    // Percentage discount
    discountPercentage = Math.min(99, Math.max(1, promo.discountPercentage || 0));
    slashedAmount = Math.round(originalPrice * (discountPercentage / 100));
    slashedPrice = Math.max(0, originalPrice - slashedAmount);
  }

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
