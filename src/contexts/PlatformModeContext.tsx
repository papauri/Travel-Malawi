/**
 * Platform mode — the one switch between a pure information directory and the
 * booking platform.
 *
 * `system/settings.platformMode` is either 'directory' or 'booking'. Directory
 * mode (the default, and the value used while loading or when the read fails)
 * turns off every booking flow and all in-app guest↔host chat and calls:
 * travellers read about a property and contact it directly with the details on
 * its listing. Only an admin can switch it, from the admin dashboard.
 *
 * Firestore rules and the server read the same field, so hiding UI here is a
 * courtesy, not the enforcement.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type PlatformMode = 'directory' | 'booking';

export const DEFAULT_PLATFORM_MODE: PlatformMode = 'directory';

export function parsePlatformMode(value: unknown): PlatformMode {
  return value === 'booking' ? 'booking' : 'directory';
}

interface PlatformModeValue {
  mode: PlatformMode;
  /** True only when bookings and in-app chat/calls are switched on. */
  bookingsEnabled: boolean;
  loading: boolean;
}

const PlatformModeContext = createContext<PlatformModeValue>({
  mode: DEFAULT_PLATFORM_MODE,
  bookingsEnabled: false,
  loading: true,
});

export function PlatformModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<PlatformMode>(DEFAULT_PLATFORM_MODE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'system', 'settings'),
      (snap) => {
        setMode(parsePlatformMode(snap.exists() ? snap.data()?.platformMode : undefined));
        setLoading(false);
      },
      (err) => {
        // Fail closed: without the setting we behave as a directory.
        console.warn('[PlatformMode] Could not read system settings:', err?.message || err);
        setMode(DEFAULT_PLATFORM_MODE);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  return (
    <PlatformModeContext.Provider value={{ mode, bookingsEnabled: mode === 'booking', loading }}>
      {children}
    </PlatformModeContext.Provider>
  );
}

export function usePlatformMode(): PlatformModeValue {
  return useContext(PlatformModeContext);
}
