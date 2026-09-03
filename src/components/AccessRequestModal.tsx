import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Mic, Video, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

const STORAGE_KEY = 'tm_permissions_prefs';

export interface PermissionsPreferences {
  location: boolean;
  microphone: boolean;
  camera: boolean;
}

export function openAccessPermissionsModal() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('open-access-permissions-modal'));
  }
}

export default function AccessRequestModal() {
  const [isOpen, setIsOpen] = useState(false);
  useBodyScrollLock(isOpen);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);

  const [geoState, setGeoState] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');

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

    if (typeof navigator !== 'undefined' && navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName })
        .then(res => {
          setGeoState(res.state);
          res.onchange = () => setGeoState(res.state);
        })
        .catch(() => {});
    }

    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-access-permissions-modal', handleOpen);
    return () => window.removeEventListener('open-access-permissions-modal', handleOpen);
  }, []);

  const handleSave = () => {
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

    setIsOpen(false);

    if (locationEnabled && navigator.geolocation && geoState !== 'granted') {
      navigator.geolocation.getCurrentPosition(
        () => {
          setGeoState('granted');
          toast.success('Location enabled for nearby stays.', { id: 'perm' });
        },
        () => {
          setGeoState('denied');
        },
        { timeout: 8000, maximumAge: 60000 }
      );
    } else {
      toast.success('Preferences saved.', { id: 'perm' });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
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
            className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-stone-100">
              <div>
                <h3 className="text-base font-semibold text-stone-900">Permissions</h3>
                <p className="text-xs text-stone-500">Used only on your explicit request.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            <div className="p-5 space-y-4 text-xs">
              {/* Location */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-stone-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-stone-900">Geographic location</div>
                    <p className="text-stone-500 text-[11px] mt-0.5">Find nearby stays and calculate driving distance.</p>
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

              {/* Microphone */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Mic className="w-4 h-4 text-stone-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-stone-900">Microphone</div>
                    <p className="text-stone-500 text-[11px] mt-0.5">Direct voice calls with property hosts in chat.</p>
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

              {/* Camera */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Video className="w-4 h-4 text-stone-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-stone-900">Camera</div>
                    <p className="text-stone-500 text-[11px] mt-0.5">Optional video calls to preview lodge facilities.</p>
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

            {/* Actions */}
            <div className="px-5 py-3 bg-stone-50 border-t border-stone-100 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-200/50 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-1.5 font-medium bg-stone-900 text-white hover:bg-stone-800 rounded-lg transition cursor-pointer flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                Apply
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
