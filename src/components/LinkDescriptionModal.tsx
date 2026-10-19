import React, { useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
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

  // After the hooks: returning before them changed the hook count whenever
  // the modal opened, which React treats as a crash.
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/50 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-sm border border-stone-200 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div>
              <h3 className="tm-h2">
                Match amenities and category
              </h3>
              <p className="text-xs text-stone-500">
                {aiPowered
                  ? 'Ulendo read your description. Check the picks before applying.'
                  : 'Picked from your description. Check them before applying.'}
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
              <p className="text-sm font-medium">Reading your description…</p>
            </div>
          ) : !analysis ? (
            <div className="py-8 text-center text-stone-500 text-sm">
              Write a description first, then try again.
            </div>
          ) : (
            <>
              {/* Reasoning Card */}
              {analysis.reasoning && (
                <div className="rounded-lg bg-stone-50 p-3 text-xs text-stone-700">
                  <div>
                    {analysis.reasoning}
                  </div>
                </div>
              )}

              {/* Befitting Categories */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-stone-700">
                    Category
                  </label>
                  <span className="text-[11px] text-stone-400">Tap to choose</span>
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
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-stone-900 text-white border-stone-900'
                            : isSuggested
                            ? 'bg-amber-50 text-stone-800 border-amber-300 hover:border-stone-400'
                            : 'bg-stone-50 text-stone-500 border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                        <span>{category}</span>
                        {isSuggested && !isSelected && (
                          <span className="text-[10px] text-amber-800 font-medium">suggested</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Matched Common Amenities */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-stone-700">
                    Amenities ({selectedAmens.length} selected)
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedAmens(COMMON_AMENITIES.filter(a => (analysis.matchedAmenities || []).includes(a)))}
                      className="tm-link text-[11px]"
                    >
                      Reset
                    </button>
                    <span className="text-stone-300">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedAmens([])}
                      className="tm-link text-[11px]"
                    >
                      Clear all
                    </button>
                  </div>
                </div>

                {analysis.matchedAmenities.length === 0 ? (
                  <p className="tm-muted">
                    No amenities found in the description. You can add them on the form.
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
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-stone-900 text-white border-stone-900'
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
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    Other extras found
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {analysis.customAmenities.map(custom => {
                      const isSelected = selectedCustom.includes(custom);
                      return (
                        <button
                          key={custom}
                          type="button"
                          onClick={() => toggleCustom(custom)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-stone-900 text-white border-stone-900'
                              : 'bg-stone-50 text-stone-500 border-stone-200 hover:border-stone-400'
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
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 py-3.5 border-t border-stone-100">
          <p className="text-xs text-stone-500">
            {selectedCats.length} category • {selectedAmens.length + selectedCustom.length} amenities
          </p>
          <div className="tm-actions">
            <button
              type="button"
              onClick={onClose}
              className="tm-btn tm-btn-quiet tm-btn-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading || !analysis}
              onClick={handleApply}
              className="tm-btn tm-btn-primary tm-btn-sm"
            >
              <span>Apply</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
