/**
 * IndexedDB storage and synchronization engine for offline booking requests.
 *
 * Persists booking requests locally when the traveller has intermittent or no
 * internet connectivity (common in remote Malawian safari reserves, plateaus,
 * and lake shores). Automatically monitors network state and syncs queued
 * bookings to Firebase Firestore atomically once connectivity returns.
 */

import { createBookingWithSlot } from './bookingWrites';
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
  return all.filter((b) => b.status === 'pending_sync' || b.status === 'failed');
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

  isSyncInProgress = true;
  const pending = await getPendingOfflineBookings();
  const result: SyncResult = {
    total: pending.length,
    synced: 0,
    failed: 0,
    records: [],
  };

  if (pending.length === 0) {
    isSyncInProgress = false;
    return result;
  }

  for (const booking of pending) {
    try {
      await updateOfflineBooking(booking.id, { status: 'syncing' });

      // Write booking and public inventory slot atomically to Firebase Firestore
      const firebaseBookingId = await createBookingWithSlot({
        ...booking.bookingData,
        reference: booking.reference,
        status: 'pending',
        offlineSynced: true,
        offlineCreatedAt: booking.createdAt,
        syncedAt: Date.now(),
      });

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

      // Attempt to notify manager if managerEmail is provided
      if (booking.managerEmail) {
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            booking: {
              ...booking.bookingData,
              id: firebaseBookingId,
              reference: booking.reference,
            },
            hotelName: booking.hotelName,
            managerEmail: booking.managerEmail,
            roomName: booking.roomName,
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

  isSyncInProgress = false;
  notifyOfflineChange();
  return result;
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
