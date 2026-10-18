import { PropertyCategory } from './listing';

export interface RegisteredProperty {
  id: string;
  name: string;
  aliases?: string[];
  category: PropertyCategory;
  region: string;
  location: string;
  district: string;
  coordinates: { lat: number; lng: number };
  badge: string;
  locationNotes: string;
  description: string;
  summary: string;
  amenities: string[];
  checkInTime: string;
  checkOutTime: string;
  suggestedRooms: Array<{
    name: string;
    description: string;
    priceMwk: number;
    priceUsd: number;
    maxGuests: number;
    baseGuests?: number;
    quantity?: number;
    amenities?: string[];
  }>;
  contactPhone?: string;
  contactEmail?: string;
  contactWhatsapp?: string;
}

/**
 * Registry of onboarded properties used for name lookups. Deliberately empty: per directive D1
 * only properties onboarded through the platform (approved `hotels` in Firestore) may be named,
 * suggested or prefilled anywhere in the product, so no real lodge data is hard-coded here.
 */
export const MALAWI_HOSPITALITY_REGISTRY: RegisteredProperty[] = [];

/**
 * Normalizes query string for fuzzy and partial matching.
 */
function cleanQuery(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Searches the curated Malawian Hospitality Registry.
 * High-precision scoring that prioritizes exact prefix and word-boundary matches.
 */
export function searchMalawiHospitalityRegistry(query: string, limit = 8): RegisteredProperty[] {
  const q = cleanQuery(query);
  if (q.length < 2) return [];

  const scored: Array<{ property: RegisteredProperty; score: number }> = [];

  for (const p of MALAWI_HOSPITALITY_REGISTRY) {
    const pName = cleanQuery(p.name);
    const pLoc = cleanQuery(p.location);
    const pDist = cleanQuery(p.district);
    const pCat = cleanQuery(p.category);
    const aliases = (p.aliases || []).map(cleanQuery);

    let score = 0;

    // Exact or prefix match on name (highest score)
    if (pName === q) {
      score += 100;
    } else if (pName.startsWith(q)) {
      score += 80;
    } else if (pName.includes(` ${q}`)) {
      score += 65;
    } else if (pName.includes(q)) {
      score += 50;
    }

    // Alias matches
    for (const alias of aliases) {
      if (alias === q) score += 90;
      else if (alias.startsWith(q)) score += 70;
      else if (alias.includes(q)) score += 40;
    }

    // Location / District matches
    if (pDist.startsWith(q) || pDist === q) {
      score += 35;
    } else if (pLoc.includes(q)) {
      score += 30;
    }

    // Category matches
    if (pCat === q || pCat.startsWith(q)) {
      score += 20;
    }

    if (score > 0) {
      scored.push({ property: p, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(s => s.property);
}

/**
 * Finds a single matching property in the registry by exact or near-exact name.
 */
export function getRegisteredPropertyByName(name: string): RegisteredProperty | null {
  const q = cleanQuery(name);
  if (!q) return null;

  for (const p of MALAWI_HOSPITALITY_REGISTRY) {
    const pName = cleanQuery(p.name);
    if (pName === q) return p;
    for (const a of p.aliases || []) {
      if (cleanQuery(a) === q) return p;
    }
  }

  // Fallback to substring match if unique enough
  const matches = searchMalawiHospitalityRegistry(name, 1);
  return matches.length > 0 ? matches[0] : null;
}

/**
 * Generates smart hospitality suggestions if user is naming a new independent stay.
 */
export function generateSmartPropertySuggestions(rawInput: string): Array<{
  name: string;
  category: PropertyCategory;
  badge: string;
  description: string;
}> {
  const trimmed = rawInput.trim();
  if (trimmed.length < 3) return [];

  // Capitalize properly
  const formatted = trimmed
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const lower = trimmed.toLowerCase();
  const suggestions: Array<{ name: string; category: PropertyCategory; badge: string; description: string }> = [];

  const hasSuffix = lower.includes('lodge') || lower.includes('chalet') || lower.includes('cottage') ||
    lower.includes('hotel') || lower.includes('inn') || lower.includes('camp') || lower.includes('guest') ||
    lower.includes('b&b') || lower.includes('retreat') || lower.includes('resort');

  if (!hasSuffix) {
    if (lower.includes('lake') || lower.includes('beach') || lower.includes('bay')) {
      suggestions.push({
        name: `${formatted} Lakeside Chalets`,
        category: 'Lake & Beach',
        badge: 'Lakeside Chalet',
        description: `Direct beach and water access along Lake Malawi.`,
      });
      suggestions.push({
        name: `${formatted} Beach Resort`,
        category: 'Lake & Beach',
        badge: 'Beachfront Resort',
        description: `Sandy shores and panoramic Lake Malawi sunrise views.`,
      });
    } else if (lower.includes('safari') || lower.includes('wild') || lower.includes('bush')) {
      suggestions.push({
        name: `${formatted} Safari Camp`,
        category: 'Safari & Wildlife',
        badge: 'Safari Wildlife Camp',
        description: `Bush chalets with guided wildlife excursions.`,
      });
    } else {
      suggestions.push({
        name: `${formatted} Lodge`,
        category: 'Bed & Breakfast',
        badge: 'Welcoming Lodge',
        description: `Comfortable accommodations with warm Malawian hospitality.`,
      });
      suggestions.push({
        name: `${formatted} Cottage & Chalets`,
        category: 'Cottage & Chalet',
        badge: 'Private Cottage',
        description: `Self-contained private chalets with garden verandas.`,
      });
      suggestions.push({
        name: `${formatted} Boutique Guest House`,
        category: 'Guest House',
        badge: 'Boutique Guest House',
        description: `Quiet, secure guest house with high-speed Wi-Fi and solar backup.`,
      });
    }
  }

  return suggestions;
}

/**
 * Onboarding inspiration list. Empty by design (directive D1): no real property that was not
 * onboarded through the platform may be named in the product.
 */
export const POPULAR_MALAWI_PROPERTIES_SHOWCASE: Array<{ name: string; category: string; location: string }> = [];
