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
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getHotelImages } from '../lib/images';
import TripAIInsights from './TripAIInsights';

interface Props {
  hotels: Hotel[];
}

// Region categorization helper for Malawi
function getMalawiRegion(location?: string): { name: string; hub: string; color: string; bg: string; borderColor: string; lat: number; lng: number } {
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
function getTransitEstimate(fromRegion: string, toRegion: string): { time: string; distance: string; advice: string } {
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

export default function TripPlannerD3({ hotels }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const navigate = useNavigate();

  const [orderedHotels, setOrderedHotels] = useState<Hotel[]>(hotels);
  const [selectedLodgeId, setSelectedLodgeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'visualizer' | 'itinerary' | 'ai-insights'>('visualizer');
  const [copiedShare, setCopiedShare] = useState(false);

  // Sync if prop changes
  useEffect(() => {
    setOrderedHotels(hotels);
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
      hotels: data.items
    }));
  }, [orderedHotels]);

  // Total estimated nights (suggest 2 nights per distinct region or lodge)
  const estimatedDays = Math.max(3, orderedHotels.length * 2);

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

    // Sequential itinerary links (connecting Stop 1 -> Stop 2 -> Stop 3)
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

    // Arrow markers for sequential links
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

    // Link transit pill background & text
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

    // Resize badge rect based on text
    linkText.each(function(this: SVGTextElement) {
      const textWidth = this.getComputedTextLength();
      const parent = d3.select(this.parentNode as SVGGElement);
      parent.select('rect')
        .attr('width', textWidth + 16)
        .attr('x', -(textWidth + 16) / 2)
        .attr('y', -10);
    });

    // Tooltip reference
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
        
        // Highlight circle
        d3.select(event.currentTarget).select('.main-circle')
          .transition().duration(150)
          .attr('transform', 'scale(1.1)')
          .attr('stroke-width', 3.5);

        // Tooltip display
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

    // Node Outer Ring / Region Ring
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

    // Lodge Monogram / Icon
    node.append('text')
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
        // Constrain strictly within viewport bounds to prevent overlapping or clipping
        d.x = Math.max(d.radius + 30, Math.min(width - d.radius - 30, d.x));
        d.y = Math.max(d.radius + 30, Math.min(height - d.radius - 55, d.y));
        return `translate(${d.x},${d.y})`;
      });
    });

    // Animate nodes entering
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
    const text = `🇲🇼 My Travel Malawi Road Trip Itinerary:
Total Stops: ${orderedHotels.length} Stays | Est. Duration: ${estimatedDays} Days

Route Sequence:
${orderedHotels.map((h, i) => `${i + 1}. ${h.name} (${h.location || 'Malawi'})`).join('\n')}

Plan and book direct at: https://travel-malawi.ai.studio/`;

    navigator.clipboard.writeText(text);
    setCopiedShare(true);
    toast.success('Itinerary copied! Ready to share via WhatsApp or Email.');
    setTimeout(() => setCopiedShare(false), 3000);
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Clear "What Is Trip Planner" Explainer Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5 text-emerald-600" />
              <span>Malawi Route &amp; Road Trip Builder</span>
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
              Interactive Trip Planner
            </h2>
            <p className="text-stone-600 text-sm sm:text-base leading-relaxed">
              <strong>How it works:</strong> The Trip Planner turns your saved properties into a connected travel route. It groups your lodges into geographical hubs across Malawi, estimates driving times between legs, and helps you sequence a safari, lake, and highlands itinerary.
            </p>
          </div>

          {/* Key Summary Stats */}
          <div className="grid grid-cols-3 gap-3 shrink-0 bg-stone-50 p-3.5 rounded-2xl border border-stone-200/80 text-center">
            <div className="px-3 py-1">
              <span className="block text-stone-400 text-[11px] font-semibold uppercase tracking-wider">Stops</span>
              <span className="text-xl sm:text-2xl font-bold text-stone-900 font-serif">{orderedHotels.length}</span>
            </div>
            <div className="px-3 py-1 border-x border-stone-200">
              <span className="block text-stone-400 text-[11px] font-semibold uppercase tracking-wider">Regions</span>
              <span className="text-xl sm:text-2xl font-bold text-emerald-700 font-serif">{regionalGroups.length}</span>
            </div>
            <div className="px-3 py-1">
              <span className="block text-stone-400 text-[11px] font-semibold uppercase tracking-wider">Rec. Days</span>
              <span className="text-xl sm:text-2xl font-bold text-amber-700 font-serif">~{estimatedDays}d</span>
            </div>
          </div>
        </div>

        {/* View Switcher & Action Bar */}
        <div className="mt-6 pt-5 border-t border-stone-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5 bg-stone-100 p-1 rounded-2xl w-fit">
            <button
              type="button"
              onClick={() => setActiveTab('visualizer')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'visualizer'
                  ? 'bg-white text-stone-900 shadow-xs'
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
                  ? 'bg-white text-stone-900 shadow-xs'
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
              <Compass className={`w-3.5 h-3.5 ${activeTab === 'ai-insights' ? 'text-white' : 'text-stone-700'}`} />
              <span>Trip Insights</span>
            </button>
          </div>

          <button
            type="button"
            onClick={copyItinerarySummary}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-stone-900 text-white text-xs font-bold hover:bg-stone-800 transition shadow-xs cursor-pointer w-fit"
          >
            {copiedShare ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copiedShare ? 'Copied Itinerary!' : 'Share Trip Plan'}</span>
          </button>
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
                Journey Feasibility &amp; Malawi Route Concierge
              </span>
              <span className="text-[11px] sm:text-xs text-stone-600">
                Unlock day-by-day pacing, authentic roadside culinary detours, and live route guidance for your stays.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('ai-insights')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition shadow-xs shrink-0 cursor-pointer w-fit"
          >
            <span>Explore Insights</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Main Content View: AI Insights vs Visualizer vs Step-by-Step */}
      {activeTab === 'ai-insights' ? (
        <TripAIInsights hotels={orderedHotels} onOpenListing={(id) => navigate(`/hotel/${id}`)} />
      ) : activeTab === 'visualizer' ? (
        <div className="space-y-4">
          {/* D3 Route Map Canvas Card */}
          <div 
            ref={containerRef}
            className="relative w-full rounded-3xl bg-white border border-stone-200 overflow-hidden shadow-xs p-4 sm:p-6"
          >
            {/* Clean Sub-header (Non-overlapping layout) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-2 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-sm font-bold text-stone-900">
                  Regional Travel Route &amp; Transit Flow
                </h3>
              </div>
              <span className="text-xs text-stone-500">
                Hover over nodes to view lodge details • Click to open listing
              </span>
            </div>

            {/* SVG Visualizer Canvas */}
            <div className="w-full bg-[#FAF8F5] rounded-2xl border border-stone-200/60 overflow-hidden">
              <svg ref={svgRef} className="w-full h-[400px] sm:h-[480px] select-none block" />
            </div>

            {/* Regional Legend Footer */}
            <div className="mt-4 pt-3 flex flex-wrap items-center justify-center gap-3 text-xs">
              <span className="text-stone-400 font-medium">Regional Hubs:</span>
              {regionalGroups.map(group => (
                <div 
                  key={group.name} 
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold"
                  style={{ backgroundColor: group.info.bg, borderColor: group.info.borderColor, color: group.info.color }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: group.info.color }} />
                  <span>{group.name} ({group.hotels.length})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Step-by-Step Itinerary View */
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-6">
          <div>
            <h3 className="text-xl font-serif font-bold text-stone-900">
              Recommended Itinerary Sequence
            </h3>
            <p className="text-stone-500 text-xs sm:text-sm mt-1">
              Arrange your stops in order. Use the up and down arrows to customize your road-trip sequence.
            </p>
          </div>

          <div className="space-y-4">
            {orderedHotels.map((hotel, index) => {
              const reg = getMalawiRegion(hotel.location);
              const isLast = index === orderedHotels.length - 1;
              const nextHotel = !isLast ? orderedHotels[index + 1] : null;
              const nextReg = nextHotel ? getMalawiRegion(nextHotel.location) : null;
              const transit = nextReg ? getTransitEstimate(reg.name, nextReg.name) : null;

              return (
                <React.Fragment key={hotel.id || index}>
                  {/* Itinerary Stop Card */}
                  <div className="flex items-start gap-4 p-4 sm:p-5 rounded-2xl bg-stone-50 border border-stone-200/90 hover:border-stone-300 transition">
                    
                    {/* Stop Number Circle */}
                    <div 
                      className="w-10 h-10 rounded-2xl text-white font-bold font-mono flex items-center justify-center shrink-0 shadow-xs"
                      style={{ backgroundColor: reg.color }}
                    >
                      {index + 1}
                    </div>

                    {/* Lodge Information */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span 
                          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                          style={{ backgroundColor: reg.bg, borderColor: reg.borderColor, color: reg.color }}
                        >
                          {reg.name}
                        </span>
                        <span className="text-xs text-stone-400">📍 {hotel.location || 'Malawi'}</span>
                      </div>

                      <h4 className="font-serif font-bold text-base sm:text-lg text-stone-900">
                        {hotel.name}
                      </h4>

                      <p className="text-xs text-stone-500 mt-0.5">
                        Recommended stay: <strong>2–3 nights</strong> • Direct Host Booking
                      </p>

                      <div className="mt-3 flex items-center gap-3">
                        <Link
                          to={`/hotel/${hotel.id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                        >
                          <span>View Property Details</span>
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

      {/* 3. Practical Travel Logistics Guide for Malawi Road Trips */}
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
