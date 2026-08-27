/**
 * Spam and abuse checks for the booking form.
 *
 * Guest checkout is open to anyone with the URL and writes straight to
 * Firestore, so the form is exactly the kind of thing that attracts junk. This
 * scores a submission on signals that are cheap to compute in the browser and
 * hard to trip accidentally.
 *
 * Two verdicts matter:
 *   'block'  — refuse the submission outright.
 *   'review' — accept it, but mark the booking so the property sees why.
 *
 * A false positive costs a real guest their booking, so `block` is reserved for
 * signals a person cannot trip by accident. Everything softer is `review`.
 */

export type SpamVerdict = 'allow' | 'review' | 'block';

export interface SpamSignal {
  /** Stable id, stored on the booking so a manager can be told what tripped. */
  code: string;
  /** One line a property manager can understand. */
  message: string;
  weight: number;
}

export interface SpamAssessment {
  verdict: SpamVerdict;
  score: number;
  signals: SpamSignal[];
  /** Codes only, for storing on the booking document. */
  codes: string[];
}

export interface BookingSubmission {
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestWhatsapp?: string;
  specialRequests?: string;
  /** Hidden field no human ever sees, let alone fills in. */
  honeypot?: string;
  /** How long the form was open, in milliseconds. */
  elapsedMs?: number;
  /** Bookings already made from this browser, for burst detection. */
  recentSubmissionTimes?: number[];
}

const BLOCK_THRESHOLD = 100;
const REVIEW_THRESHOLD = 40;

/** A form filled faster than this was not filled by a person typing. */
const MIN_FILL_MS = 3000;

/** Throwaway domains. Not proof of abuse, but worth a look. */
const DISPOSABLE_DOMAINS = [
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com',
  'trashmail.com', 'yopmail.com', 'sharklasers.com', 'getnada.com',
  'temp-mail.org', 'throwawaymail.com', 'fakeinbox.com', 'maildrop.cc',
];

const URL_PATTERN = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|ru|xyz|top|click|info|biz)\b)/i;
const BBCODE_OR_HTML = /(<\/?[a-z][\s\S]*>|\[url|\[link)/i;

/** Words that essentially only appear in injected marketing text. */
const SPAM_PHRASES = [
  'seo', 'backlink', 'crypto', 'bitcoin', 'forex', 'casino', 'viagra', 'cialis',
  'loan offer', 'make money', 'work from home', 'click here', 'buy now',
  'free trial', 'limited offer', 'telegram.me', 'whatsapp me on',
];

function looksLikeGibberish(value: string): boolean {
  const letters = value.replace(/[^a-z]/gi, '');
  if (letters.length < 8) return false;
  // A run of the same character, or no vowels at all across a long string.
  if (/(.)\1{4,}/i.test(value)) return true;
  const vowels = (letters.match(/[aeiou]/gi) ?? []).length;
  return vowels / letters.length < 0.12;
}

function containsSpamPhrase(value: string): boolean {
  const lower = value.toLowerCase();
  return SPAM_PHRASES.some(phrase => lower.includes(phrase));
}

/** Digits only, so formatting differences do not matter. */
export function normalisePhone(phone: string): string {
  return (phone ?? '').replace(/\D/g, '');
}

function repeatedDigits(digits: string): boolean {
  if (digits.length < 7) return false;
  if (/^(\d)\1+$/.test(digits)) return true;              // 0000000000
  return /^(0?1?)?1234567/.test(digits) || /9876543/.test(digits); // sequences
}

export function assessBooking(submission: BookingSubmission): SpamAssessment {
  const signals: SpamSignal[] = [];
  const add = (code: string, message: string, weight: number) =>
    signals.push({ code, message, weight });

  const name = (submission.guestName ?? '').trim();
  const email = (submission.guestEmail ?? '').trim().toLowerCase();
  const requests = (submission.specialRequests ?? '').trim();
  const phoneDigits = normalisePhone(submission.guestPhone);

  // --- Signals no person trips by accident -> block --------------------------

  // The honeypot is hidden from view and from assistive technology, so anything
  // in it came from something filling fields blindly.
  if (submission.honeypot && submission.honeypot.trim().length > 0) {
    add('honeypot', 'A hidden field was filled in, which only automated submissions do.', 100);
  }

  if (URL_PATTERN.test(name)) {
    add('link_in_name', 'The guest name contains a web address.', 100);
  }

  if (BBCODE_OR_HTML.test(name) || BBCODE_OR_HTML.test(requests)) {
    add('markup_injected', 'The submission contains HTML or BBCode markup.', 100);
  }

  // --- Softer signals -> review ---------------------------------------------

  if (typeof submission.elapsedMs === 'number' && submission.elapsedMs < MIN_FILL_MS) {
    add('too_fast', `The form was completed in ${(submission.elapsedMs / 1000).toFixed(1)}s.`, 45);
  }

  if (URL_PATTERN.test(requests)) {
    add('link_in_requests', 'The special requests contain a web address.', 50);
  }

  if (containsSpamPhrase(name) || containsSpamPhrase(requests)) {
    add('spam_phrase', 'The submission contains wording typical of marketing spam.', 50);
  }

  const domain = email.split('@')[1] ?? '';
  if (DISPOSABLE_DOMAINS.includes(domain)) {
    add('disposable_email', `The email uses a disposable address (${domain}).`, 45);
  }

  if (looksLikeGibberish(name)) {
    add('gibberish_name', 'The guest name does not look like a name.', 45);
  }

  if (repeatedDigits(phoneDigits)) {
    add('placeholder_phone', 'The phone number looks like a placeholder.', 45);
  }

  // A name with no letters at all, or a single character.
  if (name.replace(/[^a-z]/gi, '').length < 2) {
    add('name_too_short', 'The guest name has almost no letters in it.', 45);
  }

  // Several submissions from one browser in a few minutes.
  const recent = (submission.recentSubmissionTimes ?? []).filter(t => Date.now() - t < 10 * 60 * 1000);
  if (recent.length >= 3) {
    add('burst', `${recent.length} bookings submitted from this browser in the last 10 minutes.`, 60);
  } else if (recent.length === 2) {
    add('repeat', 'A third booking from this browser within 10 minutes.', 30);
  }

  if (requests.length > 900) {
    add('long_requests', 'The special requests field is unusually long.', 30);
  }

  const score = signals.reduce((total, signal) => total + signal.weight, 0);
  const verdict: SpamVerdict =
    score >= BLOCK_THRESHOLD ? 'block' : score >= REVIEW_THRESHOLD ? 'review' : 'allow';

  return { verdict, score, signals, codes: signals.map(s => s.code) };
}

const SUBMISSION_LOG_KEY = 'travel-malawi:booking-submissions';

/** Submission timestamps from this browser, used only for burst detection. */
export function readSubmissionLog(): number[] {
  try {
    const raw = localStorage.getItem(SUBMISSION_LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

export function recordSubmission(): void {
  try {
    const recent = [...readSubmissionLog(), Date.now()].slice(-10);
    localStorage.setItem(SUBMISSION_LOG_KEY, JSON.stringify(recent));
  } catch {
    // A browser refusing storage just means no burst detection for this visitor.
  }
}

/** Plain-language labels for the codes stored on a flagged booking. */
export const SPAM_REASON_LABELS: Record<string, string> = {
  honeypot: 'A hidden form field was filled in — a sign of automated submission.',
  link_in_name: 'The guest name contains a web address.',
  markup_injected: 'The submission contains HTML or BBCode markup.',
  too_fast: 'The form was completed faster than a person could type it.',
  link_in_requests: 'The special requests contain a web address.',
  spam_phrase: 'The wording is typical of marketing spam.',
  disposable_email: 'The email address is from a throwaway provider.',
  gibberish_name: 'The guest name does not look like a name.',
  placeholder_phone: 'The phone number looks like a placeholder.',
  name_too_short: 'The guest name has almost no letters in it.',
  burst: 'Several bookings were submitted from the same browser within minutes.',
  repeat: 'A repeat submission from the same browser within minutes.',
  long_requests: 'The special requests field is unusually long.',
};
