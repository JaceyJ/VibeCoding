/**
 * GeographicUtils
 * Single Responsibility: Provides geographic calculation utilities
 */

export interface Point {
  lat: number;
  lon: number;
}

/**
 * Calculate haversine distance between two points on Earth
 * @param point1 - First point (lat, lon)
 * @param point2 - Second point (lat, lon)
 * @returns Distance in kilometers
 */
export function haversineDistance(point1: Point, point2: Point): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(point2.lat - point1.lat);
  const dLon = toRadians(point2.lon - point1.lon);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(point1.lat)) *
      Math.cos(toRadians(point2.lat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate bearing between two points
 * @param point1 - Starting point
 * @param point2 - Ending point
 * @returns Bearing in degrees (0-360)
 */
export function calculateBearing(point1: Point, point2: Point): number {
  const lat1 = toRadians(point1.lat);
  const lat2 = toRadians(point2.lat);
  const dLon = toRadians(point2.lon - point1.lon);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  const bearing = Math.atan2(y, x);
  return (toDegrees(bearing) + 360) % 360;
}

/**
 * Convert radians to degrees
 */
function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Calculate a point at a given distance and bearing from a starting point
 * @param start - Starting point
 * @param distanceKm - Distance in kilometers
 * @param bearingDeg - Bearing in degrees
 * @returns Destination point
 */
export function destinationPoint(
  start: Point,
  distanceKm: number,
  bearingDeg: number
): Point {
  const R = 6371; // Earth's radius in kilometers
  const lat1 = toRadians(start.lat);
  const lon1 = toRadians(start.lon);
  const bearing = toRadians(bearingDeg);
  const d = distanceKm / R;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) +
      Math.cos(lat1) * Math.sin(d) * Math.cos(bearing)
  );

  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    lat: toDegrees(lat2),
    lon: toDegrees(lon2)
  };
}



