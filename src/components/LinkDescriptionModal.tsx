import React, { useState } from 'react';
import { Sparkles, Check, X, Tag, Coffee, ShieldCheck, Loader2, ArrowRight } from 'lucide-react';
import { PropertyCategory, PROPERTY_CATEGORIES, COMMON_AMENITIES } from '../lib/listing';
import { DescriptionAnalysisResult } from '../lib/descriptionAnalyzer';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  analysis: DescriptionAnalysisResult | null;
  loading: boolean;
  aiPowered: boolean;
  onApply: (selectedCategories: PropertyCategory[], selectedAmenities: string[], customAmenities: string[]) => void;
}

export default function LinkDescriptionModal({
  isOpen,
  onClose,
  analysis,
  loading,
  aiPowered,
  onApply,
}: Props) {
  if (!isOpen) return null;

  const [selectedCats, setSelectedCats] = useState<PropertyCategory[]>(
    analysis?.categories || []
  );
  const [selectedAmens, setSelectedAmens] = useState<string[]>(
    analysis?.matchedAmenities || []
  );
  const [selectedCustom, setSelectedCustom] = useState<string[]>(
    analysis?.customAmenities || []
  );

  // Sync state when analysis updates
  React.useEffect(() => {
    if (analysis) {
      setSelectedCats(analysis.categories || []);
      setSelectedAmens(analysis.matchedAmenities || []);
      setSelectedCustom(analysis.customAmenities || []);
    }
  }, [analysis]);

  const toggleCategory = (cat: PropertyCategory) => {
    setSelectedCats(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const toggleAmenity = (amenity: string) => {
    setSelectedAmens(prev =>
      prev.includes(amenity) ? prev.filter(a => a !== amenity) : [...prev, amenity]
    );
  };

  const toggleCustom = (custom: string) => {
    setSelectedCustom(prev =>
      prev.includes(custom) ? prev.filter(c => c !== custom) : [...prev, custom]
    );
  };

  const handleApply = () => {
    onApply(selectedCats, selectedAmens, selectedCustom);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-stone-200 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-stone-100 bg-stone-50/50">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-serif font-bold text-stone-900">
                Link Description to Amenities & Category
              </h3>
              <p className="text-xs text-stone-500">
                {aiPowered
                  ? 'Analyzed by Ulendo AI using Malawian hospitality intelligence'
                  : 'Analyzed using Malawian property matching intelligence'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-stone-500">
              <Loader2 className="h-8 w-8 animate-spin text-stone-900" />
              <p className="text-sm font-medium">Analyzing property description with Ulendo AI…</p>
              <p className="text-xs text-stone-400">Detecting common amenities and fitting categories</p>
            </div>
          ) : !analysis ? (
            <div className="py-8 text-center text-stone-500 text-sm">
              No description text provided to analyze. Please write a description first.
            </div>
          ) : (
            <>
              {/* Reasoning Card */}
              {analysis.reasoning && (
                <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3.5 text-xs text-stone-700 flex items-start gap-2.5">
                  <Sparkles className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-stone-900">Ulendo Assessment: </span>
                    {analysis.reasoning}
                  </div>
                </div>
              )}

              {/* Befitting Categories */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-stone-400" />
                    <span>Befitting Property Categories</span>
                  </label>
                  <span className="text-[11px] text-stone-400">Tap to select or deselect</span>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {PROPERTY_CATEGORIES.map(category => {
                    const isSuggested = (analysis.categories || []).includes(category);
                    const isSelected = selectedCats.includes(category);

                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => toggleCategory(category)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-stone-900 text-white border-stone-900 shadow-2xs'
                            : isSuggested
                            ? 'bg-amber-50 text-stone-800 border-amber-300 hover:border-stone-400'
                            : 'bg-stone-50 text-stone-500 border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                        <span>{category}</span>
                        {isSuggested && !isSelected && (
                          <span className="text-[10px] text-amber-700 font-semibold uppercase">Suggested</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Matched Common Amenities */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Coffee className="h-3.5 w-3.5 text-stone-400" />
                    <span>Matched Common Amenities ({selectedAmens.length} selected)</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedAmens(COMMON_AMENITIES.filter(a => (analysis.matchedAmenities || []).includes(a)))}
                      className="text-[11px] font-semibold text-stone-500 hover:text-stone-900 cursor-pointer"
                    >
                      Reset to detected
                    </button>
                    <span className="text-stone-300">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedAmens([])}
                      className="text-[11px] font-semibold text-stone-500 hover:text-stone-900 cursor-pointer"
                    >
                      Clear all
                    </button>
                  </div>
                </div>

                {analysis.matchedAmenities.length === 0 ? (
                  <p className="text-xs text-stone-400 italic bg-stone-50 p-3 rounded-xl border border-stone-100">
                    No common amenities explicitly found in description. You can still check any below.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {analysis.matchedAmenities.map(amenity => {
                      const isSelected = selectedAmens.includes(amenity);
                      return (
                        <button
                          key={amenity}
                          type="button"
                          onClick={() => toggleAmenity(amenity)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-stone-900 text-white border-stone-900 shadow-2xs'
                              : 'bg-stone-50 text-stone-500 border-stone-200 hover:border-stone-400'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                          <span>{amenity}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Custom Perks Detected */}
              {analysis.customAmenities && analysis.customAmenities.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                    Extra Unique Perks Detected
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {analysis.customAmenities.map(custom => {
                      const isSelected = selectedCustom.includes(custom);
                      return (
                        <button
                          key={custom}
                          type="button"
                          onClick={() => toggleCustom(custom)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-emerald-800 text-white border-emerald-800'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                          <span>{custom}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-3.5 border-t border-stone-100 bg-stone-50/70">
          <p className="text-xs text-stone-500">
            {selectedCats.length} category • {selectedAmens.length + selectedCustom.length} amenities
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-200/60 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading || !analysis}
              onClick={handleApply}
              className="px-5 py-2 text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-white rounded-xl transition shadow-2xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span>Apply to Property</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
