/**
 * LocationService
 * Single Responsibility: Handles location search API calls
 * Dependency Inversion: Provides abstraction for location data fetching
 */

export interface LocationSuggestion {
  displayName: string;
  fullAddress: string;
  lat: number;
  lon: number;
}

export class LocationService {
  private static readonly NOMINATIM_API_URL = 'https://nominatim.openstreetmap.org/search';
  private static readonly DEBOUNCE_DELAY = 300; // milliseconds

  /**
   * Search for location suggestions based on query
   * @param query - Search query string
   * @returns Promise with array of location suggestions
   */
  static async searchLocations(query: string): Promise<LocationSuggestion[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        limit: '5',
        addressdetails: '1',
        extratags: '1'
      });

      const response = await fetch(`${this.NOMINATIM_API_URL}?${params.toString()}`, {
        headers: {
          'User-Agent': 'TripPlanningApp/1.0'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch location suggestions');
      }

      const data = await response.json();
      return this.mapNominatimResults(data);
    } catch (error) {
      console.error('Error fetching location suggestions:', error);
      return [];
    }
  }

  /**
   * Maps Nominatim API results to LocationSuggestion format
   */
  private static mapNominatimResults(results: any[]): LocationSuggestion[] {
    return results.map((result) => ({
      displayName: result.display_name.split(',')[0], // First part (usually city/place name)
      fullAddress: result.display_name,
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon)
    }));
  }

  /**
   * Debounce function to limit API calls
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return function executedFunction(...args: Parameters<T>) {
      const later = () => {
        timeout = null;
        func(...args);
      };
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(later, wait);
    };
  }
}

