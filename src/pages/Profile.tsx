import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAuthDialog } from '../contexts/AuthDialogContext';
import { doc, updateDoc } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateProfile } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { CurrencyCode, UserNotificationPreferences } from '../types';
import {
  UserCircle,
  Save,
  Loader2,
  Key,
  Bell,
  Lock,
  Eye,
  EyeOff,
  Building2,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Plus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { CURRENCIES } from '../lib/currency';
import { isAdmin, isHotelManager, isMarketing } from '../lib/roles';

export default function Profile() {
  const { user, resetPassword, becomeHost } = useAuth();
  const { openAuth } = useAuthDialog();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [whatsapp, setWhatsapp] = useState(user?.whatsapp || '');
  const [city, setCity] = useState(user?.city || '');
  const [country, setCountry] = useState(user?.country || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [preferredCurrency, setPreferredCurrency] = useState<CurrencyCode>(user?.preferredCurrency || 'USD');
  const [notifications, setNotifications] = useState<UserNotificationPreferences>(
    user?.notificationPreferences || {
      emailBookings: true,
      whatsappUpdates: false,
      marketingEmails: false,
    }
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isActivatingHost, setIsActivatingHost] = useState(false);

  // Direct in-app password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // The uid whose stored profile the form currently holds. Saving is blocked
  // until this matches the signed-in user, so a reload (where `user` is still
  // null on the first render) can never write blank fields over real data.
  const [hydratedUid, setHydratedUid] = useState<string | null>(null);

  useEffect(() => {
    if (!user || hydratedUid === user.uid) return;
    setDisplayName(user.displayName || '');
    setPhone(user.phone || '');
    setWhatsapp(user.whatsapp || '');
    setCity(user.city || '');
    setCountry(user.country || '');
    setBio(user.bio || '');
    setPreferredCurrency(user.preferredCurrency || 'USD');
    setNotifications(
      user.notificationPreferences || {
        emailBookings: true,
        whatsappUpdates: false,
        marketingEmails: false,
      }
    );
    setHydratedUid(user.uid);
  }, [user, hydratedUid]);

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
        <UserCircle className="w-16 h-16 text-stone-300 mb-5" />
        <h1 className="tm-h1">Your profile</h1>
        <p className="text-stone-500 max-w-md mb-6 text-sm">
          Sign in to manage your personal details, password, and property host settings.
        </p>
        <button
          type="button"
          onClick={() => openAuth('signin')}
          className="tm-btn tm-btn-primary"
        >
          Sign In to Your Account
        </button>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hydratedUid !== user.uid) return;

    const cleanName = displayName.trim();
    if (cleanName.length < 2) {
      toast.error('Please enter your full name (at least 2 characters).');
      return;
    }
    if (cleanName.length > 80 || bio.trim().length > 600) {
      toast.error(cleanName.length > 80 ? 'Name must be 80 characters or fewer.' : 'Bio must be 600 characters or fewer.');
      return;
    }
    setIsSaving(true);

    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: cleanName });
      }

      await updateDoc(doc(db, 'users', user.uid), {
        displayName: cleanName,
        phone: phone.trim(),
        whatsapp: whatsapp.trim(),
        city: city.trim(),
        country: country.trim(),
        bio: bio.trim(),
        preferredCurrency,
        notificationPreferences: notifications,
      });

      toast.success('Profile updated successfully');
    } catch (err) {
      console.error('Failed to update profile:', err);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user.email) return;
    setIsResetting(true);
    try {
      await resetPassword(user.email);
      toast.success('Password reset & recovery email sent! Check your inbox.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send password reset email');
    } finally {
      setIsResetting(false);
    }
  };

  const handleDirectPasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      toast.error('Please sign in again to update your password.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      if (needsReauth && currentPassword && user.email) {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
      }
      await updatePassword(auth.currentUser, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNeedsReauth(false);
      toast.success('Your password has been updated!');
    } catch (err: any) {
      if (err?.code === 'auth/requires-recent-login') {
        setNeedsReauth(true);
        toast.error('For security, please enter your current/temporary password to confirm this change.');
      } else if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        toast.error('Current password is incorrect. You can also click "Email a reset link" instead.');
      } else {
        toast.error(err?.message || 'Could not update password. Try sending a reset email instead.');
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleBecomeHost = async () => {
    setIsActivatingHost(true);
    try {
      await becomeHost();
      toast.success('Host tools are now on for your account.');
    } catch (err: any) {
      toast.error(err?.message || 'Could not activate host tools');
    } finally {
      setIsActivatingHost(false);
    }
  };

  const userIsHost = isHotelManager(user);
  const userIsAdmin = isAdmin(user);
  const userIsMarketing = isMarketing(user);

  return (
    <div className="mx-auto max-w-4xl px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 md:py-10 mb-20 md:mb-0 space-y-6">
      <div className="border-b border-stone-200 pb-3.5 sm:pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="tm-h1">
            Account &amp; Profile Settings
          </h1>
          <p className="text-stone-500 mt-0.5 sm:mt-1 text-xs sm:text-sm">
            Manage your personal information, security credentials, and property host tools.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {userIsHost && (
            <Link
              to="/dashboard"
              className="tm-btn tm-btn-primary"
            >
              <Building2 className="w-3.5 h-3.5" />
              Property hub
            </Link>
          )}
          <button
            type="button"
            onClick={handlePasswordReset}
            disabled={isResetting}
            className="tm-btn tm-btn-secondary"
          >
            {isResetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
            Email a reset link
          </button>
        </div>
      </div>

      {/* Account Role & Property Host Access Card */}
      <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-xl border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-stone-400">Account access</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-800 border border-stone-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Traveller
            </span>
            {userIsHost && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <Building2 className="w-3 h-3 text-emerald-700" />
                Property Host / Manager
              </span>
            )}
            {userIsMarketing && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                <ShieldCheck className="w-3 h-3 text-amber-700" />
                Marketing
              </span>
            )}
            {userIsAdmin && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-900 text-white">
                <ShieldCheck className="w-3 h-3 text-amber-400" />
                Administrator
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-stone-600">
            {userIsHost
              ? 'Your account has full Property Host & Manager access. You can view and manage both live and pending listings.'
              : 'Want to list a lodge, guest house, or cottage on Ulendo Travel Malawi? Activate free host tools anytime.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {userIsHost ? (
            <>
              <Link
                to="/dashboard"
                className="tm-btn tm-btn-primary"
              >
                <span>Manage properties</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                to="/list-your-property"
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-800 text-xs font-semibold hover:bg-stone-100 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add property</span>
              </Link>
            </>
          ) : (
            <button
              type="button"
              onClick={handleBecomeHost}
              disabled={isActivatingHost}
              className="tm-btn tm-btn-primary"
            >
              {isActivatingHost ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Building2 className="w-3.5 h-3.5" />}
              <span>Turn on host tools</span>
            </button>
          )}
        </div>
      </div>

      {/* Personal information & Preferences Form */}
      <form
        onSubmit={handleSave}
        className="space-y-5 sm:space-y-7 bg-white p-3.5 sm:p-6 md:p-8 rounded-xl sm:rounded-xl border border-stone-200"
      >
        <div className="space-y-4 sm:space-y-5">
          <h2 className="tm-h2">Personal information</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-5">
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-stone-900 mb-1.5">Display name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition"
                placeholder="How we should call you"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-stone-900 mb-1.5">Email address</label>
              <input
                type="email"
                value={user.email || ''}
                disabled
                className="w-full rounded-xl border border-stone-200 bg-stone-100 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-stone-500 cursor-not-allowed"
              />
              <p className="text-[11px] text-stone-400 mt-1">Primary login email address</p>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-stone-900 mb-1.5">Phone number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition"
                placeholder="+265 ... (Used for bookings)"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-stone-900 mb-1.5">WhatsApp Number</label>
              <input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition"
                placeholder="+265 …"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-stone-900 mb-1.5">City / Location</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition"
                placeholder="e.g. Lilongwe"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-stone-900 mb-1.5">Country</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition"
                placeholder="e.g. Malawi"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs sm:text-sm font-semibold text-stone-900 mb-1.5">Bio / About</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition"
                placeholder="A little about you…"
              />
            </div>
          </div>
        </div>

        <div className="pt-5 border-t border-stone-100 space-y-4 sm:space-y-5">
          <h2 className="tm-h2">Preferences</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-stone-900 mb-1.5">Preferred currency</label>
                <select
                  value={preferredCurrency}
                  onChange={(e) => setPreferredCurrency(e.target.value as CurrencyCode)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition"
                >
                  {Object.entries(CURRENCIES).map(([code, config]) => (
                    <option key={code} value={code}>
                      {code} - {config.label} ({config.symbol})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-stone-500 mt-1">
                  Prices will be converted to this currency where possible.
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-stone-900 mb-3 flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-stone-500" /> Notifications
              </h3>
              <div className="space-y-3 text-xs sm:text-sm">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifications.emailBookings}
                    onChange={(e) => setNotifications((prev) => ({ ...prev, emailBookings: e.target.checked }))}
                    className="mt-0.5 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                  />
                  <div>
                    <span className="block font-medium text-stone-900 text-xs sm:text-sm">Booking Updates via Email</span>
                    <span className="block text-[11px] text-stone-500">Receive confirmations and host messages</span>
                  </div>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifications.whatsappUpdates}
                    onChange={(e) => setNotifications((prev) => ({ ...prev, whatsappUpdates: e.target.checked }))}
                    className="mt-0.5 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                  />
                  <div>
                    <span className="block font-medium text-stone-900 text-xs sm:text-sm">WhatsApp Notifications</span>
                    <span className="block text-[11px] text-stone-500">Get urgent alerts and quick replies</span>
                  </div>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifications.marketingEmails}
                    onChange={(e) => setNotifications((prev) => ({ ...prev, marketingEmails: e.target.checked }))}
                    className="mt-0.5 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                  />
                  <div>
                    <span className="block font-medium text-stone-900 text-xs sm:text-sm">Marketing &amp; Promotions</span>
                    <span className="block text-[11px] text-stone-500">Special offers, new listings, and travel tips</span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-stone-100 flex justify-end">
          <button
            type="submit"
            disabled={isSaving || hydratedUid !== user.uid}
            className="tm-btn tm-btn-primary w-full sm:w-auto"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save changes
          </button>
        </div>
      </form>

      {/* Security & Direct Password Change Card */}
      <form
        onSubmit={handleDirectPasswordUpdate}
        className="space-y-4 sm:space-y-5 bg-white p-3.5 sm:p-6 md:p-8 rounded-xl sm:rounded-xl border border-stone-200"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="tm-h2 flex items-center gap-2">
              <Lock className="w-4 h-4 text-stone-600" />
              Security &amp; Password Management
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Signed in with a temporary onboarding password? Set your own personal password below, or request a reset link via email.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-5">
          {needsReauth && (
            <div className="sm:col-span-2">
              <label className="block text-xs sm:text-sm font-semibold text-stone-900 mb-1.5">
                Current / Temporary Password
              </label>
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-xl border border-amber-300 bg-amber-50/40 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition"
                placeholder="Enter your current or temporary password"
              />
            </div>
          )}

          <div>
            <label className="block text-xs sm:text-sm font-semibold text-stone-900 mb-1.5">New password</label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 pl-3 sm:pl-4 pr-10 py-2 sm:py-2.5 text-xs sm:text-sm focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition"
                placeholder="At least 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-semibold text-stone-900 mb-1.5">Confirm new password</label>
            <input
              type={showNewPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition"
              placeholder="Re-enter new password"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <button
            type="button"
            onClick={handlePasswordReset}
            disabled={isResetting}
            className="text-xs font-semibold text-stone-600 hover:text-stone-900 underline text-left cursor-pointer"
          >
            {isResetting ? 'Sending reset email…' : `Prefer an email link? Send reset email to ${user.email}`}
          </button>
          <button
            type="submit"
            disabled={isUpdatingPassword || !newPassword}
            className="tm-btn tm-btn-primary w-full sm:w-auto"
          >
            {isUpdatingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
            Save new password
          </button>
        </div>
      </form>
    </div>
  );
}
