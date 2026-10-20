import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Booking } from '../types';
import { Save } from 'lucide-react';
import { todayStr } from '../lib/dates';
import { usePlatformMode } from '../contexts/PlatformModeContext';

interface Props {
  booking: Booking | null;
  isOpen: boolean;
  onClose: () => void;
  /** Resolves to an error message to show, or null on success. */
  onSave: (bookingId: string, patch: Partial<Booking>) => Promise<string | null | void>;
}

export default function EditBookingModal({ booking, isOpen, onClose, onSave }: Props) {
  const { bookingsEnabled } = usePlatformMode();
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestWhatsapp, setGuestWhatsapp] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (booking && isOpen) {
      setGuestName(booking.guestName || '');
      setGuestEmail(booking.guestEmail || '');
      setGuestPhone(booking.guestPhone || '');
      setGuestWhatsapp(booking.guestWhatsapp || '');
      setCheckIn(booking.checkIn || '');
      setCheckOut(booking.checkOut || '');
      setGuests(booking.guests || 1);
      setError(null);
    }
  }, [booking, isOpen]);

  if (!bookingsEnabled || !isOpen || !booking) return null;

  const handleSave = async () => {
    setError(null);
    if (!checkIn || !checkOut || checkOut <= checkIn) {
      setError('Check-out must be after check-in.');
      return;
    }
    // A stay may keep a check-in that has already passed, but cannot be moved into the past.
    if (checkIn !== booking.checkIn && checkIn < todayStr()) {
      setError('Check-in cannot be moved to a date in the past.');
      return;
    }
    if (guests < 1) {
      setError('There must be at least one guest.');
      return;
    }
    setSaving(true);
    try {
      const problem = await onSave(booking.id!, {
        guestName,
        guestEmail,
        guestPhone,
        guestWhatsapp,
        checkIn,
        checkOut,
        guests
      });
      if (typeof problem === 'string') setError(problem);
    } catch (err) {
      console.error('Saving booking changes failed:', err);
      setError('Could not save these changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Edit booking"
      size="md"
      footer={
        <div className="tm-actions justify-end w-full">
          <button
            type="button"
            onClick={onClose}
            className="tm-btn tm-btn-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="tm-btn tm-btn-primary"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <p className="text-sm text-red-700" role="alert">{error}</p>
        )}
        <p className="tm-muted">New dates or guest numbers re-check availability and update the total.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="tm-label">Check-in</label>
            <input
              type="date"
              value={checkIn}
              onChange={e => setCheckIn(e.target.value)}
              onClick={e => { try { (e.target as HTMLInputElement).showPicker?.(); } catch {} }}
              className="tm-input cursor-pointer"
            />
          </div>
          <div>
            <label className="tm-label">Check-out</label>
            <input
              type="date"
              value={checkOut}
              onChange={e => setCheckOut(e.target.value)}
              onClick={e => { try { (e.target as HTMLInputElement).showPicker?.(); } catch {} }}
              className="tm-input cursor-pointer"
            />
          </div>
        </div>

        <div>
          <label className="tm-label">Guests</label>
          <input
            type="number"
            min="1"
            value={guests}
            onChange={e => setGuests(parseInt(e.target.value, 10) || 1)}
            className="tm-input"
          />
        </div>

        <div>
          <label className="tm-label">Guest name</label>
          <input
            type="text"
            value={guestName}
            onChange={e => setGuestName(e.target.value)}
            className="tm-input"
          />
        </div>

        <div>
          <label className="tm-label">Email</label>
          <input
            type="email"
            value={guestEmail}
            onChange={e => setGuestEmail(e.target.value)}
            className="tm-input"
            placeholder="guest@example.com"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="tm-label">Phone</label>
            <input
              type="tel"
              value={guestPhone}
              onChange={e => setGuestPhone(e.target.value)}
              className="tm-input"
              placeholder="+1234567890"
            />
          </div>
          <div>
            <label className="tm-label">WhatsApp</label>
            <input
              type="tel"
              value={guestWhatsapp}
              onChange={e => setGuestWhatsapp(e.target.value)}
              className="tm-input"
              placeholder="+1234567890"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
