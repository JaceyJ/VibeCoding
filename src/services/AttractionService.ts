import { Point, haversineDistance } from '../utils/GeographicUtils';
import { TripType } from '../components/TripTypeSelector';

export interface Attraction {
  name: string;
  address: string;
  lat: number;
  lon: number;
  type: string; // e.g., 'museum', 'attraction', 'historic', 'park'
  category?: string;
  distance: number; // in kilometers
  url?: string;
  score: number;
  description?: string;
  rating?: number; // Estimated or extracted rating
}

export interface AttractionSearchParams {
  tripType: TripType;
  categories?: string[]; // e.g., ['museum', 'park', 'historic']
  maxDistance?: number; // in kilometers
}

/**
 * AttractionService
 * Single Responsibility: Handles attraction/POI search and scoring
 */
export class AttractionService {
  private static readonly NOMINATIM_API_URL = 'https://nominatim.openstreetmap.org/search';
  private static readonly OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';
  private static readonly DEFAULT_RADIUS_KM = 25; // 15.5 miles

  /**
   * Get search queries based on trip type
   */
  private static getSearchQueriesForTripType(tripType: TripType, areaName: string): string[] {
    const queries: string[] = [];
    
    switch (tripType) {
      case 'family-friendly':
        if (areaName) {
          queries.push(`playground ${areaName}`, `family attraction ${areaName}`, `zoo ${areaName}`, `aquarium ${areaName}`);
        } else {
          queries.push('playground', 'family attraction', 'zoo', 'aquarium');
        }
        break;
        
      case 'outdoors-adventure':
        if (areaName) {
          queries.push(`park ${areaName}`, `hiking ${areaName}`, `nature ${areaName}`, `adventure ${areaName}`, `outdoor activity ${areaName}`);
        } else {
          queries.push('park', 'hiking', 'nature', 'adventure', 'outdoor activity');
        }
        break;
        
      case 'cultural':
        if (areaName) {
          queries.push(`museum ${areaName}`, `gallery ${areaName}`, `historic site ${areaName}`, `theater ${areaName}`, `monument ${areaName}`);
        } else {
          queries.push('museum', 'gallery', 'historic site', 'theater', 'monument');
        }
        break;
        
      case 'relaxation':
        if (areaName) {
          queries.push(`spa ${areaName}`, `beach ${areaName}`, `scenic ${areaName}`, `wellness ${areaName}`);
        } else {
          queries.push('spa', 'beach', 'scenic', 'wellness');
        }
        break;
        
      case 'nightlife':
        if (areaName) {
          queries.push(`nightlife ${areaName}`, `entertainment ${areaName}`, `bar ${areaName}`, `club ${areaName}`);
        } else {
          queries.push('nightlife', 'entertainment', 'bar', 'club');
        }
        break;
        
      case 'shopping':
        if (areaName) {
          queries.push(`shopping ${areaName}`, `mall ${areaName}`, `market ${areaName}`);
        } else {
          queries.push('shopping', 'mall', 'market');
        }
        break;
        
      case 'all':
      default:
        // Search for general attractions
        if (areaName) {
          queries.push(`attraction ${areaName}`, `museum ${areaName}`, `park ${areaName}`, `historic ${areaName}`, `landmark ${areaName}`);
        } else {
          queries.push('attraction', 'museum', 'park', 'historic', 'landmark');
        }
        break;
    }
    
    return queries;
  }

  /**
   * Search for attractions near a location using Nominatim
   * This is a simpler approach that works with the existing stack
   */
  static async searchAttractions(
    center: Point,
    searchParams: AttractionSearchParams,
    radiusKm: number = AttractionService.DEFAULT_RADIUS_KM
  ): Promise<Attraction[]> {
    try {
      console.log(`[AttractionService] Searching for attractions near ${center.lat}, ${center.lon}`);

      // Calculate bounding box
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
          console.log(`[AttractionService] Searching attractions near: ${areaName || 'unknown area'}`);
        }
      } catch (error) {
        console.warn('[AttractionService] Error getting area name:', error);
      }

      // Build search queries based on trip type
      const tripTypeQueries = this.getSearchQueriesForTripType(searchParams.tripType, areaName);
      
      // Also add general attraction queries for broader coverage
      const generalQueries = areaName 
        ? [`attraction ${areaName}`, `landmark ${areaName}`, `point of interest ${areaName}`]
        : ['attraction', 'landmark', 'point of interest'];
      
      // Combine trip-specific and general queries
      const allQueries = [...tripTypeQueries, ...generalQueries];
      
      // If specific categories requested, add those too
      if (searchParams.categories && searchParams.categories.length > 0) {
        for (const category of searchParams.categories) {
          if (areaName) {
            allQueries.push(`${category} ${areaName}`);
          } else {
            allQueries.push(category);
          }
        }
      }

      // Limit queries to avoid rate limiting (prioritize trip type queries)
      const uniqueQueries = Array.from(new Set(allQueries)).slice(0, 6);
      console.log(`[AttractionService] Using ${uniqueQueries.length} search queries for trip type "${searchParams.tripType}":`, uniqueQueries);

      // Search for each query
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
              `${AttractionService.NOMINATIM_API_URL}?${searchParams_url.toString()}`,
              {
                headers: {
                  'User-Agent': 'TripPlanningApp/1.0'
                }
              }
            );

            if (response.ok) {
              const data = await response.json();
              
              // Filter for attractions and verify they're in bbox
              const attractionResults = data.filter((result: any) => {
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
                
                // Check if it's an attraction-related place
                const type = result.type || result.class || '';
                const category = result.category || '';
                const name = (result.display_name || '').toLowerCase();
                const extratags = result.extratags || {};
                
                // Check for tourism tags
                const isTourism = extratags.tourism || 
                                 type === 'tourism' ||
                                 category === 'tourism';
                
                // Check for historic tags
                const isHistoric = extratags.historic ||
                                  name.includes('historic') ||
                                  name.includes('monument') ||
                                  name.includes('memorial');
                
                // Check for leisure tags
                const isLeisure = extratags.leisure ||
                                 type === 'leisure' ||
                                 name.includes('park') ||
                                 name.includes('zoo') ||
                                 name.includes('aquarium');
                
                // Check for common attraction keywords
                const hasAttractionKeywords = name.includes('museum') ||
                                            name.includes('gallery') ||
                                            name.includes('attraction') ||
                                            name.includes('landmark') ||
                                            name.includes('monument') ||
                                            name.includes('park') ||
                                            name.includes('zoo') ||
                                            name.includes('aquarium') ||
                                            name.includes('theater') ||
                                            name.includes('theatre');
                
                return isTourism || isHistoric || isLeisure || hasAttractionKeywords;
              });
              
              allResults.push(...attractionResults);
              console.log(`[AttractionService] Query "${query}": found ${attractionResults.length} attractions in bbox`);
              success = true;
            } else if (response.status === 503 || response.status === 429) {
              // Rate limited - wait longer and retry
              const waitTime = (4 - retries) * 1000;
              console.warn(`[AttractionService] Rate limited (${response.status}) for "${query}", waiting ${waitTime}ms before retry (${retries} retries left)`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              retries--;
            } else {
              console.warn(`[AttractionService] Nominatim search failed for "${query}": ${response.status}`);
              success = true;
            }
          } catch (error) {
            console.warn(`[AttractionService] Error searching for ${query}:`, error);
            retries--;
            if (retries > 0) {
              const waitTime = (4 - retries) * 1000;
              await new Promise(resolve => setTimeout(resolve, waitTime));
            }
          }
        }
        
        // Add delay between queries
        if (i < uniqueQueries.length - 1) {
          const baseDelay = 500;
          const delay = success ? baseDelay : baseDelay * 2;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // Remove duplicates
      const uniqueResults = this.removeDuplicates(allResults);
      console.log(`[AttractionService] Found ${uniqueResults.length} unique potential attractions`);

      // Process and score attractions
      const attractions: Attraction[] = [];
      const maxDistance = searchParams.maxDistance || radiusKm;

      for (const result of uniqueResults) {
        const attractionLat = parseFloat(result.lat);
        const attractionLon = parseFloat(result.lon);
        
        // Validate coordinates
        if (isNaN(attractionLat) || isNaN(attractionLon) || 
            attractionLat < -90 || attractionLat > 90 || 
            attractionLon < -180 || attractionLon > 180) {
          continue;
        }
        
        const attractionPoint: Point = {
          lat: attractionLat,
          lon: attractionLon
        };

        const distance = haversineDistance(center, attractionPoint);

        if (distance <= maxDistance) {
          const attractionName = result.display_name?.split(',')[0] || 
                                 result.name || 
                                 'Unknown Attraction';
          
          const type = this.determineAttractionType(result, attractionName);
          
          const attraction: Attraction = {
            name: attractionName,
            address: result.display_name || 'Address not available',
            lat: attractionPoint.lat,
            lon: attractionPoint.lon,
            type: type,
            category: result.extratags?.tourism || result.extratags?.historic || result.extratags?.leisure,
            distance: distance,
            url: this.generateAttractionUrl({ name: attractionName, lat: attractionPoint.lat, lon: attractionPoint.lon }),
            score: 0,
            description: result.extratags?.description || result.extratags?.wikipedia
          };

          // Extract rating if available (from extratags or estimate)
          attraction.rating = this.extractRating(result);
          
          // Score the attraction
          attraction.score = this.scoreAttraction(attraction, center, searchParams.tripType);

          attractions.push(attraction);
        }
      }

      console.log(`[AttractionService] Processed ${attractions.length} attractions within ${maxDistance}km`);

      // Sort by score (highest first) and return top 10
      attractions.sort((a, b) => b.score - a.score);
      const topAttractions = attractions.slice(0, 10);

      console.log(`[AttractionService] Returning top ${topAttractions.length} attractions`);
      return topAttractions;
    } catch (error) {
      console.error('[AttractionService] Error searching attractions:', error);
      return [];
    }
  }

  /**
   * Calculate bounding box for search area
   */
  private static calculateBbox(center: Point, radiusKm: number): string {
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
   * Determine attraction type from result
   */
  private static determineAttractionType(result: any, name: string): string {
    const nameLower = name.toLowerCase();
    const extratags = result.extratags || {};
    
    // Check OSM tags first
    if (extratags.tourism) {
      return extratags.tourism;
    }
    if (extratags.historic) {
      return extratags.historic;
    }
    if (extratags.leisure) {
      return extratags.leisure;
    }
    
    // Infer from name
    if (nameLower.includes('museum')) return 'museum';
    if (nameLower.includes('park')) return 'park';
    if (nameLower.includes('zoo')) return 'zoo';
    if (nameLower.includes('aquarium')) return 'aquarium';
    if (nameLower.includes('monument') || nameLower.includes('memorial')) return 'monument';
    if (nameLower.includes('theater') || nameLower.includes('theatre')) return 'theater';
    if (nameLower.includes('gallery')) return 'gallery';
    if (nameLower.includes('castle') || nameLower.includes('fort')) return 'historic';
    
    return 'attraction';
  }

  /**
   * Extract rating from result (if available)
   */
  private static extractRating(result: any): number | undefined {
    // Try to extract from extratags
    if (result.extratags?.rating) {
      const rating = parseFloat(result.extratags.rating);
      if (!isNaN(rating) && rating >= 0 && rating <= 5) {
        return rating;
      }
    }
    
    // Estimate based on importance (Nominatim importance is 0-1, scale to 0-5)
    if (result.importance) {
      const importance = parseFloat(result.importance);
      if (!isNaN(importance)) {
        return importance * 5; // Scale 0-1 to 0-5
      }
    }
    
    return undefined;
  }

  /**
   * Generate URL for attraction (Google Maps)
   */
  private static generateAttractionUrl(attraction: { name: string; lat: number; lon: number }): string {
    const name = encodeURIComponent(attraction.name);
    const lat = attraction.lat;
    const lon = attraction.lon;
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}&query_place_id=${name}`;
  }

  /**
   * Score an attraction based on relevance
   */
  private static scoreAttraction(attraction: Attraction, center: Point): number {
    let score = 100; // Base score

    // Distance penalty (closer is better)
    const distancePenalty = attraction.distance * 2;
    score -= distancePenalty;

    // Bonus for having category/type information
    if (attraction.category) {
      score += 10;
    }

    // Bonus for having description
    if (attraction.description) {
      score += 5;
    }

    // Type-specific bonuses (museums and parks are often more popular)
    if (attraction.type === 'museum' || attraction.type === 'park') {
      score += 15;
    }

    return Math.max(0, score);
  }

  /**
   * Alternative: Search using Overpass API (more powerful but more complex)
   * Uncomment and use this if you want more comprehensive results
   */
  /*
  static async searchAttractionsOverpass(
    center: Point,
    radiusMeters: number = 5000
  ): Promise<Attraction[]> {
    try {
      const overpassQuery = `
        [out:json][timeout:25];
        (
          node["tourism"="attraction"](around:${radiusMeters},${center.lat},${center.lon});
          node["tourism"="museum"](around:${radiusMeters},${center.lat},${center.lon});
          node["tourism"="theme_park"](around:${radiusMeters},${center.lat},${center.lon});
          node["historic"](around:${radiusMeters},${center.lat},${center.lon});
          node["leisure"="park"](around:${radiusMeters},${center.lat},${center.lon});
          way["tourism"="attraction"](around:${radiusMeters},${center.lat},${center.lon});
          way["tourism"="museum"](around:${radiusMeters},${center.lat},${center.lon});
          relation["tourism"="attraction"](around:${radiusMeters},${center.lat},${center.lon});
        );
        out body;
        >;
        out skel qt;
      `;

      const response = await fetch(AttractionService.OVERPASS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(overpassQuery)}`
      });

      if (!response.ok) {
        throw new Error('Overpass API request failed');
      }

      const data = await response.json();
      // Process Overpass results...
      return [];
    } catch (error) {
      console.error('[AttractionService] Error with Overpass API:', error);
      return [];
    }
  }
  */
}

