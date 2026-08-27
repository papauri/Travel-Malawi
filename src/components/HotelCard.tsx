import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { Hotel } from '../types';
import SmartImage from './SmartImage';
import { getHotelImages } from '../lib/images';
import { formatMoney } from '../lib/currency';
import { CurrencyCode } from '../types';

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

  // Resolved centrally: drops empty/dead URLs and falls back to bundled
  // photography, so this is always at least one usable image.
  const allImages = getHotelImages(hotel);

  const handleNextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIdx((prev) => (prev + 1) % allImages.length);
  };

  const handlePrevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIdx((prev) => (prev - 1 + allImages.length) % allImages.length);
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
        className="relative w-full aspect-[4/5] overflow-hidden bg-stone-100"
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={currentImageIdx}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0"
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
                  key={image} 
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
              <span className="font-semibold text-stone-900">{formatMoney(priceFrom, priceCurrency)}</span>
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
