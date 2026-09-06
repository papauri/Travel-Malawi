import React, { useMemo } from 'react';
import { SlidersHorizontal, RotateCcw, DollarSign, Check } from 'lucide-react';
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
  availablePrices = [],
  matchingCount,
  totalCount,
  isExpanded = true,
  onToggleExpand,
  includeUnpriced = true,
  onToggleIncludeUnpriced,
}: PriceRangeFilterProps) {
  const isFiltered = minPrice > priceLimitMin || maxPrice < priceLimitMax;
  const currencySymbol = CURRENCIES[currency]?.symbol || (currency === 'MWK' ? 'MK' : '$');

  // Quick budget presets depending on currency
  const presets = useMemo(() => {
    if (currency === 'USD') {
      return [
        { label: 'All Budgets', min: 0, max: priceLimitMax },
        { label: 'Under $80', min: 0, max: 80, sub: 'Budget & Camps' },
        { label: '$80 – $200', min: 80, max: 200, sub: 'Mid-Range Lodges' },
        { label: '$200 – $400', min: 200, max: 400, sub: 'Upscale & Beach' },
        { label: '$400+', min: 400, max: priceLimitMax, sub: 'Luxury Safaris' },
      ];
    } else {
      return [
        { label: 'All Budgets', min: 0, max: priceLimitMax },
        { label: 'Under MK 150k', min: 0, max: 150000, sub: 'Budget & Camps' },
        { label: 'MK 150k – 350k', min: 150000, max: 350000, sub: 'Mid-Range' },
        { label: 'MK 350k – 700k', min: 350000, max: 700000, sub: 'Upscale' },
        { label: 'MK 700k+', min: 700000, max: priceLimitMax, sub: 'Luxury Stays' },
      ];
    }
  }, [currency, priceLimitMax]);

  // Compute 16 price histogram buckets from availablePrices
  const histogram = useMemo(() => {
    const bucketsCount = 16;
    const validPrices = availablePrices.filter((p): p is number => typeof p === 'number' && p >= 0);
    if (validPrices.length === 0 || priceLimitMax <= priceLimitMin) {
      return Array(bucketsCount).fill({ count: 0, heightPercent: 0, inRange: true });
    }

    const bucketWidth = (priceLimitMax - priceLimitMin) / bucketsCount;
    const counts = Array(bucketsCount).fill(0);

    validPrices.forEach(price => {
      const clamped = Math.min(Math.max(price, priceLimitMin), priceLimitMax);
      const bucketIdx = Math.min(
        Math.floor((clamped - priceLimitMin) / bucketWidth),
        bucketsCount - 1
      );
      counts[bucketIdx]++;
    });

    const maxCount = Math.max(...counts, 1);

    return counts.map((count, i) => {
      const bucketStart = priceLimitMin + i * bucketWidth;
      const bucketEnd = bucketStart + bucketWidth;
      const inRange = bucketEnd >= minPrice && bucketStart <= maxPrice;
      const heightPercent = count === 0 ? 8 : Math.max(16, Math.round((count / maxCount) * 100));
      return {
        count,
        heightPercent,
        inRange,
        rangeLabel: `${formatMoney(Math.round(bucketStart), currency)} - ${formatMoney(Math.round(bucketEnd), currency)}`,
      };
    });
  }, [availablePrices, priceLimitMin, priceLimitMax, minPrice, maxPrice, currency]);

  // Calculate percentage positions for dual slider track
  const minPercent = Math.min(
    100,
    Math.max(0, ((minPrice - priceLimitMin) / (priceLimitMax - priceLimitMin)) * 100)
  );
  const maxPercent = Math.min(
    100,
    Math.max(0, ((maxPrice - priceLimitMin) / (priceLimitMax - priceLimitMin)) * 100)
  );

  const handleMinSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    const newMin = Math.min(val, maxPrice - step);
    onPriceChange(newMin, maxPrice);
  };

  const handleMaxSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    const newMax = Math.max(val, minPrice + step);
    onPriceChange(minPrice, newMax);
  };

  const handleMinInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value.replace(/[^0-9]/g, '')) || 0;
    const clamped = Math.max(priceLimitMin, Math.min(val, maxPrice - step));
    onPriceChange(clamped, maxPrice);
  };

  const handleMaxInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    const val = raw ? Number(raw) : priceLimitMax;
    const clamped = Math.min(priceLimitMax, Math.max(val, minPrice + step));
    onPriceChange(minPrice, clamped);
  };

  const activePreset = presets.find(p => p.min === minPrice && p.max === maxPrice);

  return (
    <div
      id="price-range-filter"
      className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden transition-all duration-300"
    >
      {/* Header Bar */}
      <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 bg-gradient-to-r from-stone-50/70 via-white to-stone-50/40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-stone-900 text-white flex items-center justify-center shadow-xs">
            <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif font-bold text-stone-900 text-sm sm:text-base">
                Price Per Night
              </h3>
              {isFiltered && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                  Filtered
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              {minPrice <= priceLimitMin && maxPrice >= priceLimitMax
                ? `Showing stays across all price tiers (${currency})`
                : `${formatMoney(minPrice, currency)} – ${maxPrice >= priceLimitMax ? `${formatMoney(maxPrice, currency)}+` : formatMoney(maxPrice, currency)} per night`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {matchingCount !== undefined && (
            <span className="text-xs font-semibold text-stone-600 bg-stone-100 px-3 py-1 rounded-full">
              {matchingCount} {matchingCount === 1 ? 'stay' : 'stays'}{' '}
              {totalCount !== undefined ? `of ${totalCount}` : ''}
            </span>
          )}

          {isFiltered && (
            <button
              type="button"
              id="reset-price-filter-btn"
              onClick={onReset}
              className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-200 px-2.5 py-1 rounded-lg transition"
              title="Reset price range to all"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}

          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="text-xs font-semibold text-stone-500 hover:text-stone-900 p-1.5 rounded-lg hover:bg-stone-100 transition"
              aria-label={isExpanded ? 'Collapse price filter' : 'Expand price filter'}
            >
              {isExpanded ? 'Hide' : 'Adjust'}
            </button>
          )}
        </div>
      </div>

      {/* Expandable Slider Body */}
      {isExpanded && (
        <div className="p-4 sm:p-6 space-y-6">
          {/* Quick Preset Buttons */}
          <div>
            <span className="block text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-2.5">
              Popular Budget Tiers
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {presets.map(preset => {
                const isSelected = minPrice === preset.min && maxPrice === preset.max;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => onPriceChange(preset.min, preset.max)}
                    className={`text-left p-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                        : 'bg-stone-50/80 hover:bg-stone-100 text-stone-800 border-stone-200/80 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs truncate">{preset.label}</span>
                      {isSelected && <Check className="w-3 h-3 text-emerald-400 shrink-0 ml-1" />}
                    </div>
                    {preset.sub && (
                      <span
                        className={`block text-[10px] truncate mt-0.5 ${
                          isSelected ? 'text-stone-300' : 'text-stone-400'
                        }`}
                      >
                        {preset.sub}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Histogram Visual Distribution */}
          <div className="pt-2">
            <div className="flex items-center justify-between text-xs text-stone-400 font-medium mb-1.5">
              <span>Lodge price distribution across Malawi</span>
              <span>
                {formatMoney(minPrice, currency)} &rarr;{' '}
                {maxPrice >= priceLimitMax
                  ? `${formatMoney(maxPrice, currency)}+`
                  : formatMoney(maxPrice, currency)}
              </span>
            </div>
            <div className="h-14 flex items-end gap-1 px-1 pt-2 pb-1 bg-stone-50/80 rounded-xl border border-stone-100">
              {histogram.map((bar, idx) => (
                <div
                  key={idx}
                  title={`${bar.count} stays in range ${bar.rangeLabel}`}
                  className="flex-1 flex flex-col justify-end items-center h-full group relative cursor-pointer"
                  onClick={() => {
                    const bucketWidth = (priceLimitMax - priceLimitMin) / 16;
                    const start = Math.round(priceLimitMin + idx * bucketWidth);
                    const end = Math.round(start + bucketWidth);
                    onPriceChange(start, end);
                  }}
                >
                  <div
                    style={{ height: `${bar.heightPercent}%` }}
                    className={`w-full rounded-t-xs transition-all duration-300 ${
                      bar.inRange
                        ? 'bg-emerald-600 group-hover:bg-emerald-500'
                        : 'bg-stone-200 group-hover:bg-stone-300'
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Dual Range Track & Thumbs */}
          <div className="relative pt-3 pb-2 px-1">
            {/* Background Track */}
            <div className="relative h-2.5 w-full bg-stone-100 rounded-full">
              {/* Highlight Fill between Min and Max */}
              <div
                className="absolute top-0 bottom-0 bg-stone-900 rounded-full"
                style={{
                  left: `${minPercent}%`,
                  right: `${100 - maxPercent}%`,
                }}
              />
            </div>

            {/* Native Sliders Layered on Top */}
            <input
              type="range"
              id="slider-price-min"
              aria-label="Minimum price per night"
              min={priceLimitMin}
              max={priceLimitMax}
              step={step}
              value={minPrice}
              onChange={handleMinSliderChange}
              className="price-range-slider pointer-events-none absolute top-1.5 left-0 w-full h-2.5 appearance-none bg-transparent focus:outline-none z-30 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-stone-900 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing [&::-webkit-slider-thumb]:active:scale-110 [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-stone-900 [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-grab"
            />
            <input
              type="range"
              id="slider-price-max"
              aria-label="Maximum price per night"
              min={priceLimitMin}
              max={priceLimitMax}
              step={step}
              value={maxPrice}
              onChange={handleMaxSliderChange}
              className="price-range-slider pointer-events-none absolute top-1.5 left-0 w-full h-2.5 appearance-none bg-transparent focus:outline-none z-30 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-stone-900 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing [&::-webkit-slider-thumb]:active:scale-110 [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-stone-900 [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-grab"
            />
          </div>

          {/* Numeric Input Boxes & Range Labels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {/* Min Price Input Card */}
            <div className="bg-stone-50 border border-stone-200/90 rounded-xl p-3 focus-within:ring-2 focus-within:ring-stone-900 focus-within:border-stone-900 transition">
              <label
                htmlFor="input-price-min"
                className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1"
              >
                Minimum Budget
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-stone-500">{currencySymbol}</span>
                <input
                  type="text"
                  id="input-price-min"
                  value={minPrice.toLocaleString()}
                  onChange={handleMinInputChange}
                  className="w-full bg-transparent font-serif font-bold text-base text-stone-900 outline-none"
                  placeholder="0"
                />
                <span className="text-[11px] font-medium text-stone-400 whitespace-nowrap">
                  / night
                </span>
              </div>
            </div>

            {/* Max Price Input Card */}
            <div className="bg-stone-50 border border-stone-200/90 rounded-xl p-3 focus-within:ring-2 focus-within:ring-stone-900 focus-within:border-stone-900 transition">
              <label
                htmlFor="input-price-max"
                className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1"
              >
                Maximum Budget {maxPrice >= priceLimitMax && '(No Max Limit)'}
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-stone-500">{currencySymbol}</span>
                <input
                  type="text"
                  id="input-price-max"
                  value={maxPrice >= priceLimitMax ? `${priceLimitMax.toLocaleString()}+` : maxPrice.toLocaleString()}
                  onChange={handleMaxInputChange}
                  className="w-full bg-transparent font-serif font-bold text-base text-stone-900 outline-none"
                  placeholder={String(priceLimitMax)}
                />
                <span className="text-[11px] font-medium text-stone-400 whitespace-nowrap">
                  / night
                </span>
              </div>
            </div>
          </div>

          {/* Optional unpriced filter toggle */}
          {onToggleIncludeUnpriced && (
            <div className="flex items-center justify-between pt-1 border-t border-stone-100 text-xs">
              <label htmlFor="include-unpriced-checkbox" className="flex items-center gap-2 cursor-pointer text-stone-600 hover:text-stone-900">
                <input
                  type="checkbox"
                  id="include-unpriced-checkbox"
                  checked={includeUnpriced}
                  onChange={(e) => onToggleIncludeUnpriced(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-stone-300 rounded cursor-pointer"
                />
                <span>Include stays with rates on request (unpriced rooms)</span>
              </label>
              <span className="text-[11px] text-stone-400 hidden sm:inline">
                Direct booking with hosts
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
