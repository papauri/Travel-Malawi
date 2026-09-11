import React, { useState, useEffect } from 'react';
import { Hotel, Promotion, SaleType, PromotionTarget, CurrencyCode, DiscountType, RoomType } from '../types';
import SectionCard from './SectionCard';
import { Percent, Plus, Trash2, Save, Loader2, Calendar, Eye, Tag, Sparkles, Check, DollarSign, Briefcase } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { SALE_TYPE_OPTIONS, PROMOTION_TARGET_OPTIONS, getSaleTypeLabel, getSaleTypeBadge, calculateSlashedPrice } from '../lib/promotions';
import PriceDisplay from './PriceDisplay';
import PromotionIcon from './PromotionIcon';

interface PromotionsManagerProps {
  hotel: Hotel;
  rooms?: RoomType[];
  onUpdate: (promotions: Promotion[]) => void;
}

export default function PromotionsManager({ hotel, rooms, onUpdate }: PromotionsManagerProps) {
  const [promotions, setPromotions] = useState<Promotion[]>(hotel.promotions || []);
  const [saving, setSaving] = useState(false);
  const [roomsList, setRoomsList] = useState<RoomType[]>(rooms || hotel.rooms || []);

  useEffect(() => {
    if (rooms && rooms.length > 0) {
      setRoomsList(rooms);
      return;
    }
    if (hotel.id) {
      getDocs(query(collection(db, 'room_types'), where('hotelId', '==', hotel.id))).then(snap => {
        setRoomsList(snap.docs.map(d => ({ id: d.id, ...d.data() } as RoomType)));
      }).catch(err => console.error('Failed to fetch rooms for promotions:', err));
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
      startDate: new Date().toISOString().split('T')[0],
    };
    setPromotions([...promotions, newPromo]);
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
    setSaving(true);
    try {
      await updateDoc(doc(db, 'hotels', hotel.id!), { promotions });
      onUpdate(promotions);
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
        title="Promotions & Slashed Pricing Manager" 
        description="Configure active promotions, sale types, and price slash campaigns. Slashed prices are prominently displayed with 'FROM > TO' tags and promotional badges on your hotel page and homepage cards."
        action={
          <button 
            onClick={addPromotion}
            className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-stone-800 transition shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Create Promotion
          </button>
        }
      >
        {promotions.length === 0 ? (
          <div className="text-center py-12 bg-stone-50 rounded-2xl border border-stone-100 p-6">
            <Percent className="w-10 h-10 text-stone-300 mx-auto mb-3" />
            <h4 className="font-serif font-bold text-stone-800 text-base mb-1">No active promotions</h4>
            <p className="text-stone-500 text-sm max-w-md mx-auto mb-4">
              Slash room rates and conference space prices for limited periods, seasonal holidays, or early bird bookings.
            </p>
            <button 
              onClick={addPromotion}
              className="inline-flex items-center gap-2 bg-stone-900 text-white px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-stone-800 transition shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Launch First Sale Campaign
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {promotions.map((promo, pIdx) => {
              const sampleOriginalRate = 120000;
              const previewSlashed = calculateSlashedPrice(sampleOriginalRate, promo, 'MWK');

              return (
                <div key={`${promo.id || 'promo'}-${pIdx}`} className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 shadow-xs relative">
                  <div className="flex items-center justify-between gap-3 border-b border-stone-100 pb-4 mb-5">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-stone-100 text-stone-800 rounded-lg">
                        <PromotionIcon saleType={promo.saleType} className="w-5 h-5 text-stone-800" />
                      </div>
                      <div>
                        <h4 className="font-bold text-stone-900 text-base">{promo.name || 'Unnamed Promotion'}</h4>
                        <p className="text-xs text-stone-500">
                          {getSaleTypeLabel(promo.saleType, promo.saleTypeCustomLabel)} · {promo.discountPercentage}% Price Slash
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer bg-stone-50 px-3 py-1.5 rounded-full border border-stone-200">
                        <input 
                          type="checkbox" 
                          checked={promo.isActive}
                          onChange={e => updatePromo(promo.id, { isActive: e.target.checked })}
                          className="w-4 h-4 accent-stone-900 rounded cursor-pointer"
                        />
                        <span className={`text-xs font-bold ${promo.isActive ? 'text-stone-900' : 'text-stone-400'}`}>
                          {promo.isActive ? 'Campaign Active' : 'Paused / Inactive'}
                        </span>
                      </label>
                      <button 
                        onClick={() => deletePromo(promo.id)}
                        className="text-stone-400 hover:text-stone-900 p-1.5 rounded-lg hover:bg-stone-100 transition cursor-pointer"
                        title="Delete Campaign"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Campaign Title */}
                    <div>
                      <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
                        Internal Campaign Name
                      </label>
                      <input 
                        type="text" 
                        value={promo.name} 
                        onChange={e => updatePromo(promo.id, { name: e.target.value })}
                        placeholder="e.g. Easter Weekend Special"
                        className="w-full bg-stone-50 border border-stone-200 p-2.5 rounded-xl text-sm font-medium outline-none focus:border-stone-400"
                      />
                    </div>

                    {/* Sale Type Selector */}
                    <div>
                      <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
                        Sale Type (Displayed on Cards)
                      </label>
                      <select
                        value={promo.saleType || 'flash_sale'}
                        onChange={e => updatePromo(promo.id, { saleType: e.target.value as SaleType })}
                        className="w-full bg-stone-50 border border-stone-200 p-2.5 rounded-xl text-sm font-medium outline-none focus:border-stone-400"
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
                      <div className="md:col-span-2 bg-stone-50 border border-stone-200 rounded-xl p-3.5">
                        <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                          Custom Sale Title / Marketing Tag
                        </label>
                        <input 
                          type="text"
                          value={promo.saleTypeCustomLabel || ''}
                          onChange={e => updatePromo(promo.id, { saleTypeCustomLabel: e.target.value })}
                          placeholder="e.g. Independence Holiday Special, Lake Festival Getaway"
                          className="w-full bg-white border border-stone-300 p-2 rounded-lg text-sm outline-none focus:border-stone-500"
                        />
                        <p className="text-[11px] text-stone-500 mt-1">
                          This label will show in uppercase on your property card badges and in the FROM &gt; TO price section.
                        </p>
                      </div>
                    )}

                    {/* Target Scope */}
                    <div>
                      <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
                        Applies To
                      </label>
                      <select
                        value={promo.appliesTo || 'all'}
                        onChange={e => updatePromo(promo.id, { appliesTo: e.target.value as PromotionTarget })}
                        className="w-full bg-stone-50 border border-stone-200 p-2.5 rounded-xl text-sm font-medium outline-none focus:border-stone-400"
                      >
                        {PROMOTION_TARGET_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-stone-400 mt-1">
                        {PROMOTION_TARGET_OPTIONS.find(o => o.value === (promo.appliesTo || 'all'))?.description}
                      </p>
                    </div>

                    {/* Discount Percentage */}
                    <div>
                      <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
                        Price Slash Percentage (%)
                      </label>
                      <div className="flex items-center gap-3">
                        <input 
                          type="range"
                          min="5"
                          max="80"
                          step="5"
                          value={promo.discountPercentage}
                          onChange={e => updatePromo(promo.id, { discountPercentage: parseInt(e.target.value) || 0 })}
                          className="flex-1 accent-stone-900 cursor-pointer"
                        />
                        <div className="flex items-center gap-1 bg-stone-100 text-stone-900 px-3 py-1.5 rounded-lg font-bold text-sm min-w-[70px] justify-center border border-stone-200">
                          <span>{promo.discountPercentage}%</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-stone-400 mt-1">
                        How much rates are slashed by. Minimum 5%, up to 80%.
                      </p>
                    </div>

                    {/* Specific Room Selection if target is 'specific_rooms' */}
                    {promo.appliesTo === 'specific_rooms' && roomsList.length > 0 && (
                      <div className="md:col-span-2 bg-stone-50 border border-stone-200 rounded-xl p-4">
                        <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                          Select Qualifying Accommodations
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                          {roomsList.map(room => {
                            const isSelected = promo.targetRoomIds?.includes(room.id || '');
                            return (
                              <label 
                                key={room.id} 
                                className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                                  isSelected 
                                    ? 'bg-stone-900 border-stone-900 text-white font-bold' 
                                    : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100/60'
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
                      <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
                        Start Date (Optional)
                      </label>
                      <input 
                        type="date" 
                        value={promo.startDate || ''} 
                        onChange={e => updatePromo(promo.id, { startDate: e.target.value })}
                        className="w-full bg-stone-50 border border-stone-200 p-2.5 rounded-xl text-sm font-medium outline-none focus:border-stone-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
                        End Date (Optional)
                      </label>
                      <input 
                        type="date" 
                        value={promo.endDate || ''} 
                        onChange={e => updatePromo(promo.id, { endDate: e.target.value })}
                        className="w-full bg-stone-50 border border-stone-200 p-2.5 rounded-xl text-sm font-medium outline-none focus:border-stone-400"
                      />
                    </div>

                    {/* Live Guest Preview Card */}
                    <div className="md:col-span-2 bg-stone-900 text-white rounded-xl p-4 mt-2">
                      <div className="flex items-center gap-1.5 text-xs text-stone-400 font-semibold uppercase tracking-wider mb-3">
                        <Eye className="w-3.5 h-3.5 text-stone-300" />
                        <span>Live Guest View Preview</span>
                      </div>

                      <div className="bg-white/10 border border-white/15 rounded-lg p-3.5">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 bg-white text-stone-900 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shadow-2xs">
                            <PromotionIcon saleType={promo.saleType} className="w-3 h-3 text-stone-900" />
                            <span>{previewSlashed.saleTypeLabel}</span>
                          </span>
                          <span className="bg-white/10 text-stone-200 border border-white/20 px-2 py-0.5 rounded text-[10px] font-semibold">
                            Slashed by <PriceDisplay amount={previewSlashed.slashedAmount} currency="MWK" /> ({previewSlashed.discountPercentage}% OFF)
                          </span>
                        </div>

                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-[11px] font-bold uppercase text-stone-400">FROM</span>
                          <span className="line-through decoration-stone-400 text-stone-400 text-xs font-medium">
                            <PriceDisplay amount={sampleOriginalRate} currency="MWK" />
                          </span>
                          <span className="text-stone-400 font-bold text-xs">&gt;</span>
                          <span className="text-[11px] font-bold uppercase text-stone-200">TO</span>
                          <span className="text-white font-bold text-base sm:text-lg">
                            <PriceDisplay amount={previewSlashed.slashedPrice} currency="MWK" />
                          </span>
                          <span className="text-stone-300 text-xs font-normal"> / night</span>
                        </div>

                        {promo.appliesTo === 'all' && (
                          <div className="text-[10px] text-stone-300 font-medium mt-2 flex items-center gap-1.5">
                            <Briefcase className="w-3 h-3 text-stone-400" />
                            <span>Conference spaces also slashed up to {promo.discountPercentage}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            <div className="pt-4 flex justify-end">
              <button 
                onClick={savePromotions}
                disabled={saving}
                className="flex items-center gap-2 bg-stone-900 text-white px-7 py-3 rounded-full text-sm font-bold hover:bg-stone-800 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md cursor-pointer"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Save All Promotions'}
              </button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
