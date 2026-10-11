import React, { useMemo } from 'react';
import { CurrencyCode } from '../types';
import { formatMoney, CURRENCIES } from '../lib/currency';

export interface PriceRangeFilterProps {
  currency: CurrencyCode;
  minPrice: number;
  maxPrice: number;
  priceLimitMin: number;
  priceLimitMax: number;
  step: number;
  onPriceChange: (min: number, max: number) => void;
  onReset: () => void;
  availablePrices?: (number | null)[];
  matchingCount?: number;
  totalCount?: number;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  includeUnpriced?: boolean;
  onToggleIncludeUnpriced?: (include: boolean) => void;
}

export default function PriceRangeFilter({
  currency,
  minPrice,
  maxPrice,
  priceLimitMin,
  priceLimitMax,
  step,
  onPriceChange,
  onReset,
  includeUnpriced = true,
  onToggleIncludeUnpriced,
}: PriceRangeFilterProps) {
  const isFiltered = minPrice > priceLimitMin || maxPrice < priceLimitMax;
  const currencySymbol = CURRENCIES[currency]?.symbol || (currency === 'MWK' ? 'MK' : '$');

  // Clean, realistic hospitality price tiers
  const presets = useMemo(() => {
    if (currency === 'USD') {
      return [
        { label: 'All', min: 0, max: priceLimitMax },
        { label: 'Under $80', min: 0, max: 80 },
        { label: '$80 – $200', min: 80, max: 200 },
        { label: '$200 – $400', min: 200, max: 400 },
        { label: '$400+', min: 400, max: priceLimitMax },
      ];
    } else {
      return [
        { label: 'All', min: 0, max: priceLimitMax },
        { label: 'Under MK 150k', min: 0, max: 150000 },
        { label: 'MK 150k – 350k', min: 150000, max: 350000 },
        { label: 'MK 350k – 700k', min: 350000, max: 700000 },
        { label: 'MK 700k+', min: 700000, max: priceLimitMax },
      ];
    }
  }, [currency, priceLimitMax]);

  const handleMinChange = (val: number) => {
    const clamped = Math.max(priceLimitMin, Math.min(val, maxPrice - step));
    onPriceChange(clamped, maxPrice);
  };

  const handleMaxChange = (val: number) => {
    const clamped = Math.min(priceLimitMax, Math.max(val, minPrice + step));
    onPriceChange(minPrice, clamped);
  };

  // Percentage positions for dual slider bar
  const minPercent = Math.min(100, Math.max(0, ((minPrice - priceLimitMin) / (priceLimitMax - priceLimitMin)) * 100));
  const maxPercent = Math.min(100, Math.max(0, ((maxPrice - priceLimitMin) / (priceLimitMax - priceLimitMin)) * 100));

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-stone-100">
        <span className="text-xs font-semibold text-stone-900">
          Budget per night ({currency})
        </span>
        {isFiltered && (
          <button
            type="button"
            onClick={onReset}
            className="text-[11px] font-medium text-stone-500 hover:text-stone-900 transition cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>

      {/* Preset Chips */}
      <div>
        <span className="block text-[10px] font-medium text-stone-400 uppercase tracking-wider mb-1.5">
          Quick filters
        </span>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset, idx) => {
            const isSelected = minPrice === preset.min && maxPrice === preset.max;
            return (
              <button
                key={`${preset.label}-${idx}`}
                type="button"
                onClick={() => onPriceChange(preset.min, preset.max)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                  isSelected
                    ? 'bg-stone-900 text-white shadow-2xs font-semibold'
                    : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200/80 hover:border-stone-300'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dual Range Track */}
      <div className="pt-2 px-1">
        <div className="relative h-2 w-full bg-stone-100 rounded-full">
          <div
            className="absolute top-0 bottom-0 bg-stone-900 rounded-full"
            style={{
              left: `${minPercent}%`,
              right: `${100 - maxPercent}%`,
            }}
          />
        </div>
        <div className="relative -mt-2">
          <input
            type="range"
            min={priceLimitMin}
            max={priceLimitMax}
            step={step}
            value={minPrice}
            onChange={(e) => handleMinChange(Number(e.target.value))}
            className="pointer-events-none absolute left-0 w-full h-2 appearance-none bg-transparent focus:outline-none z-30 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-stone-900 [&::-webkit-slider-thumb]:shadow-xs [&::-webkit-slider-thumb]:cursor-grab [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-stone-900 [&::-moz-range-thumb]:shadow-xs [&::-moz-range-thumb]:cursor-grab"
            aria-label="Minimum price"
          />
          <input
            type="range"
            min={priceLimitMin}
            max={priceLimitMax}
            step={step}
            value={maxPrice}
            onChange={(e) => handleMaxChange(Number(e.target.value))}
            className="pointer-events-none absolute left-0 w-full h-2 appearance-none bg-transparent focus:outline-none z-30 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-stone-900 [&::-webkit-slider-thumb]:shadow-xs [&::-webkit-slider-thumb]:cursor-grab [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-stone-900 [&::-moz-range-thumb]:shadow-xs [&::-moz-range-thumb]:cursor-grab"
            aria-label="Maximum price"
          />
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div className="bg-stone-50 border border-stone-200 rounded-lg p-2">
          <label className="block text-[10px] text-stone-500 font-medium uppercase mb-0.5">
            Min
          </label>
          <div className="flex items-center gap-1">
            <span className="text-xs text-stone-400 font-medium">{currencySymbol}</span>
            <input
              type="number"
              value={minPrice}
              onChange={(e) => handleMinChange(Number(e.target.value))}
              min={priceLimitMin}
              max={maxPrice}
              step={step}
              className="w-full bg-transparent text-xs font-semibold text-stone-900 outline-none"
            />
          </div>
        </div>

        <div className="bg-stone-50 border border-stone-200 rounded-lg p-2">
          <label className="block text-[10px] text-stone-500 font-medium uppercase mb-0.5">
            Max
          </label>
          <div className="flex items-center gap-1">
            <span className="text-xs text-stone-400 font-medium">{currencySymbol}</span>
            <input
              type="number"
              value={maxPrice}
              onChange={(e) => handleMaxChange(Number(e.target.value))}
              min={minPrice}
              max={priceLimitMax}
              step={step}
              className="w-full bg-transparent text-xs font-semibold text-stone-900 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Unpriced Toggle (Optional) */}
      {onToggleIncludeUnpriced && (
        <label className="flex items-center gap-2 pt-1 text-[11px] text-stone-600 cursor-pointer">
          <input
            type="checkbox"
            checked={includeUnpriced}
            onChange={(e) => onToggleIncludeUnpriced(e.target.checked)}
            className="rounded border-stone-300 text-stone-900 focus:ring-stone-500 w-3.5 h-3.5 cursor-pointer"
          />
          <span>Include stays with rates on request</span>
        </label>
      )}

      {/* Done Footer */}
      <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
        <span className="text-[11px] text-stone-500">
          {formatMoney(minPrice, currency)} – {maxPrice >= priceLimitMax ? `${formatMoney(priceLimitMax, currency)}+` : formatMoney(maxPrice, currency)}
        </span>
        <button
          type="button"
          onClick={(e) => {
            const details = (e.target as HTMLElement).closest('details');
            if (details) details.removeAttribute('open');
          }}
          className="px-3.5 py-1 bg-stone-900 text-white rounded-md text-xs font-medium hover:bg-stone-800 transition cursor-pointer"
        >
          Done
        </button>
      </div>
    </div>
  );
}
