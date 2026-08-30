import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, MapPin, Mic, X } from 'lucide-react';

export type PermissionType = 'location' | 'camera_mic';

interface Props {
  type: PermissionType | null;
  isOpen: boolean;
  onAllow: () => void;
  onDeny: () => void;
}

export default function PermissionRequestModal({ type, isOpen, onAllow, onDeny }: Props) {
  return (
    <AnimatePresence>
      {isOpen && type && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
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
                {type === 'location' ? <MapPin className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
              </div>
              
              <h3 className="text-2xl font-serif text-stone-900 mb-3 tracking-tight">
                {type === 'location' ? 'Location Access' : 'Camera & Microphone'}
              </h3>
              
              <p className="text-stone-600 leading-relaxed mb-8">
                {type === 'location' 
                  ? 'We need access to your location to accurately calculate distances to lodges, drop pins on the map, and show you properties "Near Me". Your location is never stored on our servers.'
                  : 'To start this real-time voice and video call, we need access to your device\'s camera and microphone. Your call is peer-to-peer and completely private.'}
              </p>

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
