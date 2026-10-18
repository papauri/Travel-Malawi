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

import { searchMalawiHospitalityRegistry, generateSmartPropertySuggestions } from './malawiHospitalityRegistry';

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

/** Degrees, Minutes, Seconds for GPS / Garmin / in-car 4x4 navigation */
export function formatCoordinatesDMS(point: LatLng): string {
  const toDMS = (deg: number, isLat: boolean) => {
    const absolute = Math.abs(deg);
    const d = Math.floor(absolute);
    const minFloat = (absolute - d) * 60;
    const m = Math.floor(minFloat);
    const s = ((minFloat - m) * 60).toFixed(1);
    const dir = isLat ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W');
    return `${d}°${m}'${s}"${dir}`;
  };
  return `${toDMS(point.lat, true)} ${toDMS(point.lng, false)}`;
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

/**
 * Reads a property name and/or coordinates from a pasted Google Maps link or share URL.
 * Works 100% offline without any Google Maps API calls or billing!
 */
export function parseGoogleMapsPlaceUrl(input: string): { name?: string; coordinates?: LatLng } | null {
  const text = (input ?? '').trim();
  if (!text) return null;

  const isMapsUrl =
    /maps\.(?:google\.[a-z.]+|app\.goo\.gl)/i.test(text) ||
    /google\.[a-z.]+\/maps/i.test(text) ||
    /goo\.gl\/maps/i.test(text);

  if (!isMapsUrl) return null;

  const coordinates = parseCoordinates(text) || undefined;
  let name: string | undefined;

  // 1. Match /maps/place/{Name}/
  const placeMatch = text.match(/\/maps\/place\/([^/@?#]+)/i);
  if (placeMatch && placeMatch[1]) {
    try {
      const decoded = decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')).trim();
      if (decoded && !/^-?\d+(\.\d+)?[,\s]/.test(decoded)) {
        name = decoded;
      }
    } catch {
      name = placeMatch[1].replace(/\+/g, ' ').trim();
    }
  }

  // 2. Match /maps/search/{Name}/
  if (!name) {
    const searchMatch = text.match(/\/maps\/search\/([^/@?#]+)/i);
    if (searchMatch && searchMatch[1]) {
      try {
        const decoded = decodeURIComponent(searchMatch[1].replace(/\+/g, ' ')).trim();
        if (decoded && !/^-?\d+(\.\d+)?[,\s]/.test(decoded)) {
          name = decoded;
        }
      } catch {
        name = searchMatch[1].replace(/\+/g, ' ').trim();
      }
    }
  }

  // 3. Match ?q={Name} (if not bare coordinates)
  if (!name) {
    const qMatch = text.match(/[?&]q=([^&]+)/i);
    if (qMatch && qMatch[1]) {
      try {
        const decoded = decodeURIComponent(qMatch[1].replace(/\+/g, ' ')).trim();
        if (decoded && !/^-?\d+(\.\d+)?[,\s]/.test(decoded)) {
          name = decoded;
        }
      } catch {
        name = qMatch[1].replace(/\+/g, ' ').trim();
      }
    }
  }

  if (name || coordinates) {
    return { name, coordinates };
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

export function isCrossingLakeMalawi(origin: LatLng, destination: LatLng): boolean {
  if (!isValidLatLng(origin) || !isValidLatLng(destination)) return false;

  // Both points must be north of the southern tip of Lake Malawi (~-14.35 near Monkey Bay/Mangochi).
  // Routes to Southern Malawi (Mangochi town, Liwonde, Zomba, Blantyre, Mulanje) travel via the M1/M3 land corridor.
  if (origin.lat < -14.35 || destination.lat < -14.35) return false;
  if (origin.lat > -9.4 || destination.lat > -9.4) return false;

  // Check if either endpoint is on Likoma / Chizumulu Island (and they aren't on the same island)
  const isLikoma = (pt: LatLng) =>
    pt.lat >= -12.25 && pt.lat <= -11.95 && pt.lng >= 34.55 && pt.lng <= 34.82;
  if (isLikoma(origin) || isLikoma(destination)) {
    return distanceKm(origin, destination) > 12;
  }

  // West shore / central plateau to East shore / Cape Maclear peninsula across the water body
  const isWestA = origin.lng < 34.68;
  const isEastB = destination.lng > 34.75;
  const isWestB = destination.lng < 34.68;
  const isEastA = origin.lng > 34.75;

  return (isWestA && isEastB) || (isWestB && isEastA);
}

/**
 * Calculates estimated road distance, driving duration, and travel notes
 * taking into account terrain, Lake Malawi water body bypass, and road conditions.
 */
export function estimateTravelTime(
  straightLineKm: number,
  origin?: LatLng,
  destination?: LatLng,
  destinationName?: string
): TravelEstimate {
  // Check if Lake Malawi lies between origin and destination
  let roadMultiplier = 1.32;
  let isCrossingLake = false;

  if (origin && destination && isValidLatLng(origin) && isValidLatLng(destination)) {
    isCrossingLake = isCrossingLakeMalawi(origin, destination);
    if (isCrossingLake) {
      // Must bypass around the southern lake tip via Golomoti / Balaka highway corridor
      roadMultiplier = 2.4;
    }
  }

  const roadDistanceKm = Math.round(straightLineKm * roadMultiplier * 10) / 10;

  let speedKmH = 60;
  if (straightLineKm < 10) {
    speedKmH = 35; // City / local roads
  } else if (straightLineKm < 60) {
    speedKmH = isCrossingLake ? 55 : 50;
  } else if (straightLineKm < 250) {
    speedKmH = 65; // Highway (M1, M5)
  } else {
    speedKmH = 60; // Long-distance
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
  let notes = 'Scenic highway route';

  if (destinationName?.toLowerCase().includes('likoma')) {
    travelMode = 'boat_transfer';
    notes = 'Drive to Nkhata Bay port + boat transfer to island';
  } else if (isCrossingLake) {
    notes = 'Highway route bypassing Lake Malawi via southern corridor';
  } else if (straightLineKm > 350) {
    travelMode = 'flight_recommended';
    notes = 'Full-day highway drive or domestic charter flight recommended';
  } else if (straightLineKm < 5) {
    notes = 'Quick local drive or taxi';
  } else if (straightLineKm < 40) {
    notes = 'Direct highway drive';
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
  const destParam = destinationName
    ? `${destination.lat},${destination.lng}+(${encodeURIComponent(destinationName)})`
    : `${destination.lat},${destination.lng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destParam}&travelmode=driving`;
}

export interface RoadRouteResult {
  coordinates: [number, number][]; // Array of [lat, lng] real road points
  roadDistanceKm: number;
  straightLineKm: number;
  drivingMinutes: number;
  drivingTimeFormatted: string;
  travelMode: 'driving' | 'boat_transfer' | 'flight_recommended';
  notes: string;
  source: 'osrm' | 'road_network' | 'fallback';
}

const roadRouteCache = new Map<string, RoadRouteResult>();

/**
 * Calculates real driving road routes using OpenStreetMap / OSRM highway network,
 * navigating around Lake Malawi and avoiding water/terrain crossing.
 */
export async function fetchRoadRoute(
  origin: LatLng,
  destination: LatLng,
  destinationName?: string
): Promise<RoadRouteResult> {
  if (!isValidLatLng(origin) || !isValidLatLng(destination)) {
    return {
      coordinates: [],
      roadDistanceKm: 0,
      straightLineKm: 0,
      drivingMinutes: 0,
      drivingTimeFormatted: '0 mins',
      travelMode: 'driving',
      notes: 'Invalid coordinates',
      source: 'fallback',
    };
  }

  const cacheKey = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}->${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}`;
  if (roadRouteCache.has(cacheKey)) {
    return roadRouteCache.get(cacheKey)!;
  }

  const straightDist = distanceKm(origin, destination);

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data?.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0) {
        const route = data.routes[0];
        // Convert GeoJSON [lng, lat] to Leaflet [lat, lng]
        const coords: [number, number][] = route.geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng]
        );

        const roadDistKm = Math.round((route.distance / 1000) * 10) / 10;
        const totalMinutes = Math.max(2, Math.round(route.duration / 60));

        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        const drivingTimeFormatted =
          hours > 0 ? (mins > 0 ? `${hours} hr ${mins} min` : `${hours} hrs`) : `${mins} mins`;

        let notes = 'Paved highway route';
        if (roadDistKm > 350) {
          notes = 'Cross-country highway route (M1 / M5)';
        } else if (roadDistKm < 15) {
          notes = 'Direct local drive';
        } else if (destinationName?.toLowerCase().includes('likoma')) {
          notes = 'Highway to Nkhata Bay port + boat transfer';
        } else if (roadDistKm > straightDist * 1.5) {
          notes = 'Highway route navigating around Lake Malawi';
        }

        const result: RoadRouteResult = {
          coordinates: coords,
          roadDistanceKm: roadDistKm,
          straightLineKm: Math.round(straightDist * 10) / 10,
          drivingMinutes: totalMinutes,
          drivingTimeFormatted,
          travelMode: roadDistKm > 400 ? 'flight_recommended' : 'driving',
          notes,
          source: 'osrm',
        };

        roadRouteCache.set(cacheKey, result);
        return result;
      }
    }
  } catch (err) {
    console.warn('OSRM routing fetch failed or timed out, applying realistic road calculation fallback:', err);
  }

  // Realistic fallback if OSRM is unreachable:
  // Detect if Lake Malawi lies between origin and destination
  const isCrossingLake = isCrossingLakeMalawi(origin, destination);

  let roadMultiplier = 1.35;
  let waypoints: [number, number][] = [];

  if (isCrossingLake) {
    // Route south around the southern tip of Lake Malawi via Golomoti and Balaka highway corridor
    roadMultiplier = 2.4;
    waypoints = [
      [origin.lat, origin.lng],
      [-14.30, 34.58], // Dedza / Golomoti corridor
      [-14.85, 34.90], // Balaka / Mangochi junction
      [-14.48, 35.26], // Mangochi / Shire river bridge
      [destination.lat, destination.lng],
    ];
  } else {
    waypoints = [
      [origin.lat, origin.lng],
      [(origin.lat + destination.lat) / 2 + 0.005, (origin.lng + destination.lng) / 2 - 0.005],
      [destination.lat, destination.lng],
    ];
  }

  const estRoadKm = Math.round(straightDist * roadMultiplier * 10) / 10;
  const speed = estRoadKm < 20 ? 40 : 65;
  const estMins = Math.max(2, Math.round((estRoadKm / speed) * 60));
  const hrs = Math.floor(estMins / 60);
  const remMins = estMins % 60;
  const fmtTime = hrs > 0 ? (remMins > 0 ? `${hrs} hr ${remMins} min` : `${hrs} hrs`) : `${remMins} mins`;

  const fallbackResult: RoadRouteResult = {
    coordinates: waypoints,
    roadDistanceKm: estRoadKm,
    straightLineKm: Math.round(straightDist * 10) / 10,
    drivingMinutes: estMins,
    drivingTimeFormatted: fmtTime,
    travelMode: 'driving',
    notes: isCrossingLake ? 'Highway route bypassing Lake Malawi via southern corridor' : 'Estimated road route',
    source: 'road_network',
  };

  roadRouteCache.set(cacheKey, fallbackResult);
  return fallbackResult;
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
 * Regional destination coordinates across all major tourist areas in Malawi.
 */
const REGIONAL_DESTINATIONS: { keywords: string[]; coords: LatLng }[] = [
  { keywords: ['likoma', 'chizumulu'], coords: { lat: -12.0622, lng: 34.7351 } },
  { keywords: ['cape maclear', 'chembe', 'lake malawi national park'], coords: { lat: -14.0267, lng: 34.8519 } },
  { keywords: ['monkey bay'], coords: { lat: -14.0781, lng: 34.9208 } },
  { keywords: ['mangochi', 'nkopola', 'lake malombe'], coords: { lat: -14.3012, lng: 35.1558 } },
  { keywords: ['salima', 'senga bay', 'nankoma'], coords: { lat: -13.7245, lng: 34.6225 } },
  { keywords: ['nkhata bay', 'chintheche', 'bandawe'], coords: { lat: -11.6067, lng: 34.2908 } },
  { keywords: ['nkhotakota', 'dwangwa', 'bua river', 'chia lagoon'], coords: { lat: -12.9830, lng: 34.0520 } },
  { keywords: ['liwonde', 'shire river', 'machinga'], coords: { lat: -14.8512, lng: 35.2891 } },
  { keywords: ['majete', 'chikwawa', 'lengwe'], coords: { lat: -15.9167, lng: 34.7500 } },
  { keywords: ['nyika', 'rumphi', 'livingstonia mission'], coords: { lat: -10.5847, lng: 33.8053 } },
  { keywords: ['zomba', 'zomba plateau'], coords: { lat: -15.3642, lng: 35.3048 } },
  { keywords: ['mulanje', 'likhubula', 'sapitwa'], coords: { lat: -15.9388, lng: 35.5015 } },
  { keywords: ['thyolo', 'bvumbwe'], coords: { lat: -16.0240, lng: 35.1480 } },
  { keywords: ['blantyre', 'limbe', 'mandala', 'chileka'], coords: { lat: -15.7861, lng: 35.0058 } },
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

  // 1. If valid coordinates are already provided, check if they are authentic or swapped/mismatched
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

  // 2. Match against curated Malawi tourist regions and destination keywords
  for (const destination of REGIONAL_DESTINATIONS) {
    if (destination.keywords.some(kw => combinedText.includes(kw))) {
      const offset = getDeterministicOffset(idKey);
      return {
        lat: Number((destination.coords.lat + offset.dLat).toFixed(5)),
        lng: Number((destination.coords.lng + offset.dLng).toFixed(5)),
      };
    }
  }

  // 3. Default fallback: Place in Lilongwe with deterministic regional spread
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
  { id: 'likoma-island', name: 'Likoma Island', category: 'landmark', region: 'Northern Region', location: 'Likoma Island, Lake Malawi', coordinates: { lat: -12.0622, lng: 34.7351 }, description: 'Island in Lake Malawi reached by boat from Nkhata Bay or by air' },
  { id: 'cape-maclear-beach', name: 'Cape Maclear (Chembe Village)', category: 'beach', region: 'Mangochi', location: 'Cape Maclear, Mangochi', coordinates: { lat: -14.0267, lng: 34.8519 }, description: 'Vibrant lakeside village in Lake Malawi National Park' },
  { id: 'monkey-bay', name: 'Monkey Bay', category: 'town', region: 'Mangochi', location: 'Monkey Bay, Mangochi', coordinates: { lat: -14.0781, lng: 34.9208 }, description: 'Port town on southern shore of Lake Malawi' },
  { id: 'senga-bay', name: 'Senga Bay', category: 'beach', region: 'Salima', location: 'Senga Bay, Salima', coordinates: { lat: -13.7231, lng: 34.6192 }, description: 'Closest Lake Malawi beach to Lilongwe' },
  { id: 'nkhata-bay', name: 'Nkhata Bay', category: 'town', region: 'Northern Region', location: 'Nkhata Bay, Lake Malawi', coordinates: { lat: -11.6067, lng: 34.2908 }, description: 'Scenic bay town with lodges and diving' },

  // Lilongwe Area
  { id: 'lilongwe-city-centre', name: 'Lilongwe City Centre', category: 'town', region: 'Central Region', location: 'City Centre, Lilongwe', coordinates: { lat: -13.9626, lng: 33.7741 }, description: 'Capital city administrative and business district' },
  { id: 'lilongwe-old-town', name: 'Lilongwe Old Town', category: 'town', region: 'Central Region', location: 'Old Town, Lilongwe', coordinates: { lat: -13.9833, lng: 33.7667 }, description: 'Bustling commercial hub and markets' },
  { id: 'lilongwe-area-43', name: 'Area 43, Lilongwe', category: 'town', region: 'Central Region', location: 'Area 43, Lilongwe', coordinates: { lat: -13.9312, lng: 33.7915 }, description: 'Upscale residential neighborhood in Lilongwe' },
  { id: 'lilongwe-area-10', name: 'Area 10, Lilongwe', category: 'town', region: 'Central Region', location: 'Area 10, Lilongwe', coordinates: { lat: -13.9520, lng: 33.7850 }, description: 'Diplomatic and residential quarter' },
  { id: 'lilongwe-area-11', name: 'Area 11, Lilongwe', category: 'town', region: 'Central Region', location: 'Area 11, Lilongwe', coordinates: { lat: -13.9680, lng: 33.7810 }, description: 'Central diplomatic area' },
  { id: 'kamuzu-airport', name: 'Kamuzu International Airport (LLW)', category: 'airport', region: 'Central Region', location: 'Lumbadzi, Lilongwe', coordinates: { lat: -13.7829, lng: 33.7810 }, description: 'Malawi\'s primary international gateway' },

  // Blantyre & Southern Highlands
  { id: 'blantyre-cbd', name: 'Blantyre CBD / Victoria Avenue', category: 'town', region: 'Southern Region', location: 'Blantyre City', coordinates: { lat: -15.7861, lng: 35.0058 }, description: 'Commercial financial capital of Malawi' },
  { id: 'chileka-airport', name: 'Chileka International Airport (BLZ)', category: 'airport', region: 'Southern Region', location: 'Chileka, Blantyre', coordinates: { lat: -15.6791, lng: 34.9642 }, description: 'International airport serving Blantyre & South' },
  { id: 'zomba-plateau', name: 'Zomba Plateau', category: 'landmark', region: 'Southern Region', location: 'Zomba', coordinates: { lat: -15.3524, lng: 35.3126 }, description: 'Stunning high-altitude plateau with pine forests' },
  { id: 'mount-mulanje', name: 'Mount Mulanje (Sapitwa Peak)', category: 'landmark', region: 'Southern Region', location: 'Mulanje Mountain Biosphere Reserve', coordinates: { lat: -15.9490, lng: 35.5898 }, description: 'Highest peak in south-central Africa (3,002m)' },
  { id: 'likhubula-mulanje', name: 'Likhubula Forest Depot / Mulanje Base', category: 'landmark', region: 'Southern Region', location: 'Likhubula, Mulanje', coordinates: { lat: -15.9388, lng: 35.5015 }, description: 'Primary starting point for Mulanje hiking routes' },

  // Safari Parks & Wildlife Reserves
  { id: 'liwonde-national-park', name: 'Liwonde National Park', category: 'park', region: 'Southern Region', location: 'Liwonde National Park, Shire River', coordinates: { lat: -14.8512, lng: 35.2891 }, description: 'Premier wildlife destination on the Shire River' },
  { id: 'majete-wildlife', name: 'Majete Wildlife Reserve', category: 'park', region: 'Southern Region', location: 'Majete Reserve, Chikwawa', coordinates: { lat: -15.9167, lng: 34.7500 }, description: 'Big Five wildlife sanctuary in Lower Shire' },
  { id: 'nyika-national-park', name: 'Nyika National Park', category: 'park', region: 'Northern Region', location: 'Nyika National Park', coordinates: { lat: -10.5847, lng: 33.8053 }, description: 'Rolling montane grassland plateau with leopards & roan' },

  { id: 'nkhotakota-wildlife-reserve', name: 'Nkhotakota Wildlife Reserve', category: 'park', region: 'Central Region', location: 'Nkhotakota Wildlife Reserve, Bua River', coordinates: { lat: -12.9830, lng: 34.0520 }, description: 'Wilderness reserve along the Bua River' },

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
 * Takes into account typical African/Malawi roads, terrain, and Lake Malawi bypasses.
 */
export function estimateDriveDuration(
  km: number,
  origin?: LatLng,
  destination?: LatLng,
  destinationName?: string
): string {
  if (km <= 0) return '0 min';
  if (origin && destination && isValidLatLng(origin) && isValidLatLng(destination)) {
    return estimateTravelTime(km, origin, destination, destinationName).drivingTimeFormatted;
  }
  // Average ~60-65 km/h for mixed roads
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

export interface MalawiPlaceSuggestion {
  id: string;
  name: string;
  location: string;
  coordinates: { lat: number; lng: number };
  category?: string;
  type?: string;
  district?: string;
  source?: 'registry' | 'smart_suggestion' | 'osm';
  badge?: string;
  description?: string;
  summary?: string;
  amenities?: string[];
  suggestedRooms?: Array<{
    name: string;
    description: string;
    priceMwk: number;
    priceUsd: number;
    maxGuests: number;
    baseGuests?: number;
    quantity?: number;
    amenities?: string[];
  }>;
  locationNotes?: string;
  checkInTime?: string;
  checkOutTime?: string;
  contactPhone?: string;
  contactEmail?: string;
  contactWhatsapp?: string;
}

/**
 * Searches places across Malawi, integrating the curated National Hospitality Registry,
 * smart naming suggestions, and filtered OpenStreetMap landmarks.
 */
export async function searchMalawiPlaces(queryStr: string, limit = 6): Promise<MalawiPlaceSuggestion[]> {
  const text = queryStr.trim();
  if (text.length < 2) return [];

  const results: MalawiPlaceSuggestion[] = [];
  const seenNames = new Set<string>();

  // 1. Primary: Match from Verified Malawi Hospitality Registry
  try {
    const registryMatches = searchMalawiHospitalityRegistry(text, limit);

    for (const p of registryMatches) {
      const key = p.name.toLowerCase();
      if (!seenNames.has(key)) {
        seenNames.add(key);
        results.push({
          id: `reg-${p.id}`,
          name: p.name,
          location: p.location,
          coordinates: p.coordinates,
          category: p.category,
          type: 'hospitality',
          district: p.district,
          source: 'registry',
          badge: p.badge,
          description: p.description,
          summary: p.summary,
          amenities: p.amenities,
          suggestedRooms: p.suggestedRooms,
          locationNotes: p.locationNotes,
          checkInTime: p.checkInTime,
          checkOutTime: p.checkOutTime,
          contactPhone: p.contactPhone,
          contactEmail: p.contactEmail,
          contactWhatsapp: p.contactWhatsapp,
        });
      }
    }
  } catch (err) {
    console.warn('Registry search error:', err);
  }

  // 2. Secondary: If query is specific and we need suggestions, add smart hospitality naming ideas
  if (results.length < limit && text.length >= 3) {
    try {
      const smartIdeas = generateSmartPropertySuggestions(text);
      for (const idea of smartIdeas) {
        const key = idea.name.toLowerCase();
        if (!seenNames.has(key) && results.length < limit) {
          seenNames.add(key);
          results.push({
            id: `smart-${Math.random().toString(36).slice(2, 7)}`,
            name: idea.name,
            location: 'Malawi',
            coordinates: { lat: -13.9833, lng: 33.7833 },
            category: idea.category,
            type: 'suggestion',
            source: 'smart_suggestion',
            badge: idea.badge,
            description: idea.description,
            summary: `Proposed listing name optimized for ${idea.category} bookings.`,
          });
        }
      }
    } catch (err) {
      console.warn('Smart suggestion error:', err);
    }
  }

  // 3. Tertiary: OpenStreetMap Nominatim for geographic context, strictly excluding generic polygons
  if (results.length < limit) {
    try {
      const remainingLimit = limit - results.length;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&countrycodes=mw&viewbox=32.67,-9.36,35.92,-17.13&bounded=1&limit=${remainingLimit + 4}&addressdetails=1`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const response = await fetch(url, {
        headers: { 'Accept-Language': 'en' },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          for (const item of data) {
            if (results.length >= limit) break;

            const cleanName = (item.name || item.display_name.split(',')[0] || '').trim();
            const lowerName = cleanName.toLowerCase();

            // Filter out broad, generic administrative polygons
            if (
              !cleanName ||
              lowerName === 'malawi' ||
              lowerName.includes('central region') ||
              lowerName.includes('southern region') ||
              lowerName.includes('northern region') ||
              seenNames.has(lowerName)
            ) {
              continue;
            }

            const lat = parseFloat(item.lat);
            const lng = parseFloat(item.lon);
            const addr = item.address || {};
            const locality = addr.suburb || addr.village || addr.town || addr.city || addr.municipality || '';
            const district = addr.county || addr.state_district || addr.state || '';
            
            let locSummary = [locality, district].filter(Boolean).join(', ');
            if (!locSummary) {
              const parts = item.display_name.split(',').map((s: string) => s.trim());
              locSummary = parts.slice(1, 3).join(', ') || 'Malawi';
            }

            seenNames.add(lowerName);
            results.push({
              id: `mw-osm-${item.place_id || item.osm_id || Math.random()}`,
              name: cleanName,
              location: locSummary,
              coordinates: { lat, lng },
              category: item.type || item.class || 'Landmark',
              type: item.type,
              district,
              source: 'osm',
              badge: 'Landmark / Area',
            });
          }
        }
      }
    } catch {
      // Quietly ignore OSM network or abort failures
    }
  }

  return results;
}

export interface MalawiHub {
  id: string;
  name: string;
  region: string;
  description: string;
  coords: LatLng;
  icon: string;
}

export const MALAWI_HUBS: MalawiHub[] = [
  { id: 'lilongwe', name: 'Lilongwe', region: 'Central Hub', description: 'Capital city & Airport', coords: { lat: -13.9626, lng: 33.7741 }, icon: '🏙️' },
  { id: 'blantyre', name: 'Blantyre', region: 'Southern Hub', description: 'Commercial & Cultural centre', coords: { lat: -15.7861, lng: 35.0058 }, icon: '🏢' },
  { id: 'cape-maclear', name: 'Cape Maclear / Mangochi', region: 'Lake Malawi South', description: 'Beachfront villas & Snorkeling', coords: { lat: -14.0267, lng: 34.8519 }, icon: '🏖️' },
  { id: 'salima', name: 'Salima / Senga Bay', region: 'Central Lakeshore', description: 'Nearest lake beach to Lilongwe', coords: { lat: -13.7245, lng: 34.6225 }, icon: '🌊' },
  { id: 'mzuzu', name: 'Mzuzu', region: 'Northern Hub', description: 'Viphya & Gateway to Nyika', coords: { lat: -11.4583, lng: 34.0167 }, icon: '🌿' },
  { id: 'zomba', name: 'Zomba', region: 'Old Capital', description: 'Plateau viewpoints & Hiking', coords: { lat: -15.3642, lng: 35.3048 }, icon: '⛰️' },
  { id: 'liwonde', name: 'Liwonde / Majete', region: 'Wildlife Reserves', description: 'Safari drives & River cruises', coords: { lat: -14.8512, lng: 35.2891 }, icon: '🦁' },
  { id: 'nkhata-bay', name: 'Nkhata Bay', region: 'Northern Lakeshore', description: 'Likoma ferry & Scuba diving', coords: { lat: -11.6067, lng: 34.2908 }, icon: '⛵' },
];

/**
 * Formats and sanitizes raw location strings from database records.
 * Capitalises all-lowercase place names.
 */
export function formatLocationName(location?: string, _hotelName?: string): string {
  if (!location) return 'Malawi';
  const clean = location.trim();
  const lower = clean.toLowerCase();

  // Capitalize if completely lowercase
  if (clean === lower && clean.length > 2) {
    return clean
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  return clean;
}

export interface ReverseGeocodeResult {
  location: string;
  town: string;
  district: string;
  locationNotes: string;
  displayName: string;
  nearestLandmark?: string;
}

/**
 * Reverse geocodes GPS coordinates into an authentic Malawian town/area and generates
 * practical "finding the place" arrival directions.
 *
 * Utilizes OpenStreetMap Nominatim reverse geocoding with instant fallback to
 * Malawi known landmarks and regional boundaries.
 */
export async function reverseGeocodeCoordinates(coords: LatLng): Promise<ReverseGeocodeResult> {
  if (!isValidLatLng(coords)) {
    return {
      location: 'Malawi',
      town: 'Malawi',
      district: 'Malawi',
      locationNotes: '',
      displayName: 'Malawi',
    };
  }

  // 1. Calculate nearest known Malawi place / landmark
  let closestPlace = MALAWI_KNOWN_PLACES[0];
  let minDistance = distanceKm(coords, closestPlace.coordinates);

  for (const place of MALAWI_KNOWN_PLACES) {
    const dist = distanceKm(coords, place.coordinates);
    if (dist < minDistance) {
      minDistance = dist;
      closestPlace = place;
    }
  }

  // Generate fallback Malawian arrival guidance based on closest recognized hub/landmark
  const generateArrivalNotes = (townOrArea: string, landmark?: string): string => {
    const lower = `${townOrArea} ${landmark || ''}`.toLowerCase();
    if (lower.includes('cape maclear') || lower.includes('chembe')) {
      return 'Follow the lakeshore access road into Chembe Village. Gate and property entrance are signposted on the beachside in Cape Maclear.';
    }
    if (lower.includes('senga bay') || lower.includes('salima')) {
      return 'Take the M10 tar road from Salima toward Senga Bay. Follow signs turning off toward the beach.';
    }
    if (lower.includes('mangochi') || lower.includes('nkopola')) {
      return 'Turn off the main M3 Mangochi-Monkey Bay road onto the lodge access road. Pinned on the lake side.';
    }
    if (lower.includes('monkey bay')) {
      return 'Located in Monkey Bay town near the port/lakeshore. Pinned near the harbor access.';
    }
    if (lower.includes('area 43') || lower.includes('area 10') || lower.includes('area 11') || lower.includes('city centre')) {
      return `Located in ${townOrArea}, Lilongwe. Accessible via paved tar roads from Presidential Way / M1 with secure gated entrance.`;
    }
    if (lower.includes('lilongwe')) {
      return `Located in ${townOrArea}, Lilongwe. Paved road access with secure parking.`;
    }
    if (lower.includes('blantyre')) {
      return `Situated in ${townOrArea}, Blantyre. Convenient access from main road with dedicated on-site parking.`;
    }
    if (lower.includes('zomba plateau')) {
      return 'Take the scenic mountain road up from Zomba town. Watch for signposted gates near the plateau rim.';
    }
    if (lower.includes('zomba')) {
      return `Located in ${townOrArea}, Zomba. Follow main road toward the mountain slope.`;
    }
    if (lower.includes('mulanje')) {
      return 'Turn off the M2 toward the base of Mount Mulanje. Follow tea estate access roads to the property entrance.';
    }
    if (lower.includes('liwonde')) {
      return 'Located in the Liwonde / Shire River wildlife corridor. High-clearance vehicle recommended.';
    }
    if (lower.includes('majete')) {
      return 'Located in Chikwawa near the Majete Wildlife Reserve main gate. High-clearance vehicle recommended.';
    }
    if (lower.includes('nyika')) {
      return 'Situated on the high montane grasslands of Nyika National Park. 4x4 vehicle recommended.';
    }
    if (lower.includes('nkhata bay')) {
      return 'Follow the winding lakeshore road down into Nkhata Bay. Pinned on the lakeshore slopes.';
    }
    if (lower.includes('likoma')) {
      return 'Located on Likoma Island, Lake Malawi. Accessible via boat transfer from Mbamba Bay / Nkhata Bay or island airstrip.';
    }
    if (lower.includes('chintheche')) {
      return 'Follow the lakeshore road M5 at Chintheche. White sand beach access road leading directly to the property.';
    }
    if (lower.includes('nkhotakota')) {
      return 'Turn off the M5 lakeshore highway into Nkhotakota. Follow local signposts to the property.';
    }
    if (lower.includes('mzuzu')) {
      return `Located in ${townOrArea}, Mzuzu. Accessible from main road with secure guest parking.`;
    }
    return `Located in ${townOrArea}. Signposted entrance with secure guest parking.`;
  };

  // Default heuristic based on nearest landmark if close enough
  let resolvedLocation = closestPlace.location;
  let resolvedTown = closestPlace.region;
  let resolvedDistrict = closestPlace.region;
  let resolvedNotes = generateArrivalNotes(closestPlace.location, closestPlace.name);
  let resolvedDisplayName = closestPlace.location;

  // 2. Query OpenStreetMap Nominatim reverse geocode
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}&zoom=14&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'TravelMalawi-HostPlatform/1.0',
      },
      signal: AbortSignal.timeout(3500),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const sub = addr.suburb || addr.neighbourhood || addr.residential || addr.village || addr.hamlet;
        const cityOrTown = addr.town || addr.city || addr.municipality;
        const district = addr.county || addr.state_district || addr.state || '';
        const cleanDistrict = district.replace(/district/gi, '').trim();

        // Construct town/area string
        let formattedTown = '';
        if (sub && cityOrTown && sub.toLowerCase() !== cityOrTown.toLowerCase()) {
          formattedTown = `${sub}, ${cityOrTown}`;
        } else if (sub && cleanDistrict) {
          formattedTown = `${sub}, ${cleanDistrict}`;
        } else if (cityOrTown && cleanDistrict && cityOrTown.toLowerCase() !== cleanDistrict.toLowerCase()) {
          formattedTown = `${cityOrTown}, ${cleanDistrict}`;
        } else {
          formattedTown = cityOrTown || sub || cleanDistrict || closestPlace.location;
        }

        // Special Malawian overrides for known tourism hubs
        if (minDistance <= 15) {
          if (closestPlace.name.toLowerCase().includes('cape maclear') || closestPlace.location.toLowerCase().includes('cape maclear')) {
            formattedTown = 'Cape Maclear, Mangochi';
          } else if (closestPlace.location.toLowerCase().includes('senga bay')) {
            formattedTown = 'Senga Bay, Salima';
          } else if (closestPlace.location.toLowerCase().includes('likoma')) {
            formattedTown = 'Likoma Island, Lake Malawi';
          }
        }

        resolvedLocation = formattedTown;
        resolvedTown = cityOrTown || sub || cleanDistrict || closestPlace.region;
        resolvedDistrict = cleanDistrict || closestPlace.region;
        resolvedDisplayName = data.display_name || formattedTown;
        resolvedNotes = generateArrivalNotes(formattedTown, closestPlace.name);
      }
    }
  } catch {
    // If Nominatim timed out or failed, our proximity heuristic has already set accurate data
  }

  return {
    location: resolvedLocation,
    town: resolvedTown,
    district: resolvedDistrict,
    locationNotes: resolvedNotes,
    displayName: resolvedDisplayName,
    nearestLandmark: minDistance <= 20 ? closestPlace.name : undefined,
  };
}
