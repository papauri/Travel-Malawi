import React from 'react';
import { Hotel } from '../types';
import { Link } from 'react-router-dom';
import { Star, MapPin } from 'lucide-react';
import { formatMoney } from '../lib/booking';
import { useAuth } from '../contexts/AuthContext';
import { useWishlist } from '../hooks/useWishlist';
import SmartImage from './SmartImage';
import { getHotelImage } from '../lib/images';

interface Props {
  hotel: Hotel;
  rating?: number;
  minPrice?: number;
  searchParams: {
    checkIn?: string;
    checkOut?: string;
    guests?: number;
    currency?: string;
  };
  isAvailable?: boolean;
}

export default function CompactHotelCard({ hotel, rating, minPrice, searchParams, isAvailable }: Props) {
  const { user } = useAuth();
  const { savedHotelIds, toggleSave } = useWishlist();
  
  const isSaved = hotel.id ? savedHotelIds.includes(hotel.id) : false;

  const url = `/hotel/${hotel.id}${searchParams.checkIn && searchParams.checkOut ? `?checkIn=${searchParams.checkIn}&checkOut=${searchParams.checkOut}&guests=${searchParams.guests || 2}` : ''}`;
  
  // Extract city/region from location
  const shortLocation = hotel.location ? hotel.location.split(',')[0].trim() : 'Malawi';

  return (
    <Link
      to={url}
      className={`group flex items-center gap-4 md:gap-6 bg-white p-3 md:p-4 rounded-2xl border border-stone-100 hover:border-stone-300 hover:shadow-md transition-all ${isAvailable === false ? 'opacity-50 grayscale hover:grayscale-0 transition duration-300' : ''}`}
    >
      <div className="relative w-20 h-20 md:w-28 md:h-28 shrink-0 rounded-xl overflow-hidden bg-stone-100">
        <SmartImage
          src={hotel.imageUrl || getHotelImage(hotel)}
          fallbacks={hotel.galleryUrls || []}
          alt={hotel.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        {/* Heart icon simplified */}
        {user && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (hotel.id) toggleSave(hotel.id);
            }}
            className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-white/50 backdrop-blur-sm transition-transform hover:scale-110 z-10"
          >
            <svg
              className={`w-4 h-4 ${isSaved ? 'fill-rose-500 text-rose-500' : 'fill-none text-stone-700'}`}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-1">
          <h3 className="font-bold text-stone-900 text-base md:text-lg truncate pr-4">{hotel.name}</h3>
          {rating && (
            <div className="flex items-center gap-1 bg-stone-100 px-1.5 py-0.5 rounded-md shrink-0">
              <Star className="w-3 h-3 md:w-3.5 md:h-3.5 fill-current text-stone-700" />
              <span className="text-xs font-bold text-stone-700">{rating.toFixed(1)}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1.5 text-stone-500 text-xs md:text-sm mb-2 md:mb-3">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{shortLocation}</span>
        </div>

        <div className="flex items-center gap-2 overflow-hidden">
          {hotel.amenities?.slice(0, 3).map((amenity, i) => (
            <span key={i} className="text-[10px] md:text-xs text-stone-500 bg-stone-50 px-2 py-0.5 rounded-md whitespace-nowrap hidden sm:inline-block">
              {amenity}
            </span>
          ))}
          {hotel.amenities && hotel.amenities.length > 3 && (
            <span className="text-[10px] md:text-xs text-stone-400 hidden sm:inline-block">+{hotel.amenities.length - 3}</span>
          )}
        </div>
      </div>

      <div className="text-right shrink-0 flex flex-col justify-between self-stretch py-1">
        {minPrice !== undefined ? (
          <div>
            <div className="text-xs text-stone-500 mb-0.5 font-medium">From</div>
            <div className="font-bold text-stone-900 text-base md:text-lg tracking-tight">
              {formatMoney(minPrice, searchParams.currency || 'USD')}
            </div>
          </div>
        ) : (
          <div className="text-xs text-stone-400 italic">No rooms</div>
        )}
        
        {isAvailable === false && (
          <div className="text-xs font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded-md inline-block self-end mt-auto">
            Sold out
          </div>
        )}
      </div>
    </Link>
  );
}
