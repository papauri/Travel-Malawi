import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, Save, Star, Loader2, Check, MapPin, 
  Trash2, Edit3, Sliders, X, Eye, ExternalLink,
  ShieldCheck, Building2, Globe, ListFilter, Filter, MessageSquare, RefreshCw, AlertTriangle
} from 'lucide-react';
import { Hotel, Review } from '../types';
import toast from 'react-hot-toast';
import { collection, getDocs, deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Pagination from './Pagination';
import ConfirmDialog from './ConfirmDialog';
import { parseReviewDateToTimestamp, formatReviewDate } from '../lib/reviewDates';

interface AdminReviewScraperProps {
  hotels: Hotel[];
  onHotelUpdated: (updatedHotel: Hotel) => void;
}

export interface UnifiedPlatformReview {
  id: string;
  reviewType: 'direct' | 'imported';
  hotelId: string;
  hotelName: string;
  hotelLocation?: string;
  hotelImage?: string;
  author: string;
  rating: number;
  title?: string;
  comment: string;
  date: string;
  timestamp: number;
  source: string;
  sourceUrl?: string;
  verified: boolean;
  bookingId?: string;
  guestId?: string;
  originalIndex?: number;
}

interface EditingTarget {
  sourceType: 'all_direct' | 'all_imported' | 'scraped_discover' | 'existing_hotel';
  reviewId?: string;
  hotelId?: string;
  originalIndex?: number;
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

/**
 * Helper to identify if a scraped review matches any review already attached to the property
 */
export function isReviewDuplicate(
  candidate: any,
  existingList?: Array<{ author?: string; comment?: string; text?: string; title?: string }>
): boolean {
  if (!candidate || !Array.isArray(existingList) || existingList.length === 0) return false;
  const cAuthor = (candidate.author || candidate.guestName || '').toLowerCase().trim();
  const cComment = (candidate.comment || candidate.text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cTitle = (candidate.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  return existingList.some(ex => {
    const exAuthor = (ex.author || '').toLowerCase().trim();
    const exComment = (ex.comment || ex.text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const exTitle = (ex.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    // 1. Author and comment prefix overlap
    if (cAuthor && exAuthor && cAuthor === exAuthor) {
      if (cComment && exComment) {
        if (cComment.slice(0, 30) === exComment.slice(0, 30)) return true;
        if (cComment.includes(exComment.slice(0, 40)) || exComment.includes(cComment.slice(0, 40))) return true;
      }
      if (cTitle && exTitle && cTitle === exTitle) return true;
      if (cComment && exComment && Math.abs(cComment.length - exComment.length) < 20) return true;
    }

    // 2. Exact or substantial comment overlap
    if (cComment.length > 25 && exComment.length > 25) {
      if (cComment === exComment) return true;
      if (cComment.slice(0, 50) === exComment.slice(0, 50)) return true;
      if (cComment.includes(exComment.slice(0, 60)) || exComment.includes(cComment.slice(0, 60))) return true;
    }

    return false;
  });
}

export default function AdminReviewScraper({ hotels, onHotelUpdated }: AdminReviewScraperProps) {
  const [selectedHotelId, setSelectedHotelId] = useState<string>('');
  const [hotelSearchQuery, setHotelSearchQuery] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'discover' | 'existing'>('all');

  // Direct Guest-Written Reviews from Platform
  const [directReviews, setDirectReviews] = useState<Review[]>([]);
  const [isLoadingDirectReviews, setIsLoadingDirectReviews] = useState<boolean>(true);

  // All Platform Reviews Filtering & Search State
  const [platformSearchQuery, setPlatformSearchQuery] = useState<string>('');
  const [platformPropertyFilter, setPlatformPropertyFilter] = useState<string>('all');
  const [platformSourceFilter, setPlatformSourceFilter] = useState<string>('all');
  const [platformRatingFilter, setPlatformRatingFilter] = useState<string>('all');
  const [platformSortBy, setPlatformSortBy] = useState<'recent' | 'oldest' | 'highest' | 'critical'>('recent');
  const [platformCurrentPage, setPlatformCurrentPage] = useState<number>(1);
  const platformItemsPerPage = 10;

  // Editing Target State
  const [editingTarget, setEditingTarget] = useState<EditingTarget | null>(null);
  const [reviewToDelete, setReviewToDelete] = useState<UnifiedPlatformReview | null>(null);

  // Fetch direct platform reviews
  const fetchDirectReviews = async () => {
    setIsLoadingDirectReviews(true);
    try {
      const snap = await getDocs(collection(db, 'reviews'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Review));
      setDirectReviews(list);
    } catch (err: any) {
      console.warn('Failed to load direct platform reviews:', err);
    } finally {
      setIsLoadingDirectReviews(false);
    }
  };

  useEffect(() => {
    fetchDirectReviews();
  }, []);

  // Aggregated Platform Reviews (Direct + All Imported from Hotels)
  const allPlatformReviews = useMemo(() => {
    const hotelMap = new Map<string, Hotel>();
    hotels.forEach(h => {
      if (h.id) hotelMap.set(h.id, h);
    });

    // 1. Direct guest-written reviews from Firestore
    const direct: UnifiedPlatformReview[] = directReviews.map(r => {
      const h = hotelMap.get(r.hotelId);
      const ts = r.createdAt || Date.now();
      return {
        id: r.id || `direct-${ts}`,
        reviewType: 'direct',
        hotelId: r.hotelId,
        hotelName: h?.name || 'Property',
        hotelLocation: h?.location || 'Malawi',
        hotelImage: h?.imageUrl,
        author: r.authorName || 'Guest',
        rating: r.rating || 5,
        title: undefined,
        comment: r.text || '',
        date: formatReviewDate(ts),
        timestamp: ts,
        source: 'Travel-Malawi',
        sourceUrl: undefined,
        verified: true,
        bookingId: r.bookingId,
        guestId: r.guestId,
      };
    });

    // 2. Imported reviews from all hotels
    const imported: UnifiedPlatformReview[] = [];
    hotels.forEach(h => {
      const revs = Array.isArray(h.reviews) ? h.reviews : [];
      revs.forEach((r, idx) => {
        const rawDate = r.date || (r as any).createdAt || (r as any).scrapedAt || null;
        const ts = parseReviewDateToTimestamp(rawDate, (r as any).createdAt || 0);
        const comment = (r.comment || r.text || '').trim();
        imported.push({
          id: r.id || `imported-${h.id}-${idx}`,
          reviewType: 'imported',
          hotelId: h.id!,
          hotelName: h.name,
          hotelLocation: h.location || 'Malawi',
          hotelImage: h.imageUrl,
          author: r.author || 'Guest',
          rating: typeof r.rating === 'number' ? r.rating : 5,
          title: r.title || undefined,
          comment,
          date: formatReviewDate(rawDate || ts),
          timestamp: ts,
          source: r.source || 'TripAdvisor',
          sourceUrl: r.sourceUrl || undefined,
          verified: r.verified ?? false,
          originalIndex: idx,
        });
      });
    });

    return [...direct, ...imported];
  }, [directReviews, hotels]);

  // Overall Platform Statistics
  const platformStats = useMemo(() => {
    const total = allPlatformReviews.length;
    const directCount = directReviews.length;
    const importedCount = total - directCount;
    const ratings = allPlatformReviews.map(r => r.rating).filter(r => typeof r === 'number' && r > 0);
    const avg = ratings.length > 0 ? (ratings.reduce((sum, r) => sum + r, 0) / ratings.length) : 0;
    const criticalCount = allPlatformReviews.filter(r => r.rating <= 3.0).length;

    return {
      total,
      directCount,
      importedCount,
      averageRating: Math.round(avg * 10) / 10,
      criticalCount,
    };
  }, [allPlatformReviews, directReviews.length]);

  // Filtered & Sorted Platform Reviews
  const filteredPlatformReviews = useMemo(() => {
    let list = [...allPlatformReviews];

    if (platformSearchQuery.trim()) {
      const q = platformSearchQuery.toLowerCase().trim();
      list = list.filter(r => 
        r.author.toLowerCase().includes(q) ||
        r.hotelName.toLowerCase().includes(q) ||
        r.comment.toLowerCase().includes(q) ||
        (r.title && r.title.toLowerCase().includes(q)) ||
        (r.hotelLocation && r.hotelLocation.toLowerCase().includes(q))
      );
    }

    if (platformPropertyFilter !== 'all') {
      list = list.filter(r => r.hotelId === platformPropertyFilter);
    }

    if (platformSourceFilter !== 'all') {
      if (platformSourceFilter === 'direct') {
        list = list.filter(r => r.reviewType === 'direct');
      } else if (platformSourceFilter.toLowerCase().includes('guest') || platformSourceFilter.toLowerCase().includes('facebook') || platformSourceFilter.toLowerCase().includes('social')) {
        list = list.filter(r => {
          const s = (r.source || '').toLowerCase();
          return s.includes('guest') || s.includes('facebook') || s.includes('social');
        });
      } else {
        list = list.filter(r => (r.source || '').toLowerCase().includes(platformSourceFilter.toLowerCase()));
      }
    }

    if (platformRatingFilter !== 'all') {
      if (platformRatingFilter === '5') {
        list = list.filter(r => r.rating >= 4.8);
      } else if (platformRatingFilter === '4') {
        list = list.filter(r => r.rating >= 3.8 && r.rating < 4.8);
      } else if (platformRatingFilter === '3') {
        list = list.filter(r => r.rating >= 2.8 && r.rating < 3.8);
      } else if (platformRatingFilter === 'critical') {
        list = list.filter(r => r.rating < 3.0);
      }
    }

    // Sort order (most recent first by default)
    list.sort((a, b) => {
      if (platformSortBy === 'highest') {
        if (b.rating !== a.rating) return b.rating - a.rating;
        return (b.timestamp || 0) - (a.timestamp || 0);
      }
      if (platformSortBy === 'critical') {
        if (a.rating !== b.rating) return a.rating - b.rating;
        return (b.timestamp || 0) - (a.timestamp || 0);
      }
      if (platformSortBy === 'oldest') {
        return (a.timestamp || 0) - (b.timestamp || 0);
      }
      // 'recent' (default): most recent first
      if ((b.timestamp || 0) !== (a.timestamp || 0)) {
        return (b.timestamp || 0) - (a.timestamp || 0);
      }
      if (a.verified !== b.verified) return a.verified ? -1 : 1;
      return b.rating - a.rating;
    });

    return list;
  }, [allPlatformReviews, platformSearchQuery, platformPropertyFilter, platformSourceFilter, platformRatingFilter, platformSortBy]);

  // Discovery settings
  const [customQuery, setCustomQuery] = useState<string>('');
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [selectedSources, setSelectedSources] = useState<string[]>([
    'TripAdvisor', 'Google Reviews', 'Booking.com', 'SafariBookings'
  ]);
  const [sentimentMode, setSentimentMode] = useState<'balanced' | 'critical' | 'positive' | 'all'>('balanced');
  const [minRating, setMinRating] = useState<number>(1);
  const [reviewCount, setReviewCount] = useState<number>(4);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState<boolean>(false);

  // Discovery State
  const [isScraping, setIsScraping] = useState<boolean>(false);
  const [scrapedReviews, setScrapedReviews] = useState<ScrapedReviewItem[]>([]);
  const [selectedReviews, setSelectedReviews] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMode, setSaveMode] = useState<'append' | 'replace'>('append');
  const [duplicateFilteredCount, setDuplicateFilteredCount] = useState<number>(0);

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
    setDuplicateFilteredCount(0);

    // Prepare combined list of reviews already attached to this hotel (imported + direct)
    const propertyExistingReviews = [
      ...existingReviews,
      ...directReviews.filter(r => r.hotelId === selectedHotel.id)
    ].map(r => ({
      author: (r as any).author || (r as any).authorName || (r as any).guestName,
      comment: (r as any).comment || (r as any).text,
      title: (r as any).title,
    }));
    
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
          sentimentMode,
          minRating,
          count: reviewCount,
          existingReviews: propertyExistingReviews,
        })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to scrape reviews');
      }
      
      let reviewsList: any[] | null = null;
      if (Array.isArray(data.data) && data.data.length > 0) {
        reviewsList = data.data;
      } else if (Array.isArray(data.reviews) && data.reviews.length > 0) {
        reviewsList = data.reviews;
      } else if (typeof data.text === 'string') {
        try {
          const match = data.text.match(/\[[\s\S]*\]/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (Array.isArray(parsed) && parsed.length > 0) {
              reviewsList = parsed;
            }
          }
        } catch { /* non-critical client recovery */ }
      }

      if (reviewsList && reviewsList.length > 0) {
        // Exclude reviews that have already been attached to the property
        const freshReviews = reviewsList.filter(r => !isReviewDuplicate(r, propertyExistingReviews));
        const dupesCount = reviewsList.length - freshReviews.length;
        setDuplicateFilteredCount(dupesCount);

        if (freshReviews.length > 0) {
          setScrapedReviews(freshReviews);
          setSelectedReviews(new Set(freshReviews.map((_, i) => i)));
          if (dupesCount > 0) {
            toast.success(`Discovered ${freshReviews.length} new reviews (${dupesCount} duplicate${dupesCount > 1 ? 's' : ''} already attached were excluded).`);
          } else {
            toast.success(`Discovered ${freshReviews.length} authentic guest reviews across web channels!`);
          }
        } else {
          setScrapedReviews([]);
          toast(
            `All ${dupesCount} discovered reviews are already attached to ${selectedHotel.name}. Your listing already has all available public reviews!`,
            { icon: 'ℹ️' }
          );
        }
      } else {
        throw new Error('Unable to parse review data format. Please retry discovery.');
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
        const sf = sourceFilter.toLowerCase();
        if (sf.includes('guest') || sf.includes('facebook') || sf.includes('social')) {
          if (!revSrc.includes('guest') && !revSrc.includes('facebook') && !revSrc.includes('social')) return false;
        } else if (!revSrc.includes(sf)) {
          return false;
        }
      }
      if (ratingFilter === '5' && review.rating < 4.8) return false;
      if (ratingFilter === '4' && (review.rating < 3.8 || review.rating >= 4.8)) return false;
      if (ratingFilter === 'critical' && review.rating > 3.8) return false;
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

  // Open Edit Review Modal for Discovered Scraped Review
  const handleStartEditReview = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTarget({
      sourceType: 'scraped_discover',
      originalIndex: idx,
    });
    setEditingReviewIndex(idx);
    setEditFormData({ ...scrapedReviews[idx] });
  };

  // Open Edit Review Modal for Unified Platform Review
  const handleStartEditPlatformReview = (review: UnifiedPlatformReview, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTarget({
      sourceType: review.reviewType === 'direct' ? 'all_direct' : 'all_imported',
      reviewId: review.id,
      hotelId: review.hotelId,
      originalIndex: review.originalIndex,
    });
    setEditingReviewIndex(0);
    setEditFormData({
      id: review.id,
      author: review.author,
      rating: review.rating,
      title: review.title || '',
      comment: review.comment,
      text: review.comment,
      source: review.source,
      sourceUrl: review.sourceUrl || '',
      date: review.date,
    });
  };

  // Open Edit Review Modal for Existing Review on Selected Property
  const handleStartEditExistingReview = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedHotel) return;
    setEditingTarget({
      sourceType: 'existing_hotel',
      hotelId: selectedHotel.id,
      originalIndex: idx,
    });
    setEditingReviewIndex(idx);
    const rev = existingReviews[idx];
    setEditFormData({
      id: rev.id,
      author: rev.author || 'Guest',
      rating: typeof rev.rating === 'number' ? rev.rating : 5,
      title: rev.title || '',
      comment: rev.comment || rev.text || '',
      text: rev.comment || rev.text || '',
      source: rev.source || 'TripAdvisor',
      sourceUrl: rev.sourceUrl || '',
      date: rev.date || 'Recent stay',
    });
  };

  // Save Inline Edit (Dispatched according to editing target)
  const handleSaveEditedReview = async () => {
    if (!editFormData) return;

    try {
      if (editingTarget?.sourceType === 'all_direct' && editingTarget.reviewId) {
        const revRef = doc(db, 'reviews', editingTarget.reviewId);
        await updateDoc(revRef, {
          authorName: editFormData.author,
          rating: editFormData.rating,
          text: editFormData.comment || editFormData.text || '',
        });
        setDirectReviews(prev => prev.map(r => r.id === editingTarget.reviewId ? {
          ...r,
          authorName: editFormData.author,
          rating: editFormData.rating,
          text: editFormData.comment || editFormData.text || '',
        } : r));
        toast.success('Direct guest review updated.');
      } else if (editingTarget?.sourceType === 'all_imported' && editingTarget.hotelId) {
        const targetHotel = hotels.find(h => h.id === editingTarget.hotelId);
        if (targetHotel && targetHotel.id) {
          const hotelRef = doc(db, 'hotels', targetHotel.id);
          const currentReviews = Array.isArray(targetHotel.reviews) ? [...targetHotel.reviews] : [];
          if (editingTarget.originalIndex != null && currentReviews[editingTarget.originalIndex]) {
            currentReviews[editingTarget.originalIndex] = {
              ...currentReviews[editingTarget.originalIndex],
              author: editFormData.author,
              rating: editFormData.rating,
              title: editFormData.title || '',
              comment: editFormData.comment || editFormData.text || '',
              text: editFormData.comment || editFormData.text || '',
              source: editFormData.source || 'TripAdvisor',
              sourceUrl: editFormData.sourceUrl || '',
              date: editFormData.date || 'Recent stay',
            };
            const totalCount = currentReviews.length;
            const totalScore = currentReviews.reduce((sum: number, r: any) => sum + (r.rating || 5), 0);
            const newAvg = totalCount > 0 ? Math.round((totalScore / totalCount) * 10) / 10 : 5;
            const updatedSummary = {
              count: totalCount,
              averageRating: newAvg,
              recentReviews: currentReviews.slice(0, 20),
            };
            await updateDoc(hotelRef, {
              reviews: currentReviews,
              reviewsSummary: updatedSummary,
            });
            onHotelUpdated({
              ...targetHotel,
              reviews: currentReviews,
              reviewsSummary: updatedSummary,
            });
            toast.success('Imported review updated on property.');
          }
        }
      } else if (editingTarget?.sourceType === 'existing_hotel' && selectedHotel && selectedHotel.id) {
        const hotelRef = doc(db, 'hotels', selectedHotel.id);
        const currentReviews = Array.isArray(selectedHotel.reviews) ? [...selectedHotel.reviews] : [];
        if (editingTarget.originalIndex != null && currentReviews[editingTarget.originalIndex]) {
          currentReviews[editingTarget.originalIndex] = {
            ...currentReviews[editingTarget.originalIndex],
            author: editFormData.author,
            rating: editFormData.rating,
            title: editFormData.title || '',
            comment: editFormData.comment || editFormData.text || '',
            text: editFormData.comment || editFormData.text || '',
            source: editFormData.source || 'TripAdvisor',
            sourceUrl: editFormData.sourceUrl || '',
            date: editFormData.date || 'Recent stay',
          };
          const totalCount = currentReviews.length;
          const totalScore = currentReviews.reduce((sum: number, r: any) => sum + (r.rating || 5), 0);
          const newAvg = totalCount > 0 ? Math.round((totalScore / totalCount) * 10) / 10 : 5;
          const updatedSummary = {
            count: totalCount,
            averageRating: newAvg,
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
          toast.success('Property review updated.');
        }
      } else if (editingReviewIndex !== null) {
        // Newly scraped review in discovery queue
        const updated = [...scrapedReviews];
        updated[editingReviewIndex] = { ...editFormData };
        setScrapedReviews(updated);
        toast.success('Review updated in discovery list.');
      }
      setEditingReviewIndex(null);
      setEditFormData(null);
      setEditingTarget(null);
    } catch (err: any) {
      console.error('Error saving edited review:', err);
      toast.error(err.message || 'Failed to update review');
    }
  };

  // Delete Platform Review from Database
  const handleDeletePlatformReview = (review: UnifiedPlatformReview) => {
    setReviewToDelete(review);
  };

  const confirmDeletePlatformReview = async () => {
    if (!reviewToDelete) return;
    const review = reviewToDelete;
    setIsDeletingExisting(review.id);
    try {
      if (review.reviewType === 'direct') {
        await deleteDoc(doc(db, 'reviews', review.id));
        setDirectReviews(prev => prev.filter(r => r.id !== review.id));
        toast.success('Direct guest review deleted.');
      } else {
        const targetHotel = hotels.find(h => h.id === review.hotelId);
        if (targetHotel && targetHotel.id) {
          const hotelRef = doc(db, 'hotels', targetHotel.id);
          const currentReviews = Array.isArray(targetHotel.reviews) ? [...targetHotel.reviews] : [];
          const filtered = currentReviews.filter((_, idx) => idx !== review.originalIndex);
          const totalCount = filtered.length;
          const totalScore = filtered.reduce((sum: number, r: any) => sum + (r.rating || 5), 0);
          const newAvg = totalCount > 0 ? Math.round((totalScore / totalCount) * 10) / 10 : 0;
          const updatedSummary = {
            count: totalCount,
            averageRating: newAvg,
            recentReviews: filtered.slice(0, 20),
          };
          await updateDoc(hotelRef, {
            reviews: filtered,
            reviewsSummary: updatedSummary,
          });
          onHotelUpdated({
            ...targetHotel,
            reviews: filtered,
            reviewsSummary: updatedSummary,
          });
          toast.success('Imported review removed from property.');
        }
      }
    } catch (err: any) {
      console.error('Delete platform review error:', err);
      toast.error(err.message || 'Failed to delete review');
    } finally {
      setIsDeletingExisting(null);
      setReviewToDelete(null);
    }
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

        <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200 shrink-0 flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setActiveSubTab('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              activeSubTab === 'all'
                ? 'bg-white text-stone-900 shadow-xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            <span>All Platform Reviews ({allPlatformReviews.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('discover')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              activeSubTab === 'discover'
                ? 'bg-white text-stone-900 shadow-xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Discover Web Reviews</span>
          </button>
          {selectedHotel && (
            <button
              type="button"
              onClick={() => setActiveSubTab('existing')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeSubTab === 'existing'
                  ? 'bg-white text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{selectedHotel.name} ({existingStats.count})</span>
            </button>
          )}
        </div>
      </div>

      {/* ==================== SUB-TAB: ALL PLATFORM REVIEWS ==================== */}
      {activeSubTab === 'all' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs">
              <div className="flex items-center justify-between text-stone-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Total Reviews</span>
                <MessageSquare className="w-4 h-4 text-stone-600" />
              </div>
              <div className="text-xl sm:text-2xl font-serif font-bold text-stone-900">
                {platformStats.total}
              </div>
              <p className="text-[10px] text-stone-500 mt-0.5">Across all Malawi stays</p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs">
              <div className="flex items-center justify-between text-stone-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Direct Guests</span>
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
              </div>
              <div className="text-xl sm:text-2xl font-serif font-bold text-emerald-800">
                {platformStats.directCount}
              </div>
              <p className="text-[10px] text-stone-500 mt-0.5">Verified completed stays</p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs">
              <div className="flex items-center justify-between text-stone-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-600">Imported</span>
                <Globe className="w-4 h-4 text-stone-500" />
              </div>
              <div className="text-xl sm:text-2xl font-serif font-bold text-stone-900">
                {platformStats.importedCount}
              </div>
              <p className="text-[10px] text-stone-500 mt-0.5">TripAdvisor &amp; Google</p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs">
              <div className="flex items-center justify-between text-stone-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Avg Rating</span>
                <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
              </div>
              <div className="text-xl sm:text-2xl font-serif font-bold text-stone-900 flex items-baseline gap-1">
                <span>{platformStats.averageRating > 0 ? platformStats.averageRating.toFixed(1) : '—'}</span>
                <span className="text-xs text-amber-500 font-sans">★</span>
              </div>
              <p className="text-[10px] text-stone-500 mt-0.5">Global platform score</p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-stone-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Constructive</span>
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-xl sm:text-2xl font-serif font-bold text-rose-800">
                {platformStats.criticalCount}
              </div>
              <p className="text-[10px] text-stone-500 mt-0.5">1–3★ critiques &amp; feedback</p>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              {/* Search */}
              <div className="lg:col-span-2 relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-stone-400" />
                <input
                  type="text"
                  value={platformSearchQuery}
                  onChange={(e) => {
                    setPlatformSearchQuery(e.target.value);
                    setPlatformCurrentPage(1);
                  }}
                  placeholder="Search guest, lodge name, comments..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg pl-8 pr-7 py-1.5 text-xs text-stone-900 focus:bg-white focus:border-stone-900 outline-none transition"
                />
                {platformSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setPlatformSearchQuery('');
                      setPlatformCurrentPage(1);
                    }}
                    className="absolute right-2 top-2 text-stone-400 hover:text-stone-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Property Filter */}
              <div>
                <select
                  value={platformPropertyFilter}
                  onChange={(e) => {
                    setPlatformPropertyFilter(e.target.value);
                    setPlatformCurrentPage(1);
                  }}
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-900 outline-none focus:bg-white focus:border-stone-900 transition truncate"
                >
                  <option value="all">All Properties ({hotels.length})</option>
                  {hotels.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.name} {h.location ? `(${h.location})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Source Filter */}
              <div>
                <select
                  value={platformSourceFilter}
                  onChange={(e) => {
                    setPlatformSourceFilter(e.target.value);
                    setPlatformCurrentPage(1);
                  }}
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-900 outline-none focus:bg-white focus:border-stone-900 transition"
                >
                  <option value="all">All Channels</option>
                  <option value="direct">Direct Stays (Travel-Malawi)</option>
                  <option value="tripadvisor">TripAdvisor</option>
                  <option value="google">Google Reviews</option>
                  <option value="booking">Booking.com</option>
                  <option value="safaribookings">SafariBookings</option>
                </select>
              </div>

              {/* Rating Filter & Sort */}
              <div className="flex gap-2">
                <select
                  value={platformRatingFilter}
                  onChange={(e) => {
                    setPlatformRatingFilter(e.target.value);
                    setPlatformCurrentPage(1);
                  }}
                  className="w-1/2 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5 text-xs font-medium text-stone-900 outline-none focus:bg-white focus:border-stone-900 transition"
                >
                  <option value="all">All Stars</option>
                  <option value="5">5 Stars</option>
                  <option value="4">4 Stars</option>
                  <option value="3">3 Stars</option>
                  <option value="critical">1-3 Stars (Critique)</option>
                </select>

                <select
                  value={platformSortBy}
                  onChange={(e) => {
                    setPlatformSortBy(e.target.value as any);
                    setPlatformCurrentPage(1);
                  }}
                  className="w-1/2 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5 text-xs font-medium text-stone-900 outline-none focus:bg-white focus:border-stone-900 transition"
                >
                  <option value="recent">Most Recent</option>
                  <option value="highest">Highest</option>
                  <option value="critical">Critical</option>
                  <option value="oldest">Oldest</option>
                </select>
              </div>
            </div>

            {/* Quick status bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 text-[11px] text-stone-500">
              <div className="flex items-center gap-1.5">
                <span>Showing <strong>{filteredPlatformReviews.length}</strong> of {allPlatformReviews.length} reviews</span>
                {(platformSearchQuery || platformPropertyFilter !== 'all' || platformSourceFilter !== 'all' || platformRatingFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setPlatformSearchQuery('');
                      setPlatformPropertyFilter('all');
                      setPlatformSourceFilter('all');
                      setPlatformRatingFilter('all');
                      setPlatformSortBy('recent');
                      setPlatformCurrentPage(1);
                    }}
                    className="ml-2 text-stone-700 hover:text-stone-900 underline font-medium cursor-pointer"
                  >
                    Reset filters
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={fetchDirectReviews}
                className="inline-flex items-center gap-1 text-stone-600 hover:text-stone-900 font-medium transition cursor-pointer"
                title="Refresh direct reviews from database"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingDirectReviews ? 'animate-spin' : ''}`} />
                <span>Sync reviews</span>
              </button>
            </div>
          </div>

          {/* Platform Reviews Grid */}
          {filteredPlatformReviews.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-dashed border-stone-300 text-center space-y-2">
              <p className="font-serif font-bold text-stone-800 text-base">No reviews matched your filters</p>
              <p className="text-stone-500 text-xs max-w-sm mx-auto">
                Try clearing your search terms or expanding your rating and channel filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredPlatformReviews
                .slice((platformCurrentPage - 1) * platformItemsPerPage, platformCurrentPage * platformItemsPerPage)
                .map((review) => (
                  <div
                    key={review.id}
                    className="bg-white p-4 rounded-xl border border-stone-200/90 shadow-2xs hover:border-stone-300 transition-all flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      {/* Top Header: Author, Rating, Date */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center text-stone-700 font-serif font-bold text-xs shrink-0 border border-stone-200/60">
                            {review.author.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-stone-900 text-xs sm:text-sm truncate leading-snug">
                              {review.author}
                            </p>
                            <p className="text-[10px] text-stone-500 leading-none mt-0.5">
                              {review.date}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-bold ${
                            review.rating >= 4
                              ? 'bg-stone-50 border-stone-200/80 text-stone-900'
                              : review.rating >= 3
                              ? 'bg-amber-50/90 border-amber-200 text-amber-900'
                              : 'bg-rose-50 border-rose-200 text-rose-900'
                          }`}>
                            <Star className={`h-3 w-3 fill-current ${
                              review.rating >= 4 ? 'text-amber-400' : review.rating >= 3 ? 'text-amber-500' : 'text-rose-500'
                            }`} />
                            <span>{review.rating.toFixed(1)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Property Badge with Live Listing Link */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <a
                          href={`/hotel/${review.hotelId}`}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 px-2 py-0.5 rounded border border-stone-200/80 transition hover:underline"
                          title="Open live listing in new tab"
                        >
                          <Building2 className="w-3 h-3 text-stone-500 shrink-0" />
                          <span className="truncate max-w-[200px]">{review.hotelName}</span>
                          <ExternalLink className="w-2.5 h-2.5 text-stone-400" />
                        </a>

                        {review.verified ? (
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded uppercase tracking-wider flex items-center gap-1">
                            <ShieldCheck className="w-2.5 h-2.5" /> Verified Stay
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-stone-600 bg-stone-100 border border-stone-200 px-1.5 py-0.2 rounded">
                            {review.source}
                          </span>
                        )}

                        {review.rating <= 2.5 && (
                          <span className="text-[9px] font-bold text-rose-800 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded uppercase tracking-wider">
                            Critique
                          </span>
                        )}
                      </div>

                      {/* Title Headline (if any) */}
                      {review.title && (
                        <h4 className="font-serif font-bold text-stone-900 text-xs sm:text-sm leading-snug">
                          "{review.title}"
                        </h4>
                      )}

                      {/* Body Text */}
                      <p className="text-stone-700 text-xs sm:text-sm leading-relaxed italic font-serif">
                        "{review.comment}"
                      </p>
                    </div>

                    {/* Footer: External Verification Link & Moderation Actions */}
                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] gap-2 flex-wrap">
                      <div>
                        {review.sourceUrl ? (
                          <a
                            href={review.sourceUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold transition hover:underline text-[10px]"
                            title={`Verify original review on ${review.source}`}
                          >
                            <span>Verify on {review.source}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : (
                          <span className="text-stone-400 text-[10px]">Direct Malawian booking</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => handleStartEditPlatformReview(review, e)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-stone-600 hover:text-stone-900 hover:bg-stone-100 text-xs font-medium transition cursor-pointer"
                          title="Edit review text or rating"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          disabled={isDeletingExisting === review.id}
                          onClick={() => handleDeletePlatformReview(review)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-rose-600 hover:text-rose-800 hover:bg-rose-50 text-xs font-medium transition cursor-pointer disabled:opacity-50"
                          title="Permanently remove review"
                        >
                          {isDeletingExisting === review.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Pagination */}
          {filteredPlatformReviews.length > platformItemsPerPage && (
            <div className="pt-2 flex justify-center">
              <Pagination
                currentPage={platformCurrentPage}
                totalPages={Math.ceil(filteredPlatformReviews.length / platformItemsPerPage)}
                onPageChange={setPlatformCurrentPage}
              />
            </div>
          )}
        </div>
      )}

      {/* Property Selector Card (Visible when in Discover or Existing mode) */}
      {activeSubTab !== 'all' && (
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
                  setDuplicateFilteredCount(0);
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
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-stone-800 bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span>{existingStats.rating > 0 ? existingStats.rating : 'New'}</span>
                  </span>
                  <span className="text-[10px] text-stone-500 font-medium">
                    {existingStats.count} existing reviews
                  </span>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedHotel.name} ${selectedHotel.location || 'Malawi'}`)}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-stone-700 hover:text-stone-900 bg-white hover:bg-stone-100 px-2 py-0.5 rounded border border-stone-200/90 shadow-2xs transition"
                    title="Cross-reference live Google Maps listing, community reviews & photos"
                  >
                    <MapPin className="w-2.5 h-2.5 text-stone-400" />
                    <span>Google Maps</span>
                    <ExternalLink className="w-2.5 h-2.5 text-stone-400" />
                  </a>
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="flex-1">
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      Scraping Tone &amp; Transparency
                    </label>
                    <select
                      value={sentimentMode}
                      onChange={(e) => {
                        const m = e.target.value as any;
                        setSentimentMode(m);
                        if (m === 'critical') setMinRating(1);
                        else if (m === 'positive') setMinRating(4);
                        else setMinRating(1);
                      }}
                      className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs text-stone-900 focus:border-stone-900 outline-none"
                    >
                      <option value="balanced">Balanced &amp; Transparent (Mix of 4-5★ &amp; 2-3★)</option>
                      <option value="critical">Critical / Negative Only (1-3★ authentic issues)</option>
                      <option value="positive">Positive Highlights Only (4-5★)</option>
                      <option value="all">All Ratings (1-5★ Unfiltered)</option>
                    </select>
                  </div>

                  <div className="flex-1">
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      Target Reviews
                    </label>
                    <select
                      value={reviewCount}
                      onChange={(e) => setReviewCount(Number(e.target.value))}
                      className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs text-stone-900 focus:border-stone-900 outline-none"
                    >
                      <option value={4}>4 Reviews (Ultra-Lean ~300 tokens)</option>
                      <option value={6}>6 Reviews (~450 tokens)</option>
                    </select>
                  </div>

                  <div className="flex-1">
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      Min Rating Threshold
                    </label>
                    <select
                      value={minRating}
                      onChange={(e) => setMinRating(Number(e.target.value))}
                      className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs text-stone-900 focus:border-stone-900 outline-none"
                    >
                      <option value={1}>1+ Star (Full Transparency)</option>
                      <option value={2}>2+ Stars</option>
                      <option value={3}>3+ Stars</option>
                      <option value={4}>4+ Stars</option>
                      <option value={5}>5 Stars Only</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Launch Search Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-stone-500">
                  Searching verified reviews across <strong className="text-stone-800">{selectedSources.length} channels</strong>
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                  Ultra-Lean Token Mode (&lt;400 tokens)
                </span>
              </div>

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
      )}

      {/* Simple, Clean Loading State */}
      {isScraping && (
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-8 sm:p-10 flex flex-col items-center justify-center text-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-stone-700" />
          <h3 className="font-serif font-bold text-stone-900 text-base">
            Searching Travel Channels for {selectedHotel?.name}
          </h3>
          <p className="text-stone-600 text-xs max-w-lg leading-relaxed">
            Querying public travel channels (TripAdvisor, Google Reviews, Booking.com, SafariBookings, and Guest Book &amp; Social) for authentic guest feedback.
          </p>
        </div>
      )}

      {/* Informational banner when all discovered reviews were already attached */}
      {!isScraping && scrapedReviews.length === 0 && duplicateFilteredCount > 0 && activeSubTab === 'discover' && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-6 text-center space-y-2">
          <div className="inline-flex p-2.5 bg-amber-100 text-amber-800 rounded-full mb-1">
            <ShieldCheck className="w-5 h-5 text-amber-700" />
          </div>
          <h4 className="font-serif font-bold text-stone-900 text-sm">
            All Discovered Reviews Are Already Attached
          </h4>
          <p className="text-stone-600 text-xs max-w-md mx-auto leading-relaxed">
            {duplicateFilteredCount} public review{duplicateFilteredCount > 1 ? 's were' : ' was'} discovered across web channels, but {duplicateFilteredCount > 1 ? 'they have already been' : 'it has already been'} scraped and attached to <strong>{selectedHotel?.name}</strong>. No duplicate reviews were added.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setActiveSubTab('existing')}
              className="text-xs font-semibold text-stone-900 underline hover:text-stone-700 cursor-pointer"
            >
              View Currently Attached Reviews ({existingStats.count}) →
            </button>
          </div>
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

              {duplicateFilteredCount > 0 && (
                <span className="text-[11px] text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200 flex items-center gap-1 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  <span>{duplicateFilteredCount} duplicate{duplicateFilteredCount > 1 ? 's' : ''} hidden</span>
                </span>
              )}

              {projectedStats.count > 0 && (
                <span className="text-[11px] text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md flex items-center gap-1 font-mono font-bold">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <span>Projected Rating: {projectedStats.average}★ ({projectedStats.count} total)</span>
                </span>
              )}
            </div>

            {/* Quick Actions & Rating Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 mr-1">
                <span className="text-[11px] text-stone-500 font-medium">Filter:</span>
                <select
                  value={ratingFilter}
                  onChange={(e) => setRatingFilter(e.target.value)}
                  className="bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-xs text-stone-800 outline-none"
                >
                  <option value="all">All Stars ({scrapedReviews.length})</option>
                  <option value="5">5★ Only</option>
                  <option value="4">4★ Range</option>
                  <option value="critical">1–3★ Critical/Constructive</option>
                </select>
              </div>
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
                          <div className={`flex items-center gap-0.5 px-2 py-0.5 rounded-md font-mono text-xs font-bold ${
                            review.rating >= 4 
                              ? 'bg-stone-900 text-white' 
                              : review.rating >= 3 
                              ? 'bg-amber-700 text-white' 
                              : 'bg-rose-700 text-white'
                          }`}>
                            <Star className={`w-3 h-3 ${review.rating >= 4 ? 'fill-amber-400 text-amber-400' : 'fill-white text-white'}`} />
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

                    {/* Review Footer: Date, Clean Status, Direct Link, Actions */}
                    <div className="flex items-center justify-between text-[11px] text-stone-400 border-t border-stone-100 pt-2 mt-1">
                      <div className="flex items-center gap-2 text-stone-500 flex-wrap">
                        {review.date && <span className="font-medium text-stone-700">{review.date}</span>}
                        {review.rating <= 2.5 && (
                          <span className="text-[10px] font-bold text-rose-800 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded">
                            Critical Feedback
                          </span>
                        )}
                        {review.rating > 2.5 && review.rating <= 3.8 && (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                            Constructive
                          </span>
                        )}
                        {review.sourceUrl && (
                          <a
                            href={review.sourceUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold transition hover:underline"
                            title="Verify original review on source site"
                          >
                            <span>Direct Link</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
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
                      <div className={`flex items-center gap-1 font-mono text-xs font-bold px-2 py-0.5 rounded-md ${
                        review.rating >= 4 
                          ? 'bg-stone-900 text-white' 
                          : review.rating >= 3 
                          ? 'bg-amber-700 text-white' 
                          : 'bg-rose-700 text-white'
                      }`}>
                        <Star className={`w-3.5 h-3.5 ${review.rating >= 4 ? 'fill-amber-400 text-amber-400' : 'fill-white text-white'}`} />
                        <span>{review.rating}</span>
                      </div>
                    </div>

                    <p className="text-stone-700 text-xs italic font-serif leading-relaxed">
                      "{review.text || review.comment}"
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-stone-500 border-t border-stone-200/60 pt-2 flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-stone-700">{review.date || 'Recent stay'}</span>
                      {review.sourceUrl && (
                        <a
                          href={review.sourceUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold transition hover:underline"
                          title="Open original review source"
                        >
                          <span>Direct Link</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => handleStartEditExistingReview(i, e)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-stone-600 hover:text-stone-900 hover:bg-stone-100 text-xs font-medium transition cursor-pointer"
                        title="Edit review"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        disabled={isDeletingExisting === String(i)}
                        onClick={() => handleDeleteExistingReview(i)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-rose-600 hover:text-rose-800 hover:bg-rose-50 text-xs font-medium disabled:opacity-50 transition cursor-pointer"
                        title="Remove review"
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
                    <option value={3.5}>3.5 Stars</option>
                    <option value={3}>3 Stars ★★★☆☆ (Constructive)</option>
                    <option value={2.5}>2.5 Stars</option>
                    <option value={2}>2 Stars ★★☆☆☆ (Critical)</option>
                    <option value={1}>1 Star ★☆☆☆☆ (Negative)</option>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Stay / Review Date</label>
                  <input
                    type="text"
                    value={editFormData.date || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                    placeholder="e.g. October 2024"
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-xs font-medium text-stone-900 outline-none focus:border-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Direct Review Link (URL)</label>
                  <input
                    type="url"
                    value={editFormData.sourceUrl || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, sourceUrl: e.target.value })}
                    placeholder="https://www.tripadvisor.com/..."
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
                onClick={() => {
                  setEditingReviewIndex(null);
                  setEditFormData(null);
                  setEditingTarget(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-medium text-stone-600 hover:bg-stone-100 transition cursor-pointer"
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

      <ConfirmDialog
        isOpen={!!reviewToDelete}
        title="Delete Review"
        message={`Are you sure you want to permanently delete the review by "${reviewToDelete?.author}" for "${reviewToDelete?.hotelName}"? This action cannot be undone.`}
        confirmText="Yes, delete review"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={confirmDeletePlatformReview}
        onCancel={() => setReviewToDelete(null)}
      />
    </div>
  );
}
