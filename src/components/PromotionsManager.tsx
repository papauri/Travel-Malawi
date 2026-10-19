import React, { useState, useEffect, useRef } from 'react';
import { Hotel, Promotion, SaleType, PromotionTarget, CurrencyCode, DiscountType, RoomType } from '../types';
import SectionCard from './SectionCard';
import { Percent, Plus, Trash2, Save, Loader2, Calendar, Eye, Tag, Check, DollarSign, Briefcase } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, collection, query, where, getDocs, runTransaction } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { SALE_TYPE_OPTIONS, PROMOTION_TARGET_OPTIONS, getSaleTypeLabel, getSaleTypeBadge, calculateSlashedPrice, malawiToday, validatePromotion, mergePromotions, MAX_PROMO_DISCOUNT_PERCENT } from '../lib/promotions';
import PriceDisplay from './PriceDisplay';
import PromotionIcon from './PromotionIcon';
import Pagination from './Pagination';

interface PromotionsManagerProps {
  hotel: Hotel;
  rooms?: RoomType[];
  onUpdate: (promotions: Promotion[]) => void;
  /** Lets the page warn before a tab switch discards unsaved edits. */
  onDirtyChange?: (dirty: boolean) => void;
}

export default function PromotionsManager({ hotel, rooms, onUpdate, onDirtyChange }: PromotionsManagerProps) {
  const [promotions, setPromotions] = useState<Promotion[]>(hotel.promotions || []);
  // The promotions as loaded or last saved, used to merge with concurrent edits.
  const baselineRef = useRef<Promotion[]>(hotel.promotions || []);
  const [saving, setSaving] = useState(false);
  const [roomsList, setRoomsList] = useState<RoomType[]>(rooms || hotel.rooms || []);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;
  const isDirty = JSON.stringify(promotions) !== JSON.stringify(baselineRef.current);

  // Promotions saved elsewhere on the page (the bulk editor) show up here
  // unless the manager is mid-edit; a save merges them either way.
  useEffect(() => {
    if (isDirty) return;
    baselineRef.current = hotel.promotions || [];
    setPromotions(hotel.promotions || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotel.promotions]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  // Deleting the last card on a page falls back to the page before it.
  const totalPages = Math.max(1, Math.ceil(promotions.length / itemsPerPage));
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (rooms && rooms.length > 0) {
      setRoomsList(rooms);
      return;
    }
    if (hotel.id) {
      getDocs(query(collection(db, 'room_types'), where('hotelId', '==', hotel.id))).then(snap => {
        setRoomsList(snap.docs.map(d => ({ id: d.id, ...d.data() } as RoomType)));
      }).catch(err => {
        console.error('Failed to fetch rooms for promotions:', err);
        toast.error('Could not load rooms, so room-specific promotions are unavailable.');
      });
    }
  }, [hotel.id, rooms]);

  const addPromotion = () => {
    const newPromo: Promotion = {
      id: crypto.randomUUID(),
      name: 'Special Promotion',
      saleType: 'flash_sale',
      appliesTo: 'all',
      discountType: 'percentage',
      discountPercentage: 20,
      isActive: true,
      startDate: malawiToday(),
    };
    setPromotions([...promotions, newPromo]);
    // Shown straight away rather than on a later page.
    setCurrentPage(Math.ceil((promotions.length + 1) / itemsPerPage));
  };

  const updatePromo = (id: string, updates: Partial<Promotion>) => {
    setPromotions(promotions.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deletePromo = (id: string) => {
    setPromotions(promotions.filter(p => p.id !== id));
  };

  const toggleRoomTarget = (promoId: string, roomId: string) => {
    const promo = promotions.find(p => p.id === promoId);
    if (!promo) return;
    const current = promo.targetRoomIds || [];
    const next = current.includes(roomId)
      ? current.filter(id => id !== roomId)
      : [...current, roomId];
    updatePromo(promoId, { targetRoomIds: next });
  };

  const savePromotions = async () => {
    for (const promo of promotions) {
      const problem = validatePromotion(promo);
      if (problem) {
        toast.error(`${promo.name || 'Promotion'}: ${problem}`);
        return;
      }
    }
    setSaving(true);
    try {
      const hotelRef = doc(db, 'hotels', hotel.id!);
      const saved = await runTransaction(db, async tx => {
        const snap = await tx.get(hotelRef);
        const stored = ((snap.data()?.promotions as Promotion[] | undefined) ?? []);
        const merged = mergePromotions(stored, baselineRef.current, promotions);
        tx.update(hotelRef, { promotions: merged });
        return merged;
      });
      baselineRef.current = saved;
      setPromotions(saved);
      onUpdate(saved);
      toast.success('Promotions and price slash logic saved successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save promotions.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard 
        title="Promotions" 
        description="Time-limited discounts, shown as a from → to price on your listing."
        action={
          <button 
            onClick={addPromotion}
            className="tm-btn tm-btn-secondary tm-btn-sm"
          >
            <Plus className="w-4 h-4" /> Add promotion
          </button>
        }
      >
        {promotions.length === 0 ? (
          <div className="text-center py-8 px-4 rounded-lg border border-dashed border-stone-300">
            <Percent className="w-8 h-8 text-stone-300 mx-auto mb-3" />
            <p className="tm-muted max-w-md mx-auto mb-4">
              No promotions yet. Add one for a holiday, a quiet season or early bookings.
            </p>
            <button 
              onClick={addPromotion}
              className="tm-btn tm-btn-secondary"
            >
              <Plus className="w-4 h-4" /> Add promotion
            </button>
            {isDirty && (
              <div className="pt-4">
                <button
                  onClick={savePromotions}
                  disabled={saving}
                  className="tm-btn tm-btn-primary"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {saving ? 'Saving…' : 'Save (removes all promotions)'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="min-w-0">
            {promotions
              .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
              .map((promo, pIdx) => {
              const sampleOriginalRate = 120000;
              const previewSlashed = calculateSlashedPrice(sampleOriginalRate, promo, 'MWK');

              return (
                <div key={`${promo.id || 'promo'}-${pIdx}`} className="py-5 first:pt-0 border-t border-stone-200 first:border-t-0 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 bg-stone-100 text-stone-800 rounded-lg shrink-0">
                        <PromotionIcon saleType={promo.saleType} className="w-5 h-5 text-stone-800" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-stone-900 text-base truncate">{promo.name || 'Unnamed promotion'}</h4>
                        <p className="text-xs text-stone-500 truncate">
                          {getSaleTypeLabel(promo.saleType, promo.saleTypeCustomLabel)} · {promo.discountType === 'fixed_slash' ? 'Fixed price slash' : `${promo.discountPercentage}% off`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <label className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded-lg hover:bg-stone-50">
                        <input 
                          type="checkbox" 
                          checked={promo.isActive}
                          onChange={e => updatePromo(promo.id, { isActive: e.target.checked })}
                          className="w-4 h-4 accent-stone-900 rounded cursor-pointer"
                        />
                        <span className={`text-xs font-medium ${promo.isActive ? 'text-stone-900' : 'text-stone-500'}`}>
                          {promo.isActive ? 'Active' : 'Paused'}
                        </span>
                      </label>
                      <button 
                        onClick={() => deletePromo(promo.id)}
                        className="text-stone-400 hover:text-stone-900 p-1.5 rounded-lg hover:bg-stone-100 transition cursor-pointer"
                        title="Delete promotion" aria-label="Delete promotion"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Campaign Title */}
                    <div>
                      <label className="tm-label">
                        Name (only you see this)
                      </label>
                      <input 
                        type="text" 
                        value={promo.name} 
                        onChange={e => updatePromo(promo.id, { name: e.target.value })}
                        placeholder="e.g. Easter Weekend Special"
                        className="tm-input"
                      />
                    </div>

                    {/* Sale Type Selector */}
                    <div>
                      <label className="tm-label">
                        Sale badge
                      </label>
                      <select
                        value={promo.saleType || 'flash_sale'}
                        onChange={e => updatePromo(promo.id, { saleType: e.target.value as SaleType })}
                        className="tm-input"
                      >
                        {SALE_TYPE_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label} ({opt.badge})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Custom Sale Type Label if 'custom' selected */}
                    {promo.saleType === 'custom' && (
                      <div className="md:col-span-2">
                        <label className="tm-label">
                          Custom badge text
                        </label>
                        <input 
                          type="text"
                          value={promo.saleTypeCustomLabel || ''}
                          onChange={e => updatePromo(promo.id, { saleTypeCustomLabel: e.target.value })}
                          placeholder="e.g. Independence Holiday Special, Lake Festival Getaway"
                          className="tm-input"
                        />
                        <p className="text-xs text-stone-500 mt-1">
                          Shown on your listing badge and next to the from → to price.
                        </p>
                      </div>
                    )}

                    {/* Target Scope */}
                    <div>
                      <label className="tm-label">
                        Applies to
                      </label>
                      <select
                        value={promo.appliesTo || 'all'}
                        onChange={e => updatePromo(promo.id, { appliesTo: e.target.value as PromotionTarget })}
                        className="tm-input"
                      >
                        {PROMOTION_TARGET_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-stone-500 mt-1">
                        {PROMOTION_TARGET_OPTIONS.find(o => o.value === (promo.appliesTo || 'all'))?.description}
                      </p>
                    </div>

                    {/* Discount Percentage */}
                    <div>
                      <label className="tm-label">
                        Discount
                      </label>
                      <div className="flex items-center gap-3">
                        <input 
                          type="range"
                          min="5"
                          max={MAX_PROMO_DISCOUNT_PERCENT}
                          step="5"
                          value={promo.discountPercentage}
                          onChange={e => updatePromo(promo.id, { discountPercentage: parseInt(e.target.value) || 0 })}
                          className="flex-1 accent-stone-900 cursor-pointer"
                        />
                        <div className="flex items-center gap-1 text-stone-900 px-2 py-1.5 font-semibold text-sm min-w-[56px] justify-end tabular-nums">
                          <span>{promo.discountPercentage}%</span>
                        </div>
                      </div>
                      <p className="text-xs text-stone-500 mt-1">
                        5% to {MAX_PROMO_DISCOUNT_PERCENT}%.
                      </p>
                    </div>

                    {/* Specific Room Selection if target is 'specific_rooms' */}
                    {promo.appliesTo === 'specific_rooms' && roomsList.length > 0 && (
                      <div className="md:col-span-2">
                        <label className="tm-label">
                          Which rooms
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                          {roomsList.map(room => {
                            const isSelected = promo.targetRoomIds?.includes(room.id || '');
                            return (
                              <label 
                                key={room.id} 
                                className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition min-w-0 ${
                                  isSelected 
                                    ? 'bg-amber-50 border-amber-700 text-stone-900 font-medium' 
                                    : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                                }`}
                              >
                                <input 
                                  type="checkbox"
                                  checked={!!isSelected}
                                  onChange={() => toggleRoomTarget(promo.id, room.id || '')}
                                  className="w-3.5 h-3.5 accent-stone-900 rounded cursor-pointer"
                                />
                                <span className="truncate">{room.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Date Scheduling */}
                    <div>
                      <label className="tm-label">
                        Starts (optional)
                      </label>
                      <input 
                        type="date" 
                        value={promo.startDate || ''} 
                        onChange={e => updatePromo(promo.id, { startDate: e.target.value })}
                        onClick={e => { try { (e.target as HTMLInputElement).showPicker?.(); } catch {} }}
                        className="tm-input cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="tm-label">
                        Ends (optional)
                      </label>
                      <input 
                        type="date" 
                        value={promo.endDate || ''} 
                        min={promo.startDate || undefined}
                        onChange={e => updatePromo(promo.id, { endDate: e.target.value })}
                        onClick={e => { try { (e.target as HTMLInputElement).showPicker?.(); } catch {} }}
                        className="tm-input cursor-pointer"
                      />
                    </div>

                    {/* Live Guest Preview Card */}
                    <details className="md:col-span-2 group">
                      <summary className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-700 hover:text-stone-900 cursor-pointer select-none">
                        <Eye className="w-4 h-4 text-stone-500" />
                        <span>Preview what guests see</span>
                      </summary>

                      <div className="mt-3 rounded-lg bg-stone-50 p-3.5">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="tm-tag tm-tag-warn">
                            <PromotionIcon saleType={promo.saleType} className="w-3 h-3" />
                            <span>{previewSlashed.saleTypeLabel}</span>
                          </span>
                          <span className="text-xs text-stone-600">
                            Slashed by <PriceDisplay amount={previewSlashed.slashedAmount} currency="MWK" /> ({previewSlashed.discountPercentage}% off)
                          </span>
                        </div>

                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-xs text-stone-500">From</span>
                          <span className="line-through text-stone-500 text-xs">
                            <PriceDisplay amount={sampleOriginalRate} currency="MWK" />
                          </span>
                                                    <span className="text-xs text-stone-500">to</span>
                          <span className="text-stone-900 font-semibold text-base sm:text-lg">
                            <PriceDisplay amount={previewSlashed.slashedPrice} currency="MWK" />
                          </span>
                          <span className="text-stone-500 text-xs"> / night</span>
                        </div>

                        {promo.appliesTo === 'all' && (
                          <div className="text-xs text-stone-500 mt-2 flex items-center gap-1.5">
                            <Briefcase className="w-3 h-3" />
                            <span>Conference spaces also up to {promo.discountPercentage}% off</span>
                          </div>
                        )}
                      </div>
                    </details>
                  </div>
                </div>
              );
            })}
            
            {promotions.length > itemsPerPage && (
              <div className="pt-2">
                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(promotions.length / itemsPerPage)}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}

            <div className="pt-4 tm-actions justify-end">
              <button 
                onClick={savePromotions}
                disabled={saving}
                className="tm-btn tm-btn-primary"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving…' : 'Save promotions'}
              </button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
