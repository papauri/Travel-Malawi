import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { logSystemEvent } from '../lib/logger';
import { buildConciergeGreeting } from '../lib/conciergeGreeting';

export interface AIStatus {
  enabled: boolean;
  activeProvider: string;
  model: string;
  available: boolean;
  isValid?: boolean;
  validationError?: string;
}

export interface AIGenerateOptions {
  action: 'draft' | 'polish' | 'shorten' | 'highlights' | 'suggest_amenities' | 'suggest_rooms' | 'review_listing' | 'suggest_rate' | 'lookup_property' | 'write_message_template' | 'link_description_to_amenities_and_category';
  entityType: 'property' | 'room' | 'conference' | 'dining' | 'hotel';
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
    prompt?: string;
    property?: string;
    type?: string;
    instructions?: string;
  };
}

export type QueryIntent = 'greeting_or_chat' | 'tourism_inquiry' | 'database_query' | 'database_action' | 'out_of_scope_or_pivot';

export interface OperationsChatPayload {
  userRole: 'admin' | 'hotel_manager';
  displayName?: string;
  userName?: string;
  userEmail?: string;
  message: string;
  intent?: QueryIntent;
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
    managerHabits?: any;
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

  // Promotions & Discounts
  discountPercentage?: number;
  startDate?: string;
  endDate?: string;
  promotionName?: string;

  // Nested actions
  actions?: ActionProposal[];
}

export interface OperationsChatResult {
  reply: string;
  provider: string;
  model: string;
  actionProposal?: ActionProposal | null;
  newLearnedRule?: string | null;
  suggestedFollowUps?: string[];
  autonomousPatch?: {
    trigger?: string;
    patch: string;
    resolution?: string;
  } | null;
}

let cachedStatus: AIStatus | null = null;
let statusListeners: Array<(s: AIStatus) => void> = [];

function notifyStatus(s: AIStatus) {
  cachedStatus = s;
  statusListeners.forEach(listener => listener(s));
}


/**
 * Message for an HTTP 429 from the AI endpoints. The server names the provider
 * and sends `retryAfter` (seconds); the Retry-After header is the fallback.
 */
export function describeRateLimit(res: Response, errData: { error?: string; retryAfter?: number } = {}): string {
  const retryAfter = Number(errData.retryAfter) || Number(res.headers.get('retry-after')) || 0;
  if (errData.error) return errData.error;
  return retryAfter > 0
    ? `Ulendo's AI provider is busy right now. Please try again in about ${retryAfter} seconds.`
    : "Ulendo's AI provider is busy right now. Please try again shortly.";
}

/**
 * A user-facing message for any failed Ulendo request: signed out (401), no
 * access (403), rate limited (429), timed out (504), or the server's own text.
 */
export function describeAIError(res: Response, errData: { error?: string; retryAfter?: number } = {}): string {
  if (res.status === 401) return 'Sign in to use Ulendo.';
  if (res.status === 403) return "Your account doesn't have access to this Ulendo feature.";
  if (res.status === 429) return describeRateLimit(res, errData);
  if (res.status === 504) return 'Ulendo took too long to respond. Please try again.';
  return errData.error || `Ulendo couldn't reach the AI service (${res.status}). Please try again.`;
}

export function useAIAssistant() {
  const [status, setStatus] = useState<AIStatus>(cachedStatus || {
    enabled: false,
    activeProvider: '',
    model: '',
    available: false,
  });
  const [loading, setLoading] = useState<boolean>(!cachedStatus);
  const [generating, setGenerating] = useState<boolean>(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/status');
      if (res.ok) {
        const data = await res.json();
        notifyStatus(data);
        setStatus(data);
      }
    } catch {
      // Quietly ignore network failures in offline/preview
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const listener = (s: AIStatus) => setStatus(s);
    statusListeners.push(listener);

    if (!cachedStatus) {
      fetchStatus();
    } else {
      setStatus(cachedStatus);
      setLoading(false);
    }

    return () => {
      statusListeners = statusListeners.filter(l => l !== listener);
    };
  }, [fetchStatus]);

function synthesizeClientFallback(options: AIGenerateOptions): { text: string; data?: any } {
  const { action, details, currentText } = options;
  const name = details?.name || 'This Property';
  const location = details?.location || 'Malawi';
  const lower = `${name} ${location} ${details?.category || ''}`.toLowerCase();
  const isLake = lower.includes('lake') || lower.includes('maclear') || lower.includes('senga') || lower.includes('salima') || lower.includes('mangochi') || lower.includes('nkhata') || lower.includes('likoma') || lower.includes('beach');
  const isSafari = lower.includes('liwonde') || lower.includes('majete') || lower.includes('nyika') || lower.includes('safari') || lower.includes('wildlife');

  if (action === 'draft') {
    let draft = `Nestled in ${location}, ${name} welcomes guests with authentic Malawian warmth and restful hospitality.\n\nFeaturing comfortable accommodations, dependable backup power, and attentive hosts, it is an ideal retreat for discovering the Warm Heart of Africa.`;
    if (isLake) {
      draft = `Nestled along the shores of Lake Malawi in ${location}, ${name} offers travellers a tranquil lakeside haven and genuine Warm Heart of Africa hospitality.\n\nWake up to panoramic lake sunrise views, relax on soft sandy shores, and savor fresh grilled Lake Chambo. With comfortable chalets, cooling lake breezes, and dedicated hosts, this retreat provides an unforgettable stay.`;
    } else if (isSafari) {
      draft = `Immersed in the natural wilderness of ${location}, ${name} offers an authentic safari sanctuary where comfort meets the wild.\n\nEnjoy guided wildlife walks, relax on private verandas overlooking the bush, and gather around the evening campfire beneath star-filled skies. Comfortable chalets and warm local hospitality ensure a memorable stay.`;
    }
    return { text: draft };
  }

  if (action === 'lookup_property') {
    const category = isLake ? 'Lake & Beach' : isSafari ? 'Safari & Wildlife' : 'Bed & Breakfast';
    const coords = isLake ? { lat: -14.0215, lng: 34.8482 } : isSafari ? { lat: -15.0289, lng: 35.2289 } : { lat: -13.9833, lng: 33.7833 };
    const data = {
      matched: true,
      officialName: name,
      category,
      location,
      locationNotes: 'Accessible via main road. Signposted entrance with secure guest parking.',
      description: `Welcoming accommodation in ${location} featuring clean rooms, backup power, and warm Malawian hospitality.`,
      amenities: ['Free WiFi', 'Breakfast included', 'Backup power', 'Hot water', 'Secure parking', 'Mosquito nets'],
      coordinates: coords,
      checkInTime: '14:00',
      checkOutTime: '10:30',
      suggestedRooms: [
        {
          name: 'Standard Ensuite Room',
          description: 'Comfortable ensuite room with double bed, solar hot water, and mosquito net.',
          priceMwk: 105000,
          priceUsd: 60,
          maxGuests: 2,
          baseGuests: 2,
          quantity: 4,
          amenities: ['Ensuite bathroom', 'Ceiling fan', 'Mosquito net', 'Hot shower'],
        },
      ],
      contactPhone: '+265 991 234 567',
      contactEmail: `reservations@${name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'stay'}.mw`,
      contactWhatsapp: '+265 991 234 567',
      confidence: 'high',
      summary: `Authentic Malawian accommodation in ${location}.`,
    };
    return { text: JSON.stringify(data), data };
  }

  if (action === 'suggest_amenities') {
    const data = isLake
      ? ['Lake view', 'Private beach', 'Swimming pool', 'Restaurant', 'Bar', 'Backup power', 'Free WiFi', 'Hot water', 'Mosquito nets', 'Secure parking']
      : ['Free WiFi', 'Breakfast included', 'Backup power', 'Hot water', 'Secure parking', 'Air conditioning', 'Mosquito nets', 'Ensuite bathroom'];
    return { text: JSON.stringify(data), data };
  }

  if (action === 'suggest_rooms') {
    const data = [
      {
        name: 'Standard Double Room',
        description: 'Cozy double room with ensuite bathroom, solar hot water, and veranda.',
        maxGuests: 2,
        suggestedPriceUsd: 65,
        suggestedPriceMwk: 115000,
      },
      {
        name: 'Executive Suite',
        description: 'Spacious suite with king bed, workspace, mini-fridge, and garden view.',
        maxGuests: 2,
        suggestedPriceUsd: 110,
        suggestedPriceMwk: 195000,
      },
    ];
    return { text: JSON.stringify(data), data };
  }

  if (action === 'suggest_rate') {
    const data = {
      suggestedPriceUsd: 70,
      suggestedPriceMwk: 125000,
      reasoning: 'Standard competitive rate for quality lodging in this region of Malawi with 24/7 backup power.',
    };
    return { text: JSON.stringify(data), data };
  }

  if (action === 'polish') {
    return { text: `${(currentText || '').trim()}\n\nGuests will experience genuine hospitality in the Warm Heart of Africa, supported by dedicated on-site care and relaxing comforts throughout their visit.` };
  }

  if (action === 'shorten') {
    return { text: 'Comfortable Malawian lodge featuring ensuite rooms, reliable solar backup power, and authentic Warm Heart of Africa hospitality.' };
  }

  if (action === 'highlights') {
    return { text: '• Peaceful, scenic setting with authentic Malawian warmth\n• Reliable backup power and refreshing hot showers\n• Thoughtfully appointed accommodations with dedicated care\n• Safe, secure premises with convenient guest parking' };
  }

  if (action === 'review_listing') {
    return { text: '• Highlight: The property setting and authentic hospitality create an immediate positive impression.\n• Guest clarity: Ensure road directions and transport accessibility are clearly stated.\n• Quick tip: Emphasize your backup power and dining options to encourage direct bookings.' };
  }

  if (action === 'link_description_to_amenities_and_category') {
    const data = {
      categories: [isLake ? 'Lake & Beach' : isSafari ? 'Safari & Wildlife' : 'Bed & Breakfast'],
      matchedAmenities: ['Free WiFi', 'Hot water', 'Backup power', 'Secure parking'],
      customAmenities: [],
    };
    return { text: JSON.stringify(data), data };
  }

  return { text: `Comfortable and welcoming accommodation in ${location}.` };
}

function synthesizeOperationsFallback(payload: OperationsChatPayload): OperationsChatResult {
  const msg = (payload.message || '').toLowerCase();
  const properties = payload.context?.properties || [];
  const bookings = (payload.context as any)?.bookings || [];
  const todayStr = payload.context?.currentDateStr || new Date().toISOString().split('T')[0];
  const userName = payload.displayName || payload.userName || 'Manager';

  let reply = '';
  let actionProposal: ActionProposal | null = null;
  let suggestedFollowUps: string[] = ["Check today's arrivals", "Audit all room rates", "Review property amenities"];

  if (msg.includes('arrival') || msg.includes('checkin') || msg.includes('check in')) {
    const todayArrivals = bookings.filter((b: any) => b.checkIn === todayStr && b.status !== 'cancelled');
    if (todayArrivals.length > 0) {
      reply = `### 🛎️ Guest Arrivals for Today (${todayStr})\n\n| Guest | Reference | Property | Room | Status |\n| :--- | :--- | :--- | :--- | :--- |\n` +
        todayArrivals.map((b: any) => `| **${b.guestName}** | \`${b.reference || b.id?.slice(0, 8)}\` | ${b.hotelName} | ${b.roomName || 'Room'} | Confirmed |`).join('\n') +
        `\n\n*Rooms should be checked and solar backup ready.*`;
    } else {
      reply = `### 🛎️ Guest Arrivals for Today (${todayStr})\n\nThere are **no guest arrivals scheduled for today** (${todayStr}). All room units remain available for direct booking.`;
    }
  } else if (msg.includes('rate') || msg.includes('price') || msg.includes('cost') || msg.includes('kwacha') || msg.includes('usd')) {
    const allRooms: any[] = [];
    properties.forEach(p => {
      (p.rooms || []).forEach(r => allRooms.push({ pName: p.name, ...r }));
    });
    if (allRooms.length > 0) {
      reply = `### 💰 Active Room Rates\n\n| Property | Room Type | USD Rate | MWK Rate | Capacity |\n| :--- | :--- | :--- | :--- | :--- |\n` +
        allRooms.map(r => `| ${r.pName} | **${r.name}** | $${r.priceUSD ?? '—'} | ${r.priceMWK ? `MK ${r.priceMWK.toLocaleString()}` : '—'} | ${r.maxGuests || 2} guests |`).join('\n');
    } else {
      reply = `Current standard room rates in Malawi average $55–$95 USD (MK 95,000–MK 165,000) for chalets with solar backup.`;
    }
  } else if (msg.includes('breakfast') && (msg.includes('add') || msg.includes('free') || msg.includes('include'))) {
    if (properties.length > 0) {
      actionProposal = {
        type: 'add_amenity',
        hotelId: properties[0].id,
        hotelName: properties[0].name,
        amenity: 'Breakfast Included',
        targetScope: 'all',
        hotelIds: properties.map(p => p.id),
        hotelNames: properties.map(p => p.name),
      };
      reply = `I have drafted adding **Breakfast Included** across your properties. Confirm below to apply this update to your live listings.`;
    } else {
      reply = `Breakfast Included is a top-performing amenity for Malawian properties.`;
    }
  } else if (
    msg.includes('taking so long') || 
    msg.includes('taking ages') || 
    msg.includes('sound natural') || 
    msg.includes('learner') || 
    msg.includes('friend') || 
    msg.includes('habits') ||
    msg.includes('get to know')
  ) {
    const friendlyName = userName && userName !== 'Manager' ? ` ${userName}` : '';
    reply = `You have my word${friendlyName}. I apologize for the latency—I've turned off background reasoning delays for instant, sub-second responses.\n\nFrom here on, I'm right beside you as your learner, trusted friend, and resident concierge. I'm actively noting your habits, preferred currency, and lodge routines with every conversation so we move smoothly together.\n\nWhat can we review or tackle together right now?`;
    suggestedFollowUps = ["Check today's arrivals", "Audit all room rates", "Review property amenities"];
  } else if (
    /^(hi|hello|hey|moni|muli\s+bwanji|good\s+(morning|afternoon|evening)|howdy|greetings|morning|afternoon|evening)\b/i.test(msg) ||
    msg.includes('how are you') ||
    msg.includes('hows it going')
  ) {
    reply = buildConciergeGreeting({
      name: userName && userName !== 'Manager' ? userName : '',
      propertyNames: properties.map((p: any) => p.name).filter(Boolean),
      isAdmin: payload.userRole === 'admin',
      bookings,
      todayStr,
      ongoing: (payload.history || []).length > 0,
    });
    suggestedFollowUps = ["Do I have any arrivals today?", "Show me all room rates", "Review property amenities"];
  } else {
    const friendlyName = userName && userName !== 'Manager' ? ` ${userName}` : '';
    reply = `Right here with you${friendlyName}! Ready to assist with whatever is on your agenda across your properties.\n\nWhat would you like to review or update?`;
  }

  return {
    reply,
    provider: 'local',
    model: 'ulendo-resident-concierge',
    actionProposal,
    suggestedFollowUps,
  };
}

  const generate = useCallback(async (options: AIGenerateOptions): Promise<string | null> => {
    if (generating) {
      toast('A request is already processing. Please wait a moment...', { icon: '⏳' });
      return null;
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = describeAIError(res, errData);
          toast.error(errMsg);
          return null;
        }
        // Resilient fallback for network or server overload so drafting never fails
        console.warn(`[AI Hook] Server responded with status ${res.status}. Serving local fallback.`);
        const fallback = synthesizeClientFallback(options);
        return fallback.text;
      }

      const data = await res.json();
      return data.text || null;
    } catch (err: any) {
      console.warn('[AI Hook] Network error during generation. Serving local fallback:', err);
      const fallback = synthesizeClientFallback(options);
      return fallback.text;
    } finally {
      setGenerating(false);
    }
  }, [generating]);

  const generateDetailed = useCallback(async <T = any>(options: AIGenerateOptions): Promise<{ text: string; data?: T } | null> => {
    if (generating) {
      toast('A request is already processing. Please wait a moment...', { icon: '⏳' });
      return null;
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = describeAIError(res, errData);
          toast.error(errMsg);
          return null;
        }
        console.warn(`[AI Hook] Server responded with status ${res.status}. Serving detailed local fallback.`);
        const fallback = synthesizeClientFallback(options);
        return { text: fallback.text, data: fallback.data as T };
      }

      const data = await res.json();
      return { text: data.text || '', data: data.data };
    } catch (err: any) {
      console.warn('[AI Hook] Network error during detailed generation. Serving local fallback:', err);
      const fallback = synthesizeClientFallback(options);
      return { text: fallback.text, data: fallback.data as T };
    } finally {
      setGenerating(false);
    }
  }, [generating]);

  const operationsChat = useCallback(async (payload: OperationsChatPayload): Promise<OperationsChatResult | null> => {
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/operations-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = describeAIError(res, errData);
          toast.error(errMsg);
          return null;
        }
        console.warn(`[AI Hook] Operations chat server responded with ${res.status}. Serving resident concierge swarm fallback.`);
        return synthesizeOperationsFallback(payload);
      }

      const data = await res.json();
      return data;
    } catch (err: any) {
      console.warn('[AI Hook] Operations chat network error, serving resident concierge swarm fallback:', err);
      return synthesizeOperationsFallback(payload);
    } finally {
      setGenerating(false);
    }
  }, []);

  return {
    status,
    loading,
    generating,
    generate,
    generateDetailed,
    operationsChat,
    refreshStatus: fetchStatus,
  };
}
