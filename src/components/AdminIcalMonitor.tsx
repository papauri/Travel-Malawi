import React, { useState } from 'react';
import { Hotel, RoomType, IcalFeedConfig } from '../types';
import { 
  CalendarSync, RefreshCw, CheckCircle2, AlertCircle, ExternalLink, 
  Copy, Check, Search, ShieldCheck, HelpCircle, Activity, Filter, 
  ArrowRight, Radio, Clock, Eye, Layers, Settings, Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { getRoomIcalExportUrl, getHotelIcalExportUrl, CHANNEL_PRESETS } from '../lib/ical';
import { auth } from '../lib/firebase';
import Modal from './Modal';
import IcalSyncManager from './IcalSyncManager';

interface Props {
  hotels: Hotel[];
  rooms: RoomType[];
  onHotelsUpdated?: (hotels: Hotel[]) => void;
  onRoomsUpdated?: (rooms: RoomType[]) => void;
}

interface FeedRow {
  feed: IcalFeedConfig;
  hotel: Hotel;
  room?: RoomType;
  type: 'room' | 'hotel';
}

export default function AdminIcalMonitor({
  hotels,
  rooms,
  onHotelsUpdated,
  onRoomsUpdated,
}: Props) {
  const { user } = useAuth();
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncingFeedId, setSyncingFeedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Feed tester state
  const [testUrl, setTestUrl] = useState('');
  const [isTestingUrl, setIsTestingUrl] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    eventCount: number;
    blockedNightsCount: number;
    summary: string;
  } | null>(null);

  // Modal for editing/managing feeds for a specific room or hotel
  const [selectedTarget, setSelectedTarget] = useState<{
    hotel: Hotel;
    room?: RoomType;
  } | null>(null);

  // Compile all connected feeds across hotels and rooms
  const allFeeds: FeedRow[] = [];

  hotels.forEach(hotel => {
    if (hotel.icalSyncUrls && hotel.icalSyncUrls.length > 0) {
      hotel.icalSyncUrls.forEach(feed => {
        allFeeds.push({
          feed,
          hotel,
          type: 'hotel',
        });
      });
    }
  });

  rooms.forEach(room => {
    const parentHotel = hotels.find(h => h.id === room.hotelId);
    if (parentHotel && room.icalSyncUrls && room.icalSyncUrls.length > 0) {
      room.icalSyncUrls.forEach(feed => {
        allFeeds.push({
          feed,
          hotel: parentHotel,
          room,
          type: 'room',
        });
      });
    }
  });

  const filteredFeeds = allFeeds.filter(({ feed, hotel, room }) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      !searchTerm ||
      feed.name.toLowerCase().includes(term) ||
      feed.url.toLowerCase().includes(term) ||
      hotel.name.toLowerCase().includes(term) ||
      (room && room.name.toLowerCase().includes(term));

    const matchesPlatform = 
      filterPlatform === 'all' || 
      feed.platform?.toLowerCase() === filterPlatform.toLowerCase();

    const matchesStatus = 
      filterStatus === 'all' || 
      feed.syncStatus === filterStatus;

    return matchesSearch && matchesPlatform && matchesStatus;
  });

  // Calculate statistics
  const totalFeeds = allFeeds.length;
  const healthyFeeds = allFeeds.filter(f => f.feed.syncStatus === 'success').length;
  const errorFeeds = allFeeds.filter(f => f.feed.syncStatus === 'error').length;
  const uniquePropertiesWithSync = new Set(allFeeds.map(f => f.hotel.id)).size;

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    toast.success('Feed URL copied to clipboard');
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const res = await fetch('/api/calendar/sync-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        throw new Error(`Sync failed with HTTP status ${res.status}`);
      }

      const data = await res.json();
      toast.success(
        `Global sync complete! ${data.syncedRooms || 0} rooms and ${data.syncedHotels || 0} properties synchronized.`,
        { duration: 5000 }
      );
    } catch (err: any) {
      console.error('Global iCal sync error:', err);
      toast.error(err?.message || 'Failed to trigger global sync.');
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleSyncSingle = async (row: FeedRow) => {
    setSyncingFeedId(row.feed.id);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      if (row.type === 'room' && row.room) {
        const res = await fetch('/api/calendar/sync-room', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            roomId: row.room.id,
            hotelId: row.hotel.id,
          }),
        });
        const data = await res.json();
        if (data.success) {
          toast.success(`Synchronized ${row.room.name}: ${data.totalBlockedNights} nights blocked.`);
        } else {
          toast.error(data.error || 'Sync returned error');
        }
      } else {
        const res = await fetch('/api/calendar/sync-hotel', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            hotelId: row.hotel.id,
          }),
        });
        const data = await res.json();
        if (data.success) {
          toast.success(`Synchronized ${row.hotel.name}: ${data.totalBlockedNights} nights blocked.`);
        } else {
          toast.error(data.error || 'Sync returned error');
        }
      }
    } catch (err: any) {
      console.error('Single sync error:', err);
      toast.error(err?.message || 'Failed to trigger feed sync.');
    } finally {
      setSyncingFeedId(null);
    }
  };

  const handleTestFeedUrl = async () => {
    if (!testUrl.trim()) {
      toast.error('Please enter an iCal feed URL first.');
      return;
    }
    setIsTestingUrl(true);
    setTestResult(null);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const res = await fetch('/api/calendar/test-feed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ url: testUrl.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setTestResult({
          success: false,
          eventCount: 0,
          blockedNightsCount: 0,
          summary: data.error || 'Failed to fetch or parse this calendar feed.',
        });
        toast.error('Feed test failed.');
      } else {
        setTestResult({
          success: true,
          eventCount: data.eventCount || 0,
          blockedNightsCount: data.blockedNightsCount || 0,
          summary: data.summary || `Found ${data.eventCount} booking events.`,
        });
        toast.success('Feed verified successfully!');
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        eventCount: 0,
        blockedNightsCount: 0,
        summary: err?.message || 'Network request failed while testing feed.',
      });
      toast.error('Feed test error.');
    } finally {
      setIsTestingUrl(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Global Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="tm-h1">
              iCal &amp; Channel Sync
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Active
            </span>
          </div>
          <p className="text-stone-500 text-xs sm:text-sm mt-0.5">
            Two-way calendar sync with RoomRaccoon, Airbnb, Booking.com, NightsBridge, and Google Calendar.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSyncAll}
          disabled={isSyncingAll}
          className="tm-btn tm-btn-primary self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
          <span>{isSyncingAll ? 'Syncing All Feeds…' : 'Sync All Feeds'}</span>
        </button>
      </div>

      {/* KPI Quick Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl p-4 border border-stone-200">
          <div className="text-xs font-medium text-stone-500">Connected Feeds</div>
          <div className="text-2xl font-bold font-serif text-stone-900 mt-1 tabular-nums">{totalFeeds}</div>
          <div className="text-[11px] text-stone-400 mt-0.5">Active iCal links</div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-stone-200">
          <div className="text-xs font-medium text-stone-500">Synced Properties</div>
          <div className="text-2xl font-bold font-serif text-stone-900 mt-1 tabular-nums">{uniquePropertiesWithSync}</div>
          <div className="text-[11px] text-stone-400 mt-0.5">Out of {hotels.length} properties</div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-stone-200">
          <div className="text-xs font-medium text-stone-500">Healthy Feeds</div>
          <div className="text-2xl font-bold font-serif text-emerald-700 mt-1 tabular-nums">{healthyFeeds}</div>
          <div className="text-[11px] text-stone-400 mt-0.5">Syncing normally</div>
        </div>

        <div className={`rounded-xl p-4 border ${errorFeeds > 0 ? 'bg-red-50/60 border-red-200' : 'bg-white border-stone-200'}`}>
          <div className={`text-xs font-medium ${errorFeeds > 0 ? 'text-red-700' : 'text-stone-500'}`}>
            Sync Errors
          </div>
          <div className={`text-2xl font-bold font-serif mt-1 tabular-nums ${errorFeeds > 0 ? 'text-red-800' : 'text-stone-900'}`}>
            {errorFeeds}
          </div>
          <div className={`text-[11px] mt-0.5 ${errorFeeds > 0 ? 'text-red-600' : 'text-stone-400'}`}>
            {errorFeeds > 0 ? 'Needs attention' : 'No sync errors'}
          </div>
        </div>
      </div>

      {/* External Feed Tester */}
      <div className="bg-white border border-stone-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-stone-900 mb-1">
          Test External iCal Feed URL
        </h3>
        <p className="text-xs text-stone-500 mb-3">
          Paste an external `.ics` URL to verify calendar reachability and preview blocked dates before attaching it to a room.
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={testUrl}
            onChange={(e) => setTestUrl(e.target.value)}
            placeholder="https://app.roomraccoon.com/export/calendar/...ics"
            className="tm-input"
          />
          <button
            type="button"
            onClick={handleTestFeedUrl}
            disabled={isTestingUrl}
            className="tm-btn tm-btn-primary shrink-0"
          >
            {isTestingUrl ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Testing…</span>
              </>
            ) : (
              <span>Test Feed</span>
            )}
          </button>
        </div>

        {testResult && (
          <div className={`mt-3 p-3.5 rounded-xl border text-xs ${
            testResult.success 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
              : 'bg-red-50 border-red-200 text-red-900'
          }`}>
            <div className="flex items-start gap-2">
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-700 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{testResult.summary}</div>
                {testResult.success && (
                  <div className="mt-1 text-[11px] text-emerald-800">
                    Extracted {testResult.eventCount} booking events totaling {testResult.blockedNightsCount} blocked night(s).
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Connected Feeds Table & Filter Controls */}
      <div className="bg-white border border-stone-200/90 rounded-xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-stone-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div>
            <h3 className="font-serif font-bold text-base text-stone-900">
              Active Channel Connections ({filteredFeeds.length})
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Live status of external calendars synchronizing into Travel Malawi
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search feed, lodge, or room…"
                className="pl-8 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg w-full sm:w-48 focus:outline-none focus:border-stone-900"
              />
            </div>

            <select
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value)}
              className="py-1.5 px-2.5 text-xs bg-stone-50 border border-stone-200 rounded-lg text-stone-700 focus:outline-none focus:border-stone-900"
            >
              <option value="all">All Channels</option>
              <option value="roomraccoon">RoomRaccoon</option>
              <option value="airbnb">Airbnb</option>
              <option value="booking">Booking.com</option>
              <option value="nightsbridge">NightsBridge</option>
              <option value="google">Google Calendar</option>
              <option value="custom">Other / Custom</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="py-1.5 px-2.5 text-xs bg-stone-50 border border-stone-200 rounded-lg text-stone-700 focus:outline-none focus:border-stone-900"
            >
              <option value="all">All Statuses</option>
              <option value="success">Healthy (Success)</option>
              <option value="error">Errors</option>
              <option value="idle">Idle / Pending</option>
            </select>
          </div>
        </div>

        {filteredFeeds.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-stone-500">
            <CalendarSync className="w-8 h-8 text-stone-400 mx-auto mb-2" />
            <p className="font-medium text-sm">No connected channel feeds match the criteria.</p>
            <p className="text-xs text-stone-400 mt-1 max-w-md mx-auto">
              Property managers can connect their RoomRaccoon, Airbnb, or PMS iCal links inside their Host Dashboard under Rooms &amp; Rates.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop & Laptop Table (md+) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold">
                    <th className="py-3 px-4">Property &amp; Unit</th>
                    <th className="py-3 px-3 whitespace-nowrap">Platform</th>
                    <th className="py-3 px-3">Feed Name</th>
                    <th className="py-3 px-3 whitespace-nowrap">Last Synced</th>
                    <th className="py-3 px-3 whitespace-nowrap">Status</th>
                    <th className="py-3 px-3 whitespace-nowrap">Blocked Nights</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-stone-700">
                  {filteredFeeds.map((row, idx) => {
                    const platformPreset = row.feed.platform
                      ? CHANNEL_PRESETS[row.feed.platform]
                      : undefined;

                    const isRowSyncing = syncingFeedId === row.feed.id;

                    const exportLink = row.type === 'room' && row.room
                      ? getRoomIcalExportUrl(row.room.id!, row.room.icalExportToken)
                      : getHotelIcalExportUrl(row.hotel.id!, row.hotel.icalExportToken);

                    return (
                      <tr key={`feed-row-${row.feed.id}-${idx}`} className="hover:bg-stone-50/80 transition">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-stone-900">
                            {row.hotel.name}
                          </div>
                          <div className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5">
                            {row.type === 'room' && row.room ? (
                              <span>Chalet: {row.room.name}</span>
                            ) : (
                              <span>Entire Property</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-stone-100 text-stone-800 border border-stone-200 whitespace-nowrap">
                            {platformPreset?.name || row.feed.platform || 'iCal'}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-medium text-stone-800 max-w-[160px] truncate" title={row.feed.name}>
                            {row.feed.name}
                          </div>
                          <div className="text-[11px] text-stone-400 max-w-[160px] truncate" title={row.feed.url}>
                            {row.feed.url}
                          </div>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap text-stone-500">
                          {row.feed.lastSyncedAt ? (
                            <span>{new Date(row.feed.lastSyncedAt).toLocaleString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}</span>
                          ) : (
                            <span className="text-stone-400">Never</span>
                          )}
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          {row.feed.syncStatus === 'success' && (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px] whitespace-nowrap">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Healthy
                            </span>
                          )}
                          {row.feed.syncStatus === 'error' && (
                            <span
                              className="inline-flex items-center gap-1 text-red-600 font-semibold text-[11px] cursor-help whitespace-nowrap"
                              title={row.feed.lastError || 'Feed connection error'}
                            >
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Error
                            </span>
                          )}
                          {(!row.feed.syncStatus || row.feed.syncStatus === 'idle') && (
                            <span className="inline-flex items-center gap-1 text-stone-500 text-[11px] whitespace-nowrap">
                              <Clock className="w-3.5 h-3.5 shrink-0" /> Idle
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 font-semibold text-stone-900 whitespace-nowrap">
                          {row.feed.blockedCount ?? 0} nights
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleSyncSingle(row)}
                              disabled={isRowSyncing}
                              className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-700 transition cursor-pointer shrink-0"
                              title="Sync feed right now"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isRowSyncing ? 'animate-spin' : ''}`} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCopy(exportLink)}
                              className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-700 transition cursor-pointer shrink-0"
                              title="Copy Travel Malawi .ics export link"
                            >
                              {copiedUrl === exportLink ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedTarget({ hotel: row.hotel, room: row.room })}
                              className="tm-btn tm-btn-primary tm-btn-sm shrink-0"
                            >
                              Configure
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Card List (<md) */}
            <div className="md:hidden divide-y divide-stone-100">
              {filteredFeeds.map((row, idx) => {
                const platformPreset = row.feed.platform
                  ? CHANNEL_PRESETS[row.feed.platform]
                  : undefined;
                const isRowSyncing = syncingFeedId === row.feed.id;
                const exportLink = row.type === 'room' && row.room
                  ? getRoomIcalExportUrl(row.room.id!, row.room.icalExportToken)
                  : getHotelIcalExportUrl(row.hotel.id!, row.hotel.icalExportToken);

                return (
                  <div key={`feed-card-${row.feed.id}-${idx}`} className="p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-stone-900 truncate">{row.hotel.name}</h4>
                        <p className="text-xs text-stone-500 truncate mt-0.5">
                          {row.type === 'room' && row.room ? `Chalet: ${row.room.name}` : 'Entire Property'}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-stone-100 text-stone-800 border border-stone-200 whitespace-nowrap shrink-0">
                        {platformPreset?.name || row.feed.platform || 'iCal'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-stone-50/80 border border-stone-200/60 rounded-lg px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <span className="text-[10px] font-semibold text-stone-400 block">Feed &amp; Blocked</span>
                        <div className="font-medium text-stone-900 truncate mt-0.5">{row.feed.name}</div>
                        <div className="text-[11px] text-stone-500 mt-0.5">{row.feed.blockedCount ?? 0} nights blocked</div>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-semibold text-stone-400 block">Sync Status</span>
                        <div className="mt-0.5">
                          {row.feed.syncStatus === 'success' && (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Healthy
                            </span>
                          )}
                          {row.feed.syncStatus === 'error' && (
                            <span className="inline-flex items-center gap-1 text-red-600 font-semibold text-[11px]">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Error
                            </span>
                          )}
                          {(!row.feed.syncStatus || row.feed.syncStatus === 'idle') && (
                            <span className="inline-flex items-center gap-1 text-stone-500 text-[11px]">
                              <Clock className="w-3.5 h-3.5 shrink-0" /> Idle
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-stone-400 truncate mt-0.5">
                          {row.feed.lastSyncedAt
                            ? new Date(row.feed.lastSyncedAt).toLocaleString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Never synced'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleSyncSingle(row)}
                        disabled={isRowSyncing}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium transition cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRowSyncing ? 'animate-spin' : ''}`} />
                        <span>Sync</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopy(exportLink)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium transition cursor-pointer"
                      >
                        {copiedUrl === exportLink ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>Copy .ics</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedTarget({ hotel: row.hotel, room: row.room })}
                        className="tm-btn tm-btn-primary tm-btn-sm"
                      >
                        Configure
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Modal for managing feeds when clicked from table */}
      <Modal
        open={Boolean(selectedTarget)}
        onClose={() => setSelectedTarget(null)}
        title={`Calendar Synchronization — ${selectedTarget?.room ? selectedTarget.room.name : selectedTarget?.hotel.name}`}
        description="Configure 2-way sync feeds with RoomRaccoon, Airbnb, Booking.com, NightsBridge, and Google Calendar."
        size="3xl"
      >
        {selectedTarget && (
          <IcalSyncManager
            hotel={selectedTarget.hotel}
            room={selectedTarget.room}
            onRoomUpdated={(updated) => {
              if (onRoomsUpdated) {
                onRoomsUpdated(rooms.map(r => r.id === updated.id ? updated : r));
              }
            }}
            onHotelUpdated={(updated) => {
              if (onHotelsUpdated) {
                onHotelsUpdated(hotels.map(h => h.id === updated.id ? updated : h));
              }
            }}
            onClose={() => setSelectedTarget(null)}
          />
        )}
      </Modal>
    </div>
  );
}
