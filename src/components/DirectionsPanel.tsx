import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import toast from 'react-hot-toast';
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
  MALAWI_KNOWN_PLACES,
} from '../lib/geo';
import InteractiveMap from './InteractiveMap';

interface Props {
  hotelName: string;
  location: string;
  coordinates?: LatLng | null;
  locationNotes?: string;
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
  className = '',
}: Props) {
  const [guestLocation, setGuestLocation] = useState<LatLng | null>(null);
  const [selectedOriginName, setSelectedOriginName] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [copiedCoords, setCopiedCoords] = useState(false);

  const hasCoords = isValidLatLng(coordinates);
  const destCoords = hasCoords ? (coordinates as LatLng) : null;

  // Request guest's live location
  const handleGetGuestLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }
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
    setGuestLocation(origin.coords);
    setSelectedOriginName(origin.label);
    toast.success(`Calculated route from ${origin.label}`);
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
          className="flex items-center justify-between p-4 bg-stone-900 text-white rounded-2xl hover:bg-emerald-800 transition shadow-sm group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <Navigation className="h-5 w-5 text-emerald-400 group-hover:rotate-45 transition-transform duration-300" />
            </div>
            <div>
              <p className="text-xs text-white/60 font-medium">Fast Turn-by-Turn</p>
              <p className="text-sm font-bold text-white">Google Maps</p>
            </div>
          </div>
          <ExternalLink className="h-4 w-4 text-white/40 group-hover:text-white transition" />
        </a>

        <a
          href={appleMapsDirectionsUrl(destCoords || location, guestLocation || undefined)}
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center justify-between p-4 bg-stone-100 hover:bg-stone-200 text-stone-900 rounded-2xl transition group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-stone-700 shadow-xs">
              <MapPin className="h-5 w-5 text-stone-800" />
            </div>
            <div>
              <p className="text-xs text-stone-500 font-medium">Apple Devices</p>
              <p className="text-sm font-bold text-stone-900">Apple Maps</p>
            </div>
          </div>
          <ExternalLink className="h-4 w-4 text-stone-400 group-hover:text-stone-900 transition" />
        </a>

        {destCoords && (
          <a
            href={wazeDirectionsUrl(destCoords)}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center justify-between p-4 bg-stone-100 hover:bg-stone-200 text-stone-900 rounded-2xl transition group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-blue-600 shadow-xs">
                <Car className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-stone-500 font-medium">Traffic &amp; Hazards</p>
                <p className="text-sm font-bold text-stone-900">Waze App</p>
              </div>
            </div>
            <ExternalLink className="h-4 w-4 text-stone-400 group-hover:text-stone-900 transition" />
          </a>
        )}

        {destCoords && (
          <a
            href={openStreetMapDirectionsUrl(destCoords, guestLocation || undefined)}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center justify-between p-4 bg-stone-100 hover:bg-stone-200 text-stone-900 rounded-2xl transition group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-emerald-600 shadow-xs">
                <Compass className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-stone-500 font-medium">Open Source</p>
                <p className="text-sm font-bold text-stone-900">OpenStreetMap</p>
              </div>
            </div>
            <ExternalLink className="h-4 w-4 text-stone-400 group-hover:text-stone-900 transition" />
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

          <button
            type="button"
            onClick={handleGetGuestLocation}
            disabled={locating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-stone-100 border border-stone-200 text-stone-800 rounded-full text-xs font-bold shadow-xs transition disabled:opacity-50"
          >
            {locating ? (
              <Crosshair className="h-3.5 w-3.5 animate-pulse text-blue-600" />
            ) : (
              <LocateFixed className="h-3.5 w-3.5 text-blue-600" />
            )}
            {guestLocation && selectedOriginName === 'Your Current GPS Position'
              ? 'GPS Location Active'
              : 'Use My Current Location'}
          </button>
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
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'bg-white text-stone-600 border border-stone-200 hover:border-stone-400'
                }`}
              >
                {origin.icon === 'plane' ? (
                  <Plane className="h-3 w-3" />
                ) : (
                  <Car className="h-3 w-3" />
                )}
                {origin.label}
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
      <div className="mb-6">
        <InteractiveMap
          center={destCoords}
          markerPosition={destCoords}
          origin={guestLocation}
          originLabel={selectedOriginName || 'Your Location'}
          interactive={false}
          popupText={hotelName}
          heightClass="h-80"
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
