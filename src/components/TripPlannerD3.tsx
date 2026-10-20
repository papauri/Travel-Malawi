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
  Share2, 
  Check, 
  ChevronUp, 
  ChevronDown, 
  Car, 
  ExternalLink,
  Layers,
  ListOrdered,
  Info,
  Wallet,
  ShieldCheck,
  Minus,
  Plus
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getHotelImages } from '../lib/images';
import { distanceKm, estimateTravelTime, isValidLatLng, isCrossingLakeMalawi, LatLng } from '../lib/geo';
import TripAIInsights from './TripAIInsights';
import { usePlatformMode } from '../contexts/PlatformModeContext';

interface Props {
  hotels: Hotel[];
}

const STORAGE_KEY = 'tm_trip_planner_v2';

interface StoredPlannerState {
  orderedIds: string[];
  nightsByHotelId: Record<string, number>;
}

// Region categorization helper for Malawi — strictly using the Stone / Emerald / Amber palette
function getMalawiRegion(location?: string): {
  name: string;
  hub: string;
  color: string;
  bg: string;
  borderColor: string;
  lat: number;
  lng: number;
} {
  const loc = (location || '').toLowerCase();

  if (
    loc.includes('cape maclear') ||
    loc.includes('mangochi') ||
    loc.includes('monkey bay') ||
    loc.includes('senga bay') ||
    loc.includes('salima') ||
    loc.includes('nkhata bay') ||
    loc.includes('chintheche') ||
    loc.includes('likoma') ||
    loc.includes('lake')
  ) {
    return {
      name: 'Lake Malawi Shores',
      hub: 'Lakeside & Beach Retreats',
      color: '#047857', // emerald-700
      bg: '#ecfdf5',
      borderColor: '#a7f3d0',
      lat: -14.01,
      lng: 34.85,
    };
  }
  if (
    loc.includes('majete') ||
    loc.includes('liwonde') ||
    loc.includes('lengwe') ||
    loc.includes('nyika') ||
    loc.includes('kasungu') ||
    loc.includes('nkhotakota') ||
    loc.includes('safari') ||
    loc.includes('game')
  ) {
    return {
      name: 'National Parks & Safari',
      hub: 'Wildlife & Nature Sanctuaries',
      color: '#b45309', // amber-700
      bg: '#fffbeb',
      borderColor: '#fde68a',
      lat: -14.85,
      lng: 35.25,
    };
  }
  if (
    loc.includes('zomba') ||
    loc.includes('mulanje') ||
    loc.includes('viphya') ||
    loc.includes('highlands') ||
    loc.includes('plateau') ||
    loc.includes('mountain')
  ) {
    return {
      name: 'Highlands & Mountains',
      hub: 'Zomba & Mount Mulanje',
      color: '#44403c', // stone-700
      bg: '#f5f5f4',
      borderColor: '#d6d3d1',
      lat: -15.38,
      lng: 35.33,
    };
  }
  if (loc.includes('blantyre') || loc.includes('thyolo') || loc.includes('limbe')) {
    return {
      name: 'Southern Hub (Blantyre)',
      hub: 'Commercial & Cultural Center',
      color: '#57534e', // stone-600
      bg: '#fafaf9',
      borderColor: '#e7e5e4',
      lat: -15.78,
      lng: 35.0,
    };
  }
  // Default Central / Lilongwe
  return {
    name: 'Central Hub (Lilongwe)',
    hub: 'Capital City & Gateway',
    color: '#1c1917', // stone-900
    bg: '#f5f5f4',
    borderColor: '#d6d3d1',
    lat: -13.98,
    lng: 33.78,
  };
}

// Returns verified hotel coordinates or falls back to regional hub coordinates
export function getHotelCoords(hotel: Hotel): LatLng {
  if (isValidLatLng(hotel.coordinates)) {
    return hotel.coordinates;
  }
  const reg = getMalawiRegion(hotel.location);
  return { lat: reg.lat, lng: reg.lng };
}

export interface LegMetrics {
  time: string;
  distanceKm: number;
  drivingMinutes: number;
  crossesLake: boolean;
  highway: string;
  advice: string;
}

// Real geo math between two hotels using distanceKm & estimateTravelTime from src/lib/geo.ts
export function getLegMetrics(fromHotel: Hotel, toHotel: Hotel): LegMetrics {
  const fromCoords = getHotelCoords(fromHotel);
  const toCoords = getHotelCoords(toHotel);
  const rawStraightKm = distanceKm(fromCoords, toCoords);
  const straightKm = rawStraightKm < 2 && fromHotel.id !== toHotel.id ? 14 : rawStraightKm;
  const crossesLake = isCrossingLakeMalawi(fromCoords, toCoords);
  const est = estimateTravelTime(straightKm, fromCoords, toCoords, toHotel.name);
  const roadKm = Math.max(5, Math.round(est.roadDistanceKm));

  const fromReg = getMalawiRegion(fromHotel.location).name;
  const toReg = getMalawiRegion(toHotel.location).name;
  const pair = [fromReg, toReg].sort().join(' ⇄ ');
  const combinedLoc = `${fromHotel.location || ''} ${toHotel.location || ''} ${fromHotel.name} ${toHotel.name}`.toLowerCase();

  let highway = 'M1 / M5';
  let advice = 'Paved inter-district highway transfer; morning departure recommended.';

  if (est.travelMode === 'boat_transfer' || combinedLoc.includes('likoma')) {
    highway = 'M5 + Boat / Ferry';
    advice = 'Drive to Nkhata Bay port via M5 lakeshore highway followed by Lake Malawi boat or MV Ilala ferry transfer.';
  } else if (crossesLake) {
    highway = 'M1 / M10 / M3';
    advice = 'Curves around southern Lake Malawi via Golomoti and Mangochi corridor (M10/M3), or arrange a lakeshore boat transfer.';
  } else if (fromReg === toReg && roadKm <= 45) {
    highway = 'Local Corridor';
    advice = 'Short regional scenic transfer between nearby stays.';
  } else if (pair.includes('Central Hub') && pair.includes('Lake Malawi')) {
    highway = combinedLoc.includes('salima') || combinedLoc.includes('senga') ? 'M14 / M5' : 'M1 / M10';
    advice = 'Smooth paved descent from Lilongwe via Salima Road (M14/M5) or Golomoti escarpment to Cape Maclear (M10).';
  } else if (pair.includes('Southern Hub') && pair.includes('Lake Malawi')) {
    highway = 'M3 / M10';
    advice = 'Scenic route through Zomba and the Shire River corridor into Mangochi and the southern lakeshore (M3/M10).';
  } else if (pair.includes('Southern Hub') && pair.includes('Highlands')) {
    highway = 'M3 / M2';
    advice = 'Tarmac drive to Zomba Plateau (M3) or across the Thyolo tea estates to Mount Mulanje (M2).';
  } else if (pair.includes('Central Hub') && pair.includes('Southern Hub')) {
    highway = 'M1 Spine';
    advice = 'Primary national spine via the M1 highway through Dedza and Ntcheu escarpment.';
  } else if (pair.includes('Safari') || pair.includes('National Parks')) {
    highway = 'M1 / M3 / M5';
    advice = 'Main highway approach via M1/M3/M5; high-clearance 4x4 recommended for park gates and game loop tracks.';
  }

  return {
    time: est.drivingTimeFormatted,
    distanceKm: roadKm,
    drivingMinutes: est.drivingMinutes,
    crossesLake,
    highway,
    advice,
  };
}

function formatTotalMinutes(minutes: number): string {
  if (minutes <= 0) return '0m';
  if (minutes < 60) return `${minutes}m`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

function readStoredPlannerState(): StoredPlannerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        orderedIds: Array.isArray(parsed?.orderedIds) ? parsed.orderedIds : [],
        nightsByHotelId:
          parsed?.nightsByHotelId && typeof parsed.nightsByHotelId === 'object'
            ? parsed.nightsByHotelId
            : {},
      };
    }
  } catch {
    // ignore storage errors
  }
  return { orderedIds: [], nightsByHotelId: {} };
}

function writeStoredPlannerState(state: StoredPlannerState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

export default function TripPlannerD3({ hotels }: Props) {
  const { bookingsEnabled } = usePlatformMode();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const navigate = useNavigate();

  const [orderedHotels, setOrderedHotels] = useState<Hotel[]>(() => {
    const stored = readStoredPlannerState();
    if (stored.orderedIds.length === 0) return hotels;
    const byId = new Map(hotels.map(h => [h.id || '', h]));
    const ordered: Hotel[] = [];
    const seen = new Set<string>();
    for (const id of stored.orderedIds) {
      const match = byId.get(id);
      if (match && !seen.has(id)) {
        ordered.push(match);
        seen.add(id);
      }
    }
    for (const h of hotels) {
      const id = h.id || '';
      if (!seen.has(id)) {
        ordered.push(h);
        seen.add(id);
      }
    }
    return ordered;
  });

  const [nightsByHotelId, setNightsByHotelId] = useState<Record<string, number>>(() => {
    const stored = readStoredPlannerState();
    const initial: Record<string, number> = { ...stored.nightsByHotelId };
    for (const h of hotels) {
      const id = h.id || '';
      if (id && (typeof initial[id] !== 'number' || initial[id] < 1)) {
        initial[id] = 2;
      }
    }
    return initial;
  });

  const [selectedLodgeId, setSelectedLodgeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'visualizer' | 'itinerary' | 'ai-insights'>('visualizer');
  const [copiedShare, setCopiedShare] = useState(false);

  // Sync when hotels prop changes, preserving saved ordering and nights per stop
  useEffect(() => {
    const stored = readStoredPlannerState();
    const byId = new Map(hotels.map(h => [h.id || '', h]));
    const nextOrdered: Hotel[] = [];
    const seen = new Set<string>();

    for (const id of stored.orderedIds) {
      const match = byId.get(id);
      if (match && !seen.has(id)) {
        nextOrdered.push(match);
        seen.add(id);
      }
    }
    for (const h of hotels) {
      const id = h.id || '';
      if (!seen.has(id)) {
        nextOrdered.push(h);
        seen.add(id);
      }
    }

    const nextNights: Record<string, number> = { ...stored.nightsByHotelId };
    for (const h of hotels) {
      const id = h.id || '';
      if (id && (typeof nextNights[id] !== 'number' || nextNights[id] < 1)) {
        nextNights[id] = 2;
      }
    }

    setOrderedHotels(nextOrdered);
    setNightsByHotelId(nextNights);
    writeStoredPlannerState({
      orderedIds: nextOrdered.map(h => h.id || '').filter(Boolean),
      nightsByHotelId: nextNights,
    });
  }, [hotels]);

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
      hotels: data.items,
    }));
  }, [orderedHotels]);

  // Real route leg metrics & totals
  const { legMetricsList, totalDistanceKm, totalDriveMinutes } = useMemo(() => {
    const legs: LegMetrics[] = [];
    let distSum = 0;
    let minsSum = 0;
    for (let i = 0; i < orderedHotels.length - 1; i++) {
      const leg = getLegMetrics(orderedHotels[i], orderedHotels[i + 1]);
      legs.push(leg);
      distSum += leg.distanceKm;
      minsSum += leg.drivingMinutes;
    }
    return {
      legMetricsList: legs,
      totalDistanceKm: distSum,
      totalDriveMinutes: minsSum,
    };
  }, [orderedHotels]);

  // Total nights dynamically computed from sum of custom nights across stops
  const totalNights = useMemo(() => {
    return orderedHotels.reduce((sum, h) => {
      const n = nightsByHotelId[h.id || ''] ?? 2;
      return sum + Math.max(1, Math.min(14, n));
    }, 0);
  }, [orderedHotels, nightsByHotelId]);

  // Update nights for a specific stop (1 to 14 nights)
  const updateStopNights = (hotelId: string | undefined, delta: number) => {
    if (!hotelId) return;
    setNightsByHotelId(prev => {
      const current = prev[hotelId] ?? 2;
      const updatedVal = Math.max(1, Math.min(14, current + delta));
      if (updatedVal === current) return prev;
      const next = { ...prev, [hotelId]: updatedVal };
      writeStoredPlannerState({
        orderedIds: orderedHotels.map(h => h.id || '').filter(Boolean),
        nightsByHotelId: next,
      });
      return next;
    });
  };

  // Move itinerary stop up/down
  const moveStop = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= orderedHotels.length) return;
    const updated = [...orderedHotels];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIdx, 0, moved);
    setOrderedHotels(updated);
    writeStoredPlannerState({
      orderedIds: updated.map(h => h.id || '').filter(Boolean),
      nightsByHotelId,
    });
    toast.success('Itinerary order updated');
  };

  // Smart Sort Route (0 AI credits): nearest-neighbor starting from northernmost stop to eliminate backtracking
  const handleSmartSortRoute = () => {
    if (orderedHotels.length <= 1) {
      toast('Add at least 2 stays to optimize your route');
      return;
    }

    const remaining = [...orderedHotels];
    // Start from the northernmost stop (largest latitude) for a clean north-to-south corridor sweep
    remaining.sort((a, b) => getHotelCoords(b).lat - getHotelCoords(a).lat);

    const sorted: Hotel[] = [remaining.shift()!];
    while (remaining.length > 0) {
      const current = sorted[sorted.length - 1];
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const leg = getLegMetrics(current, remaining[i]);
        if (leg.distanceKm < bestDist) {
          bestDist = leg.distanceKm;
          bestIdx = i;
        }
      }
      sorted.push(remaining.splice(bestIdx, 1)[0]);
    }

    let newTotalKm = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      newTotalKm += getLegMetrics(sorted[i], sorted[i + 1]).distanceKm;
    }

    setOrderedHotels(sorted);
    writeStoredPlannerState({
      orderedIds: sorted.map(h => h.id || '').filter(Boolean),
      nightsByHotelId,
    });
    toast.success(
      `Smart Sort applied — ${newTotalKm} km total route (${sorted.map(h => h.name).join(' → ')})`
    );
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
      const nights = nightsByHotelId[h.id || ''] ?? 2;
      return {
        id: h.id,
        name: h.name,
        location: h.location,
        featuredImage: images[0] || '',
        region: reg.name,
        regionColor: reg.color,
        regionBg: reg.bg,
        nights,
        stopIndex: i + 1,
        radius: 32,
        x: (width / (orderedHotels.length + 1)) * (i + 1),
        y: height / 2 + (i % 2 === 0 ? -30 : 30),
      };
    });

    // Sequential itinerary links (connecting Stop 1 -> Stop 2 -> Stop 3) using real leg metrics
    const links: { source: any; target: any; label: string }[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      const leg = getLegMetrics(orderedHotels[i], orderedHotels[i + 1]);
      links.push({
        source: nodes[i],
        target: nodes[i + 1],
        label: `${leg.time} · ${leg.distanceKm} km`,
      });
    }

    // Force simulation
    const simulation = d3
      .forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2 + 10))
      .force('collide', d3.forceCollide().radius(44).iterations(3))
      .force('x', d3.forceX((d: any) => (width / (nodes.length + 1)) * d.stopIndex).strength(0.5))
      .force('y', d3.forceY(height / 2 + 15).strength(0.2));

    // Defs for gradients & drop shadows
    const defs = svg.append('defs');
    const filter = defs.append('filter').attr('id', 'planner-shadow').attr('height', '130%');
    filter
      .append('feDropShadow')
      .attr('dx', '0')
      .attr('dy', '3')
      .attr('stdDeviation', '4')
      .attr('flood-opacity', '0.12');

    // Arrow markers for sequential links
    defs
      .append('marker')
      .attr('id', 'route-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 38)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#047857');

    // Container for links
    const linkGroup = svg.append('g').attr('class', 'links');

    const linkPaths = linkGroup
      .selectAll('g.link-item')
      .data(links)
      .join('g')
      .attr('class', 'link-item');

    const linkLines = linkPaths
      .append('line')
      .attr('stroke', '#047857')
      .attr('stroke-width', 2.2)
      .attr('stroke-dasharray', '6,6')
      .attr('marker-end', 'url(#route-arrow)');

    // Link transit pill background & text (no emojis)
    const linkBadges = linkPaths.append('g').attr('class', 'link-badge cursor-default');

    linkBadges
      .append('rect')
      .attr('rx', 10)
      .attr('ry', 10)
      .attr('fill', '#ffffff')
      .attr('stroke', '#d6d3d1')
      .attr('stroke-width', 1.5)
      .attr('filter', 'url(#planner-shadow)')
      .attr('height', 22);

    const linkText = linkBadges
      .append('text')
      .text((d: any) => d.label)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', '#1c1917')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('font-family', 'sans-serif');

    // Resize badge rect based on text
    linkText.each(function (this: SVGTextElement) {
      const textWidth = this.getComputedTextLength();
      const parent = d3.select(this.parentNode as SVGGElement);
      parent
        .select('rect')
        .attr('width', textWidth + 18)
        .attr('x', -(textWidth + 18) / 2)
        .attr('y', -11);
    });

    // Tooltip reference
    const tooltip = d3
      .select(container)
      .selectAll('.planner-tooltip')
      .data([null])
      .join('div')
      .attr(
        'class',
        'planner-tooltip absolute hidden bg-stone-900 text-white text-xs p-3.5 rounded-2xl shadow-sm z-30 pointer-events-none transition-all duration-150 border border-stone-800'
      );

    // Nodes container
    const nodeGroup = svg.append('g').attr('class', 'nodes');

    const node = nodeGroup
      .selectAll('g.node')
      .data(nodes)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d: any) => {
        setSelectedLodgeId(d.id);

        d3.select(event.currentTarget as any)
          .select('.main-circle')
          .transition()
          .duration(150)
          .attr('transform', 'scale(1.1)')
          .attr('stroke-width', 3.5);

        const bounds = container.getBoundingClientRect();
        const mouseX = event.clientX - bounds.left;
        const mouseY = event.clientY - bounds.top;

        tooltip
          .classed('hidden', false)
          .html(
            `
            <div class="flex items-center gap-2 mb-1">
              <span class="bg-emerald-600 text-white font-bold px-1.5 py-0.5 rounded text-[10px]">Stop ${d.stopIndex}</span>
              <span class="font-bold text-stone-300 text-xs">${d.region}</span>
            </div>
            <div class="font-serif font-bold text-sm text-white">${d.name}</div>
            <div class="text-[11px] text-stone-400 mt-0.5">
              <span>${d.location || 'Malawi'} · ${d.nights} ${d.nights === 1 ? 'night' : 'nights'}</span>
            </div>
            <div class="mt-2 pt-2 border-t border-stone-800 flex items-center justify-between gap-3 text-[11px]">
              <span class="text-stone-400">${bookingsEnabled ? 'Direct booking • 0% Commission' : 'Contact details on the listing'}</span>
              <span class="text-amber-400 font-semibold">Open stay &rarr;</span>
            </div>
          `
          )
          .style('left', `${Math.min(mouseX + 15, width - 240)}px`)
          .style('top', `${Math.max(10, mouseY - 75)}px`);
      })
      .on('mousemove', event => {
        const bounds = container.getBoundingClientRect();
        const mouseX = event.clientX - bounds.left;
        const mouseY = event.clientY - bounds.top;
        tooltip
          .style('left', `${Math.min(mouseX + 15, width - 240)}px`)
          .style('top', `${Math.max(10, mouseY - 75)}px`);
      })
      .on('mouseleave', event => {
        setSelectedLodgeId(null);
        d3.select(event.currentTarget as any)
          .select('.main-circle')
          .transition()
          .duration(150)
          .attr('transform', 'scale(1.0)')
          .attr('stroke-width', 2.5);
        tooltip.classed('hidden', true);
      })
      .on('click', (_event, d: any) => {
        navigate(`/hotel/${d.id}`);
      });

    // Node Outer Ring / Region Ring
    node
      .append('circle')
      .attr('class', 'main-circle transition-all')
      .attr('r', (d: any) => d.radius)
      .attr('fill', '#ffffff')
      .attr('stroke', (d: any) => d.regionColor)
      .attr('stroke-width', 2.5)
      .attr('filter', 'url(#planner-shadow)');

    // Inner Stop Badge
    node
      .append('circle')
      .attr('r', 12)
      .attr('cx', 0)
      .attr('cy', -10)
      .attr('fill', (d: any) => d.regionColor);

    node
      .append('text')
      .text((d: any) => `${d.stopIndex}`)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('y', -10)
      .attr('fill', '#ffffff')
      .attr('font-size', '11px')
      .attr('font-weight', 'bold')
      .attr('font-family', 'sans-serif');

    // Lodge Monogram
    node
      .append('text')
      .text((d: any) => d.name.substring(0, 1).toUpperCase())
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('y', 10)
      .attr('fill', '#1c1917')
      .attr('font-size', '13px')
      .attr('font-weight', 'bold')
      .attr('font-family', 'serif');

    // Bottom Label under node
    const labelGroup = node.append('g').attr('transform', 'translate(0, 44)');

    labelGroup
      .append('rect')
      .attr('rx', 6)
      .attr('ry', 6)
      .attr('fill', '#ffffff')
      .attr('stroke', '#e7e5e4')
      .attr('stroke-width', 1)
      .attr('height', 20)
      .attr('filter', 'url(#planner-shadow)');

    const nodeLabelText = labelGroup
      .append('text')
      .text((d: any) => (d.name.length > 18 ? `${d.name.substring(0, 16)}…` : d.name))
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', '#292524')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('font-family', 'sans-serif');

    nodeLabelText.each(function (this: SVGTextElement) {
      const textWidth = this.getComputedTextLength();
      const parent = d3.select(this.parentNode as SVGGElement);
      parent
        .select('rect')
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

    node.attr('opacity', 0).transition().duration(600).attr('opacity', 1);

    return () => {
      simulation.stop();
      tooltip.remove();
    };
  }, [orderedHotels, nightsByHotelId, navigate, bookingsEnabled]);

  // Share / Copy Itinerary Summary (clean text, 0 emojis)
  const copyItinerarySummary = () => {
    const legsText = orderedHotels
      .map((h, i) => {
        const nights = nightsByHotelId[h.id || ''] ?? 2;
        const stopLine = `${i + 1}. ${h.name} (${h.location || 'Malawi'}) — ${nights} ${nights === 1 ? 'night' : 'nights'}`;
        if (i < orderedHotels.length - 1) {
          const leg = getLegMetrics(h, orderedHotels[i + 1]);
          return `${stopLine}\n   Next Leg: ${leg.time} · ${leg.distanceKm} km (${leg.highway})`;
        }
        return stopLine;
      })
      .join('\n');

    const text = `My Travel Malawi Road Trip Itinerary
Total Stops: ${orderedHotels.length} Stays | Duration: ${totalNights} Nights
Total Drive: ${totalDistanceKm} km (~${formatTotalMinutes(totalDriveMinutes)})

Route Sequence:
${legsText}

${bookingsEnabled ? 'Plan and book direct at' : 'Plan your trip at'}: https://ulendomalawi.com/`;

    navigator.clipboard.writeText(text).then(
      () => {
        setCopiedShare(true);
        toast.success('Itinerary copied! Ready to share via WhatsApp or Email.');
        setTimeout(() => setCopiedShare(false), 3000);
      },
      () => toast.error('Could not copy the itinerary. Please try again.')
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. Trip Planner Header & Real Geo Summary */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-100 text-stone-800 border border-stone-200 text-xs font-bold uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5 text-emerald-700" />
              <span>Malawi Route &amp; Road Trip Builder</span>
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
              Interactive Trip Planner
            </h2>
            <p className="text-stone-600 text-sm sm:text-base leading-relaxed">
              Connects your saved stays across Malawi with real road distances, highway corridor advice, and customizable nights per stop.
            </p>
          </div>

          {/* Key Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0 bg-stone-50 p-3.5 rounded-2xl border border-stone-200/80 text-center">
            <div className="px-3 py-1">
              <span className="block text-stone-400 text-[10px] font-semibold uppercase tracking-wider">Stops</span>
              <span className="text-lg sm:text-xl font-bold text-stone-900 font-serif">{orderedHotels.length}</span>
              <span className="block text-[10px] text-stone-500">{regionalGroups.length} {regionalGroups.length === 1 ? 'hub' : 'hubs'}</span>
            </div>
            <div className="px-3 py-1 sm:border-l border-stone-200">
              <span className="block text-stone-400 text-[10px] font-semibold uppercase tracking-wider">Total Stay</span>
              <span className="text-lg sm:text-xl font-bold text-emerald-700 font-serif">{totalNights}n</span>
              <span className="block text-[10px] text-stone-500">{totalNights} {totalNights === 1 ? 'night' : 'nights'}</span>
            </div>
            <div className="px-3 py-1 sm:border-l border-stone-200">
              <span className="block text-stone-400 text-[10px] font-semibold uppercase tracking-wider">Distance</span>
              <span className="text-lg sm:text-xl font-bold text-stone-900 font-serif">{totalDistanceKm} km</span>
              <span className="block text-[10px] text-stone-500">road route</span>
            </div>
            <div className="px-3 py-1 sm:border-l border-stone-200">
              <span className="block text-stone-400 text-[10px] font-semibold uppercase tracking-wider">Drive Time</span>
              <span className="text-lg sm:text-xl font-bold text-amber-700 font-serif">{formatTotalMinutes(totalDriveMinutes)}</span>
              <span className="block text-[10px] text-stone-500">est. transit</span>
            </div>
          </div>
        </div>

        {/* View Switcher & Action Bar */}
        <div className="mt-6 pt-5 border-t border-stone-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1 bg-stone-100 p-1 rounded-2xl border border-stone-200 w-fit">
            <button
              type="button"
              onClick={() => setActiveTab('visualizer')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'visualizer'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Route Graph</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('itinerary')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'itinerary'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>Step-by-Step</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ai-insights')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'ai-insights'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Trip Insights</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {orderedHotels.length > 1 && (
              <button
                type="button"
                onClick={handleSmartSortRoute}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 text-xs font-bold transition cursor-pointer"
                title="Order stops geographically from North to South to minimize backtracking"
              >
                <Navigation className="w-3.5 h-3.5 text-emerald-700" />
                <span>Smart Sort Route</span>
              </button>
            )}

            <button
              type="button"
              onClick={copyItinerarySummary}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-stone-900 text-white text-xs font-bold hover:bg-stone-800 transition shadow-xs cursor-pointer"
            >
              {copiedShare ? <Check className="w-3.5 h-3.5 text-amber-500" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copiedShare ? 'Copied Itinerary!' : 'Share Trip Plan'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Intelligence Callout Banner (when on Visualizer or Itinerary tab) */}
      {activeTab !== 'ai-insights' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-3xl bg-stone-50 border border-stone-200 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-stone-900 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Compass className="w-4 h-4 text-stone-200" />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-bold text-stone-900 block">
                Day-by-Day Route Blueprint &amp; Field Logistics
              </span>
              <span className="text-[11px] sm:text-xs text-stone-600">
                View sequenced daily activities, highway stopovers, and regional packing guidance for your {totalNights}-night itinerary.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('ai-insights')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition shadow-xs shrink-0 cursor-pointer w-fit"
          >
            <span>Open Trip Insights</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Main Content View: Trip Insights vs Visualizer vs Step-by-Step */}
      {activeTab === 'ai-insights' ? (
        <TripAIInsights
          hotels={orderedHotels}
          nightsByHotel={nightsByHotelId}
          onOpenListing={id => navigate(`/hotel/${id}`)}
        />
      ) : activeTab === 'visualizer' ? (
        <div className="space-y-4">
          {/* D3 Route Map Canvas Card */}
          <div
            ref={containerRef}
            className="relative w-full rounded-3xl bg-white border border-stone-200 overflow-hidden shadow-xs p-4 sm:p-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-2 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                <h3 className="text-sm font-bold text-stone-900">
                  Regional Travel Route &amp; Leg Estimates
                </h3>
              </div>
              <span className="text-xs text-stone-500">
                Hover over nodes to inspect stay details • Click any node to view property
              </span>
            </div>

            {/* SVG Visualizer Canvas */}
            <div className="w-full bg-[#FAF8F5] rounded-2xl border border-stone-200/60 overflow-hidden">
              <svg ref={svgRef} className="w-full h-[400px] sm:h-[480px] select-none block" />
            </div>

            {/* Regional Legend Footer */}
            <div className="mt-4 pt-3 flex flex-wrap items-center justify-center gap-3 text-xs">
              <span className="text-stone-400 font-medium">Regional Hubs:</span>
              {regionalGroups.map((group, gIdx) => (
                <div
                  key={`${group.name || 'group'}-${gIdx}`}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold"
                  style={{
                    backgroundColor: group.info.bg,
                    borderColor: group.info.borderColor,
                    color: group.info.color,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: group.info.color }}
                  />
                  <span>
                    {group.name} ({group.hotels.length})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Step-by-Step Itinerary View */
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-serif font-bold text-stone-900">
                Step-by-Step Route Sequence
              </h3>
              <p className="text-stone-500 text-xs sm:text-sm mt-0.5">
                Adjust nights per stop (1–14) or reorder stops to see updated highway distances and driving times.
              </p>
            </div>
            {orderedHotels.length > 1 && (
              <button
                type="button"
                onClick={handleSmartSortRoute}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 text-xs font-bold transition cursor-pointer w-fit"
              >
                <Navigation className="w-3.5 h-3.5 text-emerald-700" />
                <span>Smart Sort Route</span>
              </button>
            )}
          </div>

          <div className="space-y-4">
            {orderedHotels.map((hotel, index) => {
              const reg = getMalawiRegion(hotel.location);
              const isLast = index === orderedHotels.length - 1;
              const nextHotel = !isLast ? orderedHotels[index + 1] : null;
              const leg = !isLast ? legMetricsList[index] : null;
              const nights = nightsByHotelId[hotel.id || ''] ?? 2;

              return (
                <React.Fragment key={hotel.id || index}>
                  {/* Itinerary Stop Card */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-stone-50 border border-stone-200/90 hover:border-stone-300 transition">
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      {/* Stop Number Circle */}
                      <div
                        className="w-10 h-10 rounded-2xl text-white font-bold tabular-nums flex items-center justify-center shrink-0 shadow-xs"
                        style={{ backgroundColor: reg.color }}
                      >
                        {index + 1}
                      </div>

                      {/* Lodge Information */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                            style={{
                              backgroundColor: reg.bg,
                              borderColor: reg.borderColor,
                              color: reg.color,
                            }}
                          >
                            {reg.name}
                          </span>
                          <span className="text-xs text-stone-500 inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-stone-400" />
                            <span>{hotel.location || 'Malawi'}</span>
                          </span>
                        </div>

                        <h4 className="font-serif font-bold text-base sm:text-lg text-stone-900">
                          {hotel.name}
                        </h4>

                        <p className="text-xs text-stone-500 mt-0.5">
                          {bookingsEnabled ? 'Direct Host Booking • 0% Platform Commission' : 'Contact the property directly from its listing'}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-4">
                          <Link
                            to={`/hotel/${hotel.id}`}
                            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                          >
                            <span>View Property Details</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    </div>

                    {/* Right Controls: Nights Stepper + Reorder Arrows */}
                    <div className="flex items-center sm:items-end justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-200/60 shrink-0">
                      {/* Nights per stop adjuster */}
                      <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-stone-200 shadow-2xs">
                        <button
                          type="button"
                          disabled={nights <= 1}
                          onClick={() => updateStopNights(hotel.id, -1)}
                          className="p-1 rounded-lg text-stone-600 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition"
                          aria-label="Decrease nights"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <div className="px-1.5 text-center min-w-[54px]">
                          <span className="text-xs font-bold text-stone-900">{nights}</span>
                          <span className="text-[11px] text-stone-500 ml-1">
                            {nights === 1 ? 'night' : 'nights'}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={nights >= 14}
                          onClick={() => updateStopNights(hotel.id, 1)}
                          className="p-1 rounded-lg text-stone-600 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition"
                          aria-label="Increase nights"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Sequence Controls */}
                      <div className="flex sm:flex-col gap-1">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => moveStop(index, 'up')}
                          className={`p-1.5 rounded-lg border transition ${
                            index === 0
                              ? 'opacity-30 border-stone-200 text-stone-300 cursor-not-allowed'
                              : 'border-stone-300 bg-white text-stone-600 hover:bg-stone-100 hover:text-stone-900 cursor-pointer'
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
                              : 'border-stone-300 bg-white text-stone-600 hover:bg-stone-100 hover:text-stone-900 cursor-pointer'
                          }`}
                          title="Move Stop Later in Route"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Inter-Stop Transit Connector */}
                  {leg && nextHotel && (
                    <div className="flex items-center gap-3 pl-6 sm:pl-8 py-1">
                      <div className="w-0.5 h-10 bg-stone-300" />
                      <div className="flex-1 flex flex-wrap items-center gap-2 p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-800">
                        <Car className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span className="font-bold">Next Leg:</span>
                        <span>
                          {hotel.name} &rarr; {nextHotel.name}
                        </span>
                        <span className="tabular-nums font-bold bg-white px-2 py-0.5 rounded border border-stone-200 text-[11px] text-emerald-800 inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-emerald-700" />
                          <span>
                            {leg.time} · {leg.distanceKm} km
                          </span>
                        </span>
                        <span className="tabular-nums text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                          {leg.highway}
                        </span>
                        <span className="text-stone-600 text-[11px] hidden sm:inline">
                          — {leg.advice}
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

      {/* 3. Practical Travel Logistics Guide for Malawi Road Trips */}
      <div className="bg-stone-50 rounded-3xl p-6 sm:p-8 border border-stone-200/80 space-y-4">
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5 text-emerald-700" />
          <h3 className="font-serif font-bold text-stone-900 text-lg">
            Essential Malawi Road-Trip Advice
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-stone-600">
          <div className="p-4 bg-white rounded-2xl border border-stone-200/60 space-y-1.5">
            <h4 className="font-bold text-stone-900 flex items-center gap-1.5">
              <Navigation className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Main Highways (M1, M3 &amp; M5)</span>
            </h4>
            <p className="leading-relaxed">
              The M1 provides smooth North-to-South transit, the M3 connects Zomba and Liwonde to Mangochi, and the M5 hugs Lake Malawi’s shoreline. Daytime driving is recommended.
            </p>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-stone-200/60 space-y-1.5">
            <h4 className="font-bold text-stone-900 flex items-center gap-1.5">
              <Car className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Vehicle Selection</span>
            </h4>
            <p className="leading-relaxed">
              Standard 2WD sedans easily reach Lilongwe, Blantyre, Zomba, Mangochi, and Salima. For Liwonde, Majete, or Nyika National Parks, a high-clearance 4x4 is strongly advised.
            </p>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-stone-200/60 space-y-1.5">
            <h4 className="font-bold text-stone-900 flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-stone-700 shrink-0" />
              <span>{bookingsEnabled ? 'Direct Payments & Settlement' : 'Arranging your stay'}</span>
            </h4>
            <p className="leading-relaxed">
              {bookingsEnabled
                ? 'All lodges on Travel Malawi support 0% commission direct reservations with deposit options via Airtel Money, TNM Mpamba, bank transfer, or card.'
                : 'Travel Malawi does not take bookings or payments. Use the phone, WhatsApp or email on each listing to arrange rooms and rates directly with the property.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
