import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import SmartImage from './SmartImage';

interface LightboxProps {
  images: string[];
  initialIndex?: number;
  onClose: () => void;
  onDelete?: (index: number) => void;
}

export default function Lightbox({ images, initialIndex = 0, onClose, onDelete }: LightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Touch gesture tracking for mobile swipe navigation
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchDeltaX = useRef<number>(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, onClose]);

  // Lock body scroll
  useBodyScrollLock(true);

  const next = () => setCurrentIndex((prev) => (prev + 1) % images.length);
  const prev = () => setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);

  // Mobile Touch Handlers
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

    if (wasHorizontal && Math.abs(deltaX) > 40) {
      if (deltaX < 0) {
        next();
      } else {
        prev();
      }
    }
  };

  if (images.length === 0) return null;

  return (
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-xl select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: 'pan-y' }}
    >
      {/* Header controls */}
      <div className="absolute top-4 left-0 right-0 px-4 sm:px-6 flex justify-between items-center z-10 pointer-events-none">
        <span className="text-white/80 font-mono text-sm tracking-widest font-semibold bg-black/50 px-3 py-1 rounded-full backdrop-blur-md">
          {currentIndex + 1} / {images.length}
        </span>
        <div className="flex items-center gap-2 pointer-events-auto">
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const idxToDelete = currentIndex;
                onDelete(idxToDelete);
                if (images.length <= 1) {
                  onClose();
                } else {
                  setCurrentIndex(prev => (prev >= images.length - 1 ? Math.max(0, images.length - 2) : prev));
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-600/90 hover:bg-red-600 text-white text-xs font-bold rounded-full backdrop-blur-md shadow-md active:scale-95 transition cursor-pointer"
              title="Delete this photo"
              aria-label="Delete this photo"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Photo</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition backdrop-blur-md active:scale-95 cursor-pointer"
            aria-label="Close photo gallery"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Image with swipe indicators on mobile */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.2 }}
          className="relative w-full h-full max-w-6xl max-h-[85vh] mx-auto p-4 md:p-8 flex items-center justify-center cursor-grab active:cursor-grabbing"
        >
          <SmartImage
            src={images[currentIndex]}
            alt={`Gallery ${currentIndex + 1}`}
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl pointer-events-none"
          />
        </motion.div>
      </AnimatePresence>

      {/* Navigation Controls */}
      {images.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-4 md:left-8 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition backdrop-blur-md z-10 active:scale-95"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          <button
            onClick={next}
            className="absolute right-4 md:right-8 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition backdrop-blur-md z-10 active:scale-95"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </>
      )}

      {/* Thumbnail strip */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2 px-4 overflow-x-auto snap-x scrollbar-hide py-2 z-10">
        {images.map((img, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`relative w-16 h-12 shrink-0 rounded-lg overflow-hidden transition-all duration-300 ${
              idx === currentIndex ? 'ring-2 ring-white scale-110 opacity-100 shadow-lg' : 'opacity-40 hover:opacity-80'
            }`}
          >
            <SmartImage src={img} alt={`Thumb ${idx}`} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
