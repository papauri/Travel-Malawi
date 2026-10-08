import React, { useState } from 'react';
import { Search, Save, Star, Loader2, RefreshCw, Check } from 'lucide-react';
import { Hotel } from '../types';
import toast from 'react-hot-toast';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Pagination from './Pagination';

interface AdminReviewScraperProps {
  hotels: Hotel[];
  onHotelUpdated: (updatedHotel: Hotel) => void;
}

export default function AdminReviewScraper({ hotels, onHotelUpdated }: AdminReviewScraperProps) {
  const [selectedHotelId, setSelectedHotelId] = useState<string>('');
  const [isScraping, setIsScraping] = useState(false);
  const [scrapedReviews, setScrapedReviews] = useState<any[]>([]);
  const [selectedReviews, setSelectedReviews] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const selectedHotel = hotels.find(h => h.id === selectedHotelId);

  const handleScrape = async () => {
    if (!selectedHotel) return;
    
    setIsScraping(true);
    setScrapedReviews([]);
    setSelectedReviews(new Set());
    setCurrentPage(1);
    
    try {
      const response = await fetch('/api/admin/scrape-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotelName: selectedHotel.name,
          location: selectedHotel.location,
        })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to scrape reviews');
      }
      
      if (data.data && Array.isArray(data.data)) {
        setScrapedReviews(data.data);
        toast.success(`Found ${data.data.length} authentic guest reviews`);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error occurred while scraping reviews');
    } finally {
      setIsScraping(false);
    }
  };

  const handleToggleReview = (index: number) => {
    const next = new Set(selectedReviews);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedReviews(next);
  };

  const handleToggleAll = () => {
    if (selectedReviews.size === scrapedReviews.length) {
      setSelectedReviews(new Set());
    } else {
      setSelectedReviews(new Set(scrapedReviews.map((_, i) => i)));
    }
  };

  const handleSaveReviews = async () => {
    if (!selectedHotel || !selectedHotel.id || selectedReviews.size === 0) return;
    
    setIsSaving(true);
    try {
      const hotelRef = doc(db, 'hotels', selectedHotel.id);
      const hotelSnap = await getDoc(hotelRef);
      if (!hotelSnap.exists()) throw new Error('Hotel not found');
      
      const currentData = hotelSnap.data();
      const existingSummary = currentData.reviewsSummary || { count: 0, averageRating: 0, recentReviews: [] };
      
      const newReviews = Array.from(selectedReviews).map(index => scrapedReviews[index]);
      
      const combinedReviews = [...newReviews, ...(existingSummary.recentReviews || [])];
      // Keep only up to 20 reviews for display
      const truncatedReviews = combinedReviews.slice(0, 20);
      
      // Calculate new average
      const totalCount = existingSummary.count + newReviews.length;
      let totalScore = (existingSummary.averageRating * existingSummary.count);
      newReviews.forEach(r => totalScore += (r.rating || 5));
      const newAverage = totalCount > 0 ? (totalScore / totalCount) : 5;
      
      const updatedSummary = {
        count: totalCount,
        averageRating: parseFloat(newAverage.toFixed(1)),
        recentReviews: truncatedReviews
      };
      
      await updateDoc(hotelRef, { reviewsSummary: updatedSummary });
      onHotelUpdated({ ...selectedHotel, reviewsSummary: updatedSummary });
      
      toast.success('Reviews saved successfully to the property');
      setScrapedReviews([]);
      setSelectedReviews(new Set());
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to save reviews');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl animate-in fade-in duration-200">
      <div className="pb-2 border-b border-stone-200">
        <h2 className="text-2xl font-serif font-bold text-stone-900 tracking-tight">Review Discovery &amp; Moderation</h2>
        <p className="text-stone-500 text-xs sm:text-sm mt-0.5">
          Scan verified public sources for guest reviews and link them directly to verified Malawian listings.
        </p>
      </div>

      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">Select Approved Property</label>
            <select
              value={selectedHotelId}
              onChange={(e) => setSelectedHotelId(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3.5 py-2 text-xs text-stone-900 focus:bg-white focus:border-stone-900 outline-none transition"
            >
              <option value="">-- Choose a property --</option>
              {hotels.filter(h => h.status === 'approved' || !h.status).map(hotel => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name} {hotel.location ? `· ${hotel.location}` : ''}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <button
              onClick={handleScrape}
              disabled={!selectedHotelId || isScraping}
              className="w-full flex items-center justify-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-stone-800 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs cursor-pointer"
            >
              {isScraping ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Scanning Public Web...</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Discover Reviews</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {isScraping && (
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-8 flex flex-col items-center justify-center text-center space-y-2">
          <RefreshCw className="w-6 h-6 text-stone-500 animate-spin" />
          <h3 className="font-semibold text-stone-900 text-sm">Searching Verified Hospitality Channels</h3>
          <p className="text-stone-500 text-xs max-w-md">
            Querying public travel mentions for {selectedHotel?.name}. Parsing dates, ratings, and guest feedback.
          </p>
        </div>
      )}

      {!isScraping && scrapedReviews.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <span className="font-semibold text-stone-900">{scrapedReviews.length} Reviews Found</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums font-mono">{selectedReviews.size} selected</span>
            </div>
            <button
              type="button"
              onClick={handleToggleAll}
              className="text-xs font-medium text-stone-600 hover:text-stone-900 underline cursor-pointer"
            >
              {selectedReviews.size === scrapedReviews.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {scrapedReviews.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((review, i) => {
              const actualIdx = (currentPage - 1) * itemsPerPage + i;
              const isSelected = selectedReviews.has(actualIdx);
              return (
                <div 
                  key={actualIdx} 
                  onClick={() => handleToggleReview(actualIdx)}
                  className={`p-4 rounded-xl border cursor-pointer transition text-left flex flex-col justify-between gap-3 ${
                    isSelected 
                      ? 'border-stone-900 bg-stone-50/80 ring-1 ring-stone-900' 
                      : 'border-stone-200 bg-white hover:border-stone-300'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] ${
                          isSelected ? 'bg-stone-900 border-stone-900 text-white' : 'border-stone-300'
                        }`}>
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                        <span className="font-semibold text-stone-900 text-xs">{review.author}</span>
                      </div>
                      <div className="flex items-center gap-1 font-mono text-xs font-semibold text-stone-800">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span className="tabular-nums">{review.rating}</span>
                      </div>
                    </div>
                    
                    <p className="text-stone-600 text-xs italic leading-relaxed font-serif">
                      "{review.comment}"
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between text-[11px] text-stone-400 border-t border-stone-100 pt-2">
                    <span>Source: {review.source}</span>
                    {review.date && <span>{review.date}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {scrapedReviews.length > itemsPerPage && (
            <div className="pt-2">
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(scrapedReviews.length / itemsPerPage)}
                onPageChange={setCurrentPage}
                className="flex items-center justify-center gap-1.5"
              />
            </div>
          )}

          <div className="sticky bottom-4 bg-white/95 backdrop-blur border border-stone-200 rounded-xl p-4 shadow-lg flex items-center justify-between mt-6">
            <div>
              <p className="font-semibold text-xs text-stone-900">{selectedReviews.size} reviews selected</p>
              <p className="text-[11px] text-stone-500">Selected reviews will update the average rating and display on the listing card.</p>
            </div>
            <button
              onClick={handleSaveReviews}
              disabled={selectedReviews.size === 0 || isSaving}
              className="flex items-center gap-1.5 bg-stone-900 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-stone-800 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Attach to Property</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
