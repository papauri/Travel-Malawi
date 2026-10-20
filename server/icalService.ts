/**
 * Server-side RFC 5545 iCalendar (iCal / .ics) 2-Way Sync Engine.
 * Enables zero-double-booking synchronization with RoomRaccoon, Airbnb, Booking.com,
 * NightsBridge, Google Calendar, and other PMS systems.
 */

import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { PROJECT_ID, DATABASE_ID } from './auth';
import { bookingsEnabled } from './platformMode';

let firestoreInstance: Firestore | null = null;
function getDb(): Firestore {
  if (!firestoreInstance) {
    const app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID });
    firestoreInstance = getFirestore(app, DATABASE_ID);
  }
  return firestoreInstance;
}

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

/**
 * Generates an RFC 5545 compliant .ics calendar feed for a specific room.
 * External platforms (RoomRaccoon, Airbnb, Booking.com, Google Cal) subscribe to this.
 */
export async function generateRoomIcalFeed(
  roomId: string,
  token?: string,
  origin: string = 'https://travelmalawi.app'
): Promise<{ ics: string; roomName: string; hotelName: string } | null> {
  const db = getDb();
  const roomSnap = await db.collection('room_types').doc(roomId).get();
  if (!roomSnap.exists) return null;
  const room = roomSnap.data() || {};

  // If the room has a secret token configured, the feed is only served with it.
  if (room.icalExportToken && room.icalExportToken !== token) return null;

  const hotelId = room.hotelId;
  let hotelName = 'Malawi Lodge';
  let hotelBlocks: string[] = [];
  if (hotelId) {
    const hotelSnap = await db.collection('hotels').doc(hotelId).get();
    if (hotelSnap.exists) {
      hotelName = (hotelSnap.data()?.name as string) || hotelName;
      // A property-wide closure closes every room, so the room feed carries it too.
      const hb = hotelSnap.data()?.blockedDates;
      if (Array.isArray(hb)) hotelBlocks = hb.filter((d: unknown): d is string => typeof d === 'string');
    }
  }

  const roomName = (room.name as string) || 'Chalet';

  // Fetch confirmed bookings for this room
  const bookingsSnap = await db
    .collection('bookings')
    .where('roomTypeId', '==', roomId)
    .where('status', 'in', ['confirmed', 'completed', 'checked_in'])
    .get();

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Travel Malawi//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcalText(`${hotelName} - ${roomName} (Travel Malawi)`)}`,
    'X-WR-TIMEZONE:Africa/Blantyre',
  ];

  const nowStamp = toIcalTimestamp();

  // Add bookings
  for (const doc of bookingsSnap.docs) {
    const b = doc.data();
    if (!b.checkIn || !b.checkOut) continue;
    const uid = `tm-booking-${doc.id}@travelmalawi.app`;
    const dtstart = toIcalDate(b.checkIn);
    const dtend = toIcalDate(b.checkOut);
    // The feed URL is public (room ids are public), so it carries no guest
    // name or contact details, only that the nights are taken.
    const summary = escapeIcalText('Reserved - Travel Malawi');
    const desc = escapeIcalText(
      `Travel Malawi Booking Reference: ${b.reference || doc.id}\n` +
      `Property: ${hotelName}\n` +
      `Room: ${roomName}\n` +
      `Dates: ${b.checkIn} to ${b.checkOut}`
    );

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART;VALUE=DATE:${dtstart}`);
    lines.push(`DTEND;VALUE=DATE:${dtend}`);
    lines.push(`SUMMARY:${summary}`);
    lines.push(`DESCRIPTION:${desc}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('TRANSP:OPAQUE');
    lines.push('END:VEVENT');
  }

  // Add manually blocked dates from the host (avoiding duplicate spans)
  const manualBlocks: string[] = Array.isArray(room.blockedDates) ? room.blockedDates : [];
  const sortedBlocks = [...new Set([...manualBlocks, ...hotelBlocks])].filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();

  for (const blockDate of sortedBlocks) {
    const uid = `tm-blocked-${roomId}-${blockDate}@travelmalawi.app`;
    const dtstart = toIcalDate(blockDate);
    const dtend = toIcalDate(addDaysToStr(blockDate, 1));
    const summary = escapeIcalText(`Unavailable / Blocked - Travel Malawi (${roomName})`);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART;VALUE=DATE:${dtstart}`);
    lines.push(`DTEND;VALUE=DATE:${dtend}`);
    lines.push(`SUMMARY:${summary}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('TRANSP:OPAQUE');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  // Update last export timestamp asynchronously
  db.collection('room_types').doc(roomId).update({
    icalLastExportAt: Date.now(),
  }).catch(() => {});

  return {
    ics: lines.join('\r\n'),
    roomName,
    hotelName,
  };
}

/**
 * Generates an RFC 5545 compliant .ics calendar feed for an entire property.
 */
export async function generateHotelIcalFeed(
  hotelId: string,
  token?: string,
  origin: string = 'https://travelmalawi.app'
): Promise<{ ics: string; hotelName: string } | null> {
  const db = getDb();
  const hotelSnap = await db.collection('hotels').doc(hotelId).get();
  if (!hotelSnap.exists) return null;
  const hotel = hotelSnap.data() || {};

  if (hotel.icalExportToken && hotel.icalExportToken !== token) return null;

  const hotelName = (hotel.name as string) || 'Malawi Stay';

  // Fetch all confirmed bookings for this hotel
  const bookingsSnap = await db
    .collection('bookings')
    .where('hotelId', '==', hotelId)
    .where('status', 'in', ['confirmed', 'completed', 'checked_in'])
    .get();

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Travel Malawi//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcalText(`${hotelName} (Travel Malawi)`)}`,
    'X-WR-TIMEZONE:Africa/Blantyre',
  ];

  const nowStamp = toIcalTimestamp();

  for (const doc of bookingsSnap.docs) {
    const b = doc.data();
    if (!b.checkIn || !b.checkOut) continue;
    const uid = `tm-booking-${doc.id}@travelmalawi.app`;
    const dtstart = toIcalDate(b.checkIn);
    const dtend = toIcalDate(b.checkOut);
    const summary = escapeIcalText('Reserved - Travel Malawi');

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART;VALUE=DATE:${dtstart}`);
    lines.push(`DTEND;VALUE=DATE:${dtend}`);
    lines.push(`SUMMARY:${summary}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('TRANSP:OPAQUE');
    lines.push('END:VEVENT');
  }

  const manualBlocks: string[] = Array.isArray(hotel.blockedDates) ? hotel.blockedDates : [];
  for (const blockDate of manualBlocks) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(blockDate)) continue;
    const uid = `tm-blocked-${hotelId}-${blockDate}@travelmalawi.app`;
    const dtstart = toIcalDate(blockDate);
    const dtend = toIcalDate(addDaysToStr(blockDate, 1));
    const summary = escapeIcalText(`Property Closed / Blocked - Travel Malawi`);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART;VALUE=DATE:${dtstart}`);
    lines.push(`DTEND;VALUE=DATE:${dtend}`);
    lines.push(`SUMMARY:${summary}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('TRANSP:OPAQUE');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  db.collection('hotels').doc(hotelId).update({
    icalLastExportAt: Date.now(),
  }).catch(() => {});

  return {
    ics: lines.join('\r\n'),
    hotelName,
  };
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

/**
 * Executes a sync for all configured iCal feeds on a room.
 * Updates room.icalBlockedDates and feed statuses in Firestore.
 */
export async function syncRoomIcal(
  roomId: string,
  hotelId: string
): Promise<{
  success: boolean;
  totalBlockedDates: number;
  feeds: IcalFeedItem[];
  combinedBlocked: string[];
}> {
  const db = getDb();
  const roomRef = db.collection('room_types').doc(roomId);
  const roomSnap = await roomRef.get();
  if (!roomSnap.exists) {
    throw new Error(`Room with ID ${roomId} not found.`);
  }

  const room = roomSnap.data() || {};
  // The caller was authorised for `hotelId`; the room must belong to it.
  if (hotelId && room.hotelId !== hotelId) {
    throw new Error(`Room with ID ${roomId} not found.`);
  }
  const feeds: IcalFeedItem[] = Array.isArray(room.icalSyncUrls) ? [...room.icalSyncUrls] : [];

  if (feeds.length === 0) {
    // Clear out ical blocked dates if no feeds remain
    await roomRef.update({
      icalBlockedDates: [],
    });
    return { success: true, totalBlockedDates: 0, feeds: [], combinedBlocked: [] };
  }

  const allBlockedSet = new Set<string>();
  let feedFailed = false;
  const now = Date.now();

  for (let i = 0; i < feeds.length; i++) {
    const feed = feeds[i];
    try {
      const rawIcs = await fetchExternalIcal(feed.url);
      const parsed = parseIcalToBlockedDates(rawIcs);
      for (const d of parsed.blockedDates) {
        allBlockedSet.add(d);
      }
      feeds[i] = {
        ...feed,
        lastSyncedAt: now,
        syncStatus: 'success',
        lastError: '',
        blockedCount: parsed.blockedDates.length,
        updatedAt: now,
      };
    } catch (err: any) {
      console.warn(`[iCal Sync Error] Room ${roomId} feed ${feed.name}:`, err?.message);
      feedFailed = true;
      feeds[i] = {
        ...feed,
        lastSyncedAt: now,
        syncStatus: 'error',
        lastError: err?.message || 'Sync failed',
        updatedAt: now,
      };
    }
  }

  // A feed that could not be read this time keeps the nights it blocked last
  // time; dropping them would reopen externally booked nights for sale.
  if (feedFailed && Array.isArray(room.icalBlockedDates)) {
    for (const d of room.icalBlockedDates) if (typeof d === 'string') allBlockedSet.add(d);
  }

  const combinedBlocked = Array.from(allBlockedSet).sort();

  await roomRef.update({
    icalSyncUrls: feeds,
    icalBlockedDates: combinedBlocked,
  });

  return {
    success: true,
    totalBlockedDates: combinedBlocked.length,
    feeds,
    combinedBlocked,
  };
}

/**
 * Executes a sync for all configured iCal feeds on an entire property.
 */
export async function syncHotelIcal(
  hotelId: string
): Promise<{
  success: boolean;
  totalBlockedDates: number;
  feeds: IcalFeedItem[];
  combinedBlocked: string[];
}> {
  const db = getDb();
  const hotelRef = db.collection('hotels').doc(hotelId);
  const hotelSnap = await hotelRef.get();
  if (!hotelSnap.exists) {
    throw new Error(`Hotel with ID ${hotelId} not found.`);
  }

  const hotel = hotelSnap.data() || {};
  const feeds: IcalFeedItem[] = Array.isArray(hotel.icalSyncUrls) ? [...hotel.icalSyncUrls] : [];

  if (feeds.length === 0) {
    await hotelRef.update({
      icalBlockedDates: [],
    });
    return { success: true, totalBlockedDates: 0, feeds: [], combinedBlocked: [] };
  }

  const allBlockedSet = new Set<string>();
  let feedFailed = false;
  const now = Date.now();

  for (let i = 0; i < feeds.length; i++) {
    const feed = feeds[i];
    try {
      const rawIcs = await fetchExternalIcal(feed.url);
      const parsed = parseIcalToBlockedDates(rawIcs);
      for (const d of parsed.blockedDates) {
        allBlockedSet.add(d);
      }
      feeds[i] = {
        ...feed,
        lastSyncedAt: now,
        syncStatus: 'success',
        lastError: '',
        blockedCount: parsed.blockedDates.length,
        updatedAt: now,
      };
    } catch (err: any) {
      console.warn(`[iCal Sync Error] Hotel ${hotelId} feed ${feed.name}:`, err?.message);
      feedFailed = true;
      feeds[i] = {
        ...feed,
        lastSyncedAt: now,
        syncStatus: 'error',
        lastError: err?.message || 'Sync failed',
        updatedAt: now,
      };
    }
  }

  // Keep last-known blocks while a feed is unreachable (see syncRoomIcal).
  if (feedFailed && Array.isArray(hotel.icalBlockedDates)) {
    for (const d of hotel.icalBlockedDates) if (typeof d === 'string') allBlockedSet.add(d);
  }

  const combinedBlocked = Array.from(allBlockedSet).sort();

  await hotelRef.update({
    icalSyncUrls: feeds,
    icalBlockedDates: combinedBlocked,
  });

  return {
    success: true,
    totalBlockedDates: combinedBlocked.length,
    feeds,
    combinedBlocked,
  };
}

/**
 * Global background sync task that runs periodically to sync all properties
 * with active iCal URLs.
 */
export async function syncAllActiveFeeds(): Promise<{
  roomsSynced: number;
  hotelsSynced: number;
  totalFeeds: number;
}> {
  const db = getDb();
  let roomsSynced = 0;
  let hotelsSynced = 0;
  let totalFeeds = 0;

  // Directory mode: no calendar sync (feeds are kept for when bookings return).
  if (!(await bookingsEnabled())) return { roomsSynced, hotelsSynced, totalFeeds };

  try {
    // 1. Sync rooms
    const roomsSnap = await db.collection('room_types').get();
    for (const doc of roomsSnap.docs) {
      const data = doc.data();
      const urls: IcalFeedItem[] = Array.isArray(data.icalSyncUrls) ? data.icalSyncUrls : [];
      if (urls.length > 0) {
        try {
          totalFeeds += urls.length;
          await syncRoomIcal(doc.id, data.hotelId);
          roomsSynced++;
        } catch (err) {
          console.error(`Failed to background-sync room ${doc.id}:`, err);
        }
      }
    }

    // 2. Sync hotels
    const hotelsSnap = await db.collection('hotels').get();
    for (const doc of hotelsSnap.docs) {
      const data = doc.data();
      const urls: IcalFeedItem[] = Array.isArray(data.icalSyncUrls) ? data.icalSyncUrls : [];
      if (urls.length > 0) {
        try {
          totalFeeds += urls.length;
          await syncHotelIcal(doc.id);
          hotelsSynced++;
        } catch (err) {
          console.error(`Failed to background-sync hotel ${doc.id}:`, err);
        }
      }
    }
  } catch (err) {
    console.error('Error during global iCal sync loop:', err);
  }

  return { roomsSynced, hotelsSynced, totalFeeds };
}
