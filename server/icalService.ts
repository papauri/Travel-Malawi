/**
 * Server-side RFC 5545 iCalendar (iCal / .ics) 2-Way Sync Engine.
 * Enables zero-double-booking synchronization with RoomRaccoon, Airbnb, Booking.com,
 * NightsBridge, Google Calendar, and other PMS systems.
 */

import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { PROJECT_ID, DATABASE_ID } from './auth';

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

/** Adds N days to YYYY-MM-DD */
function addDaysToStr(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

  // If room has a secret token configured, verify it
  if (room.icalExportToken && token && room.icalExportToken !== token) {
    throw new Error('Unauthorized calendar feed access token.');
  }

  const hotelId = room.hotelId;
  let hotelName = 'Malawi Lodge';
  if (hotelId) {
    const hotelSnap = await db.collection('hotels').doc(hotelId).get();
    if (hotelSnap.exists) {
      hotelName = (hotelSnap.data()?.name as string) || hotelName;
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
    const summary = escapeIcalText(`Reserved - Travel Malawi (${b.guestName || 'Guest'})`);
    const desc = escapeIcalText(
      `Travel Malawi Booking Reference: ${b.bookingRef || doc.id}\n` +
      `Property: ${hotelName}\n` +
      `Room: ${roomName}\n` +
      `Dates: ${b.checkIn} to ${b.checkOut}\n` +
      `Direct Contact: ${b.guestPhone || b.guestEmail || 'Via Travel Malawi Platform'}`
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
  const sortedBlocks = [...manualBlocks].filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();

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

  if (hotel.icalExportToken && token && hotel.icalExportToken !== token) {
    throw new Error('Unauthorized calendar feed access token.');
  }

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
    const summary = escapeIcalText(`Reserved - Travel Malawi (${b.guestName || 'Guest'})`);

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

        if (startStr && startStr >= cutoffPast && startStr <= cutoffFuture) {
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

/**
 * Fetches an external .ics URL with safety guards (timeout, status check, user-agent).
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

  const response = await fetch(cleanUrl, {
    headers: {
      'User-Agent': 'TravelMalawi-ChannelSync/1.0 (+https://travelmalawi.app; hospitality calendar synchronization)',
      'Accept': 'text/calendar, application/octet-stream, text/plain, */*',
    },
    signal: AbortSignal.timeout(12000), // 12 second timeout
  });

  if (!response.ok) {
    throw new Error(`External calendar returned HTTP status ${response.status} (${response.statusText})`);
  }

  const text = await response.text();
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
  const feeds: IcalFeedItem[] = Array.isArray(room.icalSyncUrls) ? [...room.icalSyncUrls] : [];

  if (feeds.length === 0) {
    // Clear out ical blocked dates if no feeds remain
    await roomRef.update({
      icalBlockedDates: [],
    });
    return { success: true, totalBlockedDates: 0, feeds: [], combinedBlocked: [] };
  }

  const allBlockedSet = new Set<string>();
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
      feeds[i] = {
        ...feed,
        lastSyncedAt: now,
        syncStatus: 'error',
        lastError: err?.message || 'Sync failed',
        updatedAt: now,
      };
    }
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
      feeds[i] = {
        ...feed,
        lastSyncedAt: now,
        syncStatus: 'error',
        lastError: err?.message || 'Sync failed',
        updatedAt: now,
      };
    }
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
