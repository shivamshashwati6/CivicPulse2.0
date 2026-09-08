import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Loader2, CheckCircle2, Compass, AlertCircle, Search } from 'lucide-react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { issueService } from '../../services/issueService';
import { useToast } from '../../hooks/useToast';

// Fix Leaflet default marker icon paths in bundled applications
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Helper component to center map programmatically when position changes
function MapRecenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] !== undefined && center[1] !== undefined) {
      map.flyTo(center, zoom || 15, { duration: 1.5 });
    }
  }, [center, zoom, map]);
  return null;
}

// Helper component to capture map click events
function MapEventsHandler({ onLocationChange }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      onLocationChange(lat, lng);
    },
  });
  return null;
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
  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [activeTab, setActiveTab] = useState('gps');
  const [permissionBlockedAlert, setPermissionBlockedAlert] = useState(false);
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const [locationSource, setLocationSource] = useState('none'); // 'gps' | 'manual' | 'ip' | 'search' | 'none'

  // Address search query state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  // Request sequence ID ref & active source ref to prevent async race conditions
  const activeRequestIdRef = useRef(0);
  const currentSourceRef = useRef('none');

  // Unified callback handler for parent component compatibility (onChange or onLocationSelect)
  const notifyParentLocationChange = useCallback(
    (locData) => {
      if (onChange) {
        onChange(locData);
      }
      if (onLocationSelect) {
        onLocationSelect(locData);
      }
    },
    [onChange, onLocationSelect]
  );

  const hasCoordinates =
    latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined;
  const isConfirmed = locationSelected || (hasCoordinates && Boolean(address));

  // Display position fallback for broad India view when unconfirmed
  const currentLat = hasCoordinates ? Number(latitude) : 22.5937;
  const currentLng = hasCoordinates ? Number(longitude) : 78.9629;
  const displayAddress = isConfirmed ? address || initialAddress || '' : '';
  const position = [currentLat, currentLng];

  const markerRef = useRef(null);

  // Auto-detect GPS on mount if permission is already granted
  useEffect(() => {
    if (!hasCoordinates && navigator && navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((status) => {
        if (status.state === 'granted') {
          console.log('[Location] Geolocation permission granted on mount. Auto-detecting position...');
          handleUseCurrentLocation();
        } else if (status.state === 'denied') {
          console.log('[Location] Geolocation permission denied on mount.');
          setPermissionBlockedAlert(true);
        }
      }).catch((err) => {
        console.warn('[Location] Permissions query check notice:', err);
      });
    }
  }, [hasCoordinates, handleUseCurrentLocation]);

  /**
   * Reverse geocode helper to update address and notify parent safely without mutating coordinates
   */
  const handleUpdateCoordinates = useCallback(
    async (lat, lng, source = 'manual', acc = null, reqId = null) => {
      const numLat = Number(lat);
      const numLng = Number(lng);
      const tempAddress = `Selected location (${numLat.toFixed(6)}, ${numLng.toFixed(6)})`;

      // Guard check: ignore stale async calls if newer request occurred
      if (reqId !== null && reqId !== activeRequestIdRef.current) {
        console.warn('[Location] Ignoring stale coordinate update for old request ID:', reqId);
        return;
      }

      currentSourceRef.current = source;
      setLocationSource(source);

      console.log('[Location] Coordinates updated:', {
        latitude: numLat,
        longitude: numLng,
        source,
        accuracy: acc,
        requestId: reqId,
      });

      // 1. Immediately update parent coordinates with current temp address
      notifyParentLocationChange({
        latitude: numLat,
        longitude: numLng,
        address: tempAddress,
        locationSelected: true,
        accuracy: acc,
        source: source,
        timestamp: Date.now(),
      });

      // 2. Perform reverse geocoding asynchronously (maps lat/lng -> address ONLY, never mutates lat/lng)
      setIsGeocoding(true);
      console.log('[Location] Reverse geocoding started for:', numLat, numLng);
      try {
        const res = await issueService.reverseGeocode(numLat, numLng);
        
        // Guard check again after async fetch
        if (reqId !== null && reqId !== activeRequestIdRef.current) {
          console.warn('[Location] Ignoring stale reverse-geocode result for old request ID:', reqId);
          return;
        }

        const newAddress = res?.address || tempAddress;
        console.log('[Location] Reverse geocoding complete:', newAddress);

        notifyParentLocationChange({
          latitude: numLat,
          longitude: numLng,
          address: newAddress,
          locationSelected: true,
          accuracy: acc,
          source: source,
          timestamp: Date.now(),
        });
      } catch (err) {
        console.warn('[Location] Reverse geocoding error:', err);
      } finally {
        if (reqId === null || reqId === activeRequestIdRef.current) {
          setIsGeocoding(false);
        }
      }
    },
    [notifyParentLocationChange]
  );

  /**
   * 📍 Core High-Accuracy Browser GPS Detection Handler
   * Priority 1: High-Accuracy Browser GPS
   * Priority 2: Manual Map Selection
   * Priority 3: IP Geolocation Fallback (ONLY if GPS fails & user hasn't manually picked location)
   */
  const handleUseCurrentLocation = useCallback(() => {
    setActiveTab('gps');
    setPermissionBlockedAlert(false);

    const newRequestId = ++activeRequestIdRef.current;
    currentSourceRef.current = 'gps';
    setLocationSource('gps');

    console.log('[Location] GPS request started. Request ID:', newRequestId);

    const tryIpFallback = async (reqId) => {
      // Do NOT fallback if request is stale or user manually picked a pin in the meantime
      if (reqId !== activeRequestIdRef.current || currentSourceRef.current === 'manual') {
        setIsLocating(false);
        return false;
      }

      console.log('[Location] IP fallback started...');
      try {
        const ipLoc = await issueService.fetchIpLocation();
        if (reqId !== activeRequestIdRef.current || currentSourceRef.current === 'manual') {
          setIsLocating(false);
          return false;
        }

        if (ipLoc && ipLoc.latitude && ipLoc.longitude) {
          console.log('[Location] IP fallback completed:', ipLoc);
          setLocationAccuracy(null);
          setPermissionBlockedAlert(false);
          setIsLocating(false);
          currentSourceRef.current = 'ip';
          setLocationSource('ip');

          toast.info('Approximate location detected via network IP. Drag pin or click map to set exact spot.');
          notifyParentLocationChange({
            latitude: Number(ipLoc.latitude),
            longitude: Number(ipLoc.longitude),
            address: ipLoc.address,
            locationSelected: true,
            accuracy: null,
            source: 'ip',
            timestamp: Date.now(),
          });
          return true;
        }
      } catch (e) {
        console.warn('[Location] IP location fallback error:', e);
      }
      setIsLocating(false);
      return false;
    };

    if (!navigator || !navigator.geolocation) {
      toast.info('Browser geolocation is not supported by your browser. Attempting approximate network location...');
      tryIpFallback(newRequestId);
      return;
    }

    setIsLocating(true);

    // High Accuracy GPS Configuration
    const geoOptions = {
      enableHighAccuracy: true,  // Require exact GPS hardware fix
      timeout: 20000,             // Allow 20s for satellite/sensor lock
      maximumAge: 0,              // Request fresh position, do NOT use stale cached locations
    };

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        // Race condition guard: ignore if user initiated another action
        if (newRequestId !== activeRequestIdRef.current) {
          console.warn('[Location] Ignoring completed GPS reading for stale request ID:', newRequestId);
          setIsLocating(false);
          return;
        }

        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;

        console.log('[Location] GPS success:', {
          latitude: lat,
          longitude: lng,
          accuracy: accuracy,
          source: 'gps',
        });

        setIsLocating(false);
        setPermissionBlockedAlert(false);
        setLocationAccuracy(accuracy);

        if (accuracy <= 100) {
          toast.success(`Exact GPS location detected (accuracy: ±${Math.round(accuracy)} m)!`);
        } else {
          toast.info(`GPS location detected (accuracy: ±${Math.round(accuracy).toLocaleString()} m). Drag marker to refine if needed.`);
        }

        await handleUpdateCoordinates(lat, lng, 'gps', accuracy, newRequestId);
      },
      async (err) => {
        // Race condition guard
        if (newRequestId !== activeRequestIdRef.current) {
          setIsLocating(false);
          return;
        }

        console.warn('[Location] Browser GPS geolocation error:', err);
        setIsLocating(false);

        if (err.code === err.PERMISSION_DENIED) {
          setPermissionBlockedAlert(true);
          toast.error('Location permission was denied. Please allow location access or select on map.');
        } else if (err.code === err.TIMEOUT) {
          toast.warn('GPS location request timed out. Trying fallback network location...');
        }

        // Only attempt IP fallback if user hasn't manually picked a location
        if (currentSourceRef.current !== 'manual') {
          const fallbackOk = await tryIpFallback(newRequestId);
          if (!fallbackOk && err.code !== err.PERMISSION_DENIED) {
            toast.error('Unable to detect location. Please click on the map to set your location manually.');
          }
        }
      },
      geoOptions
    );
  }, [handleUpdateCoordinates, notifyParentLocationChange, toast]);

  /**
   * Search place name / address text geocoding via OpenStreetMap Nominatim
   */
  const handleSearchPlace = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    const newRequestId = ++activeRequestIdRef.current;
    currentSourceRef.current = 'search';
    setLocationSource('search');

    setIsSearchingAddress(true);
    try {
      const geocoded = await issueService.geocodeAddress(searchQuery.trim());
      if (newRequestId !== activeRequestIdRef.current) return;

      if (geocoded && geocoded.latitude !== undefined && geocoded.longitude !== undefined) {
        setActiveTab('map');
        setLocationAccuracy(null);

        notifyParentLocationChange({
          latitude: Number(geocoded.latitude),
          longitude: Number(geocoded.longitude),
          address: geocoded.address,
          locationSelected: true,
          accuracy: null,
          source: 'search',
        });
        toast.success(`Found location for "${searchQuery.trim()}"`);
      } else {
        toast.error('Location not found. Try a more specific place or landmark.');
      }
    } catch (err) {
      console.error('Search place error:', err);
      toast.error('Location search failed. Please select your position on the map.');
    } finally {
      if (newRequestId === activeRequestIdRef.current) {
        setIsSearchingAddress(false);
      }
    }
  };

  /**
   * Marker drag event handler (Manual Map Pin Priority 2)
   */
  const handleMarkerDragEnd = async () => {
    if (markerRef.current) {
      const { lat, lng } = markerRef.current.getLatLng();
      const newRequestId = ++activeRequestIdRef.current;
      currentSourceRef.current = 'manual';
      setLocationSource('manual');
      setActiveTab('map');
      setLocationAccuracy(null);

      await handleUpdateCoordinates(lat, lng, 'manual', null, newRequestId);
      toast.info('Location pin updated via marker drag.');
    }
  };

  /**
   * Map click event handler (Manual Map Pin Priority 2)
   */
  const handleMapClick = async (lat, lng) => {
    const newRequestId = ++activeRequestIdRef.current;
    currentSourceRef.current = 'manual';
    setLocationSource('manual');
    setActiveTab('map');
    setLocationAccuracy(null);

    await handleUpdateCoordinates(lat, lng, 'manual', null, newRequestId);
    toast.info('Location pin set on map.');
  };

  return (
    <div className="space-y-4 text-slate-900 dark:text-white transition-colors duration-300">
      
      {/* Option Selection Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/70 transition-colors">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            type="button"
            variant={activeTab === 'gps' ? 'default' : 'outline'}
            onClick={handleUseCurrentLocation}
            disabled={disabled || isLocating}
            className={`flex-1 sm:flex-initial text-xs font-semibold py-2 px-4 ${
              activeTab === 'gps'
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
            }`}
          >
            {isLocating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Detecting your location...
              </>
            ) : (
              <>
                <Navigation className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                📍 Use My Current Location
              </>
            )}
          </Button>

          <Button
            type="button"
            variant={activeTab === 'map' ? 'default' : 'outline'}
            onClick={() => setActiveTab('map')}
            disabled={disabled}
            className={`flex-1 sm:flex-initial text-xs font-semibold py-2 px-4 ${
              activeTab === 'map'
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
            }`}
          >
            <Compass className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
            🗺️ Select on Map
          </Button>
        </div>

        {/* Status & Accuracy Badge */}
        <div className="text-[11px] font-medium flex items-center gap-1.5 self-end sm:self-center">
          {isLocating ? (
            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Acquiring High-Accuracy GPS...
            </span>
          ) : isGeocoding || isSearchingAddress ? (
            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Reverse Geocoding Address...
            </span>
          ) : !isConfirmed ? (
            <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-semibold px-2.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
              <Compass className="w-3.5 h-3.5" /> Location Unconfirmed (Click Map)
            </span>
          ) : locationSource === 'gps' ? (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              {locationAccuracy ? `GPS Detected (±${Math.round(locationAccuracy)} m)` : 'GPS Location Detected'}
            </span>
          ) : locationSource === 'manual' ? (
            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800">
              <MapPin className="w-3.5 h-3.5" /> Manual Pin Selected
            </span>
          ) : locationSource === 'ip' ? (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800">
              <AlertCircle className="w-3.5 h-3.5" /> Approximate Network Location (IP)
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" /> Location Tagged
            </span>
          )}
        </div>
      </div>

      {/* Place Search Bar */}
      <form onSubmit={handleSearchPlace} className="flex gap-2">
        <div className="relative flex-1">
          <Input
            placeholder="Search city, street, or landmark (e.g. Guwahati Railway Station)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
        </div>
        <Button
          type="submit"
          disabled={disabled || isSearchingAddress || !searchQuery.trim()}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 font-semibold shrink-0"
        >
          {isSearchingAddress ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Search Place'}
        </Button>
      </form>

      {/* Permission Blocked Guidance Alert */}
      {permissionBlockedAlert && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5 shadow-2xs">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-800 dark:text-amber-300">Location Permission Required</p>
            <p className="text-amber-700 dark:text-amber-200/80 leading-relaxed">
              Location permission was denied. Please allow location access in your browser settings or select a location manually on the map.
            </p>
            <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 pt-0.5 font-mono">
              To enable: Click lock icon in browser address bar &gt; Site Settings &gt; Location &gt; Allow.
            </p>
          </div>
        </div>
      )}

      {/* Formatted Address Input */}
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          Selected Location Address <span className="text-rose-500">*</span>
        </label>
        <div className="relative">
          <Input
            value={displayAddress}
            readOnly
            placeholder="Search a place name or click on the map..."
            className="bg-slate-50 dark:bg-slate-800/90 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white pr-10 cursor-not-allowed font-medium text-xs sm:text-sm"
          />
          <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400 absolute right-3 top-3 pointer-events-none" />
        </div>
      </div>

      {/* Responsive Interactive Leaflet Map */}
      <div className="relative w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-2xs z-0">
        <MapContainer
          center={position}
          zoom={hasCoordinates ? 16 : 4}
          scrollWheelZoom={false}
          style={{ height: '300px', width: '100%' }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <MapRecenter center={position} zoom={hasCoordinates ? 16 : 4} />
          <MapEventsHandler onLocationChange={handleMapClick} />
          {hasCoordinates && (
            <Marker
              position={position}
              draggable={!disabled}
              eventHandlers={{ dragend: handleMarkerDragEnd }}
              ref={markerRef}
            />
          )}
        </MapContainer>

        <div className="absolute bottom-2 left-2 z-[400] bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 backdrop-blur-xs px-2.5 py-1 rounded-md text-[11px] border border-slate-200 dark:border-slate-700 font-medium shadow-xs">
          💡 Click map or drag marker to select exact position
        </div>
      </div>

      {/* Latitude, Longitude & Accuracy Readout */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-900 text-slate-100 dark:bg-slate-950 dark:border dark:border-slate-800 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-3">
          {hasCoordinates ? (
            <>
              <span><strong className="text-blue-400">LAT:</strong> {Number(latitude).toFixed(6)}</span>
              <span><strong className="text-blue-400">LNG:</strong> {Number(longitude).toFixed(6)}</span>
            </>
          ) : (
            <span className="text-slate-400">Coordinates unconfirmed (Click map or search place)</span>
          )}
          {locationAccuracy !== null && locationAccuracy !== undefined && (
            <span className="text-slate-300">
              <strong className="text-amber-400">ACCURACY:</strong> ±{Math.round(locationAccuracy).toLocaleString()} m
            </span>
          )}
        </div>
        <div className="text-[10px] text-slate-400 font-sans flex items-center gap-2">
          <span>Source: <strong className="text-slate-200 uppercase">{locationSource || 'None'}</strong></span>
        </div>
      </div>
    </div>
  );
}
