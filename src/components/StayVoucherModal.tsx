import React, { useState } from 'react';
import QRCode from 'react-qr-code';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, MapPin, X, Users, Phone, Zap, Droplets, Map, Wifi, Monitor, CheckCircle2, ClipboardList, UtensilsCrossed, Copy, Eye, QrCode, Lock, Unlock } from 'lucide-react';
import { Booking, Hotel, RoomType } from '../types';
import { formatMoney } from '../lib/booking';
import { formatDateStr } from '../lib/dates';
import SmartImage from './SmartImage';

type EnrichedBooking = Booking & { hotel?: Hotel; room?: RoomType };

interface Props {
  booking: EnrichedBooking | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function StayVoucherModal({ booking, isOpen, onClose }: Props) {
  const [showWifi, setShowWifi] = useState(false);
  const [copied, setCopied] = useState(false);
  
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
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  if (!booking || !booking.hotel) return null;
  const hotel = booking.hotel;
  const isLocked = booking.arrivalPin && !isUnlocked;


  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-stone-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-full relative"
          >
            {/* Header / Ticket Top */}
            <div className="bg-stone-900 text-white p-6 relative shrink-0">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 text-stone-400 hover:text-white hover:bg-stone-800 rounded-full transition z-10"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                <span className="font-serif font-bold tracking-wide">Stay OS Digital Voucher</span>
              </div>
              
              <h2 className="text-3xl font-serif font-bold text-white mb-2 pr-12 leading-tight">
                {hotel.name}
              </h2>
              <div className="flex items-center gap-1.5 text-stone-400 text-sm">
                <MapPin className="w-4 h-4" /> {hotel.location}
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto p-6 space-y-8 flex-1">
              
              {/* Payment Status & Details */}
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-emerald-900 text-lg mb-1">Confirmed — Payment on Arrival</h4>
                  <p className="text-emerald-700 text-sm leading-relaxed">
                    Show this digital voucher when you arrive. You will settle the total of <span className="font-bold">{formatMoney(booking.total ?? 0, booking.currency)}</span> directly with the property.
                  </p>
                  {booking.reference && (
                    <p className="mt-3 text-xs font-mono font-bold text-emerald-800 bg-emerald-100 px-3 py-1.5 rounded-lg inline-block">
                      REF: {booking.reference}
                    </p>
                  )}
                </div>
              </div>

              {/* Stay Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-stone-50 rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Check-in</p>
                  <p className="font-bold text-stone-900">{formatDateStr(booking.checkIn)}</p>
                </div>
                <div className="bg-stone-50 rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Check-out</p>
                  <p className="font-bold text-stone-900">{formatDateStr(booking.checkOut)}</p>
                </div>
                <div className="bg-stone-50 rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Guests</p>
                  <p className="font-bold text-stone-900">{booking.guests} {booking.guests === 1 ? 'Guest' : 'Guests'}</p>
                </div>
                <div className="bg-stone-50 rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Room</p>
                  <p className="font-bold text-stone-900 truncate" title={booking.room?.name || 'Room'}>{booking.room?.name || 'Room'}</p>
                </div>
              </div>


              {/* Arrival PIN Lock Screen */}
              {isLocked && (
                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6 md:p-8 text-center relative overflow-hidden shrink-0 mt-4 mx-6">
                  <div className="absolute top-0 left-0 w-full h-1 bg-amber-400" />
                  <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-stone-200 flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-8 h-8 text-amber-500" />
                  </div>
                  <h3 className="font-serif font-bold text-2xl text-stone-900 mb-2">Premium Features Locked</h3>
                  <p className="text-stone-500 max-w-md mx-auto mb-6">
                    Enter the 4-digit Arrival PIN provided by your host to unlock the WiFi password, daily board, and on-property perks.
                  </p>
                  
                  <form onSubmit={handleUnlock} className="flex flex-col items-center gap-4">
                    <input
                      type="text"
                      maxLength={4}
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="• • • •"
                      className={`text-center text-3xl tracking-[1em] indent-[1em] font-mono w-48 py-3 bg-white border-2 rounded-xl outline-none transition-colors ${pinError ? 'border-red-500 text-red-500' : 'border-stone-200 focus:border-amber-500'}`}
                    />
                    {pinError && <p className="text-red-500 text-xs font-bold uppercase tracking-wider">Incorrect PIN</p>}
                    <button 
                      type="submit"
                      disabled={pinInput.length !== 4}
                      className="flex items-center gap-2 px-8 py-3 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition disabled:opacity-50"
                    >
                      <Unlock className="w-4 h-4" /> Unlock Voucher
                    </button>
                  </form>
                </div>
              )}

              {/* Locked Features Wrapper */}
              {!isLocked && (
                <div className="space-y-6">

              {/* Daily Board */}
              {hotel.dailyBoard && (hotel.dailyBoard.activities || hotel.dailyBoard.dishOfTheDay || hotel.dailyBoard.notes) && (
                <div className="bg-emerald-900 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                    <ClipboardList className="w-32 h-32" />
                  </div>
                  <h3 className="font-serif font-bold text-xl mb-4 flex items-center gap-2 relative z-10">
                    <ClipboardList className="w-5 h-5 text-emerald-400" /> Host's Daily Board
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                    {hotel.dailyBoard.activities && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-2">Today's Activities</p>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{hotel.dailyBoard.activities}</p>
                      </div>
                    )}
                    {hotel.dailyBoard.dishOfTheDay && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1.5">
                          <UtensilsCrossed className="w-3 h-3" /> Dish of the Day
                        </p>
                        <p className="text-sm font-semibold">{hotel.dailyBoard.dishOfTheDay}</p>
                      </div>
                    )}
                    {hotel.dailyBoard.notes && (
                      <div className="md:col-span-2 mt-2 pt-4 border-t border-emerald-800/50">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-2">Important Notes</p>
                        <p className="text-sm text-emerald-50 leading-relaxed whitespace-pre-wrap">{hotel.dailyBoard.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Guest WiFi */}
              {hotel.infrastructure?.shareWifiVoucher && hotel.adminWifiVoucherEnabled !== false && hotel.infrastructure.wifiSSID && (
                <div>
                  <h3 className="font-serif font-bold text-xl text-stone-900 mb-4 flex items-center gap-2">
                    <Wifi className="w-5 h-5 text-indigo-600" /> Guest WiFi Access
                  </h3>
                  
                  {!showWifi ? (
                    <button 
                      onClick={() => setShowWifi(true)}
                      className="w-full py-4 border-2 border-indigo-100 bg-indigo-50 hover:bg-indigo-100 rounded-2xl flex items-center justify-center gap-2 text-indigo-700 font-semibold transition"
                    >
                      <Eye className="w-5 h-5" /> Reveal WiFi Password
                    </button>
                  ) : (
                    <div className="bg-white border border-indigo-100 rounded-2xl p-6 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                        <Wifi className="w-48 h-48 text-indigo-900" />
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start relative z-10">
                        <div className="shrink-0 bg-white p-3 rounded-2xl border border-stone-200 shadow-sm">
                          <QRCode 
                            value={`WIFI:S:${hotel.infrastructure.wifiSSID};T:WPA;P:${hotel.infrastructure.wifiPassword || ''};;`} 
                            size={120} 
                            level="M"
                          />
                        </div>
                        
                        <div className="flex-1 w-full text-center sm:text-left space-y-4">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Network (SSID)</p>
                            <p className="font-bold text-lg text-stone-900">{hotel.infrastructure.wifiSSID}</p>
                          </div>
                          
                          {hotel.infrastructure.wifiPassword && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Password</p>
                              <div className="flex items-center justify-center sm:justify-start gap-2">
                                <code className="font-mono bg-stone-100 px-3 py-1.5 rounded-lg text-stone-900 font-bold tracking-wide">
                                  {hotel.infrastructure.wifiPassword}
                                </code>
                                <button 
                                  onClick={() => {
                                    navigator.clipboard.writeText(hotel.infrastructure.wifiPassword || '');
                                    setCopied(true);
                                    setTimeout(() => setCopied(false), 2000);
                                  }}
                                  className="p-1.5 text-stone-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                  title="Copy Password"
                                >
                                  {copied ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                                </button>
                              </div>
                            </div>
                          )}
                          
                          <p className="text-xs text-stone-500 flex items-center justify-center sm:justify-start gap-1">
                            <QrCode className="w-3.5 h-3.5" /> Scan QR with phone camera to connect
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
                  <h3 className="font-serif font-bold text-xl text-stone-900 mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" /> Property Setup
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {hotel.infrastructure.powerSource && hotel.infrastructure.powerSource !== 'None' && (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                          <Zap className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Power</p>
                          <p className="text-sm font-semibold text-stone-900">{hotel.infrastructure.powerSource}</p>
                        </div>
                      </div>
                    )}
                    {hotel.infrastructure.waterSource && (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                          <Droplets className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Water</p>
                          <p className="text-sm font-semibold text-stone-900">{hotel.infrastructure.waterSource}</p>
                        </div>
                      </div>
                    )}
                    {hotel.infrastructure.internetSource && hotel.infrastructure.internetSource !== 'None' && (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-sky-50 flex items-center justify-center shrink-0">
                          <Wifi className="w-5 h-5 text-sky-500" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Internet</p>
                          <p className="text-sm font-semibold text-stone-900">{hotel.infrastructure.internetSource}</p>
                        </div>
                      </div>
                    )}
                    {hotel.infrastructure.workspaceSetup && hotel.infrastructure.workspaceSetup !== 'None' && (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                          <Monitor className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">WFH</p>
                          <p className="text-sm font-semibold text-stone-900">{hotel.infrastructure.workspaceSetup}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Guest WiFi */}
              {hotel.infrastructure?.shareWifiVoucher && hotel.adminWifiVoucherEnabled !== false && hotel.infrastructure.wifiSSID && (
                <div>
                  <h3 className="font-serif font-bold text-xl text-stone-900 mb-4 flex items-center gap-2">
                    <Wifi className="w-5 h-5 text-indigo-600" /> Guest WiFi Access
                  </h3>
                  
                  {!showWifi ? (
                    <button 
                      onClick={() => setShowWifi(true)}
                      className="w-full py-4 border-2 border-indigo-100 bg-indigo-50 hover:bg-indigo-100 rounded-2xl flex items-center justify-center gap-2 text-indigo-700 font-semibold transition"
                    >
                      <Eye className="w-5 h-5" /> Reveal WiFi Password
                    </button>
                  ) : (
                    <div className="bg-white border border-indigo-100 rounded-2xl p-6 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                        <Wifi className="w-48 h-48 text-indigo-900" />
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start relative z-10">
                        <div className="shrink-0 bg-white p-3 rounded-2xl border border-stone-200 shadow-sm">
                          <QRCode 
                            value={`WIFI:S:${hotel.infrastructure.wifiSSID};T:WPA;P:${hotel.infrastructure.wifiPassword || ''};;`} 
                            size={120} 
                            level="M"
                          />
                        </div>
                        
                        <div className="flex-1 w-full text-center sm:text-left space-y-4">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Network (SSID)</p>
                            <p className="font-bold text-lg text-stone-900">{hotel.infrastructure.wifiSSID}</p>
                          </div>
                          
                          {hotel.infrastructure.wifiPassword && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Password</p>
                              <div className="flex items-center justify-center sm:justify-start gap-2">
                                <code className="font-mono bg-stone-100 px-3 py-1.5 rounded-lg text-stone-900 font-bold tracking-wide">
                                  {hotel.infrastructure.wifiPassword}
                                </code>
                                <button 
                                  onClick={() => {
                                    navigator.clipboard.writeText(hotel.infrastructure.wifiPassword || '');
                                    setCopied(true);
                                    setTimeout(() => setCopied(false), 2000);
                                  }}
                                  className="p-1.5 text-stone-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                  title="Copy Password"
                                >
                                  {copied ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                                </button>
                              </div>
                            </div>
                          )}
                          
                          <p className="text-xs text-stone-500 flex items-center justify-center sm:justify-start gap-1">
                            <QrCode className="w-3.5 h-3.5" /> Scan QR with phone camera to connect
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}


              {/* Crew */}
              {hotel.crew && hotel.crew.length > 0 && (
                <div>
                  <h3 className="font-serif font-bold text-xl text-stone-900 mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-600" /> On-site Team
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {hotel.crew.map((member) => (
                      <div key={member.id} className="border border-stone-200 rounded-2xl p-4 flex items-center gap-4 bg-white">
                        <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                          <Users className="w-6 h-6 text-stone-400" />
                        </div>
                        <div>
                          <p className="font-bold text-stone-900">{member.name}</p>
                          <p className="text-sm text-stone-500 mb-1">{member.role}</p>
                          <a href={`tel:${member.phone}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md hover:bg-emerald-100 transition">
                            <Phone className="w-3 h-3" /> Call
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Guest WiFi */}
              {hotel.infrastructure?.shareWifiVoucher && hotel.adminWifiVoucherEnabled !== false && hotel.infrastructure.wifiSSID && (
                <div>
                  <h3 className="font-serif font-bold text-xl text-stone-900 mb-4 flex items-center gap-2">
                    <Wifi className="w-5 h-5 text-indigo-600" /> Guest WiFi Access
                  </h3>
                  
                  {!showWifi ? (
                    <button 
                      onClick={() => setShowWifi(true)}
                      className="w-full py-4 border-2 border-indigo-100 bg-indigo-50 hover:bg-indigo-100 rounded-2xl flex items-center justify-center gap-2 text-indigo-700 font-semibold transition"
                    >
                      <Eye className="w-5 h-5" /> Reveal WiFi Password
                    </button>
                  ) : (
                    <div className="bg-white border border-indigo-100 rounded-2xl p-6 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                        <Wifi className="w-48 h-48 text-indigo-900" />
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start relative z-10">
                        <div className="shrink-0 bg-white p-3 rounded-2xl border border-stone-200 shadow-sm">
                          <QRCode 
                            value={`WIFI:S:${hotel.infrastructure.wifiSSID};T:WPA;P:${hotel.infrastructure.wifiPassword || ''};;`} 
                            size={120} 
                            level="M"
                          />
                        </div>
                        
                        <div className="flex-1 w-full text-center sm:text-left space-y-4">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Network (SSID)</p>
                            <p className="font-bold text-lg text-stone-900">{hotel.infrastructure.wifiSSID}</p>
                          </div>
                          
                          {hotel.infrastructure.wifiPassword && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Password</p>
                              <div className="flex items-center justify-center sm:justify-start gap-2">
                                <code className="font-mono bg-stone-100 px-3 py-1.5 rounded-lg text-stone-900 font-bold tracking-wide">
                                  {hotel.infrastructure.wifiPassword}
                                </code>
                                <button 
                                  onClick={() => {
                                    navigator.clipboard.writeText(hotel.infrastructure.wifiPassword || '');
                                    setCopied(true);
                                    setTimeout(() => setCopied(false), 2000);
                                  }}
                                  className="p-1.5 text-stone-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                  title="Copy Password"
                                >
                                  {copied ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                                </button>
                              </div>
                            </div>
                          )}
                          
                          <p className="text-xs text-stone-500 flex items-center justify-center sm:justify-start gap-1">
                            <QrCode className="w-3.5 h-3.5" /> Scan QR with phone camera to connect
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}


                </div>
              )} {/* End Locked Features Wrapper */}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
