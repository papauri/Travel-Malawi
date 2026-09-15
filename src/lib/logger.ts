import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';

export interface SystemLog {
  id?: string;
  timestamp: number;
  type: 'action' | 'error' | 'info';
  message: string;
  details?: any;
  userId?: string;
  userName?: string;
  userEmail?: string;
}

export async function logSystemEvent(
  type: 'action' | 'error' | 'info',
  message: string,
  details?: any,
  user?: { id?: string, name?: string, email?: string } | null
) {
  try {
    await addDoc(collection(db, 'system_logs'), {
      timestamp: Date.now(),
      type,
      message,
      details: details || null,
      userId: user?.id || null,
      userName: user?.name || null,
      userEmail: user?.email || null,
    });
  } catch (err) {
    console.error('Failed to write system log:', err);
  }
}

export async function getSystemLogs(limitCount = 100): Promise<SystemLog[]> {
  try {
    const q = query(collection(db, 'system_logs'), orderBy('timestamp', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as SystemLog);
  } catch (err) {
    console.error('Failed to get system logs:', err);
    return [];
  }
}
