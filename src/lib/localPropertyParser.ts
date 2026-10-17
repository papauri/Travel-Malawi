import {
  COMMON_AMENITIES,
  ListingDraft,
  NAME_MAX,
  PROPERTY_CATEGORIES,
  PropertyCategory,
} from './listing';
import { RoomInput } from './validateRoom';

const ESTIMATED_MWK_PER_USD = 1750;

export function convertUsdToMwk(usd: number): number {
  if (!usd || usd <= 0) return 0;
  return Math.round((usd * ESTIMATED_MWK_PER_USD) / 5000) * 5000;
}

export function convertMwkToUsd(mwk: number): number {
  if (!mwk || mwk <= 0) return 0;
  return Math.max(5, Math.round((mwk / ESTIMATED_MWK_PER_USD) / 5) * 5);
}

export interface ParsedPropertyResult extends Partial<ListingDraft> {
  categories?: PropertyCategory[];
}

const GENERIC_DOC_HEADERS = [
  /^rate\s*sheet\b/i,
  /^price\s*list\b/i,
  /^tariff\s*(sheet|list|guide|rates)?\b/i,
  /^rack\s*rates?\b/i,
  /^room\s*rates?\b/i,
  /^accommodation\s*rates?\b/i,
  /^fact\s*sheet\b/i,
  /^property\s*(details|information|fact\s*sheet|profile|overview)\b/i,
  /^brochure\b/i,
  /^welcome$/i,
  /^20\d{2}(\s*[/\-]\s*20\d{2})?\s*(rates?|tariffs?|price\s*list)?\s*:?$/i,
  /^rooms?\s*(?:types?\s*)?(&|and)?\s*(?:20\d{2}\s*)?(rates?|prices?|tariffs?)?\s*:?$/i,
  /^contact\s*(us|info|information|details)\s*:?$/i,
];

const MALAWI_HUB_MATCHERS: Array<{ pattern: RegExp; canonical: string }> = [
  { pattern: /\bcape\s+maclear\b/i, canonical: 'Cape Maclear' },
  { pattern: /\bmangochi\b/i, canonical: 'Mangochi' },
  { pattern: /\bsenga\s+bay\b/i, canonical: 'Senga Bay' },
  { pattern: /\bsalima\b/i, canonical: 'Salima' },
  { pattern: /\barea\s*43\b/i, canonical: 'Area 43, Lilongwe' },
  { pattern: /\barea\s*10\b/i, canonical: 'Area 10, Lilongwe' },
  { pattern: /\barea\s*11\b/i, canonical: 'Area 11, Lilongwe' },
  { pattern: /\barea\s*3\b/i, canonical: 'Area 3, Lilongwe' },
  { pattern: /\barea\s*9\b/i, canonical: 'Area 9, Lilongwe' },
  { pattern: /\barea\s*12\b/i, canonical: 'Area 12, Lilongwe' },
  { pattern: /\barea\s*47\b/i, canonical: 'Area 47, Lilongwe' },
  { pattern: /\blilongwe\b/i, canonical: 'Lilongwe' },
  { pattern: /\bblantyre\b/i, canonical: 'Blantyre' },
  { pattern: /\bzomba\b/i, canonical: 'Zomba' },
  { pattern: /\bmulanje\b/i, canonical: 'Mulanje' },
  { pattern: /\bliwonde\b/i, canonical: 'Liwonde' },
  { pattern: /\bmajete\b/i, canonical: 'Majete' },
  { pattern: /\bnyika(\s+plateau)?\b/i, canonical: 'Nyika Plateau' },
  { pattern: /\bnkhata\s+bay\b/i, canonical: 'Nkhata Bay' },
  { pattern: /\blikoma(\s+island)?\b/i, canonical: 'Likoma Island' },
  { pattern: /\bchintheche\b/i, canonical: 'Chintheche' },
  { pattern: /\bdedza\b/i, canonical: 'Dedza' },
  { pattern: /\bmzuzu\b/i, canonical: 'Mzuzu' },
  { pattern: /\bkaronga\b/i, canonical: 'Karonga' },
  { pattern: /\bmonkey\s+bay\b/i, canonical: 'Monkey Bay' },
  { pattern: /\bnkhotakota\b/i, canonical: 'Nkhotakota' },
  { pattern: /\bkasungu\b/i, canonical: 'Kasungu' },
  { pattern: /\bthyolo\b/i, canonical: 'Thyolo' },
];

const AMENITY_SYNONYMS: Array<{ pattern: RegExp; amenity: string }> = [
  { pattern: /\b(solar|inverter|generator|backup\s+power|uninterrupted\s+power|escom\s+backup)\b/i, amenity: 'Backup power' },
  { pattern: /\b(wi-?fi|starlink|high[\s-]speed\s+internet|free\s+internet|wireless\s+internet)\b/i, amenity: 'Free WiFi' },
  { pattern: /\b(swimming\s+pool|plunge\s+pool|infinity\s+pool|\bpool\b)\b/i, amenity: 'Swimming pool' },
  { pattern: /\b(breakfast\s+included|complimentary\s+breakfast|free\s+breakfast|bed\s*&\s*breakfast|bed\s+and\s+breakfast|\bb&b\b|\bbreakfast\b)\b/i, amenity: 'Breakfast included' },
  { pattern: /\b(air\s*conditioning|air\s*conditioned|air-?con|\ba\/c\b)\b/i, amenity: 'Air conditioning' },
  { pattern: /\b(secure\s+parking|free\s+parking|guarded\s+parking|on[\s-]site\s+parking|\bparking\b)\b/i, amenity: 'Secure parking' },
  { pattern: /\b(private\s+beach|sandy\s+beach|beachfront|\bbeach\b)\b/i, amenity: 'Private beach' },
  { pattern: /\b(lake\s*view|lakefront|lakeshore\s+view|overlooking\s+lake)\b/i, amenity: 'Lake view' },
  { pattern: /\b(restaurant|on[\s-]site\s+dining|a\s+la\s+carte)\b/i, amenity: 'Restaurant' },
  { pattern: /\b(lounge\s+bar|sundowner\s+bar|cocktail\s+bar|\bbar\b)\b/i, amenity: 'Bar' },
  { pattern: /\b(hot\s+water|geyser|hot\s+shower)\b/i, amenity: 'Hot water' },
  { pattern: /\b(airport\s+transfer|airport\s+shuttle|airport\s+pickup|\bshuttle\b)\b/i, amenity: 'Airport transfer' },
  { pattern: /\b(laundry|washing\s+service)\b/i, amenity: 'Laundry' },
  { pattern: /\b(dedicated\s+workspace|work\s+desk|office\s+desk)\b/i, amenity: 'Dedicated Workspace' },
  { pattern: /\b(boat\s+trips?|sunset\s+cruise|kayaks?|canoes?|snorkeling)\b/i, amenity: 'Boat trips' },
  { pattern: /\b(\bspa\b|massage|wellness\s+center)\b/i, amenity: 'Spa' },
  { pattern: /\b(\bgym\b|fitness\s+cent(er|re))\b/i, amenity: 'Gym' },
  { pattern: /\b(conference\s+room|conference\s+hall|boardroom|meeting\s+facilities)\b/i, amenity: 'Conference room' },
  { pattern: /\b(room\s+service)\b/i, amenity: 'Room service' },
  { pattern: /\b(family\s+rooms?|interleading\s+rooms?)\b/i, amenity: 'Family rooms' },
  { pattern: /\b(pet\s+friendly|pets?\s+allowed|dog\s+friendly)\b/i, amenity: 'Pet friendly' },
];

const ROOM_KEYWORD_REGEX = /\b(room|rooms|chalet|chalets|suite|suites|tent|tents|cottage|cottages|villa|villas|bungalow|bungalows|single|double|twin|triple|family|executive|standard|deluxe|superior|presidential|studio|cabin|cabins|banda|bandas|dorm|dormitory|apartment|loft|king|queen)\b/i;

const NON_ROOM_SERVICE_REGEX = /^(airport\s+transfer|shuttle|boat\s+trip|sunset\s+cruise|game\s+drive|breakfast\s+only|lunch|dinner|extra\s+bed|extra\s+person|child\s+rate|corkage|conference\s+package|day\s+pass|camping\s+pitch)\b/i;

/**
 * Converts 12-hour or 24-hour time strings into canonical 24-hour "HH:MM" format.
 * Examples: "2:00 PM" -> "14:00", "14h00" -> "14:00", "10:30 AM" -> "10:30", "10am" -> "10:00"
 */
export function normalizeTimeString(raw: string): string | null {
  const m = raw
    .trim()
    .match(/\b(\d{1,2})(?:[:.h](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\b/i);
  if (!m) return null;

  let hours = parseInt(m[1], 10);
  const minutes = m[2] ? parseInt(m[2], 10) : 0;
  const meridiem = m[3] ? m[3].toLowerCase().replace(/\./g, '') : '';

  if (isNaN(hours) || isNaN(minutes) || minutes < 0 || minutes > 59) return null;

  if (meridiem === 'pm' && hours < 12) {
    hours += 12;
  } else if (meridiem === 'am' && hours === 12) {
    hours = 0;
  }

  if (hours < 0 || hours > 23) return null;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Extracts USD and MWK prices from a room line.
 * Never invents default prices ($50 / MK 85,000) when no price is found.
 */
export function extractRoomPricesFromLine(text: string): {
  usd: number;
  mwk: number;
  hasPrice: boolean;
  cleanedText: string;
} {
  let usd = 0;
  let mwk = 0;
  let cleaned = text;

  const mwkPatterns = [
    /(?:\bMWK\b|\bMK\b|\bK)\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,9})(?:\.\d+)?/gi,
    /([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,9})(?:\.\d+)?\s*(?:\bMWK\b|\bMK\b|\bKwacha\b|\bKwachas\b)/gi,
  ];

  const usdPatterns = [
    /(?:\bUSD\b|US\$|\$)\s*([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)(?:\.\d+)?/gi,
    /([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)(?:\.\d+)?\s*(?:\bUSD\b|\bdollars?\b)/gi,
  ];

  for (const pat of mwkPatterns) {
    let match;
    while ((match = pat.exec(text)) !== null) {
      const val = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(val) && val > 0 && mwk === 0) {
        mwk = Math.round(val);
      }
    }
  }

  for (const pat of usdPatterns) {
    let match;
    while ((match = pat.exec(text)) !== null) {
      const val = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(val) && val > 0 && val < 25000 && usd === 0) {
        usd = Math.round(val);
      }
    }
  }

  const hasPrice = usd > 0 || mwk > 0;

  if (usd > 0 && mwk === 0) {
    mwk = convertUsdToMwk(usd);
  } else if (mwk > 0 && usd === 0) {
    usd = convertMwkToUsd(mwk);
  }

  if (hasPrice) {
    cleaned = cleaned
      .replace(/(?:\bMWK\b|\bMK\b|\bK)\s*(?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,9})(?:\.\d+)?/gi, '')
      .replace(/(?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,9})(?:\.\d+)?\s*(?:\bMWK\b|\bMK\b|\bKwacha\b|\bKwachas\b)/gi, '')
      .replace(/(?:\bUSD\b|US\$|\$)\s*(?:[0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)(?:\.\d+)?/gi, '')
      .replace(/(?:[0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)(?:\.\d+)?\s*(?:\bUSD\b|\bdollars?\b)/gi, '')
      .replace(/\b(?:per\s+night|p\/n|\/night|a\s+night|per\s+room|b&b|bed\s*&\s*breakfast)\b/gi, '');
  }

  return {
    usd,
    mwk,
    hasPrice,
    cleanedText: cleaned.replace(/\s+/g, ' ').trim(),
  };
}

function extractPhoneNumbersFromLine(line: string): string[] {
  // Temporarily strip currency amounts so "MK 150,000" or "$120" is never mistaken for a phone number
  const withoutMoney = line
    .replace(/(?:\bMWK\b|\bMK\b|\bUSD\b|US\$|\$)\s*[\d,]+(?:\.\d+)?/gi, ' ')
    .replace(/[\d,]+(?:\.\d+)?\s*(?:\bMWK\b|\bMK\b|\bKwacha\b|\bUSD\b)/gi, ' ');

  const results: string[] = [];
  const phoneRegex = /(?:\+265[\s\-]?\d[\d\s\-]{7,11}|\b0(?:99|88|89|98|1|21)\d[\d\s\-]{6,9}\b|\+\d{1,3}[\s\-]?\(?\d{1,4}\)?[\s\-]?\d{3,4}[\s\-]?\d{3,4})/g;

  let match;
  while ((match = phoneRegex.exec(withoutMoney)) !== null) {
    const raw = match[0].trim();
    const digitsOnly = raw.replace(/\D/g, '');
    if (digitsOnly.length >= 9 && digitsOnly.length <= 15) {
      results.push(raw.replace(/\s+/g, ' '));
    }
  }
  return results;
}

function extractEmailsFromLine(line: string): string[] {
  const matches = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  return matches ? matches.map(e => e.trim().toLowerCase()) : [];
}

function cleanPersonName(raw: string): string {
  return raw
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '')
    .replace(/(?:\+265[\s\-]?\d[\d\s\-]{7,11}|\b0(?:99|88|89|98|1|21)\d[\d\s\-]{6,9}\b|\+\d{1,3}[\s\-]?\(?\d{1,4}\)?[\s\-]?\d{3,4}[\s\-]?\d{3,4})/g, '')
    .replace(/\b(tel|phone|mobile|cell|whatsapp|wa|email|e-mail)\s*[:\-]?/gi, '')
    .replace(/[\s\(\)\[\]|\/,;:\-]+$/g, '')
    .replace(/^[\s\(\)\[\]|\/,;:\-]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectCategoriesAndStayType(fullText: string, propertyName: string): {
  category: PropertyCategory | '';
  categories: PropertyCategory[];
  stayType: 'rooms' | 'entire_place';
} {
  const combined = `${propertyName}\n${fullText}`;
  const found: PropertyCategory[] = [];

  const addCat = (c: PropertyCategory) => {
    if (!found.includes(c)) found.push(c);
  };

  // Explicit category line check first
  const explicitCatMatch = fullText.match(/^(?:category|property\s*type|type|style)\s*[:\-]\s*(.+)$/im);
  if (explicitCatMatch) {
    const explicitVal = explicitCatMatch[1].trim().toLowerCase();
    for (const validCat of PROPERTY_CATEGORIES) {
      if (explicitVal.includes(validCat.toLowerCase())) {
        addCat(validCat);
      }
    }
  }

  const rules: Array<{ cat: PropertyCategory; regex: RegExp }> = [
    { cat: 'Hotel', regex: /\b(hotel)\b/i },
    { cat: 'Resort', regex: /\b(resort|beach\s+resort)\b/i },
    { cat: 'Bed & Breakfast', regex: /\b(bed\s*&\s*breakfast|bed\s+and\s+breakfast|\bb&b\b|homestay)\b/i },
    { cat: 'Cottage & Chalet', regex: /\b(cottage\s*&\s*chalet|cottages?|chalets?|self[\s-]catering|bungalows?|cabins?)\b/i },
    { cat: 'Safari & Wildlife', regex: /\b(safari|wildlife|bush\s+camp|game\s+lodge|game\s+reserve|national\s+park|liwonde|majete|nyika|kasungu|nkhotakota)\b/i },
    { cat: 'Lake & Beach', regex: /\b(lake\s*&\s*beach|lakeside|lakeshore|beachfront|lake\s+malawi|cape\s+maclear|senga\s+bay|nkhata\s+bay|likoma|chintheche|monkey\s+bay|salima|mangochi)\b/i },
    { cat: 'Guest House', regex: /\b(guest\s*house|guesthouse|executive\s+lodge|rest\s*house|\binn\b)\b/i },
    { cat: 'Lodge', regex: /\b(lodge)\b/i },
    { cat: 'Luxury', regex: /\b(luxury|5[\s-]star|five[\s-]star|boutique|presidential)\b/i },
    { cat: 'Romantic Escape', regex: /\b(romantic|honeymoon|couples?\s+retreat)\b/i },
    { cat: 'Family', regex: /\b(family\s+resort|family\s+friendly|children\s+welcome)\b/i },
    { cat: 'Adventure', regex: /\b(adventure|mount\s+mulanje|mulanje|hiking|trekking|backpackers?|diving)\b/i },
  ];

  // Prioritize matches in the property name itself
  for (const r of rules) {
    if (r.regex.test(propertyName)) {
      addCat(r.cat);
    }
  }

  for (const r of rules) {
    if (r.regex.test(combined)) {
      addCat(r.cat);
    }
  }

  const isEntirePlace = /\b(entire\s+house|whole\s+house|whole\s+cottage|entire\s+villa|entire\s+cottage|whole\s+villa|entire\s+place|exclusive\s+use\s+(?:house|villa|cottage))\b/i.test(
    combined
  );

  if (isEntirePlace && found.length === 0) {
    addCat('Cottage & Chalet');
  }

  return {
    category: found[0] || '',
    categories: found,
    stayType: isEntirePlace ? 'entire_place' : 'rooms',
  };
}

/**
 * Parses CSV or TSV room table if the user pasted or uploaded a spreadsheet table.
 */
function tryParseDelimitedRooms(rawText: string): RoomInput[] | null {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  const firstLine = lines[0].toLowerCase();
  const isCsv = firstLine.includes(',') && (firstLine.includes('room') || firstLine.includes('unit') || firstLine.includes('chalet') || firstLine.includes('rate') || firstLine.includes('price') || firstLine.includes('usd') || firstLine.includes('mwk'));
  const isTsv = firstLine.includes('\t') && (firstLine.includes('room') || firstLine.includes('unit') || firstLine.includes('chalet') || firstLine.includes('rate') || firstLine.includes('price') || firstLine.includes('usd') || firstLine.includes('mwk'));

  if (!isCsv && !isTsv) return null;

  const delimiter = isCsv ? ',' : '\t';
  const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));

  const nameIdx = headers.findIndex(h => h.includes('room') || h.includes('unit') || h.includes('chalet') || h.includes('type') || h.includes('name'));
  const descIdx = headers.findIndex(h => h.includes('desc') || h.includes('note') || h.includes('detail'));
  const guestsIdx = headers.findIndex(h => h.includes('guest') || h.includes('pax') || h.includes('sleep') || h.includes('cap'));
  const qtyIdx = headers.findIndex(h => h.includes('qty') || h.includes('quant') || h.includes('count') || h.includes('units'));
  const usdIdx = headers.findIndex(h => h.includes('usd') || h.includes('$') || h.includes('dollar'));
  const mwkIdx = headers.findIndex(h => h.includes('mwk') || h.includes('mk') || h.includes('kwacha'));
  const priceIdx = headers.findIndex(h => h === 'price' || h === 'rate' || h.includes('price') || h.includes('rate'));

  if (nameIdx === -1) return null;

  const rooms: RoomInput[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length < 2) continue;

    const name = cols[nameIdx];
    if (!name) continue;

    let usd = 0;
    let mwk = 0;

    if (usdIdx !== -1 && cols[usdIdx]) {
      const v = parseFloat(cols[usdIdx].replace(/[^0-9.]/g, ''));
      if (!isNaN(v) && v > 0) usd = Math.round(v);
    }
    if (mwkIdx !== -1 && cols[mwkIdx]) {
      const v = parseFloat(cols[mwkIdx].replace(/[^0-9.]/g, ''));
      if (!isNaN(v) && v > 0) mwk = Math.round(v);
    }
    if (priceIdx !== -1 && cols[priceIdx] && usd === 0 && mwk === 0) {
      const extracted = extractRoomPricesFromLine(cols[priceIdx]);
      usd = extracted.usd;
      mwk = extracted.mwk;
    }

    if (usd > 0 && mwk === 0) mwk = convertUsdToMwk(usd);
    else if (mwk > 0 && usd === 0) usd = convertMwkToUsd(mwk);

    const maxGuests = guestsIdx !== -1 && cols[guestsIdx] ? (parseInt(cols[guestsIdx].replace(/\D/g, ''), 10) || 2) : 2;
    const quantity = qtyIdx !== -1 && cols[qtyIdx] ? (parseInt(cols[qtyIdx].replace(/\D/g, ''), 10) || 1) : 1;
    const description = descIdx !== -1 && cols[descIdx] ? cols[descIdx] : '';

    rooms.push({
      name,
      description,
      maxGuests: Math.max(1, Math.min(30, maxGuests)),
      baseGuests: Math.min(2, Math.max(1, maxGuests)),
      quantity: Math.max(1, quantity),
      currencies: ['USD', 'MWK'],
      prices: { USD: usd, MWK: mwk },
    });
  }

  return rooms.length > 0 ? rooms : null;
}

function parseRoomDetailsFromLine(line: string): RoomInput | null {
  const trimmed = line.replace(/^[\s•*\-–—]+/, '').replace(/^\d+[.)]\s+/, '').trim();
  if (!trimmed || trimmed.length < 3 || trimmed.length > 220) return null;

  if (NON_ROOM_SERVICE_REGEX.test(trimmed)) return null;

  const { usd, mwk, hasPrice, cleanedText } = extractRoomPricesFromLine(trimmed);
  const hasRoomKeyword = ROOM_KEYWORD_REGEX.test(trimmed);

  // Must either have a room keyword + price, or a clear room keyword in a rate list, or a short title with a price
  if (!hasPrice && !hasRoomKeyword) return null;

  // If no price is present, only accept lines that strongly look like a room type entry (not a prose sentence or section heading)
  if (!hasPrice) {
    if (/:$/.test(trimmed) || GENERIC_DOC_HEADERS.some(rx => rx.test(trimmed))) {
      return null;
    }
    if (/\b(welcome|located|situated|offers?|enjoy|experience|nestled|featuring|contact|please|check[\s-]?in|breakfast\s+included|swimming\s+pool|free\s+wifi)\b/i.test(trimmed)) {
      return null;
    }
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount > 16 || /[.!?]$/.test(trimmed)) {
      return null;
    }
  }

  let working = cleanedText;

  // Extract maxGuests (e.g. "Sleeps 4", "Max 2 guests", "2 pax", "up to 3 guests")
  let maxGuests = 2;
  let explicitGuestsFound = false;
  const guestPatterns = [
    /\b(?:sleeps?|max(?:\s+guests?)?|up\s+to|accommodates?|capacity)\s*[:\-]?\s*(\d{1,2})\s*(?:guests?|pax|people|persons?|adults?)?\b/i,
    /\b(\d{1,2})\s*(?:guests?|pax|persons?|people)\b/i,
  ];
  for (const gp of guestPatterns) {
    const m = working.match(gp);
    if (m) {
      const val = parseInt(m[1], 10);
      if (val >= 1 && val <= 30) {
        maxGuests = val;
        explicitGuestsFound = true;
        working = working.replace(m[0], ' ');
        break;
      }
    }
  }

  if (!explicitGuestsFound) {
    if (/\b(three[\s-]bedroom|3[\s-]bedroom|3\s*bed)\b/i.test(working)) maxGuests = 6;
    else if (/\b(family|two[\s-]bedroom|2[\s-]bedroom|quad)\b/i.test(working)) maxGuests = 4;
    else if (/\b(triple|3\s*sleeper)\b/i.test(working)) maxGuests = 3;
    else if (/\b(single|solo)\b/i.test(working)) maxGuests = 1;
    else maxGuests = 2;
  }

  // Extract quantity (e.g. "4 rooms", "3 units", "2 chalets", "qty: 5", "x3")
  let quantity = 1;
  const qtyPatterns = [
    /\b(\d{1,3})\s*(?:rooms?|units?|chalets?|suites?|tents?|cottages?|villas?|bungalows?)\s*(?:available)?\b/i,
    /\b(?:qty|quantity|units?)\s*[:\-]?\s*(\d{1,3})\b/i,
    /\bx\s*(\d{1,2})\b/i,
  ];
  for (const qp of qtyPatterns) {
    const m = working.match(qp);
    if (m) {
      const val = parseInt(m[1], 10);
      if (val >= 1 && val <= 200) {
        quantity = val;
        working = working.replace(m[0], ' ');
        break;
      }
    }
  }

  // Clean empty brackets/parentheses left behind
  working = working
    .replace(/\(\s*[,/|•\-]*\s*\)/g, '')
    .replace(/\[\s*[,/|•\-]*\s*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Split name and inline description if separated by " - ", " – ", " — ", or ": "
  let roomName = working;
  let description = '';

  const sepMatch = working.match(/^([^:\-–—]{3,65})\s*[:\-–—]\s*(.+)$/);
  if (sepMatch) {
    roomName = sepMatch[1].trim();
    description = sepMatch[2].trim();
  }

  roomName = roomName
    .replace(/^[\s•*\-–—:|/]+/, '')
    .replace(/[\s•*\-–—:|/,]+$/, '')
    .trim();

  if (!roomName || roomName.length < 2) return null;
  if (!hasPrice && (roomName.split(/\s+/).length > 6 || !ROOM_KEYWORD_REGEX.test(roomName))) return null;

  // Reject if roomName is actually a metadata label
  if (/^(property|hotel|lodge|location|address|owner|manager|contact|phone|tel|whatsapp|email|check[\s-]?in|check[\s-]?out|amenities|facilities|website)\b/i.test(roomName)) {
    return null;
  }

  return {
    name: roomName.slice(0, 80),
    description: description.replace(/^[\s•*\-–—:|/,]+|[\s•*\-–—:|/]+$/g, '').trim(),
    maxGuests,
    baseGuests: Math.min(2, maxGuests),
    quantity,
    currencies: ['USD', 'MWK'],
    prices: {
      USD: usd,
      MWK: mwk,
    },
  };
}

/**
 * Fast, zero-credit, deterministic in-browser parser that extracts structured property
 * onboarding data (`Partial<ListingDraft>`) from pasted rate sheets, hotel brochures,
 * WhatsApp price lists, CSVs, or general documents.
 */
export function parsePropertyText(rawText: string): ParsedPropertyResult {
  if (!rawText || !rawText.trim()) {
    return {};
  }

  const lines = rawText.split(/\r?\n/).map(l => l.trim());
  const nonEmptyLines = lines.filter(Boolean);

  let name = '';
  let location = '';
  let locationNotes = '';
  let ownerName = '';
  let ownerPhone = '';
  let ownerEmail = '';
  let managerName = '';
  let managerPhone = '';
  let managerEmail = '';
  let contactPhone = '';
  let contactWhatsapp = '';
  let contactEmail = '';
  let checkInTime = '';
  let checkOutTime = '';
  let explicitDescription = '';
  const descriptionSentences: string[] = [];

  const consumedLineIndices = new Set<number>();

  // 1. Scan for labeled metadata lines first
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Property Name label
    const nameMatch = line.match(/^(?:property\s*name|hotel\s*name|lodge\s*name|resort\s*name|stay\s*name|property|hotel|lodge|resort|guest\s*house|b&b)\s*[:\-–]\s*(.+)$/i);
    if (nameMatch && !name) {
      const candidate = nameMatch[1].replace(/^[#*]+|[#*]+$/g, '').trim();
      if (candidate.length >= 2) {
        name = candidate.slice(0, NAME_MAX);
        consumedLineIndices.add(i);
        continue;
      }
    }

    // Location / Address label
    const locMatch = line.match(/^(?:location|address|situated\s+in|located\s+(?:in|at)|town|city|region)\s*[:\-–]\s*(.+)$/i);
    if (locMatch && !location) {
      location = locMatch[1].trim();
      consumedLineIndices.add(i);
      continue;
    }

    // Directions / Access / Location Notes label
    const dirMatch = line.match(/^(?:directions|access|getting\s+there|getting\s+here|location\s+notes|how\s+to\s+find\s+us|landmark)\s*[:\-–]\s*(.+)$/i);
    if (dirMatch) {
      locationNotes = locationNotes ? `${locationNotes}. ${dirMatch[1].trim()}` : dirMatch[1].trim();
      consumedLineIndices.add(i);
      continue;
    }

    // Check-in / Check-out (can appear on the same line or separate lines)
    if (/\bcheck[\s-]?in\b/i.test(line) || /\bcheck[\s-]?out\b/i.test(line)) {
      const ciSegment = line.match(/\bcheck[\s-]?in(?:\s+time|\s+from)?\s*[:\-–]?\s*([0-9]{1,2}(?:[:.h][0-9]{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?)/i);
      if (ciSegment && !checkInTime) {
        const parsedCi = normalizeTimeString(ciSegment[1]);
        if (parsedCi) checkInTime = parsedCi;
      }
      const coSegment = line.match(/\bcheck[\s-]?out(?:\s+time|\s+by|\s+until|\s+before)?\s*[:\-–]?\s*([0-9]{1,2}(?:[:.h][0-9]{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?)/i);
      if (coSegment && !checkOutTime) {
        const parsedCo = normalizeTimeString(coSegment[1]);
        if (parsedCo) checkOutTime = parsedCo;
      }
      consumedLineIndices.add(i);
      continue;
    }

    // Owner line
    const ownerMatch = line.match(/^(?:owner(?:\s*name)?|proprietor|owned\s+by|director|managing\s+director)\s*[:\-–]\s*(.+)$/i);
    if (ownerMatch) {
      const rest = ownerMatch[1].trim();
      const phones = extractPhoneNumbersFromLine(rest);
      const emails = extractEmailsFromLine(rest);
      if (phones[0] && !ownerPhone) ownerPhone = phones[0];
      if (emails[0] && !ownerEmail) ownerEmail = emails[0];
      const cleanedName = cleanPersonName(rest);
      if (cleanedName && !ownerName) ownerName = cleanedName;
      consumedLineIndices.add(i);
      continue;
    }

    // Manager / Host line
    const mgrMatch = line.match(/^(?:(?:general\s+|property\s+|reservations\s+)?manager(?:\s*name)?|host(?:\s*name)?|contact\s+person|managed\s+by)\s*[:\-–]\s*(.+)$/i);
    if (mgrMatch) {
      const rest = mgrMatch[1].trim();
      const phones = extractPhoneNumbersFromLine(rest);
      const emails = extractEmailsFromLine(rest);
      if (phones[0] && !managerPhone) managerPhone = phones[0];
      if (emails[0] && !managerEmail) managerEmail = emails[0];
      const cleanedName = cleanPersonName(rest);
      if (cleanedName && !managerName) managerName = cleanedName;
      consumedLineIndices.add(i);
      continue;
    }

    // Explicit Description / Overview line
    const descMatch = line.match(/^(?:description|overview|about(?:\s+us|\s+the\s+property)?|summary)\s*[:\-–]\s*(.+)$/i);
    if (descMatch) {
      explicitDescription = explicitDescription
        ? `${explicitDescription} ${descMatch[1].trim()}`
        : descMatch[1].trim();
      consumedLineIndices.add(i);
      continue;
    }

    // Phone / WhatsApp / Email contact lines
    const linePhones = extractPhoneNumbersFromLine(line);
    const lineEmails = extractEmailsFromLine(line);
    if (linePhones.length > 0 || lineEmails.length > 0) {
      const isWaLine = /\b(whatsapp|whats\s*app|\bwa\b)\b/i.test(line);
      const isOwnerLine = /\b(owner|proprietor|director)\b/i.test(line);
      const isMgrLine = /\b(manager|host)\b/i.test(line);

      for (const p of linePhones) {
        if (isWaLine && !contactWhatsapp) {
          contactWhatsapp = p;
        } else if (isOwnerLine && !ownerPhone) {
          ownerPhone = p;
        } else if (isMgrLine && !managerPhone) {
          managerPhone = p;
        } else if (!contactPhone) {
          contactPhone = p;
        } else if (!contactWhatsapp) {
          contactWhatsapp = p;
        }
      }

      for (const em of lineEmails) {
        if (isOwnerLine && !ownerEmail) {
          ownerEmail = em;
        } else if (isMgrLine && !managerEmail) {
          managerEmail = em;
        } else if (!contactEmail) {
          contactEmail = em;
        }
      }

      // If this line is predominantly contact info, mark it consumed so it isn't mistaken for a room or title
      if (/^(?:tel|phone|mobile|cell|call|whatsapp|wa|email|e-mail|contact|bookings?|reservations?|reception|front\s+desk)\b/i.test(line) || lineEmails.length > 0) {
        consumedLineIndices.add(i);
      }
    }
  }

  // Fallback contact cascading so fields are well-populated when only one phone/email is given
  if (!contactPhone && (contactWhatsapp || managerPhone || ownerPhone)) {
    contactPhone = contactWhatsapp || managerPhone || ownerPhone;
  }
  if (!contactWhatsapp && contactPhone) {
    contactWhatsapp = contactPhone;
  }
  if (!contactEmail && (managerEmail || ownerEmail)) {
    contactEmail = managerEmail || ownerEmail;
  }

  // 2. If property name wasn't explicitly labeled, find the first prominent title line
  if (!name && nonEmptyLines.length > 0) {
    for (let i = 0; i < Math.min(lines.length, 8); i++) {
      if (consumedLineIndices.has(i)) continue;
      const rawLine = lines[i];
      if (!rawLine) continue;

      const cleanedTitle = rawLine
        .replace(/^#{1,4}\s*/, '')
        .replace(/^\*{1,2}|\*{1,2}$/g, '')
        .replace(/\s*[-–—|]\s*(?:rate\s*sheet|price\s*list|tariffs?|20\d{2}).*$/i, '')
        .trim();

      if (!cleanedTitle || cleanedTitle.length < 3 || cleanedTitle.length > NAME_MAX) continue;
      if (GENERIC_DOC_HEADERS.some(rx => rx.test(cleanedTitle))) continue;
      if (extractRoomPricesFromLine(cleanedTitle).hasPrice) continue;
      if (extractPhoneNumbersFromLine(cleanedTitle).length > 0 || extractEmailsFromLine(cleanedTitle).length > 0) continue;
      if (/^(?:amenities|facilities|rooms|rates|accommodation|included)\s*:?$/i.test(cleanedTitle)) continue;

      name = cleanedTitle;
      consumedLineIndices.add(i);
      break;
    }
  }

  // 3. Detect Location from Malawi hubs if not explicitly set
  if (!location) {
    for (const hub of MALAWI_HUB_MATCHERS) {
      if (hub.pattern.test(rawText)) {
        location = hub.canonical;
        break;
      }
    }
  } else {
    // Enrich Area 43 / Area 10 / Area 11 / Area 3 with ", Lilongwe" if missing city
    if (/^area\s*\d+$/i.test(location.trim())) {
      location = `${location.trim()}, Lilongwe`;
    }
  }

  // 4. Detect Category, Categories & StayType
  const { category, categories, stayType } = detectCategoriesAndStayType(rawText, name);

  // 5. Extract Amenities
  const matchedAmenities = new Set<string>();
  for (const canonical of COMMON_AMENITIES) {
    const escaped = canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(rawText)) {
      matchedAmenities.add(canonical);
    }
  }
  for (const syn of AMENITY_SYNONYMS) {
    if (syn.pattern.test(rawText)) {
      matchedAmenities.add(syn.amenity);
    }
  }

  // 6. Parse Rooms
  let rooms: RoomInput[] = [];
  const delimitedRooms = tryParseDelimitedRooms(rawText);
  if (delimitedRooms && delimitedRooms.length > 0) {
    rooms = delimitedRooms;
  } else {
    for (let i = 0; i < lines.length; i++) {
      if (consumedLineIndices.has(i)) continue;
      const line = lines[i];
      if (!line) continue;

      // Skip obvious section headers like "ROOMS & RATES:" or "AMENITIES:"
      if (/^(?:#{1,4}\s*)?(?:rooms?(?:\s*&\s*rates?)?|accommodation|rates?|tariffs?|amenities|facilities|features|included|policies|house\s+rules|contact(?:\s+details)?)\s*:?$/i.test(line)) {
        consumedLineIndices.add(i);
        continue;
      }

      const parsedRoom = parseRoomDetailsFromLine(line);
      if (parsedRoom) {
        consumedLineIndices.add(i);

        // Check if the immediate next line has the price (for multi-line room blocks) or a room description
        if (i + 1 < lines.length && !consumedLineIndices.has(i + 1)) {
          const nextLine = lines[i + 1];
          if (nextLine) {
            const nextPrice = extractRoomPricesFromLine(nextLine);
            if (!parsedRoom.prices?.USD && !parsedRoom.prices?.MWK && nextPrice.hasPrice && !ROOM_KEYWORD_REGEX.test(nextPrice.cleanedText)) {
              parsedRoom.prices = { USD: nextPrice.usd, MWK: nextPrice.mwk };
              if (!parsedRoom.description && nextPrice.cleanedText.length >= 6) {
                parsedRoom.description = nextPrice.cleanedText.replace(/^[\s•*\-–—:|/]+/, '').trim();
              }
              consumedLineIndices.add(i + 1);
              i++;
            } else if (
              !parsedRoom.description &&
              nextLine.length >= 12 &&
              nextLine.length <= 180 &&
              !nextPrice.hasPrice &&
              !extractPhoneNumbersFromLine(nextLine).length &&
              !extractEmailsFromLine(nextLine).length &&
              !/^(?:owner|manager|location|address|check[\s-]?in|check[\s-]?out|amenities|facilities)\s*:/i.test(nextLine) &&
              !parseRoomDetailsFromLine(nextLine)
            ) {
              parsedRoom.description = nextLine.replace(/^[\s•*\-–—]+/, '').trim();
              consumedLineIndices.add(i + 1);
              i++;
            }
          }
        }

        rooms.push(parsedRoom);
      }
    }
  }

  // 7. Extract Overview Description if present
  for (let i = 0; i < lines.length; i++) {
    if (consumedLineIndices.has(i)) continue;
    const line = lines[i];
    if (!line || line.length < 35) continue;
    if (extractRoomPricesFromLine(line).hasPrice) continue;
    if (extractPhoneNumbersFromLine(line).length > 0 || extractEmailsFromLine(line).length > 0) continue;
    if (/^(?:amenities|facilities|includes|rates\s+include)\s*[:\-]/i.test(line)) continue;

    // Looks like a natural descriptive sentence or paragraph
    if (/[a-z]{3,}/i.test(line) && line.split(/\s+/).length >= 6) {
      descriptionSentences.push(line.replace(/^[\s•*\-–—]+/, '').trim());
    }
  }

  const finalDescription = [explicitDescription, ...descriptionSentences]
    .filter(Boolean)
    .join(' ')
    .slice(0, 2000)
    .trim();

  const result: ParsedPropertyResult = {};
  if (name) result.name = name;
  if (category) result.category = category;
  if (categories.length > 0) result.categories = categories;
  if (stayType) result.stayType = stayType;
  if (location) result.location = location;
  if (locationNotes) result.locationNotes = locationNotes;
  if (finalDescription) result.description = finalDescription;
  if (ownerName) result.ownerName = ownerName;
  if (ownerPhone) result.ownerPhone = ownerPhone;
  if (ownerEmail) result.ownerEmail = ownerEmail;
  if (managerName) result.managerName = managerName;
  if (managerPhone) result.managerPhone = managerPhone;
  if (managerEmail) result.managerEmail = managerEmail;
  if (contactPhone) result.contactPhone = contactPhone;
  if (contactWhatsapp) result.contactWhatsapp = contactWhatsapp;
  if (contactEmail) result.contactEmail = contactEmail;
  if (checkInTime) result.checkInTime = checkInTime;
  if (checkOutTime) result.checkOutTime = checkOutTime;
  if (matchedAmenities.size > 0) result.amenities = Array.from(matchedAmenities);
  if (rooms.length > 0) result.rooms = rooms;

  return result;
}
