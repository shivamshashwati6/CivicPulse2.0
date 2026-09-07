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
  const [gpsAccuracyTooLow, setGpsAccuracyTooLow] = useState(false);

  // Address search query state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

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

  /**
   * Reverse geocode helper to update address and notify parent
   */
  const handleUpdateCoordinates = useCallback(
    async (lat, lng, notifySuccess = true, acc = null) => {
      const numLat = Number(lat);
      const numLng = Number(lng);
      const tempAddress = `Selected map location (${numLat.toFixed(5)}, ${numLng.toFixed(5)})`;

      // 1. Immediately update parent coordinates as confirmed
      notifyParentLocationChange({
        latitude: numLat,
        longitude: numLng,
        address: displayAddress || tempAddress,
        locationSelected: true,
        accuracy: acc,
      });

      // 2. Perform reverse geocoding asynchronously
      setIsGeocoding(true);
      try {
        const res = await issueService.reverseGeocode(numLat, numLng);
        const newAddress = res?.address || tempAddress;

        notifyParentLocationChange({
          latitude: numLat,
          longitude: numLng,
          address: newAddress,
          locationSelected: true,
          accuracy: acc,
        });

        if (notifySuccess) {
          toast.success('Location address updated');
        }
      } catch (err) {
        console.warn('Reverse geocoding error:', err);
      } finally {
        setIsGeocoding(false);
      }
    },
    [displayAddress, notifyParentLocationChange, toast]
  );

  /**
   * 📍 Core GPS Detection Handler (Optimized with 5000m threshold, silent IP fallback & smooth map flyTo)
   */
  const handleUseCurrentLocation = useCallback(() => {
    setActiveTab('gps');
    setPermissionBlockedAlert(false);

    const tryIpFallback = async () => {
      try {
        const ipLoc = await issueService.fetchIpLocation();
        if (ipLoc && ipLoc.latitude && ipLoc.longitude) {
          setLocationAccuracy(null);
          setGpsAccuracyTooLow(false);
          setPermissionBlockedAlert(false);
          setIsLocating(false);
          toast.info('Location centered over area network. Click map or drag pin to refine.');
          notifyParentLocationChange({
            latitude: ipLoc.latitude,
            longitude: ipLoc.longitude,
            address: ipLoc.address,
            locationSelected: true,
            accuracy: null,
          });
          return true;
        }
      } catch (e) {
        console.warn('IP location fallback error:', e);
      }
      setIsLocating(false);
      return false;
    };

    if (!navigator || !navigator.geolocation) {
      tryIpFallback();
      return;
    }

    setIsLocating(true);

    const geoOptions = {
      enableHighAccuracy: false, // Set false to allow fast Wi-Fi/cellular triangulation on laptops
      timeout: 15000,            // 15 seconds allowance
      maximumAge: 30000,         // Allow cached location up to 30 seconds
    };

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;

        // Log raw browser GPS result
        console.log("RAW GPS:", {
          latitude: lat,
          longitude: lng,
          accuracy: accuracy
        });

        setLocationAccuracy(accuracy);

        if (accuracy > 5000) {
          // Accuracy > 5000m: Silently attempt IP location fallback
          const fallbackOk = await tryIpFallback();
          if (!fallbackOk) {
            setGpsAccuracyTooLow(true);
            toast.info('Location accuracy is broad. Click map to refine exact point.');
          }
          return;
        }

        // Position accuracy <= 5000m accepted smoothly
        setIsLocating(false);
        setGpsAccuracyTooLow(false);
        setPermissionBlockedAlert(false);

        if (accuracy <= 100) {
          toast.success(`Location detected (high accuracy: ±${Math.round(accuracy)} m)!`);
        } else {
          toast.success(`Location detected (±${Math.round(accuracy).toLocaleString()} m). Click map to refine if needed.`);
        }

        await handleUpdateCoordinates(lat, lng, false, accuracy);
      },
      async (err) => {
        console.warn('Geolocation access error, attempting IP location fallback:', err);

        if (err.code === err.PERMISSION_DENIED) {
          setPermissionBlockedAlert(true);
        }

        const fallbackOk = await tryIpFallback();
        if (!fallbackOk) {
          toast.error('Unable to retrieve location. Please select your location manually on the map.');
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

    setIsSearchingAddress(true);
    try {
      const geocoded = await issueService.geocodeAddress(searchQuery.trim());
      if (geocoded && geocoded.latitude !== undefined && geocoded.longitude !== undefined) {
        setActiveTab('map');
        setLocationAccuracy(null);
        setGpsAccuracyTooLow(false);
        notifyParentLocationChange({
          latitude: geocoded.latitude,
          longitude: geocoded.longitude,
          address: geocoded.address,
          locationSelected: true,
          accuracy: null,
        });
        toast.success(`Found location for "${searchQuery.trim()}"`);
      } else {
        toast.error('Location not found. Try a more specific place or landmark.');
      }
    } catch (err) {
      console.error('Search place error:', err);
      toast.error('Location not found. Try a more specific place or landmark.');
    } finally {
      setIsSearchingAddress(false);
    }
  };

  /**
   * Marker drag event handler
   */
  const handleMarkerDragEnd = async () => {
    if (markerRef.current) {
      const { lat, lng } = markerRef.current.getLatLng();
      setActiveTab('map');
      setLocationAccuracy(null);
      setGpsAccuracyTooLow(false);
      await handleUpdateCoordinates(lat, lng, true, null);
    }
  };

  /**
   * Map click event handler
   */
  const handleMapClick = async (lat, lng) => {
    setActiveTab('map');
    setLocationAccuracy(null);
    setGpsAccuracyTooLow(false);
    await handleUpdateCoordinates(lat, lng, true, null);
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

        {/* Status Tag Badge */}
        <div className="text-[11px] font-medium flex items-center gap-1.5 self-end sm:self-center">
          {isGeocoding || isSearchingAddress ? (
            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Fetching location...
            </span>
          ) : !isConfirmed && gpsAccuracyTooLow ? (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800">
              <AlertCircle className="w-3.5 h-3.5" /> Location accuracy too low
            </span>
          ) : !isConfirmed ? (
            <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
              <Compass className="w-3.5 h-3.5" /> Coordinates unconfirmed
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" /> Location tagged
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
          zoom={hasCoordinates ? 15 : 4}
          scrollWheelZoom={false}
          style={{ height: '300px', width: '100%' }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <MapRecenter center={position} zoom={hasCoordinates ? 15 : 4} />
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
        <span className="text-[10px] text-slate-400 font-sans">OpenStreetMap GIS Metadata</span>
      </div>
    </div>
  );
}
