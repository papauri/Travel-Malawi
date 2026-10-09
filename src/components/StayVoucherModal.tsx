import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'react-qr-code';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, MapPin, X, Users, Phone, Zap, Droplets, Map, Wifi, 
  Monitor, CheckCircle2, ClipboardList, UtensilsCrossed, Copy, Eye, 
  QrCode, Lock, Unlock, Printer, KeyRound, CreditCard, ExternalLink,
  MessageCircle, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useModalScrollIsolation } from '../hooks/useModalScrollIsolation';
import { Booking, Hotel, RoomType } from '../types';
import { formatMoney } from '../lib/booking';
import { formatDateStr } from '../lib/dates';
import SmartImage from './SmartImage';
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
      toast.success('Voucher credentials unlocked!');
    } else {
      setPinError(true);
      setPinInput('');
      toast.error('Incorrect PIN. Please check your message thread.');
    }
  };

  if (!booking || !booking.hotel) return null;
  const hotel = booking.hotel;

  const todayStr = new Date().toISOString().split('T')[0];
  const isArrivalDayOrLater = Boolean(booking?.checkIn && booking.checkIn <= todayStr);
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
    status: 'confirmed',
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
    toast.success('Voucher summary copied to clipboard!');
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          data-lenis-prevent="true"
          className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain flex min-h-full items-center justify-center p-3 sm:p-4 md:p-6 bg-stone-900/60 backdrop-blur-sm text-center print:p-0 print:bg-white"
        >
          <motion.div
            ref={scrollIsolationRef}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-2xl my-auto bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-2.5rem)] sm:max-h-[88dvh] relative overscroll-contain text-left print:max-h-none print:shadow-none print:rounded-none"
            data-lenis-prevent="true"
          >
            {/* Header / Ticket Top */}
            <div className="bg-stone-900 text-white p-6 relative shrink-0">
              <div className="absolute top-4 right-4 flex items-center gap-1.5 print:hidden">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="p-2 text-stone-300 hover:text-white hover:bg-stone-800 rounded-full transition cursor-pointer"
                  title="Print / Save Voucher as PDF"
                >
                  <Printer className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="p-2 text-stone-300 hover:text-white hover:bg-stone-800 rounded-full transition cursor-pointer"
                  title="Copy Voucher Summary"
                >
                  {copiedSummary ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 text-stone-400 hover:text-white hover:bg-stone-800 rounded-full transition z-10 cursor-pointer"
                  title="Close Voucher"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                <span className="font-serif font-bold tracking-wide text-stone-200">Travel Malawi Digital Voucher</span>
                <span className="hidden sm:inline-block text-[10px] bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border border-emerald-500/30">
                  Verified Booking
                </span>
              </div>
              
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white mb-2 pr-24 leading-tight">
                {hotel.name}
              </h2>
              <div className="flex items-center gap-1.5 text-stone-400 text-sm">
                <MapPin className="w-4 h-4 text-emerald-400" /> {hotel.location}
              </div>
            </div>

            {/* Scrollable Content */}
            <div data-lenis-prevent="true" className="overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-6 sm:space-y-7 flex-1 scrollbar-slim">
              
              {/* Payment Status & Details */}
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 sm:p-5 flex items-start gap-3 sm:gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <h4 className="font-bold text-emerald-900 text-base sm:text-lg">Confirmed — Payment on Arrival</h4>
                    <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-md">
                      REF: #{bookingRef}
                    </span>
                  </div>
                  <p className="text-emerald-700 text-sm leading-relaxed">
                    Show this digital voucher when you arrive at reception. Settle the balance of <strong className="text-emerald-950"><PriceDisplay amount={booking.total ?? 0} currency={booking.currency} /></strong> directly with the property.
                  </p>
                </div>
              </div>

              {/* Stay Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
                <div className="bg-stone-50 rounded-2xl p-3 sm:p-4 border border-stone-100">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Check-in</p>
                  <p className="font-bold text-stone-900 text-sm sm:text-base">{formatDateStr(booking.checkIn)}</p>
                  <p className="text-[11px] text-stone-500">From 2:00 PM</p>
                </div>
                <div className="bg-stone-50 rounded-2xl p-3 sm:p-4 border border-stone-100">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Check-out</p>
                  <p className="font-bold text-stone-900 text-sm sm:text-base">{formatDateStr(booking.checkOut)}</p>
                  <p className="text-[11px] text-stone-500">Until 10:30 AM</p>
                </div>
                <div className="bg-stone-50 rounded-2xl p-3 sm:p-4 border border-stone-100">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Guests</p>
                  <p className="font-bold text-stone-900 text-sm sm:text-base">{booking.guests} {booking.guests === 1 ? 'Guest' : 'Guests'}</p>
                  <p className="text-[11px] text-stone-500 truncate">{booking.guestName}</p>
                </div>
                <div className="bg-stone-50 rounded-2xl p-3 sm:p-4 border border-stone-100">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Reserved Room</p>
                  <p className="font-bold text-stone-900 text-sm sm:text-base truncate" title={booking.room?.name || 'Room'}>
                    {booking.room?.name || 'Standard Room'}
                  </p>
                  <p className="text-[11px] text-stone-500">{booking.quantity || 1} unit(s)</p>
                </div>
              </div>

              {/* Express Reception Check-In QR Pass */}
              <div className="bg-stone-900 text-white rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-5 sm:gap-6 border border-stone-800">
                <div className="p-3 bg-white rounded-xl shrink-0 shadow-sm">
                  <QRCode value={checkInQrData} size={110} level="M" />
                </div>
                <div className="flex-1 text-center sm:text-left space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold tracking-wide">
                    <QrCode className="w-3.5 h-3.5" /> Express Check-in Pass
                  </div>
                  <h3 className="font-serif font-bold text-lg text-white">
                    Show at Reception Desk or Security Gate
                  </h3>
                  <p className="text-xs text-stone-300 leading-relaxed">
                    Property staff can scan this verified QR code with any phone or tablet to instantly validate your reservation, verify your room assignment, and log your arrival.
                  </p>
                </div>
              </div>

              {/* Arrival PIN Pass (Displayed when unlocked or on arrival day) */}
              {isUnlockedEffective && booking.arrivalPin && (
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                      <KeyRound className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Security Gate &amp; Access Pass</span>
                      <h4 className="font-bold text-stone-900 text-base">Arrival / Security Gate PIN</h4>
                      <p className="text-xs text-stone-600 mt-0.5">
                        Present this 4-digit code at property entrance or security gate for express entry.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto bg-white px-4 py-2.5 rounded-xl border border-amber-200 shadow-2xs">
                    <code className="text-2xl font-mono font-extrabold text-stone-900 tracking-wider">
                      {booking.arrivalPin}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(booking.arrivalPin || '');
                        setCopiedPin(true);
                        toast.success('Arrival PIN copied!');
                        setTimeout(() => setCopiedPin(false), 2000);
                      }}
                      className="p-1.5 text-stone-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                      title="Copy Arrival PIN"
                    >
                      {copiedPin ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Arrival PIN Lock Screen (When before arrival date and not yet unlocked) */}
              {isLocked && (
                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 sm:p-8 text-center relative overflow-hidden shrink-0">
                  <div className="absolute top-0 left-0 w-full h-1 bg-amber-400" />
                  <div className="w-14 h-14 bg-white rounded-2xl shadow-xs border border-stone-200 flex items-center justify-center mx-auto mb-3">
                    <Lock className="w-7 h-7 text-amber-500" />
                  </div>
                  <h3 className="font-serif font-bold text-xl sm:text-2xl text-stone-900 mb-2">Property Credentials Gated</h3>
                  <p className="text-stone-500 max-w-md mx-auto mb-5 text-xs sm:text-sm leading-relaxed">
                    Enter the 4-digit Arrival PIN sent by your host in chat or 24h arrival email. These credentials (Wi-Fi QR, daily board &amp; team contacts) will also unlock automatically on your check-in date ({formatDateStr(booking.checkIn)}).
                  </p>
                  
                  <form onSubmit={handleUnlock} className="flex flex-col items-center gap-3">
                    <input
                      type="text"
                      maxLength={4}
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="• • • •"
                      className={`text-center text-3xl tracking-[1em] indent-[1em] font-mono w-48 py-2.5 bg-white border-2 rounded-xl outline-none transition-colors ${pinError ? 'border-red-500 text-red-500' : 'border-stone-200 focus:border-amber-500'}`}
                    />
                    {pinError && <p className="text-red-500 text-xs font-bold uppercase tracking-wider">Incorrect PIN</p>}
                    <button 
                      type="submit"
                      disabled={pinInput.length !== 4}
                      className="flex items-center gap-2 px-6 py-2.5 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition disabled:opacity-50 text-sm cursor-pointer shadow-xs"
                    >
                      <Unlock className="w-4 h-4" /> Unlock Voucher Details
                    </button>
                  </form>
                </div>
              )}

              {/* Locked Features Wrapper */}
              {!isLocked && (
                <div className="space-y-6">

                  {/* Payment Methods & Deposit Info (Malawi Rails) */}
                  {hotel.depositInfo && (hotel.depositInfo.airtelMoneyNumber || hotel.depositInfo.mpambaNumber || hotel.depositInfo.bankName || hotel.depositInfo.instructions) && (
                    <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <CreditCard className="w-5 h-5 text-emerald-600" />
                        <h4 className="font-bold text-stone-900 text-sm uppercase tracking-wide">
                          Payment Rails &amp; Deposit Details
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {hotel.depositInfo.airtelMoneyNumber && (
                          <div className="bg-white p-3 rounded-xl border border-stone-200/80">
                            <span className="font-bold text-red-600 block mb-0.5">Airtel Money</span>
                            <span className="font-mono font-bold text-stone-800 text-sm">{hotel.depositInfo.airtelMoneyNumber}</span>
                            {hotel.depositInfo.airtelMoneyName && (
                              <p className="text-stone-500 text-[11px] mt-0.5">Name: {hotel.depositInfo.airtelMoneyName}</p>
                            )}
                          </div>
                        )}

                        {hotel.depositInfo.mpambaNumber && (
                          <div className="bg-white p-3 rounded-xl border border-stone-200/80">
                            <span className="font-bold text-emerald-600 block mb-0.5">TNM Mpamba</span>
                            <span className="font-mono font-bold text-stone-800 text-sm">{hotel.depositInfo.mpambaNumber}</span>
                            {hotel.depositInfo.mpambaName && (
                              <p className="text-stone-500 text-[11px] mt-0.5">Name: {hotel.depositInfo.mpambaName}</p>
                            )}
                          </div>
                        )}

                        {hotel.depositInfo.bankName && (
                          <div className="sm:col-span-2 bg-white p-3 rounded-xl border border-stone-200/80">
                            <span className="font-bold text-blue-600 block mb-0.5">Bank Transfer</span>
                            <p className="text-stone-800 font-medium">
                              <strong>{hotel.depositInfo.bankName}</strong>
                              {hotel.depositInfo.bankAccountNumber && <> · Acc: <span className="font-mono font-bold">{hotel.depositInfo.bankAccountNumber}</span></>}
                              {hotel.depositInfo.bankAccountName && <> ({hotel.depositInfo.bankAccountName})</>}
                              {hotel.depositInfo.bankBranch && <> · Branch: {hotel.depositInfo.bankBranch}</>}
                            </p>
                          </div>
                        )}
                      </div>

                      {hotel.depositInfo.instructions && (
                        <p className="mt-3 text-xs text-stone-500 italic bg-white p-2.5 rounded-lg border border-stone-100">
                          📌 {hotel.depositInfo.instructions}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Daily Board */}
                  {hotel.dailyBoard && (hotel.dailyBoard.activities || hotel.dailyBoard.dishOfTheDay || hotel.dailyBoard.notes) && (
                    <div className="bg-emerald-900 text-white rounded-2xl p-5 sm:p-6 shadow-md relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                        <ClipboardList className="w-32 h-32" />
                      </div>
                      <h3 className="font-serif font-bold text-xl mb-4 flex items-center gap-2 relative z-10">
                        <ClipboardList className="w-5 h-5 text-emerald-400" /> Host's Daily Board
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                        {hotel.dailyBoard.activities && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1.5">Today's Activities</p>
                            <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap text-emerald-100">{hotel.dailyBoard.activities}</p>
                          </div>
                        )}
                        {hotel.dailyBoard.dishOfTheDay && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1.5 flex items-center gap-1.5">
                              <UtensilsCrossed className="w-3 h-3" /> Dish of the Day
                            </p>
                            <p className="text-xs sm:text-sm font-semibold text-white">{hotel.dailyBoard.dishOfTheDay}</p>
                          </div>
                        )}
                        {hotel.dailyBoard.notes && (
                          <div className="md:col-span-2 mt-2 pt-3 border-t border-emerald-800/60">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1">Important Notes</p>
                            <p className="text-xs text-emerald-50 leading-relaxed whitespace-pre-wrap">{hotel.dailyBoard.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Guest WiFi */}
                  {hotel.infrastructure?.shareWifiVoucher && hotel.adminWifiVoucherEnabled !== false && hotel.infrastructure.wifiSSID && (
                    <div>
                      <h3 className="font-serif font-bold text-lg text-stone-900 mb-3 flex items-center gap-2">
                        <Wifi className="w-5 h-5 text-indigo-600" /> Guest WiFi Access
                      </h3>
                      
                      {!showWifi ? (
                        <button 
                          type="button"
                          onClick={() => setShowWifi(true)}
                          className="w-full py-3.5 border-2 border-indigo-100 bg-indigo-50/70 hover:bg-indigo-100/70 rounded-2xl flex items-center justify-center gap-2 text-indigo-700 font-semibold transition text-sm cursor-pointer"
                        >
                          <Eye className="w-4 h-4" /> Reveal WiFi Password &amp; QR
                        </button>
                      ) : (
                        <div className="bg-white border border-indigo-100 rounded-2xl p-5 shadow-xs relative overflow-hidden">
                          <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start relative z-10">
                            <div className="shrink-0 bg-white p-2.5 rounded-xl border border-stone-200 shadow-2xs">
                              <QRCode 
                                value={`WIFI:S:${hotel.infrastructure.wifiSSID};T:WPA;P:${hotel.infrastructure.wifiPassword || ''};;`} 
                                size={110} 
                                level="M"
                              />
                            </div>
                            
                            <div className="flex-1 w-full text-center sm:text-left space-y-3">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-0.5">Network (SSID)</p>
                                <p className="font-bold text-base text-stone-900">{hotel.infrastructure.wifiSSID}</p>
                              </div>
                              
                              {hotel.infrastructure.wifiPassword && (
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-0.5">Password</p>
                                  <div className="flex items-center justify-center sm:justify-start gap-2">
                                    <code className="font-mono bg-stone-100 px-3 py-1.5 rounded-lg text-stone-900 font-bold tracking-wide text-sm">
                                      {hotel.infrastructure.wifiPassword}
                                    </code>
                                    <button 
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(hotel.infrastructure.wifiPassword || '');
                                        setCopiedWifi(true);
                                        toast.success('WiFi password copied!');
                                        setTimeout(() => setCopiedWifi(false), 2000);
                                      }}
                                      className="p-1.5 text-stone-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                      title="Copy Password"
                                    >
                                      {copiedWifi ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                  </div>
                                </div>
                              )}
                              
                              <p className="text-xs text-stone-500 flex items-center justify-center sm:justify-start gap-1">
                                <QrCode className="w-3.5 h-3.5" /> Scan QR with phone camera to auto-connect
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Infrastructure */}
                  {hotel.infrastructure && (
                    <div>
                      <h3 className="font-serif font-bold text-lg text-stone-900 mb-3 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-600" /> Verified Property Infrastructure
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {hotel.infrastructure.powerSource && hotel.infrastructure.powerSource !== 'None' && (
                          <div className="flex items-center gap-3 bg-stone-50 p-3 rounded-xl border border-stone-100">
                            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                              <Zap className="w-4 h-4 text-amber-600" />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Power</p>
                              <p className="text-xs font-semibold text-stone-900">{hotel.infrastructure.powerSource}</p>
                            </div>
                          </div>
                        )}
                        {hotel.infrastructure.waterSource && (
                          <div className="flex items-center gap-3 bg-stone-50 p-3 rounded-xl border border-stone-100">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                              <Droplets className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Water</p>
                              <p className="text-xs font-semibold text-stone-900">{hotel.infrastructure.waterSource}</p>
                            </div>
                          </div>
                        )}
                        {hotel.infrastructure.internetSource && hotel.infrastructure.internetSource !== 'None' && (
                          <div className="flex items-center gap-3 bg-stone-50 p-3 rounded-xl border border-stone-100">
                            <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center shrink-0">
                              <Wifi className="w-4 h-4 text-sky-600" />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Internet</p>
                              <p className="text-xs font-semibold text-stone-900">{hotel.infrastructure.internetSource}</p>
                            </div>
                          </div>
                        )}
                        {hotel.infrastructure.workspaceSetup && hotel.infrastructure.workspaceSetup !== 'None' && (
                          <div className="flex items-center gap-3 bg-stone-50 p-3 rounded-xl border border-stone-100">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                              <Monitor className="w-4 h-4 text-indigo-600" />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">WFH</p>
                              <p className="text-xs font-semibold text-stone-900">{hotel.infrastructure.workspaceSetup}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* On-site Team & Contact */}
                  {(hotel.crew && hotel.crew.length > 0) || hotel.contactPhone ? (
                    <div>
                      <h3 className="font-serif font-bold text-lg text-stone-900 mb-3 flex items-center gap-2">
                        <Users className="w-5 h-5 text-emerald-600" /> Host &amp; On-site Team
                      </h3>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {hotel.contactPhone && (
                          <div className="border border-stone-200 rounded-xl p-3.5 flex items-center justify-between bg-white">
                            <div>
                              <p className="font-bold text-stone-900 text-sm">{hotel.name} Desk</p>
                              <p className="text-xs text-stone-500">General Enquiries</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <a
                                href={`tel:${hotel.contactPhone}`}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg hover:bg-emerald-100 transition"
                              >
                                <Phone className="w-3.5 h-3.5" /> Call
                              </a>
                            </div>
                          </div>
                        )}

                        {hotel.crew?.map((member, mIdx) => (
                          <div key={`${member.id || 'crew'}-${mIdx}`} className="border border-stone-200 rounded-xl p-3.5 flex items-center justify-between bg-white">
                            <div>
                              <p className="font-bold text-stone-900 text-sm">{member.name}</p>
                              <p className="text-xs text-stone-500">{member.role}</p>
                            </div>
                            {member.phone && (
                              <a 
                                href={`tel:${member.phone}`} 
                                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg hover:bg-emerald-100 transition"
                              >
                                <Phone className="w-3.5 h-3.5" /> Call
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                </div>
              )} {/* End Locked Features Wrapper */}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
