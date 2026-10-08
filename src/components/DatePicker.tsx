import React, { useState, useRef, useEffect } from 'react';
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/style.css';
import { format, parse, isValid, addDays, startOfToday } from 'date-fns';
import { Calendar, Lock, Info } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  checkIn: string;
  checkOut: string;
  onSelect: (checkIn: string, checkOut: string) => void;
  isDateBlocked?: (dateStr: string) => boolean;
}

export default function DatePicker({ checkIn, checkOut, onSelect, isDateBlocked }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const disabledDays = [
    { before: startOfToday() },
    (date: Date) => {
      if (!isDateBlocked) return false;
      const dateStr = format(date, 'yyyy-MM-dd');
      return isDateBlocked(dateStr);
    }
  ];

  const parseDateStr = (str: string) => {
    if (!str) return undefined;
    const [y, m, d] = str.split('-');
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  };

  const selectedRange: DateRange | undefined = {
    from: parseDateStr(checkIn),
    to: parseDateStr(checkOut),
  };

  const handleSelect = (range: DateRange | undefined) => {
    if (!range) {
      onSelect('', '');
      return;
    }
    const fromStr = range.from ? format(range.from, 'yyyy-MM-dd') : '';
    let toStr = range.to ? format(range.to, 'yyyy-MM-dd') : '';
    
    // Ensure the selected range does not span any blocked dates
    if (fromStr && toStr && isDateBlocked) {
      let current = range.from!;
      let valid = true;
      let guard = 0;
      while (current < range.to! && guard++ < 1000) {
        if (isDateBlocked(format(current, 'yyyy-MM-dd'))) {
          valid = false;
          break;
        }
        current = addDays(current, 1);
      }
      if (!valid) {
        toast.error('The selected stay dates cross blocked or unavailable nights. Greyed-out dates have no availability.');
        // If the range spans a blocked date, just set the start date
        toStr = '';
      }
    }

    onSelect(fromStr, toStr);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const displayStr = checkIn && checkOut 
    ? `${checkIn ? format(parseDateStr(checkIn)!, 'MMM d, yyyy') : ''} - ${checkOut ? format(parseDateStr(checkOut)!, 'MMM d, yyyy') : ''}`
    : checkIn ? `${format(parseDateStr(checkIn)!, 'MMM d, yyyy')} - Select check-out`
    : 'Select check-in & check-out dates';

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-700 hover:border-stone-300 transition cursor-pointer"
      >
        <span className={checkIn ? 'font-medium text-stone-900' : 'text-stone-400'}>{displayStr}</span>
        <Calendar className="w-4 h-4 text-stone-500 shrink-0" />
      </button>

      <p className="mt-1.5 text-[11px] text-stone-500 flex items-center gap-1 font-medium">
        <Lock className="w-3 h-3 text-stone-400 shrink-0" />
        <span>Greyed-out dates = No availability (reserved or blocked by host)</span>
      </p>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 z-50 bg-white border border-stone-200 rounded-2xl shadow-xl p-4 max-w-sm w-full">
          {/* Explanatory Banner */}
          <div className="flex items-start gap-2 p-2.5 mb-3 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900 leading-snug">
            <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Greyed-out dates have NO availability.</span>
              <p className="text-[11px] text-amber-800/90 mt-0.5">
                These nights cannot be selected because they are fully booked or blocked by property management.
              </p>
            </div>
          </div>

          <DayPicker
            mode="range"
            selected={selectedRange}
            onSelect={handleSelect}
            disabled={disabledDays}
            numberOfMonths={1}
            className="text-sm mx-auto"
            modifiersClassNames={{
              disabled: '!opacity-30 !line-through !text-stone-400 !bg-stone-100/60 !cursor-not-allowed !pointer-events-none'
            }}
            styles={{
              day: { margin: '2px' },
            }}
          />

          {/* Mini Legend & Done */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-stone-100 flex-wrap gap-2">
            <div className="flex items-center gap-3 text-[11px] text-stone-500">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-stone-900 inline-block" />
                <span>Selected</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-stone-100 border border-stone-300 inline-block line-through text-[8px] text-stone-400 text-center leading-2.5">✕</span>
                <span>Greyed-out (No availability)</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="bg-stone-900 text-white px-4 py-1.5 rounded-full text-xs font-semibold hover:bg-stone-800 transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
