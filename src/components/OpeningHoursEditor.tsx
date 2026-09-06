import React from 'react';
import { Copy } from 'lucide-react';
import { DayHours, WeeklyHours } from '../types';
import { DAY_NAMES, DISPLAY_ORDER, defaultWeek, normaliseHours } from '../lib/hours';

interface Props {
  value: WeeklyHours | undefined;
  onChange: (hours: WeeklyHours) => void;
  label?: string;
  hint?: string;
}

/**
 * Seven rows of open/close times with a per-day closed toggle.
 *
 * Used for both the property's own hours and its restaurant's, which are
 * frequently different — a lodge reception runs all day while its kitchen
 * serves two sittings.
 */
export default function OpeningHoursEditor({ value, onChange, label = 'Opening hours', hint }: Props) {
  const week = normaliseHours(value) ?? defaultWeek();

  const update = (dayIndex: number, patch: Partial<DayHours>) => {
    const next = week.map((day, index) => (index === dayIndex ? { ...day, ...patch } : day));
    onChange(next);
  };

  /** Most properties keep the same hours all week, so this saves six edits. */
  const applyToAll = (dayIndex: number) => {
    const source = week[dayIndex];
    onChange(week.map(() => ({ ...source })));
  };

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2 gap-4">
        <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider">{label}</label>
        {!value && (
          <button
            type="button"
            onClick={() => onChange(defaultWeek())}
            className="text-xs font-semibold text-stone-500 hover:text-stone-900 transition"
          >
            Add hours
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-stone-400 mb-3">{hint}</p>}

      <div className="rounded-2xl border border-stone-200 divide-y divide-stone-100 overflow-hidden">
        {DISPLAY_ORDER.map(dayIndex => {
          const day = week[dayIndex];
          return (
            <div key={dayIndex} className="flex flex-wrap items-center gap-3 px-4 py-3 bg-white">
              <span className="w-24 text-sm font-semibold text-stone-700 shrink-0">{DAY_NAMES[dayIndex]}</span>

              <label className="flex items-center gap-2 text-xs text-stone-500 shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!day.closed}
                  onChange={e => update(dayIndex, { closed: !e.target.checked })}
                  className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                />
                Open
              </label>

              {day.closed ? (
                <span className="text-sm text-stone-400 italic">Closed</span>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={day.open}
                    onChange={e => update(dayIndex, { open: e.target.value })}
                    className="bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-stone-900 transition"
                  />
                  <span className="text-stone-400 text-sm">to</span>
                  <input
                    type="time"
                    value={day.close}
                    onChange={e => update(dayIndex, { close: e.target.value })}
                    className="bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-stone-900 transition"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => applyToAll(dayIndex)}
                title="Copy these hours to every day"
                className="ml-auto flex items-center gap-1.5 text-xs font-medium text-stone-400 hover:text-stone-900 transition shrink-0"
              >
                <Copy className="h-3.5 w-3.5" /> Apply to all
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-stone-400 mt-2">
        Setting the same opening and closing time means open 24 hours. A closing time
        earlier than the opening time runs past midnight.
      </p>
    </div>
  );
}
