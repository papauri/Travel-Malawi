import { db } from './firebase';
import { collection, doc, setDoc, deleteDoc, getDocs, query, where, orderBy } from 'firebase/firestore';

export interface LearnedDirective {
  id: string;
  text: string;
  createdAt: number;
  authorRole?: 'admin' | 'hotel_manager';
  userId?: string;
}

const STORAGE_PREFIX = 'tm_ai_directives_';

const DEFAULT_DIRECTIVES: Omit<LearnedDirective, 'id' | 'createdAt'>[] = [
  {
    text: 'Standard Malawi lodge check-in begins at 14:00; checkout is at 10:00 AM unless early/late arrangement is noted.',
  },
  {
    text: 'Always clarify if boat transfers, park conservation fees, or meal packages (like breakfast) are included in quoted lodge room rates.',
  },
  {
    text: 'Prioritize USD for international travel inquiries and MWK for domestic resident reservations when requested.',
  },
];

export function getLearnedDirectives(userId: string = 'global'): LearnedDirective[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    // Seed defaults if empty
    const seeded: LearnedDirective[] = DEFAULT_DIRECTIVES.map((d, index) => ({
      id: `seed_${index + 1}`,
      text: d.text,
      createdAt: Date.now() - (index * 60000),
      userId,
    }));
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(seeded));
    return seeded;
  } catch {
    return [];
  }
}

/**
 * Syncs directives with Firestore cloud storage for cross-session & multi-device persistence.
 */
export async function syncDirectivesWithCloud(userId: string = 'global'): Promise<LearnedDirective[]> {
  const local = getLearnedDirectives(userId);
  if (!userId || userId === 'global') return local;

  try {
    const q = query(
      collection(db, 'ai_directives'),
      where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    const cloudDirectives: LearnedDirective[] = snap.docs.map(d => ({
      id: d.id,
      text: d.data().text || '',
      createdAt: d.data().createdAt || Date.now(),
      authorRole: d.data().authorRole,
      userId: d.data().userId || userId,
    }));

    // Merge cloud and local directives by text / id
    const mergedMap = new Map<string, LearnedDirective>();
    
    // Add local first
    local.forEach(d => {
      mergedMap.set(d.text.toLowerCase().trim(), d);
    });

    // Overwrite/add cloud
    cloudDirectives.forEach(d => {
      mergedMap.set(d.text.toLowerCase().trim(), d);
    });

    const merged = Array.from(mergedMap.values()).sort((a, b) => b.createdAt - a.createdAt);
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(merged));
    return merged;
  } catch (err) {
    console.warn('Could not sync directives with cloud:', err);
    return local;
  }
}

export function addLearnedDirective(
  userId: string = 'global',
  text: string,
  role?: 'admin' | 'hotel_manager'
): LearnedDirective {
  const clean = text.trim();
  if (!clean) throw new Error('Directive text cannot be empty.');

  const current = getLearnedDirectives(userId);
  // Avoid exact duplicates
  const existing = current.find(d => d.text.toLowerCase() === clean.toLowerCase());
  if (existing) return existing;

  const newItem: LearnedDirective = {
    id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    text: clean,
    createdAt: Date.now(),
    authorRole: role,
    userId,
  };

  const updated = [newItem, ...current];
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to persist learned directive locally:', err);
  }

  // Asynchronously save to Firestore in the background
  if (userId && userId !== 'global') {
    setDoc(doc(db, 'ai_directives', newItem.id), {
      text: newItem.text,
      createdAt: newItem.createdAt,
      authorRole: newItem.authorRole || 'hotel_manager',
      userId,
    }).catch(err => console.warn('Failed to write directive to Firestore:', err));
  }

  return newItem;
}

export function removeLearnedDirective(userId: string = 'global', id: string): void {
  const current = getLearnedDirectives(userId);
  const updated = current.filter(d => d.id !== id);
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to remove learned directive locally:', err);
  }

  if (userId && userId !== 'global' && !id.startsWith('seed_')) {
    deleteDoc(doc(db, 'ai_directives', id))
      .catch(err => console.warn('Failed to delete directive from Firestore:', err));
  }
}

export function clearLearnedDirectives(userId: string = 'global'): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${userId}`);
  } catch (err) {
    console.warn('Failed to clear learned directives:', err);
  }
}

