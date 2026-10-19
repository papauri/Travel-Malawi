import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import Modal from './Modal';
import { Star, ShieldCheck, CheckCircle2, AlertCircle, ExternalLink, BedDouble, Calendar, ArrowRight, Loader2 } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/handleFirestoreError';
import type { Review, Booking } from '../types';
import toast from 'react-hot-toast';

interface ReviewModalProps {
  hotelId: string;
  hotelName?: string;
  googleMapsReviewsUrl?: string;
  open: boolean;
  onClose: () => void;
  onReviewSubmitted?: (newReview?: Review) => void;
}

const RATING_DESCRIPTIONS: Record<number, { label: string; color: string }> = {
  1: { label: 'Disappointing', color: 'text-rose-600' },
  2: { label: 'Fair / Needed Improvement', color: 'text-amber-700' },
  3: { label: 'Good / Decent Stay', color: 'text-amber-600' },
  4: { label: 'Great / Very Satisfied', color: 'text-emerald-700' },
  5: { label: 'Exceptional / Highly Recommended', color: 'text-emerald-600' },
};

export function ReviewModal({
  hotelId,
  hotelName,
  googleMapsReviewsUrl,
  open,
  onClose,
  onReviewSubmitted
}: ReviewModalProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userBookings, setUserBookings] = useState<Booking[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(true);

  useEffect(() => {
    if (!open || !user || !hotelId) return;
    let isMounted = true;
    setCheckingEligibility(true);
    setError(null);

    const checkEligibility = async () => {
      try {
        const q = query(
          collection(db, 'bookings'),
          where('hotelId', '==', hotelId),
          where('guestId', '==', user.uid),
          where('status', '==', 'confirmed')
        );
        const snap = await getDocs(q);
        if (!isMounted) return;

        // One review per stay: leave out bookings this guest has already reviewed.
        const reviewedSnap = await getDocs(query(
          collection(db, 'reviews'),
          where('hotelId', '==', hotelId),
          where('guestId', '==', user.uid)
        )).catch(() => null);
        if (!isMounted) return;
        const reviewedIds = new Set(reviewedSnap?.docs.map(d => d.data().bookingId) ?? []);
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Booking))
          .filter(b => !b.id || !reviewedIds.has(b.id));

        if (list.length > 0) {
          setUserBookings(list);
          setSelectedBookingId(list[0].id || null);
        } else {
          setUserBookings([]);
          setSelectedBookingId(null);
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.warn('Booking eligibility check warning:', err?.message || err);
        handleFirestoreError(err, OperationType.LIST, 'bookings');
        setUserBookings([]);
        setSelectedBookingId(null);
      } finally {
        if (isMounted) setCheckingEligibility(false);
      }
    };

    checkEligibility();
    return () => {
      isMounted = false;
    };
  }, [open, hotelId, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedBookingId || submitting) return;

    const trimmedText = text.trim();
    if (!trimmedText || trimmedText.length < 10) {
      setError('Please provide at least 10 characters describing your experience.');
      return;
    }
    if (trimmedText.length > 2000) {
      setError('Review must be 2000 characters or fewer.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const reviewRef = doc(collection(db, 'reviews'));
      const newReview: Review = {
        id: reviewRef.id,
        hotelId,
        bookingId: selectedBookingId,
        guestId: user.uid,
        authorName: user.displayName || user.email?.split('@')[0] || 'Verified Guest',
        rating,
        ...(title.trim() ? { title: title.trim() } : {}),
        text: trimmedText,
        createdAt: Date.now(),
      };

      await setDoc(reviewRef, newReview);
      toast.success('Your verified review is live!');
      if (onReviewSubmitted) {
        onReviewSubmitted(newReview);
      }
      onClose();
    } catch (err: any) {
      console.error('Failed to submit review:', err);
      setError(err?.message || 'Failed to submit review. Please check your connection.');
      handleFirestoreError(err, OperationType.WRITE, 'reviews');
    } finally {
      setSubmitting(false);
    }
  };

  const activeRating = hoverRating || rating;
  const ratingInfo = RATING_DESCRIPTIONS[activeRating] || RATING_DESCRIPTIONS[5];

  if (!open) return null;

  return (
    <Modal 
      open={open} 
      onClose={onClose} 
      title={hotelName ? `Review ${hotelName}` : 'Write a Verified Review'} 
      size="md"
    >
      {!user ? (
        <div className="text-center py-6 space-y-4">
          <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-stone-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-serif font-bold text-stone-900 text-base">Sign In Required</h4>
            <p className="text-stone-500 text-xs sm:text-sm mt-1 max-w-sm mx-auto">
              You must be signed in with the account used for your booking to submit a verified guest review.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="tm-btn tm-btn-primary"
          >
            Close
          </button>
        </div>
      ) : checkingEligibility ? (
        <div className="py-10 text-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-stone-600 mx-auto" />
          <p className="text-stone-500 text-xs sm:text-sm font-medium">
            Verifying stay reservation records for {hotelName || 'this property'}...
          </p>
        </div>
      ) : userBookings.length === 0 ? (
        <div className="py-2 space-y-4">
          <div className="bg-amber-50/90 border border-amber-200/90 rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="w-5 h-5 text-amber-700" />
              </div>
              <div className="space-y-1">
                <h4 className="font-serif font-bold text-amber-950 text-sm sm:text-base">
                  Authentic Stay Policy
                </h4>
                <p className="text-amber-900 text-xs leading-relaxed">
                  To protect travelers from fake, sponsored, or bot-generated feedback, reviews on Travel Malawi can only be posted by <strong>verified guests with a confirmed booking</strong> at {hotelName || 'this property'}.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <p className="text-stone-600 text-xs leading-relaxed">
              Have you stayed here? Make sure you are signed in with the same email used when booking. If you are exploring accommodations, you can reserve a room below or browse live community feedback directly on Google Maps.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  const roomsEl = document.getElementById('rooms');
                  if (roomsEl) roomsEl.scrollIntoView({ behavior: 'smooth' });
                }}
                className="tm-btn tm-btn-primary w-full sm:flex-1"
              >
                <BedDouble className="w-4 h-4 text-amber-400" />
                <span>Book a Stay at {hotelName || 'This Stay'}</span>
              </button>

              {googleMapsReviewsUrl && (
                <a
                  href={googleMapsReviewsUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="w-full sm:w-auto py-2.5 px-4 bg-white hover:bg-stone-100 text-stone-800 rounded-xl text-xs font-semibold border border-stone-200 transition flex items-center justify-center gap-1.5"
                >
                  <span>Google Reviews</span>
                  <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
                </a>
              )}
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Verified Stay Badge */}
          <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="font-semibold text-emerald-900">
                Verified Guest Stay Confirmed
              </span>
            </div>
            {userBookings.length > 1 && (
              <select
                value={selectedBookingId || ''}
                onChange={(e) => setSelectedBookingId(e.target.value)}
                className="bg-white border border-emerald-300 rounded-lg px-2 py-1 text-[11px] font-medium text-emerald-950 focus:outline-none"
              >
                {userBookings.map((b, idx) => (
                  <option key={b.id || idx} value={b.id}>
                    Booking #{b.reference || b.id?.slice(0, 8)} ({b.checkIn})
                  </option>
                ))}
              </select>
            )}
            {userBookings.length === 1 && (
              <span className="text-[11px] text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded">
                Ref: {userBookings[0].reference || userBookings[0].id?.slice(0, 8)}
              </span>
            )}
          </div>

          {/* Star Rating Picker */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-stone-800">
                Overall Rating
              </label>
              <span className={`text-xs font-semibold ${ratingInfo.color}`}>
                {ratingInfo.label}
              </span>
            </div>

            <div className="flex items-center gap-1.5 p-2 bg-stone-50 rounded-xl border border-stone-200/80">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  className="p-1 focus:outline-none transition-transform hover:scale-110 cursor-pointer"
                  title={`${star} Star${star > 1 ? 's' : ''}`}
                >
                  <Star
                    className={`h-7 w-7 transition-colors ${
                      star <= activeRating
                        ? 'fill-amber-400 text-amber-500'
                        : 'text-stone-300 fill-stone-100'
                    }`}
                  />
                </button>
              ))}
              <span className="ml-auto text-xs font-bold text-stone-700 bg-white border border-stone-200 px-2 py-1 rounded-md">
                {activeRating}.0 / 5.0
              </span>
            </div>
          </div>

          {/* Review Headline / Title */}
          <div>
            <label className="block text-xs font-bold text-stone-800 mb-1.5">
              Review Title (Optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Unforgettable lakeside sunset & warm hospitality"
              maxLength={120}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 focus:bg-white focus:border-stone-900 outline-none transition"
            />
          </div>

          {/* Review Feedback Text */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-stone-800">
                Your Authentic Experience
              </label>
              <span className={`text-[11px] ${text.length > 1900 ? 'text-amber-600 font-bold' : 'text-stone-400'}`}>
                {text.length}/2000
              </span>
            </div>
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (error) setError(null);
              }}
              rows={4}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs sm:text-sm text-stone-900 focus:bg-white focus:border-stone-900 outline-none transition resize-none leading-relaxed"
              placeholder="Tell other travelers about your stay — room comfort, lake views or safari sightings, food quality, access road conditions, and how welcoming the hosts were..."
              required
              maxLength={2000}
            />
            <p className="text-[11px] text-stone-500 mt-1">
              Minimum 10 characters. Honest feedback helps independent Malawian lodges and future guests.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-xs font-semibold hover:bg-stone-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || text.trim().length < 10}
              className="tm-btn tm-btn-primary"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Publishing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Publish review</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
