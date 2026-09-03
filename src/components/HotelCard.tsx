import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Star, Heart, Scale } from 'lucide-react';
import { Hotel } from '../types';
import SmartImage from './SmartImage';
import { getHotelImages } from '../lib/images';
import { formatMoney } from '../lib/currency';
import { CurrencyCode } from '../types';
import { useWishlist } from '../hooks/useWishlist';
import { useCompare } from '../contexts/CompareContext';
import PriceDisplay from './PriceDisplay';

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
  /** Combined rating across imported and guest-written reviews. */
  rating?: { average: number; count: number } | null;
}

export default function HotelCard({ hotel, searchParams, index, priceFrom, priceCurrency = 'USD', rating }: HotelCardProps) {
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
      className="group flex flex-col gap-4 w-full"
    >
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ delay: index * 0.05, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full aspect-[4/5] overflow-hidden bg-stone-100 rounded-2xl"
      >
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (hotel.id) toggleSave(hotel.id);
          }}
          className="absolute top-4 right-4 z-20 p-2 hover:scale-110 transition-transform duration-200"
        >
          <Heart 
            className={`w-6 h-6 drop-shadow-md ${isSaved ? 'fill-emerald-500 text-emerald-500' : 'fill-black/30 text-white'}`} 
            strokeWidth={isSaved ? 0 : 2}
          />
        </button>

        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (hotel.id) toggleHotel({ hotel, priceFrom, priceCurrency, rating });
          }}
          className={`absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-sm transition-all duration-200 shadow-md ${
            isComparing 
              ? 'bg-emerald-500 text-white' 
              : 'bg-black/30 text-white hover:bg-black/50'
          }`}
          title={isComparing ? 'Remove from comparison' : 'Compare Property'}
        >
          <Scale className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">{isComparing ? 'Comparing' : 'Compare'}</span>
        </button>

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
      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-start">
          <p className="text-[0.65rem] font-bold tracking-[0.2em] text-stone-500 uppercase">{hotel.location}</p>
          {hotel.featured && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-amber-800">
              <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> Featured
            </span>
          )}
          {hotel.categories && hotel.categories.length > 0 && (
            <span className="text-[0.65rem] font-medium tracking-widest text-emerald-600 uppercase">
              {hotel.categories[0]}
            </span>
          )}
        </div>
        <h3 className="font-serif text-2xl text-stone-900 truncate group-hover:text-emerald-700 transition-colors duration-300 pr-2">
          {hotel.name}
        </h3>
        <div className="flex items-center justify-between mt-1">
          {priceFrom ? (
            <p className="text-sm text-stone-600">
              <PriceDisplay className="text-stone-900" amount={priceFrom} currency={priceCurrency} />
              <span className="text-stone-400"> / night</span>
            </p>
          ) : (
            <span className="text-sm text-stone-400">Rates on request</span>
          )}
          {rating && (
            <span className="flex items-center gap-1 text-sm text-stone-600">
              <Star className="w-3.5 h-3.5 fill-stone-900 text-stone-900" />
              <span className="font-semibold text-stone-900">{rating.average.toFixed(1)}</span>
              <span className="text-stone-400">({rating.count})</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
