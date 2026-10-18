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
