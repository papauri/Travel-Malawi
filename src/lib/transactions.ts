import { db } from './firebase';
import { collection, doc, getDocs, query, where, runTransaction, getDoc } from 'firebase/firestore';
import { isRoomAvailable } from './availability';
import { RoomType } from '../types';

export async function safeRunTransactionAvailability(
  roomId: string,
  room: RoomType,
  checkIn: string,
  checkOut: string,
  quantity: number,
  operation: (transaction: any) => void,
  ignoreBookingId?: string
) {
  const lockRef = doc(db, 'room_locks', roomId);
  
  let retries = 3;
  while (retries > 0) {
    retries--;
    
    // 1. Fetch current lock outside transaction
    const lockSnapOutside = await getDoc(lockRef);
    const expectedVersion = lockSnapOutside.exists() ? lockSnapOutside.data().version : 0;
    
    // 2. Fetch all bookings outside transaction
    const bookingsSnap = await getDocs(query(collection(db, 'bookings'), where('roomTypeId', '==', roomId)));
    let bookings = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as any);
    
    if (ignoreBookingId) {
      bookings = bookings.filter((b: any) => b.id !== ignoreBookingId);
    }
    
    // 3. Verify availability
    if (!isRoomAvailable(room, bookings, checkIn, checkOut, quantity)) {
      throw new Error("ROOM_UNAVAILABLE");
    }
    
    // 4. Run transaction to assert lock hasn't changed, then apply
    try {
      await runTransaction(db, async (transaction) => {
        const lockSnap = await transaction.get(lockRef);
        const currentVersion = lockSnap.exists() ? lockSnap.data().version : 0;
        
        if (currentVersion !== expectedVersion) {
          throw new Error("LOCK_MISMATCH");
        }
        
        transaction.set(lockRef, { version: currentVersion + 1 });
        operation(transaction);
      });
      
      // Success!
      return;
    } catch (err: any) {
      if (err.message === "LOCK_MISMATCH") {
        continue;
      }
      throw err;
    }
  }
  
  throw new Error("TOO_MANY_RETRIES");
}
