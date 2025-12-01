# Route Data Structure Documentation

## Current State: Frontend-Only

Currently, the application has **no backend**. Route calculation happens directly in the frontend using external APIs (OSRM and Nominatim).

## Frontend Data Structure

### TypeScript Interfaces

```typescript
// Single coordinate point
interface RoutePoint {
  lat: number;  // Latitude
  lon: number;  // Longitude
}

// Complete route data
interface RouteData {
  coordinates: RoutePoint[];  // Array of points forming the route path
  distance: number;            // Total distance in kilometers
  duration: number;            // Total duration in seconds
  summary: string;             // Human-readable summary string
}
```

### Example RouteData Object

```json
{
  "coordinates": [
    { "lat": 40.7128, "lon": -74.0060 },
    { "lat": 40.7130, "lon": -74.0058 },
    { "lat": 40.7132, "lon": -74.0056 },
    // ... hundreds or thousands of points
    { "lat": 34.0522, "lon": -118.2437 }
  ],
  "distance": 3944.2,
  "duration": 144000,
  "summary": "Distance: 3944.2 km, Duration: 40h 0m"
}
```

## OSRM API Response Format

The OSRM API returns data in this format:

```json
{
  "code": "Ok",
  "routes": [
    {
      "geometry": {
        "coordinates": [
          [-74.0060, 40.7128],
          [-74.0058, 40.7130],
          // ... more coordinates
        ],
        "type": "LineString"
      },
      "distance": 3944200,      // in meters
      "duration": 144000,       // in seconds
      "legs": [
        {
          "distance": 3944200,
          "duration": 144000,
          "steps": [...]
        }
      ]
    }
  ],
  "waypoints": [
    {
      "hint": "...",
      "distance": 4.415666,
      "name": "Broadway",
      "location": [-74.0060, 40.7128]
    },
    {
      "hint": "...",
      "distance": 4.415666,
      "name": "Main Street",
      "location": [-118.2437, 34.0522]
    }
  ]
}
```

## Backend Representation (Proposed)

If you were to add a backend, here's how the route data could be structured:

### Database Schema (SQL Example)

```sql
-- Trips table
CREATE TABLE trips (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  start_location VARCHAR(255) NOT NULL,
  end_location VARCHAR(255) NOT NULL,
  start_lat DECIMAL(10, 8) NOT NULL,
  start_lon DECIMAL(11, 8) NOT NULL,
  end_lat DECIMAL(10, 8) NOT NULL,
  end_lon DECIMAL(11, 8) NOT NULL,
  min_daily_driving_time DECIMAL(4, 2),
  max_daily_driving_time DECIMAL(4, 2),
  total_distance DECIMAL(10, 2),  -- in kilometers
  total_duration INTEGER,          -- in seconds
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Route coordinates table (stores the path)
CREATE TABLE route_coordinates (
  id UUID PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  sequence_order INTEGER NOT NULL,  -- Order of points in the route
  lat DECIMAL(10, 8) NOT NULL,
  lon DECIMAL(11, 8) NOT NULL,
  INDEX idx_trip_sequence (trip_id, sequence_order)
);

-- Route segments (optional - for multi-day trips)
CREATE TABLE route_segments (
  id UUID PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  start_coordinate_id UUID REFERENCES route_coordinates(id),
  end_coordinate_id UUID REFERENCES route_coordinates(id),
  distance DECIMAL(10, 2),
  duration INTEGER,
  driving_time DECIMAL(4, 2)
);
```

### Backend API Response Format

```json
{
  "trip": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "startLocation": "New York, NY",
    "endLocation": "Los Angeles, CA",
    "startCoordinates": {
      "lat": 40.7128,
      "lon": -74.0060
    },
    "endCoordinates": {
      "lat": 34.0522,
      "lon": -118.2437
    },
    "minDailyDrivingTime": 4.0,
    "maxDailyDrivingTime": 8.0,
    "route": {
      "totalDistance": 3944.2,
      "totalDuration": 144000,
      "coordinates": [
        { "lat": 40.7128, "lon": -74.0060 },
        { "lat": 40.7130, "lon": -74.0058 },
        // ... more points
      ],
      "segments": [
        {
          "day": 1,
          "startIndex": 0,
          "endIndex": 500,
          "distance": 500.0,
          "duration": 18000,
          "drivingTime": 5.0
        },
        // ... more segments
      ]
    }
  }
}
```

### Backend Service Layer (Example)

```typescript
// Backend service interface
interface TripService {
  createTrip(tripData: TripPlanningFormData): Promise<Trip>;
  getTrip(tripId: string): Promise<Trip>;
  calculateRoute(start: RoutePoint, end: RoutePoint): Promise<RouteData>;
  saveRoute(tripId: string, route: RouteData): Promise<void>;
}

// Backend route calculation
class BackendRouteService {
  async calculateRoute(start: RoutePoint, end: RoutePoint): Promise<RouteData> {
    // Call OSRM API
    // Cache results in database
    // Return RouteData
  }
  
  async saveRouteToDatabase(tripId: string, route: RouteData): Promise<void> {
    // Save route coordinates to database
    // Optimize storage (e.g., use line simplification for long routes)
  }
}
```

## Storage Optimization Considerations

For production, consider:

1. **Line Simplification**: Store fewer points using algorithms like Douglas-Peucker
2. **Compression**: Compress coordinate arrays for storage
3. **Caching**: Cache frequently requested routes
4. **Segmentation**: Break long routes into daily segments based on driving time constraints

## Current Flow (Frontend-Only)

```
User Input → Frontend
    ↓
Geocode Locations (Nominatim API)
    ↓
Calculate Route (OSRM API)
    ↓
Display on Map (Leaflet)
```

## Proposed Backend Flow

```
User Input → Frontend
    ↓
POST /api/trips → Backend
    ↓
Backend: Geocode & Calculate Route
    ↓
Backend: Save to Database
    ↓
Backend: Return Route Data
    ↓
Frontend: Display on Map
```



