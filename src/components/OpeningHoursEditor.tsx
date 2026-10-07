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
        <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider">{label}</label>
        
        {/* Quick Mode Buttons */}
        <div className="flex items-center gap-1.5 p-0.5 bg-stone-100 rounded-lg border border-stone-200/80">
          <button
            type="button"
            onClick={setAll24Hours}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              all7DaysAllDay
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/70'
            }`}
            title="Set property to open 24 hours / all day every day"
          >
            {all7DaysAllDay && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
            <span>All Day (24/7)</span>
          </button>
          
          <button
            type="button"
            onClick={setStandardHours}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              !all7DaysAllDay
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/70'
            }`}
            title="Switch to custom opening and closing times per day"
          >
            <Clock className="h-3 w-3" />
            <span>Custom Hours</span>
          </button>
        </div>
      </div>

      {hint && <p className="text-xs text-stone-400">{hint}</p>}

      {/* Banner when All Day (24/7) is active */}
      {all7DaysAllDay && (
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="p-1 rounded-md bg-stone-900 text-white mt-0.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </span>
            <div>
              <p className="text-xs font-bold text-stone-900">Open All Day (24/7 Round-the-Clock)</p>
              <p className="text-[11px] text-stone-500 mt-0.5">
                Your listing shows <span className="font-semibold text-emerald-800">"Open 24 hours"</span> and stays <span className="font-semibold text-emerald-800">"Open now"</span> constantly for arriving guests.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowDayBreakdown(!showDayBreakdown)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-white border border-stone-300 px-2.5 py-1.5 rounded-lg transition self-start sm:self-auto cursor-pointer shrink-0"
          >
            <span>{showDayBreakdown ? 'Hide schedule rows' : 'View / customize days'}</span>
            {showDayBreakdown ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}

      {/* Daily Rows Table */}
      {(!all7DaysAllDay || showDayBreakdown) && (
        <div className="rounded-2xl border border-stone-200 divide-y divide-stone-100 overflow-hidden bg-white shadow-2xs">
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
                        ? 'bg-stone-900 text-white border-stone-900 shadow-2xs'
                        : 'bg-stone-50 hover:bg-stone-100 text-stone-600 border-stone-200'
                    }`}
                    title={allDayActive ? "Click to set custom open/close hours" : "Click to set this day open 24 hours / all day"}
                  >
                    {allDayActive ? '✓ All Day (24 hrs)' : 'All Day'}
                  </button>
                )}

                {day.closed ? (
                  <span className="text-xs sm:text-sm text-stone-400 italic">Closed</span>
                ) : allDayActive ? (
                  <span className="text-xs sm:text-sm text-stone-600 font-medium bg-stone-100/80 px-2.5 py-1 rounded-lg">
                    Open 24 hours around the clock
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <input
                      type="time"
                      value={day.open}
                      onChange={e => update(dayIndex, { open: e.target.value })}
                      className="bg-stone-50 border border-stone-200 rounded-lg px-2 sm:px-2.5 py-1 sm:py-1.5 text-xs sm:text-sm outline-none focus:border-stone-900 transition"
                    />
                    <span className="text-stone-400 text-xs sm:text-sm">to</span>
                    <input
                      type="time"
                      value={day.close}
                      onChange={e => update(dayIndex, { close: e.target.value })}
                      className="bg-stone-50 border border-stone-200 rounded-lg px-2 sm:px-2.5 py-1 sm:py-1.5 text-xs sm:text-sm outline-none focus:border-stone-900 transition"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => applyToAll(dayIndex)}
                  title="Copy these hours to every day"
                  className="ml-auto flex items-center gap-1.5 text-xs font-medium text-stone-400 hover:text-stone-900 transition shrink-0 cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Apply to all</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-stone-400">
        Tip: Select "All Day (24/7)" for 24-hour round-the-clock service, or set custom opening and closing hours per day.
      </p>
    </div>
  );
}
