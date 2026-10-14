import { AIProviderId } from './aiConfig';
import { buildConciergeGreeting } from '../src/lib/conciergeGreeting';
import { OperationsAssistantRequest, OperationsAssistantResult, ActionProposal } from './aiService';

export type SwarmAgentId = 
  | 'frontdesk_specialist'
  | 'revenue_specialist'
  | 'operations_specialist'
  | 'tourism_concierge'
  | 'swarm_coordinator';

export interface SwarmClassification {
  primaryAgent: SwarmAgentId;
  intent: 'arrivals_departures' | 'rate_optimization' | 'amenity_policy' | 'tourism_activities' | 'general_chat';
  reason: string;
}

/**
 * Classifies the incoming message to route to the appropriate specialist agent in the Ulendo Swarm
 */
export function classifySwarmIntent(req: OperationsAssistantRequest): SwarmClassification {
  const cleanMsg = (req.message || '').trim().toLowerCase();
  const stripped = cleanMsg.replace(/[!.,?]/g, '');

  // 1. Front Desk / Reservations / Arrivals
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

  // 2. Revenue / Rates / Pricing
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

  // 3. Operations / Amenities / Policies / Daily Board
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

  // 4. Tourism / Excursions / Local Concierge
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

  // 5. Default Swarm Coordinator (Greetings, Identity, Feedback, Adaptive Mirroring)
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
 * Deterministic Swarm Fallback Engine.
 * Runs 100% locally with ZERO network dependencies.
 * Guarantees Ulendo NEVER fails, even during rate limits (429), server overloads (503), or offline periods.
 */
export function executeDeterministicSwarmReply(
  req: OperationsAssistantRequest,
  forcedAgent?: SwarmAgentId
): OperationsAssistantResult {
  const classification = forcedAgent 
    ? { primaryAgent: forcedAgent, intent: 'general_chat' as const, reason: 'Forced fallback' }
    : classifySwarmIntent(req);

  const cleanMsg = (req.message || '').trim().toLowerCase();
  const userName = req.displayName || req.userName || 'Manager';
  const properties = req.context.properties || [];
  const bookings = req.context.bookings || [];
  const todayStr = req.context.currentDateStr || new Date().toISOString().split('T')[0];
  const hasHistory = (req.history || []).length > 0;

  let reply = '';
  let actionProposal: ActionProposal | null = null;
  let newLearnedRule: string | null = null;
  let suggestedFollowUps: string[] = [
    "Check today's arrivals",
    "Audit all room rates",
    "Review property amenities"
  ];

  // Helper: format MWK cleanly
  const formatMwk = (amount?: number) => amount ? `MK ${amount.toLocaleString()}` : '—';
  const formatUsd = (amount?: number) => amount ? `$${amount}` : '—';

  // -------------------------------------------------------------
  // 1. FRONT DESK & RESERVATIONS INTENT
  // -------------------------------------------------------------
  if (classification.primaryAgent === 'frontdesk_specialist' || classification.intent === 'arrivals_departures') {
    const isDeparturesQuery = cleanMsg.includes('departure') || cleanMsg.includes('checkout') || cleanMsg.includes('check out') || cleanMsg.includes('check-out');

    if (isDeparturesQuery) {
      const todayDepartures = bookings.filter(b => b.checkOut === todayStr && b.status !== 'cancelled');
      if (todayDepartures.length > 0) {
        reply = `### 🛫 Guest Departures for Today (${todayStr})\n\n`;
        reply += `I found **${todayDepartures.length} scheduled departure${todayDepartures.length > 1 ? 's' : ''}** for today:\n\n`;
        reply += `| Guest Name | Reference | Property | Room | Check-in | Status |\n`;
        reply += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
        todayDepartures.forEach(b => {
          reply += `| **${b.guestName}** | \`${b.reference || b.id.slice(0, 8)}\` | ${b.hotelName} | ${b.roomName || 'Standard Room'} | ${b.checkIn} | Confirmed |\n`;
        });
        reply += `\n*Please ensure keys and settling of any restaurant or excursion tabs before departure.*`;
      } else {
        reply = `### 🛫 Guest Departures for Today (${todayStr})\n\n`;
        reply += `There are **no guest departures scheduled for today** (${todayStr}).\n\n`;
        const upcomingCheckouts = bookings
          .filter(b => b.checkOut > todayStr && b.status !== 'cancelled')
          .sort((a, b) => a.checkOut.localeCompare(b.checkOut))
          .slice(0, 5);
        if (upcomingCheckouts.length > 0) {
          reply += `**Next Upcoming Checkouts:**\n\n`;
          reply += `| Guest Name | Property | Room | Checkout Date |\n`;
          reply += `| :--- | :--- | :--- | :--- |\n`;
          upcomingCheckouts.forEach(b => {
            reply += `| ${b.guestName} | ${b.hotelName} | ${b.roomName || 'Room'} | ${b.checkOut} |\n`;
          });
        }
      }
      suggestedFollowUps = ["Check today's arrivals", "View all active bookings", "Audit room rates"];
    } else {
      // Arrivals Query
      const todayArrivals = bookings.filter(b => b.checkIn === todayStr && b.status !== 'cancelled');
      if (todayArrivals.length > 0) {
        reply = `### 🛎️ Guest Arrivals for Today (${todayStr})\n\n`;
        reply += `I found **${todayArrivals.length} scheduled arrival${todayArrivals.length > 1 ? 's' : ''}** for today:\n\n`;
        reply += `| Guest Name | Reference | Property | Room | Nights | Total | Status |\n`;
        reply += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
        todayArrivals.forEach(b => {
          const totalStr = b.currency === 'MWK' ? formatMwk(b.total) : formatUsd(b.total);
          reply += `| **${b.guestName}** | \`${b.reference || b.id.slice(0, 8)}\` | ${b.hotelName} | ${b.roomName || 'Room'} | ${b.nights || 1} | ${totalStr} | Confirmed |\n`;
        });
        reply += `\n*Rooms should be aired out with fresh mosquito nets and solar backup power verified before guest check-in.*`;
      } else {
        reply = `### 🛎️ Guest Arrivals for Today (${todayStr})\n\n`;
        reply += `There are **no guest arrivals scheduled for today** (${todayStr}).\n\n`;
        const upcomingArrivals = bookings
          .filter(b => b.checkIn > todayStr && b.status !== 'cancelled')
          .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
          .slice(0, 5);
        if (upcomingArrivals.length > 0) {
          reply += `**Next Upcoming Confirmed Bookings:**\n\n`;
          reply += `| Guest Name | Reference | Property | Room | Check-in Date | Nights |\n`;
          reply += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
          upcomingArrivals.forEach(b => {
            reply += `| ${b.guestName} | \`${b.reference || b.id.slice(0, 8)}\` | ${b.hotelName} | ${b.roomName || 'Room'} | ${b.checkIn} | ${b.nights || 1} |\n`;
          });
        } else {
          reply += `All current room inventory is available for direct online bookings.`;
        }
      }
      suggestedFollowUps = ["Who is checking out today?", "Audit room rates", "Suggest a promotional rate"];
    }
  }

  // -------------------------------------------------------------
  // 2. REVENUE & RATE OPTIMIZER INTENT
  // -------------------------------------------------------------
  else if (classification.primaryAgent === 'revenue_specialist' || classification.intent === 'rate_optimization') {
    // Check if user is requesting a rate change action (e.g. "change room price to $85", "set rate to 120000 kwacha")
    const priceMatch = cleanMsg.match(/(?:price|rate|cost|to)\s*(?:\$|usd\s*)?(\d{2,7})\s*(?:usd|dollars|\$|kwacha|mwk|mk)?/i);
    const mentionsChange = cleanMsg.includes('change') || cleanMsg.includes('update') || cleanMsg.includes('set') || cleanMsg.includes('adjust') || cleanMsg.includes('drop') || cleanMsg.includes('discount');

    // Collect all rooms across portfolio
    const allRooms: Array<{ hotelId: string; hotelName: string; room: any }> = [];
    properties.forEach(p => {
      (p.rooms || []).forEach(r => {
        allRooms.push({ hotelId: p.id, hotelName: p.name, room: r });
      });
    });

    if (mentionsChange && priceMatch && allRooms.length > 0) {
      const rawValue = parseInt(priceMatch[1], 10);
      const isMwk = rawValue > 2000 || cleanMsg.includes('kwacha') || cleanMsg.includes('mwk') || cleanMsg.includes('mk');
      const currency = isMwk ? 'MWK' : 'USD';

      // Pick target room based on message or default to first room
      const targetRoom = allRooms.find(item => cleanMsg.includes(item.room.name.toLowerCase())) || allRooms[0];
      const oldPrice = isMwk ? targetRoom.room.priceMWK : targetRoom.room.priceUSD;

      actionProposal = {
        type: 'update_room_price',
        hotelId: targetRoom.hotelId,
        hotelName: targetRoom.hotelName,
        roomId: targetRoom.room.id,
        roomName: targetRoom.room.name,
        oldPrice: oldPrice || (isMwk ? 115000 : 65),
        newPrice: rawValue,
        currency,
        targetScope: 'single',
        hotelIds: [targetRoom.hotelId],
        hotelNames: [targetRoom.hotelName],
      };

      reply = `I have drafted a rate adjustment for **${targetRoom.hotelName}** (${targetRoom.room.name}):\n\n`;
      reply += `• **Room Unit**: ${targetRoom.room.name}\n`;
      reply += `• **Previous Rate**: ${currency} ${oldPrice ? oldPrice.toLocaleString() : 'Not set'}\n`;
      reply += `• **Proposed Rate**: **${currency} ${rawValue.toLocaleString()}** / night\n\n`;
      reply += `Please review and confirm below to push this update live across all booking engines.`;
      suggestedFollowUps = ["Review all other room rates", "Add breakfast included", "Check today's arrivals"];
    } else {
      // General Rate Audit Table
      reply = `### 💰 Portfolio Room Rates Audit\n\n`;
      if (allRooms.length > 0) {
        reply += `Here is your current active room pricing across Travel Malawi:\n\n`;
        reply += `| Property | Room Type | USD Rate | MWK Rate | Capacity | Status |\n`;
        reply += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
        allRooms.forEach(item => {
          reply += `| ${item.hotelName} | **${item.room.name}** | ${formatUsd(item.room.priceUSD)} | ${formatMwk(item.room.priceMWK)} | ${item.room.maxGuests || 2} guests | Live |\n`;
        });
        reply += `\n**Revenue Optimization Insights:**\n`;
        reply += `• **Dual Currency Positioning**: Malawi averages $55–$95 USD for comfortable chalets and MK 95,000–MK 165,000 for domestic travellers.\n`;
        reply += `• **Green Season Strategy**: Offering weekend package specials for resident travellers from Lilongwe and Blantyre preserves high occupancy during off-peak periods.`;
      } else {
        reply += `No active room units were found in your current portfolio. You can add room units in the **Rooms & Pricing** tab.`;
      }
      suggestedFollowUps = [
        "Update standard double room rate to $75",
        "How do I set up a local resident discount?",
        "Check today's arrivals"
      ];
    }
  }

  // -------------------------------------------------------------
  // 3. OPERATIONS & AMENITIES INTENT
  // -------------------------------------------------------------
  else if (classification.primaryAgent === 'operations_specialist' || classification.intent === 'amenity_policy') {
    const isOnlineToggle = cleanMsg.includes('offline') || cleanMsg.includes('online') || cleanMsg.includes('front desk status');
    const isAmenityRequest = cleanMsg.includes('amenity') || cleanMsg.includes('breakfast') || cleanMsg.includes('wifi') || cleanMsg.includes('power') || cleanMsg.includes('solar');

    if (isOnlineToggle && properties.length > 0) {
      const targetProp = properties[0];
      const setOnline = cleanMsg.includes('online') && !cleanMsg.includes('offline');

      actionProposal = {
        type: 'update_property_online',
        hotelId: targetProp.id,
        hotelName: targetProp.name,
        isOnline: setOnline,
        outOfOfficeMessage: setOnline ? '' : 'Front desk currently offline. Direct bookings accepted for next-day arrivals.',
        targetScope: 'all',
        hotelIds: properties.map(p => p.id),
        hotelNames: properties.map(p => p.name),
      };

      reply = `I have prepared a status update for **${properties.length > 1 ? `all ${properties.length} properties` : targetProp.name}**:\n\n`;
      reply += `• **New Front Desk Status**: ${setOnline ? '🟢 Online (Accepting Instant Inquiries)' : '🌙 Offline (Accepting Automated Bookings)'}\n`;
      reply += `• **Notice**: ${setOnline ? 'Normal front desk operating hours' : 'Offline notice active for incoming inquiries'}\n\n`;
      reply += `Confirm below to apply this state across your portfolio.`;
      suggestedFollowUps = ["Check today's arrivals", "Audit room rates", "Review listing description"];
    } else if (isAmenityRequest && (cleanMsg.includes('add') || cleanMsg.includes('include') || cleanMsg.includes('free'))) {
      const amenityName = cleanMsg.includes('breakfast') 
        ? 'Breakfast Included' 
        : cleanMsg.includes('solar') || cleanMsg.includes('power') 
        ? 'Solar Backup Power' 
        : cleanMsg.includes('wifi') 
        ? 'Free High-Speed Wi-Fi' 
        : 'Dedicated Workspace';

      actionProposal = {
        type: 'add_amenity',
        hotelId: properties[0]?.id || '',
        hotelName: properties[0]?.name || 'Property',
        amenity: amenityName,
        targetScope: 'all',
        hotelIds: properties.map(p => p.id),
        hotelNames: properties.map(p => p.name),
      };

      newLearnedRule = `Host provides ${amenityName} across properties.`;

      reply = `I have drafted adding **${amenityName}** to ${properties.length > 1 ? `all ${properties.length} properties` : properties[0]?.name || 'your property'}:\n\n`;
      reply += `• **Amenity**: \`${amenityName}\`\n`;
      reply += `• **Target Properties**: ${properties.map(p => p.name).join(', ') || 'Your listings'}\n`;
      reply += `• **Impact**: Adds verified badge to search filters and listing amenity matrices.\n\n`;
      reply += `Confirm below to publish this update to your live guest listings.`;
      suggestedFollowUps = ["Audit all room rates", "Check today's arrivals", "Set front desk online"];
    } else {
      // General Infrastructure & Amenity Review
      reply = `### ⚙️ Property Amenities & Infrastructure Overview\n\n`;
      if (properties.length > 0) {
        properties.forEach(p => {
          reply += `#### ${p.name}\n`;
          reply += `• **Amenities**: ${(p.amenities || []).join(', ') || 'No amenities selected'}\n`;
          reply += `• **Power Setup**: ${p.infrastructure?.powerSource || 'Standard grid'} ${p.infrastructure?.powerNotes ? `(${p.infrastructure.powerNotes})` : ''}\n`;
          reply += `• **Water Supply**: ${p.infrastructure?.waterSource || 'Borehole / municipal supply'}\n`;
          reply += `• **Internet & Wi-Fi**: ${p.infrastructure?.wifiSSID ? `SSID: \`${p.infrastructure.wifiSSID}\`` : 'Not configured'}\n\n`;
        });
        reply += `*Having 24/7 solar backup power and verified breakfast badges increases direct guest booking conversion by over 35% in Malawi.*`;
      } else {
        reply += `No properties found in current manager scope.`;
      }
      suggestedFollowUps = [
        "Add Breakfast Included to all properties",
        "Add Solar Backup Power to all properties",
        "Audit room rates"
      ];
    }
  }

  // -------------------------------------------------------------
  // 4. TOURISM & DESTINATION CONCIERGE INTENT
  // -------------------------------------------------------------
  else if (classification.primaryAgent === 'tourism_concierge' || classification.intent === 'tourism_activities') {
    reply = `### 🇲🇼 Malawi Destination & Tourism Intelligence\n\n`;
    reply += `Malawi offers world-class experiences across lakeshore, wildlife, and highlands:\n\n`;
    reply += `1. **Lake Malawi & Freshwater Adventures**:\n`;
    reply += `   • **Cape Maclear (Chembe)**: Part of Lake Malawi National Park (UNESCO). Renowned for kayaking to Thumbi West Island, snorkeling with vibrant cichlid fish (*mbuna*), and catamaran sunset cruises.\n`;
    reply += `   • **Likoma Island**: Spectacular granite shores, transparent turquoise waters, and the historic St. Peter's Cathedral. Ideal for peaceful island getaways.\n`;
    reply += `   • **Nkhata Bay & Senga Bay**: Laid-back beaches, fresh grilled Chambo with lime and Nsima, and vibrant local craft markets.\n\n`;
    reply += `2. **National Parks & Safari Highlights**:\n`;
    reply += `   • **Liwonde National Park**: Premier river safari destination on the Shire River. Outstanding elephant herds, hippos, crocodiles, and thriving cheetah and lion populations.\n`;
    reply += `   • **Majete Wildlife Reserve**: A triumphant Big 5 conservation story in the lower Shire valley, fully fenced with year-round game drives.\n`;
    reply += `   • **Nyika Plateau**: High alpine grassland rolling hills, mountain wildflowers, giant herds of roan antelope, and regular leopard sightings.\n\n`;
    reply += `3. **Practical Travel Advice for Guests**:\n`;
    reply += `   • **Roads**: The M1 backbone is mostly tarmac. A 4x4 with good ground clearance is strongly recommended for Nyika and during the rainy season (Dec–April).\n`;
    reply += `   • **Dining**: Encourage guests to sample authentic Lake Chambo (*Oreochromis lidole*) or fresh Kampango served with hot Nsima.`;
    suggestedFollowUps = [
      "Recommend a 4-day Lake Malawi itinerary",
      "What are the best safari months for Liwonde?",
      "Audit room rates"
    ];
  }

  // -------------------------------------------------------------
  // 5. SWARM COORDINATOR / GENERAL CHAT
  // -------------------------------------------------------------
  else {
    const isFeedback = cleanMsg.includes('flow') || cleanMsg.includes('respond back') || cleanMsg.includes('learn constantly') || cleanMsg.includes('get way better') || cleanMsg.includes('habit') || cleanMsg.includes('habits') || cleanMsg.includes('learner') || cleanMsg.includes('friend') || cleanMsg.includes('taking so long') || cleanMsg.includes('not sound natural');
    
    const now = new Date();
    const hour = now.getHours();
    const friendlyName = userName && userName !== 'Manager' && userName !== 'Host' ? ` ${userName}` : '';
    const lodgeRef = properties[0]?.name ? ` at **${properties[0].name}**` : '';

    if (isFeedback) {
      newLearnedRule = 'Ulendo is your trusted friend, proactive learner, and personal concierge: replies in under a second with natural human warmth, observes and remembers your personal lodge habits, and eliminates slow robotic data dumps.';
      reply = `You have my word${friendlyName}. From now on: no more slow robotic stalling, no impersonal boilerplate, and sub-second natural replies. I'm right here as your trusted friend, daily partner, and concierge${lodgeRef}.\n\nI'm actively learning your habits, your preferred currency, and your lodge routine with every conversation. What's on your agenda right now?`;
      suggestedFollowUps = ["Check today's arrivals", "Audit all room rates", "Review property amenities"];
    } else if (cleanMsg.includes('how are you') || cleanMsg.includes('hows it going') || cleanMsg.includes('doing today')) {
      reply = `I'm doing great, thank you${friendlyName}! Keeping an attentive eye on operations across ${properties[0]?.name || 'your lodge'}. How are things on your side today?`;
      suggestedFollowUps = ["Check today's arrivals", "Show all room rates", "Review property amenities"];
    } else {
      reply = buildConciergeGreeting({
        name: friendlyName.trim(),
        propertyNames: properties.map(p => p.name).filter(Boolean),
        isAdmin: req.userRole === 'admin',
        bookings: req.context.bookings,
        todayStr: req.context.currentDateStr,
        hour,
        ongoing: hasHistory,
      });
      suggestedFollowUps = ["Check today's arrivals", "Show all room rates", "Review pending bookings"];
    }
  }

  return {
    reply,
    provider: 'local' as any,
    model: 'ulendo-swarm-coordinator',
    actionProposal,
    newLearnedRule,
    autonomousPatch: newLearnedRule ? {
      trigger: 'Host preference / instruction',
      patch: newLearnedRule,
      resolution: 'Saved to persistent concierge memory',
    } : null,
    suggestedFollowUps,
  };
}
