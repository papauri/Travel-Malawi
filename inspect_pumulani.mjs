import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = config.firestoreDatabaseId
  ? getFirestore(app, config.firestoreDatabaseId)
  : getFirestore(app);

async function inspect() {
  const q = query(collection(db, 'hotels'), where('name', '==', 'Pumulani Lodge'));
  const snap = await getDocs(q);
  
  if (snap.empty) {
    console.log("No hotel found with name Pumulani Lodge");
    process.exit(0);
  }

  const hotel = snap.docs[0];
  console.log("Hotel ID:", hotel.id);
  console.log("Hotel Data:", JSON.stringify(hotel.data(), null, 2));

  const roomSnap = await getDocs(collection(db, `room_types`));
  const rooms = roomSnap.docs.map(d => ({id: d.id, ...d.data()})).filter(r => r.hotelId === hotel.id);
  console.log("Rooms:", JSON.stringify(rooms, null, 2));
  
  process.exit(0);
}

inspect().catch(console.error);
