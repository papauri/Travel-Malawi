import React, { useState, useMemo, useEffect } from 'react';
import { Hotel, RoomType, CurrencyCode, Promotion, SaleType, DiscountType } from '../types';
import { db } from '../lib/firebase';
import { doc, writeBatch, runTransaction } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { roomPrice, roomCurrencies, formatMoney, roundPrice } from '../lib/currency';
import { SALE_TYPE_OPTIONS, getSaleTypeBadge, getSaleTypeLabel, calculateSlashedPrice, getPromotionStatus, malawiToday, validatePromotion, MAX_PROMO_DISCOUNT_PERCENT } from '../lib/promotions';
import { validateRoom, firstError } from '../lib/validateRoom';
import { addDays } from '../lib/dates';
import { saveUpdatedRooms, saveSingleCachedHotel } from '../lib/mapCache';
import ConfirmDialog from './ConfirmDialog';
import {
  SlidersHorizontal, Percent, DollarSign, Tag, Check,
  RotateCcw, TrendingDown, TrendingUp, Calendar, Zap, AlertCircle,
  ArrowRight, ChevronDown, Building2, BedDouble, Search, X, Info, Plus,
  Save, Loader2, CheckCircle2, Sliders, Layers, Play, Pause, Trash2, Clock
} from 'lucide-react';

export type BulkEditorMode = 'rates' | 'promotions' | 'active_promotions';
export type RateAdjustmentType = 'percentage_discount' | 'percentage_increase' | 'amount_drop' | 'amount_increase';

/** The deepest base-rate cut the bulk editor will apply. */
const MAX_RATE_DISCOUNT_PERCENT = 90;
/** Firestore allows 500 writes per batch; stay well under it. */
const BATCH_CHUNK = 450;
export type PromoDiscountMode = 'percentage' | 'fixed_slash';

interface BulkRoomEditorProps {
  hotels: Hotel[];
  rooms: RoomType[];
  initialHotelId?: string;
  onClose?: () => void;
  onRoomsUpdated?: (updatedRooms: RoomType[]) => void;
  onHotelsUpdated?: (updatedHotels: Hotel[]) => void;
  /** Whether displayed as an embedded panel or a standalone modal */
  isEmbedded?: boolean;
}

export default function BulkRoomEditor({
  hotels,
  rooms,
  initialHotelId,
  onClose,
  onRoomsUpdated,
  onHotelsUpdated,
  isEmbedded = false,
}: BulkRoomEditorProps) {
  // Tab / Mode: "rates" (Direct Base Rates Update) vs "promotions" (Promotional Slash Campaign)
  const [activeTab, setActiveTab] = useState<BulkEditorMode>('rates');

  // Filter & Search
  const [selectedHotelFilter, setSelectedHotelFilter] = useState<string>(initialHotelId || 'all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Room IDs
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);

  // Rates Adjustment State
  const [rateAdjustmentType, setRateAdjustmentType] = useState<RateAdjustmentType>('percentage_discount');
  const [ratePercentage, setRatePercentage] = useState<number>(15);
  const [customRatePercentage, setCustomRatePercentage] = useState<string>('15');
  const [rateAmountCurrency, setRateAmountCurrency] = useState<CurrencyCode>('MWK');
  const [rateAmount, setRateAmount] = useState<number>(15000);
  const [customRateAmount, setCustomRateAmount] = useState<string>('15000');

  // Promotions State
  const [promoSaleType, setPromoSaleType] = useState<SaleType>('flash_sale');
  const [promoCustomTitle, setPromoCustomTitle] = useState('');
  const [promoDiscountMode, setPromoDiscountMode] = useState<PromoDiscountMode>('percentage');
  const [promoPercentage, setPromoPercentage] = useState<number>(20);
  const [customPromoPercentage, setCustomPromoPercentage] = useState<string>('20');
  const [promoSortedCurrency, setPromoSortedCurrency] = useState<CurrencyCode>('MWK');
  const [promoSortedAmount, setPromoSortedAmount] = useState<number>(20000);
  const [customPromoAmount, setCustomPromoAmount] = useState<string>('20000');
  const [promoStartDate, setPromoStartDate] = useState<string>(() => malawiToday());
  const [promoEndDate, setPromoEndDate] = useState<string>('');
  const [promoBadgeText, setPromoBadgeText] = useState<string>('');

  // Submitting state
  const [saving, setSaving] = useState(false);

  // Map of hotels for quick lookup
  const hotelsMap = useMemo(() => {
    const map = new Map<string, Hotel>();
    for (const h of hotels) {
      if (h.id) map.set(h.id, h);
    }
    return map;
  }, [hotels]);

  // Filtered rooms list
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      if (selectedHotelFilter !== 'all' && room.hotelId !== selectedHotelFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const hotelName = hotelsMap.get(room.hotelId)?.name?.toLowerCase() || '';
        const roomName = room.name.toLowerCase();
        if (!roomName.includes(query) && !hotelName.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [rooms, selectedHotelFilter, searchQuery, hotelsMap]);

  // Selected rooms object list
  const selectedRooms = useMemo(() => {
    const set = new Set(selectedRoomIds);
    return rooms.filter(r => r.id && set.has(r.id));
  }, [rooms, selectedRoomIds]);

  // All promotions across properties for active campaigns monitoring
  const allPromotions = useMemo(() => {
    const list: Array<{ hotel: Hotel; promo: Promotion }> = [];
    for (const hotel of hotels) {
      if (selectedHotelFilter !== 'all' && hotel.id !== selectedHotelFilter) continue;
      for (const p of hotel.promotions || []) {
        list.push({ hotel, promo: p });
      }
    }
    return list;
  }, [hotels, selectedHotelFilter]);

  // Handle Select All / Deselect All
  const handleSelectAll = () => {
    const allIds = filteredRooms.map(r => r.id).filter(Boolean) as string[];
    setSelectedRoomIds(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedRoomIds([]);
  };

  /** Switching property drops selections the new filter hides, so a bulk save never touches rooms the manager can no longer see. */
  const changeHotelFilter = (hotelId: string) => {
    setSelectedHotelFilter(hotelId);
    if (hotelId === 'all') return;
    const visible = new Set(rooms.filter(r => r.hotelId === hotelId && r.id).map(r => r.id as string));
    setSelectedRoomIds(prev => prev.filter(id => visible.has(id)));
  };

  const [pendingPromoDelete, setPendingPromoDelete] = useState<{ hotelId: string; promoId: string; name: string } | null>(null);

  const toggleRoomSelection = (id: string) => {
    setSelectedRoomIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  /**
   * The new rates for a room. Only currencies the room already sells in are
   * touched (no exchange-rate guessing), every result is rounded to the
   * platform convention, and `problem` explains why a room cannot be saved.
   */
  const calculateNewRatesForRoom = (room: RoomType) => {
    const currencies = roomCurrencies(room);
    const originalMWK = roomPrice(room, 'MWK');
    const originalUSD = roomPrice(room, 'USD');

    const adjust = (original: number | null, currency: CurrencyCode): number | null => {
      if (original === null) return null;
      switch (rateAdjustmentType) {
        case 'percentage_discount':
          return roundPrice(original * (1 - Math.min(ratePercentage, MAX_RATE_DISCOUNT_PERCENT) / 100), currency);
        case 'percentage_increase':
          return roundPrice(original * (1 + ratePercentage / 100), currency);
        case 'amount_drop':
        case 'amount_increase': {
          const sign = rateAdjustmentType === 'amount_drop' ? -1 : 1;
          if (currency === rateAmountCurrency) return roundPrice(original + sign * rateAmount, currency);
          // The other currency moves by the same proportion as the chosen one.
          const anchor = rateAmountCurrency === 'MWK' ? originalMWK : originalUSD;
          if (anchor === null || anchor <= 0) return original;
          return roundPrice(original * ((anchor + sign * rateAmount) / anchor), currency);
        }
      }
    };

    const newMWK = adjust(originalMWK, 'MWK');
    const newUSD = adjust(originalUSD, 'USD');

    let problem: string | null = null;
    if ((newMWK !== null && newMWK <= 0) || (newUSD !== null && newUSD <= 0)) {
      problem = 'This change would take the rate to zero or below.';
    } else {
      const prices = { ...(room.prices || {}) } as Record<string, number>;
      if (newMWK !== null) prices.MWK = newMWK;
      if (newUSD !== null) prices.USD = newUSD;
      // Only the rate rules apply here: a legacy room missing a photo can still be repriced.
      const { photos: _photos, ...rateProblems } = validateRoom({ ...room, currencies, prices });
      problem = firstError(rateProblems as Record<string, string | undefined>);
    }

    return { originalMWK, originalUSD, newMWK, newUSD, currencies, problem };
  };

  // Synchronize custom inputs
  const handlePercentageChange = (val: number) => {
    setRatePercentage(val);
    setCustomRatePercentage(String(val));
  };

  const handleCustomPercentageInput = (str: string) => {
    setCustomRatePercentage(str);
    const parsed = parseFloat(str);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= MAX_RATE_DISCOUNT_PERCENT) {
      setRatePercentage(parsed);
    }
  };

  const handleAmountChange = (val: number) => {
    setRateAmount(val);
    setCustomRateAmount(String(val));
  };

  const handleCustomAmountInput = (str: string) => {
    setCustomRateAmount(str);
    const parsed = parseFloat(str);
    if (!isNaN(parsed) && parsed >= 0) {
      setRateAmount(parsed);
    }
  };

  const handlePromoPercentageChange = (val: number) => {
    setPromoPercentage(val);
    setCustomPromoPercentage(String(val));
  };

  const handleCustomPromoPercentageInput = (str: string) => {
    setCustomPromoPercentage(str);
    const parsed = parseFloat(str);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= MAX_PROMO_DISCOUNT_PERCENT) {
      setPromoPercentage(parsed);
    }
  };

  const handlePromoAmountChange = (val: number) => {
    setPromoSortedAmount(val);
    setCustomPromoAmount(String(val));
  };

  const handleCustomPromoAmountInput = (str: string) => {
    setCustomPromoAmount(str);
    const parsed = parseFloat(str);
    if (!isNaN(parsed) && parsed >= 0) {
      setPromoSortedAmount(parsed);
    }
  };

  /** Reads the hotel's stored promotions, applies `change` and writes them back atomically. */
  const updateStoredPromotions = (hotelId: string, change: (stored: Promotion[]) => Promotion[]) =>
    runTransaction(db, async tx => {
      const ref = doc(db, 'hotels', hotelId);
      const snap = await tx.get(ref);
      const next = change((snap.data()?.promotions as Promotion[] | undefined) ?? []);
      tx.update(ref, { promotions: next });
      return next;
    });

  // Execute Base Rates Save
  const handleApplyBaseRates = async () => {
    if (selectedRooms.length === 0) {
      toast.error('Please select at least one room to update.');
      return;
    }

    const blocked = selectedRooms
      .map(room => ({ room, problem: calculateNewRatesForRoom(room).problem }))
      .filter(r => r.problem);
    if (blocked.length > 0) {
      toast.error(`${blocked[0].room.name}: ${blocked[0].problem}${blocked.length > 1 ? ` (and ${blocked.length - 1} more)` : ''}`);
      return;
    }

    setSaving(true);
    try {
      const updatedRoomsList: RoomType[] = [];
      const writes: Array<{ id: string; payload: Record<string, unknown>; room: RoomType }> = [];

      for (const room of selectedRooms) {
        if (!room.id) continue;
        const { newMWK, newUSD } = calculateNewRatesForRoom(room);
        // Same default as roomPrice(): a legacy room without `currency` holds a USD `price`.
        // Defaulting to MWK here relabelled that USD figure as kwacha (e.g. $95 → MK 95).
        const primary = room.currency || 'USD';

        const updatedPrices: Record<string, number> = { ...(room.prices || {}) };
        if (newMWK !== null) updatedPrices.MWK = newMWK;
        if (newUSD !== null) updatedPrices.USD = newUSD;

        const updatePayloadRaw: Partial<RoomType> = {
          hotelId: room.hotelId, // CRITICAL: preserve hotelId invariant
          prices: updatedPrices,
          price: primary === 'USD' ? (newUSD ?? room.price) : (newMWK ?? room.price),
          priceMWK: newMWK !== null ? newMWK : room.priceMWK,
          currency: primary,
        };

        // Strip out undefined values
        const payload = Object.fromEntries(
          Object.entries(updatePayloadRaw).filter(([_, v]) => v !== undefined)
        );
        writes.push({ id: room.id, payload, room });
      }

      // Each chunk commits atomically: a failure leaves that chunk untouched
      // rather than half its rooms repriced.
      for (let i = 0; i < writes.length; i += BATCH_CHUNK) {
        const chunk = writes.slice(i, i + BATCH_CHUNK);
        const batch = writeBatch(db);
        for (const w of chunk) batch.update(doc(db, 'room_types', w.id), w.payload);
        try {
          await batch.commit();
        } catch (err) {
          console.error('Bulk rate batch failed:', err);
          if (updatedRoomsList.length > 0) {
            saveUpdatedRooms(updatedRoomsList);
            onRoomsUpdated?.(updatedRoomsList);
          }
          throw new Error(
            updatedRoomsList.length > 0
              ? `Updated ${updatedRoomsList.length} rooms, then the rest failed. Try again for the remaining rooms.`
              : 'Could not save the new rates. Check your connection and try again.'
          );
        }
        for (const w of chunk) updatedRoomsList.push({ ...w.room, ...w.payload } as RoomType);
      }

      // 1. Immediately update offline / fast storage cache
      saveUpdatedRooms(updatedRoomsList);

      // 2. Dispatch cross-component and real-time events
      window.dispatchEvent(new CustomEvent('travel_malawi_rooms_updated', { detail: { rooms: updatedRoomsList } }));

      toast.success(`Successfully updated rates for ${updatedRoomsList.length} room${updatedRoomsList.length === 1 ? '' : 's'}!`);
      if (onRoomsUpdated) {
        onRoomsUpdated(updatedRoomsList);
      }
    } catch (err: any) {
      console.error('Error applying bulk rates:', err);
      toast.error(err?.message || 'Failed to apply bulk rate changes.');
    } finally {
      setSaving(false);
    }
  };

  // Execute Promotions Save
  const handleApplyPromotion = async () => {
    if (selectedRooms.length === 0) {
      toast.error('Please select at least one room for this promotion.');
      return;
    }

    setSaving(true);
    try {
      // Group selected rooms by hotelId
      const roomsByHotel = new Map<string, string[]>();
      for (const room of selectedRooms) {
        if (!room.id || !room.hotelId) continue;
        const list = roomsByHotel.get(room.hotelId) || [];
        list.push(room.id);
        roomsByHotel.set(room.hotelId, list);
      }

      const updatedHotelsList: Hotel[] = [];

      // For each hotel, append or update the promotion
      for (const [hotelId, roomIds] of roomsByHotel.entries()) {
        const hotel = hotelsMap.get(hotelId);
        if (!hotel) continue;

        const promoTitle = promoCustomTitle.trim() || getSaleTypeLabel(promoSaleType);
        const discountPct = promoDiscountMode === 'percentage' ? promoPercentage : 0;
        const badge = promoBadgeText.trim() || getSaleTypeBadge(promoSaleType, promoTitle, discountPct);

        const newPromoRaw: Promotion = {
          id: crypto.randomUUID(),
          name: promoTitle,
          saleType: promoSaleType,
          saleTypeCustomLabel: promoTitle,
          appliesTo: 'specific_rooms',
          targetRoomIds: roomIds,
          discountType: promoDiscountMode,
          discountPercentage: discountPct,
          fixedSlashAmount: promoDiscountMode === 'fixed_slash'
            ? { [promoSortedCurrency]: promoSortedAmount }
            : undefined,
          badgeText: badge,
          startDate: promoStartDate || malawiToday(),
          endDate: promoEndDate || undefined,
          isActive: true,
          createdAt: Date.now(),
        };

        // Strip out undefined values to satisfy Firestore's updateDoc constraints
        const newPromo = Object.fromEntries(
          Object.entries(newPromoRaw).filter(([_, v]) => v !== undefined)
        ) as Promotion;

        const problem = validatePromotion(newPromo);
        if (problem) throw new Error(problem);

        // Appended to what is stored now, not to the copy loaded with the page,
        // so promotions saved meanwhile by someone else are kept.
        const updatedPromos = await updateStoredPromotions(hotelId, stored => [...stored, newPromo]);

        const updatedHotel: Hotel = {
          ...hotel,
          promotions: updatedPromos,
        };
        updatedHotelsList.push(updatedHotel);
        saveSingleCachedHotel(updatedHotel);
      }

      // Dispatch cross-component event
      window.dispatchEvent(new CustomEvent('travel_malawi_hotels_updated', { detail: { hotels: updatedHotelsList } }));

      toast.success(
        `Successfully launched "${promoCustomTitle || getSaleTypeLabel(promoSaleType)}" on ${selectedRooms.length} room${selectedRooms.length === 1 ? '' : 's'} across ${roomsByHotel.size} propert${roomsByHotel.size === 1 ? 'y' : 'ies'}!`
      );

      if (onHotelsUpdated) {
        onHotelsUpdated(updatedHotelsList);
      }
    } catch (err: any) {
      console.error('Error applying bulk promotion:', err);
      toast.error(err?.message || 'Failed to create bulk promotion.');
    } finally {
      setSaving(false);
    }
  };

  // Active Promotions management helpers
  const handleTogglePromotionActive = async (hotelId: string, promoId: string) => {
    const hotel = hotelsMap.get(hotelId);
    if (!hotel) return;
    try {
      const updatedPromos = await updateStoredPromotions(hotelId, stored =>
        stored.map(p => (p.id === promoId ? { ...p, isActive: !p.isActive } : p))
      );
      const updatedHotel: Hotel = { ...hotel, promotions: updatedPromos };
      saveSingleCachedHotel(updatedHotel);
      window.dispatchEvent(new CustomEvent('travel_malawi_hotels_updated', { detail: { hotels: [updatedHotel] } }));
      if (onHotelsUpdated) onHotelsUpdated([updatedHotel]);
      toast.success('Promotion status updated');
    } catch (err: any) {
      toast.error('Failed to update promotion status');
    }
  };

  const handleExtendPromotion = async (hotelId: string, promoId: string, daysToAdd: number | null) => {
    const hotel = hotelsMap.get(hotelId);
    if (!hotel) return;
    const today = malawiToday();
    try {
      const updatedPromos = await updateStoredPromotions(hotelId, stored => stored.map(p => {
        if (p.id !== promoId) return p;
        if (daysToAdd === null) {
          const { endDate, ...rest } = p;
          return { ...rest, isActive: true };
        }
        const base = p.endDate && p.endDate > today ? p.endDate : today;
        return { ...p, endDate: addDays(base, daysToAdd), isActive: true };
      }));
      const updatedHotel: Hotel = { ...hotel, promotions: updatedPromos };
      saveSingleCachedHotel(updatedHotel);
      window.dispatchEvent(new CustomEvent('travel_malawi_hotels_updated', { detail: { hotels: [updatedHotel] } }));
      if (onHotelsUpdated) onHotelsUpdated([updatedHotel]);
      toast.success(daysToAdd === null ? 'Promotion made ongoing' : `Extended by ${daysToAdd} days`);
    } catch (err: any) {
      toast.error('Failed to extend promotion');
    }
  };

  const handleDeletePromotion = async (hotelId: string, promoId: string) => {
    const hotel = hotelsMap.get(hotelId);
    if (!hotel) return;
    try {
      const updatedPromos = await updateStoredPromotions(hotelId, stored => stored.filter(p => p.id !== promoId));
      const updatedHotel: Hotel = { ...hotel, promotions: updatedPromos };
      saveSingleCachedHotel(updatedHotel);
      window.dispatchEvent(new CustomEvent('travel_malawi_hotels_updated', { detail: { hotels: [updatedHotel] } }));
      if (onHotelsUpdated) onHotelsUpdated([updatedHotel]);
      toast.success('Promotion deleted');
    } catch (err: any) {
      toast.error('Failed to delete promotion');
    }
  };

  return (
    <div className={`bg-white rounded-xl border border-stone-200 overflow-hidden min-w-0 ${isEmbedded ? '' : 'max-w-5xl mx-auto'}`}>
      {/* Header Banner */}
      <div className="border-b border-stone-200 p-4 sm:p-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-700 shrink-0">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <h2 className="tm-h2">Bulk rates</h2>
          </div>
          <p className="tm-muted">Change rates or add a discount for several rooms at once.</p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="shrink-0 p-2 rounded-lg hover:bg-stone-100 text-stone-500 hover:text-stone-900 transition cursor-pointer"
            title="Close bulk editor"
            aria-label="Close bulk editor"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Minimal Underline-Based Navigation Tabs */}
      <div className="border-b border-stone-200 bg-white px-4 sm:px-5 overflow-x-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="tm-tabs border-b-0" role="tablist" aria-label="Editor modes">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'rates'}
              onClick={() => setActiveTab('rates')}
              className={`tm-tab inline-flex items-center gap-2 ${activeTab === 'rates' ? 'tm-tab-active' : ''}`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Rates</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'promotions'}
              onClick={() => setActiveTab('promotions')}
              className={`tm-tab inline-flex items-center gap-2 ${activeTab === 'promotions' ? 'tm-tab-active' : ''}`}
            >
              <Percent className="w-4 h-4" />
              <span>New discount</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'active_promotions'}
              onClick={() => setActiveTab('active_promotions')}
              className={`tm-tab inline-flex items-center gap-2 ${activeTab === 'active_promotions' ? 'tm-tab-active' : ''}`}
            >
              <Tag className="w-4 h-4" />
              <span>Running discounts</span>
              <span className={`text-[11px] tabular-nums px-1.5 py-0.5 rounded-md ${
                activeTab === 'active_promotions' ? 'bg-stone-100 text-stone-900 font-semibold' : 'text-stone-400'
              }`}>
                {allPromotions.length}
              </span>
            </button>
          </div>

        </div>
      </div>

      {/* Active Campaigns Management View */}
      {activeTab === 'active_promotions' ? (
        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-stone-900 text-sm">Running and scheduled discounts</h3>
            </div>

            <div className="tm-actions">
              {hotels.length > 1 && (
                <select
                  value={selectedHotelFilter}
                  onChange={e => changeHotelFilter(e.target.value)}
                  aria-label="Filter campaigns by property"
                  className="max-w-full bg-white border border-stone-300 text-xs font-medium rounded-lg px-2.5 py-1.5 text-stone-800 focus:outline-hidden"
                >
                  <option value="all">All properties ({hotels.length})</option>
                  {hotels.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => setActiveTab('promotions')}
                className="tm-btn tm-btn-secondary tm-btn-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New discount</span>
              </button>
            </div>
          </div>

          {allPromotions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-stone-300 p-8 text-center">
              <Tag className="w-6 h-6 text-stone-400 mx-auto mb-3" />
              <p className="tm-muted max-w-md mx-auto mb-4">No discounts running yet.</p>
              <button
                type="button"
                onClick={() => setActiveTab('promotions')}
                className="tm-btn tm-btn-secondary"
              >
                <Plus className="w-4 h-4" />
                <span>Add a discount</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {allPromotions.map(({ hotel, promo }) => {
                const today = malawiToday();
                const isExpired = promo.endDate && promo.endDate < today;
                const isScheduled = promo.startDate && promo.startDate > today;
                const isLive = promo.isActive && !isExpired && !isScheduled;

                let statusBadge = {
                  text: 'Active',
                  className: 'tm-tag-good',
                };
                if (!promo.isActive) {
                  statusBadge = { text: 'Paused', className: '' };
                } else if (isExpired) {
                  statusBadge = { text: 'Expired', className: 'tm-tag-bad' };
                } else if (isScheduled) {
                  statusBadge = { text: `Scheduled (${promo.startDate})`, className: 'tm-tag-warn' };
                }

                const targetCount = promo.targetRoomIds ? promo.targetRoomIds.length : (hotel.rooms?.length || 'All');

                return (
                  <div
                    key={`${hotel.id}-${promo.id}`}
                    className="rounded-lg border border-stone-200 p-4 flex flex-col justify-between gap-3 min-w-0"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <span className="text-xs text-stone-500 block truncate">
                            {hotel.name}
                          </span>
                          <h4 className="font-semibold text-stone-900 text-sm flex items-center gap-1.5 mt-0.5 min-w-0">
                            <Tag className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            <span className="truncate">{promo.name}</span>
                          </h4>
                        </div>
                        <span className={`tm-tag shrink-0 ${statusBadge.className}`}>
                          {statusBadge.text}
                        </span>
                      </div>

                      <div className="space-y-1 text-xs text-stone-600">
                        <div className="flex items-center justify-between gap-3 py-0.5 border-b border-stone-100">
                          <span className="text-stone-500">Discount</span>
                          <span className="font-semibold text-stone-900">
                            {promo.discountType === 'percentage'
                              ? `${promo.discountPercentage}% off`
                              : promo.fixedSlashAmount
                              ? `Slash ${formatMoney(Object.values(promo.fixedSlashAmount)[0] || 0, Object.keys(promo.fixedSlashAmount)[0] as CurrencyCode)}`
                              : 'Discount'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 py-0.5 border-b border-stone-100">
                          <span className="text-stone-500">Rooms</span>
                          <span className="font-medium text-stone-800">
                            {typeof targetCount === 'number' ? `${targetCount} room${targetCount === 1 ? '' : 's'}` : 'All rooms in property'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 py-0.5">
                          <span className="text-stone-500">Dates</span>
                          <span className="font-medium text-stone-800">
                            {promo.endDate ? `${promo.startDate || 'Now'} to ${promo.endDate}` : 'Ongoing'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Campaign Actions */}
                    <div className="pt-2 border-t border-stone-100 tm-actions justify-between">
                      <button
                        type="button"
                        onClick={() => hotel.id && handleTogglePromotionActive(hotel.id, promo.id)}
                        className="tm-btn tm-btn-secondary tm-btn-sm"
                      >
                        {promo.isActive ? (
                          <>
                            <Pause className="w-3 h-3 text-stone-500" />
                            <span>Pause</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 text-stone-500" />
                            <span>Activate</span>
                          </>
                        )}
                      </button>

                      <div className="tm-actions gap-1.5">
                        <button
                          type="button"
                          onClick={() => hotel.id && handleExtendPromotion(hotel.id, promo.id, 7)}
                          className="tm-btn tm-btn-quiet tm-btn-sm"
                          title="Extend campaign by 7 days"
                        >
                          +7 days
                        </button>
                        <button
                          type="button"
                          onClick={() => hotel.id && handleExtendPromotion(hotel.id, promo.id, 30)}
                          className="tm-btn tm-btn-quiet tm-btn-sm"
                          title="Extend campaign by 30 days"
                        >
                          +30 days
                        </button>
                        <button
                          type="button"
                          onClick={() => hotel.id && setPendingPromoDelete({ hotelId: hotel.id, promoId: promo.id, name: promo.name })}
                          className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-md transition cursor-pointer"
                          title="Delete promotion"
                          aria-label="Delete promotion"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Controls Grid */
        <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-6 min-w-0">
        {/* Left Column: Room Selection & Filter (5 cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-4 border-b lg:border-b-0 lg:border-r border-stone-200 pb-6 lg:pb-0 lg:pr-6 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BedDouble className="w-4 h-4 text-stone-700" />
              <h3 className="font-semibold text-stone-900 text-sm">Rooms</h3>
            </div>
            <span className="tm-tag">
              {selectedRoomIds.length} of {filteredRooms.length} selected
            </span>
          </div>

          {/* Property Selector & Search */}
          <div className="space-y-2">
            {hotels.length > 1 && (
              <div>
                <label className="tm-label">
                  Property
                </label>
                <div className="relative">
                  <select
                    value={selectedHotelFilter}
                    onChange={(e) => changeHotelFilter(e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-800 appearance-none pr-8 focus:border-stone-500 focus:outline-none cursor-pointer"
                  >
                    <option value="all">All properties ({rooms.length} rooms)</option>
                    {hotels.map(h => (
                      <option key={h.id} value={h.id}>
                        {h.name} ({rooms.filter(r => r.hotelId === h.id).length} rooms)
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search rooms"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-lg pl-8 pr-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:border-stone-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Bulk Select Actions */}
          <div className="flex items-center justify-between gap-2 text-xs pt-1">
            <button
              type="button"
              onClick={handleSelectAll}
              className="font-semibold text-stone-700 hover:text-stone-900 cursor-pointer"
            >
              Select all ({filteredRooms.length})
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="font-semibold text-stone-500 hover:text-stone-800 cursor-pointer"
            >
              Clear
            </button>
          </div>

          {/* Rooms Checklist List */}
          <div className="max-h-[380px] overflow-y-auto space-y-1 pr-1 border border-stone-200 rounded-lg p-1.5">
            {filteredRooms.length === 0 ? (
              <div className="p-6 text-center text-stone-500 text-xs">
                No rooms match.
              </div>
            ) : (
              filteredRooms.map(room => {
                const isSelected = room.id ? selectedRoomIds.includes(room.id) : false;
                const hotel = hotelsMap.get(room.hotelId);
                const mwkRate = roomPrice(room, 'MWK');
                const usdRate = roomPrice(room, 'USD');

                return (
                  <div
                    key={room.id}
                    onClick={() => room.id && toggleRoomSelection(room.id)}
                    className={`p-2.5 rounded-lg transition cursor-pointer flex items-center gap-3 min-w-0 ${
                      isSelected
                        ? 'bg-amber-50 text-stone-900'
                        : 'bg-white hover:bg-stone-50 text-stone-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // handled by parent div
                      className="rounded border-stone-300 text-stone-900 focus:ring-stone-900 h-4 w-4 cursor-pointer shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-1">
                        <p className="font-semibold text-xs truncate">{room.name}</p>
                        {hotel && (
                          <span className="text-[11px] truncate max-w-[120px] text-stone-500">
                            {hotel.name}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 text-[11px] mt-0.5 text-stone-500">
                        {mwkRate !== null && <span>{formatMoney(mwkRate, 'MWK')}</span>}
                        {mwkRate !== null && usdRate !== null && <span>•</span>}
                        {usdRate !== null && <span>{formatMoney(usdRate, 'USD')}</span>}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Adjustment Configuration & Preview (7 cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-5 min-w-0">
          {activeTab === 'rates' ? (
            /* ================================================================ */
            /* TAB 1: BASE ROOM RATES ADJUSTMENT                                */
            /* ================================================================ */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-semibold text-stone-900 text-sm sm:text-base flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-stone-500" />
                  <span>Change rates</span>
                </h4>
                <span className="text-xs text-stone-500">Rounded to MK 1,000 / whole dollars</span>
              </div>

              {/* Adjustment Method Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'percentage_discount', label: 'Lower by %', icon: TrendingDown },
                  { id: 'percentage_increase', label: 'Raise by %', icon: TrendingUp },
                  { id: 'amount_drop', label: 'Lower by amount', icon: DollarSign },
                  { id: 'amount_increase', label: 'Raise by amount', icon: TrendingUp },
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setRateAdjustmentType(item.id as RateAdjustmentType)}
                      className={`p-2.5 rounded-lg border text-left text-xs transition cursor-pointer flex flex-col justify-between min-w-0 ${
                        rateAdjustmentType === item.id
                          ? 'bg-amber-50 text-stone-900 border-amber-700 ring-1 ring-amber-700'
                          : 'bg-white text-stone-700 border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 mb-1 text-stone-500" />
                      <span className="font-semibold leading-tight">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Percentage Inputs */}
              {(rateAdjustmentType === 'percentage_discount' || rateAdjustmentType === 'percentage_increase') && (
                <div className="p-3.5 rounded-lg bg-stone-50 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                    <span className="font-semibold text-stone-700">
                      {rateAdjustmentType === 'percentage_discount' ? 'Lower by' : 'Raise by'}
                    </span>
                    
                  </div>

                  {/* Preset Pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {[5, 10, 15, 20, 25, 30, 40].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handlePercentageChange(val)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          ratePercentage === val
                            ? 'bg-stone-900 text-white'
                            : 'bg-white text-stone-700 border border-stone-300 hover:bg-stone-50'
                        }`}
                      >
                        {rateAdjustmentType === 'percentage_discount' ? `-${val}%` : `+${val}%`}
                      </button>
                    ))}
                  </div>

                  {/* Custom Percentage Input */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
                    <label className="text-xs font-medium text-stone-600 whitespace-nowrap">
                      Other %
                    </label>
                    <div className="relative w-32">
                      <input
                        type="number"
                        min="1"
                        max={rateAdjustmentType === 'percentage_discount' ? MAX_RATE_DISCOUNT_PERCENT : undefined}
                        step="0.5"
                        value={customRatePercentage}
                        onChange={(e) => handleCustomPercentageInput(e.target.value)}
                        className="w-full bg-white border border-stone-300 rounded-lg px-3 py-1.5 text-sm font-medium text-stone-900 pr-8 focus:border-stone-500 focus:outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400 pointer-events-none">
                        %
                      </span>
                    </div>
                    <span className="text-xs text-stone-500">Applies to MWK and USD rates.</span>
                  </div>
                </div>
              )}

              {/* Amount Inputs */}
              {(rateAdjustmentType === 'amount_drop' || rateAdjustmentType === 'amount_increase') && (
                <div className="p-3.5 rounded-lg bg-stone-50 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-stone-700">Amount</span>
                    <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => setRateAmountCurrency('MWK')}
                        className={`px-2 py-0.5 rounded text-xs font-medium transition cursor-pointer ${
                          rateAmountCurrency === 'MWK' ? 'bg-stone-900 text-white' : 'text-stone-600'
                        }`}
                      >
                        MWK (MK)
                      </button>
                      <button
                        type="button"
                        onClick={() => setRateAmountCurrency('USD')}
                        className={`px-2 py-0.5 rounded text-xs font-medium transition cursor-pointer ${
                          rateAmountCurrency === 'USD' ? 'bg-stone-900 text-white' : 'text-stone-600'
                        }`}
                      >
                        USD ($)
                      </button>
                    </div>
                  </div>

                  {/* Preset Pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {(rateAmountCurrency === 'MWK'
                      ? [5000, 10000, 15000, 20000, 30000, 50000]
                      : [5, 10, 15, 20, 25, 50]
                    ).map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleAmountChange(val)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          rateAmount === val
                            ? 'bg-stone-900 text-white'
                            : 'bg-white text-stone-700 border border-stone-300 hover:bg-stone-50'
                        }`}
                      >
                        {rateAdjustmentType === 'amount_drop' ? '-' : '+'}
                        {formatMoney(val, rateAmountCurrency)}
                      </button>
                    ))}
                  </div>

                  {/* Custom Amount Input */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
                    <label className="text-xs font-medium text-stone-600 whitespace-nowrap">
                      Other amount
                    </label>
                    <div className="relative w-40">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={customRateAmount}
                        onChange={(e) => handleCustomAmountInput(e.target.value)}
                        className="w-full bg-white border border-stone-300 rounded-lg pl-3 pr-12 py-1.5 text-sm font-medium text-stone-900 focus:border-stone-500 focus:outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-stone-400 pointer-events-none">
                        {rateAmountCurrency}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Real-time Rate Preview Table */}
              <div className="space-y-2">
                <h5 className="text-sm font-semibold text-stone-700">
                  Preview ({selectedRooms.length} rooms)
                </h5>

                <div className="border border-stone-200 rounded-lg bg-white max-h-[220px] overflow-auto">
                  {selectedRooms.length === 0 ? (
                    <div className="p-6 text-center text-stone-500 text-xs">
                      Pick rooms to see the new rates.
                    </div>
                  ) : (
                    <table className="w-full min-w-[480px] text-left text-xs border-collapse">
                      <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold text-[11px]">
                        <tr>
                          <th className="p-2.5">Room</th>
                          <th className="p-2.5">Now</th>
                          <th className="p-2.5">New</th>
                          <th className="p-2.5 text-right">Change</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {selectedRooms.map(room => {
                          const { originalMWK, originalUSD, newMWK, newUSD, problem } = calculateNewRatesForRoom(room);
                          const hotel = hotelsMap.get(room.hotelId);

                          const diffMWK = originalMWK !== null && newMWK !== null ? newMWK - originalMWK : 0;
                          const pctMWK = originalMWK && originalMWK > 0 ? Math.round((diffMWK / originalMWK) * 100) : 0;

                          return (
                            <tr key={room.id} className="hover:bg-stone-50/60">
                              <td className="p-2.5">
                                <p className="font-semibold text-stone-900 truncate max-w-[150px]">{room.name}</p>
                                <p className="text-[11px] text-stone-500 truncate max-w-[150px]">{hotel?.name}</p>
                              </td>
                              <td className="p-2.5">
                                {originalMWK !== null && <div>{formatMoney(originalMWK, 'MWK')}</div>}
                                {originalUSD !== null && <div className="text-stone-400 text-[10px]">{formatMoney(originalUSD, 'USD')}</div>}
                              </td>
                              <td className="p-2.5 font-bold text-stone-900">
                                {newMWK !== null && (
                                  <div>{formatMoney(newMWK, 'MWK')}</div>
                                )}
                                {newUSD !== null && (
                                  <div className="text-stone-500 text-[10px]">{formatMoney(newUSD, 'USD')}</div>
                                )}
                                {problem && <div className="text-red-600 text-[10px] font-normal">{problem}</div>}
                              </td>
                              <td className="p-2.5 text-right">
                                {diffMWK < 0 ? (
                                  <span className="tm-tag whitespace-nowrap">
                                    <TrendingDown className="w-2.5 h-2.5" />
                                    {pctMWK}% ({formatMoney(diffMWK, 'MWK')})
                                  </span>
                                ) : diffMWK > 0 ? (
                                  <span className="tm-tag tm-tag-warn whitespace-nowrap">
                                    <TrendingUp className="w-2.5 h-2.5" />
                                    +{pctMWK}% (+{formatMoney(diffMWK, 'MWK')})
                                  </span>
                                ) : (
                                  <span className="text-stone-500 text-[11px]">No change</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2 tm-actions justify-end">
                <button
                  type="button"
                  onClick={handleApplyBaseRates}
                  disabled={saving || selectedRooms.length === 0}
                  className="tm-btn tm-btn-primary w-full sm:w-auto"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving rates…</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Save rates for {selectedRooms.length} room{selectedRooms.length === 1 ? '' : 's'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* ================================================================ */
            /* TAB 2: PROMOTIONAL SLASH CAMPAIGN                                */
            /* ================================================================ */
            <div className="space-y-4">
              <h4 className="font-semibold text-stone-900 text-sm sm:text-base flex items-center gap-2">
                <Tag className="w-4 h-4 text-stone-500" />
                <span>New discount</span>
              </h4>

              {/* Campaign Type */}
              <div>
                <label className="tm-label">
                  Sale badge
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {SALE_TYPE_OPTIONS.map(st => (
                    <button
                      key={st.value}
                      type="button"
                      onClick={() => {
                        setPromoSaleType(st.value);
                        if (!promoCustomTitle || SALE_TYPE_OPTIONS.some(o => o.label === promoCustomTitle)) {
                          setPromoCustomTitle(st.label);
                        }
                      }}
                      className={`p-2 rounded-lg border text-left text-xs transition cursor-pointer min-w-0 ${
                        promoSaleType === st.value
                          ? 'bg-amber-50 text-stone-900 border-amber-700 font-semibold'
                          : 'bg-white text-stone-700 border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <div className="truncate">{st.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Campaign Custom Title */}
              <div>
                <label className="tm-label">
                  Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Weekend Special, Summer Flash Sale, Easter Getaway"
                  value={promoCustomTitle}
                  onChange={(e) => setPromoCustomTitle(e.target.value)}
                  className="tm-input"
                />
              </div>

              {/* Discount Structure: Percentage vs Fixed Slash */}
              <div className="p-3.5 rounded-lg bg-stone-50 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 p-0.5 bg-stone-200/70 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setPromoDiscountMode('percentage')}
                      className={`px-3 py-1 rounded-md font-medium text-xs transition cursor-pointer ${
                        promoDiscountMode === 'percentage'
                          ? 'bg-white text-stone-900 shadow-sm'
                          : 'text-stone-600'
                      }`}
                    >
                      Percent off
                    </button>
                    <button
                      type="button"
                      onClick={() => setPromoDiscountMode('fixed_slash')}
                      className={`px-3 py-1 rounded-md font-medium text-xs transition cursor-pointer ${
                        promoDiscountMode === 'fixed_slash'
                          ? 'bg-white text-stone-900 shadow-sm'
                          : 'text-stone-600'
                      }`}
                    >
                      Amount off
                    </button>
                  </div>
                </div>

                {promoDiscountMode === 'percentage' ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {[10, 15, 20, 25, 30, 40, 50].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => handlePromoPercentageChange(val)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            promoPercentage === val
                              ? 'bg-stone-900 text-white'
                              : 'bg-white text-stone-700 border border-stone-300 hover:bg-stone-50'
                          }`}
                        >
                          {val}% off
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
                      <label className="text-xs font-medium text-stone-600 whitespace-nowrap">
                        Other %
                      </label>
                      <div className="relative w-32">
                        <input
                          type="number"
                          min="1"
                          max="90"
                          value={customPromoPercentage}
                          onChange={(e) => handleCustomPromoPercentageInput(e.target.value)}
                          className="w-full bg-white border border-stone-300 rounded-lg px-3 py-1.5 text-sm font-medium text-stone-900 pr-8 focus:border-stone-500 focus:outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400 pointer-events-none">
                          %
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-lg p-0.5 text-xs">
                        <button
                          type="button"
                          onClick={() => setPromoSortedCurrency('MWK')}
                          className={`px-2 py-0.5 rounded text-xs font-medium transition cursor-pointer ${
                            promoSortedCurrency === 'MWK' ? 'bg-stone-900 text-white' : 'text-stone-600'
                          }`}
                        >
                          MWK (MK)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPromoSortedCurrency('USD')}
                          className={`px-2 py-0.5 rounded text-xs font-medium transition cursor-pointer ${
                            promoSortedCurrency === 'USD' ? 'bg-stone-900 text-white' : 'text-stone-600'
                          }`}
                        >
                          USD ($)
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {(promoSortedCurrency === 'MWK'
                        ? [10000, 20000, 30000, 50000]
                        : [10, 20, 30, 50]
                      ).map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => handlePromoAmountChange(val)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            promoSortedAmount === val
                              ? 'bg-stone-900 text-white'
                              : 'bg-white text-stone-700 border border-stone-300 hover:bg-stone-50'
                          }`}
                        >
                          -{formatMoney(val, promoSortedCurrency)}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
                      <label className="text-xs font-medium text-stone-600 whitespace-nowrap">
                        Other amount
                      </label>
                      <div className="relative w-40">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={customPromoAmount}
                          onChange={(e) => handleCustomPromoAmountInput(e.target.value)}
                          className="w-full bg-white border border-stone-300 rounded-lg pl-3 pr-12 py-1.5 text-sm font-medium text-stone-900 focus:border-stone-500 focus:outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-stone-400 pointer-events-none">
                          {promoSortedCurrency}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Dates & Badge (Optional) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="tm-label">
                    Starts
                  </label>
                  <input
                    type="date"
                    value={promoStartDate}
                    onChange={(e) => setPromoStartDate(e.target.value)}
                    onClick={(e) => { try { (e.target as HTMLInputElement).showPicker?.(); } catch {} }}
                    className="tm-input cursor-pointer"
                  />
                </div>
                <div>
                  <label className="tm-label">
                    Ends (optional)
                  </label>
                  <input
                    type="date"
                    value={promoEndDate}
                    onChange={(e) => setPromoEndDate(e.target.value)}
                    onClick={(e) => { try { (e.target as HTMLInputElement).showPicker?.(); } catch {} }}
                    className="tm-input cursor-pointer"
                  />
                </div>
              </div>

              {/* Live Promotional Price Preview */}
              <div className="space-y-2">
                <h5 className="text-sm font-semibold text-stone-700">
                  What guests see ({selectedRooms.length} rooms)
                </h5>

                <div className="border border-stone-200 rounded-lg bg-white max-h-[220px] overflow-auto">
                  {selectedRooms.length === 0 ? (
                    <div className="p-6 text-center text-stone-500 text-xs">
                      Pick rooms to see the discounted prices.
                    </div>
                  ) : (
                    <div className="p-3 space-y-2 divide-y divide-stone-100">
                      {selectedRooms.map(room => {
                        const originalMWK = roomPrice(room, 'MWK') || 0;
                        const mockPromo: Promotion = {
                          id: 'preview',
                          name: promoCustomTitle || getSaleTypeLabel(promoSaleType),
                          saleType: promoSaleType,
                          discountType: promoDiscountMode,
                          discountPercentage: promoDiscountMode === 'percentage' ? promoPercentage : 0,
                          fixedSlashAmount: promoDiscountMode === 'fixed_slash' ? { [promoSortedCurrency]: promoSortedAmount } : undefined,
                          isActive: true,
                        };

                        const slashed = calculateSlashedPrice(originalMWK, mockPromo, 'MWK');
                        const hotel = hotelsMap.get(room.hotelId);

                        return (
                          <div key={room.id} className="pt-2 first:pt-0 flex items-center justify-between gap-3 text-xs">
                            <div className="min-w-0">
                              <p className="font-semibold text-stone-900 truncate">{room.name}</p>
                              <p className="text-[11px] text-stone-500 truncate">{hotel?.name}</p>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="flex items-center gap-1.5">
                                <span className="line-through text-stone-500 text-[11px]">
                                  {formatMoney(originalMWK, 'MWK')}
                                </span>
                                <span className="font-semibold text-stone-900 text-sm">
                                  {formatMoney(slashed.slashedPrice, 'MWK')}
                                </span>
                              </div>
                              <div className="tm-tag mt-0.5">
                                {slashed.badgeText}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2 tm-actions justify-end">
                <button
                  type="button"
                  onClick={handleApplyPromotion}
                  disabled={saving || selectedRooms.length === 0}
                  className="tm-btn tm-btn-primary w-full sm:w-auto"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving discount…</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Add discount to {selectedRooms.length} room{selectedRooms.length === 1 ? '' : 's'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      )}
      <ConfirmDialog
        isOpen={!!pendingPromoDelete}
        title="Delete promotion?"
        message={`"${pendingPromoDelete?.name ?? ''}" will be removed and guests will see full prices again. This cannot be undone.`}
        confirmText="Delete promotion"
        isDestructive
        onCancel={() => setPendingPromoDelete(null)}
        onConfirm={() => {
          const target = pendingPromoDelete;
          setPendingPromoDelete(null);
          if (target) handleDeletePromotion(target.hotelId, target.promoId);
        }}
      />
    </div>
  );
}
