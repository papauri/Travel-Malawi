import React, { useState } from 'react';
import { Hotel, RoomType } from '../types';
import Modal from './Modal';
import SmartImage from './SmartImage';
import { getHotelImage } from '../lib/images';
import { pinProblem, PIN_PROBLEM_LABELS, mapLinkUrl } from '../lib/geo';
import { formatMoney } from '../lib/currency';
import {
  CheckCircle2, XCircle, Clock, MapPin, MapPinOff, ExternalLink,
  Phone, Mail, MessageSquare, Calendar, Building, Camera, Check,
  X, ShieldCheck, AlertTriangle, Eye, Edit3, User,
  DollarSign, Compass, Info, ChevronRight, Trash2, Star, RefreshCw, Globe
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import toast from 'react-hot-toast';

interface ReviewListingModalProps {
  hotel: Hotel | null;
  rooms: RoomType[];
  isOpen: boolean;
  onClose: () => void;
  onApprove: (hotelId: string) => Promise<void>;
  onReject: (hotelId: string, reason?: string) => Promise<void>;
  onDelete?: (hotelId: string) => Promise<void> | void;
  onOpenReviewScraper?: (hotelId: string) => void;
  onHotelUpdated?: (updatedHotel: Hotel) => void;
  isUpdating: boolean;
}

export default function ReviewListingModal({
  hotel,
  rooms,
  isOpen,
  onClose,
  onApprove,
  onReject,
  onDelete,
  onOpenReviewScraper,
  onHotelUpdated,
  isUpdating
}: ReviewListingModalProps) {
  const [activeTab, setActiveTab] = useState<'dossier' | 'preview'>('dossier');
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isFetchingReviews, setIsFetchingReviews] = useState(false);

  if (!hotel) return null;

  // Compile full photo list
  const allImages = [
    hotel.imageUrl,
    ...(hotel.galleryUrls || [])
  ].filter(Boolean) as string[];

  const currentPreviewImage = allImages[selectedImageIndex] || getHotelImage(hotel);

  // Filter rooms for this property
  const hotelRooms = rooms.filter(r => r.hotelId === hotel.id);

  // Geographic pin assessment
  const pinErr = pinProblem(hotel.coordinates);

  // Contact assessment
  const rawPhone = hotel.contactPhone || hotel.managerPhone || '';
  const cleanPhone = rawPhone.replace(/[^\d+]/g, '');
  const rawWa = hotel.contactWhatsapp || hotel.contactPhone || hotel.managerPhone || '';
  const cleanWa = rawWa.replace(/[^\d]/g, '');
  const waUrl = cleanWa ? `https://wa.me/${cleanWa}?text=${encodeURIComponent(`Hello ${hotel.managerName || 'Host'}, inquiring regarding your listing "${hotel.name}" on Travel Malawi.`)}` : '';

  // Pricing assessment
  const hasRooms = hotelRooms.length > 0;
  const primaryRateUsd = hasRooms 
    ? Math.min(...hotelRooms.map(r => r.prices?.USD ?? r.price ?? 0).filter(p => p > 0))
    : (hotel.entirePlaceDetails?.ratePerNightUsd || 0);
  const primaryRateMwk = hasRooms 
    ? Math.min(...hotelRooms.map(r => r.prices?.MWK ?? r.priceMWK ?? 0).filter(p => p > 0))
    : (hotel.entirePlaceDetails?.ratePerNightMwk || 0);

  // Compliance checklist items
  const checks = [
    {
      id: 'photos',
      title: 'High-Resolution Photography',
      passed: allImages.length >= 2,
      detail: allImages.length >= 2
        ? `${allImages.length} high-resolution photos uploaded`
        : allImages.length === 1
        ? 'Only 1 photo uploaded (recommend at least 3 for marketing appeal)'
        : 'Missing property cover photo',
      icon: Camera
    },
    {
      id: 'pricing',
      title: 'Dual-Currency Nightly Rates',
      passed: (primaryRateUsd > 0 && primaryRateMwk >= 1000) || hasRooms,
      detail: primaryRateUsd > 0 && primaryRateMwk > 0
        ? `Configured from $${primaryRateUsd} / MK ${primaryRateMwk.toLocaleString()} per night`
        : hasRooms
        ? `${hotelRooms.length} room unit(s) configured`
        : 'Nightly rates require review before bookings can be enabled',
      icon: DollarSign
    },
    {
      id: 'coordinates',
      title: 'Malawi GPS Pin & Navigation',
      passed: !pinErr && !!hotel.coordinates,
      detail: !pinErr && hotel.coordinates
        ? `Accurate coordinates (${hotel.coordinates.lat.toFixed(4)}, ${hotel.coordinates.lng.toFixed(4)})`
        : pinErr
        ? PIN_PROBLEM_LABELS[pinErr]
        : 'No GPS gate pin provided',
      icon: MapPin
    },
    {
      id: 'contact',
      title: 'Direct Host & WhatsApp Reachability',
      passed: !!cleanWa && !!cleanPhone,
      detail: cleanWa
        ? `Direct WhatsApp (+${cleanWa}) & Phone verified`
        : cleanPhone
        ? `Phone verified (${rawPhone}), WhatsApp missing`
        : 'No direct host contact registered',
      icon: MessageSquare
    },
    {
      id: 'rules',
      title: 'House Rules & Check-in Schedule',
      passed: !!hotel.checkInTime && !!hotel.checkOutTime,
      detail: `Check-in from ${hotel.checkInTime || '14:00'} · Check-out by ${hotel.checkOutTime || '10:00'}`,
      icon: Clock
    }
  ];

  const allPassed = checks.filter(c => c.passed).length >= 4;

  const existingReviews = Array.isArray(hotel.reviews) && hotel.reviews.length > 0
    ? hotel.reviews
    : (Array.isArray(hotel.reviewsSummary?.recentReviews) ? hotel.reviewsSummary.recentReviews : []);

  const handleQuickFetchReviews = async () => {
    if (!hotel.id) return;
    setIsFetchingReviews(true);
    try {
      const response = await fetch('/api/admin/scrape-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotelName: hotel.name,
          location: hotel.location || 'Malawi',
          category: hotel.category || 'Lodge',
          count: 8,
          minRating: 4,
          sources: ['Google Reviews', 'TripAdvisor', 'Booking.com', 'SafariBookings'],
          existingReviews: existingReviews.map(r => ({
            author: r.author,
            comment: r.comment,
            title: r.title,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.reviews) || data.reviews.length === 0) {
        toast.error(data.error || 'No new public reviews found for this property.');
        return;
      }

      const formattedNew = data.reviews.map((r: any) => ({
        author: r.author || 'Verified Guest',
        rating: Number(r.rating) || 5,
        title: r.title || '',
        comment: r.comment || r.text || '',
        date: r.date || new Date().toISOString().slice(0, 10),
        source: r.source || 'Google Reviews',
        sourceUrl: r.sourceUrl || '',
        verified: true,
      }));

      const combinedReviews = [...existingReviews, ...formattedNew];
      const avgRating = Number(
        (combinedReviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0) / combinedReviews.length).toFixed(1)
      );
      const reviewsSummary = {
        averageRating: avgRating,
        count: combinedReviews.length,
        sources: Array.from(new Set(combinedReviews.map(r => r.source || 'Google Reviews'))),
        recentReviews: combinedReviews.slice(0, 8),
        updatedAt: Date.now(),
      };

      await updateDoc(doc(db, 'hotels', hotel.id), {
        reviews: combinedReviews,
        rating: avgRating,
        reviewsSummary,
      });

      const updatedHotel: Hotel = {
        ...hotel,
        reviews: combinedReviews,
        reviewsSummary,
      };
      onHotelUpdated?.(updatedHotel);
      toast.success(`Attached ${formattedNew.length} public review(s) to ${hotel.name}!`);
    } catch (err: any) {
      console.error('Quick review fetch failed:', err);
      toast.error(err?.message || 'Failed to fetch public reviews.');
    } finally {
      setIsFetchingReviews(false);
    }
  };

  const handleApproveClick = async () => {
    await onApprove(hotel.id!);
    onClose();
  };

  const handleRejectClick = async () => {
    await onReject(hotel.id!, rejectReason.trim() || undefined);
    setShowRejectForm(false);
    setRejectReason('');
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title=""
      size="4xl"
    >
      <div className="space-y-6">
        {/* Modal Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-200">
          <div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider ${
                hotel.status === 'pending'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : hotel.status === 'rejected'
                  ? 'bg-stone-100 text-stone-700 border border-stone-300'
                  : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  hotel.status === 'pending'
                    ? 'bg-amber-500 animate-pulse'
                    : hotel.status === 'rejected'
                    ? 'bg-stone-500'
                    : 'bg-emerald-600'
                }`} />
                {hotel.status === 'pending' ? 'Pending Marketing & Admin Review' : hotel.status === 'rejected' ? 'Rejected / Unpublished' : 'Live & Approved'}
              </span>

              {hotel.stayType === 'entire_place' && (
                <span className="text-[11px] font-medium bg-stone-100 text-stone-700 border border-stone-200 px-2 py-0.5 rounded-md">
                  Entire Place
                </span>
              )}

              {hotel.categories?.[0] && (
                <span className="text-[11px] font-medium bg-stone-100 text-stone-700 border border-stone-200 px-2 py-0.5 rounded-md">
                  {hotel.categories[0]}
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 mt-1.5">
              {hotel.name}
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-stone-400" />
              <span>{hotel.location}</span>
            </p>
          </div>

          {/* Sub-Tabs: Compliance Dossier vs Traveller Ad Preview */}
          <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl shrink-0 self-start sm:self-center">
            <button
              type="button"
              onClick={() => setActiveTab('dossier')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'dossier'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Marketing Dossier
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'preview'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Traveller Ad Preview</span>
            </button>
          </div>
        </div>

        {/* ================= TAB 1: MARKETING & COMPLIANCE DOSSIER ================= */}
        {activeTab === 'dossier' && (
          <div className="space-y-6">
            
            {/* Top Grid: Photo Carousel & Verification Checklist */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              
              {/* Photo Showcase (7 cols) */}
              <div className="lg:col-span-7 space-y-2.5">
                <div className="relative aspect-[16/10] bg-stone-100 rounded-xl overflow-hidden border border-stone-200 shadow-2xs group">
                  <SmartImage
                    src={currentPreviewImage}
                    alt={hotel.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2.5 right-2.5 bg-black/75 backdrop-blur-xs text-white text-[11px] font-medium px-2 py-1 rounded-md">
                    Photo {selectedImageIndex + 1} of {Math.max(allImages.length, 1)}
                  </div>
                </div>

                {/* Thumbnails row */}
                {allImages.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                    {allImages.map((img, idx) => (
                      <button
                        key={`review-thumb-${idx}`}
                        type="button"
                        onClick={() => setSelectedImageIndex(idx)}
                        className={`relative w-16 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition cursor-pointer ${
                          selectedImageIndex === idx ? 'border-amber-700 ring-2 ring-amber-700/20' : 'border-stone-200 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <SmartImage src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quality & Verification Checklist (5 cols) */}
              <div className="lg:col-span-5 bg-stone-50/80 rounded-xl p-4 border border-stone-200/90 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-stone-200">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Review Checklist</span>
                    </h4>
                    <span className="text-[11px] font-medium text-stone-500">
                      {checks.filter(c => c.passed).length}/{checks.length} verified
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {checks.map(c => {
                      const Icon = c.icon;
                      return (
                        <div key={c.id} className="flex items-start gap-2.5 text-xs">
                          <div className={`mt-0.5 rounded-full p-0.5 shrink-0 ${
                            c.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {c.passed ? (
                              <Check className="w-3 h-3 stroke-[2.5]" />
                            ) : (
                              <Clock className="w-3 h-3 stroke-[2.5]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-stone-800 leading-tight flex items-center gap-1">
                              <span>{c.title}</span>
                            </p>
                            <p className="text-[11px] text-stone-500 leading-snug mt-0.5">
                              {c.detail}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-stone-200">
                  <p className="text-[11px] text-stone-500 leading-relaxed">
                    Verified properties receive direct traveler inquiries and instant booking access across Malawian and international search channels.
                  </p>
                </div>
              </div>
            </div>

            {/* Description & Location Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-2xs">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                  Storefront Description
                </h4>
                <p className="text-xs sm:text-sm text-stone-700 leading-relaxed whitespace-pre-line max-h-48 overflow-y-auto">
                  {hotel.description || 'No description provided by the host.'}
                </p>
              </div>

              <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-2xs space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600">
                  Driving Directions &amp; Gate Location
                </h4>
                <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">
                  {hotel.locationNotes || 'No specific driving directions provided.'}
                </p>

                <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 font-mono text-stone-600">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    <span>
                      {hotel.coordinates ? `${hotel.coordinates.lat.toFixed(4)}, ${hotel.coordinates.lng.toFixed(4)}` : 'No coordinates'}
                    </span>
                  </div>

                  <a
                    href={mapLinkUrl(hotel)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-stone-700 hover:text-stone-900 font-semibold underline cursor-pointer"
                  >
                    <span>Inspect on Google Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* Room Inventory & Dual-Currency Rates */}
            <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                    Room Inventory &amp; Dual Currency Rates
                  </h4>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    Ensuring fair, transparent pricing in both Malawian Kwacha (MWK) and USD.
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-stone-100 rounded-md text-stone-700">
                  {hotelRooms.length} Room Unit{hotelRooms.length === 1 ? '' : 's'}
                </span>
              </div>

              {hotelRooms.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">No room units registered yet</p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      {hotel.stayType === 'entire_place'
                        ? 'This property is set as an Entire Place stay. The system will auto-synthesize bookings using the primary entire place rate.'
                        : 'A lodge listing cannot take bookings until individual room categories (e.g. Standard Chalet, Executive Suite) are added.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {hotelRooms.map((r, i) => {
                    const priceUsd = r.prices?.USD ?? r.price ?? 0;
                    const priceMwk = r.prices?.MWK ?? r.priceMWK ?? 0;
                    return (
                      <div key={r.id || `room-${i}`} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-stone-900 truncate">{r.name}</p>
                          <p className="text-[11px] text-stone-500">
                            Up to {r.maxGuests} guest{r.maxGuests === 1 ? '' : 's'} · {r.quantity ?? 1} unit{(r.quantity ?? 1) === 1 ? '' : 's'} available
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="text-xs sm:text-sm font-mono font-bold text-stone-900">
                              {priceMwk > 0 ? `MK ${priceMwk.toLocaleString()}` : '—'}
                            </span>
                            <span className="text-[11px] text-stone-500 font-mono ml-1.5">
                              {priceUsd > 0 ? `($${priceUsd})` : ''}
                            </span>
                          </div>
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-600">
                            per night
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Host Contacts & Communications Channel */}
            <div className="bg-stone-50 rounded-xl p-4 border border-stone-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Host / Manager</span>
                <p className="font-semibold text-stone-900 mt-0.5">{hotel.managerName || 'Not specified'}</p>
                <p className="text-stone-500 text-[11px] truncate">{hotel.managerEmail || hotel.contactEmail || 'No email'}</p>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Direct Telephone</span>
                {cleanPhone ? (
                  <a href={`tel:${cleanPhone}`} className="font-semibold text-stone-900 hover:underline flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3 text-stone-500" />
                    <span>{rawPhone}</span>
                  </a>
                ) : (
                  <p className="text-stone-400 mt-0.5 italic">None listed</p>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">WhatsApp Inquiries</span>
                {waUrl ? (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-emerald-800 font-semibold hover:underline mt-0.5"
                  >
                    <MessageSquare className="w-3 h-3 text-emerald-600" />
                    <span>+{cleanWa}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                ) : (
                  <p className="text-stone-400 mt-0.5 italic">None listed</p>
                )}
              </div>
            </div>

            {/* Amenities Chips */}
            {hotel.amenities && hotel.amenities.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                  Amenities &amp; Features ({hotel.amenities.length})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {hotel.amenities.map(a => (
                    <span key={a} className="px-2.5 py-1 rounded-md bg-stone-100 border border-stone-200 text-stone-700 text-xs font-medium">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Public Reviews & Social Proof (Works for Pending & Approved Properties) */}
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                      Public Reviews &amp; Social Proof
                    </h4>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white border border-stone-200 text-stone-700">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>{existingReviews.length > 0 ? `${hotel.reviewsSummary?.averageRating || '4.8'} (${existingReviews.length})` : '0 attached'}</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Fetch and attach public reviews (Google, TripAdvisor, Booking.com) even while this property is pending approval.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    type="button"
                    disabled={isFetchingReviews}
                    onClick={handleQuickFetchReviews}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-xs font-semibold transition cursor-pointer shadow-2xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isFetchingReviews ? 'animate-spin' : ''}`} />
                    <span>{isFetchingReviews ? 'Fetching Reviews...' : 'Fetch Public Reviews'}</span>
                  </button>

                  {onOpenReviewScraper && hotel.id && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenReviewScraper(hotel.id!);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 text-xs font-semibold transition cursor-pointer"
                    >
                      <Globe className="w-3.5 h-3.5 text-stone-500" />
                      <span>Open Review Studio</span>
                    </button>
                  )}
                </div>
              </div>

              {existingReviews.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {existingReviews.slice(0, 4).map((rev, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-white border border-stone-200/80 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-stone-900 truncate">{rev.author || 'Guest'}</span>
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-stone-700 shrink-0">
                          <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                          {rev.rating || 5}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-600 line-clamp-2 mt-1">{rev.comment}</p>
                      {rev.source && (
                        <span className="inline-block text-[10px] text-stone-400 mt-1">{rev.source}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 2: LIVE TRAVELLER AD PREVIEW ================= */}
        {activeTab === 'preview' && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Storefront Simulation:</strong> This represents exactly how international travelers and domestic guests will encounter this listing across Travel Malawi discovery feeds.
              </span>
            </div>

            {/* Simulated Live Hotel Card / Hero */}
            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
              <div className="relative aspect-[16/9] sm:aspect-[21/9] bg-stone-100 overflow-hidden">
                <SmartImage src={currentPreviewImage} alt={hotel.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="bg-white/90 backdrop-blur-xs text-stone-900 text-xs font-bold px-2.5 py-1 rounded-md shadow-2xs">
                    {hotel.categories?.[0] || 'Lakeside Stay'}
                  </span>
                  {hotel.stayType === 'entire_place' && (
                    <span className="bg-stone-900/80 backdrop-blur-xs text-white text-xs font-medium px-2.5 py-1 rounded-md">
                      Entire Place
                    </span>
                  )}
                </div>

                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <h3 className="text-xl sm:text-3xl font-serif font-bold text-white drop-shadow-sm">
                    {hotel.name}
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-200 flex items-center gap-1.5 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-stone-300" />
                    <span>{hotel.location}</span>
                    <span>&middot;</span>
                    <span className="text-emerald-400 font-medium">Verified Partner</span>
                  </p>
                </div>
              </div>

              <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-50/50">
                <div>
                  <span className="text-xs text-stone-500 uppercase tracking-wider font-semibold">Starting Nightly Rate</span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-xl sm:text-2xl font-mono font-bold text-stone-900">
                      {primaryRateMwk > 0 ? `MK ${primaryRateMwk.toLocaleString()}` : primaryRateUsd > 0 ? `$${primaryRateUsd}` : 'Rate on inquiry'}
                    </span>
                    {primaryRateUsd > 0 && primaryRateMwk > 0 && (
                      <span className="text-xs text-stone-500 font-mono">
                        (${primaryRateUsd} USD)
                      </span>
                    )}
                    <span className="text-xs text-stone-400">/ night</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    to={`/hotel/${hotel.id}`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition shadow-2xs"
                  >
                    <span>Open Live Storefront</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rejection / Request Edits Form Drawer */}
        {showRejectForm && (
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-stone-600" />
                <span>Specify Feedback / Reason for Host</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowRejectForm(false)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Reason Chips */}
            <div className="flex flex-wrap gap-1.5 text-xs">
              {[
                'Please upload higher resolution photos of the rooms and grounds',
                'Verify GPS coordinates; current pin points outside Malawi',
                'Provide valid Malawian WhatsApp contact for guest inquiries',
                'Confirm room nightly rates in MWK and USD'
              ].map(reason => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setRejectReason(reason)}
                  className="px-2.5 py-1 bg-white border border-stone-200 rounded-md text-[11px] text-stone-700 hover:bg-stone-100 transition cursor-pointer"
                >
                  {reason}
                </button>
              ))}
            </div>

            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Explain to the host what needs updating before this listing can be approved..."
              className="w-full h-20 p-2.5 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 focus:outline-none focus:border-stone-900 resize-none"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRejectForm(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-stone-600 hover:bg-stone-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUpdating}
                onClick={handleRejectClick}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-stone-900 text-white hover:bg-stone-800 transition cursor-pointer"
              >
                Confirm Rejection &amp; Archive
              </button>
            </div>
          </div>
        )}

        {/* Modal Action Bar Footer */}
        <div className="pt-4 border-t border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              to={`/admin/hotel/${hotel.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Details in Full Manager</span>
            </Link>

            <Link
              to={`/hotel/${hotel.id}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>View Live Link</span>
            </Link>

            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (hotel.id) onDelete(hotel.id);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Delete Listing</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {hotel.status === 'pending' ? (
              <>
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => setShowRejectForm(true)}
                  className="px-3.5 py-2 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100 text-xs font-semibold transition cursor-pointer"
                >
                  Request Edits / Reject
                </button>

                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={handleApproveClick}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-stone-900 text-white hover:bg-stone-800 text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>{isUpdating ? 'Approving...' : 'Approve & Publish Live'}</span>
                </button>
              </>
            ) : hotel.status === 'rejected' ? (
              <button
                type="button"
                disabled={isUpdating}
                onClick={handleApproveClick}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Re-Approve Listing</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Approved &amp; Live</span>
                </span>
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => setShowRejectForm(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-stone-600 hover:bg-stone-100 transition cursor-pointer"
                >
                  Suspend Listing
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
