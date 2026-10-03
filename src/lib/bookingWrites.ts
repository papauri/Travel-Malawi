/**
 * Every write that creates a booking or changes what it occupies (status,
 * dates, room, quantity) goes through here, so the public `booking_slots`
 * mirror never drifts from the private booking.
 *
 * Bookings hold guest contact details and are readable only by the guest, the
 * property's manager and admins. Availability is computed from
 * `booking_slots/{bookingId}`, which carries only the inventory fields and is
 * public. Firestore rules require each slot write to match the booking in the
 * same batch or transaction.
 */

import { collection, doc, writeBatch, serverTimestamp, Transaction, DocumentReference } from 'firebase/firestore';
import { db } from './firebase';

export const SLOT_FIELDS = ['hotelId', 'roomTypeId', 'checkIn', 'checkOut', 'quantity', 'status'] as const;

export interface BookingSlot {
  hotelId: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  quantity: number;
  status: string;
}

type BookingShape = Partial<Record<(typeof SLOT_FIELDS)[number], unknown>> & Record<string, unknown>;

/** The public inventory view of a booking. */
export function slotFromBooking(booking: BookingShape): BookingSlot & { updatedAt: ReturnType<typeof serverTimestamp> } {
  return {
    hotelId: String(booking.hotelId ?? ''),
    roomTypeId: String(booking.roomTypeId ?? ''),
    checkIn: String(booking.checkIn ?? ''),
    checkOut: String(booking.checkOut ?? ''),
    quantity: typeof booking.quantity === 'number' ? booking.quantity : 1,
    status: String(booking.status ?? 'pending'),
    updatedAt: serverTimestamp(),
  };
}

/** True when a patch touches a field that the slot mirrors. */
export function touchesSlot(patch: Record<string, unknown>): boolean {
  return SLOT_FIELDS.some(f => f in patch);
}

export function bookingRef(bookingId: string): DocumentReference {
  return doc(db, 'bookings', bookingId);
}

export function slotRef(bookingId: string): DocumentReference {
  return doc(db, 'booking_slots', bookingId);
}

/** Creates a booking and its slot atomically. Returns the new booking id. */
export async function createBookingWithSlot(data: BookingShape): Promise<string> {
  const ref = doc(collection(db, 'bookings'));
  // `quantity` must be explicit so the slot and the booking agree exactly.
  const full = { ...data, quantity: typeof data.quantity === 'number' ? data.quantity : 1 };
  const batch = writeBatch(db);
  batch.set(ref, full);
  batch.set(slotRef(ref.id), slotFromBooking(full));
  await batch.commit();
  return ref.id;
}

/**
 * Updates a booking, and its slot when the patch changes inventory fields.
 * `current` is the booking as last read; the slot is built from current+patch.
 */
export async function updateBookingWithSlot(
  bookingId: string,
  patch: Record<string, unknown>,
  current: BookingShape
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(bookingRef(bookingId), patch);
  if (touchesSlot(patch)) {
    batch.set(slotRef(bookingId), slotFromBooking({ ...current, ...patch }));
  }
  await batch.commit();
}

/** Same as updateBookingWithSlot, inside an existing transaction. */
export function updateBookingWithSlotTx(
  tx: Transaction,
  bookingId: string,
  patch: Record<string, unknown>,
  current: BookingShape
): void {
  tx.update(bookingRef(bookingId), patch);
  if (touchesSlot(patch)) {
    tx.set(slotRef(bookingId), slotFromBooking({ ...current, ...patch }));
  }
}

/** Deletes a booking and its slot together (admins and managers only). */
export async function deleteBookingWithSlot(bookingId: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(bookingRef(bookingId));
  batch.delete(slotRef(bookingId));
  await batch.commit();
}

/** Tells the server to drop pending reminders for a cancelled/rejected booking. Best effort. */
export async function cancelBookingReminders(bookingId: string): Promise<void> {
  try {
    await fetch(`/api/reminders/booking/${encodeURIComponent(bookingId)}/cancel`, { method: 'POST' });
  } catch {
    /* best effort: a failed call only means a stale reminder may still go out */
  }
}
