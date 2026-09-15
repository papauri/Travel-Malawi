import { collection, addDoc, getDocs, query, orderBy, limit, onSnapshot, doc, deleteDoc, writeBatch } from 'firebase/firestore';
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

export function subscribeToSystemLogs(callback: (logs: SystemLog[]) => void, limitCount = 100) {
  const q = query(collection(db, 'system_logs'), orderBy('timestamp', 'desc'), limit(limitCount));
  return onSnapshot(q, (snap) => {
    const logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as SystemLog);
    callback(logs);
  }, (err) => {
    console.error('Failed to subscribe to system logs:', err);
  });
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
    snap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
  } catch (err) {
    console.error('Failed to clear system logs:', err);
    throw err;
  }
}
