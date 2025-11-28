import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { RoutePoint, RouteData } from '../services/RouteService';
import { OvernightStop } from '../services/OvernightStopService';
import './RouteMap.css';

// Fix for default marker icons in Leaflet with Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';

// Fix Leaflet default icon issue with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: icon,
  iconRetinaUrl: iconRetina,
  shadowUrl: iconShadow,
});

interface RouteMapProps {
  start: RoutePoint;
  end: RoutePoint;
  route: RouteData | null;
  overnightStops?: OvernightStop[];
  isLoading?: boolean;
}

/**
 * RouteMap Component
 * Single Responsibility: Displays map with route visualization
 */
export const RouteMap: React.FC<RouteMapProps> = ({
  start,
  end,
  route,
  overnightStops = [],
  isLoading = false
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const routeLayerRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView(
        [start.lat, start.lon],
        6
      );

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add start marker
    const startMarker = L.marker([start.lat, start.lon])
      .addTo(map)
      .bindPopup('Start Location');
    markersRef.current.push(startMarker);

    // Add end marker
    const endMarker = L.marker([end.lat, end.lon])
      .addTo(map)
      .bindPopup('End Location');
    markersRef.current.push(endMarker);

    // Add overnight stop markers
    overnightStops.forEach((stop) => {
      const stopIcon = L.divIcon({
        className: 'overnight-stop-marker',
        html: `<div class="stop-marker-content">${stop.day}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30]
      });

      const stopMarker = L.marker([stop.city.lat, stop.city.lon], {
        icon: stopIcon
      })
        .addTo(map)
        .bindPopup(
          `<strong>Day ${stop.day}: ${stop.city.name}</strong><br/>` +
          `Arrival: ${Math.floor(stop.arrivalTimeSec / 3600)}h ${Math.floor((stop.arrivalTimeSec % 3600) / 60)}m`
        );
      markersRef.current.push(stopMarker);
    });

    // Clear existing route
    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    // Add route if available
    if (route && route.coordinates.length > 0) {
      const routeCoordinates = route.coordinates.map(
        point => [point.lat, point.lon] as [number, number]
      );

      routeLayerRef.current = L.polyline(routeCoordinates, {
        color: '#3b82f6',
        weight: 4,
        opacity: 0.7
      }).addTo(map);

      // Fit map to show entire route
      const bounds = L.latLngBounds(routeCoordinates);
      // Include overnight stops in bounds if available
      if (overnightStops.length > 0) {
        overnightStops.forEach(stop => {
          bounds.extend([stop.city.lat, stop.city.lon]);
        });
      }
      map.fitBounds(bounds, { padding: [50, 50] });
    } else {
      // Fit map to show both markers and overnight stops
      const bounds = L.latLngBounds(
        [[start.lat, start.lon], [end.lat, end.lon]]
      );
      if (overnightStops.length > 0) {
        overnightStops.forEach(stop => {
          bounds.extend([stop.city.lat, stop.city.lon]);
        });
      }
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    return () => {
      // Cleanup on unmount
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [start, end, route, overnightStops]);

  return (
    <div className="route-map-container">
      {isLoading && (
        <div className="route-map-loading">
          <div className="route-map-spinner"></div>
          <p>Calculating route...</p>
        </div>
      )}
      <div ref={mapContainerRef} className="route-map" />
    </div>
  );
};

