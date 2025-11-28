/**
 * RouteService
 * Single Responsibility: Handles route calculation API calls
 * Dependency Inversion: Provides abstraction for route data fetching
 */

export interface RoutePoint {
  lat: number;
  lon: number;
}

export interface RouteData {
  coordinates: RoutePoint[];
  distance: number; // in kilometers
  duration: number; // in seconds
  summary: string;
}

export class RouteService {
  private static readonly OSRM_API_URL = 'https://router.project-osrm.org/route/v1/driving';

  /**
   * Calculate route between two points
   * @param start - Starting location coordinates
   * @param end - Ending location coordinates
   * @returns Promise with route data
   */
  static async calculateRoute(
    start: RoutePoint,
    end: RoutePoint
  ): Promise<RouteData | null> {
    try {
      const url = `${this.OSRM_API_URL}/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'TripPlanningApp/1.0'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to calculate route');
      }

      const data = await response.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        return null;
      }

      const route = data.routes[0];
      const geometry = route.geometry.coordinates;

      return {
        coordinates: geometry.map((coord: [number, number]) => ({
          lon: coord[0],
          lat: coord[1]
        })),
        distance: route.distance / 1000, // Convert meters to kilometers
        duration: route.duration, // in seconds
        summary: `Distance: ${(route.distance / 1000).toFixed(1)} km, Duration: ${this.formatDuration(route.duration)}`
      };
    } catch (error) {
      console.error('Error calculating route:', error);
      return null;
    }
  }

  /**
   * Format duration in seconds to human-readable string
   */
  private static formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Geocode a location string to coordinates using Nominatim
   * @param location - Location string
   * @returns Promise with coordinates or null
   */
  static async geocodeLocation(location: string): Promise<RoutePoint | null> {
    try {
      const params = new URLSearchParams({
        q: location,
        format: 'json',
        limit: '1'
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        {
          headers: {
            'User-Agent': 'TripPlanningApp/1.0'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to geocode location');
      }

      const data = await response.json();

      if (!data || data.length === 0) {
        return null;
      }

      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon)
      };
    } catch (error) {
      console.error('Error geocoding location:', error);
      return null;
    }
  }
}


