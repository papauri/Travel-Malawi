import re

with open("src/components/DirectionsPanel.tsx", "r") as f:
    text = f.read()

# Replace everything from `      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">` to the end of the file.
start_idx = text.find('      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">')
if start_idx == -1:
    print("Cannot find start")

new_layout = """      {/* Primary Navigation Launchers */}
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
      <div className="mb-6 h-[400px] rounded-2xl overflow-hidden border border-stone-200/80">
        <InteractiveMap
          center={destCoords}
          markerPosition={destCoords}
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
"""

text = text[:start_idx] + new_layout
with open("src/components/DirectionsPanel.tsx", "w") as f:
    f.write(text)

