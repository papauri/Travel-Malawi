/**
 * Currency handling.
 *
 * Every amount is authored by the manager in each currency they sell in. There
 * is deliberately no conversion anywhere in the app: the previous dual-currency
 * display derived a kwacha total as `total * (priceMWK / price)`, which invents
 * an exchange rate and then applies it to extra-guest fees and packages that
 * were never priced in kwacha at all. A price the property did not set is not
 * shown.
 */

import { CurrencyCode, RoomType } from '../types';

export const CURRENCY_CODES: CurrencyCode[] = ['USD', 'MWK'];

interface CurrencyMeta {
  code: CurrencyCode;
  label: string;
  /** Shown next to an amount. */
  symbol: string;
  /** Kwacha amounts are large and never quoted in tambala. */
  step: number;
  decimals: number;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  USD: { code: 'USD', label: 'US Dollar', symbol: '$', step: 0.01, decimals: 2 },
  MWK: { code: 'MWK', label: 'Malawi Kwacha', symbol: 'MK', step: 1000, decimals: 0 },
};

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && (CURRENCY_CODES as string[]).includes(value);
}

/** e.g. "$1,250" or "MK 2,150,000". */
export function formatMoney(amount: number, currency: string = 'USD'): string {
  const meta = isCurrencyCode(currency) ? CURRENCIES[currency] : CURRENCIES.USD;
  // Whole units unless the amount genuinely has a fractional part, so a round
  // price does not render as "$250.00".
  const hasFraction = meta.decimals > 0 && Math.abs(amount % 1) > 0.005;
  const shown = amount.toLocaleString(undefined, {
    minimumFractionDigits: hasFraction ? meta.decimals : 0,
    maximumFractionDigits: hasFraction ? meta.decimals : 0,
  });
  return meta.code === 'MWK' ? `${meta.symbol} ${shown}` : `${meta.symbol}${shown}`;
}

type PriceMap = Partial<Record<CurrencyCode, number>> | undefined;

function fromMap(map: PriceMap, currency: CurrencyCode): number | null {
  const value = map?.[currency];
  return typeof value === 'number' && value >= 0 ? value : null;
}

/**
 * The nightly rate in one currency, or null if the property has not set one.
 *
 * Falls back to the pre-multi-currency fields: `price` was denominated in the
 * room's `currency` (defaulting to USD) and `priceMWK` held a kwacha rate.
 */
export function roomPrice(room: Pick<RoomType, 'prices' | 'price' | 'priceMWK' | 'currency'>, currency: CurrencyCode): number | null {
  const explicit = fromMap(room.prices, currency);
  if (explicit !== null) return explicit;

  const legacyPrimary = isCurrencyCode(room.currency) ? room.currency : 'USD';
  if (currency === legacyPrimary && typeof room.price === 'number' && room.price > 0) return room.price;
  if (currency === 'MWK' && typeof room.priceMWK === 'number' && room.priceMWK > 0) return room.priceMWK;
  return null;
}

/** Extra-guest fee in one currency. Absent means no surcharge, not an error. */
export function roomExtraGuestFee(room: Pick<RoomType, 'extraGuestFees' | 'extraGuestFee' | 'currency'>, currency: CurrencyCode): number {
  const explicit = fromMap(room.extraGuestFees, currency);
  if (explicit !== null) return explicit;

  const legacyPrimary = isCurrencyCode(room.currency) ? room.currency : 'USD';
  if (currency === legacyPrimary && typeof room.extraGuestFee === 'number') return room.extraGuestFee;
  return 0;
}

type PackageLike = { price?: number; prices?: PriceMap };

/**
 * A package's price in one currency, or null when it has not been priced in it.
 * A package with no price in the selected currency cannot honestly be sold in
 * that currency, so callers hide it rather than converting.
 */
export function packagePrice(pkg: PackageLike, currency: CurrencyCode, roomCurrency: CurrencyCode = 'USD'): number | null {
  const explicit = fromMap(pkg.prices, currency);
  if (explicit !== null) return explicit;
  if (currency === roomCurrency && typeof pkg.price === 'number') return pkg.price;
  return null;
}

/** The room's own default currency, used to interpret its legacy fields. */
export function roomPrimaryCurrency(room: Pick<RoomType, 'currencies' | 'currency'>): CurrencyCode {
  const first = room.currencies?.find(isCurrencyCode);
  if (first) return first;
  return isCurrencyCode(room.currency) ? room.currency : 'USD';
}

/** Every currency the room is actually priced in, primary first. */
export function roomCurrencies(room: RoomType): CurrencyCode[] {
  const declared = room.currencies?.filter(isCurrencyCode) ?? [];
  const candidates = declared.length > 0 ? declared : CURRENCY_CODES;
  const priced = candidates.filter(code => roomPrice(room, code) !== null);
  // A room with no price at all still needs a currency to render against.
  return priced.length > 0 ? priced : [roomPrimaryCurrency(room)];
}

/** Currencies offered by at least one room of a property, in a stable order. */
export function currenciesForRooms(rooms: RoomType[]): CurrencyCode[] {
  const offered = new Set<CurrencyCode>();
  for (const room of rooms) for (const code of roomCurrencies(room)) offered.add(code);
  return CURRENCY_CODES.filter(code => offered.has(code));
}

/** The requested currency if the room is sold in it, otherwise its primary. */
export function resolveCurrency(room: RoomType, requested: CurrencyCode | null | undefined): CurrencyCode {
  const available = roomCurrencies(room);
  return requested && available.includes(requested) ? requested : available[0];
}

const STORAGE_KEY = 'travel-malawi:currency';

/** Remembered per browser; a preference, never anything the price depends on. */
export function readStoredCurrency(): CurrencyCode | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isCurrencyCode(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function storeCurrency(currency: CurrencyCode): void {
  try {
    localStorage.setItem(STORAGE_KEY, currency);
  } catch {
    // Private windows and blocked site data are fine; the choice just does not persist.
  }
}
