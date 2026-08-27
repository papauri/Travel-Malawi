/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User as UserIcon, Palmtree, Mail, Lock, ChevronDown, Check } from 'lucide-react';
import Modal, { fieldClass, labelClass } from './Modal';
import { Role } from '../types';
import { SELF_ASSIGNABLE_ROLES, ROLE_LABELS, describeRoles, isAdmin, isHotelManager, isTraveller } from '../lib/roles';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

type AuthMode = 'signin' | 'signup' | 'reset';


export default function Navbar() {
  const { user, signIn, signUp, signInWithGoogle, resetPassword, logOut } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [mode, setMode] = useState<AuthMode>('signin');
  const [roles, setRoles] = useState<Role[]>(['traveller']);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (isHotelManager(user)) {
      const q = query(
        collection(db, 'bookings'),
        where('managerId', '==', user.uid),
        // JS filter instead
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setPendingCount(snapshot.docs.filter(d => d.data().status === 'pending').length);
      });
      return () => unsubscribe();
    }
    // Otherwise clear any count left over from a previous session.
    setPendingCount(0);
  }, [user]);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setError('');
    setNotice('');
    setMode('signin');
    setRoles(['traveller']);
  };

  /**
   * `intent` preselects the form. "List your property" opened a blank sign-in
   * form, so a new host had to work out for themselves that they needed to
   * create an account and pick the manager role.
   */
  const openModal = (intent: 'signin' | 'host' = 'signin') => {
    resetForm();
    if (intent === 'host') {
      setMode('signup');
      // Hosts travel too, so the traveller role stays selected alongside.
      setRoles(['traveller', 'hotel_manager']);
    }
    setShowLoginModal(true);
  };

  const closeModal = () => {
    setShowLoginModal(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setNotice('');
    try {
      if (mode === 'reset') {
        await resetPassword(email);
        // Deliberately the same message whether or not the address is
        // registered, so this cannot be used to test which emails have accounts.
        setNotice('If an account exists for that address, a reset link is on its way.');
        return;
      }
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        await signUp(email, password, displayName, roles);
      }
      closeModal();
    } catch (err: any) {
      if (mode === 'reset') {
        setNotice('If an account exists for that address, a reset link is on its way.');
        return;
      }
      const msg = err?.code === 'auth/invalid-credential' || err?.code === 'auth/wrong-password'
        ? 'Incorrect email or password.'
        : err?.code === 'auth/user-not-found'
        ? 'No account found for that email.'
        : err?.code === 'auth/email-already-in-use'
        ? 'An account with this email already exists.'
        : err?.code === 'auth/weak-password'
        ? 'Password must be at least 6 characters.'
        : err?.code === 'auth/too-many-requests'
        ? 'Too many attempts. Please wait a moment and try again.'
        : err?.message ?? 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      await signInWithGoogle(roles);
      closeModal();
    } catch (err: any) {
      setError(err?.message ?? 'Google sign-in failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // User initials for avatar
  const initials = user?.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <>
      <nav className="sticky top-0 z-50 w-full bg-gradient-to-b from-white to-stone-50/80 backdrop-blur-md border-b border-stone-200/60 shadow-sm">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2.5 group">
              <div className="relative">
                <Palmtree className="h-6 w-6 text-stone-900 transition group-hover:text-emerald-700" />
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500" />
              </div>
              <span className="text-2xl font-serif font-bold tracking-tight text-stone-900 group-hover:text-stone-700 transition">
                MalawiScapes
              </span>
            </Link>

            {/* Right side */}
            <div className="flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-5">
                  {isHotelManager(user) && (
                    <Link
                      to="/dashboard"
                      className="text-sm font-medium text-stone-600 hover:text-stone-900 transition flex items-center gap-1"
                    >
                      Dashboard
                      {pendingCount > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center">
                          {pendingCount}
                        </span>
                      )}
                    </Link>
                  )}
                  {isAdmin(user) && (
                    <Link
                      to="/admin"
                      className="text-sm font-medium text-stone-600 hover:text-stone-900 transition relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-stone-900 after:transition-all hover:after:w-full"
                    >
                      Admin
                    </Link>
                  )}
                  {isTraveller(user) && (
                    <Link
                      to="/my-bookings"
                      className="text-sm font-medium text-stone-600 hover:text-stone-900 transition relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-stone-900 after:transition-all hover:after:w-full"
                    >
                      My Bookings
                    </Link>
                  )}

                  {/* User avatar + dropdown */}
                  <div className="relative pl-5 border-l border-stone-200">
                    <button
                      onClick={() => setShowUserMenu(v => !v)}
                      className="flex items-center gap-2.5 rounded-full px-3 py-1.5 hover:bg-stone-100 transition"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold tracking-wide">
                        {initials}
                      </div>
                      <span className="text-sm font-medium text-stone-900 hidden sm:block max-w-[120px] truncate">
                        {user.displayName ?? user.email}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
                    </button>

                    {showUserMenu && (
                      <div
                        className="absolute right-0 mt-2 w-52 bg-white border border-stone-200 rounded-2xl shadow-xl py-2 z-50"
                        onMouseLeave={() => setShowUserMenu(false)}
                      >
                        <div className="px-4 py-3 border-b border-stone-100">
                          <p className="text-xs text-stone-400 uppercase tracking-wider font-semibold mb-0.5">Signed in as</p>
                          <p className="text-sm font-medium text-stone-900 truncate">{user.email}</p>
                          <p className="text-xs text-stone-500 mt-0.5">{describeRoles(user)}</p>
                        </div>
                        <button
                          onClick={() => { logOut(); setShowUserMenu(false); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign out
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => openModal('host')}
                    className="text-sm font-medium text-stone-600 hover:text-stone-900 transition hidden sm:block"
                  >
                    List your property
                  </button>
                  <button
                    onClick={() => openModal('signin')}
                    className="rounded-full bg-stone-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-stone-700 transition shadow-sm"
                  >
                    Sign In
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Auth */}
      <Modal
        open={showLoginModal}
        onClose={closeModal}
        size="md"
        title={
          mode === 'reset'
            ? 'Reset your password'
            : mode === 'signup'
              ? roles.includes('hotel_manager') ? 'List your property' : 'Create your account'
              : 'Welcome back'
        }
        description={
          mode === 'reset'
            ? "We'll email you a link to choose a new one."
            : mode === 'signup'
              ? roles.includes('hotel_manager')
                ? 'Set up a host account to publish rooms and take bookings.'
                : 'Save your trips and manage bookings in one place.'
              : 'Sign in to pick up where you left off.'
        }
        footer={
          <div className="space-y-3">
            <button
              type="submit"
              form="auth-form"
              disabled={isSubmitting}
              className="w-full bg-stone-900 text-white py-3 rounded-full font-semibold text-sm hover:bg-stone-800 transition disabled:opacity-50"
            >
              {isSubmitting
                ? mode === 'signin' ? 'Signing in…' : mode === 'signup' ? 'Creating account…' : 'Sending…'
                : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
            </button>
            {mode === 'reset' && (
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(''); setNotice(''); }}
                className="w-full text-sm font-semibold text-stone-500 hover:text-stone-900 transition"
              >
                Back to sign in
              </button>
            )}
          </div>
        }
      >
        {/* Mode toggle — a reset is a detour, not a third tab. */}
        {mode !== 'reset' && (
          <div className="flex bg-stone-100 rounded-full p-1 mb-6">
            {(['signin', 'signup'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(''); setNotice(''); }}
                className={`flex-1 py-2 rounded-full text-sm font-semibold transition ${
                  mode === m ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                {m === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm mb-5 border border-red-100">
            {error}
          </div>
        )}

        {notice && (
          <div className="bg-emerald-50 text-emerald-700 px-4 py-3 rounded-xl text-sm mb-5 border border-emerald-100">
            {notice}
          </div>
        )}

        <form id="auth-form" onSubmit={handleSubmit} className="space-y-4">
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
            </div>
          )}

          <div>
            <label className={labelClass}>Email</label>
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
          </div>

          {mode !== 'reset' && (
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <label className="block text-xs font-semibold text-stone-500 tracking-wide">Password</label>
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
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                  className={`${fieldClass} pl-10`}
                />
              </div>
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label className={labelClass}>I want to…</label>
              {/* Both can be selected: running a lodge and booking stays are
                  not mutually exclusive, and picking one used to give up the
                  other for good. */}
              <div className="grid grid-cols-2 gap-3">
                {SELF_ASSIGNABLE_ROLES.map(r => {
                  const selected = roles.includes(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setRoles(current =>
                          current.includes(r)
                            // At least one role has to remain selected.
                            ? (current.length > 1 ? current.filter(x => x !== r) : current)
                            : [...current, r]
                        )
                      }
                      className={`py-3 px-4 rounded-xl border text-sm font-semibold transition text-left relative ${
                        selected
                          ? 'border-stone-900 bg-stone-900 text-white'
                          : 'border-stone-200 bg-stone-50 text-stone-600 hover:border-stone-400'
                      }`}
                    >
                      <span className="block text-base leading-none mb-1.5">{r === 'traveller' ? '✈️' : '🏨'}</span>
                      {r === 'traveller' ? 'Book stays' : 'List a property'}
                      {selected && <Check className="absolute top-3 right-3 h-4 w-4" />}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-stone-400 mt-2">
                {roles.length > 1
                  ? `You'll join as ${ROLE_LABELS.traveller.toLowerCase()} and ${ROLE_LABELS.hotel_manager.toLowerCase()}. Pick both or just one — you can hold both.`
                  : 'Select both if you want to do both.'}
              </p>
            </div>
          )}
        </form>

        {mode !== 'reset' && (
          <>
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-stone-200" />
              <span className="text-xs text-stone-400 font-medium">or</span>
              <div className="flex-1 h-px bg-stone-200" />
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-3 border border-stone-200 bg-white py-3 rounded-full text-sm font-semibold text-stone-700 hover:bg-stone-50 hover:border-stone-300 transition disabled:opacity-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
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
    </>
  );
}