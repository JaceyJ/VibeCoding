import { Point, haversineDistance } from '../utils/GeographicUtils';

export interface FoodSearchParams {
  venueType: 'fast-food' | 'restaurant' | 'both';
  priceLevel: 1 | 2 | 3 | 4; // $, $$, $$$, $$$$
  mealTypes: {
    breakfast: boolean;
    lunch: boolean;
    dinner: boolean;
  };
}

export interface FoodPlace {
  name: string;
  address: string;
  lat: number;
  lon: number;
  priceLevel?: number; // 1-4 corresponding to $, $$, $$$, $$$$
  venueType: 'fast-food' | 'restaurant' | 'unknown';
  cuisine?: string;
  distance: number; // in kilometers
  url?: string;
  score: number;
  rating?: number; // Rating from 0-5 stars
}

/**
 * FoodService
 * Single Responsibility: Handles food/restaurant search and scoring
 */
export class FoodService {
  private static readonly NOMINATIM_API_URL = 'https://nominatim.openstreetmap.org/search';
  private static readonly RADIUS_KM = 48.28; // 30 miles

  /**
   * Search for food places near a location
   */
  static async searchFood(
    center: Point,
    searchParams: FoodSearchParams,
    radiusKm: number = FoodService.RADIUS_KM,
    placeType: string = 'city'
  ): Promise<FoodPlace[]> {
    try {
      console.log(`[FoodService] Searching for food near ${center.lat}, ${center.lon}`);
      console.log(`[FoodService] Parameters:`, searchParams);

      // Calculate bounding box for search
      const bbox = this.calculateBbox(center, radiusKm);

      // Get area name for better search results
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
          console.log(`[FoodService] Searching food near: ${areaName || 'unknown area'}`);
        }
      } catch (error) {
        console.warn('[FoodService] Error getting area name:', error);
      }

      // Build search queries based on venue type
      // Limit queries to reduce API calls and avoid rate limiting
      const searchQueries: string[] = [];
      
      // Prioritize area-based searches when available
      if (areaName) {
        if (searchParams.venueType === 'fast-food' || searchParams.venueType === 'both') {
          searchQueries.push(`fast food ${areaName}`);
        }
        
        if (searchParams.venueType === 'restaurant' || searchParams.venueType === 'both') {
          searchQueries.push(`restaurant ${areaName}`);
        }

        // Add meal-specific searches if meal types are selected (limit to 1-2 per meal type)
        if (searchParams.mealTypes.breakfast) {
          searchQueries.push(`breakfast ${areaName}`);
        }
        if (searchParams.mealTypes.lunch) {
          searchQueries.push(`lunch ${areaName}`);
        }
        if (searchParams.mealTypes.dinner) {
          searchQueries.push(`dinner ${areaName}`);
        }

        // If no meal types selected, add one generic term
        if (!searchParams.mealTypes.breakfast && 
            !searchParams.mealTypes.lunch && 
            !searchParams.mealTypes.dinner) {
          searchQueries.push(`cafe ${areaName}`);
        }
      } else {
        // Fallback to generic searches if no area name
        if (searchParams.venueType === 'fast-food' || searchParams.venueType === 'both') {
          searchQueries.push('fast food');
        }
        if (searchParams.venueType === 'restaurant' || searchParams.venueType === 'both') {
          searchQueries.push('restaurant');
        }
        if (!searchParams.mealTypes.breakfast && 
            !searchParams.mealTypes.lunch && 
            !searchParams.mealTypes.dinner) {
          searchQueries.push('cafe');
        }
      }

      // Remove duplicates and limit to max 5 queries to avoid rate limiting
      const uniqueQueries = Array.from(new Set(searchQueries)).slice(0, 5);
      console.log(`[FoodService] Using ${uniqueQueries.length} search queries:`, uniqueQueries);

      // Search for each query with retry logic and better rate limiting
      const allResults: any[] = [];
      
      for (let i = 0; i < uniqueQueries.length; i++) {
        const query = uniqueQueries[i];
        let retries = 3;
        let success = false;
        
        while (retries > 0 && !success) {
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
              bounded: '1'
            });

            const response = await fetch(
              `${FoodService.NOMINATIM_API_URL}?${searchParams_url.toString()}`,
              {
                headers: {
                  'User-Agent': 'TripPlanningApp/1.0'
                }
              }
            );

            if (response.ok) {
              const data = await response.json();
              
              // Filter for food places and verify they're in bbox
              const foodResults = data.filter((result: any) => {
                const resultLat = parseFloat(result.lat);
                const resultLon = parseFloat(result.lon);
                
                // Check if result is actually within bbox
                const bboxArray = bbox.split(',').map(parseFloat);
                const inBbox = resultLat >= bboxArray[0] && 
                              resultLat <= bboxArray[2] &&
                              resultLon >= bboxArray[1] && 
                              resultLon <= bboxArray[3];
                
                if (!inBbox) {
                  return false;
                }
                
                // Check if it's a food-related place
                const type = result.type || result.class || '';
                const category = result.category || '';
                const name = (result.display_name || '').toLowerCase();
                
                return (
                  type === 'restaurant' ||
                  type === 'fast_food' ||
                  type === 'cafe' ||
                  type === 'bar' ||
                  category === 'catering' ||
                  name.includes('restaurant') ||
                  name.includes('cafe') ||
                  name.includes('diner') ||
                  name.includes('fast food') ||
                  name.includes('fast-food') ||
                  name.includes('pizza') ||
                  name.includes('burger')
                );
              });
              
              allResults.push(...foodResults);
              console.log(`[FoodService] Query "${query}": found ${foodResults.length} food places in bbox`);
              success = true;
            } else if (response.status === 503 || response.status === 429) {
              // Rate limited - wait longer and retry
              const waitTime = (4 - retries) * 1000; // Exponential backoff: 1s, 2s, 3s
              console.warn(`[FoodService] Rate limited (${response.status}) for "${query}", waiting ${waitTime}ms before retry (${retries} retries left)`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              retries--;
            } else {
              // Other error - log and move on
              console.warn(`[FoodService] Nominatim search failed for "${query}": ${response.status}`);
              success = true; // Don't retry for non-rate-limit errors
            }
          } catch (error) {
            console.warn(`[FoodService] Error searching for ${query}:`, error);
            retries--;
            if (retries > 0) {
              const waitTime = (4 - retries) * 1000;
              await new Promise(resolve => setTimeout(resolve, waitTime));
            }
          }
        }
        
        // Add delay between queries to respect rate limits (longer delay)
        // Increase delay if we had rate limit issues
        if (i < uniqueQueries.length - 1) {
          const baseDelay = 500; // Base 500ms delay
          const delay = success ? baseDelay : baseDelay * 2; // Double delay if we had issues
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // Remove duplicates based on coordinates
      const uniqueResults = this.removeDuplicates(allResults);
      console.log(`[FoodService] Found ${uniqueResults.length} unique potential food places`);

      // Process and score food places
      const foodPlaces: FoodPlace[] = [];
      let tooFarCount = 0;
      let processedCount = 0;

      for (const result of uniqueResults) {
        processedCount++;
        
        const foodLat = parseFloat(result.lat);
        const foodLon = parseFloat(result.lon);
        
        // Validate coordinates
        if (isNaN(foodLat) || isNaN(foodLon) || 
            foodLat < -90 || foodLat > 90 || 
            foodLon < -180 || foodLon > 180) {
          console.warn(`[FoodService] Invalid coordinates: ${result.display_name}`);
          continue;
        }
        
        const foodPoint: Point = {
          lat: foodLat,
          lon: foodLon
        };

        const distance = haversineDistance(center, foodPoint);

        if (distance <= radiusKm) {
          const foodName = result.display_name?.split(',')[0] || 
                          result.name || 
                          result.address?.restaurant ||
                          result.address?.name ||
                          'Unknown Food Place';
          
          const venueType = this.determineVenueType(result, foodName);
          const priceLevel = this.extractPriceLevel(result);
          const rating = this.extractRating(result);
          
          const foodPlace: FoodPlace = {
            name: foodName,
            address: result.display_name || 'Address not available',
            lat: foodPoint.lat,
            lon: foodPoint.lon,
            priceLevel: priceLevel,
            venueType: venueType,
            cuisine: this.extractCuisine(result),
            distance: distance,
            url: this.generateFoodUrl({ name: foodName, lat: foodPoint.lat, lon: foodPoint.lon }),
            score: 0, // Will be calculated
            rating: rating
          };

          // Score the food place
          foodPlace.score = this.scoreFoodPlace(foodPlace, searchParams, center);

          foodPlaces.push(foodPlace);
        } else {
          tooFarCount++;
        }
      }

      console.log(`[FoodService] Processed ${processedCount} food places: ${foodPlaces.length} within radius, ${tooFarCount} too far`);

      // Sort by score (highest first) and return top 10
      foodPlaces.sort((a, b) => b.score - a.score);
      const topFoodPlaces = foodPlaces.slice(0, 10);

      console.log(`[FoodService] Returning top ${topFoodPlaces.length} food places out of ${foodPlaces.length} total`);
      if (topFoodPlaces.length > 0) {
        console.log(`[FoodService] Top food place scores:`, topFoodPlaces.map(f => `${f.name}: ${f.score.toFixed(2)}`));
      }

      return topFoodPlaces;
    } catch (error) {
      console.error('[FoodService] Error searching food:', error);
      return [];
    }
  }

  /**
   * Calculate bounding box for search area
   */
  private static calculateBbox(center: Point, radiusKm: number): string {
    // Approximate: 1 degree latitude ≈ 111 km
    const latDelta = radiusKm / 111;
    const lonDelta = radiusKm / (111 * Math.cos(center.lat * Math.PI / 180));
    
    return `${center.lat - latDelta},${center.lon - lonDelta},${center.lat + latDelta},${center.lon + lonDelta}`;
  }

  /**
   * Remove duplicate results based on coordinates
   */
  private static removeDuplicates(results: any[]): any[] {
    const seen = new Set<string>();
    const unique: any[] = [];

    for (const result of results) {
      const key = `${parseFloat(result.lat).toFixed(4)},${parseFloat(result.lon).toFixed(4)}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(result);
      }
    }

    return unique;
  }

  /**
   * Determine venue type from result
   */
  private static determineVenueType(result: any, name: string): 'fast-food' | 'restaurant' | 'unknown' {
    const nameLower = name.toLowerCase();
    const type = (result.type || '').toLowerCase();
    const category = (result.category || '').toLowerCase();

    if (type === 'fast_food' || 
        nameLower.includes('fast food') || 
        nameLower.includes('fast-food') ||
        nameLower.includes('mcdonald') ||
        nameLower.includes('burger king') ||
        nameLower.includes('subway') ||
        nameLower.includes('taco bell') ||
        nameLower.includes('kfc')) {
      return 'fast-food';
    }

    if (type === 'restaurant' || 
        type === 'cafe' ||
        nameLower.includes('restaurant') ||
        nameLower.includes('dining') ||
        nameLower.includes('bistro')) {
      return 'restaurant';
    }

    return 'unknown';
  }

  /**
   * Extract price level from result
   */
  private static extractPriceLevel(result: any): number | undefined {
    // Try to extract from extratags or other fields
    if (result.extratags?.stars) {
      const stars = parseInt(result.extratags.stars);
      if (stars >= 1 && stars <= 4) {
        return stars;
      }
    }
    
    // Estimate based on venue type and name
    const name = (result.display_name || '').toLowerCase();
    if (name.includes('fine dining') || name.includes('upscale')) {
      return 4;
    }
    if (result.type === 'fast_food' || name.includes('fast food')) {
      return 1;
    }
    if (name.includes('cafe') || name.includes('diner')) {
      return 2;
    }
    
    return undefined;
  }

  /**
   * Extract cuisine type from result
   */
  private static extractCuisine(result: any): string | undefined {
    const cuisine = result.extratags?.cuisine || 
                   result.address?.cuisine ||
                   result.tags?.cuisine;
    
    if (cuisine) {
      return cuisine;
    }

    // Try to infer from name
    const name = (result.display_name || '').toLowerCase();
    const cuisines = ['italian', 'mexican', 'chinese', 'japanese', 'indian', 'thai', 'american', 'french', 'greek'];
    for (const c of cuisines) {
      if (name.includes(c)) {
        return c;
      }
    }

    return undefined;
  }

  /**
   * Extract rating from result (if available)
   */
  private static extractRating(result: any): number | undefined {
    // Try to extract from extratags (Nominatim sometimes has this)
    if (result.extratags?.rating) {
      const rating = parseFloat(result.extratags.rating);
      if (!isNaN(rating) && rating >= 0 && rating <= 5) {
        return rating;
      }
    }

    // Try to extract from other rating fields
    if (result.rating) {
      const rating = parseFloat(result.rating);
      if (!isNaN(rating) && rating >= 0 && rating <= 5) {
        return rating;
      }
    }

    // Estimate based on importance (Nominatim importance is 0-1, scale to 0-5)
    // But only use this as a last resort and scale it appropriately
    if (result.importance) {
      const importance = parseFloat(result.importance);
      if (!isNaN(importance) && importance > 0) {
        // Scale importance to rating, but be conservative
        // High importance (0.7-1.0) -> 4.0-4.5 stars
        // Medium importance (0.4-0.7) -> 3.5-4.0 stars
        // Low importance (0.1-0.4) -> 3.0-3.5 stars
        // Very low importance (<0.1) -> 2.5-3.0 stars
        if (importance >= 0.7) {
          return 4.0 + (importance - 0.7) * 1.67; // 4.0 to 4.5
        } else if (importance >= 0.4) {
          return 3.5 + (importance - 0.4) * 1.67; // 3.5 to 4.0
        } else if (importance >= 0.1) {
          return 3.0 + (importance - 0.1) * 1.67; // 3.0 to 3.5
        } else {
          return 2.5 + importance * 5; // 2.5 to 3.0
        }
      }
    }
    
    return undefined;
  }

  /**
   * Generate URL for food place (Google Maps)
   */
  private static generateFoodUrl(food: { name: string; lat: number; lon: number }): string {
    const name = encodeURIComponent(food.name);
    const lat = food.lat;
    const lon = food.lon;
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}&query_place_id=${name}`;
  }

  /**
   * Score a food place based on search parameters
   */
  private static scoreFoodPlace(
    foodPlace: FoodPlace,
    searchParams: FoodSearchParams,
    center: Point
  ): number {
    let score = 100; // Base score

    // Distance penalty (closer is better)
    const distancePenalty = foodPlace.distance * 2;
    score -= distancePenalty;

    // Price level match bonus
    if (foodPlace.priceLevel && searchParams.priceLevel) {
      const priceDiff = Math.abs(foodPlace.priceLevel - searchParams.priceLevel);
      score -= priceDiff * 10; // Penalty for price mismatch
    } else if (searchParams.priceLevel && !foodPlace.priceLevel) {
      score -= 5; // Small penalty for unknown price
    }

    // Venue type match bonus
    if (searchParams.venueType === 'both') {
      // No penalty for either type
    } else if (searchParams.venueType === foodPlace.venueType) {
      score += 20; // Bonus for exact match
    } else {
      score -= 15; // Penalty for mismatch
    }

    // Prefer places with cuisine information
    if (foodPlace.cuisine) {
      score += 5;
    }

    return Math.max(0, score); // Ensure non-negative
  }
}

