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
            let cachedResponse = await cache.match(url);
            // Fallback match for OpenStreetMap subdomain variance (a, b, c)
            if (!cachedResponse && url.includes('.tile.openstreetmap.org')) {
              const normalized = url.replace(/https:\/\/[abc]\.tile\.openstreetmap\.org/, 'https://a.tile.openstreetmap.org');
              if (normalized !== url) {
                cachedResponse = await cache.match(normalized);
              }
            }
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
 * Updates a batch of rooms in the local cache or adds them if missing
 */
export function saveUpdatedRooms(updatedRooms: RoomType[]): void {
  try {
    if (!updatedRooms || updatedRooms.length === 0) return;
    const existing = getCachedRooms();
    const map = new Map(updatedRooms.map(r => [r.id, r]));
    const merged = existing.length > 0
      ? existing.map(r => (r.id && map.has(r.id) ? { ...r, ...map.get(r.id) } : r))
      : updatedRooms;

    const existingIds = new Set(existing.map(r => r.id));
    for (const r of updatedRooms) {
      if (r.id && !existingIds.has(r.id)) {
        merged.push(r);
      }
    }
    localStorage.setItem(ROOMS_CACHE_KEY, JSON.stringify(merged));
    updateMetadata({ roomCount: merged.length });
  } catch (err) {
    console.warn('Failed to update cached rooms:', err);
  }
}

/**
 * Explicitly clears or invalidates the cached rooms and hotels
 */
export function invalidateListingCache(): void {
  try {
    localStorage.removeItem(ROOMS_CACHE_KEY);
    localStorage.removeItem(HOTELS_CACHE_KEY);
  } catch (err) {
    console.warn('Failed to invalidate listing cache:', err);
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

export interface PropertyOfflinePackage {
  propertyId: string;
  propertyName: string;
  location: string;
  coordinates: LatLng;
  locationNotes?: string;
  contactPhone?: string;
  contactEmail?: string;
  image?: string;
  tileCount: number;
  sizeBytes: number;
  downloadedAt: number;
  zoomLevels: number[];
}

export interface OfflineProgressUpdate {
  loaded: number;
  total: number;
  percent: number;
  stage: string;
}

export const PROPERTY_OFFLINE_PREFIX = 'malawi_offline_prop_';
export const PROPERTY_OFFLINE_CATALOG_KEY = 'malawi_offline_properties_catalog';

/**
 * Checks whether an offline map package has been downloaded for a property
 */
export function isPropertyOfflineDownloaded(propertyId: string): boolean {
  if (!propertyId) return false;
  try {
    return Boolean(localStorage.getItem(PROPERTY_OFFLINE_PREFIX + propertyId));
  } catch {
    return false;
  }
}

/**
 * Retrieves the offline map package metadata for a property
 */
export function getPropertyOfflinePackage(propertyId: string): PropertyOfflinePackage | null {
  if (!propertyId) return null;
  try {
    const raw = localStorage.getItem(PROPERTY_OFFLINE_PREFIX + propertyId);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Retrieves all currently downloaded offline properties
 */
export function getAllOfflineProperties(): PropertyOfflinePackage[] {
  try {
    const raw = localStorage.getItem(PROPERTY_OFFLINE_CATALOG_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    return ids
      .map(id => getPropertyOfflinePackage(id))
      .filter((pkg): pkg is PropertyOfflinePackage => pkg !== null);
  } catch {
    return [];
  }
}

/**
 * Deletes the offline package and unregisters from the offline properties catalog
 */
export async function deletePropertyOfflineMap(propertyId: string): Promise<boolean> {
  if (!propertyId) return false;
  try {
    localStorage.removeItem(PROPERTY_OFFLINE_PREFIX + propertyId);
    const raw = localStorage.getItem(PROPERTY_OFFLINE_CATALOG_KEY);
    if (raw) {
      const ids: string[] = JSON.parse(raw);
      const updated = ids.filter(id => id !== propertyId);
      localStorage.setItem(PROPERTY_OFFLINE_CATALOG_KEY, JSON.stringify(updated));
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper to convert latitude/longitude and zoom to tile coordinate (x, y)
 */
function latLngToTileCoordinates(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return {
    x: Math.max(0, Math.min(n - 1, x)),
    y: Math.max(0, Math.min(n - 1, y)),
  };
}

/**
 * Downloads a comprehensive offline map tile package for a specific property location in Malawi.
 * Caches multi-level street tiles (regional corridor, district, local access, and lodge perimeter)
 * into browser CacheStorage and PWA cache for complete offline exploration and navigation.
 */
export async function downloadPropertyOfflineMap(
  property: {
    id: string;
    name: string;
    location: string;
    coordinates: LatLng;
    locationNotes?: string;
    contactPhone?: string;
    contactEmail?: string;
    image?: string;
  },
  onProgress?: (update: OfflineProgressUpdate) => void
): Promise<{ tilesDownloaded: number; sizeBytes: number }> {
  if (!('caches' in window)) {
    throw new Error('Offline CacheStorage is not supported by this browser');
  }

  const { coordinates } = property;
  if (!coordinates || typeof coordinates.lat !== 'number' || typeof coordinates.lng !== 'number') {
    throw new Error('Valid GPS coordinates are required to cache this property offline');
  }

  const cache = await window.caches.open(TILE_CACHE_NAME);

  // Zoom configurations tailored for remote navigation in Malawi:
  // - Zoom 9: Regional corridor (covers highway connections from Lilongwe/Blantyre/Mzuzu)
  // - Zoom 11: District level (main tarred roads and reserve gates)
  // - Zoom 12: Approach corridors (turns off main roads)
  // - Zoom 13: Local feeder roads, bridges, and junctions
  // - Zoom 14: Unpaved tracks, villages, and terrain features
  // - Zoom 15: Lodge access roads & turnoffs
  // - Zoom 16: Immediate property perimeter & beach/park boundary
  const zoomConfigs = [
    { zoom: 9, radius: 1, stage: 'Caching regional highway corridor...' },
    { zoom: 11, radius: 1, stage: 'Caching district road network...' },
    { zoom: 12, radius: 1, stage: 'Caching approach routes...' },
    { zoom: 13, radius: 2, stage: 'Caching local junctions & turnoffs...' },
    { zoom: 14, radius: 2, stage: 'Caching local terrain & access tracks...' },
    { zoom: 15, radius: 2, stage: 'Caching neighborhood & entrance roads...' },
    { zoom: 16, radius: 1, stage: 'Caching property grounds & lake/park frontage...' },
  ];

  const tileQueue: { url: string; stage: string }[] = [];

  for (const config of zoomConfigs) {
    const centerTile = latLngToTileCoordinates(coordinates.lat, coordinates.lng, config.zoom);
    for (let dx = -config.radius; dx <= config.radius; dx++) {
      for (let dy = -config.radius; dy <= config.radius; dy++) {
        const curX = centerTile.x + dx;
        const curY = centerTile.y + dy;
        const n = Math.pow(2, config.zoom);
        if (curX >= 0 && curX < n && curY >= 0 && curY < n) {
          const url = `https://a.tile.openstreetmap.org/${config.zoom}/${curX}/${curY}.png`;
          if (!tileQueue.some(t => t.url === url)) {
            tileQueue.push({ url, stage: config.stage });
          }
        }
      }
    }
  }

  // Also pre-cache satellite imagery at zoom 13 for terrain orientation
  const satCenter = latLngToTileCoordinates(coordinates.lat, coordinates.lng, 13);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const curX = satCenter.x + dx;
      const curY = satCenter.y + dy;
      const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/13/${curY}/${curX}`;
      if (!tileQueue.some(t => t.url === url)) {
        tileQueue.push({ url, stage: 'Caching satellite terrain views...' });
      }
    }
  }

  // Also pre-cache thumbnail image if present
  if (property.image && property.image.startsWith('http')) {
    tileQueue.push({ url: property.image, stage: 'Saving property preview photo...' });
  }

  const total = tileQueue.length;
  let loaded = 0;
  let totalBytes = 0;
  const concurrency = 5;

  for (let i = 0; i < total; i += concurrency) {
    const batch = tileQueue.slice(i, i + concurrency);
    await Promise.allSettled(
      batch.map(async item => {
        try {
          const existing = await cache.match(item.url);
          if (existing) {
            try {
              const b = await existing.blob();
              totalBytes += b.size;
            } catch {
              totalBytes += 15000;
            }
          } else {
            const res = await fetch(item.url, { mode: 'cors' });
            if (res.ok) {
              await cache.put(item.url, res.clone());
              const b = await res.blob();
              totalBytes += b.size;
            }
          }
        } catch {
          // Continue if individual tile times out
        } finally {
          loaded++;
          const percent = Math.min(100, Math.round((loaded / total) * 100));
          onProgress?.({
            loaded,
            total,
            percent,
            stage: item.stage,
          });
        }
      })
    );
  }

  // Persist offline package metadata
  const pkg: PropertyOfflinePackage = {
    propertyId: property.id,
    propertyName: property.name,
    location: property.location,
    coordinates: property.coordinates,
    locationNotes: property.locationNotes,
    contactPhone: property.contactPhone,
    contactEmail: property.contactEmail,
    image: property.image,
    tileCount: loaded,
    sizeBytes: totalBytes,
    downloadedAt: Date.now(),
    zoomLevels: [9, 11, 12, 13, 14, 15, 16],
  };

  try {
    localStorage.setItem(PROPERTY_OFFLINE_PREFIX + property.id, JSON.stringify(pkg));
    const rawCatalog = localStorage.getItem(PROPERTY_OFFLINE_CATALOG_KEY);
    const catalog: string[] = rawCatalog ? JSON.parse(rawCatalog) : [];
    if (!catalog.includes(property.id)) {
      catalog.push(property.id);
      localStorage.setItem(PROPERTY_OFFLINE_CATALOG_KEY, JSON.stringify(catalog));
    }
  } catch (err) {
    console.warn('Failed to save offline package metadata:', err);
  }

  return { tilesDownloaded: loaded, sizeBytes: totalBytes };
}

