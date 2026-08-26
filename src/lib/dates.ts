/**
 * Calendar-date helpers.
 *
 * Every date the app stores is a plain 'YYYY-MM-DD' calendar date, never an
 * instant: a stay that starts on the 3rd starts on the 3rd regardless of who is
 * looking at it. Arithmetic is therefore done in UTC (so a DST transition inside
 * a range cannot shift the result) while *display* is done from local
 * components (so `new Date('2026-03-01')`, which the platform parses as UTC
 * midnight, cannot render as February 28th for a viewer west of Greenwich).
 *
 * These helpers previously existed as three near-identical private copies in
 * HotelDetails, AvailabilityCalendar and Home.
 */

/** A calendar date, 'YYYY-MM-DD'. */
export type DateStr = string;

/** Formats a `Date`'s local calendar date as 'YYYY-MM-DD'. */
export function toDateStr(date: Date): DateStr {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Today, in the viewer's own calendar. */
export function todayStr(): DateStr {
  return toDateStr(new Date());
}

/** True for a well-formed calendar date that actually exists (rejects 2026-02-31). */
export function isValidDateStr(value: unknown): value is DateStr {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Milliseconds at UTC midnight of a calendar date. Comparison only. */
export function parseDateUTC(dateStr: DateStr): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
}

/** Steps a calendar date by whole days, in UTC so DST never causes drift. */
export function addDays(dateStr: DateStr, days: number): DateStr {
  const stepped = new Date(parseDateUTC(dateStr) + days * 86400000);
  const month = String(stepped.getUTCMonth() + 1).padStart(2, '0');
  const day = String(stepped.getUTCDate()).padStart(2, '0');
  return `${stepped.getUTCFullYear()}-${month}-${day}`;
}

/** Whole nights between two calendar dates. Zero if the range is empty or invalid. */
export function nightsBetween(checkIn: DateStr, checkOut: DateStr): number {
  if (!checkIn || !checkOut) return 0;
  const diff = Math.round((parseDateUTC(checkOut) - parseDateUTC(checkIn)) / 86400000);
  return diff > 0 ? diff : 0;
}

/**
 * Every night occupied by a stay: check-in inclusive, check-out exclusive.
 * The check-out day is free for the next guest, so it is not in the list.
 */
export function nightsInRange(checkIn: DateStr, checkOut: DateStr): DateStr[] {
  const nights: DateStr[] = [];
  if (!checkIn || !checkOut) return nights;
  let cursor = checkIn;
  // Bounded so a malformed record cannot spin forever.
  while (cursor < checkOut && nights.length < 1000) {
    nights.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return nights;
}

/** True when two stays share at least one night. */
export function rangesOverlap(aIn: DateStr, aOut: DateStr, bIn: DateStr, bOut: DateStr): boolean {
  return aIn < bOut && aOut > bIn;
}

/**
 * A `Date` at local midnight of the given calendar date — the correct input for
 * `toLocaleDateString`. Passing the raw string to `new Date()` instead yields
 * UTC midnight, which renders as the previous day in western timezones.
 */
export function toLocalDate(dateStr: DateStr): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Human-readable calendar date, e.g. "Mon, Mar 3". */
export function formatDateStr(
  dateStr: DateStr | undefined,
  options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }
): string {
  if (!isValidDateStr(dateStr)) return 'N/A';
  return toLocalDate(dateStr).toLocaleDateString('en-US', options);
}

/** Whole days from today until a calendar date. Negative once it has passed. */
export function daysUntil(dateStr: DateStr): number {
  return Math.round((parseDateUTC(dateStr) - parseDateUTC(todayStr())) / 86400000);
}
