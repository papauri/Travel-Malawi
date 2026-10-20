import { Hotel, RoomType } from '../types';
import { resolveHotelCoordinates, isValidLatLng } from './geo';

export type HotelEntry =
  | Hotel
  | {
      hotel: Hotel;
      rooms?: RoomType[];
      rating?: { average: number; count: number } | null;
    };

export interface AutonomousSeoInput {
  hotels: Hotel[];
  filteredHotels?: HotelEntry[];
  roomsByHotel?: Map<string, RoomType[]> | Record<string, RoomType[]>;
  ratingByHotel?: Map<string, { average: number; count: number }> | Record<string, { average: number; count: number }>;
  locationParam?: string | null;
  categoryParam?: string | null;
  searchParam?: string | null;
}

export interface AutonomousSeoResult {
  title: string;
  description: string;
  keywords: string;
  url: string;
  schema: Record<string, any>;
}

const BASE_URL = 'https://ulendomalawi.com';

function extractHotelList(items?: HotelEntry[]): Hotel[] {
  if (!items || items.length === 0) return [];
  return items.map((item) => ('hotel' in item && item.hotel ? item.hotel : (item as Hotel)));
}

function getRoomsForHotel(
  source: Map<string, RoomType[]> | Record<string, RoomType[]> | undefined,
  hotelId?: string
): RoomType[] {
  if (!source || !hotelId) return [];
  if (source instanceof Map) return source.get(hotelId) || [];
  return (source as Record<string, RoomType[]>)[hotelId] || [];
}

function getRatingForHotel(
  source: Map<string, { average: number; count: number }> | Record<string, { average: number; count: number }> | undefined,
  hotelId?: string
): { average: number; count: number } | undefined {
  if (!source || !hotelId) return undefined;
  if (source instanceof Map) return source.get(hotelId);
  return (source as Record<string, { average: number; count: number }>)[hotelId];
}

/**
 * Formats a currency range dynamically based on real room prices.
 */
function computePriceRange(rooms: RoomType[] = []): string | undefined {
  const mwkPrices = rooms
    .map((r) => r.prices?.MWK || r.priceMWK || (r.currency === 'MWK' && typeof r.price === 'number' ? r.price : 0))
    .filter((p): p is number => typeof p === 'number' && p > 0);

  const usdPrices = rooms
    .map((r) => r.prices?.USD || (r.currency === 'USD' && typeof r.price === 'number' ? r.price : 0))
    .filter((p): p is number => typeof p === 'number' && p > 0);

  if (mwkPrices.length === 0 && usdPrices.length === 0) {
    return undefined;
  }

  const parts: string[] = [];
  if (mwkPrices.length > 0) {
    const minMwk = Math.min(...mwkPrices);
    const maxMwk = Math.max(...mwkPrices);
    parts.push(
      minMwk === maxMwk
        ? `MK ${minMwk.toLocaleString()}`
        : `MK ${minMwk.toLocaleString()} - MK ${maxMwk.toLocaleString()}`
    );
  }

  if (usdPrices.length > 0) {
    const minUsd = Math.min(...usdPrices);
    const maxUsd = Math.max(...usdPrices);
    parts.push(
      minUsd === maxUsd ? `$${minUsd}` : `$${minUsd} - $${maxUsd}`
    );
  }

  return parts.join(' / ');
}

/**
 * Computes the geographical centroid of a list of hotels from their actual live coordinates.
 */
function computeCentroid(hotels: Hotel[]): { lat: number; lng: number } | null {
  const validCoords: { lat: number; lng: number }[] = [];

  for (const h of hotels) {
    const c = resolveHotelCoordinates(h);
    if (c && isValidLatLng(c)) {
      validCoords.push(c);
    }
  }

  if (validCoords.length === 0) return null;

  const sumLat = validCoords.reduce((acc, curr) => acc + curr.lat, 0);
  const sumLng = validCoords.reduce((acc, curr) => acc + curr.lng, 0);

  return {
    lat: Number((sumLat / validCoords.length).toFixed(4)),
    lng: Number((sumLng / validCoords.length).toFixed(4)),
  };
}

/**
 * Autonomously generates dynamic, live SEO metadata and Schema.org structured data
 * from real-time Firestore property data with zero hardcoding.
 */
export function generateAutonomousSeo({
  hotels,
  filteredHotels,
  roomsByHotel,
  ratingByHotel,
  locationParam,
  categoryParam,
  searchParam,
}: AutonomousSeoInput): AutonomousSeoResult {
  const resolvedFiltered = extractHotelList(filteredHotels);
  const rawLoc = (locationParam || searchParam || '').trim();
  // A search that matched nothing must say so; falling back to every hotel
  // would advertise "N lodges in <place>" and rate the place on other towns' reviews.
  const filtersActive = Boolean(rawLoc || categoryParam);
  const activeHotels =
    filteredHotels !== undefined && filtersActive
      ? resolvedFiltered
      : resolvedFiltered.length > 0
        ? resolvedFiltered
        : hotels;

  // 1. Gather all prices across active hotels dynamically
  const allMwkPrices: number[] = [];
  const allUsdPrices: number[] = [];
  let totalReviews = 0;
  let totalRatingSum = 0;

  for (const h of activeHotels) {
    const hotelRooms = getRoomsForHotel(roomsByHotel, h.id);
    for (const r of hotelRooms) {
      const mwk = r.prices?.MWK || r.priceMWK || (r.currency === 'MWK' && typeof r.price === 'number' ? r.price : 0);
      if (typeof mwk === 'number' && mwk > 0) allMwkPrices.push(mwk);
      const usd = r.prices?.USD || (r.currency === 'USD' && typeof r.price === 'number' ? r.price : 0);
      if (typeof usd === 'number' && usd > 0) allUsdPrices.push(usd);
    }

    const ratingInfo = getRatingForHotel(ratingByHotel, h.id);
    if (ratingInfo && ratingInfo.count > 0 && ratingInfo.average > 0) {
      totalReviews += ratingInfo.count;
      totalRatingSum += ratingInfo.average * ratingInfo.count;
    } else if (h.reviewsSummary && h.reviewsSummary.averageRating > 0 && h.reviewsSummary.count > 0) {
      totalReviews += h.reviewsSummary.count;
      totalRatingSum += h.reviewsSummary.averageRating * h.reviewsSummary.count;
    }
  }

  const minMwk = allMwkPrices.length > 0 ? Math.min(...allMwkPrices) : null;
  const maxMwk = allMwkPrices.length > 0 ? Math.max(...allMwkPrices) : null;
  const minUsd = allUsdPrices.length > 0 ? Math.min(...allUsdPrices) : null;
  const maxUsd = allUsdPrices.length > 0 ? Math.max(...allUsdPrices) : null;

  const aggregateRatingValue =
    totalReviews > 0 ? Number((totalRatingSum / totalReviews).toFixed(2)) : null;

  // Format dynamic price range
  let dynamicPriceRange: string | undefined = undefined;
  if (minMwk !== null && maxMwk !== null) {
    const mwkPart =
      minMwk === maxMwk
        ? `MK ${minMwk.toLocaleString()}`
        : `MK ${minMwk.toLocaleString()} - MK ${maxMwk.toLocaleString()}`;
    const usdPart =
      minUsd !== null && maxUsd !== null
        ? minUsd === maxUsd
          ? `$${minUsd}`
          : `$${minUsd} - $${maxUsd}`
        : '';
    dynamicPriceRange = usdPart ? `${mwkPart} / ${usdPart}` : mwkPart;
  }

  // 2. Resolve dynamic location name and context
  const hasLocationFilter = Boolean(rawLoc);
  const locationLabel = hasLocationFilter
    ? rawLoc.charAt(0).toUpperCase() + rawLoc.slice(1)
    : 'Malawi';

  const categoryLabel = categoryParam ? `${categoryParam} ` : '';
  const countLabel = activeHotels.length > 0 ? `${activeHotels.length} ` : '';

  // 3. Autonomous Title, Description, and Keywords
  let title = 'Travel Malawi';
  let description =
    'Travel Malawi is a directory of verified independent lodges, Lake Malawi cottages, safari camps, boutique hotels, and guest houses across Malawi. Contact each property directly.';
  let keywords =
    'Travel Malawi, Lake Malawi lodges, Cape Maclear cottages, Liwonde safari camps, Lilongwe hotels, Blantyre guest houses, Malawi accommodation directory';
  let url = BASE_URL;

  if (hasLocationFilter) {
    const priceSnippet = minMwk ? ` from MK ${minMwk.toLocaleString()}` : '';
    title = `${countLabel}${categoryLabel}Lodges & Stays in ${locationLabel}${priceSnippet} — Travel Malawi`;
    description = `Discover ${countLabel}verified independent lodges, boutique hotels, and cottages in ${locationLabel}. Rates in MWK and USD, with each property's own contact details${priceSnippet ? `. Rates${priceSnippet}` : ''}.`;
    keywords = `${locationLabel} lodges, ${locationLabel} hotels, ${locationLabel} where to stay, ${locationLabel} accommodations Malawi, ${categoryLabel}${locationLabel} stays`;
    url = `${BASE_URL}/?location=${encodeURIComponent(rawLoc)}`;
  } else if (categoryParam) {
    title = `${countLabel}${categoryParam} Accommodations in Malawi — Travel Malawi`;
    description = `Browse ${countLabel}verified ${categoryParam.toLowerCase()} stays, safari camps, and lakeside cottages across Malawi. Rates in MWK and USD, with each property's own contact details.`;
    keywords = `${categoryParam} Malawi, Malawi lodges, safari camps Malawi, boutique stays Malawi`;
    url = `${BASE_URL}/?category=${encodeURIComponent(categoryParam)}`;
  }

  // 4. Autonomous Schema.org Graph Construction
  const schemaGraph: any[] = [
    {
      '@type': 'WebSite',
      '@id': `${BASE_URL}/#website`,
      url: `${BASE_URL}/`,
      name: 'Travel Malawi',
      alternateName: 'Ulendo Malawi',
      description:
        'Travel Malawi is a directory of verified independent lodges, Lake Malawi cottages, safari camps, boutique hotels, and guest houses across Malawi. Contact each property directly.',
      inLanguage: 'en',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${BASE_URL}/?search={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'TravelAgency',
      '@id': `${BASE_URL}/#organization`,
      name: 'Travel Malawi',
      alternateName: ['Ulendo Malawi', 'Travel Malawi Hospitality Platform'],
      url: `${BASE_URL}/`,
      logo: `${BASE_URL}/favicon-32.png`,
      image: `${BASE_URL}/icons/icon-512.png`,
      description:
        'The Warm Heart of Africa directory of independent lodges, safari camps, and lakeside cottages in Malawi. Travel Malawi does not take bookings or payments.',
      areaServed: {
        '@type': 'Country',
        name: 'Malawi',
      },
    },
  ];

  // 5. Dynamic LocalBusiness markup for the searched region (or top region)
  if (hasLocationFilter && activeHotels.length > 0) {
    const centroid = computeCentroid(activeHotels);
    const localBusinessNode: Record<string, any> = {
      '@type': ['LocalBusiness', 'LodgingBusiness'],
      '@id': `${BASE_URL}/#hub-${encodeURIComponent(rawLoc.toLowerCase())}`,
      name: `Travel Malawi — ${locationLabel} Stays & Accommodations`,
      description: `Verified independent lodges, boutique hotels, and guest houses located in ${locationLabel}, Malawi. Rates in MWK and USD; contact each property directly.`,
      url,
      address: {
        '@type': 'PostalAddress',
        addressLocality: locationLabel,
        addressRegion: activeHotels[0]?.location || 'Malawi',
        addressCountry: 'MW',
      },
    };

    if (dynamicPriceRange) {
      localBusinessNode.priceRange = dynamicPriceRange;
    }

    if (centroid) {
      localBusinessNode.geo = {
        '@type': 'GeoCoordinates',
        latitude: centroid.lat,
        longitude: centroid.lng,
      };
    }

    if (aggregateRatingValue !== null && totalReviews > 0) {
      localBusinessNode.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: String(aggregateRatingValue),
        reviewCount: String(totalReviews),
        bestRating: '5',
        worstRating: '1',
      };
    }

    schemaGraph.push(localBusinessNode);
  }

  // 6. Dynamic ItemList of live hotels on page
  const liveItems = activeHotels.slice(0, 10).map((hotel, index) => {
    const hotelRooms = getRoomsForHotel(roomsByHotel, hotel.id);
    const hotelPriceRange = computePriceRange(hotelRooms);
    const hotelCoords = resolveHotelCoordinates(hotel);
    const hotelRating = getRatingForHotel(ratingByHotel, hotel.id);

    const itemNode: Record<string, any> = {
      '@type': ['LodgingBusiness', hotel.category === 'Luxury' ? 'Resort' : 'Hotel'],
      name: hotel.name,
      url: `${BASE_URL}/hotel/${hotel.id}`,
      description: hotel.description || `${hotel.name} in ${hotel.location || 'Malawi'}`,
      address: {
        '@type': 'PostalAddress',
        addressLocality: hotel.location || 'Malawi',
        addressRegion: 'Malawi',
        addressCountry: 'MW',
      },
    };

    if (hotel.imageUrl) {
      itemNode.image = hotel.imageUrl.startsWith('http')
        ? hotel.imageUrl
        : `${BASE_URL}${hotel.imageUrl.startsWith('/') ? '' : '/'}${hotel.imageUrl}`;
    }

    if (hotelPriceRange) {
      itemNode.priceRange = hotelPriceRange;
    }

    if (hotelCoords && isValidLatLng(hotelCoords)) {
      itemNode.geo = {
        '@type': 'GeoCoordinates',
        latitude: hotelCoords.lat,
        longitude: hotelCoords.lng,
      };
    }

    if (hotelRating && hotelRating.count > 0 && hotelRating.average > 0) {
      itemNode.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: hotelRating.average.toFixed(1),
        reviewCount: String(hotelRating.count),
      };
    } else if (hotel.reviewsSummary && hotel.reviewsSummary.averageRating > 0) {
      itemNode.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: hotel.reviewsSummary.averageRating.toFixed(1),
        reviewCount: String(hotel.reviewsSummary.count || 1),
      };
    }

    return {
      '@type': 'ListItem',
      position: index + 1,
      item: itemNode,
    };
  });

  if (liveItems.length > 0) {
    schemaGraph.push({
      '@type': 'ItemList',
      '@id': `${BASE_URL}/#live-stays-list`,
      name: hasLocationFilter
        ? `Verified Lodges & Stays in ${locationLabel}`
        : 'Verified Lodges & Accommodations Across Malawi',
      numberOfItems: liveItems.length,
      itemListElement: liveItems,
    });
  }

  // 7. Dynamic Breadcrumbs
  const breadcrumbElements: any[] = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: `${BASE_URL}/`,
    },
  ];

  if (hasLocationFilter) {
    breadcrumbElements.push({
      '@type': 'ListItem',
      position: 2,
      name: locationLabel,
      item: url,
    });
  } else if (categoryParam) {
    breadcrumbElements.push({
      '@type': 'ListItem',
      position: 2,
      name: categoryParam,
      item: url,
    });
  }

  schemaGraph.push({
    '@type': 'BreadcrumbList',
    '@id': `${BASE_URL}/#breadcrumbs`,
    itemListElement: breadcrumbElements,
  });

  return {
    title,
    description,
    keywords,
    url,
    schema: {
      '@context': 'https://schema.org',
      '@graph': schemaGraph,
    },
  };
}
