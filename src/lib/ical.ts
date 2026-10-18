/**
 * Client-side utilities and platform helpers for iCal / .ics Calendar Sync.
 * Supports RoomRaccoon, Airbnb, Booking.com, NightsBridge, Google Calendar, and custom feeds.
 */

import { IcalFeedConfig } from '../types';
import { nightsInRange } from './dates';

export interface ChannelPlatformPreset {
  id: IcalFeedConfig['platform'];
  name: string;
  tagline: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  exportGuide: string;
  importGuide: string;
  urlPlaceholder: string;
}

export const CHANNEL_PRESETS: Record<string, ChannelPlatformPreset> = {
  roomraccoon: {
    id: 'roomraccoon',
    name: 'RoomRaccoon',
    tagline: 'Leading boutique hotel PMS & Channel Manager across Africa',
    color: '#0284c7',
    badgeBg: 'bg-sky-50 text-sky-800 border-sky-200',
    badgeText: 'RoomRaccoon PMS',
    exportGuide: 'In RoomRaccoon, go to Settings (Gear) → Channel Manager or External Calendars → Copy the iCal export link for this room category.',
    importGuide: 'In RoomRaccoon, go to Channel Manager → Add iCal Channel → Paste Travel Malawi\'s export link to block dates booked on our platform.',
    urlPlaceholder: 'https://...roomraccoon.com/.../calendar.ics',
  },
  nightsbridge: {
    id: 'nightsbridge',
    name: 'NightsBridge',
    tagline: 'Standard real-time distribution across Southern Africa & Malawi',
    color: '#0d9488',
    badgeBg: 'bg-teal-50 text-teal-800 border-teal-200',
    badgeText: 'NightsBridge',
    exportGuide: 'In NightsBridge Setup / Links, copy the room category iCal availability export feed link.',
    importGuide: 'In NightsBridge External Feeds, paste Travel Malawi\'s link to import confirmed bookings.',
    urlPlaceholder: 'https://...nightsbridge.co.za/.../feed.ics',
  },
  airbnb: {
    id: 'airbnb',
    name: 'Airbnb',
    tagline: 'Global vacation rentals & cottages',
    color: '#f43f5e',
    badgeBg: 'bg-rose-50 text-rose-800 border-rose-200',
    badgeText: 'Airbnb',
    exportGuide: 'In Airbnb, go to Calendar → Pricing & Availability → Calendar Sync → Export Calendar (copy the .ics URL).',
    importGuide: 'In Airbnb, go to Calendar Sync → Import Calendar → Paste Travel Malawi\'s link and name it "Travel Malawi".',
    urlPlaceholder: 'https://www.airbnb.com/calendar/ical/...ics',
  },
  booking: {
    id: 'booking',
    name: 'Booking.com',
    tagline: 'Global hotel extranet',
    color: '#1d4ed8',
    badgeBg: 'bg-blue-50 text-blue-800 border-blue-200',
    badgeText: 'Booking.com',
    exportGuide: 'In Booking.com Extranet, go to Rates & Availability → Sync Calendars → Export calendar link.',
    importGuide: 'In Booking.com Extranet, go to Rates & Availability → Sync Calendars → Import calendar link.',
    urlPlaceholder: 'https://admin.booking.com/.../calendar.ics',
  },
  google: {
    id: 'google',
    name: 'Google Calendar / Phone iCal',
    tagline: 'View bookings directly on host phone or desktop calendar',
    color: '#059669',
    badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    badgeText: 'Personal Calendar',
    exportGuide: 'Subscribe to Travel Malawi\'s calendar to view all confirmed stays directly in Google Calendar or your iPhone/Android.',
    importGuide: 'In Google Calendar, go to Settings → Add calendar → From URL → Paste Travel Malawi export link.',
    urlPlaceholder: 'https://calendar.google.com/calendar/ical/.../basic.ics',
  },
  other: {
    id: 'other',
    name: 'Custom / Other PMS',
    tagline: 'Any standard RFC 5545 iCalendar feed (Beds24, Cloudbeds, Sirvoy, etc.)',
    color: '#78716c',
    badgeBg: 'bg-stone-100 text-stone-800 border-stone-300',
    badgeText: 'iCal Feed',
    exportGuide: 'Copy the .ics / iCal export link from your PMS or channel manager.',
    importGuide: 'Paste Travel Malawi\'s export link into your channel manager\'s iCal import section.',
    urlPlaceholder: 'https://.../calendar.ics',
  },
};

/** Builds the public HTTPS export link for a room's calendar */
export function getRoomIcalExportUrl(roomId: string, token?: string, origin = window.location.origin): string {
  const base = `${origin}/api/calendar/room/${roomId}.ics`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

/** Builds the public HTTPS export link for a hotel's calendar (entire place) */
export function getHotelIcalExportUrl(hotelId: string, token?: string, origin = window.location.origin): string {
  const base = `${origin}/api/calendar/hotel/${hotelId}.ics`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

/** Converts an https:// calendar link to a webcal:// protocol link for 1-click mobile/Mac calendar subscription */
export function getWebcalUrl(httpUrl: string): string {
  return httpUrl.replace(/^https?:\/\//i, 'webcal://');
}

/** Builds a 1-click Google Calendar web subscription URL */
export function getGoogleCalendarSubscribeUrl(feedUrl: string, title?: string): string {
  const cleanUrl = feedUrl.replace(/^https?:\/\//i, '');
  return `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(`https://${cleanUrl}`)}`;
}

/**
 * Parses an iCalendar date string into 'YYYY-MM-DD'.
 * Handles VALUE=DATE (e.g. 20261101), UTC datetime (20261101T140000Z), and TZID.
 */
export function parseIcalDateToDateStr(val: string): string | null {
  if (!val) return null;
  const clean = val.replace(/^[^:]*:/, '').trim();
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(clean);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

/**
 * Client-side parser for previewing an .ics file before saving
 */
export function parseClientIcsText(ics: string): {
  count: number;
  dates: string[];
  summary: string;
} {
  // Unfold lines: RFC 5545 specifies that a line starting with a space or tab is a continuation
  const unfolded = ics.replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);
  
  const datesSet = new Set<string>();
  let inEvent = false;
  let dtstart = '';
  let dtend = '';
  let status = '';
  let eventCount = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      dtstart = '';
      dtend = '';
      status = '';
    } else if (line === 'END:VEVENT') {
      if (inEvent && dtstart && status !== 'CANCELLED') {
        const startStr = parseIcalDateToDateStr(dtstart);
        const endStr = dtend ? parseIcalDateToDateStr(dtend) : startStr;
        if (startStr) {
          eventCount++;
          if (!endStr || endStr <= startStr) {
            datesSet.add(startStr);
          } else {
            // Expand range [startStr, endStr)
            // Calendar-date stepping (UTC) so the viewer's timezone cannot shift nights.
            for (const night of nightsInRange(startStr, endStr).slice(0, 365)) datesSet.add(night);
          }
        }
      }
      inEvent = false;
    } else if (inEvent) {
      if (line.startsWith('DTSTART')) {
        dtstart = line;
      } else if (line.startsWith('DTEND')) {
        dtend = line;
      } else if (line.startsWith('STATUS:')) {
        status = line.substring(7).trim().toUpperCase();
      }
    }
  }

  const sortedDates = Array.from(datesSet).sort();
  return {
    count: eventCount,
    dates: sortedDates,
    summary: `${eventCount} reservations / blocks found (${sortedDates.length} total blocked nights)`,
  };
}
