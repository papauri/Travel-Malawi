/**
 * Server-side RFC 5545 iCalendar (iCal / .ics) 2-Way Sync Engine.
 * Enables zero-double-booking synchronization with RoomRaccoon, Airbnb, Booking.com,
 * NightsBridge, Google Calendar, and other PMS systems.
 *
 * Firestore is reached the same way as the rest of the server: through the
 * REST API as the caller (their ID token), so the security rules decide what
 * they can read and change, and anonymously for the public .ics feeds. The
 * server has no service account in production, so the timed background sync
 * only runs where firebase-admin finds credentials; elsewhere a host's
 * dashboard and the admin "Sync all" keep calendars current.
 */

import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { PROJECT_ID, DATABASE_ID, readDoc, queryDocs, updateDocFields } from './auth';
import { bookingsEnabled } from './platformMode';

/** The Firestore operations this module needs. */
export interface CalendarStore {
  get(collection: string, id: string): Promise<Record<string, any> | null>;
  update(collection: string, id: string, fields: Record<string, unknown>): Promise<void>;
  where(collection: string, field: string, value: string | boolean, limit?: number): Promise<Record<string, any>[]>;
}

/** As the caller: the rules decide. With no token, public reads only. */
export function callerStore(token?: string): CalendarStore {
  return {
    get: (collection, id) => readDoc(collection, id, token),
    update: async (collection, id, fields) => {
      if (!token) throw new Error('Sign in to update a calendar.');
      await updateDocFields(collection, id, fields, token);
    },
    where: (collection, field, value, limit = 500) => queryDocs(collection, field, value, token, limit),
  };
}

let adminDb: Firestore | null = null;
/** Privileged access for the timed background sync; throws where there are no credentials. */
function adminStore(): CalendarStore {
  if (!adminDb) {
    const app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID });
    adminDb = getFirestore(app, DATABASE_ID);
  }
  const db = adminDb;
  return {
    get: async (collection, id) => {
      const snap = await db.collection(collection).doc(id).get();
      return snap.exists ? { id: snap.id, ...snap.data() } : null;
    },
    update: async (collection, id, fields) => {
      await db.collection(collection).doc(id).update(fields);
    },
    where: async (collection, field, value, limit = 500) =>
      (await db.collection(collection).where(field, '==', value).limit(limit).get()).docs.map(d => ({ id: d.id, ...d.data() })),
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const dateList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((d): d is string => typeof d === 'string' && DATE_RE.test(d)) : [];

/** Booking statuses that hold nights in an exported feed (booking mode only). */
const HOLDING_STATUSES = ['confirmed', 'completed', 'checked_in'];

export interface IcalFeedItem {
  id: string;
  name: string;
  url: string;
  platform?: string;
  lastSyncedAt?: number;
  syncStatus?: 'idle' | 'success' | 'error' | 'syncing';
  lastError?: string;
  blockedCount?: number;
  updatedAt?: number;
}

/** Formats a Date object or YYYY-MM-DD string into iCal date format YYYYMMDD */
function toIcalDate(dateStr: string): string {
  return dateStr.replace(/-/g, '').slice(0, 8);
}

/** Formats a timestamp into iCal UTC timestamp YYYYMMDDTHHMMSSZ */
function toIcalTimestamp(ts: number = Date.now()): string {
  const d = new Date(ts);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Adds N days to YYYY-MM-DD. UTC throughout so the server's timezone cannot shift the date. */
function addDaysToStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  const stepped = new Date(Date.UTC(y, (m || 1) - 1, d || 1) + days * 86400000);
  return stepped.toISOString().slice(0, 10);
}

/**
 * Escapes text for iCalendar RFC 5545 (commas, semicolons, backslashes, newlines)
 */
function escapeIcalText(text: string): string {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function pushEvent(lines: string[], uid: string, stamp: string, start: string, end: string, summary: string) {
  lines.push('BEGIN:VEVENT');
  lines.push(`UID:${uid}`);
  lines.push(`DTSTAMP:${stamp}`);
  lines.push(`DTSTART;VALUE=DATE:${toIcalDate(start)}`);
  lines.push(`DTEND;VALUE=DATE:${toIcalDate(end)}`);
  lines.push(`SUMMARY:${escapeIcalText(summary)}`);
  lines.push('STATUS:CONFIRMED');
  lines.push('TRANSP:OPAQUE');
  lines.push('END:VEVENT');
}

function calendarHeader(name: string): string[] {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Travel Malawi//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcalText(name)}`,
    'X-WR-TIMEZONE:Africa/Blantyre',
  ];
}

/**
 * Nights taken through Travel Malawi bookings, from the public booking_slots
 * mirror (it carries dates and status only, no guest details). Booking mode only.
 */
async function bookedRanges(store: CalendarStore, field: 'roomTypeId' | 'hotelId', id: string) {
  if (!(await bookingsEnabled())) return [];
  const slots = await store.where('booking_slots', field, id, 1000);
  return slots
    .filter(s => HOLDING_STATUSES.includes(s.status) && DATE_RE.test(s.checkIn) && DATE_RE.test(s.checkOut))
    .map(s => ({ id: String(s.id), checkIn: s.checkIn as string, checkOut: s.checkOut as string }));
}

/**
 * Generates an RFC 5545 compliant .ics calendar feed for a specific room.
 * External platforms (RoomRaccoon, Airbnb, Booking.com, Google Cal) subscribe to this.
 * It carries Travel Malawi bookings (booking mode) and the nights the host
 * blocked here; dates imported from other calendars are not sent back out.
 */
export async function generateRoomIcalFeed(
  roomId: string,
  token?: string,
  _origin?: string,
  store: CalendarStore = callerStore()
): Promise<{ ics: string; roomName: string; hotelName: string } | null> {
  const room = await store.get('room_types', roomId);
  if (!room) return null;

  // If the room has a secret token configured, the feed is only served with it.
  if (room.icalExportToken && room.icalExportToken !== token) return null;

  const hotel = typeof room.hotelId === 'string' ? await store.get('hotels', room.hotelId) : null;
  const hotelName = (hotel?.name as string) || 'Malawi Lodge';
  // A property-wide closure closes every room, so the room feed carries it too.
  const hotelBlocks = dateList(hotel?.blockedDates);
  const roomName = (room.name as string) || 'Room';

  const lines = calendarHeader(`${hotelName} - ${roomName} (Travel Malawi)`);
  const stamp = toIcalTimestamp();

  for (const b of await bookedRanges(store, 'roomTypeId', roomId)) {
    pushEvent(lines, `tm-booking-${b.id}@travelmalawi.app`, stamp, b.checkIn, b.checkOut, 'Reserved - Travel Malawi');
  }

  const blocks = [...new Set([...dateList(room.blockedDates), ...hotelBlocks])].sort();
  for (const d of blocks) {
    pushEvent(lines, `tm-blocked-${roomId}-${d}@travelmalawi.app`, stamp, d, addDaysToStr(d, 1), `Unavailable - Travel Malawi (${roomName})`);
  }

  lines.push('END:VCALENDAR');
  return { ics: lines.join('\r\n'), roomName, hotelName };
}

/**
 * Generates an RFC 5545 compliant .ics calendar feed for an entire property:
 * bookings (booking mode), property-wide closures, and nights on which every
 * room type is blocked by the host (for a whole-house listing, its blocks).
 */
export async function generateHotelIcalFeed(
  hotelId: string,
  token?: string,
  _origin?: string,
  store: CalendarStore = callerStore()
): Promise<{ ics: string; hotelName: string } | null> {
  const hotel = await store.get('hotels', hotelId);
  if (!hotel) return null;

  if (hotel.icalExportToken && hotel.icalExportToken !== token) return null;

  const hotelName = (hotel.name as string) || 'Malawi Stay';
  const lines = calendarHeader(`${hotelName} (Travel Malawi)`);
  const stamp = toIcalTimestamp();

  for (const b of await bookedRanges(store, 'hotelId', hotelId)) {
    pushEvent(lines, `tm-booking-${b.id}@travelmalawi.app`, stamp, b.checkIn, b.checkOut, 'Reserved - Travel Malawi');
  }

  const rooms = (await store.where('room_types', 'hotelId', hotelId, 200)).filter(r => (Number(r.quantity) || 0) > 0);
  let allRoomsBlocked: Set<string> | null = null;
  for (const r of rooms) {
    const dates = new Set(dateList(r.blockedDates));
    allRoomsBlocked = allRoomsBlocked === null ? dates : new Set([...allRoomsBlocked].filter(d => dates.has(d)));
  }
  const blocks = [...new Set([...dateList(hotel.blockedDates), ...(allRoomsBlocked ?? [])])].sort();
  for (const d of blocks) {
    pushEvent(lines, `tm-blocked-${hotelId}-${d}@travelmalawi.app`, stamp, d, addDaysToStr(d, 1), 'Unavailable - Travel Malawi');
  }

  lines.push('END:VCALENDAR');
  return { ics: lines.join('\r\n'), hotelName };
}

/**
 * Parses an iCalendar date string into 'YYYY-MM-DD'.
 */
function parseIcalDate(val: string): string | null {
  if (!val) return null;
  const clean = val.replace(/^[^:]*:/, '').trim();
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(clean);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

/**
 * Parses raw iCalendar text into a list of blocked date strings ('YYYY-MM-DD').
 * Accurately unfolds lines, extracts DTSTART & DTEND, and expands multi-day reservations.
 */
export function parseIcalToBlockedDates(icsContent: string): {
  eventCount: number;
  blockedDates: string[];
  events: Array<{ start: string; end: string; summary: string }>;
} {
  // Unfold lines: RFC 5545 specifies lines starting with space/tab continue the previous line
  const unfolded = icsContent.replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  const datesSet = new Set<string>();
  const parsedEvents: Array<{ start: string; end: string; summary: string }> = [];

  let inEvent = false;
  let dtstart = '';
  let dtend = '';
  let summary = '';
  let status = '';

  const cutoffPast = addDaysToStr(new Date().toISOString().slice(0, 10), -30);
  const cutoffFuture = addDaysToStr(new Date().toISOString().slice(0, 10), 730);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      dtstart = '';
      dtend = '';
      summary = '';
      status = '';
    } else if (line === 'END:VEVENT') {
      if (inEvent && dtstart && status !== 'CANCELLED') {
        const startStr = parseIcalDate(dtstart);
        const endStr = dtend ? parseIcalDate(dtend) : startStr;

        // Judged by the end date so a long stay that began over 30 days ago
        // still blocks the nights it has left.
        if (startStr && (endStr || startStr) >= cutoffPast && startStr <= cutoffFuture) {
          parsedEvents.push({
            start: startStr,
            end: endStr || startStr,
            summary: summary || 'External Booking',
          });

          if (!endStr || endStr <= startStr) {
            datesSet.add(startStr);
          } else {
            // In iCalendar, DTEND is exclusive for all-day events (e.g. Nov 1 to Nov 4 means Nov 1, 2, 3 booked)
            let cur = startStr;
            let guard = 0;
            while (cur < endStr && guard++ < 365) {
              datesSet.add(cur);
              cur = addDaysToStr(cur, 1);
            }
          }
        }
      }
      inEvent = false;
    } else if (inEvent) {
      if (line.startsWith('DTSTART')) {
        dtstart = line;
      } else if (line.startsWith('DTEND')) {
        dtend = line;
      } else if (line.startsWith('SUMMARY')) {
        summary = line.replace(/^SUMMARY[^:]*:/, '').trim();
      } else if (line.startsWith('STATUS:')) {
        status = line.substring(7).trim().toUpperCase();
      }
    }
  }

  const sortedDates = Array.from(datesSet).sort();
  return {
    eventCount: parsedEvents.length,
    blockedDates: sortedDates,
    events: parsedEvents,
  };
}

const MAX_ICAL_BYTES = 5 * 1024 * 1024;

/** True for loopback, private, link-local (cloud metadata) and other non-public addresses. */
function isPrivateAddress(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^::ffff:/, '');
  if (isIP(v) === 4) {
    const [a, b] = v.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
}

/** Rejects a URL whose host is, or resolves to, a non-public address. */
async function assertPublicHost(url: string): Promise<void> {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw new Error('Feed URL must point to a public calendar address.');
  }
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map(a => a.address);
  if (!addresses.length) throw new Error(`Could not resolve calendar host ${host}.`);
  if (addresses.some(isPrivateAddress)) throw new Error('Feed URL must point to a public calendar address.');
}

/**
 * Fetches an external .ics URL with safety guards (public hosts only, timeout,
 * size cap, status check, user-agent).
 */
export async function fetchExternalIcal(url: string): Promise<string> {
  let cleanUrl = (url || '').trim();
  // Support webcal:// (commonly exported by Apple Calendar, Google Calendar, and Airbnb)
  if (cleanUrl.toLowerCase().startsWith('webcal://')) {
    cleanUrl = 'https://' + cleanUrl.slice(9);
  }
  if (!/^https?:\/\//i.test(cleanUrl)) {
    throw new Error('Invalid URL format. Feed URL must begin with http://, https://, or webcal://');
  }

  // Redirects are followed by hand so every hop is checked against private
  // addresses (a feed URL must never reach the server's own network).
  let response: Response | null = null;
  for (let hop = 0; hop < 4; hop++) {
    await assertPublicHost(cleanUrl);
    response = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'TravelMalawi-ChannelSync/1.0 (+https://travelmalawi.app; hospitality calendar synchronization)',
        'Accept': 'text/calendar, application/octet-stream, text/plain, */*',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(12000), // 12 second timeout
    });
    const location = response.status >= 300 && response.status < 400 ? response.headers.get('location') : null;
    if (!location) break;
    cleanUrl = new URL(location, cleanUrl).toString();
    if (!/^https?:\/\//i.test(cleanUrl)) throw new Error('External calendar redirected to an unsupported address.');
    response = null;
  }
  if (!response) throw new Error('External calendar redirected too many times.');

  if (!response.ok) {
    throw new Error(`External calendar returned HTTP status ${response.status} (${response.statusText})`);
  }

  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > MAX_ICAL_BYTES) throw new Error('External calendar is too large to import.');
  const text = await response.text();
  if (text.length > MAX_ICAL_BYTES) throw new Error('External calendar is too large to import.');
  if (!text.includes('BEGIN:VCALENDAR')) {
    throw new Error('Received content is not a valid iCalendar (.ics) feed (missing BEGIN:VCALENDAR).');
  }

  return text;
}

/**
 * Tests an external calendar URL and returns a preview of parsed events.
 */
export async function testIcalFeedUrl(url: string): Promise<{
  success: boolean;
  eventCount: number;
  blockedNightsCount: number;
  previewDates: string[];
  summary: string;
}> {
  try {
    const rawIcs = await fetchExternalIcal(url);
    const parsed = parseIcalToBlockedDates(rawIcs);
    return {
      success: true,
      eventCount: parsed.eventCount,
      blockedNightsCount: parsed.blockedDates.length,
      previewDates: parsed.blockedDates.slice(0, 10),
      summary: `Found ${parsed.eventCount} reservations / blocks (${parsed.blockedDates.length} total blocked nights).`,
    };
  } catch (err: any) {
    return {
      success: false,
      eventCount: 0,
      blockedNightsCount: 0,
      previewDates: [],
      summary: err.message || 'Failed to fetch or parse external calendar.',
    };
  }
}

export interface SyncResult {
  success: boolean;
  totalBlockedDates: number;
  feeds: IcalFeedItem[];
  combinedBlocked: string[];
}

/**
 * Reads every feed on a room or property and stores the nights they block in
 * `icalBlockedDates`, with each feed's status. A feed that cannot be read this
 * time keeps the nights it blocked last time; dropping them would show nights
 * taken elsewhere as open.
 */
async function syncTarget(store: CalendarStore, collection: 'room_types' | 'hotels', id: string, data: Record<string, any>): Promise<SyncResult> {
  const feeds: IcalFeedItem[] = Array.isArray(data.icalSyncUrls) ? [...data.icalSyncUrls] : [];

  if (feeds.length === 0) {
    if (dateList(data.icalBlockedDates).length > 0) await store.update(collection, id, { icalBlockedDates: [] });
    return { success: true, totalBlockedDates: 0, feeds: [], combinedBlocked: [] };
  }

  const allBlocked = new Set<string>();
  let feedFailed = false;
  const now = Date.now();

  for (let i = 0; i < feeds.length; i++) {
    const feed = feeds[i];
    try {
      const parsed = parseIcalToBlockedDates(await fetchExternalIcal(feed.url));
      for (const d of parsed.blockedDates) allBlocked.add(d);
      feeds[i] = { ...feed, lastSyncedAt: now, syncStatus: 'success', lastError: '', blockedCount: parsed.blockedDates.length, updatedAt: now };
    } catch (err: any) {
      console.warn(`[iCal Sync Error] ${collection}/${id} feed ${feed.name}:`, err?.message);
      feedFailed = true;
      feeds[i] = { ...feed, lastSyncedAt: now, syncStatus: 'error', lastError: err?.message || 'Sync failed', updatedAt: now };
    }
  }

  if (feedFailed) for (const d of dateList(data.icalBlockedDates)) allBlocked.add(d);

  const combinedBlocked = Array.from(allBlocked).sort();
  await store.update(collection, id, { icalSyncUrls: feeds, icalBlockedDates: combinedBlocked });
  return { success: true, totalBlockedDates: combinedBlocked.length, feeds, combinedBlocked };
}

/**
 * Executes a sync for all configured iCal feeds on a room.
 * Updates room.icalBlockedDates and feed statuses in Firestore.
 */
export async function syncRoomIcal(roomId: string, hotelId: string, store: CalendarStore): Promise<SyncResult> {
  const room = await store.get('room_types', roomId);
  // The caller was authorised for `hotelId`; the room must belong to it.
  if (!room || (hotelId && room.hotelId !== hotelId)) {
    throw new Error(`Room with ID ${roomId} not found.`);
  }
  return syncTarget(store, 'room_types', roomId, room);
}

/**
 * Executes a sync for all configured iCal feeds on an entire property.
 */
export async function syncHotelIcal(hotelId: string, store: CalendarStore): Promise<SyncResult> {
  const hotel = await store.get('hotels', hotelId);
  if (!hotel) throw new Error(`Hotel with ID ${hotelId} not found.`);
  return syncTarget(store, 'hotels', hotelId, hotel);
}

/**
 * Calendar export and sync run for every property while bookings are on; in
 * directory mode only for properties an admin switched the availability
 * calendar on for (`availabilityCalendarEnabled`).
 */
export async function hotelCalendarEnabled(hotelId: string, store: CalendarStore = callerStore()): Promise<boolean> {
  if (await bookingsEnabled()) return true;
  if (!hotelId) return false;
  const hotel = await store.get('hotels', hotelId);
  return hotel?.availabilityCalendarEnabled === true;
}

/** As `hotelCalendarEnabled`, for the property a room type belongs to. */
export async function roomCalendarEnabled(roomId: string, store: CalendarStore = callerStore()): Promise<boolean> {
  if (await bookingsEnabled()) return true;
  const room = await store.get('room_types', roomId);
  return typeof room?.hotelId === 'string' && hotelCalendarEnabled(room.hotelId, store);
}

let backgroundUnavailable = false;

/**
 * Syncs every property with calendar feeds: all live properties while
 * bookings are on, and in directory mode only those with the availability
 * calendar switched on (other feeds are kept for when bookings return).
 * With a store (an admin's token) it runs as that admin; without one it is
 * the timed background pass, which needs server credentials and stops
 * quietly where there are none.
 */
export async function syncAllActiveFeeds(store?: CalendarStore): Promise<{
  roomsSynced: number;
  hotelsSynced: number;
  totalFeeds: number;
}> {
  const totals = { roomsSynced: 0, hotelsSynced: 0, totalFeeds: 0 };
  const background = !store;
  if (background && backgroundUnavailable) return totals;

  let s: CalendarStore;
  let hotels: Record<string, any>[];
  try {
    s = store ?? adminStore();
    hotels = (await bookingsEnabled())
      ? await s.where('hotels', 'status', 'approved', 1000)
      : await s.where('hotels', 'availabilityCalendarEnabled', true, 1000);
  } catch (err: any) {
    if (background) {
      backgroundUnavailable = true;
      console.warn(`[iCal] Background sync is off (no server Firestore access: ${err?.message || err}). Hosts' dashboards and the admin "Sync all" still sync calendars.`);
      return totals;
    }
    throw err;
  }

  for (const hotel of hotels) {
    if (Array.isArray(hotel.icalSyncUrls) && hotel.icalSyncUrls.length > 0) {
      totals.totalFeeds += hotel.icalSyncUrls.length;
      try {
        await syncTarget(s, 'hotels', hotel.id, hotel);
        totals.hotelsSynced++;
      } catch (err) {
        console.error(`Failed to sync property ${hotel.id}:`, err);
      }
    }
    let rooms: Record<string, any>[] = [];
    try {
      rooms = await s.where('room_types', 'hotelId', hotel.id, 200);
    } catch (err) {
      console.error(`Failed to list rooms of ${hotel.id}:`, err);
    }
    for (const room of rooms) {
      if (!Array.isArray(room.icalSyncUrls) || room.icalSyncUrls.length === 0) continue;
      totals.totalFeeds += room.icalSyncUrls.length;
      try {
        await syncTarget(s, 'room_types', room.id, room);
        totals.roomsSynced++;
      } catch (err) {
        console.error(`Failed to sync room ${room.id}:`, err);
      }
    }
  }

  return totals;
}
