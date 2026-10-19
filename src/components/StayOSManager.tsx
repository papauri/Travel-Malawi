import SectionCard from './SectionCard';
import React, { useEffect, useState } from 'react';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import ConfirmDialog from './ConfirmDialog';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Hotel, InfrastructureDetails, StayCrewMember, DailyBoard } from '../types';
import toast from 'react-hot-toast';
import { ShieldCheck, Zap, Droplets, Map, CheckCircle2, User, Plus, Trash2, Save, X, Wifi, Monitor, ClipboardList } from 'lucide-react';

interface StayOSManagerProps {
  hotel: Hotel;
  /** Lets the page warn before a tab switch discards unsaved edits. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Called with what was written, so the page's copy of the hotel stays current. */
  onSaved?: (patch: Pick<Hotel, 'infrastructure' | 'crew' | 'dailyBoard'>) => void;
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
          className="tm-input"
        >
          {options.map((o, oIdx) => <option key={`${o.value}-${oIdx}`} value={o.value}>{o.label}</option>)}
          <option value="__CUSTOM__">Other…</option>
        </select>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || "Type your own…"}
            className="tm-input flex-1 min-w-0"
            autoFocus
          />
          <button
            type="button"
            onClick={() => {
              setMode('select');
              onChange(options[0]?.value || '');
            }}
            className="tm-btn tm-btn-secondary shrink-0 px-2.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default function StayOSManager({ hotel, onDirtyChange, onSaved }: StayOSManagerProps) {
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

  // What is stored now. Moved forward on save so a saved form is no longer "unsaved".
  const [saved, setSaved] = useState(() => ({ infrastructure, crew, dailyBoard }));
  const initialInfrastructure = saved.infrastructure;
  const initialCrew = saved.crew;
  const initialDailyBoard = saved.dailyBoard;
  
  const isDirty = 
    JSON.stringify(infrastructure) !== JSON.stringify(initialInfrastructure) ||
    JSON.stringify(crew) !== JSON.stringify(initialCrew) ||
    JSON.stringify(dailyBoard) !== JSON.stringify(initialDailyBoard);

  const blocker = useUnsavedChanges(isDirty);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);


  const handleSave = async () => {
    setSaving(true);
    try {
      const savedBoard = { ...dailyBoard, updatedAt: Date.now() };
      await updateDoc(doc(db, 'hotels', hotel.id!), {
        infrastructure,
        crew,
        dailyBoard: savedBoard
      });
      setDailyBoard(savedBoard);
      setSaved({ infrastructure, crew, dailyBoard: savedBoard });
      onSaved?.({ infrastructure, crew, dailyBoard: savedBoard });
      toast.success('Ulendo stay settings saved');
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
    <div className="space-y-10 pb-6 min-w-0">
      <div>
        <div className="mb-6">
          <h2 className="tm-h2 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-stone-500" />
            Stay details
          </h2>
          <p className="tm-muted mt-1 max-w-2xl">
            Shown on your guests' stay vouchers.
          </p>
        </div>

        <div className="tm-panel grid grid-cols-1 md:grid-cols-3 gap-6 min-w-0">
          <div>
            <label className="tm-label flex items-center gap-2">
              <Zap className="w-4 h-4 text-stone-500" /> Power
            </label>
            <CustomSelect 
              value={infrastructure.powerSource || 'Grid'} 
              onChange={(v) => setInfrastructure({...infrastructure, powerSource: v})}
              options={[
                { value: 'Grid', label: 'National grid (ESCOM)' },
                { value: 'Solar', label: 'Full solar' },
                { value: 'Generator', label: 'Generator backup' },
                { value: 'Mixed', label: 'Mixed (Grid + Backup)' },
                { value: 'Battery Inverter', label: 'Battery inverter' },
                { value: 'Mini-grid (Community)', label: 'Mini-grid (Community)' },
                { value: 'Wind Power', label: 'Wind power' },
                { value: 'Biogas', label: 'Biogas' },
                { value: 'None', label: 'Off-grid, no power' }
              ]} 
              placeholder="e.g. Micro-hydro plant"
            />
          </div>
          <div>
            <label className="tm-label flex items-center gap-2">
              <Droplets className="w-4 h-4 text-stone-500" /> Water
            </label>
            <CustomSelect 
              value={infrastructure.waterSource || 'Water Board'} 
              onChange={(v) => setInfrastructure({...infrastructure, waterSource: v})}
              options={[
                { value: 'Water Board', label: 'Water board (city water)' },
                { value: 'Borehole', label: 'Private borehole' },
                { value: 'Lake', label: 'Pumped from the lake' },
                { value: 'Rainwater Harvesting', label: 'Rainwater harvesting' },
                { value: 'River / Stream', label: 'Pumped from a river or stream' },
                { value: 'Water Delivery', label: 'Water delivery (truck)' },
                { value: 'Other', label: 'Other / Variable' }
              ]} 
              placeholder="e.g. Natural Spring"
            />
          </div>
          <div>
            <label className="tm-label flex items-center gap-2">
              <Map className="w-4 h-4 text-stone-500" /> Road access
            </label>
            <CustomSelect 
              value={infrastructure.roadAccess || 'Tarred'} 
              onChange={(v) => setInfrastructure({...infrastructure, roadAccess: v})}
              options={[
                { value: 'Tarred', label: 'Tarred road (any vehicle)' },
                { value: 'Dirt/Gravel', label: 'Dirt / Gravel (Accessible)' },
                { value: 'High-clearance', label: 'High-clearance vehicle needed' },
                { value: '4x4 Only', label: '4x4 Required' },
                { value: 'Boat Only', label: 'Boat access only' },
                { value: 'Fly-in', label: 'Fly-in (Airstrip)' },
                { value: 'Hike-in Only', label: 'Hike-in Only' }
              ]} 
              placeholder="e.g. Helicopter pad"
            />
          </div>
          <div>
            <label className="tm-label flex items-center gap-2">
              <Wifi className="w-4 h-4 text-stone-500" /> Internet
            </label>
            <select
              value={infrastructure.internetSource}
              onChange={(e) => setInfrastructure({...infrastructure, internetSource: e.target.value as any})}
              className="tm-input"
            >
              <option value="None">None</option>
              <option value="Fiber">Fibre</option>
              <option value="Starlink">Starlink (Satellite)</option>
              <option value="4G Router">4G Router</option>
              <option value="Mobile Data Only">Mobile data only</option>
            </select>
          </div>
          <div>
            <label className="tm-label flex items-center gap-2">
              <Monitor className="w-4 h-4 text-stone-500" /> Work-from-home setup
            </label>
            <CustomSelect 
              value={infrastructure.workspaceSetup || 'None'} 
              onChange={(v) => setInfrastructure({...infrastructure, workspaceSetup: v})}
              options={[
                { value: 'None', label: 'None' },
                { value: 'Dedicated Desk', label: 'Dedicated desk' },
                { value: 'Dining Table', label: 'Dining table' },
                { value: 'Co-working Space (Shared)', label: 'Co-working Space (Shared)' },
                { value: 'Private Office Room', label: 'Private office room' },
                { value: 'Standing Desk Available', label: 'Standing desk' },
                { value: 'Ergonomic Chair Setup', label: 'Ergonomic chair' }
              ]} 
              placeholder="e.g. Balcony Table"
            />
          </div>
          
          <div className="md:col-span-3 pt-4 border-t border-stone-200 flex items-center gap-4">
            <button
              onClick={() => setInfrastructure({...infrastructure, offlineTrustBadge: !infrastructure.offlineTrustBadge})}
              className={`w-12 h-6 rounded-full transition-colors relative ${infrastructure.offlineTrustBadge ? 'bg-emerald-600' : 'bg-stone-300'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${infrastructure.offlineTrustBadge ? 'left-7' : 'left-1'}`} />
            </button>
            <div>
              <p className="font-semibold text-stone-900">Accept cash on arrival</p>
              <p className="text-sm text-stone-500">Guests get a voucher to show on arrival; no payment is taken online.</p>
            </div>
          </div>

          <div className="md:col-span-3 pt-6 border-t border-stone-200">
            <h3 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
              <Wifi className="w-4 h-4 text-stone-500" /> Guest Wi-Fi
            </h3>
            
            {hotel.adminWifiVoucherEnabled === false ? (
              <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-sm">
                An administrator has turned off Wi-Fi details on vouchers.
              </div>
            ) : (
              <div className="rounded-lg bg-stone-50 p-4">
                <div className="flex items-center gap-4 mb-4">
                  <button
                    onClick={() => setInfrastructure({...infrastructure, shareWifiVoucher: !infrastructure.shareWifiVoucher})}
                    className={`w-12 h-6 rounded-full transition-colors relative ${infrastructure.shareWifiVoucher ? 'bg-emerald-600' : 'bg-stone-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${infrastructure.shareWifiVoucher ? 'left-7' : 'left-1'}`} />
                  </button>
                  <div>
                    <p className="font-semibold text-stone-900">Show Wi-Fi details on the voucher</p>
                    <p className="text-xs text-stone-500 mt-0.5">Guests can copy them or scan a QR code on arrival.</p>
                  </div>
                </div>
                
                {infrastructure.shareWifiVoucher && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-stone-200">
                    <div>
                      <label className="tm-label">Network name</label>
                      <input
                        type="text"
                        value={infrastructure.wifiSSID || ''}
                        onChange={(e) => setInfrastructure({...infrastructure, wifiSSID: e.target.value})}
                        placeholder="e.g. Guest_Network_5G"
                        className="tm-input"
                      />
                    </div>
                    <div>
                      <label className="tm-label">Password</label>
                      <input
                        type="text"
                        value={infrastructure.wifiPassword || ''}
                        onChange={(e) => setInfrastructure({...infrastructure, wifiPassword: e.target.value})}
                        placeholder="e.g. stay1234"
                        className="tm-input"
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
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="tm-h2 flex items-center gap-2">
              <User className="w-5 h-5 text-stone-500" />
              Your team
            </h2>
            <p className="tm-muted mt-1 max-w-2xl">
              Caretaker, boat captain, chef. Guests get their contacts once a booking is confirmed.
            </p>
          </div>
          <button
            onClick={addCrew}
            className="tm-btn tm-btn-secondary shrink-0"
          >
            <Plus className="w-4 h-4" /> Add crew member
          </button>
        </div>

        {crew.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-300 p-6 text-center">
            <p className="tm-muted mb-3">No team members yet.</p>
            <button onClick={addCrew} className="tm-btn tm-btn-secondary tm-btn-sm">
              <Plus className="w-3.5 h-3.5" /> Add crew member
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {crew.map((c, cIdx) => (
              <div key={`${c.id || 'crew'}-${cIdx}`} className="tm-panel relative group min-w-0">
                <button
                  onClick={() => removeCrew(c.id)}
                  className="absolute top-3 right-3 p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pr-8">
                    <div>
                      <label className="tm-label">Name</label>
                      <input
                        type="text"
                        value={c.name}
                        onChange={(e) => updateCrew(c.id, { name: e.target.value })}
                        placeholder="e.g. John Banda"
                        className="tm-input"
                      />
                    </div>
                    <div>
                      <label className="tm-label">Role</label>
                      <input
                        type="text"
                        value={c.role}
                        onChange={(e) => updateCrew(c.id, { role: e.target.value })}
                        placeholder="e.g. Caretaker"
                        className="tm-input"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="tm-label">Phone number</label>
                    <input
                      type="tel"
                      value={c.phone}
                      onChange={(e) => updateCrew(c.id, { phone: e.target.value })}
                      placeholder="+265…"
                      className="tm-input"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-6 border-t border-stone-200">
        <div className="mb-6">
          <h2 className="tm-h2 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-stone-500" />
            Daily Board
          </h2>
          <p className="tm-muted mt-1 max-w-2xl">
            Today's activities, dish of the day and notes for guests.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="tm-label">Today's activities</label>
            <textarea
              value={dailyBoard.activities || ''}
              onChange={(e) => setDailyBoard({...dailyBoard, activities: e.target.value})}
              placeholder="e.g. 10:00 AM - Snorkeling trip to the islands…"
              className="tm-input min-h-[100px]"
            />
          </div>
          <div>
            <label className="tm-label">Dish of the day</label>
            <input
              type="text"
              value={dailyBoard.dishOfTheDay || ''}
              onChange={(e) => setDailyBoard({...dailyBoard, dishOfTheDay: e.target.value})}
              placeholder="e.g. Freshly caught Chambo with Nsima"
              className="tm-input"
            />
          </div>
          <div>
            <label className="tm-label">Notes</label>
            <textarea
              value={dailyBoard.notes || ''}
              onChange={(e) => setDailyBoard({...dailyBoard, notes: e.target.value})}
              placeholder="e.g. The pool is closed for cleaning until noon."
              className="tm-input min-h-[100px]"
            />
          </div>
        </div>
      </div>

      
      <div className="sticky bottom-0 py-3 bg-white border-t border-stone-200 tm-actions justify-between mt-8 z-20">
        <div className="text-sm text-stone-500">
          {isDirty ? <span className="text-amber-800 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500" /> Unsaved changes</span> : 'Everything is saved'}
        </div>
        <div className="tm-actions">
          {isDirty && (
            <button
              onClick={() => {
                setInfrastructure(initialInfrastructure);
                setCrew(initialCrew);
                setDailyBoard(initialDailyBoard);
              }}
              className="tm-btn tm-btn-quiet"
            >
              Discard
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="tm-btn tm-btn-primary"
          >
            {saving ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save details'}
          </button>
        </div>
      </div>
      
      <ConfirmDialog 
        isOpen={blocker.state === 'blocked'} 
        title="Unsaved changes"
        message="You have unsaved changes here. Leave and discard them?"
        confirmText="Discard and leave"
        cancelText="Stay on page"
        isDestructive={true}
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </div>
  );
}
