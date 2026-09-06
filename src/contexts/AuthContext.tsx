/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { User, Role } from '../types';
import { isHotelManager, toRoleFields, userRoles } from '../lib/roles';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string, roles: Role[]) => Promise<void>;
  signInWithGoogle: (roles?: Role[]) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  /** Adds the hotel_manager role to the signed-in account. */
  becomeHost: () => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signInWithGoogle: async () => {},
  resetPassword: async () => {},
  becomeHost: async () => {},
  logOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

async function loadOrCreateUser(
  firebaseUser: FirebaseUser,
  defaultRoles: Role[] = ['traveller']
): Promise<User> {
  const userDocRef = doc(db, 'users', firebaseUser.uid);
  const userDoc = await getDoc(userDocRef);
  
  let userData: User;
  if (userDoc.exists()) {
    userData = { uid: firebaseUser.uid, ...userDoc.data() } as User;
  } else {
    userData = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'User'),
      ...toRoleFields(defaultRoles),
      createdAt: Date.now(),
    };
  }

  // Force global admin role for the requested email
  if (userData.email === 'johnpaulchirwa@gmail.com') {
    const roles = Array.isArray(userData.roles) ? userData.roles : (userData.role ? [userData.role] : []);
    if (!roles.includes('admin')) {
      const updatedRoles = [...roles, 'admin'] as Role[];
      const roleFields = toRoleFields(updatedRoles);
      userData = { ...userData, ...roleFields };
      await setDoc(userDocRef, { ...userData }, { merge: true });
    }
  } else if (!userDoc.exists()) {
    await setDoc(userDocRef, userData, { merge: true });
  }

  return userData;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const signingUpRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // If sign-up is currently in flight, let signUp() complete the user profile setup
      if (signingUpRef.current) {
        return;
      }

      if (firebaseUser) {
        try {
          const appUser = await loadOrCreateUser(firebaseUser);
          setUser(appUser);
        } catch (err) {
          console.error('Error loading user profile:', err);
          // Fallback to basic user profile so UI loads seamlessly
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'User'),
            role: 'traveller',
            roles: ['traveller'],
            createdAt: Date.now(),
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    const cleanEmail = email.trim();
    const result = await signInWithEmailAndPassword(auth, cleanEmail, password);
    try {
      const appUser = await loadOrCreateUser(result.user);
      setUser(appUser);
    } catch (err) {
      console.error('Error loading user profile after sign-in:', err);
      setUser({
        uid: result.user.uid,
        email: result.user.email || cleanEmail,
        displayName: result.user.displayName || cleanEmail.split('@')[0] || 'User',
        role: 'traveller',
        roles: ['traveller'],
        createdAt: Date.now(),
      });
    }
  };

  const signUp = async (email: string, password: string, displayName: string, roles: Role[]) => {
    signingUpRef.current = true;
    try {
      const cleanEmail = email.trim();
      const cleanName = displayName.trim();
      const result = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      
      if (cleanName) {
        try {
          await updateProfile(result.user, { displayName: cleanName });
        } catch (profileErr) {
          console.warn('Could not update Firebase profile displayName:', profileErr);
        }
      }

      const roleFields = toRoleFields(roles);
      const newUser: User = {
        uid: result.user.uid,
        email: result.user.email || cleanEmail,
        displayName: cleanName || cleanEmail.split('@')[0] || 'User',
        ...roleFields,
        createdAt: Date.now(),
      };

      try {
        await setDoc(doc(db, 'users', result.user.uid), newUser, { merge: true });
      } catch (docErr) {
        console.error('Error saving user profile to Firestore:', docErr);
      }

      setUser(newUser);
    } finally {
      signingUpRef.current = false;
      setLoading(false);
    }
  };

  const signInWithGoogle = async (roles: Role[] = ['traveller']) => {
    const result = await signInWithPopup(auth, googleProvider);
    const appUser = await loadOrCreateUser(result.user, roles);
    setUser(appUser);
  };

  const resetPassword = async (email: string) => {
    const cleanEmail = email.trim();
    await sendPasswordResetEmail(auth, cleanEmail);
  };

  /**
   * Turns an existing account into a host account.
   *
   * The role could only ever be chosen at sign-up, so someone who had already
   * joined to book a stay had no route to listing a property at all: every
   * host entry point either redirected them home or was hidden from them. The
   * grant is deliberately limited to `hotel_manager`, which is self-assignable
   * at sign-up anyway, so this hands out nothing new — `admin` stays
   * admin-granted, in the security rules as well as here.
   */
  const becomeHost = async () => {
    if (!user) throw new Error('Sign in before listing a property.');
    if (isHotelManager(user)) return;
    const roleFields = toRoleFields([...userRoles(user), 'hotel_manager']);
    await setDoc(doc(db, 'users', user.uid), roleFields, { merge: true });
    setUser({ ...user, ...roleFields });
  };

  const logOut = async () => {
    await signOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signInWithGoogle, resetPassword, becomeHost, logOut }}>
      {children}
    </AuthContext.Provider>
  );
};
