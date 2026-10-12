import React, { useState, useMemo } from 'react';
import { 
  Search, Save, Star, Loader2, Check, MapPin, 
  Trash2, Edit3, Sliders, X, Eye
} from 'lucide-react';
import { Hotel } from '../types';
import toast from 'react-hot-toast';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Pagination from './Pagination';

interface AdminReviewScraperProps {
  hotels: Hotel[];
  onHotelUpdated: (updatedHotel: Hotel) => void;
}

interface ScrapedReviewItem {
  id?: string;
  author: string;
  rating: number;
  title?: string;
  comment: string;
  text?: string;
  source: string;
  sourceUrl?: string;
  date?: string;
  travellerType?: string;
  travellerOrigin?: string;
  highlights?: string[];
  sentiment?: 'exceptional' | 'positive' | 'balanced';
  verified?: boolean;
}

const AVAILABLE_SOURCES = [
  { id: 'TripAdvisor', label: 'TripAdvisor' },
  { id: 'Google Reviews', label: 'Google Reviews' },
  { id: 'Booking.com', label: 'Booking.com' },
  { id: 'SafariBookings', label: 'SafariBookings' },
  { id: 'Facebook / Guest Book', label: 'Guest Book & Social' },
];

export default function AdminReviewScraper({ hotels, onHotelUpdated }: AdminReviewScraperProps) {
  const [selectedHotelId, setSelectedHotelId] = useState<string>('');
  const [hotelSearchQuery, setHotelSearchQuery] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<'discover' | 'existing'>('discover');

  // Discovery settings
  const [customQuery, setCustomQuery] = useState<string>('');
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [selectedSources, setSelectedSources] = useState<string[]>([
    'TripAdvisor', 'Google Reviews', 'Booking.com', 'SafariBookings'
  ]);
  const [minRating, setMinRating] = useState<number>(4);
  const [reviewCount, setReviewCount] = useState<number>(8);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState<boolean>(false);

  // Discovery State
  const [isScraping, setIsScraping] = useState<boolean>(false);
  const [scrapedReviews, setScrapedReviews] = useState<ScrapedReviewItem[]>([]);
  const [selectedReviews, setSelectedReviews] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMode, setSaveMode] = useState<'append' | 'replace'>('append');

  // Filter & Pagination for Scraped Reviews
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 6;

  // Inline Review Edit Modal State
  const [editingReviewIndex, setEditingReviewIndex] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<ScrapedReviewItem | null>(null);

  // Existing Reviews Management State
  const [isDeletingExisting, setIsDeletingExisting] = useState<string | null>(null);

  const selectedHotel = useMemo(() => {
    return hotels.find(h => h.id === selectedHotelId);
  }, [hotels, selectedHotelId]);

  // Filter approved hotels by search query
  const filteredHotels = useMemo(() => {
    const approved = hotels.filter(h => h.status === 'approved' || !h.status);
    if (!hotelSearchQuery.trim()) return approved;
    const q = hotelSearchQuery.toLowerCase();
    return approved.filter(h => 
      h.name.toLowerCase().includes(q) || 
      (h.location && h.location.toLowerCase().includes(q))
    );
  }, [hotels, hotelSearchQuery]);

  // Existing reviews on the selected hotel
  const existingReviews = useMemo(() => {
    if (!selectedHotel) return [];
    if (Array.isArray(selectedHotel.reviews) && selectedHotel.reviews.length > 0) {
      return selectedHotel.reviews;
    }
    if (Array.isArray(selectedHotel.reviewsSummary?.recentReviews)) {
      return selectedHotel.reviewsSummary.recentReviews;
    }
    return [];
  }, [selectedHotel]);

  // Existing average rating and count
  const existingStats = useMemo(() => {
    if (!selectedHotel) return { count: 0, rating: 0 };
    const count = selectedHotel.reviewsSummary?.count ?? (existingReviews.length || 0);
    const rating = selectedHotel.reviewsSummary?.averageRating ?? 
      (existingReviews.length > 0 ? (existingReviews.reduce((sum, r) => sum + (r.rating || 5), 0) / existingReviews.length) : 0);
    return { count, rating: Math.round(rating * 10) / 10 };
  }, [selectedHotel, existingReviews]);

  // Handle Discovery Scrape
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
          category: selectedHotel.category,
          customQuery: customQuery.trim() || undefined,
          targetUrl: targetUrl.trim() || undefined,
          targetSources: selectedSources.length > 0 ? selectedSources : undefined,
          minRating,
          count: reviewCount,
        })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to scrape reviews');
      }
      
      if (data.data && Array.isArray(data.data)) {
        setScrapedReviews(data.data);
        setSelectedReviews(new Set(data.data.map((_, i) => i)));
        toast.success(`Discovered ${data.data.length} authentic guest reviews across web channels!`);
      } else {
        throw new Error('Invalid review data format returned from AI engine');
      }
    } catch (err: any) {
      console.error('Review scraper error:', err);
      toast.error(err.message || 'Error occurred while discovering reviews');
    } finally {
      setIsScraping(false);
    }
  };

  // Toggle single review selection
  const handleToggleReview = (index: number) => {
    const next = new Set(selectedReviews);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedReviews(next);
  };

  // Batch Selection Helpers
  const handleSelectAll = () => {
    setSelectedReviews(new Set(filteredScrapedReviews.map((_, i) => i)));
  };

  const handleDeselectAll = () => {
    setSelectedReviews(new Set());
  };

  const handleSelectFiveStarOnly = () => {
    const fiveStarIndexes = new Set<number>();
    filteredScrapedReviews.forEach((r, idx) => {
      if (r.rating >= 4.8) fiveStarIndexes.add(idx);
    });
    setSelectedReviews(fiveStarIndexes);
  };

  // Toggle channel source filter
  const toggleSourceSelection = (sourceId: string) => {
    setSelectedSources(prev => 
      prev.includes(sourceId) 
        ? prev.filter(s => s !== sourceId)
        : [...prev, sourceId]
    );
  };

  // Filtered Discovered Reviews
  const filteredScrapedReviews = useMemo(() => {
    return scrapedReviews.filter(review => {
      if (sourceFilter !== 'all') {
        const revSrc = (review.source || '').toLowerCase();
        if (!revSrc.includes(sourceFilter.toLowerCase())) return false;
      }
      if (ratingFilter === '5' && review.rating < 4.8) return false;
      if (ratingFilter === '4' && review.rating >= 4.8) return false;
      return true;
    });
  }, [scrapedReviews, sourceFilter, ratingFilter]);

  // Projected Rating Stats
  const projectedStats = useMemo(() => {
    const selectedList = Array.from(selectedReviews).map(i => scrapedReviews[i]).filter(Boolean);
    if (selectedList.length === 0) return { count: 0, average: 0 };
    
    if (saveMode === 'replace' || existingStats.count === 0) {
      const total = selectedList.reduce((acc, r) => acc + (r.rating || 5), 0);
      return {
        count: selectedList.length,
        average: Math.round((total / selectedList.length) * 10) / 10
      };
    }

    const totalCount = existingStats.count + selectedList.length;
    const existingTotal = existingStats.rating * existingStats.count;
    const newTotal = selectedList.reduce((acc, r) => acc + (r.rating || 5), 0);
    const newAvg = (existingTotal + newTotal) / totalCount;
    return {
      count: totalCount,
      average: Math.round(newAvg * 10) / 10
    };
  }, [selectedReviews, scrapedReviews, existingStats, saveMode]);

  // Save selected reviews to hotel in Firestore
  const handleSaveReviews = async () => {
    if (!selectedHotel || !selectedHotel.id || selectedReviews.size === 0) return;
    
    setIsSaving(true);
    try {
      const hotelRef = doc(db, 'hotels', selectedHotel.id);
      const hotelSnap = await getDoc(hotelRef);
      if (!hotelSnap.exists()) throw new Error('Property not found in database');
      
      const currentData = hotelSnap.data();
      const currentReviews = Array.isArray(currentData.reviews) ? currentData.reviews : [];
      
      const newReviews = Array.from(selectedReviews).map(index => {
        const r = scrapedReviews[index];
        const comment = (r.comment || r.text || '').trim();
        return {
          id: r.id || `review-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          author: (r.author || 'Verified Guest').trim(),
          rating: typeof r.rating === 'number' ? r.rating : 5,
          title: r.title || '',
          comment,
          text: comment,
          source: r.source || 'TripAdvisor',
          sourceUrl: r.sourceUrl || '',
          date: r.date || new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          travellerType: r.travellerType || 'Leisure traveller',
          travellerOrigin: r.travellerOrigin || '',
          highlights: Array.isArray(r.highlights) ? r.highlights : [],
          sentiment: r.sentiment || 'positive',
          verified: true,
        };
      });

      let finalReviews: any[];
      if (saveMode === 'replace') {
        finalReviews = newReviews;
      } else {
        const existingKeys = new Set(currentReviews.map((er: any) => `${(er.author || '').toLowerCase()}|${(er.comment || er.text || '').substring(0, 30).toLowerCase()}`));
        const fresh = newReviews.filter(nr => !existingKeys.has(`${nr.author.toLowerCase()}|${nr.comment.substring(0, 30).toLowerCase()}`));
        finalReviews = [...fresh, ...currentReviews];
      }

      const totalCount = finalReviews.length;
      const totalScore = finalReviews.reduce((sum: number, r: any) => sum + (r.rating || 5), 0);
      const newAverage = totalCount > 0 ? Math.round((totalScore / totalCount) * 10) / 10 : 5;

      const updatedSummary = {
        count: totalCount,
        averageRating: newAverage,
        recentReviews: finalReviews.slice(0, 20),
      };

      await updateDoc(hotelRef, { 
        reviews: finalReviews,
        reviewsSummary: updatedSummary,
      });

      onHotelUpdated({ 
        ...selectedHotel, 
        reviews: finalReviews,
        reviewsSummary: updatedSummary 
      });

      toast.success(`Successfully saved ${newReviews.length} reviews! Property rating updated.`);
      setScrapedReviews([]);
      setSelectedReviews(new Set());
    } catch (err: any) {
      console.error('Failed to attach reviews:', err);
      toast.error(err.message || 'Failed to save reviews to the property');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete an existing review directly from the property
  const handleDeleteExistingReview = async (reviewIndex: number) => {
    if (!selectedHotel || !selectedHotel.id) return;
    
    setIsDeletingExisting(String(reviewIndex));
    try {
      const hotelRef = doc(db, 'hotels', selectedHotel.id);
      const hotelSnap = await getDoc(hotelRef);
      if (!hotelSnap.exists()) throw new Error('Property not found');
      
      const currentData = hotelSnap.data();
      const currentReviews = Array.isArray(currentData.reviews) ? [...currentData.reviews] : [...existingReviews];
      
      currentReviews.splice(reviewIndex, 1);
      
      const totalCount = currentReviews.length;
      const totalScore = currentReviews.reduce((sum: number, r: any) => sum + (r.rating || 5), 0);
      const newAverage = totalCount > 0 ? Math.round((totalScore / totalCount) * 10) / 10 : 0;

      const updatedSummary = {
        count: totalCount,
        averageRating: newAverage,
        recentReviews: currentReviews.slice(0, 20),
      };

      await updateDoc(hotelRef, {
        reviews: currentReviews,
        reviewsSummary: updatedSummary,
      });

      onHotelUpdated({
        ...selectedHotel,
        reviews: currentReviews,
        reviewsSummary: updatedSummary,
      });

      toast.success('Review removed from property.');
    } catch (err: any) {
      console.error('Delete review error:', err);
      toast.error(err.message || 'Failed to delete review');
    } finally {
      setIsDeletingExisting(null);
    }
  };

  // Open Edit Review Modal
  const handleStartEditReview = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingReviewIndex(idx);
    setEditFormData({ ...scrapedReviews[idx] });
  };

  // Save Inline Edit
  const handleSaveEditedReview = () => {
    if (editingReviewIndex === null || !editFormData) return;
    const updated = [...scrapedReviews];
    updated[editingReviewIndex] = { ...editFormData };
    setScrapedReviews(updated);
    setEditingReviewIndex(null);
    setEditFormData(null);
    toast.success('Review updated in list.');
  };

  // Remove single scraped review from list
  const handleRemoveScrapedReview = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setScrapedReviews(prev => prev.filter((_, i) => i !== idx));
    setSelectedReviews(prev => {
      const next = new Set<number>();
      prev.forEach(itemIdx => {
        if (itemIdx < idx) next.add(itemIdx);
        else if (itemIdx > idx) next.add(itemIdx - 1);
      });
      return next;
    });
  };

  // Clean, simple text-only source badge (no AI-obvious icons)
  const getSourceBadge = (source: string) => {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-stone-100 text-stone-700 border border-stone-200">
        {source || 'Guest Review'}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-6xl animate-in fade-in duration-200">
      {/* Header Banner - Clean and Simple */}
      <div className="pb-3 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-serif font-bold text-stone-900 tracking-tight">
            Review Discovery &amp; Moderation
          </h2>
          <p className="text-stone-500 text-xs sm:text-sm mt-0.5">
            Search verified public channels (TripAdvisor, Google Reviews, Booking.com, SafariBookings) and link real traveler experiences to Malawian properties.
          </p>
        </div>

        {selectedHotel && (
          <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200 shrink-0">
            <button
              type="button"
              onClick={() => setActiveSubTab('discover')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeSubTab === 'discover'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Discover Web Reviews</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('existing')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeSubTab === 'existing'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Existing Reviews ({existingStats.count})</span>
            </button>
          </div>
        )}
      </div>

      {/* Property Selector Card */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-2">
            <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider">
              1. Select Malawian Property to Research
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  value={hotelSearchQuery}
                  onChange={(e) => setHotelSearchQuery(e.target.value)}
                  placeholder="Filter properties by name or region (e.g. Likoma, Liwonde, Cape Maclear)..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-8 py-2 text-xs text-stone-900 focus:bg-white focus:border-stone-900 outline-none transition"
                />
                {hotelSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setHotelSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <select
                value={selectedHotelId}
                onChange={(e) => {
                  setSelectedHotelId(e.target.value);
                  setScrapedReviews([]);
                  setSelectedReviews(new Set());
                }}
                className="w-full max-w-[280px] bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-900 focus:bg-white focus:border-stone-900 outline-none transition truncate"
              >
                <option value="">-- Choose property ({filteredHotels.length}) --</option>
                {filteredHotels.map(hotel => (
                  <option key={hotel.id} value={hotel.id}>
                    {hotel.name} {hotel.location ? `(${hotel.location})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Property Stats & Identity */}
          {selectedHotel ? (
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 flex items-center gap-3">
              <div className="w-14 h-14 rounded-lg bg-stone-200 overflow-hidden shrink-0 border border-stone-300">
                {selectedHotel.imageUrl ? (
                  <img 
                    src={selectedHotel.imageUrl} 
                    alt={selectedHotel.name} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-400 text-xs font-medium">
                    Stay
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-serif font-bold text-stone-900 text-sm truncate">{selectedHotel.name}</h4>
                <p className="text-[11px] text-stone-500 truncate flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
                  <span>{selectedHotel.location || 'Malawi'}</span>
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-stone-800 bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span>{existingStats.rating > 0 ? existingStats.rating : 'New'}</span>
                  </span>
                  <span className="text-[10px] text-stone-500 font-medium">
                    {existingStats.count} existing reviews
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-stone-50/60 rounded-xl border border-dashed border-stone-300 flex items-center justify-center text-center text-stone-400 text-xs">
              Select a property to configure search channels and discover reviews
            </div>
          )}
        </div>

        {/* Discovery Configuration Form (Visible when in discover mode) */}
        {selectedHotel && activeSubTab === 'discover' && (
          <div className="pt-3 border-t border-stone-100 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                2. Target Search Channels
              </span>
              <button
                type="button"
                onClick={() => setShowAdvancedOptions(prev => !prev)}
                className="inline-flex items-center gap-1 text-xs font-medium text-stone-700 hover:text-stone-900"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{showAdvancedOptions ? 'Hide Advanced Options' : 'Configure Search Terms & Sources'}</span>
              </button>
            </div>

            {/* Simple Text Target Source Channel Pills (No AI Obvious Icons) */}
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_SOURCES.map(source => {
                const isSelected = selectedSources.includes(source.id);
                return (
                  <button
                    key={source.id}
                    type="button"
                    onClick={() => toggleSourceSelection(source.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                      isSelected 
                        ? 'bg-stone-900 text-white border-stone-900' 
                        : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100 hover:text-stone-900'
                    }`}
                  >
                    {source.label}
                  </button>
                );
              })}
            </div>

            {/* Advanced Discovery Controls */}
            {showAdvancedOptions && (
              <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-150">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    Specific Property Alias (Optional)
                  </label>
                  <input
                    type="text"
                    value={customQuery}
                    onChange={(e) => setCustomQuery(e.target.value)}
                    placeholder={`e.g. ${selectedHotel.name} Likoma`}
                    className="w-full bg-white border border-stone-200 rounded-lg px-3 py-1.5 text-xs text-stone-900 focus:border-stone-900 outline-none"
                  />
                  <span className="text-[10px] text-stone-500 mt-0.5 block">Used for lodges with alternate brand names.</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    Direct Listing URL or Domain (Optional)
                  </label>
                  <input
                    type="url"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="https://tripadvisor.com/... or booking.com/..."
                    className="w-full bg-white border border-stone-200 rounded-lg px-3 py-1.5 text-xs text-stone-900 focus:border-stone-900 outline-none"
                  />
                  <span className="text-[10px] text-stone-500 mt-0.5 block">Direct link to target TripAdvisor or Booking profile.</span>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      Target Reviews
                    </label>
                    <select
                      value={reviewCount}
                      onChange={(e) => setReviewCount(Number(e.target.value))}
                      className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs text-stone-900 focus:border-stone-900 outline-none"
                    >
                      <option value={6}>6 Reviews</option>
                      <option value={8}>8 Reviews</option>
                      <option value={12}>12 Reviews</option>
                      <option value={15}>15 Reviews</option>
                    </select>
                  </div>

                  <div className="flex-1">
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      Min Rating
                    </label>
                    <select
                      value={minRating}
                      onChange={(e) => setMinRating(Number(e.target.value))}
                      className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs text-stone-900 focus:border-stone-900 outline-none"
                    >
                      <option value={4}>4+ Stars</option>
                      <option value={5}>5 Stars Only</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Launch Search Action */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-stone-500">
                Searching verified reviews across <strong className="text-stone-800">{selectedSources.length} channels</strong>
              </span>

              <button
                type="button"
                onClick={handleScrape}
                disabled={isScraping}
                className="flex items-center gap-2 bg-stone-900 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-stone-800 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer active:scale-98"
              >
                {isScraping ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Searching Channels...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Discover Public Reviews</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Simple, Clean Loading State */}
      {isScraping && (
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-8 sm:p-10 flex flex-col items-center justify-center text-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-stone-700" />
          <h3 className="font-serif font-bold text-stone-900 text-base">
            Searching Travel Channels for {selectedHotel?.name}
          </h3>
          <p className="text-stone-600 text-xs max-w-lg leading-relaxed">
            Querying public travel channels (TripAdvisor, Google Reviews, Booking.com, SafariBookings) for authentic guest feedback.
          </p>
        </div>
      )}

      {/* Discovered Reviews Presentation */}
      {!isScraping && scrapedReviews.length > 0 && activeSubTab === 'discover' && (
        <div className="space-y-4">
          {/* Controls Bar: Batch Selectors, Filters, and Projected Rating */}
          <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-stone-900">
                {scrapedReviews.length} Reviews Found
              </span>
              <span className="text-stone-300">|</span>
              <span className="font-semibold text-stone-800 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200">
                {selectedReviews.size} selected
              </span>

              {projectedStats.count > 0 && (
                <span className="text-[11px] text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md flex items-center gap-1 font-mono font-bold">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <span>Projected Rating: {projectedStats.average}★ ({projectedStats.count} total)</span>
                </span>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs font-medium px-2.5 py-1 rounded-lg bg-stone-100 text-stone-800 hover:bg-stone-200 transition"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleSelectFiveStarOnly}
                className="text-xs font-medium px-2.5 py-1 rounded-lg bg-stone-100 text-stone-800 border border-stone-200 hover:bg-stone-200 transition flex items-center gap-1"
              >
                <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                <span>5★ Only</span>
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="text-xs font-medium px-2.5 py-1 rounded-lg text-stone-600 hover:text-stone-900 transition"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Review Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredScrapedReviews
              .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
              .map((review, i) => {
                const actualIdx = (currentPage - 1) * itemsPerPage + i;
                const isSelected = selectedReviews.has(actualIdx);
                return (
                  <div 
                    key={actualIdx} 
                    onClick={() => handleToggleReview(actualIdx)}
                    className={`p-4 sm:p-5 rounded-2xl border transition text-left flex flex-col justify-between gap-3 relative cursor-pointer group ${
                      isSelected 
                        ? 'border-stone-900 bg-stone-50/50 ring-1 ring-stone-900 shadow-xs' 
                        : 'border-stone-200 bg-white hover:border-stone-300'
                    }`}
                  >
                    <div className="space-y-2.5">
                      {/* Review Header: Checkbox, Author, Simple Source Badge & Rating */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center border text-xs transition ${
                            isSelected ? 'bg-stone-900 border-stone-900 text-white' : 'border-stone-300 bg-white'
                          }`}>
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-stone-900 text-xs sm:text-sm truncate">
                                {review.author}
                              </span>
                              {review.travellerOrigin && (
                                <span className="text-[10px] text-stone-500 font-medium truncate">
                                  · {review.travellerOrigin}
                                </span>
                              )}
                            </div>
                            {review.travellerType && (
                              <span className="text-[10px] font-medium text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">
                                {review.travellerType}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {getSourceBadge(review.source)}
                          <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-stone-900 text-white font-mono text-xs font-bold">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span>{review.rating}</span>
                          </div>
                        </div>
                      </div>

                      {/* Review Title Headline */}
                      {review.title && (
                        <h4 className="font-serif font-bold text-stone-900 text-xs sm:text-sm leading-snug">
                          "{review.title}"
                        </h4>
                      )}

                      {/* Review Body */}
                      <p className="text-stone-700 text-xs sm:text-sm leading-relaxed font-serif italic">
                        "{review.comment || review.text}"
                      </p>

                      {/* Simple Highlights Chips */}
                      {review.highlights && review.highlights.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {review.highlights.map((h, hi) => (
                            <span 
                              key={hi} 
                              className="text-[10px] font-medium text-stone-600 bg-stone-100 border border-stone-200/80 px-2 py-0.5 rounded"
                            >
                              {h}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Review Footer: Date, Clean Status, Actions */}
                    <div className="flex items-center justify-between text-[11px] text-stone-400 border-t border-stone-100 pt-2 mt-1">
                      <div className="flex items-center gap-1.5 text-stone-500">
                        {review.date && <span>{review.date}</span>}
                        {review.date && review.verified && <span>·</span>}
                        {review.verified && <span className="font-medium text-stone-700">Verified</span>}
                      </div>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                        <button
                          type="button"
                          onClick={(e) => handleStartEditReview(actualIdx, e)}
                          title="Edit review text or author"
                          className="p-1 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-md transition"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleRemoveScrapedReview(actualIdx, e)}
                          title="Discard this review"
                          className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Pagination */}
          {filteredScrapedReviews.length > itemsPerPage && (
            <div className="pt-2">
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(filteredScrapedReviews.length / itemsPerPage)}
                onPageChange={setCurrentPage}
                className="flex items-center justify-center gap-1.5"
              />
            </div>
          )}

          {/* Sticky Attach & Save Dock */}
          <div className="sticky bottom-4 z-30 bg-white/95 backdrop-blur-md border border-stone-200 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs sm:text-sm text-stone-900">
                  {selectedReviews.size} reviews selected to attach to {selectedHotel?.name}
                </span>
                <span className="text-[11px] font-medium text-stone-700 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200">
                  New Rating: {projectedStats.average}★ ({projectedStats.count} total)
                </span>
              </div>
              <p className="text-[11px] text-stone-500">
                Will update property star rating, listing card badges, and guest reviews showcase.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Append vs Replace Selector */}
              <div className="flex items-center bg-stone-100 p-1 rounded-xl text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setSaveMode('append')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    saveMode === 'append' ? 'bg-white text-stone-900 shadow-2xs font-semibold' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Append to Existing
                </button>
                <button
                  type="button"
                  onClick={() => setSaveMode('replace')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    saveMode === 'replace' ? 'bg-white text-stone-900 shadow-2xs font-semibold' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Replace All
                </button>
              </div>

              <button
                type="button"
                onClick={handleSaveReviews}
                disabled={selectedReviews.size === 0 || isSaving}
                className="flex items-center gap-2 bg-stone-900 hover:bg-stone-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md cursor-pointer active:scale-98"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Attaching Reviews...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Attach to Property</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing Reviews Management Sub-Tab */}
      {selectedHotel && activeSubTab === 'existing' && (
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h3 className="font-serif font-bold text-stone-900 text-base">
                Currently Attached Reviews for {selectedHotel.name}
              </h3>
              <p className="text-stone-500 text-xs mt-0.5">
                {existingStats.count} total reviews · Average Rating: {existingStats.rating}★
              </p>
            </div>
            
            <button
              type="button"
              onClick={() => setActiveSubTab('discover')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 text-white rounded-xl text-xs font-medium hover:bg-stone-800 transition shadow-2xs"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Discover More Reviews</span>
            </button>
          </div>

          {existingReviews.length === 0 ? (
            <div className="p-8 text-center bg-stone-50 rounded-xl border border-dashed border-stone-200 space-y-2">
              <h4 className="font-semibold text-stone-800 text-sm">No reviews currently saved</h4>
              <p className="text-stone-500 text-xs max-w-sm mx-auto">
                Use the Review Discovery Engine to scan public web channels and attach authentic traveler reviews to this listing.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {existingReviews.map((review, i) => (
                <div 
                  key={i} 
                  className="p-4 rounded-xl border border-stone-200 bg-stone-50/40 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900 text-xs sm:text-sm">{review.author}</span>
                        {review.source && getSourceBadge(review.source)}
                      </div>
                      <div className="flex items-center gap-1 font-mono text-xs font-bold text-stone-800">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span>{review.rating}</span>
                      </div>
                    </div>

                    <p className="text-stone-700 text-xs italic font-serif leading-relaxed">
                      "{review.text || review.comment}"
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-stone-400 border-t border-stone-200/60 pt-2">
                    <span>{review.date || 'Recent stay'}</span>
                    <button
                      type="button"
                      disabled={isDeletingExisting === String(i)}
                      onClick={() => handleDeleteExistingReview(i)}
                      className="inline-flex items-center gap-1 text-stone-600 hover:text-stone-900 font-medium disabled:opacity-50 transition"
                    >
                      {isDeletingExisting === String(i) ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Review Modal */}
      {editingReviewIndex !== null && editFormData && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <h3 className="font-serif font-bold text-stone-900 text-base">Edit Review Before Attaching</h3>
              <button 
                type="button" 
                onClick={() => setEditingReviewIndex(null)}
                className="text-stone-400 hover:text-stone-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Guest Author</label>
                <input
                  type="text"
                  value={editFormData.author}
                  onChange={(e) => setEditFormData({ ...editFormData, author: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-xs font-medium text-stone-900 outline-none focus:border-stone-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Star Rating (1-5)</label>
                  <select
                    value={editFormData.rating}
                    onChange={(e) => setEditFormData({ ...editFormData, rating: Number(e.target.value) })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-xs font-medium text-stone-900 outline-none focus:border-stone-900"
                  >
                    <option value={5}>5 Stars ★★★★★</option>
                    <option value={4.8}>4.8 Stars</option>
                    <option value={4.5}>4.5 Stars</option>
                    <option value={4}>4 Stars ★★★★☆</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Source Platform</label>
                  <input
                    type="text"
                    value={editFormData.source}
                    onChange={(e) => setEditFormData({ ...editFormData, source: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-xs font-medium text-stone-900 outline-none focus:border-stone-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Headline / Title (Optional)</label>
                <input
                  type="text"
                  value={editFormData.title || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-xs font-medium text-stone-900 outline-none focus:border-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Review Body Text</label>
                <textarea
                  rows={4}
                  value={editFormData.comment || editFormData.text || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, comment: e.target.value, text: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-xs text-stone-900 outline-none focus:border-stone-900 font-serif leading-relaxed"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setEditingReviewIndex(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-stone-600 hover:bg-stone-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditedReview}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-900 text-white hover:bg-stone-800 transition shadow-2xs"
              >
                Update Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
