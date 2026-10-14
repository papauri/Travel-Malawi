import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getClientTelemetry, parseDeviceTelemetry } from './logger';
import { auth } from './firebase';

export interface TrafficSessionData {
  sessionId: string;
  visitorId: string;
  isAnonymous: boolean;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  status: 'active' | 'waiting' | 'idle' | 'background' | 'exited';
  currentPath: string;
  currentTitle: string;
  currentWaitSeconds: number;
  totalSessionSeconds: number;
  activeSeconds: number;
  idleSeconds: number;
  ip: string;
  location: {
    ip?: string;
    city?: string;
    region?: string;
    country?: string;
    countryCode?: string;
    flag?: string;
    timezone?: string;
  };
  device: {
    type: 'Mobile' | 'Tablet' | 'Desktop';
    os: string;
    browser: string;
    screen?: string;
  };
  referrer?: string;
  intent: string;
  intentScore: number;
  intentSummary: string;
  conversionLikelihood: 'High' | 'Medium' | 'Low';
  steps: {
    path: string;
    title: string;
    dwellSeconds: number;
    enteredAt: number;
    leftAt?: number;
    interactions: number;
    hotelId?: string;
    hotelName?: string;
  }[];
  totalPageViews: number;
  totalInteractions: number;
  startedAt: number;
  lastActiveAt: number;
  lastHeartbeatAt: number;
}

export interface LiveTrafficResponse {
  summary: {
    activeNow: number;
    anonymousNow: number;
    authenticatedNow: number;
    avgWaitSeconds: number;
    longestWaitSeconds: number;
    highIntentCount: number;
    topProperties: { id: string; name: string; count: number; avgWait: number }[];
    geoBreakdown: { country: string; flag: string; count: number; percent: number }[];
    deviceBreakdown: { type: string; count: number; percent: number }[];
    intentBreakdown: Record<string, number>;
    totalMonitored24h: number;
  };
  activeSessions: TrafficSessionData[];
  recentSessions: TrafficSessionData[];
}

/**
 * Returns a persistent anonymous visitor ID stored across browser visits
 */
export function getOrCreateAnonVisitorId(): string {
  if (typeof window === 'undefined') return 'anon_srv';
  try {
    let vid = localStorage.getItem('tm_anon_visitor_id');
    if (!vid) {
      vid = 'anon_' + Math.random().toString(36).substring(2, 8) + '_' + Date.now().toString(36).slice(-4);
      localStorage.setItem('tm_anon_visitor_id', vid);
    }
    return vid;
  } catch {
    return 'anon_fallback';
  }
}

/**
 * Returns or creates the session ID for current browser tab
 */
export function getTrafficSessionId(): string {
  if (typeof window === 'undefined') return 'sess_srv';
  try {
    let sid = sessionStorage.getItem('tm_traffic_sess_id');
    if (!sid) {
      sid = 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
      sessionStorage.setItem('tm_traffic_sess_id', sid);
      sessionStorage.setItem('tm_traffic_sess_start', Date.now().toString());
    }
    return sid;
  } catch {
    return 'sess_fallback';
  }
}

/**
 * Derives hotel identification from current path if on a hotel page
 */
function extractHotelContextFromPath(pathname: string): { hotelId?: string; hotelName?: string } {
  if (!pathname.startsWith('/hotel/')) return {};
  const slug = pathname.replace('/hotel/', '').split('/')[0];
  if (!slug) return {};
  
  // Format readable name from slug
  const hotelName = slug
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
    
  return { hotelId: slug, hotelName };
}

/**
 * Hook to continuously and intelligently monitor traffic and waiting telemetry for all visitors (logged in or anonymous)
 */
export function useTrafficMonitor() {
  const location = useLocation();
  const { user } = useAuth();

  const pageEnteredAtRef = useRef<number>(Date.now());
  const interactionCountRef = useRef<number>(0);
  const interactionDeltaRef = useRef<number>(0);
  const lastActiveTimestampRef = useRef<number>(Date.now());
  const isHiddenRef = useRef<boolean>(typeof document !== 'undefined' ? document.hidden : false);
  const currentPathRef = useRef<string>(location.pathname);
  const heartbeatTimerRef = useRef<any>(null);

  // Send a heartbeat ping to server
  const sendPing = useCallback(
    async (isExiting = false) => {
      if (typeof window === 'undefined') return;

      const now = Date.now();
      const dwellSeconds = Math.max(0, Math.round((now - pageEnteredAtRef.current) / 1000));
      const idleTimeSeconds = Math.max(0, Math.round((now - lastActiveTimestampRef.current) / 1000));
      
      let waitingStatus: 'active' | 'waiting' | 'idle' | 'background' | 'exited' = 'active';
      if (isExiting) {
        waitingStatus = 'exited';
      } else if (isHiddenRef.current) {
        waitingStatus = 'background';
      } else if (idleTimeSeconds > 90) {
        waitingStatus = 'idle';
      } else if (idleTimeSeconds > 30 || dwellSeconds > 60) {
        waitingStatus = 'waiting';
      }

      const visitorId = getOrCreateAnonVisitorId();
      const sessionId = getTrafficSessionId();
      const { hotelId, hotelName } = extractHotelContextFromPath(location.pathname);
      const telemetry = await getClientTelemetry();

      const payload = {
        sessionId,
        visitorId,
        userId: user?.uid || null,
        userName: user?.displayName || null,
        userEmail: user?.email || null,
        userRole: user?.role || (user?.roles && user.roles.length > 0 ? user.roles[0] : null),
        path: location.pathname,
        title: typeof document !== 'undefined' ? document.title : 'Travel Malawi',
        dwellSeconds,
        waitingStatus,
        hotelId,
        hotelName,
        interactions: interactionCountRef.current,
        interactionsDelta: interactionDeltaRef.current,
        device: telemetry.device || parseDeviceTelemetry(),
        location: telemetry.location,
        referrer: typeof document !== 'undefined' ? document.referrer : '',
      };

      // Reset interactions delta
      interactionDeltaRef.current = 0;

      // Use keepalive / sendBeacon if exiting to guarantee delivery
      if (isExiting && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        try {
          const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
          navigator.sendBeacon('/api/telemetry/traffic', blob);
          return;
        } catch {
          // fallback to fetch
        }
      }

      try {
        await fetch('/api/telemetry/traffic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: isExiting,
        });
      } catch {
        // Silently catch to avoid disrupting user experience
      }
    },
    [location.pathname, user]
  );

  // Track user activity (scroll, click, keydown, touch) to separate active waiting from idle
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onUserInteraction = () => {
      lastActiveTimestampRef.current = Date.now();
      interactionCountRef.current += 1;
      interactionDeltaRef.current += 1;
    };

    const onVisibilityChange = () => {
      isHiddenRef.current = document.hidden;
      if (!document.hidden) {
        lastActiveTimestampRef.current = Date.now();
      }
      sendPing(false);
    };

    window.addEventListener('mousemove', onUserInteraction, { passive: true });
    window.addEventListener('scroll', onUserInteraction, { passive: true });
    window.addEventListener('click', onUserInteraction, { passive: true });
    window.addEventListener('keydown', onUserInteraction, { passive: true });
    window.addEventListener('touchstart', onUserInteraction, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);

    const onBeforeUnload = () => {
      sendPing(true);
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      window.removeEventListener('mousemove', onUserInteraction);
      window.removeEventListener('scroll', onUserInteraction);
      window.removeEventListener('click', onUserInteraction);
      window.removeEventListener('keydown', onUserInteraction);
      window.removeEventListener('touchstart', onUserInteraction);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [sendPing]);

  // Route change handler & periodic heartbeat
  useEffect(() => {
    // If route changed, flush previous route dwell and start new stop
    if (currentPathRef.current !== location.pathname) {
      sendPing(false);
      currentPathRef.current = location.pathname;
      pageEnteredAtRef.current = Date.now();
      interactionCountRef.current = 0;
      interactionDeltaRef.current = 0;
    }

    // Initial ping on route entry
    const initialTimer = setTimeout(() => {
      sendPing(false);
    }, 1200);

    // Regular heartbeat every 20 seconds while user is waiting/reading/interacting
    heartbeatTimerRef.current = setInterval(() => {
      sendPing(false);
    }, 20000);

    return () => {
      clearTimeout(initialTimer);
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
    };
  }, [location.pathname, sendPing]);
}

/**
 * Admin API: Fetch live traffic intelligence
 */
export async function fetchLiveTrafficSummary(): Promise<LiveTrafficResponse | null> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return null;

    const res = await fetch('/api/admin/traffic/live', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch live traffic summary:', err);
    return null;
  }
}

/**
 * Admin API: Clear in-memory traffic telemetry
 */
export async function clearTrafficBuffer(): Promise<boolean> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return false;

    const res = await fetch('/api/admin/traffic/clear', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return res.ok;
  } catch (err) {
    console.error('Failed to clear traffic buffer:', err);
    return false;
  }
}
