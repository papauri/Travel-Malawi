/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { RoomType } from '../types';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { BookingLike, buildOccupancyMap } from '../lib/availability';
import { DateStr, toDateStr, todayStr, addDays, formatDateStr } from '../lib/dates';

interface Props {
  hotelId: string;
  rooms: RoomType[];
  onDateSelect?: (date: DateStr) => void;
  onRangeSelect?: (inDate: DateStr, outDate: DateStr) => void;
  checkIn?: DateStr;
  checkOut?: DateStr;
  selectedRoom?: RoomType | null;
  /**
   * Manager mode. When supplied, clicking a day toggles it in the room's
   * blocked list instead of selecting it as a check-in date.
   */
  onToggleBlocked?: (date: DateStr) => void;
  /** Blocked dates being edited, so the grid reflects unsaved changes. */
  blockedDates?: string[];
  /** Blocked units being edited. */
  blockedUnits?: Record<string, number>;
  availableRoomNames?: string[];
}

interface DayInfo {
  date: Date;
  dateStr: DateStr;
  bookedCount: number;
  totalRooms: number;
  isBlocked: boolean;
}

type Availability = 'available' | 'limited' | 'full' | 'blocked' | 'past' | 'empty';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function AvailabilityCalendar({
  hotelId,
  rooms,
  onDateSelect,
  onRangeSelect,
  checkIn,
  checkOut,
  selectedRoom,
  onToggleBlocked,
  blockedDates,
  blockedUnits,
  availableRoomNames = [],
}: Props) {
  const today = todayStr();
  const isManagerMode = !!onToggleBlocked;

  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [bookedMap, setBookedMap] = useState<Record<DateStr, number>>({});
  const [loading, setLoading] = useState(true);

  // Depend on the room's id rather than the object: a parent that rebuilds the
  // room on each render would otherwise re-run the query every render.
  const selectedRoomId = selectedRoom?.id;

  /** Total inventory in view — one room type, or the whole property. */
  const totalRooms = useMemo(
    () => (selectedRoom ? selectedRoom.quantity ?? 0 : rooms.reduce((sum, r) => sum + (r.quantity ?? 0), 0)),
    [rooms, selectedRoom]
  );

  /**
   * Dates taken off sale by hand, with how much inventory each one removes.
   * Previously only the selected room's blocked dates counted, so the
   * property-wide calendar showed hand-blocked nights as bookable.
   */
  const blockedInventory = useMemo(() => {
    const totals: Record<DateStr, number> = {};

    if (selectedRoom) {
      const dates = blockedDates ?? selectedRoom.blockedDates ?? [];
      const qty = selectedRoom.quantity ?? 0;
      for (const d of dates) {
        totals[d] = (totals[d] ?? 0) + qty;
      }
      
      const units = blockedUnits ?? selectedRoom.blockedUnits ?? {};
      for (const [d, u] of Object.entries(units)) {
        if (!totals[d] || totals[d] < qty) {
          totals[d] = Math.max(totals[d] ?? 0, Number(u));
        }
      }
    } else {
      for (const r of rooms) {
        const dates = r.blockedDates ?? [];
        const qty = r.quantity ?? 0;
        for (const d of dates) {
          totals[d] = (totals[d] ?? 0) + qty;
        }
        
        const units = r.blockedUnits ?? {};
        for (const [d, u] of Object.entries(units)) {
          if (!dates.includes(d)) {
            totals[d] = (totals[d] ?? 0) + Number(u);
          }
        }
      }
    }

    return Object.entries(totals).map(([date, units]) => ({ date, units }));
  }, [rooms, selectedRoom, blockedDates, blockedUnits]);

  const blockedSet = useMemo(() => {
    const set = new Set<string>();
    for (const b of blockedInventory) {
      if (totalRooms > 0 && b.units >= totalRooms) {
        set.add(b.date);
      } else if (totalRooms === 0 && b.units > 0) {
        set.add(b.date);
      }
    }
    return set;
  }, [blockedInventory, totalRooms]);

  const [rawBookings, setRawBookings] = useState<BookingLike[]>([]);

  useEffect(() => {
    async function fetchBookings() {
      if (!hotelId) return;
      setLoading(true);
      try {
        // Status is filtered in JS: an inequality on status would force a
        // composite index, and the result set per hotel is small.
        const q = selectedRoomId
          ? query(
              collection(db, 'bookings'),
              where('hotelId', '==', hotelId),
              where('roomTypeId', '==', selectedRoomId)
            )
          : query(collection(db, 'bookings'), where('hotelId', '==', hotelId));

        const snap = await getDocs(q);
        setRawBookings(snap.docs.map(d => d.data() as BookingLike));
      } catch (e) {
        console.error('Error fetching bookings for calendar:', e);
        setRawBookings([]);
      } finally {
        setLoading(false);
      }
    }
    fetchBookings();
  }, [hotelId, selectedRoomId]);

  // Recomputed separately from the fetch so editing blocked dates in manager
  // mode updates the grid without another round trip.
  useEffect(() => {
    setBookedMap(buildOccupancyMap(rawBookings, blockedInventory));
  }, [rawBookings, blockedInventory]);

  // Build grid cells for the current view month
  const cells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const startOffset = firstDay.getDay(); // 0=Sun

    const days: (DayInfo | null)[] = [];
    for (let i = 0; i < startOffset; i++) days.push(null);

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(viewYear, viewMonth, d);
      const dateStr = toDateStr(date);
      days.push({
        date,
        dateStr,
        bookedCount: bookedMap[dateStr] ?? 0,
        totalRooms,
        isBlocked: blockedSet.has(dateStr),
      });
    }

    // Pad to full rows of 7
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [viewYear, viewMonth, bookedMap, totalRooms, blockedSet]);

  function getAvailability(day: DayInfo): Availability {
    if (day.dateStr < today) return 'past';
    if (day.isBlocked) return 'blocked';
    // A property with no inventory is neither wide open (what this used to
    // claim) nor sold out. Guests get an explicit notice instead of a grid; in
    // manager mode the grid stays usable so dates can still be blocked.
    if (day.totalRooms === 0) return isManagerMode ? 'available' : 'full';
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
    if (avail === 'past') return;
    
    // In manager mode, allow selecting booked dates
    // For guests, they can't start a booking on a blocked date, 
    // but they CAN end a booking on a blocked date if the range before it is valid.
    const isSelectingCheckout = !isManagerMode && checkIn && !checkOut && day.dateStr > checkIn;
    
    if (!isManagerMode && !isSelectingCheckout && (avail === 'full' || avail === 'blocked')) {
      return;
    }

    if (onRangeSelect) {
      if (!checkIn || (checkIn && checkOut)) {
        onRangeSelect(day.dateStr, '');
        // If clicking the last day of the month as the checkIn date, auto-advance to next month
        const lastDayOfMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        if (day.date.getDate() === lastDayOfMonth) {
          nextMonth();
        }
      } else {
        if (day.dateStr <= checkIn) {
          onRangeSelect(day.dateStr, '');
        } else {
          let valid = true;
          if (!isManagerMode) {
            let cursor = checkIn;
            while (cursor < day.dateStr) {
              const b = bookedMap[cursor] || 0;
              const isBlocked = blockedSet.has(cursor);
              if (totalRooms === 0 || isBlocked || b >= totalRooms) {
                valid = false;
                break;
              }
              cursor = addDays(cursor, 1);
            }
          }
          if (valid) {
            onRangeSelect(checkIn, day.dateStr);
          } else {
            onRangeSelect(day.dateStr, '');
          }
        }
      }
    } else if (isManagerMode && onToggleBlocked) {
      onToggleBlocked(day.dateStr);
    } else {
      onDateSelect?.(day.dateStr);
    }
  }

  const cellStyles: Record<Availability, string> = {
    available: 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 cursor-pointer border border-emerald-200',
    limited:   'bg-amber-50 text-amber-800 hover:bg-amber-100 cursor-pointer border border-amber-200',
    full:      'bg-red-50 text-red-400 border border-red-100 opacity-70',
    blocked:   'bg-stone-800 text-stone-200 border border-stone-700',
    past:      'bg-stone-50 text-stone-300 cursor-default border border-stone-100',
    empty:     '',
  };

  const dotStyles: Record<Availability, string> = {
    available: 'bg-emerald-400',
    limited:   'bg-amber-400',
    full:      'bg-red-400',
    blocked:   'bg-stone-400',
    past:      'hidden',
    empty:     'hidden',
  };

  const legend: { avail: Availability; label: string }[] = [
    { avail: 'available', label: 'Available' },
    { avail: 'limited', label: 'Limited' },
    { avail: 'full', label: 'Fully Booked' },
    { avail: 'blocked', label: 'Blocked' },
  ];

  return (
    <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-stone-100">
        <div>
          <h3 className="text-xl font-serif text-stone-900">Availability</h3>
          <div className="text-sm text-stone-500 mt-0.5 flex flex-col gap-1.5">
            <p>{isManagerMode ? 'Click a date to block or unblock it' : 'Select your travel dates'}</p>
            {(!isManagerMode && (checkIn || checkOut)) && (
              <div className="flex flex-col gap-2 mt-1">
                <p className="font-semibold text-emerald-700 bg-emerald-50 self-start px-3 py-1 rounded-md border border-emerald-100/50">
                  {checkIn ? formatDateStr(checkIn) : 'Select check-in'}
                  <span className="text-emerald-400 mx-2">→</span>
                  {checkOut ? formatDateStr(checkOut) : 'Select check-out'}
                </p>
                {checkIn && checkOut && (
                  <div className="text-xs">
                    {availableRoomNames.length > 0 ? (
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-emerald-700 font-medium">Available: {availableRoomNames.join(', ')}</span>
                        <button 
                          onClick={() => document.getElementById('rooms-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                          className="mt-1 bg-stone-900 text-white px-3 py-1.5 rounded-full font-bold uppercase tracking-wider text-[9px] hover:bg-emerald-700 transition-colors shadow-sm"
                        >
                          Scroll to Book
                        </button>
                      </div>
                    ) : (
                      <span className="text-red-500 font-medium">No rooms available for these dates.</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
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
            type="button"
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
      ) : totalRooms === 0 && !isManagerMode ? (
        <div className="px-8 py-12 text-center">
          <p className="text-stone-500">This property has not published its room availability yet.</p>
          <p className="text-sm text-stone-400 mt-1">Contact them directly to check dates.</p>
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
              // In manager mode every future day stays clickable, including
              // sold-out ones, so a date can always be taken off sale.
              const isSelectingCheckout = !isManagerMode && checkIn && !checkOut && day.dateStr > checkIn;
              
              // We need to check if the range from checkIn to day.dateStr is valid before enabling it as a checkout date
              let isValidCheckout = false;
              if (isSelectingCheckout) {
                isValidCheckout = true;
                let cursor = checkIn;
                while (cursor < day.dateStr) {
                  const b = bookedMap[cursor] || 0;
                  const isBlocked = blockedSet.has(cursor);
                  if (totalRooms === 0 || isBlocked || b >= totalRooms) {
                    isValidCheckout = false;
                    break;
                  }
                  cursor = addDays(cursor, 1);
                }
              }

              const disabled = avail === 'past' || (!isManagerMode && !isValidCheckout && (avail === 'full' || avail === 'blocked'));
              
              const isSelected = day.dateStr === checkIn || day.dateStr === checkOut;
              const isInRange = checkIn && checkOut && day.dateStr > checkIn && day.dateStr < checkOut;
              
              const rangeStyles = isSelected
                ? 'bg-stone-900 text-white ring-2 ring-stone-900 ring-offset-1 border-stone-900 hover:bg-stone-800'
                : isInRange
                ? 'bg-stone-100 text-stone-900 border-stone-200 hover:bg-stone-200'
                : cellStyles[avail];

              return (
                <button
                  key={day.dateStr}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  disabled={disabled}
                  title={
                    avail === 'blocked'   ? 'Blocked by the property' :
                    avail === 'available' ? 'Rooms available' :
                    avail === 'limited'   ? 'Limited availability' :
                    avail === 'full'      ? 'Fully booked' :
                    undefined
                  }
                  className={`
                    relative flex flex-col items-center justify-center
                    rounded-xl py-2 px-1 text-sm font-medium transition
                    ${rangeStyles}
                    ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
                    ${isToday && !isSelected ? 'ring-2 ring-stone-400 ring-offset-1' : ''}
                  `}
                >
                  <span>{day.date.getDate()}</span>
                  {avail === 'blocked' ? (
                    <Lock className={`mt-1 h-2.5 w-2.5 ${isSelected ? 'text-stone-300' : ''}`} />
                  ) : (
                    <span className={`mt-1 h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : dotStyles[avail]}`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-6 mt-6 pt-4 border-t border-stone-100 flex-wrap">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Legend</span>
            {legend.map(({ avail, label }) => (
              <div key={avail} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${avail === 'blocked' ? 'bg-stone-800' : dotStyles[avail]}`} />
                <span className="text-xs text-stone-500">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
