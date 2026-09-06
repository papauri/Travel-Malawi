import { Hotel, Promotion } from '../types';
import { DateStr } from './dates';

/**
 * Returns the highest active discount percentage for the hotel on the given date.
 */
export function getActivePromotion(hotel: Hotel, checkInDate: DateStr): Promotion | null {
  if (!hotel.promotions || hotel.promotions.length === 0) return null;
  
  const active = hotel.promotions.filter(p => {
    if (!p.isActive) return false;
    if (p.startDate && p.startDate > checkInDate) return false;
    if (p.endDate && p.endDate < checkInDate) return false;
    return true;
  });
  
  if (active.length === 0) return null;
  
  // Return the one with the highest discount
  return active.reduce((prev, current) => 
    (prev.discountPercentage > current.discountPercentage) ? prev : current
  );
}
