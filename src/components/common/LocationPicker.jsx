import React, { useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin, Navigation, Loader2, CheckCircle2, Compass,
  AlertCircle, Search, X, Info,
} from 'lucide-react';
import { issueService, isApproximateGranularity } from '../../services/issueService';
import { useToast } from '../../hooks/useToast';

// ── Leaflet icon fix ─────────────────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Default map center: Assam, India
const ASSAM_CENTER = [26.2006, 92.9376];
const ASSAM_ZOOM = 7;

/**
 * Programmatically re-centers the map when `center` prop changes.
 * Does NOT affect coordinates — only the map viewport.
 */
function MapRecenter({ center, zoom }) {
  const map = useMap();
  // useEffect not needed — Leaflet's useMap hook runs in the map context
  // We use a ref to avoid re-renders
  const prevCenter = useRef(null);
  if (
    center &&
    center[0] !== undefined &&
    center[1] !== undefined &&
    (prevCenter.current?.[0] !== center[0] || prevCenter.current?.[1] !== center[1])
  ) {
    prevCenter.current = center;
    map.setView(center, zoom || 16, { animate: true });
  }
  return null;
}

/** Capture map click events */
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      if (e && e.latlng) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

/** Build a fully-typed empty location object */
function emptyLocation() {
  return {
    latitude: null,
    longitude: null,
    address: '',
    road: '',
    locality: '',
    city: '',
    town: '',
    village: '',
    municipality: '',
    district: '',
    state: '',
    postcode: '',
    country: '',
    source: null,       // 'gps' | 'search' | 'map_pin'
    accuracy: null,     // metres (GPS only)
    granularity: null,  // 'building' | 'road' | 'neighbourhood' | 'city' | ...
    locationSelected: false,
    timestamp: null,
  };
}

export function LocationPicker({
  latitude,
  longitude,
  address,
  initialAddress,
  locationSelected = false,
  onChange,
  onLocationSelect,
  disabled = false,
}) {
  const toast = useToast();

  // ── UI state ─────────────────────────────────────────────────────────────
  const [isLocating, setIsLocating] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [gpsError, setGpsError] = useState(null);

  // locationMeta holds the last fully-resolved metadata for the readout panel
  const [locationMeta, setLocationMeta] = useState(null);

  // ── Refs ──────────────────────────────────────────────────────────────────
  // Monotonically-increasing request ID — only the latest async response is applied
  const requestIdRef = useRef(0);
  const markerRef = useRef(null);
  const watchIdRef = useRef(null);

  // ── Derived display values ────────────────────────────────────────────────
  const hasCoordinates =
    latitude !== null && latitude !== undefined &&
    longitude !== null && longitude !== undefined;

  const mapCenter = hasCoordinates ? [Number(latitude), Number(longitude)] : ASSAM_CENTER;
  const mapZoom = hasCoordinates ? 16 : ASSAM_ZOOM;

  const displayAddress = hasCoordinates ? (address || initialAddress || '') : '';

  const currentSource = locationMeta?.source || null;
  const currentGranularity = locationMeta?.granularity || null;
  const isApproximate = currentGranularity ? isApproximateGranularity(currentGranularity) : false;

  // ── Parent notification ───────────────────────────────────────────────────
  /**
   * Sends ONE complete, normalized location object to the parent.
   * This is the single exit point — called once per user action, after full resolution.
   * Coordinates are ALWAYS from the user action, never from a geocoder.
   */
  const notifyParent = useCallback(
    (locObj) => {
      setLocationMeta(locObj);
      if (onChange) onChange(locObj);
      if (onLocationSelect) onLocationSelect(locObj);
    },
    [onChange, onLocationSelect]
  );

  // ── Core: resolve address from coordinates ────────────────────────────────
  /**
   * Takes the exact user coordinates (from GPS/click/drag/search-selection),
   * reverse-geocodes them to get administrative metadata, then calls notifyParent
   * ONCE with the final complete object.
   *
   * IMPORTANT: `userLat` and `userLng` are the authoritative coordinates.
   * reverseGeocode() is ONLY used to get the address string and admin fields.
   * Its returned coordinates (if any) are DISCARDED.
   */
  const resolveAndNotify = useCallback(
    async ({
      userLat,
      userLng,
      source,
      accuracy = null,
      reqId,
      // Pre-supplied structured fields from search results (avoids an extra round-trip)
      preloaded = null,
      granularity = null,
    }) => {
      const numLat = Number(userLat);
      const numLng = Number(userLng);

      // If the search result already has structured address data at sufficient granularity,
      // skip the reverse geocode and emit the preloaded data immediately.
      if (preloaded && !isApproximateGranularity(granularity)) {
        const obj = {
          ...emptyLocation(),
          ...preloaded,
          latitude: numLat,   // Always the user coordinate
          longitude: numLng,  // Always the user coordinate
          source,
          accuracy,
          granularity,
          locationSelected: true,
          timestamp: Date.now(),
        };
        console.log('[LocationPicker] resolveAndNotify (preloaded exact):', obj);
        notifyParent(obj);
        return;
      }

      // For approximate/broad results OR map clicks, always run reverse geocode
      setIsReverseGeocoding(true);
      try {
        const geo = await issueService.reverseGeocode(numLat, numLng);

        // Discard if a newer request has superseded this one
        if (reqId !== null && reqId !== requestIdRef.current) {
          console.warn('[LocationPicker] Discarding stale reverse geocode (reqId', reqId, '≠', requestIdRef.current, ')');
          return;
        }

        const fallbackAddress = `${numLat.toFixed(6)}, ${numLng.toFixed(6)}`;
        const obj = {
          latitude: numLat,                    // User coordinate — never touched
          longitude: numLng,                   // User coordinate — never touched
          address: geo?.address || fallbackAddress,
          road: geo?.road || preloaded?.road || '',
          locality: geo?.locality || preloaded?.locality || '',
          city: geo?.city || preloaded?.city || '',
          town: geo?.town || preloaded?.town || '',
          village: geo?.village || preloaded?.village || '',
          municipality: geo?.municipality || preloaded?.municipality || '',
          district: geo?.district || preloaded?.district || '',
          state: geo?.state || preloaded?.state || '',
          postcode: geo?.postcode || preloaded?.postcode || '',
          country: geo?.country || preloaded?.country || 'India',
          source,
          accuracy,
          granularity,
          locationSelected: true,
          timestamp: Date.now(),
        };
        console.log('[LocationPicker] resolveAndNotify (reverse-geocoded):', obj);
        notifyParent(obj);
      } catch (err) {
        console.warn('[LocationPicker] reverseGeocode error:', err);
        // Still emit coordinates with a fallback address
        const obj = {
          ...emptyLocation(),
          ...(preloaded || {}),
          latitude: numLat,
          longitude: numLng,
          address: `${numLat.toFixed(6)}, ${numLng.toFixed(6)}`,
          source,
          accuracy,
          granularity,
          locationSelected: true,
          timestamp: Date.now(),
        };
        notifyParent(obj);
      } finally {
        if (reqId === null || reqId === requestIdRef.current) {
          setIsReverseGeocoding(false);
        }
      }
    },
    [notifyParent]
  );

  // ── GPS ───────────────────────────────────────────────────────────────────
  const handleUseCurrentLocation = useCallback(() => {
    setGpsError(null);
    setShowSuggestions(false);

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (!navigator?.geolocation) {
      const msg = 'GPS is not available in this browser.';
      setGpsError(msg); toast.error(msg); return;
    }
    if (window.isSecureContext === false && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      const msg = 'GPS requires HTTPS. Please search or select on the map.';
      setGpsError(msg); toast.error(msg); return;
    }

    const reqId = ++requestIdRef.current;
    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (reqId !== requestIdRef.current) { setIsLocating(false); return; }

        // These are the authoritative GPS coordinates — preserved verbatim
        let bestLat = pos.coords.latitude;
        let bestLng = pos.coords.longitude;
        let bestAccuracy = Math.round(pos.coords.accuracy);

        console.log('[LocationPicker] GPS initial fix:', { bestLat, bestLng, bestAccuracy });

        // 3-second accuracy refinement window
        if (bestAccuracy > 25 && navigator.geolocation.watchPosition) {
          const watchId = navigator.geolocation.watchPosition(
            (wp) => {
              if (reqId !== requestIdRef.current) return;
              const a = Math.round(wp.coords.accuracy);
              if (a < bestAccuracy) {
                bestLat = wp.coords.latitude;
                bestLng = wp.coords.longitude;
                bestAccuracy = a;
                console.log('[LocationPicker] GPS refined:', { bestLat, bestLng, bestAccuracy });
              }
            },
            () => {},
            { enableHighAccuracy: true, maximumAge: 0 }
          );
          watchIdRef.current = watchId;

          setTimeout(async () => {
            if (watchIdRef.current !== null) {
              navigator.geolocation.clearWatch(watchIdRef.current);
              watchIdRef.current = null;
            }
            if (reqId !== requestIdRef.current) return;
            setIsLocating(false);
            const label = bestAccuracy <= 25 ? 'High' : bestAccuracy <= 100 ? 'Moderate' : 'Low';
            toast[bestAccuracy <= 100 ? 'success' : 'info'](`GPS detected (±${bestAccuracy} m, ${label} accuracy)`);
            await resolveAndNotify({ userLat: bestLat, userLng: bestLng, source: 'gps', accuracy: bestAccuracy, reqId, granularity: 'gps' });
          }, 3000);
        } else {
          setIsLocating(false);
          const label = bestAccuracy <= 25 ? 'High' : bestAccuracy <= 100 ? 'Moderate' : 'Low';
          toast[bestAccuracy <= 100 ? 'success' : 'info'](`GPS detected (±${bestAccuracy} m, ${label} accuracy)`);
          await resolveAndNotify({ userLat: bestLat, userLng: bestLng, source: 'gps', accuracy: bestAccuracy, reqId, granularity: 'gps' });
        }
      },
      (err) => {
        if (reqId !== requestIdRef.current) { setIsLocating(false); return; }
        setIsLocating(false);
        const msgs = {
          1: 'Location permission denied. Please allow access in browser settings, or search / select on the map.',
          2: 'GPS signal unavailable. Please search your location or select on the map.',
          3: 'GPS timed out. Please try again or select manually on the map.',
        };
        const msg = msgs[err.code] || 'GPS unavailable. Search or select on the map.';
        setGpsError(msg); toast.error(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [resolveAndNotify, toast]);

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearch = async (queryOverride) => {
    const query = (queryOverride ?? searchQuery).trim();
    if (!query) return;

    const reqId = ++requestIdRef.current;
    setIsSearching(true);
    setShowSuggestions(false);

    try {
      const results = await issueService.searchLocationSuggestions(query);
      if (reqId !== requestIdRef.current) return;

      if (results && results.notFound) {
        setSearchSuggestions([]);
        toast.error(`No results for "${query}". Try adding a city, district, or PIN code — e.g. "MG Road, Guwahati" or "788001".`);
        return;
      }

      if (Array.isArray(results) && results.length > 0) {
        setSearchSuggestions(results);
        setShowSuggestions(true);
      } else {
        setSearchSuggestions([]);
        toast.error(`No results for "${query}". Try adding a city or PIN code.`);
      }
    } catch (err) {
      console.error('[LocationPicker] Search error:', err);
      toast.error('Location search failed. Please select on the map.');
    } finally {
      if (reqId === requestIdRef.current) setIsSearching(false);
    }
  };

  // ── Search suggestion selection ───────────────────────────────────────────
  const handleSelectSuggestion = (suggestion, e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }

    const reqId = ++requestIdRef.current;
    setShowSuggestions(false);
    setSearchQuery(suggestion.name || suggestion.address);

    const isApprox = suggestion.isApproximate ?? isApproximateGranularity(suggestion.granularity);

    if (isApprox) {
      toast.info(
        `Approximate location: ${suggestion.name}. Drag the marker to your exact spot.`
      );
    } else {
      toast.success(`Location: ${suggestion.name}`);
    }

    // Fire resolveAndNotify with the search coordinates.
    // The preloaded structured data is passed so we avoid an extra API call
    // when the granularity is fine enough. For broad results, we still reverse-geocode
    // to get the most accurate administrative detail for that location.
    resolveAndNotify({
      userLat: suggestion.latitude,
      userLng: suggestion.longitude,
      source: 'search',
      accuracy: null,
      reqId,
      preloaded: {
        address: suggestion.address,
        road: suggestion.road,
        locality: suggestion.locality,
        city: suggestion.city,
        town: suggestion.town,
        village: suggestion.village,
        municipality: suggestion.municipality,
        district: suggestion.district,
        state: suggestion.state,
        postcode: suggestion.postcode,
        country: suggestion.country,
      },
      granularity: suggestion.granularity,
    });
  };

  // ── Map click ─────────────────────────────────────────────────────────────
  const handleMapClick = (lat, lng) => {
    const reqId = ++requestIdRef.current;
    setShowSuggestions(false);
    // Exact user-selected coordinates
    resolveAndNotify({ userLat: lat, userLng: lng, source: 'map_pin', accuracy: null, reqId, granularity: 'exact' });
  };

  // ── Marker drag ───────────────────────────────────────────────────────────
  const handleMarkerDragEnd = () => {
    if (!markerRef.current) return;
    const { lat, lng } = markerRef.current.getLatLng();
    const reqId = ++requestIdRef.current;
    setShowSuggestions(false);
    // Exact dragged coordinates — source becomes map_pin regardless of previous source
    resolveAndNotify({ userLat: lat, userLng: lng, source: 'map_pin', accuracy: null, reqId, granularity: 'exact' });
  };

  // ── Source label & colour helpers ─────────────────────────────────────────
  const sourceLabel = () => {
    if (!currentSource) return null;
    if (currentSource === 'gps') return { label: 'GPS location detected', color: 'emerald', Icon: CheckCircle2 };
    if (currentSource === 'search' && isApproximate) return { label: 'Approximate location from search', color: 'amber', Icon: Info };
    if (currentSource === 'search') return { label: 'Location from search', color: 'blue', Icon: Search };
    return { label: 'Exact location selected', color: 'indigo', Icon: MapPin };
  };
  const src = sourceLabel();
  const colourMap = {
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800',
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800',
    indigo: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800',
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 text-slate-900 dark:text-white transition-colors duration-300">

      {/* Action bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/70">
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={disabled || isLocating}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-xs font-semibold py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all cursor-pointer"
        >
          {isLocating ? (
            <><Loader2 className="w-4 h-4 animate-spin" /><span>Detecting GPS…</span></>
          ) : (
            <><Navigation className="w-4 h-4" /><span>Use Current GPS Location</span></>
          )}
        </button>

        {/* Status badge */}
        <div className="text-[11px] font-medium flex items-center gap-1.5 self-end sm:self-center">
          {isLocating ? (
            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Acquiring GPS…
            </span>
          ) : isReverseGeocoding ? (
            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Resolving address…
            </span>
          ) : src ? (
            <span className={`flex items-center gap-1 font-semibold px-2.5 py-1 rounded-full border ${colourMap[src.color]}`}>
              <src.Icon className="w-3.5 h-3.5" /> {src.label}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800">
              <Compass className="w-3.5 h-3.5" /> Map focused on Assam — search or click map
            </span>
          )}
        </div>
      </div>

      {/* GPS error */}
      {gpsError && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-rose-800 dark:text-rose-300">GPS Error</p>
            <p className="leading-relaxed">{gpsError}</p>
          </div>
        </div>
      )}

      {/* Approximate location hint */}
      {currentSource === 'search' && isApproximate && hasCoordinates && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <span><strong>Approximate location.</strong> Drag the marker on the map to your exact spot, or click the map directly.</span>
        </div>
      )}

      {/* Search input */}
      <div className="relative space-y-1">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          Search Location (cities, roads, landmarks, PIN codes — India)
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="e.g. Silchar Railway Station, 788001, MG Road Guwahati…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); handleSearch(searchQuery); }
              }}
              className="w-full px-3.5 py-2.5 pl-9 bg-slate-100/80 border border-slate-200/80 rounded-xl text-slate-900 placeholder-slate-400 text-xs focus:outline-none dark:bg-slate-800/50 dark:border-slate-700/80 dark:text-white dark:placeholder-slate-500 focus:dark:border-blue-500 transition-colors"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setShowSuggestions(false); }}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSearch(searchQuery); }}
            disabled={disabled || isSearching || !searchQuery.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 font-semibold rounded-xl shrink-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center gap-1.5"
          >
            {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
          </button>
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && searchSuggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-[500] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {searchSuggestions.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => handleSelectSuggestion(item, e)}
                className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-start gap-2.5 text-xs group cursor-pointer"
              >
                <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {item.name}
                    </p>
                    {item.isApproximate && (
                      <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                        approx
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {item.context || item.address}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected address display */}
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          Selected Address <span className="text-rose-500">*</span>
        </label>
        <div className="relative">
          <input
            type="text"
            value={displayAddress}
            readOnly
            placeholder="GPS detect, search, or click the map to set location…"
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white pr-10 cursor-not-allowed font-medium text-xs sm:text-sm rounded-xl"
          />
          <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400 absolute right-3 top-3 pointer-events-none" />
        </div>
      </div>

      {/* Leaflet map */}
      <div className="relative w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xs z-0">
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          scrollWheelZoom={false}
          style={{ height: '340px', width: '100%' }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <MapRecenter center={mapCenter} zoom={mapZoom} />
          <MapClickHandler onMapClick={handleMapClick} />
          {hasCoordinates && (
            <Marker
              position={[Number(latitude), Number(longitude)]}
              draggable={!disabled}
              eventHandlers={{ dragend: handleMarkerDragEnd }}
              ref={markerRef}
            />
          )}
        </MapContainer>

        <div className="absolute bottom-2 left-2 z-[400] bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 backdrop-blur-xs px-2.5 py-1 rounded-md text-[11px] border border-slate-200 dark:border-slate-700 font-medium shadow-xs pointer-events-none">
          {hasCoordinates
            ? '💡 Drag marker or click map to fine-tune exact position'
            : '🗺️ Map centred on Assam — search or click to select'}
        </div>
      </div>

      {/* Metadata readout */}
      <div className="p-3 rounded-xl bg-slate-900 text-slate-100 dark:bg-slate-950 dark:border dark:border-slate-800 text-xs font-mono space-y-1.5">
        {hasCoordinates ? (
          <>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span><strong className="text-blue-400">Lat:</strong> {Number(latitude).toFixed(7)}</span>
              <span><strong className="text-blue-400">Lng:</strong> {Number(longitude).toFixed(7)}</span>
              {locationMeta?.accuracy != null && (
                <span><strong className="text-amber-400">Accuracy:</strong> ±{locationMeta.accuracy} m</span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-300">
              {locationMeta?.municipality && <span><strong className="text-slate-400">Municipality:</strong> {locationMeta.municipality}</span>}
              {(locationMeta?.city || locationMeta?.town || locationMeta?.village) && (
                <span><strong className="text-slate-400">City/Town:</strong> {locationMeta?.city || locationMeta?.town || locationMeta?.village}</span>
              )}
              {locationMeta?.district && <span><strong className="text-slate-400">District:</strong> {locationMeta.district}</span>}
              {locationMeta?.state && <span><strong className="text-slate-400">State:</strong> {locationMeta.state}</span>}
              {locationMeta?.postcode && <span><strong className="text-slate-400">PIN:</strong> {locationMeta.postcode}</span>}
            </div>
            <div className="flex items-center gap-2 pt-0.5 border-t border-slate-800">
              <span className="text-[10px] text-slate-400 font-sans">
                Source: <strong className="text-slate-200 uppercase">{locationMeta?.source || '—'}</strong>
              </span>
              {locationMeta?.granularity && (
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${isApproximate ? 'bg-amber-900/60 text-amber-300' : 'bg-emerald-900/60 text-emerald-300'}`}>
                  {isApproximate ? 'APPROXIMATE' : 'EXACT'}
                </span>
              )}
            </div>
          </>
        ) : (
          <span className="text-slate-400">No location selected</span>
        )}
      </div>

    </div>
  );
}
