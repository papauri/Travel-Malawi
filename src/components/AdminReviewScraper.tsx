import React, { useState } from 'react';
import { Search, Plus, Save, Star, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { Hotel } from '../types';
import toast from 'react-hot-toast';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

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

  const selectedHotel = hotels.find(h => h.id === selectedHotelId);

  const handleScrape = async () => {
    if (!selectedHotel) return;
    
    setIsScraping(true);
    setScrapedReviews([]);
    setSelectedReviews(new Set());
    
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
        toast.success(`Successfully found ${data.data.length} reviews`);
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
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-3xl font-serif font-bold text-stone-900">Review Scraper</h2>
        <p className="text-stone-500 mt-1">Search the web for authentic guest reviews and attach them to local properties.</p>
      </div>

      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200 shadow-2xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-stone-900 mb-1.5">Select Property</label>
            <select
              value={selectedHotelId}
              onChange={(e) => setSelectedHotelId(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 transition"
            >
              <option value="">-- Choose a property --</option>
              {hotels.filter(h => h.status === 'approved').map(hotel => (
                <option key={hotel.id} value={hotel.id}>{hotel.name} {hotel.location ? `(${hotel.location})` : ''}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={handleScrape}
              disabled={!selectedHotelId || isScraping}
              className="w-full md:w-auto flex items-center justify-center gap-2 bg-stone-900 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-stone-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isScraping ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Searching the web...</span>
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  <span>Scrape Reviews</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {isScraping && (
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
          <RefreshCw className="w-10 h-10 text-stone-400 animate-spin mb-4" />
          <h3 className="font-bold text-stone-900 text-lg">Scanning TripAdvisor, Google Maps & Social Media</h3>
          <p className="text-stone-500 text-sm mt-2 max-w-md">Our AI is securely searching the web for authentic positive reviews mentioning {selectedHotel?.name}. This usually takes about 10-15 seconds.</p>
        </div>
      )}

      {!isScraping && scrapedReviews.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-serif font-bold text-stone-900">Found Reviews</h3>
            <button
              onClick={handleToggleAll}
              className="text-sm font-semibold text-stone-600 hover:text-stone-900"
            >
              {selectedReviews.size === scrapedReviews.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scrapedReviews.map((review, i) => {
              const isSelected = selectedReviews.has(i);
              return (
                <div 
                  key={i} 
                  onClick={() => handleToggleReview(i)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected ? 'border-stone-900 bg-stone-50/50 shadow-xs' : 'border-stone-200 bg-white hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                        isSelected ? 'bg-stone-900 border-stone-900 text-white' : 'border-stone-300'
                      }`}>
                        {isSelected && <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <span className="font-bold text-stone-900 text-sm">{review.author}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      <span className="text-sm font-bold">{review.rating}</span>
                    </div>
                  </div>
                  
                  <p className="text-stone-600 text-sm mb-3">"{review.comment}"</p>
                  
                  <div className="flex items-center justify-between text-xs text-stone-500">
                    <span>Source: {review.source}</span>
                    {review.date && <span>{review.date}</span>}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="sticky bottom-4 bg-white border border-stone-200 rounded-2xl p-4 shadow-xl flex items-center justify-between mt-8">
            <div>
              <p className="font-bold text-stone-900">{selectedReviews.size} selected</p>
              <p className="text-xs text-stone-500">These will be added to the property's public listing.</p>
            </div>
            <button
              onClick={handleSaveReviews}
              disabled={selectedReviews.size === 0 || isSaving}
              className="flex items-center gap-2 bg-stone-900 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-stone-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Save to Property</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
