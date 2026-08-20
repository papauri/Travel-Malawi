/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User as UserIcon, X, Palmtree, Mail, Lock, ChevronDown } from 'lucide-react';

type AuthMode = 'signin' | 'signup';
type RoleChoice = 'traveller' | 'hotel_manager';

export default function Navbar() {
  const { user, signIn, signUp, signInWithGoogle, logOut } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [mode, setMode] = useState<AuthMode>('signin');
  const [role, setRole] = useState<RoleChoice>('traveller');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setError('');
    setMode('signin');
    setRole('traveller');
  };

  const openModal = () => {
    resetForm();
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
    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        await signUp(email, password, displayName, role);
      }
      closeModal();
    } catch (err: any) {
      const msg = err?.code === 'auth/invalid-credential' || err?.code === 'auth/wrong-password'
        ? 'Incorrect email or password.'
        : err?.code === 'auth/email-already-in-use'
        ? 'An account with this email already exists.'
        : err?.code === 'auth/weak-password'
        ? 'Password must be at least 6 characters.'
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
      await signInWithGoogle(role);
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
                  {user.role === 'hotel_manager' && (
                    <Link
                      to="/dashboard"
                      className="text-sm font-medium text-stone-600 hover:text-stone-900 transition relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-stone-900 after:transition-all hover:after:w-full"
                    >
                      Dashboard
                    </Link>
                  )}
                  {user.role === 'traveller' && (
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
                          <p className="text-xs text-stone-500 capitalize mt-0.5">{user.role === 'hotel_manager' ? 'Hotel Manager' : 'Traveller'}</p>
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
                    onClick={openModal}
                    className="text-sm font-medium text-stone-600 hover:text-stone-900 transition hidden sm:block"
                  >
                    List your property
                  </button>
                  <button
                    onClick={openModal}
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

      {/* Auth Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative">
            <button
              onClick={closeModal}
              className="absolute top-5 right-5 p-1.5 rounded-full text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="p-10">
              {/* Logo mark */}
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <Palmtree className="h-10 w-10 text-stone-900" />
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </div>
              </div>

              {/* Mode toggle */}
              <div className="flex bg-stone-100 rounded-xl p-1 mb-8">
                <button
                  onClick={() => { setMode('signin'); setError(''); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                    mode === 'signin'
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => { setMode('signup'); setError(''); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                    mode === 'signup'
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-5 border border-red-100">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
                      Full Name
                    </label>
                    <div className="relative">
                      <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                      <input
                        type="text"
                        required
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        placeholder="Your full name"
                        className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none focus:border-stone-900 transition"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none focus:border-stone-900 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                      className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none focus:border-stone-900 transition"
                    />
                  </div>
                </div>

                {/* Role picker — show on signup */}
                {mode === 'signup' && (
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
                      I am a…
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {(['traveller', 'hotel_manager'] as RoleChoice[]).map(r => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRole(r)}
                          className={`py-2.5 px-4 rounded-xl border text-sm font-semibold transition ${
                            role === r
                              ? 'border-stone-900 bg-stone-900 text-white'
                              : 'border-stone-200 bg-stone-50 text-stone-600 hover:border-stone-400'
                          }`}
                        >
                          {r === 'traveller' ? '✈️ Traveller' : '🏨 Hotel Manager'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-stone-900 text-white py-3 rounded-xl font-semibold text-sm hover:bg-stone-700 transition disabled:opacity-50 mt-2"
                >
                  {isSubmitting
                    ? mode === 'signin' ? 'Signing in…' : 'Creating account…'
                    : mode === 'signin' ? 'Sign In' : 'Create Account'}
                </button>
              </form>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-stone-200" />
                <span className="text-xs text-stone-400 font-medium">or</span>
                <div className="flex-1 h-px bg-stone-200" />
              </div>

              {/* Google Sign-In */}
              <button
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-3 border border-stone-200 bg-white py-3 rounded-xl text-sm font-semibold text-stone-700 hover:bg-stone-50 hover:border-stone-300 transition disabled:opacity-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <p className="text-center text-xs text-stone-400 mt-6 leading-relaxed">
                By continuing, you agree to our{' '}
                <span className="underline cursor-pointer hover:text-stone-600">Terms of Service</span>
                {' '}and{' '}
                <span className="underline cursor-pointer hover:text-stone-600">Privacy Policy</span>.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
