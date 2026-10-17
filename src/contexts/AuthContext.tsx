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
  signInWithRedirect,
  getRedirectResult,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, limit, query, setDoc, where } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { User, Role } from '../types';
import { isHotelManager, isOwnerEmail, toRoleFields, userRoles, canShadowManager } from '../lib/roles';
import toast from 'react-hot-toast';
import {
  logAuthEvent,
  logSessionEvent,
  getSessionDurationMinutes,
  clearSessionTracking,
} from '../lib/logger';

interface AuthContextType {
  user: User | null;
  actualUser: User | null;
  isShadowing: boolean;
  shadowedUser: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string, roles: Role[]) => Promise<void>;
  signInWithGoogle: (roles?: Role[]) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  /** Adds the hotel_manager role to the signed-in account. */
  becomeHost: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  logOut: () => Promise<void>;
  /** Allows Marketing & Global Admins to shadow any property manager for support */
  shadowManager: (target: User) => Promise<void>;
  /** Exits shadow mode and restores the original admin session */
  exitShadowMode: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  actualUser: null,
  isShadowing: false,
  shadowedUser: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signInWithGoogle: async () => {},
  resetPassword: async () => {},
  becomeHost: async () => {},
  refreshUser: async () => null,
  logOut: async () => {},
  shadowManager: async () => {},
  exitShadowMode: async () => {},
});

export const useAuth = () => useContext(AuthContext);

/** Thrown when an administrator has suspended or revoked the account. */
class AccountSuspendedError extends Error {
  constructor() {
    super('Your account has been suspended. Contact the Travel Malawi team if you think this is a mistake.');
    this.name = 'AccountSuspendedError';
  }
}

async function loadOrCreateUser(
  firebaseUser: FirebaseUser,
  defaultRoles: Role[] = ['traveller']
): Promise<User> {
  const userDocRef = doc(db, 'users', firebaseUser.uid);
  const userDoc = await getDoc(userDocRef);
  
  let userData: User;
  if (userDoc.exists()) {
    userData = { uid: firebaseUser.uid, ...userDoc.data() } as User;
    if (userData.accessRevoked || userData.status === 'suspended') {
      await signOut(auth);
      throw new AccountSuspendedError();
    }
  } else {
    userData = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'User'),
      ...toRoleFields(defaultRoles),
      createdAt: Date.now(),
    };
  }

  let needsWrite = !userDoc.exists();

  // Force global admin role for the requested email
  if (isOwnerEmail(userData.email)) {
    const roles = Array.isArray(userData.roles) ? userData.roles : (userData.role ? [userData.role] : []);
    if (!roles.includes('admin')) {
      const updatedRoles = [...roles, 'admin'] as Role[];
      const roleFields = toRoleFields(updatedRoles);
      userData = { ...userData, ...roleFields };
      needsWrite = true;
    }
  }

  // Auto-recognize property owners/managers whose email or uid is attached to an onboarded hotel (including pending listings)
  if (!isHotelManager(userData) && firebaseUser.email) {
    try {
      const cleanEmail = firebaseUser.email.trim().toLowerCase();
      const [byUid, byOwnerEmail, byManagerEmail] = await Promise.all([
        getDocs(query(collection(db, 'hotels'), where('managerId', '==', firebaseUser.uid), limit(1))),
        getDocs(query(collection(db, 'hotels'), where('ownerEmail', '==', cleanEmail), limit(1))),
        getDocs(query(collection(db, 'hotels'), where('managerEmail', '==', cleanEmail), limit(1))),
      ]);
      if (!byUid.empty || !byOwnerEmail.empty || !byManagerEmail.empty) {
        const currentRoles = Array.isArray(userData.roles) ? userData.roles : (userData.role ? [userData.role] : ['traveller']);
        const roleFields = toRoleFields([...currentRoles, 'hotel_manager'] as Role[]);
        userData = { ...userData, ...roleFields };
        needsWrite = true;
      }
    } catch {
      // Non-fatal; ManageHotel / ManagerDashboard also verify per-property email match
    }
  }

  if (needsWrite) {
    await setDoc(userDocRef, { ...userData }, { merge: true });
  }

  return userData;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [actualUser, setActualUser] = useState<User | null>(null);
  const [shadowedUser, setShadowedUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('tm_shadow_user');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return null;
  });
  const [isShadowing, setIsShadowing] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return Boolean(sessionStorage.getItem('tm_shadow_user'));
    }
    return false;
  });
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const signingUpRef = useRef(false);

  const applyEffectiveUser = (realUser: User | null, shadow: User | null = shadowedUser) => {
    setActualUser(realUser);
    if (realUser && shadow && canShadowManager(realUser)) {
      const effective: User = {
        ...shadow,
        isShadowed: true,
        shadowedBy: realUser,
      };
      setShadowedUser(effective);
      setIsShadowing(true);
      setUser(effective);
    } else {
      setShadowedUser(null);
      setIsShadowing(false);
      setUser(realUser);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('tm_shadow_user');
      }
    }
  };

  useEffect(() => {
    // Process redirect credentials if returning from Google Sign-In redirect
    getRedirectResult(auth)
      .then(async (credential) => {
        if (credential?.user) {
          let pendingRoles: Role[] = ['traveller'];
          if (typeof window !== 'undefined') {
            try {
              const saved = sessionStorage.getItem('tm_auth_pending_roles');
              if (saved) {
                pendingRoles = JSON.parse(saved);
                sessionStorage.removeItem('tm_auth_pending_roles');
              }
            } catch {}
          }
          const appUser = await loadOrCreateUser(credential.user, pendingRoles);
          applyEffectiveUser(appUser);
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('tm_session_logged_user', appUser.uid);
          }
          await logAuthEvent('login', `User signed in via Google: ${appUser.displayName || appUser.email}`, appUser, {
            method: 'google.com (redirect)',
            email: appUser.email,
            role: appUser.role,
            roles: appUser.roles,
          });
          toast.success(`Signed in as ${appUser.displayName || appUser.email}`);
        }
      })
      .catch((err) => {
        if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
          console.warn('[Auth] getRedirectResult notice:', err?.code, err?.message);
        }
      });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // If sign-up is currently in flight, let signUp() complete the user profile setup
      if (signingUpRef.current) {
        return;
      }

      if (firebaseUser) {
        try {
          const appUser = await loadOrCreateUser(firebaseUser);
          applyEffectiveUser(appUser);

          // Track session in system logs once per browser session per user
          if (typeof window !== 'undefined') {
            const loggedUser = sessionStorage.getItem('tm_session_logged_user');
            if (loggedUser !== appUser.uid) {
              sessionStorage.setItem('tm_session_logged_user', appUser.uid);
              logSessionEvent(appUser, 'session_start', {
                email: appUser.email,
                role: appUser.role,
                roles: appUser.roles,
                provider: firebaseUser.providerData?.[0]?.providerId || 'password',
                isAnonymous: firebaseUser.isAnonymous,
              }).catch(() => {});
            }
          }
        } catch (err) {
          if (err instanceof AccountSuspendedError) {
            // loadOrCreateUser has already signed them out; never fall back
            // to a traveller session for a suspended account.
            applyEffectiveUser(null);
            toast.error(err.message);
            setLoading(false);
            return;
          }
          console.error('Error loading user profile:', err);
          // Fallback to basic user profile so UI loads seamlessly
          applyEffectiveUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'User'),
            role: 'traveller',
            roles: ['traveller'],
            createdAt: Date.now(),
          });
        }
      } else {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('tm_session_logged_user');
        }
        applyEffectiveUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    const cleanEmail = email.trim();
    try {
      const result = await signInWithEmailAndPassword(auth, cleanEmail, password);
      let appUser: User;
      try {
        appUser = await loadOrCreateUser(result.user);
        applyEffectiveUser(appUser);
      } catch (err) {
        // A suspended account must fail the sign-in, not log in as a traveller.
        if (err instanceof AccountSuspendedError) throw err;
        console.error('Error loading user profile after sign-in:', err);
        appUser = {
          uid: result.user.uid,
          email: result.user.email || cleanEmail,
          displayName: result.user.displayName || cleanEmail.split('@')[0] || 'User',
          role: 'traveller',
          roles: ['traveller'],
          createdAt: Date.now(),
        };
        applyEffectiveUser(appUser);
      }

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('tm_session_logged_user', appUser.uid);
      }

      // Log successful login
      await logAuthEvent('login', `User signed in: ${appUser.displayName || appUser.email}`, appUser, {
        method: 'password',
        email: cleanEmail,
        role: appUser.role,
        roles: appUser.roles,
      });
    } catch (err: any) {
      console.error('Login error:', err);
      // Log failed login attempt
      await logAuthEvent('login_failed', `Failed login attempt for ${cleanEmail}: ${err?.message || 'Invalid credentials'}`, null, {
        method: 'password',
        email: cleanEmail,
        errorCode: err?.code || 'auth/error',
      });
      throw err;
    }
  };

  const signUp = async (email: string, password: string, displayName: string, roles: Role[]) => {
    signingUpRef.current = true;
    const cleanEmail = email.trim();
    const cleanName = displayName.trim();
    try {
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
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('tm_session_logged_user', newUser.uid);
      }

      // Log account creation
      await logAuthEvent('signup', `New user registered: ${newUser.displayName} (${newUser.email}) as [${roles.join(', ')}]`, newUser, {
        method: 'password',
        email: newUser.email,
        roles,
      });
    } catch (err: any) {
      console.error('Sign-up error:', err);
      await logAuthEvent('login_failed', `Registration failed for ${cleanEmail}: ${err?.message || 'Error creating account'}`, null, {
        method: 'password',
        email: cleanEmail,
        roles,
        errorCode: err?.code || 'auth/error',
      });
      throw err;
    } finally {
      signingUpRef.current = false;
      setLoading(false);
    }
  };

  const signInWithGoogle = async (roles: Role[] = ['traveller']) => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const appUser = await loadOrCreateUser(result.user, roles);
      setUser(appUser);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('tm_session_logged_user', appUser.uid);
      }

      await logAuthEvent('login', `User signed in via Google: ${appUser.displayName || appUser.email}`, appUser, {
        method: 'google.com',
        email: appUser.email,
        role: appUser.role,
        roles: appUser.roles,
      });
    } catch (err: any) {
      console.warn('Google sign-in popup notice:', err?.code, err?.message);

      // If browser blocks popups, automatically fall back to signInWithRedirect
      if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/cancelled-popup-request') {
        try {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('tm_auth_pending_roles', JSON.stringify(roles));
          }
          toast('Browser popup was blocked. Redirecting you to Google Sign-In...', { icon: '🔄', duration: 4000 });
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr: any) {
          console.error('Google sign-in redirect fallback failed:', redirectErr);
          throw redirectErr;
        }
      }

      if (err?.code !== 'auth/popup-closed-by-user') {
        await logAuthEvent('login_failed', `Google sign-in failed: ${err?.message || 'Popup cancelled or failed'}`, null, {
          method: 'google.com',
          errorCode: err?.code || 'auth/popup-error',
        });
      }
      throw err;
    }
  };

  const resetPassword = async (email: string) => {
    const cleanEmail = email.trim();
    if (!cleanEmail) throw new Error('Please provide an email address.');

    // 1. Trigger SMTP password recovery & auto-provisioning on the server first
    let smtpSent = false;
    try {
      const res = await fetch('/api/auth/notify-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await res.json().catch(() => ({}));
      smtpSent = Boolean(data?.emailSent);
    } catch {
      // Fallback to Firebase client reset below
    }

    // 2. Also send Firebase Auth standard reset link
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
    } catch (err) {
      if (!smtpSent) throw err;
    }

    await logAuthEvent('password_reset', `Password reset requested for: ${cleanEmail}`, null, {
      email: cleanEmail,
      smtpSent,
    });
  };

  const refreshUser = async (): Promise<User | null> => {
    if (auth.currentUser) {
      try {
        const appUser = await loadOrCreateUser(auth.currentUser);
        setUser(appUser);
        return appUser;
      } catch (err) {
        console.error('Failed to refresh user:', err);
      }
    }
    return null;
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
    const updatedUser = { ...user, ...roleFields };
    setUser(updatedUser);
    await logAuthEvent('role_change', `User added Host / Property Manager role: ${user.displayName || user.email}`, updatedUser, {
      grantedRole: 'hotel_manager',
      allRoles: userRoles(updatedUser),
    });
  };

  const shadowManager = async (target: User) => {
    const currentActual = actualUser || (user?.isShadowed ? user.shadowedBy : user);
    if (!currentActual || !canShadowManager(currentActual)) {
      toast.error('Only administrators and marketing team can shadow property managers.');
      throw new Error('Unauthorized shadow request');
    }
    const effectiveShadow: User = {
      ...target,
      isShadowed: true,
      shadowedBy: currentActual,
    };
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('tm_shadow_user', JSON.stringify(target));
    }
    setShadowedUser(effectiveShadow);
    setIsShadowing(true);
    setUser(effectiveShadow);

    await logAuthEvent('role_change', `Staff member ${currentActual.email} entered shadow mode as ${target.displayName || target.email} (${target.uid})`, currentActual, {
      action: 'shadow_manager',
      targetUid: target.uid,
      targetEmail: target.email,
    });
    toast.success(`Shadow mode active: Viewing as ${target.displayName || target.email}`);
  };

  const exitShadowMode = async () => {
    const currentActual = actualUser || (user?.isShadowed ? user.shadowedBy : null);
    const currentShadow = shadowedUser;
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('tm_shadow_user');
    }
    setShadowedUser(null);
    setIsShadowing(false);
    setUser(currentActual);

    if (currentActual) {
      await logAuthEvent('role_change', `Staff member ${currentActual.email} exited shadow mode for ${currentShadow?.email || 'manager'}`, currentActual, {
        action: 'exit_shadow_manager',
        targetUid: currentShadow?.uid,
      });
    }
    toast.success('Exited shadow mode. Restored admin account.');
  };

  const logOut = async () => {
    const currentUser = actualUser || user;
    if (currentUser) {
      const duration = getSessionDurationMinutes();
      await logAuthEvent('logout', `User signed out: ${currentUser.displayName || currentUser.email} (${duration}m active session)`, currentUser, {
        email: currentUser.email,
        sessionDurationMinutes: duration,
      });
    }
    clearSessionTracking();
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('tm_shadow_user');
    }
    setShadowedUser(null);
    setIsShadowing(false);
    setActualUser(null);
    await signOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      actualUser,
      isShadowing,
      shadowedUser,
      loading,
      signIn,
      signUp,
      signInWithGoogle,
      resetPassword,
      becomeHost,
      refreshUser,
      logOut,
      shadowManager,
      exitShadowMode,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
