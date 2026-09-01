import SectionCard from './SectionCard';
import React, { useState } from 'react';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import ConfirmDialog from './ConfirmDialog';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Hotel, InfrastructureDetails, StayCrewMember, DailyBoard } from '../types';
import toast from 'react-hot-toast';
import { ShieldCheck, Zap, Droplets, Map, CheckCircle2, User, Plus, Trash2, Save, X, Wifi, Monitor, ClipboardList } from 'lucide-react';

interface StayOSManagerProps {
  hotel: Hotel;
}


const CustomSelect = ({ value, options, onChange, placeholder }: { value: string, options: {label: string, value: string}[], onChange: (val: string) => void, placeholder?: string }) => {
  const isCustom = !options.find(o => o.value === value) && value !== '' && value !== undefined;
  const [mode, setMode] = useState(isCustom ? 'custom' : 'select');
  
  return (
    <div className="space-y-2">
      {mode === 'select' ? (
        <select
          value={options.find(o => o.value === value) ? value : (value ? '__CUSTOM__' : options[0]?.value)}
          onChange={(e) => {
            if (e.target.value === '__CUSTOM__') {
              setMode('custom');
              onChange('');
            } else {
              onChange(e.target.value);
            }
          }}
          className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          <option value="__CUSTOM__">Other (Custom)...</option>
        </select>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || "Type custom value..."}
            className="flex-1 px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
            autoFocus
          />
          <button
            type="button"
            onClick={() => {
              setMode('select');
              onChange(options[0]?.value || '');
            }}
            className="px-3 py-3 text-stone-400 hover:text-stone-600 border border-stone-200 rounded-xl bg-stone-50 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default function StayOSManager({ hotel }: StayOSManagerProps) {
  const [saving, setSaving] = useState(false);
  const [infrastructure, setInfrastructure] = useState<InfrastructureDetails>(
    hotel.infrastructure || {
      powerSource: 'None',
      waterSource: 'Water Board',
      roadAccess: 'Tarred',
      internetSource: 'None',
      workspaceSetup: 'None',
      offlineTrustBadge: false
    }
  );
  
  const [crew, setCrew] = useState<StayCrewMember[]>(hotel.crew || []);
  const [dailyBoard, setDailyBoard] = useState<DailyBoard>(hotel.dailyBoard || { activities: '', dishOfTheDay: '', notes: '' });

  const initialInfrastructure = hotel.infrastructure || {
    powerSource: 'None',
    waterSource: 'Water Board',
    roadAccess: 'Tarred',
    internetSource: 'None',
    workspaceSetup: 'None',
    offlineTrustBadge: false
  };
  const initialCrew = hotel.crew || [];
  const initialDailyBoard = hotel.dailyBoard || { activities: '', dishOfTheDay: '', notes: '' };
  
  const isDirty = 
    JSON.stringify(infrastructure) !== JSON.stringify(initialInfrastructure) ||
    JSON.stringify(crew) !== JSON.stringify(initialCrew) ||
    JSON.stringify(dailyBoard) !== JSON.stringify(initialDailyBoard);

  const blocker = useUnsavedChanges(isDirty);


  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'hotels', hotel.id!), {
        infrastructure,
        crew,
        dailyBoard: {
          ...dailyBoard,
          updatedAt: Date.now()
        }
      });
      toast.success('Stay OS settings saved successfully');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const addCrew = () => {
    setCrew([
      ...crew, 
      { id: Date.now().toString(), name: '', role: '', phone: '', isAvailable: true }
    ]);
  };

  const removeCrew = (id: string) => {
    setCrew(crew.filter(c => c.id !== id));
  };

  const updateCrew = (id: string, updates: Partial<StayCrewMember>) => {
    setCrew(crew.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  return (
    <div className="space-y-12 pb-12">
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-serif font-bold text-stone-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
            Stay OS Verification
          </h2>
          <p className="text-stone-500 mt-1 max-w-2xl">
            Build trust with guests without processing payments. These verified infrastructure details appear on your digital stay vouchers.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-6 md:p-8 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <label className="block text-sm font-semibold text-stone-900 mb-2 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" /> Power Source
            </label>
            <CustomSelect 
              value={infrastructure.powerSource || 'Grid'} 
              onChange={(v) => setInfrastructure({...infrastructure, powerSource: v})}
              options={[
                { value: 'Grid', label: 'National Grid (ESCOM)' },
                { value: 'Solar', label: 'Full Solar Setup' },
                { value: 'Generator', label: 'Generator Backup' },
                { value: 'Mixed', label: 'Mixed (Grid + Backup)' },
                { value: 'Battery Inverter', label: 'Battery Inverter' },
                { value: 'Mini-grid (Community)', label: 'Mini-grid (Community)' },
                { value: 'Wind Power', label: 'Wind Power' },
                { value: 'Biogas', label: 'Biogas' },
                { value: 'None', label: 'Off-grid / No Power' }
              ]} 
              placeholder="e.g. Micro-hydro plant"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-900 mb-2 flex items-center gap-2">
              <Droplets className="w-4 h-4 text-blue-500" /> Water Source
            </label>
            <CustomSelect 
              value={infrastructure.waterSource || 'Water Board'} 
              onChange={(v) => setInfrastructure({...infrastructure, waterSource: v})}
              options={[
                { value: 'Water Board', label: 'Water Board (City Water)' },
                { value: 'Borehole', label: 'Private Borehole' },
                { value: 'Lake', label: 'Direct Lake Pumping' },
                { value: 'Rainwater Harvesting', label: 'Rainwater Harvesting' },
                { value: 'River / Stream', label: 'River / Stream Pumping' },
                { value: 'Water Delivery', label: 'Water Delivery / Truck' },
                { value: 'Other', label: 'Other / Variable' }
              ]} 
              placeholder="e.g. Natural Spring"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-900 mb-2 flex items-center gap-2">
              <Map className="w-4 h-4 text-stone-500" /> Road Access
            </label>
            <CustomSelect 
              value={infrastructure.roadAccess || 'Tarred'} 
              onChange={(v) => setInfrastructure({...infrastructure, roadAccess: v})}
              options={[
                { value: 'Tarred', label: 'Tarred Road (All Vehicles)' },
                { value: 'Dirt/Gravel', label: 'Dirt / Gravel (Accessible)' },
                { value: 'High-clearance', label: 'High-clearance Vehicle Required' },
                { value: '4x4 Only', label: '4x4 Required' },
                { value: 'Boat Only', label: 'Boat Access Only' },
                { value: 'Fly-in', label: 'Fly-in (Airstrip)' },
                { value: 'Hike-in Only', label: 'Hike-in Only' }
              ]} 
              placeholder="e.g. Helicopter pad"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-900 mb-2 flex items-center gap-2">
              <Wifi className="w-4 h-4 text-sky-500" /> Internet Source
            </label>
            <select
              value={infrastructure.internetSource}
              onChange={(e) => setInfrastructure({...infrastructure, internetSource: e.target.value as any})}
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
            >
              <option value="None">None</option>
              <option value="Fiber">Fiber (Fast & Reliable)</option>
              <option value="Starlink">Starlink (Satellite)</option>
              <option value="4G Router">4G Router</option>
              <option value="Mobile Data Only">Mobile Data Only</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-900 mb-2 flex items-center gap-2">
              <Monitor className="w-4 h-4 text-indigo-500" /> WFH Setup
            </label>
            <CustomSelect 
              value={infrastructure.workspaceSetup || 'None'} 
              onChange={(v) => setInfrastructure({...infrastructure, workspaceSetup: v})}
              options={[
                { value: 'None', label: 'None' },
                { value: 'Dedicated Desk', label: 'Dedicated Desk' },
                { value: 'Dining Table', label: 'Dining Table Setup' },
                { value: 'Co-working Space (Shared)', label: 'Co-working Space (Shared)' },
                { value: 'Private Office Room', label: 'Private Office Room' },
                { value: 'Standing Desk Available', label: 'Standing Desk Available' },
                { value: 'Ergonomic Chair Setup', label: 'Ergonomic Chair Setup' }
              ]} 
              placeholder="e.g. Balcony Table"
            />
          </div>
          
          <div className="md:col-span-3 pt-4 border-t border-stone-100 flex items-center gap-4">
            <button
              onClick={() => setInfrastructure({...infrastructure, offlineTrustBadge: !infrastructure.offlineTrustBadge})}
              className={`w-12 h-6 rounded-full transition-colors relative ${infrastructure.offlineTrustBadge ? 'bg-emerald-500' : 'bg-stone-300'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${infrastructure.offlineTrustBadge ? 'left-7' : 'left-1'}`} />
            </button>
            <div>
              <p className="font-semibold text-stone-900">Accept Offline/Cash Payments on Arrival</p>
              <p className="text-sm text-stone-500">Enable this to generate non-financial Digital Vouchers that guests present on arrival.</p>
            </div>
          </div>

          <div className="md:col-span-3 pt-6 border-t border-stone-100">
            <h3 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
              <Wifi className="w-5 h-5 text-indigo-500" /> Guest WiFi Access
            </h3>
            
            {hotel.adminWifiVoucherEnabled === false ? (
              <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-sm">
                <strong>Admin Disabled:</strong> Sharing WiFi details on vouchers has been disabled by an administrator.
              </div>
            ) : (
              <div className="bg-indigo-50/50 rounded-xl p-5 border border-indigo-100">
                <div className="flex items-center gap-4 mb-4">
                  <button
                    onClick={() => setInfrastructure({...infrastructure, shareWifiVoucher: !infrastructure.shareWifiVoucher})}
                    className={`w-12 h-6 rounded-full transition-colors relative ${infrastructure.shareWifiVoucher ? 'bg-indigo-500' : 'bg-stone-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${infrastructure.shareWifiVoucher ? 'left-7' : 'left-1'}`} />
                  </button>
                  <div>
                    <p className="font-semibold text-stone-900">Include WiFi Details on Digital Voucher</p>
                    <p className="text-xs text-stone-500 mt-0.5">Guests can easily copy or scan a QR code to connect upon arrival.</p>
                  </div>
                </div>
                
                {infrastructure.shareWifiVoucher && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-indigo-100">
                    <div>
                      <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Network Name (SSID)</label>
                      <input
                        type="text"
                        value={infrastructure.wifiSSID || ''}
                        onChange={(e) => setInfrastructure({...infrastructure, wifiSSID: e.target.value})}
                        placeholder="e.g. Guest_Network_5G"
                        className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-stone-900 font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Password</label>
                      <input
                        type="text"
                        value={infrastructure.wifiPassword || ''}
                        onChange={(e) => setInfrastructure({...infrastructure, wifiPassword: e.target.value})}
                        placeholder="e.g. stay1234"
                        className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-stone-900 font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-serif font-bold text-stone-900 flex items-center gap-2">
              <User className="w-6 h-6 text-emerald-600" />
              Property Crew
            </h2>
            <p className="text-stone-500 mt-1 max-w-2xl">
              Add your caretaker, boat captain, or chef. Guests will receive their direct contact details upon booking confirmation.
            </p>
          </div>
          <button
            onClick={addCrew}
            className="flex items-center gap-2 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white font-semibold rounded-xl transition"
          >
            <Plus className="w-4 h-4" /> Add Crew
          </button>
        </div>

        {crew.length === 0 ? (
          <div className="bg-stone-50 border-2 border-dashed border-stone-200 rounded-2xl p-12 text-center">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mx-auto mb-4">
              <User className="w-8 h-8 text-stone-400" />
            </div>
            <h3 className="font-serif font-bold text-lg text-stone-900 mb-1">No crew members yet</h3>
            <p className="text-stone-500">Help guests coordinate their arrival by adding your local team.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {crew.map((c) => (
              <div key={c.id} className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm relative group">
                <button
                  onClick={() => removeCrew(c.id)}
                  className="absolute top-4 right-4 p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Name</label>
                      <input
                        type="text"
                        value={c.name}
                        onChange={(e) => updateCrew(c.id, { name: e.target.value })}
                        placeholder="e.g. John Banda"
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Role</label>
                      <input
                        type="text"
                        value={c.role}
                        onChange={(e) => updateCrew(c.id, { role: e.target.value })}
                        placeholder="e.g. Caretaker"
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={c.phone}
                      onChange={(e) => updateCrew(c.id, { phone: e.target.value })}
                      placeholder="+265..."
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-6 border-t border-stone-100">
        <div className="mb-6">
          <h2 className="text-2xl font-serif font-bold text-stone-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-emerald-600" />
            Daily Board
          </h2>
          <p className="text-stone-500 mt-1 max-w-2xl">
            Update this board daily to welcome guests with today's activities, the dish of the day, or important notes.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-stone-900 mb-2">Today's Activities</label>
            <textarea
              value={dailyBoard.activities || ''}
              onChange={(e) => setDailyBoard({...dailyBoard, activities: e.target.value})}
              placeholder="e.g. 10:00 AM - Snorkeling trip to the islands..."
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none min-h-[100px]"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-900 mb-2">Dish of the Day</label>
            <input
              type="text"
              value={dailyBoard.dishOfTheDay || ''}
              onChange={(e) => setDailyBoard({...dailyBoard, dishOfTheDay: e.target.value})}
              placeholder="e.g. Freshly caught Chambo with Nsima"
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-900 mb-2">Important Notes</label>
            <textarea
              value={dailyBoard.notes || ''}
              onChange={(e) => setDailyBoard({...dailyBoard, notes: e.target.value})}
              placeholder="e.g. The pool is closed for cleaning until noon."
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none min-h-[100px]"
            />
          </div>
        </div>
      </div>

      
      <div className="sticky bottom-0 py-4 bg-white/95 backdrop-blur-md border-t border-stone-200 flex items-center justify-between gap-4 rounded-b-2xl mt-8 px-6 -mx-6 mb-[-3rem] z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <p className="text-sm font-medium text-stone-500">
          {isDirty ? <span className="text-amber-600 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Unsaved changes</span> : 'Everything is saved'}
        </p>
        <div className="flex items-center gap-3">
          {isDirty && (
            <button
              onClick={() => {
                setInfrastructure(initialInfrastructure);
                setCrew(initialCrew);
                setDailyBoard(initialDailyBoard);
              }}
              className="px-4 py-2 text-stone-500 hover:text-stone-900 font-semibold transition"
            >
              Discard
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <CheckCircle2 className="w-5 h-5 animate-pulse" /> : <Save className="w-5 h-5" />}
            {saving ? 'Saving...' : 'Save details'}
          </button>
        </div>
      </div>
      
      <ConfirmDialog 
        isOpen={blocker.state === 'blocked'} 
        title="Unsaved Changes" 
        message="You have unsaved changes to your Stay OS settings. Are you sure you want to leave this page and discard them?"
        confirmText="Discard and Leave"
        cancelText="Stay on Page"
        isDestructive={true}
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </div>
  );
}
