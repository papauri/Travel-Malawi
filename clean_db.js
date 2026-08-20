import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf-8'));
const app = initializeApp(config);
const db = getFirestore(app);

async function clean() {
  console.log("Cleaning hotels...");
  const hotels = await getDocs(collection(db, "hotels"));
  for (const h of hotels.docs) {
    await deleteDoc(doc(db, "hotels", h.id));
  }
  console.log("Cleaning room types...");
  const rooms = await getDocs(collection(db, "room_types"));
  for (const r of rooms.docs) {
    await deleteDoc(doc(db, "room_types", r.id));
  }
  console.log("Done.");
}
clean();
