/**
 * Interactive Location & Map Pin Picker for Property Managers.
 *
 * Allows managers to:
 * 1. Search locations within the map window (addresses, landmarks, towns, or existing properties).
 * 2. Pick existing registered properties or known Malawi landmarks with 1 click.
 * 3. Click directly on the interactive map or drag the pin to set exact coordinates.
 * 4. Use device GPS or paste Google Maps coordinates/links.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Crosshair,
  LocateFixed,
  MapPin,
  Search,
  Trash2,
  TriangleAlert,
  Building,
  Compass,
  Check,
  Globe,
  Loader2,
  ChevronRight,
  X,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  LatLng,
  MALAWI_CENTRE,
  MALAWI_KNOWN_PLACES,
  PIN_PROBLEM_LABELS,
  formatCoordinates,
  isValidLatLng,
  parseCoordinates,
  pinProblem,
  searchNominatim,
  GeocodeResult,
  KnownPlace,
  distanceKm,
} from '../lib/geo';
import InteractiveMap from './InteractiveMap';

interface Props {
  value: LatLng | null | undefined;
  onChange: (value: LatLng | null) => void;
  /** Falls back to this on the map when there is no pin yet. */
  locationText?: string;
  label?: string;
  onLocationSelect?: (info: { name?: string; location?: string; coordinates: LatLng }) => void;
}

const POPULAR_REGIONS: { label: string; coords: LatLng; zoom: number }[] = [
  { label: 'Lilongwe', coords: { lat: -13.9626, lng: 33.7741 }, zoom: 12 },
  { label: 'Blantyre', coords: { lat: -15.7861, lng: 35.0058 }, zoom: 12 },
  { label: 'Cape Maclear', coords: { lat: -14.0267, lng: 34.8519 }, zoom: 14 },
  { label: 'Salima / Senga Bay', coords: { lat: -13.7231, lng: 34.6192 }, zoom: 13 },
  { label: 'Mangochi', coords: { lat: -14.4781, lng: 35.2645 }, zoom: 12 },
  { label: 'Zomba Plateau', coords: { lat: -15.3524, lng: 35.3126 }, zoom: 13 },
  { label: 'Mzuzu', coords: { lat: -11.4583, lng: 34.0167 }, zoom: 12 },
  { label: 'Nkhata Bay', coords: { lat: -11.6067, lng: 34.2908 }, zoom: 13 },
  { label: 'Likoma Island', coords: { lat: -12.0622, lng: 34.7351 }, zoom: 13 },
  { label: 'Liwonde Safari', coords: { lat: -14.8512, lng: 35.2891 }, zoom: 12 },
  { label: 'Nyika Plateau', coords: { lat: -10.5847, lng: 33.8053 }, zoom: 11 },
];

export default function LocationPicker({
  value,
  onChange,
  locationText,
  label = 'Property Location & Map Pin',
  onLocationSelect,
}: Props) {
  const [paste, setPaste] = useState('');
  const [locating, setLocating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedPlaceName, setSelectedPlaceName] = useState<string | null>(null);

  // Existing properties from database
  const [existingHotels, setExistingHotels] = useState<
    { id: string; name: string; location: string; coordinates?: LatLng }[]
  >([]);
  const [onlineResults, setOnlineResults] = useState<GeocodeResult[]>([]);

  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const pin = isValidLatLng(value) ? (value as LatLng) : null;
  const problem = value === null || value === undefined ? null : pinProblem(value);

  // Fetch existing hotels from Firestore for instant matching
  useEffect(() => {
    let isMounted = true;
    async function loadHotels() {
      try {
        const q = query(collection(db, 'hotels'), limit(80));
        const snapshot = await getDocs(q);
        if (isMounted) {
          const list = snapshot.docs.map(doc => {
            const d = doc.data();
            return {
              id: doc.id,
              name: d.name || 'Unnamed Property',
              location: d.location || '',
              coordinates: isValidLatLng(d.coordinates) ? d.coordinates : undefined,
            };
          });
          setExistingHotels(list);
        }
      } catch (e) {
        console.error('Error fetching existing hotels for location search:', e);
      }
    }
    loadHotels();
    return () => {
      isMounted = false;
    };
  }, []);

  // Close search results when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowSearchResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter matching existing database hotels and known places
  const localMatches = useMemo(() => {
    const queryLower = searchQuery.trim().toLowerCase();
    if (!queryLower) return { existing: [], known: [] };

    const existing = existingHotels.filter(
      h =>
        h.coordinates &&
        (h.name.toLowerCase().includes(queryLower) ||
          h.location.toLowerCase().includes(queryLower))
    );

    const known = MALAWI_KNOWN_PLACES.filter(
      p =>
        p.name.toLowerCase().includes(queryLower) ||
        p.location.toLowerCase().includes(queryLower) ||
        p.region.toLowerCase().includes(queryLower)
    );

    return { existing, known };
  }, [searchQuery, existingHotels]);

  // Perform debounced live geocoding search for street/town queries
  useEffect(() => {
    const queryClean = searchQuery.trim();
    if (queryClean.length < 3) {
      setOnlineResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchNominatim(queryClean, 5);
        setOnlineResults(results);
      } catch (err) {
        console.error('Geocoding search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 450);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  const handlePickPlace = (
    place: { name: string; location?: string; coordinates: LatLng },
    sourceType: 'existing' | 'known' | 'osm'
  ) => {
    onChange(place.coordinates);
    setSelectedPlaceName(place.name);
    setShowSearchResults(false);
    setSearchQuery('');

    if (onLocationSelect) {
      onLocationSelect({
        name: place.name,
        location: place.location,
        coordinates: place.coordinates,
      });
    }

    const sourceLabel =
      sourceType === 'existing'
        ? 'Existing Property'
        : sourceType === 'known'
        ? 'Verified Landmark'
        : 'Location';

    toast.success(`Pin set to ${place.name} (${sourceLabel})`);
  };

  const applyPaste = () => {
    const parsed = parseCoordinates(paste);
    if (!parsed) {
      toast.error('Could not find coordinates. Paste a Google Maps link or "-13.98, 33.78".');
      return;
    }
    onChange(parsed);
    setSelectedPlaceName(null);
    setPaste('');
    toast.success(`Pin set to ${formatCoordinates(parsed, 4)}.`);
  };

  const useMyPosition = async () => {
    if (!navigator.geolocation) {
      toast.error('This browser will not share a location.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      position => {
        
        setLocating(false);
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        onChange(coords);
        setSelectedPlaceName('Your Current GPS Location');
        toast.success('Pin dropped at your current position.');
      },
      () => {
        setLocating(false);
        toast.error('Could not read your location. Check browser permissions.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const setPart = (part: keyof LatLng, raw: string) => {
    const parsed = Number(raw);
    const base = pin ?? MALAWI_CENTRE;
    if (raw.trim() === '') {
      onChange(null);
      setSelectedPlaceName(null);
      return;
    }
    if (!Number.isFinite(parsed)) return;
    onChange({ ...base, [part]: parsed });
    setSelectedPlaceName(null);
  };

  const totalResultsCount =
    localMatches.existing.length + localMatches.known.length + onlineResults.length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider">
          {label}
        </label>
        {pin && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setSelectedPlaceName(null);
            }}
            className="flex items-center gap-1 text-xs font-semibold text-stone-400 hover:text-red-600 transition"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove pin
          </button>
        )}
      </div>

      {/* Main Search & Location Window */}
      <div
        ref={searchContainerRef}
        className="relative rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
      >
        {/* Search Bar inside Window */}
        <div className="relative mb-3">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 h-4 w-4 text-stone-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => setShowSearchResults(true)}
              placeholder="Search address, landmark, town, or existing hotel in Malawi..."
              className="w-full bg-stone-50 border border-stone-200 pl-10 pr-24 py-2.5 rounded-xl text-sm outline-none focus:border-stone-900 focus:bg-white transition"
            />
            {isSearching && (
              <Loader2 className="absolute right-12 h-4 w-4 animate-spin text-stone-400" />
            )}
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setShowSearchResults(false);
                }}
                className="absolute right-3 p-1 text-stone-400 hover:text-stone-700"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Search Dropdown / Autocomplete Results */}
          {showSearchResults && searchQuery.trim().length >= 2 && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-80 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-2 shadow-2xl scrollbar-slim">
              {totalResultsCount === 0 && !isSearching ? (
                <div className="p-4 text-center text-sm text-stone-500">
                  No places found for "{searchQuery}". You can click anywhere on the map below or paste coordinates.
                </div>
              ) : (
                <div className="space-y-2">
                  {/* 1. Existing properties in database */}
                  {localMatches.existing.length > 0 && (
                    <div>
                      <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 rounded-lg flex items-center gap-1.5 mb-1">
                        <Building className="h-3 w-3" /> Existing Registered Properties
                      </div>
                      {localMatches.existing.map(hotel => (
                        <button
                          key={`hotel-${hotel.id}`}
                          type="button"
                          onClick={() =>
                            handlePickPlace(
                              {
                                name: hotel.name,
                                location: hotel.location,
                                coordinates: hotel.coordinates!,
                              },
                              'existing'
                            )
                          }
                          className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-stone-100 text-left transition group"
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg mt-0.5">
                              <Building className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-stone-900 group-hover:text-emerald-700 transition">
                                {hotel.name}
                              </p>
                              <p className="text-xs text-stone-500">{hotel.location}</p>
                            </div>
                          </div>
                          <span className="shrink-0 text-xs font-semibold text-emerald-700 bg-emerald-100/70 px-2.5 py-1 rounded-full group-hover:bg-emerald-600 group-hover:text-white transition">
                            Pick this place
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 2. Known Malawi Landmarks & Lodges */}
                  {localMatches.known.length > 0 && (
                    <div>
                      <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-stone-500 bg-stone-100 rounded-lg flex items-center gap-1.5 mb-1">
                        <Compass className="h-3 w-3" /> Known Places &amp; Landmarks
                      </div>
                      {localMatches.known.map(place => (
                        <button
                          key={`known-${place.id}`}
                          type="button"
                          onClick={() =>
                            handlePickPlace(
                              {
                                name: place.name,
                                location: place.location,
                                coordinates: place.coordinates,
                              },
                              'known'
                            )
                          }
                          className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-stone-100 text-left transition group"
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="p-2 bg-stone-100 text-stone-700 rounded-lg mt-0.5">
                              <MapPin className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-stone-900 group-hover:text-stone-700">
                                  {place.name}
                                </p>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                                  {place.category}
                                </span>
                              </div>
                              <p className="text-xs text-stone-500">
                                {place.location} • {place.region}
                              </p>
                              {place.description && (
                                <p className="text-[11px] text-stone-400 mt-0.5">
                                  {place.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="shrink-0 text-xs font-medium text-stone-600 bg-stone-200/60 px-2.5 py-1 rounded-full group-hover:bg-stone-900 group-hover:text-white transition">
                            Pick place
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 3. Online Geocoding Results */}
                  {onlineResults.length > 0 && (
                    <div>
                      <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-stone-500 bg-stone-100 rounded-lg flex items-center gap-1.5 mb-1">
                        <Globe className="h-3 w-3" /> Map Geocoding Search
                      </div>
                      {onlineResults.map(res => (
                        <button
                          key={res.id}
                          type="button"
                          onClick={() =>
                            handlePickPlace(
                              {
                                name: res.name,
                                location: res.location,
                                coordinates: res.coordinates,
                              },
                              'osm'
                            )
                          }
                          className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-stone-100 text-left transition group"
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="p-2 bg-blue-50 text-blue-700 rounded-lg mt-0.5">
                              <Globe className="h-4 w-4" />
                            </div>
                            <div className="pr-2">
                              <p className="text-sm font-semibold text-stone-900">{res.name}</p>
                              <p className="text-xs text-stone-500 line-clamp-1">{res.location}</p>
                            </div>
                          </div>
                          <span className="shrink-0 text-xs font-medium text-stone-600 bg-stone-100 px-2.5 py-1 rounded-full group-hover:bg-stone-900 group-hover:text-white transition">
                            Select
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Region Presets Chips */}
        <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide text-xs">
          <span className="text-stone-400 font-semibold uppercase text-[10px] shrink-0 mr-1 flex items-center gap-1">
            <Compass className="h-3 w-3 text-stone-500" /> Jump to:
          </span>
          {POPULAR_REGIONS.map(reg => (
            <button
              key={reg.label}
              type="button"
              onClick={() => {
                onChange(reg.coords);
                setSelectedPlaceName(reg.label);
                toast.success(`Jumped map to ${reg.label}`);
              }}
              className="shrink-0 px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-full font-medium transition"
            >
              {reg.label}
            </button>
          ))}
        </div>

        {/* Interactive Map Component */}
        <div className="relative">
          <InteractiveMap
            markerPosition={pin}
            onMarkerChange={coords => {
              onChange(coords);
              setSelectedPlaceName(null);
            }}
            popupText={selectedPlaceName || locationText || 'Property Location'}
            interactive={true}
            heightClass="h-[60vh] min-h-[400px] sm:h-[500px]"
          />
        </div>

        {/* Selected location status readout */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-stone-600">
            <MapPin className="h-4 w-4 text-emerald-600 shrink-0" />
            {pin ? (
              <span>
                <strong className="text-stone-900">
                  {selectedPlaceName ? `${selectedPlaceName} • ` : ''}
                </strong>
                {formatCoordinates(pin)}
              </span>
            ) : (
              <span className="text-stone-400">
                No location pinned yet. Search above or tap on the map to place pin.
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={useMyPosition}
            disabled={locating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl font-medium transition disabled:opacity-50"
          >
            {locating ? (
              <Crosshair className="h-3.5 w-3.5 animate-pulse text-blue-600" />
            ) : (
              <LocateFixed className="h-3.5 w-3.5 text-stone-600" />
            )}
            Use Device GPS
          </button>
        </div>

        {/* Validation Warning */}
        {problem && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div>
              <p className="font-bold">{PIN_PROBLEM_LABELS[problem]}</p>
              {problem === 'swapped' && pin && (
                <button
                  type="button"
                  onClick={() => onChange({ lat: pin.lng, lng: pin.lat })}
                  className="mt-0.5 font-bold underline hover:text-amber-950"
                >
                  Click here to swap Latitude and Longitude
                </button>
              )}
              {problem === 'outside' && (
                <p className="mt-0.5 text-amber-800/80">
                  Coordinates fall outside Malawi's borders. Verify if this property is situated across the border.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Alternate Input: Paste link & Manual Coordinate Adjustments */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        {/* Paste link */}
        <div className="flex gap-2">
          <input
            type="text"
            value={paste}
            onChange={e => setPaste(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyPaste();
              }
            }}
            placeholder="Paste Google Maps URL or lat,lng"
            className="w-full bg-stone-50 border border-stone-200 px-3 py-2 text-xs rounded-xl outline-none focus:border-stone-900 transition"
          />
          <button
            type="button"
            onClick={applyPaste}
            disabled={!paste.trim()}
            className="shrink-0 bg-stone-900 text-white px-4 rounded-xl text-xs font-semibold hover:bg-stone-800 transition disabled:opacity-40"
          >
            Paste
          </button>
        </div>

        {/* Lat/Lng fine-tuning */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <input
              type="number"
              step="0.00001"
              value={pin ? pin.lat : ''}
              onChange={e => setPart('lat', e.target.value)}
              placeholder="Lat (-13.98)"
              className="w-full bg-stone-50 border border-stone-200 px-3 py-2 text-xs rounded-xl outline-none focus:border-stone-900 transition"
            />
          </div>
          <div>
            <input
              type="number"
              step="0.00001"
              value={pin ? pin.lng : ''}
              onChange={e => setPart('lng', e.target.value)}
              placeholder="Lng (33.78)"
              className="w-full bg-stone-50 border border-stone-200 px-3 py-2 text-xs rounded-xl outline-none focus:border-stone-900 transition"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

