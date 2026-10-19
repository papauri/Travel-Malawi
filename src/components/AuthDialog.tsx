/**
 * The sign-in / create-account dialog.
 *
 * This used to live inside the navbar, which meant the navbar was the only
 * thing that could open it. Anything else that needed an account — most
 * obviously the "list your property" flow — had to send the visitor to a page
 * that would immediately bounce them home instead. It is now driven through
 * `useAuthDialog()` so any page can ask for it, with the intent that brought
 * the visitor there.
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import Modal from './Modal';
import FieldError from './FieldError';
import { emailProblem } from '../lib/contact';
import { Role } from '../types';

/** What brought the visitor here; it decides the mode and the copy. */
export type AuthIntent = 'signin' | 'signup' | 'host' | 'reset';

type AuthMode = 'signin' | 'signup' | 'reset';

interface Props {
  open: boolean;
  intent: AuthIntent;
  initialEmail?: string;
  onClose: () => void;
  /** Called after a successful sign-in or sign-up. */
  onAuthenticated?: () => void;
}

export default function AuthDialog({ open, intent, initialEmail, onClose, onAuthenticated }: Props) {
  const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [roles, setRoles] = useState<Role[]>(['traveller']);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showErrors, setShowErrors] = useState(false);

  // Re-arm the form each time it opens, for the intent it was opened with.
  useEffect(() => {
    if (!open) return;
    setEmail(initialEmail?.trim() || '');
    setPassword('');
    setShowPassword(false);
    setDisplayName('');
    setError('');
    setNotice('');
    setShowErrors(false);
    if (intent === 'host') {
      setMode('signup');
      // Hosts travel too, so the traveller role stays selected alongside.
      setRoles(['traveller', 'hotel_manager']);
    } else if (intent === 'reset') {
      setMode('reset');
      setRoles(['traveller']);
    } else {
      setMode(intent === 'signup' ? 'signup' : 'signin');
      setRoles(['traveller']);
    }
  }, [open, intent, initialEmail]);

  const hosting = roles.includes('hotel_manager');

  /**
   * Checked here rather than left to Firebase.
   *
   * The form submitted whatever was typed and waited for the server to object,
   * so a mistyped address cost a round trip to be told "invalid credential",
   * and a five-character password was only refused after the account creation
   * had already been attempted. Firebase's own errors still surface — these
   * only catch what can be known without asking it.
   */
  const problems = {
    displayName:
      mode === 'signup' && !displayName.trim()
        ? 'Tell us what to call you.'
        : mode === 'signup' && displayName.trim().length > 100
          ? 'That name is too long.'
          : '',
    email: emailProblem(email, 'An email address', true) ?? '',
    // Firebase's own minimum. Saying so up front beats a rejected sign-up.
    password:
      mode === 'reset'
        ? ''
        : !password
          ? 'Enter your password.'
          : mode === 'signup' && password.length < 6
            ? 'Passwords need at least 6 characters.'
            : '',
  };

  const hasProblem = Object.values(problems).some(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasProblem) {
      setShowErrors(true);
      return;
    }
    setIsSubmitting(true);
    setError('');
    setNotice('');
    const cleanEmail = email.trim();
    const cleanName = displayName.trim();

    try {
      if (mode === 'reset') {
        await resetPassword(cleanEmail);
        // Deliberately the same message whether or not the address is
        // registered, so this cannot be used to test which emails have accounts.
        setNotice('If an account exists for that address, a reset link is on its way.');
        return;
      }
      if (mode === 'signin') {
        await signIn(cleanEmail, password);
      } else {
        await signUp(cleanEmail, password, cleanName, roles);
      }
      onAuthenticated?.();
      onClose();
    } catch (err: any) {
      if (mode === 'reset') {
        setNotice('If an account exists for that address, a reset link is on its way.');
        return;
      }
      const msg =
        err?.code === 'auth/invalid-credential' || err?.code === 'auth/wrong-password'
          ? 'Incorrect email or password.'
          : err?.code === 'auth/user-not-found'
          ? 'No account uses that email. Check it or create an account.'
          : err?.code === 'auth/email-already-in-use'
          ? 'That email already has an account. Try signing in.'
          : err?.code === 'auth/weak-password'
          ? 'Use at least 6 characters for your password.'
          : err?.code === 'auth/invalid-email'
          ? 'That email address does not look right.'
          : err?.code === 'auth/network-request-failed'
          ? 'No connection. Check your internet and try again.'
          : err?.code === 'auth/too-many-requests'
          ? 'Too many attempts. Wait a minute, then try again.'
          : err?.message ?? 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    // Deliberately not gated on `problems`: Google supplies the address and
    // the password, so an empty form is the normal case here.
    setIsSubmitting(true);
    setError('');
    try {
      await signInWithGoogle(mode === 'signup' ? roles : ['traveller']);
      onAuthenticated?.();
      onClose();
    } catch (err: any) {
      if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/cancelled-popup-request') {
        setError('Your browser blocked the Google window. Allow pop-ups and try again.');
        return;
      }
      const msg =
        err?.code === 'auth/popup-closed-by-user'
          ? 'Google sign-in was cancelled.'
          : err?.code === 'auth/network-request-failed'
          ? 'No connection. Check your internet and try again.'
          : err?.message ?? 'Google sign-in failed. Please try again.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const title =
    mode === 'reset'
      ? 'Reset your password'
      : mode === 'signup'
        ? hosting ? 'Create a host account' : 'Create an account'
        : 'Sign in';

  const description =
    mode === 'reset'
      ? "We'll email you a link to choose a new password."
      : mode === 'signup'
        ? hosting
          ? 'List your property and manage bookings directly.'
          : 'Save stays, message hosts and manage your bookings.'
        : 'Welcome back. Sign in to see your bookings.';

  const optionClass = (active: boolean) =>
    `tm-btn tm-btn-secondary h-auto flex-col items-start gap-0.5 py-2.5 text-left ${
      active ? 'border-stone-900 ring-1 ring-stone-900' : ''
    }`;

  return (
    <Modal open={open} onClose={onClose} size="md" title={title} description={description}
      footer={
        <div className="space-y-2">
          <button
            type="submit"
            form="auth-form"
            disabled={isSubmitting}
            className="tm-btn tm-btn-primary w-full"
          >
            {isSubmitting
              ? mode === 'signin' ? 'Signing in…' : mode === 'signup' ? 'Creating account…' : 'Sending link…'
              : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
          </button>
          {mode === 'reset' && (
            <button
              type="button"
              onClick={() => { setMode('signin'); setError(''); setNotice(''); }}
              className="tm-btn tm-btn-quiet w-full"
            >
              Back to sign in
            </button>
          )}
        </div>
      }
    >
      {/* Mode toggle — a reset is a detour, not a third tab. */}
      {mode !== 'reset' && (
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-stone-100 p-1">
          {(['signin', 'signup'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(''); setNotice(''); setShowErrors(false); }}
              className={`tm-btn tm-btn-sm ${mode === m ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'}`}
            >
              {m === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1 break-words">{error}</div>
        </div>
      )}

      {notice && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1 break-words">{notice}</div>
        </div>
      )}

      <form id="auth-form" onSubmit={handleSubmit} className="space-y-3" noValidate>
        {mode === 'signup' && (
          <div>
            <label className="tm-label" htmlFor="auth-name">Full name</label>
            <input
              id="auth-name"
              type="text"
              required
              autoComplete="name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="tm-input"
            />
            <FieldError message={showErrors ? problems.displayName : ''} />
          </div>
        )}

        <div>
          <label className="tm-label" htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="tm-input"
          />
          <FieldError message={showErrors ? problems.email : ''} />
        </div>

        {mode !== 'reset' && (
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <label className="tm-label" htmlFor="auth-password">Password</label>
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => { setMode('reset'); setError(''); setNotice(''); }}
                  className="tm-link text-xs"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 6 characters' : ''}
                className="tm-input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <FieldError message={showErrors ? problems.password : ''} />
          </div>
        )}

        {mode === 'signup' && (
          <fieldset>
            <legend className="tm-label">I am a</legend>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={!hosting}
                onClick={() => setRoles(['traveller'])}
                className={optionClass(!hosting)}
              >
                <span className="font-medium">Guest</span>
                <span className="text-xs font-normal text-stone-500">Looking to book</span>
              </button>
              <button
                type="button"
                aria-pressed={hosting}
                onClick={() => setRoles(['traveller', 'hotel_manager'])}
                className={optionClass(hosting)}
              >
                <span className="font-medium">Property owner</span>
                <span className="text-xs font-normal text-stone-500">Listing a stay</span>
              </button>
            </div>
          </fieldset>
        )}
      </form>

      {mode !== 'reset' && (
        <>
          <div className="my-4 flex items-center gap-3">
            <div className="tm-divider flex-1" />
            <span className="tm-muted text-xs">or</span>
            <div className="tm-divider flex-1" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
            className="tm-btn tm-btn-secondary w-full"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="truncate">Continue with Google</span>
          </button>

          <p className="tm-muted mt-4 text-center text-xs">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </>
      )}
    </Modal>
  );
}
