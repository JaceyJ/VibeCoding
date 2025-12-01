import { RouteData, RoutePoint } from './RouteService';
import { Point, haversineDistance } from '../utils/GeographicUtils';
import { Attraction, AttractionService } from './AttractionService';
import { TripType } from '../components/TripTypeSelector';

/**
 * RouteAttractionService
 * Single Responsibility: Finds attractions along a route (per day/segment)
 */

export interface DayAttractionResult {
  day: number;
  attractions: Attraction[];
}

interface RoutePointWithDistance {
  point: Point;
  distanceFromStartKm: number;
}

export class RouteAttractionService {
  /**
   * Find attractions along the route for a given day.
   *
   * Flow:
   * 1. Optionally simplify the route polyline using Douglas–Peucker.
   * 2. Compute cumulative distances along the route.
   * 3. Derive the day's segment (start/end distance) based on total days.
   * 4. Sample search points every 20–50 km within that segment.
   * 5. Query attractions around each search point.
   * 6. Merge, score, and de-duplicate results (scoring handled by AttractionService).
   * 7. Ensure at least one attraction is returned for the day (fallback if needed).
   */
  static async findAttractionsForDay(params: {
    route: RouteData;
    day: number;          // 1-based day index
    totalDays: number;    // total number of driving days
    tripType: TripType;
    simplifyToleranceKm?: number; // Douglas–Peucker tolerance
    searchIntervalKm?: number;    // spacing between search points (default ~30km)
    searchRadiusKm?: number;      // radius for each attraction search (default 25km)
  }): Promise<DayAttractionResult> {
    const {
      route,
      day,
      totalDays,
      tripType,
      simplifyToleranceKm = 2,
      searchIntervalKm = 30,
      searchRadiusKm = 25
    } = params;

    if (!route.coordinates || route.coordinates.length === 0 || totalDays <= 0) {
      return { day, attractions: [] };
    }

    // 1) Optionally simplify the route polyline if it has many points
    const rawPoints: Point[] = route.coordinates.map((p: RoutePoint) => ({
      lat: p.lat,
      lon: p.lon
    }));

    const points =
      rawPoints.length > 200
        ? this.simplifyRoute(rawPoints, simplifyToleranceKm)
        : rawPoints;

    // 2) Compute cumulative distances along the (possibly simplified) route
    const pointsWithDistance = this.buildCumulativeDistances(points);
    const totalDistanceKm =
      pointsWithDistance.length > 0
        ? pointsWithDistance[pointsWithDistance.length - 1].distanceFromStartKm
        : route.distance;

    if (totalDistanceKm <= 0) {
      return { day, attractions: [] };
    }

    // 3) Derive the day's segment [startKm, endKm] by splitting the total distance
    const segmentLengthKm = totalDistanceKm / totalDays;
    const segmentStartKm = segmentLengthKm * (day - 1);
    const segmentEndKm = day === totalDays
      ? totalDistanceKm
      : segmentLengthKm * day;

    // 4) Sample search points every N km within the segment
    const searchPoints = this.getSearchPointsForSegment(
      pointsWithDistance,
      segmentStartKm,
      segmentEndKm,
      searchIntervalKm
    );

    // Ensure at least one search point (use segment midpoint if needed)
    if (searchPoints.length === 0) {
      const midKm = (segmentStartKm + segmentEndKm) / 2;
      const midPoint = this.getPointAtDistance(pointsWithDistance, midKm);
      if (midPoint) {
        searchPoints.push(midPoint);
      }
    }

    console.log(
      `[RouteAttractionService] Day ${day}: totalDistance=${totalDistanceKm.toFixed(
        1
      )}km, segment=[${segmentStartKm.toFixed(1)}, ${segmentEndKm.toFixed(
        1
      )}]km, searchPoints=${searchPoints.length}`
    );

    // 5) Query attractions around each search point
    const allAttractions: Attraction[] = [];

    for (let i = 0; i < searchPoints.length; i++) {
      const center = searchPoints[i];
      try {
        console.log(
          `[RouteAttractionService] Day ${day}: Searching attractions around point ${i + 1}/${
            searchPoints.length
          } (${center.lat.toFixed(4)}, ${center.lon.toFixed(4)})`
        );

        const results = await AttractionService.searchAttractions(
          center,
          {
            tripType,
            maxDistance: searchRadiusKm
          },
          searchRadiusKm
        );

        allAttractions.push(...results);
      } catch (error) {
        console.warn(
          `[RouteAttractionService] Day ${day}: Error searching attractions at point ${i + 1}:`,
          error
        );
      }
    }

    // 6) De-duplicate and sort by score (AttractionService already scored them)
    const uniqueAttractions = this.deduplicateAttractions(allAttractions);
    uniqueAttractions.sort((a, b) => b.score - a.score);

    // 7) Ensure at least one attraction is returned for the day
    let finalAttractions = uniqueAttractions.slice(0, 10);

    if (finalAttractions.length === 0 && searchPoints.length > 0) {
      // Fallback: broad search at the midpoint of the day's segment
      const midIndex = Math.floor(searchPoints.length / 2);
      const center = searchPoints[midIndex];
      try {
        console.log(
          `[RouteAttractionService] Day ${day}: No attractions found, running fallback search at midpoint`
        );
        const fallbackResults = await AttractionService.searchAttractions(
          center,
          {
            tripType,
            maxDistance: searchRadiusKm * 1.5
          },
          searchRadiusKm * 1.5
        );
        const dedupFallback = this.deduplicateAttractions(fallbackResults);
        dedupFallback.sort((a, b) => b.score - a.score);
        finalAttractions = dedupFallback.slice(0, 5);
      } catch (error) {
        console.warn(
          `[RouteAttractionService] Day ${day}: Fallback attraction search failed:`,
          error
        );
      }
    }

    console.log(
      `[RouteAttractionService] Day ${day}: Returning ${finalAttractions.length} attraction(s)`
    );

    return { day, attractions: finalAttractions };
  }

  /**
   * Douglas–Peucker simplification for a polyline of Points.
   * Tolerance is expressed in kilometers.
   */
  private static simplifyRoute(points: Point[], toleranceKm: number): Point[] {
    if (points.length <= 2) {
      return points;
    }

    const sqTolerance = toleranceKm * toleranceKm;

    const dp = (pts: Point[], first: number, last: number, simplified: Point[]) => {
      let maxSqDist = 0;
      let index = 0;

      const start = pts[first];
      const end = pts[last];

      for (let i = first + 1; i < last; i++) {
        const sqDist = this.squaredPerpendicularDistance(pts[i], start, end);
        if (sqDist > maxSqDist) {
          index = i;
          maxSqDist = sqDist;
        }
      }

      if (maxSqDist > sqTolerance) {
        if (index - first > 1) dp(pts, first, index, simplified);
        simplified.push(pts[index]);
        if (last - index > 1) dp(pts, index, last, simplified);
      }
    };

    const simplified: Point[] = [points[0]];
    dp(points, 0, points.length - 1, simplified);
    simplified.push(points[points.length - 1]);

    return simplified;
  }

  /**
   * Helper for Douglas–Peucker: squared perpendicular distance from point C to segment AB.
   * Distances are approximated using haversineDistance in km, then squared.
   */
  private static squaredPerpendicularDistance(
    c: Point,
    a: Point,
    b: Point
  ): number {
    // If A and B are the same point, just return squared distance to A
    if (a.lat === b.lat && a.lon === b.lon) {
      const d = haversineDistance(a, c);
      return d * d;
    }

    // Project point C onto segment AB using parametric form
    const A = { x: a.lon, y: a.lat };
    const B = { x: b.lon, y: b.lat };
    const C = { x: c.lon, y: c.lat };

    const ABx = B.x - A.x;
    const ABy = B.y - A.y;
    const t =
      ((C.x - A.x) * ABx + (C.y - A.y) * ABy) /
      (ABx * ABx + ABy * ABy);

    let proj: Point;
    if (t <= 0) {
      proj = a;
    } else if (t >= 1) {
      proj = b;
    } else {
      proj = {
        lat: A.y + ABy * t,
        lon: A.x + ABx * t
      };
    }

    const d = haversineDistance(c, proj);
    return d * d;
  }

  /**
   * Compute cumulative distances along the route.
   */
  private static buildCumulativeDistances(points: Point[]): RoutePointWithDistance[] {
    const result: RoutePointWithDistance[] = [];
    let cumulative = 0;

    for (let i = 0; i < points.length; i++) {
      if (i > 0) {
        cumulative += haversineDistance(points[i - 1], points[i]);
      }
      result.push({
        point: points[i],
        distanceFromStartKm: cumulative
      });
    }

    return result;
  }

  /**
   * Get search points within a segment [startKm, endKm], spaced by intervalKm.
   */
  private static getSearchPointsForSegment(
    pointsWithDist: RoutePointWithDistance[],
    startKm: number,
    endKm: number,
    intervalKm: number
  ): Point[] {
    if (pointsWithDist.length === 0 || endKm <= startKm) {
      return [];
    }

    const searchPoints: Point[] = [];
    let currentKm = startKm;

    while (currentKm <= endKm) {
      const point = this.getPointAtDistance(pointsWithDist, currentKm);
      if (point) {
        searchPoints.push(point);
      }
      currentKm += intervalKm;
    }

    return searchPoints;
  }

  /**
   * Get the route point at (or just after) a given cumulative distance.
   */
  private static getPointAtDistance(
    pointsWithDist: RoutePointWithDistance[],
    targetKm: number
  ): Point | null {
    if (pointsWithDist.length === 0) return null;

    for (let i = 0; i < pointsWithDist.length; i++) {
      if (pointsWithDist[i].distanceFromStartKm >= targetKm) {
        return pointsWithDist[i].point;
      }
    }

    return pointsWithDist[pointsWithDist.length - 1].point;
  }

  /**
   * De-duplicate attractions by approximate coordinates and name.
   */
  private static deduplicateAttractions(attractions: Attraction[]): Attraction[] {
    const seen = new Set<string>();
    const result: Attraction[] = [];

    for (const a of attractions) {
      const key = `${a.name.toLowerCase()}-${a.lat.toFixed(4)}-${a.lon.toFixed(4)}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(a);
      }
    }

    return result;
  }
}



