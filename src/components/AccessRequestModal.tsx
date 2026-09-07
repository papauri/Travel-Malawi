import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Mic, Video, X, Check, Locate, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { MALAWI_HUBS, MalawiHub, searchMalawiPlaces, MalawiPlaceSuggestion, LatLng } from '../lib/geo';

const STORAGE_KEY = 'tm_permissions_prefs';
export const MANUAL_LOCATION_STORAGE_KEY = 'tm_manual_user_location';

export interface PermissionsPreferences {
  location: boolean;
  microphone: boolean;
  camera: boolean;
}

export interface UserLocationEventDetail {
  coords: LatLng;
  label: string;
  isManual?: boolean;
}

export function openAccessPermissionsModal(tab: 'location' | 'permissions' = 'location') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('open-access-permissions-modal', { detail: { tab } }));
  }
}

export function openLocationSettingsModal() {
  openAccessPermissionsModal('location');
}

export default function AccessRequestModal() {
  const [isOpen, setIsOpen] = useState(false);
  useBodyScrollLock(isOpen);

  const [activeTab, setActiveTab] = useState<'location' | 'permissions'>('location');
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);

  const [isDetectingGPS, setIsDetectingGPS] = useState(false);

  // Manual search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [placeSuggestions, setPlaceSuggestions] = useState<MalawiPlaceSuggestion[]>([]);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Active selected location label
  const [activeLocationLabel, setActiveLocationLabel] = useState<string | null>(null);

  useEffect(() => {
    // Read saved permissions preferences
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setLocationEnabled(parsed.location ?? true);
        setMicrophoneEnabled(parsed.microphone ?? true);
        setCameraEnabled(parsed.camera ?? true);
      }
    } catch {
      // ignore
    }

    // Read active manual location if stored
    try {
      const savedLoc = localStorage.getItem(MANUAL_LOCATION_STORAGE_KEY);
      if (savedLoc) {
        const parsed = JSON.parse(savedLoc);
        if (parsed?.label) {
          setActiveLocationLabel(parsed.label);
        }
      }
    } catch {
      // ignore
    }

    const handleOpen = (e: Event) => {
      const customEvent = e as CustomEvent<{ tab?: 'location' | 'permissions' }>;
      if (customEvent.detail?.tab) {
        setActiveTab(customEvent.detail.tab);
      } else {
        setActiveTab('location');
      }
      setIsOpen(true);
    };

    const handleLocationUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<UserLocationEventDetail>;
      if (customEvent.detail?.label) {
        setActiveLocationLabel(customEvent.detail.label);
      }
    };

    const handleLocationCleared = () => {
      setActiveLocationLabel(null);
    };

    window.addEventListener('open-access-permissions-modal', handleOpen);
    window.addEventListener('user-location-changed', handleLocationUpdated as EventListener);
    window.addEventListener('user-location-cleared', handleLocationCleared);

    return () => {
      window.removeEventListener('open-access-permissions-modal', handleOpen);
      window.removeEventListener('user-location-changed', handleLocationUpdated as EventListener);
      window.removeEventListener('user-location-cleared', handleLocationCleared);
    };
  }, []);

  // Debounced search for Malawi places
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (text.trim().length < 2) {
      setPlaceSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchMalawiPlaces(text.trim(), 5);
        setPlaceSuggestions(results);
      } catch {
        setPlaceSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 280);
  };

  const handleSelectLocation = (coords: LatLng, label: string, isManual = true) => {
    setActiveLocationLabel(label);
    try {
      localStorage.setItem(
        MANUAL_LOCATION_STORAGE_KEY,
        JSON.stringify({ coords, label, isManual, updatedAt: Date.now() })
      );
    } catch {
      // ignore
    }

    window.dispatchEvent(
      new CustomEvent<UserLocationEventDetail>('user-location-changed', {
        detail: { coords, label, isManual }
      })
    );

    toast.success(`Location set to ${label}`, { id: 'loc-toast' });
    setIsOpen(false);
  };

  const handleDetectGPS = () => {
    if (!('geolocation' in navigator)) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }

    setIsDetectingGPS(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsDetectingGPS(false);
        const coords: LatLng = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        handleSelectLocation(coords, 'Live GPS', false);
      },
      (err) => {
        setIsDetectingGPS(false);
        if (err.code === 1) {
          toast.error('Location permission was denied in browser settings. You can pick a city below.');
        } else {
          toast.error('Could not get device GPS. You can pick a city below.');
        }
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  };

  const handleClearLocation = () => {
    try {
      localStorage.removeItem(MANUAL_LOCATION_STORAGE_KEY);
    } catch {
      // ignore
    }
    setActiveLocationLabel(null);
    window.dispatchEvent(new CustomEvent('user-location-cleared'));
    toast.success('Location reset');
  };

  const handleSavePreferences = () => {
    const prefs: PermissionsPreferences = {
      location: locationEnabled,
      microphone: microphoneEnabled,
      camera: cameraEnabled,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // ignore
    }

    if (locationEnabled && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {},
        () => {},
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
      );
    }

    toast.success('Preferences saved');
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15 }}
            id="access-request-dialog"
            className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden z-10 flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="px-5 pt-4 pb-3 border-b border-stone-100 flex items-center justify-between shrink-0 bg-white">
              <div>
                <h3 className="text-base font-semibold text-stone-900">
                  Location &amp; Permissions
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Set your starting point or manage device permissions
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition cursor-pointer shrink-0"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Segmented Pill Tabs */}
            <div className="px-5 pt-3 shrink-0 bg-white">
              <div className="flex bg-stone-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab('location')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'location'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Starting Location
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('permissions')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'permissions'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Device Permissions
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs text-stone-700 flex-1">
              {activeTab === 'location' ? (
                <>
                  {/* One-Click Use Device GPS Button */}
                  <button
                    type="button"
                    onClick={handleDetectGPS}
                    disabled={isDetectingGPS}
                    className="w-full py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60 shadow-xs"
                  >
                    <Locate className={`w-4 h-4 shrink-0 ${isDetectingGPS ? 'animate-spin' : ''}`} />
                    <span>{isDetectingGPS ? 'Detecting Device GPS...' : 'Use Device GPS'}</span>
                  </button>

                  {/* Active Location Indicator (if set) */}
                  {activeLocationLabel && (
                    <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-stone-800 min-w-0">
                        <MapPin className="w-3.5 h-3.5 text-stone-600 shrink-0" />
                        <span className="truncate">Active: <strong>{activeLocationLabel}</strong></span>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearLocation}
                        className="text-[11px] font-medium text-stone-500 hover:text-stone-900 underline ml-2 shrink-0 cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  )}

                  {/* Malawi Travel Hubs Grid */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 block">
                      Malawi Travel Hubs
                    </span>

                    <div className="grid grid-cols-2 gap-2">
                      {MALAWI_HUBS.map((hub: MalawiHub, hubIdx: number) => {
                        const isSelected = activeLocationLabel === hub.name;
                        return (
                          <button
                            key={`${hub.id || 'hub'}-${hubIdx}`}
                            type="button"
                            onClick={() => handleSelectLocation(hub.coords, hub.name, true)}
                            className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-center min-h-[56px] ${
                              isSelected
                                ? 'bg-stone-100 border-stone-900 ring-1 ring-stone-900 text-stone-900'
                                : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-800'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="font-semibold text-stone-900 text-xs truncate">
                                {hub.name}
                              </span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-stone-900 shrink-0 ml-1" />}
                            </div>
                            <span className="text-[11px] text-stone-500 truncate mt-0.5">
                              {hub.region}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Search Any Town / District in Malawi */}
                  <div className="space-y-2 pt-2 border-t border-stone-100">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 block">
                      Search Any Place in Malawi
                    </span>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                        {isSearching ? (
                          <div className="w-3.5 h-3.5 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin" />
                        ) : (
                          <Search className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="e.g. Kasungu, Mulanje, Dedza, Karonga..."
                        className="w-full pl-8 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 focus:bg-white transition"
                      />
                    </div>

                    {/* Search Suggestions */}
                    {placeSuggestions.length > 0 && (
                      <div className="border border-stone-200 rounded-xl overflow-hidden bg-white shadow-xs divide-y divide-stone-100">
                        {placeSuggestions.map((place, pIdx) => (
                          <button
                            key={`${place.id || 'place'}-${pIdx}`}
                            type="button"
                            onClick={() => handleSelectLocation(place.coordinates, place.name, true)}
                            className="w-full text-left p-2.5 hover:bg-stone-50 transition flex items-center justify-between gap-2 cursor-pointer"
                          >
                            <div className="min-w-0">
                              <span className="font-semibold text-stone-900 block truncate text-xs">
                                {place.name}
                              </span>
                              <span className="text-[10px] text-stone-500 block truncate">
                                {place.location}
                              </span>
                            </div>
                            <span className="text-[10px] font-semibold text-stone-800 bg-stone-100 px-2 py-0.5 rounded-md shrink-0">
                              Select
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Permissions Tab - Simple Default Permissions */
                <div className="space-y-3">
                  {/* Location Toggle */}
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-stone-50 border border-stone-200">
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-stone-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium text-stone-900">Geographic Location</div>
                        <p className="text-stone-500 text-[11px] mt-0.5">Calculate driving distance and estimated travel times.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={locationEnabled}
                      onClick={() => setLocationEnabled(!locationEnabled)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                        locationEnabled ? 'bg-stone-900' : 'bg-stone-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 mt-0.5 ml-0.5 ${
                          locationEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Microphone Toggle */}
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-stone-50 border border-stone-200">
                    <div className="flex items-start gap-2.5">
                      <Mic className="w-4 h-4 text-stone-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium text-stone-900">Microphone</div>
                        <p className="text-stone-500 text-[11px] mt-0.5">Voice messages and inquiries with property hosts.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={microphoneEnabled}
                      onClick={() => setMicrophoneEnabled(!microphoneEnabled)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                        microphoneEnabled ? 'bg-stone-900' : 'bg-stone-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 mt-0.5 ml-0.5 ${
                          microphoneEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Camera Toggle */}
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-stone-50 border border-stone-200">
                    <div className="flex items-start gap-2.5">
                      <Video className="w-4 h-4 text-stone-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium text-stone-900">Camera</div>
                        <p className="text-stone-500 text-[11px] mt-0.5">Optional video preview for lodge facilities and rooms.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={cameraEnabled}
                      onClick={() => setCameraEnabled(!cameraEnabled)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                        cameraEnabled ? 'bg-stone-900' : 'bg-stone-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 mt-0.5 ml-0.5 ${
                          cameraEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-stone-50 border-t border-stone-100 flex items-center justify-between text-xs shrink-0">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 font-medium text-stone-500 hover:text-stone-900 transition cursor-pointer"
              >
                Close
              </button>

              {activeTab === 'permissions' ? (
                <button
                  type="button"
                  onClick={handleSavePreferences}
                  className="px-4 py-1.5 font-semibold bg-stone-900 hover:bg-stone-800 text-white rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Preferences</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-1.5 font-semibold bg-stone-900 hover:bg-stone-800 text-white rounded-xl transition cursor-pointer shadow-xs"
                >
                  Done
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
