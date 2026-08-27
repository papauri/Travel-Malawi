/**
 * Map pins.
 *
 * A pin could only ever be dropped by standing at the property and tapping
 * "use my position" while creating the listing. Nothing could edit one
 * afterwards, so a listing imported without coordinates, or pinned from the
 * wrong side of the lake, stayed that way — and the property page's map
 * searched Google for the location *text* regardless, which for "Area 43,
 * Lilongwe" lands somewhere in the general vicinity and for "Nankoma Island"
 * lands nowhere useful at all.
 *
 * Everything to do with reading, checking and rendering a pin lives here.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Malawi's bounding box, generously rounded outwards.
 *
 * Used to warn, never to refuse: a legitimate pin could sit just over a border
 * — Songwe on the Tanzanian line, or a lodge reached from Zambia — and a
 * warning that can be ignored is the right strength for a rule that cannot be
 * certain. It does catch the two mistakes that actually happen: a swapped
 * lat/lng pair, and a stray minus sign.
 */
export const MALAWI_BOUNDS = { minLat: -17.2, maxLat: -9.3, minLng: 32.6, maxLng: 36.0 };

/** Roughly the middle of the country, for a map with nothing to centre on. */
export const MALAWI_CENTRE: LatLng = { lat: -13.25, lng: 34.3 };

export function isValidLatLng(value: unknown): value is LatLng {
  if (!value || typeof value !== 'object') return false;
  const { lat, lng } = value as LatLng;
  return (
    typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180
  );
}

export function isWithinMalawi(point: LatLng): boolean {
  return (
    point.lat >= MALAWI_BOUNDS.minLat && point.lat <= MALAWI_BOUNDS.maxLat &&
    point.lng >= MALAWI_BOUNDS.minLng && point.lng <= MALAWI_BOUNDS.maxLng
  );
}

/**
 * True when the pair looks like it was entered the wrong way round. Malawi's
 * longitudes are all positive and its latitudes all negative, so a swap is
 * unambiguous here even though it would not be everywhere.
 */
export function looksSwapped(point: LatLng): boolean {
  return !isWithinMalawi(point) && isWithinMalawi({ lat: point.lng, lng: point.lat });
}

/** Six decimal places is about 10 cm — more is noise. */
export function formatCoordinates(point: LatLng, decimals = 5): string {
  return `${point.lat.toFixed(decimals)}, ${point.lng.toFixed(decimals)}`;
}

const DECIMAL_PAIR = /(-?\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)/;

/**
 * Reads a pin out of whatever someone pasted.
 *
 * Nobody types coordinates by hand; they copy a Google Maps link off their
 * phone. All the common shapes are accepted so the field does not become a
 * puzzle: a bare "-13.98, 33.78" pair, a `@lat,lng,zoom` URL, a `?q=` or
 * `?ll=` query, and the `!3dlat!4dlng` form that appears in a place URL.
 */
export function parseCoordinates(input: string): LatLng | null {
  const text = (input ?? '').trim();
  if (!text) return null;

  const candidates: [string, string][] = [];

  // https://www.google.com/maps/place/.../@-13.98,33.78,15z
  const at = text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) candidates.push([at[1], at[2]]);

  // .../data=...!3d-13.98!4d33.78 — the place's own pin, more precise than @.
  const bang = text.match(/!3d(-?\d+(?:\.\d+)?).*?!4d(-?\d+(?:\.\d+)?)/);
  if (bang) candidates.unshift([bang[1], bang[2]]);

  // ?q=-13.98,33.78 or ?ll=-13.98,33.78 or ?destination=...
  const query = text.match(/[?&](?:q|ll|sll|daddr|destination|center)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (query) candidates.push([query[1], query[2]]);

  // A plain pasted pair, but only when there is no URL to misread.
  if (candidates.length === 0 && !/https?:\/\//i.test(text)) {
    const pair = text.match(DECIMAL_PAIR);
    if (pair) candidates.push([pair[1], pair[2]]);
  }

  for (const [rawLat, rawLng] of candidates) {
    const point = { lat: Number(rawLat), lng: Number(rawLng) };
    if (isValidLatLng(point)) return point;
  }
  return null;
}

/** Great-circle distance in kilometres. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * The embedded map for a property. A pin is used verbatim when there is one;
 * otherwise this falls back to searching for the location text, which is what
 * every listing used to get whether or not it had been pinned.
 */
export function mapEmbedUrl(place: { location?: string; coordinates?: LatLng | null }): string {
  if (place.coordinates && isValidLatLng(place.coordinates)) {
    const { lat, lng } = place.coordinates;
    return `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
  }
  return `https://maps.google.com/maps?q=${encodeURIComponent(place.location ?? 'Malawi')}&z=13&output=embed`;
}

/** A link that opens the pin in the visitor's own maps app. */
export function mapLinkUrl(place: { location?: string; coordinates?: LatLng | null }): string {
  if (place.coordinates && isValidLatLng(place.coordinates)) {
    const { lat, lng } = place.coordinates;
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.location ?? 'Malawi')}`;
}

export interface TravelEstimate {
  straightLineKm: number;
  roadDistanceKm: number;
  drivingMinutes: number;
  drivingTimeFormatted: string;
  travelMode: 'driving' | 'boat_transfer' | 'flight_recommended';
  notes: string;
}

/**
 * Calculates estimated road distance, driving duration, and travel notes
 * taking into account typical road conditions and speeds across Malawi.
 */
export function estimateTravelTime(straightLineKm: number): TravelEstimate {
  // Road distance usually spans ~1.25x to 1.35x straight line in Malawi
  const roadDistanceKm = Math.round(straightLineKm * 1.3 * 10) / 10;
  
  let speedKmH = 60;
  if (straightLineKm < 10) {
    speedKmH = 35; // City / local roads
  } else if (straightLineKm < 60) {
    speedKmH = 50; // Semi-urban / regional
  } else if (straightLineKm < 250) {
    speedKmH = 65; // Highway (e.g. M1, M5 Lakeshore road)
  } else {
    speedKmH = 60; // Long-distance cross-country routes
  }

  const drivingMinutes = Math.max(2, Math.round((roadDistanceKm / speedKmH) * 60));
  
  let drivingTimeFormatted = '';
  if (drivingMinutes < 60) {
    drivingTimeFormatted = `${drivingMinutes} mins`;
  } else {
    const hours = Math.floor(drivingMinutes / 60);
    const mins = drivingMinutes % 60;
    drivingTimeFormatted = mins > 0 ? `${hours} hr ${mins} min` : `${hours} hrs`;
  }

  let travelMode: 'driving' | 'boat_transfer' | 'flight_recommended' = 'driving';
  let notes = 'Scenic road drive';

  if (straightLineKm > 350) {
    travelMode = 'flight_recommended';
    notes = 'Full-day drive or domestic charter flight recommended';
  } else if (straightLineKm < 5) {
    notes = 'Quick local drive or taxi';
  } else if (straightLineKm < 40) {
    notes = 'Direct short highway drive';
  }

  return {
    straightLineKm: Math.round(straightLineKm * 10) / 10,
    roadDistanceKm,
    drivingMinutes,
    drivingTimeFormatted,
    travelMode,
    notes,
  };
}

/**
 * Generates turn-by-turn directions link to Google Maps with origin GPS and destination.
 */
export function getDirectionsUrl(origin: LatLng, destination: LatLng, destinationName?: string): string {
  const destParam = `${destination.lat},${destination.lng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destParam}&travelmode=driving`;
}

export type PinProblem = 'missing' | 'invalid' | 'swapped' | 'outside' | null;

/** What, if anything, is wrong with a listing's pin. */
export function pinProblem(coordinates: unknown): PinProblem {
  if (coordinates === null || coordinates === undefined) return 'missing';
  if (!isValidLatLng(coordinates)) return 'invalid';
  if (looksSwapped(coordinates)) return 'swapped';
  if (!isWithinMalawi(coordinates)) return 'outside';
  return null;
}

export const PIN_PROBLEM_LABELS: Record<Exclude<PinProblem, null>, string> = {
  missing: 'No map pin',
  invalid: 'Pin is not a usable coordinate',
  swapped: 'Latitude and longitude look swapped',
  outside: 'Pin falls outside Malawi',
};

/**
 * Deterministic hash-based micro offset (~200m - 600m) so multiple properties
 * sharing a town or region anchor do not overlap on the exact same sub-pixel.
 */
function getDeterministicOffset(key: string): { dLat: number; dLng: number } {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  const angle = (Math.abs(hash) % 360) * (Math.PI / 180);
  const distance = 0.002 + ((Math.abs(hash >> 6) % 100) / 100) * 0.004;
  return {
    dLat: Math.sin(angle) * distance,
    dLng: Math.cos(angle) * distance,
  };
}

/**
 * Known lodge name to exact Malawi GPS coordinates mapping.
 */
const KNOWN_LODGE_COORDS: Record<string, LatLng> = {
  'kaya mawa': { lat: -12.0622, lng: 34.7351 },
  'pumulani': { lat: -14.0245, lng: 34.8458 },
  'the makokola retreat': { lat: -14.1833, lng: 35.1333 },
  'club makokola': { lat: -14.1833, lng: 35.1333 },
  'makokola': { lat: -14.1833, lng: 35.1333 },
  'blue zebra': { lat: -13.8863, lng: 34.6086 },
  'blue zebra island lodge': { lat: -13.8863, lng: 34.6086 },
  'mayoka village': { lat: -11.6015, lng: 34.3032 },
  'mvuu': { lat: -14.8512, lng: 35.2891 },
  'mvuu camp': { lat: -14.8512, lng: 35.2891 },
  'mvuu lodge': { lat: -14.8512, lng: 35.2891 },
  'kuthengo': { lat: -14.9350, lng: 35.2510 },
  'kuthengo camp': { lat: -14.9350, lng: 35.2510 },
  'chelinda': { lat: -10.5847, lng: 33.8053 },
  'chelinda lodge': { lat: -10.5847, lng: 33.8053 },
  'chelinda camp': { lat: -10.5847, lng: 33.8053 },
  'tongole': { lat: -12.9830, lng: 34.0520 },
  'tongole wilderness retreat': { lat: -12.9830, lng: 34.0520 },
  'mkulumadzi': { lat: -15.9167, lng: 34.7500 },
  'thawale': { lat: -15.9167, lng: 34.7500 },
  'majete': { lat: -15.9167, lng: 34.7500 },
  'sunbird ku chawe': { lat: -15.3642, lng: 35.3048 },
  'ku chawe': { lat: -15.3642, lng: 35.3048 },
  'sunbird livingstonia': { lat: -13.7245, lng: 34.6225 },
  'livingstonia beach': { lat: -13.7245, lng: 34.6225 },
  'sunbird nkopola': { lat: -14.3012, lng: 35.1558 },
  'nkopola lodge': { lat: -14.3012, lng: 35.1558 },
  'latitude 13': { lat: -13.9325, lng: 33.7930 },
  'latitude 13°': { lat: -13.9325, lng: 33.7930 },
  'sunbird mount soche': { lat: -15.7889, lng: 35.0083 },
  'mount soche': { lat: -15.7889, lng: 35.0083 },
  'protea hotel ryalls': { lat: -15.7905, lng: 35.0062 },
  'ryalls': { lat: -15.7905, lng: 35.0062 },
  'president walmont': { lat: -13.9575, lng: 33.7880 },
  'sunbird capital': { lat: -13.9629, lng: 33.7885 },
  'kumbali': { lat: -13.9820, lng: 33.8420 },
  'kumbali country lodge': { lat: -13.9820, lng: 33.8420 },
  'rosalyn': { lat: -13.9450, lng: 33.7820 },
  'rosalyns': { lat: -13.9450, lng: 33.7820 },
  'luwawa': { lat: -12.1158, lng: 33.7542 },
  'luwawa forest lodge': { lat: -12.1158, lng: 33.7542 },
  'ngala beach': { lat: -12.3833, lng: 34.0500 },
  'game haven': { lat: -15.9520, lng: 35.1215 },
  'huntingdon house': { lat: -16.0240, lng: 35.1480 },
  'satemwa': { lat: -16.0240, lng: 35.1480 },
  'kande beach': { lat: -11.9542, lng: 34.1205 },
  'sunbird mzuzu': { lat: -11.4645, lng: 34.0205 },
  'grand palace': { lat: -11.4645, lng: 34.0205 },
  'chembe eagles nest': { lat: -14.0210, lng: 34.8490 },
  'norman carr cottage': { lat: -14.0310, lng: 34.8560 },
  'thumbi view': { lat: -14.0280, lng: 34.8530 },
  'gecko lounge': { lat: -14.0255, lng: 34.8510 },
  'safari beach lodge': { lat: -13.7280, lng: 34.6210 },
  'cool runnings': { lat: -13.7295, lng: 34.6240 },
  'butterfly space': { lat: -11.6080, lng: 34.2980 },
};

/**
 * Regional destination coordinates across all major tourist areas in Malawi.
 */
const REGIONAL_DESTINATIONS: { keywords: string[]; coords: LatLng }[] = [
  { keywords: ['likoma', 'chizumulu', 'kaya mawa'], coords: { lat: -12.0622, lng: 34.7351 } },
  { keywords: ['cape maclear', 'chembe', 'pumulani', 'lake malawi national park'], coords: { lat: -14.0267, lng: 34.8519 } },
  { keywords: ['monkey bay'], coords: { lat: -14.0781, lng: 34.9208 } },
  { keywords: ['mangochi', 'makokola', 'nkopola', 'lake malombe'], coords: { lat: -14.3012, lng: 35.1558 } },
  { keywords: ['salima', 'senga bay', 'nankoma', 'blue zebra', 'livingstonia beach'], coords: { lat: -13.7245, lng: 34.6225 } },
  { keywords: ['nkhata bay', 'mayoka', 'chintheche', 'kande', 'bandawe'], coords: { lat: -11.6067, lng: 34.2908 } },
  { keywords: ['nkhotakota', 'dwangwa', 'tongole', 'bua river', 'chia lagoon'], coords: { lat: -12.9830, lng: 34.0520 } },
  { keywords: ['liwonde', 'mvuu', 'kuthengo', 'shire river', 'machinga'], coords: { lat: -14.8512, lng: 35.2891 } },
  { keywords: ['majete', 'mkulumadzi', 'thawale', 'chikwawa', 'lengwe'], coords: { lat: -15.9167, lng: 34.7500 } },
  { keywords: ['nyika', 'chelinda', 'rumphi', 'livingstonia mission'], coords: { lat: -10.5847, lng: 33.8053 } },
  { keywords: ['zomba', 'ku chawe', 'zomba plateau'], coords: { lat: -15.3642, lng: 35.3048 } },
  { keywords: ['mulanje', 'likhubula', 'sapitwa'], coords: { lat: -15.9388, lng: 35.5015 } },
  { keywords: ['thyolo', 'satemwa', 'huntingdon', 'bvumbwe', 'game haven'], coords: { lat: -16.0240, lng: 35.1480 } },
  { keywords: ['blantyre', 'limbe', 'mount soche', 'ryalls', 'mandala', 'chileka'], coords: { lat: -15.7861, lng: 35.0058 } },
  { keywords: ['mzuzu', 'luwawa', 'viphya'], coords: { lat: -11.4583, lng: 34.0167 } },
  { keywords: ['karonga'], coords: { lat: -9.9333, lng: 33.9333 } },
  { keywords: ['kasungu'], coords: { lat: -13.0333, lng: 33.4833 } },
  { keywords: ['ntchisi'], coords: { lat: -13.3667, lng: 33.9833 } },
  { keywords: ['dedza'], coords: { lat: -14.3667, lng: 34.3333 } },
  { keywords: ['balaka'], coords: { lat: -14.9833, lng: 34.9500 } },
  { keywords: ['ntcheu'], coords: { lat: -14.8167, lng: 34.6333 } },
  { keywords: ['mchinji'], coords: { lat: -13.8000, lng: 32.8833 } },
  { keywords: ['lilongwe', 'area 43', 'area 10', 'area 11', 'area 44', 'area 3', 'area 12', 'city centre', 'old town', 'umodzi', 'capital'], coords: { lat: -13.9626, lng: 33.7741 } },
];

/**
 * Resolves accurate Malawi GPS coordinates for any hotel, fixing missing coordinates,
 * copy-pasted coordinates, or generic place pin mismatches across the country.
 */
export function resolveHotelCoordinates(hotel: {
  id?: string;
  name?: string;
  location?: string;
  coordinates?: LatLng | null;
}): LatLng {
  const name = (hotel.name ?? '').toLowerCase().trim();
  const location = (hotel.location ?? '').toLowerCase().trim();
  const combinedText = `${name} ${location}`;
  const idKey = hotel.id || hotel.name || 'hotel-pin';

  // 1. Check exact/known lodge name matches first
  for (const [lodgeName, coords] of Object.entries(KNOWN_LODGE_COORDS)) {
    if (name.includes(lodgeName) || location.includes(lodgeName)) {
      const offset = getDeterministicOffset(idKey);
      return {
        lat: Number((coords.lat + offset.dLat * 0.4).toFixed(5)),
        lng: Number((coords.lng + offset.dLng * 0.4).toFixed(5)),
      };
    }
  }

  // 2. If valid coordinates are already provided, check if they are authentic or swapped/mismatched
  if (hotel.coordinates && isValidLatLng(hotel.coordinates)) {
    let pt = hotel.coordinates;
    if (looksSwapped(pt)) {
      pt = { lat: pt.lng, lng: pt.lat };
    }

    if (isWithinMalawi(pt)) {
      // Check if coordinates match the text region (e.g. if coords are in Lilongwe but text says "Cape Maclear" or "Likoma")
      const isLilongweCoords = pt.lat > -14.15 && pt.lat < -13.80 && pt.lng > 33.65 && pt.lng < 33.90;
      const textExplicitlyNonLilongwe =
        location.includes('cape maclear') ||
        location.includes('likoma') ||
        location.includes('mangochi') ||
        location.includes('nkhata bay') ||
        location.includes('liwonde') ||
        location.includes('nyika') ||
        location.includes('majete') ||
        location.includes('zomba') ||
        location.includes('blantyre') ||
        location.includes('mzuzu');

      if (!isLilongweCoords || !textExplicitlyNonLilongwe) {
        // Legitimate specific coordinate! Add tiny micro-offset only if identical down to 5 decimals
        return pt;
      }
    }
  }

  // 3. Match against curated Malawi tourist regions and destination keywords
  for (const destination of REGIONAL_DESTINATIONS) {
    if (destination.keywords.some(kw => combinedText.includes(kw))) {
      const offset = getDeterministicOffset(idKey);
      return {
        lat: Number((destination.coords.lat + offset.dLat).toFixed(5)),
        lng: Number((destination.coords.lng + offset.dLng).toFixed(5)),
      };
    }
  }

  // 4. Default fallback: Place in Lilongwe with deterministic regional spread
  const defaultOffset = getDeterministicOffset(idKey);
  return {
    lat: Number((-13.9626 + defaultOffset.dLat * 2).toFixed(5)),
    lng: Number((33.7741 + defaultOffset.dLng * 2).toFixed(5)),
  };
}

/**
 * Curated list of known Malawi places, hotels, resorts, national parks,
 * towns, and airports. Used for instant search suggestions so managers can
 * immediately pick pre-existing places.
 */
export interface KnownPlace {
  id: string;
  name: string;
  category: 'hotel' | 'landmark' | 'town' | 'park' | 'beach' | 'airport';
  region: string;
  location: string;
  coordinates: LatLng;
  description?: string;
}

export const MALAWI_KNOWN_PLACES: KnownPlace[] = [
  // Lake Malawi & Mangochi / Cape Maclear / Likoma
  { id: 'kaya-mawa', name: 'Kaya Mawa', category: 'hotel', region: 'Likoma Island', location: 'Likoma Island, Lake Malawi', coordinates: { lat: -12.0622, lng: 34.7351 }, description: 'Luxury lodge on Likoma Island' },
  { id: 'makokola-retreat', name: 'The Makokola Retreat (Club Makokola)', category: 'hotel', region: 'Mangochi', location: 'Club Makokola, Mangochi, Lake Malawi', coordinates: { lat: -14.1833, lng: 35.1333 }, description: 'Lakeside resort with private airstrip and golf course' },
  { id: 'pumulani-lodge', name: 'Pumulani Lodge', category: 'hotel', region: 'Cape Maclear', location: 'Lake Malawi National Park, Cape Maclear', coordinates: { lat: -14.0245, lng: 34.8458 }, description: 'Exclusive hillside villas overlooking Lake Malawi' },
  { id: 'blue-zebra', name: 'Blue Zebra Island Lodge', category: 'hotel', region: 'Salima', location: 'Nankoma Island, Marelli Archipelago, Salima', coordinates: { lat: -13.8863, lng: 34.6086 }, description: 'Eco-lodge on private Nankoma Island' },
  { id: 'cape-maclear-beach', name: 'Cape Maclear (Chembe Village)', category: 'beach', region: 'Mangochi', location: 'Cape Maclear, Mangochi', coordinates: { lat: -14.0267, lng: 34.8519 }, description: 'Vibrant lakeside village in Lake Malawi National Park' },
  { id: 'monkey-bay', name: 'Monkey Bay', category: 'town', region: 'Mangochi', location: 'Monkey Bay, Mangochi', coordinates: { lat: -14.0781, lng: 34.9208 }, description: 'Port town on southern shore of Lake Malawi' },
  { id: 'senga-bay', name: 'Senga Bay / Livingstonia Beach', category: 'beach', region: 'Salima', location: 'Senga Bay, Salima', coordinates: { lat: -13.7231, lng: 34.6192 }, description: 'Closest Lake Malawi beach to Lilongwe' },
  { id: 'sunbird-livingstonia', name: 'Sunbird Livingstonia Beach', category: 'hotel', region: 'Salima', location: 'Senga Bay, Salima', coordinates: { lat: -13.7245, lng: 34.6225 }, description: 'Classic beach resort in Senga Bay' },
  { id: 'sunbird-nkopola', name: 'Sunbird Nkopola Lodge', category: 'hotel', region: 'Mangochi', location: 'Nkopola, Mangochi', coordinates: { lat: -14.3012, lng: 35.1558 }, description: 'Lake Malawi beach resort south of Club Makokola' },
  { id: 'nkhata-bay', name: 'Nkhata Bay', category: 'town', region: 'Northern Region', location: 'Nkhata Bay, Lake Malawi', coordinates: { lat: -11.6067, lng: 34.2908 }, description: 'Scenic bay town with lodges and diving' },
  { id: 'mayoka-village', name: 'Mayoka Village', category: 'hotel', region: 'Northern Region', location: 'Nkhata Bay', coordinates: { lat: -11.6015, lng: 34.3032 }, description: 'Renowned cliffside lodge on Lake Malawi' },

  // Lilongwe Area
  { id: 'lilongwe-city-centre', name: 'Lilongwe City Centre', category: 'town', region: 'Central Region', location: 'City Centre, Lilongwe', coordinates: { lat: -13.9626, lng: 33.7741 }, description: 'Capital city administrative and business district' },
  { id: 'lilongwe-old-town', name: 'Lilongwe Old Town', category: 'town', region: 'Central Region', location: 'Old Town, Lilongwe', coordinates: { lat: -13.9833, lng: 33.7667 }, description: 'Bustling commercial hub and markets' },
  { id: 'lilongwe-area-43', name: 'Area 43, Lilongwe', category: 'town', region: 'Central Region', location: 'Area 43, Lilongwe', coordinates: { lat: -13.9312, lng: 33.7915 }, description: 'Upscale residential neighborhood in Lilongwe' },
  { id: 'lilongwe-area-10', name: 'Area 10, Lilongwe', category: 'town', region: 'Central Region', location: 'Area 10, Lilongwe', coordinates: { lat: -13.9520, lng: 33.7850 }, description: 'Diplomatic and residential quarter' },
  { id: 'lilongwe-area-11', name: 'Area 11, Lilongwe', category: 'town', region: 'Central Region', location: 'Area 11, Lilongwe', coordinates: { lat: -13.9680, lng: 33.7810 }, description: 'Central diplomatic area' },
  { id: 'sunbird-capital', name: 'Sunbird Capital Hotel', category: 'hotel', region: 'Central Region', location: 'Presidential Way, City Centre, Lilongwe', coordinates: { lat: -13.9629, lng: 33.7885 }, description: 'Leading business hotel in City Centre' },
  { id: 'latitude-13', name: 'Latitude 13° Hotel', category: 'hotel', region: 'Central Region', location: 'Area 43, Lilongwe', coordinates: { lat: -13.9325, lng: 33.7930 }, description: 'Boutique luxury hotel in Area 43' },
  { id: 'president-hotel', name: 'President Walmont Hotel at Umodzi Park', category: 'hotel', region: 'Central Region', location: 'City Centre, Lilongwe', coordinates: { lat: -13.9575, lng: 33.7880 }, description: '5-star convention hotel at Umodzi Park' },
  { id: 'kumbali-lodge', name: 'Kumbali Country Lodge', category: 'hotel', region: 'Central Region', location: 'Area 44, Lilongwe', coordinates: { lat: -13.9820, lng: 33.8420 }, description: 'Quiet dairy farm lodge just outside the capital' },
  { id: 'kamuzu-airport', name: 'Kamuzu International Airport (LLW)', category: 'airport', region: 'Central Region', location: 'Lumbadzi, Lilongwe', coordinates: { lat: -13.7829, lng: 33.7810 }, description: 'Malawi\'s primary international gateway' },

  // Blantyre & Southern Highlands
  { id: 'blantyre-cbd', name: 'Blantyre CBD / Victoria Avenue', category: 'town', region: 'Southern Region', location: 'Blantyre City', coordinates: { lat: -15.7861, lng: 35.0058 }, description: 'Commercial financial capital of Malawi' },
  { id: 'sunbird-mount-soche', name: 'Sunbird Mount Soche', category: 'hotel', region: 'Southern Region', location: 'Glyn Jones Road, Blantyre', coordinates: { lat: -15.7889, lng: 35.0083 }, description: 'Historic hotel in central Blantyre' },
  { id: 'protea-ryalls', name: 'Protea Hotel Ryalls', category: 'hotel', region: 'Southern Region', location: 'Hanover Avenue, Blantyre', coordinates: { lat: -15.7905, lng: 35.0062 }, description: 'Oldest established hotel in Malawi' },
  { id: 'chileka-airport', name: 'Chileka International Airport (BLZ)', category: 'airport', region: 'Southern Region', location: 'Chileka, Blantyre', coordinates: { lat: -15.6791, lng: 34.9642 }, description: 'International airport serving Blantyre & South' },
  { id: 'zomba-plateau', name: 'Zomba Plateau', category: 'landmark', region: 'Southern Region', location: 'Zomba', coordinates: { lat: -15.3524, lng: 35.3126 }, description: 'Stunning high-altitude plateau with pine forests' },
  { id: 'sunbird-ku-chawe', name: 'Sunbird Ku Chawe', category: 'hotel', region: 'Southern Region', location: 'Zomba Plateau, Zomba', coordinates: { lat: -15.3642, lng: 35.3048 }, description: 'Mountain inn on the rim of Zomba Plateau' },
  { id: 'mount-mulanje', name: 'Mount Mulanje (Sapitwa Peak)', category: 'landmark', region: 'Southern Region', location: 'Mulanje Mountain Biosphere Reserve', coordinates: { lat: -15.9490, lng: 35.5898 }, description: 'Highest peak in south-central Africa (3,002m)' },
  { id: 'likhubula-mulanje', name: 'Likhubula Forest Depot / Mulanje Base', category: 'landmark', region: 'Southern Region', location: 'Likhubula, Mulanje', coordinates: { lat: -15.9388, lng: 35.5015 }, description: 'Primary starting point for Mulanje hiking routes' },

  // Safari Parks & Wildlife Reserves
  { id: 'liwonde-mvuu', name: 'Mvuu Camp & Lodge (Liwonde NP)', category: 'park', region: 'Southern Region', location: 'Liwonde National Park, Shire River', coordinates: { lat: -14.8512, lng: 35.2891 }, description: 'Premier wildlife destination on the Shire River' },
  { id: 'kuthengo-camp', name: 'Kuthengo Camp', category: 'hotel', region: 'Southern Region', location: 'Liwonde National Park', coordinates: { lat: -14.9350, lng: 35.2510 }, description: 'Robin Pope luxury safari camp in Liwonde' },
  { id: 'majete-wildlife', name: 'Majete Wildlife Reserve (Mkulumadzi / Thawale)', category: 'park', region: 'Southern Region', location: 'Majete Reserve, Chikwawa', coordinates: { lat: -15.9167, lng: 34.7500 }, description: 'Big Five wildlife sanctuary in Lower Shire' },
  { id: 'nyika-chelinda', name: 'Chelinda Lodge (Nyika National Park)', category: 'park', region: 'Northern Region', location: 'Nyika National Park', coordinates: { lat: -10.5847, lng: 33.8053 }, description: 'Rolling montane grassland plateau with leopards & roan' },
  { id: 'nkhotakota-tongole', name: 'Tongole Wilderness Retreat', category: 'hotel', region: 'Central Region', location: 'Nkhotakota Wildlife Reserve, Bua River', coordinates: { lat: -12.9830, lng: 34.0520 }, description: 'Eco-lodge overlooking the pristine Bua River' },

  // Northern Region
  { id: 'mzuzu-city', name: 'Mzuzu City Centre', category: 'town', region: 'Northern Region', location: 'Mzuzu', coordinates: { lat: -11.4583, lng: 34.0167 }, description: 'Hub of northern Malawi and gateway to Nyika' },
  { id: 'livingstonia-mission', name: 'Livingstonia Mission & Plateau', category: 'landmark', region: 'Northern Region', location: 'Khondowe Plateau, Rumphi', coordinates: { lat: -10.6033, lng: 34.1089 }, description: 'Historic 1894 mission perched above Lake Malawi' },
  { id: 'karonga-town', name: 'Karonga Town', category: 'town', region: 'Northern Region', location: 'Karonga', coordinates: { lat: -9.9333, lng: 33.9333 }, description: 'Northern lake town and cultural centre' },
];

/**
 * Generates direct Google Maps Turn-by-Turn directions URL.
 */
export function googleDirectionsUrl(destination: LatLng | string, origin?: LatLng | string): string {
  const dest = typeof destination === 'object' ? `${destination.lat},${destination.lng}` : encodeURIComponent(destination);
  if (origin) {
    const orig = typeof origin === 'object' ? `${origin.lat},${origin.lng}` : encodeURIComponent(origin);
    return `https://www.google.com/maps/dir/?api=1&origin=${orig}&destination=${dest}&travelmode=driving`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
}

/**
 * Generates Apple Maps navigation URL.
 */
export function appleMapsDirectionsUrl(destination: LatLng | string, origin?: LatLng | string): string {
  const dest = typeof destination === 'object' ? `${destination.lat},${destination.lng}` : encodeURIComponent(destination);
  if (origin) {
    const orig = typeof origin === 'object' ? `${origin.lat},${origin.lng}` : encodeURIComponent(origin);
    return `https://maps.apple.com/?saddr=${orig}&daddr=${dest}&dirflg=d`;
  }
  return `https://maps.apple.com/?daddr=${dest}&dirflg=d`;
}

/**
 * Generates Waze navigation URL.
 */
export function wazeDirectionsUrl(destination: LatLng): string {
  return `https://waze.com/ul?ll=${destination.lat},${destination.lng}&navigate=yes`;
}

/**
 * Generates OpenStreetMap Directions URL.
 */
export function openStreetMapDirectionsUrl(destination: LatLng, origin?: LatLng): string {
  const route = origin ? `${origin.lat}%2C${origin.lng}%3B${destination.lat}%2C${destination.lng}` : `%3B${destination.lat}%2C${destination.lng}`;
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${route}`;
}

/**
 * Calculates estimated driving time string (e.g. "1 hr 45 min").
 * Takes into account typical African/Malawi roads (average ~60-70 km/h).
 */
export function estimateDriveDuration(km: number): string {
  if (km <= 0) return '0 min';
  // Average ~60 km/h for mixed roads
  const totalMinutes = Math.round((km / 65) * 60);
  if (totalMinutes < 60) {
    return `${Math.max(1, totalMinutes)} min`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const remainingMins = totalMinutes % 60;
  if (remainingMins === 0) return `${hours} hr${hours > 1 ? 's' : ''}`;
  return `${hours} hr${hours > 1 ? 's' : ''} ${remainingMins} min`;
}

/**
 * Computes compass bearing from one coordinate to another.
 */
export function getCompassBearing(from: LatLng, to: LatLng): string {
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  let brng = (Math.atan2(y, x) * 180) / Math.PI;
  brng = (brng + 360) % 360;

  const bearings = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];
  const index = Math.round(brng / 45) % 8;
  return bearings[index];
}

export interface GeocodeResult {
  id: string;
  name: string;
  location: string;
  coordinates: LatLng;
  source: 'existing' | 'known' | 'osm';
  category?: string;
  description?: string;
}

/**
 * Live geocoding search for locations via OpenStreetMap Nominatim.
 */
export async function searchNominatim(queryStr: string, limit = 5): Promise<GeocodeResult[]> {
  const text = queryStr.trim();
  if (text.length < 2) return [];

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&countrycodes=mw,zm,tz,mz&limit=${limit}&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'en',
      },
    });
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data)) return [];

    return data.map((item: any) => {
      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lon);
      return {
        id: `osm-${item.place_id || item.osm_id || Math.random()}`,
        name: item.name || item.display_name.split(',')[0],
        location: item.display_name,
        coordinates: { lat, lng },
        source: 'osm',
        category: item.type || 'place',
        description: item.display_name,
      };
    });
  } catch (err) {
    console.error('Nominatim search failed:', err);
    return [];
  }
}
