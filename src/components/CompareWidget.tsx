import React from 'react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { motion, AnimatePresence } from 'motion/react';
import { Scale, X, Check, Star, MapPin, Clock, Phone, Mail, Tag, ArrowRight } from 'lucide-react';
import { useCompare } from '../contexts/CompareContext';
import { getHotelImages } from '../lib/images';
import { formatMoney } from '../lib/currency';
import PriceDisplay from './PriceDisplay';

export default function CompareWidget() {
  const { selectedHotels, clearSelection, toggleHotel, isCompareModalOpen, setIsCompareModalOpen } = useCompare();
  useBodyScrollLock(isCompareModalOpen);

  if (selectedHotels.length === 0) return null;

  return (
    <>
      <AnimatePresence>
        {!isCompareModalOpen && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 md:bottom-6 left-4 md:left-1/2 md:-translate-x-1/2 z-[70] flex items-center gap-2 sm:gap-4 bg-stone-900 text-white p-2 pl-3 sm:px-6 sm:py-3 rounded-full shadow-2xl border border-stone-700 w-auto max-w-[calc(100%-5rem)] md:max-w-none overflow-x-auto scrollbar-hide"
          >
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Scale className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
              <span className="font-medium text-sm sm:text-base whitespace-nowrap hidden sm:inline">{selectedHotels.length} selected</span>
              
            </div>
            
            <div className="flex -space-x-3 mr-1 sm:mr-2 shrink-0">
              {selectedHotels.map(item => (
                <div key={item.hotel.id} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 border-stone-900 overflow-hidden bg-stone-800">
                  <img src={getHotelImages(item.hotel)[0]} alt={item.hotel.name} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>

            <div className="flex items-center gap-1 sm:gap-2 border-l border-stone-700 pl-2 sm:pl-4 shrink-0">
              <button
                onClick={() => setIsCompareModalOpen(true)}
                disabled={selectedHotels.length < 2}
                className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-stone-700 disabled:text-stone-400 text-white px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-sm font-bold transition whitespace-nowrap"
              >
                Compare
              </button>
              <button
                onClick={clearSelection}
                className="p-1.5 sm:p-1.5 bg-stone-800 hover:bg-stone-700 rounded-full transition text-stone-300 hover:text-white shrink-0"
                title="Clear selection"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCompareModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-12">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCompareModalOpen(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-6xl max-h-full bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-stone-100 bg-stone-50/50">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-100 p-2 rounded-xl">
                    <Scale className="w-5 h-5 text-emerald-700" />
                  </div>
                  <h2 className="text-2xl font-serif font-bold text-stone-900">Compare Properties</h2>
                </div>
                <button
                  onClick={() => setIsCompareModalOpen(false)}
                  className="p-2 hover:bg-stone-200 rounded-full transition bg-stone-100"
                >
                  <X className="w-6 h-6 text-stone-600" />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-3 sm:p-6 bg-stone-50">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="md:hidden flex items-center justify-center gap-2 mb-3 text-stone-500 text-[11px] font-bold uppercase tracking-wider"
                >
                  <span>Swipe to compare</span>
                  <motion.div
                    animate={{ x: [0, 8, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </motion.div>
                </motion.div>
                <div className="flex flex-nowrap md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hide">
                  {selectedHotels.map(item => (
                    <div key={item.hotel.id} className="flex-none w-[85vw] sm:w-80 md:w-auto snap-center flex flex-col gap-0 bg-white rounded-2xl shadow-xs border border-stone-200 overflow-hidden">
                      <div className="relative aspect-[4/3] bg-stone-100 shrink-0">
                        <img 
                          src={getHotelImages(item.hotel)[0]} 
                          alt={item.hotel.name}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <button
                          onClick={() => toggleHotel(item)}
                          className="absolute top-3 right-3 p-2 bg-white/90 hover:bg-white text-stone-900 rounded-full shadow-md transition"
                          title="Remove from comparison"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        
                      </div>
                      
                      <div className="p-5 flex flex-col gap-6">
                        {/* Header Section */}
                        <div>
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <h3 className="font-serif font-bold text-xl text-stone-900 leading-tight">
                              {item.hotel.name}
                            </h3>
                            {item.priceFrom && item.priceCurrency && (
                              <div className="text-right shrink-0">
                                <div className="font-bold text-lg text-emerald-700">
                                  <PriceDisplay amount={item.priceFrom} currency={item.priceCurrency} />
                                </div>
                                <div className="text-[10px] text-stone-500 uppercase font-semibold">per night</div>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1.5 text-sm text-stone-500 mb-3">
                            <MapPin className="w-4 h-4 shrink-0" />
                            <span className="truncate">{item.hotel.location}</span>
                          </div>

                          {item.rating ? (
                            <div className="flex items-center gap-2 text-sm">
                              <div className="flex items-center gap-1 font-bold text-stone-900 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                                <Star className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
                                <span>{item.rating.average.toFixed(1)}</span>
                              </div>
                              <span className="font-bold text-stone-800">
                                {item.rating.average >= 4.8 ? 'Exceptional' : item.rating.average >= 4.5 ? 'Superb' : item.rating.average >= 4.0 ? 'Very Good' : item.rating.average >= 3.5 ? 'Good' : 'Mixed'}
                              </span>
                              <span className="text-stone-300">&bull;</span>
                              <span className="text-stone-500 underline decoration-stone-300">{item.rating.count} reviews</span>
                            </div>
                          ) : (
                            <div className="text-sm text-stone-400 italic">No reviews yet</div>
                          )}
                        </div>

                        <hr className="border-stone-100" />

                        {/* Quick Stats Grid */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          {item.hotel.categories && item.hotel.categories.length > 0 && (
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Type</span>
                              <div className="flex items-center gap-1.5 text-stone-700 font-medium">
                                <Tag className="w-4 h-4 text-stone-400" />
                                {item.hotel.categories[0]}
                              </div>
                            </div>
                          )}
                          
                          {(item.hotel.checkInTime || item.hotel.checkOutTime) && (
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Times</span>
                              <div className="flex items-center gap-1.5 text-stone-700 font-medium">
                                <Clock className="w-4 h-4 text-stone-400" />
                                <span>{item.hotel.checkInTime || '14:00'} - {item.hotel.checkOutTime || '11:00'}</span>
                              </div>
                            </div>
                          )}

                          {item.hotel.contactPhone && (
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Phone</span>
                              <div className="flex items-center gap-1.5 text-stone-700 font-medium">
                                <Phone className="w-4 h-4 text-stone-400" />
                                <span className="truncate">{item.hotel.contactPhone}</span>
                              </div>
                            </div>
                          )}
                          
                          {item.hotel.contactEmail && (
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Email</span>
                              <div className="flex items-center gap-1.5 text-stone-700 font-medium">
                                <Mail className="w-4 h-4 text-stone-400" />
                                <span className="truncate" title={item.hotel.contactEmail}>{item.hotel.contactEmail}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        <hr className="border-stone-100" />

                        {/* Amenities */}
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-3 block">Amenities</span>
                          <ul className="grid grid-cols-1 gap-2 text-sm">
                            {item.hotel.amenities.map(amenity => (
                              <li key={amenity} className="flex items-start gap-2 text-stone-700 font-medium">
                                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                <span>{amenity}</span>
                              </li>
                            ))}
                            {item.hotel.amenities.length === 0 && (
                              <li className="text-stone-400 italic text-sm">No amenities listed</li>
                            )}
                          </ul>
                        </div>
                        
                        {item.hotel.description && (
                          <>
                            <hr className="border-stone-100" />
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2 block">About</span>
                              <p className="text-sm text-stone-600 line-clamp-4 leading-relaxed">
                                {item.hotel.description}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
