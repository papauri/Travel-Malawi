/**
 * Request authentication for the Express API.
 *
 * Callers send their Firebase ID token as `Authorization: Bearer <token>`
 * (src/main.tsx attaches it to every same-origin /api request). The token is
 * verified with firebase-admin, which only needs the project ID — no service
 * account. Roles are read from `users/{uid}` through the Firestore REST API
 * using the caller's own token, so Firestore security rules still decide what
 * the server can see on the caller's behalf.
 */

import './envSanitizer';
import fs from 'fs';
import path from 'path';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { OWNER_EMAILS } from '../src/lib/roles';

export type ServerRole = 'traveller' | 'hotel_manager' | 'admin' | 'marketing' | 'global_admin';

export interface AuthUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  roles: ServerRole[];
  token: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

interface FirebaseClientConfig {
  projectId: string;
  firestoreDatabaseId?: string;
}

function loadClientConfig(): FirebaseClientConfig {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    return { projectId: parsed.projectId, firestoreDatabaseId: parsed.firestoreDatabaseId };
  } catch {
    return { projectId: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || '' };
  }
}

const config = loadClientConfig();
export const PROJECT_ID = config.projectId;
export const DATABASE_ID = config.firestoreDatabaseId || '(default)';

function adminAuth() {
  if (getApps().length === 0) {
    initializeApp({ projectId: PROJECT_ID });
  }
  return getAuth();
}

// ---------------------------------------------------------------------------
// Firestore REST helpers
// ---------------------------------------------------------------------------

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${encodeURIComponent(DATABASE_ID)}/documents`;

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

export function isSafeId(id: unknown): id is string {
  return typeof id === 'string' && SAFE_ID.test(id);
}

function decodeValue(v: any): any {
  if (!v || typeof v !== 'object') return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields || {});
  return undefined;
}

function decodeFields(fields: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) out[k] = decodeValue(v);
  return out;
}

/**
 * Reads one document. Returns null when it does not exist or the caller's
 * token (or anonymous access when no token) is not allowed to read it.
 */
export async function readDoc(
  collection: string,
  id: string,
  token?: string
): Promise<Record<string, any> | null> {
  if (!isSafeId(id)) return null;
  try {
    const res = await fetch(`${FIRESTORE_BASE}/${collection}/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return { id, ...decodeFields(data.fields || {}) };
  } catch (err) {
    console.error(`[auth] Firestore read failed for ${collection}/${id}:`, err);
    return null;
  }
}

/** Runs an equality query on a top-level collection. */
export async function queryDocs(
  collection: string,
  field: string,
  value: string,
  token?: string,
  limit = 5
): Promise<Record<string, any>[]> {
  try {
    const res = await fetch(`${FIRESTORE_BASE}:runQuery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: collection }],
          where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } },
          limit,
        },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const rows: any[] = await res.json();
    return rows
      .filter(r => r.document)
      .map(r => ({ id: String(r.document.name).split('/').pop(), ...decodeFields(r.document.fields || {}) }));
  } catch (err) {
    console.error(`[auth] Firestore query failed on ${collection}.${field}:`, err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

const ALL_ROLES: ServerRole[] = ['traveller', 'hotel_manager', 'admin', 'marketing', 'global_admin'];
const ROLE_CACHE_MS = 60_000;
const roleCache = new Map<string, { roles: ServerRole[]; at: number }>();

async function lookupRoles(uid: string, email: string | null, emailVerified: boolean, token: string): Promise<ServerRole[]> {
  const cached = roleCache.get(uid);
  if (cached && Date.now() - cached.at < ROLE_CACHE_MS) return cached.roles;

  const profile = await readDoc('users', uid, token);
  const roles = new Set<ServerRole>();
  if (profile) {
    if (Array.isArray(profile.roles)) {
      for (const r of profile.roles) if (ALL_ROLES.includes(r)) roles.add(r);
    }
    if (roles.size === 0 && ALL_ROLES.includes(profile.role)) roles.add(profile.role);
    // A suspended account keeps no privileges on the server.
    if (profile.accessRevoked === true || profile.status === 'suspended' || profile.status === 'revoked') {
      roles.clear();
    }
  }
  if (emailVerified && email && OWNER_EMAILS.includes(email.toLowerCase())) roles.add('global_admin');
  if (roles.size === 0) roles.add('traveller');

  const list = [...roles];
  roleCache.set(uid, { roles: list, at: Date.now() });
  return list;
}

export function hasAnyRole(user: AuthUser | undefined, ...roles: ServerRole[]): boolean {
  if (!user) return false;
  if (user.roles.includes('global_admin')) return true;
  return roles.some(r => user.roles.includes(r));
}

export function isAdminUser(user: AuthUser | undefined): boolean {
  return hasAnyRole(user, 'admin', 'global_admin');
}

/** The single role the AI layer understands. */
export function aiRoleFor(user: AuthUser): 'admin' | 'hotel_manager' {
  return isAdminUser(user) ? 'admin' : 'hotel_manager';
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

async function resolveUser(req: Request): Promise<AuthUser | undefined> {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return undefined;
  const token = match[1].trim();
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    const email = decoded.email ? decoded.email.toLowerCase() : null;
    const emailVerified = decoded.email_verified === true;
    const roles = await lookupRoles(decoded.uid, email, emailVerified, token);
    return { uid: decoded.uid, email, emailVerified, roles, token };
  } catch {
    return undefined;
  }
}

/** Attaches req.authUser when a valid token is present; never rejects. */
export const optionalAuth: RequestHandler = async (req, _res, next) => {
  req.authUser = await resolveUser(req);
  next();
};

/** Rejects with 401 unless a valid Firebase ID token is present. */
export const requireAuth: RequestHandler = async (req, res, next) => {
  const user = req.authUser ?? (await resolveUser(req));
  if (!user) {
    res.status(401).json({ error: 'Please sign in to continue.' });
    return;
  }
  req.authUser = user;
  next();
};

/** Rejects with 401/403 unless the caller holds one of the roles (global_admin always passes). */
export function requireRole(...roles: ServerRole[]): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.authUser ?? (await resolveUser(req));
    if (!user) {
      res.status(401).json({ error: 'Please sign in to continue.' });
      return;
    }
    req.authUser = user;
    if (!hasAnyRole(user, ...roles)) {
      res.status(403).json({ error: 'You do not have permission to do this.' });
      return;
    }
    next();
  };
}

/** Hotel contact addresses a notification may go to. */
export function hotelEmails(hotel: Record<string, any> | null): string[] {
  if (!hotel) return [];
  return [hotel.managerEmail, hotel.contactEmail, hotel.ownerEmail]
    .filter((e): e is string => typeof e === 'string' && e.includes('@'))
    .map(e => e.trim().toLowerCase());
}

/**
 * True when the caller manages the hotel (managerId match, or a verified email
 * matching managerEmail/ownerEmail) or is an admin. Unassigned hotels belong
 * to nobody.
 */
export async function canManageHotel(user: AuthUser | undefined, hotelId: unknown): Promise<boolean> {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  if (!isSafeId(hotelId)) return false;
  const hotel = await readDoc('hotels', hotelId, user.token);
  if (!hotel) return false;
  if (hotel.managerId && hotel.managerId === user.uid) return true;
  if (user.email && user.emailVerified) {
    const owners = [hotel.managerEmail, hotel.ownerEmail]
      .filter((e): e is string => typeof e === 'string')
      .map(e => e.toLowerCase());
    if (owners.includes(user.email)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Rate limiting (in-memory, per instance)
// ---------------------------------------------------------------------------

/** Client address as resolved by Express (`trust proxy` is set to one hop). */
export function clientIp(req: Request): string {
  const ip = (req.ip || req.socket.remoteAddress || '').trim();
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip || 'unknown';
}

/**
 * Fixed-window limiter. Keyed by signed-in uid when present, otherwise by IP.
 * Responds 429 with a retryAfter (seconds) when the window is exhausted.
 */
export function rateLimit(opts: { name: string; windowMs: number; max: number; key?: (req: Request) => string }): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, Math.max(opts.windowMs, 60_000)).unref();

  return (req, res, next) => {
    const key = opts.key ? opts.key(req) : req.authUser ? `u:${req.authUser.uid}` : `ip:${clientIp(req)}`;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + opts.windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    if (entry.count > opts.max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.', retryAfter });
      return;
    }
    next();
  };
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

export function escapeHtml(text: unknown): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Trims, caps length, and (for single-line fields) strips line breaks. */
export function cleanText(value: unknown, max: number, singleLine = false): string {
  let s = String(value ?? '').trim();
  if (singleLine) s = s.replace(/[\r\n]+/g, ' ');
  return s.length > max ? s.slice(0, max) : s;
}

export function digitsOnly(phone: unknown): string {
  return String(phone ?? '').replace(/\D/g, '');
}

/** Compares phone numbers by their last 9 digits, ignoring country prefixes. */
export function samePhone(a: unknown, b: unknown): boolean {
  const da = digitsOnly(a);
  const db = digitsOnly(b);
  if (da.length < 7 || db.length < 7) return false;
  return da.slice(-9) === db.slice(-9);
}
