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
  Calendar as CalendarIcon, Wifi
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
    previewDates?: string[];
    summary: string;
    latencyMs?: number;
  } | null>(null);

  // Real-time on-demand test results for existing feeds
  const [existingFeedTests, setExistingFeedTests] = useState<Record<string, {
    testing: boolean;
    success?: boolean;
    summary?: string;
    latencyMs?: number;
    eventCount?: number;
    blockedNightsCount?: number;
    previewDates?: string[];
  }>>({});

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
    toast.success('Link copied');
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

  const cleanFeedUrl = (raw: string) => {
    let clean = (raw || '').trim();
    if (clean.toLowerCase().startsWith('webcal://')) {
      clean = 'https://' + clean.slice(9);
    }
    return clean;
  };

  const handleTestFeed = async () => {
    const targetUrl = cleanFeedUrl(feedUrl);
    if (!targetUrl) {
      toast.error('Paste the calendar link (.ics) first.');
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    const startTime = performance.now();
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const res = await fetch('/api/calendar/test-feed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ url: targetUrl }),
      });
      const data = await res.json();
      const latencyMs = Math.round(performance.now() - startTime);
      if (data.success) {
        setTestResult({ ...data, latencyMs });
        toast.success(`Link works: ${data.eventCount} bookings found (${latencyMs} ms).`);
      } else {
        setTestResult({
          success: false,
          eventCount: 0,
          blockedNightsCount: 0,
          summary: data.summary || data.error || 'Failed to connect to calendar.',
          latencyMs,
        });
        toast.error(data.summary || data.error || 'Could not read that calendar. Check the link and try again.');
      }
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      setTestResult({
        success: false,
        eventCount: 0,
        blockedNightsCount: 0,
        summary: err?.message || 'Network error while testing feed.',
        latencyMs,
      });
      toast.error('Could not reach the link. Check your connection and try again.');
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestExistingFeed = async (feed: IcalFeedConfig) => {
    setExistingFeedTests(prev => ({
      ...prev,
      [feed.id]: { testing: true },
    }));

    const targetUrl = cleanFeedUrl(feed.url);
    const startTime = performance.now();
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const res = await fetch('/api/calendar/test-feed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ url: targetUrl }),
      });
      const data = await res.json();
      const latencyMs = Math.round(performance.now() - startTime);

      if (data.success) {
        setExistingFeedTests(prev => ({
          ...prev,
          [feed.id]: {
            testing: false,
            success: true,
            summary: data.summary,
            latencyMs,
            eventCount: data.eventCount,
            blockedNightsCount: data.blockedNightsCount,
            previewDates: data.previewDates,
          },
        }));
        toast.success(`Link works: ${data.eventCount} bookings found (${latencyMs} ms).`);
      } else {
        setExistingFeedTests(prev => ({
          ...prev,
          [feed.id]: {
            testing: false,
            success: false,
            summary: data.summary || 'Failed to connect to external feed.',
            latencyMs,
          },
        }));
        toast.error(data.summary || 'That calendar link did not work. Check it and try again.');
      }
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      setExistingFeedTests(prev => ({
        ...prev,
        [feed.id]: {
          testing: false,
          success: false,
          summary: err?.message || 'Network error while testing connection.',
          latencyMs,
        },
      }));
      toast.error('Could not reach the link. Check your connection and try again.');
    }
  };

  const handleAddFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalUrl = cleanFeedUrl(feedUrl);
    if (!finalUrl) {
      toast.error('Paste the calendar link (.ics) first.');
      return;
    }
    setIsSaving(true);
    try {
      const newFeed: IcalFeedConfig = {
        id: `feed_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: feedName.trim() || 'External Calendar',
        url: finalUrl,
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

      toast.success('Calendar added. Syncing now…');
      setShowAddForm(false);
      setFeedUrl('');
      setTestResult(null);

      // Immediately trigger live sync
      await triggerLiveSync();
    } catch (err: any) {
      console.error('Failed to add feed:', err);
      toast.error(err?.message || 'Could not save the calendar. Try again.');
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

      toast.success('Calendar removed. Syncing…');
      await triggerLiveSync();
    } catch (err: any) {
      toast.error('Could not remove the calendar. Try again.');
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
        const failedFeeds = (Array.isArray(data.feeds) ? data.feeds : []).filter((f: any) => f?.syncStatus === 'error');
        if (failedFeeds.length > 0) {
          toast.error(`${failedFeeds.length} feed(s) could not be read: ${failedFeeds.map((f: any) => f.name).join(', ')}. Their last known blocked dates were kept.`);
        } else {
          toast.success(`Synced. ${data.totalBlockedDates} dates blocked from other channels.`);
        }
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
      toast.error('Sync failed: no connection. Try again shortly.');
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
    <div className="space-y-4 text-stone-900 min-w-0">
      {/* Intro */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="tm-h2 flex items-center gap-2"><CalendarSync className="w-5 h-5 text-stone-500" /> Calendar sync</h3>
          <p className="tm-muted mt-1">Link calendars from Airbnb, Booking.com, RoomRaccoon and others so the same night is never sold twice.</p>
          {totalBlockedDates > 0 && (
            <p className="text-sm text-stone-700 mt-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span><strong>{totalBlockedDates} nights</strong> blocked from other channels</span>
            </p>
          )}
        </div>
        {totalBlockedDates > 0 && (
          <button
            type="button"
            onClick={() => triggerLiveSync()}
            disabled={isSyncingAll}
            className="tm-btn tm-btn-secondary tm-btn-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
            {isSyncingAll ? 'Syncing…' : 'Sync now'}
          </button>
        )}
      </div>

      {/* 1. Export: Travel Malawi -> other channels */}
      <section className="tm-panel space-y-3">
        <div>
          <h4 className="font-semibold text-stone-900 text-sm">1. Share your Travel Malawi calendar</h4>
          <p className="tm-muted mt-0.5">Paste this link into your other channels so our bookings block dates there too.</p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <input
            type="text"
            readOnly
            value={exportUrl}
            aria-label="Calendar export link"
            className="tm-input flex-1 min-w-0 font-mono text-xs select-all"
          />
          <button type="button" onClick={handleCopy} className="tm-btn tm-btn-secondary shrink-0">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>

        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-sm">
          <a href={googleCalUrl} target="_blank" rel="noopener noreferrer" className="tm-link inline-flex items-center gap-1">
            <CalendarIcon className="w-3.5 h-3.5" /> Add to Google Calendar <ExternalLink className="w-3 h-3" />
          </a>
          <a href={webcalUrl} className="tm-link inline-flex items-center gap-1">
            Open in Apple or phone calendar <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <details className="text-sm text-stone-600">
          <summary className="cursor-pointer font-medium text-stone-700 inline-flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-stone-500" /> Where to paste it in RoomRaccoon
          </summary>
          <p className="mt-2">
            Go to <strong>Settings → Channel Manager → External Calendars / iCal</strong>, pick the room category, choose <em>Import Calendar</em> and paste the link.
          </p>
        </details>
      </section>

      {/* 2. Import: other channels -> Travel Malawi */}
      <section className="tm-panel space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h4 className="font-semibold text-stone-900 text-sm">2. Bring in your other calendars</h4>
            <p className="tm-muted mt-0.5">Dates booked elsewhere are blocked here automatically.</p>
          </div>
          {!showAddForm && (
            <button type="button" onClick={() => setShowAddForm(true)} className="tm-btn tm-btn-secondary tm-btn-sm">
              <Plus className="w-4 h-4" /> Add calendar
            </button>
          )}
        </div>

        {currentFeeds.length === 0 ? (
          !showAddForm && <p className="tm-muted">No calendars linked yet.</p>
        ) : (
          <ul className="divide-y divide-stone-100 border-t border-stone-100">
            {currentFeeds.map((feed) => {
              const preset = CHANNEL_PRESETS[feed.platform || 'other'] || CHANNEL_PRESETS.other;
              const isSyncing = isSyncingFeedId === feed.id || isSyncingAll;
              const isSuccess = feed.syncStatus === 'success';
              const isError = feed.syncStatus === 'error';

              const feedTest = existingFeedTests[feed.id];

              return (
                <li key={feed.id} className="py-3 space-y-2 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-stone-900 truncate">{feed.name}</span>
                        <span className="tm-tag">{preset.badgeText}</span>
                        {isSuccess && (
                          <span className="tm-tag tm-tag-good">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {feed.blockedCount || 0} dates blocked
                          </span>
                        )}
                        {isError && (
                          <span className="tm-tag tm-tag-bad">
                            <AlertCircle className="w-3.5 h-3.5" /> Sync failed
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-stone-500 truncate mt-1">{feed.url}</div>
                      {feed.lastSyncedAt && (
                        <div className="text-xs text-stone-400 mt-0.5">
                          Last synced {new Date(feed.lastSyncedAt).toLocaleTimeString()} · {new Date(feed.lastSyncedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    <div className="tm-actions shrink-0">
                      <button
                        type="button"
                        onClick={() => handleTestExistingFeed(feed)}
                        disabled={feedTest?.testing || isSyncing}
                        className="tm-btn tm-btn-secondary tm-btn-sm"
                        title="Check this link still works"
                      >
                        {feedTest?.testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                        <span>{feedTest?.testing ? 'Testing…' : 'Test'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => triggerLiveSync(feed.id)}
                        disabled={isSyncing}
                        className="tm-btn tm-btn-quiet tm-btn-sm !px-2"
                        title="Sync this calendar now"
                        aria-label="Sync this calendar now"
                      >
                        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveFeed(feed.id)}
                        className="tm-btn tm-btn-quiet tm-btn-sm !px-2 hover:!text-red-700"
                        title="Remove calendar"
                        aria-label="Remove calendar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Test result for an existing feed */}
                  {feedTest && !feedTest.testing && (
                    <div className={`text-xs ${feedTest.success ? 'text-emerald-800' : 'text-red-700'}`}>
                      <p className="flex items-start gap-1.5">
                        {feedTest.success ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />}
                        <span className="break-words">
                          <strong>{feedTest.success ? 'Link works' : 'Link failed'}</strong>
                          {typeof feedTest.latencyMs === 'number' && <span className="text-stone-500"> ({feedTest.latencyMs} ms)</span>}
                          {feedTest.summary ? ` · ${feedTest.summary}` : ''}
                        </span>
                      </p>
                      {feedTest.previewDates && feedTest.previewDates.length > 0 && (
                        <p className="mt-1 text-stone-600 break-words">
                          Blocked: {feedTest.previewDates.slice(0, 8).join(', ')}
                          {feedTest.previewDates.length > 8 ? ` (+${feedTest.previewDates.length - 8} more)` : ''}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Last sync error */}
                  {isError && feed.lastError && (!feedTest || feedTest.testing) && (
                    <div className="text-xs text-red-700 flex items-start justify-between gap-2">
                      <p className="flex items-start gap-1.5 min-w-0">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                        <span className="break-all">{feed.lastError}</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => handleTestExistingFeed(feed)}
                        className="tm-link text-xs shrink-0 cursor-pointer"
                      >
                        Test again
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Add calendar form */}
        {showAddForm && (
          <form onSubmit={handleAddFeed} className="tm-divider pt-4 space-y-3">
            <h5 className="text-sm font-semibold text-stone-900">Add a calendar</h5>

            <div>
              <span className="tm-label">Where is it from?</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(CHANNEL_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handlePlatformChange(key)}
                    aria-pressed={selectedPlatform === key}
                    className={`px-3 py-2 rounded-lg text-left border text-sm transition-colors min-w-0 truncate ${
                      selectedPlatform === key
                        ? 'border-amber-700 ring-1 ring-amber-700 text-stone-900 font-medium'
                        : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-600'
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <details className="text-sm text-stone-600">
              <summary className="cursor-pointer font-medium text-stone-700">Where to find the link in {activePreset.name}</summary>
              <p className="mt-1">{activePreset.exportGuide}</p>
            </details>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="tm-label" htmlFor="ical-feed-name">Name</label>
                <input
                  id="ical-feed-name"
                  type="text"
                  required
                  value={feedName}
                  onChange={(e) => setFeedName(e.target.value)}
                  placeholder="e.g. Airbnb – lake chalet"
                  className="tm-input"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="tm-label" htmlFor="ical-feed-url">Calendar link (.ics)</label>
                <input
                  id="ical-feed-url"
                  type="url"
                  required
                  value={feedUrl}
                  onChange={(e) => {
                    setFeedUrl(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder={activePreset.urlPlaceholder}
                  className="tm-input"
                />
              </div>
            </div>

            {/* Test result */}
            {testResult && (
              <div className={`text-sm ${testResult.success ? 'text-emerald-800' : 'text-red-700'}`}>
                <p className="flex items-start gap-1.5">
                  {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                  <span className="break-words">
                    {testResult.summary}
                    {typeof testResult.latencyMs === 'number' && <span className="text-stone-500"> ({testResult.latencyMs} ms)</span>}
                  </span>
                </p>
                {testResult.previewDates && testResult.previewDates.length > 0 && (
                  <p className="mt-1 text-xs text-stone-600 break-words">
                    Upcoming blocked dates: {testResult.previewDates.slice(0, 8).join(', ')}
                    {testResult.previewDates.length > 8 ? ` (+${testResult.previewDates.length - 8} more)` : ''}
                  </p>
                )}
              </div>
            )}

            <div className="tm-actions justify-end pt-1">
              <button type="button" onClick={() => setShowAddForm(false)} className="tm-btn tm-btn-quiet">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTestFeed}
                disabled={isTesting || !feedUrl.trim()}
                className="tm-btn tm-btn-secondary"
              >
                {isTesting ? 'Testing…' : 'Test link'}
              </button>
              <button
                type="submit"
                disabled={isSaving || !feedUrl.trim()}
                className="tm-btn tm-btn-primary"
              >
                {isSaving ? 'Saving…' : 'Save and sync'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
