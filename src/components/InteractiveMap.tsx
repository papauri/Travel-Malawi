import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { LatLng, isValidLatLng, MALAWI_CENTRE, distanceKm, estimateTravelTime, getDirectionsUrl, fetchRoadRoute, RoadRouteResult } from '../lib/geo';
import { CurrencyCode } from '../types';
import { Layers, Locate, Maximize2, Minimize2, ZoomIn, ZoomOut, Navigation, Star, MapPin, Car, ArrowRight, ExternalLink, X, Compass, Route, WifiOff, CloudDownload, Download, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';


import { createCachedStreetLayer, createCachedSatelliteLayer, prefetchMalawiMapTiles } from '../lib/mapCache';

/** Escapes text for interpolation into Leaflet HTML strings. */
const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Only http(s) image URLs are rendered; anything else is dropped. */
const safeUrl = (url: unknown): string => {
  if (typeof url !== 'string') return '';
  return /^https?:\/\//i.test(url.trim()) ? esc(url.trim()) : '';
};

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
      <div class="relative w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-sm flex items-center justify-center">
        <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
      </div>
      
      <!-- Tooltip Tag -->
      <div class="absolute top-full mt-1.5 px-2 py-0.5 bg-blue-900/90 text-white text-[10px] font-bold rounded-md shadow-sm whitespace-nowrap border border-blue-700 pointer-events-none flex items-center gap-1">
        <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
        ${esc(label)}
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

// Compact SVG Pin for a single destination / property (small mode)
const createSmallPinIcon = (label?: string) => {
  const html = `
    <div style="position: relative; width: 32px; height: 42px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; cursor: pointer; pointer-events: auto;" title="${esc(label ? `${label} (Click to view hotel icon)` : 'Click to view hotel icon')}">
      <!-- Ground Anchor Glow -->
      <div style="position: absolute; bottom: -2px; left: 50%; transform: translateX(-50%); width: 14px; height: 6px; border-radius: 50%; background: rgba(16, 185, 129, 0.5); filter: blur(1.5px); pointer-events: none; z-index: 1;"></div>

      <!-- Compact Teardrop Pin SVG Silhouette -->
      <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg" style="position: absolute; top: 0; left: 50%; transform: translateX(-50%); filter: drop-shadow(0 4px 8px rgba(0,0,0,0.35)); z-index: 5;">
        <path d="M16 42C16 42 30 27.5 30 15.5C30 7.49187 23.732 1 16 1C8.26801 1 2 7.49187 2 15.5C2 27.5 16 42 16 42Z" fill="#1c1917" stroke="#ffffff" stroke-width="2"/>
      </svg>

      <!-- Center Emerald Hotel/Location Emblem -->
      <div style="position: absolute; top: 5px; left: 50%; transform: translateX(-50%); width: 21px; height: 21px; border-radius: 50%; background: #292524; display: flex; align-items: center; justify-content: center; color: #10b981; z-index: 10; box-shadow: inset 0 1px 3px rgba(0,0,0,0.5);">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 21h18"/>
          <path d="M5 21V7l8-4v18"/>
          <path d="M19 21V11l-6-3"/>
          <path d="M9 9v.01"/>
          <path d="M9 12v.01"/>
        </svg>
      </div>

      <!-- Bottom Tip Emerald Dot Anchor -->
      <div style="position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 5px; height: 5px; border-radius: 50%; background: #10b981; border: 1px solid #ffffff; z-index: 12; box-shadow: 0 0 6px #10b981;"></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-leaflet-marker custom-leaflet-small-pin',
    iconSize: [32, 42],
    iconAnchor: [16, 42],
  });
};

// Expanded SVG Pin for a single destination / property with photo thumbnail badge (hotel mode)
const createExpandedHotelIcon = (label?: string, image?: string) => {
  const html = `
    <div style="position: relative; width: 52px; height: 66px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; cursor: pointer; pointer-events: auto;" title="Click to show compact pin">
      ${label ? `
        <!-- Floating Hotel Name Pill Tag with Close Hint -->
        <div style="position: absolute; bottom: 70px; left: 50%; transform: translateX(-50%); padding: 4px 10px; background: #1c1917; color: #ffffff; font-size: 11px; font-weight: 700; border-radius: 9999px; box-shadow: 0 4px 14px rgba(0,0,0,0.35); white-space: nowrap; border: 1.5px solid rgba(255,255,255,0.25); display: flex; align-items: center; gap: 5px; max-width: 220px; z-index: 30; pointer-events: none;">
          <span style="width: 7px; height: 7px; border-radius: 9999px; background: #10b981; flex-shrink: 0; box-shadow: 0 0 8px #10b981;"></span>
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${esc(label)}</span>
        </div>
      ` : ''}

      <!-- Teardrop Pin Container -->
      <div style="position: relative; width: 46px; height: 58px; display: flex; flex-direction: column; align-items: center;">
        <!-- Base Ground Anchor Glow -->
        <div style="position: absolute; bottom: -3px; left: 50%; transform: translateX(-50%); width: 20px; height: 8px; border-radius: 50%; background: rgba(16, 185, 129, 0.45); filter: blur(1.5px); pointer-events: none; z-index: 1;"></div>

        <!-- Drop-Pin SVG Silhouette with Sharp Point Tip -->
        <svg width="46" height="58" viewBox="0 0 46 58" fill="none" xmlns="http://www.w3.org/2000/svg" style="position: absolute; top: 0; left: 50%; transform: translateX(-50%); filter: drop-shadow(0 6px 12px rgba(0,0,0,0.4)); z-index: 5;">
          <path d="M23 58C23 58 44 38.5 44 23C44 10.2975 34.598 0 23 0C11.402 0 2 10.2975 2 23C2 38.5 23 58 23 58Z" fill="#1c1917" stroke="#ffffff" stroke-width="2.5"/>
        </svg>

        <!-- Circular Stay Image Inset Framed Inside Pin Head -->
        <div style="position: absolute; top: 3.5px; left: 50%; transform: translateX(-50%); width: 39px; height: 39px; border-radius: 50%; overflow: hidden; background: #292524; display: flex; align-items: center; justify-content: center; z-index: 10;">
          ${safeUrl(image) ? `
            <img src="${safeUrl(image)}" alt="${esc(label || 'Stay')}" style="width: 100%; height: 100%; object-fit: cover; display: block;" referrerpolicy="no-referrer" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
            <div style="display: none; width: 100%; height: 100%; background: #1c1917; align-items: center; justify-content: center; color: #10b981;">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 21h18"/>
                <path d="M5 21V7l8-4v18"/>
                <path d="M19 21V11l-6-3"/>
                <path d="M9 9v.01"/>
                <path d="M9 12v.01"/>
                <path d="M9 15v.01"/>
                <path d="M9 18v.01"/>
              </svg>
            </div>
          ` : `
            <div style="width: 100%; height: 100%; background: #1c1917; display: flex; align-items: center; justify-content: center; color: #10b981;">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 21h18"/>
                <path d="M5 21V7l8-4v18"/>
                <path d="M19 21V11l-6-3"/>
                <path d="M9 9v.01"/>
                <path d="M9 12v.01"/>
                <path d="M9 15v.01"/>
                <path d="M9 18v.01"/>
              </svg>
            </div>
          `}
        </div>

        <!-- Precise Emerald Anchor Dot at Bottom Point -->
        <div style="position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 6px; height: 6px; border-radius: 50%; background: #10b981; border: 1px solid #ffffff; z-index: 12; box-shadow: 0 0 6px #10b981;"></div>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-leaflet-marker custom-leaflet-hotel-pin',
    iconSize: [52, 66],
    iconAnchor: [26, 66],
  });
};

// Custom SVG Pin for guest/origin location
const createOriginIcon = (label: string = 'Your Location') => {
  const html = `
    <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-full">
      <div class="relative flex items-center justify-center">
        <div class="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-sm ring-4 ring-white border border-blue-700">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </div>
        <div class="absolute -bottom-1 w-2 h-2 bg-blue-600 rotate-45"></div>
      </div>
      <div class="absolute top-full mt-1.5 px-2.5 py-1 bg-blue-900/90 text-white text-[11px] font-bold rounded-lg shadow-sm whitespace-nowrap border border-blue-700 pointer-events-none">${esc(label)}</div>
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

  if (isSelected) {
    // Only return an invisible anchor for the popup when selected
    // This removes the redundant price badge behind the popup card
    return L.divIcon({
      html: `<div class="opacity-0 w-8 h-8 pointer-events-none"></div>`,
      className: 'custom-lodge-marker-hidden bg-transparent border-none',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });
  }

  const bgClasses = 'bg-white text-stone-900 border border-stone-300 hover:border-emerald-600 hover:bg-stone-900 hover:text-white shadow-sm';

  const html = `
    <div class="relative flex flex-col items-center justify-center -translate-x-1/2 -translate-y-full cursor-pointer group">
      <div class="px-2.5 py-1 rounded-full font-bold text-xs transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap ${bgClasses}">
        <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
        <span class="tracking-tight">${priceDisplay}</span>
      </div>
      <div class="w-2 h-2 rotate-45 -mt-1 bg-white group-hover:bg-stone-900 transition-colors"></div>
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

  const imageHtml = safeUrl(lodge.image)
    ? `<div class="h-28 w-full bg-stone-100 overflow-hidden relative">
         <img src="${safeUrl(lodge.image)}" alt="${esc(lodge.name)}" class="w-full h-full object-cover" />
         ${lodge.category ? `<span class="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-stone-900/80 text-[10px] font-bold text-white uppercase tracking-wider">${esc(lodge.category)}</span>` : ''}
       </div>`
    : '';

  return `
    <div class="w-64 overflow-hidden rounded-2xl bg-white text-stone-900 font-sans shadow-sm">
      ${imageHtml}
      <div class="p-3.5 space-y-2">
        <div>
          <div class="font-serif font-bold text-base text-stone-900 leading-snug line-clamp-1">${esc(lodge.name)}</div>
          <div class="text-xs text-stone-500 flex items-center gap-1 mt-0.5 truncate">
            <svg class="w-3.5 h-3.5 text-stone-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            <span class="truncate">${esc(lodge.location)}</span>
          </div>
        </div>
        <div class="flex items-center justify-between pt-2 border-t border-stone-100">
          <div>${priceLabel}</div>
          <a href="/hotel/${encodeURIComponent(lodge.id)}" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-xs">
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
  zoom = 7,
  interactive = true,
  markerPosition,
  markerImage,
  onMarkerChange,
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
  const userRouteCasingRef = useRef<L.Polyline | null>(null);
  const userRoutePolylineRef = useRef<L.Polyline | null>(null);
  const midpointMarkerRef = useRef<L.Marker | null>(null);
  const polylineCasingRef = useRef<L.Polyline | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  
  // Cluster and markers layer ref
  const clusterGroupRef = useRef<any>(null);
  const lodgeMarkersMapRef = useRef<Map<string, L.Marker>>(new Map());

  const [userRoadRoute, setUserRoadRoute] = useState<RoadRouteResult | null>(null);
  const [isCalculatingUserRoute, setIsCalculatingUserRoute] = useState(false);
  const [originRoadRoute, setOriginRoadRoute] = useState<RoadRouteResult | null>(null);

  const [mapType, setMapType] = useState<'streets' | 'satellite'>('streets');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isOverlayMinimized, setIsOverlayMinimized] = useState(false);
  const { isOnline } = useNetworkStatus();
  const isOffline = !isOnline;
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const onMarkerChangeRef = useRef(onMarkerChange);
  onMarkerChangeRef.current = onMarkerChange;
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [isPinExpanded, setIsPinExpanded] = useState(false);

  // Fullscreen is a fixed overlay: hold the page still behind it and let Escape leave it.
  useBodyScrollLock(isFullscreen);
  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
        setTimeout(() => mapInstanceRef.current?.invalidateSize(), 200);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen]);

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

  // Fetch real road route (via OSRM road network avoiding water bodies) when user and lodge are selected
  useEffect(() => {
    let cancelled = false;

    if (showUserLocation && isValidLatLng(userLocation) && selectedLodge && isValidLatLng(selectedLodge.coordinates)) {
      setIsCalculatingUserRoute(true);
      fetchRoadRoute(userLocation, selectedLodge.coordinates, selectedLodge.name)
        .then(route => {
          if (!cancelled) {
            setUserRoadRoute(route);
            setIsCalculatingUserRoute(false);
          }
        })
        .catch(err => {
          if (!cancelled) {
            console.warn('Road route fetch error:', err);
            setIsCalculatingUserRoute(false);
          }
        });
    } else {
      setUserRoadRoute(null);
      setIsCalculatingUserRoute(false);
    }

    return () => {
      cancelled = true;
    };
  }, [showUserLocation, userLocation, selectedLodge]);

  // Compute live travel estimate between user location and selected lodge
  // Prefers real road calculation from road network (OSRM), fallbacks to terrain-aware estimate
  const travelInfo = useMemo(() => {
    if (!showUserLocation || !userLocation || !selectedLodge || !isValidLatLng(userLocation) || !isValidLatLng(selectedLodge.coordinates)) {
      return null;
    }
    if (userRoadRoute) {
      return userRoadRoute;
    }
    const straightKm = distanceKm(userLocation, selectedLodge.coordinates);
    return estimateTravelTime(straightKm, userLocation, selectedLodge.coordinates, selectedLodge.name);
  }, [showUserLocation, userLocation, selectedLodge, userRoadRoute]);

  // Fetch road route for Origin -> Destination (single pin / directions mode)
  useEffect(() => {
    let cancelled = false;
    if (isValidLatLng(origin) && isValidLatLng(markerPosition)) {
      fetchRoadRoute(origin, markerPosition, popupText)
        .then(route => {
          if (!cancelled) setOriginRoadRoute(route);
        })
        .catch(() => {});
    } else {
      setOriginRoadRoute(null);
    }
    return () => {
      cancelled = true;
    };
  }, [origin, markerPosition, popupText]);

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
      
      dragging: interactive,
      touchZoom: interactive,
      doubleClickZoom: interactive,
    });

    if (interactive) {
      L.control.zoom({ position: 'bottomright' }).addTo(map);
    }

    const streetLayer = createCachedStreetLayer();
    streetLayer.addTo(map);
    tileLayerRef.current = streetLayer;
    mapInstanceRef.current = map;
    setMapReady(true);

    // Ensure map tiles and container geometry calculate correctly
    const resizeTimer = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 150);

    // Watch for container resizes
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        mapInstanceRef.current?.invalidateSize();
      });
      resizeObserver.observe(containerRef.current);
    }

    // Handle map clicks in interactive single-pin mode
    if (interactive && onMarkerChange) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        const newCoords = { lat: e.latlng.lat, lng: e.latlng.lng };
        onMarkerChangeRef.current?.(newCoords);
      });
    }

    // Popup "View" links are plain anchors inside Leaflet's HTML; keep them in
    // the SPA instead of reloading the whole app.
    map.on('popupopen', (e: L.PopupEvent) => {
      const link = e.popup.getElement()?.querySelector<HTMLAnchorElement>('a[href^="/hotel/"]');
      if (!link || link.dataset.spaBound) return;
      link.dataset.spaBound = '1';
      link.addEventListener('click', (ev) => {
        if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
        ev.preventDefault();
        navigateRef.current(link.getAttribute('href') || '/');
      });
    });

    return () => {
      clearTimeout(resizeTimer);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      setMapReady(false);
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
      originMarkerRef.current = null;
      userLocationMarkerRef.current = null;
      userLocationCircleRef.current = null;
      userRouteCasingRef.current = null;
      userRoutePolylineRef.current = null;
      midpointMarkerRef.current = null;
      polylineRef.current = null;
      polylineCasingRef.current = null;
      tileLayerRef.current = null;
      clusterGroupRef.current = null;
      lodgeMarkersMapRef.current.clear();
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
          let bgStyle = 'bg-stone-900 text-white ring-4 ring-white/90 border border-stone-700 shadow-sm';
          if (count >= 15) {
            size = 52;
            bgStyle = 'bg-amber-700 text-white ring-4 ring-amber-500/30 border border-amber-600 shadow-sm';
          } else if (count >= 6) {
            size = 46;
            bgStyle = 'bg-stone-900 text-amber-300 ring-4 ring-stone-900/40 border border-stone-600 shadow-sm';
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
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 13 });
    }
  }, [mapReady, lodges, enableClustering, showLodgePopups, fitBoundsToLodges]);

  // Update marker icons when selectedLodgeId changes
  useEffect(() => {
    if (!lodges || lodges.length === 0) return;
    // Popups open on a delay; if the map is torn down first, opening one on a
    // marker with no map throws.
    const timers: ReturnType<typeof setTimeout>[] = [];
    lodges.forEach(lodge => {
      const marker = lodgeMarkersMapRef.current.get(lodge.id);
      if (marker) {
        const isSelected = selectedLodgeId === lodge.id;
        marker.setIcon(createLodgePinIcon(lodge, isSelected));
        if (isSelected) {
          if (showLodgePopups) {
            marker.setPopupContent(createPopupHtml(lodge));
          }
          const map = mapInstanceRef.current;
          if (clusterGroupRef.current && typeof clusterGroupRef.current.zoomToShowLayer === 'function') {
            clusterGroupRef.current.zoomToShowLayer(marker, () => {
              if (map) {
                map.flyTo([lodge.coordinates.lat, lodge.coordinates.lng], 12, { animate: true, duration: 1 });
              }
              timers.push(setTimeout(() => {
                if (mapInstanceRef.current) marker.openPopup();
              }, 200));
            });
          } else {
            if (map) {
              map.flyTo([lodge.coordinates.lat, lodge.coordinates.lng], 12, { animate: true, duration: 1 });
            }
            timers.push(setTimeout(() => {
              if (marker && mapInstanceRef.current) marker.openPopup();
            }, 500));
          }
        }
      }
    });
    return () => timers.forEach(clearTimeout);
  }, [selectedLodgeId, lodges, showLodgePopups]);

  // Update Destination / Property Marker (Single Pin Mode)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    if (isValidLatLng(markerPosition)) {
      const activeIcon = isPinExpanded
        ? createExpandedHotelIcon(popupText, markerImage)
        : createSmallPinIcon(popupText);

      if (markerRef.current) {
        markerRef.current.setLatLng([markerPosition.lat, markerPosition.lng]);
        markerRef.current.setIcon(activeIcon);
      } else {
        const marker = L.marker([markerPosition.lat, markerPosition.lng], {
          icon: activeIcon,
          draggable: interactive && !!onMarkerChange,
          zIndexOffset: 600,
        });

        if (interactive && onMarkerChange) {
          marker.on('dragend', () => {
            const pos = marker.getLatLng();
            onMarkerChangeRef.current?.({ lat: pos.lat, lng: pos.lng });
          });
        }

        marker.addTo(map);
        markerRef.current = marker;
      }

      // Toggle between small pin and hotel icon on click (no popup overlay)
      markerRef.current.off('click');
      markerRef.current.on('click', () => {
        setIsPinExpanded(prev => !prev);
      });

      // Central mapping: Ensure marker coordinate is always centrally positioned
      if (!isValidLatLng(origin)) {
        map.panTo([markerPosition.lat, markerPosition.lng], { animate: true, duration: 0.35 });
      }
    } else if (markerRef.current) {
      map.removeLayer(markerRef.current);
      markerRef.current = null;
    }
  }, [mapReady, markerPosition, interactive, onMarkerChange, popupText, markerImage, origin, zoom, isPinExpanded]);

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

      // Draw real road route connecting line
      if (isValidLatLng(markerPosition)) {
        const roadCoords: [number, number][] =
          originRoadRoute && originRoadRoute.coordinates.length > 1
            ? originRoadRoute.coordinates
            : [
                [origin.lat, origin.lng],
                [markerPosition.lat, markerPosition.lng],
              ];

        // Google Maps blue route casing / shadow
        if (polylineCasingRef.current) {
          polylineCasingRef.current.setLatLngs(roadCoords);
        } else {
          const casing = L.polyline(roadCoords, {
            color: '#1e3a8a',
            weight: 7.5,
            opacity: 0.35,
            lineCap: 'round',
            lineJoin: 'round',
          });
          casing.addTo(map);
          polylineCasingRef.current = casing;
        }

        // Google Maps vibrant blue road polyline
        if (polylineRef.current) {
          polylineRef.current.setLatLngs(roadCoords);
        } else {
          const polyline = L.polyline(roadCoords, {
            color: '#2563eb',
            weight: 4.5,
            opacity: 0.95,
            lineCap: 'round',
            lineJoin: 'round',
          });
          polyline.addTo(map);
          polylineRef.current = polyline;
        }

        // Fit bounds to entire road route
        const bounds = L.latLngBounds(roadCoords);
        map.fitBounds(bounds, { padding: [120, 120], maxZoom: 13 });
      }
    } else {
      if (originMarkerRef.current) {
        map.removeLayer(originMarkerRef.current);
        originMarkerRef.current = null;
      }
      if (polylineCasingRef.current) {
        map.removeLayer(polylineCasingRef.current);
        polylineCasingRef.current = null;
      }
      if (polylineRef.current) {
        map.removeLayer(polylineRef.current);
        polylineRef.current = null;
      }
      // Re-center smoothly on property marker if origin was turned off
      if (isValidLatLng(markerPosition)) {
        map.setView([markerPosition.lat, markerPosition.lng], zoom || 13, { animate: true });
      }
    }
  }, [mapReady, origin, markerPosition, originLabel, originRoadRoute, zoom]);

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

  // Connect User Location to Selected Lodge with Real Road Polyline & Road Distance Badge
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    if (showUserLocation && isValidLatLng(userLocation) && selectedLodge && isValidLatLng(selectedLodge.coordinates)) {
      const roadCoords: [number, number][] =
        userRoadRoute && userRoadRoute.coordinates.length > 1
          ? userRoadRoute.coordinates
          : [
              [userLocation.lat, userLocation.lng],
              [selectedLodge.coordinates.lat, selectedLodge.coordinates.lng],
            ];

      // Draw route underlayer casing (Google Maps route shadow)
      if (userRouteCasingRef.current) {
        userRouteCasingRef.current.setLatLngs(roadCoords);
      } else {
        const casing = L.polyline(roadCoords, {
          color: '#1e3a8a',
          weight: 7.5,
          opacity: 0.35,
          lineCap: 'round',
          lineJoin: 'round',
        });
        casing.addTo(map);
        userRouteCasingRef.current = casing;
      }

      // Draw route main polyline (Google Maps vibrant blue)
      if (userRoutePolylineRef.current) {
        userRoutePolylineRef.current.setLatLngs(roadCoords);
      } else {
        const polyline = L.polyline(roadCoords, {
          color: '#2563eb',
          weight: 4.5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        });
        polyline.addTo(map);
        userRoutePolylineRef.current = polyline;
      }

      // Add midpoint distance & driving time badge along the actual road
      if (travelInfo) {
        let midLat: number;
        let midLng: number;
        if (userRoadRoute && userRoadRoute.coordinates.length > 2) {
          const midIdx = Math.floor(userRoadRoute.coordinates.length / 2);
          midLat = userRoadRoute.coordinates[midIdx][0];
          midLng = userRoadRoute.coordinates[midIdx][1];
        } else {
          midLat = (userLocation.lat + selectedLodge.coordinates.lat) / 2;
          midLng = (userLocation.lng + selectedLodge.coordinates.lng) / 2;
        }

        const badgeHtml = `
          <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div class="px-2.5 py-1 bg-stone-900/95 text-white text-[11px] font-bold rounded-full shadow-sm border border-blue-500/80 flex items-center gap-1.5 whitespace-nowrap">
              <span class="text-blue-400 font-extrabold flex items-center gap-1">
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

      // Smoothly frame entire road route on the map
      const bounds = L.latLngBounds(roadCoords);
      map.fitBounds(bounds, { paddingTopLeft: [120, 280], paddingBottomRight: [120, 120], maxZoom: 11 });
    } else {
      if (userRouteCasingRef.current) {
        map.removeLayer(userRouteCasingRef.current);
        userRouteCasingRef.current = null;
      }
      if (userRoutePolylineRef.current) {
        map.removeLayer(userRoutePolylineRef.current);
        userRoutePolylineRef.current = null;
      }
      if (midpointMarkerRef.current) {
        map.removeLayer(midpointMarkerRef.current);
        midpointMarkerRef.current = null;
      }
    }
  }, [showUserLocation, userLocation, selectedLodge, userRoadRoute, travelInfo]);

  // Recenter map when center or marker changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (isValidLatLng(markerPosition) && !isValidLatLng(origin)) {
      // Don't auto-recenter when dragging the marker in interactive mode to avoid jerky movement and zoom loss.
      // If we *must* recenter (e.g., initial load or external coordinates change), do it gracefully.
      // To prevent constant recentering while dragging, we will ONLY flyTo if the marker is very far offscreen,
      // but otherwise let the user pan themselves.
      if (interactive && !!onMarkerChange) {
         // Do nothing automatically here to preserve user pan/zoom while dropping pins
      } else {
        const currentZoom = zoom || map.getZoom() || 13;
        map.setView([markerPosition.lat, markerPosition.lng], currentZoom, { animate: true });
      }
    } else if (isValidLatLng(center) && !isValidLatLng(markerPosition) && (!lodges || lodges.length === 0)) {
      map.setView([center.lat, center.lng], map.getZoom(), { animate: true });
    }
  }, [center, markerPosition, zoom, lodges, interactive, onMarkerChange, origin]);

  // On a phone, a one-finger drag on a browse map would swallow the page scroll
  // and strand the visitor inside it. Pinch (two fingers) still zooms and moves
  // the map; fullscreen and pin-picking maps keep one-finger panning.
  const pinPicking = !!onMarkerChange;
  const touchScrollsPage = L.Browser.mobile && !isFullscreen && !pinPicking && !!lodges;
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady || !interactive) return;
    if (touchScrollsPage) map.dragging.disable();
    else map.dragging.enable();
  }, [mapReady, interactive, touchScrollsPage]);
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
    map.fitBounds(bounds, { paddingTopLeft: [120, 280], paddingBottomRight: [120, 120], maxZoom: 11 });
  };

  const handleCenterOnPin = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const target = isValidLatLng(markerPosition)
      ? markerPosition
      : isValidLatLng(center)
      ? center
      : MALAWI_CENTRE;
      
    const targetZoom = zoom || 14;
    map.setView([target.lat, target.lng], targetZoom, { animate: true });
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-stone-200 bg-stone-100 isolate ${
        isFullscreen ? 'fixed inset-4 z-[2000] shadow-sm' : `${heightClass} z-0`
      } ${interactive && onMarkerChange ? 'pick-location-mode' : ''} ${className}`}
    >
      <div ref={containerRef} className="h-full w-full" />

      {/* Top-Left Offline & Cache Status Badge + Pin View Mode Toggle */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2 pointer-events-auto">
        {isOffline ? (
          <div className="bg-amber-900/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-xl flex items-center gap-1.5 shadow-sm border border-amber-700/60">
            <WifiOff className="w-3.5 h-3.5 text-amber-300" />
            <span>Offline, showing saved map</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handlePreloadMalawi}
            disabled={isPrefetching}
            title="Save map tiles for the safari and lake regions so they work without signal"
            className="bg-white/95 hover:bg-stone-50 text-stone-700 hover:text-emerald-800 text-[11px] font-semibold px-2.5 py-1 rounded-xl border border-stone-200/90 flex items-center gap-1.5 shadow-xs transition group"
          >
            {isPrefetching ? (
              <div className="w-3 h-3 border-2 border-stone-400 border-t-emerald-600 rounded-full animate-spin" />
            ) : (
              <CloudDownload className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
            )}
            <span>{isPrefetching ? 'Saving map...' : 'Save map offline'}</span>
          </button>
        )}

        {/* Quick Toggle Chip: Switch between compact pin and hotel photo icon */}
        {isValidLatLng(markerPosition) && (
          <button
            type="button"
            onClick={() => {
              setIsPinExpanded(prev => !prev);
              if (mapInstanceRef.current && isValidLatLng(markerPosition)) {
                mapInstanceRef.current.panTo([markerPosition.lat, markerPosition.lng], { animate: true, duration: 0.35 });
              }
            }}
            title={isPinExpanded ? 'Switch to compact pin' : 'Show hotel photo icon'}
            aria-label={isPinExpanded ? 'Switch to compact pin' : 'Show hotel photo icon'}
            className="bg-white/95 hover:bg-stone-50 text-stone-800 hover:text-emerald-800 text-[11px] font-semibold px-2.5 py-1 rounded-xl border border-stone-200/90 flex items-center gap-1.5 shadow-xs transition cursor-pointer"
          >
            {isPinExpanded ? (
              <>
                <MapPin className="w-3.5 h-3.5 text-stone-600" />
                <span>Small pin</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Photo pin</span>
              </>
            )}
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
            aria-label={showUserLocation ? 'Hide my location' : 'Show my location'}
            aria-pressed={showUserLocation}
            className={`p-2.5 rounded-xl border shadow-sm transition-all flex items-center justify-center ${
              showUserLocation
                ? 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-400/50 shadow-blue-500/20'
                : isLocatingUser
                ? 'bg-amber-50 text-amber-700 border-amber-300 animate-pulse'
                : 'bg-white/95 text-stone-700 hover:text-blue-600 hover:bg-stone-50 border-stone-200/80'
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
            aria-label="Center on my location"
            className="p-2 bg-white/95 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-xl border border-blue-200 shadow-sm transition"
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
            aria-label="Fit route from you to the stay"
            className="p-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl border border-emerald-700 shadow-sm transition"
          >
            <Route className="h-4 w-4" />
          </button>
        )}

        <div className="flex flex-col bg-white/95 rounded-xl border border-stone-200/80 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In"
            aria-label="Zoom in"
            className="p-2 text-stone-700 hover:bg-stone-100 hover:text-stone-900 border-b border-stone-100 transition"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out"
            aria-label="Zoom out"
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
            aria-label="Center on pin"
            className="p-2 bg-white/95 text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-xl border border-stone-200/80 shadow-sm transition"
          >
            <Locate className="h-4 w-4" />
          </button>
        )}

        {showSatelliteToggle && (
          <button
            type="button"
            onClick={() => setMapType(m => (m === 'streets' ? 'satellite' : 'streets'))}
            title={`Switch to ${mapType === 'streets' ? 'Satellite' : 'Streets'} view`}
            aria-label={`Switch to ${mapType === 'streets' ? 'satellite' : 'streets'} view`}
            className={`p-2 rounded-xl border border-stone-200/80 shadow-sm transition ${
              mapType === 'satellite'
                ? 'bg-stone-900 text-white'
                : 'bg-white/95 text-stone-700 hover:bg-stone-100'
            }`}
          >
            <Layers className="h-4 w-4" />
          </button>
        )}

        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
          aria-label={isFullscreen ? 'Exit fullscreen map' : 'Fullscreen map'}
          className="p-2 bg-white/95 text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-xl border border-stone-200/80 shadow-sm transition"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Distance Measurement & Route Travel Time Overlay (Desktop & Mobile) */}
      {showDistanceOverlay && showUserLocation && isValidLatLng(userLocation) && selectedLodge && travelInfo && (
        <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-md z-30 pointer-events-auto">
          <div className="bg-white/95 rounded-2xl border border-stone-200/90 shadow-sm p-3.5 sm:p-4 space-y-3 text-stone-900 transition-all">
            {/* Header: Title, Category, and Actions */}
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 shadow-xs">
                  <Navigation className="w-4 h-4 fill-blue-600/20" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-800 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-md">
                      Road Navigation
                    </span>
                    {isCalculatingUserRoute && (
                      <span className="text-[10px] text-stone-400 animate-pulse font-medium">Calculating road...</span>
                    )}
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
                  aria-expanded={!isOverlayMinimized}
                >
                  <span className="text-xs font-bold">{isOverlayMinimized ? 'Show' : 'Hide'}</span>
                </button>
                {onClearSelectedLodge && (
                  <button
                    type="button"
                    onClick={onClearSelectedLodge}
                    className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition"
                    title="Close measurement overlay"
            aria-label="Close route details"
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
                      <Clock className="w-3 h-3 text-stone-400" />
                      <span>Driving Duration</span>
                    </div>
                    <div className="text-sm sm:text-base font-black text-stone-900 leading-tight">
                      {travelInfo.drivingTimeFormatted}
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide flex items-center gap-1">
                      <Route className="w-3 h-3 text-stone-400" />
                      <span>Highway Distance</span>
                    </div>
                    <div className="text-sm sm:text-base font-black text-blue-700 leading-tight">
                      ~{travelInfo.roadDistanceKm} km
                    </div>
                  </div>
                </div>

                {/* Sub-metrics: Direct Distance & Route Notes */}
                <div className="flex items-center justify-between text-[11px] text-stone-600 bg-white/60 px-2 py-1 rounded-lg border border-stone-100">
                  <span className="text-stone-500">
                    Direct distance: <strong className="text-stone-800">{travelInfo.straightLineKm} km</strong>
                  </span>
                  <span className="text-stone-400">·</span>
                  <span className="truncate text-blue-800 font-medium">{travelInfo.notes}</span>
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
                    <span>Open in Google Maps</span>
                    <ExternalLink className="w-3 h-3 opacity-80" />
                  </a>
                  <Link
                    to={`/hotel/${encodeURIComponent(selectedLodge.id)}`}
                    className="inline-flex items-center justify-center gap-1 py-2.5 px-3.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition active:scale-[0.98]"
                  >
                    <span>View Stay</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {touchScrollsPage && !(showDistanceOverlay && showUserLocation && selectedLodge) && (
        <div className="absolute bottom-3 left-3 z-20 bg-stone-900/80 px-2.5 py-1 rounded-lg text-[10px] font-medium text-white pointer-events-none">
          Use two fingers to move the map
        </div>
      )}

      {interactive && onMarkerChange && (
        <div className="absolute bottom-3 left-3 z-20 bg-stone-900/85 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white shadow-sm pointer-events-none flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          Click map or drag marker to set exact location
        </div>
      )}
    </div>
  );
}







