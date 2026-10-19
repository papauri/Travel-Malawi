import React, { useState } from 'react';
import { Hotel, RoomType } from '../types';
import Modal from './Modal';
import SmartImage from './SmartImage';
import { getHotelImage } from '../lib/images';
import { pinProblem, PIN_PROBLEM_LABELS, mapLinkUrl } from '../lib/geo';
import { formatMoney } from '../lib/currency';
import {
  CheckCircle2, Clock, MapPin, MapPinOff, ExternalLink,
  Phone, Mail, MessageSquare, Calendar, Building, Camera, Check,
  X, AlertTriangle, Eye, Edit3, User,
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
  // Math.min() of an empty list is Infinity, which showed as "$Infinity" when
  // no room had a price yet.
  const lowestPositive = (values: number[]) => {
    const priced = values.filter(p => p > 0);
    return priced.length ? Math.min(...priced) : 0;
  };
  const primaryRateUsd = hasRooms
    ? lowestPositive(hotelRooms.map(r => r.prices?.USD ?? r.price ?? 0))
    : (hotel.entirePlaceDetails?.ratePerNightUsd || 0);
  const primaryRateMwk = hasRooms
    ? lowestPositive(hotelRooms.map(r => r.prices?.MWK ?? r.priceMWK ?? 0))
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
          category: hotel.categories?.[0] || hotel.category || 'Lodge',
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
            <div className="flex flex-wrap items-center gap-2">
              <span className={`tm-tag ${
                hotel.status === 'pending'
                  ? 'tm-tag-warn'
                  : hotel.status === 'rejected'
                  ? ''
                  : 'tm-tag-good'
              }`}>
                {hotel.status === 'pending' ? 'Waiting for review' : hotel.status === 'rejected' ? 'Rejected' : 'Live'}
              </span>

              {hotel.stayType === 'entire_place' && (
                <span className="tm-tag">
                  Entire place
                </span>
              )}

              {hotel.categories?.[0] && (
                <span className="tm-tag">
                  {hotel.categories[0]}
                </span>
              )}
            </div>

            <h2 className="tm-h2 mt-1.5 break-words">
              {hotel.name}
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-stone-400" />
              <span>{hotel.location}</span>
            </p>
          </div>

          {/* Sub-tabs: details vs traveller preview */}
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
              Details
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
              <span>Preview</span>
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
                <div className="relative aspect-[16/10] bg-stone-100 rounded-xl overflow-hidden border border-stone-200 group">
                  <SmartImage
                    src={currentPreviewImage}
                    alt={hotel.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2.5 right-2.5 bg-black/70 text-white text-[11px] font-medium px-2 py-1 rounded-md">
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
              <div className="lg:col-span-5 tm-panel min-w-0">
                <div>
                  <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-stone-200">
                    <h4 className="text-sm font-semibold text-stone-900">
                      <span>Checklist</span>
                    </h4>
                    <span className="text-[11px] font-medium text-stone-500">
                      {checks.filter(c => c.passed).length} of {checks.length} done
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {checks.map(c => {
                      const Icon = c.icon;
                      return (
                        <div key={c.id} className="flex items-start gap-2.5 text-xs">
                          <div className={`mt-0.5 rounded-full p-0.5 shrink-0 ${
                            c.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
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


              </div>
            </div>

            {/* Description & Location Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="tm-panel min-w-0">
                <h4 className="text-sm font-semibold text-stone-900 mb-2">
                  Description
                </h4>
                <p className="text-xs sm:text-sm text-stone-700 leading-relaxed whitespace-pre-line max-h-48 overflow-y-auto">
                  {hotel.description || 'No description provided by the host.'}
                </p>
              </div>

              <div className="tm-panel min-w-0 space-y-3">
                <h4 className="text-sm font-semibold text-stone-900">
                  Directions
                </h4>
                <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">
                  {hotel.locationNotes || 'No directions given.'}
                </p>

                <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 tabular-nums text-stone-600">
                    <MapPin className="w-3.5 h-3.5 text-stone-400" />
                    <span>
                      {hotel.coordinates ? `${hotel.coordinates.lat.toFixed(4)}, ${hotel.coordinates.lng.toFixed(4)}` : 'No coordinates'}
                    </span>
                  </div>

                  <a
                    href={mapLinkUrl(hotel)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="tm-link inline-flex items-center gap-1"
                  >
                    <span>Open in Google Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* Room Inventory & Dual-Currency Rates */}
            <div className="tm-panel space-y-3">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-stone-100">
                <h4 className="text-sm font-semibold text-stone-900">
                  Rooms and rates
                </h4>
                <span className="tm-tag">
                  {hotelRooms.length} room type{hotelRooms.length === 1 ? '' : 's'}
                </span>
              </div>

              {hotelRooms.length === 0 ? (
                <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">No rooms added yet</p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      {hotel.stayType === 'entire_place'
                        ? 'Entire-place stay: bookings use the entire-place rate.'
                        : 'Add at least one room type before this listing can take bookings.'}
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
                            <span className="text-xs sm:text-sm tabular-nums font-semibold text-stone-900">
                              {priceMwk > 0 ? `MK ${priceMwk.toLocaleString()}` : '—'}
                            </span>
                            <span className="text-[11px] text-stone-500 tabular-nums ml-1.5">
                              {priceUsd > 0 ? `($${priceUsd})` : ''}
                            </span>
                          </div>
                          <span className="text-[11px] text-stone-500">
                            per night
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Host contacts */}
            <div className="tm-panel grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="min-w-0">
                <span className="text-[11px] text-stone-500 block">Host</span>
                <p className="font-semibold text-stone-900 mt-0.5">{hotel.managerName || 'Not specified'}</p>
                <p className="text-stone-500 text-[11px] truncate">{hotel.managerEmail || hotel.contactEmail || 'No email'}</p>
              </div>

              <div>
                <span className="text-[11px] text-stone-500 block">Phone</span>
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
                <span className="text-[11px] text-stone-500 block">WhatsApp</span>
                {waUrl ? (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="tm-link inline-flex items-center gap-1 mt-0.5"
                  >
                    <MessageSquare className="w-3 h-3" />
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
                <h4 className="text-sm font-semibold text-stone-900 mb-2">
                  Amenities ({hotel.amenities.length})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {hotel.amenities.map(a => (
                    <span key={a} className="tm-tag">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Public reviews (works for pending and approved properties) */}
            <div className="tm-panel space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-stone-900">
                      Public reviews
                    </h4>
                    <span className="tm-tag">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>{existingReviews.length > 0 ? (hotel.reviewsSummary?.averageRating ? `${hotel.reviewsSummary.averageRating} (${existingReviews.length})` : `${existingReviews.length} attached`) : 'None yet'}</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Attach public reviews, even while the listing waits for approval.
                  </p>
                </div>

                <div className="tm-actions shrink-0">
                  <button
                    type="button"
                    disabled={isFetchingReviews}
                    onClick={handleQuickFetchReviews}
                    className="tm-btn tm-btn-secondary tm-btn-sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isFetchingReviews ? 'animate-spin' : ''}`} />
                    <span>{isFetchingReviews ? 'Fetching reviews…' : 'Fetch reviews'}</span>
                  </button>

                  {onOpenReviewScraper && hotel.id && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenReviewScraper(hotel.id!);
                      }}
                      className="tm-btn tm-btn-quiet tm-btn-sm"
                    >
                      <Globe className="w-3.5 h-3.5 text-stone-500" />
                      <span>Open review studio</span>
                    </button>
                  )}
                </div>
              </div>

              {existingReviews.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 pt-1">
                  {existingReviews.slice(0, 4).map((rev, idx) => (
                    <div key={idx} className="min-w-0 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-stone-900 truncate">{rev.author || 'Guest'}</span>
                        {rev.rating ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-stone-700 shrink-0">
                            <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                            {rev.rating}
                          </span>
                        ) : null}
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
            <p className="tm-muted">This is how travellers will see the listing.</p>

            {/* Simulated listing card */}
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <div className="relative aspect-[16/9] sm:aspect-[21/9] bg-stone-100 overflow-hidden">
                <SmartImage src={currentPreviewImage} alt={hotel.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/35" />
                
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  {hotel.categories?.[0] && (
                    <span className="bg-white/90 text-stone-900 text-xs font-semibold px-2.5 py-1 rounded-md">
                      {hotel.categories[0]}
                    </span>
                  )}
                  {hotel.stayType === 'entire_place' && (
                    <span className="bg-stone-900/80 text-white text-xs font-medium px-2.5 py-1 rounded-md">
                      Entire place
                    </span>
                  )}
                </div>

                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <h3 className="text-xl sm:text-3xl font-serif font-semibold text-white drop-shadow-sm break-words">
                    {hotel.name}
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-200 flex items-center gap-1.5 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-stone-300" />
                    <span>{hotel.location}</span>
                  </p>
                </div>
              </div>

              <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-stone-500">From</span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-xl sm:text-2xl tabular-nums font-semibold text-stone-900">
                      {primaryRateMwk > 0 ? `MK ${primaryRateMwk.toLocaleString()}` : primaryRateUsd > 0 ? `$${primaryRateUsd}` : 'Rate on inquiry'}
                    </span>
                    {primaryRateUsd > 0 && primaryRateMwk > 0 && (
                      <span className="text-xs text-stone-500 tabular-nums">
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
                    className="tm-btn tm-btn-secondary tm-btn-sm"
                  >
                    <span>Open listing page</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rejection / Request Edits Form Drawer */}
        {showRejectForm && (
          <div className="tm-panel space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-stone-900">
                <span>What should the host change?</span>
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
                'Please upload sharper photos of the rooms and grounds',
                'Please check the map pin; it is outside Malawi',
                'Please add a Malawi WhatsApp number for guests',
                'Please confirm your nightly room rates'
              ].map(reason => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setRejectReason(reason)}
                  className="px-2.5 py-1 bg-white border border-stone-200 rounded-lg text-[11px] text-left text-stone-700 hover:bg-stone-100 transition cursor-pointer"
                >
                  {reason}
                </button>
              ))}
            </div>

            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Tell the host what to update before approval…"
              className="tm-input h-20 resize-none"
            />

            <div className="tm-actions justify-end">
              <button
                type="button"
                onClick={() => setShowRejectForm(false)}
                className="tm-btn tm-btn-quiet tm-btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUpdating}
                onClick={handleRejectClick}
                className="tm-btn tm-btn-danger tm-btn-sm"
              >
                Reject and notify host
              </button>
            </div>
          </div>
        )}

        {/* Modal Action Bar Footer */}
        <div className="pt-4 border-t border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="tm-actions">
            <Link
              to={`/admin/hotel/${hotel.id}`}
              className="tm-btn tm-btn-quiet tm-btn-sm"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit details</span>
            </Link>

            <Link
              to={`/hotel/${hotel.id}`}
              target="_blank"
              className="tm-btn tm-btn-quiet tm-btn-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>View page</span>
            </Link>

            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (hotel.id) onDelete(hotel.id);
                }}
                className="tm-btn tm-btn-danger tm-btn-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete listing</span>
              </button>
            )}
          </div>

          <div className="tm-actions self-end sm:self-auto">
            {hotel.status === 'pending' ? (
              <>
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => setShowRejectForm(true)}
                  className="tm-btn tm-btn-secondary"
                >
                  Request changes
                </button>

                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={handleApproveClick}
                  className="tm-btn tm-btn-primary"
                >
                  <Check className="w-4 h-4" />
                  <span>{isUpdating ? 'Approving…' : 'Approve and publish'}</span>
                </button>
              </>
            ) : hotel.status === 'rejected' ? (
              <button
                type="button"
                disabled={isUpdating}
                onClick={handleApproveClick}
                className="tm-btn tm-btn-primary"
              >
                <Check className="w-4 h-4" />
                <span>Approve again</span>
              </button>
            ) : (
              <div className="tm-actions">
                <span className="tm-tag tm-tag-good">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Live</span>
                </span>
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => setShowRejectForm(true)}
                  className="tm-btn tm-btn-quiet tm-btn-sm"
                >
                  Suspend listing
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
