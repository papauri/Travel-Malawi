/**
 * IndexedDB storage and synchronization engine for offline booking requests.
 *
 * Persists booking requests locally when the traveller has intermittent or no
 * internet connectivity (common in remote Malawian safari reserves, plateaus,
 * and lake shores). Automatically monitors network state and syncs queued
 * bookings to Firebase Firestore atomically once connectivity returns.
 */

import { doc, getDoc } from 'firebase/firestore';
import { db as firestoreDb } from './firebase';
import { bookingsEnabledNow, createBookingWithSlot } from './bookingWrites';
import { logSystemEvent } from './logger';

export interface OfflineBookingRecord {
  id: string; // Unique local ID e.g. "offline_1712345678_xyz"
  reference: string;
  hotelId: string;
  hotelName: string;
  roomTypeId: string;
  roomName: string;
  guestId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestWhatsapp?: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  adults?: number;
  children?: number;
  quantity: number;
  total: number;
  currency: string;
  specialRequests?: string;
  packageIds?: string[];
  extraGuestTotal?: number;
  packagesTotal?: number;
  promotionId?: string | null;
  discountAmount?: number;
  managerId?: string | null;
  managerEmail?: string | null;
  status: 'pending_sync' | 'syncing' | 'synced' | 'failed';
  lastError?: string;
  createdAt: number;
  syncedAt?: number;
  firebaseBookingId?: string;
  bookingData: Record<string, unknown>;
}

export type OfflineBookingInput = Omit<
  OfflineBookingRecord,
  'id' | 'status' | 'createdAt' | 'syncedAt' | 'firebaseBookingId' | 'lastError'
>;

const DB_NAME = 'TravelMalawi_OfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'offline_bookings';

/**
 * Opens and initializes the IndexedDB database instance.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('guestId', 'guestId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB.'));
  });
}

function notifyOfflineChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('offline-bookings-changed'));
  }
}

/**
 * Saves a new booking request to IndexedDB.
 */
export async function saveOfflineBooking(input: OfflineBookingInput): Promise<OfflineBookingRecord> {
  const db = await openDB();
  const id = `offline_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const record: OfflineBookingRecord = {
    ...input,
    id,
    status: 'pending_sync',
    createdAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(record);

    req.onsuccess = () => {
      notifyOfflineChange();
      resolve(record);
    };
    req.onerror = () => reject(req.error || new Error('Failed to save booking to IndexedDB.'));
  });
}

/**
 * Retrieves all offline booking records.
 */
export async function getAllOfflineBookings(): Promise<OfflineBookingRecord[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const results: OfflineBookingRecord[] = req.result || [];
        // Sort descending by creation date
        results.sort((a, b) => b.createdAt - a.createdAt);
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[OfflineDB] Error fetching bookings:', err);
    return [];
  }
}

/**
 * Retrieves pending bookings awaiting synchronization.
 */
export async function getPendingOfflineBookings(): Promise<OfflineBookingRecord[]> {
  const all = await getAllOfflineBookings();
  // 'syncing' is included so a record left mid-sync by a closed tab is retried;
  // replays are idempotent (fixed document id), and one tab syncs at a time.
  return all.filter((b) => b.status === 'pending_sync' || b.status === 'failed' || b.status === 'syncing');
}

/**
 * Updates a specific offline booking record in IndexedDB.
 */
export async function updateOfflineBooking(
  id: string,
  patch: Partial<OfflineBookingRecord>
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const current = getReq.result as OfflineBookingRecord | undefined;
      if (!current) {
        reject(new Error(`Offline booking with ID ${id} not found.`));
        return;
      }

      const updated = { ...current, ...patch };
      const putReq = store.put(updated);
      putReq.onsuccess = () => {
        notifyOfflineChange();
        resolve();
      };
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Deletes an offline booking record.
 */
export async function deleteOfflineBooking(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);

    req.onsuccess = () => {
      notifyOfflineChange();
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Removes all successfully synced records from IndexedDB to free space.
 */
export async function clearSyncedOfflineBookings(): Promise<number> {
  const all = await getAllOfflineBookings();
  const synced = all.filter((b) => b.status === 'synced');
  for (const item of synced) {
    await deleteOfflineBooking(item.id);
  }
  return synced.length;
}

export interface SyncResult {
  total: number;
  synced: number;
  failed: number;
  records: Array<{ id: string; reference: string; success: boolean; error?: string; firebaseId?: string }>;
}

let isSyncInProgress = false;

/**
 * Synchronizes all pending offline bookings with Firebase Firestore.
 */
export async function syncOfflineBookings(): Promise<SyncResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { total: 0, synced: 0, failed: 0, records: [] };
  }

  if (isSyncInProgress) {
    return { total: 0, synced: 0, failed: 0, records: [] };
  }

  // Directory mode: keep the queue untouched (not failed) so it replays if
  // bookings are switched back on.
  if (!(await bookingsEnabledNow())) {
    return { total: 0, synced: 0, failed: 0, records: [] };
  }

  isSyncInProgress = true;
  try {
    return await runSync();
  } finally {
    isSyncInProgress = false;
    notifyOfflineChange();
  }
}

/** Firestore id derived from the local record, so every replay targets the same document. */
function firestoreIdFor(localId: string): string {
  return localId.replace(/[^A-Za-z0-9_-]/g, '_');
}

async function runSync(): Promise<SyncResult> {
  const pending = await getPendingOfflineBookings();
  const result: SyncResult = {
    total: pending.length,
    synced: 0,
    failed: 0,
    records: [],
  };

  if (pending.length === 0) return result;

  for (const booking of pending) {
    try {
      await updateOfflineBooking(booking.id, { status: 'syncing' });

      // Write booking and public inventory slot atomically to Firebase Firestore.
      // A fixed id makes the replay idempotent: if an earlier attempt landed but
      // its acknowledgement was lost, the rules refuse the second create
      // instead of a duplicate booking being made.
      const firebaseBookingId = firestoreIdFor(booking.id);
      try {
        await createBookingWithSlot({
          ...booking.bookingData,
          reference: booking.reference,
          status: 'pending',
          offlineSynced: true,
          offlineCreatedAt: booking.createdAt,
          syncedAt: Date.now(),
        }, firebaseBookingId);
      } catch (writeErr: any) {
        if (writeErr?.code !== 'permission-denied' || !(await bookingAlreadyExists(firebaseBookingId))) throw writeErr;
      }

      // Mark locally as synced
      await updateOfflineBooking(booking.id, {
        status: 'synced',
        firebaseBookingId,
        syncedAt: Date.now(),
        lastError: undefined,
      });

      result.synced += 1;
      result.records.push({
        id: booking.id,
        reference: booking.reference,
        success: true,
        firebaseId: firebaseBookingId,
      });

      // Attempt to notify manager if managerEmail is provided (same shape as an online booking)
      if (booking.managerEmail) {
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: booking.managerEmail,
            hotelId: booking.hotelId,
            bookingId: firebaseBookingId,
            subject: `New booking request: ${booking.guestName} at ${booking.hotelName}`,
            message: `You have received a new booking request on Travel Malawi.

Guest: ${booking.guestName}
Dates: ${booking.checkIn} to ${booking.checkOut}
Room: ${booking.roomName}
Total: ${booking.total} ${booking.currency}

Please log in to review and confirm this booking.`,
          }),
        }).catch(() => {
          // Non-fatal notification failure
        });
      }

      // Log system audit event
      logSystemEvent(
        'action',
        `Offline booking synced for ${booking.hotelName} (Ref: ${booking.reference})`,
        {
          reference: booking.reference,
          hotelId: booking.hotelId,
          roomTypeId: booking.roomTypeId,
          firebaseBookingId,
        },
        undefined,
        'booking'
      ).catch(() => {});
    } catch (err: any) {
      console.error(`[OfflineSync] Failed to sync booking ${booking.reference}:`, err);
      const errorMessage = err?.message || 'Sync failed due to connectivity or verification error';
      await updateOfflineBooking(booking.id, {
        status: 'failed',
        lastError: errorMessage,
      });

      result.failed += 1;
      result.records.push({
        id: booking.id,
        reference: booking.reference,
        success: false,
        error: errorMessage,
      });
    }
  }

  return result;
}

/** True when the booking document is readable and exists (a signed-in guest's own booking). */
async function bookingAlreadyExists(bookingId: string): Promise<boolean> {
  try {
    return (await getDoc(doc(firestoreDb, 'bookings', bookingId))).exists();
  } catch {
    return false;
  }
}

// Global auto-sync listener when connection returns
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    // Wait 1.5 seconds for network sockets to stabilize, then sync
    setTimeout(() => {
      syncOfflineBookings().catch((err) => {
        console.warn('[OfflineDB] Background auto-sync attempt failed:', err);
      });
    }, 1500);
  });
}
