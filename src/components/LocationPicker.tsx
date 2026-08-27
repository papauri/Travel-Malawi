/**
 * Sets a property's map pin.
 *
 * There was no way to edit a pin at all once a listing existed. It could only
 * be dropped at creation time by standing at the property and tapping "use my
 * position", which is useless to an admin correcting someone else's listing
 * from an office, and to any host who listed from home.
 *
 * Three ways in, because different people have different things to hand: paste
 * a Google Maps link off a phone, type the numbers, or use the device's own
 * position. Whatever arrives is checked and previewed on a map before it is
 * saved, so a wrong pin is visible rather than discovered by a guest.
 */

import React, { useState } from 'react';
import { Crosshair, LocateFixed, MapPin, Trash2, TriangleAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  LatLng, MALAWI_CENTRE, PIN_PROBLEM_LABELS, formatCoordinates, isValidLatLng,
  mapEmbedUrl, parseCoordinates, pinProblem,
} from '../lib/geo';

interface Props {
  value: LatLng | null | undefined;
  onChange: (value: LatLng | null) => void;
  /** Falls back to this on the map when there is no pin yet. */
  locationText?: string;
  label?: string;
}

const inputClass =
  'w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition';

export default function LocationPicker({ value, onChange, locationText, label = 'Map pin' }: Props) {
  const [paste, setPaste] = useState('');
  const [locating, setLocating] = useState(false);

  const pin = isValidLatLng(value) ? (value as LatLng) : null;
  const problem = value === null || value === undefined ? null : pinProblem(value);

  const applyPaste = () => {
    const parsed = parseCoordinates(paste);
    if (!parsed) {
      toast.error('Could not find coordinates in that. Paste a Google Maps link, or "-13.98, 33.78".');
      return;
    }
    onChange(parsed);
    setPaste('');
    toast.success(`Pin set to ${formatCoordinates(parsed, 4)}.`);
  };

  const useMyPosition = () => {
    if (!navigator.geolocation) {
      toast.error('This browser will not share a location.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      position => {
        setLocating(false);
        onChange({ lat: position.coords.latitude, lng: position.coords.longitude });
        toast.success('Pin dropped at your current position.');
      },
      () => {
        setLocating(false);
        toast.error('Could not read your location. Check the browser permissions.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  /** Editing one number at a time, without losing the other. */
  const setPart = (part: keyof LatLng, raw: string) => {
    const parsed = Number(raw);
    const base = pin ?? MALAWI_CENTRE;
    if (raw.trim() === '') {
      onChange(null);
      return;
    }
    if (!Number.isFinite(parsed)) return;
    onChange({ ...base, [part]: parsed });
  };

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider">{label}</label>
        {pin && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex items-center gap-1 text-xs font-semibold text-stone-400 hover:text-red-600 transition"
          >
            <Trash2 className="h-3 w-3" /> Remove pin
          </button>
        )}
      </div>

      {/* Paste is first because it is what people actually have: a link
          copied out of Google Maps on their phone. */}
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
          placeholder="Paste a Google Maps link, or -13.98, 33.78"
          className={inputClass}
        />
        <button
          type="button"
          onClick={applyPaste}
          disabled={!paste.trim()}
          className="shrink-0 bg-stone-900 text-white px-5 rounded-xl text-sm font-semibold hover:bg-stone-800 transition disabled:opacity-40"
        >
          Set
        </button>
        <button
          type="button"
          onClick={useMyPosition}
          disabled={locating}
          title="Use this device's position"
          className="shrink-0 bg-stone-100 text-stone-600 px-4 rounded-xl hover:bg-stone-200 transition disabled:opacity-50"
        >
          {locating ? <Crosshair className="h-4 w-4 animate-pulse" /> : <LocateFixed className="h-4 w-4" />}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <label className="block text-[0.65rem] font-bold text-stone-400 uppercase tracking-wider mb-1">Latitude</label>
          <input
            type="number"
            step="0.00001"
            value={pin ? pin.lat : ''}
            onChange={e => setPart('lat', e.target.value)}
            placeholder="-13.98"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-[0.65rem] font-bold text-stone-400 uppercase tracking-wider mb-1">Longitude</label>
          <input
            type="number"
            step="0.00001"
            value={pin ? pin.lng : ''}
            onChange={e => setPart('lng', e.target.value)}
            placeholder="33.78"
            className={inputClass}
          />
        </div>
      </div>

      {problem && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">{PIN_PROBLEM_LABELS[problem]}</p>
            {problem === 'swapped' && pin && (
              <button
                type="button"
                onClick={() => onChange({ lat: pin.lng, lng: pin.lat })}
                className="mt-1 font-semibold underline hover:text-amber-950"
              >
                Swap them
              </button>
            )}
            {problem === 'outside' && (
              <p className="mt-0.5 text-amber-800/80">
                Fine if the property really is over the border — otherwise check the numbers.
              </p>
            )}
          </div>
        </div>
      )}

      {/* The preview is the point: a pin nobody looked at is a pin nobody
          knows is wrong. */}
      <div className="mt-3 h-56 w-full overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
        <iframe
          title="Map preview"
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={mapEmbedUrl({ location: locationText, coordinates: pin })}
        />
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-xs text-stone-400">
        <MapPin className="h-3 w-3" />
        {pin
          ? `Pinned at ${formatCoordinates(pin)}. Guests see this map and it drives "near me" search.`
          : `No pin yet — the map is guessing from "${locationText || 'the location text'}", and this property is left out of "near me" results.`}
      </p>
    </div>
  );
}
