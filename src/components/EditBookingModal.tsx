import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Booking } from '../types';
import { Save } from 'lucide-react';
import { fieldClass, labelClass } from './Modal';

interface Props {
  booking: Booking | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (bookingId: string, patch: Partial<Booking>) => Promise<void>;
}

export default function EditBookingModal({ booking, isOpen, onClose, onSave }: Props) {
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestWhatsapp, setGuestWhatsapp] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (booking && isOpen) {
      setGuestName(booking.guestName || '');
      setGuestEmail(booking.guestEmail || '');
      setGuestPhone(booking.guestPhone || '');
      setGuestWhatsapp(booking.guestWhatsapp || '');
      setCheckIn(booking.checkIn || '');
      setCheckOut(booking.checkOut || '');
      setGuests(booking.guests || 1);
    }
  }, [booking, isOpen]);

  if (!isOpen || !booking) return null;

  const handleSave = async () => {
    setSaving(true);
    await onSave(booking.id!, {
      guestName,
      guestEmail,
      guestPhone,
      guestWhatsapp,
      checkIn,
      checkOut,
      guests
    });
    setSaving(false);
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Edit Booking"
      size="md"
      footer={
        <div className="flex justify-end gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-full text-sm font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 transition"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Check-in Date</label>
            <input
              type="date"
              value={checkIn}
              onChange={e => setCheckIn(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Check-out Date</label>
            <input
              type="date"
              value={checkOut}
              onChange={e => setCheckOut(e.target.value)}
              className={fieldClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Number of Guests</label>
          <input
            type="number"
            min="1"
            value={guests}
            onChange={e => setGuests(parseInt(e.target.value, 10) || 1)}
            className={fieldClass}
          />
        </div>

        <div>
          <label className={labelClass}>Guest Name</label>
          <input
            type="text"
            value={guestName}
            onChange={e => setGuestName(e.target.value)}
            className={fieldClass}
          />
        </div>

        <div>
          <label className={labelClass}>Email Address</label>
          <input
            type="email"
            value={guestEmail}
            onChange={e => setGuestEmail(e.target.value)}
            className={fieldClass}
            placeholder="guest@example.com"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Phone Number</label>
            <input
              type="tel"
              value={guestPhone}
              onChange={e => setGuestPhone(e.target.value)}
              className={fieldClass}
              placeholder="+1234567890"
            />
          </div>
          <div>
            <label className={labelClass}>WhatsApp Number</label>
            <input
              type="tel"
              value={guestWhatsapp}
              onChange={e => setGuestWhatsapp(e.target.value)}
              className={fieldClass}
              placeholder="+1234567890"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
