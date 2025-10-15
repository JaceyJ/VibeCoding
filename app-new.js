// Main application initialization and orchestration

// Global variables
let map, baselayer, routeLayer;

// Initialize the application
function initializeApp() {
	// Initialize map
	initializeMap();
	
	// Initialize autocomplete
	initializeAutocomplete();
	
	// Setup form submission
	setupFormHandlers();
	
	console.log('Smart Trip Planner initialized successfully');
}

// Initialize Leaflet map
function initializeMap() {
	map = L.map('map').setView(MAP_CONFIG.defaultCenter, MAP_CONFIG.defaultZoom);
	
	baselayer = L.tileLayer(MAP_CONFIG.tileLayer, {
		attribution: MAP_CONFIG.attribution
	}).addTo(map);
	
	// Make map globally available
	window.map = map;
	window.baselayer = baselayer;
}

// Setup form event handlers
function setupFormHandlers() {
	const form = getElementSafely('trip-form');
	if (!form) return;
	
	form.addEventListener('submit', planTrip);
}

// Main trip planning function
async function planTrip(event) {
	event.preventDefault();
	
	const form = event.target;
	const startText = getElementSafely('start').value.trim();
	const endText = getElementSafely('end').value.trim();
	
	if (!startText || !endText) {
		setStatus('Please enter both start and end locations');
		return;
	}
	
	// Disable form during processing
	form.querySelector('button[type="submit"]').disabled = true;
	
	try {
		setStatus('Finding locations...');
		showProgress();
		
		// Geocode start and end locations
		let start, end;
		try {
			start = await geocode(startText);
		} catch (error) {
			throw new Error(`Could not find start location: ${startText}`);
		}
		
		try {
			end = await geocode(endText);
		} catch (error) {
			throw new Error(`Could not find end location: ${endText}`);
		}
		
		// Validate locations
		if (!validateLocation(start) || !validateLocation(end)) {
			throw new Error('Invalid location coordinates');
		}
		
		// Clear map and add markers
		clearMap();
		addMarker(start.lat, start.lon, 'Start', '#22c55e');
		addMarker(end.lat, end.lon, 'End', '#ef4444');
		
		// Fetch route
		setStatus('Finding route...');
		updateProgress(20, 'Calculating route...');
		const route = await fetchRoute(start, end);
		renderRoute(route.geometry);
		
		// Get user preferences
		const tripPace = getTripPace();
		const driveTimeRange = getDriveTimeRange();
		const preferences = getUserPreferences();
		
		// Get configuration
		const config = TRIP_PACE_CONFIG[tripPace];
		const totalDistance = route.distance;
		const totalDuration = route.duration;
		
		setStatus('Planning trip with your preferences...');
		showProgress();
		
		// Calculate number of days based on total duration and user preferences
		const totalHours = totalDuration / 3600;
		const idealDays = Math.ceil(totalHours / config.maxDailyDrivingHours);
		const days = Math.max(1, Math.min(idealDays, UI_CONFIG.maxDays));
		
		console.log(`Planning ${days}-day trip with ${tripPace} pace`);
		console.log('Drive time range:', driveTimeRange);
		console.log('Preferences:', preferences);
		
		// Create stops along the route using sophisticated logic
		setStatus('Finding optimal stops with accommodations...');
		updateProgress(30, 'Searching for accommodations along route...');
		
		const result = await computeSmartTripStops(route, days, config, (progress, message) => {
			updateProgress(30 + (progress * 0.2), message); // 30-50%
		});
		
		const stops = result.stops;
		console.log(`Created ${stops.length} sophisticated stops`);
		
		// Add markers for stops
		stops.forEach((stop, i) => {
			addMarker(stop.lat, stop.lon, `Stop ${i + 1}: ${stop.name}`, '#f59e0b');
		});
		
		// Find POIs and accommodations for each stop
		setStatus(`Finding attractions and accommodations based on your preferences...`);
		const poisPerStop = await Promise.all(stops.map(async (stop, index) => {
			try {
				const [pois, accommodations] = await Promise.all([
					fetchPoisSimple(stop.lat, stop.lon, 16000, config.maxPoisPerStop, preferences), // Use 10 miles (16km)
					fetchAccommodations(stop.lat, stop.lon, config.accommodationRadius, 5)
				]);
				
				const progress = 50 + ((index + 1) / stops.length) * 40; // 50-90%
				updateProgress(progress, `Finding activities and accommodations for stop ${index + 1}/${stops.length}...`);
				
				console.log(`Stop ${index + 1}: ${pois.length} POIs, ${accommodations.length} accommodations`);
				return { stop, pois, accommodations };
			} catch (e) {
				console.error('Error fetching data for stop:', e);
				return { stop, pois: [], accommodations: [] };
			}
		}));
		
		// Render results
		renderTripResults(start, end, stops, poisPerStop, totalDistance, totalDuration, days, tripPace);
		
		updateProgress(100, 'Complete!');
		setStatus('Trip planned successfully!');
		
		// Hide progress bar after a short delay
		setTimeout(() => {
			hideProgress();
		}, 2000);
		
	} catch (err) {
		console.error(err);
		setStatus(err.message || 'Something went wrong. Try different inputs.');
	} finally {
		form.querySelector('button[type="submit"]').disabled = false;
	}
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);
