import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'react-qr-code';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, X, Users, Phone, Zap, Droplets, Wifi, 
  Monitor, CheckCircle2, ClipboardList, UtensilsCrossed, Copy, Eye, 
  QrCode, Lock, Unlock, Printer, KeyRound, CreditCard,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useModalScrollIsolation } from '../hooks/useModalScrollIsolation';
import { Booking, Hotel, RoomType } from '../types';
import { formatDateStr, toDateStr } from '../lib/dates';
import PriceDisplay from '../components/PriceDisplay';

type EnrichedBooking = Booking & { hotel?: Hotel; room?: RoomType };

interface Props {
  booking: EnrichedBooking | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function StayVoucherModal({ booking, isOpen, onClose }: Props) {
  const [showWifi, setShowWifi] = useState(false);
  const [copiedWifi, setCopiedWifi] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  useBodyScrollLock(isOpen);
  const scrollIsolationRef = useModalScrollIsolation<HTMLDivElement>(isOpen);
  
  // Arrival PIN Lock State
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  React.useEffect(() => {
    if (booking?.id) {
      const saved = localStorage.getItem(`voucher_unlocked_${booking.id}`);
      if (saved === 'true') setIsUnlocked(true);
    }
  }, [booking?.id]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === booking?.arrivalPin) {
      setIsUnlocked(true);
      setPinError(false);
      localStorage.setItem(`voucher_unlocked_${booking.id}`, 'true');
      toast.success('Stay details shown');
    } else {
      setPinError(true);
      setPinInput('');
      toast.error('That PIN did not match. Check your messages from the host.');
    }
  };

  if (!booking || !booking.hotel) return null;
  const hotel = booking.hotel;

  // Local calendar date (not UTC), and only a confirmed stay unlocks on arrival day.
  const todayStr = toDateStr(new Date());
  const isArrivalDayOrLater = Boolean(booking?.status === 'confirmed' && booking?.checkIn && booking.checkIn <= todayStr);
  const isUnlockedEffective = isUnlocked || isArrivalDayOrLater;
  const isLocked = Boolean(booking?.arrivalPin && !isUnlockedEffective);

  const bookingRef = booking.reference || booking.id.slice(0, 8).toUpperCase();
  const arrivalPin = booking.arrivalPin || 'Available at desk';

  const checkInQrData = JSON.stringify({
    platform: 'Travel Malawi',
    ref: bookingRef,
    id: booking.id,
    hotel: hotel.name,
    guest: booking.guestName,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    pin: isUnlockedEffective ? arrivalPin : 'LOCKED',
    status: booking.status,
  });

  const handlePrint = () => {
    window.print();
  };

  const handleCopySummary = () => {
    const text = `TRAVEL MALAWI DIGITAL VOUCHER
Property: ${hotel.name} (${hotel.location})
Booking Ref: #${bookingRef}
Guest: ${booking.guestName}
Stay Dates: ${formatDateStr(booking.checkIn)} to ${formatDateStr(booking.checkOut)}
Room: ${booking.room?.name || 'Confirmed Room'}
Arrival Gate PIN: ${arrivalPin}
Total Price: ${booking.currency || 'MWK'} ${Number(booking.total || 0).toLocaleString()} (Payment on arrival)
Host Contact: ${hotel.contactPhone || hotel.managerPhone || 'via Travel Malawi chat'}`;
    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    toast.success('Voucher details copied');
    setTimeout(() => setCopiedSummary(false), 2000);
  };


  if (typeof document === 'undefined') return null;

  const iconBtn = 'p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer';
  const callLink = 'tm-btn tm-btn-secondary tm-btn-sm shrink-0';
  const infra = hotel.infrastructure;
  const infraRows = infra ? [
    infra.powerSource && infra.powerSource !== 'None' ? { icon: Zap, label: 'Power', value: infra.powerSource } : null,
    infra.waterSource ? { icon: Droplets, label: 'Water', value: infra.waterSource } : null,
    infra.internetSource && infra.internetSource !== 'None' ? { icon: Wifi, label: 'Internet', value: infra.internetSource } : null,
    infra.workspaceSetup && infra.workspaceSetup !== 'None' ? { icon: Monitor, label: 'Workspace', value: infra.workspaceSetup } : null,
  ].filter(Boolean) as { icon: typeof Zap; label: string; value: string }[] : [];

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          key="stay-voucher-modal-portal-root"
          data-lenis-prevent="true"
          className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain flex min-h-full items-center justify-center p-3 sm:p-4 md:p-6 bg-stone-900/60 text-center print:p-0 print:bg-white"
        >
          <motion.div
            ref={scrollIsolationRef}
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            className="w-full max-w-2xl my-auto bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden flex flex-col max-h-[calc(100dvh-2.5rem)] sm:max-h-[88dvh] relative overscroll-contain text-left print:max-h-none print:shadow-none print:rounded-none"
            data-lenis-prevent="true"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-stone-200 flex items-start justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <p className="tm-muted">Stay voucher</p>
                <h2 className="tm-h1 break-words">{hotel.name}</h2>
                <p className="tm-muted flex items-center gap-1 mt-1">
                  <MapPin className="w-4 h-4 shrink-0" /> <span className="truncate">{hotel.location}</span>
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0 print:hidden">
                <button type="button" onClick={handlePrint} className={iconBtn} title="Print or save as PDF" aria-label="Print voucher">
                  <Printer className="w-5 h-5" />
                </button>
                <button type="button" onClick={handleCopySummary} className={iconBtn} title="Copy voucher details" aria-label="Copy voucher details">
                  {copiedSummary ? <Check className="w-5 h-5 text-emerald-700" /> : <Copy className="w-5 h-5" />}
                </button>
                <button type="button" onClick={onClose} className={iconBtn} title="Close" aria-label="Close voucher">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div data-lenis-prevent="true" className="overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-5 flex-1 min-w-0 scrollbar-slim">

              {/* Status + reference */}
              <div className="space-y-2">
                <div className="tm-actions">
                  <span className="tm-tag tm-tag-good"><CheckCircle2 className="w-3.5 h-3.5" /> Confirmed · pay on arrival</span>
                  <span className="tm-tag font-mono">Ref #{bookingRef}</span>
                </div>
                <p className="text-sm text-stone-600">
                  Show this voucher at reception and pay <strong className="text-stone-900"><PriceDisplay amount={booking.total ?? 0} currency={booking.currency} /></strong> to the property.
                </p>
              </div>

              {/* Stay details */}
              <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 text-sm">
                <div className="min-w-0">
                  <dt className="tm-muted">Check-in</dt>
                  <dd className="font-semibold text-stone-900">{formatDateStr(booking.checkIn)}</dd>
                  <dd className="text-xs text-stone-500">From 2:00 PM</dd>
                </div>
                <div className="min-w-0">
                  <dt className="tm-muted">Check-out</dt>
                  <dd className="font-semibold text-stone-900">{formatDateStr(booking.checkOut)}</dd>
                  <dd className="text-xs text-stone-500">Until 10:30 AM</dd>
                </div>
                <div className="min-w-0">
                  <dt className="tm-muted">Guests</dt>
                  <dd className="font-semibold text-stone-900">{booking.guests} {booking.guests === 1 ? 'guest' : 'guests'}</dd>
                  <dd className="text-xs text-stone-500 truncate">{booking.guestName}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="tm-muted">Room</dt>
                  <dd className="font-semibold text-stone-900 truncate" title={booking.room?.name || 'Room'}>{booking.room?.name || 'Standard Room'}</dd>
                  <dd className="text-xs text-stone-500">{booking.quantity || 1} unit(s)</dd>
                </div>
              </dl>

              {/* Check-in QR */}
              <div className="tm-divider pt-5 flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
                <div className="p-2 bg-white rounded-lg border border-stone-200 shrink-0">
                  <QRCode value={checkInQrData} size={110} level="M" />
                </div>
                <div className="text-center sm:text-left min-w-0">
                  <h3 className="tm-h2">Check-in code</h3>
                  <p className="tm-muted mt-1">Staff scan this at reception or the gate to find your booking.</p>
                </div>
              </div>

              {/* Arrival PIN (shown when unlocked or on arrival day) */}
              {isUnlockedEffective && booking.arrivalPin && (
                <div className="tm-divider pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <KeyRound className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <h3 className="tm-h2">Arrival PIN</h3>
                      <p className="tm-muted">Give this code at the entrance or gate.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <code className="text-2xl font-mono font-semibold text-stone-900 tracking-wider">{booking.arrivalPin}</code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(booking.arrivalPin || '');
                        setCopiedPin(true);
                        toast.success('PIN copied');
                        setTimeout(() => setCopiedPin(false), 2000);
                      }}
                      className={iconBtn}
                      title="Copy PIN"
                      aria-label="Copy arrival PIN"
                    >
                      {copiedPin ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* PIN entry (before arrival day, not yet unlocked) */}
              {isLocked && (
                <div className="tm-divider pt-5 text-center">
                  <Lock className="w-6 h-6 text-amber-800 mx-auto mb-2" />
                  <h3 className="tm-h2">Enter your arrival PIN</h3>
                  <p className="tm-muted max-w-md mx-auto mt-1 mb-4">
                    Your host sent a 4-digit PIN by chat or email. Wi-Fi, contacts and the daily board open with it, or on {formatDateStr(booking.checkIn)}.
                  </p>
                  <form onSubmit={handleUnlock} className="flex flex-col items-center gap-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="• • • •"
                      aria-label="Arrival PIN"
                      className={`tm-input text-center text-2xl tracking-[0.8em] indent-[0.8em] font-mono w-44 ${pinError ? 'border-red-500 text-red-700' : ''}`}
                    />
                    {pinError && <p className="text-red-700 text-sm">That PIN didn't match. Check your messages and try again.</p>}
                    <button type="submit" disabled={pinInput.length !== 4} className="tm-btn tm-btn-primary">
                      <Unlock className="w-4 h-4" /> Show stay details
                    </button>
                  </form>
                </div>
              )}

              {!isLocked && (
                <>
                  {/* Payment details (Malawi rails) */}
                  {hotel.depositInfo && (hotel.depositInfo.airtelMoneyNumber || hotel.depositInfo.mpambaNumber || hotel.depositInfo.bankName || hotel.depositInfo.instructions) && (
                    <div className="tm-divider pt-5">
                      <h3 className="tm-h2 flex items-center gap-2 mb-3"><CreditCard className="w-5 h-5 text-stone-500" /> How to pay</h3>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
                        {hotel.depositInfo.airtelMoneyNumber && (
                          <div className="min-w-0">
                            <dt className="tm-muted">Airtel Money</dt>
                            <dd className="font-semibold text-stone-900 tabular-nums break-words">{hotel.depositInfo.airtelMoneyNumber}</dd>
                            {hotel.depositInfo.airtelMoneyName && <dd className="text-xs text-stone-500">{hotel.depositInfo.airtelMoneyName}</dd>}
                          </div>
                        )}
                        {hotel.depositInfo.mpambaNumber && (
                          <div className="min-w-0">
                            <dt className="tm-muted">TNM Mpamba</dt>
                            <dd className="font-semibold text-stone-900 tabular-nums break-words">{hotel.depositInfo.mpambaNumber}</dd>
                            {hotel.depositInfo.mpambaName && <dd className="text-xs text-stone-500">{hotel.depositInfo.mpambaName}</dd>}
                          </div>
                        )}
                        {hotel.depositInfo.bankName && (
                          <div className="sm:col-span-2 min-w-0">
                            <dt className="tm-muted">Bank transfer</dt>
                            <dd className="text-stone-800 break-words">
                              <strong>{hotel.depositInfo.bankName}</strong>
                              {hotel.depositInfo.bankAccountNumber && <> · Acc: <span className="font-semibold tabular-nums">{hotel.depositInfo.bankAccountNumber}</span></>}
                              {hotel.depositInfo.bankAccountName && <> ({hotel.depositInfo.bankAccountName})</>}
                              {hotel.depositInfo.bankBranch && <> · Branch: {hotel.depositInfo.bankBranch}</>}
                            </dd>
                          </div>
                        )}
                      </dl>
                      {hotel.depositInfo.instructions && (
                        <p className="mt-3 text-sm text-stone-600 break-words">{hotel.depositInfo.instructions}</p>
                      )}
                    </div>
                  )}

                  {/* Daily board */}
                  {hotel.dailyBoard && (hotel.dailyBoard.activities || hotel.dailyBoard.dishOfTheDay || hotel.dailyBoard.notes) && (
                    <div className="tm-divider pt-5">
                      <h3 className="tm-h2 flex items-center gap-2 mb-3"><ClipboardList className="w-5 h-5 text-stone-500" /> Today at the property</h3>
                      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 text-sm">
                        {hotel.dailyBoard.activities && (
                          <div className="min-w-0">
                            <dt className="tm-muted">Activities</dt>
                            <dd className="text-stone-800 whitespace-pre-wrap break-words">{hotel.dailyBoard.activities}</dd>
                          </div>
                        )}
                        {hotel.dailyBoard.dishOfTheDay && (
                          <div className="min-w-0">
                            <dt className="tm-muted flex items-center gap-1"><UtensilsCrossed className="w-3.5 h-3.5" /> Dish of the day</dt>
                            <dd className="font-semibold text-stone-900 break-words">{hotel.dailyBoard.dishOfTheDay}</dd>
                          </div>
                        )}
                        {hotel.dailyBoard.notes && (
                          <div className="md:col-span-2 min-w-0">
                            <dt className="tm-muted">Notes</dt>
                            <dd className="text-stone-800 whitespace-pre-wrap break-words">{hotel.dailyBoard.notes}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  )}

                  {/* Guest Wi-Fi */}
                  {hotel.infrastructure?.shareWifiVoucher && hotel.adminWifiVoucherEnabled !== false && hotel.infrastructure.wifiSSID && (
                    <div className="tm-divider pt-5">
                      <h3 className="tm-h2 flex items-center gap-2 mb-3"><Wifi className="w-5 h-5 text-stone-500" /> Guest Wi-Fi</h3>
                      {!showWifi ? (
                        <button type="button" onClick={() => setShowWifi(true)} className="tm-btn tm-btn-secondary">
                          <Eye className="w-4 h-4" /> Show Wi-Fi password
                        </button>
                      ) : (
                        <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
                          <div className="shrink-0 p-2 rounded-lg border border-stone-200 bg-white">
                            <QRCode
                              value={`WIFI:S:${hotel.infrastructure.wifiSSID};T:WPA;P:${hotel.infrastructure.wifiPassword || ''};;`}
                              size={110}
                              level="M"
                            />
                          </div>
                          <dl className="flex-1 w-full min-w-0 text-center sm:text-left space-y-2 text-sm">
                            <div>
                              <dt className="tm-muted">Network</dt>
                              <dd className="font-semibold text-stone-900 break-words">{hotel.infrastructure.wifiSSID}</dd>
                            </div>
                            {hotel.infrastructure.wifiPassword && (
                              <div>
                                <dt className="tm-muted">Password</dt>
                                <dd className="flex items-center justify-center sm:justify-start gap-2">
                                  <code className="font-mono bg-stone-100 px-2.5 py-1 rounded-md text-stone-900 break-all">{hotel.infrastructure.wifiPassword}</code>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(hotel.infrastructure.wifiPassword || '');
                                      setCopiedWifi(true);
                                      toast.success('Password copied');
                                      setTimeout(() => setCopiedWifi(false), 2000);
                                    }}
                                    className={iconBtn}
                                    title="Copy password"
                                    aria-label="Copy Wi-Fi password"
                                  >
                                    {copiedWifi ? <CheckCircle2 className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
                                  </button>
                                </dd>
                              </div>
                            )}
                            <p className="tm-muted flex items-center justify-center sm:justify-start gap-1">
                              <QrCode className="w-3.5 h-3.5" /> Scan with your phone camera to connect.
                            </p>
                          </dl>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Facilities */}
                  {infraRows.length > 0 && (
                    <div className="tm-divider pt-5">
                      <h3 className="tm-h2 mb-3">Facilities</h3>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                        {infraRows.map(({ icon: Icon, label, value }) => (
                          <div key={label} className="flex items-start gap-2 min-w-0">
                            <Icon className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <dt className="tm-muted">{label}</dt>
                              <dd className="font-medium text-stone-900 break-words">{value}</dd>
                            </div>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}

                  {/* Host & on-site team */}
                  {(hotel.crew && hotel.crew.length > 0) || hotel.contactPhone ? (
                    <div className="tm-divider pt-5">
                      <h3 className="tm-h2 flex items-center gap-2 mb-2"><Users className="w-5 h-5 text-stone-500" /> Contacts</h3>
                      <ul className="divide-y divide-stone-100">
                        {hotel.contactPhone && (
                          <li className="py-2.5 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-stone-900 text-sm truncate">{hotel.name} desk</p>
                              <p className="tm-muted">General questions</p>
                            </div>
                            <a href={`tel:${hotel.contactPhone}`} className={callLink}>
                              <Phone className="w-3.5 h-3.5" /> Call
                            </a>
                          </li>
                        )}
                        {hotel.crew?.map((member, mIdx) => (
                          <li key={`${member.id || 'crew'}-${mIdx}`} className="py-2.5 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-stone-900 text-sm truncate">{member.name}</p>
                              <p className="tm-muted truncate">{member.role}</p>
                            </div>
                            {member.phone && (
                              <a href={`tel:${member.phone}`} className={callLink}>
                                <Phone className="w-3.5 h-3.5" /> Call
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
