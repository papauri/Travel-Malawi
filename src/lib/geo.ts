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
