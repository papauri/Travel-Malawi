import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Hotel } from '../types';

interface HotelCardProps {
  hotel: Hotel;
  searchParams: {
    checkIn?: string;
    checkOut?: string;
    guests?: number;
  };
  index: number;
  key?: string;
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
      className="group flex flex-col gap-4 w-full"
    >
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ delay: index * 0.05, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full aspect-[4/5] overflow-hidden bg-stone-100"
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
              transition={{ duration: 0.4 }}
              className="absolute inset-0 object-cover w-full h-full group-hover:scale-105 transition-transform duration-1000 ease-[cubic-bezier(0.25,1,0.5,1)]"
            />
          </AnimatePresence>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-stone-400 font-serif">
            No Image
          </div>
        )}

        {/* Carousel Controls */}
        {allImages.length > 1 && (
          <>
            <div className="absolute inset-0 flex items-center justify-between p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <button 
                onClick={handlePrevImage}
                className="bg-white/90 hover:bg-white text-stone-900 p-2 rounded-full shadow-sm backdrop-blur-sm transition z-10"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={handleNextImage}
                className="bg-white/90 hover:bg-white text-stone-900 p-2 rounded-full shadow-sm backdrop-blur-sm transition z-10"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            {/* Dots */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-10">
              {allImages.map((_, i) => (
                <div 
                  key={i} 
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
      </div>
    </Link>
  );
}
