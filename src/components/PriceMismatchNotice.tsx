import Modal from './Modal';
import { formatMoney } from '../lib/currency';
import { PendingMismatch } from '../hooks/useConfirmBooking';
import { usePlatformMode } from '../contexts/PlatformModeContext';

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
  const { bookingsEnabled } = usePlatformMode();
  if (!bookingsEnabled || !mismatch) return null;
  const { check, booking } = mismatch;
  return (
    <Modal
      open
      onClose={onDismiss}
      size="md"
      title="Check the price before confirming"
      description={booking.guestName ? `${booking.guestName} · ${booking.checkIn} to ${booking.checkOut}` : undefined}
      footer={
        <div className="tm-actions justify-end">
          <button
            type="button"
            onClick={onDismiss}
            className="tm-btn tm-btn-secondary"
          >
            Don't confirm
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirmAnyway}
            className="tm-btn tm-btn-primary"
          >
            Confirm at {formatMoney(check.stored, check.currency)}
          </button>
        </div>
      }
    >
      <p className="text-sm text-stone-700" role="alert">
        This booking was submitted at <strong>{formatMoney(check.stored, check.currency)}</strong>, but the current
        price for these dates is <strong>{formatMoney(check.expected, check.currency)}</strong>. Confirm only if you
        agreed this price with the guest.
      </p>
    </Modal>
  );
}
