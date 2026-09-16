import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Compass, Palmtree } from 'lucide-react';

export default function PageLoader() {
  const location = useLocation();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setIsNavigating(true);
    setProgress(35);

    const midTimer = setTimeout(() => {
      setProgress(85);
    }, 120);

    const endTimer = setTimeout(() => {
      setProgress(100);
      setTimeout(() => {
        setIsNavigating(false);
        setProgress(0);
      }, 180);
    }, 380);

    return () => {
      clearTimeout(midTimer);
      clearTimeout(endTimer);
    };
  }, [location.pathname, location.search]);

  return (
    <AnimatePresence>
      {isNavigating && (
        <>
          {/* Top-Edge Ambient Progress Beam */}
          <motion.div
            initial={{ scaleX: 0, opacity: 1 }}
            animate={{ scaleX: progress / 100, opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.25, ease: 'easeOut' } }}
            style={{ transformOrigin: '0% 50%' }}
            className="fixed top-0 left-0 right-0 h-[2.5px] z-[9999] pointer-events-none bg-gradient-to-r from-amber-600 via-amber-400 to-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
          />

          {/* Floating Luxury Concierge Transition Pill */}
          <motion.div
            initial={{ y: -50, opacity: 0, scale: 0.95 }}
            animate={{ y: 20, opacity: 1, scale: 1 }}
            exit={{ y: -15, opacity: 0, scale: 0.95, transition: { duration: 0.2, ease: 'easeOut' } }}
            transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            className="fixed top-0 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none"
          >
            <div className="bg-stone-950/90 text-stone-100 backdrop-blur-md px-4 py-2 rounded-full shadow-2xl border border-stone-800 flex items-center gap-3">
              <div className="relative w-5 h-5 flex items-center justify-center">
                {/* Rotating Ambient Ring */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-0 border-[2px] border-stone-800 border-t-amber-400 border-r-amber-500/40 rounded-full"
                />
                <Compass className="w-3 h-3 text-amber-400 animate-pulse" />
              </div>

              <div className="flex items-center gap-1.5 pr-1">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-[0.25em]">
                  Ulendo
                </span>
                <span className="text-stone-600 text-xs">&bull;</span>
                <span className="text-[11px] font-medium text-stone-200 tracking-wide">
                  Exploring Malawi
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
