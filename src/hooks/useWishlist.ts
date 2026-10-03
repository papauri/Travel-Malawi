import { useWishlistContext } from '../contexts/WishlistContext';

/** The signed-in user's saved properties, shared through WishlistProvider. */
export function useWishlist() {
  return useWishlistContext();
}
