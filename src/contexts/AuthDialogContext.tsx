/**
 * One auth dialog for the whole app.
 *
 * The sign-in modal used to be private state inside the navbar, so the only
 * thing that could ask a visitor to sign in was the navbar itself. Every other
 * entry point — the home page's host call to action, the listing flow — had to
 * send them to a route that bounced them straight back home. Anything can now
 * call `openAuth('host')` and get the right form, in place.
 */

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import AuthDialog, { AuthIntent } from '../components/AuthDialog';

interface AuthDialogContextValue {
  /** Opens the dialog. `onDone` runs once, after a successful sign-in. */
  openAuth: (intent?: AuthIntent, onDone?: () => void) => void;
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
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<AuthIntent>('signin');
  // A ref, not state: the callback belongs to one opening of the dialog and
  // must not cause a re-render of every consumer when it is replaced.
  const onDoneRef = useRef<(() => void) | undefined>(undefined);

  const openAuth = useCallback((next: AuthIntent = 'signin', onDone?: () => void) => {
    setIntent(next);
    onDoneRef.current = onDone;
    setOpen(true);
  }, []);

  const closeAuth = useCallback(() => {
    setOpen(false);
    onDoneRef.current = undefined;
  }, []);

  const value = useMemo(() => ({ openAuth, closeAuth, isOpen: open }), [openAuth, closeAuth, open]);

  return (
    <AuthDialogContext.Provider value={value}>
      {children}
      <AuthDialog
        open={open}
        intent={intent}
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
