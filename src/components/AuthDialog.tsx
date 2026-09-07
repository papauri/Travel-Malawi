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
import {
  Mail,
  Lock,
  User as UserIcon,
  Compass,
  Building2,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Check,
} from 'lucide-react';
import Modal, { fieldClass, labelClass } from './Modal';
import FieldError from './FieldError';
import { emailProblem } from '../lib/contact';
import { Role } from '../types';

/** What brought the visitor here; it decides the mode and the copy. */
export type AuthIntent = 'signin' | 'signup' | 'host';

type AuthMode = 'signin' | 'signup' | 'reset';

interface Props {
  open: boolean;
  intent: AuthIntent;
  onClose: () => void;
  /** Called after a successful sign-in or sign-up. */
  onAuthenticated?: () => void;
}

export default function AuthDialog({ open, intent, onClose, onAuthenticated }: Props) {
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
    setEmail('');
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
    } else {
      setMode(intent === 'signup' ? 'signup' : 'signin');
      setRoles(['traveller']);
    }
  }, [open, intent]);

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
          ? 'No account found with that email address.'
          : err?.code === 'auth/email-already-in-use'
          ? 'An account with this email already exists. Please sign in instead.'
          : err?.code === 'auth/weak-password'
          ? 'Password must be at least 6 characters.'
          : err?.code === 'auth/invalid-email'
          ? 'Please enter a valid email address.'
          : err?.code === 'auth/network-request-failed'
          ? 'Network connection failed. Please check your internet connection.'
          : err?.code === 'auth/too-many-requests'
          ? 'Too many attempts. Please wait a moment and try again.'
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
      const msg =
        err?.code === 'auth/popup-closed-by-user'
          ? 'Google sign-in was cancelled.'
          : err?.code === 'auth/network-request-failed'
          ? 'Network error during Google sign-in. Please try again.'
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
        ? hosting ? 'Create Property Owner Account' : 'Create Guest Account'
        : 'Welcome back';

  const description =
    mode === 'reset'
      ? "We'll email you a secure link to choose a new password."
      : mode === 'signup'
        ? hosting
          ? 'Sign up to unlock the Host Starter Pack, Host Dashboard, and direct 0% fee listings.'
          : 'Browse lodges, B&Bs, cottages & stays, chat with verified hosts on WhatsApp, and manage bookings.'
        : 'Sign in to access your bookings and properties.';

  return (
    <Modal open={open} onClose={onClose} size="md" title={title} description={description}
      footer={
        <div className="space-y-3">
          <button
            type="submit"
            form="auth-form"
            disabled={isSubmitting}
            className="w-full bg-stone-900 text-white py-3 rounded-xl font-semibold text-sm hover:bg-stone-800 transition disabled:opacity-50 active:scale-[0.99]"
          >
            {isSubmitting
              ? mode === 'signin' ? 'Signing in…' : mode === 'signup' ? (hosting ? 'Creating owner account…' : 'Creating guest account…') : 'Sending link…'
              : mode === 'signin' ? 'Sign In' : mode === 'signup' ? (hosting ? 'Create Property Owner Account' : 'Create Guest Account') : 'Send reset link'}
          </button>
          {mode === 'reset' && (
            <button
              type="button"
              onClick={() => { setMode('signin'); setError(''); setNotice(''); }}
              className="w-full text-sm font-semibold text-stone-500 hover:text-stone-900 transition py-1"
            >
              Back to sign in
            </button>
          )}
        </div>
      }
    >
      {/* Mode toggle — a reset is a detour, not a third tab. */}
      {mode !== 'reset' && (
        <div className="flex bg-stone-100 rounded-xl p-1 mb-6 border border-stone-200/70">
          {(['signin', 'signup'] as const).map((m, mIdx) => (
            <button
              key={`${m}-${mIdx}`}
              type="button"
              onClick={() => { setMode(m); setError(''); setNotice(''); setShowErrors(false); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                mode === m ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {m === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50/90 border border-red-200/80 text-red-700 px-3.5 py-2.5 rounded-xl text-xs mb-4 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed font-medium">{error}</div>
        </div>
      )}

      {notice && (
        <div className="bg-emerald-50/90 border border-emerald-200/80 text-emerald-800 px-3.5 py-2.5 rounded-xl text-xs mb-4 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed font-medium">{notice}</div>
        </div>
      )}

      <form id="auth-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        {mode === 'signup' && (
          <div>
            <label className={labelClass}>Full name</label>
            <div className="relative">
              <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
              <input
                type="text"
                required
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your full name"
                className={`${fieldClass} pl-10`}
              />
            </div>
            <FieldError message={showErrors ? problems.displayName : ''} />
          </div>
        )}

        <div>
          <label className={labelClass}>Email address</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={`${fieldClass} pl-10`}
            />
          </div>
          <FieldError message={showErrors ? problems.email : ''} />
        </div>

        {mode !== 'reset' && (
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <label className={labelClass}>Password</label>
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => { setMode('reset'); setError(''); setNotice(''); }}
                  className="text-xs font-semibold text-stone-500 hover:text-stone-900 transition"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                className={`${fieldClass} pl-10 pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition"
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
          <div className="space-y-2.5 pt-1">
            <label className={labelClass}>Choose Account Type</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setRoles(['traveller'])}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  !hosting
                    ? 'border-stone-900 bg-stone-900 text-white shadow-sm ring-1 ring-stone-900'
                    : 'border-stone-200 bg-stone-50 hover:bg-stone-100/80 text-stone-700'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className={`p-1.5 rounded-lg ${!hosting ? 'bg-stone-800 text-white' : 'bg-stone-200/80 text-stone-700'}`}>
                    <Compass className="h-4 w-4" />
                  </div>
                  {!hosting && <Check className="h-3.5 w-3.5 text-stone-300" />}
                </div>
                <div>
                  <div className="text-xs font-bold tracking-tight">Guest Account</div>
                  <div className={`text-[11px] leading-tight mt-0.5 ${!hosting ? 'text-stone-300' : 'text-stone-500'}`}>
                    Traveler looking to book stays
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRoles(['traveller', 'hotel_manager'])}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  hosting
                    ? 'border-stone-900 bg-stone-900 text-white shadow-sm ring-1 ring-stone-900'
                    : 'border-stone-200 bg-stone-50 hover:bg-stone-100/80 text-stone-700'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className={`p-1.5 rounded-lg ${hosting ? 'bg-stone-800 text-white' : 'bg-stone-200/80 text-stone-700'}`}>
                    <Building2 className="h-4 w-4" />
                  </div>
                  {hosting && <Check className="h-3.5 w-3.5 text-stone-300" />}
                </div>
                <div>
                  <div className="text-xs font-bold tracking-tight">Property Owner</div>
                  <div className={`text-[11px] leading-tight mt-0.5 ${hosting ? 'text-stone-300' : 'text-stone-500'}`}>
                    Lodge, B&B, cottage, or stay host
                  </div>
                </div>
              </button>
            </div>

            {/* Explanatory breakdown of features available for each sign up option */}
            <div className="p-3 rounded-xl bg-stone-100/80 border border-stone-200 text-xs space-y-1.5">
              <div className="flex items-center justify-between font-semibold text-stone-900 text-[11px] uppercase tracking-wider">
                <span>{hosting ? 'Owner Tools Included' : 'Guest Features Included'}</span>
                <span className="font-normal text-[10px] text-stone-500 lowercase">
                  {hosting ? 'complete host suite' : 'booking & vouchers'}
                </span>
              </div>
              <ul className="text-[11px] text-stone-600 space-y-1 leading-snug">
                {hosting ? (
                  <>
                    <li className="flex items-center gap-1.5 font-medium text-stone-900">
                      <Check className="h-3 w-3 text-stone-800 shrink-0" />
                      <span><strong>Host Starter Pack</strong>: Onboarding guide &amp; rate card</span>
                    </li>
                    <li className="flex items-center gap-1.5 font-medium text-stone-900">
                      <Check className="h-3 w-3 text-stone-800 shrink-0" />
                      <span><strong>Host Dashboard</strong>: Manage rooms, bookings &amp; pricing</span>
                    </li>
                    <li className="flex items-center gap-1.5 text-stone-700">
                      <Check className="h-3 w-3 text-stone-800 shrink-0" />
                      <span>0% commission on direct WhatsApp guest inquiries</span>
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-center gap-1.5 text-stone-700">
                      <Check className="h-3 w-3 text-stone-800 shrink-0" />
                      <span>Direct WhatsApp chat with verified property hosts</span>
                    </li>
                    <li className="flex items-center gap-1.5 text-stone-700">
                      <Check className="h-3 w-3 text-stone-800 shrink-0" />
                      <span>Saved properties, trip itineraries &amp; booking vouchers</span>
                    </li>
                    <li className="flex items-center gap-1.5 text-stone-500 italic">
                      <span>(Host Starter Pack &amp; Dashboard reserved for Property Owners)</span>
                    </li>
                  </>
                )}
              </ul>
            </div>
          </div>
        )}
      </form>

      {mode !== 'reset' && (
        <>
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-stone-200" />
            <span className="text-xs text-stone-400 font-medium">or continue with</span>
            <div className="flex-1 h-px bg-stone-200" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2.5 border border-stone-200 bg-white py-2.5 rounded-xl text-sm font-semibold text-stone-700 hover:bg-stone-50 hover:border-stone-300 transition disabled:opacity-50 active:scale-[0.99] shadow-sm"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>{mode === 'signup' ? (hosting ? 'Sign up as Property Owner with Google' : 'Sign up as Guest with Google') : 'Continue with Google'}</span>
          </button>

          <p className="text-center text-xs text-stone-400 mt-5 leading-relaxed">
            By continuing, you agree to our{' '}
            <span className="underline cursor-pointer hover:text-stone-600">Terms of Service</span>
            {' '}and{' '}
            <span className="underline cursor-pointer hover:text-stone-600">Privacy Policy</span>.
          </p>
        </>
      )}
    </Modal>
  );
}
