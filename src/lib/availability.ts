/**
 * Inventory maths shared by the search page, the property page and the
 * availability calendar.
 *
 * A room type has `quantity` identical units. A night is sold out when the
 * active bookings covering it, plus any dates the manager has blocked by hand,
 * account for every unit. Cancelled and rejected bookings release their units.
 */

import { CurrencyCode, RoomType } from '../types';
import { roomPrice } from './currency';
import { DateStr, addDays, nightsInRange, rangesOverlap } from './dates';

/** Booking statuses that hold inventory. */
export const ACTIVE_BOOKING_STATUSES = ['confirmed'] as const;

/** The subset of a booking this module needs; anything wider is accepted. */
export interface BookingLike {
  roomTypeId?: string;
  hotelId?: string;
  checkIn?: string;
  checkOut?: string;
  quantity?: number;
  status?: string;
}

/** True when a booking still occupies rooms. */
export function isActiveBooking(booking: BookingLike): boolean {
  return (
    !!booking.checkIn &&
    !!booking.checkOut &&
    (ACTIVE_BOOKING_STATUSES as readonly string[]).includes(booking.status ?? 'pending')
  );
}

/** Units of one room type held across a date range by active bookings. */
export function bookedUnitsForRange(
  bookings: BookingLike[],
  roomTypeId: string | undefined,
  checkIn: DateStr,
  checkOut: DateStr
): number {
  if (!roomTypeId) return 0;
  
  const dailyCounts: Record<string, number> = {};
  
  for (const booking of bookings) {
    if (booking.roomTypeId !== roomTypeId) continue;
    if (!isActiveBooking(booking)) continue;
    if (!rangesOverlap(booking.checkIn!, booking.checkOut!, checkIn, checkOut)) continue;
    
    let cursor = booking.checkIn!;
    let guard = 0;
    while (cursor < booking.checkOut! && guard++ < 1000) {
      if (cursor >= checkIn && cursor < checkOut) {
        dailyCounts[cursor] = (dailyCounts[cursor] ?? 0) + (booking.quantity ?? 1);
      }
      cursor = addDays(cursor, 1);
    }
  }
  
  let maxUnits = 0;
  for (const count of Object.values(dailyCounts)) {
    if (count > maxUnits) maxUnits = count;
  }
  return maxUnits;
}

export function blockedUnitsForRange(
  room: RoomType,
  checkIn: DateStr,
  checkOut: DateStr
): number {
  let maxBlocked = 0;
  const nights = nightsInRange(checkIn, checkOut);
  
  if (room.blockedDates?.length) {
    const fullyBlocked = new Set(room.blockedDates);
    if (nights.some(night => fullyBlocked.has(night))) {
      return room.quantity ?? 0; // The entire room type is blocked
    }
  }

  if (room.blockedUnits) {
    for (const night of nights) {
      const units = room.blockedUnits[night] ?? 0;
      if (units > maxBlocked) maxBlocked = units;
    }
  }

  return maxBlocked;
}

/**
 * Whether `quantity` units of a room can still be sold for a range.
 * `quantity: 0` means the manager has taken the room type off sale entirely.
 */
export function isRoomAvailable(
  room: RoomType,
  bookings: BookingLike[],
  checkIn: DateStr,
  checkOut: DateStr,
  quantity = 1
): boolean {
  const inventory = room.quantity ?? 0;
  if (inventory <= 0) return false;
  
  const booked = bookedUnitsForRange(bookings, room.id, checkIn, checkOut);
  const blocked = blockedUnitsForRange(room, checkIn, checkOut);
  
  return (booked + blocked + quantity) <= inventory;
}

/** Units of a room type still sellable for a range; never negative. */
export function unitsRemaining(
  room: RoomType,
  bookings: BookingLike[],
  checkIn: DateStr,
  checkOut: DateStr
): number {
  const inventory = room.quantity ?? 0;
  if (inventory <= 0) return 0;
  
  const booked = bookedUnitsForRange(bookings, room.id, checkIn, checkOut);
  const blocked = blockedUnitsForRange(room, checkIn, checkOut);
  
  return Math.max(0, inventory - booked - blocked);
}

/**
 * Rooms of a property that can take a party of `guests` for the given dates.
 * With no dates supplied, only capacity is applied — a search for two guests
 * should not hide a property just because the visitor has not picked dates yet.
 */
export function roomsMatching(
  rooms: RoomType[],
  bookings: BookingLike[],
  criteria: { checkIn?: DateStr; checkOut?: DateStr; guests?: number }
): RoomType[] {
  const { checkIn, checkOut, guests } = criteria;
  const hasDates = !!checkIn && !!checkOut && checkIn < checkOut;

  return rooms.filter(room => {
    if (guests && guests > (room.maxGuests ?? 0)) return false;
    if (!hasDates) return (room.quantity ?? 0) > 0;
    return isRoomAvailable(room, bookings, checkIn!, checkOut!, 1);
  });
}

/**
 * Nightly rate of the cheapest room priced in `currency`, or null when none is.
 * Rooms not sold in that currency are skipped rather than converted.
 */
export function lowestPrice(rooms: RoomType[], currency: CurrencyCode = 'USD'): number | null {
  const prices = rooms
    .map(room => roomPrice(room, currency))
    .filter((price): price is number => price !== null && price > 0);
  return prices.length ? Math.min(...prices) : null;
}

/**
 * Units held per night across a set of bookings, for calendar shading.
 * Hand-blocked dates are folded in at full inventory so they read as sold out.
 */
export function buildOccupancyMap(
  bookings: BookingLike[],
  blockedDates: { date: DateStr; units: number }[] = []
): Record<DateStr, number> {
  const map: Record<DateStr, number> = {};

  for (const booking of bookings) {
    if (!isActiveBooking(booking)) continue;
    const units = booking.quantity ?? 1;
    let cursor = booking.checkIn!;
    let guard = 0;
    while (cursor < booking.checkOut! && guard++ < 1000) {
      map[cursor] = (map[cursor] ?? 0) + units;
      cursor = addDays(cursor, 1);
    }
  }

  // Added to the booked count rather than assigned over it, so a night that is
  // both blocked and booked is not silently reported as merely blocked.
  for (const { date, units } of blockedDates) {
    map[date] = (map[date] ?? 0) + units;
  }

  return map;
}
