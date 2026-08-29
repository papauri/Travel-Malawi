import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Palmtree } from 'lucide-react';

export default function PageLoader() {
  const location = useLocation();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    setIsNavigating(true);
    // Hide the loader quickly after navigation starts since React Router is instant client-side.
    // The delay gives a subtle smooth transition feel.
    const timeout = setTimeout(() => setIsNavigating(false), 400); 
    return () => clearTimeout(timeout);
  }, [location.pathname]);

  return (
    <AnimatePresence>
      {isNavigating && (
        <motion.div
          initial={{ y: -50, opacity: 0, scale: 0.95 }}
          animate={{ y: 24, opacity: 1, scale: 1 }}
          exit={{ y: -20, opacity: 0, scale: 0.95, transition: { duration: 0.2, ease: "easeOut" } }}
          className="fixed top-0 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none"
        >
          <div className="bg-stone-900/95 backdrop-blur-md px-5 py-2.5 rounded-full shadow-2xl border border-stone-800 flex items-center gap-3">
            <div className="relative w-5 h-5 flex items-center justify-center">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border-[2px] border-stone-700 border-t-emerald-400 rounded-full"
              />
              <Palmtree className="w-3 h-3 text-emerald-400" />
            </div>
            <span className="text-[11px] font-bold text-stone-300 uppercase tracking-[0.2em] pr-1">Traveling</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
