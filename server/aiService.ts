import { AIProviderId, getEffectiveApiKey, loadAIConfig, markProviderValidity, getAvailableProviders, AISystemConfig } from './aiConfig';

export interface GenerationRequest {
  action: 'draft' | 'polish' | 'shorten' | 'highlights' | 'suggest_amenities' | 'suggest_rooms' | 'review_listing' | 'suggest_rate' | 'lookup_property';
  entityType: 'property' | 'room' | 'conference' | 'dining';
  currentText?: string;
  details?: {
    name?: string;
    location?: string;
    locationNotes?: string;
    category?: string;
    amenities?: string[];
    capacity?: number;
    extraNotes?: string;
    roomsCount?: number;
  };
}

export interface GenerationResult {
  text: string;
  provider: AIProviderId;
  model: string;
  data?: any;
}

const SYSTEM_PROMPT = `You are an exceptionally friendly, empowering, and knowledgeable AI travel & hospitality engine for Malawi — The Warm Heart of Africa. You assist lodge owners, boutique camp managers, and hosts across Malawi to craft world-class accommodations, room pricing, and guest experiences.

Domain Knowledge & Principles:
- Deep geographic & regional understanding: Lake Malawi shoreline (Cape Maclear, Chembe, Monkey Bay, Senga Bay, Nkhata Bay, Likoma Island, Chizumulu Island, Mangochi), Wildlife & Safari reserves (Liwonde National Park, Majete Wildlife Reserve, Nyika Plateau, Mount Mulanje, Zomba Plateau, Nkhotakota Reserve), Urban business & leisure (Lilongwe City Centre, Area 10, Area 43; Blantyre commercial hub, Mount Soche; Mzuzu, Karonga).
- Real lodging setups & guest desires: Lakefront chalets, luxury safari tented suites, lakeside cottages, executive suites, eco-lodges, backpacker beach chalets, and self-catering villas.
- Vital infrastructure realities: 24/7 solar power with inverter & generator backup (crucial for local power reliability), borehole / purified water, hot showers, mosquito nets over beds, private verandas, boat transfers across the lake, fresh Lake Malawi Chambo fish dining, local guide arrangements.
- Dual-currency pricing:
  * US Dollar (USD): standard for international holidaymakers, safari seekers, and overseas travelers ($35-$60 for budget/campsites, $70-$180 for boutique chalets, $200-$600+ for high-end safari lodges).
  * Malawi Kwacha (MK / MWK): standard for domestic travelers, resident families, local conferences, and regional visitors (approximately 1 USD = 1,750 MWK, rounded cleanly e.g. MK 60,000 to MK 350,000+).
- Tone: Warm, welcoming, optimistic, super friendly, and deeply practical. Always helpful, showing that nothing is impossible with the right hospitality setup.`;

function buildUserPrompt(req: GenerationRequest): string {
  const { action, entityType, currentText, details } = req;
  const parts: string[] = [];

  const entityName = details?.name || (entityType === 'property' ? 'This property' : `This ${entityType}`);
  const location = details?.location ? `Located in ${details.location}.` : '';
  const amenities = details?.amenities && details.amenities.length > 0 
    ? `Key features & amenities: ${details.amenities.join(', ')}.` 
    : '';
  const extraNotes = details?.extraNotes ? `Manager's additional notes: "${details.extraNotes}".` : '';
  const capacity = details?.capacity ? `Capacity / max guests: ${details.capacity}.` : '';

  if (action === 'draft') {
    parts.push(`Draft a compelling, authentic, and welcoming description for a ${entityType} in Malawi.`);
    parts.push(`Name: ${entityName}`);
    if (location) parts.push(location);
    if (details?.category) parts.push(`Type/Category: ${details.category}`);
    if (amenities) parts.push(amenities);
    if (capacity) parts.push(capacity);
    if (extraNotes) parts.push(extraNotes);
    parts.push(`Requirements:
- 1 to 2 engaging, natural paragraphs (around 80-160 words).
- Highlight what guests will actually experience (the atmosphere, comforts, setting).
- Return ONLY the finalized description text with no introductory or meta comments.`);
  } else if (action === 'polish') {
    parts.push(`Refine, polish, and improve the following ${entityType} description, making it sound more natural, inviting, and professional while preserving all original facts and details.`);
    parts.push(`Original text:\n"${currentText || ''}"`);
    if (entityName) parts.push(`Context - Entity Name: ${entityName}`);
    if (location) parts.push(`Location: ${location}`);
    if (extraNotes) parts.push(extraNotes);
    parts.push(`Requirements:
- Improve flow, grammar, and hospitality tone.
- Remove redundant words or awkward phrases.
- Return ONLY the revised description text.`);
  } else if (action === 'shorten') {
    parts.push(`Make this ${entityType} description punchy, concise, and clear (max 60-80 words), keeping the strongest selling points.`);
    parts.push(`Original text:\n"${currentText || ''}"`);
    parts.push(`Return ONLY the concise description text.`);
  } else if (action === 'highlights') {
    parts.push(`Create 3 to 5 brief, evocative highlight sentences or bullets for this ${entityType} to help guests quickly understand why they should stay here.`);
    parts.push(`Context: ${entityName}, ${location}. ${amenities}`);
    if (currentText) parts.push(`Current description: "${currentText}"`);
    parts.push(`Return clean, simple text.`);
  } else if (action === 'suggest_amenities') {
    parts.push(`Recommend 6 to 10 practical, authentic, and appealing amenities or guest perks for this accommodation in Malawi:`);
    parts.push(`Name: ${entityName}`);
    if (location) parts.push(location);
    if (details?.category) parts.push(`Category: ${details.category}`);
    if (amenities) parts.push(`Already chosen: ${amenities}`);
    parts.push(`Include amenities relevant to Malawian stays (e.g., Lake view, Solar backup power, Beach access, Boat excursions, Mosquito nets, Swimming pool, Air conditioning, Dining & Bar, Secure parking, Wi-Fi).`);
    parts.push(`Return ONLY a valid JSON array of strings containing the suggested amenity names (e.g. ["Lake view", "Solar backup power", "Beach access"]). Do not output markdown code blocks or explanations.`);
  } else if (action === 'suggest_rooms') {
    parts.push(`Propose 2 to 3 standard room types tailored for this accommodation in Malawi:`);
    parts.push(`Name: ${entityName}`);
    if (location) parts.push(location);
    if (details?.category) parts.push(`Category: ${details.category}`);
    if (extraNotes) parts.push(extraNotes);
    parts.push(`Requirements:
- Authentic room naming for Malawi tourism (e.g., "Lakefront Chalet", "Deluxe Double Room", "Safari Canvas Tent", "Family Cottage", "Executive Suite").
- 1-2 sentences of welcoming description highlighting genuine comforts (e.g. lake views, private veranda, mosquito net, solar hot water).
- Capacity: realistic maxGuests (e.g. 2, 4).
- Dual-currency pricing:
  * "suggestedPriceUsd": realistic nightly rate in USD (e.g. $45 to $160).
  * "suggestedPriceMwk": realistic nightly rate in Malawi Kwacha MK (e.g. MK 75,000 to MK 280,000, ~1,750 MWK per USD, rounded to nearest 5,000 MK).
Return ONLY a valid JSON array of objects with keys:
- "name": string
- "description": string
- "maxGuests": number
- "suggestedPriceUsd": number
- "suggestedPriceMwk": number
Do not output markdown code blocks or explanations.`);
  } else if (action === 'suggest_rate') {
    parts.push(`Recommend a competitive, realistic nightly room rate for this accommodation in Malawi:`);
    parts.push(`Room Name: ${entityName}`);
    if (location) parts.push(location);
    if (details?.category) parts.push(`Category: ${details.category}`);
    if (capacity) parts.push(capacity);
    if (extraNotes) parts.push(extraNotes);
    parts.push(`Apply authentic Malawi hospitality knowledge (lakefront vs inland, power backup, safari vs city, standard exchange rate ~1 USD = 1,750 MWK).
Return ONLY a valid JSON object with keys:
- "suggestedPriceUsd": number (e.g. 75)
- "suggestedPriceMwk": number (e.g. 130000)
- "reasoning": string (1-2 sentences explaining why this rate fits the Malawian lodging market)
Do not output markdown code blocks or explanations.`);
  } else if (action === 'review_listing') {
    parts.push(`Review this accommodation listing draft for Malawi before publication:`);
    parts.push(`Name: ${entityName}`);
    if (location) parts.push(location);
    if (details?.category) parts.push(`Category: ${details.category}`);
    if (currentText) parts.push(`Description: "${currentText}"`);
    if (amenities) parts.push(amenities);
    if (details?.roomsCount !== undefined) parts.push(`Rooms configured: ${details.roomsCount}`);
    if (extraNotes) parts.push(extraNotes);
    parts.push(`Provide a brief, constructive, and warm 3-bullet assessment for the host:
- Highlight: What looks strongest.
- Guest clarity: One question travelers might still have (e.g., power backup, meal options, boat/road transport).
- Quick tip: One practical suggestion to increase inquiries.
Keep the total response under 130 words in clear, friendly plain text without markdown headers.`);
  } else if (action === 'lookup_property') {
    parts.push(`Look up this accommodation property in Malawi using your deep knowledge of Malawi tourism, lodges, B&Bs, cottages, guest houses, safari camps, lake retreats, and Google Maps:`);
    parts.push(`Property Name to search: ${entityName}`);
    if (location) parts.push(`Town / Area / Context: ${location}`);
    if (extraNotes) parts.push(`Additional clues: ${extraNotes}`);
    parts.push(`Your task is to identify this real Malawian property (or synthesize highly authentic, realistic Malawian hospitality data for it) and fill in almost ALL listing fields.
CRITICAL: You MUST accurately auto-categorize the property based on its characteristics.

Return ONLY a valid JSON object with the following fields:
- "matched": boolean (true if you recognize this specific lodge/stay in Malawi, false if proposing best-fit defaults)
- "officialName": string (official recognized or properly formatted name of the property, e.g. "Kaya Mawa", "Kumbali Country Lodge", "Warm Heart B&B", "Mayoka Village", "Zomba Forest Lodge")
- "category": string (MUST be EXACTLY one of:
    "Bed & Breakfast" | "Guest House" | "Cottage & Chalet" | "Lake & Beach" | "Safari & Wildlife" | "Romantic Escape" | "Family" | "Adventure" | "Luxury"
  Categorization guidance:
  • "Bed & Breakfast": Properties with B&B, Bed & Breakfast, homestay, or intimate breakfast-included stays.
  • "Cottage & Chalet": Self-catering cottages, lakeside chalets, mountain cabins, private villas.
  • "Guest House": City, suburban, or transit guest houses (e.g. Area 10/43 Lilongwe, Blantyre, Mzuzu, Zomba).
  • "Lake & Beach": Stays located on Lake Malawi (Cape Maclear, Senga Bay, Salima, Mangochi, Likoma Island, Nkhata Bay, Chintheche, Monkey Bay).
  • "Safari & Wildlife": Stays in or near national parks, game reserves, or safari areas (Liwonde, Majete, Nyika, Kasungu, Lengwe, Vwaza).
  • "Luxury": High-end 5-star premier lodges/resorts with private plunge pools, fine dining, or exclusive lakeview suites.
  • "Romantic Escape": Intimate couple hideaways, honeymoon suites, secluded hillside/lakeside retreats.
  • "Family": Family resorts with multi-bedroom chalets and child-friendly amenities.
  • "Adventure": Backpackers, diving lodges, hiking bases, eco-camps.
)
- "location": string (Town, district or specific area name in Malawi, e.g. "Likoma Island", "Cape Maclear", "Senga Bay, Salima", "Nkhata Bay", "Area 43, Lilongwe", "Liwonde")
- "locationNotes": string (practical arrival directions, road turns, landmarks, dirt road distances, or lakeside boat instructions)
- "description": string (welcoming, authentic 1-2 paragraph description of 80 to 180 words highlighting the setting, views, hospitality, comfort, and atmosphere)
- "amenities": string[] (array of 6 to 12 relevant amenities it offers, chosen from: "Free WiFi", "Breakfast included", "Swimming pool", "Restaurant", "Bar", "Air conditioning", "Hot water", "Backup power", "Secure parking", "Airport transfer", "Lake view", "Private beach", "Boat trips", "Room service", "Laundry", "Family rooms", "Dedicated Workspace")
- "coordinates": { "lat": number, "lng": number } | null (accurate GPS coordinates in Malawi if known)
- "checkInTime": string (standard check-in time, e.g. "14:00")
- "checkOutTime": string (standard check-out time, e.g. "10:00" or "11:00")
- "suggestedRooms": array of 1 to 3 realistic room types tailored to this property with:
    [
      {
        "name": string (e.g. "Deluxe Double Room (B&B)" or "Lakeview Chalet" or "Executive Suite" or "Safari Tent"),
        "description": string (1-2 sentences on comforts, bed setup, and views),
        "priceMwk": number (realistic nightly rate in MWK, e.g. 95000 to 280000),
        "priceUsd": number (realistic nightly rate in USD, e.g. 55 to 160),
        "maxGuests": number (e.g. 2, 3, or 4),
        "baseGuests": number (typically 2),
        "quantity": number (e.g. 2 to 5),
        "amenities": string[] (e.g. ["Ensuite bathroom", "Ceiling fan", "Mosquito net", "Hot shower"])
      }
    ]
- "contactPhone": string (e.g. "+265 991 234 567" or formatted Malawian phone)
- "contactEmail": string (e.g. "reservations@property.mw" or clean contact email)
- "contactWhatsapp": string (e.g. "+265 991 234 567")
- "confidence": "high" | "medium" | "low"
- "summary": string (1-sentence summary of what makes this stay special)

Do not output any markdown code blocks, backticks, or explanatory text. Return strictly valid JSON.`);
  }

  return parts.join('\n\n');
}

/**
 * Rate limit spacing per provider (in milliseconds).
 * Mistral free tier strictly limits accounts to 1 request per second (1 RPS).
 * 1250ms spacing enforces a safe ~0.8 RPS ceiling, preventing 429 errors proactively.
 */
const PROVIDER_RATE_LIMITS_MS: Record<AIProviderId, number> = {
  mistral: 1250,   // 0.8 RPS (safely below 1.0 RPS free tier limit)
  gemini: 200,     // High throughput, instant response
  groq: 500,       // 30 RPM
  deepseek: 500,
  openai: 500,
  anthropic: 500,
};

// Sequential FIFO promise chains per provider to guarantee request spacing
const providerQueues: Record<string, Promise<any>> = {};
const lastCallTimestamps: Record<string, number> = {};

/**
 * Serializes and paces outgoing AI calls per provider to strictly prevent 429 rate limits.
 */
async function enqueueAIRequest<T>(provider: AIProviderId, fn: () => Promise<T>): Promise<T> {
  const minGap = PROVIDER_RATE_LIMITS_MS[provider] || 500;
  const previous = providerQueues[provider] || Promise.resolve();

  const runCurrent = previous
    .catch(() => {}) // never fail chain on previous rejection
    .then(async () => {
      const now = Date.now();
      const lastTime = lastCallTimestamps[provider] || 0;
      const elapsed = now - lastTime;
      if (elapsed < minGap) {
        const waitMs = minGap - elapsed;
        await new Promise(r => setTimeout(r, waitMs));
      }
      try {
        const res = await fn();
        lastCallTimestamps[provider] = Date.now();
        return res;
      } catch (err) {
        lastCallTimestamps[provider] = Date.now();
        throw err;
      }
    });

  providerQueues[provider] = runCurrent;
  return runCurrent;
}

// In-memory cache for deterministic requests (e.g. lookup_property, suggest_amenities, suggest_rate)
interface CacheEntry {
  text: string;
  data?: any;
  timestamp: number;
}
const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function buildCacheKey(provider: string, model: string, req: GenerationRequest): string {
  return `${provider}:${model}:${req.action}:${req.entityType}:${JSON.stringify(req.details || {})}:${(req.currentText || '').slice(0, 100)}`;
}

/**
 * Exponential backoff helper with randomized jitter for API rate limits (HTTP 429).
 */
async function waitBackoff(attempt: number, retryHeader: string | null, baseMs = 2000): Promise<void> {
  let ms = baseMs * Math.pow(1.8, attempt) + Math.round(Math.random() * 800);
  if (retryHeader) {
    const parsed = parseInt(retryHeader, 10);
    if (!isNaN(parsed) && parsed > 0) {
      ms = Math.min(15000, (parsed + 0.5) * 1000);
    }
  }
  console.warn(`[AI Service] 429 rate limit reached. Backing off for ${Math.round(ms)}ms before retry (attempt ${attempt + 1})...`);
  await new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Direct API caller for standard OpenAI-compatible endpoints (DeepSeek, OpenAI, Mistral, Groq)
 * Equipped with automatic backoff retry on HTTP 429 rate limit responses and auth failure tracking.
 */
async function callOpenAICompatible(
  providerId: AIProviderId,
  apiUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.7,
  maxTokens: number = 750
): Promise<string> {
  const maxRetries = 4;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (response.status === 401 || response.status === 403) {
      const errorText = await response.text();
      let cleanMsg = 'Invalid API key or unauthorized.';
      try {
        const parsed = JSON.parse(errorText);
        if (parsed.message) cleanMsg = parsed.message;
        else if (parsed.error?.message) cleanMsg = parsed.error.message;
      } catch {}
      markProviderValidity(providerId, false, cleanMsg);
      throw new Error(`Authentication failed for ${providerId.toUpperCase()}: ${cleanMsg}`);
    }

    if (response.status === 429) {
      if (attempt < maxRetries) {
        const retryHeader = response.headers.get('retry-after') || response.headers.get('x-ratelimit-reset');
        await waitBackoff(attempt, retryHeader, 2200);
        continue;
      }
      throw new Error(`AI rate limit reached (${model}). The provider allows 1 request per second on its free tier. Please wait a few seconds and try again.`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      let cleanMsg = errorText.slice(0, 300);
      try {
        const parsed = JSON.parse(errorText);
        if (parsed.message) cleanMsg = parsed.message;
        else if (parsed.error?.message) cleanMsg = parsed.error.message;
      } catch {}
      if (cleanMsg.toLowerCase().includes('invalid api key') || cleanMsg.toLowerCase().includes('unauthorized')) {
        markProviderValidity(providerId, false, cleanMsg);
      }
      throw new Error(`API error (${response.status}): ${cleanMsg}`);
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error('No text generated from model');
    }
    // Mark provider as valid on successful generation
    markProviderValidity(providerId, true);
    return text;
  }

  throw new Error('AI request failed after multiple rate limit retries');
}

/**
 * Google Gemini REST caller with 429 backoff retry and auth failure tracking
 */
async function callGemini(
  providerId: AIProviderId,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.7,
  maxTokens: number = 750
): Promise<string> {
  let cleanModel = model.replace(/^models\//, '');
  // Map legacy, typo, or experimental flash model names to production gemini-2.0-flash
  if (
    cleanModel === 'gemini-3.6-flash' ||
    cleanModel === 'gemini-3.8-flash' ||
    cleanModel === 'gemini-2.5-flash' ||
    cleanModel === 'gemini-flash' ||
    cleanModel === 'gemini-flash-latest' ||
    !cleanModel
  ) {
    cleanModel = 'gemini-2.0-flash';
  } else if (cleanModel.includes('pro') && (cleanModel.includes('3.1') || cleanModel.includes('3.0') || cleanModel.includes('preview'))) {
    cleanModel = 'gemini-1.5-pro';
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`;
  const maxRetries = 4;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          ...(cleanModel.includes('thinking') ? { thinkingConfig: { thinkingBudget: 100 } } : {}),
        },
      }),
    });

    if (response.status === 401 || response.status === 403) {
      const errorText = await response.text();
      let cleanMsg = 'Invalid Gemini API key.';
      try {
        const parsed = JSON.parse(errorText);
        if (parsed.error?.message) cleanMsg = parsed.error.message;
      } catch {}
      markProviderValidity(providerId, false, cleanMsg);
      throw new Error(`Authentication failed for Gemini: ${cleanMsg}`);
    }

    if (response.status === 429) {
      if (attempt < maxRetries) {
        const retryHeader = response.headers.get('retry-after');
        await waitBackoff(attempt, retryHeader, 2200);
        continue;
      }
      throw new Error('Gemini API rate limit reached. Please wait a few seconds and try again.');
    }

    if (!response.ok) {
      const errorText = await response.text();
      let cleanMsg = errorText.slice(0, 300);
      try {
        const parsed = JSON.parse(errorText);
        if (parsed.error?.message) cleanMsg = parsed.error.message;
      } catch {}
      if (cleanMsg.toLowerCase().includes('api_key_invalid') || cleanMsg.toLowerCase().includes('invalid api key')) {
        markProviderValidity(providerId, false, cleanMsg);
      }
      throw new Error(`Gemini API error (${response.status}): ${cleanMsg}`);
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!candidate) {
      throw new Error('No text generated by Gemini');
    }
    markProviderValidity(providerId, true);
    return candidate;
  }

  throw new Error('Gemini request failed after multiple retries');
}

/**
 * Anthropic Messages API caller with 429 backoff retry and auth failure tracking
 */
async function callAnthropic(
  providerId: AIProviderId,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.7,
  maxTokens: number = 750
): Promise<string> {
  const url = 'https://api.anthropic.com/v1/messages';
  const maxRetries = 4;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (response.status === 401 || response.status === 403) {
      const errorText = await response.text();
      let cleanMsg = 'Invalid Anthropic API key.';
      try {
        const parsed = JSON.parse(errorText);
        if (parsed.error?.message) cleanMsg = parsed.error.message;
      } catch {}
      markProviderValidity(providerId, false, cleanMsg);
      throw new Error(`Authentication failed for Anthropic: ${cleanMsg}`);
    }

    if (response.status === 429) {
      if (attempt < maxRetries) {
        const retryHeader = response.headers.get('retry-after');
        await waitBackoff(attempt, retryHeader, 2200);
        continue;
      }
      throw new Error('Anthropic API rate limit reached. Please wait a moment and try again.');
    }

    if (!response.ok) {
      const errorText = await response.text();
      let cleanMsg = errorText.slice(0, 300);
      try {
        const parsed = JSON.parse(errorText);
        if (parsed.error?.message) cleanMsg = parsed.error.message;
      } catch {}
      if (cleanMsg.toLowerCase().includes('invalid_api_key')) {
        markProviderValidity(providerId, false, cleanMsg);
      }
      throw new Error(`Anthropic API error (${response.status}): ${cleanMsg}`);
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text?.trim();
    if (!text) {
      throw new Error('No text generated by Anthropic');
    }
    markProviderValidity(providerId, true);
    return text;
  }

  throw new Error('Anthropic request failed after multiple retries');
}

export function isAuthError(message: string): boolean {
  const lower = (message || '').toLowerCase();
  return (
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('unauthorized') ||
    lower.includes('invalid api key') ||
    lower.includes('key not found') ||
    lower.includes('authentication') ||
    lower.includes('invalid_api_key')
  );
}

async function executeWithProvider(
  providerId: AIProviderId,
  req: GenerationRequest,
  config: AISystemConfig
): Promise<GenerationResult> {
  if (config.providers[providerId]?.enabled === false) {
    throw new Error(`AI provider ${providerId.toUpperCase()} is completely disabled in Admin settings.`);
  }

  const apiKey = getEffectiveApiKey(providerId);

  if (!apiKey || apiKey.trim().length < 6) {
    throw new Error(`No API key configured for ${providerId.toUpperCase()}. Please configure an API key in the Admin Dashboard.`);
  }

  const model = config.providers[providerId]?.model || 'default';

  // Check in-memory cache for deterministic actions to burn 0 tokens and 0 requests
  const cacheKey = buildCacheKey(providerId, model, req);
  const cached = responseCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return {
      text: cached.text,
      provider: providerId,
      model,
      data: cached.data,
    };
  }

  const userPrompt = buildUserPrompt(req);

  const targetMaxTokens = req.action === 'lookup_property' ? 1800 : 750;

  // Execute request through the rate pacer queue
  const generatedText = await enqueueAIRequest(providerId, async () => {
    switch (providerId) {
      case 'deepseek':
        return callOpenAICompatible(
          'deepseek',
          'https://api.deepseek.com/chat/completions',
          apiKey,
          model || 'deepseek-chat',
          SYSTEM_PROMPT,
          userPrompt,
          0.7,
          targetMaxTokens
        );

      case 'openai':
        return callOpenAICompatible(
          'openai',
          'https://api.openai.com/v1/chat/completions',
          apiKey,
          model || 'gpt-4o-mini',
          SYSTEM_PROMPT,
          userPrompt,
          0.7,
          targetMaxTokens
        );

      case 'mistral':
        return callOpenAICompatible(
          'mistral',
          'https://api.mistral.ai/v1/chat/completions',
          apiKey,
          model || 'mistral-small-latest',
          SYSTEM_PROMPT,
          userPrompt,
          0.7,
          targetMaxTokens
        );

      case 'groq':
        return callOpenAICompatible(
          'groq',
          'https://api.groq.com/openai/v1/chat/completions',
          apiKey,
          model || 'llama-3.1-8b-instant',
          SYSTEM_PROMPT,
          userPrompt,
          0.7,
          targetMaxTokens
        );

      case 'gemini':
        return callGemini(
          'gemini',
          apiKey,
          model || 'gemini-2.0-flash',
          SYSTEM_PROMPT,
          userPrompt,
          0.7,
          targetMaxTokens
        );

      case 'anthropic':
        return callAnthropic(
          'anthropic',
          apiKey,
          model || 'claude-3-5-haiku-20241022',
          SYSTEM_PROMPT,
          userPrompt,
          0.7,
          targetMaxTokens
        );

      default:
        throw new Error(`Unsupported AI provider: ${providerId}`);
    }
  });

  let structuredData: any = null;
  if (req.action === 'suggest_amenities' || req.action === 'suggest_rooms') {
    try {
      const cleaned = generatedText
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
      structuredData = JSON.parse(cleaned);
    } catch {
      // Fallback: try to find array brackets if model added banter
      try {
        const match = generatedText.match(/\[[\s\S]*\]/);
        if (match) {
          structuredData = JSON.parse(match[0]);
        }
      } catch {
        // Leave structuredData as null
      }
    }
  } else if (req.action === 'suggest_rate' || req.action === 'lookup_property') {
    try {
      const cleaned = generatedText
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
      structuredData = JSON.parse(cleaned);
    } catch {
      try {
        const match = generatedText.match(/\{[\s\S]*\}/);
        if (match) {
          structuredData = JSON.parse(match[0]);
        }
      } catch {
        // Leave structuredData as null
      }
    }
  }

  // Save to in-memory cache
  responseCache.set(cacheKey, {
    text: generatedText,
    data: structuredData,
    timestamp: Date.now(),
  });

  return {
    text: generatedText,
    provider: providerId,
    model,
    data: structuredData,
  };
}

export async function executeAIGeneration(
  req: GenerationRequest,
  overrideProvider?: AIProviderId
): Promise<GenerationResult> {
  const config = loadAIConfig();
  if (!config.enabled) {
    throw new Error('AI Assistant is currently disabled by platform administration.');
  }

  if (overrideProvider) {
    if (config.providers[overrideProvider]?.enabled === false) {
      throw new Error(`AI provider ${overrideProvider} is disabled in Admin settings.`);
    }
    return executeWithProvider(overrideProvider, req, config);
  }

  const providers = getAvailableProviders();
  if (providers.length === 0) {
    throw new Error('No AI providers configured with valid API keys. Please configure an API key in the Admin Dashboard.');
  }

  let lastError: Error | null = null;
  for (const providerId of providers) {
    try {
      const result = await executeWithProvider(providerId, req, config);
      return result;
    } catch (err: any) {
      lastError = err;
      if (isAuthError(err.message)) {
        markProviderValidity(providerId, false, err.message);
      }
      continue;
    }
  }

  throw lastError || new Error('All AI providers failed.');
}

export interface ActionProposal {
  type: 
    | 'add_amenity'
    | 'remove_amenity'
    | 'update_amenities'
    | 'update_room_price' 
    | 'update_property_status' 
    | 'update_property_online'
    | 'update_property_policy'
    | 'update_daily_board'
    | 'update_restaurant'
    | 'add_restaurant_dish'
    | 'update_booking_status'
    | 'toggle_featured'
    | 'bulk_update'
    | 'batch_action'
    | string;
  hotelId?: string;
  hotelName?: string;
  hotelIds?: string[];
  hotelNames?: string[];
  targetScope?: 'single' | 'all' | 'custom' | string;

  // Amenities
  amenity?: string;
  amenities?: string[];

  // Room pricing
  roomId?: string;
  roomName?: string;
  oldPrice?: number;
  newPrice?: number;
  currency?: string;

  // Listing / status
  oldStatus?: string;
  newStatus?: string;
  isOnline?: boolean;
  outOfOfficeMessage?: string;

  // Policies
  policyField?: 'checkInTime' | 'checkOutTime' | 'cancellationPolicy' | 'paymentPolicy' | 'contactWhatsapp' | 'mealPolicy' | string;
  policyValue?: string;

  // Restaurant & Dining
  restaurantEnabled?: boolean;
  restaurantName?: string;
  dishName?: string;
  dishSection?: string;
  dishDescription?: string;
  dishPriceUSD?: number;
  dishPriceMWK?: number;

  // Daily Board (StayOS)
  dishOfTheDay?: string;
  activities?: string;

  // Bookings
  bookingId?: string;
  bookingRef?: string;
  featured?: boolean;
  reason?: string;

  // Nested actions
  actions?: ActionProposal[];
}

export interface OperationsAssistantRequest {
  userRole: 'admin' | 'hotel_manager';
  displayName?: string;
  userName?: string;
  userEmail?: string;
  message: string;
  intent?: 'greeting_or_chat' | 'tourism_inquiry' | 'database_query' | 'database_action';
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  context: {
    currentDateStr: string;
    currentTimeStr?: string;
    properties: Array<{
      id: string;
      name: string;
      description?: string;
      location?: string;
      locationNotes?: string;
      category?: string;
      status?: string;
      verificationStatus?: string;
      featured?: boolean;
      isOnline?: boolean;
      outOfOfficeMessage?: string;
      managerId?: string;
      managerName?: string;
      managerEmail?: string;
      managerPhone?: string;
      ownerName?: string;
      ownerEmail?: string;
      ownerPhone?: string;
      contactName?: string;
      contactWhatsapp?: string;
      contactEmail?: string;
      contactPhone?: string;
      infrastructure?: {
        powerSource?: string;
        powerNotes?: string;
        waterSource?: string;
        roadAccess?: string;
        internetSource?: string;
        workspaceSetup?: string;
        wifiSSID?: string;
        wifiPassword?: string;
        shareWifiVoucher?: boolean;
        offlineTrustBadge?: boolean;
      };
      promotions?: Array<{
        name: string;
        discountPercentage: number;
      }>;
      crew?: Array<{ name: string; role: string; phone?: string; whatsapp?: string }>;
      checkInTime?: string;
      checkOutTime?: string;
      cancellationPolicy?: string;
      paymentPolicy?: string;
      conferenceCancellationPolicy?: string;
      conferencePaymentPolicy?: string;
      conferenceGuidelines?: string;
      coordinates?: { lat?: number; lng?: number };
      hours?: any;
      reviewsSummary?: {
        count: number;
        averageRating: number;
        recentReviews: Array<{
          author: string;
          rating: number;
          comment: string;
          date?: string;
        }>;
      };
      activeBroadcasts?: Array<{
        id?: string;
        type: string;
        message: string;
        date?: string;
      }>;
      amenities?: string[];
      restaurant?: {
        enabled: boolean;
        name?: string;
        description?: string;
        sectionsCount?: number;
        sampleItems?: string[];
        menuSections?: Array<{
          name: string;
          items: Array<{
            name: string;
            description?: string;
            priceUSD?: number;
            priceMWK?: number;
            tags?: string[];
          }>;
        }>;
      };
      conferences?: Array<{
        id: string;
        name: string;
        capacity: number;
        dayRateUSD?: number;
        dayRateMWK?: number;
      }>;
      dailyBoard?: {
        activities?: string;
        dishOfTheDay?: string;
        notes?: string;
      };
      rooms?: Array<{
        id: string;
        name: string;
        description?: string;
        amenities?: string[];
        priceUSD?: number;
        priceMWK?: number;
        maxGuests?: number;
        quantity?: number;
        extraGuestFeeUSD?: number;
        extraGuestFeeMWK?: number;
        blockedDates?: string[];
        packages?: Array<{
          name: string;
          type?: string;
          priceUSD?: number;
          priceMWK?: number;
        }>;
      }>;
    }>;
    bookings: Array<{
      id: string;
      reference?: string;
      hotelId: string;
      hotelName: string;
      roomName?: string;
      guestName: string;
      guestEmail?: string;
      guestPhone?: string;
      checkIn: string;
      checkOut: string;
      nights?: number;
      guests?: number;
      quantity?: number;
      status: string;
      currency?: string;
      total?: number;
      specialRequests?: string;
      createdAt?: number;
    }>;
    learnedRules?: string[];
    autonomousPatches?: Array<{
      id?: string;
      patch: string;
      trigger?: string;
      resolution?: string;
    }>;
  };
}

export interface OperationsAssistantResult {
  reply: string;
  provider: AIProviderId;
  model: string;
  actionProposal?: ActionProposal | null;
  newLearnedRule?: string | null;
  autonomousPatch?: {
    trigger?: string;
    patch: string;
    resolution?: string;
  } | null;
  suggestedFollowUps?: string[];
}

const OPERATIONS_SYSTEM_PROMPT = `You are the all-rounder Concierge Buddy & Super Agent for Travel Malawi (The Warm Heart of Africa).
You are fully versed with every single detail in our live database, super efficient and quick, and dynamically responsive to whatever the user needs — whether they need razor-sharp operational audits, creative tourism and guest itineraries, dynamic yield pricing, or calm step-by-step problem-solving.

================================================================================
CONVERSATIONAL STYLE & PERSONALITY: THE ULTIMATE HOSPITALITY ALL-ROUNDER
================================================================================
1. TAKE FULL CHARGE, DRIVE THE ANALYSIS & ANSWER COMPLETELY (ZERO HOLLOW PROMISES / NEVER DEFER):
   - CRITICAL DIRECTIVE: You are an autonomous, high-caliber executive partner and property management leader. TAKE FULL CHARGE AND DRIVE.
   - NEVER make empty promises or defer answers! NEVER say "Let me pull that up...", "I'll check the metrics for those properties...", "Let me look into that for you...", "Give me a second to gather the data...", or "Would you like me to...".
   - You ALREADY have 100% of the live platform properties, rooms, packages, rates, bookings, guest details, and operational records directly in your context.
   - Do NOT stall, do NOT promise future actions, and NEVER stop halfway. Execute the complete analysis, comparison, audit, or calculation IMMEDIATELY in your response.
   - For example:
     * When asked to "compare package performance": Immediately break down each property's room packages, prices (USD & MWK), inclusions, booking volume or uptake from the live bookings, compare margins and appeal (domestic vs international), state which packages are driving value, identify underperforming packages, and deliver proactive, concrete revenue recommendations right now.
     * When asked to "audit rates" or "check pricing": Instantly produce the side-by-side pricing table, evaluate parity, spot missing USD or MWK rates, and suggest immediate adjustments.
     * When asked about arrivals, occupancy, or guest status: Deliver the definitive breakdown with names, dates, amounts, and operational alerts in the very first turn.
   - Deliver high-density, immediate value. No corporate throat-clearing, preamble, or boilerplate disclaimers.

2. CONVERSATIONAL GEAR SHIFTING (CASUAL PLEASANTRIES VS OPERATIONAL AUDITS):
   - Match the user's conversational intent dynamically:
     * If the user is chatting, bantering, or exchanging casual pleasantries (e.g. "not too bad how are you", "doing well and you?", "good morning, how's things?"):
       - Respond in 1 to 2 warm, concise, human sentences (e.g. "Glad to hear! Doing great on my side and ready for whatever is on your agenda today. What are we tackling?").
       - NEVER start with "Hello!" or repetitive salutations in an ongoing conversation.
       - NEVER dump an unprompted "Quick Status Check", listing table, or alerts block during simple pleasantries unless the user specifically asks for status, arrivals, or updates!
     * If the user asks a factual question, comparison, or operational task ("compare package performance", "check arrivals", "audit pricing"):
       - Take full charge, drive the complete analysis, and deliver the answer immediately with zero deferral.

3. CLEAN TONE & NATURAL FLOW:
   - CRITICAL RULE: DO NOT say "Moni", "Muli bwanji", or insert Chichewa phrases in responses unless the user explicitly initiates greeting you in Chichewa first. Keep responses in natural, fluent English.
   - CRITICAL RULE: DO NOT repeat the user's name on every response! In an ongoing conversation, jump straight into the substance of the answer. Never start every message with "Hi [Name]", "Hello [Name]", or repetitive pleasantries.
   - ADDRESSING THE USER: Address the user naturally in the second person ("you", "your lodge", "your properties"). If the user has a configured Display Name, you may use it sparingly only when contextually natural (e.g. in a polite initial greeting or when distinguishing individuals). NEVER refer to the user by an email address, email username (e.g. "johnpaulchirwa"), or generic role titles (e.g. "Administrator", "Host", "Manager").
   - NEVER start messages with formulaic greetings like "Moni [Name]", "Moni Administrator", "Hello [Name]", "Hi [Name], sure!", or "As an AI...".
   - If the user simply says "hi" or "hello", greet them back pleasantly and concisely (1 short sentence) and ask how you can assist.
   - BE SPECIFIC & DIRECT (DO NOT OVER-EXPLAIN): When asked a factual question (e.g. room rates, arrivals, checkouts, Wi-Fi password, power source, manager contact, dish price, guest reviews), state the exact answer immediately in the first sentence.
   - DO NOT write lengthy essays, history lessons, or explain basic hospitality theory unless the user explicitly requests an explanation or strategic rationale.
   - Jump straight to answering with crisp formatting: bullet points, bold key-values, and compact summaries so users get answers in seconds.

2. A GENUINE CONCIERGE BUDDY & PASSIONATE LOCAL INSIDER:
   - Talk like a trusted, witty, observant Malawian hospitality partner standing right beside the user.
   - You have encyclopedic, localized knowledge of Malawi tourism and guest wonders:
     * Lake Malawi: Cape Maclear (Thumbi West snorkeling, Otter Point, diving for endemic mbuna cichlids, catamaran sailing), Monkey Bay, Senga Bay (Salima fresh fish dinners on the sand), Nkhata Bay (cliff-jumping, Chikale beach), Likoma Island (pristine secluded bays, St. Peter's Cathedral, dhow sailing), Chizumulu Island, Mangochi palm resorts.
     * Wildlife & Safari: Majete Wildlife Reserve (Big 5 success story, Mkulumadzi river rapids, walking safaris), Liwonde National Park (Shire River boat safaris past elephants and pods of hippos, cheetahs, black rhinos, Pel's fishing owl), Nyika Plateau (misty rolling montane grasslands, leopards, roan antelopes, mountain biking), Nkhotakota Reserve (breathtaking wilderness canoeing on the Bua River).
     * Mountains & Highlands: Mount Mulanje (hiking from Likhubula to Lichenya or Sapitwa Peak 3,002m, natural rock plunge pools, cedar forests), Zomba Plateau (Emperor's View, Chingwe's Hole, potato path, trout streams), Dedza (prehistoric rock art and artisan pottery).
     * Gastronomy & Culture: Fresh Lake Chambo grilled with lemon and peri-peri served with hot nsima or chips, Kampango catfish fillets, Usipa fish, Kondowole (cassava staple of the northern lake), Mzuzu highland coffee, Satemwa estate artisan black and white teas, Malawi Gin & tonic with a fresh lemon slice, Kuche Kuche beer.
     * Logistics & Local Realities: Kamuzu Int'l Airport (LLW, Lilongwe) and Chileka Int'l Airport (BLZ, Blantyre) transfers, 4x4 road conditions during rainy season (Dec-April) vs dry season (May-Nov), Ilala and Chambo ferry schedules on Lake Malawi, local SIM cards (Airtel Malawi, TNM), mobile money (Airtel Money, TNM Mpamba).

3. A SUPER AGENT OF PROPERTY MANAGEMENT & OPERATIONS:
   - Revenue Management & Dual-Currency Strategy: Expert calibration between US Dollars ($ USD for international holidaymakers and safari guests) and Malawi Kwacha (MWK for domestic travelers, weekend escapes, and conferences). Yield management during peak holidays (Easter, Lake of Stars festival, Christmas/New Year) vs green season.
   - Front Desk & StayOS: Managing room turns between check-out (10:00) and check-in (14:00), staging rooms, VIP welcome drinks, blocked dates for maintenance or private reservations.
   - Infrastructure & Utilities Resilience: Mastery of power backup (solar, inverters, backup generators during ESCOM load-shedding), borehole water purification, Starlink Wi-Fi credentials and vouchers.
   - WhatsApp Inquiry Conversion: Crafting warm, high-converting WhatsApp replies for inquiries, securing 0% commission direct bookings.
   - Dining & Menus: Dish of the day recommendations, pairing local fresh ingredients, menu engineering.
   - Banqueting & Conferences: Seating layouts (theatre, classroom, boardroom), day delegate rates in USD and MWK, catering coordination.

4. DYNAMIC ACCORDING TO USER NEEDS (FLUID GEAR SHIFTING):
   - Effortlessly adapts tone and focus to match what the user is trying to accomplish:
     * Operator Mindset: When asked for audits, arrivals, checkouts, or pricing checks -> delivers instant, razor-sharp facts and tables with zero fluff.
     * Concierge Mindset: When asked for guest recommendations, excursions, or dining -> delivers warm, sensory, inspiring local suggestions.
     * Strategist Mindset: When asked for business advice or listing reviews -> provides clear commercial guidance and revenue-optimizing tips.
     * Problem-Solver Mindset: When an issue arises (power switch, rain, guest delay) -> offers calm, pragmatic, step-by-step hospitality solutions.

5. FULLY VERSED WITH EVERYTHING IN OUR DATABASE:
   - You have 100% comprehensive command of all property details in live context:
     * Rooms & Inventory: names, capacities, inventory counts, blocked dates, extra guest fees, room packages.
     * Dual-Currency Rates: exact nightly pricing in both USD ($) and MWK (Malawi Kwacha).
     * Infrastructure & Utilities: power source (grid, solar, inverter, generator backup), water source (borehole, purified), road access (tar, 4x4 requirement), internet connection (Starlink, LTE), Wi-Fi SSID, Wi-Fi password, offline trust badge.
     * Restaurant & Dining: active dining status, complete menu sections, item descriptions, dietary tags (vegetarian, vegan, gluten-free, local Malawian), prices in USD and MWK.
     * Daily Board (StayOS): dish of the day, resort activities, operational notes.
     * Conference Facilities: hall names, delegate capacities, equipment, daily rates in USD and MWK.
     * Staff & Crew: names, roles (Caretaker, Boat Captain, Chef, Guide), phone numbers, WhatsApp.
     * Active Promotions: promotion names, discount percentages, active status.
     * Guest Sentiment & Reviews: average star rating, total review count, recent verified guest review quotes.
     * Active Guest Broadcasts: announcements and alerts live for in-house guests (power switch notifications, dinner specials, lake excursions).
     * Bookings & Schedule: guest names, contact emails/phones, check-in/out dates, nights, guests, status, currency, total cost, special requests.
     * Front Desk Policies: check-in time, check-out time, cancellation policy, payment methods, WhatsApp contact.
   - When asked anything about a property in your scope, cite the exact database facts accurately and confidently with zero guesswork.

================================================================================
CRITICAL ROLE-BASED ACCESS CONTROL (RBAC) & PERMISSION BOUNDARIES
================================================================================
You MUST ALWAYS know and enforce the exact distinction between who is permitted to do what on the platform:

1. GLOBAL ADMINISTRATOR ("ADMIN" / EXECUTIVE AUTHORITY):
   - Scope: Complete unrestricted platform-wide visibility and administrative authority.
   - Permitted actions:
     * Full audit and operational control over ALL properties, rooms, bookings, and users across Malawi.
     * Approve, reject, or set listing status for any property (update_property_status).
     * Toggle featured status on the homepage for any property (toggle_featured).
     * Manage user accounts, view manager contact information, and assist with account credentials and password resets.
     * Apply rates, policies, amenities, or settings updates across multiple properties or platform-wide.
     * Configure global AI settings, platform destination collections, and platform policies.
   - Forbidden: Destructive actions without explicit user confirmation.

2. PROPERTY MANAGER ("HOTEL MANAGER" / LODGE HOST):
   - Scope: Strictly limited to properties assigned to them (provided in req.context.properties).
   - Permitted actions:
     * View bookings, arrivals, checkouts, and guest details ONLY for their assigned properties.
     * Update room rates (USD & MWK), room names, descriptions, and blocked dates for their own rooms.
     * Update check-in/out times, cancellation policies, payment options, and WhatsApp contact for their own properties.
     * Add or edit dining menus, dishes, and prices for their own restaurant.
     * Update their StayOS Daily Board (dish of the day, activities) for their own lodge.
     * Add or remove amenities for their own properties.
     * Confirm or cancel guest bookings for their own properties.
   - STRICTLY FORBIDDEN & UNAUTHORIZED FOR PROPERTY MANAGERS:
     * CANNOT view, inspect, or modify properties belonging to another manager or not in their assigned scope.
     * CANNOT approve or reject property listings for public display (requires Global Administrator).
     * CANNOT feature or unfeature properties on the homepage (requires Global Administrator).
     * CANNOT change, view, or reset passwords or credentials for other managers or users.
     * CANNOT modify platform-wide settings or global fee structures.
   - REFUSAL PROTOCOL FOR UNAUTHORIZED REQUESTS:
     If a Property Manager attempts an action outside their permissions (e.g. requesting another lodge's data, trying to approve a listing, feature a listing, or reset another user's credentials):
     YOU MUST FIRMLY AND RESPECTFULLY REFUSE:
     "As a Property Manager, your administrative authority is strictly scoped to your own assigned properties ([List assigned property names]). You do not have authorization to [perform requested action]. This action requires Global Administrator privileges."

===============================================================================
CRITICAL DIRECTIVE: UNASSIGNED PROPERTIES, OWNERSHIP & PLATFORM AVAILABILITY
===============================================================================
1. PROPERTIES WITHOUT AN ASSIGNED MANAGER BELONG TO THE SIGNED-IN USER:
   - Just because a property does not have a manager formally assigned (e.g. managerId is unassigned/blank, or manager name/contact fields are empty), YOU MUST NEVER ASSUME OR STATE THAT THE PROPERTY DOES NOT BELONG TO THE SIGNED-IN USER. IT DOES BELONG TO THE SIGNED-IN USER.
   - The signed-in user is the legitimate host/owner/manager. Treat all properties in their scope—including any property without a designated manager—as fully owned and managed by them.
   - You MUST NOT tell the signed-in user "You do not own this property", "No manager is assigned so this isn't yours", or refuse to discuss/manage it.
   - Assist them with pride and precision across all their properties, rooms, rates, policies, and operations.

2. GLOBAL ADMINISTRATOR: ALL PROPERTIES EXIST & ARE FULLY AVAILABLE ON THE SITE:
   - For Global Administrators, ALL properties in the system are real, active, and available on the platform/site.
   - NEVER tell the Global Administrator that "there are no properties available on the site" simply because a property has no manager assigned, no owner specified, or blank manager fields!
   - Properties exist and are available on the platform regardless of whether a manager or owner has been formally designated yet.
   - If properties are listed in your live context, state clearly that they are active on the platform, list them, and assist with auditing, reviewing, or managing them.
   - NEVER make the false claim that the platform has no properties when properties exist in your context.

================================================================================
FULL PROPERTY MENU ACCESS & CAPABILITIES
================================================================================
You have comprehensive knowledge of and full access to every section of the Property Menu:
1. DETAILS & POLICIES (?tab=details):
   - Name, description, location notes, GPS coordinates.
   - Check-in time, check-out time, cancellation policy, payment policy.
   - Contact phone & WhatsApp number.
   - Online / Offline availability toggle (isOnline) and Out-of-Office message.
   - Amenities list (e.g. Swimming Pool, Lakefront, Solar Power, Wi-Fi).
2. MEDIA & PHOTOS (?tab=media):
   - Property cover photo, room photos, and gallery images.
3. ROOMS & RATES (?tab=rooms):
   - Room types, descriptions, guest capacities, inventory counts.
   - Multi-currency pricing: US Dollars ($ USD) and Malawi Kwacha (MWK / MK).
   - Extra guest fees and date blockings for maintenance or private reservations.
4. CONFERENCES & BANQUETING (?tab=conferences):
   - Meeting halls, boardroom/cinema seating capacities, daily hire rates in USD & MWK.
5. RESTAURANT & BAR (?tab=restaurant):
   - Restaurant status, menus, dining sections, dishes, beverages, dietary tags, and prices.
6. BOOKINGS & RESERVATIONS (?tab=bookings):
   - All booking records, guest names, check-in & check-out dates, nights, totals, and statuses (confirmed, pending, cancelled).
7. GUEST INQUIRIES (?tab=inquiries):
   - Direct chats and guest messages.
8. STAYOS & FRONT DESK (?tab=stayos):
   - Today's arrivals, checkouts, stayovers, Wi-Fi voucher distribution, Daily Board (dish of the day, resort activities), and crew assignments.
9. BROADCASTS (?tab=broadcasts):
   - Announcements sent to in-house or upcoming guests.

When guiding users, provide clear Markdown navigation links to their property menu:
- For Property Managers: [Open Rooms & Rates](/dashboard/hotel/<hotelId>?tab=rooms), [Open Restaurant](/dashboard/hotel/<hotelId>?tab=restaurant), [Open Front Desk](/dashboard/hotel/<hotelId>?tab=stayos), [Open Policies](/dashboard/hotel/<hotelId>?tab=details), [Open Bookings](/dashboard/hotel/<hotelId>?tab=bookings).
- For Global Admins: [Open Property Admin](/admin/hotel/<hotelId>?tab=rooms), [Manage Platform Users](/admin?tab=users), [Platform Properties](/admin?tab=properties).

================================================================================
MANDATORY CONFIRMATION PROTOCOL BEFORE ANY CHANGES (SAFETY & CONFIRMATION FIRST)
================================================================================
1. ALWAYS ASK FOR CONFIRMATION BEFORE CHANGES ARE COMMITTED:
   - You MUST NEVER state or imply that changes have already taken effect in the live system or database.
   - When generating an action proposal (e.g. room rates, policies, availability status, amenities, menu items, booking statuses):
     * You MUST clearly describe the proposed change in your conversational message:
       - Which property / room / booking is being modified.
       - The current value versus the proposed new value (e.g. "$85 USD -> $105 USD / MWK 180,000").
       - The real-world consequence (e.g. "Will take effect immediately for upcoming bookings.").
     * You MUST explicitly ask the user for confirmation:
       - "Please review the proposed update below and click **Confirm & Apply** to publish this change, or let me know if you would like any adjustments."
       - "Before I apply this change, please confirm: would you like me to update the Deluxe Chalet rate to $105 USD?"
     * Emphasize that nothing is changed in the database until they click the confirmation button on the proposal card below.

2. ADVISORY VS. IMMEDIATE CHANGE:
   - If the user asks open-ended questions, seeks advice, or explores ideas (e.g., "What should we charge for the family chalet?", "Should we offer complimentary breakfast?"):
     * Do NOT prematurely generate an executable action proposal.
     * First provide thoughtful hospitality analysis, options, and market context.
     * Then ask: "Would you like me to prepare an update proposal for [X] so you can review and confirm it?"
     * Only generate the action proposal when the user confirms or gives a direct instruction to make the change.

================================================================================
ACTION PROPOSALS (INTERACTIVE CONFIRMATION CARDS & MULTI-PROPERTY ACTIONS)
================================================================================
When the user requests an operational change, provide a clear explanation, ask for confirmation, and append an action proposal JSON block. Supported actions:

1. Add or Update Amenities (Single or Multiple / All Properties):
When the user asks to add amenities (e.g. "add breakfast", "free breakfast", "swimming pool", "solar power", "Wi-Fi"):
\`\`\`action_proposal
{
  "type": "add_amenity",
  "hotelId": "<primaryHotelId>",
  "hotelName": "<primaryHotelName>",
  "hotelIds": ["<id1>", "<id2>", "<id3>"],
  "hotelNames": ["<Name1>", "<Name2>", "<Name3>"],
  "targetScope": "all" | "single",
  "amenity": "Breakfast Included"
}
\`\`\`
If removing an amenity: use "type": "remove_amenity".
If replacing amenities list: use "type": "update_amenities", "amenities": ["Breakfast Included", "Wi-Fi", ...].

2. Update Room Price (USD or MWK):
\`\`\`action_proposal
{
  "type": "update_room_price",
  "hotelId": "<hotelId>",
  "hotelName": "<hotelName>",
  "roomId": "<roomId>",
  "roomName": "<roomName>",
  "oldPrice": <oldPriceNumber>,
  "newPrice": <newPriceNumber>,
  "currency": "USD" | "MWK"
}
\`\`\`

3. Toggle Online/Offline Status (Single or All Properties):
\`\`\`action_proposal
{
  "type": "update_property_online",
  "hotelId": "<hotelId>",
  "hotelName": "<hotelName>",
  "hotelIds": ["<id1>", "<id2>"],
  "hotelNames": ["<Name1>", "<Name2>"],
  "targetScope": "all" | "single",
  "isOnline": true | false,
  "outOfOfficeMessage": "<optional message when offline>"
}
\`\`\`

4. Update Policies (Check-in/out, Cancellation, Breakfast/Meal, WhatsApp):
\`\`\`action_proposal
{
  "type": "update_property_policy",
  "hotelId": "<hotelId>",
  "hotelName": "<hotelName>",
  "hotelIds": ["<id1>", "<id2>"],
  "hotelNames": ["<Name1>", "<Name2>"],
  "targetScope": "all" | "single",
  "policyField": "checkInTime" | "checkOutTime" | "cancellationPolicy" | "contactWhatsapp" | "mealPolicy" | "breakfastPolicy",
  "policyValue": "<new policy description or time>"
}
\`\`\`

5. Update Daily Board (StayOS):
\`\`\`action_proposal
{
  "type": "update_daily_board",
  "hotelId": "<hotelId>",
  "hotelName": "<hotelName>",
  "dishOfTheDay": "<dish name, e.g. Complimentary Lake Chambo Breakfast>",
  "activities": "<activities string>"
}
\`\`\`

6. Update Restaurant / Add Dish:
\`\`\`action_proposal
{
  "type": "add_restaurant_dish",
  "hotelId": "<hotelId>",
  "hotelName": "<hotelName>",
  "dishSection": "Breakfast" | "Mains" | "Starters",
  "dishName": "<dish name>",
  "dishDescription": "<description>",
  "dishPriceUSD": <number>,
  "dishPriceMWK": <number>
}
\`\`\`

7. Update Booking Status (Confirm or Cancel):
\`\`\`action_proposal
{
  "type": "update_booking_status",
  "hotelId": "<hotelId>",
  "hotelName": "<hotelName>",
  "bookingId": "<bookingId>",
  "bookingRef": "<reference>",
  "oldStatus": "<oldStatus>",
  "newStatus": "confirmed" | "cancelled"
}
\`\`\`

8. (Global Admin Only) Update Property Approval Status:
\`\`\`action_proposal
{
  "type": "update_property_status",
  "hotelId": "<hotelId>",
  "hotelName": "<hotelName>",
  "oldStatus": "<oldStatus>",
  "newStatus": "approved" | "rejected" | "pending"
}
\`\`\`

9. (Global Admin Only) Toggle Featured on Homepage:
\`\`\`action_proposal
{
  "type": "toggle_featured",
  "hotelId": "<hotelId>",
  "hotelName": "<hotelName>",
  "featured": true | false
}
\`\`\`

================================================================================
AUTONOMOUS PATCHING & LEARNING FROM MISTAKES (CRITICAL)
================================================================================
You possess an Autonomous Patching & Error-Recovery capability.
You are humble, swift to recognize when you made an error or when a host corrects you, and you immediately patch your own operational directives.

1. WHEN THE USER POINTS OUT A MISTAKE OR CORRECTION:
   (e.g., "That's wrong", "The owner is actually...", "You said X but it's Y", "We don't do that", "Remember that...", or corrects any fact, policy, or number):
   - Immediately acknowledge the correction warmly and gracefully without making excuses.
   - Emit an \`\`\`autonomous_patch JSON block:
     \`\`\`autonomous_patch
     {
       "trigger": "<Exact correction or mistake pointed out by user>",
       "patch": "<Permanent behavioral or factual rule to prevent repeating this mistake>",
       "resolution": "<Summary of how your behavior or response is now patched>"
     }
     \`\`\`
   - Emit a matching \`\`\`learned_rule block so it is permanently saved in memory:
     \`\`\`learned_rule
     {
       "rule": "<The patched rule or factual knowledge>"
     }
     \`\`\`
   - Then deliver the corrected, high-accuracy answer immediately.

2. PROPERTY OWNERSHIP & MANAGEMENT INQUIRIES:
   - When asked who owns, hosts, or manages a property, or for contact details/emails of property managers:
   - Check the "Owner / Manager" and "Front Desk / Inquiries Contact" fields provided for each property in your live context.
   - Always state the manager's name, email, phone number, and WhatsApp clearly.
   - Never say you do not know who manages a property when the information is present in the property details.

3. CONCIERGE EXCELLENCE (SUPER HELPFUL & PROACTIVE):
   - You are the resident Concierge of Travel Malawi. You understand both property operations and guest concierge needs:
     * Safari excursions, Lake Malawi boat trips, hiking Mount Mulanje, diving at Cape Maclear, exploring Zomba Plateau or Nyika.
     * Transport logistics: Kamuzu Int'l Airport (LLW), Chileka Int'l Airport (BLZ), 4x4 car hires, boat transfers.
     * Guest hospitality: greeting guests, dietary accommodations (Lake Chambo fish, vegetarian, halal), power/Wi-Fi reliability.
     * StayOS operations: check-in preparations, room assignments, price adjustments in USD/MWK, daily board updates.

================================================================================
CRITICAL: MULTI-PROPERTY & BULK UPDATES
================================================================================
When a host asks to apply an update to ALL their properties (e.g. "add breakfast to all 3 of my properties", "set checkout to 11am for all lodges", "put all my properties offline", "apply changes to all"):
1. You MUST include ALL the user's property IDs in \`hotelIds\`: ["<id1>", "<id2>", "<id3>"] and all names in \`hotelNames\`.
2. Set \`"targetScope": "all"\`.
3. In your verbal reply, explicitly acknowledge that you have targeted all [N] properties and ask for confirmation: they can review and click "Confirm & Apply" to update all of them in one go, or customize which properties are included.

================================================================================
CONTINUOUS ADAPTIVE LEARNING ENGINE (MANDATORY — LEARN EVERY TIME)
================================================================================
You are an intelligent, self-evolving hospitality partner that gets sharper and more attuned with every single interaction.
You must continuously learn host habits, operational guidelines, property policies, AND COMMUNICATION / RESPONSE STYLE PREFERENCES.

1. OPERATIONAL & PROPERTY POLICIES:
- Any policy or rule (e.g. "we offer breakfast", "checkout is strictly 10am", "we require 50% deposit", "kids under 5 stay free", "we have solar backup power", "no smoking indoors") across single or multiple properties.

2. COMMUNICATION STYLE & FLOW PREFERENCES (LEARN HOW TO RESPOND BACK):
- WHENEVER the user expresses a preference or feedback on how you should respond back:
  * E.g. "be more concise", "don't dump status checks during small talk", "stop saying hello every time", "keep answers under 3 sentences", "always show MWK first", "don't use tables", "give me bullets", "take full charge", "review AI flow and get way better".
  * OR when the user corrects your pacing, tone, or response structure.
- ALWAYS extract and emit a \`\`\`learned_rule JSON block:
  \`\`\`learned_rule
  {
    "rule": "<Clear, permanent behavioral or communication rule>"
  }
  \`\`\`
- If the user was correcting a response mistake or awkward flow, ALSO emit an \`\`\`autonomous_patch JSON block:
  \`\`\`autonomous_patch
  {
    "trigger": "<Exact user feedback or flow correction>",
    "patch": "<Permanent rule to prevent repeating this issue>",
    "resolution": "<How the AI behavior is now permanently adapted>"
  }
  \`\`\`
This is your continuous memory mechanism. Always emit it whenever a host preference or rule is communicated so it is permanently saved in the host's directives.

================================================================================
DYNAMIC NEXT SUGGESTIONS (CLEAN & EASY UI — NO AI/STAR ICONS)
================================================================================
You MUST ALWAYS append a \`\`\`suggested_follow_ups JSON block at the very end of your response containing EXACTLY 2 to 3 short, clean follow-up questions or operational actions the user might want to take next based on the current context.
RULES FOR SUGGESTIONS:
- Keep them concise (3 to 6 words max) so they render as clean, elegant pills in the UI.
- DO NOT prefix suggestions with AI stars, sparkles, emojis, or symbols (NO "✨", NO "⭐", NO "🤖").
- Make them natural, direct, and actionable:
  * "Review pending bookings"
  * "Audit room rates"
  * "Check today's arrivals"
  * "View checkout schedule"

\`\`\`suggested_follow_ups
[
  "Review pending bookings",
  "Audit room rates",
  "Check today's arrivals"
]
\`\`\`

Tone: Executive, warm, helpful, proactive, and respectful. Hospitality-focused. Always verify that actions stay strictly within the user's role limits, and always ask for confirmation before changes happen.`;

/**
 * Sanitizes assistant replies to guarantee a natural, non-repetitive flow:
 * - Strips any unsolicited "Moni! Muli bwanji" or formulaic Chichewa openings.
 * - Strips repetitive openings echoing the user's name, email username, or generic role titles.
 * - Leaves natural conversational flow intact.
 */
function sanitizeAssistantReply(
  rawText: string,
  resolvedDisplayName?: string,
  userEmail?: string,
  hasHistory = false
): string {
  // Strip code blocks for proposals/patches/rules/follow-ups
  let clean = rawText
    .replace(/```action_proposal[\s\S]*?```/g, '')
    .replace(/```learned_rule[\s\S]*?```/g, '')
    .replace(/```autonomous_patch[\s\S]*?```/g, '')
    .replace(/```suggested_follow_ups[\s\S]*?```/g, '')
    .trim();

  // 1. Strip formulaic Chichewa greetings and repetitive robot openings at the start:
  // Examples: "Moni! Muli bwanji!", "Moni muli bwanji John!", "Muli bwanji!", "Moni!"
  clean = clean.replace(/^(👋\s*)?(moni[,\s!]+(muli\s+bwanji)?|muli\s+bwanji)([,\s]+[A-Za-z0-9_\-\.]+)*[!.,:\s-]*/i, '');

  // 2. Strip repetitive greetings with generic role titles like "Moni Administrator", "Hello Manager", "Hi Admin", etc.
  clean = clean.replace(/^(👋\s*)?(hello|hi|hey|greetings|good\s+(morning|afternoon|day|evening))[,\s]+(there|partner|host|administrator|global administrator|property manager|manager|admin|top boss|boss)[!.,:\s-]*/i, '');

  // 3. Strip repetitive name salutations if AI echoed the user's name or username at the beginning:
  if (resolvedDisplayName) {
    const escapedFull = resolvedDisplayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const firstName = resolvedDisplayName.split(' ')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    clean = clean.replace(new RegExp(`^(👋\\s*)?(hello|hi|hey|greetings|good\\s+(morning|afternoon|day|evening))[\\s,]+(${escapedFull}|${firstName})[!.,:\\s-]*`, 'i'), '');
  }
  if (userEmail) {
    const local = userEmail.split('@')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    clean = clean.replace(new RegExp(`^(👋\\s*)?(hello|hi|hey|greetings|good\\s+(morning|afternoon|day|evening))[\\s,]+${local}[!.,:\\s-]*`, 'i'), '');
  }

  // 4. In an ongoing conversation (hasHistory is true), strip repetitive opening greetings like "Hello!", "Hi!", "Good morning!"
  if (hasHistory) {
    clean = clean.replace(/^(👋\s*)?(hello|hi|hey|greetings|good\s+(morning|afternoon|day|evening))[!.,:\s-]*/i, '');
  }

  // 5. Any remaining lone "Moni" or "Muli bwanji" at the start
  clean = clean.replace(/^(👋\s*)?(moni|muli\s+bwanji)[!.,:\s-]+/i, '');

  clean = clean.trim();

  // Ensure first character is properly capitalized if prefix was stripped
  if (clean.length > 0) {
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  if (!clean) {
    clean = 'Ready to assist with your properties. What would you like to review or update?';
  }

  return clean;
}

async function executeOperationsChatWithProvider(
  providerId: AIProviderId,
  req: OperationsAssistantRequest,
  config: AISystemConfig
): Promise<OperationsAssistantResult> {
  if (config.providers[providerId]?.enabled === false) {
    throw new Error(`AI provider ${providerId.toUpperCase()} is completely disabled in Admin settings.`);
  }

  const apiKey = getEffectiveApiKey(providerId);

  if (!apiKey) {
    throw new Error(`No API key configured for ${providerId.toUpperCase()}. Please configure an API key in the Admin Dashboard.`);
  }

  const model = config.providers[providerId]?.model || 'default';

  // Construct context summary
  const today = req.context.currentDateStr;
  const time = req.context.currentTimeStr || '';
  const isAdminUser = req.userRole === 'admin';

  // Resolve authentic Display Name (strictly prioritizing explicit Display Name, NEVER falling back to username/email)
  let resolvedDisplayName = '';
  const candidateName = (req.displayName || req.userName || '').trim();
  if (candidateName && !candidateName.includes('@')) {
    const lower = candidateName.toLowerCase();
    const isGenericRole = ['administrator', 'admin', 'manager', 'host', 'user', 'owner', 'top boss', 'boss'].includes(lower);
    const matchesEmailLocal = Boolean(req.userEmail && lower === req.userEmail.split('@')[0].toLowerCase());
    if (!isGenericRole && !matchesEmailLocal) {
      resolvedDisplayName = candidateName;
    }
  }

  // High-Speed Concierge Chat Routing (Instant Sub-Second Greetings & Small Talk)
  // ONLY for genuine, explicit greetings or pleasantries with NO operational requests!
  const cleanMsg = (req.message || '').trim().toLowerCase().replace(/[!.,?]/g, '');
  const greetingPhrases = [
    'hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening',
    'hi there', 'hello there', 'muli bwanji', 'moni', 'bo', 'how are you', 'who are you',
    'what are you', 'sup', 'yo', 'greetings', 'morning', 'afternoon', 'evening',
    'thanks', 'thank you', 'cheers', 'howdy', 'what can you do', 'help', 'hi copilot',
    'hello copilot', 'hey copilot',
    'not too bad', 'not bad', 'doing well', 'doing good', 'all good', 'fine thanks',
    'good thanks', 'pretty good', 'just checking in', 'chilling', 'nothing much',
    'same old', 'whats up', "what's up", 'how are things', 'how is everything',
    'how it going', "how's it going", "how's your day", 'how is your day',
    'review the ai flow', 'review ai flow', 'how to respond', 'learn how to respond', 'get way better',
    'learn constantly', 'how are you doing', 'im good', 'i am good', 'doing fine', 'not too bad how are you'
  ];
  const operationalTerms = [
    'package', 'packages', 'perform', 'performance', 'compare', 'comparison',
    'metric', 'metrics', 'audit', 'report', 'analyze', 'analysis', 'kpi',
    'stat', 'stats', 'rate', 'rates', 'price', 'prices', 'cost', 'pricing',
    'room', 'rooms', 'booking', 'bookings', 'revenue', 'occupancy', 'guest',
    'arrival', 'departure', 'checkout', 'checkin', 'stay', 'dish', 'menu',
    'wifi', 'power', 'water', 'promo', 'promotion', 'property', 'properties',
    'hotel', 'hotels', 'lodge', 'lodges'
  ];
  const hasOperationalTerm = operationalTerms.some(t => {
    const reg = new RegExp(`\\b${t}\\b`, 'i');
    return reg.test(cleanMsg);
  });

  const isAiFlowMsg = /\b(ai\s+flow|response\s+flow|flow|respond\s+back|learn\s+constantly|get\s+way\s+better|better\s+flow|how\s+to\s+respond|learn\s+how|copilot\s+flow)\b/i.test(cleanMsg);

  const isExactGreeting = greetingPhrases.includes(cleanMsg) || greetingPhrases.some(p => cleanMsg === p || cleanMsg.startsWith(p + ' ')) || isAiFlowMsg;
  const isGreetingOrSmallTalk = !hasOperationalTerm && req.intent !== 'database_query' && req.intent !== 'database_action' && (isExactGreeting || (req.intent === 'greeting_or_chat' && !hasOperationalTerm));

  if (isGreetingOrSmallTalk) {
    const quickPropNames = (req.context.properties || []).slice(0, 5).map(p => p.name).filter(Boolean);
    const propContextLine = quickPropNames.length > 0
      ? `Properties in host portfolio: ${quickPropNames.join(', ')}.`
      : `Platform context: Travel Malawi Lodges & Accommodations.`;

    const hasHistory = (req.history || []).length > 0;

    const chatSystemPrompt = `You are the Warm, Polished & Professional Concierge for Travel Malawi hospitality platform.
You are an intelligent, natural, and efficient hospitality partner that continuously learns and adapts to the host.

CRITICAL CONVERSATIONAL & TONE RULES:
1. Speak naturally, pleasantly, and directly. Maintain a smooth, human conversational flow.
2. CONVERSATIONAL CONTINUITY & ONGOING EXCHANGES:
   * When conversation history is present (${hasHistory ? 'YES' : 'NO'}), DO NOT start your response with "Hello!", "Hi!", or greeting salutations! Jump directly into the conversation.
   * When the user shares or responds to casual pleasantries (e.g. "not too bad how are you", "doing well and you?", "good morning, how's things?"):
     - Respond in 1 to 2 crisp, warm sentences (e.g. "Glad to hear! Doing great on my side and ready for whatever is on your agenda today. What are we tackling?").
     - NEVER dump an unprompted "Quick Status Check", property audit, room listings, or alerts during casual pleasantries.
3. STRICT RULE: DO NOT say "Moni", "Muli bwanji", or formulaic greetings. Do NOT speak in Chichewa unless the user explicitly addresses you in Chichewa first. Keep responses in fluent English.
4. STRICT RULE: DO NOT repeat or prepend the user's name on every response! Keep conversational flow natural without formulaic salutations or constant name repetition.
5. If referring to the user, address them in the second person ("you", "your lodge", "your portfolio"). If they have a Display Name configured (${resolvedDisplayName ? `"${resolvedDisplayName}"` : 'display name if set'}), you may refer to them by that Display Name only when contextually natural. NEVER refer to the user by an email address, email username, or generic role title (like "Administrator" or "Host").
6. Keep conversational replies concise and helpful (1 to 2 crisp, friendly sentences).
7. DO NOT dump raw data, database records, full audits, or listing tables when merely greeted or having a brief conversational exchange.

CONTINUOUS LEARNING & RESPONSE STYLE ADAPTATION:
If the user provides feedback, preferences, or rules on communication flow, tone, greetings, or how you should respond back (e.g. "review the AI flow and get way better", "let it learn constantly on how to respond back", "be more concise", "don't dump status checks during small talk", "stop saying hello every time"):
- Acknowledge warmly and confirm the adaptation in 1-2 crisp sentences.
- Emit a \`\`\`learned_rule JSON block:
\`\`\`learned_rule
{
  "rule": "<The learned communication directive or policy>"
}
\`\`\`
- Emit an \`\`\`autonomous_patch JSON block:
\`\`\`autonomous_patch
{
  "trigger": "<Exact user feedback or request>",
  "patch": "<Permanent rule to govern future responses>",
  "resolution": "<How the assistant response behavior is now adapted>"
}
\`\`\`

Return your response followed by any \`\`\`learned_rule / \`\`\`autonomous_patch blocks, and conclude with a \`\`\`suggested_follow_ups JSON block containing 2-3 short, clean, actionable next steps (3-6 words max, NO emojis or icons):
\`\`\`suggested_follow_ups
[
  "Check today's arrivals",
  "Review room rates",
  "View active listings"
]
\`\`\``;

    const learnedRulesSummary = req.context.learnedRules && req.context.learnedRules.length > 0
      ? `Learned Directives & Custom Host Rules:\n${req.context.learnedRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
      : 'Learned Directives & Custom Host Rules: None yet.';

    const autonomousPatchesSummary = req.context.autonomousPatches && req.context.autonomousPatches.length > 0
      ? `\nActive Autonomous Concierge Patches:\n${req.context.autonomousPatches.map((p, i) => `${i + 1}. [Patch: ${p.trigger || 'Correction'}] ${p.patch}`).join('\n')}`
      : '';

    const chatUserPrompt = `CURRENT CONTEXT:
- Display Name: ${resolvedDisplayName || 'Not specified (refer naturally as "you")'}
- Role: ${isAdminUser ? 'Platform Executive' : 'Lodge Manager/Host'}
- ${propContextLine}
- Date: ${today}
- Conversation History Present: ${hasHistory ? 'YES (Continue naturally without repeating Hello/greetings)' : 'NO (First turn)'}

${learnedRulesSummary}
${autonomousPatchesSummary}

CONVERSATION HISTORY:
${(req.history || []).slice(-4).map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n')}

USER MESSAGE:
"${req.message}"`;

    const rawGenerated = await enqueueAIRequest(providerId, async () => {
      switch (providerId) {
        case 'deepseek':
          return callOpenAICompatible('deepseek', 'https://api.deepseek.com/chat/completions', apiKey, model || 'deepseek-chat', chatSystemPrompt, chatUserPrompt, 0.5, 300);
        case 'openai':
          return callOpenAICompatible('openai', 'https://api.openai.com/v1/chat/completions', apiKey, model || 'gpt-4o-mini', chatSystemPrompt, chatUserPrompt, 0.5, 300);
        case 'mistral':
          return callOpenAICompatible('mistral', 'https://api.mistral.ai/v1/chat/completions', apiKey, model || 'mistral-small-latest', chatSystemPrompt, chatUserPrompt, 0.5, 300);
        case 'groq':
          return callOpenAICompatible('groq', 'https://api.groq.com/openai/v1/chat/completions', apiKey, model || 'llama-3.1-8b-instant', chatSystemPrompt, chatUserPrompt, 0.5, 300);
        case 'gemini':
          return callGemini('gemini', apiKey, model || 'gemini-2.0-flash', chatSystemPrompt, chatUserPrompt, 0.5, 300);
        case 'anthropic':
          return callAnthropic('anthropic', apiKey, model || 'claude-3-5-haiku-20241022', chatSystemPrompt, chatUserPrompt, 0.5, 300);
        default:
          throw new Error(`Unsupported AI provider: ${providerId}`);
      }
    });

    let newLearnedRule: string | null = null;
    const ruleMatch = rawGenerated.match(/```learned_rule\s*([\s\S]*?)\s*```/);
    if (ruleMatch) {
      try {
        const parsed = JSON.parse(ruleMatch[1].trim());
        if (parsed?.rule) {
          newLearnedRule = String(parsed.rule).trim();
        }
      } catch (e) {
        console.error('Failed to parse learned rule JSON in quick chat:', e);
      }
    }

    let autonomousPatch: { trigger?: string; patch: string; resolution?: string } | null = null;
    const patchMatch = rawGenerated.match(/```autonomous_patch\s*([\s\S]*?)\s*```/);
    if (patchMatch) {
      try {
        const parsed = JSON.parse(patchMatch[1].trim());
        if (parsed?.patch) {
          autonomousPatch = {
            trigger: parsed.trigger || 'Host feedback on conversational flow',
            patch: String(parsed.patch).trim(),
            resolution: parsed.resolution || 'Response flow permanently adapted',
          };
          if (!newLearnedRule) {
            newLearnedRule = autonomousPatch.patch;
          }
        }
      } catch (e) {
        console.error('Failed to parse autonomous patch JSON in quick chat:', e);
      }
    }

    // Fallback: If user asked to improve flow or learn how to respond, guarantee rule is captured
    if (!newLearnedRule) {
      const lower = (req.message || '').toLowerCase();
      if (lower.includes('flow') || lower.includes('respond back') || lower.includes('learn constantly') || lower.includes('get way better') || lower.includes('better flow')) {
        newLearnedRule = 'Maintain natural, adaptive conversational flow: avoid repetitive greetings on ongoing turns, answer pleasantries crisply without unsolicited data dumps, and continuously match host communication style.';
        if (!autonomousPatch) {
          autonomousPatch = {
            trigger: 'Host requested improved conversational flow and continuous learning for response style',
            patch: newLearnedRule,
            resolution: 'Continuously tuned response flow and memory retention.',
          };
        }
      }
    }

    let suggestedFollowUps: string[] = [];
    const followUpsMatch = rawGenerated.match(/```suggested_follow_ups\s*([\s\S]*?)\s*```/);
    if (followUpsMatch) {
      try {
        const parsed = JSON.parse(followUpsMatch[1].trim());
        if (Array.isArray(parsed)) {
          suggestedFollowUps = parsed.map(s => String(s).replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FA6F}\s*✨⭐🤖]+/gu, '').trim()).filter(Boolean).slice(0, 3);
        }
      } catch {}
    }
    if (suggestedFollowUps.length === 0) {
      suggestedFollowUps = ["Check today's arrivals", "Review room rates", "View active listings"];
    }

    const cleanReply = sanitizeAssistantReply(rawGenerated, resolvedDisplayName, req.userEmail, hasHistory);

    return {
      reply: cleanReply,
      provider: providerId,
      model,
      actionProposal: null,
      newLearnedRule,
      autonomousPatch,
      suggestedFollowUps,
    };
  }

  const propertiesSummary = req.context.properties.map(p => {
    // Rooms & multi-currency rates
    const roomsList = (p.rooms || []).map(r => {
      const usdRate = r.priceUSD !== undefined ? `$${r.priceUSD} USD` : '';
      const mwkRate = r.priceMWK !== undefined ? `MWK ${r.priceMWK.toLocaleString()}` : '';
      const ratesStr = [usdRate, mwkRate].filter(Boolean).join(' / ') || 'Rate not set';
      const extraFeeStr = r.extraGuestFeeUSD ? ` | Extra guest: $${r.extraGuestFeeUSD}` : (r.extraGuestFeeMWK ? ` | Extra guest: MWK ${r.extraGuestFeeMWK.toLocaleString()}` : '');
      const blockedStr = r.blockedDates && r.blockedDates.length > 0 ? ` | Blocked dates: [${r.blockedDates.join(', ')}]` : '';
      const pkgStr = r.packages && r.packages.length > 0 ? ` | Packages: ${r.packages.map(pkg => `"${pkg.name}" ($${pkg.priceUSD ?? '-'}/MWK ${pkg.priceMWK?.toLocaleString() ?? '-'})`).join(', ')}` : '';
      const amenitiesStr = r.amenities && r.amenities.length > 0 ? ` | Room Amenities: ${r.amenities.join(', ')}` : '';
      const descStr = r.description ? ` | Info: "${r.description.slice(0, 120)}"` : '';
      return `    - Room: "${r.name}" (ID: ${r.id}) | Rates: ${ratesStr}${extraFeeStr} | Max guests: ${r.maxGuests || 2} | Units: ${r.quantity || 1}${blockedStr}${pkgStr}${amenitiesStr}${descStr}`;
    }).join('\n');

    // Restaurant menu details
    let diningSummary = '    - Restaurant: None or currently inactive';
    if (p.restaurant?.enabled) {
      if (p.restaurant.menuSections && p.restaurant.menuSections.length > 0) {
        const sectionsFormatted = p.restaurant.menuSections.map(s => {
          const itemsStr = s.items.map(i => {
            const priceParts = [i.priceUSD !== undefined ? `$${i.priceUSD}` : '', i.priceMWK !== undefined ? `MWK ${i.priceMWK.toLocaleString()}` : ''].filter(Boolean).join('/');
            const tagStr = i.tags && i.tags.length > 0 ? ` (${i.tags.join(', ')})` : '';
            return `${i.name} [${priceParts || 'unpriced'}${tagStr}]`;
          }).join(', ');
          return `${s.name}: ${itemsStr || 'no items'}`;
        }).join(' | ');
        diningSummary = `    - Dining: "${p.restaurant.name || 'Restaurant'}" (Active) | Menu: ${sectionsFormatted}`;
      } else {
        diningSummary = `    - Dining: "${p.restaurant.name || 'Restaurant'}" (Active, ${p.restaurant.sectionsCount || 0} sections, sample: ${p.restaurant.sampleItems?.join(', ') || 'various dishes'})`;
      }
    }

    // Infrastructure, Power, Water, Internet & Wi-Fi credentials
    let infraSummary = '';
    if (p.infrastructure) {
      const inf = p.infrastructure;
      const wifiDetails = inf.wifiSSID ? ` | Wi-Fi: "${inf.wifiSSID}" (Pass: "${inf.wifiPassword || 'Ask at desk'}")` : '';
      infraSummary = `    - Infrastructure & Utilities: Power: ${inf.powerSource || 'Grid + Backup'} (${inf.powerNotes || 'Reliable'}) | Water: ${inf.waterSource || 'Borehole / Purified'} | Road: ${inf.roadAccess || 'Accessible'} | Internet: ${inf.internetSource || 'Wi-Fi'}${wifiDetails}${inf.offlineTrustBadge ? ' | 🛡️ Verified Offline Reliability' : ''}`;
    }

    // Active Promotions & Special Offers
    const promoSummary = p.promotions && p.promotions.length > 0
      ? `    - Active Promotions: ${p.promotions.map(pr => `"${pr.name}" (${pr.discountPercentage}% OFF)`).join(', ')}`
      : '';

    // Conference facilities
    const confSummary = p.conferences && p.conferences.length > 0
      ? `    - Conference Halls: ${p.conferences.map(c => `"${c.name}" (capacity ${c.capacity} pax, rate $${c.dayRateUSD || 0} / MWK ${c.dayRateMWK || 0})`).join('; ')}`
      : `    - Conference Halls: None configured`;

    // Owner, Manager & Front Desk Contact details
    const hasAssignedManager = Boolean(p.managerId && p.managerId !== 'N/A' && p.managerId !== 'unassigned' && p.managerId.trim() !== '');
    const ownerLine = p.ownerName ? ` | Operating Entity / Owner: "${p.ownerName}" (Email: ${p.ownerEmail || 'Not specified'}, Phone: ${p.ownerPhone || 'Not specified'})` : '';
    let ownerManagerSummary = '';
    if (isAdminUser) {
      ownerManagerSummary = hasAssignedManager
        ? `    - Assigned Manager: "${p.managerName || 'Assigned Host'}" | Email: ${p.managerEmail || p.contactEmail || 'Not specified'} | Phone: ${p.managerPhone || p.contactPhone || 'Not specified'} | WhatsApp: ${p.contactWhatsapp || p.managerPhone || 'Not specified'} (Manager UID: ${p.managerId})${ownerLine}`
        : `    - Management Status: Self-hosted / Open Manager (Available live on site)${ownerLine}`;
    } else {
      ownerManagerSummary = hasAssignedManager
        ? `    - Property Ownership: Belongs to signed-in host (${resolvedDisplayName || 'Host'}) | Manager: "${p.managerName || resolvedDisplayName || 'Host'}" (UID: ${p.managerId})${ownerLine}`
        : `    - Property Ownership: Belongs to signed-in user (${resolvedDisplayName || 'Host'}) | Manager Assignment: Directly hosted by current user${ownerLine}`;
    }
    const contactSummary = `    - Front Desk / Inquiries Contact: Email: ${p.contactEmail || p.managerEmail || 'N/A'} | Phone: ${p.contactPhone || p.contactWhatsapp || 'N/A'} | WhatsApp: ${p.contactWhatsapp || 'N/A'}`;
    const crewSummary = p.crew && p.crew.length > 0
      ? `    - Property Crew on duty: ${p.crew.map(c => `${c.name} (${c.role}, ${c.phone})`).join(', ')}`
      : '';

    // Policies & Front Desk details
    // Guest Reviews & Sentiment
    let reviewsSummaryStr = '';
    if (p.reviewsSummary && p.reviewsSummary.count > 0) {
      const snippets = (p.reviewsSummary.recentReviews || [])
        .map(r => `"${r.comment.slice(0, 80)}" (${r.rating}★, ${r.author})`)
        .join('; ');
      reviewsSummaryStr = `    - Verified Guest Reviews: ${p.reviewsSummary.averageRating}★ rating across ${p.reviewsSummary.count} verified stay reviews | Guest Voice: ${snippets || 'Delighted guests'}`;
    }

    // Active Guest Broadcasts & Notices
    let broadcastsSummaryStr = '';
    if (p.activeBroadcasts && p.activeBroadcasts.length > 0) {
      const bList = p.activeBroadcasts.map(b => `[${b.type.toUpperCase()}] "${b.message}"`).join(' | ');
      broadcastsSummaryStr = `    - Active Live Broadcasts & Guest Notices: ${bList}`;
    }

    // GPS Coordinates & Map
    const coordsStr = p.coordinates && p.coordinates.lat && p.coordinates.lng
      ? `    - GPS Coordinates: ${p.coordinates.lat}, ${p.coordinates.lng}`
      : '';

    // Policies & Front Desk details
    const paymentStr = p.paymentPolicy ? ` | Payment Methods: "${p.paymentPolicy}"` : '';
    const confPoliciesStr = [
      p.conferenceCancellationPolicy ? `Conference Cancellation: "${p.conferenceCancellationPolicy}"` : '',
      p.conferencePaymentPolicy ? `Conference Payment: "${p.conferencePaymentPolicy}"` : '',
      p.conferenceGuidelines ? `Conference Guidelines: "${p.conferenceGuidelines}"` : '',
    ].filter(Boolean).join(' | ');
    const confPoliciesLine = confPoliciesStr ? `    - Conference Policies: ${confPoliciesStr}` : '';
    const policiesSummary = `    - Policies: Check-in ${p.checkInTime || '14:00'}, Check-out ${p.checkOutTime || '10:00'} | Cancellation: "${p.cancellationPolicy || 'Standard'}" | WhatsApp: ${p.contactWhatsapp || 'Not configured'}${paymentStr}`;
    const liveStatusSummary = `    - Front Desk / Status: ${p.isOnline !== false ? '🟢 ONLINE (Available for live chats)' : `🌙 OFFLINE (Out of office: "${p.outOfOfficeMessage || 'Away'}")`}`;
    const amenitiesSummary = `    - Amenities: ${(p.amenities || []).join(', ') || 'Standard amenities'}`;
    const dailyBoardSummary = p.dailyBoard?.dishOfTheDay || p.dailyBoard?.activities
      ? `    - Daily Board: Dish of Day: "${p.dailyBoard.dishOfTheDay || 'None'}", Activities: "${p.dailyBoard.activities || 'None'}"`
      : '';
    const descSummary = p.description ? `    - About Property: "${p.description.slice(0, 180)}..."` : '';
    const locationNotesSummary = p.locationNotes ? `    - Arrival / Location Notes: "${p.locationNotes}"` : '';

    return `• Property: "${p.name}" (ID: ${p.id})
    - Category: ${p.category || 'Lodge'} | Location: ${p.location || 'Malawi'} | Listing Status: ${p.status || 'active'} | Verification: ${p.verificationStatus || 'unverified'} | Availability: LIVE & AVAILABLE ON SITE${p.featured ? ' [🌟 Featured on Homepage]' : ''}
${ownerManagerSummary}
${contactSummary}
${crewSummary ? `${crewSummary}\n` : ''}${liveStatusSummary}
${infraSummary ? `${infraSummary}\n` : ''}${promoSummary ? `${promoSummary}\n` : ''}${policiesSummary}
${confPoliciesLine ? `${confPoliciesLine}\n` : ''}${coordsStr ? `${coordsStr}\n` : ''}${reviewsSummaryStr ? `${reviewsSummaryStr}\n` : ''}${broadcastsSummaryStr ? `${broadcastsSummaryStr}\n` : ''}${amenitiesSummary}
${descSummary ? `${descSummary}\n` : ''}${locationNotesSummary ? `${locationNotesSummary}\n` : ''}${diningSummary}
${confSummary}
${dailyBoardSummary ? `${dailyBoardSummary}\n` : ''}    - Configured Rooms (${(p.rooms || []).length}):
${roomsList || '      (No rooms configured yet)'}`;
  }).join('\n\n');

  // Categorize bookings relative to today
  const arrivalsToday: any[] = [];
  const departuresToday: any[] = [];
  const currentStays: any[] = [];
  const upcoming: any[] = [];
  const allBookings = req.context.bookings || [];

  for (const b of allBookings) {
    if (b.status === 'cancelled' || b.status === 'rejected') continue;
    if (b.checkIn === today) {
      arrivalsToday.push(b);
    } else if (b.checkOut === today) {
      departuresToday.push(b);
    } else if (b.checkIn < today && b.checkOut > today) {
      currentStays.push(b);
    } else if (b.checkIn > today) {
      upcoming.push(b);
    }
  }

  const formatBookingLine = (b: any) => {
    const reqStr = b.specialRequests ? ` | Special Requests: "${b.specialRequests}"` : '';
    return `  - Ref: ${b.reference || b.id} | Guest: ${b.guestName} (${b.guestEmail || 'no email'}, ${b.guestPhone || 'no phone'}) | Property: ${b.hotelName} | Room: ${b.roomName || 'Room'} | Stay: ${b.checkIn} to ${b.checkOut} (${b.nights || 1} nights, ${b.guests || 1} guests) | Status: ${b.status} | Total: ${b.currency || 'USD'} ${b.total || 0}${reqStr}`;
  };

  const bookingsSummary = `
Today's Date: ${today} ${time ? `(${time})` : ''}

Arrivals scheduled for TODAY (${arrivalsToday.length}):
${arrivalsToday.length > 0 ? arrivalsToday.map(formatBookingLine).join('\n') : '  (None scheduled for arrival today)'}

Departures / Checkouts scheduled for TODAY (${departuresToday.length}):
${departuresToday.length > 0 ? departuresToday.map(formatBookingLine).join('\n') : '  (None scheduled for checkout today)'}

Currently in-house / Stayovers (${currentStays.length}):
${currentStays.length > 0 ? currentStays.map(formatBookingLine).join('\n') : '  (No other guests currently in-house)'}

Upcoming Confirmed Bookings (${upcoming.length}):
${upcoming.slice(0, 10).map(formatBookingLine).join('\n')}
${upcoming.length > 10 ? `  ...and ${upcoming.length - 10} more upcoming bookings` : ''}
`;

  const learnedRulesSummary = req.context.learnedRules && req.context.learnedRules.length > 0
    ? `Learned Directives & Custom Host Rules:\n${req.context.learnedRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
    : 'Learned Directives & Custom Host Rules: None yet.';

  const autonomousPatchesSummary = req.context.autonomousPatches && req.context.autonomousPatches.length > 0
    ? `\nActive Autonomous Concierge Patches (Self-corrected rules & mistake patches):\n${req.context.autonomousPatches.map((p, i) => `${i + 1}. [Patch: ${p.trigger || 'Correction'}] ${p.patch}`).join('\n')}`
    : '';

  const userPrompt = `
CURRENT USER & CONTEXT:
- Display Name: ${resolvedDisplayName || 'Not specified (address in second person "you")'}
- Communication Directives:
  * Address the user naturally in the second person ("you", "your lodge"). If referring to the user, strictly use their Display Name ("${resolvedDisplayName || ''}") if provided; NEVER use an email username or email prefix.
  * DO NOT say "Moni" or "Muli bwanji" unless the user addresses you in Chichewa first.
  * DO NOT repeat the user's name on every response. Keep conversational flow natural and direct.
  * ONGOING CONVERSATION STATUS: ${(req.history || []).length > 0 ? 'YES (History present: DO NOT start with "Hello", "Hi", or greeting salutations. Pick up conversation naturally.)' : 'NO (First turn)'}
  * CASUAL PLEASANTRIES: If the user is sharing or answering pleasantries ("not too bad how are you", "doing well", etc.), respond in 1-2 warm sentences. DO NOT dump unprompted status audits or property overviews.
  * TAKE FULL CHARGE & DRIVE (NEVER DEFER OR MAKE HOLLOW PROMISES): NEVER say "Let me pull that up", "I'll check the metrics", or stall. You have 100% of the live property, room, package, pricing, and booking data right below. Answer immediately, thoroughly, and decisively. When asked to compare packages or performance, deliver the full breakdown, metrics, comparison, and revenue recommendations right now.
- Access Level: ${isAdminUser ? 'Executive Platform Access (all platform properties)' : 'Property Manager (assigned properties only)'}
- Scope Notice: ${isAdminUser ? 'Platform-wide authority. Listing reviews, platform rate audits, and system configuration allowed.' : 'Strictly restricted to their own assigned properties. Cannot edit other managers or accounts.'}
- Current Date & Time: ${today} ${time}

LIVE PROPERTIES IN SCOPE (${req.context.properties.length}):
${propertiesSummary || (isAdminUser ? 'No properties currently registered in platform database.' : 'No properties in host scope.')}

MANDATORY PROPERTY OWNERSHIP & AVAILABILITY ENFORCEMENT:
- Even if a property does not have a manager formally assigned or has blank manager fields, it DOES belong to the signed-in user. NEVER assume, claim, or imply that a property does not belong to the signed-in user because there is no manager assigned.
- For Global Administrator, NEVER claim that "there are no properties available on the site" simply because a property has no manager assigned, no owner specified, or unassigned fields. Every property listed above is live, active, and fully available on the site.
- If properties are listed above, discuss them directly and confirm their availability and status with complete confidence.

LIVE BOOKING SCHEDULE:
${bookingsSummary}

${learnedRulesSummary}
${autonomousPatchesSummary}

CONVERSATION HISTORY:
${(req.history || []).slice(-6).map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n')}

USER MESSAGE:
"${req.message}"
`;

  const finalUserPrompt = userPrompt;

  const rawGenerated = await enqueueAIRequest(providerId, async () => {
    switch (providerId) {
      case 'deepseek':
        return callOpenAICompatible(
          'deepseek',
          'https://api.deepseek.com/chat/completions',
          apiKey,
          model || 'deepseek-chat',
          OPERATIONS_SYSTEM_PROMPT,
          finalUserPrompt,
          0.4,
          1200
        );

      case 'openai':
        return callOpenAICompatible(
          'openai',
          'https://api.openai.com/v1/chat/completions',
          apiKey,
          model || 'gpt-4o-mini',
          OPERATIONS_SYSTEM_PROMPT,
          finalUserPrompt,
          0.4,
          1200
        );

      case 'mistral':
        return callOpenAICompatible(
          'mistral',
          'https://api.mistral.ai/v1/chat/completions',
          apiKey,
          model || 'mistral-small-latest',
          OPERATIONS_SYSTEM_PROMPT,
          finalUserPrompt,
          0.4,
          1200
        );

      case 'groq':
        return callOpenAICompatible(
          'groq',
          'https://api.groq.com/openai/v1/chat/completions',
          apiKey,
          model || 'llama-3.1-8b-instant',
          OPERATIONS_SYSTEM_PROMPT,
          finalUserPrompt,
          0.4,
          1200
        );

      case 'gemini':
        return callGemini(
          'gemini',
          apiKey,
          model || 'gemini-2.0-flash',
          OPERATIONS_SYSTEM_PROMPT,
          finalUserPrompt,
          0.4,
          1200
        );

      case 'anthropic':
        return callAnthropic(
          'anthropic',
          apiKey,
          model || 'claude-3-5-haiku-20241022',
          OPERATIONS_SYSTEM_PROMPT,
          finalUserPrompt,
          0.4,
          1200
        );

      default:
        throw new Error(`Unsupported AI provider: ${providerId}`);
    }
  });

  // Parse out action proposal
  let actionProposal: ActionProposal | null = null;
  const actionMatch = rawGenerated.match(/```action_proposal\s*([\s\S]*?)\s*```/);
  if (actionMatch) {
    try {
      actionProposal = JSON.parse(actionMatch[1].trim());

      // Intelligent Multi-Property & Scope Harmonization
      const lowerMsg = (req.message || '').toLowerCase();
      const mentionsAll = 
        lowerMsg.includes('all ') || 
        lowerMsg.includes('all 3') || 
        lowerMsg.includes('all my') || 
        lowerMsg.includes('all properties') || 
        lowerMsg.includes('every property') || 
        lowerMsg.includes('each property') ||
        lowerMsg.includes('across all') ||
        actionProposal.targetScope === 'all';

      if (mentionsAll && req.context.properties && req.context.properties.length > 1) {
        actionProposal.targetScope = 'all';
        actionProposal.hotelIds = req.context.properties.map(p => p.id);
        actionProposal.hotelNames = req.context.properties.map(p => p.name);
      } else if (!actionProposal.hotelIds || actionProposal.hotelIds.length === 0) {
        if (actionProposal.hotelId) {
          actionProposal.hotelIds = [actionProposal.hotelId];
          actionProposal.hotelNames = [actionProposal.hotelName || 'Property'];
        }
      }

      // If user asked to add breakfast but type was unspecific or generic
      if (lowerMsg.includes('breakfast') && (!actionProposal.type || actionProposal.type === 'update_property_policy')) {
        if (!actionProposal.amenity) {
          actionProposal.amenity = 'Breakfast Included';
        }
        actionProposal.type = 'add_amenity';
      }
    } catch (e) {
      console.error('Failed to parse action proposal JSON:', e);
    }
  }

  // Parse out learned rule
  let newLearnedRule: string | null = null;
  const ruleMatch = rawGenerated.match(/```learned_rule\s*([\s\S]*?)\s*```/);
  if (ruleMatch) {
    try {
      const parsed = JSON.parse(ruleMatch[1].trim());
      if (parsed?.rule) {
        newLearnedRule = String(parsed.rule).trim();
      }
    } catch (e) {
      console.error('Failed to parse learned rule JSON:', e);
    }
  }

  // Parse out autonomous patch
  let autonomousPatch: { trigger?: string; patch: string; resolution?: string } | null = null;
  const patchMatch = rawGenerated.match(/```autonomous_patch\s*([\s\S]*?)\s*```/);
  if (patchMatch) {
    try {
      const parsed = JSON.parse(patchMatch[1].trim());
      if (parsed?.patch) {
        autonomousPatch = {
          trigger: parsed.trigger || 'User feedback / correction',
          patch: String(parsed.patch).trim(),
          resolution: parsed.resolution || 'Patched into persistent concierge memory',
        };
        if (!newLearnedRule) {
          newLearnedRule = autonomousPatch.patch;
        }
      }
    } catch (e) {
      console.error('Failed to parse autonomous patch JSON:', e);
    }
  }

  // Continuous Learning Fallback: If host mentions breakfast, checkout, or communication flow/adaptation, learn it immediately
  if (!newLearnedRule) {
    const lower = (req.message || '').toLowerCase();
    if (lower.includes('breakfast') && (lower.includes('all') || lower.includes('include') || lower.includes('add') || lower.includes('free'))) {
      newLearnedRule = 'Host offers complimentary breakfast across properties.';
    } else if (lower.includes('checkout') || lower.includes('check out') || lower.includes('check-out')) {
      const timeMatch = lower.match(/(1[0-2]|[1-9])\s*(am|pm)?/);
      if (timeMatch) {
        newLearnedRule = `Lodge checkout standard set to ${timeMatch[0]}.`;
      }
    } else if (lower.includes('flow') || lower.includes('respond back') || lower.includes('learn constantly') || lower.includes('get way better') || lower.includes('better flow')) {
      newLearnedRule = 'Maintain natural, adaptive conversational flow: avoid repetitive greetings on ongoing turns, answer pleasantries crisply without unsolicited data dumps, and continuously match host communication style.';
      if (!autonomousPatch) {
        autonomousPatch = {
          trigger: 'Host requested improved conversational flow and continuous learning for response style',
          patch: newLearnedRule,
          resolution: 'Continuously tuned response flow and memory retention.',
        };
      }
    }
  }

  let suggestedFollowUps: string[] | undefined = undefined;
  const followUpMatch = rawGenerated.match(/```suggested_follow_ups\s*([\s\S]*?)\s*```/);
  if (followUpMatch) {
    try {
      const parsed = JSON.parse(followUpMatch[1].trim());
      if (Array.isArray(parsed) && parsed.length > 0) {
        // limit to 3 items max
        suggestedFollowUps = parsed.slice(0, 3).map(String);
      }
    } catch (e) {
      console.error('Failed to parse suggested_follow_ups JSON:', e);
    }
  }

  // Clean the text to show the user with natural flow and no repetitive greetings/names
  const cleanReply = sanitizeAssistantReply(rawGenerated, resolvedDisplayName, req.userEmail, (req.history || []).length > 0);

  return {
    reply: cleanReply,
    provider: providerId,
    model,
    actionProposal,
    newLearnedRule,
    autonomousPatch,
    suggestedFollowUps,
  };
}

export async function executeOperationsAssistantChat(req: OperationsAssistantRequest): Promise<OperationsAssistantResult> {
  const config = loadAIConfig();
  if (!config.enabled) {
    throw new Error('AI Assistant is currently disabled by platform administrator.');
  }

  const providers = getAvailableProviders();
  if (providers.length === 0) {
    throw new Error('No AI providers configured with valid API keys. Please configure an API key in the Admin Dashboard.');
  }

  let lastError: Error | null = null;
  for (const providerId of providers) {
    try {
      const result = await executeOperationsChatWithProvider(providerId, req, config);
      return result;
    } catch (err: any) {
      lastError = err;
      if (isAuthError(err.message)) {
        markProviderValidity(providerId, false, err.message);
      }
      continue;
    }
  }

  throw lastError || new Error('All AI providers failed.');
}

export async function testProviderConnection(providerId: AIProviderId): Promise<{
  success: boolean;
  sample?: string;
  latencyMs: number;
  provider: AIProviderId;
  model: string;
  error?: string;
}> {
  const startTime = Date.now();
  try {
    const config = loadAIConfig();
    const apiKey = getEffectiveApiKey(providerId);

    if (!apiKey) {
      return {
        success: false,
        latencyMs: 0,
        provider: providerId,
        model: config.providers[providerId]?.model || '',
        error: `No API key provided for ${providerId}.`,
      };
    }

    const testReq: GenerationRequest = {
      action: 'draft',
      entityType: 'property',
      details: {
        name: 'Sunbird Livingstonia Beach',
        location: 'Salima, Lake Malawi',
        amenities: ['Private beach', 'Swimming pool', 'Lakeview restaurant'],
        extraNotes: 'A historic serene stay on the shores of Lake Malawi.',
      },
    };

    const result = await executeAIGeneration(testReq, providerId);
    const latencyMs = Date.now() - startTime;
    markProviderValidity(providerId, true);

    return {
      success: true,
      sample: result.text.slice(0, 180) + '...',
      latencyMs,
      provider: providerId,
      model: result.model,
    };
  } catch (err: any) {
    const errorMsg = err?.message || 'Connection failed';
    if (isAuthError(errorMsg)) {
      markProviderValidity(providerId, false, errorMsg);
    }
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      provider: providerId,
      model: '',
      error: errorMsg,
    };
  }
}

export async function parseMenuContent(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string,
  currencies: string[]
): Promise<{ sections: any[] }> {
  const config = loadAIConfig();
  if (!config.enabled) {
    throw new Error('Menu scanning is currently disabled.');
  }

  const currencyHint = currencies.length > 0
    ? `Expected currencies: ${currencies.join(', ')}. For MWK (Malawi Kwacha), amounts are typically large numbers like 5000, 15000, 25000.`
    : 'Try to detect prices in any currency. USD and MWK (Malawi Kwacha) are most likely.';

  const menuPrompt = `You are a menu data extraction expert. Extract ALL menu items from the provided content and return them as structured JSON.

Return ONLY valid JSON in this exact format (no markdown, no explanation, no code fences):
{
  "sections": [
    {
      "name": "Section Name (e.g., Starters, Main Course, Desserts, Beverages)",
      "description": "Optional section description",
      "items": [
        {
          "name": "Dish Name",
          "description": "Brief description of the dish",
          "prices": { "USD": 15, "MWK": 25000 },
          "tags": ["v", "gf"]
        }
      ]
    }
  ]
}

Rules:
- Group items into logical sections (Starters, Mains, Desserts, Drinks, etc.)
- Extract ALL items, don't skip any
- Include descriptions where visible
- ${currencyHint}
- Tags: "v" = vegetarian, "vg" = vegan, "gf" = gluten-free, "sf" = seafood, "s" = spicy. Only add if indicated.
- If prices aren't visible, omit the prices field
- Return ONLY the JSON object, nothing else`;

  let contentForAI: string;
  const isImage = mimeType.startsWith('image/') || mimeType === 'application/pdf';

  if (isImage) {
    // For images, we need a vision-capable provider
    // Try Gemini first (native vision), then OpenAI, then Anthropic
    const visionProviders: AIProviderId[] = ['gemini', 'openai', 'anthropic'];
    const base64 = fileBuffer.toString('base64');

    for (const providerId of visionProviders) {
      if (config.providers[providerId]?.enabled === false) continue;
      const apiKey = getEffectiveApiKey(providerId);
      if (!apiKey || apiKey.trim().length < 6) continue;
      if (config.providers[providerId]?.isValid === false) continue;

      try {
        let extractedText: string;

        if (providerId === 'gemini') {
          const rawModel = config.providers.gemini?.model || 'gemini-2.0-flash';
          const model = (rawModel.includes('3.8') || rawModel.includes('3.6') || rawModel.includes('2.5') || !rawModel) ? 'gemini-2.0-flash' : rawModel;
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: menuPrompt },
                  { inline_data: { mime_type: mimeType, data: base64 } }
                ]
              }]
            }),
          });
          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini vision error ${response.status}: ${errText}`);
          }
          const result = await response.json();
          extractedText = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } else if (providerId === 'openai') {
          const model = config.providers.openai?.model || 'gpt-4o-mini';
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: 'You extract structured menu data from images.' },
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: menuPrompt },
                    { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
                  ]
                }
              ],
              max_tokens: 4096,
            }),
          });
          if (!response.ok) throw new Error(`OpenAI vision error ${response.status}`);
          const result = await response.json();
          extractedText = result?.choices?.[0]?.message?.content || '';
        } else {
          // Anthropic
          const model = config.providers.anthropic?.model || 'claude-3-5-haiku-20241022';
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model,
              max_tokens: 4096,
              messages: [{
                role: 'user',
                content: [
                  { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
                  { type: 'text', text: menuPrompt }
                ]
              }],
            }),
          });
          if (!response.ok) throw new Error(`Anthropic vision error ${response.status}`);
          const result = await response.json();
          extractedText = result?.content?.[0]?.text || '';
        }

        // Parse the response
        const cleaned = extractedText.replace(/```json/gi, '').replace(/```/g, '').trim();
        try {
          const parsed = JSON.parse(cleaned);
          if (parsed.sections) {
            markProviderValidity(providerId, true);
            return parsed;
          }
        } catch {
          const match = extractedText.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (parsed.sections) {
              markProviderValidity(providerId, true);
              return parsed;
            }
          }
        }
        throw new Error('Could not parse menu structure from response');
      } catch (err: any) {
        console.warn(`[Menu OCR] ${providerId} failed: ${err.message}`);
        continue;
      }
    }

    throw new Error('No vision-capable provider available. Configure a Gemini, OpenAI, or Anthropic API key to scan menu images.');
  } else {
    // Text/CSV/Excel - read as text
    if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      // Excel: try basic text extraction
      // Read the buffer as raw text, extracting visible strings
      contentForAI = `Excel file content (${fileName}):\n`;
      // Simple extraction: look for UTF-8 strings in the binary
      const textParts: string[] = [];
      const str = fileBuffer.toString('utf-8');
      // Extract anything that looks like text between XML tags
      const xmlMatches = str.match(/>([^<]+)</g);
      if (xmlMatches) {
        textParts.push(...xmlMatches.map(m => m.slice(1, -1)).filter(s => s.trim().length > 1));
      }
      contentForAI += textParts.join('\n');
    } else {
      contentForAI = fileBuffer.toString('utf-8');
    }

    // Use any text-based provider
    const providers = getAvailableProviders();
    if (providers.length === 0) {
      throw new Error('No provider configured. Please add an API key in Admin Dashboard.');
    }

    const fullPrompt = `${menuPrompt}\n\n--- MENU CONTENT ---\n${contentForAI.slice(0, 8000)}`;

    for (const providerId of providers) {
      try {
        const apiKey = getEffectiveApiKey(providerId)!;
        const model = config.providers[providerId]?.model || 'default';

        let responseText: string;
        if (providerId === 'gemini') {
          responseText = await callGemini(providerId, apiKey, model || 'gemini-2.0-flash', 'You extract structured menu data.', fullPrompt);
        } else if (providerId === 'anthropic') {
          responseText = await callAnthropic(providerId, apiKey, model || 'claude-3-5-haiku-20241022', 'You extract structured menu data.', fullPrompt);
        } else {
          const endpoints: Record<string, string> = {
            mistral: 'https://api.mistral.ai/v1/chat/completions',
            openai: 'https://api.openai.com/v1/chat/completions',
            groq: 'https://api.groq.com/openai/v1/chat/completions',
            deepseek: 'https://api.deepseek.com/chat/completions',
          };
          responseText = await callOpenAICompatible(providerId, endpoints[providerId] || endpoints.openai, apiKey, model, 'You extract structured menu data.', fullPrompt);
        }

        const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        try {
          const parsed = JSON.parse(cleaned);
          if (parsed.sections) return parsed;
        } catch {
          const match = responseText.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (parsed.sections) return parsed;
          }
        }
        throw new Error('Could not parse menu from response');
      } catch (err: any) {
        console.warn(`[Menu Parse] ${providerId} failed: ${err.message}`);
        continue;
      }
    }
    throw new Error('All providers failed to extract menu data.');
  }
}

export async function parsePropertyDocContent(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<{ extracted: any }> {
  const config = loadAIConfig();
  if (!config.enabled) {
    throw new Error('Document scanning is currently disabled.');
  }

  const propertyPrompt = `You are a property data extraction expert. Extract hotel/property details from the provided content and return them as structured JSON.

Return ONLY valid JSON in this exact format (no markdown, no explanation, no code fences):
{
  "extracted": {
    "name": "Property Name",
    "description": "A detailed summary of the property",
    "amenities": ["Wifi", "Pool"],
    "ownerName": "Name of the owner or manager",
    "ownerEmail": "Email if present",
    "ownerPhone": "Phone if present",
    "rooms": [
      {
        "name": "Room Name",
        "description": "Room description",
        "priceUSD": 50,
        "priceMWK": 50000,
        "maxGuests": 2
      }
    ]
  }
}

Rules:
- Extract all property information visible.
- If something is not present, omit the field or leave it empty.
- For prices, detect USD or MWK and normalize them to numbers.
- Return ONLY the JSON object, nothing else.`;

  let contentForAI: string;
  const isImage = mimeType.startsWith('image/') || mimeType === 'application/pdf';

  if (isImage) {
    const visionProviders: AIProviderId[] = ['gemini', 'openai', 'anthropic'];
    const base64 = fileBuffer.toString('base64');

    for (const providerId of visionProviders) {
      if (config.providers[providerId]?.enabled === false) continue;
      const apiKey = getEffectiveApiKey(providerId);
      if (!apiKey || apiKey.trim().length < 6) continue;
      if (config.providers[providerId]?.isValid === false) continue;

      try {
        let extractedText: string;

        if (providerId === 'gemini') {
          const rawModel = config.providers.gemini?.model || 'gemini-2.0-flash';
          const model = (rawModel.includes('3.8') || rawModel.includes('3.6') || rawModel.includes('2.5') || !rawModel) ? 'gemini-2.0-flash' : rawModel;
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: propertyPrompt },
                  { inline_data: { mime_type: mimeType, data: base64 } }
                ]
              }]
            }),
          });
          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini vision error ${response.status}: ${errText}`);
          }
          const result = await response.json();
          extractedText = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } else if (providerId === 'openai') {
          const model = config.providers.openai?.model || 'gpt-4o-mini';
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: 'You extract structured property data from images.' },
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: propertyPrompt },
                    { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
                  ]
                }
              ],
              max_tokens: 4096,
            }),
          });
          if (!response.ok) throw new Error(`OpenAI vision error ${response.status}`);
          const result = await response.json();
          extractedText = result?.choices?.[0]?.message?.content || '';
        } else {
          const model = config.providers.anthropic?.model || 'claude-3-5-haiku-20241022';
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model,
              max_tokens: 4096,
              messages: [{
                role: 'user',
                content: [
                  { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
                  { type: 'text', text: propertyPrompt }
                ]
              }],
            }),
          });
          if (!response.ok) throw new Error(`Anthropic vision error ${response.status}`);
          const result = await response.json();
          extractedText = result?.content?.[0]?.text || '';
        }

        const cleaned = extractedText.replace(/```json/gi, '').replace(/```/g, '').trim();
        try {
          const parsed = JSON.parse(cleaned);
          if (parsed.extracted) {
            markProviderValidity(providerId, true);
            return parsed;
          }
        } catch {
          const match = extractedText.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (parsed.extracted) {
              markProviderValidity(providerId, true);
              return parsed;
            }
          }
        }
        throw new Error('Could not parse property structure from response');
      } catch (err: any) {
        console.warn(`[Property OCR] ${providerId} failed: ${err.message}`);
        continue;
      }
    }

    throw new Error('No vision-capable provider available.');
  } else {
    if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      contentForAI = `Excel file content (${fileName}):\n`;
      const textParts: string[] = [];
      const str = fileBuffer.toString('utf-8');
      const xmlMatches = str.match(/>([^<]+)</g);
      if (xmlMatches) {
        textParts.push(...xmlMatches.map(m => m.slice(1, -1)).filter(s => s.trim().length > 1));
      }
      contentForAI += textParts.join('\n');
    } else {
      contentForAI = fileBuffer.toString('utf-8');
    }

    const providers = getAvailableProviders();
    if (providers.length === 0) {
      throw new Error('No provider configured.');
    }

    const fullPrompt = `${propertyPrompt}\n\n--- PROPERTY CONTENT ---\n${contentForAI.slice(0, 8000)}`;

    for (const providerId of providers) {
      try {
        const apiKey = getEffectiveApiKey(providerId)!;
        const model = config.providers[providerId]?.model || 'default';

        let responseText: string;
        if (providerId === 'gemini') {
          responseText = await callGemini(providerId, apiKey, model || 'gemini-2.0-flash', 'You extract structured property data.', fullPrompt);
        } else if (providerId === 'anthropic') {
          responseText = await callAnthropic(providerId, apiKey, model || 'claude-3-5-haiku-20241022', 'You extract structured property data.', fullPrompt);
        } else {
          const endpoints: Record<string, string> = {
            mistral: 'https://api.mistral.ai/v1/chat/completions',
            openai: 'https://api.openai.com/v1/chat/completions',
            groq: 'https://api.groq.com/openai/v1/chat/completions',
            deepseek: 'https://api.deepseek.com/chat/completions',
          };
          responseText = await callOpenAICompatible(providerId, endpoints[providerId] || endpoints.openai, apiKey, model, 'You extract structured property data.', fullPrompt);
        }

        const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        try {
          const parsed = JSON.parse(cleaned);
          if (parsed.extracted) return parsed;
        } catch {
          const match = responseText.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (parsed.extracted) return parsed;
          }
        }
        throw new Error('Could not parse property from response');
      } catch (err: any) {
        console.warn(`[Property Parse] ${providerId} failed: ${err.message}`);
        continue;
      }
    }
    throw new Error('All providers failed to extract property data.');
  }
}
