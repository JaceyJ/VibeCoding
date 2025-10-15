// Configuration constants and settings

// Trip pace configurations
const TRIP_PACE_CONFIG = {
	fast: {
		maxDailyDrivingHours: 8,
		maxRoadsideStops: 1,
		minActivityTime: 1,
		preferOvernightStops: true,
		accommodationRadius: 5000,
		poiRadius: 15000,
		maxPoisPerStop: 3
	},
	balanced: {
		maxDailyDrivingHours: 6,
		maxRoadsideStops: 3,
		minActivityTime: 1.5,
		preferOvernightStops: true,
		accommodationRadius: 8000,
		poiRadius: 25000,
		maxPoisPerStop: 5
	},
	explore: {
		maxDailyDrivingHours: 4,
		maxRoadsideStops: 5,
		minActivityTime: 2,
		preferOvernightStops: false,
		accommodationRadius: 10000,
		poiRadius: 30000,
		maxPoisPerStop: 8
	}
};

// Activity time estimates (in hours)
const ACTIVITY_TIME_ESTIMATES = {
	'Museum': 2.5,
	'Zoo/Aquarium': 3,
	'Park': 1.5,
	'Historic Site': 1.5,
	'Restaurant': 1,
	'Scenic View': 0.5,
	'Entertainment': 2,
	'Outdoor Activity': 2,
	'Cultural Site': 2,
	'Food & Drink': 1,
	'Family Activity': 2,
	'Adventure': 3,
	'Attraction': 1.5
};

// API endpoints and settings
const API_CONFIG = {
	nominatim: {
		baseUrl: 'https://nominatim.openstreetmap.org',
		timeout: 10000,
		userAgent: 'RoadtripPlanner/1.0'
	},
	osrm: {
		baseUrl: 'https://router.project-osrm.org',
		timeout: 15000
	},
	overpass: {
		baseUrl: 'https://overpass-api.de/api/interpreter',
		timeout: 25000
	},
	wikipedia: {
		baseUrl: 'https://en.wikipedia.org/w/api.php',
		timeout: 10000
	}
};

// Map configuration
const MAP_CONFIG = {
	defaultCenter: [40.7128, -74.0060], // New York City
	defaultZoom: 6,
	tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
	attribution: '© OpenStreetMap contributors'
};

// UI configuration
const UI_CONFIG = {
	maxSuggestions: 5,
	debounceDelay: 300,
	progressUpdateInterval: 100,
	maxDays: 7,
	minDays: 1
};

// Export for use in other modules
export { TRIP_PACE_CONFIG, ACTIVITY_TIME_ESTIMATES, API_CONFIG, MAP_CONFIG, UI_CONFIG };
