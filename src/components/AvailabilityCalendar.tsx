/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { RoomType } from '../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  hotelId: string;
  rooms: RoomType[];
  onDateSelect?: (date: string) => void;
}

interface DayInfo {
  date: Date;
  dateStr: string;
  bookedCount: number;
  totalRooms: number;
}

type Availability = 'available' | 'limited' | 'full' | 'past' | 'empty';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

export default function AvailabilityCalendar({ hotelId, rooms, onDateSelect }: Props) {
  const today = useMemo(() => toDateStr(new Date()), []);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [bookedMap, setBookedMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Total room inventory across all room types
  const totalRooms = useMemo(
    () => rooms.reduce((sum, r) => sum + (r.quantity ?? 0), 0),
    [rooms]
  );

  useEffect(() => {
    async function fetchBookings() {
      if (!hotelId) return;
      setLoading(true);
      try {
        const q = query(
          collection(db, 'bookings'),
          where('hotelId', '==', hotelId),
          where('status', 'in', ['pending', 'confirmed'])
        );
        const snap = await getDocs(q);
        const map: Record<string, number> = {};

        snap.docs.forEach(doc => {
          const data = doc.data();
          const { checkIn, checkOut, quantity = 1 } = data as {
            checkIn: string;
            checkOut: string;
            quantity?: number;
          };
          if (!checkIn || !checkOut) return;
          let cursor = checkIn;
          while (cursor < checkOut) {
            map[cursor] = (map[cursor] ?? 0) + quantity;
            cursor = addDays(cursor, 1);
          }
        });

        setBookedMap(map);
      } catch (e) {
        console.error('Error fetching bookings for calendar:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchBookings();
  }, [hotelId]);

  // Build grid cells for the current view month
  const { cells, weeks } = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const startOffset = firstDay.getDay(); // 0=Sun

    const days: (DayInfo | null)[] = [];
    for (let i = 0; i < startOffset; i++) days.push(null);

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(viewYear, viewMonth, d);
      const dateStr = toDateStr(date);
      days.push({ date, dateStr, bookedCount: bookedMap[dateStr] ?? 0, totalRooms });
    }

    // Pad to full rows of 7
    while (days.length % 7 !== 0) days.push(null);

    const w: (DayInfo | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) w.push(days.slice(i, i + 7));
    return { cells: days, weeks: w };
  }, [viewYear, viewMonth, bookedMap, totalRooms]);

  function getAvailability(day: DayInfo): Availability {
    if (day.dateStr < today) return 'past';
    if (day.totalRooms === 0) return 'available';
    const ratio = day.bookedCount / day.totalRooms;
    if (ratio >= 1) return 'full';
    if (ratio >= 0.5) return 'limited';
    return 'available';
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  // Prevent navigating before current month
  const isPrevDisabled =
    viewYear < new Date().getFullYear() ||
    (viewYear === new Date().getFullYear() && viewMonth <= new Date().getMonth());

  function handleDayClick(day: DayInfo) {
    const avail = getAvailability(day);
    if (avail === 'past' || avail === 'full') return;
    onDateSelect?.(day.dateStr);
  }

  const cellStyles: Record<Availability, string> = {
    available: 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 cursor-pointer border border-emerald-200',
    limited:   'bg-amber-50 text-amber-800 hover:bg-amber-100 cursor-pointer border border-amber-200',
    full:      'bg-red-50 text-red-400 cursor-not-allowed border border-red-100 opacity-70',
    past:      'bg-stone-50 text-stone-300 cursor-default border border-stone-100',
    empty:     '',
  };

  const dotStyles: Record<Availability, string> = {
    available: 'bg-emerald-400',
    limited:   'bg-amber-400',
    full:      'bg-red-400',
    past:      'hidden',
    empty:     'hidden',
  };

  return (
    <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-stone-100">
        <div>
          <h3 className="text-xl font-serif text-stone-900">Availability</h3>
          <p className="text-sm text-stone-500 mt-0.5">Select a check-in date</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            disabled={isPrevDisabled}
            className="p-2 rounded-full hover:bg-stone-100 transition disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5 text-stone-600" />
          </button>
          <span className="text-base font-semibold text-stone-900 w-36 text-center">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button
            onClick={nextMonth}
            className="p-2 rounded-full hover:bg-stone-100 transition"
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5 text-stone-600" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-stone-200 border-t-stone-700" />
        </div>
      ) : (
        <div className="px-6 py-6">
          {/* Day name headers */}
          <div className="grid grid-cols-7 mb-2">
            {DAY_NAMES.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-stone-400 uppercase tracking-wider py-2">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} />;
              const avail = getAvailability(day);
              const isToday = day.dateStr === today;
              return (
                <button
                  key={day.dateStr}
                  onClick={() => handleDayClick(day)}
                  disabled={avail === 'past' || avail === 'full'}
                  title={
                    avail === 'available' ? 'Rooms available' :
                    avail === 'limited'   ? 'Limited availability' :
                    avail === 'full'      ? 'Fully booked' :
                    undefined
                  }
                  className={`
                    relative flex flex-col items-center justify-center
                    rounded-xl py-2 px-1 text-sm font-medium transition
                    ${cellStyles[avail]}
                    ${isToday ? 'ring-2 ring-stone-400 ring-offset-1' : ''}
                  `}
                >
                  <span>{day.date.getDate()}</span>
                  <span className={`mt-1 h-1.5 w-1.5 rounded-full ${dotStyles[avail]}`} />
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-6 mt-6 pt-4 border-t border-stone-100 flex-wrap">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Legend</span>
            {[
              { avail: 'available' as Availability, label: 'Available' },
              { avail: 'limited'   as Availability, label: 'Limited' },
              { avail: 'full'      as Availability, label: 'Fully Booked' },
            ].map(({ avail, label }) => (
              <div key={avail} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${dotStyles[avail]}`} />
                <span className="text-xs text-stone-500">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
