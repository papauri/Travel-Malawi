import React, { useState, useEffect, useMemo } from 'react';
import {
  CloudDownload,
  CheckCircle2,
  Compass,
  MapPin,
  WifiOff,
  Wifi,
  PhoneCall,
  Mail,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  X,
  AlertTriangle,
  Locate,
  Car,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { LatLng, distanceKm, estimateTravelTime, formatCoordinates, formatCoordinatesDMS, getCompassBearing, isValidLatLng } from '../lib/geo';
import {
  PropertyOfflinePackage,
  downloadPropertyOfflineMap,
  isPropertyOfflineDownloaded,
  getPropertyOfflinePackage,
  deletePropertyOfflineMap,
  OfflineProgressUpdate,
} from '../lib/mapCache';
import InteractiveMap from './InteractiveMap';
import toast from 'react-hot-toast';

export interface OfflineMapManagerProps {
  property: {
    id: string;
    name: string;
    location: string;
    coordinates: LatLng;
    locationNotes?: string;
    contactPhone?: string;
    contactEmail?: string;
    image?: string;
  };
  variant?: 'inline' | 'card';
  className?: string;
}

export default function OfflineMapManager({
  property,
  variant = 'inline',
  className = '',
}: OfflineMapManagerProps) {
  const [isDownloaded, setIsDownloaded] = useState(() => isPropertyOfflineDownloaded(property.id));
  const [pkg, setPkg] = useState<PropertyOfflinePackage | null>(() => getPropertyOfflinePackage(property.id));
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<OfflineProgressUpdate | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);
  
  // GPS tracking for offline guide
  const [gpsLocation, setGpsLocation] = useState<LatLng | null>(null);
  const [isGpsLocating, setIsGpsLocating] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<'decimal' | 'dms' | null>(null);

  useEffect(() => {
    setIsDownloaded(isPropertyOfflineDownloaded(property.id));
    setPkg(getPropertyOfflinePackage(property.id));
  }, [property.id]);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const handleDownload = async () => {
    if (isDownloading) return;
    if (!isValidLatLng(property.coordinates)) {
      toast.error('Location coordinates unavailable for this property.');
      return;
    }

    setIsDownloading(true);
    setProgress({ loaded: 0, total: 120, percent: 0, stage: 'Preparing map tiles for download...' });

    try {
      const result = await downloadPropertyOfflineMap(property, (update) => {
        setProgress(update);
      });

      setIsDownloaded(true);
      const updatedPkg = getPropertyOfflinePackage(property.id);
      setPkg(updatedPkg);
      toast.success(
        `Offline map saved! ${result.tilesDownloaded} road & terrain tiles available offline for ${property.name}.`
      );
    } catch (err: any) {
      toast.error(err?.message || 'Failed to download offline map tiles. Check your connection.');
    } finally {
      setIsDownloading(false);
      setProgress(null);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Remove offline map and cached road tiles for ${property.name}?`)) return;
    try {
      await deletePropertyOfflineMap(property.id);
      setIsDownloaded(false);
      setPkg(null);
      toast.success('Offline map data removed from this device.');
      setShowModal(false);
    } catch {
      toast.error('Failed to remove offline map.');
    }
  };

  const handleCopy = (text: string, type: 'decimal' | 'dms') => {
    navigator.clipboard.writeText(text);
    setCopiedFormat(type);
    toast.success(`Copied ${type === 'decimal' ? 'decimal coordinates' : 'GPS DMS coordinates'}!`);
    setTimeout(() => setCopiedFormat(null), 2000);
  };

  // Offline GPS Position request
  const handleToggleGps = () => {
    if (gpsLocation) {
      setGpsLocation(null);
      return;
    }
    if (!navigator.geolocation) {
      toast.error('GPS Geolocation is not supported by your device');
      return;
    }
    setIsGpsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsGpsLocating(false);
        setGpsLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        toast.success('Current GPS satellite position acquired!');
      },
      (err) => {
        setIsGpsLocating(false);
        toast.error(`Could not read GPS position: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  };

  // Calculate live relative navigation metrics from GPS location to property
  const relativeGpsNav = useMemo(() => {
    if (!gpsLocation || !isValidLatLng(property.coordinates)) return null;
    const km = distanceKm(gpsLocation, property.coordinates);
    const bearing = getCompassBearing(gpsLocation, property.coordinates);
    const driveEst = estimateTravelTime(km);
    return { km, bearing, driveEst };
  }, [gpsLocation, property.coordinates]);

  const geoUri = isValidLatLng(property.coordinates)
    ? `geo:${property.coordinates.lat},${property.coordinates.lng}?q=${property.coordinates.lat},${property.coordinates.lng}(${encodeURIComponent(property.name)})`
    : null;

  const sizeMb = pkg?.sizeBytes ? (pkg.sizeBytes / (1024 * 1024)).toFixed(1) : '2.4';

  return (
    <>
      {/* 1. COMPONENT TRIGGER INLINE OR CARD */}
      {variant === 'inline' ? (
        <div className={`flex flex-wrap items-center gap-2 ${className}`}>
          {isDownloading ? (
            <div className="w-full sm:w-auto flex flex-col gap-1.5 p-2.5 bg-stone-50 border border-stone-200 rounded-xl min-w-[260px]">
              <div className="flex items-center justify-between text-xs font-bold text-stone-800">
                <span className="flex items-center gap-1.5">
                  <div className="w-3 h-3 border-2 border-stone-400 border-t-emerald-600 rounded-full animate-spin" />
                  Downloading Offline Map...
                </span>
                <span className="text-emerald-700">{progress?.percent ?? 0}%</span>
              </div>
              <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full transition-all duration-200"
                  style={{ width: `${progress?.percent ?? 0}%` }}
                />
              </div>
              <p className="text-[10px] text-stone-500 truncate">
                {progress?.stage || 'Caching map tiles for remote navigation...'}
              </p>
            </div>
          ) : isDownloaded ? (
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200/90 rounded-xl text-xs font-bold shadow-2xs cursor-default"
                title={`Offline map cached (${pkg?.tileCount ?? 110} tiles, ~${sizeMb} MB)`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Offline Map Ready</span>
                <span className="text-[10px] font-normal text-emerald-600 bg-emerald-100/60 px-1.5 py-0.2 rounded-md">
                  ~{sizeMb} MB
                </span>
              </span>

              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition shadow-2xs active:scale-98"
              >
                <Compass className="w-3.5 h-3.5 text-emerald-400" />
                <span>Offline Guide &amp; GPS</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50/90 hover:bg-emerald-100/90 border border-emerald-200/80 px-3.5 py-2 rounded-xl transition shadow-2xs group active:scale-98"
              title="Save road and approach tiles to browse map without cellular internet"
            >
              <CloudDownload className="w-3.5 h-3.5 text-emerald-700 group-hover:scale-110 transition-transform" />
              <span>Download Offline Map</span>
            </button>
          )}
        </div>
      ) : (
        /* CARD VARIANT */
        <div className={`p-4 sm:p-5 bg-stone-50 border border-stone-200 rounded-2xl ${className}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100/70 text-emerald-800 rounded-lg">
                  <Compass className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-stone-900">
                  Remote Area Offline Navigation
                </h4>
                {isDownloaded && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Downloaded
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-600 max-w-xl leading-relaxed">
                Traveling to remote lakeshore coves, wildlife reserves, or mountain plateaus? Download map
                tiles and GPS coordinates to your browser for reliable turn-by-turn orientation with zero cell service.
              </p>
            </div>

            <div className="shrink-0">
              {isDownloading ? (
                <div className="flex flex-col gap-1 w-48">
                  <div className="flex justify-between text-xs font-bold text-stone-800">
                    <span>Downloading...</span>
                    <span>{progress?.percent}%</span>
                  </div>
                  <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full rounded-full transition-all"
                      style={{ width: `${progress?.percent}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-stone-500 truncate">{progress?.stage}</span>
                </div>
              ) : isDownloaded ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(true)}
                    className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                  >
                    <Compass className="w-3.5 h-3.5 text-emerald-400" />
                    Open Offline Guide
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    title="Update offline map tiles"
                    className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-200 rounded-xl transition"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-2 active:scale-98"
                >
                  <CloudDownload className="w-4 h-4" />
                  Download Offline Map
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. OFFLINE NAVIGATION GUIDE & GPS MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-[3000] bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-white rounded-2xl sm:rounded-3xl border border-stone-200 shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-stone-100 flex items-start justify-between gap-4 bg-stone-50/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-sm">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-serif font-bold text-stone-900">
                      Offline Navigation Guide
                    </h3>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-700" />
                      Cached Offline
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {property.name} &bull; {property.location}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Offline Connectivity Status Pill */}
            <div className="px-5 py-2.5 sm:px-6 bg-stone-100/70 border-b border-stone-200/60 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                {isOffline ? (
                  <span className="inline-flex items-center gap-1.5 text-amber-800 font-bold bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-lg">
                    <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                    No Internet Connection Detected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
                    <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                    Online &bull; Offline Tiles Available
                  </span>
                )}
                <span className="text-stone-500 text-[11px] hidden sm:inline">
                  Interactive map and GPS orientation are fully functional offline.
                </span>
              </div>

              <button
                type="button"
                onClick={handleToggleGps}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl font-bold transition text-xs ${
                  gpsLocation
                    ? 'bg-blue-600 text-white shadow-xs'
                    : isGpsLocating
                    ? 'bg-amber-100 text-amber-900 animate-pulse'
                    : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                <Locate className="w-3.5 h-3.5" />
                <span>
                  {gpsLocation ? 'GPS Live Tracking' : isGpsLocating ? 'Acquiring GPS...' : 'Track My GPS Position'}
                </span>
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
              {/* Live GPS Relative Bearing Stats (if GPS activated) */}
              {relativeGpsNav && (
                <div className="p-3.5 bg-blue-50/80 border border-blue-200/80 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-blue-900">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-600 text-white rounded-xl">
                      <Car className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                        Live Satellite Distance to Stay
                      </p>
                      <p className="text-sm font-bold text-blue-950">
                        {relativeGpsNav.km.toFixed(1)} km &bull; Heading {relativeGpsNav.bearing}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-medium text-blue-700 block">Est. Drive Time</span>
                    <span className="text-xs font-bold text-blue-950">{relativeGpsNav.driveEst.drivingTimeFormatted}</span>
                  </div>
                </div>
              )}

              {/* Embedded Interactive Map (Using Cached Tile Layer) */}
              <div className="rounded-2xl overflow-hidden border border-stone-200 relative isolate">
                <InteractiveMap
                  center={property.coordinates}
                  markerPosition={property.coordinates}
                  markerImage={property.image}
                  popupText={property.name}
                  userLocation={gpsLocation}
                  showUserLocation={Boolean(gpsLocation)}
                  zoom={14}
                  heightClass="h-[260px] sm:h-[320px]"
                  interactive={true}
                  showSatelliteToggle={true}
                />
              </div>

              {/* GPS Coordinates Grid for Handheld Garmin or Car GPS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                      Decimal Coordinates
                    </span>
                    <span className="font-mono text-xs font-bold text-stone-900">
                      {formatCoordinates(property.coordinates)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(formatCoordinates(property.coordinates), 'decimal')}
                    className="p-2 hover:bg-stone-200 text-stone-600 rounded-lg transition"
                    title="Copy Decimal coordinates"
                  >
                    {copiedFormat === 'decimal' ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                      DMS Format (4x4 GPS / In-Car)
                    </span>
                    <span className="font-mono text-xs font-bold text-stone-900">
                      {formatCoordinatesDMS(property.coordinates)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(formatCoordinatesDMS(property.coordinates), 'dms')}
                    className="p-2 hover:bg-stone-200 text-stone-600 rounded-lg transition"
                    title="Copy Degrees Minutes Seconds"
                  >
                    {copiedFormat === 'dms' ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Geo URI for Device Offline Navigation Apps */}
              {geoUri && (
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-emerald-50/70 border border-emerald-200/70 rounded-xl text-xs">
                  <div className="flex items-center gap-2 text-emerald-900 font-medium">
                    <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Open in installed offline navigation app (OsmAnd, Maps.me, or Apple Maps)</span>
                  </div>
                  <a
                    href={geoUri}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold text-xs transition"
                  >
                    <span>Launch GPS App</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Host Driving & Access Notes */}
              {property.locationNotes ? (
                <div className="p-4 bg-amber-50/70 border border-amber-200/70 rounded-xl">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-900 mb-1 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                    Host Access &amp; Road Advice
                  </h4>
                  <p className="text-xs text-amber-900/90 leading-relaxed whitespace-pre-line">
                    {property.locationNotes}
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-500">
                  Standard access roads connect to the local highway network. For remote or rainy-season
                  travel, 4WD is recommended across unpaved lakeshore and reserve roads.
                </div>
              )}

              {/* Host Contact Details for Arrival updates */}
              {(property.contactPhone || property.contactEmail) && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Host Direct Arrival Contacts
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {property.contactPhone && (
                      <a
                        href={`tel:${property.contactPhone}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 transition"
                      >
                        <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Call Host: {property.contactPhone}</span>
                      </a>
                    )}
                    {property.contactEmail && (
                      <a
                        href={`mailto:${property.contactEmail}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold transition"
                      >
                        <Mail className="w-3.5 h-3.5 text-stone-500" />
                        <span>{property.contactEmail}</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer with Storage Info and Management Actions */}
            <div className="px-5 py-3.5 sm:px-6 bg-stone-50 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="text-stone-500 text-[11px]">
                <span>
                  Storage: {pkg?.tileCount ?? 110} tiles cached (~{sizeMb} MB) &bull;{' '}
                  {pkg?.downloadedAt
                    ? `Saved ${new Date(pkg.downloadedAt).toLocaleDateString()}`
                    : 'Saved on device'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-stone-700 hover:text-stone-900 hover:bg-stone-200/70 rounded-lg font-semibold transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isDownloading ? 'animate-spin' : ''}`} />
                  <span>Update Tiles</span>
                </button>

                <button
                  type="button"
                  onClick={handleDelete}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg font-semibold transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Offline Map</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
