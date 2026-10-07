import { PROPERTY_CATEGORIES, COMMON_AMENITIES, PropertyCategory } from './listing';

export interface DescriptionAnalysisResult {
  categories: PropertyCategory[];
  primaryCategory: PropertyCategory;
  matchedAmenities: string[];
  customAmenities: string[];
  reasoning: string;
}

/**
 * Intelligent keyword and phrase matcher grounded in Malawian hospitality geography and accommodation types.
 * Serves as an instant, zero-latency local analyzer and provides fallback when network or AI quotas are limited.
 */
export function analyzeDescriptionLocal(
  description: string,
  name?: string,
  location?: string
): DescriptionAnalysisResult {
  const combined = `${name || ''} ${location || ''} ${description || ''}`.toLowerCase();

  // 1. Detect Amenities
  const matchedAmenitiesSet = new Set<string>();

  const amenityRules: Array<{ amenity: string; patterns: RegExp[] }> = [
    {
      amenity: 'Free WiFi',
      patterns: [/\bwi-?fi\b/i, /\binternet\b/i, /\bfiber\b/i, /\bwireless\b/i, /\bconnected\b/i],
    },
    {
      amenity: 'Dedicated Workspace',
      patterns: [/\bworkspace\b/i, /\bdesk\b/i, /\bergonomic\b/i, /\bwork station\b/i, /\bremote work\b/i],
    },
    {
      amenity: 'Breakfast included',
      patterns: [/\bbreakfast\b/i, /\bb&b\b/i, /\bmorning meal\b/i, /\bcontinental\b/i, /\bfull breakfast\b/i],
    },
    {
      amenity: 'Swimming pool',
      patterns: [/\bpool\b/i, /\bswimming\b/i, /\bplunge pool\b/i, /\binfinity pool\b/i],
    },
    {
      amenity: 'Restaurant',
      patterns: [/\brestaurant\b/i, /\bdining\b/i, /\bcuisine\b/i, /\bchef\b/i, /\bmeals\b/i, /\bchambo\b/i, /\bfood\b/i, /\bkitchen\b/i],
    },
    {
      amenity: 'Bar',
      patterns: [/\bbar\b/i, /\bcocktail\b/i, /\blounge\b/i, /\bdrinks\b/i, /\bbeers\b/i, /\bwine\b/i, /\bpub\b/i],
    },
    {
      amenity: 'Air conditioning',
      patterns: [/\bair condition/i, /\ba\/c\b/i, /\bac\b/i, /\bclimate control\b/i, /\bair-conditioned\b/i],
    },
    {
      amenity: 'Hot water',
      patterns: [/\bhot water\b/i, /\bhot shower\b/i, /\bgeyser\b/i, /\bsolar water\b/i, /\bwarm shower\b/i],
    },
    {
      amenity: 'Backup power',
      patterns: [/\bsolar\b/i, /\bgenerator\b/i, /\bbackup power\b/i, /\binverter\b/i, /\b24\/7 power\b/i, /\belectricity backup\b/i],
    },
    {
      amenity: 'Secure parking',
      patterns: [/\bparking\b/i, /\bcar park\b/i, /\bsecure parking\b/i, /\bguarded\b/i, /\bgarage\b/i],
    },
    {
      amenity: 'Airport transfer',
      patterns: [/\bairport\b/i, /\btransfer\b/i, /\bshuttle\b/i, /\bpickup\b/i, /\bpick-up\b/i],
    },
    {
      amenity: 'Lake view',
      patterns: [/\blake view\b/i, /\boverlooking the lake\b/i, /\blakeshore view\b/i, /\bviews of lake\b/i, /\blake vista\b/i, /\bwater view\b/i],
    },
    {
      amenity: 'Private beach',
      patterns: [/\bbeach\b/i, /\blakefront\b/i, /\bshoreline\b/i, /\bsandy shore\b/i, /\bwaterfront\b/i, /\bprivate beach\b/i],
    },
    {
      amenity: 'Boat trips',
      patterns: [/\bboat\b/i, /\bcruise\b/i, /\bkayak\b/i, /\bcanoe\b/i, /\bsnorkel\b/i, /\bdiving\b/i, /\bsailing\b/i, /\bcatamaran\b/i],
    },
    {
      amenity: 'Spa',
      patterns: [/\bspa\b/i, /\bmassage\b/i, /\bwellness\b/i, /\bsauna\b/i, /\btherapy\b/i],
    },
    {
      amenity: 'Gym',
      patterns: [/\bgym\b/i, /\bfitness\b/i, /\bworkout\b/i, /\bexercise\b/i],
    },
    {
      amenity: 'Conference room',
      patterns: [/\bconference\b/i, /\bmeeting\b/i, /\bboardroom\b/i, /\bevents?\b/i, /\bhall\b/i, /\bseminar\b/i],
    },
    {
      amenity: 'Laundry',
      patterns: [/\blaundry\b/i, /\bwashing\b/i, /\bdry cleaning\b/i, /\bironing\b/i],
    },
    {
      amenity: 'Room service',
      patterns: [/\broom service\b/i, /\bin-room dining\b/i, /\bconcierge\b/i],
    },
    {
      amenity: 'Family rooms',
      patterns: [/\bfamily\b/i, /\bkids\b/i, /\bchildren\b/i, /\binterconnected\b/i, /\bcrib\b/i],
    },
    {
      amenity: 'Pet friendly',
      patterns: [/\bpet\b/i, /\bdog\b/i, /\banimals allowed\b/i, /\bpet friendly\b/i],
    },
  ];

  for (const rule of amenityRules) {
    if (rule.patterns.some(p => p.test(combined))) {
      matchedAmenitiesSet.add(rule.amenity);
    }
  }

  // 2. Detect Categories
  const categoryScores: Record<PropertyCategory, number> = {
    'Lake & Beach': 0,
    'Safari & Wildlife': 0,
    'Romantic Escape': 0,
    'Family': 0,
    'Adventure': 0,
    'Luxury': 0,
    'Bed & Breakfast': 0,
    'Guest House': 0,
    'Cottage & Chalet': 0,
  };

  // Lake & Beach indicators
  if (/lake|beach|water|shore|cape maclear|senga bay|mangochi|nkhata bay|likoma|chintheche|monkey bay/i.test(combined)) {
    categoryScores['Lake & Beach'] += 5;
  }
  // Safari & Wildlife indicators
  if (/safari|wildlife|game drive|park|reserve|liwonde|majete|nyika|kasungu|animals|elephants|hippo|leopard|birding/i.test(combined)) {
    categoryScores['Safari & Wildlife'] += 6;
  }
  // Romantic Escape indicators
  if (/romantic|honeymoon|couples|intimate|secluded|retreat|lovers|getaway|candlelit/i.test(combined)) {
    categoryScores['Romantic Escape'] += 4;
  }
  // Family indicators
  if (/family|children|kids|spacious chalets|playground|multi-room|all ages/i.test(combined)) {
    categoryScores['Family'] += 4;
  }
  // Adventure indicators
  if (/adventure|hiking|backpack|diving|climbing|trekking|mulanje|trail|kayak|expedition|dive/i.test(combined)) {
    categoryScores['Adventure'] += 4;
  }
  // Luxury indicators
  if (/luxury|5-star|five-star|exclusive|premier|butler|fine dining|vip|infinity pool|lavish/i.test(combined)) {
    categoryScores['Luxury'] += 4;
  }
  // Bed & Breakfast indicators
  if (/bed & breakfast|bed and breakfast|b&b|homestay|intimate b&b/i.test(combined)) {
    categoryScores['Bed & Breakfast'] += 5;
  }
  // Guest House indicators
  if (/guest house|guesthouse|city stay|suburban|transit|area 10|area 43|area 11|lilongwe|blantyre|mzuzu/i.test(combined)) {
    categoryScores['Guest House'] += 4;
  }
  // Cottage & Chalet indicators
  if (/cottage|chalet|cabin|self-catering|bungalow|private villa|lakeside cottage/i.test(combined)) {
    categoryScores['Cottage & Chalet'] += 5;
  }

  // Sort categories by score descending
  const sortedCategories = (Object.keys(categoryScores) as PropertyCategory[])
    .filter(cat => categoryScores[cat] > 0)
    .sort((a, b) => categoryScores[b] - categoryScores[a]);

  const categories: PropertyCategory[] = sortedCategories.length > 0
    ? sortedCategories.slice(0, 2)
    : ['Guest House'];

  const primaryCategory = categories[0];

  // Specific custom highlights mentioned
  const customAmenities: string[] = [];
  if (/\bkayak\b/i.test(combined) && !matchedAmenitiesSet.has('Boat trips')) customAmenities.push('Kayaks');
  if (/\bsnorkel/i.test(combined)) customAmenities.push('Snorkeling gear');
  if (/\bcampfire|fire pit\b/i.test(combined)) customAmenities.push('Campfire / Fire pit');
  if (/\bbraai|barbecue|bbq\b/i.test(combined)) customAmenities.push('Braai / BBQ area');
  if (/\bsunbed|hammock\b/i.test(combined)) customAmenities.push('Hammocks & Sunbeds');

  const matchedAmenities = Array.from(matchedAmenitiesSet);

  const reasoning = `Matched ${matchedAmenities.length} common amenities and identified ${primaryCategory} based on property highlights.`;

  return {
    categories,
    primaryCategory,
    matchedAmenities,
    customAmenities,
    reasoning,
  };
}
