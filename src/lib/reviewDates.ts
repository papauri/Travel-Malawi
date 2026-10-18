/**
 * Utility for parsing, formatting, and sorting review dates
 * Supports string dates ('October 2024', '2024-11-15', '2 days ago'),
 * numeric timestamps (epoch ms), and relative phrases.
 */

export function parseReviewDateToTimestamp(
  dateStr?: string | number | null,
  fallbackMs?: number
): number {
  if (typeof dateStr === 'number') {
    return dateStr > 0 ? dateStr : (fallbackMs || 0);
  }
  if (!dateStr || typeof dateStr !== 'string') {
    return fallbackMs || 0;
  }

  const raw = dateStr.trim();
  if (!raw) return fallbackMs || 0;

  // Direct epoch timestamp (ms or s)
  if (/^\d{10,13}$/.test(raw)) {
    const num = parseInt(raw, 10);
    return raw.length === 10 ? num * 1000 : num;
  }

  // Relative dates
  const lower = raw.toLowerCase();
  if (lower === 'today' || lower === 'just now') {
    return Date.now();
  }
  if (lower === 'yesterday') {
    return Date.now() - 86400000;
  }
  // "3 days ago", "a month ago", "an hour ago", "2 years ago" (Google / TripAdvisor phrasing)
  const relative = lower.match(/^(\d+|a|an)\s+(minute|hour|day|week|month|year)s?\s+ago$/);
  if (relative) {
    const amount = /^\d+$/.test(relative[1]) ? parseInt(relative[1], 10) : 1;
    const unitMs: Record<string, number> = {
      minute: 60000,
      hour: 3600000,
      day: 86400000,
      week: 7 * 86400000,
      month: 30 * 86400000,
      year: 365 * 86400000,
    };
    return Date.now() - amount * unitMs[relative[2]];
  }

  // European / Commonwealth DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const candidate = new Date(year, month, day);
    // Reject impossible dates (US-style 12/25/2024 would otherwise roll into 2026); Date.parse handles those.
    if (
      candidate.getFullYear() === year &&
      candidate.getMonth() === month &&
      candidate.getDate() === day
    ) {
      return candidate.getTime();
    }
  }

  // Standard JS Date parser handles "October 2024", "2024-11-15", "Jan 5, 2025", etc.
  const parsed = Date.parse(raw);
  if (!isNaN(parsed)) {
    return parsed;
  }

  return fallbackMs || 0;
}

export function formatReviewDate(
  dateVal?: string | number | null,
  fallback = 'Recent stay'
): string {
  if (!dateVal) return fallback;
  if (typeof dateVal === 'number') {
    return new Date(dateVal).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }

  const trimmed = dateVal.trim();
  if (!trimmed || trimmed.toLowerCase() === 'recent stay') {
    return fallback;
  }

  // If already formatted like "October 2024" or "January 2025", preserve
  if (/^[A-Za-z]+ \d{4}$/.test(trimmed)) {
    return trimmed;
  }

  // If it's a parseable timestamp or ISO date string, convert to clean Month Year
  const ts = parseReviewDateToTimestamp(trimmed);
  if (ts > 0) {
    return new Date(ts).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }

  return trimmed;
}

/**
 * Detects if a review URL is broken, fake, hallucinated, or a bare root homepage.
 */
export function isBrokenOrFakeReviewUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return true;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    const search = parsed.search.toLowerCase();

    // 1. Bare root domain / homepage (e.g. https://www.google.com/maps, https://www.booking.com)
    if ((path === '' || path === '/') && !search) {
      if (host.includes('google.') || host.includes('booking.') || host.includes('tripadvisor.') || host.includes('safaribookings.')) {
        return true;
      }
    }

    // 2. Google Maps fake review paths (Google has no /maps/reviews/ or /maps/review/ URL scheme)
    if (host.includes('google.') && (path.includes('/maps/reviews') || path.includes('/maps/review') || path === '/maps')) {
      if (!search.includes('api=1') && !search.includes('query=') && !search.includes('q=')) {
        return true;
      }
    }
    // Fake CID (not a 15-22 digit number) or a known dummy CID number
    if (host.includes('google.') && search.includes('cid=')) {
      const cidMatch = search.match(/cid=([^&]+)/);
      if (cidMatch && (!/^\d{15,22}$/.test(cidMatch[1]) || cidMatch[1] === '1293847561029384756')) {
        return true;
      }
    }

    // 3. TripAdvisor fake paths (Hallucinated pattern without real geo -g and doc -d IDs)
    if (host.includes('tripadvisor.')) {
      if (path.includes('/hotel_review-') && !/-g\d+-d\d+/i.test(path)) {
        return true;
      }
      if (path.includes('/showuserreviews-') && (path.includes('987123456') || !/-g\d+-d\d+-r\d+/i.test(path))) {
        return true;
      }
      if (path.includes('/review-')) {
        return true;
      }
    }

    // 4. Facebook: group posts/permalinks cannot be verified (and private groups need a login), plus a known dummy post id
    if (host.includes('facebook.')) {
      if (
        path.includes('/permalink/9182736450123') ||
        /\/groups\/[^/]+\/(permalink|posts)\//.test(path)
      ) {
        return true;
      }
    }

    return false;
  } catch {
    return true;
  }
}

/**
 * Returns a guaranteed working, authentic verification URL for a review source.
 * Converts fake or broken URLs into working search / place verification links.
 */
export function sanitizeReviewSourceUrl(
  url: string | null | undefined,
  source?: string | null,
  hotelName?: string | null,
  location?: string | null,
  verifiedTargetUrl?: string | null
): string | undefined {
  const src = (source || '').toLowerCase().trim();
  const safeName = (hotelName || 'Property').trim();
  const safeLoc = (location || 'Malawi').trim();
  const safeQuery = encodeURIComponent(`${safeName} ${safeLoc}`);

  // In-person physical Guest Book has no web URL
  if (src.includes('guest book') || src === 'guestbook') {
    return undefined;
  }

  // If verified target URL is supplied (e.g. from admin input) and is not broken:
  if (verifiedTargetUrl && typeof verifiedTargetUrl === 'string' && verifiedTargetUrl.startsWith('http')) {
    if (!isBrokenOrFakeReviewUrl(verifiedTargetUrl)) {
      return verifiedTargetUrl.trim();
    }
  }

  // If the provided url is valid and NOT broken/fake:
  if (url && typeof url === 'string' && url.trim().startsWith('http')) {
    if (!isBrokenOrFakeReviewUrl(url)) {
      return url.trim();
    }
  }

  // Fallback to official, guaranteed working query verification URLs
  if (src.includes('google')) {
    return `https://www.google.com/maps/search/?api=1&query=${safeQuery}`;
  }
  if (src.includes('tripadvisor')) {
    return `https://www.tripadvisor.com/Search?q=${encodeURIComponent(`${safeName} Malawi`)}`;
  }
  if (src.includes('booking')) {
    return `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(`${safeName} Malawi`)}`;
  }
  if (src.includes('safari')) {
    return `https://www.safaribookings.com/search?q=${encodeURIComponent(safeName)}`;
  }
  if (src.includes('facebook') || src.includes('social')) {
    return `https://www.facebook.com/search/top?q=${encodeURIComponent(safeName)}`;
  }

  return undefined;
}

/**
 * Descriptive label for external source verification button
 */
export function getReviewSourceLabel(source?: string | null): string {
  const src = (source || '').toLowerCase().trim();
  if (src.includes('google')) return 'Verify on Google Maps';
  if (src.includes('tripadvisor')) return 'Check on TripAdvisor';
  if (src.includes('booking')) return 'Check on Booking.com';
  if (src.includes('safari')) return 'Check on SafariBookings';
  if (src.includes('facebook')) return 'View on Facebook';
  return `Verify on ${source || 'Source'}`;
}

