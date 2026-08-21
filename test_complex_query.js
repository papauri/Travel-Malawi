import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  try {
    const q = query(
            collection(db, 'bookings'),
            where('hotelId', '==', 'testHotel'),
            where('roomTypeId', '==', 'testRoom'),
            where('status', 'in', ['pending', 'confirmed'])
          );
    await getDocs(q);
    console.log("SUCCESS!");
  } catch(e) {
    console.error("FAILED:", e);
  }
}
test();
