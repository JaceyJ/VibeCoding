/**
 * CityService
 * Single Responsibility: Handles city search and data retrieval
 * Dependency Inversion: Provides abstraction for city data fetching
 */

import { Point } from '../utils/GeographicUtils';
import { haversineDistance } from '../utils/GeographicUtils';

export interface City {
  name: string;
  displayName: string;
  lat: number;
  lon: number;
  placeType: 'city' | 'town' | 'village' | 'hamlet' | 'locality' | 'unknown';
  distanceFromRoute: number; // in kilometers
}

/**
 * Search for nearby cities around a given point
 * @param center - Center point to search around
 * @param minRadiusKm - Minimum radius in kilometers (default: 20)
 * @param maxRadiusKm - Maximum radius in kilometers (default: 50)
 * @returns Promise with array of nearby cities
 */
export async function findNearbyCities(
  center: Point,
  minRadiusKm: number = 20,
  maxRadiusKm: number = 50
): Promise<City[]> {
  try {
    // Use Nominatim reverse geocoding and nearby search
    // First, get the city at the center point
    const reverseParams = new URLSearchParams({
      lat: center.lat.toString(),
      lon: center.lon.toString(),
      format: 'json',
      addressdetails: '1',
      zoom: '10'
    });

    const reverseResponse = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${reverseParams.toString()}`,
      {
        headers: {
          'User-Agent': 'TripPlanningApp/1.0'
        }
      }
    );

    if (!reverseResponse.ok) {
      return [];
    }

    const reverseData = await reverseResponse.json();
    const cities: City[] = [];

    // Search in a bounding box around the center point
    // Approximate bounding box calculation
    const latDelta = maxRadiusKm / 111; // ~111 km per degree latitude
    const lonDelta = maxRadiusKm / (111 * Math.cos(toRadians(center.lat)));

    const bbox = [
      center.lat - latDelta,
      center.lon - lonDelta,
      center.lat + latDelta,
      center.lon + lonDelta
    ].join(',');

    // Note: Overpass API removed due to query complexity and rate limiting
    // Using Nominatim with enhanced population extraction instead

    // Use Nominatim search with better parameters for population data
    // Search for places near the center point
    const searchParams = new URLSearchParams({
      q: '',
      format: 'json',
      limit: '50',
      bbox: bbox,
      addressdetails: '1',
      extratags: '1',
      namedetails: '1',
      polygon_geojson: '0',
      zoom: '10',
      'accept-language': 'en'
    });

    const searchResponse = await fetch(
      `https://nominatim.openstreetmap.org/search?${searchParams.toString()}`,
      {
        headers: {
          'User-Agent': 'TripPlanningApp/1.0'
        }
      }
    );

    if (!searchResponse.ok) {
      return [];
    }

    const searchData = await searchResponse.json();
    console.log(`[CityService] Nominatim search returned ${searchData.length} results`);

    // Process results and filter by radius and place type
    for (const result of searchData) {
      // Filter for actual places (cities, towns, villages)
      const placeType = result.type || result.class || '';
      const category = result.category || '';
      
      // Only include places, not roads or other features
      if (category !== 'place' && placeType !== 'city' && placeType !== 'town' && placeType !== 'village') {
        continue;
      }

      const cityPoint: Point = {
        lat: parseFloat(result.lat),
        lon: parseFloat(result.lon)
      };

      const distance = haversineDistance(center, cityPoint);

      if (distance >= minRadiusKm && distance <= maxRadiusKm) {
        const placeType = extractPlaceType(result);
        const cityName = result.display_name.split(',')[0];
        const displayName = result.display_name;

        console.log(`[CityService] Adding city: ${cityName}, place type: ${placeType}, distance: ${distance.toFixed(1)}km`);

        cities.push({
          name: cityName,
          displayName: displayName,
          lat: cityPoint.lat,
          lon: cityPoint.lon,
          placeType: placeType,
          distanceFromRoute: distance
        });
      }
    }

    // Also add the city at the center if it exists
    if (reverseData.address) {
      const cityName = reverseData.address.city ||
        reverseData.address.town ||
        reverseData.address.village ||
        reverseData.display_name.split(',')[0];

      const centerCity: City = {
        name: cityName,
        displayName: reverseData.display_name,
        lat: center.lat,
        lon: center.lon,
        placeType: extractPlaceType(reverseData),
        distanceFromRoute: 0
      };

      // Only add if not already in the list
      const exists = cities.some(
        c => Math.abs(c.lat - centerCity.lat) < 0.001 &&
        Math.abs(c.lon - centerCity.lon) < 0.001
      );

      if (!exists) {
        cities.push(centerCity);
      }
    }

    return cities;
  } catch (error) {
    console.error('Error finding nearby cities:', error);
    return [];
  }
}

/**
 * Extract place type from Nominatim result using OSM place hierarchy
 * OpenStreetMap has a well-maintained hierarchy:
 * - place=city → major cities
 * - place=town → smaller towns
 * - place=village → villages
 * - place=hamlet → hamlets
 * - place=locality → localities
 */
function extractPlaceType(result: any): 'city' | 'town' | 'village' | 'hamlet' | 'locality' | 'unknown' {
  // Check extratags first (most reliable - comes directly from OSM)
  if (result.extratags?.place) {
    const place = String(result.extratags.place).toLowerCase();
    if (place === 'city' || place === 'town' || place === 'village' || place === 'hamlet' || place === 'locality') {
      console.log(`[CityService] ✓ Found place type in extratags: ${place} for ${result.display_name?.split(',')[0]}`);
      return place as 'city' | 'town' | 'village' | 'hamlet' | 'locality';
    }
  }

  // Check address fields
  if (result.address?.city) {
    console.log(`[CityService] → Classified as city from address.city for ${result.display_name?.split(',')[0]}`);
    return 'city';
  }
  if (result.address?.town) {
    console.log(`[CityService] → Classified as town from address.town for ${result.display_name?.split(',')[0]}`);
    return 'town';
  }
  if (result.address?.village) {
    console.log(`[CityService] → Classified as village from address.village for ${result.display_name?.split(',')[0]}`);
    return 'village';
  }

  // Use type/class from Nominatim
  const type = result.type || result.class || '';
  const category = result.category || '';
  const placeRank = result.place_rank || 0;

  // Check if it's a city
  if (type === 'city' || (category === 'place' && placeRank >= 16)) {
    console.log(`[CityService] → Classified as city (type: ${type}, rank: ${placeRank}) for ${result.display_name?.split(',')[0]}`);
    return 'city';
  }

  // Check if it's a town
  if (type === 'town' || (category === 'place' && placeRank >= 14)) {
    console.log(`[CityService] → Classified as town (type: ${type}, rank: ${placeRank}) for ${result.display_name?.split(',')[0]}`);
    return 'town';
  }

  // Check if it's a village
  if (type === 'village' || (category === 'place' && placeRank >= 12)) {
    console.log(`[CityService] → Classified as village (type: ${type}, rank: ${placeRank}) for ${result.display_name?.split(',')[0]}`);
    return 'village';
  }

  // Check if it's a hamlet
  if (type === 'hamlet' || (category === 'place' && placeRank >= 10)) {
    console.log(`[CityService] → Classified as hamlet (type: ${type}, rank: ${placeRank}) for ${result.display_name?.split(',')[0]}`);
    return 'hamlet';
  }

  // Check if it's a locality
  if (type === 'locality' || category === 'place') {
    console.log(`[CityService] → Classified as locality (type: ${type}) for ${result.display_name?.split(',')[0]}`);
    return 'locality';
  }

  // Default fallback
  console.log(`[CityService] ⚠ Could not determine place type for ${result.display_name?.split(',')[0]}, using unknown`);
  return 'unknown';
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

