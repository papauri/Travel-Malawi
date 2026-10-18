/**
 * Central image resolution.
 *
 * Listing images come from Firestore, where the data is frequently incomplete:
 * some documents have an empty `imageUrl`, some point at links that have since
 * 404'd, and most have no `galleryUrls` at all. Rendering those values straight
 * into an `<img>` produces broken-image glyphs (and an empty `src` makes the
 * browser re-request the page itself), so every image in the app is resolved
 * through here first.
 */

import { resolveShareUrl } from './shareLinks';

/** Inline SVG so the last-resort fallback can never itself fail to load. */
export const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
      <rect width="800" height="600" fill="#e7e5e4"/>
      <g fill="none" stroke="#a8a29e" stroke-width="14" stroke-linecap="round" stroke-linejoin="round">
        <rect x="250" y="205" width="300" height="230" rx="18"/>
        <circle cx="330" cy="277" r="26"/>
        <path d="M262 392l84-84 74 74 46-46 72 72"/>
      </g>
    </svg>`.replace(/\s+/g, ' ')
  );

/**
 * A generic Malawi landscape (Mulunguzi Dam, Zomba Plateau) that pictures no
 * property. Only onboarded properties may appear in the product, so no lodge
 * photo is ever used as a default, hero or decorative image (directive D1).
 */
const MALAWI_LANDSCAPE_IMAGE = 'https://upload.wikimedia.org/wikipedia/commons/1/15/Mulunguzi_dam_on_Zomba_Plateau.jpg';

/** Decorative background art; names and pictures no property. */
export const DECORATIVE_IMAGE = MALAWI_LANDSCAPE_IMAGE;

/** The home page hero; names and pictures no property. */
export const HERO_IMAGE = MALAWI_LANDSCAPE_IMAGE;

/**
 * URLs confirmed dead (verified 404) that still exist in stored records,
 * mapped to a working equivalent. Matched on a distinctive substring so the
 * surrounding query string does not matter.
 */
const DEAD_URL_REWRITES: { match: string; replacement: string | null }[] = [
  // Stock photo removed upstream (old seed data); dropped so the listing's own
  // photos or the neutral placeholder are used instead.
  { match: 'photo-1542314831-c6a4d1409e1c', replacement: null },
  // Wikimedia file no longer exists at this path.
  { match: 'commons/4/4e/Liwonde_National_Park.jpg', replacement: null },
];

/**
 * Normalizes a stored image value. Returns null for anything unusable so
 * callers can fall back rather than rendering an empty or broken `src`.
 */
export function normalizeImageUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  // Firestore records sometimes hold these as literal strings.
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return null;

  // Bundled sample photos of real lodges (old seed data) never stand in for a
  // listing: only onboarded properties' own photos are shown (directive D1).
  if (/^(https?:\/\/[^/]+)?\/(hotels\/)?[a-z]+_(main|gal\d)\.jpg(\?.*)?$/i.test(trimmed)) {
    return null;
  }

  for (const { match, replacement } of DEAD_URL_REWRITES) {
    if (trimmed.includes(match)) return replacement;
  }

  // A OneDrive, Drive or Dropbox share link points at a viewer page rather than
  // at the image. Rewriting here means links already saved in Firestore start
  // rendering too, without anyone having to re-enter them.
  return resolveShareUrl(trimmed).url;
}

/**
 * Every usable image for a hotel, main image first, de-duplicated.
 * Never appends default or sample pictures to the end of a property's authentic photos.
 */
export function getHotelImages(hotel: {
  name?: string;
  imageUrl?: string;
  galleryUrls?: unknown;
}): string[] {
  const gallery = Array.isArray(hotel?.galleryUrls)
    ? hotel.galleryUrls
    : // Legacy records store the gallery as a comma-separated string.
      typeof hotel?.galleryUrls === 'string'
      ? hotel.galleryUrls.split(',')
      : [];

  const resolved = [hotel?.imageUrl, ...gallery]
    .map(normalizeImageUrl)
    .filter((url): url is string => url !== null);

  // If the listing has authentic uploaded photos, return ONLY those photos!
  // Do NOT append bundled or default sample photos to the end of their pictures.
  if (resolved.length > 0) {
    return [...new Set(resolved)];
  }

  // No photos of its own: the neutral placeholder, never another property's photo.
  return [PLACEHOLDER_IMAGE];
}

/** The single best image for a hotel. Never empty. */
export function getHotelImage(hotel: { name?: string; imageUrl?: string; galleryUrls?: unknown }): string {
  return getHotelImages(hotel)[0];
}

/**
 * Default image for a property category. Every category gets the neutral
 * placeholder: the old defaults were photos of specific real lodges (D1).
 */
export function getDefaultImageForCategory(_category?: string): string {
  return PLACEHOLDER_IMAGE;
}


/**
 * The best image for a room type. Room records overwhelmingly have an empty
 * `imageUrl`, so this falls back to the parent hotel's photography before the
 * placeholder.
 */
export function getRoomImage(room: { imageUrl?: string; galleryUrls?: unknown },
  hotel?: { name?: string; imageUrl?: string; galleryUrls?: unknown; category?: string } | null
): string {
  const direct = normalizeImageUrl(room?.imageUrl);
  if (direct) return direct;
  
  if (Array.isArray(room?.galleryUrls) && room.galleryUrls.length > 0) {
    const galDirect = normalizeImageUrl(room.galleryUrls[0] as string);
    if (galDirect) return galDirect;
  }

  // Fall back to the parent hotel's photography before placeholder
  if (hotel) {
    const hotelImg = getHotelImage(hotel);
    if (hotelImg && hotelImg !== PLACEHOLDER_IMAGE) return hotelImg;
    
    if (hotel.category) {
      const catImg = getDefaultImageForCategory(hotel.category);
      if (catImg) return catImg;
    }
  }
  
  return PLACEHOLDER_IMAGE;
}
