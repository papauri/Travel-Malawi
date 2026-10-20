import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WifiOff, Wifi, RefreshCw, X, HardDrive } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useOfflineBookings } from '../hooks/useOfflineBookings';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useDialogA11y } from '../hooks/useDialogA11y';
import OfflineBookingsQueue from './OfflineBookingsQueue';
import { usePlatformMode } from '../contexts/PlatformModeContext';
import toast from 'react-hot-toast';

const BANNER_CLASS =
  'pointer-events-auto w-full max-w-md rounded-xl border border-stone-200 bg-white p-3 text-stone-800 shadow-sm';

export default function OfflineIndicator() {
  const { isOnline, isChecking, justReconnected, checkConnection } = useNetworkStatus();
  const { bookingsEnabled } = usePlatformMode();
  const { pendingCount: queuedCount, isSyncing, syncNow } = useOfflineBookings();
  // Directory mode has no booking queue: nothing to report or send.
  const pendingCount = bookingsEnabled ? queuedCount : 0;
  const [isDismissed, setIsDismissed] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  // If user went back online, reset dismiss state for the next offline episode
  React.useEffect(() => {
    if (isOnline) {
      setIsDismissed(false);
    }
  }, [isOnline]);

  const guideDialogRef = useDialogA11y(showGuideModal, () => setShowGuideModal(false));
  useBodyScrollLock(showGuideModal);

  // The browser only fires "online" when the link itself returns. If the drop
  // was the server (or a captive network), nothing else would ever clear the
  // banner, so keep probing quietly while it is showing.
  React.useEffect(() => {
    if (isOnline) return;
    const timer = setInterval(() => { void checkConnection(); }, 15000);
    return () => clearInterval(timer);
  }, [isOnline, checkConnection]);

  const handleManualCheck = async () => {
    const success = await checkConnection();
    if (success) {
      toast.success('You are back online.');
    } else {
      toast.error('Still offline. Check your mobile data or Wi-Fi.', {
        id: 'offline-check-failed',
      });
    }
  };

  return (
    <>
      {/* 1. Main floating offline / reconnected banner */}
      <div className="fixed top-16 sm:top-18 md:top-20 inset-x-0 z-[90] pointer-events-none flex justify-center px-3 sm:px-4">
        <AnimatePresence mode="wait">
          {/* Reconnected */}
          {justReconnected && (
            <motion.div
              key="reconnected-banner"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12, transition: { duration: 0.2 } }}
              transition={{ duration: 0.2 }}
              className={`${BANNER_CLASS} flex items-center gap-3`}
            >
              <Wifi className="h-5 w-5 shrink-0 text-emerald-700" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-stone-900">Back online</p>
                <p className="tm-muted truncate">
                  {pendingCount > 0
                    ? `Sending ${pendingCount} saved booking request${pendingCount === 1 ? '' : 's'}.`
                    : (bookingsEnabled ? 'Rates and availability are up to date.' : 'Listings are up to date.')}
                </p>
              </div>
            </motion.div>
          )}

          {/* Online with saved booking requests waiting */}
          {isOnline && !justReconnected && pendingCount > 0 && !isDismissed && (
            <motion.div
              key="pending-sync-banner"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12, transition: { duration: 0.2 } }}
              transition={{ duration: 0.2 }}
              className={`${BANNER_CLASS} flex items-center justify-between gap-3`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <HardDrive className="h-5 w-5 shrink-0 text-amber-700" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-stone-900">
                    {pendingCount} booking request{pendingCount > 1 ? 's' : ''} waiting
                  </p>
                  <p className="tm-muted truncate">Saved on this device.</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => syncNow()}
                  disabled={isSyncing}
                  className="tm-btn tm-btn-primary tm-btn-sm"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Sending...' : 'Send now'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsDismissed(true)}
                  aria-label="Dismiss"
                  className="tm-btn tm-btn-quiet tm-btn-sm"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Offline */}
          {!isOnline && !isDismissed && (
            <motion.div
              key="offline-banner"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12, transition: { duration: 0.2 } }}
              transition={{ duration: 0.2 }}
              className={`${BANNER_CLASS} max-w-xl`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <WifiOff className="h-5 w-5 shrink-0 text-amber-700" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">You are offline</p>
                    <p className="tm-muted truncate">
                      {pendingCount > 0
                        ? `${pendingCount} booking request${pendingCount === 1 ? '' : 's'} saved to send later.`
                        : 'Places you have already opened still work.'}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowGuideModal(true)}
                    className="tm-btn tm-btn-quiet tm-btn-sm"
                  >
                    What works
                  </button>
                  <button
                    type="button"
                    onClick={handleManualCheck}
                    disabled={isChecking}
                    className="tm-btn tm-btn-secondary tm-btn-sm"
                    title="Check connection"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">{isChecking ? 'Checking...' : 'Retry'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDismissed(true)}
                    className="tm-btn tm-btn-quiet tm-btn-sm"
                    aria-label="Minimise offline banner"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. Small pill once the banner is closed */}
      <AnimatePresence>
        {!isOnline && isDismissed && (
          <motion.div
            key="offline-floating-pill"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 sm:bottom-6 left-4 z-40"
          >
            <button
              type="button"
              onClick={() => setIsDismissed(false)}
              className="tm-btn tm-btn-secondary tm-btn-sm rounded-full shadow-sm"
              title="Show offline status"
            >
              <WifiOff className="h-3.5 w-3.5 text-amber-700" />
              Offline
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. What works offline */}
      <AnimatePresence>
        {showGuideModal && (
          <div key="offline-guide-modal-wrapper" className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGuideModal(false)}
              className="fixed inset-0 bg-stone-950/50"
            />

            <motion.div
              ref={guideDialogRef}
              role="dialog"
              aria-modal="true"
              aria-label="Using Travel Malawi offline"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="tm-panel relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto shadow-sm sm:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="tm-h2">Using Travel Malawi offline</h2>
                  <p className="tm-muted">Enough to get you to your stay without signal.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  aria-label="Close"
                  className="tm-btn tm-btn-quiet tm-btn-sm shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <ul className="mt-4 space-y-3 text-sm text-stone-700">
                <li>
                  <strong className="text-stone-900">Places you have viewed.</strong> Profiles and photos stay available.
                </li>
                <li>
                  <strong className="text-stone-900">Saved maps.</strong> Areas you saved offline keep their map and coordinates.
                </li>
                {bookingsEnabled && (
                  <>
                    <li>
                      <strong className="text-stone-900">Your bookings.</strong> References and host contacts are kept on this device.
                    </li>
                    <li>
                      <strong className="text-stone-900">New requests.</strong> They are saved here and sent when you reconnect.
                    </li>
                  </>
                )}
              </ul>

              {bookingsEnabled && <OfflineBookingsQueue className="mt-4" />}

              <div className="tm-divider mt-5 pt-4 tm-actions justify-between">
                <button
                  type="button"
                  onClick={handleManualCheck}
                  disabled={isChecking}
                  className="tm-btn tm-btn-primary"
                >
                  <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
                  {isChecking ? 'Checking...' : 'Check connection'}
                </button>
                <button type="button" onClick={() => setShowGuideModal(false)} className="tm-btn tm-btn-secondary">
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
