import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, Mic, Video, X, Check, Locate, AlertCircle, 
  Search, RefreshCw, Navigation, ShieldAlert, CheckCircle2
} from 'lucide-react';
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

  const [geoState, setGeoState] = useState<'granted' | 'denied' | 'prompt' | 'unsupported' | 'unknown'>('unknown');
  const [isRetryingGPS, setIsRetryingGPS] = useState(false);
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);

  // Manual search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [placeSuggestions, setPlaceSuggestions] = useState<MalawiPlaceSuggestion[]>([]);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Active selected location info
  const [activeLocationLabel, setActiveLocationLabel] = useState<string | null>(null);

  useEffect(() => {
    // Read saved preferences
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

    checkPermissionStatus();

    const handleOpen = (e: Event) => {
      const customEvent = e as CustomEvent<{ tab?: 'location' | 'permissions' }>;
      if (customEvent.detail?.tab) {
        setActiveTab(customEvent.detail.tab);
      } else {
        setActiveTab('location');
      }
      setIsOpen(true);
      checkPermissionStatus();
    };

    window.addEventListener('open-access-permissions-modal', handleOpen);
    return () => window.removeEventListener('open-access-permissions-modal', handleOpen);
  }, []);

  const checkPermissionStatus = () => {
    if (typeof window === 'undefined') return;

    if (!navigator.geolocation) {
      setGeoState('unsupported');
      return;
    }

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName })
        .then(res => {
          setGeoState(res.state as any);
          res.onchange = () => {
            setGeoState(res.state as any);
            if (res.state === 'granted') {
              setGpsErrorMsg(null);
            }
          };
        })
        .catch(() => {
          setGeoState('prompt');
        });
    } else {
      setGeoState('prompt');
    }
  };

  // Debounced search for Malawi places
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (text.trim().length < 2) {
      setPlaceSuggestions([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchMalawiPlaces(text.trim(), 5);
        setPlaceSuggestions(results);
      } catch {
        setPlaceSuggestions([]);
      } finally {
        setSearching(false);
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

    // Broadcast update to Home page and map
    window.dispatchEvent(
      new CustomEvent<UserLocationEventDetail>('user-location-changed', {
        detail: { coords, label, isManual }
      })
    );

    toast.success(`Location set to ${label}! Travel times updated.`, { id: 'loc-toast' });
    setIsOpen(false);
  };

  const handleRetryGPS = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }

    setIsRetryingGPS(true);
    setGpsErrorMsg(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsRetryingGPS(false);
        setGeoState('granted');
        const coords: LatLng = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        handleSelectLocation(coords, 'Current GPS Location', false);
      },
      (err) => {
        setIsRetryingGPS(false);
        if (err.code === 1) {
          setGeoState('denied');
          setGpsErrorMsg('Permission was denied. Please allow location in your browser URL address bar.');
        } else if (err.code === 3) {
          setGpsErrorMsg('Location request timed out. Please try again or select a city below.');
        } else {
          setGpsErrorMsg(err.message || 'Could not acquire GPS fix. Please choose a city below.');
        }
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 30000 }
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
    toast.success('Location pin cleared.');
    setIsOpen(false);
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
    toast.success('Preferences saved.');
    setIsOpen(false);
  };

  const isSecure = typeof window !== 'undefined' ? (window.isSecureContext || window.location.hostname === 'localhost') : true;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.16 }}
            id="access-request-dialog"
            className="relative w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-stone-200 overflow-hidden z-10 flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="px-5 pt-5 pb-3 border-b border-stone-100 flex items-center justify-between shrink-0 bg-stone-50/70">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-xl bg-emerald-100 text-emerald-800">
                    <MapPin className="w-4 h-4" />
                  </span>
                  <h3 className="text-base sm:text-lg font-serif font-bold text-stone-900">
                    Location &amp; Travel Measurement
                  </h3>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Calculate real driving distance, estimated travel time, and route directions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Segmented Tabs */}
            <div className="px-5 pt-3 pb-1 border-b border-stone-100 flex gap-2 shrink-0 bg-white">
              <button
                type="button"
                onClick={() => setActiveTab('location')}
                className={`pb-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'location'
                    ? 'border-emerald-700 text-emerald-800'
                    : 'border-transparent text-stone-400 hover:text-stone-700'
                }`}
              >
                <Locate className="w-3.5 h-3.5" />
                <span>Choose Location / City</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('permissions')}
                className={`pb-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'permissions'
                    ? 'border-emerald-700 text-emerald-800'
                    : 'border-transparent text-stone-400 hover:text-stone-700'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Device Permissions</span>
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs text-stone-700 flex-1">
              {activeTab === 'location' ? (
                <>
                  {/* Status Banner: Browser Geolocation Diagnostic */}
                  {!isSecure ? (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                      <div className="flex items-center gap-2 font-bold text-xs">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Insecure Connection (HTTP)</span>
                      </div>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        Modern web browsers require HTTPS for live device GPS. You can pick any Malawian city or town below to immediately calculate distances!
                      </p>
                    </div>
                  ) : geoState === 'denied' || gpsErrorMsg ? (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-xs">
                          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>Browser Location Access is Blocked</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleRetryGPS}
                          disabled={isRetryingGPS}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-lg text-[11px] font-bold shadow-2xs transition"
                        >
                          <RefreshCw className={`w-3 h-3 ${isRetryingGPS ? 'animate-spin' : ''}`} />
                          <span>{isRetryingGPS ? 'Checking...' : 'Retry GPS'}</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-rose-800 leading-relaxed">
                        To enable live GPS: click the 🔒 lock or 🎛️ tune icon next to the URL bar &rarr; set <strong>Location</strong> to <strong>Allow</strong> &rarr; then tap Retry.
                      </p>
                      <p className="text-[11px] font-medium text-rose-900">
                        ✨ <strong>No problem!</strong> You don&apos;t need GPS—simply choose your city hub below:
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-900">
                        <Navigation className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-xs font-semibold">
                          {activeLocationLabel ? `Active Location: ${activeLocationLabel}` : 'Use live device GPS or select your starting hub'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRetryGPS}
                        disabled={isRetryingGPS}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                      >
                        <Locate className={`w-3.5 h-3.5 ${isRetryingGPS ? 'animate-spin' : ''}`} />
                        <span>{isRetryingGPS ? 'Detecting...' : 'Use Device GPS'}</span>
                      </button>
                    </div>
                  )}

                  {/* 1-Click Popular Malawi Travel Hubs */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                        Choose Starting Hub in Malawi
                      </span>
                      {activeLocationLabel && (
                        <button
                          type="button"
                          onClick={handleClearLocation}
                          className="text-[11px] font-medium text-stone-400 hover:text-stone-700 underline"
                        >
                          Clear custom pin
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 sm:gap-2.5">
                      {MALAWI_HUBS.map((hub: MalawiHub) => {
                        const isSelected = activeLocationLabel === hub.name;
                        return (
                          <button
                            key={hub.id}
                            type="button"
                            onClick={() => handleSelectLocation(hub.coords, hub.name, true)}
                            className={`p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer flex items-start gap-2.5 ${
                              isSelected
                                ? 'bg-emerald-50/80 border-emerald-600 ring-2 ring-emerald-500/20 shadow-xs'
                                : 'bg-stone-50/70 hover:bg-stone-100/90 border-stone-200/90 hover:border-stone-300'
                            }`}
                          >
                            <span className="text-xl shrink-0 mt-0.5">{hub.icon}</span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-stone-900 text-xs sm:text-sm truncate">
                                  {hub.name}
                                </span>
                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />}
                              </div>
                              <p className="text-[11px] text-stone-500 truncate mt-0.5">
                                {hub.description}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Town Search in Malawi */}
                  <div className="space-y-2 pt-2 border-t border-stone-100">
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-500 block">
                      Or Search Any Area in Malawi
                    </span>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                        {searching ? (
                          <div className="w-3.5 h-3.5 border-2 border-stone-400 border-t-emerald-600 rounded-full animate-spin" />
                        ) : (
                          <Search className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="e.g. Kasungu, Mulanje, Dedza, Monkey Bay..."
                        className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                      />
                    </div>

                    {/* Suggestions Dropdown */}
                    {placeSuggestions.length > 0 && (
                      <div className="border border-stone-200 rounded-xl overflow-hidden bg-white shadow-md divide-y divide-stone-100">
                        {placeSuggestions.map((place) => (
                          <button
                            key={place.id}
                            type="button"
                            onClick={() => handleSelectLocation(place.coordinates, place.name, true)}
                            className="w-full text-left p-2.5 hover:bg-stone-50 transition flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <span className="font-semibold text-stone-900 block truncate text-xs">
                                {place.name}
                              </span>
                              <span className="text-[10px] text-stone-500 block truncate">
                                {place.location}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                              Select
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Permissions Tab */
                <div className="space-y-4">
                  {/* Location Toggle */}
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-stone-50 border border-stone-200/80">
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-stone-900">Geographic Location</div>
                        <p className="text-stone-500 text-[11px] mt-0.5">Calculate driving distance and estimated travel times.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={locationEnabled}
                      onClick={() => setLocationEnabled(!locationEnabled)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                        locationEnabled ? 'bg-emerald-700' : 'bg-stone-300'
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
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-stone-50 border border-stone-200/80">
                    <div className="flex items-start gap-2.5">
                      <Mic className="w-4 h-4 text-stone-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-stone-900">Microphone</div>
                        <p className="text-stone-500 text-[11px] mt-0.5">Voice messages and inquiries with property hosts.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={microphoneEnabled}
                      onClick={() => setMicrophoneEnabled(!microphoneEnabled)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                        microphoneEnabled ? 'bg-stone-900' : 'bg-stone-300'
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
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-stone-50 border border-stone-200/80">
                    <div className="flex items-start gap-2.5">
                      <Video className="w-4 h-4 text-stone-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-stone-900">Camera</div>
                        <p className="text-stone-500 text-[11px] mt-0.5">Optional video verification for lodge tours and room previews.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={cameraEnabled}
                      onClick={() => setCameraEnabled(!cameraEnabled)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                        cameraEnabled ? 'bg-stone-900' : 'bg-stone-300'
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
            <div className="px-5 py-3.5 bg-stone-50 border-t border-stone-100 flex items-center justify-between gap-2 text-xs shrink-0">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3.5 py-2 font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 rounded-xl transition cursor-pointer"
              >
                Close
              </button>

              {activeTab === 'permissions' ? (
                <button
                  type="button"
                  onClick={handleSavePreferences}
                  className="px-4 py-2 font-semibold bg-stone-900 hover:bg-stone-800 text-white rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Preferences</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 font-semibold bg-stone-900 hover:bg-stone-800 text-white rounded-xl transition cursor-pointer shadow-2xs"
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
