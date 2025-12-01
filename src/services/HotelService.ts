/**
 * HotelService
 * Single Responsibility: Handles hotel search and scoring
 * Dependency Inversion: Provides abstraction for hotel data fetching
 */

import { Point } from '../utils/GeographicUtils';
import { haversineDistance } from '../utils/GeographicUtils';
import { HotelSearchParams } from '../components/HotelSearchModal';

export interface Hotel {
  name: string;
  address: string;
  lat: number;
  lon: number;
  priceLevel?: number; // 1-4 corresponding to $, $$, $$$, $$$$
  rating?: number;
  distance: number; // in kilometers
  url?: string;
  score: number;
  estimatedPriceRange?: {
    min: number;
    max: number;
    currency: string;
  };
}

/**
 * Search for hotels near a given point
 * @param center - Center point to search around
 * @param searchParams - Hotel search parameters
 * @param radiusKm - Search radius in kilometers (default: 30 miles = ~48 km)
 * @returns Promise with array of top 5 scored hotels
 */
export async function searchHotels(
  center: Point,
  searchParams: HotelSearchParams,
  radiusKm: number = 48.28, // 30 miles in kilometers
  placeType: string = 'city' // Place type for price estimation
): Promise<Hotel[]> {
  try {
    // Use Nominatim to search for hotels/accommodations
    // Calculate bounding box - use a slightly larger bbox to ensure we get results
    // then filter by actual haversine distance
    const latDelta = (radiusKm * 1.2) / 111; // Add 20% buffer for bbox
    const lonDelta = (radiusKm * 1.2) / (111 * Math.cos((center.lat * Math.PI) / 180));

    const bbox = [
      center.lat - latDelta,
      center.lon - lonDelta,
      center.lat + latDelta,
      center.lon + lonDelta
    ].join(',');
    
    console.log(`[HotelService] Searching hotels near ${center.lat.toFixed(4)}, ${center.lon.toFixed(4)} within ${radiusKm}km radius`);

    // Use reverse geocoding to get the area name, then search for hotels in that area
    // This is more reliable than searching with just keywords
    let areaName = '';
    try {
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

      if (reverseResponse.ok) {
        const reverseData = await reverseResponse.json();
        areaName = reverseData.address?.city || 
                   reverseData.address?.town || 
                   reverseData.address?.county ||
                   reverseData.address?.state ||
                   '';
        console.log(`[HotelService] Searching hotels near: ${areaName || 'unknown area'}`);
      }
    } catch (error) {
      console.warn('[HotelService] Error getting area name:', error);
    }

    // Search for hotels using area name + hotel keyword
    const allResults: any[] = [];
    const searchQueries = areaName 
      ? [`hotel ${areaName}`, `motel ${areaName}`, `inn ${areaName}`]
      : ['hotel', 'motel', 'inn'];

    for (const query of searchQueries) {
      try {
        const searchParams_url = new URLSearchParams({
          q: query,
          format: 'json',
          limit: '20',
          bbox: bbox,
          addressdetails: '1',
          extratags: '1',
          namedetails: '1',
          'accept-language': 'en',
          bounded: '1' // Force results to be within bbox
        });

        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?${searchParams_url.toString()}`,
          {
            headers: {
              'User-Agent': 'TripPlanningApp/1.0'
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          
          // Filter for actual hotels/accommodations and verify they're in bbox
          const hotelResults = data.filter((result: any) => {
            const resultLat = parseFloat(result.lat);
            const resultLon = parseFloat(result.lon);
            
            // Check if result is actually within bbox
            const bboxArray = bbox.split(',').map(parseFloat);
            const inBbox = resultLat >= bboxArray[0] && 
                          resultLat <= bboxArray[2] &&
                          resultLon >= bboxArray[1] && 
                          resultLon <= bboxArray[3];
            
            if (!inBbox) {
              return false; // Skip if not in bbox
            }
            
            const type = result.type || result.class || '';
            const category = result.category || '';
            const name = (result.display_name || '').toLowerCase();
            return (
              type === 'hotel' ||
              type === 'motel' ||
              type === 'hostel' ||
              category === 'tourism' ||
              name.includes('hotel') ||
              name.includes('motel') ||
              name.includes('inn') ||
              name.includes('lodge') ||
              name.includes('resort')
            );
          });
          
          allResults.push(...hotelResults);
          console.log(`[HotelService] Query "${query}": found ${hotelResults.length} hotels in bbox`);
          
          // Add delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 300));
        } else {
          console.warn(`[HotelService] Nominatim search failed for "${query}": ${response.status}`);
        }
      } catch (error) {
        console.warn(`[HotelService] Error searching for ${query}:`, error);
      }
    }

    // Remove duplicates based on coordinates
    const uniqueResults = allResults.filter((result, index, self) =>
      index === self.findIndex((r) => 
        Math.abs(parseFloat(r.lat) - parseFloat(result.lat)) < 0.001 &&
        Math.abs(parseFloat(r.lon) - parseFloat(result.lon)) < 0.001
      )
    );

    console.log(`[HotelService] Found ${uniqueResults.length} unique potential hotels`);
    console.log(`[HotelService] Search center: ${center.lat}, ${center.lon}, radius: ${radiusKm}km`);

    // Process and score hotels
    const hotels: Hotel[] = [];
    let tooFarCount = 0;
    let processedCount = 0;

    for (const result of uniqueResults) {
      processedCount++;
      
      // Parse coordinates carefully
      const hotelLat = parseFloat(result.lat);
      const hotelLon = parseFloat(result.lon);
      
      // Validate coordinates
      if (isNaN(hotelLat) || isNaN(hotelLon) || 
          hotelLat < -90 || hotelLat > 90 || 
          hotelLon < -180 || hotelLon > 180) {
        console.warn(`[HotelService] Invalid coordinates for hotel: ${result.display_name}, lat: ${result.lat}, lon: ${result.lon}`);
        continue;
      }
      
      const hotelPoint: Point = {
        lat: hotelLat,
        lon: hotelLon
      };

      const distance = haversineDistance(center, hotelPoint);
      
      // Debug: log first few distances with coordinates
      if (processedCount <= 5) {
        console.log(`[HotelService] Hotel ${processedCount}: ${result.display_name?.split(',')[0] || 'Unknown'}`);
        console.log(`[HotelService]   Center: ${center.lat.toFixed(4)}, ${center.lon.toFixed(4)}`);
        console.log(`[HotelService]   Hotel: ${hotelPoint.lat.toFixed(4)}, ${hotelPoint.lon.toFixed(4)}`);
        console.log(`[HotelService]   Distance: ${distance.toFixed(2)}km, radius limit: ${radiusKm}km`);
      }

      if (distance <= radiusKm) {
        const hotelName = result.display_name?.split(',')[0] || 
                         result.name || 
                         result.address?.hotel ||
                         result.address?.name ||
                         'Unknown Hotel';
        
        const priceLevel = extractPriceLevel(result);
        
        const hotel: Hotel = {
          name: hotelName,
          address: result.display_name || 'Address not available',
          lat: hotelPoint.lat,
          lon: hotelPoint.lon,
          priceLevel: priceLevel,
          rating: extractRating(result),
          distance: distance,
          url: generateBookingUrl({ name: hotelName, lat: hotelPoint.lat, lon: hotelPoint.lon }),
          score: 0, // Will be calculated
          estimatedPriceRange: estimatePriceRange(
            priceLevel,
            placeType, // This is the parameter passed to searchHotels
            searchParams.numberOfGuests,
            searchParams.extendStay ? (searchParams.numberOfDays || 1) : 1
          )
        };

        // Score the hotel
        hotel.score = scoreHotel(hotel, searchParams, center);

        hotels.push(hotel);
        if (hotels.length <= 5) {
          console.log(`[HotelService] Added hotel: ${hotel.name}, distance: ${distance.toFixed(2)}km, score: ${hotel.score.toFixed(2)}`);
        }
      } else {
        tooFarCount++;
        if (tooFarCount <= 3) {
          console.log(`[HotelService] Hotel ${result.display_name?.split(',')[0]} too far: ${distance.toFixed(2)}km > ${radiusKm}km`);
        }
      }
    }

    console.log(`[HotelService] Processed ${processedCount} hotels: ${hotels.length} within radius, ${tooFarCount} too far`);

    // Sort by score (highest first) and return top 5
    hotels.sort((a, b) => b.score - a.score);
    const topHotels = hotels.slice(0, 5);

    console.log(`[HotelService] Returning top ${topHotels.length} hotels out of ${hotels.length} total`);
    if (topHotels.length > 0) {
      console.log(`[HotelService] Top hotel scores:`, topHotels.map(h => `${h.name}: ${h.score.toFixed(2)}`));
    } else if (hotels.length > 0) {
      console.warn(`[HotelService] Hotels found but none passed filtering. Sample scores:`, 
        hotels.slice(0, 3).map(h => `${h.name}: ${h.score.toFixed(2)}`));
    }
    return topHotels;
  } catch (error) {
    console.error('[HotelService] Error searching hotels:', error);
    return [];
  }
}

/**
 * Extract price level from Nominatim result
 */
function extractPriceLevel(result: any): number | undefined {
  // Try to extract from extratags or other fields
  if (result.extratags?.stars) {
    const stars = parseInt(result.extratags.stars);
    if (stars >= 1 && stars <= 4) {
      return stars;
    }
  }
  // Default based on hotel type
  if (result.tourism === 'hotel') return 3;
  if (result.tourism === 'motel') return 2;
  if (result.tourism === 'hostel') return 1;
  return undefined;
}

/**
 * Extract rating from Nominatim result
 */
function extractRating(result: any): number | undefined {
  // Nominatim doesn't typically have ratings, but we can estimate
  // based on hotel type and stars
  if (result.extratags?.stars) {
    const stars = parseInt(result.extratags.stars);
    return stars * 0.5 + 2.5; // Convert stars to rating (1-4 stars -> 3-4.5 rating)
  }
  return undefined;
}

/**
 * Generate a URL for the hotel (could be booking.com, Google Maps, etc.)
 */
function generateHotelUrl(result: any): string {
  const name = encodeURIComponent(result.display_name.split(',')[0] || result.name || '');
  const lat = result.lat;
  const lon = result.lon;
  // Return Google Maps search URL as a placeholder
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}&query_place_id=${name}`;
}

/**
 * Generate booking.com search URL for the hotel
 */
function generateBookingUrl(hotel: { name: string; lat: number; lon: number }): string {
  const name = encodeURIComponent(hotel.name);
  const lat = hotel.lat;
  const lon = hotel.lon;
  // Booking.com search URL
  return `https://www.booking.com/searchresults.html?ss=${name}&latitude=${lat}&longitude=${lon}`;
}

/**
 * Estimate price range based on price level and location
 * @param priceLevel - Price level (1-4)
 * @param placeType - Place type (city, town, village, etc.)
 * @param numberOfGuests - Number of guests
 * @param numberOfDays - Number of days (default 1)
 * @returns Estimated price range
 */
function estimatePriceRange(
  priceLevel: number | undefined,
  placeType: string,
  numberOfGuests: number,
  numberOfDays: number = 1
): { min: number; max: number; currency: string } {
  // Base prices per night in USD
  const basePrices: Record<number, { min: number; max: number }> = {
    1: { min: 40, max: 80 },   // $ - Budget
    2: { min: 80, max: 150 },  // $$ - Mid-range
    3: { min: 150, max: 300 }, // $$$ - Upscale
    4: { min: 300, max: 600 } // $$$$ - Luxury
  };

  // Default to $$ if no price level
  const price = priceLevel && priceLevel >= 1 && priceLevel <= 4
    ? basePrices[priceLevel]
    : basePrices[2];

  // Adjust based on place type (cities are more expensive)
  let multiplier = 1.0;
  if (placeType === 'city') {
    multiplier = 1.2;
  } else if (placeType === 'town') {
    multiplier = 1.0;
  } else if (placeType === 'village' || placeType === 'hamlet') {
    multiplier = 0.8;
  }

  // Adjust for number of guests (assume 2 guests per room, add extra room if needed)
  const roomsNeeded = Math.ceil(numberOfGuests / 2);
  const pricePerRoom = {
    min: price.min * multiplier,
    max: price.max * multiplier
  };

  // Total for all nights
  const totalMin = pricePerRoom.min * roomsNeeded * numberOfDays;
  const totalMax = pricePerRoom.max * roomsNeeded * numberOfDays;

  return {
    min: Math.round(totalMin),
    max: Math.round(totalMax),
    currency: 'USD'
  };
}

/**
 * Score a hotel based on search parameters
 * @param hotel - Hotel to score
 * @param searchParams - User's search parameters
 * @param center - Center point (for distance scoring)
 * @returns Score (higher is better)
 */
function scoreHotel(
  hotel: Hotel,
  searchParams: HotelSearchParams,
  center: Point
): number {
  let score = 0;

  // Budget match (40% weight)
  const budgetLevel = searchParams.budget.length; // $=1, $$=2, $$$=3, $$$$=4
  if (hotel.priceLevel) {
    const priceDiff = Math.abs(hotel.priceLevel - budgetLevel);
    const budgetScore = (4 - priceDiff) * 10; // Max 40 points
    score += budgetScore;
  } else {
    // If no price level, give neutral score
    score += 20;
  }

  // Distance score (30% weight)
  // Closer hotels get higher scores
  const maxDistance = 48.28; // 30 miles
  const distanceScore = (1 - hotel.distance / maxDistance) * 30;
  score += Math.max(0, distanceScore);

  // Rating score (20% weight)
  if (hotel.rating) {
    const ratingScore = (hotel.rating / 5) * 20;
    score += ratingScore;
  } else {
    score += 10; // Neutral if no rating
  }

  // Hotel type preference (10% weight)
  // Prefer hotels over motels/hostels
  if (hotel.name.toLowerCase().includes('hotel')) {
    score += 10;
  } else if (hotel.name.toLowerCase().includes('motel')) {
    score += 5;
  } else {
    score += 3;
  }

  return score;
}

/**
 * Calculate check-in date based on start date and day number
 * @param startDate - Trip start date (YYYY-MM-DD format)
 * @param dayNumber - Day number (1-indexed)
 * @returns Check-in date string (YYYY-MM-DD format)
 */
export function calculateCheckInDate(startDate: string, dayNumber: number): string {
  if (!startDate) {
    return '';
  }

  const start = new Date(startDate);
  const checkIn = new Date(start);
  checkIn.setDate(start.getDate() + (dayNumber - 1));

  return checkIn.toISOString().split('T')[0];
}

