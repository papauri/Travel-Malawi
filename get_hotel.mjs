import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = config.firestoreDatabaseId ? getFirestore(app, config.firestoreDatabaseId) : getFirestore(app);

async function main() {
  const d = await getDoc(doc(db, 'hotels', 'CVLioXMAPYkxR9kHBiS8'));
  console.log(JSON.stringify(d.data(), null, 2));
  process.exit(0);
}
main();
