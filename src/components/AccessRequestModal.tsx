import React, { useState, useEffect } from 'react';
import { MapPin, Mic, Video, Check, Locate, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from './Modal';
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

export const DEFAULT_HUB: MalawiHub = MALAWI_HUBS[0]; // Lilongwe

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
          const matched = MALAWI_HUBS.find(
            (h) =>
              h.name.toLowerCase() === parsed.label.toLowerCase() ||
              parsed.label.toLowerCase().includes(h.name.toLowerCase())
          );
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
        const hub = MALAWI_HUBS.find((h) => h.id === selectedHubId) || DEFAULT_HUB;
        toast(`Location access unavailable. Using ${hub.name} as default.`, {
          icon: '📍',
        });
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
    );
  };

  const handleResetToDefaults = () => {
    setLocationEnabled(true);
    setMicrophoneEnabled(true);
    setCameraEnabled(true);
    setSelectedHubId(DEFAULT_HUB.id);
    setIsGPSActive(false);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PERMISSIONS));
      localStorage.setItem(
        MANUAL_LOCATION_STORAGE_KEY,
        JSON.stringify({
          coords: DEFAULT_HUB.coords,
          label: DEFAULT_HUB.name,
          isManual: true,
          updatedAt: Date.now(),
        })
      );
    } catch {
      // ignore
    }

    window.dispatchEvent(
      new CustomEvent<UserLocationEventDetail>('user-location-changed', {
        detail: {
          coords: DEFAULT_HUB.coords,
          label: `${DEFAULT_HUB.name} (Default)`,
          isManual: true,
        },
      })
    );

    toast.success(`Reset to default settings (${DEFAULT_HUB.name})`);
    setIsOpen(false);
  };

  const handleApply = () => {
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

    if (!isGPSActive) {
      const hub = MALAWI_HUBS.find((h) => h.id === selectedHubId) || DEFAULT_HUB;
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

    toast.success('Preferences updated');
    setIsOpen(false);
  };

  const footer = (
    <div className="flex items-center justify-between gap-3 text-xs">
      <button
        type="button"
        onClick={handleResetToDefaults}
        className="inline-flex items-center gap-1.5 text-stone-500 hover:text-stone-800 font-medium transition cursor-pointer"
        title="Restore defaults"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>Reset Defaults</span>
      </button>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="px-3 py-1.5 font-medium text-stone-500 hover:text-stone-800 transition cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="px-4 py-2 font-semibold bg-stone-900 hover:bg-stone-800 text-white rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Apply</span>
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      open={isOpen}
      onClose={() => setIsOpen(false)}
      title="Permissions & Location"
      description="Manage device access and your default starting point."
      size="sm"
      footer={footer}
    >
      <div className="space-y-4 text-xs text-stone-700">
        {/* Starting Hub Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Starting Location
            </span>
            <button
              type="button"
              onClick={handleUseDeviceGPS}
              disabled={isLocatingGPS}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200/80 px-2 py-0.5 rounded-md transition cursor-pointer disabled:opacity-50"
            >
              <Locate className={`w-3 h-3 ${isLocatingGPS ? 'animate-spin' : ''}`} />
              <span>{isLocatingGPS ? 'Locating...' : 'Use Device GPS'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
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
                  className={`p-2 rounded-xl border text-left transition cursor-pointer flex flex-col justify-center min-h-[48px] ${
                    isSelected
                      ? 'bg-stone-900 border-stone-900 text-white shadow-xs'
                      : 'bg-stone-50/70 hover:bg-stone-100 border-stone-200/80 text-stone-800'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`font-semibold text-xs truncate ${isSelected ? 'text-white' : 'text-stone-900'}`}>
                      {hub.name}
                    </span>
                    {isSelected && <Check className="w-3 h-3 text-white shrink-0 ml-1" />}
                  </div>
                  <span className={`text-[10px] truncate mt-0.5 ${isSelected ? 'text-stone-300' : 'text-stone-500'}`}>
                    {hub.region}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Device Permissions Section */}
        <div className="space-y-2 pt-3 border-t border-stone-100">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 block">
            Device Permissions
          </span>

          <div className="space-y-2">
            {/* Location Toggle */}
            <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-stone-50/70 border border-stone-200/80">
              <div className="flex items-start gap-2 min-w-0">
                <MapPin className="w-3.5 h-3.5 text-stone-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="font-medium text-stone-900 text-xs">Geographic Location</div>
                  <p className="text-stone-500 text-[10px] truncate mt-0.5">Calculates driving distance and travel times.</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={locationEnabled}
                onClick={() => setLocationEnabled(!locationEnabled)}
                className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                  locationEnabled ? 'bg-stone-900' : 'bg-stone-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition duration-200 mt-0.5 ml-0.5 ${
                    locationEnabled ? 'translate-x-3.5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Microphone Toggle */}
            <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-stone-50/70 border border-stone-200/80">
              <div className="flex items-start gap-2 min-w-0">
                <Mic className="w-3.5 h-3.5 text-stone-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="font-medium text-stone-900 text-xs">Microphone</div>
                  <p className="text-stone-500 text-[10px] truncate mt-0.5">Voice messages and inquiries with hosts.</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={microphoneEnabled}
                onClick={() => setMicrophoneEnabled(!microphoneEnabled)}
                className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                  microphoneEnabled ? 'bg-stone-900' : 'bg-stone-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition duration-200 mt-0.5 ml-0.5 ${
                    microphoneEnabled ? 'translate-x-3.5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Camera Toggle */}
            <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-stone-50/70 border border-stone-200/80">
              <div className="flex items-start gap-2 min-w-0">
                <Video className="w-3.5 h-3.5 text-stone-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="font-medium text-stone-900 text-xs">Camera</div>
                  <p className="text-stone-500 text-[10px] truncate mt-0.5">Optional video previews for lodge rooms.</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={cameraEnabled}
                onClick={() => setCameraEnabled(!cameraEnabled)}
                className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                  cameraEnabled ? 'bg-stone-900' : 'bg-stone-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition duration-200 mt-0.5 ml-0.5 ${
                    cameraEnabled ? 'translate-x-3.5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
