import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { Hotel } from '../types';

interface HotelCardProps {
  hotel: Hotel;
  searchParams: {
    checkIn?: string;
    checkOut?: string;
    guests?: number;
  };
  index: number;
}

export default function HotelCard({ hotel, searchParams, index }: HotelCardProps) {
  const [currentImageIdx, setCurrentImageIdx] = useState(0);

  const allImages = [hotel.imageUrl, ...(hotel.galleryUrls || [])].filter(Boolean);

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

  return (
    <Link 
      to={`/hotel/${hotel.id}?checkIn=${searchParams.checkIn || ''}&checkOut=${searchParams.checkOut || ''}&guests=${searchParams.guests || ''}`} 
      className="group flex flex-col gap-3 w-full"
    >
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: index * 0.05 }}
        className="relative w-full aspect-[4/3] sm:aspect-square md:aspect-[4/3] overflow-hidden rounded-2xl bg-stone-100"
      >
        {allImages.length > 0 ? (
          <AnimatePresence initial={false} mode="wait">
            <motion.img 
              key={currentImageIdx}
              src={allImages[currentImageIdx]} 
              alt={hotel.name} 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 object-cover w-full h-full"
            />
          </AnimatePresence>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-stone-400">
            No Image
          </div>
        )}

        {/* Carousel Controls */}
        {allImages.length > 1 && (
          <>
            <div className="absolute inset-0 flex items-center justify-between p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <button 
                onClick={handlePrevImage}
                className="bg-white/80 hover:bg-white text-stone-800 p-1.5 rounded-full shadow-sm backdrop-blur-sm transition z-10"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={handleNextImage}
                className="bg-white/80 hover:bg-white text-stone-800 p-1.5 rounded-full shadow-sm backdrop-blur-sm transition z-10"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            
            {/* Dots */}
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
              {allImages.map((_, i) => (
                <div 
                  key={i} 
                  className={`h-1.5 rounded-full transition-all ${i === currentImageIdx ? 'w-4 bg-white' : 'w-1.5 bg-white/60'}`}
                />
              ))}
            </div>
          </>
        )}
      </motion.div>

      {/* Card Content underneath */}
      <div className="flex flex-col">
        <div className="flex justify-between items-start">
          <h3 className="font-bold text-stone-900 truncate pr-2">{hotel.location}</h3>
          {hotel.categories && hotel.categories.length > 0 && (
            <span className="text-xs font-medium text-stone-500 whitespace-nowrap">
              {hotel.categories[0]}
            </span>
          )}
        </div>
        <p className="text-stone-500 text-sm truncate">{hotel.name}</p>
      </div>
    </Link>
  );
}
