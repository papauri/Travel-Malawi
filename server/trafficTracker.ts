import { Request } from 'express';
import { clientIp } from './auth';

export interface TrafficDeviceTelemetry {
  type: 'Mobile' | 'Tablet' | 'Desktop';
  os: string;
  browser: string;
  screen?: string;
  language?: string;
  timezone?: string;
}

export interface TrafficLocationTelemetry {
  ip?: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  flag?: string;
  timezone?: string;
  org?: string;
}

export type VisitorIntentCategory =
  | 'booking_intent'
  | 'exploring_stays'
  | 'host_inquiry'
  | 'price_comparing'
  | 'reading_guide'
  | 'casual_browse'
  | 'bounced';

export interface JourneyStep {
  path: string;
  title: string;
  dwellSeconds: number;
  enteredAt: number;
  leftAt?: number;
  interactions: number;
  hotelId?: string;
  hotelName?: string;
}

export interface TrafficSession {
  sessionId: string;
  visitorId: string;
  isAnonymous: boolean;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  
  // Real-time Presence & Waiting
  status: 'active' | 'waiting' | 'idle' | 'background' | 'exited';
  currentPath: string;
  currentTitle: string;
  currentWaitSeconds: number; // Waiting/dwell seconds on current page
  totalSessionSeconds: number; // Total dwell seconds across session
  activeSeconds: number; // Actively interacting seconds
  idleSeconds: number; // Inactive or background waiting seconds
  
  // Telemetry
  ip: string;
  location: TrafficLocationTelemetry;
  device: TrafficDeviceTelemetry;
  referrer?: string;
  
  // Intelligent Monitoring Signals
  intent: VisitorIntentCategory;
  intentScore: number; // 0 - 100
  intentSummary: string;
  conversionLikelihood: 'High' | 'Medium' | 'Low';
  
  // Journey History
  steps: JourneyStep[];
  totalPageViews: number;
  totalInteractions: number;
  
  // Timing
  startedAt: number;
  lastActiveAt: number;
  lastHeartbeatAt: number;
}

export interface TrafficSummary {
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
}

// In-memory rolling store for low latency & real-time monitoring
class TrafficTrackerStore {
  private sessions: Map<string, TrafficSession> = new Map();
  private maxSessions = 1500;
  private geoCache: Map<string, TrafficLocationTelemetry> = new Map();

  constructor() {
    // Periodic sweep of stale sessions (mark as exited after 15m of no heartbeat)
    setInterval(() => {
      this.sweepStaleSessions();
    }, 60000);
  }

  private sweepStaleSessions() {
    const now = Date.now();
    const expiryMs = 25 * 60 * 1000; // 25 mins idle = exited

    for (const [sid, session] of this.sessions.entries()) {
      if (now - session.lastHeartbeatAt > expiryMs) {
        session.status = 'exited';
      }
    }

    // Drop anything older than 24h (the admin view reports a 24h window)
    const dayMs = 24 * 60 * 60 * 1000;
    for (const [sid, session] of this.sessions.entries()) {
      if (now - session.lastHeartbeatAt > dayMs) this.sessions.delete(sid);
    }
    if (this.geoCache.size > 2000) this.geoCache.clear();

    this.trimToCapacity();
  }

  private trimToCapacity() {
    // Trim store if exceeds maximum capacity
    if (this.sessions.size > this.maxSessions) {
      const sorted = Array.from(this.sessions.entries()).sort(
        (a, b) => a[1].lastHeartbeatAt - b[1].lastHeartbeatAt
      );
      const toRemove = sorted.slice(0, this.sessions.size - this.maxSessions);
      for (const [sid] of toRemove) {
        this.sessions.delete(sid);
      }
    }
  }

  public getCountryFlag(code?: string): string {
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

  public async resolveGeo(ip: string): Promise<TrafficLocationTelemetry> {
    const isPrivate =
      !ip ||
      ip === 'unknown' ||
      ip === '127.0.0.1' ||
      ip === '::1' ||
      ip.startsWith('10.') ||
      ip.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(ip);

    if (isPrivate) {
      return {
        ip: ip || '127.0.0.1',
        city: 'Lilongwe',
        region: 'Central Region',
        country: 'Malawi',
        countryCode: 'MW',
        flag: '🇲🇼',
        timezone: 'Africa/Blantyre',
        org: 'Local Development Network',
      };
    }

    if (this.geoCache.has(ip)) {
      return this.geoCache.get(ip)!;
    }

    try {
      const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
        headers: { 'User-Agent': 'TravelMalawi-TrafficMonitor/1.0' },
        signal: AbortSignal.timeout(2000),
      });

      if (res.ok) {
        const data = await res.json();
        if (!data.error) {
          const loc: TrafficLocationTelemetry = {
            ip,
            city: data.city || 'Unknown',
            region: data.region || '',
            country: data.country_name || 'Malawi',
            countryCode: data.country_code || 'MW',
            flag: this.getCountryFlag(data.country_code),
            timezone: data.timezone || 'Africa/Blantyre',
            org: data.org || '',
          };
          this.geoCache.set(ip, loc);
          return loc;
        }
      }
    } catch {
      // Fallback
    }

    const fallbackLoc: TrafficLocationTelemetry = {
      ip,
      city: 'Unknown',
      country: 'Malawi',
      countryCode: 'MW',
      flag: '🇲🇼',
      timezone: 'Africa/Blantyre',
    };
    this.geoCache.set(ip, fallbackLoc);
    return fallbackLoc;
  }

  /**
   * Intelligently computes visitor intent and conversion score based on journey
   */
  public computeIntelligentIntent(
    path: string,
    currentWaitSecs: number,
    totalWaitSecs: number,
    steps: JourneyStep[],
    extraContext?: any
  ): {
    intent: VisitorIntentCategory;
    intentScore: number;
    intentSummary: string;
    conversionLikelihood: 'High' | 'Medium' | 'Low';
  } {
    const isHotelDetail = path.startsWith('/hotel/') || steps.some((s) => s.path.startsWith('/hotel/'));
    const isListProperty = path.includes('list-your-property') || path.includes('host-guide') || path.includes('marketing');
    const isBookings = path.includes('booking') || path.includes('trip');
    const isComparing = path.includes('saved') || extraContext?.comparedCount > 0;
    const hasCheckedDates = !!extraContext?.hasDatesSelected || steps.some((s) => s.interactions > 3);

    // Look for hotel name in context or steps
    const targetedHotel =
      extraContext?.hotelName ||
      steps.find((s) => s.hotelName)?.hotelName ||
      (path.startsWith('/hotel/') ? path.replace('/hotel/', '').replace(/-/g, ' ') : null);

    if (isHotelDetail) {
      if (hasCheckedDates || currentWaitSecs > 75 || totalWaitSecs > 180) {
        const score = Math.min(98, 70 + Math.floor(currentWaitSecs / 10) + (hasCheckedDates ? 15 : 0));
        return {
          intent: 'booking_intent',
          intentScore: score,
          intentSummary: targetedHotel
            ? `High booking intent for ${targetedHotel} · Checked rates & waiting on dates`
            : 'Active stay selection · Evaluating availability and rates',
          conversionLikelihood: score >= 80 ? 'High' : 'Medium',
        };
      }
      return {
        intent: 'booking_intent',
        intentScore: 62,
        intentSummary: targetedHotel
          ? `Browsing ${targetedHotel} gallery & amenities (${Math.round(currentWaitSecs)}s dwell)`
          : 'Viewing lodge details & rates',
        conversionLikelihood: 'Medium',
      };
    }

    if (isListProperty) {
      return {
        intent: 'host_inquiry',
        intentScore: 78,
        intentSummary: 'Prospective property manager / host reading onboarding guides',
        conversionLikelihood: 'High',
      };
    }

    if (isComparing) {
      return {
        intent: 'price_comparing',
        intentScore: 65,
        intentSummary: 'Comparing prices, amenities and locations across multiple stays',
        conversionLikelihood: 'Medium',
      };
    }

    if (steps.length > 2) {
      return {
        intent: 'exploring_stays',
        intentScore: 50,
        intentSummary: `Exploring Malawi destinations (${steps.length} stops visited · ${Math.round(totalWaitSecs / 60)}m active)`,
        conversionLikelihood: 'Medium',
      };
    }

    if (totalWaitSecs < 15 && steps.length <= 1) {
      return {
        intent: 'casual_browse',
        intentScore: 20,
        intentSummary: 'Just landed on homepage · Initial navigation',
        conversionLikelihood: 'Low',
      };
    }

    return {
      intent: 'casual_browse',
      intentScore: 35,
      intentSummary: 'Browsing Travel Malawi platform catalog',
      conversionLikelihood: 'Low',
    };
  }

  /**
   * Records or updates a real-time visitor traffic heartbeat
   */
  public async ingestTrafficPing(req: Request, payload: any): Promise<TrafficSession> {
    const now = Date.now();
    // The caller's address always comes from the connection, never from the body.
    const ip = clientIp(req) || '127.0.0.1';

    const clip = (value: unknown, max: number): string => String(value ?? '').slice(0, max);
    const clipOpt = (value: unknown, max: number): string | undefined => (value ? clip(value, max) : undefined);
    const num = (value: unknown, max: number): number => {
      const n = Number(value);
      return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0;
    };

    const sessionId: string = clip(payload.sessionId || 'sess_anon_' + Math.random().toString(36).slice(2, 9), 80);
    const visitorId: string = clip(payload.visitorId || 'anon_' + Math.random().toString(36).slice(2, 9), 80);

    // Identity comes from the verified token (optionalAuth), not from what the client claims.
    const authUser = req.authUser;
    const userId: string | null = authUser?.uid || null;
    const isAnonymous = !userId;
    const userEmail: string | null = authUser?.email || null;
    const userName: string | null = authUser ? clipOpt(payload.userName, 120) || userEmail : null;
    const userRole: string | null = authUser ? authUser.roles?.[0] || 'Traveller' : null;

    const path: string = clip(payload.path || '/', 200);
    const title: string = clip(payload.title || 'Travel Malawi', 150);
    const currentWaitSeconds: number = num(payload.dwellSeconds, 86400);
    const allowedStatuses = ['active', 'waiting', 'idle', 'background', 'exited'];
    const incomingStatus: TrafficSession['status'] = allowedStatuses.includes(payload.waitingStatus)
      ? payload.waitingStatus
      : currentWaitSeconds > 60 ? 'waiting' : 'active';
    const hotelId = clipOpt(payload.hotelId, 120);
    const hotelName = clipOpt(payload.hotelName, 150);
    const interactions = Math.max(1, Math.round(num(payload.interactions, 100000)));
    const interactionsDelta = Math.round(num(payload.interactionsDelta, 10000));

    // Resolve or retrieve geo location (client-supplied values are length-capped text only)
    const claimed = payload.location && typeof payload.location === 'object' ? payload.location : {};
    let location: TrafficLocationTelemetry = {
      ip,
      city: clipOpt(claimed.city, 80),
      region: clipOpt(claimed.region, 80),
      country: clipOpt(claimed.country, 80),
      countryCode: clipOpt(claimed.countryCode, 2),
      flag: clipOpt(claimed.flag, 8),
      timezone: clipOpt(claimed.timezone, 60),
      org: clipOpt(claimed.org, 120),
    };
    if (!location.country || !location.city) {
      location = await this.resolveGeo(ip);
    }
    if (!location.flag && location.countryCode) {
      location.flag = this.getCountryFlag(location.countryCode);
    }

    const claimedDevice = payload.device && typeof payload.device === 'object' ? payload.device : {};
    const device: TrafficDeviceTelemetry = {
      type: ['Mobile', 'Tablet', 'Desktop'].includes(claimedDevice.type) ? claimedDevice.type : 'Desktop',
      os: clip(claimedDevice.os || 'Unknown', 60),
      browser: clip(claimedDevice.browser || 'Web', 60),
      screen: clipOpt(claimedDevice.screen, 30),
      language: clipOpt(claimedDevice.language, 20),
      timezone: clipOpt(claimedDevice.timezone, 60),
    };

    let session = this.sessions.get(sessionId);

    if (!session) {
      // New visitor session
      const step: JourneyStep = {
        path,
        title,
        dwellSeconds: currentWaitSeconds,
        enteredAt: now,
        interactions,
        hotelId,
        hotelName,
      };

      const intelligent = this.computeIntelligentIntent(
        path,
        currentWaitSeconds,
        currentWaitSeconds,
        [step],
        payload
      );

      session = {
        sessionId,
        visitorId,
        isAnonymous,
        userId,
        userName: userName || (isAnonymous ? `Guest · ${visitorId.slice(-4)}` : null),
        userEmail,
        userRole: userRole || 'Anonymous Visitor',
        status: incomingStatus,
        currentPath: path,
        currentTitle: title,
        currentWaitSeconds,
        totalSessionSeconds: currentWaitSeconds,
        activeSeconds: incomingStatus === 'active' ? currentWaitSeconds : Math.max(0, currentWaitSeconds - 10),
        idleSeconds: incomingStatus === 'idle' ? currentWaitSeconds : 0,
        ip,
        location,
        device,
        referrer: payload.referrer ? String(payload.referrer).slice(0, 250) : undefined,
        intent: intelligent.intent,
        intentScore: intelligent.intentScore,
        intentSummary: intelligent.intentSummary,
        conversionLikelihood: intelligent.conversionLikelihood,
        steps: [step],
        totalPageViews: 1,
        totalInteractions: interactions,
        startedAt: now - Math.round(currentWaitSeconds * 1000),
        lastActiveAt: now,
        lastHeartbeatAt: now,
      };

      this.sessions.set(sessionId, session);
      if (this.sessions.size > this.maxSessions) this.trimToCapacity();
      return session;
    }

    // Existing session update
    const previousWait = session.currentWaitSeconds;
    const waitDelta = Math.max(0, currentWaitSeconds - previousWait);

    session.lastHeartbeatAt = now;
    session.currentWaitSeconds = currentWaitSeconds;
    session.totalSessionSeconds += waitDelta;

    if (incomingStatus === 'active') {
      session.activeSeconds += waitDelta;
      session.lastActiveAt = now;
      session.status = 'active';
    } else if (incomingStatus === 'waiting') {
      session.status = 'waiting';
    } else if (incomingStatus === 'idle' || incomingStatus === 'background') {
      session.idleSeconds += waitDelta;
      session.status = incomingStatus;
    } else if (incomingStatus === 'exited') {
      session.status = 'exited';
    }

    // Path change detected (new stop in journey)
    if (session.currentPath !== path) {
      // Close previous step
      if (session.steps.length > 0) {
        const lastStep = session.steps[session.steps.length - 1];
        lastStep.leftAt = now;
        lastStep.dwellSeconds = previousWait;
      }

      session.steps.push({
        path,
        title,
        dwellSeconds: currentWaitSeconds,
        enteredAt: now,
        interactions,
        hotelId,
        hotelName,
      });
      if (session.steps.length > 60) session.steps.splice(0, session.steps.length - 60);

      session.currentPath = path;
      session.currentTitle = title;
      session.totalPageViews += 1;
    } else {
      // Update current step
      if (session.steps.length > 0) {
        const lastStep = session.steps[session.steps.length - 1];
        lastStep.dwellSeconds = currentWaitSeconds;
        lastStep.interactions = (lastStep.interactions || 0) + interactionsDelta;
        if (hotelName && !lastStep.hotelName) lastStep.hotelName = hotelName;
      }
    }

    // Link user if authenticated mid-session
    if (userId && session.isAnonymous) {
      session.isAnonymous = false;
      session.userId = userId;
      session.userName = userName || session.userName;
      session.userEmail = userEmail || session.userEmail;
      session.userRole = userRole || 'Traveller';
    }

    // Recompute intelligent intent
    const intelligent = this.computeIntelligentIntent(
      path,
      session.currentWaitSeconds,
      session.totalSessionSeconds,
      session.steps,
      payload
    );
    session.intent = intelligent.intent;
    session.intentScore = intelligent.intentScore;
    session.intentSummary = intelligent.intentSummary;
    session.conversionLikelihood = intelligent.conversionLikelihood;
    session.totalInteractions += interactionsDelta;

    return session;
  }

  /**
   * Returns live traffic summary and metrics for admin view
   */
  public getLiveTrafficSummary(): {
    summary: TrafficSummary;
    activeSessions: TrafficSession[];
    recentSessions: TrafficSession[];
  } {
    const now = Date.now();
    const activeWindow = 5 * 60 * 1000; // active in last 5 minutes

    const allSessions = Array.from(this.sessions.values()).sort(
      (a, b) => b.lastHeartbeatAt - a.lastHeartbeatAt
    );

    const activeSessions = allSessions.filter(
      (s) => now - s.lastHeartbeatAt <= activeWindow && s.status !== 'exited'
    );

    const anonymousNow = activeSessions.filter((s) => s.isAnonymous).length;
    const authenticatedNow = activeSessions.length - anonymousNow;

    const totalWait = activeSessions.reduce((sum, s) => sum + s.currentWaitSeconds, 0);
    const avgWaitSeconds = activeSessions.length > 0 ? Math.round(totalWait / activeSessions.length) : 0;
    const longestWaitSeconds = activeSessions.reduce(
      (max, s) => Math.max(max, s.currentWaitSeconds),
      0
    );

    const highIntentCount = activeSessions.filter((s) => s.conversionLikelihood === 'High').length;

    // Top properties with waiting traffic
    const propMap: Map<string, { id: string; name: string; count: number; totalWait: number }> = new Map();
    for (const s of allSessions) {
      for (const step of s.steps) {
        if (step.hotelName || step.hotelId) {
          const key = step.hotelId || step.hotelName!;
          const curr = propMap.get(key) || {
            id: step.hotelId || key,
            name: step.hotelName || key,
            count: 0,
            totalWait: 0,
          };
          curr.count += 1;
          curr.totalWait += step.dwellSeconds;
          propMap.set(key, curr);
        }
      }
    }

    const topProperties = Array.from(propMap.values())
      .map((p) => ({
        id: p.id,
        name: p.name,
        count: p.count,
        avgWait: p.count > 0 ? Math.round(p.totalWait / p.count) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Geographies
    const geoMap: Map<string, { country: string; flag: string; count: number }> = new Map();
    for (const s of activeSessions) {
      const country = s.location.country || 'Malawi';
      const flag = s.location.flag || '🇲🇼';
      const curr = geoMap.get(country) || { country, flag, count: 0 };
      curr.count += 1;
      geoMap.set(country, curr);
    }

    const totalActive = Math.max(1, activeSessions.length);
    const geoBreakdown = Array.from(geoMap.values())
      .map((g) => ({
        country: g.country,
        flag: g.flag,
        count: g.count,
        percent: Math.round((g.count / totalActive) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    // Devices
    const devMap: Map<string, number> = new Map();
    for (const s of activeSessions) {
      const type = s.device?.type || 'Desktop';
      devMap.set(type, (devMap.get(type) || 0) + 1);
    }
    const deviceBreakdown = Array.from(devMap.entries()).map(([type, count]) => ({
      type,
      count,
      percent: Math.round((count / totalActive) * 100),
    }));

    // Intent distribution
    const intentBreakdown: Record<string, number> = {};
    for (const s of activeSessions) {
      intentBreakdown[s.intent] = (intentBreakdown[s.intent] || 0) + 1;
    }

    return {
      summary: {
        activeNow: activeSessions.length,
        anonymousNow,
        authenticatedNow,
        avgWaitSeconds,
        longestWaitSeconds,
        highIntentCount,
        topProperties,
        geoBreakdown,
        deviceBreakdown,
        intentBreakdown,
        totalMonitored24h: allSessions.length,
      },
      activeSessions: activeSessions.slice(0, 100),
      recentSessions: allSessions.slice(0, 150),
    };
  }

  public clearSessions(): void {
    this.sessions.clear();
  }
}

export const trafficTracker = new TrafficTrackerStore();
