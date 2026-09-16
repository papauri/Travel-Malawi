import { collection, addDoc, getDocs, query, orderBy, limit, onSnapshot, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

export type LogType = 'action' | 'error' | 'info' | 'auth' | 'session';
export type LogCategory = 'auth' | 'session' | 'booking' | 'property' | 'admin' | 'security' | 'ai' | 'system';

export interface ClientDeviceTelemetry {
  type: 'Mobile' | 'Tablet' | 'Desktop';
  os: string;
  browser: string;
  screen?: string;
  language?: string;
  timezone?: string;
  platform?: string;
}

export interface ClientLocationTelemetry {
  ip?: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  flag?: string;
  timezone?: string;
  org?: string;
}

export interface SystemLog {
  id?: string;
  timestamp: number;
  type: LogType;
  category?: LogCategory;
  message: string;
  details?: any;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  sessionId?: string;
  userAgent?: string;
  ip?: string;
  location?: ClientLocationTelemetry;
  device?: ClientDeviceTelemetry;
  status?: 'Success' | 'Failed' | 'Pending' | 'Info';
  activity?: string;
  target?: string;
  targetType?: string;
}

/**
 * Parses detailed device telemetry from navigator / browser window
 */
export function parseDeviceTelemetry(uaString?: string): ClientDeviceTelemetry {
  if (typeof window === 'undefined' && !uaString) {
    return { type: 'Desktop', os: 'Server', browser: 'Node', screen: '0x0' };
  }

  const ua = uaString || (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '';
  let type: 'Mobile' | 'Tablet' | 'Desktop' = 'Desktop';

  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    type = 'Tablet';
  } else if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua)) {
    type = 'Mobile';
  }

  // OS
  let os = 'Unknown OS';
  if (/Windows NT 10.0/i.test(ua)) os = 'Windows 10/11';
  else if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/iPhone/i.test(ua)) os = 'iOS';
  else if (/iPad/i.test(ua)) os = 'iPadOS';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/CrOS/i.test(ua)) os = 'Chrome OS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  // Browser
  let browser = 'Unknown Browser';
  if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Internet';
  else if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua)) browser = 'Google Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Apple Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Mozilla Firefox';

  const screen = typeof window !== 'undefined'
    ? `${window.screen?.width || window.innerWidth}x${window.screen?.height || window.innerHeight}`
    : undefined;

  const timezone = typeof Intl !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'UTC';

  return {
    type,
    os,
    browser,
    screen,
    language: typeof navigator !== 'undefined' ? navigator.language : 'en',
    timezone,
    platform: typeof navigator !== 'undefined' ? navigator.platform : undefined,
  };
}

/**
 * Produces national flag emoji from standard 2-letter ISO country code
 */
export function getCountryFlag(code?: string): string {
  if (!code || code.length !== 2) return '🌐';
  try {
    const codePoints = code
      .toUpperCase()
      .split('')
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  } catch {
    return '🌐';
  }
}

// Memory cache for telemetry to eliminate redundant calls
let memoryCachedTelemetry: {
  ip?: string;
  location?: ClientLocationTelemetry;
  device?: ClientDeviceTelemetry;
} | null = null;

/**
 * Resolves current client IP, location (city, country, flag) and device
 */
export async function getClientTelemetry(): Promise<{
  ip: string;
  location: ClientLocationTelemetry;
  device: ClientDeviceTelemetry;
}> {
  const device = parseDeviceTelemetry();

  if (memoryCachedTelemetry) {
    return {
      ip: memoryCachedTelemetry.ip || '127.0.0.1',
      location: memoryCachedTelemetry.location || { timezone: device.timezone },
      device,
    };
  }

  // Check sessionStorage
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem('tm_telemetry_cache');
      if (stored) {
        const parsed = JSON.parse(stored);
        memoryCachedTelemetry = { ...parsed, device };
        return {
          ip: parsed.ip || '127.0.0.1',
          location: parsed.location || { timezone: device.timezone },
          device,
        };
      }
    } catch {
      // ignore parse error
    }
  }

  let ip = '127.0.0.1';
  let location: ClientLocationTelemetry = {
    timezone: device.timezone,
  };

  // 1. Fetch from our Express server endpoint /api/client-telemetry
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/client-telemetry', { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json();
        if (data.ip) ip = data.ip;
        if (data.geo && (data.geo.city || data.geo.country)) {
          location = {
            ip: data.ip,
            city: data.geo.city,
            region: data.geo.region,
            country: data.geo.country,
            countryCode: data.geo.countryCode,
            flag: getCountryFlag(data.geo.countryCode),
            timezone: data.geo.timezone || device.timezone,
            org: data.geo.org,
          };
        }
      }
    } catch {
      // Fallback
    }

    // 2. Direct browser fallback lookup if online and location not yet discovered
    if ((!location.city || !location.country) && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const directRes = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(2000) });
        if (directRes.ok) {
          const d = await directRes.json();
          if (!d.error) {
            ip = d.ip || ip;
            location = {
              ip: d.ip,
              city: d.city,
              region: d.region,
              country: d.country_name,
              countryCode: d.country_code,
              flag: getCountryFlag(d.country_code),
              timezone: d.timezone || device.timezone,
              org: d.org,
            };
          }
        }
      } catch {
        // Fallback
      }
    }

    // 3. Timezone-based country hint if IP lookup was blocked
    if (!location.countryCode && device.timezone) {
      const tz = device.timezone;
      if (tz.includes('Blantyre') || tz.includes('Lilongwe')) {
        location.country = 'Malawi';
        location.countryCode = 'MW';
        location.flag = '🇲🇼';
        if (!location.city) location.city = 'Lilongwe';
      } else if (tz.includes('Johannesburg')) {
        location.country = 'South Africa';
        location.countryCode = 'ZA';
        location.flag = '🇿🇦';
      } else if (tz.includes('London')) {
        location.country = 'United Kingdom';
        location.countryCode = 'GB';
        location.flag = '🇬🇧';
      } else if (tz.includes('New_York') || tz.includes('Chicago') || tz.includes('Los_Angeles')) {
        location.country = 'United States';
        location.countryCode = 'US';
        location.flag = '🇺🇸';
      }
    }
  }

  const result = { ip, location, device };
  memoryCachedTelemetry = result;

  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem('tm_telemetry_cache', JSON.stringify({ ip, location }));
    } catch {
      // ignore storage error
    }
  }

  return result;
}

/**
 * Returns a persistent session ID for the current browser session.
 */
export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return 'srv_session';
  try {
    let sid = sessionStorage.getItem('tm_session_id');
    if (!sid) {
      sid = 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
      sessionStorage.setItem('tm_session_id', sid);
      sessionStorage.setItem('tm_session_start', Date.now().toString());
    }
    return sid;
  } catch {
    return 'sess_fallback';
  }
}

/**
 * Computes elapsed minutes since current tab/browser session started.
 */
export function getSessionDurationMinutes(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const startStr = sessionStorage.getItem('tm_session_start');
    if (!startStr) return 0;
    const start = parseInt(startStr, 10);
    if (isNaN(start)) return 0;
    return Math.max(0, Math.round((Date.now() - start) / 60000));
  } catch {
    return 0;
  }
}

/**
 * Clears session tracking state from sessionStorage.
 */
export function clearSessionTracking(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem('tm_session_id');
    sessionStorage.removeItem('tm_session_start');
    sessionStorage.removeItem('tm_session_logged_user');
  } catch {
    // Ignore storage errors
  }
}

/**
 * Derives Intune-style Activity, Target, and Status attributes from log messages
 */
export function inferIntuneAttributes(
  message: string,
  type: LogType,
  category?: LogCategory,
  details?: any
): {
  activity: string;
  status: 'Success' | 'Failed' | 'Pending' | 'Info';
  target: string;
  targetType: string;
} {
  const lower = message.toLowerCase();
  let status: 'Success' | 'Failed' | 'Pending' | 'Info' =
    type === 'error' || lower.includes('failed') || lower.includes('error') ? 'Failed' : 'Success';

  let activity = 'General Activity';
  let target = 'System / Platform';
  let targetType = 'System';

  if (lower.includes('admin set property status')) {
    activity = 'Update Property Status';
    targetType = 'Property';
  } else if (lower.includes('admin deleted property')) {
    activity = 'Delete Property Listing';
    targetType = 'Property';
  } else if (lower.includes('admin toggled featured')) {
    activity = 'Update Featured Status';
    targetType = 'Property';
  } else if (lower.includes('admin updated booking status')) {
    activity = 'Override Booking Status';
    targetType = 'Booking';
  } else if (lower.includes('admin permanently deleted booking')) {
    activity = 'Purge Booking Record';
    targetType = 'Booking';
  } else if (lower.includes('admin updated roles')) {
    activity = 'Assign User Roles (RBAC)';
    targetType = 'Access Control';
  } else if (lower.includes('admin suspended') || lower.includes('admin restored')) {
    activity = lower.includes('suspended') ? 'Suspend User Access' : 'Restore User Access';
    targetType = 'Security / User';
  } else if (lower.includes('admin deleted user profile')) {
    activity = 'Delete User Profile';
    targetType = 'Security / User';
  } else if (lower.includes('manager confirmed booking')) {
    activity = 'Confirm Booking Request';
    targetType = 'Booking';
  } else if (lower.includes('manager rejected booking')) {
    activity = 'Reject Booking Request';
    targetType = 'Booking';
  } else if (lower.includes('guest cancelled booking')) {
    activity = 'Cancel Guest Reservation';
    targetType = 'Booking';
  } else if (lower.includes('quick edited booking')) {
    activity = 'Quick Edit Reservation';
    targetType = 'Booking';
  } else if (lower.includes('new booking requested')) {
    activity = 'Submit Booking Request';
    targetType = 'Booking';
  } else if (lower.includes('manager updated property')) {
    activity = 'Modify Property Details';
    targetType = 'Property';
  } else if (lower.includes('manager toggled property status')) {
    activity = 'Toggle Listing Live State';
    targetType = 'Property';
  } else if (lower.includes('manager added new room type')) {
    activity = 'Create Room Type Inventory';
    targetType = 'Property';
  } else if (lower.includes('manager updated room type')) {
    activity = 'Update Room Type Inventory';
    targetType = 'Property';
  } else if (lower.includes('user signed in via google') || lower.includes('user signed in')) {
    activity = 'User Sign-In (Interactive)';
    targetType = 'Authentication';
  } else if (lower.includes('user signed out')) {
    activity = 'User Sign-Out';
    targetType = 'Authentication';
  } else if (lower.includes('new user registered')) {
    activity = 'Register User Account';
    targetType = 'Authentication';
  } else if (lower.includes('failed login') || lower.includes('registration failed')) {
    activity = 'Authentication Failure';
    targetType = 'Security';
    status = 'Failed';
  } else if (lower.includes('password reset')) {
    activity = 'Request Password Reset';
    targetType = 'Security';
  } else if (lower.includes('session started')) {
    activity = 'Initialize Client Session';
    targetType = 'Session';
  } else if (lower.includes('session ended')) {
    activity = 'Terminate Client Session';
    targetType = 'Session';
  } else if (details?.action) {
    activity = String(details.action)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c: string) => c.toUpperCase());
  } else {
    const firstSentence = message.split(/[:\n]/)[0].trim();
    activity = firstSentence.length > 36 ? firstSentence.substring(0, 34) + '...' : firstSentence;
  }

  // Resolve Target resource name
  if (details?.hotelName || details?.hotelId) {
    target = details.hotelName || `Lodge ID: ${details.hotelId}`;
    targetType = 'Property';
  } else if (details?.reference || details?.bookingId) {
    target = `Ref: ${details.reference || details.bookingId}`;
    targetType = 'Booking';
  } else if (details?.targetEmail || details?.targetUserId) {
    target = details.targetEmail || `User: ${details.targetUserId}`;
    targetType = 'User / Identity';
  } else if (details?.email) {
    target = details.email;
    targetType = 'Identity';
  } else {
    const refMatch = message.match(/Ref\s+([A-Za-z0-9-]+)/i);
    if (refMatch) {
      target = `Ref: ${refMatch[1]}`;
      targetType = 'Booking';
    } else {
      const hotelMatch = message.match(/for\s+([^,:\n]+)/i);
      if (hotelMatch) {
        target = hotelMatch[1].trim();
        targetType = 'Property';
      }
    }
  }

  return { activity, status, target, targetType };
}

/**
 * Normalizes any existing or incoming log record with Intune schema attributes
 */
export function normalizeSystemLog(log: SystemLog): SystemLog {
  const { activity, status, target, targetType } = inferIntuneAttributes(
    log.message,
    log.type,
    log.category,
    log.details
  );

  const device = log.device || parseDeviceTelemetry(log.userAgent || log.details?.device?.userAgent);

  let location: ClientLocationTelemetry = log.location || {};
  if (!location.city && log.details?.location) {
    location = log.details.location;
  }
  if (!location.flag && location.countryCode) {
    location.flag = getCountryFlag(location.countryCode);
  }

  return {
    ...log,
    activity: log.activity || activity,
    status: log.status || status,
    target: log.target || target,
    targetType: log.targetType || targetType,
    device,
    location,
    ip: log.ip || location.ip || (typeof log.details?.ip === 'string' ? log.details.ip : undefined),
  };
}

export async function logSystemEvent(
  type: LogType,
  message: string,
  details?: any,
  user?: { id?: string; uid?: string; name?: string; displayName?: string; email?: string; role?: string; roles?: string[] } | null,
  category?: LogCategory
) {
  try {
    const userId = user?.id || user?.uid || null;
    const userName = user?.name || user?.displayName || null;
    const userEmail = user?.email || null;
    const userRole = user?.role || (user?.roles && user.roles.length > 0 ? user.roles.join(', ') : null);

    // Auto-resolve category if not explicitly provided
    let resolvedCategory = category;
    if (!resolvedCategory) {
      const lower = message.toLowerCase();
      if (
        type === 'auth' ||
        lower.includes('login') ||
        lower.includes('logout') ||
        lower.includes('sign in') ||
        lower.includes('sign up') ||
        lower.includes('password reset')
      ) {
        resolvedCategory = 'auth';
      } else if (type === 'session' || lower.includes('session')) {
        resolvedCategory = 'session';
      } else if (lower.includes('booking')) {
        resolvedCategory = 'booking';
      } else if (lower.includes('hotel') || lower.includes('property') || lower.includes('room') || lower.includes('listing')) {
        resolvedCategory = 'property';
      } else if (lower.includes('admin') || lower.includes('role') || lower.includes('suspend') || lower.includes('delete user')) {
        resolvedCategory = 'admin';
      } else if (lower.includes('copilot') || lower.includes('ulendo') || lower.includes('ai')) {
        resolvedCategory = 'ai';
      } else {
        resolvedCategory = 'system';
      }
    }

    const sessionId = typeof window !== 'undefined' ? (sessionStorage.getItem('tm_session_id') || getOrCreateSessionId()) : null;
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;

    // Fetch client telemetry (IP, location, device)
    const telemetry = await getClientTelemetry();
    const { activity, status, target, targetType } = inferIntuneAttributes(message, type, resolvedCategory, details);

    await addDoc(collection(db, 'system_logs'), {
      timestamp: Date.now(),
      type,
      category: resolvedCategory,
      message,
      activity,
      status,
      target,
      targetType,
      details: details || null,
      userId,
      userName,
      userEmail,
      userRole,
      sessionId,
      userAgent,
      ip: telemetry.ip,
      location: telemetry.location,
      device: telemetry.device,
    });
  } catch (err) {
    console.error('Failed to write system log:', err);
  }
}

/**
 * Helper to log authentication events (logins, logouts, signups, failures).
 */
export async function logAuthEvent(
  action: 'login' | 'logout' | 'signup' | 'login_failed' | 'password_reset' | 'role_change',
  message: string,
  user?: { uid?: string; id?: string; displayName?: string; name?: string; email?: string; role?: string; roles?: string[] } | null,
  extraDetails?: any
) {
  const sessionId = getOrCreateSessionId();
  const telemetry = await getClientTelemetry();

  const details = {
    action,
    sessionId,
    ip: telemetry.ip,
    location: telemetry.location,
    device: telemetry.device,
    ...extraDetails,
  };

  const isError = action === 'login_failed';
  await logSystemEvent(
    isError ? 'error' : 'auth',
    message,
    details,
    user,
    'auth'
  );
}

/**
 * Helper to log user session lifecycle events.
 */
export async function logSessionEvent(
  user: { uid?: string; id?: string; displayName?: string; name?: string; email?: string; role?: string; roles?: string[] },
  event: 'session_start' | 'session_heartbeat' | 'session_end' = 'session_start',
  extraDetails?: any
) {
  const sessionId = getOrCreateSessionId();
  const telemetry = await getClientTelemetry();

  const details = {
    event,
    sessionId,
    durationMinutes: getSessionDurationMinutes(),
    ip: telemetry.ip,
    location: telemetry.location,
    device: telemetry.device,
    ...extraDetails,
  };

  const roleLabel = user.role || (user.roles && user.roles.length > 0 ? user.roles[0] : 'traveller');
  const message =
    event === 'session_start'
      ? `User session started: ${user.displayName || user.email || 'User'} (${roleLabel})`
      : event === 'session_end'
      ? `User session ended: ${user.displayName || user.email || 'User'} (${getSessionDurationMinutes()} mins duration)`
      : `Session heartbeat for ${user.displayName || user.email || 'User'}`;

  await logSystemEvent(
    'session',
    message,
    details,
    user,
    'session'
  );
}

export async function getSystemLogs(limitCount = 100): Promise<SystemLog[]> {
  try {
    const q = query(collection(db, 'system_logs'), orderBy('timestamp', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map((doc) => normalizeSystemLog({ id: doc.id, ...doc.data() } as SystemLog));
  } catch (err) {
    console.error('Failed to get system logs:', err);
    return [];
  }
}

export function subscribeToSystemLogs(callback: (logs: SystemLog[]) => void, limitCount = 300) {
  const q = query(collection(db, 'system_logs'), orderBy('timestamp', 'desc'), limit(limitCount));
  return onSnapshot(
    q,
    (snap) => {
      const logs = snap.docs.map((doc) => normalizeSystemLog({ id: doc.id, ...doc.data() } as SystemLog));
      callback(logs);
    },
    (err) => {
      console.error('Failed to subscribe to system logs:', err);
    }
  );
}

export async function deleteSystemLog(logId: string) {
  try {
    await deleteDoc(doc(db, 'system_logs', logId));
  } catch (err) {
    console.error('Failed to delete system log:', err);
    throw err;
  }
}

export async function clearAllSystemLogs() {
  try {
    const q = query(collection(db, 'system_logs'), limit(500));
    const snap = await getDocs(q);

    if (snap.empty) return;

    const batch = writeBatch(db);
    snap.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
  } catch (err) {
    console.error('Failed to clear system logs:', err);
    throw err;
  }
}

// ================= USER SESSION BUNDLING =================

export interface SessionBundle {
  sessionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  startTime: number;
  lastActiveTime: number;
  durationMinutes: number;
  isActive: boolean;
  ip?: string;
  location?: ClientLocationTelemetry;
  device?: ClientDeviceTelemetry;
  events: SystemLog[];
  totalEvents: number;
  errorEvents: number;
  hasAuditActions: boolean;
}

export interface UserSessionGroup {
  userId: string;
  userKey: string;
  userName: string;
  userEmail: string;
  userRole: string;
  totalSessions: number;
  totalEvents: number;
  lastActiveTime: number;
  distinctLocations: string[];
  distinctDevices: string[];
  sessions: SessionBundle[];
}

/**
 * Bundles audit and system logs by User, and groups each user's operations into discrete sessions.
 */
export function bundleLogsByUser(logs: SystemLog[]): UserSessionGroup[] {
  const userMap: Record<string, {
    userId: string;
    userName: string;
    userEmail: string;
    userRole: string;
    sessionMap: Record<string, SystemLog[]>;
    standaloneLogs: SystemLog[];
  }> = {};

  const now = Date.now();

  logs.forEach((log) => {
    const normalized = normalizeSystemLog(log);
    const userId = normalized.userId || normalized.userEmail || 'system_anonymous';
    const userName = normalized.userName || (normalized.userEmail ? normalized.userEmail.split('@')[0] : 'System Core');
    const userEmail = normalized.userEmail || '';
    const userRole = normalized.userRole || (normalized.userId ? 'traveller' : 'System');

    if (!userMap[userId]) {
      userMap[userId] = {
        userId,
        userName,
        userEmail,
        userRole,
        sessionMap: {},
        standaloneLogs: [],
      };
    }

    // Keep user information as accurate as possible if later log has it
    if (normalized.userName && userMap[userId].userName === 'System Core') {
      userMap[userId].userName = normalized.userName;
    }
    if (normalized.userEmail && !userMap[userId].userEmail) {
      userMap[userId].userEmail = normalized.userEmail;
    }
    if (normalized.userRole && userMap[userId].userRole === 'System') {
      userMap[userId].userRole = normalized.userRole;
    }

    const sid = normalized.sessionId;
    if (sid) {
      if (!userMap[userId].sessionMap[sid]) {
        userMap[userId].sessionMap[sid] = [];
      }
      userMap[userId].sessionMap[sid].push(normalized);
    } else {
      userMap[userId].standaloneLogs.push(normalized);
    }
  });

  const userGroups: UserSessionGroup[] = [];

  Object.entries(userMap).forEach(([userKey, uData]) => {
    const sessions: SessionBundle[] = [];
    const locationSet = new Set<string>();
    const deviceSet = new Set<string>();
    let userTotalEvents = 0;
    let userLastActive = 0;

    // Process named sessions
    Object.entries(uData.sessionMap).forEach(([sessionId, sLogs]) => {
      // Sort logs chronologically
      sLogs.sort((a, b) => a.timestamp - b.timestamp);

      const startTime = sLogs[0].timestamp;
      const lastActiveTime = sLogs[sLogs.length - 1].timestamp;
      userLastActive = Math.max(userLastActive, lastActiveTime);
      userTotalEvents += sLogs.length;

      // Calculate duration: min 1 minute, or difference
      const diffMinutes = Math.max(1, Math.round((lastActiveTime - startTime) / 60000));
      // Active if event in the last 15 minutes
      const isActive = now - lastActiveTime < 15 * 60 * 1000;

      // Find best location and device from the session events
      let bestIp: string | undefined;
      let bestLocation: ClientLocationTelemetry | undefined;
      let bestDevice: ClientDeviceTelemetry | undefined;

      for (const log of sLogs) {
        if (!bestIp && log.ip && log.ip !== '127.0.0.1') bestIp = log.ip;
        if (!bestLocation && log.location && (log.location.city || log.location.country)) {
          bestLocation = log.location;
        }
        if (!bestDevice && log.device && log.device.os !== 'Server') {
          bestDevice = log.device;
        }
      }

      // If still missing, check any log
      if (!bestIp) bestIp = sLogs[0]?.ip;
      if (!bestLocation) bestLocation = sLogs[0]?.location;
      if (!bestDevice) bestDevice = sLogs[0]?.device;

      if (bestLocation) {
        const locStr = [bestLocation.flag, bestLocation.city, bestLocation.country].filter(Boolean).join(' ');
        if (locStr) locationSet.add(locStr);
      }
      if (bestDevice) {
        const devStr = `${bestDevice.type} (${bestDevice.os})`;
        deviceSet.add(devStr);
      }

      const errorEvents = sLogs.filter((l) => l.type === 'error' || l.status === 'Failed').length;
      const hasAuditActions = sLogs.some(
        (l) => l.category === 'admin' || l.category === 'security' || l.category === 'property' || l.category === 'booking'
      );

      sessions.push({
        sessionId,
        userId: uData.userId,
        userName: uData.userName,
        userEmail: uData.userEmail,
        userRole: uData.userRole,
        startTime,
        lastActiveTime,
        durationMinutes: diffMinutes,
        isActive,
        ip: bestIp,
        location: bestLocation,
        device: bestDevice,
        events: sLogs.reverse(), // reverse to display newest first in timeline
        totalEvents: sLogs.length,
        errorEvents,
        hasAuditActions,
      });
    });

    // If there were standalone events without sessionId, cluster them into a virtual bundle
    if (uData.standaloneLogs.length > 0) {
      uData.standaloneLogs.sort((a, b) => a.timestamp - b.timestamp);
      const startTime = uData.standaloneLogs[0].timestamp;
      const lastActiveTime = uData.standaloneLogs[uData.standaloneLogs.length - 1].timestamp;
      userLastActive = Math.max(userLastActive, lastActiveTime);
      userTotalEvents += uData.standaloneLogs.length;

      const diffMinutes = Math.max(1, Math.round((lastActiveTime - startTime) / 60000));
      const first = uData.standaloneLogs[0];

      if (first.location) {
        const locStr = [first.location.flag, first.location.city, first.location.country].filter(Boolean).join(' ');
        if (locStr) locationSet.add(locStr);
      }
      if (first.device) {
        deviceSet.add(`${first.device.type} (${first.device.os})`);
      }

      sessions.push({
        sessionId: 'sess_automated_' + userKey.substring(0, 6),
        userId: uData.userId,
        userName: uData.userName,
        userEmail: uData.userEmail,
        userRole: uData.userRole,
        startTime,
        lastActiveTime,
        durationMinutes: diffMinutes,
        isActive: now - lastActiveTime < 15 * 60 * 1000,
        ip: first.ip,
        location: first.location,
        device: first.device,
        events: uData.standaloneLogs.reverse(),
        totalEvents: uData.standaloneLogs.length,
        errorEvents: uData.standaloneLogs.filter((l) => l.type === 'error').length,
        hasAuditActions: uData.standaloneLogs.some(
          (l) => l.category === 'admin' || l.category === 'security' || l.category === 'property'
        ),
      });
    }

    // Sort user sessions descending by last active time
    sessions.sort((a, b) => b.lastActiveTime - a.lastActiveTime);

    userGroups.push({
      userId: uData.userId,
      userKey,
      userName: uData.userName,
      userEmail: uData.userEmail,
      userRole: uData.userRole,
      totalSessions: sessions.length,
      totalEvents: userTotalEvents,
      lastActiveTime: userLastActive,
      distinctLocations: Array.from(locationSet),
      distinctDevices: Array.from(deviceSet),
      sessions,
    });
  });

  // Sort user groups by newest activity first
  userGroups.sort((a, b) => b.lastActiveTime - a.lastActiveTime);

  return userGroups;
}
