import { getActivePromotion, calculateSlashedPrice, getSaleTypeBadge } from '../lib/promotions';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Star, Heart, Scale, Tag, Briefcase } from 'lucide-react';
import PromotionIcon from './PromotionIcon';
import { Hotel } from '../types';
import SmartImage from './SmartImage';
import { getHotelImages } from '../lib/images';
import { formatMoney } from '../lib/currency';
import { CurrencyCode } from '../types';
import { useWishlist } from '../hooks/useWishlist';
import { useCompare } from '../contexts/CompareContext';
import PriceDisplay from './PriceDisplay';
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
  const { savedHotelIds, toggleSave } = useWishlist();
  const { selectedHotels, toggleHotel } = useCompare();

  const isSaved = hotel.id ? savedHotelIds.includes(hotel.id) : false;
  const isComparing = hotel.id ? selectedHotels.some(h => h.hotel.id === hotel.id) : false;

  // Resolved centrally: drops empty/dead URLs and falls back to bundled
  // photography, so this is always at least one usable image.
  const allImages = getHotelImages(hotel);

  const nextImage = () => {
    setCurrentImageIdx((prev) => (prev + 1) % allImages.length);
  };

  const prevImage = () => {
    setCurrentImageIdx((prev) => (prev - 1 + allImages.length) % allImages.length);
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

  const searchQuery = new URLSearchParams(
    Object.entries({
      checkIn: searchParams.checkIn || '',
      checkOut: searchParams.checkOut || '',
      guests: searchParams.guests ? String(searchParams.guests) : '',
    }).filter(([, value]) => value !== '')
  ).toString();

  return (
    <Link
      to={searchQuery ? `/hotel/${hotel.id}?${searchQuery}` : `/hotel/${hotel.id}`}
      className="group flex flex-col gap-2.5 sm:gap-3 md:gap-4 w-full"
    >
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ delay: index * 0.05, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full aspect-[16/11] sm:aspect-[4/3] md:aspect-[4/5] overflow-hidden bg-stone-100 rounded-xl sm:rounded-2xl"
      >
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (hotel.id) toggleSave(hotel.id);
          }}
          className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 md:top-4 md:right-4 z-20 p-1.5 sm:p-2 hover:scale-110 transition-transform duration-200"
          aria-label={isSaved ? 'Remove from wishlist' : 'Save to wishlist'}
        >
          <Heart 
            className={`w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 drop-shadow-md ${isSaved ? 'fill-emerald-500 text-emerald-500' : 'fill-black/30 text-white'}`} 
            strokeWidth={isSaved ? 0 : 2}
          />
        </button>

        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (hotel.id) toggleHotel({ hotel, priceFrom, priceCurrency, rating });
          }}
          className={`absolute top-2.5 left-2.5 sm:top-3 sm:left-3 md:top-4 md:left-4 z-20 flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 rounded-full backdrop-blur-sm transition-all duration-200 shadow-md ${
            isComparing 
              ? 'bg-emerald-500 text-white' 
              : 'bg-black/30 text-white hover:bg-black/50'
          }`}
          title={isComparing ? 'Remove from comparison' : 'Compare Property'}
        >
          <Scale className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
          <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider hidden sm:inline">{isComparing ? 'Comparing' : 'Compare'}</span>
        </button>

        {(() => {
          const promo = getActivePromotion(hotel, searchParams?.checkIn, 'all');
          if (!promo) return null;
          return (
            <div className="absolute top-2.5 right-11 sm:top-3 sm:right-13 md:top-4 md:right-15 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-900/95 hover:bg-stone-900 text-white backdrop-blur-md shadow-md border border-stone-700/80 transition-transform">
              <PromotionIcon saleType={promo.saleType} className="w-3 h-3 text-stone-200" />
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                {getSaleTypeBadge(promo.saleType, promo.saleTypeCustomLabel, promo.discountPercentage)}
              </span>
            </div>
          );
        })()}

        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={currentImageIdx}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0"
            style={{ touchAction: 'pan-y' }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            onDragEnd={(e, { offset, velocity }) => {
              const swipe = offset.x;
              if (swipe < -50) {
                nextImage();
              } else if (swipe > 50) {
                prevImage();
              }
            }}
          >
            <SmartImage
              src={allImages[currentImageIdx]}
              alt={hotel.name}
              className="absolute inset-0 object-cover w-full h-full group-hover:scale-105 transition-transform duration-1000 ease-[cubic-bezier(0.25,1,0.5,1)]"
            />
          </motion.div>
        </AnimatePresence>

        {/* Carousel Controls */}
        {allImages.length > 1 && (
          <>
            <div className="absolute inset-0 flex items-center justify-between p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <button 
                onClick={handlePrevImage}
                aria-label="Previous image"
                className="bg-white/90 hover:bg-white text-stone-900 p-2 rounded-full shadow-sm backdrop-blur-sm transition z-10"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={handleNextImage}
                aria-label="Next image"
                className="bg-white/90 hover:bg-white text-stone-900 p-2 rounded-full shadow-sm backdrop-blur-sm transition z-10"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            {/* Dots */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-10">
              {allImages.map((image, i) => (
                <div 
                  key={`${image}-${i}`} 
                  className={`h-1 transition-all ${i === currentImageIdx ? 'w-6 bg-white' : 'w-2 bg-white/50'}`}
                />
              ))}
            </div>
          </>
        )}
      </motion.div>

      {/* Dwellis Aesthetic Content */}
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <p className="text-[0.65rem] font-bold tracking-[0.18em] text-stone-500 uppercase truncate flex-1 min-w-0">
            {formatLocationName(hotel.location, hotel.name)}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {hotel.featured && (
              <span className="inline-flex items-center gap-1 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-stone-500">
                <Star className="h-2.5 w-2.5 fill-stone-400 text-stone-400" /> Featured
              </span>
            )}
            {hotel.categories && hotel.categories.length > 0 && (
              <span className="text-[0.65rem] font-semibold tracking-wider text-emerald-600 uppercase">
                {hotel.categories[0]}
              </span>
            )}
          </div>
        </div>
        <h3 className="font-serif text-sm sm:text-base md:text-lg font-bold text-stone-900 leading-snug line-clamp-2 group-hover:text-emerald-700 transition-colors duration-300">
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
                      {/* Sale Type Pill + Slashed Amount */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 bg-stone-900 text-white px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold uppercase tracking-wider shadow-2xs">
                          <PromotionIcon saleType={slashed.saleType} className="w-3 h-3 text-white" />
                          <span>{slashed.saleTypeLabel}</span>
                        </span>
                        <span className="bg-stone-100 text-stone-800 border border-stone-300 px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold tracking-tight">
                          Slashed by <PriceDisplay amount={slashed.slashedAmount} currency={priceCurrency} /> ({slashed.discountPercentage}% OFF)
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
              {rating && (
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
