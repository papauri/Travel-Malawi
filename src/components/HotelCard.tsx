import { getActivePromotion, calculateSlashedPrice, getSaleTypeBadge } from '../lib/promotions';
import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Star, Heart, Scale, Tag, Briefcase, Home } from 'lucide-react';
import PromotionIcon from './PromotionIcon';
import { Hotel } from '../types';
import SmartImage from './SmartImage';
import { getHotelImages } from '../lib/images';
import { formatMoney } from '../lib/currency';
import { CurrencyCode } from '../types';
import { useWishlist } from '../hooks/useWishlist';
import { useCompare } from '../contexts/CompareContext';
import PriceDisplay from './PriceDisplay';
import { usePlatformMode } from '../contexts/PlatformModeContext';
import MaskedPlaceName from './MaskedPlaceName';
import { formatLocationName } from '../lib/geo';

interface HotelCardProps {
  hotel: Hotel;
  searchParams: {
    checkIn?: string;
    checkOut?: string;
    guests?: number;
  };
  index: number;
  /** Nightly rate of the cheapest room that matches the search, if known. */
  priceFrom?: number | null;
  /** The currency `priceFrom` is denominated in. */
  priceCurrency?: CurrencyCode;
  /** Simultaneous secondary currency rate (e.g. USD if primary is MWK), if available. */
  secondaryPriceFrom?: number | null;
  secondaryCurrency?: CurrencyCode;
  /** Combined rating across imported and guest-written reviews. */
  rating?: { average: number; count: number } | null;
}

export default function HotelCard({
  hotel,
  searchParams,
  index,
  priceFrom,
  priceCurrency = 'MWK',
  secondaryPriceFrom,
  secondaryCurrency,
  rating
}: HotelCardProps) {
  const [currentImageIdx, setCurrentImageIdx] = useState(0);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const justSwipedRef = useRef(false);
  const swipeTimerRef = useRef<any>(null);

  const { savedHotelIds, toggleSave } = useWishlist();
  const { selectedHotels, toggleHotel } = useCompare();
  // Directory mode: dates and guests are not carried into the listing, and rates read as indicative "from" prices.
  const { bookingsEnabled } = usePlatformMode();

  const isSaved = hotel.id ? savedHotelIds.includes(hotel.id) : false;
  const isComparing = hotel.id ? selectedHotels.some(h => h.hotel.id === hotel.id) : false;

  // Resolved centrally: drops empty/dead URLs and falls back to bundled
  // photography, so this is always at least one usable image.
  const allImages = getHotelImages(hotel);

  const nextImage = () => {
    if (allImages.length <= 1) return;
    setCurrentImageIdx((prev) => (prev + 1) % allImages.length);
  };

  const prevImage = () => {
    if (allImages.length <= 1) return;
    setCurrentImageIdx((prev) => (prev - 1 + allImages.length) % allImages.length);
  };

  const markSwiped = () => {
    justSwipedRef.current = true;
    if (swipeTimerRef.current) clearTimeout(swipeTimerRef.current);
    swipeTimerRef.current = setTimeout(() => {
      justSwipedRef.current = false;
    }, 200);
  };

  const handleNextImage = (e: React.SyntheticEvent | Event) => {
    e.preventDefault();
    e.stopPropagation();
    nextImage();
  };

  const handlePrevImage = (e: React.SyntheticEvent | Event) => {
    e.preventDefault();
    e.stopPropagation();
    prevImage();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartXRef.current;
    const deltaY = touchEndY - touchStartYRef.current;

    // Only register horizontal swipe if movement is predominantly horizontal and > 35px
    if (Math.abs(deltaX) > 35 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      markSwiped();
      if (deltaX < 0) {
        nextImage();
      } else {
        prevImage();
      }
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  const searchQuery = new URLSearchParams(
    Object.entries({
      checkIn: bookingsEnabled ? searchParams.checkIn || '' : '',
      checkOut: bookingsEnabled ? searchParams.checkOut || '' : '',
      guests: bookingsEnabled && searchParams.guests ? String(searchParams.guests) : '',
    }).filter(([, value]) => value !== '')
  ).toString();

  const handleLinkClick = (e: React.MouseEvent) => {
    if (justSwipedRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <Link
      to={searchQuery ? `/hotel/${hotel.id}?${searchQuery}` : `/hotel/${hotel.id}`}
      onClick={handleLinkClick}
      className="group flex flex-col gap-2.5 sm:gap-3 md:gap-4 w-full select-none"
    >
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full aspect-[16/11] sm:aspect-[4/3] overflow-hidden bg-stone-100 rounded-xl sm:rounded-2xl"
      >
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (hotel.id) toggleSave(hotel.id);
          }}
          className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-20 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-white/95 hover:bg-white border border-stone-200/90 text-stone-600 hover:text-stone-900 shadow-2xs transition cursor-pointer"
          aria-label={isSaved ? 'Remove from wishlist' : 'Save to wishlist'}
        >
          <Heart 
            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-colors ${isSaved ? 'fill-rose-500 text-rose-500' : 'text-stone-600'}`} 
            strokeWidth={isSaved ? 0 : 1.75}
          />
        </button>

        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (hotel.id) toggleHotel({ hotel, priceFrom, priceCurrency, rating });
          }}
          className={`absolute top-2.5 left-2.5 sm:top-3 sm:left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer select-none border ${
            isComparing 
              ? 'bg-stone-900 text-white border-stone-900 shadow-xs' 
              : 'bg-white/95 hover:bg-white text-stone-700 hover:text-stone-900 border-stone-200/90 shadow-2xs'
          }`}
          title={isComparing ? 'Remove from comparison' : 'Compare Property'}
          aria-label={isComparing ? 'Remove from comparison' : 'Compare property'}
          aria-pressed={isComparing}
        >
          <Scale className={`w-3.5 h-3.5 ${isComparing ? 'text-stone-300' : 'text-stone-500'}`} />
          <span className="hidden sm:inline">{isComparing ? 'Comparing' : 'Compare'}</span>
        </button>

        {(() => {
          const promo = getActivePromotion(hotel, searchParams?.checkIn, 'all');
          if (!promo) return null;
          return (
            <div className="absolute top-2.5 right-11 sm:top-3 sm:right-13 z-20 flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white/95 text-stone-800 border border-stone-200/90 shadow-2xs">
              <PromotionIcon saleType={promo.saleType} className="w-3 h-3 text-stone-600" />
              <span className="text-[11px] font-medium whitespace-nowrap">
                {getSaleTypeBadge(promo.saleType, promo.saleTypeCustomLabel, promo.discountPercentage)}
              </span>
            </div>
          );
        })()}

        {/* Carousel Image Display with native touch swipe */}
        <div 
          className="absolute inset-0 cursor-pointer overflow-hidden touch-pan-y"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <AnimatePresence initial={false}>
            <motion.div
              key={currentImageIdx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0 pointer-events-none"
            >
              <SmartImage
                src={allImages[currentImageIdx]}
                alt={hotel.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out select-none pointer-events-none"
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Carousel Controls */}
        {allImages.length > 1 && (
          <>
            <div className="absolute inset-0 flex items-center justify-between p-2.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 pointer-events-none">
              <button 
                onClick={handlePrevImage}
                aria-label="Previous image"
                className="bg-white/95 hover:bg-white text-stone-700 hover:text-stone-900 p-1.5 rounded-lg border border-stone-200/80 shadow-2xs transition pointer-events-auto cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={handleNextImage}
                aria-label="Next image"
                className="bg-white/95 hover:bg-white text-stone-700 hover:text-stone-900 p-1.5 rounded-lg border border-stone-200/80 shadow-2xs transition pointer-events-auto cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            
            {/* Dots */}
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
              {allImages.map((image, i) => (
                <div 
                  key={`${image}-${i}`} 
                  className={`h-1 rounded-full transition-all ${i === currentImageIdx ? 'w-5 bg-white' : 'w-1.5 bg-white/60'}`}
                />
              ))}
            </div>
          </>
        )}
      </motion.div>

      {/* Card content */}
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <p className="text-xs font-medium text-stone-500 truncate flex-1 min-w-0">
            {formatLocationName(hotel.location, hotel.name)}
          </p>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            {hotel.stayType === 'entire_place' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200/70">
                <Home className="h-3 w-3 text-stone-500" />
                <span>{hotel.entirePlaceDetails?.propertyType || 'Whole Place'}</span>
              </span>
            )}
            {hotel.featured && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-500">
                <Star className="h-3 w-3 fill-amber-400/80 text-amber-500/80" /> Featured
              </span>
            )}
            {hotel.categories && hotel.categories.length > 0 && (
              <span className="text-[11px] font-medium text-stone-500">
                {hotel.categories[0]}
              </span>
            )}
            {hotel.childPolicy?.enabled && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                hotel.childPolicy.allowed === false
                  ? 'bg-rose-50 text-rose-700 border-rose-200/60'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200/60'
              }`}>
                {hotel.childPolicy.allowed === false
                  ? 'Adults 18+'
                  : hotel.childPolicy.freeUnderAge
                  ? `Kids <${hotel.childPolicy.freeUnderAge} free`
                  : hotel.childPolicy.rateType === 'free'
                  ? 'Kids free'
                  : 'Children welcome'}
              </span>
            )}
          </div>
        </div>
        <h3 className="font-serif text-sm sm:text-base md:text-lg font-bold text-stone-900 leading-snug line-clamp-2 group-hover:text-stone-700 transition-colors duration-200">
          <MaskedPlaceName 
            name={hotel.name} 
            fallback={index === 0 ? '[Your Lodge Name]' : '[Partner Stay]'} 
          />
        </h3>
        {(() => {
          const dateStr = searchParams?.checkIn || new Date().toISOString().split('T')[0];
          const roomPromo = getActivePromotion(hotel, dateStr, 'room');
          const confPromo = getActivePromotion(hotel, dateStr, 'conference');
          const slashed = priceFrom ? calculateSlashedPrice(priceFrom, roomPromo, priceCurrency) : null;
          
          return (
            <div className="flex items-start justify-between mt-0.5 gap-2 flex-wrap">
              {priceFrom && slashed ? (
                <div className="text-xs sm:text-sm text-stone-600 flex-1 min-w-0">
                  {slashed.hasDiscount ? (
                    <div className="flex flex-col gap-1">
                      {/* Sale Type Tag + Slashed Amount */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 bg-stone-100 text-stone-800 border border-stone-200/90 px-1.5 py-0.5 rounded text-[11px] font-medium">
                          <PromotionIcon saleType={slashed.saleType} className="w-3 h-3 text-stone-600" />
                          <span>{slashed.saleTypeLabel}</span>
                        </span>
                        <span className="text-stone-600 text-[11px] font-normal">
                          &minus;{slashed.discountPercentage}% OFF
                        </span>
                      </div>

                      {/* Explicit FROM > TO */}
                      <div className="flex items-baseline gap-1.5 flex-wrap mt-0.5">
                        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-stone-400">FROM</span>
                        <PriceDisplay 
                          className="text-stone-400 font-medium line-through decoration-stone-400 text-xs sm:text-sm" 
                          amount={priceFrom} 
                          currency={priceCurrency} 
                        />
                        <span className="text-stone-400 font-bold text-xs">&gt;</span>
                        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-stone-900">TO</span>
                        <PriceDisplay 
                          className="text-stone-900 font-bold text-base sm:text-lg tracking-tight" 
                          amount={slashed.slashedPrice} 
                          currency={priceCurrency} 
                        />
                        <span className="text-stone-500 text-xs font-medium"> / night</span>

                        {secondaryPriceFrom && secondaryCurrency && (() => {
                          const secSlashed = calculateSlashedPrice(secondaryPriceFrom, roomPromo, secondaryCurrency);
                          return (
                            <span className="text-stone-400 text-[11px] sm:text-xs font-normal ml-0.5">
                              (FROM <PriceDisplay amount={secondaryPriceFrom} currency={secondaryCurrency} className="line-through decoration-stone-300" /> &gt; TO <PriceDisplay amount={secSlashed.slashedPrice} currency={secondaryCurrency} className="font-semibold text-stone-700" />)
                            </span>
                          );
                        })()}
                      </div>

                      {confPromo && (
                        <div className="text-[10px] sm:text-[11px] text-stone-700 font-medium flex items-center gap-1.5 mt-0.5">
                          <Briefcase className="w-3 h-3 text-stone-500 shrink-0" />
                          <span>Conference spaces also slashed up to {confPromo.discountPercentage}%</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-baseline gap-1 flex-wrap">
                        {!bookingsEnabled && <span className="text-stone-400 text-xs">from</span>}
                        <PriceDisplay className="text-stone-900 font-bold text-sm sm:text-base tracking-tight" amount={priceFrom} currency={priceCurrency} />
                        {secondaryPriceFrom && secondaryCurrency && (
                          <span className="text-stone-400 text-[11px] sm:text-xs font-normal">
                            · (<PriceDisplay className="text-stone-500 font-medium" amount={secondaryPriceFrom} currency={secondaryCurrency} />)
                          </span>
                        )}
                        <span className="text-stone-400 text-xs"> / night</span>
                      </div>
                      {confPromo && (
                        <div className="text-[10px] sm:text-[11px] text-stone-700 font-medium flex items-center gap-1.5">
                          <Briefcase className="w-3 h-3 text-stone-500 shrink-0" />
                          <span>Conference spaces on sale ({confPromo.discountPercentage}% OFF)</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-xs sm:text-sm text-stone-400 italic">Rates on request</span>
              )}
              {rating && rating.count > 0 && (
                <span className="flex items-center gap-1 text-sm text-stone-600 shrink-0 ml-auto">
                  <Star className="w-3.5 h-3.5 fill-stone-900 text-stone-900" />
                  <span className="font-semibold text-stone-900">{rating.average.toFixed(1)}</span>
                  <span className="text-stone-400">({rating.count})</span>
                </span>
              )}
            </div>
          );
        })()}
      </div>
    </Link>
  );
}
