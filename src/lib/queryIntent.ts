/**
 * Shared message classification for Ulendo (used by the browser and the server
 * so both agree on what is small talk, what is a real question and what is
 * outside the concierge's scope).
 */

/** Words that carry no request on their own: greetings, pleasantries and fillers. */
const SMALL_TALK_WORDS = new Set([
  'hi', 'hello', 'hey', 'hiya', 'howdy', 'greetings', 'yo', 'sup', 'bo', 'moni', 'muli', 'bwanji',
  'good', 'morning', 'afternoon', 'evening', 'night', 'day', 'today', 'there', 'ulendo', 'copilot',
  'how', 'are', 'r', 'u', 'you', 'your', 'is', 'it', 'its', 'going', 'doing', 'things', 'everything',
  'whats', 'what', 'up', 'i', 'im', 'am', 'and', 'too', 'so', 'very', 'just', 'really', 'well',
  'great', 'fine', 'ok', 'okay', 'alright', 'nice', 'cool', 'awesome', 'thanks', 'thank', 'cheers',
  'not', 'bad', 'pretty', 'all', 'been', 'me', 'my', 'the', 'a', 'lol', 'haha', 'yes', 'yeah', 'no',
  'sure', 'bye', 'goodbye', 'see', 'later', 'checking', 'in', 'chilling', 'nothing', 'much', 'same',
  'old', 'hope', 'hows', 'youre', 'also', 'still', 'busy', 'tired',
]);

/**
 * True only when the whole message is greeting or pleasantry ("hi", "how are
 * you", "not bad, and you?"). Anything carrying a request ("not bad, who owns
 * Esthers?") is a real question, even if it starts with a greeting.
 */
export function isPureSmallTalk(text: string): boolean {
  const words = (text || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return false;
  if (words.length > 12) return false;
  return words.every(w => SMALL_TALK_WORDS.has(w));
}

export type OutOfScopeKind = 'car_purchase' | 'coding' | 'other';

/** Topics Ulendo must decline (and pivot back to stays and concierge work). */
export function detectOutOfScope(text: string): OutOfScopeKind | null {
  const clean = (text || '').toLowerCase();
  const carPurchase =
    /\b(buy|buying|purchase|purchasing|dealership|dealer|for\s+sale|sell|selling|import|importing|used\s+car)\b/.test(clean) &&
    /\b(car|cars|vehicle|vehicles|automobile|automobiles|truck|trucks|sedan|suv)\b/.test(clean) &&
    !/\b(shuttle|transfer|hire|rent|rental|safari|lodge|airport|pick\s*up|drop\s*off)\b/.test(clean);
  if (carPurchase) return 'car_purchase';
  if (/\b(code\s+an\s+app|coding|write\s+(me\s+)?(some\s+)?code|program(ming)?\s+an\s+app|write\s+a\s+python|build\s+(me\s+)?an\s+app|develop\s+an\s+app|software\s+development|debug\s+(my\s+)?code|create\s+an\s+app|python\s+script|javascript\s+code|html|css)\b/.test(clean)) {
    return 'coding';
  }
  if (/\b(crypto|bitcoin|ethereum|forex|stock\s+market|stock\s+trading|stocks|medical\s+diagnosis|diagnose|legal\s+counsel|lawsuit|politics|election|homework|essay|recipe\s+for|football|premier\s+league|movie|celebrity)\b/.test(clean)) {
    return 'other';
  }
  return null;
}

/** Generic words that never identify a single property on their own. */
const GENERIC_NAME_WORDS = new Set([
  'lodge', 'lodges', 'hotel', 'resort', 'camp', 'house', 'guest', 'guesthouse', 'beach', 'lake', 'cottage',
  'cottages', 'village', 'malawi', 'safari', 'retreat', 'suites', 'country', 'island', 'river', 'the', 'boat',
  'inn', 'stay', 'stays', 'home', 'villa', 'chalet', 'chalets', 'bay', 'park',
]);

/** Levenshtein distance, for matching misspelled property names. */
function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = above;
    }
  }
  return prev[b.length];
}

/**
 * Ids of properties a message names, by full name, by a distinctive word
 * ("Esthers" for "Esthers Guest House"), its possessive ("Esther's") or a close misspelling ("esters").
 */
export function findMentionedPropertyIds(text: string, properties: Array<{ id: string; name?: string }>): Set<string> {
  const lower = (text || '').toLowerCase().replace(/['’]/g, '');
  const messageWords = lower.split(/[^a-z0-9]+/).filter(w => w.length >= 4);
  const mentioned = new Set<string>();
  for (const p of properties) {
    const name = (p.name || '').toLowerCase().replace(/['’]/g, '').trim();
    if (!name) continue;
    if (lower.includes(name)) {
      mentioned.add(p.id);
      continue;
    }
    const distinctive = name.split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !GENERIC_NAME_WORDS.has(w));
    const exact = (w: string) => new RegExp(`\\b${w}s?\\b`).test(lower) || (w.endsWith('s') && new RegExp(`\\b${w.slice(0, -1)}\\b`).test(lower));
    // Typos count too ("esters" -> "esthers"): one edit allowed from 5 letters, two from 8.
    const close = (w: string) => w.length >= 5 && messageWords.some(m => Math.abs(m.length - w.length) <= 2 && editDistance(m, w) <= (w.length >= 8 ? 2 : 1));
    if (distinctive.some(w => exact(w) || close(w))) {
      mentioned.add(p.id);
    }
  }
  return mentioned;
}
