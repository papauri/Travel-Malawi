import React, { useState, useMemo } from 'react';
import {
  Compass,
  Copy,
  ExternalLink,
  LocateFixed,
  MapPin,
  Navigation,
  Share2,
  Check,
  Clock,
  Car,
  Plane,
  AlertCircle,
  Crosshair,
  X,
  RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePermission } from '../contexts/PermissionContext';
import {
  LatLng,
  distanceKm,
  estimateDriveDuration,
  formatCoordinates,
  getCompassBearing,
  googleDirectionsUrl,
  appleMapsDirectionsUrl,
  wazeDirectionsUrl,
  openStreetMapDirectionsUrl,
  isValidLatLng,
  resolveHotelCoordinates,
  MALAWI_KNOWN_PLACES,
} from '../lib/geo';
import InteractiveMap from './InteractiveMap';

interface Props {
  hotelName: string;
  location: string;
  coordinates?: LatLng | null;
  locationNotes?: string;
  hotelImage?: string;
  className?: string;
}

const COMMON_ORIGINS: { label: string; name: string; coords: LatLng; icon: 'plane' | 'car' }[] = [
  {
    label: 'Kamuzu Airport (LLW)',
    name: 'Kamuzu International Airport, Lilongwe',
    coords: { lat: -13.7829, lng: 33.781 },
    icon: 'plane',
  },
  {
    label: 'Chileka Airport (BLZ)',
    name: 'Chileka International Airport, Blantyre',
    coords: { lat: -15.6791, lng: 34.9642 },
    icon: 'plane',
  },
  {
    label: 'Lilongwe City',
    name: 'Lilongwe City Centre',
    coords: { lat: -13.9626, lng: 33.7741 },
    icon: 'car',
  },
  {
    label: 'Blantyre CBD',
    name: 'Blantyre CBD',
    coords: { lat: -15.7861, lng: 35.0058 },
    icon: 'car',
  },
  {
    label: 'Mzuzu Centre',
    name: 'Mzuzu City Centre',
    coords: { lat: -11.4583, lng: 34.0167 },
    icon: 'car',
  },
];

export default function DirectionsPanel({
  hotelName,
  location,
  coordinates,
  locationNotes,
  hotelImage,
  className = '',
}: Props) {
  const [guestLocation, setGuestLocation] = useState<LatLng | null>(null);
  const [selectedOriginName, setSelectedOriginName] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const { requestPermission } = usePermission();
  const [copiedCoords, setCopiedCoords] = useState(false);

  // Always resolve valid coordinates so the stay and photo pin display by default
  const destCoords = useMemo(() => {
    if (isValidLatLng(coordinates)) return coordinates as LatLng;
    return resolveHotelCoordinates({ name: hotelName, location, coordinates });
  }, [coordinates, hotelName, location]);

  const isGpsActive = Boolean(guestLocation && selectedOriginName === 'Your Current GPS Position');

  // Request or Toggle guest's live location
  const handleToggleGuestLocation = async () => {
    if (isGpsActive) {
      setGuestLocation(null);
      setSelectedOriginName(null);
      toast.success('Live GPS location switched off');
      return;
    }

    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }
    const granted = await requestPermission('location');
    if (!granted) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        
        setLocating(false);
        const origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGuestLocation(origin);
        setSelectedOriginName('Your Current GPS Position');
        toast.success('Found your location! Calculated direct route.');
      },
      err => {
        setLocating(false);
        console.error('Geolocation error:', err);
        toast.error('Could not determine your location. Please check browser permissions.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSelectPresetOrigin = (origin: (typeof COMMON_ORIGINS)[0]) => {
    if (selectedOriginName === origin.label) {
      // Toggle off when clicking the active preset
      setGuestLocation(null);
      setSelectedOriginName(null);
      toast.success('Origin cleared');
      return;
    }
    setGuestLocation(origin.coords);
    setSelectedOriginName(origin.label);
    toast.success(`Calculated route from ${origin.label}`);
  };

  const handleClearOrigin = () => {
    setGuestLocation(null);
    setSelectedOriginName(null);
    toast.success('Origin cleared');
  };

  const handleCopyCoordinates = () => {
    if (!destCoords) return;
    const text = formatCoordinates(destCoords, 5);
    navigator.clipboard.writeText(text);
    setCopiedCoords(true);
    toast.success(`Copied coordinates: ${text}`);
    setTimeout(() => setCopiedCoords(false), 3000);
  };

  const handleShareLocation = () => {
    const dest = destCoords || location;
    const url = googleDirectionsUrl(dest);
    if (navigator.share) {
      navigator
        .share({
          title: `Directions to ${hotelName}`,
          text: `Here are directions to ${hotelName} in ${location}.`,
          url,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Directions link copied to clipboard!');
    }
  };

  // Route calculations
  const routeStats =
    destCoords && guestLocation
      ? (() => {
          const km = distanceKm(guestLocation, destCoords);
          const miles = km * 0.621371;
          const duration = estimateDriveDuration(km);
          const bearing = getCompassBearing(guestLocation, destCoords);
          return { km, miles, duration, bearing };
        })()
      : null;

  return (
    <div
      id="directions"
      className={`rounded-3xl border border-stone-200/90 bg-white p-6 md:p-8 shadow-sm isolate z-0 scroll-mt-28 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
              <Navigation className="h-5 w-5" />
            </span>
            <h3 className="text-2xl font-serif text-stone-900">Get Directions</h3>
          </div>
          <p className="text-stone-500 text-sm mt-1">
            Navigate to <strong className="text-stone-900">{hotelName}</strong> ({location})
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2">
          {destCoords && (
            <button
              type="button"
              onClick={handleCopyCoordinates}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold transition"
            >
              {copiedCoords ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-stone-500" />
              )}
              {copiedCoords ? 'Copied' : 'Copy GPS'}
            </button>
          )}
          <button
            type="button"
            onClick={handleShareLocation}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold transition"
          >
            <Share2 className="h-3.5 w-3.5 text-stone-500" />
            Share
          </button>
        </div>
      </div>

      {/* Primary Navigation Launchers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <a
          href={googleDirectionsUrl(destCoords || location, guestLocation || undefined)}
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center justify-between p-4 bg-stone-900 text-white rounded-2xl hover:bg-emerald-800 transition shadow-sm group min-w-0"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-xl bg-white/10 flex items-center justify-center">
              <Navigation className="h-5 w-5 text-emerald-400 group-hover:rotate-45 transition-transform duration-300" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-white/60 font-medium truncate">Fast Turn-by-Turn</p>
              <p className="text-sm font-bold text-white truncate">Google Maps</p>
            </div>
          </div>
          <ExternalLink className="h-4 w-4 shrink-0 text-white/40 group-hover:text-white transition ml-3" />
        </a>

        <a
          href={appleMapsDirectionsUrl(destCoords || location, guestLocation || undefined)}
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center justify-between p-4 bg-stone-100 hover:bg-stone-200 text-stone-900 rounded-2xl transition group min-w-0"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-xl bg-white flex items-center justify-center text-stone-700 shadow-xs">
              <MapPin className="h-5 w-5 text-stone-800" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-stone-500 font-medium truncate">Apple Devices</p>
              <p className="text-sm font-bold text-stone-900 truncate">Apple Maps</p>
            </div>
          </div>
          <ExternalLink className="h-4 w-4 shrink-0 text-stone-400 group-hover:text-stone-900 transition ml-3" />
        </a>

        {destCoords && (
          <a
            href={wazeDirectionsUrl(destCoords)}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center justify-between p-4 bg-stone-100 hover:bg-stone-200 text-stone-900 rounded-2xl transition group min-w-0"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-white flex items-center justify-center text-blue-600 shadow-xs">
                <Car className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-stone-500 font-medium truncate">Traffic &amp; Hazards</p>
                <p className="text-sm font-bold text-stone-900 truncate">Waze App</p>
              </div>
            </div>
            <ExternalLink className="h-4 w-4 shrink-0 text-stone-400 group-hover:text-stone-900 transition ml-3" />
          </a>
        )}

        {destCoords && (
          <a
            href={openStreetMapDirectionsUrl(destCoords, guestLocation || undefined)}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center justify-between p-4 bg-stone-100 hover:bg-stone-200 text-stone-900 rounded-2xl transition group min-w-0"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-white flex items-center justify-center text-emerald-600 shadow-xs">
                <Compass className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-stone-500 font-medium truncate">Open Source</p>
                <p className="text-sm font-bold text-stone-900 truncate">OpenStreetMap</p>
              </div>
            </div>
            <ExternalLink className="h-4 w-4 shrink-0 text-stone-400 group-hover:text-stone-900 transition ml-3" />
          </a>
        )}
      </div>

      {/* Live Distance & Route Calculator */}
      <div className="rounded-2xl border border-stone-200/80 bg-stone-50 p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              Calculate Travel Distance &amp; Estimated Driving Time
            </h4>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleGuestLocation}
              disabled={locating}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition disabled:opacity-50 ${
                isGpsActive
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm ring-2 ring-blue-300'
                  : 'bg-white hover:bg-stone-100 border border-stone-200 text-stone-800 shadow-xs'
              }`}
              title={isGpsActive ? 'Click to turn off GPS' : 'Click to use your live location'}
            >
              {locating ? (
                <Crosshair className="h-3.5 w-3.5 animate-pulse text-blue-600" />
              ) : (
                <LocateFixed className={`h-3.5 w-3.5 ${isGpsActive ? 'text-white' : 'text-blue-600'}`} />
              )}
              <span>{isGpsActive ? 'GPS Active' : 'Use My Current Location'}</span>
              {isGpsActive && (
                <span className="ml-0.5 px-1.5 py-0.5 bg-blue-700 hover:bg-blue-800 rounded-md text-[10px] uppercase font-bold text-blue-100">
                  Turn Off ✕
                </span>
              )}
            </button>

            {guestLocation && (
              <button
                type="button"
                onClick={handleClearOrigin}
                className="inline-flex items-center gap-1 px-3 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-full text-xs font-semibold transition"
                title="Clear route origin"
              >
                <X className="h-3.5 w-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Airport & City preset origins */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs text-stone-400 font-medium">Or from:</span>
          {COMMON_ORIGINS.map(origin => {
            const isSelected = selectedOriginName === origin.label;
            return (
              <button
                key={origin.label}
                type="button"
                onClick={() => handleSelectPresetOrigin(origin)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                  isSelected
                    ? 'bg-stone-900 text-white shadow-xs ring-2 ring-stone-900/20'
                    : 'bg-white text-stone-600 border border-stone-200 hover:border-stone-400'
                }`}
                title={isSelected ? 'Click to remove this origin' : `Calculate route from ${origin.label}`}
              >
                {origin.icon === 'plane' ? (
                  <Plane className="h-3 w-3" />
                ) : (
                  <Car className="h-3 w-3" />
                )}
                <span>{origin.label}</span>
                {isSelected && <span className="text-[10px] text-stone-400">✕</span>}
              </button>
            );
          })}
        </div>

        {/* Calculated Stats Banner */}
        {routeStats ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-white rounded-2xl border border-stone-200/80 shadow-xs mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <Car className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-stone-400 uppercase font-bold tracking-wider">Distance</p>
                <p className="text-base font-bold text-stone-900">
                  {routeStats.km.toFixed(1)} km{' '}
                  <span className="text-xs text-stone-500 font-normal">
                    ({routeStats.miles.toFixed(1)} mi)
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-stone-400 uppercase font-bold tracking-wider">
                  Est. Drive Time
                </p>
                <p className="text-base font-bold text-stone-900">~{routeStats.duration}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                <Compass className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-stone-400 uppercase font-bold tracking-wider">
                  Heading / Origin
                </p>
                <p className="text-sm font-bold text-stone-900 line-clamp-1">
                  {routeStats.bearing} ({selectedOriginName || 'Origin'})
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-stone-500 mb-2">
            Click "Use My Current Location" or choose a starting airport/city above to view driving distance and road travel time.
          </p>
        )}
      </div>

      {/* Interactive Map with Route & Destination Pin */}
      <div className="mb-6 h-[50vh] min-h-[400px] rounded-2xl overflow-hidden border border-stone-200/80">
        <InteractiveMap
          center={destCoords}
          markerPosition={destCoords}
          markerImage={hotelImage}
          origin={guestLocation}
          originLabel={selectedOriginName || 'Your Location'}
          interactive={false}
          popupText={hotelName}
          heightClass="h-full w-full"
        />
      </div>

      {/* Host Location Notes / Specific Instructions */}
      {locationNotes && (
        <div className="p-4 bg-amber-50/70 border border-amber-200/70 rounded-2xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-1">
              Host Arrival Advice &amp; Directions
            </h4>
            <p className="text-sm text-amber-900/90 leading-relaxed">{locationNotes}</p>
          </div>
        </div>
      )}
    </div>
  );
}



