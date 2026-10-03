import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { Booking } from '../types';
import { confirmBooking, confirmErrorMessage, ConfirmOptions, PriceCheck, PriceMismatchError } from '../lib/transactions';

export interface ConfirmRequest extends ConfirmOptions {
  /** Called with the fields written once the booking is confirmed. */
  onConfirmed?: (patch: Record<string, unknown>) => void | Promise<void>;
}

export interface PendingMismatch {
  booking: Booking;
  check: PriceCheck;
  request: ConfirmRequest;
}

/**
 * Shared confirm flow for every screen that can confirm a booking. A price
 * mismatch is held as state so the screen can show an inline notice with an
 * explicit "confirm at stored price" choice.
 */
export function useConfirmBooking() {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [mismatch, setMismatch] = useState<PendingMismatch | null>(null);

  const run = useCallback(async (booking: Booking, request: ConfirmRequest): Promise<boolean> => {
    setBusyId(booking.id ?? null);
    try {
      const patch = await confirmBooking(booking, request);
      setMismatch(null);
      await request.onConfirmed?.(patch);
      return true;
    } catch (err) {
      if (err instanceof PriceMismatchError) {
        setMismatch({ booking, check: err.check, request });
      } else {
        console.error('Confirm booking failed:', err);
        toast.error(confirmErrorMessage(err));
      }
      return false;
    } finally {
      setBusyId(null);
    }
  }, []);

  const confirm = useCallback((booking: Booking, request: ConfirmRequest = {}) => run(booking, request), [run]);

  const confirmAnyway = useCallback(async () => {
    if (!mismatch) return false;
    return run(mismatch.booking, { ...mismatch.request, acceptStoredPrice: true });
  }, [mismatch, run]);

  const dismiss = useCallback(() => setMismatch(null), []);

  return { confirm, confirmAnyway, dismiss, mismatch, busyId };
}
