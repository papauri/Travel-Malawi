/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
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
      displayName: firebaseUser.displayName,
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
    await setDoc(userDocRef, userData);
  }

  return userData;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
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
            displayName: firebaseUser.displayName,
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
    const result = await signInWithEmailAndPassword(auth, email, password);
    const appUser = await loadOrCreateUser(result.user);
    setUser(appUser);
  };

  const signUp = async (email: string, password: string, displayName: string, roles: Role[]) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName });
    const newUser: User = {
      uid: result.user.uid,
      email: result.user.email,
      displayName,
      ...toRoleFields(roles),
      createdAt: Date.now(),
    };
    await setDoc(doc(db, 'users', result.user.uid), newUser);
    setUser(newUser);
  };

  const signInWithGoogle = async (roles: Role[] = ['traveller']) => {
    const result = await signInWithPopup(auth, googleProvider);
    const appUser = await loadOrCreateUser(result.user, roles);
    setUser(appUser);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
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
