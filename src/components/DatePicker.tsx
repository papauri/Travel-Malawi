import React, { useState, useRef, useEffect } from 'react';
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/style.css';
import { format, parse, isValid, addDays, startOfToday } from 'date-fns';
import { Calendar } from 'lucide-react';
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
      if (!isDateBlocked(dateStr)) return false;
      // A blocked night can still be the check-out day (check-out is not a
      // night stayed), provided every night from check-in up to it is free.
      if (checkIn && !checkOut && dateStr > checkIn) {
        let cursor = checkIn;
        let guard = 0;
        while (cursor < dateStr && guard++ < 1000) {
          if (isDateBlocked(cursor)) return true;
          cursor = format(addDays(parseDateStr(cursor)!, 1), 'yyyy-MM-dd');
        }
        return false;
      }
      return true;
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
        toast.error('Those dates include a night that is not available. Pick dates without grey days.');
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
        className="tm-input flex items-center justify-between gap-2 text-left hover:border-stone-400 transition-colors cursor-pointer"
      >
        <span className={`truncate ${checkIn ? 'font-medium text-stone-900' : 'text-stone-400'}`}>{displayStr}</span>
        <Calendar className="w-4 h-4 text-stone-500 shrink-0" />
      </button>

      <p className="mt-1.5 text-xs text-stone-500">Grey dates are already booked or closed.</p>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 z-50 bg-white border border-stone-200 rounded-xl shadow-sm p-3 sm:p-4 max-w-sm w-full">
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

          <div className="flex justify-end mt-3 pt-3 border-t border-stone-100">
            <button type="button" onClick={() => setIsOpen(false)} className="tm-btn tm-btn-primary tm-btn-sm">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
