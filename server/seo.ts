import { resolveShareUrl } from '../src/lib/shareLinks';
import { readDoc, escapeHtml, isSafeId } from './auth';

export const BASE_URL = 'https://ulendomalawi.com';

export interface SitemapUrl {
  loc: string;
  priority: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  lastmod?: string;
}

export interface HotelMeta {
  id: string;
  name: string;
  location: string;
  title: string;
  description: string;
  imageUrl: string;
  canonicalUrl: string;
}

const hotelMetaCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function invalidateHotelMetaCache(hotelId?: string) {
  if (hotelId) {
    hotelMetaCache.delete(hotelId);
  } else {
    hotelMetaCache.clear();
  }
}

export async function getCachedHotelData(hotelId: string): Promise<any | null> {
  if (!isSafeId(hotelId)) return null;
  const cached = hotelMetaCache.get(hotelId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }
  const hotel = await readDoc('hotels', hotelId);
  if (hotel) {
    hotelMetaCache.set(hotelId, { data: hotel, expiresAt: now + CACHE_TTL_MS });
  }
  return hotel;
}

/**
 * Resolves the primary featured photograph URL for a hotel.
 * Always resolves to an absolute, crawler-friendly HTTPS URL.
 * Automatically converts Cloudinary .webp / .avif extensions to .jpg for universal
 * OpenGraph compatibility with WhatsApp, iMessage, and social scrapers.
 */
export function resolveHotelFeaturedImage(hotel: any, baseUrl = BASE_URL): string {
  let img: unknown = hotel?.imageUrl;
  if (!img) {
    if (Array.isArray(hotel?.galleryUrls) && hotel.galleryUrls.length > 0) {
      img = hotel.galleryUrls[0];
    } else if (typeof hotel?.galleryUrls === 'string') {
      img = hotel.galleryUrls.split(',')[0]?.trim();
    }
  }

  if (typeof img !== 'string' || !img.trim()) {
    return `${baseUrl}/icons/icon-512.png`;
  }

  let trimmed = img.trim();
  if (trimmed === 'undefined' || trimmed === 'null') {
    return `${baseUrl}/icons/icon-512.png`;
  }

  // Rewrite OneDrive / Google Drive / Dropbox share links to direct images
  const resolved = resolveShareUrl(trimmed).url;
  trimmed = resolved || trimmed;

  // Relative URL -> absolute
  if (trimmed.startsWith('/')) {
    trimmed = `${baseUrl}${trimmed}`;
  } else if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    trimmed = `${baseUrl}/${trimmed}`;
  }

  // Cloudinary: convert .webp or .avif to .jpg so all social bots (including WhatsApp) unfurl reliably
  if (trimmed.includes('res.cloudinary.com')) {
    trimmed = trimmed.replace(/\.(webp|avif)(\?.*)?$/i, '.jpg$2');
  }

  return trimmed;
}

export function getHotelMeta(hotel: any, baseUrl = BASE_URL): HotelMeta {
  const name = String(hotel?.name || 'Property').trim();
  const location = String(hotel?.location || 'Malawi').trim();
  const category = String(hotel?.category || 'Lodge').trim();
  const title = `${name} — ${location} | Travel Malawi`;

  const rawDesc = String(hotel?.description || '')
    .replace(/[#*_`~[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const snippet = rawDesc.length > 160 ? `${rawDesc.slice(0, 157)}...` : rawDesc;
  const description =
    snippet ||
    `Discover ${name} in ${location}. Independent ${category.toLowerCase()} in Malawi with photos, rates and direct property contact details on Travel Malawi.`;

  const imageUrl = resolveHotelFeaturedImage(hotel, baseUrl);
  const canonicalUrl = `${baseUrl}/hotel/${encodeURIComponent(hotel?.id || '')}`;

  return {
    id: hotel?.id || '',
    name,
    location,
    title,
    description,
    imageUrl,
    canonicalUrl,
  };
}

/**
 * Injects hotel-specific OpenGraph, Twitter card, canonical, title, and description
 * metadata into the static index.html template so social share cards (WhatsApp, Facebook,
 * Twitter/X, iMessage, LinkedIn, Telegram, etc.) display the property's featured photograph
 * instead of the generic TM brand logo.
 */
export function injectHotelMetaIntoHtml(html: string, hotel: any, baseUrl = BASE_URL): string {
  const meta = getHotelMeta(hotel, baseUrl);
  const escapedTitle = escapeHtml(meta.title);
  const escapedDesc = escapeHtml(meta.description);
  const escapedUrl = escapeHtml(meta.canonicalUrl);
  const escapedImg = escapeHtml(meta.imageUrl);

  let result = html;

  result = result.replace(/<title>.*?<\/title>/i, `<title>${escapedTitle}</title>`);
  result = result.replace(
    /<meta\s+name=["']description["']\s+content=["'].*?["']\s*\/?>/i,
    `<meta name="description" content="${escapedDesc}" />`
  );
  result = result.replace(
    /<link\s+rel=["']canonical["']\s+href=["'].*?["']\s*\/?>/i,
    `<link rel="canonical" href="${escapedUrl}" />`
  );
  result = result.replace(
    /<meta\s+property=["']og:title["']\s+content=["'].*?["']\s*\/?>/i,
    `<meta property="og:title" content="${escapedTitle}" />`
  );
  result = result.replace(
    /<meta\s+property=["']og:description["']\s+content=["'].*?["']\s*\/?>/i,
    `<meta property="og:description" content="${escapedDesc}" />`
  );
  result = result.replace(
    /<meta\s+property=["']og:url["']\s+content=["'].*?["']\s*\/?>/i,
    `<meta property="og:url" content="${escapedUrl}" />`
  );
  result = result.replace(
    /<meta\s+property=["']og:image["']\s+content=["'].*?["']\s*\/?>/i,
    `<meta property="og:image" content="${escapedImg}" />\n    <meta property="og:image:secure_url" content="${escapedImg}" />`
  );
  result = result.replace(
    /<meta\s+property=["']og:image:alt["']\s+content=["'].*?["']\s*\/?>/i,
    `<meta property="og:image:alt" content="${escapedTitle}" />`
  );
  result = result.replace(
    /<meta\s+property=["']og:image:width["']\s+content=["'].*?["']\s*\/?>/i,
    `<meta property="og:image:width" content="1200" />`
  );
  result = result.replace(
    /<meta\s+property=["']og:image:height["']\s+content=["'].*?["']\s*\/?>/i,
    `<meta property="og:image:height" content="630" />`
  );
  result = result.replace(
    /<meta\s+name=["']twitter:card["']\s+content=["'].*?["']\s*\/?>/i,
    `<meta name="twitter:card" content="summary_large_image" />`
  );
  result = result.replace(
    /<meta\s+name=["']twitter:title["']\s+content=["'].*?["']\s*\/?>/i,
    `<meta name="twitter:title" content="${escapedTitle}" />`
  );
  result = result.replace(
    /<meta\s+name=["']twitter:description["']\s+content=["'].*?["']\s*\/?>/i,
    `<meta name="twitter:description" content="${escapedDesc}" />`
  );
  result = result.replace(
    /<meta\s+name=["']twitter:image["']\s+content=["'].*?["']\s*\/?>/i,
    `<meta name="twitter:image" content="${escapedImg}" />`
  );
  result = result.replace(
    /<meta\s+name=["']twitter:image:alt["']\s+content=["'].*?["']\s*\/?>/i,
    `<meta name="twitter:image:alt" content="${escapedTitle}" />`
  );

  return result;
}

/**
 * Generates the complete, high-authority sitemap.xml for Travel Malawi
 */
export function generateSitemapXml(
  allHotels: { id: string; updatedAt?: number; location?: string; district?: string; status?: string }[] = []
): string {
  // Pending and rejected listings are not public pages; a missing status is a legacy approved one.
  const liveHotels = allHotels.filter((h) => !h.status || h.status === 'approved');
  const today = new Date().toISOString().split('T')[0];

  // Core static landing pages
  const staticRoutes: SitemapUrl[] = [
    { loc: '/', priority: '1.0', changefreq: 'daily', lastmod: today },
    { loc: '/list-your-property', priority: '0.85', changefreq: 'weekly', lastmod: today },
    { loc: '/host-guide', priority: '0.80', changefreq: 'weekly', lastmod: today },
    { loc: '/how-hosting-works', priority: '0.80', changefreq: 'weekly', lastmod: today },
    { loc: '/stay-owner-leaflet', priority: '0.75', changefreq: 'monthly', lastmod: today },
    { loc: '/concept-validation', priority: '0.65', changefreq: 'monthly', lastmod: today },
    { loc: '/terms', priority: '0.50', changefreq: 'monthly', lastmod: today },
    { loc: '/privacy', priority: '0.50', changefreq: 'monthly', lastmod: today },
    { loc: '/refunds', priority: '0.50', changefreq: 'monthly', lastmod: today },
  ];

  // Only places with a live listing: the national registry is not browsable,
  // so its towns would be search pages with no results.
  const uniqueLocations = new Set<string>();
  for (const h of liveHotels) {
    if (h.district) uniqueLocations.add(h.district.trim());
    if (h.location) uniqueLocations.add(h.location.trim());
  }

  const dynamicLocationRoutes: SitemapUrl[] = Array.from(uniqueLocations)
    .filter(Boolean)
    .map((loc) => ({
      loc: `/?location=${encodeURIComponent(loc)}`,
      priority: '0.90',
      changefreq: 'daily',
      lastmod: today,
    }));

  // Live hotels only: a registry id has no /hotel/:id page behind it, so
  // listing it would hand crawlers a "not found" page.
  const seenIds = new Set<string>();
  const hotelRoutes: SitemapUrl[] = [];

  for (const h of liveHotels) {
    if (h.id && !seenIds.has(h.id)) {
      seenIds.add(h.id);
      const modDate = h.updatedAt ? new Date(h.updatedAt).toISOString().split('T')[0] : today;
      hotelRoutes.push({
        loc: `/hotel/${encodeURIComponent(h.id)}`,
        priority: '0.90',
        changefreq: 'weekly',
        lastmod: modDate,
      });
    }
  }

  const allUrls = [...staticRoutes, ...dynamicLocationRoutes, ...hotelRoutes];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${allUrls
  .map(
    (u) => `  <url>
    <loc>${BASE_URL}${u.loc.replace(/&/g, '&amp;')}</loc>
    <lastmod>${u.lastmod || today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;
}

/**
 * Returns clean robots.txt directives
 */
export function generateRobotsTxt(): string {
  return `# Robots.txt for Travel Malawi - The Warm Heart of Africa
# https://ulendomalawi.com

User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/*
Disallow: /dashboard
Disallow: /dashboard/*
Disallow: /api/admin/*
Disallow: /my-bookings
Disallow: /profile
Disallow: /saved
Disallow: /marketing
Disallow: /marketing-deck
Disallow: /operations-guide
Disallow: /listing-guide
Disallow: /uat
Disallow: /uat-guide
Disallow: /uat-manual
Disallow: /platform-guide

# Googlebot and Bingbot follow the group above: a bot with its own group ignores
# the "*" rules, which used to let them crawl /admin and /my-bookings.

# Link-preview bots only fetch pages they are given
User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

# Canonical XML Sitemap
Sitemap: ${BASE_URL}/sitemap.xml
`;
}
