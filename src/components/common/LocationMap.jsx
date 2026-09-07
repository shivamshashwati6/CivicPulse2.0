import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon paths in bundled applications
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export function LocationMap({ latitude, longitude, onLocationSelect, height = '260px' }) {
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markerRef = useRef(null);

  const initialLatRef = useRef(latitude);
  const initialLngRef = useRef(longitude);

  const onLocationSelectRef = useRef(onLocationSelect);
  useEffect(() => {
    onLocationSelectRef.current = onLocationSelect;
  }, [onLocationSelect]);

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current) return;

    const defaultLat = initialLatRef.current || 28.6139; // Default fallback (e.g. New Delhi)
    const defaultLng = initialLngRef.current || 77.2090;

    if (!leafletMapRef.current) {
      const map = L.map(mapRef.current, {
        center: [defaultLat, defaultLng],
        zoom: initialLatRef.current && initialLngRef.current ? 15 : 12,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([defaultLat, defaultLng], {
        draggable: true,
      }).addTo(map);

      // Handle marker drag
      marker.on('dragend', () => {
        const position = marker.getLatLng();
        if (onLocationSelectRef.current) {
          onLocationSelectRef.current({ lat: position.lat, lng: position.lng });
        }
      });

      // Handle map click
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        if (onLocationSelectRef.current) {
          onLocationSelectRef.current({ lat, lng });
        }
      });

      leafletMapRef.current = map;
      markerRef.current = marker;
    }

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Update map and marker position when lat/lng props change
  useEffect(() => {
    if (leafletMapRef.current && markerRef.current && latitude && longitude) {
      const newPos = [latitude, longitude];
      markerRef.current.setLatLng(newPos);
      leafletMapRef.current.setView(newPos, 15, { animate: true });
    }
  }, [latitude, longitude]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-gray-200 shadow-inner">
      <div ref={mapRef} style={{ height }} className="w-full z-0" />
      <div className="absolute bottom-2 left-2 z-[400] bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-md text-[11px] text-gray-600 border border-gray-200 font-medium">
        💡 Click map or drag marker to refine position
      </div>
    </div>
  );
}
