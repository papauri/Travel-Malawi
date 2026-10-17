import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Compass,
  MapPin,
  Calendar,
  Car,
  Utensils,
  ShieldCheck,
  Check,
  Copy,
  Send,
  Loader2,
  Lightbulb,
  Backpack,
  RotateCcw,
  ExternalLink,
  MessageCircle,
  CheckCircle2,
  Sun,
  Wallet,
  Smartphone
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAIAssistant, describeAIError } from '../hooks/useAIAssistant';
import { Hotel } from '../types';
import { distanceKm, estimateTravelTime, isValidLatLng, isCrossingLakeMalawi, LatLng } from '../lib/geo';

export interface TripInsightsData {
  title: string;
  summary: string;
  tripVibe: string;
  pacingScore: string;
  estimatedTotalDistance: string;
  recommendedTotalDays: number;
  dayByDay: Array<{
    dayNumber: string;
    stopName: string;
    location: string;
    activityHighlight: string;
    scenicTransitNote: string;
    diningOrLocalPerk: string;
  }>;
  insiderSecrets: string[];
  logisticsAdvice: {
    roadAndVehicle: string;
    bestTimeToDrive: string;
    currencyAndCash: string;
    simAndConnectivity: string;
  };
  packingHighlights: string[];
  provider?: string;
  model?: string;
  /** Present when the server could not use an AI provider and sent standard route notes. */
  aiNotice?: string;
}

interface Props {
  hotels: Hotel[];
  nightsByHotel?: Record<string, number>;
  onOpenListing?: (hotelId: string) => void;
}

const TRAVEL_STYLES = [
  { id: 'balanced', label: 'Balanced Explorer', desc: 'Mix of scenic lake relaxation, culture & game viewing' },
  { id: 'scenic', label: 'Lakeshore & Leisure', desc: 'Sun, freshwater snorkeling, beach sunrises & slow travel' },
  { id: 'safari', label: 'Big 5 Safari Focus', desc: 'Game drives, Shire River boat safaris & wildlife photography' },
  { id: 'romantic', label: 'Romantic Retreat', desc: 'Secluded verandas, candlelit lake dinners & scenic sunsets' },
  { id: 'adventure', label: 'Highland & Adventure', desc: 'Plateau hikes, tea trails, waterfalls & rugged viewpoints' },
];

const SUGGESTED_QUESTIONS = [
  'Is a 4x4 required for this route or is a 2WD sedan okay?',
  'Where are the best scenic lunch stops between our destinations?',
  'What is the best time of year for wildlife and lake conditions?',
  'What should we know about fuel, toll gates, and local currency?',
];

type RegionCategory = 'lake' | 'safari' | 'highlands' | 'south' | 'central';

function classifyStopRegion(hotel: Hotel): {
  category: RegionCategory;
  regionLabel: string;
  coords: LatLng;
} {
  const text = `${hotel.name || ''} ${hotel.location || ''}`.toLowerCase();

  if (text.includes('likoma') || text.includes('kaya mawa')) {
    return {
      category: 'lake',
      regionLabel: 'Likoma Island, Lake Malawi',
      coords: isValidLatLng(hotel.coordinates) ? hotel.coordinates : { lat: -12.0622, lng: 34.7351 },
    };
  }
  if (text.includes('nkhata') || text.includes('chintheche') || text.includes('kande') || text.includes('mayoka')) {
    return {
      category: 'lake',
      regionLabel: 'Northern Lakeshore (Nkhata Bay)',
      coords: isValidLatLng(hotel.coordinates) ? hotel.coordinates : { lat: -11.6067, lng: 34.2908 },
    };
  }
  if (text.includes('salima') || text.includes('senga') || text.includes('blue zebra') || text.includes('nankoma')) {
    return {
      category: 'lake',
      regionLabel: 'Central Lake Malawi (Senga Bay)',
      coords: isValidLatLng(hotel.coordinates) ? hotel.coordinates : { lat: -13.7245, lng: 34.6225 },
    };
  }
  if (
    text.includes('cape maclear') ||
    text.includes('mangochi') ||
    text.includes('monkey bay') ||
    text.includes('makokola') ||
    text.includes('nkopola') ||
    text.includes('pumulani') ||
    text.includes('lake')
  ) {
    return {
      category: 'lake',
      regionLabel: 'Southern Lake Malawi Shores',
      coords: isValidLatLng(hotel.coordinates) ? hotel.coordinates : { lat: -14.0267, lng: 34.8519 },
    };
  }
  if (text.includes('nyika') || text.includes('chelinda') || text.includes('vwaza')) {
    return {
      category: 'safari',
      regionLabel: 'Nyika National Park Plateau',
      coords: isValidLatLng(hotel.coordinates) ? hotel.coordinates : { lat: -10.5847, lng: 33.8053 },
    };
  }
  if (text.includes('majete') || text.includes('mkulumadzi') || text.includes('thawale') || text.includes('lengwe')) {
    return {
      category: 'safari',
      regionLabel: 'Majete Wildlife Reserve (Lower Shire)',
      coords: isValidLatLng(hotel.coordinates) ? hotel.coordinates : { lat: -15.9167, lng: 34.75 },
    };
  }
  if (text.includes('nkhotakota') || text.includes('tongole') || text.includes('kasungu')) {
    return {
      category: 'safari',
      regionLabel: 'Nkhotakota Wildlife Sanctuary',
      coords: isValidLatLng(hotel.coordinates) ? hotel.coordinates : { lat: -12.983, lng: 34.052 },
    };
  }
  if (
    text.includes('liwonde') ||
    text.includes('mvuu') ||
    text.includes('kuthengo') ||
    text.includes('safari') ||
    text.includes('game')
  ) {
    return {
      category: 'safari',
      regionLabel: 'Liwonde National Park & Shire River',
      coords: isValidLatLng(hotel.coordinates) ? hotel.coordinates : { lat: -14.8512, lng: 35.2891 },
    };
  }
  if (
    text.includes('zomba') ||
    text.includes('mulanje') ||
    text.includes('viphya') ||
    text.includes('luwawa') ||
    text.includes('highlands') ||
    text.includes('plateau') ||
    text.includes('mountain')
  ) {
    const isMulanje = text.includes('mulanje');
    return {
      category: 'highlands',
      regionLabel: isMulanje ? 'Mount Mulanje Biosphere' : 'Zomba Plateau & Highlands',
      coords: isValidLatLng(hotel.coordinates)
        ? hotel.coordinates
        : isMulanje
        ? { lat: -15.9388, lng: 35.5015 }
        : { lat: -15.3642, lng: 35.3048 },
    };
  }
  if (text.includes('blantyre') || text.includes('thyolo') || text.includes('limbe') || text.includes('satemwa')) {
    return {
      category: 'south',
      regionLabel: 'Southern Hub (Blantyre & Thyolo Tea Estates)',
      coords: isValidLatLng(hotel.coordinates) ? hotel.coordinates : { lat: -15.7861, lng: 35.0058 },
    };
  }
  return {
    category: 'central',
    regionLabel: 'Central Hub (Lilongwe)',
    coords: isValidLatLng(hotel.coordinates) ? hotel.coordinates : { lat: -13.9626, lng: 33.7741 },
  };
}

function getHighwayCorridorAdvice(fromStop: Hotel, toStop: Hotel, crossesLake: boolean, roadKm: number): string {
  const fromMeta = classifyStopRegion(fromStop);
  const toMeta = classifyStopRegion(toStop);
  const combined = `${fromStop.location || ''} ${toStop.location || ''} ${fromStop.name} ${toStop.name}`.toLowerCase();

  if (combined.includes('likoma') || combined.includes('kaya mawa')) {
    return 'Connect via Nkhata Bay jetty on the M5 lakeshore highway or scheduled domestic hop from Lilongwe (LLW) to Likoma airstrip.';
  }
  if (crossesLake) {
    return 'Route curves south around Lake Malawi via the scenic Golomoti escarpment and Monkey Bay / Mangochi turnoff (M1 to M10/M3), or schedule a boat transfer.';
  }
  if (fromMeta.category === toMeta.category && roadKm < 45) {
    return 'Short regional transfer along local paved and graded district roads; ideal for a relaxed mid-morning checkout.';
  }
  if (
    (fromMeta.category === 'central' && toMeta.category === 'lake') ||
    (fromMeta.category === 'lake' && toMeta.category === 'central')
  ) {
    return 'Smooth tarmac descent from the central plateau via the M14 Salima corridor or M1/M10 Golomoti road with panoramic Rift Valley views.';
  }
  if (fromMeta.category === 'lake' && toMeta.category === 'safari') {
    return 'Follow the M3/M10 lakeshore corridor south along the Shire River valley directly toward the park sanctuary gates.';
  }
  if (fromMeta.category === 'safari' && toMeta.category === 'highlands') {
    return 'Climb from the Shire Valley floor up the scenic M3 highway toward Zomba Plateau and the southern mountain massif.';
  }
  if (
    (fromMeta.category === 'central' && toMeta.category === 'south') ||
    (fromMeta.category === 'south' && toMeta.category === 'central')
  ) {
    return 'Primary M1 national highway through Dedza high country and Ntcheu escarpment; stop at Dedza Pottery for lunch halfway.';
  }
  return 'Paved inter-district highway via the M1/M5 national spine; plan a morning departure for clear mountain and lakeshore visibility.';
}

function getStopActivitiesAndDining(
  hotel: Hotel,
  category: RegionCategory,
  style: string
): { activity: string; dining: string } {
  const text = `${hotel.name} ${hotel.location}`.toLowerCase();

  if (category === 'lake') {
    const activityByStyle: Record<string, string> = {
      scenic: 'Kayak over crystal-clear freshwater cichlid reefs at sunrise, followed by an afternoon wooden dhow sail to a secluded granite island cove.',
      safari: 'Board a guided boat excursion to spot African fish eagles, monitor lizards, and hippos near the southern lake lagoons.',
      romantic: 'Private sunset dhow cruise across golden Lake Malawi waters followed by stargazing from your lakeshore deck.',
      adventure: 'Guided island snorkeling trail, cliff-jumping into deep freshwater bays, and paddleboarding along the headland.',
      balanced: 'Snorkel among vibrant endemic cichlids in Lake Malawi National Park and take a late-afternoon sunset cruise along the shore.',
    };
    return {
      activity: activityByStyle[style] || activityByStyle.balanced,
      dining: text.includes('nkhata')
        ? 'Freshly caught Lake Malawi Kampango fillet grilled over charcoal with coconut-simmered greens and cassava.'
        : 'Whole charcoal-grilled Chambo served lakeside with tangy tomato-onion relish, nsima, and a chilled Malawi Gin & Tonic.',
    };
  }

  if (category === 'safari') {
    const activityByStyle: Record<string, string> = {
      safari: 'Dawn 4x4 tracker drive for elephants, sable antelope, and big cats, paired with a golden-hour boat safari along the Shire River.',
      romantic: 'Private bush sundowner overlooking the river floodplains and a lantern-lit wilderness dinner under the southern stars.',
      adventure: 'Early morning armed ranger bush walk tracking spoor and birdlife along ancient baobab corridors.',
      scenic: 'Slow afternoon river cruise watching elephant herds cross the reeds and malachite kingfishers along the banks.',
      balanced: 'Morning open-vehicle game drive through mopane woodlands and an afternoon river safari past basking hippo pods.',
    };
    return {
      activity: activityByStyle[style] || activityByStyle.balanced,
      dining: 'Fireside boma dinner featuring tender slow-braised beef, smoky chambo starters, and spiced Malawian hibiscus (chibwantu/sobo) cooler.',
    };
  }

  if (category === 'highlands') {
    const activityByStyle: Record<string, string> = {
      adventure: 'Trek through misty Mulanje cedar forests to mountain waterfall pools and panoramic Queen’s View and Emperor’s View lookouts.',
      romantic: 'Misty morning walk through pine and heather trails followed by afternoon tea beside a crackling fireplace.',
      scenic: 'Scenic plateau circuit drive past Mulunguzi Dam, Mandala Falls, and dramatic Rift Valley escarpment viewpoints.',
      safari: 'Forest birding walk spotting endemic mountain apalis, augur buzzards, and samango monkeys in the canopy.',
      balanced: 'Guided hike to Williams Falls and Chingwe’s Hole rim viewpoint with sweeping views toward Lake Chilwa and Mulanje.',
    };
    return {
      activity: activityByStyle[style] || activityByStyle.balanced,
      dining: 'Pan-seared Zomba mountain rainbow trout with local highland potatoes, wild forest berry tart, and freshly brewed Thyolo estate tea.',
    };
  }

  if (category === 'south') {
    return {
      activity:
        style === 'adventure'
          ? 'Explore the rolling Thyolo tea estates by mountain bike and hike the Michiru Nature Sanctuary trails.'
          : 'Tour historic Mandala House (Malawi’s oldest standing building), browse local artisan galleries, and walk the emerald Thyolo tea fields.',
      dining: 'Estate-grown single-origin tea tasting and macadamia-crusted chicken at a colonial veranda kitchen.',
    };
  }

  // Central / Lilongwe
  return {
    activity:
      style === 'safari'
        ? 'Walk the shaded trails of Lilongwe Wildlife Centre—Malawi’s accredited forest sanctuary—before visiting the lively Old Town craft market.'
        : 'Stroll the tranquil Lilongwe Wildlife Centre forest sanctuary, browse woodcarvers’ stalls, and unwind in leafy Area 43 gardens.',
    dining: 'Artisanal Mzuzu single-origin pour-over coffee, warm spiced samosas, and garden courtyard dining in Lilongwe.',
  };
}

export function buildLocalTripInsights(
  hotels: Hotel[],
  style: string,
  nightsByHotel?: Record<string, number>
): TripInsightsData {
  if (!hotels || hotels.length === 0) {
    return {
      title: 'Malawi Circuit Blueprint',
      summary: 'Save stays across Malawi to generate a tailored road-trip itinerary.',
      tripVibe: 'Balanced Explorer',
      pacingScore: 'Flexible Pacing',
      estimatedTotalDistance: '0 km',
      recommendedTotalDays: 0,
      dayByDay: [],
      insiderSecrets: [],
      logisticsAdvice: {
        roadAndVehicle: 'Standard 2WD reaches major towns; 4x4 advised for national parks.',
        bestTimeToDrive: 'Plan highway drives between 06:30 and 16:30 for full daylight visibility.',
        currencyAndCash: 'Keep Malawian Kwacha (MWK) cash for toll gates and roadside craft markets.',
        simAndConnectivity: 'Airtel Malawi and TNM offer reliable 4G across lakeshore and highland hubs.',
      },
      packingHighlights: [],
    };
  }

  const styleObj = TRAVEL_STYLES.find(s => s.id === style) || TRAVEL_STYLES[0];
  const stopClassified = hotels.map(h => classifyStopRegion(h));
  const categoriesSet = new Set(stopClassified.map(c => c.category));

  let totalRoadKm = 0;
  let totalDriveMins = 0;
  let currentDayCursor = 1;

  const dayByDay = hotels.map((hotel, idx) => {
    const nights = Math.max(1, Math.min(14, nightsByHotel?.[hotel.id || ''] ?? 2));
    const startDay = currentDayCursor;
    const endDay = currentDayCursor + nights - 1;
    currentDayCursor = endDay + 1;

    const dayLabel =
      nights === 1
        ? `Day ${startDay} (1 night)`
        : `Days ${startDay}–${endDay} (${nights} nights)`;

    const meta = stopClassified[idx];
    const { activity, dining } = getStopActivitiesAndDining(hotel, meta.category, style);

    let scenicTransitNote = '';
    if (idx === 0) {
      scenicTransitNote =
        meta.category === 'south' || meta.category === 'highlands'
          ? `Start your route in ${meta.regionLabel}. Arrive via Chileka Airport (BLZ) or morning highway transfer, stock up on snacks, and check in directly with your host.`
          : `Begin your journey at ${hotel.name} (${meta.regionLabel}). Easy access from Kamuzu International Airport (LLW) or main tarmac corridor.`;
    } else {
      const prevHotel = hotels[idx - 1];
      const prevMeta = stopClassified[idx - 1];
      const rawStraight = distanceKm(prevMeta.coords, meta.coords);
      const effectiveStraight = rawStraight < 2 && prevHotel.id !== hotel.id ? 14 : rawStraight;
      const crossesLake = isCrossingLakeMalawi(prevMeta.coords, meta.coords);
      const est = estimateTravelTime(effectiveStraight, prevMeta.coords, meta.coords, hotel.name);
      const legRoadKm = Math.round(est.roadDistanceKm);
      totalRoadKm += legRoadKm;
      totalDriveMins += est.drivingMinutes;

      const corridorNote = getHighwayCorridorAdvice(prevHotel, hotel, crossesLake, legRoadKm);
      scenicTransitNote = `${est.drivingTimeFormatted} (~${legRoadKm} km) from ${prevHotel.name}. ${corridorNote}`;
    }

    return {
      dayNumber: dayLabel,
      stopName: hotel.name,
      location: hotel.location || meta.regionLabel,
      activityHighlight: activity,
      scenicTransitNote,
      diningOrLocalPerk: dining,
    };
  });

  const totalNights = currentDayCursor - 1;
  const avgDrivePerLeg = hotels.length > 1 ? totalDriveMins / (hotels.length - 1) : 0;
  const pacingScore =
    hotels.length === 1
      ? 'Single-Base Immersion'
      : avgDrivePerLeg <= 140 && totalNights / hotels.length >= 2
      ? 'Relaxed & Scenic Pacing'
      : avgDrivePerLeg <= 220
      ? 'Well-Balanced Circuit'
      : 'Grand Cross-Country Expedition';

  const regionParts: string[] = [];
  if (categoriesSet.has('lake')) regionParts.push('Lake Malawi');
  if (categoriesSet.has('safari')) regionParts.push('Bush Safari');
  if (categoriesSet.has('highlands')) regionParts.push('Highland Peaks');
  if (categoriesSet.has('central') || categoriesSet.has('south')) regionParts.push('Cultural Hubs');

  const routeThemeTitle =
    regionParts.length >= 2
      ? `The ${regionParts.slice(0, 3).join(' & ')} Circuit`
      : hotels.length === 1
      ? `${hotels[0].name} Retreat Blueprint`
      : `Malawi ${styleObj.label} Route`;

  const totalHoursStr =
    totalDriveMins >= 60
      ? `${Math.floor(totalDriveMins / 60)}h ${totalDriveMins % 60}m total drive`
      : `${totalDriveMins}m local transfer`;

  const summary =
    hotels.length === 1
      ? `A focused ${totalNights}-night stay at ${hotels[0].name} in ${hotels[0].location || 'Malawi'}, curated for ${styleObj.desc.toLowerCase()}. Book directly with your host for 0% platform commission and tailored local excursions.`
      : `Spanning ${hotels.length} handpicked stays over ${totalNights} nights (~${totalRoadKm} km road distance, ${totalHoursStr}), this ${styleObj.label.toLowerCase()} route links ${hotels.map(h => h.name).join(' → ')}. Each leg is timed for comfortable daytime driving along Malawi's scenic Rift Valley and highland corridors.`;

  const hasSafari = categoriesSet.has('safari');
  const hasLake = categoriesSet.has('lake');
  const hasHighlands = categoriesSet.has('highlands');

  const insiderSecrets: string[] = [
    hasLake
      ? 'Ask your lakeshore host to arrange a morning boat out to feed African fish eagles and snorkel before the midday breeze picks up.'
      : 'Stop at Dedza Pottery or Bvumbwe roadside farm stalls between legs for fresh highland coffee, macadamia nuts, and hand-painted ceramics.',
    hasSafari
      ? 'In Liwonde and Majete, afternoon boat safaris between 15:30 and sunset deliver the highest concentration of elephant herds and hippos along the water.'
      : 'Buy roasted Mzuzu AA arabica coffee beans and Nali peri-peri sauces at local town supermarkets for authentic Malawian gifts.',
    hasHighlands
      ? 'Depart for Zomba Plateau or Mount Mulanje viewpoints before 08:30 to enjoy crystal-clear Rift Valley panoramas before afternoon cloud buildup.'
      : 'Confirm your arrival time with your host on WhatsApp a day ahead—many lodges prepare fresh welcome juices and pre-order lake fish to your schedule.',
    'Keep small Malawian Kwacha notes (MWK 1,000–5,000) accessible in the glovebox for national highway toll plazas (Chingeni, Kalinyeke, Dowa) and roadside fruit sellers.',
  ];

  const logisticsAdvice = {
    roadAndVehicle: hasSafari
      ? 'A high-clearance SUV or 4x4 is recommended for national park game loops and wet-season reserve tracks; main M1/M3/M5 connecting highways are paved.'
      : 'A standard 2WD sedan or crossover comfortably handles the paved M1, M3, and M5 highways linking your stays, with high clearance helpful for final lodge driveways.',
    bestTimeToDrive:
      'Depart between 07:00 and 10:00 so you arrive at each lodge by mid-afternoon. Avoid night driving outside urban centres due to unlit cyclists and livestock.',
    currencyAndCash:
      'Lodges on Travel Malawi accept direct bank transfers, Airtel Money, TNM Mpamba, or cards, while highway fuel stations and toll gates frequently require MWK cash.',
    simAndConnectivity:
      'Pick up an Airtel Malawi eSIM or physical SIM on arrival for the widest 4G coverage along Lake Malawi, Lilongwe, Blantyre, and national park gates.',
  };

  const packingHighlights = [
    hasLake
      ? 'Reef-safe sunscreen, polarized sunglasses, and a dry bag for dhow and boat transfers'
      : 'Polarized sunglasses and a reusable insulated water bottle for scenic highway legs',
    hasSafari
      ? 'Neutral khaki/olive breathable layers, binoculars (8x42), and a telephoto zoom lens'
      : 'Breathable cotton daywear and comfortable walking shoes for village and craft market visits',
    hasHighlands
      ? 'Warm fleece jacket and windproof layer for crisp Zomba and Mulanje highland evenings'
      : 'Light linen shirt or wrap for breezy lakeshore evenings after sunset',
    'DEET insect repellent, universal UK Type-G 3-pin power adapter, and a compact power bank',
  ];

  return {
    title: routeThemeTitle,
    summary,
    tripVibe: styleObj.label,
    pacingScore,
    estimatedTotalDistance: hotels.length > 1 ? `~${totalRoadKm} km (${totalHoursStr})` : 'Local base stay',
    recommendedTotalDays: totalNights,
    dayByDay,
    insiderSecrets,
    logisticsAdvice,
    packingHighlights,
  };
}

export default function TripAIInsights({ hotels, nightsByHotel, onOpenListing }: Props) {
  const { status: aiStatus } = useAIAssistant();
  const isAIAvailable = Boolean(aiStatus.enabled && aiStatus.available);

  const [selectedStyle, setSelectedStyle] = useState('balanced');
  const [customNotes, setCustomNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const nightsKey = nightsByHotel
    ? Object.entries(nightsByHotel)
        .map(([k, v]) => `${k}:${v}`)
        .join(',')
    : 'default';

  const cacheKey = `trip_insights_v2_${hotels.map(h => h.id).join('_')}_${selectedStyle}_${nightsKey}`;

  const [insights, setInsights] = useState<TripInsightsData>(() =>
    buildLocalTripInsights(hotels, 'balanced', nightsByHotel)
  );
  const [copied, setCopied] = useState(false);

  // Chat Concierge State (only rendered when isAIAvailable is true)
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    Array<{ id?: string; role: 'user' | 'assistant'; text: string; time: string; notice?: string }>
  >([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Synchronize insights immediately whenever hotels, style, or nights change (0 AI credits)
  useEffect(() => {
    if (isAIAvailable) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          setInsights(JSON.parse(cached));
          return;
        }
      } catch {
        // ignore storage error
      }
    }
    setInsights(buildLocalTripInsights(hotels, selectedStyle, nightsByHotel));
  }, [hotels, selectedStyle, nightsKey, cacheKey, isAIAvailable]);

  // Scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  // Optional Custom Notes Refresh (only available & triggered when user clicks button and isAIAvailable is true)
  const handleRefreshWithCustomNotes = async () => {
    if (!isAIAvailable || hotels.length === 0) return;

    setLoading(true);
    try {
      const stopsPayload = hotels.map(h => ({
        name: h.name,
        location: h.location || 'Malawi',
        category: h.category || 'Lodge',
        nights: nightsByHotel?.[h.id || ''] ?? 2,
      }));

      const res = await fetch('/api/ai/trip-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stops: stopsPayload,
          travelStyle: selectedStyle,
          customPreferences: customNotes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(describeAIError(res, errData));
      }

      const data: TripInsightsData = await res.json();
      setInsights(data);
      if (!data.aiNotice) {
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(data));
        } catch {
          // ignore
        }
      }
      toast.success('Route blueprint updated with your custom notes');
    } catch {
      // Fall back gracefully to local deterministic engine without noisy error banners
      setInsights(buildLocalTripInsights(hotels, selectedStyle, nightsByHotel));
      toast.success('Route blueprint refreshed');
    } finally {
      setLoading(false);
    }
  };

  // Ask Route Concierge (only rendered when isAIAvailable is true)
  const handleSendMessage = async (customText?: string) => {
    const text = (customText || chatInput).trim();
    if (!text || chatLoading || hotels.length === 0 || !isAIAvailable) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg = { role: 'user' as const, text, time };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const stopsPayload = hotels.map(h => ({
        name: h.name,
        location: h.location || 'Malawi',
      }));

      const historyPayload = chatMessages.slice(-6).map(m => ({
        role: m.role,
        text: m.text,
      }));

      const res = await fetch('/api/ai/trip-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stops: stopsPayload,
          message: text,
          history: historyPayload,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(describeAIError(res, errData));
      }

      const data = await res.json();
      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setChatMessages(prev => [
        ...prev,
        { role: 'assistant', text: data.answer, time: replyTime },
      ]);
    } catch {
      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setChatMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: 'Along your itinerary, daytime driving on the main highways (M1, M3, M5) is paved and scenic. Keep Malawian Kwacha cash handy for highway toll plazas and lakeside fish stalls.',
          time: replyTime,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Copy Full Itinerary to Clipboard
  const handleCopyItinerary = () => {
    if (!insights) return;
    const text = `${insights.title} — Travel Malawi Route Plan
Pacing: ${insights.pacingScore} | Duration: ~${insights.recommendedTotalDays} Nights
Vibe: ${insights.tripVibe}
Distance: ${insights.estimatedTotalDistance}

${insights.summary}

--- DAY BY DAY JOURNEY ---
${insights.dayByDay
  .map(
    d => `• ${d.dayNumber}: ${d.stopName} (${d.location})
  Highlights: ${d.activityHighlight}
  Transit Advice: ${d.scenicTransitNote}
  Culinary Tip: ${d.diningOrLocalPerk}`
  )
  .join('\n\n')}

--- LOCAL INSIDER SECRETS ---
${insights.insiderSecrets.map(s => `- ${s}`).join('\n')}

--- LOGISTICS & ROAD ADVICE ---
• Road & Vehicle: ${insights.logisticsAdvice.roadAndVehicle}
• Driving Hours: ${insights.logisticsAdvice.bestTimeToDrive}
• Cash & Cards: ${insights.logisticsAdvice.currencyAndCash}
• Mobile & SIM: ${insights.logisticsAdvice.simAndConnectivity}

Plan and book direct with 0% fees on Travel Malawi: https://travel-malawi.ai.studio/`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Full trip plan copied to clipboard!');
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* 1. Configuration & Style Selection Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-stone-100">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 text-stone-800 border border-stone-200 text-xs font-bold uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5 text-emerald-700" />
              <span>Journey Route Intelligence</span>
            </div>
            <h3 className="font-serif text-2xl font-bold text-stone-900 tracking-tight">
              Curate Your Route Focus
            </h3>
            <p className="text-stone-500 text-xs sm:text-sm">
              Tailored day-by-day pacing, highway corridors, and regional Malawian highlights for your {hotels.length} saved stay{hotels.length === 1 ? '' : 's'}.
            </p>
          </div>

          {isAIAvailable && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleRefreshWithCustomNotes}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating Route...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 text-stone-300" />
                    <span>Refresh with Custom Notes</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Travel Style Selector */}
        <div className="space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
            Select Your Travel Style
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {TRAVEL_STYLES.map((style, sIdx) => {
              const isSelected = selectedStyle === style.id;
              return (
                <button
                  key={`${style.id}-${sIdx}`}
                  type="button"
                  onClick={() => setSelectedStyle(style.id)}
                  className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-stone-900 border-stone-900 text-white shadow-xs'
                      : 'bg-stone-50/70 border-stone-200 hover:border-stone-300 text-stone-700 hover:text-stone-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-stone-900'}`}>
                      {style.label}
                    </span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  </div>
                  <span className={`text-[11px] leading-snug ${isSelected ? 'text-stone-300' : 'text-stone-500'}`}>
                    {style.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Optional Custom Preference Input (only shown when AI service is active) */}
        {isAIAvailable && (
          <div className="pt-1">
            <input
              type="text"
              value={customNotes}
              onChange={e => setCustomNotes(e.target.value)}
              placeholder="Optional custom notes (e.g., traveling with kids, prefer self-drive 4x4, focus on birdwatching) — then click Refresh above"
              className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/20"
            />
          </div>
        )}
      </div>

      {/* 2. Loading State Skeleton */}
      {loading && (
        <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto text-stone-800 animate-pulse">
            <Compass className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="font-serif font-bold text-lg text-stone-900">
              Updating Your Malawi Route Blueprint
            </h4>
            <p className="text-stone-500 text-xs max-w-md mx-auto">
              Calculating highway legs between {hotels.map(h => h.name).join(' & ')}, road conditions, and regional stops...
            </p>
          </div>
        </div>
      )}

      {/* 3. Route Insights View */}
      {insights && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Executive Overview Header Card */}
          <div className="bg-[#FAF8F5] rounded-3xl p-6 sm:p-8 border border-stone-200/90 shadow-xs space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-200/70">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                    {insights.tripVibe}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold">
                    {insights.pacingScore}
                  </span>
                </div>
                <h3 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
                  {insights.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={handleCopyItinerary}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition shadow-xs cursor-pointer shrink-0 w-fit"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied Full Plan!' : 'Copy Full Plan'}</span>
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-3.5 rounded-2xl border border-stone-200/70">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-stone-400">Duration</span>
                <span className="text-sm sm:text-base font-bold text-stone-900 font-serif">
                  {insights.recommendedTotalDays} {insights.recommendedTotalDays === 1 ? 'Night' : 'Nights'}
                </span>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-stone-200/70">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-stone-400">Total Corridor</span>
                <span className="text-sm sm:text-base font-bold text-stone-900 font-serif">{insights.estimatedTotalDistance}</span>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-stone-200/70">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-stone-400">Primary Spine</span>
                <span className="text-sm sm:text-base font-bold text-emerald-700 font-serif">M1 / M3 / M5</span>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-stone-200/70">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-stone-400">Host Terms</span>
                <span className="text-sm sm:text-base font-bold text-emerald-700 font-serif">0% Comm. Direct</span>
              </div>
            </div>

            <p className="text-stone-700 text-sm sm:text-base leading-relaxed">
              {insights.summary}
            </p>
          </div>

          {/* Day-by-Day Journey Breakdown */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-5">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-700" />
              <h4 className="font-serif text-xl font-bold text-stone-900 tracking-tight">
                Sequenced Journey Blueprint
              </h4>
            </div>

            <div className="space-y-4">
              {insights.dayByDay.map((leg, idx) => {
                const hotelMatch =
                  hotels.find(h => h.name.toLowerCase() === leg.stopName.toLowerCase()) || hotels[idx];

                return (
                  <div
                    key={`leg-${leg.dayNumber || idx}-${idx}`}
                    className="p-4 sm:p-5 rounded-2xl border border-stone-200 bg-stone-50/40 hover:bg-stone-50 transition space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded-full bg-stone-900 text-white text-xs font-bold font-mono">
                          {leg.dayNumber}
                        </span>
                        <div>
                          <h5 className="font-serif font-bold text-stone-900 text-base">
                            {leg.stopName}
                          </h5>
                          <span className="text-xs text-stone-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-stone-400" />
                            {leg.location}
                          </span>
                        </div>
                      </div>

                      {hotelMatch && onOpenListing && (
                        <button
                          type="button"
                          onClick={() => onOpenListing(hotelMatch.id!)}
                          className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline inline-flex items-center gap-1 cursor-pointer w-fit"
                        >
                          <span>View Property</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Highlights Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 bg-white rounded-xl border border-stone-200/60 space-y-1">
                        <span className="font-bold flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-emerald-800">
                          <Compass className="w-3.5 h-3.5" />
                          <span>Signature Activity</span>
                        </span>
                        <p className="text-stone-600 leading-relaxed">
                          {leg.activityHighlight}
                        </p>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-stone-200/60 space-y-1">
                        <span className="font-bold flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-amber-800">
                          <Car className="w-3.5 h-3.5" />
                          <span>Route &amp; Transit</span>
                        </span>
                        <p className="text-stone-600 leading-relaxed">
                          {leg.scenicTransitNote}
                        </p>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-stone-200/60 space-y-1">
                        <span className="font-bold flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-stone-800">
                          <Utensils className="w-3.5 h-3.5" />
                          <span>Local Table &amp; Flavours</span>
                        </span>
                        <p className="text-stone-600 leading-relaxed">
                          {leg.diningOrLocalPerk}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Insider Secrets & Hidden Gems */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-700" />
              <h4 className="font-serif text-xl font-bold text-stone-900 tracking-tight">
                Malawi Route Field Notes
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-stone-700">
              {insights.insiderSecrets.map((tip, idx) => (
                <div
                  key={`secret-${idx}`}
                  className="p-3.5 bg-amber-50/40 rounded-2xl border border-amber-200/60 flex items-start gap-2.5"
                >
                  <span className="w-5 h-5 rounded-full bg-amber-200/80 text-amber-900 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Practical Logistics & Gear Intelligence */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Logistics Grid */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-700" />
                <h4 className="font-serif text-lg font-bold text-stone-900">
                  Malawi Road &amp; Field Logistics
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-1">
                  <span className="font-bold text-stone-900 flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Vehicle Recommendation</span>
                  </span>
                  <p className="text-stone-600 leading-relaxed">{insights.logisticsAdvice.roadAndVehicle}</p>
                </div>
                <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-1">
                  <span className="font-bold text-stone-900 flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-amber-700" />
                    <span>Daylight Driving Windows</span>
                  </span>
                  <p className="text-stone-600 leading-relaxed">{insights.logisticsAdvice.bestTimeToDrive}</p>
                </div>
                <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-1">
                  <span className="font-bold text-stone-900 flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-stone-700" />
                    <span>Currency &amp; Cash Needs</span>
                  </span>
                  <p className="text-stone-600 leading-relaxed">{insights.logisticsAdvice.currencyAndCash}</p>
                </div>
                <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-1">
                  <span className="font-bold text-stone-900 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-stone-700" />
                    <span>SIM &amp; 4G Data Connectivity</span>
                  </span>
                  <p className="text-stone-600 leading-relaxed">{insights.logisticsAdvice.simAndConnectivity}</p>
                </div>
              </div>
            </div>

            {/* Packing Highlights */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Backpack className="w-5 h-5 text-emerald-700" />
                  <h4 className="font-serif text-lg font-bold text-stone-900">
                    Route Packing
                  </h4>
                </div>
                <ul className="space-y-2 text-xs text-stone-600">
                  {insights.packingHighlights.map((item, idx) => (
                    <li key={`pack-${idx}`} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t border-stone-100 text-[11px] text-stone-400">
                Tailored for warm lakeshore days, cool plateau evenings &amp; national park game loops.
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* 4. Interactive Route Concierge (Rendered ONLY when isAIAvailable is true) */}
      {isAIAvailable && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-100">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-emerald-700" />
                <h4 className="font-serif text-xl font-bold text-stone-900">
                  Ask Ulendo — Malawi Route Concierge
                </h4>
              </div>
              <p className="text-xs text-stone-500">
                Have specific questions about road tarmac, park entry fees, fuel stops, or travel timing for your itinerary?
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold w-fit">
              Route Q&amp;A
            </span>
          </div>

          {/* Quick Suggestion Pills */}
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <button
                key={`sug-q-${i}`}
                type="button"
                onClick={() => handleSendMessage(q)}
                className="text-[11px] font-medium px-3 py-1.5 rounded-full bg-stone-100 hover:bg-stone-200/80 text-stone-700 transition cursor-pointer text-left"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Conversation Stream */}
          {chatMessages.length > 0 && (
            <div className="space-y-3 max-h-[360px] overflow-y-auto p-4 rounded-2xl bg-stone-50 border border-stone-200/70 text-xs">
              {chatMessages.map((msg, i) => (
                <div
                  key={`chat-msg-${msg.id || i}-${i}`}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-stone-900 text-white rounded-br-xs'
                        : 'bg-white text-stone-800 border border-stone-200 rounded-bl-xs shadow-2xs'
                    }`}
                  >
                    <p className="whitespace-pre-line">{msg.text}</p>
                    <span className="block text-[10px] mt-1 text-right text-stone-400">
                      {msg.time}
                    </span>
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex items-center gap-2 p-3 bg-white rounded-2xl border border-stone-200 text-stone-500 w-fit">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                  <span>Consulting Malawi road &amp; lodge records...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          {/* Chat Input Bar */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Ask about road conditions, fuel stops, park fees, or local dining..."
              className="flex-1 px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/20"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || chatLoading}
              className="p-3 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white transition disabled:opacity-40 cursor-pointer shrink-0"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
