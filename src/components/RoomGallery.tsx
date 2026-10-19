import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Images } from 'lucide-react';
import SmartImage from './SmartImage';

interface Props {
  images: string[];
  altPrefix: string;
}

export default function RoomGallery({ images, altPrefix }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(images.length > 1);

  // Touch gesture tracking for mobile swiping
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchDeltaX = useRef<number>(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);

  const updateScrollState = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    if (clientWidth > 0) {
      const idx = Math.round(scrollLeft / clientWidth);
      const clampedIdx = Math.max(0, Math.min(images.length - 1, idx));
      setActiveIndex(clampedIdx);
      setShowLeft(scrollLeft > 10);
      setShowRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  }, [images.length]);

  const scrollToImage = useCallback((index: number) => {
    if (!scrollRef.current) return;
    const { clientWidth } = scrollRef.current;
    const targetIdx = Math.max(0, Math.min(images.length - 1, index));
    scrollRef.current.scrollTo({
      left: targetIdx * clientWidth,
      behavior: 'smooth',
    });
    setActiveIndex(targetIdx);
  }, [images.length]);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const nextIdx = direction === 'left' ? activeIndex - 1 : activeIndex + 1;
    scrollToImage(nextIdx);
  };

  // Mobile Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchDeltaX.current = 0;
    isHorizontalSwipe.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartX.current;
    const deltaY = currentY - touchStartY.current;

    if (isHorizontalSwipe.current === null) {
      // Determine if horizontal swipe intent dominates vertical scroll
      if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
        isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY);
      }
    }

    if (isHorizontalSwipe.current) {
      touchDeltaX.current = deltaX;
    }
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null) return;
    const deltaX = touchDeltaX.current;
    const wasHorizontal = isHorizontalSwipe.current;

    touchStartX.current = null;
    touchStartY.current = null;
    touchDeltaX.current = 0;
    isHorizontalSwipe.current = null;

    if (wasHorizontal && Math.abs(deltaX) > 35) {
      if (deltaX < 0 && activeIndex < images.length - 1) {
        scrollToImage(activeIndex + 1);
      } else if (deltaX > 0 && activeIndex > 0) {
        scrollToImage(activeIndex - 1);
      }
    }
  };

  useEffect(() => {
    updateScrollState();
  }, [updateScrollState]);

  return (
    <div className="w-full h-full relative group select-none">
      <div 
        ref={scrollRef}
        onScroll={updateScrollState}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'pan-y' }}
        className="w-full h-full flex overflow-x-auto snap-x snap-mandatory scrollbar-none"
      >
        {images.map((imgUrl, i) => (
          <div key={`gallery-img-${imgUrl ? imgUrl.slice(-20) : 'img'}-${i}`} className="min-w-full h-full shrink-0 snap-center relative">
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
          {/* Desktop Navigation Arrows (hidden on mobile) */}
          {showLeft && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                scroll('left');
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/95 hover:bg-white text-stone-800 rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10 hidden md:flex cursor-pointer"
              aria-label="Previous room photo"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          {showRight && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                scroll('right');
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/95 hover:bg-white text-stone-800 rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10 hidden md:flex cursor-pointer"
              aria-label="Next room photo"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          {/* Mobile Dot Indicators */}
          <div className="absolute bottom-2.5 left-0 right-0 flex justify-center items-center gap-1.5 z-10 pointer-events-none md:hidden">
            {images.slice(0, 7).map((_, i) => (
              <div 
                key={`dot-${i}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === activeIndex 
                    ? 'w-4 bg-white shadow-sm' 
                    : 'w-1.5 bg-white/60'
                }`}
              />
            ))}
            {images.length > 7 && (
              <span className="text-[9px] text-white/80 font-bold ml-0.5">•</span>
            )}
          </div>

          {/* Mobile Photo Counter Pill */}
          <div className="absolute bottom-2.5 right-2.5 bg-stone-950/70 text-white text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 z-10 pointer-events-none md:hidden">
            <Images className="h-2.5 w-2.5" />
            <span>{activeIndex + 1} / {images.length}</span>
          </div>
        </>
      )}
    </div>
  );
}
