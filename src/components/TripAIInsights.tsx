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
import { usePlatformMode } from '../contexts/PlatformModeContext';
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
  { id: 'balanced', label: 'Balanced', desc: 'Some lake time, culture and wildlife' },
  { id: 'scenic', label: 'Lake and leisure', desc: 'Beaches, snorkelling and slow days' },
  { id: 'safari', label: 'Safari', desc: 'Game drives and boat safaris' },
  { id: 'romantic', label: 'Romantic', desc: 'Quiet stays and lake sunsets' },
  { id: 'adventure', label: 'Hiking and adventure', desc: 'Plateau hikes, tea trails and waterfalls' },
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

  if (text.includes('likoma') || text.includes('chizumulu')) {
    return {
      category: 'lake',
      regionLabel: 'Likoma Island, Lake Malawi',
      coords: isValidLatLng(hotel.coordinates) ? hotel.coordinates : { lat: -12.0622, lng: 34.7351 },
    };
  }
  if (text.includes('nkhata') || text.includes('chintheche') || text.includes('kande')) {
    return {
      category: 'lake',
      regionLabel: 'Northern Lakeshore (Nkhata Bay)',
      coords: isValidLatLng(hotel.coordinates) ? hotel.coordinates : { lat: -11.6067, lng: 34.2908 },
    };
  }
  if (text.includes('salima') || text.includes('senga')) {
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
    text.includes('lake')
  ) {
    return {
      category: 'lake',
      regionLabel: 'Southern Lake Malawi Shores',
      coords: isValidLatLng(hotel.coordinates) ? hotel.coordinates : { lat: -14.0267, lng: 34.8519 },
    };
  }
  if (text.includes('nyika') || text.includes('vwaza')) {
    return {
      category: 'safari',
      regionLabel: 'Nyika National Park Plateau',
      coords: isValidLatLng(hotel.coordinates) ? hotel.coordinates : { lat: -10.5847, lng: 33.8053 },
    };
  }
  if (text.includes('majete') || text.includes('lengwe') || text.includes('chikwawa')) {
    return {
      category: 'safari',
      regionLabel: 'Majete Wildlife Reserve (Lower Shire)',
      coords: isValidLatLng(hotel.coordinates) ? hotel.coordinates : { lat: -15.9167, lng: 34.75 },
    };
  }
  if (text.includes('nkhotakota') || text.includes('kasungu')) {
    return {
      category: 'safari',
      regionLabel: 'Nkhotakota Wildlife Sanctuary',
      coords: isValidLatLng(hotel.coordinates) ? hotel.coordinates : { lat: -12.983, lng: 34.052 },
    };
  }
  if (
    text.includes('liwonde') ||
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
  if (text.includes('blantyre') || text.includes('thyolo') || text.includes('limbe')) {
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

  if (combined.includes('likoma') || combined.includes('chizumulu')) {
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
      ? 'One base'
      : avgDrivePerLeg <= 140 && totalNights / hotels.length >= 2
      ? 'Relaxed pace'
      : avgDrivePerLeg <= 220
      ? 'Steady pace'
      : 'Long drives';

  const regionParts: string[] = [];
  if (categoriesSet.has('lake')) regionParts.push('Lake Malawi');
  if (categoriesSet.has('safari')) regionParts.push('safari');
  if (categoriesSet.has('highlands')) regionParts.push('highlands');
  if (categoriesSet.has('central') || categoriesSet.has('south')) regionParts.push('towns');

  const routeThemeTitle =
    regionParts.length >= 2
      ? `${regionParts.slice(0, 3).join(', ').replace(/, ([^,]*)$/, ' and $1')} trip`
      : hotels.length === 1
      ? `Your stay at ${hotels[0].name}`
      : `Your ${styleObj.label.toLowerCase()} trip in Malawi`;

  const totalHoursStr =
    totalDriveMins >= 60
      ? `${Math.floor(totalDriveMins / 60)}h ${totalDriveMins % 60}m total drive`
      : `${totalDriveMins}m local transfer`;

  const summary =
    hotels.length === 1
      ? `A ${totalNights}-night stay at ${hotels[0].name} in ${hotels[0].location || 'Malawi'}. Good for: ${styleObj.desc.toLowerCase()}. Arrange your stay directly with the property.`
      : `${hotels.length} stays over ${totalNights} nights (about ${totalRoadKm} km, ${totalHoursStr}): ${hotels.map(h => h.name).join(' → ')}. Each leg is planned for daytime driving.`;

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
  // Directory mode (D3): copied plans never mention booking or fees.
  const { bookingsEnabled } = usePlatformMode();
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
      toast.success('Trip plan updated');
    } catch (err: any) {
      // Keep the current blueprint and say honestly that the refresh failed.
      toast.error(err?.message || "Ulendo couldn't update the plan just now. Please try again.");
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
    } catch (err: any) {
      // An honest notice, never a scripted answer.
      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setChatMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: err?.message || "Ulendo couldn't answer right now. Please try again.",
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

${bookingsEnabled
  ? 'Plan and book direct with 0% fees on Travel Malawi'
  : 'Plan your trip on Travel Malawi and contact each property directly'}: https://travel-malawi.ai.studio/`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Trip plan copied');
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="space-y-6 min-w-0">
      {/* 1. Travel style and notes */}
      <section className="tm-panel space-y-4">
        <div className="space-y-1">
          <h3 className="tm-h2">Plan your route</h3>
          <p className="tm-muted">
            A day-by-day order, driving times and local tips for your {hotels.length} saved stay{hotels.length === 1 ? '' : 's'}.
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="tm-label">How do you like to travel?</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {TRAVEL_STYLES.map((style, sIdx) => {
              const isSelected = selectedStyle === style.id;
              return (
                <button
                  key={`${style.id}-${sIdx}`}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedStyle(style.id)}
                  className={`rounded-lg border p-3 text-left transition-colors min-w-0 ${
                    isSelected
                      ? 'border-amber-700 bg-amber-50 text-stone-900'
                      : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                  }`}
                >
                  <span className="block text-sm font-medium">{style.label}</span>
                  <span className="block text-xs text-stone-500 mt-0.5">{style.desc}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {isAIAvailable && (
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={customNotes}
              onChange={e => setCustomNotes(e.target.value)}
              placeholder="Anything else? e.g. travelling with kids, self-drive, birdwatching"
              aria-label="Notes for your trip plan"
              className="tm-input flex-1"
            />
            <button
              type="button"
              onClick={handleRefreshWithCustomNotes}
              disabled={loading}
              className="tm-btn tm-btn-primary shrink-0"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  <span>Update plan</span>
                </>
              )}
            </button>
          </div>
        )}
      </section>

      {/* 2. Loading */}
      {loading && (
        <div className="tm-panel flex items-center gap-2 tm-muted">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
          <span>Working out the drives between {hotels.map(h => h.name).join(' and ')}...</span>
        </div>
      )}

      {/* 3. The plan */}
      {insights && !loading && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <section className="tm-panel space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  <span className="tm-tag">{insights.tripVibe}</span>
                  <span className="tm-tag">{insights.pacingScore}</span>
                </div>
                <h3 className="tm-h2 break-words">{insights.title}</h3>
                <p className="tm-muted">
                  {insights.recommendedTotalDays} {insights.recommendedTotalDays === 1 ? 'night' : 'nights'} · {insights.estimatedTotalDistance}
                </p>
              </div>
              <button type="button" onClick={handleCopyItinerary} className="tm-btn tm-btn-secondary tm-btn-sm shrink-0 w-fit">
                {copied ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                <span>{copied ? 'Copied' : 'Copy plan'}</span>
              </button>
            </div>

            <p className="text-sm text-stone-700 leading-relaxed">{insights.summary}</p>
            {insights.aiNotice && (
              <p className="text-sm text-amber-900 bg-amber-50 rounded-lg px-3 py-2">{insights.aiNotice}</p>
            )}

            <ol className="tm-divider divide-y divide-stone-200">
              {insights.dayByDay.map((leg, idx) => {
                const hotelMatch =
                  hotels.find(h => h.name.toLowerCase() === leg.stopName.toLowerCase()) || hotels[idx];

                return (
                  <li key={`leg-${leg.dayNumber || idx}-${idx}`} className="py-4 space-y-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-amber-800">{leg.dayNumber}</p>
                        <h4 className="font-serif font-semibold text-stone-900 text-base break-words">{leg.stopName}</h4>
                        <p className="text-xs text-stone-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                          <span className="break-words">{leg.location}</span>
                        </p>
                      </div>
                      {hotelMatch && onOpenListing && (
                        <button
                          type="button"
                          onClick={() => onOpenListing(hotelMatch.id!)}
                          className="tm-link text-sm inline-flex items-center gap-1"
                        >
                          <span>See this stay</span>
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    <dl className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                      <div className="min-w-0">
                        <dt className="font-medium text-stone-800">Things to do</dt>
                        <dd className="text-stone-600 leading-relaxed">{leg.activityHighlight}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="font-medium text-stone-800">Getting there</dt>
                        <dd className="text-stone-600 leading-relaxed">{leg.scenicTransitNote}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="font-medium text-stone-800">Food</dt>
                        <dd className="text-stone-600 leading-relaxed">{leg.diningOrLocalPerk}</dd>
                      </div>
                    </dl>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="tm-panel space-y-3">
            <h4 className="tm-h2">Local tips</h4>
            <ol className="list-decimal pl-5 space-y-2 text-sm text-stone-700 leading-relaxed marker:text-stone-400">
              {insights.insiderSecrets.map((tip, idx) => (
                <li key={`secret-${idx}`}>{tip}</li>
              ))}
            </ol>
          </section>

          <section className="tm-panel space-y-4">
            <h4 className="tm-h2">Before you go</h4>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div className="min-w-0">
                <dt className="font-medium text-stone-800">Car</dt>
                <dd className="text-stone-600 leading-relaxed">{insights.logisticsAdvice.roadAndVehicle}</dd>
              </div>
              <div className="min-w-0">
                <dt className="font-medium text-stone-800">When to drive</dt>
                <dd className="text-stone-600 leading-relaxed">{insights.logisticsAdvice.bestTimeToDrive}</dd>
              </div>
              <div className="min-w-0">
                <dt className="font-medium text-stone-800">Money</dt>
                <dd className="text-stone-600 leading-relaxed">{insights.logisticsAdvice.currencyAndCash}</dd>
              </div>
              <div className="min-w-0">
                <dt className="font-medium text-stone-800">Phone and data</dt>
                <dd className="text-stone-600 leading-relaxed">{insights.logisticsAdvice.simAndConnectivity}</dd>
              </div>
            </dl>
            <details className="tm-divider pt-3">
              <summary className="cursor-pointer text-sm font-medium text-stone-800">What to pack</summary>
              <ul className="list-disc pl-5 mt-2 space-y-1.5 text-sm text-stone-600 marker:text-stone-400">
                {insights.packingHighlights.map((item, idx) => (
                  <li key={`pack-${idx}`}>{item}</li>
                ))}
              </ul>
            </details>
          </section>
        </motion.div>
      )}

      {/* 4. Ask Ulendo (only when an AI provider is available) */}
      {isAIAvailable && (
        <section className="tm-panel space-y-4">
          <div className="space-y-1">
            <h4 className="tm-h2 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-amber-800" aria-hidden="true" />
              <span>Ask Ulendo</span>
            </h4>
            <p className="tm-muted">Questions about roads, park fees, fuel or timing on this trip? Just ask.</p>
          </div>

          {chatMessages.length === 0 && (
            <div className="tm-actions">
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button
                  key={`sug-q-${i}`}
                  type="button"
                  onClick={() => handleSendMessage(q)}
                  disabled={chatLoading}
                  className="tm-btn tm-btn-secondary tm-btn-sm h-auto whitespace-normal text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {chatMessages.length > 0 && (
            <div className="space-y-3 max-h-[360px] overflow-y-auto rounded-lg bg-stone-50 p-3 sm:p-4 text-sm" aria-live="polite">
              {chatMessages.map((msg, i) => (
                <div
                  key={`chat-msg-${msg.id || i}-${i}`}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  {msg.role !== 'user' && <span className="text-xs text-stone-500 mb-0.5">Ulendo</span>}
                  <div
                    className={`max-w-[85%] rounded-xl px-3.5 py-2 leading-relaxed break-words ${
                      msg.role === 'user'
                        ? 'bg-stone-800 text-stone-50'
                        : 'bg-white text-stone-800 border border-stone-200'
                    }`}
                  >
                    <p className="whitespace-pre-line">{msg.text}</p>
                    <span className={`block text-[11px] mt-1 text-right ${msg.role === 'user' ? 'text-stone-300' : 'text-stone-400'}`}>
                      {msg.time}
                    </span>
                  </div>
                </div>
              ))}

              {chatLoading && (
                <p className="flex items-center gap-2 text-stone-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  <span>Ulendo is writing...</span>
                </p>
              )}
              <div ref={chatEndRef} />
            </div>
          )}

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
              placeholder="Ask about roads, fuel, park fees or food"
              aria-label="Your question for Ulendo"
              className="tm-input flex-1 min-w-0"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || chatLoading}
              className="tm-btn tm-btn-secondary shrink-0"
              aria-label="Send"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
