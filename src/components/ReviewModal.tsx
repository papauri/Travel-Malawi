import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import Modal from './Modal';
import { Star } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/handleFirestoreError';
import type { Booking } from '../types';

export function ReviewModal({
  hotelId,
  open,
  onClose,
  onReviewSubmitted
}: {
  hotelId: string;
  open: boolean;
  onClose: () => void;
  onReviewSubmitted: () => void;
}) {
  const { user } = useAuth();
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(true);

  useEffect(() => {
    if (!open || !user) return;
    setCheckingEligibility(true);
    const checkEligibility = async () => {
      try {
        const pathForGetDocs = 'bookings';
        const q = query(
          collection(db, pathForGetDocs),
          where('hotelId', '==', hotelId),
          where('guestId', '==', user.uid),
          where('status', '==', 'confirmed')
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          // Find any confirmed booking to attach the review to
          setBookingId(snap.docs[0].id);
        } else {
          setBookingId(null);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'bookings');
        setBookingId(null);
      } finally {
        setCheckingEligibility(false);
      }
    };
    checkEligibility();
  }, [open, hotelId, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !bookingId) return;
    if (!text.trim() || text.length > 2000) {
      setError('Please provide a review under 2000 characters.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const reviewRef = doc(collection(db, 'reviews'));
      const newReview = {
        hotelId,
        bookingId,
        guestId: user.uid,
        authorName: user.displayName || 'Guest',
        rating,
        text: text.trim(),
        createdAt: Date.now()
      };
      await setDoc(reviewRef, newReview);
      onReviewSubmitted();
      onClose();
    } catch (err) {
      setError('Failed to submit review.');
      console.error(err);
      handleFirestoreError(err, OperationType.WRITE, 'reviews');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Leave a Review" size="md">
      {!user ? (
        <p className="text-stone-500">You must be signed in to leave a review.</p>
      ) : checkingEligibility ? (
        <p className="text-stone-500">Checking eligibility...</p>
      ) : !bookingId ? (
        <p className="text-amber-800 bg-amber-50 p-4 rounded-xl">
          You must have a confirmed booking at this property to leave a review.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="focus:outline-none"
                >
                  <Star
                    className={`h-8 w-8 transition ${
                      rating >= star ? 'fill-emerald-500 text-emerald-500' : 'text-stone-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Review</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-32 rounded-xl border border-stone-200 p-3 text-stone-900 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition resize-none"
              placeholder="Tell us about your stay..."
              required
              maxLength={2000}
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-stone-900 text-white py-3 rounded-xl font-semibold hover:bg-stone-800 transition disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </form>
      )}
    </Modal>
  );
}
