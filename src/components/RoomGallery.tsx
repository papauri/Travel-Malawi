import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Images } from 'lucide-react';
import SmartImage from './SmartImage';

interface Props {
  images: string[];
  altPrefix: string;
}

export default function RoomGallery({ images, altPrefix }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(images.length > 1);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeft(scrollLeft > 5);
    setShowRight(scrollLeft < scrollWidth - clientWidth - 5);
  };

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const { clientWidth } = scrollRef.current;
    const offset = direction === 'left' ? -clientWidth : clientWidth;
    scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  return (
    <div className="w-full h-full relative group">
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="w-full h-full flex overflow-x-auto snap-x snap-mandatory scrollbar-none"
      >
        {images.map((imgUrl, i) => (
          <div key={i} className="min-w-full h-full shrink-0 snap-center relative">
            <SmartImage
              src={imgUrl}
              alt={`${altPrefix} photo ${i + 1}`}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>

      {images.length > 1 && (
        <>
          {/* Desktop Navigation Arrows (hidden on touch devices via media queries or just opacity/hover) */}
          {showLeft && (
            <button
              onClick={() => scroll('left')}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 hover:bg-white text-stone-800 rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10 hidden md:flex"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          {showRight && (
            <button
              onClick={() => scroll('right')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 hover:bg-white text-stone-800 rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10 hidden md:flex"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          {/* Mobile "Swipe for more" or dot indicators (using dots now for cleaner look or just keeping it on mobile) */}
          <div className="absolute bottom-3 right-3 bg-stone-900/60 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm z-10 pointer-events-none md:hidden">
            <Images className="h-3 w-3" />
            Swipe for more
          </div>
        </>
      )}
    </div>
  );
}
