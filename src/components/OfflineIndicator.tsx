import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  WifiOff, 
  Wifi, 
  RefreshCw, 
  Info, 
  X, 
  MapPin, 
  HardDrive, 
  FileCheck2, 
  Clock, 
  ChevronRight,
  ShieldCheck,
  Palmtree
} from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import toast from 'react-hot-toast';

export default function OfflineIndicator() {
  const { isOnline, isChecking, justReconnected, checkConnection } = useNetworkStatus();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  // If user went back online, reset dismiss state for the next offline episode
  React.useEffect(() => {
    if (isOnline) {
      setIsDismissed(false);
    }
  }, [isOnline]);

  const handleManualCheck = async () => {
    const success = await checkConnection();
    if (success) {
      toast.success('Connection re-established!');
    } else {
      toast.error('Still offline. Check your mobile data or Wi-Fi settings.', {
        id: 'offline-check-failed',
      });
    }
  };

  return (
    <>
      {/* 1. Main Floating Offline / Reconnected Banner */}
      <div className="fixed top-16 sm:top-18 md:top-20 inset-x-0 z-[90] pointer-events-none flex justify-center px-3 sm:px-4">
        <AnimatePresence mode="wait">
          {/* Reconnected Notification Banner */}
          {justReconnected && (
            <motion.div
              key="reconnected-banner"
              initial={{ opacity: 0, y: -20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="pointer-events-auto bg-stone-900 text-stone-100 border border-stone-800 shadow-xl rounded-2xl px-4 py-2.5 flex items-center gap-3 backdrop-blur-md max-w-md w-full"
            >
              <div className="w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                <Wifi className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Back Online</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </p>
                <p className="text-[11px] text-stone-300 truncate">
                  Platform synchronized with live availability &amp; rates.
                </p>
              </div>
            </motion.div>
          )}

          {/* Offline Mode Active Banner */}
          {!isOnline && !isDismissed && (
            <motion.div
              key="offline-banner"
              initial={{ opacity: 0, y: -20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className="pointer-events-auto bg-stone-900/95 text-stone-100 border border-stone-800/90 shadow-2xl rounded-2xl p-3 sm:px-4 sm:py-3 backdrop-blur-md max-w-xl w-full"
            >
              <div className="flex items-center justify-between gap-3">
                {/* Left: Icon & Description */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                    <WifiOff className="w-4 h-4 text-amber-400" />
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 animate-pulse ring-2 ring-stone-900" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-white tracking-wide">
                        Offline Mode Active
                      </p>
                      <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-stone-800 text-amber-300 border border-stone-700">
                        Cached Guides Ready
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-300 truncate mt-0.5">
                      Previously viewed lodges, road guides &amp; vouchers remain accessible.
                    </p>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowGuideModal(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-200 border border-stone-700/80 text-[11px] font-semibold transition cursor-pointer"
                    title="View what is accessible offline"
                  >
                    <Info className="w-3.5 h-3.5 text-stone-400" />
                    <span className="hidden md:inline">Offline Features</span>
                    <span className="md:hidden">Info</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleManualCheck}
                    disabled={isChecking}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[11px] font-semibold transition cursor-pointer disabled:opacity-50"
                    title="Check network connectivity"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">{isChecking ? 'Checking...' : 'Retry'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsDismissed(true)}
                    className="p-1.5 rounded-xl text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition cursor-pointer"
                    title="Minimize banner"
                    aria-label="Minimize offline banner"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. Minimized Floating Pill when banner was closed */}
      <AnimatePresence>
        {!isOnline && isDismissed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="fixed bottom-20 sm:bottom-6 left-4 z-40"
          >
            <button
              type="button"
              onClick={() => setIsDismissed(false)}
              className="group bg-stone-900/95 hover:bg-stone-850 text-stone-100 border border-stone-800 shadow-xl rounded-full px-3.5 py-2 flex items-center gap-2 text-xs font-semibold backdrop-blur-md transition cursor-pointer"
              title="Click to view offline status &amp; guides"
            >
              <div className="relative">
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              </div>
              <span className="text-stone-200">Offline</span>
              <span className="text-[10px] text-stone-400 bg-stone-800 px-1.5 py-0.5 rounded-md border border-stone-700/60 font-medium">
                Tap to expand
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Offline Capabilities & Guide Modal */}
      <AnimatePresence>
        {showGuideModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGuideModal(false)}
              className="fixed inset-0 bg-stone-950/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg bg-white rounded-2xl border border-stone-200 shadow-2xl p-5 sm:p-6 overflow-hidden z-10"
            >
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-stone-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                    <WifiOff className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-serif font-bold text-stone-900">
                      Travel Malawi Offline Mode
                    </h3>
                    <p className="text-xs text-stone-500">
                      Reliable local functionality designed for remote wilderness areas.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-xl transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Offline Features Checklist */}
              <div className="mt-4 space-y-3">
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-white border border-stone-200 text-stone-700 shrink-0">
                    <HardDrive className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">Cached Lodge Profiles &amp; Photos</h4>
                    <p className="text-[11px] text-stone-600 leading-relaxed mt-0.5">
                      Lodges, cottages, and camps you previously explored are stored in your device storage and remain viewable without cell reception.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-white border border-stone-200 text-stone-700 shrink-0">
                    <MapPin className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">Offline Road Navigation &amp; GPS Guides</h4>
                    <p className="text-[11px] text-stone-600 leading-relaxed mt-0.5">
                      Cached map tiles for Lake Malawi, Liwonde, Majete, and Nyika continue providing interactive turn orientation and coordinates.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-white border border-stone-200 text-stone-700 shrink-0">
                    <FileCheck2 className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">Stay Vouchers &amp; Booking Details</h4>
                    <p className="text-[11px] text-stone-600 leading-relaxed mt-0.5">
                      Confirmed booking references and property manager contacts are preserved locally for easy check-in at lodge reception.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-white border border-stone-200 text-stone-700 shrink-0">
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">Automatic Sync on Reconnection</h4>
                    <p className="text-[11px] text-stone-600 leading-relaxed mt-0.5">
                      When your device regains network signal (Airtel, TNM, or Wi-Fi), live rates, new messages, and reservations will synchronize immediately.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-stone-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleManualCheck}
                  disabled={isChecking}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                  <span>{isChecking ? 'Checking Connection...' : 'Check Connection Now'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
