import L from 'leaflet';
import { Hotel, RoomType } from '../types';
import { LatLng } from './geo';

export const TILE_CACHE_NAME = 'malawi-map-tiles-v1';
export const HOTELS_CACHE_KEY = 'malawi_lodges_offline_cache_v2';
export const ROOMS_CACHE_KEY = 'malawi_rooms_offline_cache_v2';
export const CACHE_META_KEY = 'malawi_cache_metadata_v2';

export interface CacheMetadata {
  lastUpdated: number;
  hotelCount: number;
  roomCount: number;
  tileCount?: number;
}

/**
 * Custom Leaflet TileLayer that uses browser CacheStorage to store and serve map tiles.
 * Supports offline viewing and seamless stale-while-revalidate for intermittent internet.
 */
export class CachedTileLayer extends L.TileLayer {
  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const tile = document.createElement('img');
    tile.alt = '';
    tile.setAttribute('role', 'presentation');

    const url = this.getTileUrl(coords);

    // If browser supports Cache API
    if ('caches' in window) {
      window.caches
        .open(TILE_CACHE_NAME)
        .then(async (cache) => {
          try {
            const cachedResponse = await cache.match(url);
            if (cachedResponse) {
              const blob = await cachedResponse.blob();
              const objectUrl = URL.createObjectURL(blob);
              tile.onload = () => {
                URL.revokeObjectURL(objectUrl);
                done(undefined, tile);
              };
              tile.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                done(new Error('Cached tile decode error'), tile);
              };
              tile.src = objectUrl;

              // Background refresh if online
              if (navigator.onLine) {
                fetch(url, { mode: 'cors' })
                  .then((freshRes) => {
                    if (freshRes.ok) {
                      cache.put(url, freshRes);
                    }
                  })
                  .catch(() => {
                    // Ignore background refresh errors
                  });
              }
              return;
            }

            // Not in cache yet, fetch from network and store in cache
            fetch(url, { mode: 'cors' })
              .then(async (response) => {
                if (response.ok) {
                  cache.put(url, response.clone());
                  const blob = await response.blob();
                  const objectUrl = URL.createObjectURL(blob);
                  tile.onload = () => {
                    URL.revokeObjectURL(objectUrl);
                    done(undefined, tile);
                  };
                  tile.onerror = () => {
                    URL.revokeObjectURL(objectUrl);
                    done(new Error('Tile image render error'), tile);
                  };
                  tile.src = objectUrl;
                } else {
                  tile.src = url;
                  tile.onload = () => done(undefined, tile);
                  tile.onerror = (e) => done(new Error('Tile load error'), tile);
                }
              })
              .catch(() => {
                // If fetch fails (e.g. offline), fallback to direct url
                tile.src = url;
                tile.onload = () => done(undefined, tile);
                tile.onerror = (e) => done(new Error('Tile network error'), tile);
              });
          } catch {
            tile.src = url;
            tile.onload = () => done(undefined, tile);
            tile.onerror = (e) => done(new Error('Tile error'), tile);
          }
        })
        .catch(() => {
          tile.src = url;
          tile.onload = () => done(undefined, tile);
          tile.onerror = (e) => done(new Error('Tile error'), tile);
        });
    } else {
      tile.src = url;
      tile.onload = () => done(undefined, tile);
      tile.onerror = (e) => done(new Error('Tile error'), tile);
    }

    return tile;
  }
}

/**
 * Creates a cached street tile layer
 */
export function createCachedStreetLayer(): L.TileLayer {
  return new CachedTileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors (Offline Cached)',
  });
}

/**
 * Creates a cached satellite tile layer
 */
export function createCachedSatelliteLayer(): L.TileLayer {
  return new CachedTileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri (Offline Cached)',
    }
  );
}

/**
 * Saves hotels array to offline local cache
 */
export function saveCachedHotels(hotels: Hotel[]): void {
  try {
    if (!hotels || hotels.length === 0) return;
    localStorage.setItem(HOTELS_CACHE_KEY, JSON.stringify(hotels));
    updateMetadata({ hotelCount: hotels.length });
  } catch (err) {
    console.warn('Failed to cache hotels offline:', err);
  }
}

/**
 * Retrieves cached hotels from local storage
 */
export function getCachedHotels(): Hotel[] {
  try {
    const raw = localStorage.getItem(HOTELS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to read cached hotels:', err);
    return [];
  }
}

/**
 * Saves room types array to offline local cache
 */
export function saveCachedRooms(rooms: RoomType[]): void {
  try {
    if (!rooms || rooms.length === 0) return;
    localStorage.setItem(ROOMS_CACHE_KEY, JSON.stringify(rooms));
    updateMetadata({ roomCount: rooms.length });
  } catch (err) {
    console.warn('Failed to cache rooms offline:', err);
  }
}

/**
 * Retrieves cached rooms from local storage
 */
export function getCachedRooms(): RoomType[] {
  try {
    const raw = localStorage.getItem(ROOMS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to read cached rooms:', err);
    return [];
  }
}

/**
 * Saves a single hotel detail into cache for fast offline access
 */
export function saveSingleCachedHotel(hotel: Hotel): void {
  try {
    if (!hotel || !hotel.id) return;
    const existing = getCachedHotels();
    const idx = existing.findIndex(h => h.id === hotel.id);
    if (idx >= 0) {
      existing[idx] = hotel;
    } else {
      existing.push(hotel);
    }
    saveCachedHotels(existing);
  } catch (err) {
    console.warn('Failed to cache single hotel:', err);
  }
}

/**
 * Retrieves a single hotel from local cache by ID
 */
export function getSingleCachedHotel(hotelId: string): Hotel | null {
  try {
    const all = getCachedHotels();
    return all.find(h => h.id === hotelId) || null;
  } catch {
    return null;
  }
}

/**
 * Updates metadata timestamp
 */
function updateMetadata(partial: Partial<CacheMetadata>): void {
  try {
    const prev = getCacheMetadata();
    const updated: CacheMetadata = {
      lastUpdated: Date.now(),
      hotelCount: partial.hotelCount ?? prev.hotelCount ?? 0,
      roomCount: partial.roomCount ?? prev.roomCount ?? 0,
      tileCount: partial.tileCount ?? prev.tileCount ?? 0,
    };
    localStorage.setItem(CACHE_META_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage issues
  }
}

/**
 * Returns cache metadata
 */
export function getCacheMetadata(): CacheMetadata {
  try {
    const raw = localStorage.getItem(CACHE_META_KEY);
    if (!raw) return { lastUpdated: 0, hotelCount: 0, roomCount: 0 };
    return JSON.parse(raw);
  } catch {
    return { lastUpdated: 0, hotelCount: 0, roomCount: 0 };
  }
}

/**
 * Counts total map tiles currently stored in CacheStorage
 */
export async function getCachedTileCount(): Promise<number> {
  if (!('caches' in window)) return 0;
  try {
    const cache = await window.caches.open(TILE_CACHE_NAME);
    const keys = await cache.keys();
    return keys.length;
  } catch {
    return 0;
  }
}

/**
 * Clears map tile cache storage
 */
export async function clearMapTileCache(): Promise<boolean> {
  if (!('caches' in window)) return false;
  try {
    return await window.caches.delete(TILE_CACHE_NAME);
  } catch {
    return false;
  }
}

/**
 * Pre-fetches map tiles for key tourist hubs in Malawi so users can browse completely offline
 */
export async function prefetchMalawiMapTiles(onProgress?: (loaded: number, total: number) => void): Promise<number> {
  if (!('caches' in window)) return 0;

  // Major hubs in Malawi with bounding boxes/zoom levels
  const hubs: { lat: number; lng: number; zooms: number[] }[] = [
    { lat: -13.9626, lng: 33.7741, zooms: [7, 8, 9, 10, 11] }, // Lilongwe
    { lat: -15.7861, lng: 35.0058, zooms: [7, 8, 9, 10, 11] }, // Blantyre
    { lat: -14.0167, lng: 34.8333, zooms: [7, 8, 9, 10, 11] }, // Cape Maclear & Lake Malawi
    { lat: -11.4583, lng: 34.0167, zooms: [7, 8, 9, 10] },     // Mzuzu & Nkhata Bay
    { lat: -14.8333, lng: 35.3333, zooms: [7, 8, 9, 10] },     // Liwonde National Park
    { lat: -15.3833, lng: 35.3333, zooms: [7, 8, 9, 10] },     // Zomba Plateau
    { lat: -10.5833, lng: 33.8000, zooms: [7, 8, 9] },         // Nyika National Park
    { lat: -12.0500, lng: 34.7333, zooms: [7, 8, 9, 10] },     // Likoma Island
  ];

  try {
    const cache = await window.caches.open(TILE_CACHE_NAME);
    const tileUrls: string[] = [];

    // Calculate tile coordinates (z, x, y) for each hub
    for (const hub of hubs) {
      for (const z of hub.zooms) {
        const x = Math.floor(((hub.lng + 180) / 360) * Math.pow(2, z));
        const latRad = (hub.lat * Math.PI) / 180;
        const y = Math.floor(
          ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, z)
        );

        // Fetch center tile and 1 adjacent neighbor in each direction
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const curX = x + dx;
            const curY = y + dy;
            if (curX >= 0 && curY >= 0) {
              const url = `https://a.tile.openstreetmap.org/${z}/${curX}/${curY}.png`;
              if (!tileUrls.includes(url)) {
                tileUrls.push(url);
              }
            }
          }
        }
      }
    }

    let loadedCount = 0;
    const batchSize = 6;

    for (let i = 0; i < tileUrls.length; i += batchSize) {
      const batch = tileUrls.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map(async (url) => {
          try {
            const match = await cache.match(url);
            if (!match) {
              const res = await fetch(url, { mode: 'cors' });
              if (res.ok) {
                await cache.put(url, res);
              }
            }
            loadedCount++;
            onProgress?.(loadedCount, tileUrls.length);
          } catch {
            // Ignore single tile fetch failure
          }
        })
      );
    }

    return loadedCount;
  } catch (err) {
    console.warn('Failed to prefetch map tiles:', err);
    return 0;
  }
}
