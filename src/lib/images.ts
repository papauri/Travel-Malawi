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
 * Photography bundled with the app under `public/hotels/`. Used to stand in for
 * listings whose stored URLs are missing or dead, keyed by a fragment of the
 * hotel name.
 */
const LOCAL_HOTEL_IMAGES: Record<string, string[]> = {
  pumulani: ['/hotels/pumulani_main.jpg', '/hotels/pumulani_gal1.jpg', '/hotels/pumulani_gal2.jpg'],
  'kaya mawa': ['/hotels/kaya_main.jpg', '/hotels/kaya_gal1.jpg', '/hotels/kaya_gal2.jpg'],
  makokola: ['/hotels/makokola_main.jpg', '/hotels/makokola_gal1.jpg', '/hotels/makokola_gal2.jpg'],
  rosalyn: ['/hotels/rosalyn_main.jpg', '/hotels/rosalyn_gal1.jpg', '/hotels/rosalyn_gal2.jpg', '/hotels/rosalyn_gal3.jpg'],
};

/** A local image safe to use as decorative background art. */
export const DECORATIVE_IMAGE = '/hotels/rosalyn_main.jpg';

/**
 * The home page hero.
 *
 * This was a stock Unsplash photograph of a modern white villa — with a
 * construction crane in the frame — which had nothing to do with Malawi and
 * depended on a third-party host. Kaya Mawa on Likoma Island is bundled with
 * the app, loads instantly, and is actually one of the listings.
 */
export const HERO_IMAGE = '/hotels/kaya_main.jpg';

/**
 * URLs confirmed dead (verified 404) that still exist in stored records,
 * mapped to a working equivalent. Matched on a distinctive substring so the
 * surrounding query string does not matter.
 */
const DEAD_URL_REWRITES: { match: string; replacement: string }[] = [
  // Unsplash photo removed upstream; was used both as Sunbird Ku Chawe's main
  // image and as a generic fallback across the home page.
  {
    match: 'photo-1542314831-c6a4d1409e1c',
    replacement: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Mulunguzi_dam_on_Zomba_Plateau.jpg',
  },
  // Wikimedia file no longer exists at this path.
  {
    match: 'commons/4/4e/Liwonde_National_Park.jpg',
    replacement: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?q=80&w=2936&auto=format&fit=crop',
  },
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

  for (const { match, replacement } of DEAD_URL_REWRITES) {
    if (trimmed.includes(match)) return replacement;
  }
  return trimmed;
}

/** Local photography for a hotel, matched on its name. Empty if none matches. */
export function localImagesForName(name: unknown): string[] {
  if (typeof name !== 'string') return [];
  const normalized = name.toLowerCase();
  for (const [key, images] of Object.entries(LOCAL_HOTEL_IMAGES)) {
    if (normalized.includes(key)) return images;
  }
  return [];
}

/**
 * Every usable image for a hotel, main image first, de-duplicated. Falls back
 * to bundled local photography, then to the placeholder, so the result is
 * never empty and callers can index into it safely.
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

  // Bundled photography for this property is appended rather than used only as
  // an all-or-nothing fallback: stored records rarely carry a gallery, so
  // without this a listing would show its single hero shot everywhere.
  const local = localImagesForName(hotel?.name);
  const unique = [...new Set([...resolved, ...local])];

  return unique.length > 0 ? unique : [PLACEHOLDER_IMAGE];
}

/** The single best image for a hotel. Never empty. */
export function getHotelImage(hotel: { name?: string; imageUrl?: string; galleryUrls?: unknown }): string {
  return getHotelImages(hotel)[0];
}

/**
 * The best image for a room type. Room records overwhelmingly have an empty
 * `imageUrl`, so this falls back to the parent hotel's photography before the
 * placeholder.
 */
export function getRoomImage(
  room: { imageUrl?: string },
  hotel?: { name?: string; imageUrl?: string; galleryUrls?: unknown } | null
): string {
  const direct = normalizeImageUrl(room?.imageUrl);
  if (direct) return direct;
  if (hotel) {
    const images = getHotelImages(hotel);
    // Prefer a gallery shot over the hero image so a room card does not simply
    // repeat the picture shown at the top of the page.
    return images[1] ?? images[0];
  }
  return PLACEHOLDER_IMAGE;
}
