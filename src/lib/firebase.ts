import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

/**
 * Google sign-in through our own domain, so the account chooser says
 * "continue to ulendomalawi.com" rather than the Firebase project address.
 * server.ts proxies the sign-in helper at /__/auth/. Only switch this on once
 * https://ulendomalawi.com/__/auth/handler is an authorised redirect URI on
 * the OAuth web client in Google Cloud; until then Google refuses the sign-in.
 */
const OWN_DOMAIN_SIGN_IN = false;
const ownDomain = typeof window !== 'undefined' && /(^|\.)ulendomalawi\.com$/i.test(window.location.hostname)
  ? window.location.host
  : null;

const app = initializeApp(OWN_DOMAIN_SIGN_IN && ownDomain ? { ...firebaseConfig, authDomain: ownDomain } : firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Firestore with persistent offline cache and forced long-polling to prevent
// 10-second backend connection timeouts in restricted network/iframe environments.
let firestoreDb;
try {
  firestoreDb = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
      experimentalForceLongPolling: true,
    },
    firebaseConfig.firestoreDatabaseId
  );
} catch {
  try {
    firestoreDb = initializeFirestore(
      app,
      {
        experimentalForceLongPolling: true,
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

export const db = firestoreDb;

export const storage = getStorage(app, firebaseConfig.storageBucket);
