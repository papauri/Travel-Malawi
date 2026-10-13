import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface ManagerHabit {
  id: string;
  category: 'pricing' | 'routine' | 'communication' | 'property_rule' | 'hospitality';
  text: string;
  learnedAt: number;
  source: 'observed' | 'explicit';
  confidence: number;
}

export interface ManagerHabitsProfile {
  userId: string;
  preferredName?: string;
  communicationStyle: 'casual_friendly' | 'brief_curt' | 'detailed_executive';
  currencyPreference: 'MWK' | 'USD';
  familiarityScore: number;
  familiarityTier: 'New Friend' | 'Trusted Partner' | 'Resident Ally';
  habits: ManagerHabit[];
  lastActive: number;
}

const STORAGE_KEY_PREFIX = 'tm_manager_habits_';

export function calculateFamiliarityTier(score: number): 'New Friend' | 'Trusted Partner' | 'Resident Ally' {
  if (score >= 12) return 'Resident Ally';
  if (score >= 4) return 'Trusted Partner';
  return 'New Friend';
}

/**
 * Retrieves the local manager habits profile, initializing sensible defaults if not found.
 */
export function getManagerHabits(userId: string = 'global', displayName?: string): ManagerHabitsProfile {
  if (typeof window === 'undefined') {
    return {
      userId,
      preferredName: displayName,
      communicationStyle: 'casual_friendly',
      currencyPreference: 'MWK',
      familiarityScore: 1,
      familiarityTier: 'New Friend',
      habits: [],
      lastActive: Date.now(),
    };
  }

  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const score = (parsed.familiarityScore || 0) + 1;
        return {
          ...parsed,
          preferredName: parsed.preferredName || displayName,
          familiarityScore: score,
          familiarityTier: calculateFamiliarityTier(score),
          habits: Array.isArray(parsed.habits) ? parsed.habits : [],
        };
      }
    }
  } catch {}

  const defaultProfile: ManagerHabitsProfile = {
    userId,
    preferredName: displayName || '',
    communicationStyle: 'casual_friendly',
    currencyPreference: 'MWK',
    familiarityScore: 1,
    familiarityTier: 'New Friend',
    habits: [
      {
        id: 'habit_seed_1',
        category: 'pricing',
        text: 'Always keeps room rates cleanly rounded (nearest MK 5,000 or whole $5 USD)',
        learnedAt: Date.now(),
        source: 'explicit',
        confidence: 0.9,
      },
      {
        id: 'habit_seed_2',
        category: 'routine',
        text: 'Prioritizes checking today arrivals and room preparation first thing in the morning',
        learnedAt: Date.now(),
        source: 'explicit',
        confidence: 0.85,
      },
    ],
    lastActive: Date.now(),
  };

  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(defaultProfile));
  } catch {}

  return defaultProfile;
}

/**
 * Saves and updates the manager habits profile locally and queues async cloud backup.
 */
export function saveManagerHabits(profile: ManagerHabitsProfile): void {
  if (typeof window === 'undefined') return;
  profile.lastActive = Date.now();
  profile.familiarityTier = calculateFamiliarityTier(profile.familiarityScore);

  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${profile.userId}`, JSON.stringify(profile));
  } catch (e) {
    console.warn('Failed to save manager habits locally:', e);
  }

  // Cloud sync if authenticated user
  if (profile.userId && profile.userId !== 'global') {
    setDoc(doc(db, 'manager_habits', profile.userId), profile, { merge: true })
      .catch(err => console.warn('Could not sync manager habits to cloud:', err));
  }
}

/**
 * Pulls and reconciles habits from Firestore for multi-device synchronization.
 */
export async function syncManagerHabitsWithCloud(userId: string): Promise<ManagerHabitsProfile | null> {
  if (!userId || userId === 'global') return null;

  try {
    const snap = await getDoc(doc(db, 'manager_habits', userId));
    if (snap.exists()) {
      const cloudData = snap.data() as ManagerHabitsProfile;
      const local = getManagerHabits(userId);
      const mergedScore = Math.max(local.familiarityScore, cloudData.familiarityScore || 0);

      // Merge habits list by text
      const map = new Map<string, ManagerHabit>();
      (local.habits || []).forEach(h => map.set(h.text.toLowerCase().trim(), h));
      (cloudData.habits || []).forEach(h => map.set(h.text.toLowerCase().trim(), h));

      const mergedProfile: ManagerHabitsProfile = {
        ...local,
        ...cloudData,
        preferredName: cloudData.preferredName || local.preferredName,
        currencyPreference: cloudData.currencyPreference || local.currencyPreference,
        communicationStyle: cloudData.communicationStyle || local.communicationStyle,
        familiarityScore: mergedScore,
        familiarityTier: calculateFamiliarityTier(mergedScore),
        habits: Array.from(map.values()),
        lastActive: Date.now(),
      };

      saveManagerHabits(mergedProfile);
      return mergedProfile;
    }
  } catch (err) {
    console.warn('Cloud sync error for manager habits:', err);
  }

  return null;
}

/**
 * Analyzes manager message to discover and save habits, preferences, and personal touches over time.
 */
export function observeAndLearnHabits(
  userId: string,
  message: string,
  currentProfile?: ManagerHabitsProfile
): { profile: ManagerHabitsProfile; discoveredHabit: string | null } {
  const profile = currentProfile || getManagerHabits(userId);
  const clean = (message || '').trim();
  const lower = clean.toLowerCase();

  let discoveredHabit: string | null = null;

  // 1. Preferred Name Learning ("call me Davie", "I'm Davie", "my name is Davie")
  const nameMatch = lower.match(/(?:call me|my name is|i am|i'm|name's)\s+([a-zA-Z]{2,20})\b/i);
  if (nameMatch && !['the', 'manager', 'host', 'busy', 'good', 'fine', 'ready', 'ulendo', 'asking', 'checking'].includes(nameMatch[1].toLowerCase())) {
    const extractedName = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1).toLowerCase();
    if (profile.preferredName !== extractedName) {
      profile.preferredName = extractedName;
      discoveredHabit = `Learned your preferred name: ${extractedName}`;
    }
  }

  // 2. Currency Preference Learning
  if (lower.includes('only kwacha') || lower.includes('in kwacha') || lower.includes('use mwk') || lower.includes('show mwk') || lower.includes('think in kwacha')) {
    if (profile.currencyPreference !== 'MWK') {
      profile.currencyPreference = 'MWK';
      discoveredHabit = 'Learned currency preference: Malawian Kwacha (MWK)';
    }
  } else if (lower.includes('only usd') || lower.includes('in dollars') || lower.includes('use usd') || lower.includes('quote in usd')) {
    if (profile.currencyPreference !== 'USD') {
      profile.currencyPreference = 'USD';
      discoveredHabit = 'Learned currency preference: US Dollars (USD)';
    }
  }

  // 3. Communication Style Learning
  if (lower.includes('keep it short') || lower.includes('be brief') || lower.includes('quick bullet') || lower.includes('too long') || lower.includes('less text')) {
    if (profile.communicationStyle !== 'brief_curt') {
      profile.communicationStyle = 'brief_curt';
      discoveredHabit = 'Learned style preference: Brief, concise summaries';
    }
  } else if (lower.includes('be casual') || lower.includes('talk like a friend') || lower.includes('chat normally') || lower.includes('relaxed')) {
    if (profile.communicationStyle !== 'casual_friendly') {
      profile.communicationStyle = 'casual_friendly';
      discoveredHabit = 'Learned style preference: Warm, casual friend conversation';
    }
  }

  // 4. Operational Habits & Lodge Rules
  const habitPatterns = [
    { regex: /(?:our checkout is|checkout at|check-out is)\s*([0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm)?)/i, category: 'property_rule' as const, label: 'Checkout time is' },
    { regex: /(?:our checkin is|check-in is|check in starts at)\s*([0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm)?)/i, category: 'property_rule' as const, label: 'Check-in time is' },
    { regex: /(?:we always|we usually|i always)\s+(.{10,80})/i, category: 'routine' as const, label: 'Lodge routine:' },
    { regex: /(?:we don't|we never|do not allow)\s+(.{10,80})/i, category: 'property_rule' as const, label: 'Lodge policy:' },
    { regex: /(?:boat departs|boat leaves|safari starts at)\s*([0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm)?)/i, category: 'hospitality' as const, label: 'Excursion schedule:' }
  ];

  for (const p of habitPatterns) {
    const match = clean.match(p.regex);
    if (match) {
      const detail = match[1]?.trim();
      if (detail && detail.length > 2) {
        const habitText = `${p.label} ${detail}`;
        const alreadyExists = profile.habits.some(h => h.text.toLowerCase() === habitText.toLowerCase());
        if (!alreadyExists) {
          const newHabit: ManagerHabit = {
            id: `habit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            category: p.category,
            text: habitText,
            learnedAt: Date.now(),
            source: 'observed',
            confidence: 0.9,
          };
          profile.habits = [newHabit, ...profile.habits].slice(0, 15);
          discoveredHabit = `Noted new lodge habit: "${habitText}"`;
          break;
        }
      }
    }
  }

  // Increment familiarity score
  profile.familiarityScore = (profile.familiarityScore || 1) + 1;
  saveManagerHabits(profile);

  return { profile, discoveredHabit };
}

/**
 * Returns a warm, authentic, natural friend greeting grounded in Malawian hospitality.
 */
export function generateNaturalGreeting(
  profile: ManagerHabitsProfile,
  properties: any[] = [],
  todayStr?: string
): string {
  const name = profile.preferredName ? profile.preferredName : '';
  const now = new Date();
  const hour = now.getHours();

  const propName = properties[0]?.name || 'your lodge';

  // Time-of-day natural Malawian greeting
  if (hour >= 5 && hour < 12) {
    if (name) {
      return `Mwauka bwanji ${name}! Good morning! Hope you had a peaceful night. Everything quiet over at ${propName}, or ready to check on today's arrivals and lakeside plans?`;
    }
    return `Mwauka bwanji! Good morning! Hope you had a peaceful night. I'm right here with you across ${propName}—ready for whatever the day brings. Anything on your mind this morning?`;
  }

  if (hour >= 12 && hour < 17) {
    if (name) {
      return `Good afternoon ${name}! Hope the day is treating you well over at ${propName}. Taking a breather, or need a quick hand checking checkouts or guest requests?`;
    }
    return `Good afternoon! Hope the day is running smoothly over at ${propName}. Right here beside you—what can we tackle together this afternoon?`;
  }

  // Evening
  if (name) {
    return `Madzulo abwino ${name}! Hope it was a fruitful day. Winding down for the evening, or should we review tomorrow's reservations before you call it a day?`;
  }
  return `Madzulo abwino! Hope you had a productive day across ${propName}. Right here if you need to review tomorrow's arrivals or update anything before heading off!`;
}
