import { MenuItem, MenuSection, PriceMap } from '../types';

/**
 * Standard known culinary menu section keywords.
 */
const KNOWN_SECTIONS = [
  'starters',
  'starter',
  'appetizers',
  'appetizer',
  'entrées',
  'entree',
  'entrees',
  'mains',
  'main courses',
  'main course',
  'specials',
  'lodge specials',
  'chef specials',
  "chef's specials",
  "chef's recommendations",
  'lake malawi catch',
  'fish & seafood',
  'seafood',
  'fresh fish',
  'grill & barbecue',
  'grill',
  'from the grill',
  'steaks',
  'poultry',
  'salads',
  'salad',
  'soups',
  'soup',
  'pasta',
  'pizzas',
  'pizza',
  'burgers',
  'sandwiches',
  'light meals',
  'light bites',
  'snacks',
  'finger foods',
  'sides',
  'side dishes',
  'accompaniments',
  'traditional malawian',
  'local favorites',
  'malawian dishes',
  'vegetarian',
  'vegan',
  'platters',
  'desserts',
  'dessert',
  'sweets',
  'puddings',
  'kids menu',
  "children's menu",
  'breakfast',
  'morning bites',
  'brunch',
  'lunch',
  'dinner',
  'beverages',
  'drinks',
  'soft drinks',
  'cold drinks',
  'hot drinks',
  'coffee & tea',
  'coffee',
  'tea',
  'cocktails',
  'mocktails',
  'beers',
  'beer & ciders',
  'ciders',
  'wines',
  'wine list',
  'white wine',
  'red wine',
  'sparkling',
  'spirits',
  'whisky',
];

/**
 * Common dietary tags dictionary
 */
const DIETARY_MAP: Record<string, string> = {
  v: 'v',
  veg: 'v',
  vegetarian: 'v',
  vg: 'vg',
  ve: 'vg',
  vegan: 'vg',
  gf: 'gf',
  'gluten-free': 'gf',
  'gluten free': 'gf',
  df: 'df',
  'dairy-free': 'df',
  'dairy free': 'df',
  sf: 'sf',
  seafood: 'sf',
  fish: 'sf',
  s: 's',
  spicy: 's',
  hot: 's',
  h: 'h',
  halal: 'h',
  nuts: 'contains nuts',
  'contains nuts': 'contains nuts',
};

/**
 * Extracts dietary tags like (v), (gf), [vg], or inline keywords.
 */
export function extractDietaryTags(text: string): { tags: string[]; cleanedText: string } {
  const foundTags = new Set<string>();
  let cleaned = text;

  // 1. Bracketed tags like (v), (gf), (v, gf), [vg], (spicy)
  const bracketRegex = /[\(\[](v|vg|ve|gf|df|sf|s|h|veg|vegan|vegetarian|gluten-free|dairy-free|spicy|halal)[\)\]]/gi;
  cleaned = cleaned.replace(bracketRegex, (_, tag) => {
    const norm = DIETARY_MAP[tag.toLowerCase()];
    if (norm) foundTags.add(norm);
    return '';
  });

  // Multiple inside one bracket: (gf, v) or (v / gf)
  const multiBracketRegex = /[\(\[]([a-z\s,/+-]+)[\)\]]/gi;
  cleaned = cleaned.replace(multiBracketRegex, (fullMatch, inside) => {
    const parts = inside.split(/[,/+-]/).map((p: string) => p.trim().toLowerCase());
    let matchedAny = false;
    for (const part of parts) {
      if (DIETARY_MAP[part]) {
        foundTags.add(DIETARY_MAP[part]);
        matchedAny = true;
      }
    }
    return matchedAny ? '' : fullMatch;
  });

  return {
    tags: Array.from(foundTags),
    cleanedText: cleaned.replace(/\s+/g, ' ').trim(),
  };
}

/**
 * Parse price amounts and currencies from string.
 * Handles:
 *  - "MWK 14,000 / USD 8"
 *  - "MWK 14,000"
 *  - "MK 6,500"
 *  - "K14,000"
 *  - "14000 MWK"
 *  - "USD 8" / "$8" / "8 USD"
 *  - "£10" / "€12" / "R150"
 */
export function extractPrices(text: string): { prices: PriceMap; cleanedText: string } {
  const prices: PriceMap = {};
  let cleaned = text;

  // Replace commas inside numbers for clean parsing (e.g. 14,000 -> 14000)
  // Look for patterns like: MWK 14,000 / USD 8
  const dualCurrencyRegex = /(?:MWK|MK|K)?\s*([\d,]+(?:\.\d+)?)\s*(?:MWK|MK|K)?\s*[/|]\s*(?:USD|\$)?\s*([\d,]+(?:\.\d+)?)\s*(?:USD|\$)?/i;
  
  // Specific MWK patterns:
  // MWK 14,000 | MK 14,000 | K14,000 | 14,000 MWK | 14,000 MK
  const mwkPatterns = [
    /(?:MWK|MK|K)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)/gi,
    /([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)\s*(?:MWK|MK|Kwacha|Kwachas)/gi,
  ];

  // USD patterns:
  // USD 8 | $8 | 8 USD | US$ 8
  const usdPatterns = [
    /(?:USD|US\$|\$)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)/gi,
    /([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)\s*(?:USD|dollars?)/gi,
  ];

  // GBP patterns:
  const gbpPatterns = [
    /(?:GBP|£)\s*([0-9]+(?:\.[0-9]+)?)/gi,
    /([0-9]+(?:\.[0-9]+)?)\s*GBP/gi,
  ];

  // EUR patterns:
  const eurPatterns = [
    /(?:EUR|€)\s*([0-9]+(?:\.[0-9]+)?)/gi,
    /([0-9]+(?:\.[0-9]+)?)\s*EUR/gi,
  ];

  // ZAR patterns:
  const zarPatterns = [
    /(?:ZAR|R)\s*([0-9]+(?:\.[0-9]+)?)/gi,
    /([0-9]+(?:\.[0-9]+)?)\s*ZAR/gi,
  ];

  // 1. First test explicit MWK patterns
  for (const pat of mwkPatterns) {
    let match;
    while ((match = pat.exec(cleaned)) !== null) {
      const numStr = match[1].replace(/,/g, '');
      const val = parseFloat(numStr);
      if (!isNaN(val) && val > 0) {
        prices.MWK = val;
      }
    }
  }

  // 2. USD patterns
  for (const pat of usdPatterns) {
    let match;
    while ((match = pat.exec(cleaned)) !== null) {
      const numStr = match[1].replace(/,/g, '');
      const val = parseFloat(numStr);
      if (!isNaN(val) && val > 0) {
        prices.USD = val;
      }
    }
  }

  // 3. Fallback for other foreign currencies: convert to USD equivalent if USD not already set
  for (const pat of gbpPatterns) {
    let match;
    while ((match = pat.exec(cleaned)) !== null) {
      const val = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(val) && val > 0 && !prices.USD) prices.USD = Math.round(val * 1.25);
    }
  }

  for (const pat of eurPatterns) {
    let match;
    while ((match = pat.exec(cleaned)) !== null) {
      const val = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(val) && val > 0 && !prices.USD) prices.USD = Math.round(val * 1.08);
    }
  }

  for (const pat of zarPatterns) {
    let match;
    while ((match = pat.exec(cleaned)) !== null) {
      const val = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(val) && val > 0 && !prices.USD) prices.USD = Math.round(val / 18);
    }
  }

  // Strip price text out of the line so we leave only the dish name / description
  cleaned = cleaned
    .replace(/(?:\bMWK\b|\bMK\b|\bK\b|\bKwacha\b)\s*[\d,]+(?:\.\d+)?/gi, '')
    .replace(/[\d,]+(?:\.\d+)?\s*(?:\bMWK\b|\bMK\b|\bKwacha\b)/gi, '')
    .replace(/(?:\bUSD\b|US\$|\$)\s*[\d,]+(?:\.\d+)?/gi, '')
    .replace(/[\d,]+(?:\.\d+)?\s*(?:\bUSD\b|dollars?)/gi, '')
    .replace(/(?:\bGBP\b|£|\bEUR\b|€|\bZAR\b|\bR\b)\s*[\d,]+(?:\.\d+)?/gi, '')
    .replace(/[\d,]+(?:\.\d+)?\s*(?:\bGBP\b|\bEUR\b|\bZAR\b)/gi, '')
    // Clean trailing or orphan slashes, dots, and dashes
    .replace(/\s*[/|]\s*$/g, '')
    .replace(/[\s.\-—–:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { prices, cleanedText: cleaned };
}

/**
 * Determines whether a given line is a menu section header.
 */
function isSectionHeader(line: string, nextLine?: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 65) return false;

  // 1. Markdown style: # Starters, ## Starters, === Starters ===, --- Starters ---
  if (/^#{1,3}\s+\S+/.test(trimmed)) return true;
  if (/^[=\-~*]{2,}\s*[^=\-~*]+\s*[=\-~*]{2,}$/.test(trimmed)) return true;

  // Underlined headers (next line is --- or ===)
  if (nextLine && /^[=\-]{3,}$/.test(nextLine.trim())) return true;

  // 2. Trailing colon: "Starters:" or "Main Courses:"
  const withoutColon = trimmed.replace(/:$/, '').trim().toLowerCase();
  if (trimmed.endsWith(':') && withoutColon.length > 2 && withoutColon.length < 35) {
    // If it's not starting with an item number like "1:"
    if (!/^\d+$/.test(withoutColon)) return true;
  }

  // 3. Known section names (case-insensitive)
  const norm = withoutColon.replace(/[^a-z\s&]/gi, '').trim().toLowerCase();
  if (KNOWN_SECTIONS.includes(norm)) {
    return true;
  }

  // 4. Short ALL-CAPS line without numbers or prices (e.g. "STARTERS", "LAKE MALAWI SPECIALS")
  const isAllCaps = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
  const hasNoPrice = !/(mwk|mk|usd|\$|k\d|\d+,\d+|\d+\s*k)/i.test(trimmed);
  const words = trimmed.split(/\s+/);
  if (isAllCaps && hasNoPrice && words.length >= 1 && words.length <= 5 && trimmed.length >= 3) {
    return true;
  }

  return false;
}

/**
 * Clean a section title (strip decoration like hashes, asterisks, dashes, colons).
 */
function cleanSectionTitle(raw: string): string {
  let cleaned = raw
    .replace(/^#{1,4}\s*/, '')
    .replace(/^[=\-~*]+\s*/, '')
    .replace(/\s*[=\-~*]+$/, '')
    .replace(/:$/, '')
    .trim();

  // If fully uppercase, convert to Title Case for elegant presentation (e.g. "STARTERS" -> "Starters")
  if (cleaned === cleaned.toUpperCase() && cleaned.length > 2) {
    cleaned = cleaned
      .toLowerCase()
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  return cleaned;
}

/**
 * Parse CSV or TSV menu text
 */
function tryParseDelimitedMenu(rawText: string): MenuSection[] | null {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  // Check header line for CSV/TSV
  const firstLine = lines[0].toLowerCase();
  const isCsv = firstLine.includes(',') && (firstLine.includes('item') || firstLine.includes('dish') || firstLine.includes('name') || firstLine.includes('price') || firstLine.includes('mwk'));
  const isTsv = firstLine.includes('\t') && (firstLine.includes('item') || firstLine.includes('dish') || firstLine.includes('name') || firstLine.includes('price') || firstLine.includes('mwk'));

  if (!isCsv && !isTsv) return null;

  const delimiter = isCsv ? ',' : '\t';
  const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase());

  const nameIdx = headers.findIndex(h => h.includes('item') || h.includes('dish') || h.includes('name'));
  const secIdx = headers.findIndex(h => h.includes('section') || h.includes('category'));
  const descIdx = headers.findIndex(h => h.includes('desc'));
  const mwkIdx = headers.findIndex(h => h.includes('mwk') || h.includes('mk') || h.includes('kwacha'));
  const usdIdx = headers.findIndex(h => h.includes('usd') || h.includes('$') || h.includes('dollar'));
  const priceIdx = headers.findIndex(h => h === 'price' || h.includes('price'));
  const tagIdx = headers.findIndex(h => h.includes('tag') || h.includes('diet'));

  if (nameIdx === -1 && priceIdx === -1) return null;

  const sectionMap = new Map<string, MenuItem[]>();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length < 2) continue;

    const name = cols[nameIdx] || cols[0];
    if (!name) continue;

    const sectionName = (secIdx !== -1 && cols[secIdx]) ? cols[secIdx] : 'Main Menu';
    const description = (descIdx !== -1 && cols[descIdx]) ? cols[descIdx] : undefined;
    
    const prices: PriceMap = {};
    if (mwkIdx !== -1 && cols[mwkIdx]) {
      const v = parseFloat(cols[mwkIdx].replace(/[^0-9.]/g, ''));
      if (!isNaN(v) && v > 0) prices.MWK = v;
    }
    if (usdIdx !== -1 && cols[usdIdx]) {
      const v = parseFloat(cols[usdIdx].replace(/[^0-9.]/g, ''));
      if (!isNaN(v) && v > 0) prices.USD = v;
    }
    if (priceIdx !== -1 && cols[priceIdx] && Object.keys(prices).length === 0) {
      const parsed = extractPrices(cols[priceIdx]);
      Object.assign(prices, parsed.prices);
    }

    const tags: string[] = [];
    if (tagIdx !== -1 && cols[tagIdx]) {
      const parsedTags = extractDietaryTags(cols[tagIdx]);
      tags.push(...parsedTags.tags);
    }

    const item: MenuItem = {
      id: `local-item-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
      name,
      description,
      prices: Object.keys(prices).length > 0 ? prices : undefined,
      tags: tags.length > 0 ? tags : undefined,
    };

    const existing = sectionMap.get(sectionName) || [];
    existing.push(item);
    sectionMap.set(sectionName, existing);
  }

  if (sectionMap.size === 0) return null;

  return Array.from(sectionMap.entries()).map(([secName, items], sIdx) => ({
    id: `local-sec-${Date.now()}-${sIdx}`,
    name: cleanSectionTitle(secName),
    items,
  }));
}

/**
 * Main local parser engine.
 * Converts unstructured, pasted, or file-loaded menu text into fully formatted MenuSection[]
 * with zero external network calls or AI requirements.
 */
export function parseMenuText(rawText: string, preferredCurrencies: string[] = ['MWK', 'USD']): {
  sections: MenuSection[];
  stats: {
    sectionsCount: number;
    itemsCount: number;
    pricesFoundCount: number;
  };
} {
  if (!rawText || !rawText.trim()) {
    return { sections: [], stats: { sectionsCount: 0, itemsCount: 0, pricesFoundCount: 0 } };
  }

  // 1. Check if it's CSV or TSV
  const delimited = tryParseDelimitedMenu(rawText);
  if (delimited && delimited.length > 0 && delimited.some(s => s.items.length > 0)) {
    const totalItems = delimited.reduce((sum, s) => sum + s.items.length, 0);
    const totalPrices = delimited.reduce(
      (sum, s) => sum + s.items.filter(i => i.prices && Object.keys(i.prices).length > 0).length,
      0
    );
    return {
      sections: delimited,
      stats: {
        sectionsCount: delimited.length,
        itemsCount: totalItems,
        pricesFoundCount: totalPrices,
      },
    };
  }

  // 2. Parse unstructured menu text line-by-line
  const rawLines = rawText.split(/\r?\n/);
  const sections: MenuSection[] = [];

  let currentSection: MenuSection | null = null;
  let currentItem: MenuItem | null = null;

  // Helper to push current item safely
  const commitItem = () => {
    if (currentItem && currentSection) {
      // Ensure name is clean
      currentItem.name = currentItem.name.replace(/\s+/g, ' ').trim();
      if (currentItem.name.length > 0) {
        currentSection.items.push(currentItem);
      }
      currentItem = null;
    }
  };

  // Helper to ensure an active section exists
  const ensureSection = (name: string = 'Chef Specialties') => {
    if (!currentSection) {
      currentSection = {
        id: `local-sec-${Date.now()}-${sections.length}-${Math.random().toString(36).substring(2, 5)}`,
        name: cleanSectionTitle(name),
        items: [],
      };
      sections.push(currentSection);
    }
  };

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const trimmed = rawLine.trim();
    const nextLine = i + 1 < rawLines.length ? rawLines[i + 1] : undefined;

    // Skip empty lines (and commit current item)
    if (!trimmed) {
      commitItem();
      continue;
    }

    // Skip horizontal divider lines like "---" or "==="
    if (/^[=\-~*]{3,}$/.test(trimmed)) {
      continue;
    }

    // Check if this line is a section header
    if (isSectionHeader(trimmed, nextLine)) {
      commitItem();
      const secName = cleanSectionTitle(trimmed);
      currentSection = {
        id: `local-sec-${Date.now()}-${sections.length}-${Math.random().toString(36).substring(2, 5)}`,
        name: secName,
        items: [],
      };
      sections.push(currentSection);

      // Skip the underline row if it was followed by "---"
      if (nextLine && /^[=\-]{3,}$/.test(nextLine.trim())) {
        i++;
      }
      continue;
    }

    // If we don't have a section yet, create a default one
    ensureSection();

    // Check if this line has prices
    const { prices, cleanedText: textWithoutPrice } = extractPrices(trimmed);
    const hasPrices = Object.keys(prices).length > 0;

    // Check for dietary tags
    const { tags, cleanedText: rawCleanedText } = extractDietaryTags(textWithoutPrice);
    const fullyCleanedText = rawCleanedText.replace(/[\s.\-—–:]+$/g, '').trim();

    // Is this line a new menu item or a description for the previous item?
    if (hasPrices) {
      // A line with a price is definitively a new menu item!
      commitItem();

      // Look for separator between item name and description/notes (e.g. "Chambo Cakes - With spicy mayo")
      let itemName = fullyCleanedText;
      let inlineDesc = '';

      // Check for hyphen/em-dash or colon separator
      const sepMatch = fullyCleanedText.match(/^(.*?)\s+[-—–:]\s+(.*)$/);
      if (sepMatch) {
        itemName = sepMatch[1].trim();
        inlineDesc = sepMatch[2].trim();
      }

      // If item name ended up empty (e.g. the line was just "MWK 14,000"), handle edge cases
      if (!itemName && inlineDesc) {
        itemName = inlineDesc;
        inlineDesc = '';
      }

      currentItem = {
        id: `local-item-${Date.now()}-${currentSection!.items.length}-${Math.random().toString(36).substring(2, 6)}`,
        name: itemName || 'Special Item',
        description: inlineDesc || undefined,
        prices,
        tags: tags.length > 0 ? tags : undefined,
      };
    } else {
      // No price found on this line
      if (currentItem && !currentItem.description) {
        // If we have an active item waiting for description, this line is likely its description!
        // E.g.:
        // Chambo Fish Cakes - MWK 14,000 / USD 8
        // Fresh Lake Malawi chambo with spicy mayo dipping sauce (gf)
        currentItem.description = fullyCleanedText;
        if (tags.length > 0) {
          currentItem.tags = Array.from(new Set([...(currentItem.tags || []), ...tags]));
        }
        // Commit item after attaching description
        commitItem();
      } else {
        // Could this be an item without an explicit price (e.g. "Catch of the Day (Market Price)")?
        // Or could it be a section description if it's the very first line after a section header?
        if (currentSection && currentSection.items.length === 0 && !currentSection.description && trimmed.length > 15) {
          currentSection.description = trimmed;
        } else {
          // It's a new item (or header without price)
          commitItem();
          currentItem = {
            id: `local-item-${Date.now()}-${currentSection!.items.length}-${Math.random().toString(36).substring(2, 6)}`,
            name: fullyCleanedText || trimmed,
            tags: tags.length > 0 ? tags : undefined,
          };
        }
      }
    }
  }

  // Commit any trailing item
  commitItem();

  // Filter out any completely empty sections
  const validSections = sections.filter(s => s.items.length > 0 || s.name.length > 0);

  // If all items ended up in an untitled section, rename to "Menu"
  if (validSections.length === 1 && validSections[0].name === 'Chef Specialties') {
    validSections[0].name = 'Main Menu';
  }

  const totalItems = validSections.reduce((sum, s) => sum + s.items.length, 0);
  const totalPrices = validSections.reduce(
    (sum, s) => sum + s.items.filter(i => i.prices && Object.keys(i.prices).length > 0).length,
    0
  );

  return {
    sections: validSections,
    stats: {
      sectionsCount: validSections.length,
      itemsCount: totalItems,
      pricesFoundCount: totalPrices,
    },
  };
}
