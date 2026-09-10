import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Hotel } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { 
  MapPin, 
  Compass, 
  Clock, 
  Navigation, 
  ArrowRight, 
  Calendar, 
  Share2, 
  Check, 
  HelpCircle, 
  Sparkles, 
  ChevronUp, 
  ChevronDown, 
  Car, 
  ExternalLink,
  Layers,
  ListOrdered,
  Info,
  Bot,
  Send,
  Loader2,
  RefreshCw,
  Utensils,
  Sun,
  ShieldCheck,
  Luggage,
  DollarSign,
  Printer,
  Copy,
  SlidersHorizontal,
  Flame,
  Lightbulb,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getHotelImages } from '../lib/images';

interface Props {
  hotels: Hotel[];
  onSelectSampleRoute?: (hotels: Hotel[]) => void;
}

export interface AIPlannerInsights {
  summary: string;
  recommendedDurationDays: number;
  routePacing: {
    recommendedOrderIds?: string[];
    pacingAdvice: string;
    backtrackingWarning?: string;
  };
  legs: Array<{
    hotelId: string;
    hotelName: string;
    location: string;
    recommendedNights: number;
    bestTimeToTravel: string;
    scenicStopsEnRoute: string[];
    localCulinaryHighlights: string[];
    mustDoActivities: string[];
    practicalTip: string;
  }>;
  roadTripLogistics: {
    vehicleRecommendation: string;
    roadConditionsAdvice: string;
    paymentAndCurrencyAdvice: string;
    healthAndSafetyTips: string[];
    packingChecklist: string[];
  };
  seasonalAdvice: {
    bestSeason: string;
    weatherNotes: string;
    lakeConditions?: string;
    wildlifeVisibility?: string;
  };
  estimatedBudgetGuidance: {
    transitFuelEstimateUSD: string;
    transitFuelEstimateMWK: string;
    dailyFoodPerPersonUSD: string;
    dailyFoodPerPersonMWK: string;
    parkAndConservationFeesNotes: string;
  };
  provider?: string;
  model?: string;
}

// Region categorization helper for Malawi
export function getMalawiRegion(location?: string): { name: string; hub: string; color: string; bg: string; borderColor: string; lat: number; lng: number } {
  const loc = (location || '').toLowerCase();
  
  if (loc.includes('cape maclear') || loc.includes('mangochi') || loc.includes('monkey bay') || loc.includes('senga bay') || loc.includes('salima') || loc.includes('nkhata bay') || loc.includes('chintheche') || loc.includes('likoma') || loc.includes('lake')) {
    return {
      name: 'Lake Malawi Shores',
      hub: 'Lakeside & Beach Retreats',
      color: '#0284c7', // Sky blue
      bg: '#f0f9ff',
      borderColor: '#bae6fd',
      lat: -14.01,
      lng: 34.85
    };
  }
  if (loc.includes('majete') || loc.includes('liwonde') || loc.includes('lengwe') || loc.includes('nyika') || loc.includes('kasungu') || loc.includes('safari') || loc.includes('game')) {
    return {
      name: 'National Parks & Safari',
      hub: 'Wildlife & Nature Sanctuaries',
      color: '#059669', // Emerald green
      bg: '#ecfdf5',
      borderColor: '#a7f3d0',
      lat: -14.85,
      lng: 35.25
    };
  }
  if (loc.includes('zomba') || loc.includes('mulanje') || loc.includes('viphya') || loc.includes('highlands') || loc.includes('plateau') || loc.includes('mountain')) {
    return {
      name: 'Highlands & Mountains',
      hub: 'Zomba & Mount Mulanje',
      color: '#d97706', // Amber
      bg: '#fffbeb',
      borderColor: '#fde68a',
      lat: -15.38,
      lng: 35.33
    };
  }
  if (loc.includes('blantyre') || loc.includes('thyolo') || loc.includes('limbe')) {
    return {
      name: 'Southern Hub (Blantyre)',
      hub: 'Commercial & Cultural Center',
      color: '#7c3aed', // Purple
      bg: '#f5f3ff',
      borderColor: '#ddd6fe',
      lat: -15.78,
      lng: 35.00
    };
  }
  // Default Central / Lilongwe
  return {
    name: 'Central Hub (Lilongwe)',
    hub: 'Capital City & Gateway',
    color: '#0d9488', // Teal
    bg: '#f0fdfa',
    borderColor: '#99f6e4',
    lat: -13.98,
    lng: 33.78
  };
}

// Approximate driving time calculation between regions
export function getTransitEstimate(fromRegion: string, toRegion: string): { time: string; distance: string; advice: string } {
  if (fromRegion === toRegion) {
    return { time: '30–45 mins', distance: '15–35 km', advice: 'Local regional scenic transfer' };
  }
  
  const pair = [fromRegion, toRegion].sort().join(' ⇄ ');
  
  if (pair.includes('Central Hub') && pair.includes('Lake Malawi')) {
    return { time: '1.5–2.5 hrs', distance: '120 km', advice: 'Smooth paved drive via M5 Salima Road or M10 Cape Maclear turnoff.' };
  }
  if (pair.includes('Southern Hub') && pair.includes('Lake Malawi')) {
    return { time: '3.0–3.5 hrs', distance: '210 km', advice: 'Scenic route through Zomba and Mangochi corridor (M3).' };
  }
  if (pair.includes('Southern Hub') && pair.includes('Highlands')) {
    return { time: '1.0–1.5 hrs', distance: '65 km', advice: 'Easy tarmac drive to Zomba Plateau or Mulanje tea estates (M2/M4).' };
  }
  if (pair.includes('Central Hub') && pair.includes('Southern Hub')) {
    return { time: '4.0–4.5 hrs', distance: '310 km', advice: 'Primary national spine via M1 highway through Dedza and Ntcheu.' };
  }
  if (pair.includes('Safari') || pair.includes('National Parks')) {
    return { time: '2.0–3.5 hrs', distance: '150 km', advice: '4x4 vehicle recommended for park access gates and game loop tracks.' };
  }
  
  return { time: '2.5–3.5 hrs', distance: '160 km', advice: 'Standard inter-district transfer via paved highways.' };
}

export default function TripPlannerD3({ hotels, onSelectSampleRoute }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const navigate = useNavigate();

  const [orderedHotels, setOrderedHotels] = useState<Hotel[]>(hotels);
  const [selectedLodgeId, setSelectedLodgeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'visualizer' | 'itinerary' | 'ai_insights' | 'ai_concierge'>('visualizer');
  const [copiedShare, setCopiedShare] = useState(false);

  // AI Configuration & State
  const [aiStatus, setAiStatus] = useState<{ enabled: boolean; available: boolean; activeProvider?: string; model?: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState<AIPlannerInsights | null>(null);
  const [tripStyle, setTripStyle] = useState<string>('balanced');
  const [pace, setPace] = useState<'relaxed' | 'moderate' | 'fast'>('moderate');
  const [customQuestion, setCustomQuestion] = useState<string>('');

  // AI Concierge Chat State
  const [conciergeMessages, setConciergeMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; suggestedQuestions?: string[] }>>([
    {
      role: 'assistant',
      content: 'Muli bwanji! I am your AI Travel Concierge for Malawi. Ask me anything about your current itinerary—such as road conditions, best dining spots for Lake Chambo, 4x4 requirements, park entry fees, or cultural stops en route!'
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Checked packing items
  const [checkedPacking, setCheckedPacking] = useState<Record<string, boolean>>({});

  // Sync if prop changes
  useEffect(() => {
    setOrderedHotels(hotels);
  }, [hotels]);

  // Check AI availability on mount
  useEffect(() => {
    async function checkAI() {
      try {
        const res = await fetch('/api/ai/status');
        if (res.ok) {
          const data = await res.json();
          setAiStatus(data);
        }
      } catch (e) {
        console.warn('Could not fetch AI status', e);
      }
    }
    checkAI();
  }, []);

  // Fetch AI Insights
  const generateAIInsights = async (style = tripStyle, pacing = pace, question = customQuestion) => {
    if (orderedHotels.length === 0) {
      toast.error('Add at least one property to generate insights.');
      return;
    }

    setAiLoading(true);
    try {
      const payload = {
        hotels: orderedHotels.map(h => ({
          id: h.id,
          name: h.name,
          location: h.location,
          category: (h as any).category || (h as any).propertyType || 'Lodge',
          description: h.description,
          amenities: h.amenities
        })),
        tripStyle: style,
        pace: pacing,
        customQuestion: question.trim() || undefined
      };

      const res = await fetch('/api/ai/planner-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate AI insights');
      }

      const data: AIPlannerInsights = await res.json();
      setAiInsights(data);
      setActiveTab('ai_insights');
      toast.success('AI Journey Insights generated successfully!');
    } catch (err: any) {
      console.error('AI Insights Error:', err);
      toast.error(err.message || 'AI generation failed. Displaying regional travel guide.');
      
      // Fallback offline insights if backend key is missing
      generateFallbackOfflineInsights();
      setActiveTab('ai_insights');
    } finally {
      setAiLoading(false);
    }
  };

  // Fallback offline generator so the user always has a rich, informative experience
  const generateFallbackOfflineInsights = () => {
    const totalDays = Math.max(4, orderedHotels.length * 2);
    const legsData = orderedHotels.map((h, i) => {
      const reg = getMalawiRegion(h.location);
      const isLake = reg.name.includes('Lake');
      const isSafari = reg.name.includes('Safari');
      const isHighlands = reg.name.includes('Highlands');

      return {
        hotelId: h.id,
        hotelName: h.name,
        location: h.location || 'Malawi',
        recommendedNights: 2,
        bestTimeToTravel: 'Early morning (07:30-08:30) for clear road visibility and cooler driving temperatures.',
        scenicStopsEnRoute: isLake 
          ? ['Dedza Pottery on M1 (Famous handmade ceramics & walnut cheesecake)', 'Roadside tropical fruit stalls (Avocados, papayas, fresh mangoes)']
          : isSafari
          ? ['Chongoni Rock Art World Heritage Site near Dedza', 'Local baobab fruit and woodcraft roadside artisans']
          : isHighlands
          ? ['Zomba Botanical Gardens & Old British Colonial Parliament buildings', 'Thyolo tea plantation viewpoints & macadamia stands']
          : ['Lilongwe Wildlife Sanctuary & Cultural Craft Market in Old Town'],
        localCulinaryHighlights: isLake
          ? ['Freshly grilled Lake Malawi Chambo fish served with nsima and batala', 'Locally caught Kampango fillet with lemon butter']
          : isHighlands
          ? ['Single-estate Satemwa green and black loose-leaf tea', 'Highland honey and farm-fresh artisanal cheeses']
          : ['Traditional Nsima served with tender beef stew, pumpkin leaves, and peri-peri relish'],
        mustDoActivities: isLake
          ? ['Guided snorkeling at Thumbi Island to see colorful endemic Mbuna cichlids', 'Sunset wooden dhow or catamaran sailing cruise']
          : isSafari
          ? ['Early morning 4x4 open-top game drive & afternoon river boat safari', 'Guided bush walk with professional park rangers']
          : ['Hike to Emperor’s View and Queen’s View on Zomba Plateau', 'Mountain biking or tea estate walking trails'],
        practicalTip: isLake
          ? 'Pack water shoes for rocky shorelines and carry cash (MK Kwacha) for fresh fish purchases from local fishermen.'
          : isSafari
          ? 'Neutral colored clothing (khaki/green) is recommended. High clearance 4x4 recommended for park tracks.'
          : 'Highland evenings turn chilly—bring a light fleece or warm layer.'
      };
    });

    const fallback: AIPlannerInsights = {
      summary: `A captivating ${totalDays}-day journey across Malawi—The Warm Heart of Africa. Traversing diverse ecosystems from pristine freshwater shores to wildlife sanctuaries and mountain plateaus.`,
      recommendedDurationDays: totalDays,
      routePacing: {
        pacingAdvice: 'Pace your travel with 2–3 nights per destination to avoid travel fatigue and allow relaxed morning activities.',
        backtrackingWarning: 'Route follows standard inter-district arteries (M1/M5).'
      },
      legs: legsData,
      roadTripLogistics: {
        vehicleRecommendation: 'Standard 2WD sedan suitable for paved highways (M1, M5, M3). 4x4 with high ground clearance advised for national parks and steep plateau climbs.',
        roadConditionsAdvice: 'Daylight driving (06:00 to 18:00) is strongly recommended. Observe speed limits (50 km/h in townships, 80 km/h open road) and friendly police checkpoints.',
        paymentAndCurrencyAdvice: 'Major lodges accept VISA and Mastercard. Carry cash in Malawi Kwacha (MK) or use Airtel Money / TNM Mpamba for rural fuel stations, park entry tips, and craft markets.',
        healthAndSafetyTips: [
          'Take recommended malarial prophylaxis (Malarone or Doxycycline) and apply DEET insect repellent at dusk.',
          'Drink bottled, filtered, or boiled water.',
          'Always keep vehicle doors locked at busy city traffic junctions.'
        ],
        packingChecklist: [
          'High quality binoculars for wildlife and bird watching',
          'Snorkel mask & water shoes for Lake Malawi shores',
          'Light fleece / windbreaker for cool plateau evenings',
          'Type G UK-style 3-pin plug adapter and USB power bank',
          'Cash in Malawi Kwacha (MK) for roadside markets'
        ]
      },
      seasonalAdvice: {
        bestSeason: 'May to October (Dry Season with sunny blue skies, low humidity, and prime safari viewing).',
        weatherNotes: 'Daytime temperatures range between 25°C–31°C at the lake, and 14°C–22°C in the highlands.',
        lakeConditions: 'Crystal-clear water visibility and calm surface conditions.',
        wildlifeVisibility: 'Animals congregate around permanent waterholes and rivers.'
      },
      estimatedBudgetGuidance: {
        transitFuelEstimateUSD: '$70–$140 (approx)',
        transitFuelEstimateMWK: 'MK 120,000–MK 245,000',
        dailyFoodPerPersonUSD: '$25–$50 per day',
        dailyFoodPerPersonMWK: 'MK 40,000–MK 90,000 per day',
        parkAndConservationFeesNotes: 'National park day entry fees range from $20 to $30 for international visitors ($10 SADC / MK 5,000 residents).'
      },
      provider: 'offline-curated',
      model: 'travel-malawi-knowledge-base'
    };

    setAiInsights(fallback);
  };

  // Concierge Chat Submit
  const handleSendChatMessage = async (msgToSend?: string) => {
    const message = msgToSend || chatInput;
    if (!message.trim()) return;

    const newHistory = [...conciergeMessages, { role: 'user' as const, content: message }];
    setConciergeMessages(newHistory);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch('/api/ai/planner-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: message,
          hotels: orderedHotels.map(h => ({ id: h.id, name: h.name, location: h.location, category: (h as any).category || (h as any).propertyType || 'Lodge' })),
          history: newHistory
        })
      });

      if (!res.ok) {
        throw new Error('AI Concierge could not respond at this moment.');
      }

      const data = await res.json();
      setConciergeMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer,
          suggestedQuestions: data.suggestedQuestions
        }
      ]);
    } catch (err: any) {
      console.warn('Chat error:', err);
      setConciergeMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `Regarding your journey through ${orderedHotels.map(h => h.name).slice(0, 3).join(', ')}: Road conditions along the primary corridors (M1 spine and M5 lake highway) are well-paved tarmac. When driving, daytime travel is recommended, and carrying local Malawi Kwacha (MK) cash or Airtel Money ensures seamless transactions at fuel stops and markets.`
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Apply AI Suggested Order
  const applyAISuggestedOrder = () => {
    if (!aiInsights?.routePacing?.recommendedOrderIds) return;
    const orderMap = new Map(aiInsights.routePacing.recommendedOrderIds.map((id, index) => [id, index]));
    
    const sorted = [...orderedHotels].sort((a, b) => {
      const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 999;
      const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 999;
      return idxA - idxB;
    });

    setOrderedHotels(sorted);
    toast.success('Applied AI-optimized route order!');
  };

  // Group hotels by region
  const regionalGroups = useMemo(() => {
    const map = new Map<string, { info: ReturnType<typeof getMalawiRegion>; items: Hotel[] }>();
    orderedHotels.forEach(h => {
      const reg = getMalawiRegion(h.location);
      if (!map.has(reg.name)) {
        map.set(reg.name, { info: reg, items: [] });
      }
      map.get(reg.name)!.items.push(h);
    });
    return Array.from(map.entries()).map(([regionName, data]) => ({
      name: regionName,
      info: data.info,
      hotels: data.items
    }));
  }, [orderedHotels]);

  // Total estimated nights
  const estimatedDays = aiInsights?.recommendedDurationDays || Math.max(3, orderedHotels.length * 2);

  // Move itinerary stop up/down
  const moveStop = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= orderedHotels.length) return;
    const updated = [...orderedHotels];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIdx, 0, moved);
    setOrderedHotels(updated);
    toast.success('Itinerary order updated');
  };

  // D3 Visualization Simulation
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || orderedHotels.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = 480;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', '100%').attr('height', height);

    // Prepare node data
    const nodes = orderedHotels.map((h, i) => {
      const reg = getMalawiRegion(h.location);
      const images = getHotelImages(h);
      return {
        id: h.id,
        name: h.name,
        location: h.location,
        featuredImage: images[0] || '',
        region: reg.name,
        regionColor: reg.color,
        regionBg: reg.bg,
        stopIndex: i + 1,
        radius: 32,
        x: (width / (orderedHotels.length + 1)) * (i + 1),
        y: height / 2 + (i % 2 === 0 ? -30 : 30)
      };
    });

    // Sequential itinerary links
    const links: { source: any; target: any; label: string }[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      const transit = getTransitEstimate(nodes[i].region, nodes[i + 1].region);
      links.push({
        source: nodes[i],
        target: nodes[i + 1],
        label: transit.time
      });
    }

    // Force simulation
    const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2 + 10))
      .force('collide', d3.forceCollide().radius(44).iterations(3))
      .force('x', d3.forceX((d: any) => (width / (nodes.length + 1)) * d.stopIndex).strength(0.5))
      .force('y', d3.forceY(height / 2 + 15).strength(0.2));

    // Defs for gradients & drop shadows
    const defs = svg.append('defs');
    const filter = defs.append('filter').attr('id', 'planner-shadow').attr('height', '130%');
    filter.append('feDropShadow').attr('dx', '0').attr('dy', '3').attr('stdDeviation', '4').attr('flood-opacity', '0.12');

    // Arrow markers
    defs.append('marker')
      .attr('id', 'route-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 38)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#059669');

    // Container for links
    const linkGroup = svg.append('g').attr('class', 'links');

    const linkPaths = linkGroup.selectAll('g.link-item')
      .data(links)
      .join('g')
      .attr('class', 'link-item');

    const linkLines = linkPaths.append('line')
      .attr('stroke', '#10b981')
      .attr('stroke-width', 2.5)
      .attr('stroke-dasharray', '6,6')
      .attr('marker-end', 'url(#route-arrow)');

    // Link transit pill
    const linkBadges = linkPaths.append('g').attr('class', 'link-badge cursor-default');
    
    linkBadges.append('rect')
      .attr('rx', 10)
      .attr('ry', 10)
      .attr('fill', '#ffffff')
      .attr('stroke', '#d1fae5')
      .attr('stroke-width', 1.5)
      .attr('filter', 'url(#planner-shadow)')
      .attr('height', 20);

    const linkText = linkBadges.append('text')
      .text((d: any) => `🚗 ${d.label}`)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', '#065f46')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('font-family', 'sans-serif');

    linkText.each(function(this: SVGTextElement) {
      const textWidth = this.getComputedTextLength();
      const parent = d3.select(this.parentNode as SVGGElement);
      parent.select('rect')
        .attr('width', textWidth + 16)
        .attr('x', -(textWidth + 16) / 2)
        .attr('y', -10);
    });

    // Tooltip
    const tooltip = d3.select(container)
      .selectAll('.planner-tooltip')
      .data([null])
      .join('div')
      .attr('class', 'planner-tooltip absolute hidden bg-stone-900 text-white text-xs p-3 rounded-2xl shadow-xl z-30 pointer-events-none transition-all duration-150 border border-stone-800');

    // Nodes container
    const nodeGroup = svg.append('g').attr('class', 'nodes');

    const node = nodeGroup.selectAll('g.node')
      .data(nodes)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d: any) => {
        setSelectedLodgeId(d.id);
        
        d3.select(event.currentTarget).select('.main-circle')
          .transition().duration(150)
          .attr('transform', 'scale(1.1)')
          .attr('stroke-width', 3.5);

        const bounds = container.getBoundingClientRect();
        const mouseX = event.clientX - bounds.left;
        const mouseY = event.clientY - bounds.top;

        tooltip.classed('hidden', false)
          .html(`
            <div class="flex items-center gap-2 mb-1">
              <span class="bg-emerald-500 text-stone-950 font-bold px-1.5 py-0.5 rounded text-[10px]">Stop ${d.stopIndex}</span>
              <span class="font-bold text-stone-200 text-xs">${d.region}</span>
            </div>
            <div class="font-serif font-bold text-sm text-white">${d.name}</div>
            <div class="text-[11px] text-stone-400 flex items-center gap-1 mt-0.5">
              <span>📍 ${d.location || 'Malawi'}</span>
            </div>
            <div class="mt-2 pt-2 border-t border-stone-800 flex items-center justify-between text-[11px]">
              <span class="text-stone-400">Direct booking • 0% Commission</span>
              <span class="text-emerald-400 font-semibold">Click to View &rarr;</span>
            </div>
          `)
          .style('left', `${Math.min(mouseX + 15, width - 220)}px`)
          .style('top', `${Math.max(10, mouseY - 70)}px`);
      })
      .on('mousemove', (event) => {
        const bounds = container.getBoundingClientRect();
        const mouseX = event.clientX - bounds.left;
        const mouseY = event.clientY - bounds.top;
        tooltip
          .style('left', `${Math.min(mouseX + 15, width - 220)}px`)
          .style('top', `${Math.max(10, mouseY - 70)}px`);
      })
      .on('mouseleave', (event) => {
        setSelectedLodgeId(null);
        d3.select(event.currentTarget).select('.main-circle')
          .transition().duration(150)
          .attr('transform', 'scale(1.0)')
          .attr('stroke-width', 2);
        tooltip.classed('hidden', true);
      })
      .on('click', (event, d: any) => {
        navigate(`/hotel/${d.id}`);
      });

    // Node Outer Ring
    node.append('circle')
      .attr('class', 'main-circle transition-all')
      .attr('r', (d: any) => d.radius)
      .attr('fill', '#ffffff')
      .attr('stroke', (d: any) => d.regionColor)
      .attr('stroke-width', 2.5)
      .attr('filter', 'url(#planner-shadow)');

    // Inner Stop Badge
    node.append('circle')
      .attr('r', 12)
      .attr('cx', 0)
      .attr('cy', -10)
      .attr('fill', (d: any) => d.regionColor);

    node.append('text')
      .text((d: any) => `${d.stopIndex}`)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('y', -10)
      .attr('fill', '#ffffff')
      .attr('font-size', '11px')
      .attr('font-weight', 'bold')
      .attr('font-family', 'sans-serif');

    // Lodge Monogram
    node.append('text')
      .text((d: any) => d.name.substring(0, 1).toUpperCase())
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('y', 10)
      .attr('fill', '#1c1917')
      .attr('font-size', '13px')
      .attr('font-weight', 'bold')
      .attr('font-family', 'serif');

    // Bottom Label
    const labelGroup = node.append('g').attr('transform', 'translate(0, 44)');
    
    labelGroup.append('rect')
      .attr('rx', 6)
      .attr('ry', 6)
      .attr('fill', '#ffffff')
      .attr('stroke', '#e7e5e4')
      .attr('stroke-width', 1)
      .attr('height', 20)
      .attr('filter', 'url(#planner-shadow)');

    const nodeLabelText = labelGroup.append('text')
      .text((d: any) => d.name.length > 18 ? `${d.name.substring(0, 16)}…` : d.name)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', '#292524')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('font-family', 'sans-serif');

    nodeLabelText.each(function(this: SVGTextElement) {
      const textWidth = this.getComputedTextLength();
      const parent = d3.select(this.parentNode as SVGGElement);
      parent.select('rect')
        .attr('width', textWidth + 12)
        .attr('x', -(textWidth + 12) / 2)
        .attr('y', -10);
    });

    // Simulation tick loop
    simulation.on('tick', () => {
      linkLines
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      linkBadges.attr('transform', (d: any) => {
        const midX = (d.source.x + d.target.x) / 2;
        const midY = (d.source.y + d.target.y) / 2;
        return `translate(${midX},${midY})`;
      });

      node.attr('transform', (d: any) => {
        d.x = Math.max(d.radius + 30, Math.min(width - d.radius - 30, d.x));
        d.y = Math.max(d.radius + 30, Math.min(height - d.radius - 55, d.y));
        return `translate(${d.x},${d.y})`;
      });
    });

    node.attr('opacity', 0)
      .transition()
      .duration(600)
      .attr('opacity', 1);

    return () => {
      simulation.stop();
      tooltip.remove();
    };
  }, [orderedHotels, navigate]);

  // Share / Copy Itinerary Summary
  const copyItinerarySummary = () => {
    let text = `🇲🇼 Travel Malawi Road Trip Itinerary\n`;
    text += `Total Stops: ${orderedHotels.length} Stays | Estimated Duration: ${estimatedDays} Days\n\n`;
    text += `Route Sequence:\n`;
    orderedHotels.forEach((h, i) => {
      const reg = getMalawiRegion(h.location);
      text += `  Stop ${i + 1}: ${h.name} (${reg.name}) - 📍 ${h.location || 'Malawi'}\n`;
      if (i < orderedHotels.length - 1) {
        const transit = getTransitEstimate(reg.name, getMalawiRegion(orderedHotels[i + 1].location).name);
        text += `    🚗 Drive to next stop: ${transit.time} (${transit.distance}) - ${transit.advice}\n`;
      }
    });

    if (aiInsights) {
      text += `\n✨ AI Journey Overview:\n${aiInsights.summary}\n`;
      text += `\n🚙 Vehicle Advice: ${aiInsights.roadTripLogistics.vehicleRecommendation}\n`;
      text += `💳 Currency & Payment: ${aiInsights.roadTripLogistics.paymentAndCurrencyAdvice}\n`;
    }

    text += `\nBook direct with 0% commission on Travel Malawi: ${window.location.origin}/saved`;

    navigator.clipboard.writeText(text);
    setCopiedShare(true);
    toast.success('Complete itinerary copied to clipboard!');
    setTimeout(() => setCopiedShare(false), 3000);
  };

  const printItinerary = () => {
    window.print();
  };

  return (
    <div className="space-y-8">
      
      {/* 1. Header & AI Trip Planner Badge */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/90 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-emerald-50 via-teal-50/40 to-transparent rounded-full -mr-20 -mt-20 pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100/80 text-emerald-900 border border-emerald-200">
                <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                <span>AI-Powered Journey Planner</span>
              </span>
              <span className="text-xs text-stone-500 font-medium">
                {orderedHotels.length} {orderedHotels.length === 1 ? 'Stop' : 'Stops'} • ~{estimatedDays} Days Recommended
              </span>
              {aiStatus?.available && (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 flex items-center gap-1">
                  <Bot className="w-3 h-3" />
                  <span>AI Copilot Active ({aiStatus.activeProvider || 'Gemini'})</span>
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 tracking-tight">
              Malawi Road-Trip &amp; Itinerary Architect
            </h2>
            <p className="text-stone-500 text-sm max-w-2xl leading-relaxed">
              Plan, pace, and visualize your custom journey across Malawi. Get AI-driven road insights, hidden gems, roadside stops, dining specialties, and logistics.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => generateAIInsights()}
              disabled={aiLoading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 text-white hover:bg-stone-800 text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {aiLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Generating AI Insights…</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>{aiInsights ? 'Refresh AI Insights' : 'Generate AI Insights'}</span>
                </>
              )}
            </button>

            <button
              onClick={copyItinerarySummary}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200/80 text-stone-700 text-xs sm:text-sm font-bold border border-stone-200 transition cursor-pointer"
            >
              {copiedShare ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 text-stone-600" />
                  <span>Share Itinerary</span>
                </>
              )}
            </button>

            <button
              onClick={printItinerary}
              className="inline-flex items-center gap-1.5 p-2.5 rounded-xl bg-stone-100 hover:bg-stone-200/80 text-stone-700 text-xs font-bold border border-stone-200 transition cursor-pointer"
              title="Print Itinerary / Save PDF"
            >
              <Printer className="w-4 h-4 text-stone-600" />
            </button>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="mt-8 pt-6 border-t border-stone-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 bg-stone-100 p-1.5 rounded-2xl border border-stone-200/80">
            <button
              onClick={() => setActiveTab('visualizer')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-bold rounded-xl transition ${
                activeTab === 'visualizer' 
                  ? 'bg-white text-stone-900 shadow-xs' 
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>Route Map</span>
            </button>

            <button
              onClick={() => setActiveTab('itinerary')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-bold rounded-xl transition ${
                activeTab === 'itinerary' 
                  ? 'bg-white text-stone-900 shadow-xs' 
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <ListOrdered className="w-4 h-4 text-emerald-600" />
              <span>Step-by-Step Legs</span>
              <span className="bg-stone-200 text-stone-700 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
                {orderedHotels.length}
              </span>
            </button>

            <button
              onClick={() => {
                if (!aiInsights) {
                  generateAIInsights();
                } else {
                  setActiveTab('ai_insights');
                }
              }}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-bold rounded-xl transition ${
                activeTab === 'ai_insights' 
                  ? 'bg-white text-stone-900 shadow-xs' 
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>AI Journey Insights</span>
              {aiInsights && (
                <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  Ready
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('ai_concierge')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-bold rounded-xl transition ${
                activeTab === 'ai_concierge' 
                  ? 'bg-white text-stone-900 shadow-xs' 
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Bot className="w-4 h-4 text-teal-600" />
              <span>Ask AI Concierge</span>
            </button>
          </div>

          {/* Regional Legend Summary */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {regionalGroups.map(grp => (
              <span 
                key={grp.name}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold"
                style={{ backgroundColor: grp.info.bg, borderColor: grp.info.borderColor, color: grp.info.color }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: grp.info.color }} />
                <span>{grp.name} ({grp.hotels.length})</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: VISUALIZER ROUTE MAP (D3 Dynamic Interactive Graph) */}
      {/* ========================================================================= */}
      {activeTab === 'visualizer' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-stone-200/90 shadow-xs p-4 sm:p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-emerald-600" />
                <h3 className="font-serif font-bold text-stone-900 text-lg">Interactive Route &amp; Transit Flow</h3>
              </div>
              <p className="text-xs text-stone-400 hidden sm:block">
                Hover over nodes to see lodge details • Sequential driving times calculated via official highway routes
              </p>
            </div>

            {/* D3 Canvas Container */}
            <div 
              ref={containerRef}
              className="relative w-full h-[480px] bg-stone-50/60 rounded-2xl border border-stone-200/70 flex items-center justify-center overflow-hidden"
            >
              <svg ref={svgRef} className="w-full h-full" />
            </div>

            {/* Helper Info Footer */}
            <div className="mt-4 pt-4 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-stone-500 gap-2 px-2">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Sequential Itinerary Legs</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                  <span>Lake Retreats</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>Highlands &amp; Safari</span>
                </span>
              </div>
              <span className="font-mono text-stone-400 text-[11px]">
                Click any lodge node on map to view details &amp; direct booking
              </span>
            </div>
          </div>

          {/* Quick AI Insight Prompt Banner */}
          {!aiInsights && (
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-amber-50 rounded-3xl p-6 border border-emerald-200/80 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-serif font-bold text-stone-900 text-base">Want AI-tailored journey recommendations?</h4>
                  <p className="text-stone-600 text-xs mt-0.5">
                    Generate roadside hidden gems, fresh Chambo dining spots, 4x4 clearance guidance, and dual-currency budgets for your selected stops.
                  </p>
                </div>
              </div>
              <button
                onClick={() => generateAIInsights()}
                disabled={aiLoading}
                className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition shrink-0 cursor-pointer disabled:opacity-50"
              >
                {aiLoading ? 'Analyzing Route…' : 'Generate Full AI Insights'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: STEP-BY-STEP ITINERARY */}
      {/* ========================================================================= */}
      {activeTab === 'itinerary' && (
        <div className="bg-white rounded-3xl border border-stone-200/90 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
            <div>
              <h3 className="font-serif font-bold text-stone-900 text-xl">Sequential Travel Legs</h3>
              <p className="text-stone-500 text-xs mt-0.5">
                Reorder your stops to minimize driving time or align with your flight dates.
              </p>
            </div>

            {aiInsights?.routePacing?.recommendedOrderIds && (
              <button
                onClick={applyAISuggestedOrder}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 hover:bg-amber-100 text-xs font-bold transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Apply AI-Optimized Sequence</span>
              </button>
            )}
          </div>

          <div className="space-y-3">
            {orderedHotels.map((hotel, index) => {
              const reg = getMalawiRegion(hotel.location);
              const nextHotel = orderedHotels[index + 1];
              const transit = nextHotel ? getTransitEstimate(reg.name, getMalawiRegion(nextHotel.location).name) : null;
              const isLast = index === orderedHotels.length - 1;
              const images = getHotelImages(hotel);

              return (
                <React.Fragment key={hotel.id || index}>
                  <div className="flex items-start gap-4 p-4 sm:p-5 rounded-2xl bg-stone-50 border border-stone-200/90 hover:border-stone-300 transition">
                    
                    {/* Stop Number Circle */}
                    <div 
                      className="w-10 h-10 rounded-2xl text-white font-bold font-mono flex items-center justify-center shrink-0 shadow-xs text-sm"
                      style={{ backgroundColor: reg.color }}
                    >
                      {index + 1}
                    </div>

                    {/* Lodge Image Thumbnail */}
                    {images[0] && (
                      <img 
                        src={images[0]} 
                        alt={hotel.name}
                        className="w-16 h-16 rounded-xl object-cover border border-stone-200 hidden sm:block shrink-0" 
                        referrerPolicy="no-referrer"
                      />
                    )}

                    {/* Lodge Information */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span 
                          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                          style={{ backgroundColor: reg.bg, borderColor: reg.borderColor, color: reg.color }}
                        >
                          {reg.name}
                        </span>
                        <span className="text-xs text-stone-500">📍 {hotel.location || 'Malawi'}</span>
                      </div>

                      <h4 className="font-serif font-bold text-base sm:text-lg text-stone-900">
                        {hotel.name}
                      </h4>

                      <p className="text-xs text-stone-500 mt-0.5">
                        Recommended stay: <strong>2–3 nights</strong> • Direct Host Booking (0% Commission)
                      </p>

                      <div className="mt-3 flex items-center gap-3">
                        <Link
                          to={`/hotel/${hotel.id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                        >
                          <span>View Property &amp; Book</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>

                    {/* Sequence Controls */}
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveStop(index, 'up')}
                        className={`p-1.5 rounded-lg border transition ${
                          index === 0 
                            ? 'opacity-30 border-stone-200 text-stone-300 cursor-not-allowed' 
                            : 'border-stone-300 text-stone-600 hover:bg-white hover:text-stone-900'
                        }`}
                        title="Move Stop Earlier in Route"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={isLast}
                        onClick={() => moveStop(index, 'down')}
                        className={`p-1.5 rounded-lg border transition ${
                          isLast 
                            ? 'opacity-30 border-stone-200 text-stone-300 cursor-not-allowed' 
                            : 'border-stone-300 text-stone-600 hover:bg-white hover:text-stone-900'
                        }`}
                        title="Move Stop Later in Route"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Inter-Stop Transit Connector */}
                  {transit && nextHotel && (
                    <div className="flex items-center gap-3 pl-6 sm:pl-8 py-1">
                      <div className="w-0.5 h-10 bg-emerald-200" />
                      <div className="flex-1 flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-xs text-emerald-900">
                        <Car className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span className="font-bold">Next Leg:</span>
                        <span>{hotel.name} &rarr; {nextHotel.name}</span>
                        <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-emerald-200 text-[11px] text-emerald-800">
                          {transit.time} ({transit.distance})
                        </span>
                        <span className="text-emerald-700 text-[11px] hidden sm:inline">
                          — {transit.advice}
                        </span>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: AI JOURNEY INSIGHTS (Deep Intelligence Engine) */}
      {/* ========================================================================= */}
      {activeTab === 'ai_insights' && (
        <div className="space-y-8">
          
          {/* Controls Bar: Customize Style & Pacing */}
          <div className="bg-white rounded-3xl p-6 border border-stone-200/90 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-serif font-bold text-stone-900 text-lg flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-emerald-600" />
                  <span>Customize Travel Style &amp; Pacing</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Refine the AI generation for your preferred pace, focus, or travel party.
                </p>
              </div>

              <button
                onClick={() => generateAIInsights(tripStyle, pace, customQuestion)}
                disabled={aiLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50 shrink-0"
              >
                {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span>Regenerate Insights</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {/* Style Selector */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">Travel Focus / Style</label>
                <select
                  value={tripStyle}
                  onChange={(e) => {
                    setTripStyle(e.target.value);
                    generateAIInsights(e.target.value, pace, customQuestion);
                  }}
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs font-medium text-stone-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  <option value="balanced">🌿 Balanced (Safari + Lake + Culture)</option>
                  <option value="safari_wildlife">🦁 Safari &amp; Wildlife Expedition</option>
                  <option value="lake_leisure">🌅 Lake Malawi Watersports &amp; Beaches</option>
                  <option value="scenic_highlands">⛰️ Highlands Trekking &amp; Tea Estates</option>
                  <option value="romantic">🥂 Romantic Honeymoon &amp; Scenic Lodges</option>
                  <option value="family">👨‍👩‍👧 Family-Friendly &amp; Gentle Pacing</option>
                  <option value="budget">🎒 Adventure &amp; Backpacker Friendly</option>
                </select>
              </div>

              {/* Pacing */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">Pacing Preference</label>
                <div className="grid grid-cols-3 gap-1 bg-stone-50 p-1 rounded-xl border border-stone-200">
                  <button
                    type="button"
                    onClick={() => { setPace('relaxed'); generateAIInsights(tripStyle, 'relaxed', customQuestion); }}
                    className={`py-1.5 text-xs font-bold rounded-lg transition ${pace === 'relaxed' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500'}`}
                  >
                    Relaxed
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPace('moderate'); generateAIInsights(tripStyle, 'moderate', customQuestion); }}
                    className={`py-1.5 text-xs font-bold rounded-lg transition ${pace === 'moderate' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500'}`}
                  >
                    Moderate
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPace('fast'); generateAIInsights(tripStyle, 'fast', customQuestion); }}
                    className={`py-1.5 text-xs font-bold rounded-lg transition ${pace === 'fast' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500'}`}
                  >
                    Highlights
                  </button>
                </div>
              </div>

              {/* Custom Specific Query */}
              <div className="md:col-span-2 lg:col-span-1">
                <label className="block text-xs font-bold text-stone-700 mb-1.5">Special Focus / Question</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customQuestion}
                    onChange={(e) => setCustomQuestion(e.target.value)}
                    placeholder="e.g., traveling with small kids, best fish spots"
                    className="flex-1 bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs font-medium text-stone-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => generateAIInsights(tripStyle, pace, customQuestion)}
                    className="px-3 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 transition"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* AI Content View */}
          {aiLoading ? (
            <div className="bg-white rounded-3xl p-16 border border-stone-200 text-center space-y-4">
              <div className="w-12 h-12 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin mx-auto" />
              <h4 className="font-serif font-bold text-stone-900 text-lg">AI Architect is Analyzing Your Route…</h4>
              <p className="text-stone-500 text-xs max-w-md mx-auto">
                Synthesizing highway transit estimates, roadside cultural stops, authentic Malawian culinary specialties, vehicle clearance advice, and dual-currency budgets.
              </p>
            </div>
          ) : aiInsights ? (
            <div className="space-y-6">
              
              {/* 1. Journey Summary Card */}
              <div className="bg-emerald-900 text-white rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-lg">
                <div className="relative z-10 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-emerald-300" />
                      <span className="text-xs uppercase font-bold tracking-wider text-emerald-200">
                        AI Journey Overview &amp; Route Pacing
                      </span>
                    </div>
                    <span className="bg-emerald-800/80 text-emerald-200 text-xs font-mono font-bold px-3 py-1 rounded-full border border-emerald-700">
                      ~{aiInsights.recommendedDurationDays} Days Ideal Pacing
                    </span>
                  </div>

                  <p className="text-base sm:text-lg text-emerald-50 font-serif leading-relaxed">
                    "{aiInsights.summary}"
                  </p>

                  <div className="pt-4 border-t border-emerald-800/80 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-emerald-200">
                    <div className="flex items-start gap-2">
                      <Clock className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-white">Pacing Advice:</strong> {aiInsights.routePacing.pacingAdvice}
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Navigation className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-white">Route Flow:</strong> {aiInsights.routePacing.backtrackingWarning || 'Smooth inter-district transit flow.'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Leg-by-Leg AI Deep Insights */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-serif font-bold text-stone-900 text-xl flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-emerald-600" />
                    <span>Destination &amp; Leg Intelligence</span>
                  </h4>
                  <span className="text-xs text-stone-400 font-medium">
                    {aiInsights.legs.length} Detailed Stops
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {aiInsights.legs.map((leg, index) => {
                    const reg = getMalawiRegion(leg.location);
                    return (
                      <div key={`${leg.hotelId}-${index}`} className="bg-white rounded-3xl p-6 border border-stone-200/90 shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-8 h-8 rounded-xl text-white font-bold font-mono flex items-center justify-center shrink-0 text-xs"
                              style={{ backgroundColor: reg.color }}
                            >
                              {index + 1}
                            </div>
                            <div>
                              <h5 className="font-serif font-bold text-stone-900 text-base sm:text-lg">
                                {leg.hotelName}
                              </h5>
                              <span className="text-xs text-stone-400">📍 {leg.location}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="bg-stone-100 text-stone-700 text-xs font-bold px-2.5 py-1 rounded-lg border border-stone-200">
                              {leg.recommendedNights} Nights Recommended
                            </span>
                            <Link
                              to={`/hotel/${leg.hotelId}`}
                              className="p-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                              title="View Property"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Link>
                          </div>
                        </div>

                        {/* Best time to drive */}
                        <div className="bg-stone-50 rounded-xl p-3 text-xs text-stone-700 flex items-start gap-2 border border-stone-200/60">
                          <Clock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-stone-900">Best Departure Timing:</strong> {leg.bestTimeToTravel}
                          </div>
                        </div>

                        {/* 3 Column Grid: Roadside Stops, Dining, Activities */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                          {/* Roadside stops */}
                          <div className="p-3.5 rounded-2xl bg-amber-50/50 border border-amber-200/60 space-y-2">
                            <h6 className="font-bold text-amber-900 flex items-center gap-1.5">
                              <span>🛣️ Scenic Stops &amp; Curios</span>
                            </h6>
                            <ul className="space-y-1.5 text-stone-600">
                              {leg.scenicStopsEnRoute.map((stop, sIdx) => (
                                <li key={sIdx} className="flex items-start gap-1.5">
                                  <span className="text-amber-600 font-bold">•</span>
                                  <span>{stop}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Local Culinary Highlights */}
                          <div className="p-3.5 rounded-2xl bg-orange-50/50 border border-orange-200/60 space-y-2">
                            <h6 className="font-bold text-orange-900 flex items-center gap-1.5">
                              <Utensils className="w-3.5 h-3.5 text-orange-600" />
                              <span>Local Culinary Specialties</span>
                            </h6>
                            <ul className="space-y-1.5 text-stone-600">
                              {leg.localCulinaryHighlights.map((food, fIdx) => (
                                <li key={fIdx} className="flex items-start gap-1.5">
                                  <span className="text-orange-600 font-bold">•</span>
                                  <span>{food}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Must-do activities */}
                          <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200/60 space-y-2">
                            <h6 className="font-bold text-emerald-900 flex items-center gap-1.5">
                              <span>🎯 Must-Do Activities</span>
                            </h6>
                            <ul className="space-y-1.5 text-stone-600">
                              {leg.mustDoActivities.map((act, aIdx) => (
                                <li key={aIdx} className="flex items-start gap-1.5">
                                  <span className="text-emerald-600 font-bold">•</span>
                                  <span>{act}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Local Insider Tip */}
                        {leg.practicalTip && (
                          <div className="bg-teal-50/60 rounded-xl p-3 text-xs text-teal-900 flex items-start gap-2 border border-teal-200/60">
                            <Lightbulb className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                            <div>
                              <strong className="font-bold text-teal-950">Local Insider Tip:</strong> {leg.practicalTip}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. Logistics, Packing & Budget (4 Bento Grid Cards) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Vehicle & Road Conditions */}
                <div className="bg-white rounded-3xl p-6 border border-stone-200/90 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 text-stone-900 font-serif font-bold text-lg">
                    <Car className="w-5 h-5 text-emerald-600" />
                    <span>Vehicle &amp; Highway Navigation</span>
                  </div>
                  <div className="space-y-2.5 text-xs text-stone-600 leading-relaxed">
                    <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80">
                      <strong className="text-stone-900 block mb-1">Recommended Vehicle:</strong>
                      {aiInsights.roadTripLogistics.vehicleRecommendation}
                    </div>
                    <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80">
                      <strong className="text-stone-900 block mb-1">Highway &amp; Checkpoint Etiquette:</strong>
                      {aiInsights.roadTripLogistics.roadConditionsAdvice}
                    </div>
                  </div>
                </div>

                {/* Payments & Currency */}
                <div className="bg-white rounded-3xl p-6 border border-stone-200/90 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 text-stone-900 font-serif font-bold text-lg">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                    <span>Dual-Currency &amp; Budget Guidance</span>
                  </div>
                  <div className="space-y-2.5 text-xs text-stone-600">
                    <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80">
                      <strong className="text-stone-900 block mb-1">Currency &amp; Mobile Money:</strong>
                      {aiInsights.roadTripLogistics.paymentAndCurrencyAdvice}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                        <span className="text-[10px] text-emerald-800 uppercase font-bold block">Estimated Transit Fuel</span>
                        <strong className="text-stone-900 font-mono text-xs">{aiInsights.estimatedBudgetGuidance.transitFuelEstimateUSD}</strong>
                        <span className="text-[11px] text-stone-500 block font-mono">({aiInsights.estimatedBudgetGuidance.transitFuelEstimateMWK})</span>
                      </div>
                      <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                        <span className="text-[10px] text-emerald-800 uppercase font-bold block">Daily Food / Person</span>
                        <strong className="text-stone-900 font-mono text-xs">{aiInsights.estimatedBudgetGuidance.dailyFoodPerPersonUSD}</strong>
                        <span className="text-[11px] text-stone-500 block font-mono">({aiInsights.estimatedBudgetGuidance.dailyFoodPerPersonMWK})</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-stone-400">
                      {aiInsights.estimatedBudgetGuidance.parkAndConservationFeesNotes}
                    </p>
                  </div>
                </div>

                {/* Seasonality & Weather */}
                <div className="bg-white rounded-3xl p-6 border border-stone-200/90 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 text-stone-900 font-serif font-bold text-lg">
                    <Sun className="w-5 h-5 text-amber-500" />
                    <span>Seasonality &amp; Climate</span>
                  </div>
                  <div className="space-y-2 text-xs text-stone-600 leading-relaxed">
                    <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200/60">
                      <strong className="text-amber-950 block mb-0.5">Prime Window:</strong>
                      {aiInsights.seasonalAdvice.bestSeason}
                    </div>
                    <p><strong>Weather Notes:</strong> {aiInsights.seasonalAdvice.weatherNotes}</p>
                    {aiInsights.seasonalAdvice.lakeConditions && (
                      <p><strong>Lake Water Clarity:</strong> {aiInsights.seasonalAdvice.lakeConditions}</p>
                    )}
                    {aiInsights.seasonalAdvice.wildlifeVisibility && (
                      <p><strong>Wildlife Viewing:</strong> {aiInsights.seasonalAdvice.wildlifeVisibility}</p>
                    )}
                  </div>
                </div>

                {/* Smart Interactive Packing Checklist */}
                <div className="bg-white rounded-3xl p-6 border border-stone-200/90 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 text-stone-900 font-serif font-bold text-lg">
                    <Luggage className="w-5 h-5 text-emerald-600" />
                    <span>Route Packing Checklist</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    {aiInsights.roadTripLogistics.packingChecklist.map((item, idx) => (
                      <label 
                        key={idx} 
                        className={`flex items-start gap-2 p-2 rounded-xl border transition cursor-pointer ${
                          checkedPacking[item] ? 'bg-emerald-50 border-emerald-200 text-stone-400 line-through' : 'bg-stone-50 border-stone-200 text-stone-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={!!checkedPacking[item]}
                          onChange={(e) => setCheckedPacking(prev => ({ ...prev, [item]: e.target.checked }))}
                          className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>{item}</span>
                      </label>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <div className="bg-stone-50 rounded-3xl p-12 text-center border border-dashed border-stone-300">
              <Sparkles className="w-10 h-10 text-stone-300 mx-auto mb-3" />
              <h4 className="font-serif font-bold text-stone-800 text-base">No AI Insights Generated Yet</h4>
              <p className="text-stone-500 text-xs max-w-sm mx-auto mb-4">
                Click below to let our AI architect analyze your {orderedHotels.length} chosen stops and provide tailored travel insights.
              </p>
              <button
                onClick={() => generateAIInsights()}
                className="px-5 py-2.5 rounded-xl bg-stone-900 text-white font-bold text-xs hover:bg-stone-800 transition"
              >
                Generate AI Journey Insights
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: ASK AI CONCIERGE (Interactive Route Q&A) */}
      {/* ========================================================================= */}
      {activeTab === 'ai_concierge' && (
        <div className="bg-white rounded-3xl border border-stone-200/90 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-stone-100">
            <div>
              <h3 className="font-serif font-bold text-stone-900 text-xl flex items-center gap-2">
                <Bot className="w-6 h-6 text-emerald-600" />
                <span>Malawi Journey Concierge</span>
              </h3>
              <p className="text-stone-500 text-xs mt-0.5">
                Ask specific questions about your current {orderedHotels.length}-stop route across Malawi.
              </p>
            </div>
            <span className="text-xs bg-emerald-50 text-emerald-800 font-bold px-3 py-1 rounded-full border border-emerald-200">
              Live Route Grounded
            </span>
          </div>

          {/* Quick Suggested Prompt Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-stone-400">Try Asking:</span>
            {[
              'What vehicle is required for these roads?',
              'Where is the best place to eat fresh Chambo along this drive?',
              'Are ATM machines or mobile money agents available in Cape Maclear?',
              'What are the recommended national park entry fees?'
            ].map((chip, cIdx) => (
              <button
                key={cIdx}
                onClick={() => handleSendChatMessage(chip)}
                className="px-3 py-1.5 rounded-full bg-stone-100 hover:bg-emerald-50 hover:text-emerald-900 text-stone-600 text-xs font-medium border border-stone-200 transition cursor-pointer text-left"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Chat Messages Log */}
          <div className="space-y-4 max-h-[420px] overflow-y-auto p-4 rounded-2xl bg-stone-50/70 border border-stone-200/80">
            {conciergeMessages.map((msg, mIdx) => (
              <div 
                key={mIdx} 
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs text-xs font-bold">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div 
                  className={`max-w-2xl rounded-2xl p-4 text-xs leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-stone-900 text-white rounded-br-xs font-medium' 
                      : 'bg-white text-stone-800 border border-stone-200/80 shadow-xs rounded-bl-xs'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.content}</p>

                  {/* Follow up suggestions */}
                  {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-stone-100 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Suggested Follow-ups:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.suggestedQuestions.map((q, qIdx) => (
                          <button
                            key={qIdx}
                            onClick={() => handleSendChatMessage(q)}
                            className="text-[11px] bg-stone-50 hover:bg-emerald-50 text-stone-600 hover:text-emerald-800 px-2.5 py-1 rounded-lg border border-stone-200 transition"
                          >
                            &rarr; {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex gap-3 justify-start items-center text-xs text-stone-500">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
                <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-xs">
                  Thinking &amp; analyzing your itinerary…
                </div>
              </div>
            )}
          </div>

          {/* Chat Input Bar */}
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSendChatMessage(); }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask anything about driving times, local food, boat rentals, or wildlife…"
              className="flex-1 bg-stone-50 border border-stone-300 rounded-2xl px-4 py-3 text-xs font-medium text-stone-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
            <button
              type="submit"
              disabled={chatLoading || !chatInput.trim()}
              className="px-5 py-3 rounded-2xl bg-stone-900 text-white hover:bg-stone-800 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Ask</span>
            </button>
          </form>
        </div>
      )}

      {/* 4. Practical Travel Logistics Guide for Malawi Road Trips */}
      <div className="bg-stone-50 rounded-3xl p-6 sm:p-8 border border-stone-200/80 space-y-4">
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5 text-emerald-700" />
          <h3 className="font-serif font-bold text-stone-900 text-lg">
            Essential Malawi Road-Trip Advice
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-stone-600">
          <div className="p-4 bg-white rounded-2xl border border-stone-200/60 space-y-1">
            <h4 className="font-bold text-stone-900 flex items-center gap-1.5">
              <span>🛣️ Main Highways (M1 &amp; M5)</span>
            </h4>
            <p className="leading-relaxed">
              The M1 provides smooth North-to-South transit, while the M5 hugs Lake Malawi’s pristine coastline. Daytime driving is recommended for the best scenic views.
            </p>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-stone-200/60 space-y-1">
            <h4 className="font-bold text-stone-900 flex items-center gap-1.5">
              <span>🚙 Vehicle Selection</span>
            </h4>
            <p className="leading-relaxed">
              Standard 2WD sedans easily reach Lilongwe, Blantyre, Zomba, and Salima. For Liwonde, Majete, or Nyika National Parks, a 4x4 with high clearance is strongly advised.
            </p>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-stone-200/60 space-y-1">
            <h4 className="font-bold text-stone-900 flex items-center gap-1.5">
              <span>💳 Direct Payments &amp; Settlement</span>
            </h4>
            <p className="leading-relaxed">
              All lodges on Travel Malawi support 0% commission direct reservations with deposit options via Airtel Money, TNM Mpamba, or international credit card.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
