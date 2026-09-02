import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { Camera, MapPin, Mic, X } from 'lucide-react';

export type PermissionType = 'location' | 'camera_mic';

interface Props {
  type: PermissionType | null;
  isOpen: boolean;
  onAllow: () => void;
  onDeny: () => void;
}

export default function PermissionRequiredDialog({ type, isOpen, onAllow, onDeny }: Props) {
  return (
    <AnimatePresence>
      {isOpen && type && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-md bg-white rounded-[24px] shadow-2xl overflow-hidden"
          >
            <div className="p-6 md:p-8 relative">
              <button 
                onClick={onDeny}
                className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-6 text-emerald-600">
                {type === 'location' ? <MapPin className="w-8 h-8" /> : (
                  <div className="flex items-center gap-1">
                    <Camera className="w-6 h-6" />
                    <Mic className="w-6 h-6" />
                  </div>
                )}
              </div>
              
              <h3 className="text-2xl font-serif text-stone-900 mb-3 tracking-tight">
                {type === 'location' ? 'Location Access' : 'Camera & Microphone'}
              </h3>
              
              <div className="text-stone-600 leading-relaxed mb-8 space-y-4">
                {type === 'location' ? (
                  <>
                    <p>We use your location to calculate distances, drop map pins, and show you nearby properties.</p>
                    <div className="bg-stone-50 p-4 rounded-xl text-sm border border-stone-100">
                      <p className="font-semibold text-stone-900 mb-1">Privacy First</p>
                      <p>Your precise location is only used temporarily on your device and is <span className="font-semibold">never stored on our servers</span>.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <p>To start this real-time call, we need temporary access to your device's camera and microphone.</p>
                    <div className="bg-stone-50 p-4 rounded-xl text-sm border border-stone-100">
                      <p className="font-semibold text-stone-900 mb-1">End-to-End Encrypted</p>
                      <p>Your call is peer-to-peer and completely private. We cannot hear, record, or store your conversations.</p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onDeny}
                  className="flex-1 py-3 px-4 rounded-xl text-stone-600 font-medium hover:bg-stone-100 transition"
                >
                  Not Now
                </button>
                <button
                  onClick={onAllow}
                  className="flex-1 py-3 px-4 rounded-xl bg-stone-900 text-white font-medium hover:bg-stone-800 transition"
                >
                  Allow Access
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
