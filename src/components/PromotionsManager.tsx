import React, { useState } from 'react';
import { Hotel, Promotion } from '../types';
import SectionCard from './SectionCard';
import { Percent, Plus, Trash2, Save, Loader2, Calendar } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

interface PromotionsManagerProps {
  hotel: Hotel;
  onUpdate: (promotions: Promotion[]) => void;
}

export default function PromotionsManager({ hotel, onUpdate }: PromotionsManagerProps) {
  const [promotions, setPromotions] = useState<Promotion[]>(hotel.promotions || []);
  const [saving, setSaving] = useState(false);

  const addPromotion = () => {
    const newPromo: Promotion = {
      id: crypto.randomUUID(),
      name: 'Summer Sale',
      discountPercentage: 10,
      isActive: false,
    };
    setPromotions([...promotions, newPromo]);
  };

  const updatePromo = (id: string, updates: Partial<Promotion>) => {
    setPromotions(promotions.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deletePromo = (id: string) => {
    setPromotions(promotions.filter(p => p.id !== id));
  };

  const savePromotions = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'hotels', hotel.id!), { promotions });
      onUpdate(promotions);
      toast.success('Promotions updated successfully!');
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
        title="Promotions & Discounts" 
        description="Manage active sales and discounts for your property. Discounts apply to the base room rate."
        action={
          <button 
            onClick={addPromotion}
            className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-stone-800 transition"
          >
            <Plus className="w-4 h-4" /> Add Promotion
          </button>
        }
      >
        {promotions.length === 0 ? (
          <div className="text-center py-12 bg-stone-50 rounded-xl border border-stone-100">
            <Percent className="w-8 h-8 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-500 text-sm">No promotions currently configured.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {promotions.map((promo, pIdx) => (
              <div key={`${promo.id || 'promo'}-${pIdx}`} className="bg-white border border-stone-200 rounded-xl p-5 relative">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Campaign Name</label>
                    <input 
                      type="text" 
                      value={promo.name} 
                      onChange={e => updatePromo(promo.id, { name: e.target.value })}
                      className="w-full bg-stone-50 border border-stone-200 p-2.5 rounded-lg outline-none focus:border-stone-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Discount (%)</label>
                    <input 
                      type="number" 
                      min="1" max="99"
                      value={promo.discountPercentage} 
                      onChange={e => updatePromo(promo.id, { discountPercentage: parseInt(e.target.value) || 0 })}
                      className="w-full bg-stone-50 border border-stone-200 p-2.5 rounded-lg outline-none focus:border-stone-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Start Date (Optional)</label>
                    <input 
                      type="date" 
                      value={promo.startDate || ''} 
                      onChange={e => updatePromo(promo.id, { startDate: e.target.value })}
                      className="w-full bg-stone-50 border border-stone-200 p-2.5 rounded-lg outline-none focus:border-stone-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">End Date (Optional)</label>
                    <input 
                      type="date" 
                      value={promo.endDate || ''} 
                      onChange={e => updatePromo(promo.id, { endDate: e.target.value })}
                      className="w-full bg-stone-50 border border-stone-200 p-2.5 rounded-lg outline-none focus:border-stone-400"
                    />
                  </div>
                  
                  <div className="md:col-span-2 flex items-center justify-between mt-2 pt-4 border-t border-stone-100">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={promo.isActive}
                        onChange={e => updatePromo(promo.id, { isActive: e.target.checked })}
                        className="w-4 h-4 accent-stone-900 rounded"
                      />
                      <span className="text-sm font-medium text-stone-700">Active</span>
                    </label>
                    
                    <button 
                      onClick={() => deletePromo(promo.id)}
                      className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition"
                      title="Delete Campaign"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            
            <div className="pt-4 flex justify-end">
              <button 
                onClick={savePromotions}
                disabled={saving || JSON.stringify(promotions) === JSON.stringify(hotel.promotions || [])}
                className="flex items-center gap-2 bg-stone-900 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
