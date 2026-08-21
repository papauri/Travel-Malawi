import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "demo-api-key",
  authDomain: "demo-project.firebaseapp.com",
  projectId: "demo-project",
  storageBucket: "demo-project.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:1234567890"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkHotels() {
  const querySnapshot = await getDocs(collection(db, "hotels"));
  querySnapshot.forEach((doc) => {
    console.log(doc.id, " => ", doc.data().name, doc.data().imageUrl);
  });
  console.log("Done");
  process.exit(0);
}

checkHotels();
