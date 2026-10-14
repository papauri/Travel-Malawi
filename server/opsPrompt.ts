import type { OperationsAssistantRequest } from './aiService';
import { getSpecialistAgentPrompt, type SwarmAgentId } from './aiSwarm';
import {
  MAX_HISTORY_ITEM_CHARS,
  MAX_LEARNED_RULES,
  MAX_LEARNED_RULE_CHARS,
  MAX_MESSAGE_CHARS,
  MAX_PROPERTIES_SUMMARY_CHARS,
  UNTRUSTED_DATA_RULE,
  capLearnedRules,
  clip,
  untrusted,
} from './promptUtils';
import { findMentionedPropertyIds } from '../src/lib/queryIntent';

/**
 * Prompt builder for the Ulendo operations concierge.
 *
 * Token budget strategy:
 * - A compact core system prompt, plus optional modules (action proposal
 *   schemas, Malawi destination knowledge) only when the message needs them.
 * - Property context is routed: only the sections the question touches are
 *   included, and only the properties it names get full detail.
 * - Stable content comes first and volatile content (time, history, message)
 *   last, so provider prefix caching can reuse the bulk of the prompt.
 */

const OPS_CORE_PROMPT = `You are Ulendo (Chichewa for "journey"), the resident hospitality concierge for Travel Malawi, the Warm Heart of Africa. You work beside lodge managers and platform admins and have their live properties, rooms, rates, bookings, menus and operations in the context below.

SCOPE
- In scope: Malawi tourism and travel; the Travel Malawi platform (properties, rooms, rates, bookings, menus, policies, amenities, StayOS, reviews); guest logistics (airport transfers LLW/BLZ, lodge shuttles, 4x4 hire with driver, boat transfers, guides).
- Out of scope: code or software, buying/selling vehicles, crypto/trading/finance, shopping, medical, legal, politics, homework, trivia. Never do these. Say in 1-2 friendly sentences it is outside your domain, then pivot where natural (car purchase -> shuttles or 4x4 hire with driver; coding -> managing their properties on Travel Malawi; flights/visas -> airport transfers). Never lecture.

STYLE
- Mirror the user's tone fully: formal -> polished; casual or emoji -> casual; rushed -> ultra brief bullets, no pleasantries. Follow learned rules and habits below.
- Answer immediately and completely from the context. Never say "let me pull that up", "I'll check", "give me a second", and never stop halfway: you already have the data.
- Small talk -> 1-2 warm sentences, no data dumps or status checks. Questions and tasks -> the exact answer in the first sentence, then compact detail.
- No "Moni" or Chichewa unless the user uses it first. In an ongoing conversation don't open with a greeting. Don't repeat the user's name; never use their email username or a role title. Say "you", "your lodge".
- No essays or theory unless asked. Use bold labels and bullets. Tables: max 3 columns, one row per line (chat is phone-sized).
- Never invent facts. If something is not in the context, say so in one line and where to set it.
- Money: MWK rounded to the nearest 1,000 (e.g. MK 85,000), USD whole dollars.

PERMISSIONS
- Global admin: platform-wide; can approve/reject listings, feature on the homepage, manage users, change any property.
- Property manager: only their own properties in context (rates, rooms, blocked dates, policies, menus, daily board, amenities, booking status). Cannot change stay type, category or legal owner; cannot see or change other properties, approve or feature listings, touch other users' credentials, or platform settings. Refuse firmly and politely, naming their properties and that it needs Global Administrator privileges.
- Every property in context belongs to the signed-in user even with no manager assigned, and is live on the site. Never claim there are no properties when some are listed. For ownership or contact questions give the name, email, phone and WhatsApp from context.

UNCLEAR REQUESTS (be smart, not literal)
- Read the conversation history first: short replies ("the boat house one", "yes", "June") usually answer your last question.
- Typos, nicknames and partial names: match them to the closest property, room or guest in context and say which one you used ("Taking 'esters' as Esthers Guest House").
- If one reading is clearly most likely, answer it and state the assumption in a few words. Ask only when the answer would differ materially (several properties or rooms fit, dates are missing for a booking question, a change has no target or value).
- When you ask, ask ONE short, specific question and offer the real options from the context, e.g. "Which one: Esthers Guest House or Kaya Mawa?". Put those options in suggested_follow_ups so the user can tap one. Never ask something the context already answers.
- If a request is vague ("help with my lodge", "something about rates"), give the 2-3 most useful things you can do with their actual data and ask which they want.
- Never emit an action_proposal until the target and value are clear.

CHANGES
- Never say a change has been made: it applies only when the user clicks Confirm & Apply on a proposal card.
- Advice or what-if questions: analyse, then offer to prepare a proposal.
- Direct instructions: state the property/room, current -> new value and the effect, then ask them to review and click **Confirm & Apply**.

LINKS (replace <hotelId>)
Bookings/arrivals: [Open Bookings](/dashboard/hotel/<hotelId>?tab=bookings) or [My Bookings](/my-bookings). Same path with ?tab=rooms (rooms & rates), ?tab=details (policies), ?tab=restaurant, ?tab=inquiries, ?tab=broadcasts, ?tab=stayos (voucher/Wi-Fi settings only, never for bookings). Admin: [Platform Properties](/admin?tab=properties), [Manage Users](/admin?tab=users).

MEMORY (only when it applies)
- The user states a policy, preference or habit ("checkout is 10am", "be brief", "show MWK first"): emit
\`\`\`learned_rule
{"rule": "<permanent rule>"}
\`\`\`
- The user corrects you: acknowledge without excuses, give the corrected answer, and also emit
\`\`\`autonomous_patch
{"trigger": "<their correction>", "patch": "<rule preventing a repeat>", "resolution": "<how you adapted>"}
\`\`\`

END EVERY REPLY with 2-3 short next steps (3-6 words, no emojis, hospitality only). When you asked a clarifying question, make them the answer options instead:
\`\`\`suggested_follow_ups
["Review pending bookings", "Audit room rates"]
\`\`\``;

const ACTIONS_MODULE = `ACTION PROPOSALS: after explaining a requested change, append one block:
\`\`\`action_proposal
{"type": "<type>", "hotelId": "<id>", "hotelName": "<name>", "<field>": "<value>"}
\`\`\`
Types and their fields:
- add_amenity / remove_amenity: amenity. update_amenities: amenities[]
- update_room_price: roomId, roomName, oldPrice, newPrice, currency ("USD" | "MWK")
- update_property_online: isOnline, outOfOfficeMessage (optional)
- update_property_policy: policyField (checkInTime | checkOutTime | cancellationPolicy | paymentPolicy | contactWhatsapp | mealPolicy | breakfastPolicy), policyValue
- update_daily_board: dishOfTheDay, activities
- add_restaurant_dish: dishSection, dishName, dishDescription, dishPriceUSD, dishPriceMWK
- update_booking_status: bookingId, bookingRef, oldStatus, newStatus ("confirmed" | "cancelled")
- apply_promotion: promotionName, discountPercentage, startDate, endDate (YYYY-MM-DD)
- Admin only: update_property_status (oldStatus, newStatus "approved" | "rejected" | "pending"); toggle_featured (featured)
For several or all properties: list every id in "hotelIds" and name in "hotelNames", set "targetScope": "all" (or "single"), and say how many properties are targeted.`;

const MALAWI_KNOWLEDGE_MODULE = `MALAWI INSIDER KNOWLEDGE (use for guest and travel advice):
- Lake Malawi: Cape Maclear (Thumbi West snorkelling, Otter Point, mbuna cichlids, sunset dhows), Monkey Bay, Senga Bay (Salima), Nkhata Bay (cliff jumping, Chikale beach), Likoma (St Peter's Cathedral), Chizumulu, Mangochi.
- Wildlife: Majete (Big 5), Liwonde (Shire River boat safaris, elephants, hippos, rhino, cheetah), Nyika (montane grassland, roan, leopard), Nkhotakota (Bua River canoeing), Kasungu, Vwaza Marsh.
- Highlands: Mulanje (Likhubula, Sapitwa 3,002 m), Zomba Plateau (Emperor's View, Chingwe's Hole, trout), Dedza (rock art, pottery).
- Food: grilled Chambo, Kampango, Usipa, Mpasa, nsima with ndiwo, Mzuzu coffee, Satemwa tea, Malawi Gin, Kuche Kuche.
- Logistics: LLW and BLZ airports, M1/M3/M5 tarmac, 4x4 for rainy season (Dec-Apr) park roads, daylight driving, Ilala ferry, Airtel/TNM SIMs, Airtel Money and TNM Mpamba, ESCOM load-shedding and solar backup.
- Revenue: USD for international guests, MWK for residents and conferences (~1,750 MWK per USD); peak at Easter, Lake of Stars and Christmas, discount in green season.`;

/** Context sections a message can need. */
type ContextTopic =
  | 'rooms' | 'bookings' | 'dining' | 'infra' | 'crew' | 'reviews'
  | 'conferences' | 'broadcasts' | 'contacts' | 'location' | 'policies' | 'promotions';

const TOPIC_PATTERNS: Record<ContextTopic, RegExp> = {
  rooms: /\b(rooms?|rates?|price|prices|pricing|cost|charge|tariff|package|packages|chalet|suite|tent|units?|inventory|blocked|capacity|occupancy|availability|available|revenue|yield|discount|mwk|usd|kwacha|dollars?)\b/i,
  bookings: /\b(bookings?|reservations?|arrivals?|arriving|departures?|departing|check-?ins?|check-?outs?|in-house|staying|guests?|occupancy|revenue|performance|calendar|today|tomorrow|tonight|weekend|pending|confirmed|cancel\w*|ref)\b/i,
  dining: /\b(restaurant|menu|menus|dish|dishes|food|meal|meals|breakfast|lunch|dinner|bar|drinks?|cuisine|chef|daily board|special)\b/i,
  infra: /\b(power|solar|generator|inverter|escom|water|borehole|internet|wi-?fi|wireless|password|ssid|starlink|road|access|electricity)\b/i,
  crew: /\b(staff|crew|team|employees?|caretaker|captain|guide|chef|housekeep\w*)\b/i,
  reviews: /\b(reviews?|ratings?|stars?|feedback|sentiment|complain\w*|testimonials?)\b/i,
  conferences: /\b(conferences?|meetings?|events?|banquet\w*|halls?|delegates?|boardroom|workshop)\b/i,
  broadcasts: /\b(broadcasts?|notices?|announcements?|alerts?)\b/i,
  contacts: /\b(contact|phone|email|whatsapp|call|manager|owner|owns|who runs|reach)\b/i,
  location: /\b(location|directions?|gps|coordinates|map|where|address|get there|arrival notes)\b/i,
  policies: /\b(polic(y|ies)|cancellation|deposit|payment|check-?in time|check-?out time|rules?|online|offline|status|featured|verified|approved|listing)\b/i,
  promotions: /\b(promo\w*|discounts?|offers?|deals?|sale)\b/i,
};

/** Broad questions ("audit everything", "how are we doing") get the full context. */
const BROAD_REQUEST = /\b(audit|overview|summary|summari[sz]e|everything|report|all details|full details|compare|comparison|analy[sz]e|analysis|health|how are we doing|how is business|performance|status check|tell me about)\b/i;

const CHANGE_REQUEST = /\b(add|remove|delete|update|change|set|apply|make|put|turn|switch|raise|lower|increase|decrease|drop|reduce|confirm|cancel|approve|reject|feature|unfeature|publish|create|enable|disable|go ahead|do it|yes|yep|proceed|offline|online)\b/i;
const TOURISM_REQUEST = /\b(tour|tourism|excursions?|activit(y|ies)|safari|game drive|itinerar\w*|things to do|recommend|visit|trip|travel|route|drive|driving|road|roads|transfer|shuttle|airport|boat|snorkel\w*|div(e|ing)|hike|hiking|lake|mulanje|zomba|liwonde|majete|nyika|cape maclear|likoma|nkhata|senga|mangochi|chambo|nsima|culture|weather|season|guests? (ask|want)|festival|revenue strategy|peak)\b/i;

type PropertyContext = OperationsAssistantRequest['context']['properties'][number];

function detectTopics(text: string): Set<ContextTopic> {
  const topics = new Set<ContextTopic>();
  for (const [topic, pattern] of Object.entries(TOPIC_PATTERNS) as Array<[ContextTopic, RegExp]>) {
    if (pattern.test(text)) topics.add(topic);
  }
  return topics;
}

function roomLine(r: NonNullable<PropertyContext['rooms']>[number], withDetail: boolean): string {
  const rates = [r.priceUSD !== undefined ? `$${r.priceUSD}` : '', r.priceMWK !== undefined ? `MWK ${r.priceMWK.toLocaleString()}` : '']
    .filter(Boolean).join(' / ') || 'rate not set';
  const extra = r.extraGuestFeeUSD ? ` | extra guest $${r.extraGuestFeeUSD}` : (r.extraGuestFeeMWK ? ` | extra guest MWK ${r.extraGuestFeeMWK.toLocaleString()}` : '');
  const blocked = r.blockedDates?.length ? ` | blocked: ${r.blockedDates.slice(0, 12).join(', ')}${r.blockedDates.length > 12 ? '…' : ''}` : '';
  const packages = r.packages?.length
    ? ` | packages: ${r.packages.map(pkg => `"${pkg.name}" ($${pkg.priceUSD ?? '-'}/MWK ${pkg.priceMWK?.toLocaleString() ?? '-'})`).join(', ')}`
    : '';
  const detail = withDetail
    ? `${r.amenities?.length ? ` | amenities: ${r.amenities.join(', ')}` : ''}${r.description ? ` | info: ${untrusted('room_description', r.description, 120)}` : ''}`
    : '';
  return `    - Room "${r.name}" (ID ${r.id}): ${rates}${extra} | max ${r.maxGuests || 2} guests | ${r.quantity || 1} units${blocked}${packages}${detail}`;
}

/** Full property block with only the requested sections. */
function propertyBlock(p: PropertyContext, topics: Set<ContextTopic>, all: boolean, isAdminUser: boolean, displayName: string): string {
  const want = (t: ContextTopic) => all || topics.has(t);
  const lines: string[] = [];

  const stayType = p.stayType === 'entire_place'
    ? `Entire place (${p.entirePlaceDetails?.propertyType || 'whole property'}, ${p.entirePlaceDetails?.bedrooms || 1} bed, ${p.entirePlaceDetails?.bathrooms || 1} bath, max ${p.entirePlaceDetails?.maxGuests || 2}, $${p.entirePlaceDetails?.ratePerNightUsd ?? '-'}/MWK ${p.entirePlaceDetails?.ratePerNightMwk?.toLocaleString() ?? '-'} per night)`
    : 'Room-by-room';
  lines.push(`• "${p.name}" (ID ${p.id}) | ${p.category || 'Lodge'} | ${p.location || 'Malawi'} | ${stayType} | listing ${p.status || 'active'}, ${p.verificationStatus || 'unverified'}${p.featured ? ', featured' : ''} | front desk ${p.isOnline !== false ? 'online' : `offline ("${clip(p.outOfOfficeMessage, 120) || 'Away'}")`}`);

  if (want('contacts')) {
    const hasManager = Boolean(p.managerId && !['N/A', 'unassigned'].includes(p.managerId) && p.managerId.trim());
    const owner = p.ownerName ? ` | owner "${p.ownerName}" (${p.ownerEmail || 'no email'}, ${p.ownerPhone || 'no phone'})` : '';
    if (isAdminUser) {
      lines.push(hasManager
        ? `    - Manager: "${p.managerName || 'Assigned host'}" | ${p.managerEmail || p.contactEmail || 'no email'} | ${p.managerPhone || p.contactPhone || 'no phone'} | WhatsApp ${p.contactWhatsapp || p.managerPhone || '-'}${owner}`
        : `    - Manager: none assigned (self-hosted)${owner}`);
    } else {
      lines.push(`    - Belongs to the signed-in host (${displayName || 'you'})${hasManager && p.managerName ? `, manager "${p.managerName}"` : ''}${owner}`);
    }
    lines.push(`    - Front desk: ${p.contactEmail || p.managerEmail || 'no email'} | ${p.contactPhone || p.contactWhatsapp || 'no phone'} | WhatsApp ${p.contactWhatsapp || '-'}`);
  }
  if (want('crew') && p.crew?.length) {
    lines.push(`    - Crew: ${p.crew.slice(0, 10).map(c => `${clip(c.name, 60)} (${clip(c.role, 40)})`).join(', ')}`);
  }
  if (want('policies')) {
    lines.push(`    - Policies: check-in ${p.checkInTime || '14:00'}, check-out ${p.checkOutTime || '10:00'} | cancellation "${clip(p.cancellationPolicy, 200) || 'Standard'}"${p.paymentPolicy ? ` | payment "${clip(p.paymentPolicy, 200)}"` : ''}`);
  }
  if (want('infra') && p.infrastructure) {
    const inf = p.infrastructure;
    const wifi = inf.wifiSSID ? ` | Wi-Fi "${inf.wifiSSID}" (password "${inf.wifiPassword || 'ask at desk'}")` : '';
    lines.push(`    - Utilities: power ${inf.powerSource || 'grid + backup'}${inf.powerNotes ? ` (${clip(inf.powerNotes, 100)})` : ''} | water ${inf.waterSource || '-'} | road ${inf.roadAccess || '-'} | internet ${inf.internetSource || '-'}${wifi}`);
  }
  if ((want('promotions') || want('rooms')) && p.promotions?.length) {
    lines.push(`    - Promotions: ${p.promotions.map(pr => `"${pr.name}" (${pr.discountPercentage}% off)`).join(', ')}`);
  }
  if (want('location')) {
    if (p.coordinates?.lat && p.coordinates?.lng) lines.push(`    - GPS: ${p.coordinates.lat}, ${p.coordinates.lng}`);
    if (p.locationNotes) lines.push(`    - Arrival notes: ${untrusted('location_notes', p.locationNotes, 300)}`);
  }
  if (all && p.description) lines.push(`    - About: ${untrusted('property_description', p.description, 180)}`);
  if (want('policies') || want('rooms') || all) {
    lines.push(`    - Amenities: ${(p.amenities || []).join(', ') || 'none listed'}`);
  }
  if (want('reviews') && p.reviewsSummary && p.reviewsSummary.count > 0) {
    const snippets = (p.reviewsSummary.recentReviews || [])
      .map(r => `${untrusted('guest_review', r.comment, 80)} (${r.rating}★, ${clip(r.author, 40)})`).join('; ');
    lines.push(`    - Reviews: ${p.reviewsSummary.averageRating}★ from ${p.reviewsSummary.count}${snippets ? ` | ${snippets}` : ''}`);
  }
  if (want('broadcasts') && p.activeBroadcasts?.length) {
    lines.push(`    - Live notices: ${p.activeBroadcasts.slice(0, 5).map(b => `[${String(b.type || '').toUpperCase()}] ${untrusted('broadcast', b.message, 200)}`).join(' | ')}`);
  }
  if (want('dining')) {
    if (!p.restaurant?.enabled) {
      lines.push('    - Restaurant: none or inactive');
    } else if (p.restaurant.menuSections?.length) {
      const menu = p.restaurant.menuSections.map(s => {
        const items = (s.items || []).slice(0, 12).map(i => {
          const price = [i.priceUSD !== undefined ? `$${i.priceUSD}` : '', i.priceMWK !== undefined ? `MWK ${i.priceMWK.toLocaleString()}` : ''].filter(Boolean).join('/');
          return `${i.name} [${price || 'unpriced'}${i.tags?.length ? `, ${i.tags.join(', ')}` : ''}]`;
        }).join(', ');
        return `${s.name}: ${items || 'no items'}`;
      }).join(' | ');
      lines.push(`    - Restaurant "${p.restaurant.name || 'Restaurant'}": ${menu}`);
    } else {
      lines.push(`    - Restaurant "${p.restaurant.name || 'Restaurant'}" (${p.restaurant.sectionsCount || 0} sections${p.restaurant.sampleItems?.length ? `, e.g. ${p.restaurant.sampleItems.join(', ')}` : ''})`);
    }
    if (p.dailyBoard?.dishOfTheDay || p.dailyBoard?.activities) {
      lines.push(`    - Daily board: dish "${p.dailyBoard.dishOfTheDay || '-'}", activities "${p.dailyBoard.activities || '-'}"`);
    }
  }
  if (want('conferences')) {
    lines.push(p.conferences?.length
      ? `    - Conference halls: ${p.conferences.map(c => `"${c.name}" (${c.capacity} pax, $${c.dayRateUSD || 0}/MWK ${c.dayRateMWK || 0} per day)`).join('; ')}`
      : '    - Conference halls: none');
    const confPolicies = [
      p.conferenceCancellationPolicy ? `cancellation "${clip(p.conferenceCancellationPolicy, 150)}"` : '',
      p.conferencePaymentPolicy ? `payment "${clip(p.conferencePaymentPolicy, 150)}"` : '',
      p.conferenceGuidelines ? `guidelines "${clip(p.conferenceGuidelines, 150)}"` : '',
    ].filter(Boolean).join(' | ');
    if (confPolicies) lines.push(`    - Conference policies: ${confPolicies}`);
  }
  if (want('rooms') || want('bookings')) {
    const rooms = p.rooms || [];
    lines.push(`    - Rooms (${rooms.length}):`);
    lines.push(rooms.length ? rooms.slice(0, 15).map(r => roomLine(r, all || want('rooms'))).join('\n') : '      (no rooms configured)');
  }
  return lines.join('\n');
}

/** One-line summary for properties outside the question's focus. */
function propertyOneLiner(p: PropertyContext): string {
  const rooms = p.rooms || [];
  const usd = rooms.map(r => r.priceUSD).filter((n): n is number => typeof n === 'number');
  const range = usd.length ? `, $${Math.min(...usd)}-${Math.max(...usd)}` : '';
  return `• "${p.name}" (ID ${p.id}) | ${p.location || 'Malawi'} | ${rooms.length} room types${range} | ${p.status || 'active'}${p.isOnline === false ? ', offline' : ''}`;
}

function bookingLine(b: OperationsAssistantRequest['context']['bookings'][number], withContact: boolean): string {
  const contact = withContact ? ` (${b.guestEmail || 'no email'}, ${b.guestPhone || 'no phone'})` : '';
  const requests = b.specialRequests ? ` | requests: ${untrusted('guest_special_request', b.specialRequests, 200)}` : '';
  return `  - ${b.reference || b.id} | ${b.guestName}${contact} | ${b.hotelName} / ${b.roomName || 'Room'} | ${b.checkIn} to ${b.checkOut} (${b.nights || 1}n, ${b.guests || 1}g) | ${b.status} | ${b.currency || 'USD'} ${b.total || 0}${requests}`;
}

export interface OperationsChatPrompts {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  thinkingBudget: number;
  isUserGreeting: boolean;
  effectiveDisplayName: string;
}

/**
 * Builds the system and user prompts for one operations chat turn, sized to
 * what the message actually needs.
 */
export function buildOperationsChatPrompts(
  req: OperationsAssistantRequest,
  resolvedDisplayName: string,
  agent: SwarmAgentId
): OperationsChatPrompts {
  const isAdminUser = req.userRole === 'admin';
  const today = req.context.currentDateStr;
  const history = req.history || [];
  const message = req.message || '';
  const lowerMsg = message.trim().toLowerCase();

  // Short follow-ups ("and the other lodge?", "yes do it") inherit the topic of the previous turns.
  const recentText = [message, ...history.slice(-2).map(h => h.content || '')].join('\n');
  const topics = detectTopics(recentText);
  const broad = BROAD_REQUEST.test(message) || topics.size === 0;

  const properties = (req.context.properties || []).slice(0, 40);
  const mentioned = findMentionedPropertyIds(recentText, properties);
  // With no property named, every property is in focus (up to a handful in full detail).
  const focusAll = mentioned.size === 0;

  const effectiveDisplayName = req.context.managerHabits?.preferredName || resolvedDisplayName;
  const propertyBlocks = properties.map(p =>
    focusAll || mentioned.has(p.id)
      ? propertyBlock(p, topics, broad, isAdminUser, effectiveDisplayName)
      : propertyOneLiner(p)
  ).join('\n');
  const propertiesSummary = propertyBlocks.length > MAX_PROPERTIES_SUMMARY_CHARS
    ? `${propertyBlocks.slice(0, MAX_PROPERTIES_SUMMARY_CHARS)}\n…(truncated; ask about a specific property for more)`
    : propertyBlocks;

  // Bookings relative to today; full lines only when the question is about bookings or performance.
  const active = (req.context.bookings || []).filter(b => b.status !== 'cancelled' && b.status !== 'rejected');
  const scoped = mentioned.size > 0 ? active.filter(b => mentioned.has(b.hotelId)) : active;
  const arrivals = scoped.filter(b => b.checkIn === today);
  const departures = scoped.filter(b => b.checkOut === today);
  const inHouse = scoped.filter(b => b.checkIn < today && b.checkOut > today);
  const upcoming = scoped.filter(b => b.checkIn > today).sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const wantBookings = broad || topics.has('bookings') || agent === 'frontdesk_specialist' || agent === 'revenue_specialist';
  const withContact = topics.has('contacts');
  const section = (label: string, list: typeof scoped, limit: number) =>
    `${label} (${list.length}):\n${list.length ? list.slice(0, limit).map(b => bookingLine(b, withContact)).join('\n') : '  (none)'}${list.length > limit ? `\n  …and ${list.length - limit} more` : ''}`;
  const bookingsSummary = wantBookings
    ? [section('Arriving today', arrivals, 15), section('Departing today', departures, 15), section('In-house', inHouse, 15), section('Upcoming', upcoming, 10)].join('\n')
    : `Arriving today ${arrivals.length}, departing today ${departures.length}, in-house ${inHouse.length}, upcoming ${upcoming.length} (details available on request).`;

  const rules = capLearnedRules(req.context.learnedRules);
  const patches = (req.context.autonomousPatches || []).slice(-MAX_LEARNED_RULES);
  const habits = req.context.managerHabits;
  const patchTexts = new Set(patches.map(p => clip(p.patch, MAX_LEARNED_RULE_CHARS)));
  const memoryLines = [
    // Patches are also saved as rules; list each one once.
    ...rules.filter(r => !patchTexts.has(r)).map(r => `- ${r}`),
    ...patches.map(p => `- [correction: ${clip(p.trigger, 120) || 'host feedback'}] ${clip(p.patch, MAX_LEARNED_RULE_CHARS)}`),
    ...(habits?.habits || []).slice(-MAX_LEARNED_RULES).map(h => `- [${h.category} habit] ${clip(h.text, MAX_LEARNED_RULE_CHARS)}`),
  ];

  // Response sizing: small talk and persona feedback stay short; analysis gets room.
  const strippedMsg = lowerMsg.replace(/[!.,?]/g, '').trim();
  const isGreetingWord = /^(hi|hello|hey|moni|muli\s+bwanji|good\s+(morning|afternoon|evening)|howdy|greetings|bo|sup|yo|morning|afternoon|evening)\b/i.test(strippedMsg);
  const isCasualPleasantry = /how are you|how r u|not too bad|doing well|all good|fine thanks/.test(lowerMsg);
  const isPersonaFeedback = /taking so long|taking ages|sound natural|learner|friend|habits|get to know/.test(lowerMsg);
  const isUserGreeting = isGreetingWord || isCasualPleasantry || req.intent === 'greeting_or_chat';
  const isAnalysis = /compare|audit|calculate|analytics|analy[sz]e|forecast|performance|report/.test(lowerMsg);
  const maxTokens = isUserGreeting || isPersonaFeedback ? 380 : isAnalysis ? 1400 : 900;
  const thinkingBudget = isAnalysis ? 256 : 0;

  // Modules are only sent when the message needs them.
  const lastAssistant = [...history].reverse().find(h => h.role === 'assistant')?.content || '';
  const needsActions = req.intent === 'database_action'
    || (CHANGE_REQUEST.test(message) && !isUserGreeting)
    || /confirm\s*&\s*apply|prepare (an )?(update )?proposal/i.test(lastAssistant);
  const needsKnowledge = agent === 'tourism_concierge' || req.intent === 'tourism_inquiry' || TOURISM_REQUEST.test(message);

  const systemPrompt = [
    OPS_CORE_PROMPT,
    getSpecialistAgentPrompt(agent),
    needsActions ? ACTIONS_MODULE : '',
    needsKnowledge ? MALAWI_KNOWLEDGE_MODULE : '',
    UNTRUSTED_DATA_RULE,
  ].filter(Boolean).join('\n\n');

  // Stable content first, volatile content (time, history, message) last for prefix caching.
  const userPrompt = `USER
- Role: ${isAdminUser ? 'Global administrator (all platform properties)' : 'Property manager (own properties only)'}
- Name: ${effectiveDisplayName || 'not set (use "you")'}
- Preferred currency: ${habits?.currencyPreference || 'MWK'} | Style: ${habits?.communicationStyle || 'casual_friendly'} | Familiarity: ${habits?.familiarityTier || 'Trusted Partner'}

LEARNED RULES, CORRECTIONS & HABITS:
${memoryLines.length ? memoryLines.join('\n') : '- none yet'}

PROPERTIES IN SCOPE (${req.context.properties.length}${mentioned.size ? `, ${mentioned.size} in focus` : ''}):
${propertiesSummary || (isAdminUser ? 'No properties registered on the platform yet.' : 'No properties in this host\'s scope.')}

BOOKINGS (today ${today}):
${bookingsSummary}

NOW: ${today} ${req.context.currentTimeStr || ''} | conversation ${history.length ? 'ongoing (no greeting)' : 'first turn'}
${history.length ? `HISTORY:\n${history.slice(-6).map(h => `${h.role === 'user' ? 'User' : 'Ulendo'}: ${clip(h.content, MAX_HISTORY_ITEM_CHARS)}`).join('\n')}\n` : ''}
USER MESSAGE:
"${clip(message, MAX_MESSAGE_CHARS)}"`;

  return { systemPrompt, userPrompt, maxTokens, thinkingBudget, isUserGreeting, effectiveDisplayName };
}
