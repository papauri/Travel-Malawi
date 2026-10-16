import React, { useState } from 'react';
import { RoomType, Hotel, IcalFeedConfig } from '../types';
import { 
  CHANNEL_PRESETS, 
  getRoomIcalExportUrl, 
  getHotelIcalExportUrl, 
  getGoogleCalendarSubscribeUrl, 
  getWebcalUrl 
} from '../lib/ical';
import { 
  CalendarSync, Copy, Check, ExternalLink, RefreshCw, Plus, 
  Trash2, AlertCircle, CheckCircle2, ShieldCheck, HelpCircle, 
  Sparkles, Calendar as CalendarIcon, Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  room?: RoomType;
  hotel: Hotel;
  onRoomUpdated?: (updated: RoomType) => void;
  onHotelUpdated?: (updated: Hotel) => void;
  onClose?: () => void;
}

export default function IcalSyncManager({
  room,
  hotel,
  onRoomUpdated,
  onHotelUpdated,
  onClose,
}: Props) {
  const { user } = useAuth();
  const isRoomMode = Boolean(room && room.id);
  const targetId = isRoomMode ? room!.id! : hotel.id!;
  const targetName = isRoomMode ? `${hotel.name} — ${room!.name}` : hotel.name;

  const currentFeeds: IcalFeedConfig[] = isRoomMode
    ? (room?.icalSyncUrls || [])
    : (hotel.icalSyncUrls || []);

  const [copied, setCopied] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('roomraccoon');
  const [feedName, setFeedName] = useState('RoomRaccoon Calendar');
  const [feedUrl, setFeedUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    eventCount: number;
    blockedNightsCount: number;
    summary: string;
  } | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingFeedId, setIsSyncingFeedId] = useState<string | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  const exportUrl = isRoomMode
    ? getRoomIcalExportUrl(room!.id!, room!.icalExportToken)
    : getHotelIcalExportUrl(hotel.id!, hotel.icalExportToken);

  const webcalUrl = getWebcalUrl(exportUrl);
  const googleCalUrl = getGoogleCalendarSubscribeUrl(exportUrl, targetName);

  const handleCopy = () => {
    navigator.clipboard.writeText(exportUrl);
    setCopied(true);
    toast.success('Calendar feed link copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePlatformChange = (platformKey: string) => {
    setSelectedPlatform(platformKey);
    const preset = CHANNEL_PRESETS[platformKey];
    if (preset) {
      setFeedName(`${preset.name} Feed`);
    }
    setTestResult(null);
  };

  const handleTestFeed = async () => {
    if (!feedUrl.trim()) {
      toast.error('Please enter the .ics calendar URL first.');
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const res = await fetch('/api/calendar/test-feed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ url: feedUrl.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult(data);
        toast.success(`Connection verified! Found ${data.eventCount} reservations.`);
      } else {
        setTestResult({
          success: false,
          eventCount: 0,
          blockedNightsCount: 0,
          summary: data.summary || 'Failed to connect to calendar.',
        });
        toast.error(data.summary || 'Could not parse external feed.');
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        eventCount: 0,
        blockedNightsCount: 0,
        summary: err?.message || 'Network error while testing feed.',
      });
      toast.error('Network error testing feed.');
    } finally {
      setIsTesting(false);
    }
  };

  const handleAddFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedUrl.trim()) {
      toast.error('Feed URL is required.');
      return;
    }
    setIsSaving(true);
    try {
      const newFeed: IcalFeedConfig = {
        id: `feed_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: feedName.trim() || 'External Calendar',
        url: feedUrl.trim(),
        platform: selectedPlatform as any,
        syncStatus: 'syncing',
        updatedAt: Date.now(),
      };

      const nextFeeds = [...currentFeeds, newFeed];

      if (isRoomMode && room?.id) {
        await updateDoc(doc(db, 'room_types', room.id), {
          icalSyncUrls: nextFeeds,
        });
        const updatedRoom = { ...room, icalSyncUrls: nextFeeds };
        onRoomUpdated?.(updatedRoom);
      } else if (hotel.id) {
        await updateDoc(doc(db, 'hotels', hotel.id), {
          icalSyncUrls: nextFeeds,
        });
        const updatedHotel = { ...hotel, icalSyncUrls: nextFeeds };
        onHotelUpdated?.(updatedHotel);
      }

      toast.success('Calendar feed added! Triggering first synchronization...');
      setShowAddForm(false);
      setFeedUrl('');
      setTestResult(null);

      // Immediately trigger live sync
      await triggerLiveSync();
    } catch (err: any) {
      console.error('Failed to add feed:', err);
      toast.error(err?.message || 'Failed to save calendar feed.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveFeed = async (feedId: string) => {
    if (!confirm('Are you sure you want to remove this external calendar feed? Blocked dates from this feed will be cleared.')) return;
    try {
      const nextFeeds = currentFeeds.filter(f => f.id !== feedId);
      if (isRoomMode && room?.id) {
        await updateDoc(doc(db, 'room_types', room.id), {
          icalSyncUrls: nextFeeds,
        });
        const updatedRoom = { ...room, icalSyncUrls: nextFeeds };
        onRoomUpdated?.(updatedRoom);
      } else if (hotel.id) {
        await updateDoc(doc(db, 'hotels', hotel.id), {
          icalSyncUrls: nextFeeds,
        });
        const updatedHotel = { ...hotel, icalSyncUrls: nextFeeds };
        onHotelUpdated?.(updatedHotel);
      }

      toast.success('Feed removed. Re-syncing calendar...');
      await triggerLiveSync();
    } catch (err: any) {
      toast.error('Failed to remove feed.');
    }
  };

  const triggerLiveSync = async (specificFeedId?: string) => {
    if (specificFeedId) setIsSyncingFeedId(specificFeedId);
    else setIsSyncingAll(true);

    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const endpoint = isRoomMode ? '/api/calendar/sync-room' : '/api/calendar/sync-hotel';
      const body = isRoomMode
        ? { roomId: room!.id, hotelId: hotel.id }
        : { hotelId: hotel.id };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Synchronized! ${data.totalBlockedDates} dates blocked from external channels.`);
        if (isRoomMode && room) {
          onRoomUpdated?.({
            ...room,
            icalSyncUrls: data.feeds || currentFeeds,
            icalBlockedDates: data.combinedBlocked || room.icalBlockedDates,
          });
        } else {
          onHotelUpdated?.({
            ...hotel,
            icalSyncUrls: data.feeds || currentFeeds,
            icalBlockedDates: data.combinedBlocked || hotel.icalBlockedDates,
          });
        }
      } else {
        toast.error(data.error || 'Sync completed with warnings.');
      }
    } catch (err: any) {
      toast.error('Network failure during calendar sync.');
    } finally {
      setIsSyncingFeedId(null);
      setIsSyncingAll(false);
    }
  };

  const activePreset = CHANNEL_PRESETS[selectedPlatform] || CHANNEL_PRESETS.roomraccoon;
  const totalBlockedDates = isRoomMode
    ? (room?.icalBlockedDates?.length || 0)
    : (hotel.icalBlockedDates?.length || 0);

  return (
    <div className="space-y-6 text-stone-900">
      {/* Top Banner / Explanation */}
      <div className="bg-gradient-to-br from-amber-50 to-stone-50 border border-amber-200/80 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 bg-amber-600 text-white rounded-xl shadow-sm shrink-0">
            <CalendarSync className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-stone-900">
                2-Way Calendar Sync (iCal / .ics)
              </h3>
              <span className="text-[11px] font-semibold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                Zero Double Bookings
              </span>
            </div>
            <p className="text-xs text-stone-600 mt-1 leading-relaxed">
              Connect seamlessly with <strong>RoomRaccoon, Airbnb, Booking.com, NightsBridge</strong>, or Google Calendar. 
              Bookings made on other channels automatically block dates here, and reservations made on Travel Malawi sync straight into your PMS.
            </p>
          </div>
        </div>

        {totalBlockedDates > 0 && (
          <div className="mt-4 pt-3 border-t border-amber-200/60 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2 text-amber-900 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span><strong>{totalBlockedDates} nights</strong> automatically protected & blocked on Travel Malawi</span>
            </div>
            <button
              onClick={() => triggerLiveSync()}
              disabled={isSyncingAll}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-amber-100 text-amber-900 font-semibold rounded-lg border border-amber-300 text-xs transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
              {isSyncingAll ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        )}
      </div>

      {/* 1. EXPORT SECTION: Travel Malawi -> RoomRaccoon / Airbnb */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-stone-900 text-white text-[11px] font-bold flex items-center justify-center">1</span>
              <h4 className="font-bold text-stone-900 text-sm">
                Export Travel Malawi Calendar to RoomRaccoon / Channels
              </h4>
            </div>
            <p className="text-xs text-stone-600 mt-1 ml-7">
              Paste this link into RoomRaccoon or Airbnb so bookings made on Travel Malawi block dates across your other systems.
            </p>
          </div>
        </div>

        <div className="ml-7 space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={exportUrl}
              className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-stone-700 select-all focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold shadow-sm transition shrink-0"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
            <span className="text-stone-500">Quick subscribe:</span>
            <a
              href={googleCalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sky-700 hover:text-sky-800 font-medium hover:underline"
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              Add to Google Calendar
              <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-stone-300">•</span>
            <a
              href={webcalUrl}
              className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-medium hover:underline"
            >
              Open on Apple / Phone Calendar
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="bg-stone-50 rounded-xl p-3 border border-stone-200/80 text-[11px] text-stone-600 space-y-1">
            <div className="font-semibold text-stone-800 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
              Where to paste this in RoomRaccoon:
            </div>
            <p>
              In RoomRaccoon, go to <strong>Settings (Gear) → Channel Manager → External Calendars / iCal</strong>. Select this room category, choose <em>"Import Calendar"</em>, and paste this URL.
            </p>
          </div>
        </div>
      </div>

      {/* 2. IMPORT SECTION: RoomRaccoon / Airbnb -> Travel Malawi */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-stone-900 text-white text-[11px] font-bold flex items-center justify-center">2</span>
              <h4 className="font-bold text-stone-900 text-sm">
                Import RoomRaccoon / External Calendars into Travel Malawi
              </h4>
            </div>
            <p className="text-xs text-stone-600 mt-1 ml-7">
              Add your RoomRaccoon or Airbnb iCal links so dates booked elsewhere automatically block on Travel Malawi.
            </p>
          </div>

          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-sm transition ml-7 sm:ml-0"
            >
              <Plus className="w-4 h-4" />
              Connect Calendar
            </button>
          )}
        </div>

        {/* Existing Feeds List */}
        <div className="ml-7 space-y-3">
          {currentFeeds.length === 0 ? (
            <div className="p-4 border border-dashed border-stone-300 rounded-xl text-center bg-stone-50/50">
              <CalendarSync className="w-6 h-6 text-stone-400 mx-auto mb-1.5" />
              <p className="text-xs font-semibold text-stone-700">No external calendars connected yet</p>
              <p className="text-[11px] text-stone-500 mt-0.5 max-w-sm mx-auto">
                Connect your RoomRaccoon chalet calendar link or Airbnb feed to keep your availability synchronized in real time.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {currentFeeds.map((feed) => {
                const preset = CHANNEL_PRESETS[feed.platform || 'other'] || CHANNEL_PRESETS.other;
                const isSyncing = isSyncingFeedId === feed.id || isSyncingAll;
                const isSuccess = feed.syncStatus === 'success';
                const isError = feed.syncStatus === 'error';

                return (
                  <div
                    key={feed.id}
                    className="border border-stone-200 rounded-xl p-3.5 bg-stone-50/80 hover:bg-stone-50 transition flex items-center justify-between gap-3 flex-wrap"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${preset.badgeBg}`}>
                          {preset.badgeText}
                        </span>
                        <span className="text-xs font-bold text-stone-900 truncate">
                          {feed.name}
                        </span>
                        {isSuccess && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            {feed.blockedCount || 0} dates blocked
                          </span>
                        )}
                        {isError && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-rose-700 font-medium" title={feed.lastError}>
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                            Sync error
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-stone-500 font-mono truncate mt-1 max-w-md">
                        {feed.url}
                      </div>

                      {feed.lastSyncedAt && (
                        <div className="text-[10px] text-stone-400 mt-0.5">
                          Last synchronized: {new Date(feed.lastSyncedAt).toLocaleTimeString()} · {new Date(feed.lastSyncedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => triggerLiveSync(feed.id)}
                        disabled={isSyncing}
                        className="p-1.5 hover:bg-stone-200/80 rounded-lg text-stone-600 transition"
                        title="Sync this feed now"
                      >
                        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-amber-600' : ''}`} />
                      </button>
                      <button
                        onClick={() => handleRemoveFeed(feed.id)}
                        className="p-1.5 hover:bg-rose-100 rounded-lg text-stone-400 hover:text-rose-600 transition"
                        title="Remove feed"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add New Feed Form */}
          {showAddForm && (
            <form onSubmit={handleAddFeed} className="border border-amber-300 bg-amber-50/40 rounded-xl p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  Connect New Calendar Feed
                </h5>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-stone-400 hover:text-stone-700 text-xs"
                >
                  Cancel
                </button>
              </div>

              {/* Platform Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  PMS / Platform
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(CHANNEL_PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handlePlatformChange(key)}
                      className={`px-3 py-2 rounded-xl text-left border text-xs font-medium transition ${
                        selectedPlatform === key
                          ? 'border-amber-600 bg-white shadow-sm ring-1 ring-amber-600 text-stone-900'
                          : 'border-stone-200 bg-white/70 hover:bg-white text-stone-600'
                      }`}
                    >
                      <div className="font-bold text-[11px]">{preset.name}</div>
                      <div className="text-[10px] text-stone-500 truncate">{preset.badgeText}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200 text-[11px] text-stone-600">
                <span className="font-semibold text-stone-800">How to find this link in {activePreset.name}:</span>
                <p className="mt-0.5">{activePreset.exportGuide}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                    Feed Name / Label
                  </label>
                  <input
                    type="text"
                    required
                    value={feedName}
                    onChange={(e) => setFeedName(e.target.value)}
                    placeholder="e.g. RoomRaccoon Chalet"
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                    iCal URL (.ics link)
                  </label>
                  <input
                    type="url"
                    required
                    value={feedUrl}
                    onChange={(e) => {
                      setFeedUrl(e.target.value);
                      setTestResult(null);
                    }}
                    placeholder={activePreset.urlPlaceholder}
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Test Result Callout */}
              {testResult && (
                <div className={`p-3 rounded-xl border text-xs ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-rose-50 border-rose-300 text-rose-900'
                }`}>
                  <div className="flex items-center gap-2 font-bold">
                    {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                    <span>{testResult.summary}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleTestFeed}
                  disabled={isTesting || !feedUrl.trim()}
                  className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold transition"
                >
                  {isTesting ? 'Verifying link...' : 'Test Connection'}
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !feedUrl.trim()}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                >
                  {isSaving ? 'Connecting...' : 'Save & Sync Calendar'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
