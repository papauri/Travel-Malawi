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
import { usePlatformMode } from '../contexts/PlatformModeContext';

interface OfflineBookingsQueueProps {
  className?: string;
  compact?: boolean;
}

export default function OfflineBookingsQueue({ className = '', compact = false }: OfflineBookingsQueueProps) {
  const { allBookings, pendingCount, syncedCount, isSyncing, syncNow, removeBooking, clearCompleted } = useOfflineBookings();
  const { isOnline } = useNetworkStatus();
  const { bookingsEnabled } = usePlatformMode();

  if (!bookingsEnabled || allBookings.length === 0) {
    return null;
  }

  return (
    <div className={`tm-panel !p-0 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <HardDrive className="w-5 h-5 text-stone-500 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="tm-h2">Saved offline</h3>
              {pendingCount > 0 ? (
                <span className="tm-tag tm-tag-warn">{pendingCount} waiting to send</span>
              ) : (
                <span className="tm-tag tm-tag-good">All sent</span>
              )}
            </div>
            <p className="tm-muted mt-0.5">Bookings made without a connection are sent when you are back online.</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="tm-actions shrink-0">
          {syncedCount > 0 && (
            <button
              type="button"
              onClick={clearCompleted}
              className="tm-btn tm-btn-quiet tm-btn-sm"
            >
              Clear sent ({syncedCount})
            </button>
          )}

          <button
            type="button"
            onClick={syncNow}
            disabled={isSyncing || (!isOnline && pendingCount > 0)}
            className="tm-btn tm-btn-secondary tm-btn-sm"
            title={!isOnline ? 'Reconnect to send' : 'Send waiting bookings now'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sending…' : isOnline ? 'Send now' : 'Offline'}</span>
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
              className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              {/* Main Booking Details */}
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="tm-tag font-mono">
                    {b.reference}
                  </span>
                  <h4 className="text-sm font-semibold text-stone-900 truncate min-w-0">
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
                  <p className="text-xs text-red-700 flex items-start gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span className="break-words">Not sent: {b.lastError}</span>
                  </p>
                )}
              </div>

              {/* Status and Action Controls */}
              <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto">
                {isPending && (
                  <span className="tm-tag tm-tag-warn">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Waiting</span>
                  </span>
                )}

                {isSyncingItem && (
                  <span className="tm-tag">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending…</span>
                  </span>
                )}

                {isSynced && (
                  <span className="tm-tag tm-tag-good">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Sent</span>
                  </span>
                )}

                {isFailed && (
                  <span className="tm-tag tm-tag-bad">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Not sent</span>
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
