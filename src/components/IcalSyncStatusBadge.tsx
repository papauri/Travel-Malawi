import React, { useState } from 'react';
import { Hotel, RoomType } from '../types';
import { 
  getPropertyIcalSyncStatus, 
  CHANNEL_PRESETS 
} from '../lib/ical';
import { 
  CalendarSync, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Clock, 
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { auth } from '../lib/firebase';

interface Props {
  hotel: Hotel;
  rooms?: RoomType[];
  onOpenSyncModal?: (hotel: Hotel) => void;
  onSyncComplete?: (updatedHotel: Hotel) => void;
  showWhenEmpty?: boolean;
  compact?: boolean;
  className?: string;
}

export default function IcalSyncStatusBadge({
  hotel,
  rooms = [],
  onOpenSyncModal,
  onSyncComplete,
  showWhenEmpty = false,
  compact = false,
  className = '',
}: Props) {
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const summary = getPropertyIcalSyncStatus(hotel, rooms);

  // If no feeds configured and showWhenEmpty is false, render nothing
  if (summary.totalFeeds === 0) {
    if (!showWhenEmpty) return null;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenSyncModal?.(hotel);
        }}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-stone-100 hover:bg-stone-200 text-stone-600 border border-stone-200/90 transition cursor-pointer ${className}`}
        title="Connect RoomRaccoon, Airbnb, or external PMS calendar"
      >
        <CalendarSync className="w-3 h-3 text-stone-400 shrink-0" />
        <span>iCal: Inactive</span>
      </button>
    );
  }

  const effectiveState = isManualSyncing ? 'syncing' : summary.state;

  const handleQuickSync = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isManualSyncing || !hotel.id) return;

    setIsManualSyncing(true);
    const toastId = toast.loading(`Syncing external calendars for ${hotel.name}…`);

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/calendar/sync-hotel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ hotelId: hotel.id }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(
          `Sync successful! ${data.totalBlockedDates ?? summary.totalBlockedDates} nights blocked from external channels.`,
          { id: toastId }
        );
        if (onSyncComplete) {
          onSyncComplete({
            ...hotel,
            icalLastSyncAt: data.lastSyncedAt || Date.now(),
            icalSyncStatus: 'success',
            icalLastError: '',
          });
        }
      } else {
        const errMsg = data.error || data.lastError || 'Some external feeds could not be reached.';
        toast.error(`iCal sync warning: ${errMsg}`, { id: toastId });
        if (onSyncComplete) {
          onSyncComplete({
            ...hotel,
            icalLastSyncAt: data.lastSyncedAt || Date.now(),
            icalSyncStatus: 'failed',
            icalLastError: errMsg,
          });
        }
      }
    } catch (err: any) {
      toast.error('Network connection issue during calendar sync.', { id: toastId });
    } finally {
      setIsManualSyncing(false);
    }
  };

  // Visual themes by state
  const getTheme = () => {
    switch (effectiveState) {
      case 'syncing':
        return {
          bg: 'bg-sky-50 hover:bg-sky-100/70 text-sky-800 border-sky-200/90',
          dot: 'bg-sky-500 animate-ping',
          icon: <RefreshCw className="w-3 h-3 text-sky-600 animate-spin shrink-0" />,
          label: 'iCal Syncing…',
          timestampLabel: 'In progress',
        };
      case 'failed':
        return {
          bg: 'bg-rose-50 hover:bg-rose-100/70 text-rose-800 border-rose-200/90',
          dot: 'bg-rose-500',
          icon: <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />,
          label: 'iCal Sync Failed',
          timestampLabel: summary.lastSyncedAt ? `Attempted ${summary.relativeTime}` : 'Check URL',
        };
      case 'success':
        return {
          bg: 'bg-emerald-50 hover:bg-emerald-100/70 text-emerald-800 border-emerald-200/90',
          dot: 'bg-emerald-500',
          icon: <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />,
          label: 'iCal Synced',
          timestampLabel: summary.lastSyncedAt ? `Updated ${summary.relativeTime}` : 'Active',
        };
      case 'active':
      default:
        return {
          bg: 'bg-amber-50 hover:bg-amber-100/70 text-amber-800 border-amber-200/90',
          dot: 'bg-amber-500',
          icon: <CalendarSync className="w-3 h-3 text-amber-600 shrink-0" />,
          label: 'iCal Active',
          timestampLabel: summary.lastSyncedAt ? `Updated ${summary.relativeTime}` : 'Scheduled',
        };
    }
  };

  const theme = getTheme();

  return (
    <div 
      className="relative inline-flex items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenSyncModal?.(hotel);
        }}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-semibold border shadow-2xs transition cursor-pointer select-none ${theme.bg} ${className}`}
        role="button"
        tabIndex={0}
        aria-label={`iCal Sync Status: ${theme.label}, ${theme.timestampLabel}`}
      >
        {/* Status Icon */}
        {theme.icon}

        {/* State Label */}
        <span>{theme.label}</span>

        {/* Timestamp of last sync attempt */}
        {!compact && (
          <>
            <span className="opacity-40">•</span>
            <span className="font-normal opacity-90 text-[10.5px]">
              {theme.timestampLabel}
            </span>
          </>
        )}

        {/* Quick Refresh Icon Button */}
        <button
          type="button"
          onClick={handleQuickSync}
          disabled={isManualSyncing}
          className="ml-0.5 p-0.5 -mr-1 rounded hover:bg-black/5 active:scale-95 transition cursor-pointer disabled:opacity-50"
          title="Trigger instant calendar sync now"
          aria-label="Refresh calendar sync"
        >
          <RefreshCw className={`w-2.5 h-2.5 ${isManualSyncing ? 'animate-spin text-stone-700' : 'opacity-60 hover:opacity-100'}`} />
        </button>
      </div>

      {/* Floating Detailed Hover Tooltip Popover */}
      {showTooltip && (
        <div 
          className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-stone-900 text-white rounded-xl shadow-xl z-50 text-xs border border-stone-800 pointer-events-none animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between border-b border-stone-800 pb-1.5 mb-2">
            <span className="font-semibold flex items-center gap-1.5 text-stone-200">
              <CalendarSync className="w-3.5 h-3.5 text-amber-400" />
              <span>2-Way iCal Sync</span>
            </span>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${
              effectiveState === 'success' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
              effectiveState === 'failed' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
              'bg-sky-950 text-sky-400 border border-sky-800'
            }`}>
              {effectiveState}
            </span>
          </div>

          <div className="space-y-1.5 text-[11px] text-stone-300">
            <div className="flex items-center justify-between">
              <span className="text-stone-400">Last sync attempt:</span>
              <span className="font-medium text-stone-200">{summary.exactTime}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-stone-400">Connected feeds:</span>
              <span className="font-medium text-stone-200">
                {summary.totalFeeds} {summary.totalFeeds === 1 ? 'feed' : 'feeds'}
                {summary.hotelFeedsCount > 0 && ` (${summary.hotelFeedsCount} property)`}
                {summary.roomFeedsCount > 0 && ` (${summary.roomFeedsCount} room)`}
              </span>
            </div>

            {summary.totalBlockedDates > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-stone-400">Nights blocked:</span>
                <span className="font-medium text-emerald-400">{summary.totalBlockedDates} dates</span>
              </div>
            )}

            {summary.feedNames.length > 0 && (
              <div className="pt-1 border-t border-stone-800/80">
                <span className="text-stone-400 text-[10px] block mb-1">Channels:</span>
                <div className="flex flex-wrap gap-1">
                  {summary.feedNames.map((name, idx) => (
                    <span 
                      key={idx}
                      className="px-1.5 py-0.5 rounded bg-stone-800 text-[10px] text-stone-200 font-medium"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {summary.hasErrors && summary.errors.length > 0 && (
              <div className="pt-1.5 border-t border-stone-800/80 text-rose-400 text-[10.5px]">
                <div className="flex items-start gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{summary.errors[0]}</span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-2.5 pt-2 border-t border-stone-800 flex items-center justify-between text-[10px] text-stone-400">
            <span>Click badge to manage settings</span>
            <ChevronRight className="w-3 h-3 text-stone-500" />
          </div>
        </div>
      )}
    </div>
  );
}
