import { AIProviderId } from './aiConfig';
import { findMentionedPropertyIds } from '../src/lib/queryIntent';
import { OperationsAssistantRequest, OperationsAssistantResult, ActionProposal } from './aiService';

export type SwarmAgentId = 
  | 'frontdesk_specialist'
  | 'revenue_specialist'
  | 'operations_specialist'
  | 'tourism_concierge'
  | 'onboarding_specialist'
  | 'marketing_specialist'
  | 'swarm_coordinator';

export interface SwarmClassification {
  primaryAgent: SwarmAgentId;
  intent: 
    | 'arrivals_departures' 
    | 'rate_optimization' 
    | 'amenity_policy' 
    | 'tourism_activities' 
    | 'onboarding_assistance' 
    | 'marketing_outreach' 
    | 'general_chat';
  reason: string;
}

/**
 * Classifies the incoming message to route to the appropriate specialist agent in the Ulendo Swarm
 */
export function classifySwarmIntent(req: OperationsAssistantRequest): SwarmClassification {
  const cleanMsg = (req.message || '').trim().toLowerCase();
  const stripped = cleanMsg.replace(/[!.,?]/g, '');

  // 1. Host Onboarding & Listing Setup Specialist
  const onboardingTerms = [
    'onboard', 'onboarding', 'list property', 'list my property', 'list lodge',
    'list my stay', 'new listing', 'draft listing', 'setup property', 'register lodge',
    'create listing', 'add property', 'painless', 'listing steps', 'room setup',
    'category setup', 'draft help', 'how to list', 'start listing', 'listing draft',
    'setup rooms', 'how do i list', 'host signup', 'join as host', 'claim lodge'
  ];
  if (onboardingTerms.some(t => new RegExp(`\\b${t}\\b`, 'i').test(cleanMsg))) {
    return {
      primaryAgent: 'onboarding_specialist',
      intent: 'onboarding_assistance',
      reason: 'User is asking about property listing, host onboarding, or draft configuration.',
    };
  }

  // 2. Marketing Team & Host Acquisition Specialist
  const marketingTerms = [
    'marketing', 'outreach', 'starter pack', 'field guide', 'welcome message',
    'welcome pack', 'whatsapp template', 'audit listing', 'review pending', 'acquire',
    'field onboarding', 'pitch deck', 'social post', 'announce lodge', 'new host pitch',
    'brochure pitch', 'flyer', 'host acquisition', 'fast onboard', 'quick onboard'
  ];
  if (marketingTerms.some(t => new RegExp(`\\b${t}\\b`, 'i').test(cleanMsg))) {
    return {
      primaryAgent: 'marketing_specialist',
      intent: 'marketing_outreach',
      reason: 'User is seeking marketing strategies, host welcome templates, listing audits, or field onboarding assistance.',
    };
  }

  // 3. Front Desk / Reservations / Arrivals
  const frontDeskTerms = [
    'arrival', 'arrivals', 'checkin', 'check in', 'check-in',
    'departure', 'departures', 'checkout', 'check out', 'check-out',
    'booking', 'bookings', 'reservation', 'reservations',
    'guest', 'guests', 'who is staying', 'staying today', 'calendar',
    'booked', 'occupied', 'vacant', 'key', 'voucher', 'pin'
  ];
  if (frontDeskTerms.some(t => new RegExp(`\\b${t}\\b`, 'i').test(cleanMsg))) {
    return {
      primaryAgent: 'frontdesk_specialist',
      intent: 'arrivals_departures',
      reason: 'User is querying guest arrivals, departures, or booking calendar.',
    };
  }

  // 4. Revenue / Rates / Pricing
  const revenueTerms = [
    'rate', 'rates', 'price', 'prices', 'pricing', 'rack rate',
    'cost', 'charge', 'kwacha', 'mwk', 'usd', 'dollar', 'discount',
    'bulk', 'yield', 'revenue', 'commission', 'package', 'packages',
    'season', 'seasonal', 'peak season', 'green season', 'promotions', 'promo'
  ];
  if (revenueTerms.some(t => new RegExp(`\\b${t}\\b`, 'i').test(cleanMsg))) {
    return {
      primaryAgent: 'revenue_specialist',
      intent: 'rate_optimization',
      reason: 'User is inquiring about room rates, currency conversions, or yield optimization.',
    };
  }

  // 5. Operations / Amenities / Policies / Daily Board
  const operationsTerms = [
    'amenity', 'amenities', 'power', 'solar', 'escom', 'inverter', 'generator',
    'water', 'borehole', 'wifi', 'internet', 'password', 'breakfast', 'meal',
    'menu', 'dish', 'restaurant', 'daily board', 'specials', 'offline', 'online',
    'out of office', 'policy', 'cancellation', 'rules', 'staff', 'crew', 'status',
    'verified', 'feature', 'featured'
  ];
  if (operationsTerms.some(t => new RegExp(`\\b${t}\\b`, 'i').test(cleanMsg))) {
    return {
      primaryAgent: 'operations_specialist',
      intent: 'amenity_policy',
      reason: 'User is managing property infrastructure, amenities, daily board, or operational status.',
    };
  }

  // 6. Tourism / Excursions / Local Concierge
  const tourismTerms = [
    'lake', 'lake malawi', 'chambo', 'kampango', 'nsima', 'tour', 'tourism',
    'excursion', 'safari', 'game drive', 'liwonde', 'majete', 'nyika', 'mulanje',
    'zomba', 'cape maclear', 'senga bay', 'mangochi', 'nkhata bay', 'likoma',
    'boat', 'catamaran', 'kayak', 'diving', 'snorkeling', 'road', '4x4', 'tarmac',
    'route', 'shuttle', 'drive', 'driving', 'attraction', 'attractions'
  ];
  if (tourismTerms.some(t => new RegExp(`\\b${t}\\b`, 'i').test(cleanMsg))) {
    return {
      primaryAgent: 'tourism_concierge',
      intent: 'tourism_activities',
      reason: 'User is seeking Malawian destination expertise, travel advice, or itinerary recommendations.',
    };
  }

  // 7. Default Swarm Coordinator (Greetings, Identity, Feedback, Adaptive Mirroring)
  return {
    primaryAgent: 'swarm_coordinator',
    intent: 'general_chat',
    reason: 'Conversational greetings, assistant feedback, or high-level platform inquiry.',
  };
}

/**
 * Returns tailored prompt extensions for the designated Swarm Specialist Agent
 */
export function getSpecialistAgentPrompt(agent: SwarmAgentId): string {
  switch (agent) {
    case 'onboarding_specialist':
      return `SWARM ROLE: LODGE ONBOARDING & RAPID INVENTORY SPECIALIST (ULENDO SWARM)
You are the dedicated Host Onboarding Specialist in the Ulendo Swarm. Your mission is to make listing a Malawian property as effortless, welcoming, and painless as possible.
Key Guidelines:
1. Frictionless Onboarding Mindset:
   - Reassure hosts that listing takes under 3 minutes, with 0% foreign commission and direct WhatsApp guest messaging.
   - Draft saves automatically in their browser.
2. Dual Currency Pricing Guidance:
   - Malawian Kwacha (MWK): Rounded to nearest 1,000 MWK (e.g. MK 85,000 or MK 140,000 / night).
   - US Dollars (USD): Whole dollar figures rounded to nearest $5 (e.g. $55 or $95).
3. Malawi Infrastructure Essentials Checklist:
   - Always encourage adding 24/7 Solar / Inverter backup (top guest priority in Malawi), purified borehole water, hot showers, and mosquito nets over beds.
4. Auto-Fill & Document Assistance:
   - Remind hosts that they can import photos, WhatsApp rate sheets, brochures, or paste links directly into the Property Document Importer.
5. Empathic, Encouraging Tone:
   - Provide concrete, ready-to-use snippets for property descriptions and room setups instead of asking the host to brainstorm from scratch.`;

    case 'marketing_specialist':
      return `SWARM ROLE: MARKETING & HOST ACQUISITION SPECIALIST (ULENDO SWARM)
You are the expert Marketing & Field Acquisition Sub-Agent in the Ulendo Swarm. Your mission is to empower the Travel Malawi marketing team to discover, audit, and onboard independent lodges, cottages, and B&Bs with zero friction.
Key Guidelines:
1. Field Onboarding Speed:
   - Help marketing officers on the road (Mangochi, Cape Maclear, Senga Bay, Lilongwe, Blantyre, Zomba, Nyika) rapid-onboard a lodge in under 60 seconds.
2. Listing Quality Audit:
   - Perform rapid 5-point audits on pending properties:
     a. Geo Gate Coordinates (must be in Malawi).
     b. Dual Currency Pricing Balance (~1,750 MWK / USD).
     c. Power & Water Reliability (Solar / Inverter, Borehole).
     d. Clear Room Inventory (names, guests, rates).
     e. Photography (angles of master bed, veranda view, en-suite bathroom).
3. Host Welcome & Starter Pack Dispatch:
   - Generate warm, personalized WhatsApp messages that field marketing officers can send to lodge owners instantly, with their live link and the Host Starter Pack ([/host-guide](/host-guide)).
4. Social & Launch Hooks:
   - Craft compelling 2-3 sentence promotional features highlighting Lake Malawi views, wildlife proximity, fresh Chambo dining, and direct booking savings.`;

    case 'frontdesk_specialist':
      return `SWARM ROLE: FRONT DESK & RESERVATIONS SPECIALIST (ULENDO SWARM)
You are the expert Front Desk & Reservations Sub-Agent. Your mission is to provide instantaneous, clear, and actionable visibility into guest arrivals, departures, check-in readiness, and room inventory.
Key Guidelines:
1. Present arrivals and departures as compact bullet cards (**Guest** · Room · Dates · Status · Total) or a table of at most 3 columns (e.g. | Guest & Room | Dates | Status |).
2. Highlight any guests arriving today or departing today.
3. If no arrivals or checkouts occur today, state it clearly in one friendly sentence, then proactively summarize upcoming bookings.
4. Keep commentary practical: remind hosts about room preparation, solar hot water readiness, mosquito nets, and arrival greetings (Takulandirani).`;

    case 'revenue_specialist':
      return `SWARM ROLE: REVENUE & RATE OPTIMIZER SPECIALIST (ULENDO SWARM)
You are the expert Revenue & Pricing Sub-Agent. Your mission is to maximize occupancy and revenue for Malawian properties while honoring dual-currency standards.
Key Guidelines:
1. Dual Currency Rules:
   - USD: Standard for international travellers ($35–$60 budget, $70–$180 boutique chalets, $200–$600+ luxury safari).
   - MWK (Malawian Kwacha): Standard for residents and domestic guests (~1,750 MWK / USD), cleanly rounded to the nearest 1,000 MWK (e.g. MK 95,000, not MK 94,832).
2. Rate Audits: show each room as a compact line (**Room** · USD · MWK · max guests · extra guest fee) or a table of at most 3 columns (| Room | USD / MWK | Guests |).
3. Actions: When the host asks to change a room price or run a discount, emit the exact \`\`\`action_proposal block with type: "update_room_price".`;

    case 'operations_specialist':
      return `SWARM ROLE: OPERATIONS & AMENITIES SPECIALIST (ULENDO SWARM)
You are the expert Property Operations & Infrastructure Sub-Agent. Your mission is to assist hosts with vital utilities, amenities, daily boards, dining menus, and operational status.
Key Guidelines:
1. Malawi Infrastructure Essentials:
   - 24/7 Solar Power & Inverter/Generator backup is the #1 guest satisfaction factor in Malawi.
   - Borehole / purified water, solar geyser hot water, and draped box mosquito nets are critical.
2. Amenities & Policies:
   - When asked to add or remove an amenity (e.g. Breakfast, Solar Backup, Wi-Fi), emit an \`\`\`action_proposal block with type: "add_amenity" or "remove_amenity".
   - When asked to change online status or out-of-office message, emit an \`\`\`action_proposal block with type: "update_property_online".
   - When asked to update the daily board or restaurant dish, emit an \`\`\`action_proposal block with type: "update_daily_board" or "add_restaurant_dish".`;

    case 'tourism_concierge':
      return `SWARM ROLE: MALAWI DESTINATION CONCIERGE SPECIALIST (ULENDO SWARM)
You are the authentic Malawi Tourism & Excursions Concierge Sub-Agent. Your mission is to inspire guests and advise lodge hosts on local Malawian activities and logistics.
Key Guidelines:
1. Deep Regional Grounding:
   - Lake Malawi: Cape Maclear (Chembe, Otter Point kayak, Mumbo Island), Mangochi resort strip, Senga Bay (Salima), Nkhata Bay (cliff jumping, Chikale beach), Likoma Island (St. Peter's Cathedral, Kaya Mawa).
   - Wildlife & Parks: Liwonde National Park (Shire River boat safaris, elephants), Majete Wildlife Reserve (Big 5 success story), Nyika National Park (high-altitude rolling grasslands, leopards, roan antelope).
   - Mountains: Mount Mulanje (Sapitwa peak, cedar huts), Zomba Plateau (Emperor's View, trout ponds).
2. Culinary Culture: Fresh Lake Chambo, Kampango fillets, traditional Nsima with pumpkin leaves (ndiwo) or fresh tomato relish.
3. Road Guidance: Practical insights on M1 tarmac conditions, lakeshore road, and 4x4 necessity during the rainy season.`;

    case 'swarm_coordinator':
    default:
      return `SWARM ROLE: ULENDO SWARM COORDINATOR
You are Ulendo Swarm Coordinator. You assess the host's overall situation, greet them with authentic Warm Heart of Africa warmth, enforce 100% capacity adaptive personality mirroring, and orchestrate the specialized concierge swarm.`;
  }
}

/**
 * Used only when no AI provider can answer. It never makes conversation: it
 * says the AI service is unavailable and, when the question maps directly to
 * data already in context, shows that data plainly.
 */
export function executeDeterministicSwarmReply(
  req: OperationsAssistantRequest,
  _forcedAgent?: SwarmAgentId,
  reason?: string
): OperationsAssistantResult {
  const data = liveDataAnswer(req);
  const notice = `_Ulendo couldn't reach the AI service${reason ? ` (${reason})` : ''}._`;
  return {
    reply: data ? `${notice}\n\n${data}` : `${notice} Please try again in a moment.`,
    provider: 'local' as AIProviderId,
    model: 'live-data',
    actionProposal: null,
    newLearnedRule: null,
    autonomousPatch: null,
    suggestedFollowUps: [],
  };
}

type PropertyCtx = OperationsAssistantRequest['context']['properties'][number];
type BookingCtx = OperationsAssistantRequest['context']['bookings'][number];

function money(usd?: number, mwk?: number): string {
  return [usd !== undefined ? `$${usd}` : '', mwk !== undefined ? `MK ${mwk.toLocaleString()}` : ''].filter(Boolean).join(' / ') || 'not set';
}

function bookingRow(b: BookingCtx): string {
  return `• **${b.guestName}** · ${b.hotelName} · ${b.roomName || 'Room'} · ${b.checkIn} → ${b.checkOut} · ${b.status}`;
}

function ownership(p: PropertyCtx, isAdmin: boolean): string {
  const hasManager = Boolean(p.managerId && !['N/A', 'unassigned', 'none'].includes(p.managerId));
  return [
    `**${p.name}**`,
    `• Owner: ${p.ownerName ? `${p.ownerName}${p.ownerEmail ? ` · ${p.ownerEmail}` : ''}${p.ownerPhone ? ` · ${p.ownerPhone}` : ''}` : 'not recorded'}`,
    isAdmin
      ? `• Manager: ${hasManager ? `${p.managerName || 'assigned'}${p.managerEmail ? ` · ${p.managerEmail}` : ''}${p.managerPhone ? ` · ${p.managerPhone}` : ''}` : 'none assigned'}`
      : '• Manager: you',
    `• Front desk: ${[p.contactEmail, p.contactPhone, p.contactWhatsapp].filter(Boolean).join(' · ') || 'not recorded'}`,
  ].join('\n');
}

/** Maps a question straight onto data in context. Returns null when it needs the AI. */
function liveDataAnswer(req: OperationsAssistantRequest): string | null {
  const lower = (req.message || '').toLowerCase();
  const isAdmin = req.userRole === 'admin';
  const all = req.context.properties || [];
  const mentionedIds = findMentionedPropertyIds(lower, all);
  const properties = mentionedIds.size ? all.filter(p => mentionedIds.has(p.id)) : all;
  const today = req.context.currentDateStr;
  const live = (req.context.bookings || []).filter(b => b.status !== 'cancelled' && b.status !== 'rejected'
    && (!mentionedIds.size || mentionedIds.has(b.hotelId)));

  if (/\b(arrival|arrivals|arriving|check-?ins?)\b/.test(lower)) {
    const rows = live.filter(b => b.checkIn === today);
    return rows.length ? `Arrivals today (${today}):\n${rows.map(bookingRow).join('\n')}` : `No arrivals today (${today}).`;
  }
  if (/\b(departure|departures|departing|check-?outs?)\b/.test(lower)) {
    const rows = live.filter(b => b.checkOut === today);
    return rows.length ? `Check-outs today (${today}):\n${rows.map(bookingRow).join('\n')}` : `No check-outs today (${today}).`;
  }
  if (mentionedIds.size && /\b(own|owns|owner|owned|manag\w*|runs?|contact|phone|email|whatsapp|who)\b/.test(lower)) {
    return properties.slice(0, 5).map(p => ownership(p, isAdmin)).join('\n\n');
  }
  if (/\b(rates?|prices?|pricing|rooms?)\b/.test(lower)) {
    const blocks = properties.slice(0, 10).map(p => `**${p.name}**\n${(p.rooms || []).map(r => `• ${r.name}: ${money(r.priceUSD, r.priceMWK)}`).join('\n') || '• no rooms set up'}`);
    return blocks.length ? blocks.join('\n\n') : null;
  }
  if (/\b(wi-?fi|password|power|water|internet)\b/.test(lower) && mentionedIds.size) {
    return properties.slice(0, 5).map(p => {
      const inf = p.infrastructure || {};
      return `**${p.name}**\n• Wi-Fi: ${inf.wifiSSID ? `${inf.wifiSSID}${inf.wifiPassword ? ` (password: ${inf.wifiPassword})` : ''}` : 'not set'}\n• Power: ${inf.powerSource || 'not set'}\n• Water: ${inf.waterSource || 'not set'}`;
    }).join('\n\n');
  }
  if (/\b(how many|list|which|all|my)\b.*\b(propert(y|ies)|stays|lodges|hotels|listings)\b/.test(lower)) {
    return all.length
      ? `${isAdmin ? 'Properties on the platform' : 'Your properties'} (${all.length}):\n${all.slice(0, 25).map(p => `• **${p.name}**${p.location ? ` · ${p.location}` : ''} · ${p.status || 'active'}`).join('\n')}`
      : (isAdmin ? 'No properties on the platform yet.' : 'No properties set up yet.');
  }
  if (/\b(onboard|list property|list my property|how to list|create listing|add new lodge|register lodge)\b/.test(lower)) {
    return `**Effortless Host Onboarding**\nListing takes ~3 minutes with 0% host commission, direct WhatsApp guest messaging, and instant browser auto-save.\n• [Start Listing Your Property](/list-your-property)\n• [Host Starter Pack & Field Guide](/host-guide)\n• [How Hosting Works](/how-hosting-works)`;
  }
  if (/\b(marketing|starter pack|field guide|field onboarding|pitch deck|prospect)\b/.test(lower)) {
    return `**Marketing & Host Acquisition**\nEmpower your field acquisition with these live tools:\n• [Host Starter Pack & Field Guide](/host-guide) (0% commission, 4 winning photo angles, WhatsApp templates)\n• [Marketing Presentation & Deck](/marketing)\n• [Pending Properties Review Queue](/admin?tab=properties)`;
  }
  return null;
}
