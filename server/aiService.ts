import { AIProviderId, getEffectiveApiKey, loadAIConfig } from './aiConfig';

export interface GenerationRequest {
  action: 'draft' | 'polish' | 'shorten' | 'highlights' | 'suggest_amenities' | 'suggest_rooms' | 'review_listing' | 'suggest_rate';
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
  }

  return parts.join('\n\n');
}

/**
 * Direct API caller for standard OpenAI-compatible endpoints (DeepSeek, OpenAI, Mistral, Groq)
 */
async function callOpenAICompatible(
  apiUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
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
      temperature: 0.7,
      max_tokens: 600,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText.slice(0, 300)}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error('No text generated from model');
  }
  return text;
}

/**
 * Google Gemini REST caller
 */
async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const cleanModel = model.replace(/^models\//, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`;

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
        temperature: 0.7,
        maxOutputTokens: 600,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText.slice(0, 300)}`);
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!candidate) {
    throw new Error('No text generated by Gemini');
  }
  return candidate;
}

/**
 * Anthropic Messages API caller
 */
async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const url = 'https://api.anthropic.com/v1/messages';

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
      temperature: 0.7,
      max_tokens: 600,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errorText.slice(0, 300)}`);
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text?.trim();
  if (!text) {
    throw new Error('No text generated by Anthropic');
  }
  return text;
}

export async function executeAIGeneration(
  req: GenerationRequest,
  overrideProvider?: AIProviderId
): Promise<GenerationResult> {
  const config = loadAIConfig();

  // Check Kill Switch
  if (!config.enabled) {
    throw new Error('AI Assistant is currently disabled by platform administration.');
  }

  const providerId = overrideProvider || config.activeProvider;
  const apiKey = getEffectiveApiKey(providerId);

  if (!apiKey) {
    throw new Error(`No API key configured for ${providerId.toUpperCase()}. Please configure an API key in the Admin Dashboard.`);
  }

  const model = config.providers[providerId]?.model || 'default';
  const userPrompt = buildUserPrompt(req);

  let generatedText = '';

  switch (providerId) {
    case 'deepseek':
      generatedText = await callOpenAICompatible(
        'https://api.deepseek.com/chat/completions',
        apiKey,
        model || 'deepseek-chat',
        SYSTEM_PROMPT,
        userPrompt
      );
      break;

    case 'openai':
      generatedText = await callOpenAICompatible(
        'https://api.openai.com/v1/chat/completions',
        apiKey,
        model || 'gpt-4o-mini',
        SYSTEM_PROMPT,
        userPrompt
      );
      break;

    case 'mistral':
      generatedText = await callOpenAICompatible(
        'https://api.mistral.ai/v1/chat/completions',
        apiKey,
        model || 'mistral-small-latest',
        SYSTEM_PROMPT,
        userPrompt
      );
      break;

    case 'groq':
      generatedText = await callOpenAICompatible(
        'https://api.groq.com/openai/v1/chat/completions',
        apiKey,
        model || 'llama-3.3-70b-versatile',
        SYSTEM_PROMPT,
        userPrompt
      );
      break;

    case 'gemini':
      generatedText = await callGemini(
        apiKey,
        model || 'gemini-1.5-flash',
        SYSTEM_PROMPT,
        userPrompt
      );
      break;

    case 'anthropic':
      generatedText = await callAnthropic(
        apiKey,
        model || 'claude-3-5-haiku-20241022',
        SYSTEM_PROMPT,
        userPrompt
      );
      break;

    default:
      throw new Error(`Unsupported AI provider: ${providerId}`);
  }

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
  } else if (req.action === 'suggest_rate') {
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

  return {
    text: generatedText,
    provider: providerId,
    model,
    data: structuredData,
  };
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
  userName?: string;
  userEmail?: string;
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  context: {
    currentDateStr: string;
    currentTimeStr?: string;
    properties: Array<{
      id: string;
      name: string;
      location?: string;
      category?: string;
      status?: string;
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
      crew?: Array<{ name: string; role: string; phone?: string; whatsapp?: string }>;
      checkInTime?: string;
      checkOutTime?: string;
      cancellationPolicy?: string;
      paymentPolicy?: string;
      amenities?: string[];
      restaurant?: {
        enabled: boolean;
        name?: string;
        sectionsCount?: number;
        sampleItems?: string[];
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
        priceUSD?: number;
        priceMWK?: number;
        maxGuests?: number;
        quantity?: number;
        extraGuestFeeUSD?: number;
        extraGuestFeeMWK?: number;
        blockedDates?: string[];
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

const OPERATIONS_SYSTEM_PROMPT = `You are the executive Lodge Operations Copilot and Hospitality AI for the premier Malawian accommodations platform (The Warm Heart of Africa).
You assist with real-time property operations, rooms, pricing in USD and MWK, restaurant menus, conference bookings, guest arrivals, checkouts, and front desk operations.

================================================================================
CONVERSATIONAL STYLE & PERSONALITY (CRITICAL — READ CAREFULLY)
================================================================================
1. ZERO REPETITIVE GREETINGS ("STOP SAYING MONI ADMINISTRATOR"):
   - NEVER start your messages with "Moni Administrator", "Moni", "Hello Administrator", or any repetitive formulaic greeting on every prompt.
   - NEVER call the user "Administrator", "Global Administrator", or "Manager" as their title or name. Address them naturally in the second person ("you", "your properties"), or by their real first name if provided.
   - In an active conversation, jump straight into answering the user's question, providing analysis, or proposing changes. No robotic preamble, corporate throat-clearing, or repetitive welcome lines.

2. BE A GENUINE, VIBRANT, HIGH-CALIBER ASSISTANT (NOT BORING OR STATIC):
   - Speak like a sharp, trusted hospitality operations partner or executive chief of staff standing right beside the user.
   - Be human, observant, proactive, and direct. Add genuine hospitality intelligence:
     * If there are zero arrivals scheduled for today, don't just dump "0 arrivals". Give practical operational context: "Front desk is quiet with zero check-ins today—a great window for housekeeping to do deep maintenance or get rooms staged for the weekend."
     * If checkouts or arrivals are scheduled, point out guest names, room assignments, and whether payments are settled.
     * If asked about rates, highlight differences between USD and MWK, or flag unpriced rooms.
   - NEVER use robotic clichés like "As an AI language model...", "As your Lodge Operations Copilot...", "I have live access to...", or "Top Boss Mode activated". Just be genuinely helpful and sharp.

================================================================================
CRITICAL ROLE-BASED ACCESS CONTROL (RBAC) & SECURITY BOUNDARIES
================================================================================

1. GLOBAL ADMINISTRATOR ("TOP BOSS"):
   - Highest executive authority on the platform.
   - Has full visibility and managerial rights over ALL properties, rooms, bookings, and users across Malawi.
   - Can approve, reject, or feature any property listing.
   - Can manage user accounts and assist with password reset instructions for managers and users. (Direct link: [Admin Users Management](/admin?tab=users)).
   - Can configure platform AI settings, destination collections, and platform policies.

2. PROPERTY MANAGER ("MANAGER"):
   - Scoped strictly to their own assigned properties.
   - Can ONLY manage, configure, or inspect properties that are assigned to them (provided in the context list).
   - STRICT FORBIDDEN BOUNDARIES:
     * A manager CANNOT manage or view operational data for properties belonging to another manager.
     * A MANAGER CANNOT CHANGE OR RESET PASSWORDS FOR OTHER MANAGERS OR USERS.
       If a manager asks to change or reset the password for another manager or user (e.g. "Change password for manager John", "Reset Mary's password", "Give me John's credentials"):
       YOU MUST FIRMLY AND POLITELY REFUSE:
       "As a Property Manager, your administrative authority is strictly limited to your own assigned properties. You do not have authorization to manage credentials, edit profiles, or reset passwords for other managers. Account management and password resets can only be performed by the Global Administrator."
     * A manager CANNOT approve properties for public listing or feature properties on the homepage (requires Global Admin).
     * A manager CANNOT change platform system settings.

================================================================================
CRITICAL DIRECTIVE: UNASSIGNED PROPERTIES, OWNERSHIP & PLATFORM AVAILABILITY
================================================================================
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
ACTION PROPOSALS (ONE-CLICK EXECUTABLE UPDATES & MULTI-PROPERTY ACTIONS)
================================================================================
When the user asks to make an operational change, provide a clear, warm explanation and append an action proposal JSON block. Supported actions:

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
3. In your verbal reply, explicitly acknowledge that you have targeted all [N] properties and that the host can click "Apply Changes" to update all of them in one go, or customize which properties are included.

================================================================================
CONTINUOUS ADAPTIVE LEARNING ENGINE (MANDATORY — LEARN EVERY TIME)
================================================================================
You are an all-rounder intelligent hospitality engine that gets sharper and more attuned with every single conversation.
You must continuously extract and retain operational directives, host habits, meal policies, check-in timings, payment methods, and property rules.
WHENEVER the user mentions or implies:
- Any policy or standard (e.g. "we offer breakfast", "breakfast is free", "checkout is strictly 10am", "we require 50% deposit", "kids under 5 stay free", "we have solar backup power", "no smoking indoors")
- Any operational guideline across single or multiple properties
- Even if the user did NOT say "remember this":
YOU MUST ALWAYS append a \`\`\`learned_rule JSON block at the very end of your response:
\`\`\`learned_rule
{
  "rule": "Host provides complimentary breakfast across all properties."
}
\`\`\`
This is your continuous memory mechanism. Always emit it whenever a host preference or rule is communicated.

================================================================================
DYNAMIC NEXT SUGGESTIONS (MANDATORY)
================================================================================
You MUST ALWAYS append a \`\`\`suggested_follow_ups JSON block at the very end of your response containing EXACTLY 2 to 3 short, highly relevant follow-up questions or actions the user might want to take next based on the current context. Keep them concise (max 6-8 words) so they fit perfectly in prompt chips without scrolling.

\`\`\`suggested_follow_ups
[
  "Review pending bookings",
  "Update room rates",
  "Check today's arrivals"
]
\`\`\`

Tone: Executive, warm, helpful, proactive, and respectful. Hospitality-focused. Always verify that actions stay strictly within the user's role limits.`;

export async function executeOperationsAssistantChat(req: OperationsAssistantRequest): Promise<OperationsAssistantResult> {
  const config = loadAIConfig();
  if (!config.enabled) {
    throw new Error('AI Assistant is currently disabled by platform administrator.');
  }

  const providerId = config.activeProvider;
  const apiKey = getEffectiveApiKey(providerId);

  if (!apiKey) {
    throw new Error(`No API key configured for ${providerId.toUpperCase()}. Please configure an API key in the Admin Dashboard.`);
  }

  const model = config.providers[providerId]?.model || 'default';

  // Construct context summary
  const today = req.context.currentDateStr;
  const time = req.context.currentTimeStr || '';
  const isAdminUser = req.userRole === 'admin';

  // Extract clean first name if available (avoiding generic role titles as names)
  let cleanFirstName = '';
  const rawName = (req.userName || '').trim();
  if (rawName && !rawName.includes('@') && !['administrator', 'admin', 'manager', 'host', 'user', 'owner', 'top boss'].includes(rawName.toLowerCase())) {
    cleanFirstName = rawName.split(' ')[0];
  } else if (req.userEmail) {
    const localPart = req.userEmail.split('@')[0];
    const extracted = localPart.split(/[._-]/)[0];
    cleanFirstName = extracted.charAt(0).toUpperCase() + extracted.slice(1);
  }

  const propertiesSummary = req.context.properties.map(p => {
    // Rooms & multi-currency rates
    const roomsList = (p.rooms || []).map(r => {
      const usdRate = r.priceUSD !== undefined ? `$${r.priceUSD} USD` : '';
      const mwkRate = r.priceMWK !== undefined ? `MWK ${r.priceMWK.toLocaleString()}` : '';
      const ratesStr = [usdRate, mwkRate].filter(Boolean).join(' / ') || 'Rate not set';
      const blockedStr = r.blockedDates && r.blockedDates.length > 0 ? ` | Blocked dates: [${r.blockedDates.join(', ')}]` : '';
      return `    - Room: "${r.name}" (ID: ${r.id}) | Rates: ${ratesStr} | Max guests: ${r.maxGuests || 2} | Units: ${r.quantity || 1}${blockedStr}`;
    }).join('\n');

    // Restaurant menu details
    const diningSummary = p.restaurant?.enabled
      ? `    - Restaurant: "${p.restaurant.name || 'On-site Dining'}" (Active, ${p.restaurant.sectionsCount || 0} menu sections, sample dishes: ${p.restaurant.sampleItems?.join(', ') || 'Various dishes'})`
      : `    - Restaurant: None or currently inactive`;

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
        ? `    - Property Ownership: Belongs to signed-in host (${cleanFirstName || 'Host'}) | Manager: "${p.managerName || cleanFirstName || 'Host'}" (UID: ${p.managerId})${ownerLine}`
        : `    - Property Ownership: Belongs to signed-in user (${cleanFirstName || 'Host'}) | Manager Assignment: Directly hosted by current user${ownerLine}`;
    }
    const contactSummary = `    - Front Desk / Inquiries Contact: Email: ${p.contactEmail || p.managerEmail || 'N/A'} | Phone: ${p.contactPhone || p.contactWhatsapp || 'N/A'} | WhatsApp: ${p.contactWhatsapp || 'N/A'}`;
    const crewSummary = p.crew && p.crew.length > 0
      ? `    - Property Crew on duty: ${p.crew.map(c => `${c.name} (${c.role}, ${c.phone})`).join(', ')}`
      : '';

    // Policies & Front Desk details
    const policiesSummary = `    - Policies: Check-in ${p.checkInTime || '14:00'}, Check-out ${p.checkOutTime || '10:00'} | Cancellation: "${p.cancellationPolicy || 'Standard'}" | WhatsApp: ${p.contactWhatsapp || 'Not configured'}`;
    const liveStatusSummary = `    - Front Desk / Status: ${p.isOnline !== false ? '🟢 ONLINE (Available for live chats)' : `🌙 OFFLINE (Out of office: "${p.outOfOfficeMessage || 'Away'}")`}`;
    const amenitiesSummary = `    - Amenities: ${(p.amenities || []).join(', ') || 'Standard amenities'}`;
    const dailyBoardSummary = p.dailyBoard?.dishOfTheDay || p.dailyBoard?.activities
      ? `    - Daily Board: Dish of Day: "${p.dailyBoard.dishOfTheDay || 'None'}", Activities: "${p.dailyBoard.activities || 'None'}"`
      : '';

    return `• Property: "${p.name}" (ID: ${p.id})
    - Category: ${p.category || 'Lodge'} | Location: ${p.location || 'Malawi'} | Listing Status: ${p.status || 'active'} | Availability: LIVE & AVAILABLE ON SITE${p.featured ? ' [🌟 Featured on Homepage]' : ''}
${ownerManagerSummary}
${contactSummary}
${crewSummary ? `${crewSummary}\n` : ''}${liveStatusSummary}
${policiesSummary}
${amenitiesSummary}
${diningSummary}
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

  const formatBookingLine = (b: any) => 
    `  - Ref: ${b.reference || b.id} | Guest: ${b.guestName} (${b.guestEmail || 'no email'}, ${b.guestPhone || 'no phone'}) | Property: ${b.hotelName} | Room: ${b.roomName || 'Room'} | Stay: ${b.checkIn} to ${b.checkOut} (${b.nights || 1} nights, ${b.guests || 1} guests) | Status: ${b.status} | Total: ${b.currency || 'USD'} ${b.total || 0}`;

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
- Name: ${cleanFirstName || 'Partner'}
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

  let rawGenerated = '';

  switch (providerId) {
    case 'deepseek':
      rawGenerated = await callOpenAICompatible(
        'https://api.deepseek.com/chat/completions',
        apiKey,
        model || 'deepseek-chat',
        OPERATIONS_SYSTEM_PROMPT,
        userPrompt
      );
      break;

    case 'openai':
      rawGenerated = await callOpenAICompatible(
        'https://api.openai.com/v1/chat/completions',
        apiKey,
        model || 'gpt-4o-mini',
        OPERATIONS_SYSTEM_PROMPT,
        userPrompt
      );
      break;

    case 'mistral':
      rawGenerated = await callOpenAICompatible(
        'https://api.mistral.ai/v1/chat/completions',
        apiKey,
        model || 'mistral-small-latest',
        OPERATIONS_SYSTEM_PROMPT,
        userPrompt
      );
      break;

    case 'groq':
      rawGenerated = await callOpenAICompatible(
        'https://api.groq.com/openai/v1/chat/completions',
        apiKey,
        model || 'llama-3.3-70b-versatile',
        OPERATIONS_SYSTEM_PROMPT,
        userPrompt
      );
      break;

    case 'gemini':
      rawGenerated = await callGemini(
        apiKey,
        model || 'gemini-1.5-flash',
        OPERATIONS_SYSTEM_PROMPT,
        userPrompt
      );
      break;

    case 'anthropic':
      rawGenerated = await callAnthropic(
        apiKey,
        model || 'claude-3-5-haiku-20241022',
        OPERATIONS_SYSTEM_PROMPT,
        userPrompt
      );
      break;

    default:
      throw new Error(`Unsupported AI provider: ${providerId}`);
  }

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

  // Continuous Learning Fallback: If host mentions breakfast policy or rule across properties, learn it immediately
  if (!newLearnedRule) {
    const lower = (req.message || '').toLowerCase();
    if (lower.includes('breakfast') && (lower.includes('all') || lower.includes('include') || lower.includes('add') || lower.includes('free'))) {
      newLearnedRule = 'Host offers complimentary breakfast across properties.';
    } else if (lower.includes('checkout') || lower.includes('check out') || lower.includes('check-out')) {
      const timeMatch = lower.match(/(1[0-2]|[1-9])\s*(am|pm)?/);
      if (timeMatch) {
        newLearnedRule = `Lodge checkout standard set to ${timeMatch[0]}.`;
      }
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

  // Clean the text to show the user
  let cleanReply = rawGenerated
    .replace(/```action_proposal[\s\S]*?```/g, '')
    .replace(/```learned_rule[\s\S]*?```/g, '')
    .replace(/```autonomous_patch[\s\S]*?```/g, '')
    .replace(/```suggested_follow_ups[\s\S]*?```/g, '')
    .trim();

  // Clean away any repetitive formulaic robot openings like "Moni Administrator!", "Moni!", "Hello Administrator!"
  cleanReply = cleanReply
    .replace(/^(👋\s*)?(Moni|Hello|Hi|Greetings|Good\s+(morning|afternoon|day|evening))[,\s]+(Administrator|Global Administrator|Property Manager|Manager|Admin|Top Boss|Boss)[!.,:\s-]*/i, '')
    .replace(/^(👋\s*)?Moni[!.,\s]+/i, '')
    .trim();

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

    return {
      success: true,
      sample: result.text.slice(0, 180) + '...',
      latencyMs,
      provider: providerId,
      model: result.model,
    };
  } catch (err: any) {
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      provider: providerId,
      model: '',
      error: err?.message || 'Connection failed',
    };
  }
}
