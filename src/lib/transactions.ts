import { db } from './firebase';
import { collection, doc, getDocs, query, where, runTransaction, getDoc, Transaction } from 'firebase/firestore';
import { isRoomAvailable, BookingLike } from './availability';
import { computeBookingPricing } from './booking';
import { getActivePromotion } from './promotions';
import { roomPrice } from './currency';
import { updateBookingWithSlotTx } from './bookingWrites';
import { Booking, CurrencyCode, Hotel, Promotion, RoomType } from '../types';

/**
 * Public inventory for one room type, read from `booking_slots` (bookings
 * themselves are private). Each entry carries its booking id.
 */
export async function loadRoomSlots(roomTypeId: string): Promise<(BookingLike & { id: string })[]> {
  const snap = await getDocs(query(collection(db, 'booking_slots'), where('roomTypeId', '==', roomTypeId)));
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as BookingLike) }));
}

/** Public inventory for a whole property. */
export async function loadHotelSlots(hotelId: string): Promise<(BookingLike & { id: string })[]> {
  const snap = await getDocs(query(collection(db, 'booking_slots'), where('hotelId', '==', hotelId)));
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as BookingLike) }));
}

/**
 * Runs `operation` inside a transaction only if the room still has `quantity`
 * units free for the dates. A version counter on `room_locks/{roomId}` makes
 * two concurrent confirmations serialise: the loser sees a changed version,
 * re-reads inventory and re-checks.
 */
export async function safeRunTransactionAvailability(
  roomId: string,
  room: RoomType,
  checkIn: string,
  checkOut: string,
  quantity: number,
  operation: (transaction: Transaction) => void,
  ignoreBookingId?: string
) {
  const lockRef = doc(db, 'room_locks', roomId);

  let retries = 3;
  while (retries > 0) {
    retries--;

    const lockSnapOutside = await getDoc(lockRef);
    const expectedVersion = lockSnapOutside.exists() ? lockSnapOutside.data().version : 0;

    let slots = await loadRoomSlots(roomId);
    if (ignoreBookingId) slots = slots.filter(b => b.id !== ignoreBookingId);

    if (!isRoomAvailable(room, slots, checkIn, checkOut, quantity)) {
      throw new Error('ROOM_UNAVAILABLE');
    }

    try {
      await runTransaction(db, async (transaction) => {
        const lockSnap = await transaction.get(lockRef);
        const currentVersion = lockSnap.exists() ? lockSnap.data().version : 0;
        if (currentVersion !== expectedVersion) throw new Error('LOCK_MISMATCH');
        transaction.set(lockRef, { version: currentVersion + 1 });
        operation(transaction);
      });
      return;
    } catch (err: any) {
      if (err?.message === 'LOCK_MISMATCH') continue;
      throw err;
    }
  }

  throw new Error('TOO_MANY_RETRIES');
}

/** Smallest difference treated as a real underpayment rather than rounding. */
function priceTolerance(currency: CurrencyCode): number {
  return currency === 'USD' ? 5 : 1000;
}

export interface PriceCheck {
  ok: boolean;
  expected: number;
  stored: number;
  currency: CurrencyCode;
}

/**
 * Recomputes what a booking should cost and compares it with the stored total,
 * which the browser wrote. Lenient where the promotion that applied at booking
 * time can no longer be reconstructed: the lowest legitimate price wins.
 */
export function checkBookingPrice(booking: Booking, room: RoomType, hotel?: Hotel | null): PriceCheck {
  const currency = (booking.currency as CurrencyCode) || 'MWK';
  const stored = Number(booking.total) || 0;
  const guests = booking.guests || 1;
  const quantity = booking.quantity || 1;
  const packageIds = booking.packageIds ?? [];

  const candidates: number[] = [];
  const noPromo = computeBookingPricing(room, booking.checkIn, booking.checkOut, guests, quantity, packageIds, currency, 0);
  candidates.push(noPromo.total);

  const promotionId = booking.promotionId ?? undefined;
  const storedPromo: Promotion | undefined = promotionId ? hotel?.promotions?.find(p => p.id === promotionId) : undefined;
  if (storedPromo) {
    candidates.push(computeBookingPricing(room, booking.checkIn, booking.checkOut, guests, quantity, packageIds, currency, storedPromo).total);
  } else if (promotionId) {
    // The promotion has since been deleted; accept the discount recorded at booking
    // time, capped like any promotion.
    const recorded = Math.max(0, Number(booking.discountAmount) || 0);
    candidates.push(noPromo.total - Math.min(recorded, noPromo.accommodationTotal * 0.9));
  } else if (hotel) {
    const price = roomPrice(room, currency) ?? 0;
    const current = getActivePromotion(hotel, booking.checkIn, 'room', room.id, { price, currency });
    if (current) {
      candidates.push(computeBookingPricing(room, booking.checkIn, booking.checkOut, guests, quantity, packageIds, currency, current).total);
    }
  }

  const expected = Math.min(...candidates);
  return { ok: stored + priceTolerance(currency) >= expected, expected, stored, currency };
}

export class PriceMismatchError extends Error {
  constructor(public check: PriceCheck) {
    super('PRICE_MISMATCH');
  }
}

export interface ConfirmOptions {
  /** The room type; read from Firestore when omitted. */
  room?: RoomType | null;
  /** Used for the promotion check; read when omitted. */
  hotel?: Hotel | null;
  /** Extra fields written with the confirmation (voucher, PIN, timestamps). */
  extraPatch?: Record<string, unknown>;
  /** The manager has seen a price mismatch and chosen to honour the stored total. */
  acceptStoredPrice?: boolean;
}

/**
 * The only way a booking becomes confirmed. Re-checks inventory inside the
 * room-lock transaction, verifies the stored price, and writes the booking and
 * its public slot together.
 *
 * Throws Error('ROOM_UNAVAILABLE'), Error('TOO_MANY_RETRIES'),
 * Error('ROOM_NOT_FOUND') or PriceMismatchError.
 */
export async function confirmBooking(booking: Booking, options: ConfirmOptions = {}): Promise<Record<string, unknown>> {
  let room = options.room ?? null;
  if (!room) {
    const snap = await getDoc(doc(db, 'room_types', booking.roomTypeId));
    if (!snap.exists()) throw new Error('ROOM_NOT_FOUND');
    room = { id: snap.id, ...snap.data() } as RoomType;
  }

  let hotel = options.hotel ?? null;
  if (!hotel && booking.hotelId) {
    const snap = await getDoc(doc(db, 'hotels', booking.hotelId));
    if (snap.exists()) hotel = { id: snap.id, ...snap.data() } as Hotel;
  }

  if (!options.acceptStoredPrice) {
    const check = checkBookingPrice(booking, room, hotel);
    if (!check.ok) throw new PriceMismatchError(check);
  }

  const newPin = (options.extraPatch?.arrivalPin as string) || booking.arrivalPin || Math.floor(1000 + Math.random() * 9000).toString();
  const patch: Record<string, unknown> = {
    voucherIssued: true,
    arrivalPin: newPin,
    ...(options.extraPatch ?? {}),
    status: 'confirmed',
    confirmedAt: Date.now(),
    ...(options.acceptStoredPrice ? { priceOverrideAccepted: true } : {}),
  };

  await safeRunTransactionAvailability(
    room.id!,
    room,
    booking.checkIn,
    booking.checkOut,
    booking.quantity || 1,
    (tx) => updateBookingWithSlotTx(tx, booking.id!, patch, booking as any),
    booking.id
  );
  return patch;
}

/** A plain-language message for an error thrown by confirmBooking. */
export function confirmErrorMessage(err: unknown): string {
  if (err instanceof PriceMismatchError) {
    return 'The stored total is lower than the current price for this stay.';
  }
  const msg = (err as any)?.message;
  if (msg === 'ROOM_UNAVAILABLE') return 'No units of this room are free for these dates. Confirming would overbook it.';
  if (msg === 'TOO_MANY_RETRIES') return 'Inventory changed several times while confirming. Please try again.';
  if (msg === 'ROOM_NOT_FOUND') return 'The room type for this booking no longer exists.';
  return 'Could not confirm this booking. Please try again.';
}
