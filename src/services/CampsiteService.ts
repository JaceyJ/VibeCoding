import { Point, haversineDistance } from '../utils/GeographicUtils';
import { Hotel } from './HotelService';

export type Campsite = Hotel;

/**
 * CampsiteService
 * Single Responsibility: Search and score nearby campsites using Nominatim.
 *
 * We reuse the Hotel shape (name/address/lat/lon/distance/url/score) so that
 * existing lodging UI components (e.g. HotelResult) can render campsites
 * without major changes.
 */
export class CampsiteService {
  private static readonly NOMINATIM_API_URL = 'https://nominatim.openstreetmap.org/search';

  /**
   * Search for campsites near a given point.
   *
   * @param center - Center point to search around
   * @param radiusKm - Search radius in kilometers (default: 60km)
   * @returns Top 10 scored campsite-like places as Hotel-shaped objects
   */
  static async searchCampsites(
    center: Point,
    radiusKm: number = 60
  ): Promise<Campsite[]> {
    try {
      console.log(
        `[CampsiteService] Searching campsites near ${center.lat.toFixed(
          4
        )}, ${center.lon.toFixed(4)} within ${radiusKm}km radius`
      );

      // Compute a bounding box a bit larger than the radius to ensure we get candidates
      const latDelta = (radiusKm * 1.2) / 111;
      const lonDelta = (radiusKm * 1.2) / (111 * Math.cos((center.lat * Math.PI) / 180));
      const bbox = [
        center.lat - latDelta,
        center.lon - lonDelta,
        center.lat + latDelta,
        center.lon + lonDelta
      ].join(',');

      // Use Nominatim to search for camping-related places in the bbox
      const searchParams = new URLSearchParams({
        q: 'campground',
        format: 'json',
        limit: '50',
        bbox,
        addressdetails: '1',
        extratags: '1',
        namedetails: '1',
        'accept-language': 'en',
        bounded: '1'
      });

      const response = await fetch(
        `${CampsiteService.NOMINATIM_API_URL}?${searchParams.toString()}`,
        {
          headers: {
            'User-Agent': 'TripPlanningApp/1.0'
          }
        }
      );

      if (!response.ok) {
        console.warn('[CampsiteService] Nominatim search failed with status', response.status);
        return [];
      }

      const data = await response.json();
      console.log(
        `[CampsiteService] Nominatim returned ${data.length} raw results for campground query`
      );

      const campsites: Campsite[] = [];

      for (const result of data) {
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        if (
          Number.isNaN(lat) ||
          Number.isNaN(lon) ||
          lat < -90 ||
          lat > 90 ||
          lon < -180 ||
          lon > 180
        ) {
          continue;
        }

        const distance = haversineDistance(center, { lat, lon });
        if (distance > radiusKm) {
          continue;
        }

        const name =
          result.display_name?.split(',')[0] ||
          result.name ||
          result.address?.camp_site ||
          result.address?.campsite ||
          'Campsite';

        const type = (result.type || '').toLowerCase();
        const tourism = (result.extratags?.tourism || '').toLowerCase();
        const amenity = (result.extratags?.amenity || '').toLowerCase();
        const display = (result.display_name || '').toLowerCase();

        const looksLikeCampsite =
          tourism === 'camp_site' ||
          amenity === 'camp_site' ||
          type === 'camp_site' ||
          display.includes('campground') ||
          display.includes('rv park') ||
          display.includes('rv park') ||
          display.includes('campsite') ||
          display.includes('campground') ||
          display.includes('camping');

        if (!looksLikeCampsite) {
          continue;
        }

        const campsite: Campsite = {
          name,
          address: result.display_name || 'Campsite',
          lat,
          lon,
          distance,
          // priceLevel and rating are rarely available for campsites; leave undefined
          priceLevel: undefined,
          rating: undefined,
          url: CampsiteService.generateCampsiteUrl({ name, lat, lon }),
          score: 0
        };

        // Simple scoring: closer is better; minor bonus if explicitly tagged as camp_site
        let score = 100 - distance; // base on distance
        if (tourism === 'camp_site' || amenity === 'camp_site' || type === 'camp_site') {
          score += 20;
        }
        campsite.score = score;

        campsites.push(campsite);
      }

      // Sort and limit
      campsites.sort((a, b) => b.score - a.score);
      const top = campsites.slice(0, 10);
      console.log(
        `[CampsiteService] Returning ${top.length} campsites out of ${campsites.length} candidates`
      );
      return top;
    } catch (error) {
      console.error('[CampsiteService] Error searching campsites:', error);
      return [];
    }
  }

  private static generateCampsiteUrl(campsite: { name: string; lat: number; lon: number }): string {
    const name = encodeURIComponent(campsite.name);
    const lat = campsite.lat;
    const lon = campsite.lon;
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}&query_place_id=${name}`;
  }
}


