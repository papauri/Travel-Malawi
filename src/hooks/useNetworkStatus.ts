import { useState, useEffect, useCallback } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  isChecking: boolean;
  lastChangedAt: number | null;
  justReconnected: boolean;
  checkConnection: () => Promise<boolean>;
}

// Singleton state listeners so all components are 100% synchronized
type Listener = () => void;
const listeners = new Set<Listener>();

let globalIsOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
let globalIsChecking = false;
let globalLastChangedAt: number | null = null;
let globalJustReconnected = false;
let reconnectTimer: any = null;

function notifyListeners() {
  listeners.forEach(listener => listener());
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    globalIsOnline = true;
    globalLastChangedAt = Date.now();
    globalJustReconnected = true;
    notifyListeners();

    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      globalJustReconnected = false;
      notifyListeners();
    }, 4000);
  });

  window.addEventListener('offline', () => {
    globalIsOnline = false;
    globalLastChangedAt = Date.now();
    globalJustReconnected = false;
    notifyListeners();
  });
}

/**
 * Hook providing real-time network connectivity, active ping checking,
 * and seamless PWA offline state management.
 */
export function useNetworkStatus(): NetworkStatus {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick(t => t + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    if (globalIsChecking) return globalIsOnline;

    globalIsChecking = true;
    notifyListeners();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      // Attempt ping to local API health endpoint with cache-busting
      const res = await fetch(`/api/health?t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const isHealthy = res.ok;
      const prevOnline = globalIsOnline;
      globalIsOnline = isHealthy;

      if (!prevOnline && isHealthy) {
        globalJustReconnected = true;
        globalLastChangedAt = Date.now();
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          globalJustReconnected = false;
          notifyListeners();
        }, 4000);
      } else if (!isHealthy) {
        globalIsOnline = false;
        globalLastChangedAt = Date.now();
      }

      return isHealthy;
    } catch {
      globalIsOnline = false;
      globalLastChangedAt = Date.now();
      return false;
    } finally {
      globalIsChecking = false;
      notifyListeners();
    }
  }, []);

  return {
    isOnline: globalIsOnline,
    isChecking: globalIsChecking,
    lastChangedAt: globalLastChangedAt,
    justReconnected: globalJustReconnected,
    checkConnection,
  };
}
