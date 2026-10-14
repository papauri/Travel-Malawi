import { MALAWI_HOSPITALITY_REGISTRY } from '../src/lib/malawiHospitalityRegistry';

export const BASE_URL = 'https://ulendomalawi.com';

export interface SitemapUrl {
  loc: string;
  priority: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  lastmod?: string;
}

/**
 * Generates the complete, high-authority sitemap.xml for Travel Malawi
 */
export function generateSitemapXml(
  liveHotels: { id: string; updatedAt?: number; location?: string; district?: string }[] = []
): string {
  const today = new Date().toISOString().split('T')[0];

  // Core static landing pages
  const staticRoutes: SitemapUrl[] = [
    { loc: '/', priority: '1.0', changefreq: 'daily', lastmod: today },
    { loc: '/list-your-property', priority: '0.85', changefreq: 'weekly', lastmod: today },
    { loc: '/host-guide', priority: '0.80', changefreq: 'weekly', lastmod: today },
    { loc: '/how-hosting-works', priority: '0.80', changefreq: 'weekly', lastmod: today },
    { loc: '/stay-owner-leaflet', priority: '0.75', changefreq: 'monthly', lastmod: today },
    { loc: '/marketing', priority: '0.70', changefreq: 'monthly', lastmod: today },
    { loc: '/operations-guide', priority: '0.70', changefreq: 'monthly', lastmod: today },
    { loc: '/concept-validation', priority: '0.65', changefreq: 'monthly', lastmod: today },
    { loc: '/terms', priority: '0.50', changefreq: 'monthly', lastmod: today },
    { loc: '/privacy', priority: '0.50', changefreq: 'monthly', lastmod: today },
    { loc: '/refunds', priority: '0.50', changefreq: 'monthly', lastmod: today },
  ];

  // Dynamically harvest all unique locations and districts from live hotels and registry
  const uniqueLocations = new Set<string>();
  for (const h of liveHotels) {
    if (h.district) uniqueLocations.add(h.district.trim());
    if (h.location) uniqueLocations.add(h.location.trim());
  }
  for (const reg of MALAWI_HOSPITALITY_REGISTRY) {
    if (reg.district) uniqueLocations.add(reg.district.trim());
    if (reg.location) uniqueLocations.add(reg.location.trim());
  }

  const dynamicLocationRoutes: SitemapUrl[] = Array.from(uniqueLocations)
    .filter(Boolean)
    .map((loc) => ({
      loc: `/?location=${encodeURIComponent(loc)}`,
      priority: '0.90',
      changefreq: 'daily',
      lastmod: today,
    }));

  // Collect hotel IDs from registry and live database
  const seenIds = new Set<string>();
  const hotelRoutes: SitemapUrl[] = [];

  // 1. Live Firestore hotels
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

  // 2. Verified national registry hotels
  for (const reg of MALAWI_HOSPITALITY_REGISTRY) {
    if (reg.id && !seenIds.has(reg.id)) {
      seenIds.add(reg.id);
      hotelRoutes.push({
        loc: `/hotel/${encodeURIComponent(reg.id)}`,
        priority: '0.90',
        changefreq: 'weekly',
        lastmod: today,
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

# Major search engines crawl rate
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

# Canonical XML Sitemap
Sitemap: ${BASE_URL}/sitemap.xml
`;
}
