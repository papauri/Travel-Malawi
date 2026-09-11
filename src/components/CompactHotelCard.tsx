import React from 'react';
import { Hotel, CurrencyCode } from '../types';
import { Link } from 'react-router-dom';
import { Star, MapPin, Heart } from 'lucide-react';
import PromotionIcon from './PromotionIcon';
import { formatMoney } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';
import { useWishlist } from '../hooks/useWishlist';
import SmartImage from './SmartImage';
import { getHotelImage } from '../lib/images';
import MaskedPlaceName from './MaskedPlaceName';
import { formatLocationName } from '../lib/geo';
import { getActivePromotion, calculateSlashedPrice, getSaleTypeBadge } from '../lib/promotions';

interface Props {
  hotel: Hotel;
  rating?: number;
  minPrice?: number | null;
  secondaryPriceFrom?: number | null;
  secondaryCurrency?: CurrencyCode;
  priceCurrency?: CurrencyCode;
  searchParams: {
    checkIn?: string;
    checkOut?: string;
    guests?: number;
    currency?: string;
  };
  isAvailable?: boolean;
}

export default function CompactHotelCard({
  hotel,
  rating,
  minPrice,
  secondaryPriceFrom,
  secondaryCurrency,
  searchParams,
  isAvailable
}: Props) {
  const { user } = useAuth();
  const { savedHotelIds, toggleSave } = useWishlist();
  
  const isSaved = hotel.id ? savedHotelIds.includes(hotel.id) : false;

  const url = `/hotel/${hotel.id}${searchParams.checkIn && searchParams.checkOut ? `?checkIn=${searchParams.checkIn}&checkOut=${searchParams.checkOut}&guests=${searchParams.guests || 2}` : ''}`;
  
  const formattedLocation = formatLocationName(hotel.location, hotel.name);
  const activeCurrency = (searchParams.currency as CurrencyCode) || 'MWK';

  return (
    <Link
      to={url}
      className={`group flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3.5 md:gap-4 bg-white p-2.5 sm:p-3.5 md:p-4 rounded-xl sm:rounded-2xl border border-stone-200/80 hover:border-stone-400 hover:shadow-md transition-all ${
        isAvailable === false ? 'opacity-60 grayscale hover:grayscale-0 transition duration-300' : ''
      }`}
    >
      {/* Top / Left: Image Container with dynamic sizing */}
      <div className="flex items-start sm:items-center gap-2.5 sm:gap-3.5 flex-1 min-w-0">
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-28 shrink-0 rounded-lg sm:rounded-xl overflow-hidden bg-stone-100 shadow-2xs">
          <SmartImage
            src={hotel.imageUrl || getHotelImage(hotel)}
            fallbacks={hotel.galleryUrls || []}
            alt={hotel.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          {/* Wishlist button */}
          {user && (
            <button
              type="button"
              aria-label={isSaved ? "Remove from wishlist" : "Save to wishlist"}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (hotel.id) toggleSave(hotel.id);
              }}
              className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-stone-900/40 hover:bg-stone-900/60 backdrop-blur-sm transition-transform active:scale-90 z-10 cursor-pointer"
            >
              <Heart
                className={`w-3.5 h-3.5 transition-colors ${
                  isSaved ? 'fill-rose-500 text-rose-500' : 'text-white'
                }`}
              />
            </button>
          )}
        </div>

        {/* Content Area: Title, Location, Tags */}
        <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch py-0.5">
          <div>
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex flex-col min-w-0">
                {hotel.featured && (
                  <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">
                    <Star className="w-2.5 h-2.5 fill-stone-400 text-stone-400" /> Featured
                  </span>
                )}
                <h3 className="font-serif font-bold text-stone-900 text-sm sm:text-base md:text-lg leading-snug line-clamp-2 group-hover:text-emerald-800 transition-colors">
                  <MaskedPlaceName name={hotel.name} fallback="[Your Lodge Name]" />
                </h3>
              </div>
              
              {/* Rating badge */}
              {rating !== undefined && rating > 0 && (
                <div className="flex items-center gap-1 bg-stone-100/90 border border-stone-200/60 px-1.5 py-0.5 rounded-md shrink-0">
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                  <span className="text-[11px] sm:text-xs font-bold text-stone-800">{rating.toFixed(1)}</span>
                </div>
              )}
            </div>

            {/* Location */}
            <div className="flex items-center gap-1 text-stone-500 text-xs sm:text-sm mb-1.5">
              <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-stone-400 shrink-0" />
              <span className="truncate">{formattedLocation}</span>
            </div>

            {/* Amenities & Tags */}
            <div className="flex items-center gap-1.5 overflow-hidden flex-wrap">
              {hotel.categories && hotel.categories[0] && (
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md whitespace-nowrap">
                  {hotel.categories[0]}
                </span>
              )}
              {hotel.amenities?.slice(0, 3).map((amenity, i) => (
                <span key={i} className="text-[10px] text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md whitespace-nowrap hidden sm:inline-block">
                  {amenity}
                </span>
              ))}
              {hotel.amenities && hotel.amenities.length > 3 && (
                <span className="text-[10px] text-stone-400 hidden md:inline-block">
                  +{hotel.amenities.length - 3}
                </span>
              )}
            </div>
          </div>

          {/* Mobile-only Price Row: Integrated at bottom so title has 100% horizontal width */}
          <div className="sm:hidden mt-2 pt-1.5 border-t border-stone-100 flex items-center justify-between gap-2">
            {(() => {
              const promo = getActivePromotion(hotel, searchParams.checkIn, 'all');
              const slashed = minPrice != null ? calculateSlashedPrice(minPrice, promo, activeCurrency) : null;

              if (minPrice !== undefined && minPrice !== null && slashed) {
                return slashed.hasDiscount ? (
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="inline-flex items-center gap-1 bg-stone-900 text-white px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                        <PromotionIcon saleType={slashed.saleType} className="w-2.5 h-2.5 text-white" />
                        <span>{slashed.saleTypeLabel}</span>
                      </span>
                      <span className="text-stone-700 text-[10px] font-semibold">
                        -{slashed.discountPercentage}% OFF
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[9px] uppercase font-bold text-stone-400">FROM</span>
                      <span className="text-[11px] text-stone-400 line-through decoration-stone-300">
                        {formatMoney(minPrice, activeCurrency)}
                      </span>
                      <span className="text-[9px] font-bold text-stone-400">&gt;</span>
                      <span className="text-[9px] uppercase font-bold text-stone-900">TO</span>
                      <span className="font-bold text-stone-900 text-xs tracking-tight">
                        {formatMoney(slashed.slashedPrice, activeCurrency)}
                      </span>
                      <span className="text-[10px] text-stone-400">/ night</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400">From</span>
                    <span className="font-bold text-stone-900 text-xs sm:text-sm tracking-tight">
                      {formatMoney(minPrice, activeCurrency)}
                    </span>
                    <span className="text-[10px] text-stone-400">/ night</span>
                  </div>
                );
              }
              return <span className="text-[11px] text-stone-400 italic">No rooms listed</span>;
            })()}

            {isAvailable === false && (
              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200/60 px-1.5 py-0.5 rounded">
                Sold out
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tablet & Desktop Dedicated Price Column */}
      <div className="hidden sm:flex text-right shrink-0 flex-col justify-between self-stretch py-1 pl-3 md:pl-4 border-l border-stone-100/90 min-w-[130px] md:min-w-[160px]">
        {(() => {
          const promo = getActivePromotion(hotel, searchParams.checkIn, 'all');
          const slashed = minPrice != null ? calculateSlashedPrice(minPrice, promo, activeCurrency) : null;

          if (minPrice !== undefined && minPrice !== null && slashed) {
            return slashed.hasDiscount ? (
              <div>
                <div className="inline-flex items-center gap-1 bg-stone-900 text-white text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shadow-2xs mb-1">
                  <PromotionIcon saleType={slashed.saleType} className="w-2.5 h-2.5 text-white" />
                  <span>{slashed.saleTypeLabel}</span>
                </div>
                <div className="text-[10px] font-semibold text-stone-700 mb-0.5">
                  Save {slashed.discountPercentage}% ({formatMoney(slashed.slashedAmount, activeCurrency)})
                </div>
                <div className="text-[10px] text-stone-400 font-medium">
                  FROM <span className="line-through decoration-stone-300">{formatMoney(minPrice, activeCurrency)}</span>
                </div>
                <div className="font-bold text-stone-900 text-sm sm:text-base md:text-lg tracking-tight">
                  &gt; TO {formatMoney(slashed.slashedPrice, activeCurrency)}
                </div>
                {secondaryPriceFrom && secondaryCurrency && (() => {
                  const secSlashed = calculateSlashedPrice(secondaryPriceFrom, promo, secondaryCurrency);
                  return (
                    <div className="text-[10px] text-stone-400 font-normal">
                      (FROM {formatMoney(secondaryPriceFrom, secondaryCurrency)} &gt; TO {formatMoney(secSlashed.slashedPrice, secondaryCurrency)})
                    </div>
                  );
                })()}
                <div className="text-[10px] md:text-xs text-stone-400 mt-0.5">per night</div>
              </div>
            ) : (
              <div>
                <div className="text-[10px] md:text-xs text-stone-400 uppercase tracking-wider font-semibold mb-0.5">From</div>
                <div className="font-bold text-stone-900 text-sm sm:text-base md:text-lg tracking-tight">
                  {formatMoney(minPrice, activeCurrency)}
                </div>
                {secondaryPriceFrom && secondaryCurrency && (
                  <div className="text-[11px] text-stone-400 font-normal">
                    ({formatMoney(secondaryPriceFrom, secondaryCurrency)})
                  </div>
                )}
                <div className="text-[10px] md:text-xs text-stone-400 mt-0.5">per night</div>
              </div>
            );
          }
          return <div className="text-xs text-stone-400 italic">No rooms listed</div>;
        })()}
        
        {isAvailable === false ? (
          <div className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200/60 px-2 py-0.5 rounded-md inline-block self-end mt-auto">
            Sold out
          </div>
        ) : (
          <span className="text-[11px] font-semibold text-emerald-700 group-hover:underline self-end mt-auto">
            View details &rarr;
          </span>
        )}
      </div>
    </Link>
  );
}
