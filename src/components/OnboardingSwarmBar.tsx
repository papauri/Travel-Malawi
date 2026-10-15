import React, { useState } from 'react';
import {
  Sparkles, Bot, Zap, FileText, CheckCircle2, AlertCircle, ChevronDown, ChevronUp,
  Coins, Sun, ShieldCheck, MapPin, Building, BedDouble, Camera, ArrowRight, RefreshCw,
  HelpCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ListingDraft, PropertyCategory } from '../lib/listing';
import { isValidLatLng } from '../lib/geo';

interface OnboardingSwarmBarProps {
  draft: ListingDraft;
  step: number;
  stepsCount: number;
  hasAI: boolean;
  onRapidAutocomplete: (nameOrQuery?: string) => void;
  onOpenDocumentImporter: () => void;
  onApplyEssentialsBundle: () => void;
  onApplyMarketRates: () => void;
  onAutoFixMissingGaps: () => void;
  loading?: boolean;
}

export default function OnboardingSwarmBar({
  draft,
  step,
  stepsCount,
  hasAI,
  onRapidAutocomplete,
  onOpenDocumentImporter,
  onApplyEssentialsBundle,
  onApplyMarketRates,
  onAutoFixMissingGaps,
  loading = false,
}: OnboardingSwarmBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [quickInput, setQuickInput] = useState('');
  const [showInputModal, setShowInputModal] = useState(false);

  // Calculate live listing readiness metrics
  const hasName = Boolean(draft.name?.trim());
  const hasCategory = Boolean(draft.category);
  const hasLocation = Boolean(draft.location?.trim());
  const hasCoords = Boolean(draft.coordinates && isValidLatLng(draft.coordinates));
  const hasDescription = Boolean(draft.description && draft.description.trim().length >= 50);
  
  const hasSolar = Boolean(draft.amenities?.some(a => 
    /solar|backup|inverter|generator/i.test(a)
  ));
  const hasWater = Boolean(draft.amenities?.some(a => 
    /water|borehole|hot water|shower/i.test(a)
  ));
  const hasNets = Boolean(draft.amenities?.some(a => 
    /net|mosquito/i.test(a)
  ));
  const hasMalawiEssentials = hasSolar && (hasWater || hasNets);

  const hasRooms = draft.stayType === 'entire_place'
    ? Boolean((draft.entirePlaceDetails?.ratePerNightMwk || 0) > 0 || (draft.entirePlaceDetails?.ratePerNightUsd || 0) > 0)
    : Boolean(draft.rooms && draft.rooms.length > 0 && draft.rooms.some(r => 
        (r.prices?.MWK || r.priceMWK || 0) > 0 || (r.prices?.USD || r.priceUSD || 0) > 0
      ));

  const hasPhoto = Boolean(draft.imageUrl || (draft.gallery && draft.gallery.length > 0));

  const checks = [
    { label: 'Basic Info & Category', done: hasName && hasCategory, weight: 20 },
    { label: 'Malawi Location & Pin', done: hasLocation && hasCoords, weight: 20 },
    { label: 'Lodge Description', done: hasDescription, weight: 15 },
    { label: 'Solar & Water Essentials', done: hasMalawiEssentials, weight: 15 },
    { label: 'Rooms & Dual Pricing (MWK/USD)', done: hasRooms, weight: 20 },
    { label: 'Cover Photography', done: hasPhoto, weight: 10 },
  ];

  const totalScore = checks.reduce((acc, c) => acc + (c.done ? c.weight : 0), 0);

  const handleStartRapidFill = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = quickInput.trim() || draft.name.trim();
    if (!query) {
      toast.error('Enter a lodge name, area, or Google Maps link to autocomplete');
      return;
    }
    setShowInputModal(false);
    onRapidAutocomplete(query);
  };

  return (
    <div className="mb-6 rounded-2xl bg-gradient-to-r from-amber-950 via-stone-900 to-stone-950 text-stone-100 p-4 sm:p-5 border border-amber-500/30 shadow-md">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0 text-amber-300">
            <Bot className="w-5 h-5 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-stone-900" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                Ulendo Helping Agent Swarm
              </span>
              <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                Onboarding &amp; Marketing
              </span>
            </div>
            <p className="text-xs text-stone-300 mt-0.5">
              Helping agents swarming to make listing painless for you &amp; our marketing team.
            </p>
          </div>
        </div>

        {/* Readiness Meter & Quick Triggers */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          <div className="flex items-center gap-2 bg-stone-900/80 border border-stone-700/80 px-3 py-1.5 rounded-xl">
            <div className="text-right">
              <div className="text-[10px] text-stone-400 uppercase font-mono tracking-wider">Readiness</div>
              <div className="text-xs font-bold font-mono text-amber-400">{totalScore}%</div>
            </div>
            <div className="w-12 h-2 bg-stone-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${totalScore}%` }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white transition cursor-pointer"
            title={expanded ? 'Collapse Swarm Tools' : 'Expand Swarm Tools'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Swarm Fast Action Pills */}
      <div className="mt-3.5 pt-3 border-t border-stone-800/80 flex items-center gap-2 flex-wrap text-xs">
        {hasAI && (
          <button
            type="button"
            onClick={() => setShowInputModal(true)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold px-3 py-1.5 rounded-xl transition shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <Zap className="w-3.5 h-3.5 fill-stone-950" />
            <span>⚡ Rapid Autocomplete (60s)</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenDocumentImporter}
          className="inline-flex items-center gap-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 px-3 py-1.5 rounded-xl font-medium transition cursor-pointer shadow-2xs"
        >
          <FileText className="w-3.5 h-3.5 text-amber-300" />
          <span>Import Brochure / Rate Card</span>
        </button>

        {step === 2 && (
          <button
            type="button"
            onClick={onApplyEssentialsBundle}
            className="inline-flex items-center gap-1.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border border-emerald-700/60 px-3 py-1.5 rounded-xl font-medium transition cursor-pointer"
          >
            <Sun className="w-3.5 h-3.5 text-amber-300" />
            <span>Add Malawi Essentials (Solar &amp; Water)</span>
          </button>
        )}

        {step === 3 && (
          <button
            type="button"
            onClick={onApplyMarketRates}
            className="inline-flex items-center gap-1.5 bg-amber-950/80 hover:bg-amber-900 text-amber-200 border border-amber-700/60 px-3 py-1.5 rounded-xl font-medium transition cursor-pointer"
          >
            <Coins className="w-3.5 h-3.5 text-amber-300" />
            <span>Suggest Market Rates (MWK &amp; USD)</span>
          </button>
        )}

        {totalScore < 100 && (
          <button
            type="button"
            onClick={onAutoFixMissingGaps}
            className="inline-flex items-center gap-1.5 text-stone-300 hover:text-white underline font-medium px-2 py-1 ml-auto cursor-pointer"
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Auto-Fix Missing Details</span>
          </button>
        )}
      </div>

      {/* Expanded Swarm Details & Live Readiness Checklist */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-stone-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          {checks.map((check, idx) => (
            <div 
              key={`check-${idx}`}
              className={`p-2.5 rounded-xl border flex items-center gap-2.5 ${
                check.done 
                  ? 'bg-stone-900/60 border-emerald-500/40 text-stone-200' 
                  : 'bg-stone-900/40 border-stone-800 text-stone-400'
              }`}
            >
              {check.done ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-400/80 shrink-0" />
              )}
              <span className={check.done ? 'font-medium text-stone-200' : ''}>
                {check.label}
              </span>
            </div>
          ))}

          <div className="sm:col-span-2 md:col-span-3 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-stone-300 flex items-start gap-2.5 mt-1">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <strong className="text-amber-300">Swarm Assistance Tip:</strong> You do not need to fill everything manually. 
              Upload a photo of your printed rate sheet, paste a WhatsApp rate message, or type your lodge name to let the swarm agents draft your rooms, amenities, and pricing in seconds.
            </div>
          </div>
        </div>
      )}

      {/* Rapid Autocomplete Modal */}
      {showInputModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700 rounded-3xl max-w-md w-full p-6 text-stone-100 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Zap className="w-4 h-4 fill-amber-400" />
                <span>Swarm Rapid Autocomplete</span>
              </div>
              <button
                type="button"
                onClick={() => setShowInputModal(false)}
                className="text-stone-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-stone-300 leading-relaxed">
              Type your lodge name, area, or paste a Google Maps link. The Swarm will look up your property in the Malawi Hospitality Registry and auto-fill your entire 7-step listing.
            </p>

            <form onSubmit={handleStartRapidFill} className="space-y-3">
              <input
                type="text"
                autoFocus
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                placeholder={draft.name || "e.g. Kaya Mawa, Chembe Cottage, Sunbird Livingstonia"}
                className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInputModal(false)}
                  className="px-3 py-1.5 rounded-xl text-xs text-stone-400 hover:text-white font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-stone-950 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 fill-stone-950" />}
                  <span>Run Swarm Auto-Fill</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
