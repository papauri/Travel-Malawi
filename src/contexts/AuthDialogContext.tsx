/**
 * One auth dialog for the whole app.
 *
 * The sign-in modal used to be private state inside the navbar, so the only
 * thing that could ask a visitor to sign in was the navbar itself. Every other
 * entry point — the home page's host call to action, the listing flow — had to
 * send them to a route that bounced them straight back home. Anything can now
 * call `openAuth('host')` and get the right form, in place.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AuthDialog, { AuthIntent } from '../components/AuthDialog';
import { useAuth } from './AuthContext';

interface AuthDialogContextValue {
  /** Opens the dialog. `onDone` runs once, after a successful sign-in. */
  openAuth: (intent?: AuthIntent, onDone?: () => void, prefillEmail?: string) => void;
  closeAuth: () => void;
  isOpen: boolean;
}

const AuthDialogContext = createContext<AuthDialogContextValue>({
  openAuth: () => {},
  closeAuth: () => {},
  isOpen: false,
});

export const useAuthDialog = () => useContext(AuthDialogContext);

export const AuthDialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<AuthIntent>('signin');
  const [initialEmail, setInitialEmail] = useState<string>('');
  // A ref, not state: the callback belongs to one opening of the dialog and
  // must not cause a re-render of every consumer when it is replaced.
  const onDoneRef = useRef<(() => void) | undefined>(undefined);

  const openAuth = useCallback((next: AuthIntent = 'signin', onDone?: () => void, prefillEmail?: string) => {
    setIntent(next);
    setInitialEmail(prefillEmail?.trim() || '');
    onDoneRef.current = onDone;
    setOpen(true);
  }, []);

  const closeAuth = useCallback(() => {
    setOpen(false);
    onDoneRef.current = undefined;
  }, []);

  // Automatically open the AuthDialog when arriving from an onboarding or password reset email link (?auth=signin&email=...)
  useEffect(() => {
    if (authLoading) return;
    const params = new URLSearchParams(location.search);
    const authParam = params.get('auth')?.toLowerCase();
    const emailParam = params.get('email')?.trim() || '';

    if (authParam === 'signin' || authParam === 'signup' || authParam === 'host' || authParam === 'reset') {
      if (authParam === 'reset' || !user) {
        setIntent(authParam as AuthIntent);
        if (emailParam) setInitialEmail(emailParam);
        setOpen(true);
      }
    }
  }, [location.search, authLoading, user]);

  const value = useMemo(() => ({ openAuth, closeAuth, isOpen: open }), [openAuth, closeAuth, open]);

  return (
    <AuthDialogContext.Provider value={value}>
      {children}
      <AuthDialog
        open={open}
        intent={intent}
        initialEmail={initialEmail}
        onClose={() => setOpen(false)}
        onAuthenticated={() => {
          const done = onDoneRef.current;
          onDoneRef.current = undefined;
          done?.();
        }}
      />
    </AuthDialogContext.Provider>
  );
};
