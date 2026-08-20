import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf-8'));
const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);

async function createTestUsers() {
  const users = [
    { email: 'manager@malawiscapes.com', password: 'password123', displayName: 'Demo Manager', role: 'hotel_manager' },
    { email: 'traveller@malawiscapes.com', password: 'password123', displayName: 'Demo Traveller', role: 'traveller' }
  ];

  for (const u of users) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, u.email, u.password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: u.displayName });
      
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: u.displayName,
        role: u.role,
        createdAt: Date.now()
      });
      console.log(`Created user: ${u.email}`);
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        console.log(`User already exists: ${u.email}`);
      } else {
        console.error(`Error creating user ${u.email}:`, error);
      }
    }
  }
  process.exit(0);
}

createTestUsers();
