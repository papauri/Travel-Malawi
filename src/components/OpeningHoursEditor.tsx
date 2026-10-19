import React, { useState } from 'react';
import { Copy, Clock, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { DayHours, WeeklyHours } from '../types';
import { DAY_NAMES, DISPLAY_ORDER, defaultWeek, allDayWeek, isWeekAllDay, normaliseHours } from '../lib/hours';

interface Props {
  value: WeeklyHours | undefined;
  onChange: (hours: WeeklyHours) => void;
  label?: string;
  hint?: string;
}

/**
 * Opening hours editor supporting:
 * - 1-tap "All Day (24/7)" round-the-clock setting for the entire property
 * - Per-day "All Day" toggles
 * - Custom open / close hours per day
 */
export default function OpeningHoursEditor({ value, onChange, label = 'Opening hours', hint }: Props) {
  const week = normaliseHours(value) ?? defaultWeek();
  const all7DaysAllDay = isWeekAllDay(week);
  const [showDayBreakdown, setShowDayBreakdown] = useState<boolean>(!all7DaysAllDay);

  const isAllDay = (day: DayHours) => !day.closed && day.open === day.close;

  const update = (dayIndex: number, patch: Partial<DayHours>) => {
    const next = week.map((day, index) => (index === dayIndex ? { ...day, ...patch } : day));
    onChange(next);
  };

  const toggleAllDay = (dayIndex: number) => {
    const day = week[dayIndex];
    if (isAllDay(day)) {
      update(dayIndex, { closed: false, open: '07:00', close: '22:00' });
    } else {
      update(dayIndex, { closed: false, open: '00:00', close: '00:00' });
    }
  };

  const setAll24Hours = () => {
    onChange(allDayWeek());
  };

  const setStandardHours = () => {
    onChange(defaultWeek('07:00', '22:00'));
    setShowDayBreakdown(true);
  };

  /** Most properties keep the same hours all week, so this saves six edits. */
  const applyToAll = (dayIndex: number) => {
    const source = week[dayIndex];
    onChange(week.map(() => ({ ...source })));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="tm-label mb-0">{label}</label>
        
        {/* Quick Mode Buttons */}
        <div className="flex items-center gap-1.5 p-0.5 bg-stone-100 rounded-lg border border-stone-200/80">
          <button
            type="button"
            onClick={setAll24Hours}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              all7DaysAllDay
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
            title="Set property to open 24 hours / all day every day"
          >
            {all7DaysAllDay && <CheckCircle2 className="h-3 w-3 text-emerald-700" />}
            <span>Open 24/7</span>
          </button>
          
          <button
            type="button"
            onClick={setStandardHours}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              !all7DaysAllDay
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
            title="Switch to custom opening and closing times per day"
          >
            <Clock className="h-3 w-3" />
            <span>Set hours</span>
          </button>
        </div>
      </div>

      {hint && <p className="text-xs text-stone-500">{hint}</p>}

      {/* Banner when All Day (24/7) is active */}
      {all7DaysAllDay && (
        <div className="rounded-lg bg-stone-50 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm text-stone-700 min-w-0">
            <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
            Guests see "Open 24 hours".
          </p>
          <button
            type="button"
            onClick={() => setShowDayBreakdown(!showDayBreakdown)}
            className="tm-btn tm-btn-quiet tm-btn-sm"
          >
            <span>{showDayBreakdown ? 'Hide days' : 'Edit days'}</span>
            {showDayBreakdown ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}

      {/* Daily Rows Table */}
      {(!all7DaysAllDay || showDayBreakdown) && (
        <div className="rounded-lg border border-stone-200 divide-y divide-stone-100 overflow-hidden bg-white">
          {DISPLAY_ORDER.map(dayIndex => {
            const day = week[dayIndex];
            const allDayActive = isAllDay(day);

            return (
              <div key={dayIndex} className="flex flex-wrap items-center gap-2 sm:gap-3 px-3.5 sm:px-4 py-2.5 sm:py-3 bg-white">
                <span className="w-20 sm:w-24 text-xs sm:text-sm font-semibold text-stone-700 shrink-0">{DAY_NAMES[dayIndex]}</span>

                <label className="flex items-center gap-1.5 text-xs text-stone-500 shrink-0 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!day.closed}
                    onChange={e => update(dayIndex, { closed: !e.target.checked })}
                    className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900 cursor-pointer"
                  />
                  Open
                </label>

                {!day.closed && (
                  <button
                    type="button"
                    onClick={() => toggleAllDay(dayIndex)}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition cursor-pointer shrink-0 ${
                      allDayActive
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-white hover:bg-stone-50 text-stone-600 border-stone-300'
                    }`}
                    title={allDayActive ? "Click to set custom open/close hours" : "Click to set this day open 24 hours / all day"}
                  >
                    {allDayActive ? '✓ 24 hours' : '24 hours'}
                  </button>
                )}

                {day.closed ? (
                  <span className="text-xs sm:text-sm text-stone-400 italic">Closed</span>
                ) : allDayActive ? (
                  <span className="text-xs sm:text-sm text-stone-600">Open 24 hours</span>
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
                    <input
                      type="time"
                      value={day.open}
                      onChange={e => update(dayIndex, { open: e.target.value })}
                      className="bg-white border border-stone-300 rounded-lg px-2 sm:px-2.5 py-1 sm:py-1.5 text-xs sm:text-sm focus:outline-none focus:border-stone-500 transition"
                    />
                    <span className="text-stone-400 text-xs sm:text-sm">to</span>
                    <input
                      type="time"
                      value={day.close}
                      onChange={e => update(dayIndex, { close: e.target.value })}
                      className="bg-white border border-stone-300 rounded-lg px-2 sm:px-2.5 py-1 sm:py-1.5 text-xs sm:text-sm focus:outline-none focus:border-stone-500 transition"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => applyToAll(dayIndex)}
                  title="Copy these hours to every day"
                  className="ml-auto flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-900 transition shrink-0 cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Apply to all</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
