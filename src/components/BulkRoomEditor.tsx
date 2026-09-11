import React, { useState, useMemo, useEffect } from 'react';
import { Hotel, RoomType, CurrencyCode, Promotion, SaleType, DiscountType } from '../types';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { roomPrice, roomCurrencies, formatMoney } from '../lib/currency';
import { SALE_TYPE_OPTIONS, getSaleTypeBadge, getSaleTypeLabel, calculateSlashedPrice } from '../lib/promotions';
import {
  SlidersHorizontal, Percent, DollarSign, Tag, Sparkles, Check,
  RotateCcw, TrendingDown, TrendingUp, Calendar, Zap, AlertCircle,
  ArrowRight, ChevronDown, Building2, BedDouble, Search, X, Info,
  Save, Loader2, CheckCircle2, Sliders, Layers
} from 'lucide-react';

export type BulkEditorMode = 'rates' | 'promotions';
export type RateAdjustmentType = 'percentage_discount' | 'percentage_increase' | 'amount_drop' | 'amount_increase' | 'fixed_price';
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
  const [fixedTargetPrice, setFixedTargetPrice] = useState<string>('80000');
  const [roundToCleanNumbers, setRoundToCleanNumbers] = useState(true);

  // Per-room manual overrides in the preview (optional fine-tuning)
  const [manualPriceOverrides, setManualPriceOverrides] = useState<Record<string, { MWK?: number; USD?: number }>>({});

  // Promotions State
  const [promoSaleType, setPromoSaleType] = useState<SaleType>('flash_sale');
  const [promoCustomTitle, setPromoCustomTitle] = useState('');
  const [promoDiscountMode, setPromoDiscountMode] = useState<PromoDiscountMode>('percentage');
  const [promoPercentage, setPromoPercentage] = useState<number>(20);
  const [customPromoPercentage, setCustomPromoPercentage] = useState<string>('20');
  const [promoSortedCurrency, setPromoSortedCurrency] = useState<CurrencyCode>('MWK');
  const [promoSortedAmount, setPromoSortedAmount] = useState<number>(20000);
  const [customPromoAmount, setCustomPromoAmount] = useState<string>('20000');
  const [promoStartDate, setPromoStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
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

  // Handle Select All / Deselect All
  const handleSelectAll = () => {
    const allIds = filteredRooms.map(r => r.id).filter(Boolean) as string[];
    setSelectedRoomIds(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedRoomIds([]);
    setManualPriceOverrides({});
  };

  const toggleRoomSelection = (id: string) => {
    setSelectedRoomIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Helper to round clean currency figures
  const roundPrice = (amount: number, currency: CurrencyCode): number => {
    if (!roundToCleanNumbers) return Math.round(amount);
    if (currency === 'MWK') {
      // Round to nearest 1,000 for MWK
      return Math.round(amount / 1000) * 1000;
    }
    // Round to nearest whole dollar or 5 for USD
    return Math.round(amount);
  };

  // Calculate new rates for a given room
  const calculateNewRatesForRoom = (room: RoomType) => {
    const currencies = roomCurrencies(room);
    const originalMWK = roomPrice(room, 'MWK');
    const originalUSD = roomPrice(room, 'USD');

    let newMWK = originalMWK;
    let newUSD = originalUSD;

    // Check manual override first
    if (room.id && manualPriceOverrides[room.id]) {
      const override = manualPriceOverrides[room.id];
      if (override.MWK !== undefined) newMWK = override.MWK;
      if (override.USD !== undefined) newUSD = override.USD;
      return { originalMWK, originalUSD, newMWK, newUSD, currencies };
    }

    if (rateAdjustmentType === 'percentage_discount') {
      const pct = ratePercentage;
      const factor = Math.max(0, 1 - pct / 100);
      if (originalMWK !== null) newMWK = roundPrice(originalMWK * factor, 'MWK');
      if (originalUSD !== null) newUSD = roundPrice(originalUSD * factor, 'USD');
    } else if (rateAdjustmentType === 'percentage_increase') {
      const pct = ratePercentage;
      const factor = 1 + pct / 100;
      if (originalMWK !== null) newMWK = roundPrice(originalMWK * factor, 'MWK');
      if (originalUSD !== null) newUSD = roundPrice(originalUSD * factor, 'USD');
    } else if (rateAdjustmentType === 'amount_drop') {
      if (rateAmountCurrency === 'MWK' && originalMWK !== null) {
        newMWK = Math.max(0, originalMWK - rateAmount);
        // Also adjust USD proportionately if room has USD
        if (originalUSD !== null && originalMWK > 0) {
          const ratio = newMWK / originalMWK;
          newUSD = roundPrice(originalUSD * ratio, 'USD');
        }
      } else if (rateAmountCurrency === 'USD' && originalUSD !== null) {
        newUSD = Math.max(0, originalUSD - rateAmount);
        // Adjust MWK proportionately
        if (originalMWK !== null && originalUSD > 0) {
          const ratio = newUSD / originalUSD;
          newMWK = roundPrice(originalMWK * ratio, 'MWK');
        }
      }
    } else if (rateAdjustmentType === 'amount_increase') {
      if (rateAmountCurrency === 'MWK' && originalMWK !== null) {
        newMWK = originalMWK + rateAmount;
        if (originalUSD !== null && originalMWK > 0) {
          const ratio = newMWK / originalMWK;
          newUSD = roundPrice(originalUSD * ratio, 'USD');
        }
      } else if (rateAmountCurrency === 'USD' && originalUSD !== null) {
        newUSD = originalUSD + rateAmount;
        if (originalMWK !== null && originalUSD > 0) {
          const ratio = newUSD / originalUSD;
          newMWK = roundPrice(originalMWK * ratio, 'MWK');
        }
      }
    } else if (rateAdjustmentType === 'fixed_price') {
      const fixed = parseFloat(fixedTargetPrice) || 0;
      if (rateAmountCurrency === 'MWK') {
        newMWK = fixed;
      } else {
        newUSD = fixed;
      }
    }

    return { originalMWK, originalUSD, newMWK, newUSD, currencies };
  };

  // Synchronize custom inputs
  const handlePercentageChange = (val: number) => {
    setRatePercentage(val);
    setCustomRatePercentage(String(val));
  };

  const handleCustomPercentageInput = (str: string) => {
    setCustomRatePercentage(str);
    const parsed = parseFloat(str);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
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
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 99) {
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

  // Execute Base Rates Save
  const handleApplyBaseRates = async () => {
    if (selectedRooms.length === 0) {
      toast.error('Please select at least one room to update.');
      return;
    }

    setSaving(true);
    try {
      const updatedRoomsList: RoomType[] = [];

      for (const room of selectedRooms) {
        if (!room.id) continue;
        const { newMWK, newUSD } = calculateNewRatesForRoom(room);
        const primary = room.currency || 'MWK';

        const updatedPrices: Record<string, number> = { ...(room.prices || {}) };
        if (newMWK !== null && newMWK !== undefined) updatedPrices.MWK = newMWK;
        if (newUSD !== null && newUSD !== undefined) updatedPrices.USD = newUSD;

        const updatePayload: Partial<RoomType> = {
          prices: updatedPrices,
          price: primary === 'USD' ? (newUSD ?? room.price) : (newMWK ?? room.price),
          priceMWK: newMWK !== null ? newMWK : room.priceMWK,
        };

        await updateDoc(doc(db, 'room_types', room.id), updatePayload);
        updatedRoomsList.push({ ...room, ...updatePayload });
      }

      toast.success(`Successfully updated rates for ${updatedRoomsList.length} room${updatedRoomsList.length === 1 ? '' : 's'}!`);
      if (onRoomsUpdated) {
        onRoomsUpdated(updatedRoomsList);
      }
      setManualPriceOverrides({});
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

        const newPromo: Promotion = {
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
          startDate: promoStartDate || new Date().toISOString().split('T')[0],
          endDate: promoEndDate || undefined,
          isActive: true,
          createdAt: Date.now(),
        };

        const existingPromos = hotel.promotions || [];
        const updatedPromos = [...existingPromos, newPromo];

        await updateDoc(doc(db, 'hotels', hotelId), {
          promotions: updatedPromos,
        });

        updatedHotelsList.push({
          ...hotel,
          promotions: updatedPromos,
        });
      }

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

  return (
    <div className={`bg-white rounded-2xl md:rounded-3xl border border-stone-200 shadow-sm overflow-hidden ${isEmbedded ? '' : 'max-w-5xl mx-auto'}`}>
      {/* Header Banner */}
      <div className="bg-stone-900 text-white p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-amber-300">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <h2 className="text-lg sm:text-xl font-serif font-bold text-white flex items-center gap-2">
              <span>Bulk Room &amp; Rates Editor</span>
              <span className="text-[10px] font-sans font-bold bg-amber-400 text-stone-950 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Manager Tool
              </span>
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-stone-300 max-w-2xl leading-relaxed">
            Quickly adjust base rates or launch promotional slashed prices across multiple rooms simultaneously with custom percentages or amounts.
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="self-end sm:self-center p-2 rounded-xl bg-white/10 hover:bg-white/20 text-stone-300 hover:text-white transition cursor-pointer"
            title="Close Bulk Editor"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Target Mode Segmented Navigation */}
      <div className="p-4 sm:p-6 border-b border-stone-200 bg-stone-50/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 p-1 bg-stone-200/70 rounded-2xl max-w-md w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('rates')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
                activeTab === 'rates'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>1. Base Room Rates (Permanent)</span>
            </button>
            <button
              onClick={() => setActiveTab('promotions')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
                activeTab === 'promotions'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Percent className="w-4 h-4 text-amber-600" />
              <span>2. Promotional Slash (Campaign)</span>
            </button>
          </div>

          <div className="text-xs text-stone-500 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <span>
              {activeTab === 'rates'
                ? 'Updates the standard published nightly rate in your inventory.'
                : 'Creates a promotional discount with original strikethrough price and sale badge.'}
            </span>
          </div>
        </div>
      </div>

      {/* Controls Grid */}
      <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Room Selection & Filter (5 cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-4 border-b lg:border-b-0 lg:border-r border-stone-200 pb-6 lg:pb-0 lg:pr-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BedDouble className="w-4 h-4 text-stone-700" />
              <h3 className="font-semibold text-stone-900 text-sm">Select Target Rooms</h3>
            </div>
            <span className="text-xs font-bold text-stone-700 bg-stone-100 px-2.5 py-0.5 rounded-full">
              {selectedRoomIds.length} of {filteredRooms.length} selected
            </span>
          </div>

          {/* Property Selector & Search */}
          <div className="space-y-2">
            {hotels.length > 1 && (
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
                  Filter by Property
                </label>
                <div className="relative">
                  <select
                    value={selectedHotelFilter}
                    onChange={(e) => setSelectedHotelFilter(e.target.value)}
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-800 appearance-none pr-8 shadow-2xs focus:ring-2 focus:ring-stone-900 focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Properties ({rooms.length} total rooms)</option>
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
                placeholder="Search rooms by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-stone-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-stone-800 placeholder-stone-400 shadow-2xs focus:ring-2 focus:ring-stone-900 focus:outline-none"
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
          <div className="flex items-center justify-between text-xs pt-1">
            <button
              type="button"
              onClick={handleSelectAll}
              className="font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
            >
              Select All ({filteredRooms.length})
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="font-semibold text-stone-500 hover:text-stone-800 cursor-pointer"
            >
              Deselect All
            </button>
          </div>

          {/* Rooms Checklist List */}
          <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1 divide-y divide-stone-100 border border-stone-100 rounded-xl p-2 bg-stone-50/50">
            {filteredRooms.length === 0 ? (
              <div className="p-6 text-center text-stone-400 text-xs">
                No rooms match the selected filter.
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
                    className={`pt-2 first:pt-0 p-2.5 rounded-xl transition cursor-pointer flex items-center gap-3 ${
                      isSelected
                        ? 'bg-stone-900 text-white shadow-2xs'
                        : 'bg-white hover:bg-stone-100/80 text-stone-800 border border-stone-200/60'
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
                          <span className={`text-[10px] truncate max-w-[120px] ${isSelected ? 'text-stone-300' : 'text-stone-500'}`}>
                            {hotel.name}
                          </span>
                        )}
                      </div>

                      <div className={`flex items-center gap-2 text-[11px] mt-0.5 ${isSelected ? 'text-stone-300' : 'text-stone-500'}`}>
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
        <div className="lg:col-span-7 flex flex-col space-y-5">
          {activeTab === 'rates' ? (
            /* ================================================================ */
            /* TAB 1: BASE ROOM RATES ADJUSTMENT                                */
            /* ================================================================ */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-serif font-bold text-stone-900 text-sm sm:text-base flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-emerald-600" />
                  <span>Configure Base Rate Adjustment</span>
                </h4>
                <div className="flex items-center gap-2 text-xs">
                  <label className="text-stone-600 cursor-pointer flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={roundToCleanNumbers}
                      onChange={(e) => setRoundToCleanNumbers(e.target.checked)}
                      className="rounded text-stone-900 focus:ring-stone-900 h-3.5 w-3.5"
                    />
                    <span>Round clean amounts</span>
                  </label>
                </div>
              </div>

              {/* Adjustment Method Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'percentage_discount', label: 'Percentage Discount (-%)', icon: TrendingDown },
                  { id: 'percentage_increase', label: 'Percentage Increase (+%)', icon: TrendingUp },
                  { id: 'amount_drop', label: 'Fixed Price Drop (- Amount)', icon: DollarSign },
                  { id: 'amount_increase', label: 'Fixed Price Increase (+ Amount)', icon: TrendingUp },
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setRateAdjustmentType(item.id as RateAdjustmentType)}
                      className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer flex flex-col justify-between ${
                        rateAdjustmentType === item.id
                          ? 'bg-stone-900 text-white border-stone-900 shadow-2xs'
                          : 'bg-white text-stone-700 border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 mb-1 ${rateAdjustmentType === item.id ? 'text-amber-400' : 'text-stone-500'}`} />
                      <span className="font-semibold leading-tight">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Percentage Inputs */}
              {(rateAdjustmentType === 'percentage_discount' || rateAdjustmentType === 'percentage_increase') && (
                <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-stone-700">
                      {rateAdjustmentType === 'percentage_discount' ? 'Discount Percentage' : 'Rate Increase Percentage'}
                    </span>
                    <span className="text-stone-500">Pick a preset or enter a custom %</span>
                  </div>

                  {/* Preset Pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {[5, 10, 15, 20, 25, 30, 40].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handlePercentageChange(val)}
                        className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                          ratePercentage === val
                            ? 'bg-stone-900 text-white shadow-xs'
                            : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {rateAdjustmentType === 'percentage_discount' ? `-${val}%` : `+${val}%`}
                      </button>
                    ))}
                  </div>

                  {/* Custom Percentage Input */}
                  <div className="flex items-center gap-3 pt-1">
                    <label className="text-xs font-medium text-stone-600 whitespace-nowrap">
                      Custom Percentage:
                    </label>
                    <div className="relative w-32">
                      <input
                        type="number"
                        min="1"
                        max="99"
                        step="0.5"
                        value={customRatePercentage}
                        onChange={(e) => handleCustomPercentageInput(e.target.value)}
                        className="w-full bg-white border border-stone-300 rounded-xl px-3 py-1.5 text-xs font-bold text-stone-900 pr-8 focus:ring-2 focus:ring-stone-900 focus:outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400 pointer-events-none">
                        %
                      </span>
                    </div>
                    <span className="text-xs text-stone-500 italic">
                      Applies proportionally across both MWK &amp; USD rates
                    </span>
                  </div>
                </div>
              )}

              {/* Amount Inputs */}
              {(rateAdjustmentType === 'amount_drop' || rateAdjustmentType === 'amount_increase') && (
                <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-stone-700">Currency &amp; Adjustment Amount</span>
                    <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => setRateAmountCurrency('MWK')}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                          rateAmountCurrency === 'MWK' ? 'bg-stone-900 text-white' : 'text-stone-600'
                        }`}
                      >
                        MWK (MK)
                      </button>
                      <button
                        type="button"
                        onClick={() => setRateAmountCurrency('USD')}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
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
                        className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                          rateAmount === val
                            ? 'bg-stone-900 text-white shadow-xs'
                            : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {rateAdjustmentType === 'amount_drop' ? '-' : '+'}
                        {formatMoney(val, rateAmountCurrency)}
                      </button>
                    ))}
                  </div>

                  {/* Custom Amount Input */}
                  <div className="flex items-center gap-3 pt-1">
                    <label className="text-xs font-medium text-stone-600 whitespace-nowrap">
                      Custom Amount:
                    </label>
                    <div className="relative w-40">
                      <input
                        type="number"
                        min="0"
                        step={rateAmountCurrency === 'MWK' ? '1000' : '1'}
                        value={customRateAmount}
                        onChange={(e) => handleCustomAmountInput(e.target.value)}
                        className="w-full bg-white border border-stone-300 rounded-xl pl-3 pr-12 py-1.5 text-xs font-bold text-stone-900 focus:ring-2 focus:ring-stone-900 focus:outline-none"
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
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                    Rate Adjustment Preview ({selectedRooms.length} rooms)
                  </h5>
                  {selectedRooms.length > 0 && (
                    <span className="text-[11px] text-stone-400">Values update in real-time</span>
                  )}
                </div>

                <div className="border border-stone-200 rounded-xl overflow-hidden bg-white max-h-[220px] overflow-y-auto">
                  {selectedRooms.length === 0 ? (
                    <div className="p-8 text-center text-stone-400 text-xs">
                      Select one or more rooms from the left to preview new calculated rates.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold text-[11px]">
                        <tr>
                          <th className="p-2.5">Room &amp; Property</th>
                          <th className="p-2.5">Current Rate</th>
                          <th className="p-2.5">New Rate</th>
                          <th className="p-2.5 text-right">Net Change</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {selectedRooms.map(room => {
                          const { originalMWK, originalUSD, newMWK, newUSD } = calculateNewRatesForRoom(room);
                          const hotel = hotelsMap.get(room.hotelId);

                          const diffMWK = originalMWK !== null && newMWK !== null ? newMWK - originalMWK : 0;
                          const pctMWK = originalMWK && originalMWK > 0 ? Math.round((diffMWK / originalMWK) * 100) : 0;

                          return (
                            <tr key={room.id} className="hover:bg-stone-50/60">
                              <td className="p-2.5">
                                <p className="font-semibold text-stone-900 truncate max-w-[150px]">{room.name}</p>
                                <p className="text-[10px] text-stone-400 truncate max-w-[150px]">{hotel?.name}</p>
                              </td>
                              <td className="p-2.5">
                                {originalMWK !== null && <div>{formatMoney(originalMWK, 'MWK')}</div>}
                                {originalUSD !== null && <div className="text-stone-400 text-[10px]">{formatMoney(originalUSD, 'USD')}</div>}
                              </td>
                              <td className="p-2.5 font-bold text-stone-900">
                                {newMWK !== null && (
                                  <div className="text-emerald-700">{formatMoney(newMWK, 'MWK')}</div>
                                )}
                                {newUSD !== null && (
                                  <div className="text-stone-500 text-[10px]">{formatMoney(newUSD, 'USD')}</div>
                                )}
                              </td>
                              <td className="p-2.5 text-right">
                                {diffMWK < 0 ? (
                                  <span className="inline-flex items-center gap-0.5 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">
                                    <TrendingDown className="w-2.5 h-2.5" />
                                    {pctMWK}% ({formatMoney(diffMWK, 'MWK')})
                                  </span>
                                ) : diffMWK > 0 ? (
                                  <span className="inline-flex items-center gap-0.5 text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-full text-[10px]">
                                    <TrendingUp className="w-2.5 h-2.5" />
                                    +{pctMWK}% (+{formatMoney(diffMWK, 'MWK')})
                                  </span>
                                ) : (
                                  <span className="text-stone-400 text-[10px]">No change</span>
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
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleApplyBaseRates}
                  disabled={saving || selectedRooms.length === 0}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl text-xs sm:text-sm transition shadow-sm cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving New Base Rates...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Apply Rates to {selectedRooms.length} Room{selectedRooms.length === 1 ? '' : 's'}</span>
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
              <div className="flex items-center justify-between">
                <h4 className="font-serif font-bold text-stone-900 text-sm sm:text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Configure Promotional Slash Campaign</span>
                </h4>
                <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                  Displayed with Strikethrough &amp; Badges
                </span>
              </div>

              {/* Campaign Type */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
                  Sale Campaign Type
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
                      className={`p-2 rounded-xl border text-left text-xs transition cursor-pointer ${
                        promoSaleType === st.value
                          ? 'bg-stone-900 text-white border-stone-900 shadow-2xs font-semibold'
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
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
                  Promotion Title / Campaign Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Weekend Special, Summer Flash Sale, Easter Getaway"
                  value={promoCustomTitle}
                  onChange={(e) => setPromoCustomTitle(e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold text-stone-900 placeholder-stone-400 focus:ring-2 focus:ring-stone-900 focus:outline-none"
                />
              </div>

              {/* Discount Structure: Percentage vs Fixed Slash */}
              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 p-1 bg-stone-200/80 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setPromoDiscountMode('percentage')}
                      className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                        promoDiscountMode === 'percentage'
                          ? 'bg-white text-stone-900 shadow-xs'
                          : 'text-stone-600'
                      }`}
                    >
                      % Percentage Discount
                    </button>
                    <button
                      type="button"
                      onClick={() => setPromoDiscountMode('fixed_slash')}
                      className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                        promoDiscountMode === 'fixed_slash'
                          ? 'bg-white text-stone-900 shadow-xs'
                          : 'text-stone-600'
                      }`}
                    >
                      Fixed Amount Slash
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
                          className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                            promoPercentage === val
                              ? 'bg-stone-900 text-white shadow-xs'
                              : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          {val}% OFF
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <label className="text-xs font-medium text-stone-600 whitespace-nowrap">
                        Custom Percentage:
                      </label>
                      <div className="relative w-32">
                        <input
                          type="number"
                          min="1"
                          max="90"
                          value={customPromoPercentage}
                          onChange={(e) => handleCustomPromoPercentageInput(e.target.value)}
                          className="w-full bg-white border border-stone-300 rounded-xl px-3 py-1.5 text-xs font-bold text-stone-900 pr-8 focus:ring-2 focus:ring-stone-900 focus:outline-none"
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
                          className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                            promoSortedCurrency === 'MWK' ? 'bg-stone-900 text-white' : 'text-stone-600'
                          }`}
                        >
                          MWK (MK)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPromoSortedCurrency('USD')}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
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
                          className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                            promoSortedAmount === val
                              ? 'bg-stone-900 text-white shadow-xs'
                              : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          Slash {formatMoney(val, promoSortedCurrency)}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <label className="text-xs font-medium text-stone-600 whitespace-nowrap">
                        Custom Amount to Slash:
                      </label>
                      <div className="relative w-40">
                        <input
                          type="number"
                          min="0"
                          step={promoSortedCurrency === 'MWK' ? '1000' : '1'}
                          value={customPromoAmount}
                          onChange={(e) => handleCustomPromoAmountInput(e.target.value)}
                          className="w-full bg-white border border-stone-300 rounded-xl pl-3 pr-12 py-1.5 text-xs font-bold text-stone-900 focus:ring-2 focus:ring-stone-900 focus:outline-none"
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
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={promoStartDate}
                    onChange={(e) => setPromoStartDate(e.target.value)}
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs text-stone-800 focus:ring-2 focus:ring-stone-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={promoEndDate}
                    onChange={(e) => setPromoEndDate(e.target.value)}
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs text-stone-800 focus:ring-2 focus:ring-stone-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Live Promotional Price Preview */}
              <div className="space-y-2">
                <h5 className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                  Guest-Facing Slashed Preview ({selectedRooms.length} rooms)
                </h5>

                <div className="border border-stone-200 rounded-xl overflow-hidden bg-white max-h-[220px] overflow-y-auto">
                  {selectedRooms.length === 0 ? (
                    <div className="p-8 text-center text-stone-400 text-xs">
                      Select one or more rooms from the left to preview guest-facing promotional prices.
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
                              <p className="text-[10px] text-stone-400 truncate">{hotel?.name}</p>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="flex items-center gap-1.5">
                                <span className="line-through text-stone-400 text-[11px]">
                                  {formatMoney(originalMWK, 'MWK')}
                                </span>
                                <span className="font-bold text-emerald-700 text-sm">
                                  {formatMoney(slashed.slashedPrice, 'MWK')}
                                </span>
                              </div>
                              <div className="text-[10px] font-bold text-amber-800 bg-amber-100/70 px-1.5 py-0.2 rounded-full inline-block mt-0.5">
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
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleApplyPromotion}
                  disabled={saving || selectedRooms.length === 0}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl text-xs sm:text-sm transition shadow-sm cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating Promotions...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span>Launch Promotion on {selectedRooms.length} Room{selectedRooms.length === 1 ? '' : 's'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
