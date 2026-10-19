import React, { useState, useMemo, useEffect } from 'react';
import {
  Copy,
  ExternalLink,
  LocateFixed,
  Share2,
  Check,
  Car,
  Plane,
  Crosshair,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import FormattedDescription from './FormattedDescription';
import {
  LatLng,
  distanceKm,
  estimateDriveDuration,
  estimateTravelTime,
  formatCoordinates,
  getCompassBearing,
  googleDirectionsUrl,
  appleMapsDirectionsUrl,
  wazeDirectionsUrl,
  openStreetMapDirectionsUrl,
  isValidLatLng,
  resolveHotelCoordinates,
} from '../lib/geo';
import InteractiveMap from './InteractiveMap';
import OfflineMapManager from './OfflineMapManager';

interface Props {
  hotelName: string;
  location: string;
  coordinates?: LatLng | null;
  locationNotes?: string;
  hotelImage?: string;
  hotelId?: string;
  /** Switches to the Directions tab when it turns true (set by "directions" links). */
  openDirections?: boolean;
  className?: string;
}

type Tab = 'map' | 'directions' | 'notes';

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
  hotelId,
  openDirections = false,
  className = '',
}: Props) {
  const [tab, setTab] = useState<Tab>('map');
  useEffect(() => {
    if (openDirections) setTab('directions');
  }, [openDirections]);
  const [guestLocation, setGuestLocation] = useState<LatLng | null>(null);
  const [selectedOriginName, setSelectedOriginName] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
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
      toast.success('Location switched off');
      return;
    }

    const applyFallbackOrigin = () => {
      try {
        const saved = localStorage.getItem('tm_manual_user_location');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.coords?.lat && parsed?.coords?.lng) {
            setGuestLocation({ lat: parsed.coords.lat, lng: parsed.coords.lng });
            setSelectedOriginName(parsed.label || 'Lilongwe (Default)');
            toast.success(`Using ${parsed.label || 'Lilongwe'} as starting point.`);
            return;
          }
        }
      } catch {
        // ignore
      }
      const fallback = COMMON_ORIGINS[0];
      setGuestLocation(fallback.coords);
      setSelectedOriginName(`${fallback.label} (Default)`);
      toast.success(`Using ${fallback.label} as starting point.`);
    };

    if (!navigator.geolocation) {
      applyFallbackOrigin();
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocating(false);
        const origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGuestLocation(origin);
        setSelectedOriginName('Your Current GPS Position');
        toast.success('Found your location.');
      },
      err => {
        setLocating(false);
        console.warn('Geolocation fallback used:', err);
        applyFallbackOrigin();
      },
      { enableHighAccuracy: true, timeout: 8000 }
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
    navigator.clipboard.writeText(text).then(
      () => {
        setCopiedCoords(true);
        toast.success(`Copied coordinates: ${text}`);
        setTimeout(() => setCopiedCoords(false), 3000);
      },
      () => toast.error(`Could not copy. The coordinates are ${text}`)
    );
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
      navigator.clipboard.writeText(url).then(
        () => toast.success('Directions link copied.'),
        () => toast.error('Could not copy the link.')
      );
    }
  };

  // Route calculations with terrain and road routing logic
  const routeStats =
    destCoords && guestLocation
      ? (() => {
          const directKm = distanceKm(guestLocation, destCoords);
          const travel = estimateTravelTime(directKm, guestLocation, destCoords, hotelName);
          const roadKm = travel.roadDistanceKm;
          const miles = roadKm * 0.621371;
          const duration = travel.drivingTimeFormatted;
          const bearing = getCompassBearing(guestLocation, destCoords);
          return { km: roadKm, directKm, miles, duration, bearing, notes: travel.notes };
        })()
      : null;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'map', label: 'Map' },
    { id: 'directions', label: 'Directions' },
    ...(locationNotes ? [{ id: 'notes' as Tab, label: 'Notes' }] : []),
  ];

  const appLinks = [
    { label: 'Google Maps', href: googleDirectionsUrl(destCoords || location, guestLocation || undefined) },
    { label: 'Apple Maps', href: appleMapsDirectionsUrl(destCoords || location, guestLocation || undefined) },
    ...(destCoords
      ? [
          { label: 'Waze', href: wazeDirectionsUrl(destCoords) },
          { label: 'OpenStreetMap', href: openStreetMapDirectionsUrl(destCoords, guestLocation || undefined) },
        ]
      : []),
  ];

  return (
    <section id="directions" className={`tm-panel scroll-mt-28 ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="tm-h2">Location</h2>
          <p className="tm-muted break-words">{hotelName}, {location}</p>
        </div>
        <div role="tablist" aria-label="Location views" className="flex shrink-0 gap-1 rounded-lg bg-stone-100 p-1">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-stone-200 isolate">
        <InteractiveMap
          center={destCoords}
          markerPosition={destCoords}
          markerImage={hotelImage}
          origin={guestLocation}
          originLabel={selectedOriginName || 'Your Location'}
          interactive={true}
          showSatelliteToggle={true}
          showDistanceOverlay={false}
          popupText={hotelName}
          zoom={13}
          heightClass="h-[260px] sm:h-[340px] lg:h-[400px]"
        />
      </div>

      <div className="mt-4">
        {tab === 'map' && (
          <div className="tm-actions">
            {destCoords && (
              <OfflineMapManager
                property={{
                  id: hotelId || hotelName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                  name: hotelName,
                  location,
                  coordinates: destCoords,
                  locationNotes,
                  image: hotelImage,
                }}
                variant="inline"
              />
            )}
            {destCoords && (
              <button type="button" onClick={handleCopyCoordinates} className="tm-btn tm-btn-secondary tm-btn-sm">
                {copiedCoords ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedCoords ? 'Copied' : 'Copy coordinates'}
              </button>
            )}
            <button type="button" onClick={handleShareLocation} className="tm-btn tm-btn-secondary tm-btn-sm">
              <Share2 className="h-4 w-4" />
              Share
            </button>
          </div>
        )}

        {tab === 'directions' && (
          <div className="space-y-4">
            <div>
              <p className="tm-label">Start from</p>
              <div className="tm-actions">
                <button
                  type="button"
                  onClick={handleToggleGuestLocation}
                  disabled={locating}
                  aria-pressed={isGpsActive}
                  className={`tm-btn tm-btn-sm ${isGpsActive ? 'tm-btn-primary' : 'tm-btn-secondary'}`}
                >
                  {locating ? <Crosshair className="h-4 w-4 animate-pulse" /> : <LocateFixed className="h-4 w-4" />}
                  {isGpsActive ? 'Using my location' : 'My location'}
                </button>
                {COMMON_ORIGINS.map((origin, oIdx) => {
                  const isSelected = selectedOriginName === origin.label;
                  return (
                    <button
                      key={`${origin.label}-${oIdx}`}
                      type="button"
                      onClick={() => handleSelectPresetOrigin(origin)}
                      aria-pressed={isSelected}
                      className={`tm-btn tm-btn-sm ${isSelected ? 'tm-btn-primary' : 'tm-btn-secondary'}`}
                    >
                      {origin.icon === 'plane' ? <Plane className="h-4 w-4" /> : <Car className="h-4 w-4" />}
                      {origin.label}
                    </button>
                  );
                })}
                {guestLocation && (
                  <button type="button" onClick={handleClearOrigin} className="tm-btn tm-btn-quiet tm-btn-sm">
                    <X className="h-4 w-4" />
                    Clear
                  </button>
                )}
              </div>
            </div>

            {routeStats ? (
              <div className="tm-divider pt-4">
                <p className="text-sm text-stone-900">
                  About <strong>{routeStats.km.toFixed(0)} km</strong> by road ({routeStats.miles.toFixed(0)} mi),
                  roughly <strong>{routeStats.duration}</strong> driving, heading {routeStats.bearing} from{' '}
                  {selectedOriginName || 'your start'}.
                </p>
                {routeStats.notes && <p className="tm-muted mt-1">{routeStats.notes}</p>}
              </div>
            ) : (
              <p className="tm-muted">Pick a starting point to see the road distance and drive time.</p>
            )}

            <div className="tm-divider pt-4">
              <p className="tm-label">Open in</p>
              <div className="tm-actions">
                {appLinks.map(a => (
                  <a
                    key={a.label}
                    href={a.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="tm-btn tm-btn-secondary tm-btn-sm"
                  >
                    {a.label}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'notes' && locationNotes && (
          <FormattedDescription
            text={locationNotes}
            collapsible={true}
            collapsedHeight={120}
            expandLabel="Read more"
            collapseLabel="Show less"
            fadeGradientClass="from-transparent via-white/60 to-white"
            buttonClassName="text-amber-800 font-medium text-sm"
            className="text-stone-700 text-sm"
            paragraphClassName="text-stone-700 text-sm leading-relaxed mb-2 last:mb-0"
          />
        )}
      </div>
    </section>
  );
}
