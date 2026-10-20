/**
 * Server view of the platform mode switch (`system/settings.platformMode`).
 *
 * 'directory' (the default, and the answer whenever the setting cannot be read)
 * means no booking flows and no in-app guest↔host chat or calls. 'booking'
 * turns them on. The client reads the same field through PlatformModeContext.
 */
import { FIRESTORE_BASE } from './auth';

export type PlatformMode = 'directory' | 'booking';

const CACHE_MS = 30_000;
let cached: { mode: PlatformMode; at: number } | null = null;
let inFlight: Promise<PlatformMode> | null = null;

async function fetchMode(): Promise<PlatformMode> {
  try {
    const res = await fetch(`${FIRESTORE_BASE}/system/settings`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return 'directory';
    const body: any = await res.json();
    return body?.fields?.platformMode?.stringValue === 'booking' ? 'booking' : 'directory';
  } catch {
    return 'directory';
  }
}

export async function getPlatformMode(): Promise<PlatformMode> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.mode;
  if (!inFlight) {
    inFlight = fetchMode()
      .then((mode) => {
        cached = { mode, at: Date.now() };
        return mode;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

export async function bookingsEnabled(): Promise<boolean> {
  return (await getPlatformMode()) === 'booking';
}

/** Drop the cached value, e.g. right after an admin flips the switch. */
export function invalidatePlatformMode(): void {
  cached = null;
}

/**
 * Express guard for booking and chat routes: answers 403 with a stable code
 * while the platform is in directory mode.
 */
export async function requireBookingMode(req: any, res: any, next: any): Promise<void> {
  if (await bookingsEnabled()) return next();
  res.status(403).json({ error: 'Bookings and in-app chat are switched off.', code: 'directory_mode' });
}
