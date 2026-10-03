import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';

/**
 * "Delete for me" and "clear history" for inquiry and booking chats.
 *
 * Both actions are per user. A chat is shared between the guest and the
 * property manager, so neither action touches the shared messages, the shared
 * chat status or the other person's view:
 *
 * - delete: adds the user to `deletedBy` (inquiry) / `chatDeletedBy` (booking).
 *   The chat is hidden for that user until the other side sends a new message,
 *   which removes them from the list again.
 * - clear: records `clearedFor.<uid>` (inquiry) / `chatClearedFor.<uid>`
 *   (booking). Messages at or before that time are hidden for that user only.
 */

interface FastDeleteOptions {
  chatType: 'inquiry' | 'booking';
  id: string; // chat document ID (for booking, may be 'booking_xxx' or raw booking ID)
  userId: string;
  mode: 'delete' | 'clear';
}

export async function fastDeleteOrClearChat({
  chatType,
  id,
  userId,
  mode
}: FastDeleteOptions): Promise<{ success: boolean; message: string }> {
  if (!id || !userId) {
    throw new Error('Invalid chat deletion request: missing chat ID or user ID');
  }

  const now = Date.now();

  if (chatType === 'inquiry') {
    const chatRef = doc(db, 'hotel_chats', id);
    await updateDoc(chatRef, mode === 'delete'
      ? { deletedBy: arrayUnion(userId), [`clearedFor.${userId}`]: now }
      : { [`clearedFor.${userId}`]: now });
    return { success: true, message: mode === 'delete' ? 'Chat deleted' : 'Chat history cleared' };
  }

  const rawBookingId = id.startsWith('booking_') ? id.replace('booking_', '') : id;
  const bookingRef = doc(db, 'bookings', rawBookingId);
  await updateDoc(bookingRef, mode === 'delete'
    ? { chatDeletedBy: arrayUnion(userId), [`chatClearedFor.${userId}`]: now }
    : { [`chatClearedFor.${userId}`]: now });
  return { success: true, message: mode === 'delete' ? 'Booking chat removed' : 'Chat history cleared' };
}

/**
 * When this user last cleared the chat, or 0. Reads the per-user map and the
 * legacy single-value fields (`clearedAt` + `clearedBy`) written before
 * clearing became per user.
 */
export function clearedAtFor(
  data: Record<string, any> | null | undefined,
  uid: string | undefined,
  kind: 'inquiry' | 'booking' = 'inquiry'
): number {
  if (!data || !uid) return 0;
  const map = data[kind === 'inquiry' ? 'clearedFor' : 'chatClearedFor'];
  const perUser = map && typeof map === 'object' ? Number(map[uid]) || 0 : 0;
  const legacy = data[kind === 'inquiry' ? 'clearedAt' : 'chatClearedAt'];
  const legacyBy = data[kind === 'inquiry' ? 'clearedBy' : 'chatClearedBy'];
  const legacyTime = typeof legacy === 'number' && legacyBy === uid ? legacy : 0;
  return Math.max(perUser, legacyTime);
}

/** Time of the last real message, ignoring status/presence bumps on legacy docs. */
export function lastMessageTime(data: Record<string, any> | null | undefined): number {
  if (!data) return 0;
  return Number(data.lastMessageAt) || Number(data.updatedAt) || Number(data.createdAt) || 0;
}
