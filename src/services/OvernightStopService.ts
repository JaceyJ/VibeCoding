/**
 * OvernightStopService
 * Single Responsibility: Calculates optimal overnight stops along a route
 * Open/Closed: Extensible through configuration without modification
 */

import { RouteData, RoutePoint } from './RouteService';
import { haversineDistance } from '../utils/GeographicUtils';
import { findNearbyCities, City } from './CityService';

export interface OvernightStop {
  day: number;
  city: {
    name: string;
    displayName: string;
    lat: number;
    lon: number;
    placeType: 'city' | 'town' | 'village' | 'hamlet' | 'locality' | 'unknown';
  };
  arrivalTimeSec: number; // Cumulative time in seconds when arriving at this stop
  cumulativeDistance: number; // Cumulative distance in kilometers
  routePointIndex: number; // Index of the closest route point
}

interface RoutePointWithMetrics {
  point: RoutePoint;
  cumulativeDistance: number; // in kilometers
  cumulativeTime: number; // in seconds
  index: number;
}

/**
 * Calculate cumulative travel metrics for each route point
 * @param route - Route data with coordinates
 * @returns Array of route points with cumulative distance and time
 */
function buildCumulativeMetrics(route: RouteData): RoutePointWithMetrics[] {
  const points: RoutePointWithMetrics[] = [];
  let cumulativeDistance = 0;
  let cumulativeTime = 0;

  // Initialize first point
  if (route.coordinates.length > 0) {
    points.push({
      point: route.coordinates[0],
      cumulativeDistance: 0,
      cumulativeTime: 0,
      index: 0
    });
  }

  // Calculate cumulative metrics for each subsequent point
  for (let i = 1; i < route.coordinates.length; i++) {
    const prevPoint = route.coordinates[i - 1];
    const currentPoint = route.coordinates[i];

    // Calculate haversine distance between consecutive points
    const segmentDistance = haversineDistance(prevPoint, currentPoint);
    cumulativeDistance += segmentDistance;

    // Calculate cumulative time using linear scaling
    // Time is proportional to distance based on total route duration
    const timeRatio = cumulativeDistance / route.distance;
    cumulativeTime = timeRatio * route.duration;

    points.push({
      point: currentPoint,
      cumulativeDistance,
      cumulativeTime,
      index: i
    });
  }

  return points;
}

/**
 * Determine the number of driving days based on min/max driving time
 * @param totalDuration - Total route duration in seconds
 * @param minDailyHours - Minimum daily driving time in hours
 * @param maxDailyHours - Maximum daily driving time in hours
 * @returns Number of days needed
 */
function calculateNumberOfDays(
  totalDuration: number,
  minDailyHours: number,
  maxDailyHours: number
): number {
  const totalHours = totalDuration / 3600;
  const minDays = Math.ceil(totalHours / maxDailyHours);
  const maxDays = Math.floor(totalHours / minDailyHours);

  // Use the minimum number of days that satisfies constraints
  // If no valid range, default to minimum days
  if (minDays > maxDays) {
    return Math.max(1, minDays);
  }

  return Math.max(1, minDays);
}

/**
 * Calculate ideal stop window for a given day
 * @param day - Day number (1-indexed)
 * @param totalDays - Total number of days
 * @param totalDuration - Total route duration in seconds
 * @param minDailyHours - Minimum daily driving time in hours
 * @param maxDailyHours - Maximum daily driving time in hours
 * @returns Object with idealMin and idealMax times in seconds
 */
function calculateIdealStopWindow(
  day: number,
  totalDays: number,
  totalDuration: number,
  minDailyHours: number,
  maxDailyHours: number
): { idealMin: number; idealMax: number; idealCenter: number } {
  const totalHours = totalDuration / 3600;
  const hoursPerDay = totalHours / totalDays;

  // Ideal center time for this day
  const idealCenterHours = (day - 0.5) * hoursPerDay;
  const idealCenter = idealCenterHours * 3600;

  // Calculate window boundaries
  // Allow some flexibility around the ideal center
  const windowSize = (maxDailyHours - minDailyHours) / 2;
  const idealMin = Math.max(0, (idealCenterHours - windowSize) * 3600);
  const idealMax = Math.min(
    totalDuration,
    (idealCenterHours + windowSize) * 3600
  );

  return { idealMin, idealMax, idealCenter };
}

/**
 * Get weight for place type based on OSM hierarchy
 * Higher weight = better (more amenities, services, hotels)
 */
function getPlaceTypeWeight(placeType: 'city' | 'town' | 'village' | 'hamlet' | 'locality' | 'unknown'): number {
  const weights: Record<string, number> = {
    'city': 5.0,      // Major cities - best amenities
    'town': 3.0,     // Towns - good amenities
    'village': 1.5,  // Villages - basic amenities
    'hamlet': 0.5,   // Hamlets - minimal amenities
    'locality': 0.3, // Localities - very minimal
    'unknown': 0.1   // Unknown - lowest priority
  };
  return weights[placeType] || 0.1;
}

/**
 * Score a candidate city for overnight stop
 * @param city - Candidate city
 * @param cityTime - Cumulative time when reaching this city (in seconds)
 * @param idealCenter - Ideal center time for this day (in seconds)
 * @param detourTime - Additional time due to detour (in seconds)
 * @returns Final score (higher is better)
 */
function scoreCity(
  city: City,
  cityTime: number,
  idealCenter: number,
  detourTime: number
): number {
  // Closeness to ideal time (negative penalty for being far from ideal)
  const timePenalty = -Math.abs(cityTime - idealCenter) / 3600; // Convert to hours for scaling

  // Detour penalty (negative penalty for long detours)
  const detourPenalty = -detourTime / 3600; // Convert to hours

  // Place type bonus (preference for larger places based on OSM hierarchy)
  const placeTypeBonus = getPlaceTypeWeight(city.placeType);

  // Final score
  const finalScore = timePenalty + detourPenalty + placeTypeBonus;

  return finalScore;
}

/**
 * Find the best overnight stop for a given day
 * @param day - Day number (1-indexed)
 * @param routePoints - Route points with cumulative metrics
 * @param idealMin - Minimum ideal time in seconds
 * @param idealMax - Maximum ideal time in seconds
 * @param idealCenter - Ideal center time in seconds
 * @param routeDistance - Total route distance in kilometers
 * @param routeDuration - Total route duration in seconds
 * @param onProgress - Optional callback for progress updates
 * @returns Best overnight stop or null if none found
 */
async function findBestStopForDay(
  day: number,
  routePoints: RoutePointWithMetrics[],
  idealMin: number,
  idealMax: number,
  idealCenter: number,
  routeDistance: number,
  routeDuration: number,
  onProgress?: ProgressCallback
): Promise<OvernightStop | null> {
  // Get subset of route points within the ideal time window
  onProgress?.({ current: 0, total: 100, message: 'Finding candidate route points...' });
  console.log(`[OvernightStopService] Day ${day}: Filtering route points within time window...`);
  const candidatePoints = routePoints.filter(
    point =>
      point.cumulativeTime >= idealMin && point.cumulativeTime <= idealMax
  );
  console.log(`[OvernightStopService] Day ${day}: Found ${candidatePoints.length} candidate points in time window`);

  if (candidatePoints.length === 0) {
    // If no points in window, use the point closest to ideal center
    console.log(`[OvernightStopService] Day ${day}: No points in window, using closest to ideal center`);
    const closestPoint = routePoints.reduce((prev, curr) => {
      const prevDiff = Math.abs(prev.cumulativeTime - idealCenter);
      const currDiff = Math.abs(curr.cumulativeTime - idealCenter);
      return currDiff < prevDiff ? curr : prev;
    });
    candidatePoints.push(closestPoint);
  }

  // Sample points to avoid too many API calls (every 10th point or so)
  const sampleInterval = Math.max(1, Math.floor(candidatePoints.length / 20));
  const sampledPoints = candidatePoints.filter(
    (_, index) => index % sampleInterval === 0
  );
  console.log(`[OvernightStopService] Day ${day}: Sampling ${sampledPoints.length} points for city search`);

  let bestStop: OvernightStop | null = null;
  let bestScore = -Infinity;
  let citiesFound = 0;
  let citiesScored = 0;

  // For each candidate point, find nearby cities and score them
  for (let i = 0; i < sampledPoints.length; i++) {
    const routePoint = sampledPoints[i];
    const pointProgress = (i / sampledPoints.length) * 100;
    onProgress?.({ 
      current: pointProgress * 0.7, 
      total: 100, 
      message: `Searching for cities near route point ${i + 1}/${sampledPoints.length}...` 
    });
    try {
      console.log(`[OvernightStopService] Day ${day}: Searching cities near point ${i + 1}/${sampledPoints.length} (${routePoint.point.lat.toFixed(4)}, ${routePoint.point.lon.toFixed(4)})`);
      const nearbyCities = await findNearbyCities(
        routePoint.point,
        20, // min radius 20 km
        50 // max radius 50 km
      );
      citiesFound += nearbyCities.length;
      console.log(`[OvernightStopService] Day ${day}: Found ${nearbyCities.length} cities near this point (total: ${citiesFound})`);

      onProgress?.({ 
        current: pointProgress * 0.7 + 10, 
        total: 100, 
        message: `Scoring ${nearbyCities.length} cities...` 
      });

      for (const city of nearbyCities) {
        // Calculate detour time
        // Estimate detour as additional distance / average speed
        const averageSpeedKmh = (routeDistance / routeDuration) * 3600;
        const detourDistance = city.distanceFromRoute;
        const detourTime = (detourDistance / averageSpeedKmh) * 3600;

        // Estimate city arrival time (route time + detour time)
        const cityTime = routePoint.cumulativeTime + detourTime;

        // Score the city
        citiesScored++;
        const score = scoreCity(city, cityTime, idealCenter, detourTime);
        console.log(`[OvernightStopService] Day ${day}: Scored ${city.name} (${city.placeType}, detour: ${city.distanceFromRoute.toFixed(1)}km) - Score: ${score.toFixed(2)}`);

        if (score > bestScore) {
          console.log(`[OvernightStopService] Day ${day}: New best stop! ${city.name} (previous best: ${bestScore.toFixed(2)})`);
          bestScore = score;
          bestStop = {
            day,
            city: {
              name: city.name,
              displayName: city.displayName,
              lat: city.lat,
              lon: city.lon,
              placeType: city.placeType
            },
            arrivalTimeSec: cityTime,
            cumulativeDistance: routePoint.cumulativeDistance,
            routePointIndex: routePoint.index
          };
        }
      }

      // Add a small delay to respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`[OvernightStopService] Day ${day}: Error processing route point ${i + 1}:`, error);
    }
  }

  console.log(`[OvernightStopService] Day ${day}: Evaluated ${citiesFound} cities, scored ${citiesScored} candidates`);
  if (bestStop) {
    console.log(`[OvernightStopService] Day ${day}: Best stop selected: ${bestStop.city.name} with score ${bestScore.toFixed(2)}`);
  }

  return bestStop;
}

/**
 * Progress callback type for tracking calculation progress
 */
export interface ProgressCallback {
  (progress: {
    current: number;
    total: number;
    message: string;
    day?: number;
  }): void;
}

/**
 * Select optimal overnight stops along a route
 * @param route - Route data with coordinates, distance, and duration
 * @param minDailyHours - Minimum daily driving time in hours
 * @param maxDailyHours - Maximum daily driving time in hours
 * @param onProgress - Optional callback for progress updates
 * @returns Promise with array of optimal overnight stops
 */
export async function selectOvernightStops(
  route: RouteData,
  minDailyHours: number,
  maxDailyHours: number,
  onProgress?: ProgressCallback
): Promise<OvernightStop[]> {
  console.log('[OvernightStopService] Starting overnight stop calculation...');
  console.log(`[OvernightStopService] Route: ${route.distance.toFixed(1)} km, ${(route.duration / 3600).toFixed(1)} hours`);

  // Step 1: Build cumulative travel metrics for each route point
  onProgress?.({ current: 0, total: 100, message: 'Building route metrics...' });
  console.log('[OvernightStopService] Step 1: Building cumulative metrics for route points...');
  const routePoints = buildCumulativeMetrics(route);
  console.log(`[OvernightStopService] Processed ${routePoints.length} route points`);

  if (routePoints.length === 0) {
    console.warn('[OvernightStopService] No route points found, returning empty stops');
    return [];
  }

  // Step 2: Determine number of driving days
  onProgress?.({ current: 10, total: 100, message: 'Calculating number of days...' });
  console.log('[OvernightStopService] Step 2: Calculating number of driving days...');
  const numberOfDays = calculateNumberOfDays(
    route.duration,
    minDailyHours,
    maxDailyHours
  );
  console.log(`[OvernightStopService] Trip will take ${numberOfDays} day(s) (min: ${minDailyHours}h, max: ${maxDailyHours}h)`);

  const stops: OvernightStop[] = [];
  const progressPerDay = 90 / numberOfDays; // 90% for all days, 10% for setup

  // Step 3 & 4: For each day, find optimal stop
  for (let day = 1; day <= numberOfDays; day++) {
    const dayProgress = 10 + (day - 1) * progressPerDay;
    onProgress?.({ 
      current: dayProgress, 
      total: 100, 
      message: `Finding stop for day ${day} of ${numberOfDays}...`,
      day 
    });
    console.log(`[OvernightStopService] Step 3: Processing day ${day}/${numberOfDays}...`);
    // Calculate ideal stop window for this day
    const { idealMin, idealMax, idealCenter } = calculateIdealStopWindow(
      day,
      numberOfDays,
      route.duration,
      minDailyHours,
      maxDailyHours
    );
    console.log(`[OvernightStopService] Day ${day}: Ideal window ${(idealMin / 3600).toFixed(1)}h - ${(idealMax / 3600).toFixed(1)}h (center: ${(idealCenter / 3600).toFixed(1)}h)`);

    // Find best stop for this day
    const stop = await findBestStopForDay(
      day,
      routePoints,
      idealMin,
      idealMax,
      idealCenter,
      route.distance,
      route.duration,
      (subProgress) => {
        const totalProgress = dayProgress + (subProgress.current * progressPerDay / 100);
        onProgress?.({
          current: totalProgress,
          total: 100,
          message: `Day ${day}: ${subProgress.message}`,
          day
        });
      }
    );

    if (stop) {
      console.log(`[OvernightStopService] Day ${day}: Selected ${stop.city.name} (${stop.city.placeType}, arrival: ${(stop.arrivalTimeSec / 3600).toFixed(1)}h)`);
      stops.push(stop);
    } else {
      console.warn(`[OvernightStopService] Day ${day}: No suitable stop found`);
    }
  }

  onProgress?.({ current: 100, total: 100, message: 'Complete!' });
  console.log(`[OvernightStopService] Calculation complete. Found ${stops.length} overnight stop(s)`);
  return stops;
}

