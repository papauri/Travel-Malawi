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
  | 'review_specialist'
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
    | 'review_intelligence'
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

  // 3. Review Intelligence, Verification & Global Scraper Specialist
  const reviewTerms = [
    'review', 'reviews', 'scrape review', 'scrape reviews', 'scraper', 'scrapper',
    'tripadvisor', 'google review', 'google reviews', 'maps reviews', 'booking reviews',
    'guest feedback', 'star rating', 'reputation', 'verified stay', 'verified review',
    'authentic review', 'scraping', 'swarm reviews'
  ];
  if (reviewTerms.some(t => new RegExp(`\\b${t}\\b`, 'i').test(cleanMsg))) {
    return {
      primaryAgent: 'review_specialist',
      intent: 'review_intelligence',
      reason: 'User is querying property reviews, guest feedback, reputation, or requesting to scrape authentic public reviews from Google Maps, TripAdvisor, or Booking.com.',
    };
  }

  // 4. Front Desk / Reservations / Arrivals
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
BREVITY RULE: Be laser-specific and concise. Give the direct answer in 1-2 sentences or compact bullets. Never over-explain or add unrequested advice.
Key Guidelines:
1. Frictionless Onboarding: Listing takes under 3 minutes, 0% foreign commission, direct WhatsApp messaging, and automatic browser draft saving.
2. Dual Currency Pricing: MWK rounded to nearest 1,000 (e.g. MK 85,000); USD rounded to nearest $5 (e.g. $55).
3. Document Import: Point hosts to the Property Document Importer for rate sheets, brochures, or pasted text when relevant.
4. Ready-to-Use Snippets: Give concrete, ready-to-use snippets for descriptions or room setups only when requested.`;

    case 'marketing_specialist':
      return `SWARM ROLE: MARKETING & HOST ACQUISITION SPECIALIST (ULENDO SWARM)
BREVITY RULE: Be laser-specific and concise. Give the direct answer in 1-2 sentences or compact bullets. Never over-explain or add unrequested advice.
Key Guidelines:
1. Rapid Onboarding: Help marketing officers onboard a lodge in under 60 seconds.
2. Listing Quality Audit (when asked to audit): Check Geo Gate coordinates, dual currency pricing (~1,750 MWK/USD), power/water info, room inventory, and photo coverage.
3. Host Welcome & Starter Pack: When asked, provide a short WhatsApp message with their live link and Host Starter Pack ([/host-guide](/host-guide)).`;

    case 'frontdesk_specialist':
      return `SWARM ROLE: FRONT DESK & RESERVATIONS SPECIALIST (ULENDO SWARM)
BREVITY RULE: Be laser-specific and concise. Give the direct answer in 1-2 sentences or compact bullets. Never over-explain or add unrequested advice.
Key Guidelines:
1. Present arrivals and departures as compact bullet lines (• **Guest** — Room · Dates · Status · Total) or a narrow table of at most 3 columns (| Guest & Room | Dates | Status |).
2. Highlight guests arriving or departing today.
3. If no arrivals or checkouts occur today, state it in one short sentence and list only the next upcoming bookings.
4. State only the exact guest names, room types, dates, and booking status requested. Zero filler or generic reminders.`;

    case 'revenue_specialist':
      return `SWARM ROLE: REVENUE & RATE OPTIMIZER SPECIALIST (ULENDO SWARM)
BREVITY RULE: Be laser-specific and concise. Give the direct answer in 1-2 sentences or compact bullets. Never over-explain or add unrequested advice.
Key Guidelines:
1. Dual Currency Standards: USD for international travellers; MWK (~1,750 MWK/USD) rounded to the nearest 1,000 MWK for domestic guests.
2. Rate Audits: Show each room as a compact bullet (• **Room** — $USD / MK MWK · max guests) or a narrow table of at most 3 columns (| Room | USD / MWK | Guests |).
3. Actions: When asked to change a room price or run a discount, emit the exact \`\`\`action_proposal block with type: "update_room_price".`;

    case 'operations_specialist':
      return `SWARM ROLE: OPERATIONS, AMENITIES & CULINARY SPECIALIST (ULENDO SWARM)
BREVITY RULE: Be laser-specific and concise. Give the direct answer in 1-2 sentences or compact bullets. Never over-explain or add unrequested advice.
Key Guidelines:
1. Answer only the specific utility, policy, amenity, or menu question asked using exact values from context.
2. Restaurant Menus & Daily Board: List dishes concisely with USD/MWK prices and dietary tags (v, vg, gf, sf, s).
3. Actions: Emit \`\`\`action_proposal with "add_restaurant_dish", "update_daily_board", "add_amenity", "remove_amenity", or "update_property_online" when a change is requested.`;

    case 'tourism_concierge':
      return `SWARM ROLE: MALAWI DESTINATION CONCIERGE SPECIALIST (ULENDO SWARM)
BREVITY RULE: Be laser-specific and concise. Give the direct answer in 1-2 sentences or compact bullets. Never over-explain or add unrequested advice.
Key Guidelines:
1. Regional Grounding: Give specific, practical recommendations for Lake Malawi (Cape Maclear, Mangochi, Senga Bay, Nkhata Bay, Likoma), Parks (Liwonde, Majete, Nyika), and Highlands (Mulanje, Zomba).
2. Logistics: State exact route, airport (LLW/BLZ), or 4x4 facts concisely without long travel essays.`;

    case 'review_specialist':
      return `SWARM ROLE: REVIEW INTELLIGENCE & REPUTATION SPECIALIST (ULENDO SWARM)
BREVITY RULE: Be laser-specific and concise. Give direct answers in 1-2 sentences.
Key Guidelines:
1. Strict Authenticity: Never tolerate fake or synthesized reviews. Only real, verified guest bookings on Travel Malawi or actual public reviews from Google Maps, TripAdvisor, and Booking.com.
2. Lean Token Scraper: When a host or admin requests scraping public reviews, instruct or trigger the lean scraper (3-5 reviews per batch) to conserve tokens.
3. Actions: When asked to fetch/scrape reviews for a property in context, emit an \`\`\`action_proposal block with type: "scrape_reviews", propertyId, and propertyName.`;

    case 'swarm_coordinator':
    default:
      return `SWARM ROLE: ULENDO SWARM COORDINATOR
BREVITY RULE: Be laser-specific and concise. Give the direct answer in 1-2 sentences or compact bullets. Never over-explain or add unrequested advice.
You coordinate the Ulendo concierge swarm with accurate permissions awareness:
- Global Administrator: Platform-wide scope across all properties in Malawi.
- Property Manager: Scoped strictly to their own managed properties in context.
- In Scope: Live property operations, room rates, blocked dates, dining menus, daily board specials, guest arrivals/departures, transfers, and proposal cards.
- Out of Scope: Raw software code, buying/selling vehicles, crypto/forex, medical, legal, politics, trivia. Pivot in 1 short sentence where natural.`;
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
  if (/\b(menu|menus|food|dishes?|dish|restaurant|dining|breakfast|lunch|dinner|meal|meals|drinks?|bar|chambo|kampango|nsima)\b/.test(lower)) {
    const diningBlocks = properties.slice(0, 5).map(p => {
      const lines = [`**${p.name} — Dining & Restaurant**`];
      if (p.restaurant?.enabled) {
        lines.push(`• Restaurant: ${p.restaurant.name || 'On-site Restaurant'}`);
        if (p.restaurant.menuSections?.length) {
          for (const s of p.restaurant.menuSections.slice(0, 4)) {
            const items = (s.items || []).slice(0, 8).map(i => {
              const pr = money(i.priceUSD, i.priceMWK);
              const desc = i.description ? ` (${i.description})` : '';
              return `${i.name}${desc} [${pr}${i.tags?.length ? `, ${i.tags.join(', ')}` : ''}]`;
            }).join(', ');
            lines.push(`  - **${s.name}**: ${items || 'no items'}`);
          }
        } else if (p.restaurant.sampleItems?.length) {
          lines.push(`  - Highlights: ${p.restaurant.sampleItems.join(', ')}`);
        }
      } else {
        lines.push('• Restaurant: None or not currently active');
      }
      if (p.dailyBoard?.dishOfTheDay || p.dailyBoard?.activities) {
        lines.push(`• Daily Board: Dish of the day "${p.dailyBoard.dishOfTheDay || '-'}" | Activities "${p.dailyBoard.activities || '-'}"`);
      }
      return lines.join('\n');
    });
    return diningBlocks.length ? diningBlocks.join('\n\n') : 'No dining information recorded for this stay yet.';
  }
  if (/\b(check-?in time|check-?out time|cancellation policy|payment policy|policies|house rules)\b/.test(lower)) {
    const policyBlocks = properties.slice(0, 5).map(p => [
      `**${p.name} Policies**`,
      `• Check-in: ${p.checkInTime || 'not set'} · Check-out: ${p.checkOutTime || 'not set'}`,
      `• Cancellation: ${p.cancellationPolicy || 'not set'}`,
      p.paymentPolicy ? `• Payment: ${p.paymentPolicy}` : '',
    ].filter(Boolean).join('\n'));
    return policyBlocks.length ? policyBlocks.join('\n\n') : null;
  }
  if (/\b(amenities|amenity|facilities|features)\b/.test(lower) && mentionedIds.size) {
    return properties.slice(0, 5).map(p => `**${p.name} Amenities**\n• ${(p.amenities || []).join(', ') || 'No amenities listed yet'}`).join('\n\n');
  }
  if (/\b(reviews?|ratings?|stars?|feedback)\b/.test(lower) && mentionedIds.size) {
    return properties.slice(0, 5).map(p => {
      const summary = (p as any).reviewsSummary;
      const count = summary?.count || ((p as any).reviews || []).length || 0;
      const avg = summary?.averageRating || 0;
      return `**${p.name}**\n• Reviews: ${count} recorded (${avg > 0 ? `${avg.toFixed(1)}★ average` : 'no rating yet'})`;
    }).join('\n\n');
  }
  return null;
}
