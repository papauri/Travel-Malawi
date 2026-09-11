import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
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
  ChevronRight,
  Clock,
  Navigation,
  ExternalLink,
  MessageCircle,
  HelpCircle,
  CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Hotel } from '../types';
import { getHotelImages } from '../lib/images';

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
}

interface Props {
  hotels: Hotel[];
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

export default function TripAIInsights({ hotels, onOpenListing }: Props) {
  const [selectedStyle, setSelectedStyle] = useState('balanced');
  const [customNotes, setCustomNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<TripInsightsData | null>(null);
  const [copied, setCopied] = useState(false);

  // Chat Concierge State
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string; time: string }>>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Cache key based on hotels list
  const cacheKey = `trip_insights_${hotels.map(h => h.id).join('_')}_${selectedStyle}`;

  // Check cache on mount
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setInsights(JSON.parse(cached));
      }
    } catch {
      // ignore
    }
  }, [cacheKey]);

  // Scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  // Generate Insights
  const handleGenerateInsights = async (forceRefresh = false) => {
    if (hotels.length === 0) {
      toast.error('Add at least one stay to generate journey insights.');
      return;
    }

    if (!forceRefresh && insights) {
      return;
    }

    setLoading(true);
    try {
      const stopsPayload = hotels.map(h => ({
        name: h.name,
        location: h.location || 'Malawi',
        category: (h as any).category || 'Lodge',
        description: h.description ? h.description.slice(0, 200) : '',
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
        throw new Error(`Server returned ${res.status}`);
      }

      const data: TripInsightsData = await res.json();
      setInsights(data);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
      } catch {
        // ignore
      }
      toast.success('Journey Insights generated!');
    } catch (err: any) {
      console.error('Failed to generate insights:', err);
      toast.error('Could not generate insights right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Ask Route Concierge
  const handleSendMessage = async (customText?: string) => {
    const text = (customText || chatInput).trim();
    if (!text || chatLoading || hotels.length === 0) return;

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
        throw new Error(`Server responded with ${res.status}`);
      }

      const data = await res.json();
      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setChatMessages(prev => [
        ...prev,
        { role: 'assistant', text: data.answer, time: replyTime },
      ]);
    } catch (err: any) {
      console.error('Chat Concierge Error:', err);
      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setChatMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: 'Along your itinerary, daytime driving on the main highways (M1, M3, M5) is paved and scenic. Keep cash handy for toll gates and lakeside fish stalls, and feel free to ask about any specific lodge leg!',
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
    const text = `🇲🇼 ${insights.title}
Pacing: ${insights.pacingScore} | Duration: ~${insights.recommendedTotalDays} Days
Vibe: ${insights.tripVibe}
Distance: ${insights.estimatedTotalDistance}

${insights.summary}

--- DAY BY DAY JOURNEY ---
${insights.dayByDay.map(d => `• ${d.dayNumber}: ${d.stopName} (${d.location})
  Highlights: ${d.activityHighlight}
  Transit Advice: ${d.scenicTransitNote}
  Culinary Tip: ${d.diningOrLocalPerk}`).join('\n\n')}

--- LOCAL INSIDER SECRETS ---
${insights.insiderSecrets.map(s => `✓ ${s}`).join('\n')}

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
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5 text-emerald-600" />
              <span>Journey Route Intelligence</span>
            </div>
            <h3 className="font-serif text-2xl font-bold text-stone-900 tracking-tight">
              Curate Your Route Intelligence
            </h3>
            <p className="text-stone-500 text-xs sm:text-sm">
              Analyzing your {hotels.length} saved stay{hotels.length === 1 ? '' : 's'} across Malawi with real road, culinary, and wildlife insights.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {insights && (
              <button
                type="button"
                onClick={() => handleGenerateInsights(true)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Re-Analyze</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleGenerateInsights(false)}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Journey...</span>
                </>
              ) : (
                <>
                  <Compass className="w-4 h-4 text-emerald-200" />
                  <span>{insights ? 'Update Analysis' : 'Generate Insights'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Travel Style Selector */}
        <div className="space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
            Select Your Travel Style
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {TRAVEL_STYLES.map(style => {
              const isSelected = selectedStyle === style.id;
              return (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setSelectedStyle(style.id)}
                  className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50/70 border-emerald-400 ring-1 ring-emerald-500/30 text-stone-900 shadow-2xs'
                      : 'bg-stone-50/60 border-stone-200 hover:border-stone-300 text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-stone-900">{style.label}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                  </div>
                  <span className="text-[11px] text-stone-500 leading-snug">{style.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Optional Custom Preference Input */}
        <div className="pt-2">
          <input
            type="text"
            value={customNotes}
            onChange={e => setCustomNotes(e.target.value)}
            placeholder="Special preferences? (e.g., traveling with kids, prefer self-drive 4x4, focus on birdwatching...)"
            className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>
      </div>

      {/* 2. Loading State Skeleton */}
      {loading && (
        <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto text-emerald-700 animate-pulse">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="font-serif font-bold text-lg text-stone-900">
              Crafting Your Custom Malawi Itinerary Intelligence
            </h4>
            <p className="text-stone-500 text-xs max-w-md mx-auto">
              Synthesizing travel times between {hotels.map(h => h.name).join(' & ')}, evaluating road tarmac status, and curating local Malawian culinary perks...
            </p>
          </div>
          <div className="w-48 h-1.5 bg-stone-100 rounded-full mx-auto overflow-hidden">
            <div className="w-full h-full bg-emerald-600 animate-pulse" />
          </div>
        </div>
      )}

      {/* 3. Generated Insights View */}
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
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                    {insights.tripVibe}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                    {insights.pacingScore}
                  </span>
                  {insights.model && (
                    <span className="px-2 py-0.5 rounded-full bg-stone-200/80 text-stone-600 text-[10px] font-medium font-mono">
                      {insights.model}
                    </span>
                  )}
                </div>
                <h3 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
                  {insights.title}
                </h3>
              </div>

              {/* Action Buttons */}
              <button
                type="button"
                onClick={handleCopyItinerary}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied Full Plan!' : 'Copy Full Plan'}</span>
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-3.5 rounded-2xl border border-stone-200/70">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-stone-400">Pacing</span>
                <span className="text-sm sm:text-base font-bold text-stone-900 font-serif">~{insights.recommendedTotalDays} Days Ideal</span>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-stone-200/70">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-stone-400">Total Corridor</span>
                <span className="text-sm sm:text-base font-bold text-stone-900 font-serif">{insights.estimatedTotalDistance}</span>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-stone-200/70">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-stone-400">Road Class</span>
                <span className="text-sm sm:text-base font-bold text-emerald-700 font-serif">Paved Spine (M1/M5)</span>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-stone-200/70">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-stone-400">Direct Booking</span>
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
                const hotelMatch = hotels.find(h => h.name.toLowerCase() === leg.stopName.toLowerCase()) || hotels[idx];
                const images = hotelMatch ? getHotelImages(hotelMatch) : [];

                return (
                  <div
                    key={idx}
                    className="p-4 sm:p-5 rounded-2xl border border-stone-200 bg-stone-50/40 hover:bg-stone-50 transition space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold font-mono">
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
                          onClick={() => onOpenListing(hotelMatch.id)}
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
                        <span className="font-bold text-stone-900 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-emerald-800">
                          <Compass className="w-3.5 h-3.5" />
                          <span>Must-Do Activity</span>
                        </span>
                        <p className="text-stone-600 leading-relaxed">
                          {leg.activityHighlight}
                        </p>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-stone-200/60 space-y-1">
                        <span className="font-bold text-stone-900 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-amber-800">
                          <Car className="w-3.5 h-3.5" />
                          <span>Scenic Route &amp; Transit</span>
                        </span>
                        <p className="text-stone-600 leading-relaxed">
                          {leg.scenicTransitNote}
                        </p>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-stone-200/60 space-y-1">
                        <span className="font-bold text-stone-900 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-rose-800">
                          <Utensils className="w-3.5 h-3.5" />
                          <span>Local Perk / Dining</span>
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
              <Lightbulb className="w-5 h-5 text-amber-600" />
              <h4 className="font-serif text-xl font-bold text-stone-900 tracking-tight">
                Authentic Malawian Insider Secrets
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-stone-700">
              {insights.insiderSecrets.map((tip, idx) => (
                <div key={idx} className="p-3.5 bg-amber-50/40 rounded-2xl border border-amber-200/60 flex items-start gap-2.5">
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
                  <span className="font-bold text-stone-900 block">🚙 Vehicle Recommendation</span>
                  <p className="text-stone-600 leading-relaxed">{insights.logisticsAdvice.roadAndVehicle}</p>
                </div>
                <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-1">
                  <span className="font-bold text-stone-900 block">☀️ Daylight Driving Windows</span>
                  <p className="text-stone-600 leading-relaxed">{insights.logisticsAdvice.bestTimeToDrive}</p>
                </div>
                <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-1">
                  <span className="font-bold text-stone-900 block">💵 Currency &amp; Cash Needs</span>
                  <p className="text-stone-600 leading-relaxed">{insights.logisticsAdvice.currencyAndCash}</p>
                </div>
                <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-1">
                  <span className="font-bold text-stone-900 block">📱 SIM &amp; 4G Data Connectivity</span>
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
                    <li key={idx} className="flex items-start gap-2">
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

      {/* 4. Interactive AI Route Concierge (Ask Questions About Your Route) */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-emerald-700" />
              <h4 className="font-serif text-xl font-bold text-stone-900">
                Ask the Malawi Route Concierge
              </h4>
            </div>
            <p className="text-xs text-stone-500">
              Have specific questions about road tarmac, park entry fees, fuel stops, or travel timing for your itinerary?
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold w-fit">
            Instant Malawian Answers
          </span>
        </div>

        {/* Quick Suggestion Pills */}
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((q, i) => (
            <button
              key={i}
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
                key={i}
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
                  <span className={`block text-[10px] mt-1 text-right ${msg.role === 'user' ? 'text-stone-400' : 'text-stone-400'}`}>
                    {msg.time}
                  </span>
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex items-center gap-2 p-3 bg-white rounded-2xl border border-stone-200 text-stone-500 w-fit">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                <span>Concierge is consulting Malawi road &amp; lodge records...</span>
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
            className="flex-1 px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
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

    </div>
  );
}
