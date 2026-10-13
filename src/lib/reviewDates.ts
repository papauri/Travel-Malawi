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
  const relativeDays = lower.match(/^(\d+)\s+days?\s+ago$/);
  if (relativeDays) {
    return Date.now() - parseInt(relativeDays[1], 10) * 86400000;
  }
  const relativeWeeks = lower.match(/^(\d+)\s+weeks?\s+ago$/);
  if (relativeWeeks) {
    return Date.now() - parseInt(relativeWeeks[1], 10) * 7 * 86400000;
  }
  const relativeMonths = lower.match(/^(\d+)\s+months?\s+ago$/);
  if (relativeMonths) {
    return Date.now() - parseInt(relativeMonths[1], 10) * 30 * 86400000;
  }

  // European / Commonwealth DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const parsed = new Date(year, month, day).getTime();
    if (!isNaN(parsed)) return parsed;
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
