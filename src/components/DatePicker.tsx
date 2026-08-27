import React, { useState, useRef, useEffect } from 'react';
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format, parse, isValid, addDays } from 'date-fns';
import { Calendar } from 'lucide-react';

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
    { before: new Date() },
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
    const toStr = range.to ? format(range.to, 'yyyy-MM-dd') : '';
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
    : checkIn ? `${format(parseDateStr(checkIn)!, 'MMM d, yyyy')} - Checkout`
    : 'Select dates';

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-700 hover:border-stone-300 transition"
      >
        <span>{displayStr}</span>
        <Calendar className="w-4 h-4 text-stone-400" />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 z-50 bg-white border border-stone-200 rounded-2xl shadow-xl p-4">
          <DayPicker
            mode="range"
            selected={selectedRange}
            onSelect={handleSelect}
            disabled={disabledDays}
            numberOfMonths={1}
            className="text-sm"
            styles={{
              day: { margin: '2px' },
              
            }}
          />
          <div className="flex justify-end mt-4">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="bg-stone-900 text-white px-4 py-2 rounded-lg text-sm font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
