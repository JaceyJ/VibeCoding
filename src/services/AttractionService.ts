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
        // Use simpler queries that are more likely to return results from Nominatim
        if (areaName) {
          queries.push(
            `park ${areaName}`,  // Start with simple park - most likely to work
            `hiking ${areaName}`, 
            `outdoor ${areaName}`,
            `nature ${areaName}`,
            `recreation ${areaName}`
          );
        } else {
          queries.push(
            'park',  // Start with simple park - most likely to work
            'hiking', 
            'outdoor',
            'nature',
            'recreation'
          );
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
      
      // For outdoors-adventure, add additional fallback queries if specific ones don't work
      let fallbackQueries: string[] = [];
      if (searchParams.tripType === 'outdoors-adventure') {
        fallbackQueries = areaName
          ? [`outdoor ${areaName}`, `nature ${areaName}`, `park ${areaName}`, `recreation ${areaName}`]
          : ['outdoor', 'nature', 'park', 'recreation'];
      }
      
      // Also add general attraction queries for broader coverage
      const generalQueries = areaName 
        ? [`attraction ${areaName}`, `landmark ${areaName}`, `point of interest ${areaName}`]
        : ['attraction', 'landmark', 'point of interest'];
      
      // Combine trip-specific, fallback, and general queries
      const allQueries = [...tripTypeQueries, ...fallbackQueries, ...generalQueries];
      
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

      // Limit queries to avoid rate limiting (prioritize trip type queries, then fallback, then general)
      // For outdoors-adventure, allow more queries to ensure we find results
      const maxQueries = searchParams.tripType === 'outdoors-adventure' ? 8 : 6;
      const uniqueQueries = Array.from(new Set(allQueries)).slice(0, maxQueries);
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
              console.log(`[AttractionService] Query "${query}": Nominatim returned ${data.length} total results`);
              
              // Debug: log first few results to see what we're getting
              if (data.length > 0 && i === 0) {
                console.log(`[AttractionService] Sample result from "${query}":`, {
                  display_name: data[0].display_name,
                  type: data[0].type,
                  class: data[0].class,
                  category: data[0].category,
                  extratags: data[0].extratags,
                  lat: data[0].lat,
                  lon: data[0].lon
                });
              }
              
              // Filter for attractions and verify they're in bbox
              const attractionResults = data.filter((result: any) => {
                const resultLat = parseFloat(result.lat);
                const resultLon = parseFloat(result.lon);
                
                // Validate coordinates
                if (isNaN(resultLat) || isNaN(resultLon)) {
                  return false;
                }
                
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
                
                // For outdoors-adventure, be extremely permissive - accept almost anything in bbox
                // Let the scoring system prioritize adventure activities
                if (searchParams.tripType === 'outdoors-adventure') {
                  // Reject only obvious non-outdoor things
                  const isNotOutdoor = name.includes('restaurant') || name.includes('hotel') || 
                                      name.includes('mall') || name.includes('store') ||
                                      name.includes('gas station') || name.includes('bank') ||
                                      name.includes('hospital') || name.includes('school') ||
                                      (type === 'amenity' && !name.includes('park') && !name.includes('campground'));
                  
                  // Accept everything else - let scoring handle prioritization
                  return !isNotOutdoor;
                }
                
                // For other trip types, use standard filtering
                const isTourism = extratags.tourism || type === 'tourism' || category === 'tourism';
                const isHistoric = extratags.historic || name.includes('historic') || name.includes('monument') || name.includes('memorial');
                const isLeisure = extratags.leisure || type === 'leisure';
                const isAdventureActivity = extratags.route === 'hiking' || extratags.route === 'foot' ||
                                           extratags.route === 'mountain_bike' || extratags.sport === 'climbing' ||
                                           extratags.sport === 'rafting' || extratags.sport === 'hiking' ||
                                           extratags.sport === 'mountain_biking' || extratags.sport === 'kayaking' ||
                                           extratags.sport === 'canoeing' || category === 'sport' ||
                                           name.includes('trail') || name.includes('climbing') ||
                                           name.includes('rafting') || name.includes('hiking') ||
                                           name.includes('adventure') || name.includes('outdoor');
                const isNatural = extratags.natural || type === 'natural' || category === 'natural' ||
                                 name.includes('national park') || name.includes('state park') ||
                                 name.includes('forest') || name.includes('mountain') ||
                                 name.includes('canyon') || name.includes('river') ||
                                 name.includes('lake') || name.includes('beach');
                const hasAttractionKeywords = name.includes('museum') || name.includes('gallery') ||
                                            name.includes('attraction') || name.includes('landmark') ||
                                            name.includes('monument') || name.includes('zoo') ||
                                            name.includes('aquarium') || name.includes('theater') ||
                                            name.includes('theatre');
                
                return isTourism || isHistoric || isLeisure || isAdventureActivity || isNatural || hasAttractionKeywords;
              });
              
              allResults.push(...attractionResults);
              console.log(`[AttractionService] Query "${query}": found ${attractionResults.length} attractions in bbox (after filtering)`);
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

      // If no results found for outdoors-adventure, try even simpler queries as last resort
      if (uniqueResults.length === 0 && searchParams.tripType === 'outdoors-adventure') {
        console.log(`[AttractionService] No results found, trying simpler fallback queries...`);
        const fallbackQueries = areaName 
          ? [`${areaName}`, `park near ${areaName}`, `attraction ${areaName}`]
          : ['park', 'attraction', 'landmark'];
        
        for (const query of fallbackQueries) {
          try {
            const searchParams_url = new URLSearchParams({
              q: query,
              format: 'json',
              limit: '30',
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
              });

            if (response.ok) {
              const data = await response.json();
              console.log(`[AttractionService] Fallback query "${query}": Nominatim returned ${data.length} total results`);
              
              const fallbackResults = data.filter((result: any) => {
                const resultLat = parseFloat(result.lat);
                const resultLon = parseFloat(result.lon);
                
                if (isNaN(resultLat) || isNaN(resultLon)) {
                  return false;
                }
                
                const bboxArray = bbox.split(',').map(parseFloat);
                const inBbox = resultLat >= bboxArray[0] && 
                              resultLat <= bboxArray[2] &&
                              resultLon >= bboxArray[1] && 
                              resultLon <= bboxArray[3];
                
                if (!inBbox) {
                  return false;
                }
                
                // Very permissive - reject only obvious non-outdoor things
                const name = (result.display_name || '').toLowerCase();
                const isNotOutdoor = name.includes('restaurant') || name.includes('hotel') || 
                                    name.includes('mall') || name.includes('store') ||
                                    name.includes('gas station') || name.includes('bank') ||
                                    name.includes('hospital') || name.includes('school');
                
                return !isNotOutdoor;
              });
              
              allResults.push(...fallbackResults);
              console.log(`[AttractionService] Fallback query "${query}": found ${fallbackResults.length} results`);
              
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } catch (error) {
            console.warn(`[AttractionService] Error in fallback query "${query}":`, error);
          }
        }
        
        // Remove duplicates again after fallback
        const updatedUniqueResults = this.removeDuplicates(allResults);
        console.log(`[AttractionService] After fallback: found ${updatedUniqueResults.length} unique potential attractions`);
        // Replace uniqueResults with the updated list
        uniqueResults.length = 0;
        uniqueResults.push(...updatedUniqueResults);
      }

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
    // Try to extract from extratags (primary source)
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
    // Use a better scaling approach that avoids very low ratings
    if (result.importance) {
      const importance = parseFloat(result.importance);
      if (!isNaN(importance) && importance > 0) {
        // Scale importance to rating more intelligently
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
   * Generate URL for attraction (Google Maps)
   */
  private static generateAttractionUrl(attraction: { name: string; lat: number; lon: number }): string {
    const name = encodeURIComponent(attraction.name);
    const lat = attraction.lat;
    const lon = attraction.lon;
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}&query_place_id=${name}`;
  }

  /**
   * Score an attraction based on trip type, distance, and other factors
   */
  private static scoreAttraction(
    attraction: Attraction, 
    center: Point,
    tripType: TripType
  ): number {
    let score = 100; // Base score

    // Distance penalty (closer is better) - stronger penalty
    const distancePenalty = attraction.distance * 3;
    score -= distancePenalty;

    // Trip type matching bonus (most important factor)
    const tripTypeMatch = this.getTripTypeMatchScore(attraction, tripType);
    score += tripTypeMatch;

    // Bonus for having category/type information
    if (attraction.category) {
      score += 10;
    }

    // Bonus for having description
    if (attraction.description) {
      score += 5;
    }

    // Rating bonus (if available)
    if (attraction.rating) {
      score += attraction.rating * 5; // Up to 25 points for 5-star rating
    }

    // Type-specific popularity bonuses
    const popularityBonus = this.getPopularityBonus(attraction.type, tripType);
    score += popularityBonus;

    return Math.max(0, score);
  }

  /**
   * Get match score based on trip type
   */
  private static getTripTypeMatchScore(attraction: Attraction, tripType: TripType): number {
    const type = attraction.type.toLowerCase();
    const name = (attraction.name || '').toLowerCase();
    const category = (attraction.category || '').toLowerCase();

    switch (tripType) {
      case 'family-friendly':
        if (type.includes('playground') || type.includes('zoo') || type.includes('aquarium') ||
            name.includes('family') || name.includes('kids') || name.includes('children')) {
          return 40; // Strong match
        }
        if (type.includes('park') || type.includes('museum') || type.includes('attraction')) {
          return 20; // Moderate match
        }
        return 0;

      case 'outdoors-adventure':
        // Prioritize actual adventure activities over general parks
        if (type.includes('hiking_trail') || type.includes('trail') || 
            type.includes('climbing') || type.includes('water_sports') ||
            type.includes('mountain_biking') || type.includes('rafting') ||
            type.includes('kayaking') || type.includes('canoeing')) {
          return 50; // Highest score for actual adventure activities
        }
        if (name.includes('trail') || name.includes('climbing') || 
            name.includes('rafting') || name.includes('adventure') ||
            name.includes('hiking') || category === 'sport' || category.includes('adventure')) {
          return 45; // High score for adventure-related
        }
        // National/state parks and natural areas are good fallbacks
        if (name.includes('national park') || name.includes('state park') ||
            name.includes('national forest') || name.includes('wilderness') ||
            type.includes('natural') || category.includes('natural')) {
          return 30; // Good score for protected natural areas
        }
        // General parks get lower score but still acceptable as fallback
        if (type.includes('park') || name.includes('park')) {
          return 20; // Lower score for general parks but still acceptable
        }
        if (type.includes('nature') || type.includes('outdoor') ||
            name.includes('nature') || name.includes('outdoor') ||
            name.includes('recreation') || type.includes('leisure')) {
          return 25; // Moderate score for nature/outdoor/recreation areas
        }
        // Even generic attractions in outdoor context can work
        if (type.includes('attraction') || category.includes('tourism')) {
          return 10; // Low score but acceptable as last resort
        }
        return 0;

      case 'cultural':
        if (type.includes('museum') || type.includes('gallery') || type.includes('historic') ||
            type.includes('monument') || type.includes('theater') || type.includes('theatre')) {
          return 40;
        }
        if (category.includes('cultural') || category.includes('historic')) {
          return 25;
        }
        return 0;

      case 'relaxation':
        if (type.includes('spa') || type.includes('beach') || type.includes('wellness') ||
            name.includes('spa') || name.includes('beach') || name.includes('resort')) {
          return 40;
        }
        if (type.includes('park') && (name.includes('scenic') || name.includes('garden'))) {
          return 25;
        }
        return 0;

      case 'nightlife':
        if (type.includes('bar') || type.includes('club') || type.includes('nightlife') ||
            category.includes('entertainment') || name.includes('night')) {
          return 40;
        }
        if (type.includes('theater') || type.includes('venue')) {
          return 20;
        }
        return 0;

      case 'shopping':
        if (type.includes('shop') || type.includes('mall') || type.includes('market') ||
            category.includes('shopping') || name.includes('mall') || name.includes('market')) {
          return 40;
        }
        return 0;

      case 'all':
      default:
        // For 'all', give moderate bonus to well-known types
        if (type.includes('museum') || type.includes('park') || type.includes('attraction')) {
          return 15;
        }
        return 0;
    }
  }

  /**
   * Get popularity bonus based on attraction type
   */
  private static getPopularityBonus(type: string, tripType: TripType): number {
    const typeLower = type.toLowerCase();
    
    // For outdoors-adventure, prioritize adventure activities
    if (tripType === 'outdoors-adventure') {
      if (typeLower.includes('hiking_trail') || typeLower.includes('trail') ||
          typeLower.includes('climbing') || typeLower.includes('water_sports') ||
          typeLower.includes('mountain_biking')) {
        return 20; // Higher bonus for adventure activities
      }
      // General parks get lower bonus
      if (typeLower.includes('park') && !typeLower.includes('national')) {
        return 3; // Very low bonus for general parks
      }
      return 5;
    }
    
    // Adventure activities get higher bonus (for outdoors-adventure trip type)
    if (typeLower.includes('hiking_trail') || typeLower.includes('trail') ||
        typeLower.includes('climbing') || typeLower.includes('water_sports') ||
        typeLower.includes('mountain_biking')) {
      return 20; // Higher bonus for adventure activities
    }
    
    // Museums are generally more popular
    if (typeLower.includes('museum')) {
      return 15;
    }
    
    // Historic sites and monuments are also popular
    if (typeLower.includes('historic') || typeLower.includes('monument')) {
      return 10;
    }
    
    // Zoos and aquariums are popular family destinations
    if (typeLower.includes('zoo') || typeLower.includes('aquarium')) {
      return 12;
    }
    
    // General parks get lower bonus (not as adventurous)
    if (typeLower.includes('park') && !typeLower.includes('national')) {
      return 5; // Lower bonus for general parks
    }
    
    return 5; // Default small bonus
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

