import { useState, useEffect, useCallback } from 'react';
import {
  getAllOfflineBookings,
  getPendingOfflineBookings,
  syncOfflineBookings,
  deleteOfflineBooking,
  clearSyncedOfflineBookings,
  OfflineBookingRecord,
  SyncResult,
} from '../lib/offlineBookingsDB';
import toast from 'react-hot-toast';

export interface UseOfflineBookingsReturn {
  allBookings: OfflineBookingRecord[];
  pendingBookings: OfflineBookingRecord[];
  pendingCount: number;
  syncedCount: number;
  isSyncing: boolean;
  refresh: () => Promise<void>;
  syncNow: () => Promise<SyncResult>;
  removeBooking: (id: string) => Promise<void>;
  clearCompleted: () => Promise<void>;
}

export function useOfflineBookings(): UseOfflineBookingsReturn {
  const [allBookings, setAllBookings] = useState<OfflineBookingRecord[]>([]);
  const [pendingBookings, setPendingBookings] = useState<OfflineBookingRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const refresh = useCallback(async () => {
    try {
      const all = await getAllOfflineBookings();
      setAllBookings(all);
      const pending = all.filter((b) => b.status === 'pending_sync' || b.status === 'failed');
      setPendingBookings(pending);
    } catch (err) {
      console.warn('[useOfflineBookings] Error loading from IndexedDB:', err);
    }
  }, []);

  useEffect(() => {
    refresh();

    const handleDataChange = () => {
      refresh();
    };

    window.addEventListener('offline-bookings-changed', handleDataChange);
    return () => {
      window.removeEventListener('offline-bookings-changed', handleDataChange);
    };
  }, [refresh]);

  const syncNow = useCallback(async (): Promise<SyncResult> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast.error('Device is currently offline. Will sync once reconnected.');
      return { total: 0, synced: 0, failed: 0, records: [] };
    }

    setIsSyncing(true);
    const toastId = toast.loading('Syncing offline bookings with Firebase...');
    try {
      const res = await syncOfflineBookings();
      await refresh();

      if (res.total === 0) {
        toast.dismiss(toastId);
        toast.success('All bookings are already synchronized.');
      } else if (res.failed === 0) {
        toast.dismiss(toastId);
        toast.success(`Successfully synced ${res.synced} offline booking(s) to Firebase!`);
      } else {
        toast.dismiss(toastId);
        toast.error(`Synced ${res.synced} booking(s), but ${res.failed} failed. Check details.`);
      }
      return res;
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(`Sync error: ${err?.message || 'Failed to sync with Firebase'}`);
      return { total: 0, synced: 0, failed: 0, records: [] };
    } finally {
      setIsSyncing(false);
    }
  }, [refresh]);

  const removeBooking = useCallback(
    async (id: string) => {
      await deleteOfflineBooking(id);
      await refresh();
      toast.success('Removed offline booking.');
    },
    [refresh]
  );

  const clearCompleted = useCallback(async () => {
    const count = await clearSyncedOfflineBookings();
    await refresh();
    if (count > 0) {
      toast.success(`Cleared ${count} synced booking(s).`);
    }
  }, [refresh]);

  const syncedCount = allBookings.filter((b) => b.status === 'synced').length;

  return {
    allBookings,
    pendingBookings,
    pendingCount: pendingBookings.length,
    syncedCount,
    isSyncing,
    refresh,
    syncNow,
    removeBooking,
    clearCompleted,
  };
}
