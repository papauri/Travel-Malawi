import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { LatLng, isValidLatLng, MALAWI_CENTRE, distanceKm, estimateTravelTime, getDirectionsUrl } from '../lib/geo';
import { CurrencyCode } from '../types';
import { Layers, Locate, Maximize2, Minimize2, ZoomIn, ZoomOut, Navigation, Star, MapPin, Car, ArrowRight, ExternalLink, X, Compass, Route, WifiOff, CloudDownload, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { createCachedStreetLayer, createCachedSatelliteLayer, prefetchMalawiMapTiles } from '../lib/mapCache';

export interface LodgeMarker {
  id: string;
  name: string;
  location: string;
  coordinates: LatLng;
  priceFrom?: number | null;
  priceCurrency?: CurrencyCode;
  image?: string;
  rating?: number;
  category?: string;
  roomsCount?: number;
  slug?: string;
  distanceFromUser?: number | null;
}

export interface InteractiveMapProps {
  center?: LatLng | null;
  markerPosition?: LatLng | null;
  markerImage?: string;
  onMarkerChange?: (pos: LatLng) => void;
  interactive?: boolean;
  zoom?: number;
  heightClass?: string;
  popupText?: string;
  origin?: LatLng | null;
  originLabel?: string;
  showSatelliteToggle?: boolean;
  className?: string;
  
  // Cluster & Multi-lodge properties
  lodges?: LodgeMarker[];
  enableClustering?: boolean;
  selectedLodgeId?: string | null;
  onLodgeSelect?: (lodge: LodgeMarker) => void;
  onClearSelectedLodge?: () => void;
  fitBoundsToLodges?: boolean;
  showLodgePopups?: boolean;

  // Current User Location properties
  userLocation?: LatLng | null;
  showUserLocation?: boolean;
  userLocationAccuracy?: number;
  onToggleUserLocation?: () => void;
  isLocatingUser?: boolean;
  showDistanceOverlay?: boolean;
}

// Custom SVG Pin for user live GPS location with pulsing radar waves
const createUserLiveLocationIcon = (label: string = 'You are here') => {
  const html = `
    <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
      <!-- Radar Waves -->
      <span class="absolute w-10 h-10 rounded-full bg-blue-500/25 animate-ping"></span>
      <span class="absolute w-6 h-6 rounded-full bg-blue-500/35 animate-pulse"></span>
      
      <!-- Core Pulse Dot -->
      <div class="relative w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-xl flex items-center justify-center">
        <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
      </div>
      
      <!-- Tooltip Tag -->
      <div class="absolute top-full mt-1.5 px-2 py-0.5 bg-blue-900/90 backdrop-blur-md text-white text-[10px] font-bold rounded-md shadow-md whitespace-nowrap border border-blue-700 pointer-events-none flex items-center gap-1">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        ${label}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-user-live-location-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -16],
  });
};

// Custom SVG Pin for a single destination / property with photo thumbnail badge
const createCustomPinIcon = (label?: string, image?: string) => {
  const html = `
    <div style="position: relative; width: 56px; height: 68px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; cursor: pointer; pointer-events: auto;">
      ${label ? `
        <div style="position: absolute; bottom: 70px; left: 50%; transform: translateX(-50%); padding: 5px 12px; background: #1c1917; color: #ffffff; font-size: 11px; font-weight: 700; border-radius: 9999px; box-shadow: 0 10px 25px rgba(0,0,0,0.4); white-space: nowrap; border: 1.5px solid rgba(255,255,255,0.35); pointer-events: none; display: flex; align-items: center; gap: 6px; max-width: 240px; z-index: 30;">
          <span style="width: 8px; height: 8px; border-radius: 9999px; background: #10b981; flex-shrink: 0; box-shadow: 0 0 10px #10b981;"></span>
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${label}</span>
        </div>
      ` : ''}
      
      <div style="position: relative; width: 52px; height: 52px; margin-bottom: 6px; display: flex; align-items: center; justify-content: center;">
        <!-- Glowing Beacon Radar Rings -->
        <div style="position: absolute; width: 66px; height: 66px; border-radius: 9999px; background: rgba(16, 185, 129, 0.25); pointer-events: none; z-index: 1;"></div>
        <div style="position: absolute; width: 58px; height: 58px; border-radius: 9999px; background: rgba(16, 185, 129, 0.4); pointer-events: none; z-index: 2;"></div>
        
        <!-- Circular Picture Frame with Stay Thumbnail -->
        <div style="position: relative; width: 52px; height: 52px; border-radius: 9999px; background: #1c1917; border: 3.5px solid #ffffff; box-shadow: 0 12px 28px -4px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0,0,0,0.15); overflow: hidden; display: flex; align-items: center; justify-content: center; z-index: 10;">
          ${image ? `
            <img src="${image}" alt="${label || 'Stay'}" style="width: 100%; height: 100%; object-fit: cover; display: block;" referrerpolicy="no-referrer" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
            <div style="display: none; width: 100%; height: 100%; background: #1c1917; align-items: center; justify-content: center; color: #10b981;">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
          ` : `
            <div style="width: 100%; height: 100%; background: #1c1917; display: flex; align-items: center; justify-content: center; color: #10b981;">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
          `}
        </div>
        
        <!-- Bottom Pin Pointer Tip -->
        <div style="position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%) rotate(45deg); width: 13px; height: 13px; background: #1c1917; border-right: 3px solid #ffffff; border-bottom: 3px solid #ffffff; z-index: 5; box-shadow: 2px 2px 5px rgba(0,0,0,0.35);"></div>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-leaflet-marker',
    iconSize: [56, 68],
    iconAnchor: [28, 68],
    popupAnchor: [0, -68],
  });
};

// Custom SVG Pin for guest/origin location
const createOriginIcon = (label: string = 'Your Location') => {
  const html = `
    <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-full">
      <div class="relative flex items-center justify-center">
        <div class="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-2xl ring-4 ring-white border border-blue-700">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </div>
        <div class="absolute -bottom-1 w-2 h-2 bg-blue-600 rotate-45"></div>
      </div>
      <div class="absolute top-full mt-1.5 px-2.5 py-1 bg-blue-900/90 backdrop-blur text-white text-[11px] font-bold rounded-lg shadow-lg whitespace-nowrap border border-blue-700 pointer-events-none">${label}</div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-leaflet-origin-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

// Custom Price Badge Pin for Lodges in Multi-Marker Mode
const createLodgePinIcon = (lodge: LodgeMarker, isSelected: boolean) => {
  const priceDisplay = lodge.priceFrom
    ? `${lodge.priceCurrency === 'USD' ? '$' : 'MK '}${lodge.priceFrom.toLocaleString()}`
    : lodge.name;

  const bgClasses = isSelected
    ? 'bg-emerald-800 text-white ring-4 ring-emerald-400/70 scale-110 shadow-2xl z-30'
    : 'bg-white text-stone-900 border border-stone-300 hover:border-emerald-600 hover:bg-stone-900 hover:text-white shadow-md';

  const html = `
    <div class="relative flex flex-col items-center justify-center -translate-x-1/2 -translate-y-full cursor-pointer group">
      <div class="px-2.5 py-1 rounded-full font-bold text-xs transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap ${bgClasses}">
        <span class="w-2 h-2 rounded-full ${isSelected ? 'bg-emerald-300 animate-ping' : 'bg-emerald-500'}"></span>
        <span class="tracking-tight">${priceDisplay}</span>
      </div>
      <div class="w-2 h-2 rotate-45 -mt-1 ${isSelected ? 'bg-emerald-800' : 'bg-white group-hover:bg-stone-900'} transition-colors"></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-lodge-marker',
    iconSize: [80, 32],
    iconAnchor: [40, 32],
    popupAnchor: [0, -32],
  });
};

export const createPopupHtml = (lodge: LodgeMarker) => {
  const priceLabel = lodge.priceFrom
    ? `<span class="text-xs font-bold text-emerald-700">${lodge.priceCurrency === 'USD' ? '$' : 'MK '}${lodge.priceFrom.toLocaleString()}</span> <span class="text-[10px] text-stone-500">/ night</span>`
    : `<span class="text-xs font-medium text-stone-500">Contact for rates</span>`;

  const imageHtml = lodge.image
    ? `<div class="h-28 w-full bg-stone-100 overflow-hidden relative">
         <img src="${lodge.image}" alt="${lodge.name}" class="w-full h-full object-cover" />
         ${lodge.category ? `<span class="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-stone-900/80 backdrop-blur-md text-[10px] font-bold text-white uppercase tracking-wider">${lodge.category}</span>` : ''}
       </div>`
    : '';

  return `
    <div class="w-64 overflow-hidden rounded-2xl bg-white text-stone-900 font-sans shadow-lg">
      ${imageHtml}
      <div class="p-3.5 space-y-2">
        <div>
          <div class="font-serif font-bold text-base text-stone-900 leading-snug line-clamp-1">${lodge.name}</div>
          <div class="text-xs text-stone-500 flex items-center gap-1 mt-0.5 truncate">
            <svg class="w-3.5 h-3.5 text-stone-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            <span class="truncate">${lodge.location}</span>
          </div>
        </div>
        <div class="flex items-center justify-between pt-2 border-t border-stone-100">
          <div>${priceLabel}</div>
          <a href="/hotel/${lodge.id}" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-xs">
            <span>View</span>
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>
          </a>
        </div>
      </div>
    </div>
  `;
};

export default function InteractiveMap({
  center,
  markerPosition,
  markerImage,
  onMarkerChange,
  interactive = true,
  zoom = 13,
  heightClass = 'h-72',
  popupText,
  origin,
  originLabel = 'Your Location',
  showSatelliteToggle = true,
  className = '',
  lodges,
  enableClustering = true,
  selectedLodgeId,
  onLodgeSelect,
  onClearSelectedLodge,
  fitBoundsToLodges = true,
  showLodgePopups = true,
  userLocation,
  showUserLocation = false,
  userLocationAccuracy,
  onToggleUserLocation,
  isLocatingUser = false,
  showDistanceOverlay = true,
}: InteractiveMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const originMarkerRef = useRef<L.Marker | null>(null);
  const userLocationMarkerRef = useRef<L.Marker | null>(null);
  const userLocationCircleRef = useRef<L.Circle | null>(null);
  const userRoutePolylineRef = useRef<L.Polyline | null>(null);
  const midpointMarkerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  
  // Cluster and markers layer ref
  const clusterGroupRef = useRef<any>(null);
  const lodgeMarkersMapRef = useRef<Map<string, L.Marker>>(new Map());

  const [mapType, setMapType] = useState<'streets' | 'satellite'>('streets');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isOverlayMinimized, setIsOverlayMinimized] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handlePreloadMalawi = async () => {
    if (isPrefetching) return;
    setIsPrefetching(true);
    try {
      await prefetchMalawiMapTiles();
      toast.success('Malawi map tiles saved for offline travel!');
    } catch {
      // Ignore
    } finally {
      setIsPrefetching(false);
    }
  };

  // Identify currently selected lodge object
  const selectedLodge = useMemo(() => {
    if (!selectedLodgeId || !lodges) return null;
    return lodges.find(l => l.id === selectedLodgeId && isValidLatLng(l.coordinates)) || null;
  }, [selectedLodgeId, lodges]);

  // Compute live travel estimate between user location and selected lodge
  const travelInfo = useMemo(() => {
    if (!showUserLocation || !userLocation || !selectedLodge || !isValidLatLng(userLocation) || !isValidLatLng(selectedLodge.coordinates)) {
      return null;
    }
    const straightKm = distanceKm(userLocation, selectedLodge.coordinates);
    return estimateTravelTime(straightKm);
  }, [showUserLocation, userLocation, selectedLodge]);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current) return;

    // Determine initial center
    let initialPos = MALAWI_CENTRE;
    let initialZoom = 7;

    if (isValidLatLng(markerPosition)) {
      initialPos = markerPosition;
      initialZoom = zoom || 13;
    } else if (isValidLatLng(center)) {
      initialPos = center;
      initialZoom = zoom || 13;
    } else if (lodges && lodges.length > 0 && isValidLatLng(lodges[0]?.coordinates)) {
      initialPos = lodges[0].coordinates;
      initialZoom = 7;
    }

    const map = L.map(containerRef.current, {
      center: [initialPos.lat, initialPos.lng],
      zoom: initialZoom,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
      dragging: false,
    });

    const streetLayer = createCachedStreetLayer();
    streetLayer.addTo(map);
    tileLayerRef.current = streetLayer;
    mapInstanceRef.current = map;
    setMapReady(true);

    // Ensure map tiles and container geometry calculate correctly
    const resizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    // Watch for container resizes
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(containerRef.current);
    }

    // Handle map clicks in interactive single-pin mode
    if (interactive && onMarkerChange) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        const newCoords = { lat: e.latlng.lat, lng: e.latlng.lng };
        onMarkerChange(newCoords);
      });
    }

    return () => {
      clearTimeout(resizeTimer);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      setMapReady(false);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer when mapType changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    if (mapType === 'satellite') {
      const satLayer = createCachedSatelliteLayer();
      satLayer.addTo(map);
      tileLayerRef.current = satLayer;
    } else {
      const streetLayer = createCachedStreetLayer();
      streetLayer.addTo(map);
      tileLayerRef.current = streetLayer;
    }
  }, [mapType, mapReady]);

  // Handle Multi-Lodge Clustering & Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    // Clean up previous cluster layer or lodge markers
    if (clusterGroupRef.current) {
      map.removeLayer(clusterGroupRef.current);
      clusterGroupRef.current = null;
    }
    lodgeMarkersMapRef.current.clear();

    if (!lodges || lodges.length === 0) return;

    // Filter valid coordinates
    const validLodges = lodges.filter(l => isValidLatLng(l.coordinates));
    if (validLodges.length === 0) return;

    // Initialize Cluster Group or standard FeatureGroup
    let targetLayerGroup: any;

    if (enableClustering && typeof (L as any).markerClusterGroup === 'function') {
      targetLayerGroup = (L as any).markerClusterGroup({
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        spiderfyOnMaxZoom: true,
        removeOutsideVisibleBounds: true,
        maxClusterRadius: 40,
        iconCreateFunction: (cluster: any) => {
          const count = cluster.getChildCount();
          let size = 42;
          let bgStyle = 'bg-stone-900 text-white ring-4 ring-white/90 border border-stone-700 shadow-xl';
          if (count >= 15) {
            size = 52;
            bgStyle = 'bg-emerald-900 text-white ring-4 ring-emerald-400/50 border border-emerald-300 shadow-2xl';
          } else if (count >= 6) {
            size = 46;
            bgStyle = 'bg-stone-900 text-emerald-300 ring-4 ring-stone-900/40 border border-stone-600 shadow-xl';
          }

          return L.divIcon({
            html: `
              <div class="flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
                <div style="width: ${size}px; height: ${size}px;" class="${bgStyle} rounded-full flex flex-col items-center justify-center font-bold transition-transform duration-200 hover:scale-110">
                  <span class="text-xs md:text-sm font-black leading-none">${count}</span>
                  <span class="text-[8px] uppercase tracking-wider font-semibold opacity-80 leading-tight">stays</span>
                </div>
              </div>
            `,
            className: 'custom-cluster-marker',
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          });
        },
      });
    } else {
      targetLayerGroup = L.featureGroup();
    }

    const bounds = L.latLngBounds([]);

    validLodges.forEach(lodge => {
      const isSelected = selectedLodgeId === lodge.id;
      const marker = L.marker([lodge.coordinates.lat, lodge.coordinates.lng], {
        icon: createLodgePinIcon(lodge, isSelected),
        riseOnHover: true,
      });

      // Rich Card Popup
      if (showLodgePopups) {
        marker.bindPopup(createPopupHtml(lodge), {
          closeButton: false,
          className: 'custom-lodge-popup',
          autoPan: true,
          autoPanPadding: [20, 40],
        });
      }

      marker.on('click', () => {
        if (onLodgeSelect) {
          onLodgeSelect(lodge);
        }
      });

      targetLayerGroup.addLayer(marker);
      lodgeMarkersMapRef.current.set(lodge.id, marker);
      bounds.extend([lodge.coordinates.lat, lodge.coordinates.lng]);
    });

    targetLayerGroup.addTo(map);
    clusterGroupRef.current = targetLayerGroup;

    if (fitBoundsToLodges && validLodges.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [mapReady, lodges, enableClustering, showLodgePopups, fitBoundsToLodges]);

  // Update marker icons when selectedLodgeId changes
  useEffect(() => {
    if (!lodges || lodges.length === 0) return;
    lodges.forEach(lodge => {
      const marker = lodgeMarkersMapRef.current.get(lodge.id);
      if (marker) {
        const isSelected = selectedLodgeId === lodge.id;
        marker.setIcon(createLodgePinIcon(lodge, isSelected));
        if (isSelected) {
          if (showLodgePopups) {
            marker.setPopupContent(createPopupHtml(lodge));
          }
          if (clusterGroupRef.current && typeof clusterGroupRef.current.zoomToShowLayer === 'function') {
            clusterGroupRef.current.zoomToShowLayer(marker, () => {
              marker.openPopup();
            });
          } else {
            const map = mapInstanceRef.current;
            if (map) {
              // Offset the center so the popup fits (shift center down by 100 pixels)
              const pt = map.project([lodge.coordinates.lat, lodge.coordinates.lng], map.getZoom());
              pt.y -= 150;
              const offsetLatLng = map.unproject(pt, map.getZoom());
              map.panTo(offsetLatLng, { animate: true });
            }
            // Add a small delay to allow pan to start before opening popup to prevent visual jitter
            setTimeout(() => {
              if (marker) marker.openPopup();
            }, 100);
          }
        }
      }
    });
  }, [selectedLodgeId, lodges, showLodgePopups]);

  // Update Destination / Property Marker (Single Pin Mode)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    if (isValidLatLng(markerPosition)) {
      if (markerRef.current) {
        markerRef.current.setLatLng([markerPosition.lat, markerPosition.lng]);
        markerRef.current.setIcon(createCustomPinIcon(popupText, markerImage));
      } else {
        const marker = L.marker([markerPosition.lat, markerPosition.lng], {
          icon: createCustomPinIcon(popupText, markerImage),
          draggable: interactive && !!onMarkerChange,
          zIndexOffset: 600,
        });

        if (popupText) {
          marker.bindPopup(`
            <div style="font-family: sans-serif; padding: 4px; text-align: center; max-width: 180px;">
              ${markerImage ? `<img src="${markerImage}" alt="${popupText}" style="width: 100%; height: 75px; object-fit: cover; border-radius: 8px; margin-bottom: 6px;" />` : ''}
              <div style="font-weight: 700; font-size: 13px; color: #1c1917; line-height: 1.2;">${popupText}</div>
              <div style="font-size: 11px; color: #059669; font-weight: 600; margin-top: 3px;">📍 Exact Property Pinpoint</div>
            </div>
          `, {
            closeButton: false,
            className: 'custom-destination-popup',
            autoPan: true,
            autoPanPadding: [20, 40],
          });
        }

        if (interactive && onMarkerChange) {
          marker.on('dragend', () => {
            const pos = marker.getLatLng();
            onMarkerChange({ lat: pos.lat, lng: pos.lng });
          });
        }

        marker.addTo(map);
        markerRef.current = marker;
      }

      // If no route origin is active, center on the destination stay
      if (!isValidLatLng(origin)) {
        if (interactive && !!onMarkerChange) {
          // Normal center without auto-popup for draggable location pickers
          map.setView([markerPosition.lat, markerPosition.lng], zoom || 13, { animate: false });
        } else {
          // Offset down so rich popup is fully visible for display maps
          const pt = map.project([markerPosition.lat, markerPosition.lng], zoom || 13);
          pt.y -= 120;
          const offsetLatLng = map.unproject(pt, zoom || 13);
          map.setView(offsetLatLng, zoom || 13, { animate: false });
          
          // Automatically open the popup
          if (popupText) {
            setTimeout(() => {
              if (markerRef.current) markerRef.current.openPopup();
            }, 150);
          }
        }
      }
    } else if (markerRef.current) {
      map.removeLayer(markerRef.current);
      markerRef.current = null;
    }
  }, [mapReady, markerPosition, interactive, onMarkerChange, popupText, markerImage, origin, zoom]);

  // Update Origin Marker and Route Line (if origin provided)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    if (isValidLatLng(origin)) {
      if (originMarkerRef.current) {
        originMarkerRef.current.setLatLng([origin.lat, origin.lng]);
      } else {
        const marker = L.marker([origin.lat, origin.lng], {
          icon: createOriginIcon(originLabel),
          interactive: false,
        });
        marker.addTo(map);
        originMarkerRef.current = marker;
      }

      // Draw route connecting line
      if (isValidLatLng(markerPosition)) {
        const latlngs: [number, number][] = [
          [origin.lat, origin.lng],
          [markerPosition.lat, markerPosition.lng],
        ];

        if (polylineRef.current) {
          polylineRef.current.setLatLngs(latlngs);
        } else {
          const polyline = L.polyline(latlngs, {
            color: '#2563eb',
            weight: 4,
            dashArray: '6, 8',
            opacity: 0.85,
          });
          polyline.addTo(map);
          polylineRef.current = polyline;
        }

        // Fit bounds to both points
        const bounds = L.latLngBounds(latlngs);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    } else {
      if (originMarkerRef.current) {
        map.removeLayer(originMarkerRef.current);
        originMarkerRef.current = null;
      }
      if (polylineRef.current) {
        map.removeLayer(polylineRef.current);
        polylineRef.current = null;
      }
      // Re-center smoothly on property marker if origin was turned off
      if (isValidLatLng(markerPosition)) {
        if (interactive && !!onMarkerChange) {
          map.setView([markerPosition.lat, markerPosition.lng], zoom || 13, { animate: true });
        } else {
          const pt = map.project([markerPosition.lat, markerPosition.lng], zoom || 13);
          pt.y -= 120;
          const offsetLatLng = map.unproject(pt, zoom || 13);
          map.setView(offsetLatLng, zoom || 13, { animate: true });
        }
      }
    }
  }, [mapReady, origin, markerPosition, originLabel, zoom]);

  // Update User Live Location Marker & Accuracy Circle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    if (showUserLocation && isValidLatLng(userLocation)) {
      // User marker
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
      } else {
        const marker = L.marker([userLocation.lat, userLocation.lng], {
          icon: createUserLiveLocationIcon('You are here'),
          zIndexOffset: 1000,
        });

        marker.bindPopup(`
          <div class="p-2 text-stone-900 font-sans text-center">
            <div class="flex items-center justify-center gap-1.5 font-bold text-sm text-blue-700 mb-1">
              <span class="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
              Your Current Location
            </div>
            <p class="text-xs text-stone-600">
              ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}
            </p>
            ${userLocationAccuracy ? `<p class="text-[10px] text-stone-400 mt-1">Accuracy: within ~${Math.round(userLocationAccuracy)}m</p>` : ''}
          </div>
        `, {
          closeButton: false,
          className: 'custom-user-location-popup',
        });

        marker.addTo(map);
        userLocationMarkerRef.current = marker;
      }

      // Accuracy circle
      const radius = Math.max(50, Math.min(userLocationAccuracy || 150, 1500));
      if (userLocationCircleRef.current) {
        userLocationCircleRef.current.setLatLng([userLocation.lat, userLocation.lng]);
        userLocationCircleRef.current.setRadius(radius);
      } else {
        const circle = L.circle([userLocation.lat, userLocation.lng], {
          radius,
          color: '#2563eb',
          fillColor: '#3b82f6',
          fillOpacity: 0.12,
          weight: 1.5,
          dashArray: '3, 4',
        });
        circle.addTo(map);
        userLocationCircleRef.current = circle;
      }

      // Smooth pan to user location if active and no lodge specifically selected
      if (!selectedLodgeId) {
        map.panTo([userLocation.lat, userLocation.lng], { animate: true });
      }
    } else {
      if (userLocationMarkerRef.current) {
        map.removeLayer(userLocationMarkerRef.current);
        userLocationMarkerRef.current = null;
      }
      if (userLocationCircleRef.current) {
        map.removeLayer(userLocationCircleRef.current);
        userLocationCircleRef.current = null;
      }
    }
  }, [mapReady, userLocation, showUserLocation, userLocationAccuracy, selectedLodgeId]);

  // Connect User Location to Selected Lodge with Route Polyline & Distance Badge
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    if (showUserLocation && isValidLatLng(userLocation) && selectedLodge && isValidLatLng(selectedLodge.coordinates)) {
      const latlngs: [number, number][] = [
        [userLocation.lat, userLocation.lng],
        [selectedLodge.coordinates.lat, selectedLodge.coordinates.lng],
      ];

      // Draw route connecting polyline
      if (userRoutePolylineRef.current) {
        userRoutePolylineRef.current.setLatLngs(latlngs);
      } else {
        const polyline = L.polyline(latlngs, {
          color: '#059669',
          weight: 4,
          dashArray: '6, 8',
          opacity: 0.9,
        });
        polyline.addTo(map);
        userRoutePolylineRef.current = polyline;
      }

      // Add midpoint distance & driving time badge
      if (travelInfo) {
        const midLat = (userLocation.lat + selectedLodge.coordinates.lat) / 2;
        const midLng = (userLocation.lng + selectedLodge.coordinates.lng) / 2;

        const badgeHtml = `
          <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div class="px-2.5 py-1 bg-stone-900/95 text-white text-[11px] font-bold rounded-full shadow-2xl border border-emerald-400 flex items-center gap-1.5 whitespace-nowrap backdrop-blur-md">
              <span class="text-emerald-400 font-extrabold flex items-center gap-1">
                <span>🚗</span>
                <span>${travelInfo.drivingTimeFormatted}</span>
              </span>
              <span class="text-stone-500">·</span>
              <span class="text-stone-200">~${travelInfo.roadDistanceKm} km</span>
            </div>
          </div>
        `;

        const badgeIcon = L.divIcon({
          html: badgeHtml,
          className: 'custom-route-midpoint-badge',
          iconSize: [120, 26],
          iconAnchor: [60, 13],
        });

        if (midpointMarkerRef.current) {
          midpointMarkerRef.current.setLatLng([midLat, midLng]);
          midpointMarkerRef.current.setIcon(badgeIcon);
        } else {
          const marker = L.marker([midLat, midLng], {
            icon: badgeIcon,
            interactive: false,
            zIndexOffset: 920,
          });
          marker.addTo(map);
          midpointMarkerRef.current = marker;
        }
      }

      // Smoothly frame both User and Selected Lodge on the map
      const bounds = L.latLngBounds(latlngs);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    } else {
      if (userRoutePolylineRef.current) {
        map.removeLayer(userRoutePolylineRef.current);
        userRoutePolylineRef.current = null;
      }
      if (midpointMarkerRef.current) {
        map.removeLayer(midpointMarkerRef.current);
        midpointMarkerRef.current = null;
      }
    }
  }, [showUserLocation, userLocation, selectedLodge, travelInfo]);

  // Recenter map when center or marker changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (isValidLatLng(markerPosition) && !isValidLatLng(origin)) {
      if (interactive && !!onMarkerChange) {
        map.setView([markerPosition.lat, markerPosition.lng], zoom, { animate: true });
      } else {
        const pt = map.project([markerPosition.lat, markerPosition.lng], zoom || 13);
        pt.y -= 120;
        const offsetLatLng = map.unproject(pt, zoom || 13);
        map.setView(offsetLatLng, zoom, { animate: true });
      }
    } else if (isValidLatLng(center) && !isValidLatLng(markerPosition) && (!lodges || lodges.length === 0)) {
      map.setView([center.lat, center.lng], zoom, { animate: true });
    }
  }, [center, markerPosition, zoom, lodges]);

  // Invalidate map size on resize / fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
    setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 200);
  };

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  const handleCenterOnUser = () => {
    if (isValidLatLng(userLocation)) {
      mapInstanceRef.current?.setView([userLocation.lat, userLocation.lng], 13, { animate: true });
    }
  };

  const handleCenterOnRoute = () => {
    const map = mapInstanceRef.current;
    if (!map || !userLocation || !selectedLodge || !isValidLatLng(userLocation) || !isValidLatLng(selectedLodge.coordinates)) return;
    const bounds = L.latLngBounds([
      [userLocation.lat, userLocation.lng],
      [selectedLodge.coordinates.lat, selectedLodge.coordinates.lng],
    ]);
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
  };

  const handleCenterOnPin = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const target = isValidLatLng(markerPosition)
      ? markerPosition
      : isValidLatLng(center)
      ? center
      : MALAWI_CENTRE;
      
    if (isValidLatLng(markerPosition)) {
      const pt = map.project([target.lat, target.lng], 14);
      pt.y -= 120;
      const offsetLatLng = map.unproject(pt, 14);
      map.setView(offsetLatLng, 14, { animate: true });
    } else {
      map.setView([target.lat, target.lng], 14, { animate: true });
    }
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 shadow-inner isolate ${
        isFullscreen ? 'fixed inset-4 z-[2000] shadow-2xl' : `${heightClass} z-0`
      } ${className}`}
    >
      <div ref={containerRef} className="h-full w-full" />

      {/* Top-Left Offline & Cache Status Badge */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2 pointer-events-auto">
        {isOffline ? (
          <div className="bg-amber-900/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-xl backdrop-blur-md flex items-center gap-1.5 shadow-md border border-amber-700/60">
            <WifiOff className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span>Offline · Using Cached Map</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handlePreloadMalawi}
            disabled={isPrefetching}
            title="Download/Update offline map tiles for Malawi safari & lake regions"
            className="bg-white/95 hover:bg-stone-50 text-stone-700 hover:text-emerald-800 text-[11px] font-semibold px-2.5 py-1 rounded-xl border border-stone-200/90 backdrop-blur-md flex items-center gap-1.5 shadow-xs transition group"
          >
            {isPrefetching ? (
              <div className="w-3 h-3 border-2 border-stone-400 border-t-emerald-600 rounded-full animate-spin" />
            ) : (
              <CloudDownload className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
            )}
            <span>{isPrefetching ? 'Caching Malawi...' : 'Offline Map Ready'}</span>
          </button>
        )}
      </div>

      {/* Floating Controls */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
        {/* User Location Toggle on Map */}
        {onToggleUserLocation && (
          <button
            type="button"
            onClick={onToggleUserLocation}
            title={showUserLocation ? 'Hide My Location' : 'Show My Location'}
            className={`p-2.5 rounded-xl border shadow-md transition-all flex items-center justify-center ${
              showUserLocation
                ? 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-400/50 shadow-blue-500/20'
                : isLocatingUser
                ? 'bg-amber-50 text-amber-700 border-amber-300 animate-pulse'
                : 'bg-white/95 backdrop-blur-md text-stone-700 hover:text-blue-600 hover:bg-stone-50 border-stone-200/80'
            }`}
          >
            {isLocatingUser ? (
              <div className="w-4 h-4 border-2 border-stone-400 border-t-blue-600 rounded-full animate-spin" />
            ) : (
              <Navigation className={`h-4 w-4 ${showUserLocation ? 'fill-white' : ''}`} />
            )}
          </button>
        )}

        {/* Recenter on User Location */}
        {showUserLocation && isValidLatLng(userLocation) && (
          <button
            type="button"
            onClick={handleCenterOnUser}
            title="Center on My Location"
            className="p-2 bg-white/95 backdrop-blur-md text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-xl border border-blue-200 shadow-md transition"
          >
            <Locate className="h-4 w-4" />
          </button>
        )}

        {/* Fit Entire Route Bounds Button if User + Lodge Selected */}
        {showUserLocation && isValidLatLng(userLocation) && selectedLodge && isValidLatLng(selectedLodge.coordinates) && (
          <button
            type="button"
            onClick={handleCenterOnRoute}
            title="Fit Route (You to Stay)"
            className="p-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl border border-emerald-700 shadow-md transition animate-pulse"
          >
            <Route className="h-4 w-4" />
          </button>
        )}

        <div className="flex flex-col bg-white/95 backdrop-blur-md rounded-xl border border-stone-200/80 shadow-md overflow-hidden">
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In"
            className="p-2 text-stone-700 hover:bg-stone-100 hover:text-stone-900 border-b border-stone-100 transition"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out"
            className="p-2 text-stone-700 hover:bg-stone-100 hover:text-stone-900 transition"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
        </div>

        {isValidLatLng(markerPosition) && (
          <button
            type="button"
            onClick={handleCenterOnPin}
            title="Center on Pin"
            className="p-2 bg-white/95 backdrop-blur-md text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-xl border border-stone-200/80 shadow-md transition"
          >
            <Locate className="h-4 w-4" />
          </button>
        )}

        {showSatelliteToggle && (
          <button
            type="button"
            onClick={() => setMapType(m => (m === 'streets' ? 'satellite' : 'streets'))}
            title={`Switch to ${mapType === 'streets' ? 'Satellite' : 'Streets'} view`}
            className={`p-2 rounded-xl border border-stone-200/80 shadow-md transition ${
              mapType === 'satellite'
                ? 'bg-stone-900 text-white'
                : 'bg-white/95 backdrop-blur-md text-stone-700 hover:bg-stone-100'
            }`}
          >
            <Layers className="h-4 w-4" />
          </button>
        )}

        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
          className="p-2 bg-white/95 backdrop-blur-md text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-xl border border-stone-200/80 shadow-md transition"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Distance Measurement & Route Travel Time Overlay (Desktop & Mobile) */}
      {showDistanceOverlay && showUserLocation && isValidLatLng(userLocation) && selectedLodge && travelInfo && (
        <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-md z-30 pointer-events-auto">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-stone-200/90 shadow-2xl p-3.5 sm:p-4 space-y-3 text-stone-900 transition-all">
            {/* Header: Title, Category, and Actions */}
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 shadow-xs">
                  <Car className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md">
                      Route Measurement
                    </span>
                    {selectedLodge.category && (
                      <span className="text-[10px] text-stone-500 font-semibold truncate hidden xs:inline">
                        · {selectedLodge.category}
                      </span>
                    )}
                  </div>
                  <h4 className="font-serif font-bold text-stone-900 text-sm sm:text-base truncate mt-0.5 leading-snug">
                    {selectedLodge.name}
                  </h4>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsOverlayMinimized(prev => !prev)}
                  className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition"
                  title={isOverlayMinimized ? 'Expand details' : 'Minimize overlay'}
                >
                  <span className="text-xs font-bold">{isOverlayMinimized ? 'Show' : 'Hide'}</span>
                </button>
                {onClearSelectedLodge && (
                  <button
                    type="button"
                    onClick={onClearSelectedLodge}
                    className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition"
                    title="Close measurement overlay"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {!isOverlayMinimized && (
              <>
                {/* Distance & Travel Duration Metric Cards */}
                <div className="grid grid-cols-2 gap-2 bg-stone-50/90 rounded-xl p-2.5 border border-stone-100">
                  <div className="space-y-0.5">
                    <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide flex items-center gap-1">
                      <span>⏱️</span>
                      <span>Est. Drive Time</span>
                    </div>
                    <div className="text-sm sm:text-base font-black text-emerald-800 leading-tight">
                      {travelInfo.drivingTimeFormatted}
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide flex items-center gap-1">
                      <span>🛣️</span>
                      <span>Est. Road Distance</span>
                    </div>
                    <div className="text-sm sm:text-base font-black text-blue-700 leading-tight">
                      ~{travelInfo.roadDistanceKm} km
                    </div>
                  </div>
                </div>

                {/* Sub-metrics: Straight-line & Route Notes */}
                <div className="flex items-center justify-between text-[11px] text-stone-600 bg-white/60 px-2 py-1 rounded-lg border border-stone-100">
                  <span className="text-stone-500">
                    Direct distance: <strong className="text-stone-800">{travelInfo.straightLineKm} km</strong>
                  </span>
                  <span className="text-stone-400">·</span>
                  <span className="truncate text-emerald-800 font-medium">{travelInfo.notes}</span>
                </div>

                {/* Buttons Row: Google Directions + View Stay */}
                <div className="flex items-center gap-2 pt-1">
                  <a
                    href={getDirectionsUrl(userLocation, selectedLodge.coordinates, selectedLodge.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-[0.98]"
                  >
                    <Navigation className="w-3.5 h-3.5 fill-white" />
                    <span>Get Directions</span>
                    <ExternalLink className="w-3 h-3 opacity-80" />
                  </a>
                  <a
                    href={`/hotel/${selectedLodge.id}`}
                    className="inline-flex items-center justify-center gap-1 py-2.5 px-3.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition active:scale-[0.98]"
                  >
                    <span>View Stay</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {interactive && onMarkerChange && (
        <div className="absolute bottom-3 left-3 z-20 bg-stone-900/85 backdrop-blur-md px-3 py-1.5 rounded-lg text-[11px] font-medium text-white shadow-md pointer-events-none flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Click map or drag marker to set exact location
        </div>
      )}
    </div>
  );
}
