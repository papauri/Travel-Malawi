import React from 'react';
import { 
  HardDrive, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Trash2, 
  Wifi, 
  WifiOff, 
  Calendar, 
  Building2, 
  ExternalLink 
} from 'lucide-react';
import { useOfflineBookings } from '../hooks/useOfflineBookings';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import PriceDisplay from './PriceDisplay';

interface OfflineBookingsQueueProps {
  className?: string;
  compact?: boolean;
}

export default function OfflineBookingsQueue({ className = '', compact = false }: OfflineBookingsQueueProps) {
  const { allBookings, pendingCount, syncedCount, isSyncing, syncNow, removeBooking, clearCompleted } = useOfflineBookings();
  const { isOnline } = useNetworkStatus();

  if (allBookings.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-700 shrink-0">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-stone-900">
                Offline Bookings Queue
              </h3>
              {pendingCount > 0 ? (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                  {pendingCount} Pending Sync
                </span>
              ) : (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200">
                  All Synced
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Saved locally via IndexedDB. Synchronizes with Firebase when online.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {syncedCount > 0 && (
            <button
              type="button"
              onClick={clearCompleted}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition cursor-pointer"
            >
              Clear Synced ({syncedCount})
            </button>
          )}

          <button
            type="button"
            onClick={syncNow}
            disabled={isSyncing || (!isOnline && pendingCount > 0)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              isOnline
                ? 'bg-stone-900 text-white hover:bg-stone-800 shadow-xs'
                : 'bg-stone-100 text-stone-500 border border-stone-200'
            }`}
            title={!isOnline ? 'Reconnect to internet to sync' : 'Sync pending bookings with Firebase'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : isOnline ? 'Sync with Firebase' : 'Offline'}</span>
          </button>
        </div>
      </div>

      {/* Bookings List */}
      <div className="divide-y divide-stone-100">
        {allBookings.map((b) => {
          const isPending = b.status === 'pending_sync';
          const isFailed = b.status === 'failed';
          const isSynced = b.status === 'synced';
          const isSyncingItem = b.status === 'syncing';

          return (
            <div
              key={b.id}
              className={`p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 transition ${
                isPending ? 'bg-amber-50/20' : isFailed ? 'bg-red-50/20' : 'bg-white'
              }`}
            >
              {/* Main Booking Details */}
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-stone-800 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                    {b.reference}
                  </span>
                  <h4 className="text-sm font-bold text-stone-900 truncate">
                    {b.hotelName} &middot; <span className="text-stone-600 font-normal">{b.roomName}</span>
                  </h4>
                </div>

                <div className="flex items-center gap-3 text-xs text-stone-500 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-stone-400" />
                    {b.checkIn} &rarr; {b.checkOut}
                  </span>
                  <span>&bull;</span>
                  <span>{b.guests} guest{b.guests > 1 ? 's' : ''}</span>
                  <span>&bull;</span>
                  <span className="font-semibold text-stone-900">
                    <PriceDisplay amount={b.total} currency={b.currency} />
                  </span>
                </div>

                {isFailed && b.lastError && (
                  <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Sync failed: {b.lastError}</span>
                  </p>
                )}
              </div>

              {/* Status and Action Controls */}
              <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto">
                {isPending && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Saved Offline</span>
                  </span>
                )}

                {isSyncingItem && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Syncing...</span>
                  </span>
                )}

                {isSynced && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Synced to Firebase</span>
                  </span>
                )}

                {isFailed && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Failed</span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => removeBooking(b.id)}
                  className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-stone-100 rounded-lg transition cursor-pointer"
                  title="Remove from queue"
                  aria-label="Remove offline booking"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
