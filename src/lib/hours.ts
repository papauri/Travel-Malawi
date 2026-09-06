/**
 * Weekly trading hours.
 *
 * Times are plain 'HH:MM' strings in the property's own local time — the same
 * reasoning as calendar dates in lib/dates: a lodge that opens at 07:00 opens
 * at 07:00 regardless of where the person reading the page happens to be.
 */

import { DayHours, WeeklyHours } from '../types';

/** Index 0 is Sunday, matching `Date.prototype.getDay()`. */
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Monday-first order for display; people do not read a week starting Sunday. */
export const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function isTimeStr(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function defaultDay(open = '07:00', close = '22:00'): DayHours {
  return { closed: false, open, close };
}

export function defaultWeek(open = '07:00', close = '22:00'): WeeklyHours {
  return Array.from({ length: 7 }, () => defaultDay(open, close));
}

/** Pads, trims and repairs whatever is stored so the UI always has seven days. */
export function normaliseHours(hours: WeeklyHours | undefined | null): WeeklyHours | null {
  if (!Array.isArray(hours) || hours.length === 0) return null;
  return Array.from({ length: 7 }, (_, index) => {
    const day = hours[index];
    if (!day || typeof day !== 'object') return { closed: true, open: '00:00', close: '00:00' };
    return {
      closed: !!day.closed,
      open: isTimeStr(day.open) ? day.open : '00:00',
      close: isTimeStr(day.close) ? day.close : '00:00',
    };
  });
}

/** "7:00 am" — hour-first, lowercase meridiem, no dead ":00" noise. */
export function formatTime(time: string): string {
  if (!isTimeStr(time)) return time;
  const [h, m] = time.split(':').map(Number);
  const meridiem = h < 12 ? 'am' : 'pm';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour} ${meridiem}` : `${hour}:${String(m).padStart(2, '0')} ${meridiem}`;
}

export function formatDay(day: DayHours): string {
  if (day.closed) return 'Closed';
  // A day that opens and closes at the same time is running around the clock.
  if (day.open === day.close) return 'Open 24 hours';
  return `${formatTime(day.open)} – ${formatTime(day.close)}`;
}

function sameHours(a: DayHours, b: DayHours): boolean {
  return a.closed === b.closed && a.open === b.open && a.close === b.close;
}

export interface HoursRow {
  /** e.g. "Mon – Fri" or "Sat". */
  label: string;
  hours: string;
  days: number[];
}

/**
 * Collapses consecutive days that share hours, so a week reads as three lines
 * rather than seven near-identical ones.
 */
export function summariseHours(hours: WeeklyHours): HoursRow[] {
  const rows: HoursRow[] = [];

  for (const dayIndex of DISPLAY_ORDER) {
    const day = hours[dayIndex];
    const previous = rows[rows.length - 1];
    const previousDay = previous ? hours[previous.days[previous.days.length - 1]] : null;

    if (previous && previousDay && sameHours(previousDay, day)) {
      previous.days.push(dayIndex);
      previous.label = previous.days.length > 1
        ? `${DAY_SHORT[previous.days[0]]} – ${DAY_SHORT[dayIndex]}`
        : DAY_SHORT[dayIndex];
      continue;
    }

    rows.push({ label: DAY_SHORT[dayIndex], hours: formatDay(day), days: [dayIndex] });
  }

  return rows;
}

/**
 * Whether the property is open at `now`, handling a closing time past midnight
 * (a bar closing at 01:00 is still open at 23:30 on the previous day).
 */
export function isOpenAt(hours: WeeklyHours | undefined | null, now = new Date()): boolean | null {
  const week = normaliseHours(hours);
  if (!week) return null;

  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const toMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const today = week[now.getDay()];
  if (!today.closed) {
    const open = toMinutes(today.open);
    const close = toMinutes(today.close);
    if (open === close) return true; // 24 hours
    if (close > open && minutesNow >= open && minutesNow < close) return true;
    if (close < open && minutesNow >= open) return true; // runs past midnight
  }

  // Yesterday's session may still be running.
  const yesterday = week[(now.getDay() + 6) % 7];
  if (!yesterday.closed) {
    const open = toMinutes(yesterday.open);
    const close = toMinutes(yesterday.close);
    if (close < open && minutesNow < close) return true;
  }

  return false;
}

/** True when at least one day is open, i.e. the hours are worth publishing. */
export function hasPublishedHours(hours: WeeklyHours | undefined | null): boolean {
  const week = normaliseHours(hours);
  return !!week && week.some(day => !day.closed);
}
