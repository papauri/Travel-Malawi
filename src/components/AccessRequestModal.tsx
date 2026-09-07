import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Mic, Video, X, Check, Locate, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { MALAWI_HUBS, MalawiHub, LatLng } from '../lib/geo';

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

export const DEFAULT_PERMISSIONS: PermissionsPreferences = {
  location: true,
  microphone: true,
  camera: true,
};

export const DEFAULT_HUB: MalawiHub = MALAWI_HUBS[0]; // Lilongwe (Capital & Central)

export function openAccessPermissionsModal(_tab?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('open-access-permissions-modal'));
  }
}

export function openLocationSettingsModal() {
  openAccessPermissionsModal();
}

export default function AccessRequestModal() {
  const [isOpen, setIsOpen] = useState(false);
  useBodyScrollLock(isOpen);

  // Permission states - default to true
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);

  // Location selection state - default to Lilongwe
  const [selectedHubId, setSelectedHubId] = useState<string>(DEFAULT_HUB.id);
  const [isLocatingGPS, setIsLocatingGPS] = useState(false);
  const [isGPSActive, setIsGPSActive] = useState(false);

  useEffect(() => {
    // Load stored permissions or default to true
    try {
      const savedPrefs = localStorage.getItem(STORAGE_KEY);
      if (savedPrefs) {
        const parsed = JSON.parse(savedPrefs);
        setLocationEnabled(parsed.location ?? true);
        setMicrophoneEnabled(parsed.microphone ?? true);
        setCameraEnabled(parsed.camera ?? true);
      }
    } catch {
      // ignore
    }

    // Load stored default location
    try {
      const savedLoc = localStorage.getItem(MANUAL_LOCATION_STORAGE_KEY);
      if (savedLoc) {
        const parsed = JSON.parse(savedLoc);
        if (parsed?.label) {
          const matched = MALAWI_HUBS.find(h => h.name.toLowerCase() === parsed.label.toLowerCase() || parsed.label.toLowerCase().includes(h.name.toLowerCase()));
          if (matched) {
            setSelectedHubId(matched.id);
          }
          if (parsed.label === 'Live GPS') {
            setIsGPSActive(true);
          }
        }
      }
    } catch {
      // ignore
    }

    const handleOpen = () => {
      setIsOpen(true);
    };

    window.addEventListener('open-access-permissions-modal', handleOpen);
    return () => window.removeEventListener('open-access-permissions-modal', handleOpen);
  }, []);

  const handleUseDeviceGPS = () => {
    if (!('geolocation' in navigator)) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocatingGPS(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingGPS(false);
        setIsGPSActive(true);
        const coords: LatLng = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };

        try {
          localStorage.setItem(
            MANUAL_LOCATION_STORAGE_KEY,
            JSON.stringify({ coords, label: 'Live GPS', isManual: false, updatedAt: Date.now() })
          );
        } catch {
          // ignore
        }

        window.dispatchEvent(
          new CustomEvent<UserLocationEventDetail>('user-location-changed', {
            detail: { coords, label: 'Live GPS', isManual: false },
          })
        );

        toast.success('Live GPS location activated');
        setIsOpen(false);
      },
      (err) => {
        setIsLocatingGPS(false);
        setIsGPSActive(false);
        console.warn('GPS blocked or failed:', err);
        // Fall back gracefully to the selected hub so the user is never blocked
        const hub = MALAWI_HUBS.find(h => h.id === selectedHubId) || DEFAULT_HUB;
        toast('Browser GPS blocked. Using ' + hub.name + ' as your default location.', { icon: '📍' });
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
    );
  };

  const handleResetToDefaults = () => {
    // Reset permissions to default all true
    setLocationEnabled(true);
    setMicrophoneEnabled(true);
    setCameraEnabled(true);
    setSelectedHubId(DEFAULT_HUB.id);
    setIsGPSActive(false);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PERMISSIONS));
      localStorage.setItem(
        MANUAL_LOCATION_STORAGE_KEY,
        JSON.stringify({ coords: DEFAULT_HUB.coords, label: DEFAULT_HUB.name, isManual: true, updatedAt: Date.now() })
      );
    } catch {
      // ignore
    }

    window.dispatchEvent(
      new CustomEvent<UserLocationEventDetail>('user-location-changed', {
        detail: { coords: DEFAULT_HUB.coords, label: `${DEFAULT_HUB.name} (Default)`, isManual: true },
      })
    );

    toast.success(`Reset to default permissions and location (${DEFAULT_HUB.name})`);
    setIsOpen(false);
  };

  const handleApply = () => {
    // Save permissions
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

    // If GPS wasn't explicitly selected, apply the chosen Malawi hub as the active default location
    if (!isGPSActive) {
      const hub = MALAWI_HUBS.find(h => h.id === selectedHubId) || DEFAULT_HUB;
      try {
        localStorage.setItem(
          MANUAL_LOCATION_STORAGE_KEY,
          JSON.stringify({ coords: hub.coords, label: hub.name, isManual: true, updatedAt: Date.now() })
        );
      } catch {
        // ignore
      }

      window.dispatchEvent(
        new CustomEvent<UserLocationEventDetail>('user-location-changed', {
          detail: { coords: hub.coords, label: hub.name, isManual: true },
        })
      );
    }

    toast.success('Permissions and default location updated');
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
            {/* Header */}
            <div className="px-5 pt-4 pb-3 border-b border-stone-100 flex items-center justify-between shrink-0 bg-white">
              <div>
                <h3 className="text-base font-semibold text-stone-900">
                  Permissions &amp; Default Location
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Set starting point defaults and device access
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

            {/* Scrollable Content */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs text-stone-700 flex-1">
              {/* Default Starting Location */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 block">
                    Default Starting Location
                  </span>
                  <button
                    type="button"
                    onClick={handleUseDeviceGPS}
                    disabled={isLocatingGPS}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-700 hover:text-stone-950 bg-stone-100 hover:bg-stone-200 px-2.5 py-1 rounded-lg transition cursor-pointer disabled:opacity-60"
                  >
                    <Locate className={`w-3 h-3 ${isLocatingGPS ? 'animate-spin' : ''}`} />
                    <span>{isLocatingGPS ? 'Detecting...' : 'Use Device GPS'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {MALAWI_HUBS.slice(0, 6).map((hub) => {
                    const isSelected = !isGPSActive && selectedHubId === hub.id;
                    return (
                      <button
                        key={hub.id}
                        type="button"
                        onClick={() => {
                          setSelectedHubId(hub.id);
                          setIsGPSActive(false);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-center min-h-[54px] ${
                          isSelected
                            ? 'bg-stone-900 border-stone-900 text-white shadow-xs'
                            : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-800'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className={`font-semibold text-xs truncate ${isSelected ? 'text-white' : 'text-stone-900'}`}>
                            {hub.name}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0 ml-1" />}
                        </div>
                        <span className={`text-[11px] truncate mt-0.5 ${isSelected ? 'text-stone-300' : 'text-stone-500'}`}>
                          {hub.region}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Default Permissions Section */}
              <div className="space-y-2.5 pt-3 border-t border-stone-100">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 block">
                  Device Permissions
                </span>

                <div className="space-y-2.5">
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
                        <p className="text-stone-500 text-[11px] mt-0.5">Direct voice messages and inquiries with hosts.</p>
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
                        <p className="text-stone-500 text-[11px] mt-0.5">Optional video preview for lodge facilities.</p>
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
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-stone-50 border-t border-stone-100 flex items-center justify-between text-xs shrink-0">
              <button
                type="button"
                onClick={handleResetToDefaults}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 font-medium text-stone-500 hover:text-stone-900 hover:bg-stone-200/50 rounded-lg transition cursor-pointer"
                title="Reset all permissions to enabled and default location to Lilongwe"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Defaults</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1.5 font-medium text-stone-500 hover:text-stone-900 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="px-4 py-1.5 font-semibold bg-stone-900 hover:bg-stone-800 text-white rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Apply</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
