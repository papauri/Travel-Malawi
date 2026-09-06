import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { User, CurrencyCode } from '../types';
import { UserCircle, Save, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { CURRENCIES } from '../lib/currency';

export default function Profile() {
  const { user } = useAuth();
  
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [preferredCurrency, setPreferredCurrency] = useState<CurrencyCode>(user?.preferredCurrency || 'USD');
  const [isSaving, setIsSaving] = useState(false);

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
        <UserCircle className="w-16 h-16 text-stone-200 mb-6" />
        <h1 className="text-3xl font-serif text-stone-900 mb-4 tracking-tight">Account Profile</h1>
        <p className="text-stone-500 max-w-md mb-8">Sign in to manage your account settings.</p>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName });
      }

      await updateDoc(doc(db, 'users', user.uid), {
        displayName,
        phone,
        preferredCurrency
      });

      toast.success('Profile updated successfully');
    } catch (err) {
      console.error('Failed to update profile:', err);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 lg:px-8 py-10 mb-20 md:mb-0">
      <div className="mb-10 border-b border-stone-200 pb-6">
        <h1 className="text-3xl md:text-4xl font-serif font-medium text-stone-900 tracking-tight">Profile Settings</h1>
        <p className="text-stone-500 mt-2">Manage your personal information and preferences.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-8 bg-white p-6 md:p-8 rounded-3xl border border-stone-200 shadow-sm">
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-stone-900">Personal Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-stone-900 mb-2">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                placeholder="How we should call you"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-stone-900 mb-2">Email Address</label>
              <input
                type="email"
                value={user.email || ''}
                disabled
                className="w-full rounded-xl border border-stone-200 bg-stone-100 px-4 py-2.5 text-sm text-stone-500 cursor-not-allowed"
              />
              <p className="text-xs text-stone-400 mt-1.5">Email address cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-900 mb-2">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                placeholder="+265 ... (Used for bookings)"
              />
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-stone-100 space-y-6">
          <h2 className="text-xl font-bold text-stone-900">Preferences</h2>
          
          <div className="max-w-md">
            <label className="block text-sm font-semibold text-stone-900 mb-2">Preferred Currency</label>
            <select
              value={preferredCurrency}
              onChange={(e) => setPreferredCurrency(e.target.value as CurrencyCode)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
            >
              {Object.entries(CURRENCIES).map(([code, config]) => (
                <option key={code} value={code}>
                  {code} - {config.label} ({config.symbol})
                </option>
              ))}
            </select>
            <p className="text-xs text-stone-500 mt-1.5">
              Prices will be converted to this currency where possible.
            </p>
          </div>
        </div>

        <div className="pt-6 border-t border-stone-100 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 rounded-full bg-stone-900 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
