import Modal from './Modal';
import { formatMoney } from '../lib/currency';
import { PendingMismatch } from '../hooks/useConfirmBooking';

interface Props {
  mismatch: PendingMismatch | null;
  busy?: boolean;
  onConfirmAnyway: () => void;
  onDismiss: () => void;
}

/**
 * Shown when a booking's stored total is below the current price for the
 * stay. The manager must choose explicitly to honour the stored price.
 */
export default function PriceMismatchNotice({ mismatch, busy, onConfirmAnyway, onDismiss }: Props) {
  if (!mismatch) return null;
  const { check, booking } = mismatch;
  return (
    <Modal
      open
      onClose={onDismiss}
      size="md"
      title="Check the price before confirming"
      description={booking.guestName ? `${booking.guestName} · ${booking.checkIn} to ${booking.checkOut}` : undefined}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="border border-stone-300 text-stone-800 rounded-md px-3 py-1.5 text-sm hover:bg-stone-50"
          >
            Don't confirm
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirmAnyway}
            className="bg-stone-900 text-white rounded-md px-3 py-1.5 text-sm hover:bg-stone-800 disabled:opacity-50"
          >
            Confirm at {formatMoney(check.stored, check.currency)}
          </button>
        </div>
      }
    >
      <div className="bg-stone-50 border-l-2 border-stone-300 px-4 py-3 text-sm text-stone-700" role="alert">
        This booking was submitted at <strong>{formatMoney(check.stored, check.currency)}</strong>, but the current
        price for these dates is <strong>{formatMoney(check.expected, check.currency)}</strong>. Confirm only if you
        agreed this price with the guest.
      </div>
    </Modal>
  );
}
