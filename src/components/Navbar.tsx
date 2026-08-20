import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User as UserIcon, X, Palmtree } from 'lucide-react';

export default function Navbar() {
  const { user, signIn, logOut } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState('');

  const handleDemoLogin = async (role: 'manager' | 'traveller') => {
    setIsSigningIn(true);
    setError('');
    const email = role === 'manager' ? 'manager@malawiscapes.com' : 'traveller@malawiscapes.com';
    const password = 'password123';
    try {
      await signIn(email, password);
      setShowLoginModal(false);
    } catch (err: any) {
      setError('Login failed: ' + err.message);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <>
      <nav className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-sm border-b border-stone-200">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            <Link to="/" className="flex items-center space-x-2">
              <Palmtree className="h-6 w-6 text-stone-900" />
              <span className="text-2xl font-serif font-bold tracking-tight text-stone-900">MalawiScapes</span>
            </Link>

            <div className="flex items-center space-x-6">
              {user ? (
                <div className="flex items-center space-x-6">
                  {user.role === 'hotel_manager' && (
                    <Link to="/dashboard" className="text-sm font-medium text-stone-600 hover:text-stone-900 transition">
                      Dashboard
                    </Link>
                  )}
                  {user.role === 'traveller' && (
                    <Link to="/my-bookings" className="text-sm font-medium text-stone-600 hover:text-stone-900 transition">
                      My Bookings
                    </Link>
                  )}
                  <div className="flex items-center space-x-4 pl-6 border-l border-stone-200">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-700">
                      <UserIcon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium text-stone-900 hidden sm:block">{user.displayName}</span>
                    <button onClick={() => logOut()} className="p-2 text-stone-400 hover:text-stone-900 transition">
                      <LogOut className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-6">
                  <button onClick={() => setShowLoginModal(true)} className="text-sm font-medium text-stone-600 hover:text-stone-900 transition">
                    List your property
                  </button>
                  <button onClick={() => setShowLoginModal(true)} className="rounded-full bg-stone-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800">
                    Sign In
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative">
            <button 
              onClick={() => setShowLoginModal(false)}
              className="absolute top-6 right-6 text-stone-400 hover:text-stone-900 transition"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="p-10">
              <div className="flex justify-center mb-6">
                <Palmtree className="h-12 w-12 text-stone-900" />
              </div>
              <h2 className="text-2xl font-serif font-bold text-stone-900 text-center mb-8">Welcome back</h2>
              
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-6 border border-red-100">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <button 
                  disabled={isSigningIn}
                  onClick={() => handleDemoLogin('traveller')}
                  className="w-full bg-stone-900 text-white p-4 rounded-xl font-medium hover:bg-stone-800 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <UserIcon className="h-4 w-4" /> Sign in as Demo Traveller
                </button>
                <button 
                  disabled={isSigningIn}
                  onClick={() => handleDemoLogin('manager')}
                  className="w-full bg-stone-100 text-stone-900 p-4 rounded-xl font-medium hover:bg-stone-200 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <UserIcon className="h-4 w-4" /> Sign in as Demo Manager
                </button>
              </div>
              <p className="text-center text-sm text-stone-500 mt-8 leading-relaxed">
                These demo accounts are pre-configured to let you explore the platform's features instantly. Email & password authentication is used under the hood.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
