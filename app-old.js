/* Roadtrip Planner App */

const form = document.getElementById('planner-form');
const startInput = document.getElementById('start');
const endInput = document.getElementById('end');
const daysInput = document.getElementById('days');
const statusEl = document.getElementById('status');
const itineraryEl = document.getElementById('itinerary');
const poiListEl = document.getElementById('poi-list');
const startSuggestions = document.getElementById('start-suggestions');
const endSuggestions = document.getElementById('end-suggestions');
const progressContainer = document.getElementById('progress-container');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const tripOverviewEl = document.getElementById('trip-overview');
const detailedItineraryEl = document.getElementById('detailed-itinerary');

// Add error handling for missing elements
function getElementSafely(id) {
	const element = document.getElementById(id);
	if (!element) {
		console.error(`Element with id '${id}' not found`);
	}
	return element;
}

// Initialize map
const map = L.map('map');
const baselayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
	attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
});
baselayer.addTo(map);
map.setView([37.773972, -122.431297], 5);

// Layers to manage route and markers
let routeLayer = null;
const markerLayer = L.layerGroup().addTo(map);

function setStatus(message) {
	statusEl.textContent = message || '';
}

function showProgress() {
	progressContainer.style.display = 'block';
	progressFill.style.width = '0%';
}

function hideProgress() {
	progressContainer.style.display = 'none';
}

function updateProgress(percentage, text) {
	progressFill.style.width = `${percentage}%`;
	progressText.textContent = text || '';
}

async function geocode(text) {
	const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(text)}`;
	const res = await fetch(url, {
		headers: {
			'Accept': 'application/json'
		}
	});
	if (!res.ok) throw new Error('Geocoding failed');
	const data = await res.json();
	if (!data || data.length === 0) throw new Error('No results found');
	const place = data[0];
	return {
		lat: parseFloat(place.lat),
		lon: parseFloat(place.lon),
		displayName: place.display_name
	};
}

async function fetchRoute(start, end) {
	const coords = `${start.lon},${start.lat};${end.lon},${end.lat}`;
	const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false&annotations=distance`;
	const res = await fetch(url);
	if (!res.ok) throw new Error('Routing failed');
	const json = await res.json();
	if (!json || !json.routes || json.routes.length === 0) throw new Error('No route found');
	return json.routes[0];
}

function clearMap() {
	if (routeLayer) {
		map.removeLayer(routeLayer);
		routeLayer = null;
	}
	markerLayer.clearLayers();
}

function renderRoute(geojson) {
	routeLayer = L.geoJSON(geojson, {
		style: { color: '#38bdf8', weight: 5, opacity: 0.85 }
	}).addTo(map);
	map.fitBounds(routeLayer.getBounds(), { padding: [20, 20] });
}

function addMarker(lat, lon, label, color = '#22c55e') {
	const marker = L.circleMarker([lat, lon], {
		radius: 7,
		color,
		weight: 2,
		fillColor: color,
		fillOpacity: 0.65
	}).bindTooltip(label, { permanent: false });
	markerLayer.addLayer(marker);
	return marker;
}

async function computeStopsByDistance(route, days, progressCallback) {
	const tripPace = getTripPace();
	const config = TRIP_PACE_CONFIG[tripPace];
	
	if (progressCallback) {
		progressCallback(10, `Planning ${tripPace} trip with ${days} days...`);
	}
	
	// Use smart trip planning based on style
	return await computeSmartTripStops(route, days, config, progressCallback);
}

async function computeSmartTripStops(route, days, config, progressCallback) {
	const geometry = route.geometry;
	const coordinates = geometry.coordinates;
	const totalDistance = route.distance;
	const totalDuration = route.duration;
	
	// Calculate daily driving limits
	const maxDailyDistance = (totalDistance / days) * 1.2; // 20% buffer
	const maxDailyDuration = (totalDuration / days) * 1.2;
	
	// Find potential overnight stops (hotels/accommodations)
	if (progressCallback) {
		progressCallback(20, 'Finding overnight accommodation options...');
	}
	const overnightStops = await findOvernightStops(route, days, config, progressCallback);
	
	// Find roadside attractions and activities
	if (progressCallback) {
		progressCallback(40, 'Discovering roadside attractions...');
	}
	const roadsideStops = await findRoadsideStops(route, config, progressCallback);
	
	// Plan the optimal itinerary
	if (progressCallback) {
		progressCallback(70, 'Creating optimized itinerary...');
	}
	const itinerary = await createSmartItinerary(
		route, 
		days, 
		overnightStops, 
		roadsideStops, 
		config, 
		progressCallback
	);
	
	return {
		stops: itinerary.stops,
		roadsideStops: itinerary.roadsideStops,
		totalDistance,
		itinerary: itinerary.days
	};
}

async function findAccommodationStops(route, days, progressCallback) {
	const geometry = route.geometry;
	const coordinates = geometry.coordinates;
	const totalDistance = route.distance;
	
	// Reduce sampling frequency for better performance
	const samplePoints = [];
	const sampleInterval = Math.max(10000, totalDistance / 20); // Sample every 10km or 20 points max
	let currentDistance = 0;
	
	for (let i = 0; i < coordinates.length - 1; i++) {
		const [lon1, lat1] = coordinates[i];
		const [lon2, lat2] = coordinates[i + 1];
		const segmentDistance = calculateDistance(lat1, lon1, lat2, lon2);
		
		if (currentDistance >= sampleInterval) {
			samplePoints.push({
				lat: lat1,
				lon: lon1,
				distanceFromStart: currentDistance,
				index: i
			});
			currentDistance = 0;
		}
		currentDistance += segmentDistance;
	}
	
	// Limit to reasonable number of sample points
	const maxSamples = Math.min(samplePoints.length, days * 3);
	const selectedSamples = samplePoints.slice(0, maxSamples);
	
	// Check sample points for accommodations with progress tracking
	const accommodationStops = [];
	
	for (let i = 0; i < selectedSamples.length; i++) {
		const point = selectedSamples[i];
		const progress = (i / selectedSamples.length) * 50; // First 50% of progress
		
		if (progressCallback) {
			progressCallback(progress, `Checking accommodations at location ${i + 1}/${selectedSamples.length}...`);
		}
		
		try {
			// Add timeout to prevent hanging
			const accommodations = await Promise.race([
				findNearbyAccommodations(point.lat, point.lon),
				new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
			]);
			
			if (accommodations.length > 0) {
				const locationInfo = await reverseGeocode(point.lat, point.lon);
				accommodationStops.push({
					...point,
					name: locationInfo ? locationInfo.name : 'Accommodation Available',
					fullAddress: locationInfo ? locationInfo.fullAddress : null,
					accommodations: accommodations,
					accommodationScore: accommodations.length
				});
			}
		} catch (error) {
			console.error('Error checking accommodations:', error);
			// Continue with other points even if one fails
		}
	}
	
	return accommodationStops;
}

async function findNearbyAccommodations(lat, lon, radiusMeters = 10000) {
	console.log(`Searching for accommodations near ${lat}, ${lon} within ${radiusMeters}m`);
	// Search for hotels, motels, B&Bs, and other accommodations using Overpass API
	const query = `
		[out:json][timeout:25];
		(
		  node["tourism"~"^(hotel|motel|hostel|guest_house|bed_and_breakfast|apartment|resort)$"](around:${radiusMeters},${lat},${lon});
		  node["amenity"~"^(hotel|motel|hostel|guest_house)$"](around:${radiusMeters},${lat},${lon});
		  node["accommodation"~"^(hotel|motel|hostel|guest_house|bed_and_breakfast|apartment|resort)$"](around:${radiusMeters},${lat},${lon});
		);
		out geom;
	`;
	
	try {
		const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
		const res = await fetch(url, {
			headers: {
				'Accept': 'application/json',
				'User-Agent': 'RoadtripPlanner/1.0'
			}
		});
		if (!res.ok) {
			console.error('Overpass API error for accommodations:', res.status, res.statusText);
			return [];
		}
		
		const data = await res.json();
		const elements = data.elements || [];
		console.log(`Found ${elements.length} accommodation elements`);
		
		return elements
			.filter(element => {
				const tags = element.tags || {};
				const name = (tags.name || '').toLowerCase();
				return name && name.length > 2;
			})
			.map(element => {
				const tags = element.tags || {};
				const name = tags.name || 'Unnamed Accommodation';
				const distance = calculateDistance(lat, lon, element.lat, element.lon);
				
				return {
					name: name,
					type: tags.tourism || tags.amenity || tags.accommodation || 'accommodation',
					distance: distance,
					lat: element.lat,
					lon: element.lon,
					url: `https://www.openstreetmap.org/node/${element.id}`
				};
			})
			.sort((a, b) => a.distance - b.distance);
	} catch (error) {
		console.error('Accommodation search failed:', error);
		return [];
	}
}

function selectOptimalStops(accommodationStops, idealDailyDistance, idealDailyDuration, days) {
	const selectedStops = [];
	const totalStops = days - 1;
	
	// Sort stops by accommodation score and distance from ideal
	accommodationStops.sort((a, b) => {
		const aDistanceScore = Math.abs(a.distanceFromStart - idealDailyDistance);
		const bDistanceScore = Math.abs(b.distanceFromStart - idealDailyDistance);
		
		// Prioritize stops with more accommodations, then by distance from ideal
		if (a.accommodationScore !== b.accommodationScore) {
			return b.accommodationScore - a.accommodationScore;
		}
		return aDistanceScore - bDistanceScore;
	});
	
	// Select stops that are reasonably spaced
	for (let d = 1; d < days; d++) {
		const targetDistance = idealDailyDistance * d;
		const tolerance = idealDailyDistance * 0.4; // 40% tolerance
		
		// Find the best stop within tolerance
		const candidateStops = accommodationStops.filter(stop => 
			Math.abs(stop.distanceFromStart - targetDistance) <= tolerance &&
			!selectedStops.some(selected => 
				Math.abs(selected.distanceFromStart - stop.distanceFromStart) < idealDailyDistance * 0.2
			)
		);
		
		if (candidateStops.length > 0) {
			selectedStops.push(candidateStops[0]);
		} else {
			// Fallback: find closest available stop
			const closestStop = accommodationStops.find(stop => 
				!selectedStops.some(selected => 
					Math.abs(selected.distanceFromStart - stop.distanceFromStart) < idealDailyDistance * 0.2
				)
			);
			if (closestStop) {
				selectedStops.push(closestStop);
			}
		}
	}
	
	// Sort selected stops by distance from start
	selectedStops.sort((a, b) => a.distanceFromStart - b.distanceFromStart);
	
	return selectedStops;
}

async function computeEnhancedRouteStops(route, days, progressCallback) {
	// Enhanced fallback that looks for towns/cities along the route
	const geometry = route.geometry;
	const coordinates = geometry.coordinates;
	const totalDistance = route.distance;
	
	// Find urban areas along the route
	if (progressCallback) {
		progressCallback(60, 'Searching for urban areas along route...');
	}
	const urbanStops = await findUrbanAreasAlongRoute(coordinates, totalDistance, days, progressCallback);
	
	if (urbanStops.length >= days - 1) {
		return { stops: urbanStops, totalDistance };
	}
	
	// Final fallback: improved even spacing with location names
	if (progressCallback) {
		progressCallback(80, 'Using route-based stop selection...');
	}
	const idealDailyDistance = totalDistance / days;
	const stops = [];
	
	for (let d = 1; d < days; d++) {
		const targetDistance = idealDailyDistance * d;
		const closestPoint = findClosestPointOnRoute(coordinates, targetDistance);
		
		if (closestPoint) {
			const locationInfo = await reverseGeocode(closestPoint.lat, closestPoint.lon);
			stops.push({
				...closestPoint,
				name: locationInfo ? locationInfo.name : `Stop ${d}`,
				fullAddress: locationInfo ? locationInfo.fullAddress : null
			});
		}
		
		if (progressCallback) {
			const progress = 80 + (d / (days - 1)) * 15; // 80-95%
			progressCallback(progress, `Processing stop ${d}/${days - 1}...`);
		}
	}
	
	return { stops, totalDistance };
}

async function findUrbanAreasAlongRoute(coordinates, totalDistance, days, progressCallback) {
	const urbanStops = [];
	const sampleInterval = totalDistance / (days * 2); // Reduced sampling for better performance
	let currentDistance = 0;
	let sampleCount = 0;
	
	// Count total samples first
	let totalSamples = 0;
	for (let i = 0; i < coordinates.length - 1; i++) {
		const [lon1, lat1] = coordinates[i];
		const [lon2, lat2] = coordinates[i + 1];
		const segmentDistance = calculateDistance(lat1, lon1, lat2, lon2);
		
		if (currentDistance >= sampleInterval) {
			totalSamples++;
			currentDistance = 0;
		}
		currentDistance += segmentDistance;
	}
	
	// Reset for actual processing
	currentDistance = 0;
	
	for (let i = 0; i < coordinates.length - 1; i++) {
		const [lon1, lat1] = coordinates[i];
		const [lon2, lat2] = coordinates[i + 1];
		const segmentDistance = calculateDistance(lat1, lon1, lat2, lon2);
		
		if (currentDistance >= sampleInterval) {
			sampleCount++;
			const progress = 60 + (sampleCount / totalSamples) * 15; // 60-75%
			
			if (progressCallback) {
				progressCallback(progress, `Checking urban features at location ${sampleCount}/${totalSamples}...`);
			}
			
			try {
				// Add timeout to prevent hanging
				const urbanFeatures = await Promise.race([
					findUrbanFeatures(lat1, lon1),
					new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000))
				]);
				
				if (urbanFeatures.length > 0) {
					const locationInfo = await reverseGeocode(lat1, lon1);
					urbanStops.push({
						lat: lat1,
						lon: lon1,
						distanceFromStart: currentDistance,
						name: locationInfo ? locationInfo.name : 'Urban Area',
						fullAddress: locationInfo ? locationInfo.fullAddress : null,
						urbanScore: urbanFeatures.length
					});
				}
			} catch (error) {
				console.error('Error checking urban features:', error);
			}
			currentDistance = 0;
		}
		currentDistance += segmentDistance;
	}
	
	return urbanStops;
}

async function findUrbanFeatures(lat, lon, radiusMeters = 5000) {
	// Look for urban features like restaurants, shops, services
	const query = `
		[out:json][timeout:25];
		(
		  node["amenity"~"^(restaurant|shop|bank|pharmacy|fuel|hospital|school)$"](around:${radiusMeters},${lat},${lon});
		  node["shop"~"^.*"](around:${radiusMeters},${lat},${lon});
		  node["tourism"~"^(hotel|motel|hostel)$"](around:${radiusMeters},${lat},${lon});
		);
		out geom;
	`;
	
	try {
		const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
		const res = await fetch(url);
		if (!res.ok) return [];
		
		const data = await res.json();
		return data.elements || [];
	} catch (error) {
		console.error('Urban features search failed:', error);
		return [];
	}
}

function findClosestPointOnRoute(coordinates, targetDistance) {
	let currentDistance = 0;
	
	for (let i = 0; i < coordinates.length - 1; i++) {
		const [lon1, lat1] = coordinates[i];
		const [lon2, lat2] = coordinates[i + 1];
		const segmentDistance = calculateDistance(lat1, lon1, lat2, lon2);
		
		if (currentDistance + segmentDistance >= targetDistance) {
			// Interpolate position along this segment
			const ratio = (targetDistance - currentDistance) / segmentDistance;
			const lat = lat1 + (lat2 - lat1) * ratio;
			const lon = lon1 + (lon2 - lon1) * ratio;
			
			return {
				lat: lat,
				lon: lon,
				distanceFromStart: targetDistance,
				index: i
			};
		}
		
		currentDistance += segmentDistance;
	}
	
	return null;
}

async function findOvernightStops(route, days, config, progressCallback) {
	console.log('findOvernightStops called with:', { days, config });
	const geometry = route.geometry;
	const coordinates = geometry.coordinates;
	const totalDistance = route.distance;
	console.log('Route info:', { totalDistance, coordinatesLength: coordinates.length });
	
	// Sample points along route for accommodations
	const samplePoints = [];
	const sampleInterval = Math.max(15000, totalDistance / 15); // Sample every 15km or 15 points
	let currentDistance = 0;
	
	for (let i = 0; i < coordinates.length - 1; i++) {
		const [lon1, lat1] = coordinates[i];
		const [lon2, lat2] = coordinates[i + 1];
		const segmentDistance = calculateDistance(lat1, lon1, lat2, lon2);
		
		if (currentDistance >= sampleInterval) {
			samplePoints.push({
				lat: lat1,
				lon: lon1,
				distanceFromStart: currentDistance,
				index: i
			});
			currentDistance = 0;
		}
		currentDistance += segmentDistance;
	}
	
	// Check for accommodations with progress tracking
	const overnightStops = [];
	const maxSamples = Math.min(samplePoints.length, days * 2);
	
	for (let i = 0; i < maxSamples; i++) {
		const point = samplePoints[i];
		const progress = 20 + (i / maxSamples) * 15; // 20-35%
		
		if (progressCallback) {
			progressCallback(progress, `Checking accommodations at location ${i + 1}/${maxSamples}...`);
		}
		
		try {
			const accommodations = await Promise.race([
				findNearbyAccommodations(point.lat, point.lon, config.accommodationRadius),
				new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000))
			]);
			
			if (accommodations.length > 0) {
				const locationInfo = await reverseGeocode(point.lat, point.lon);
				overnightStops.push({
					...point,
					name: locationInfo ? locationInfo.name : 'Accommodation Available',
					fullAddress: locationInfo ? locationInfo.fullAddress : null,
					accommodations: accommodations,
					accommodationScore: accommodations.length,
					type: 'overnight'
				});
			}
		} catch (error) {
			console.error('Error checking accommodations:', error);
		}
	}
	
	console.log(`findOvernightStops returning ${overnightStops.length} stops:`, overnightStops);
	return overnightStops;
}

async function findRoadsideStops(route, config, progressCallback) {
	const geometry = route.geometry;
	const coordinates = geometry.coordinates;
	const totalDistance = route.distance;
	
	// Sample more frequently for roadside attractions
	const samplePoints = [];
	const sampleInterval = Math.max(8000, totalDistance / 30); // Sample every 8km or 30 points
	let currentDistance = 0;
	
	for (let i = 0; i < coordinates.length - 1; i++) {
		const [lon1, lat1] = coordinates[i];
		const [lon2, lat2] = coordinates[i + 1];
		const segmentDistance = calculateDistance(lat1, lon1, lat2, lon2);
		
		if (currentDistance >= sampleInterval) {
			samplePoints.push({
				lat: lat1,
				lon: lon1,
				distanceFromStart: currentDistance,
				index: i
			});
			currentDistance = 0;
		}
		currentDistance += segmentDistance;
	}
	
	// Find attractions near each sample point
	const roadsideStops = [];
	const maxSamples = Math.min(samplePoints.length, 12); // Reduced for better performance
	
	for (let i = 0; i < maxSamples; i++) {
		const point = samplePoints[i];
		const progress = 40 + (i / maxSamples) * 20; // 40-60%
		
		if (progressCallback) {
			progressCallback(progress, `Finding attractions at location ${i + 1}/${maxSamples}...`);
		}
		
		try {
			// Get user preferences for filtering
			const preferences = getUserPreferences();
			const attractions = await Promise.race([
				fetchPoisSimple(point.lat, point.lon, 20000, 4, preferences),
				new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
			]);
			
			// Filter attractions based on trip style and time constraints
			const suitableAttractions = attractions.filter(attraction => {
				const timeEstimate = ACTIVITY_TIME_ESTIMATES[attraction.category] || 1;
				return timeEstimate >= config.minActivityTime;
			});
			
			if (suitableAttractions.length > 0) {
				const locationInfo = await reverseGeocode(point.lat, point.lon);
				roadsideStops.push({
					...point,
					name: locationInfo ? locationInfo.name : 'Attractions Available',
					fullAddress: locationInfo ? locationInfo.fullAddress : null,
					attractions: suitableAttractions,
					type: 'roadside'
				});
			}
		} catch (error) {
			console.error('Error finding roadside attractions:', error);
		}
	}
	
	return roadsideStops;
}

async function createSmartItinerary(route, days, overnightStops, roadsideStops, config, progressCallback) {
	const geometry = route.geometry;
	const coordinates = geometry.coordinates;
	const totalDistance = route.distance;
	const idealDailyDistance = totalDistance / days;
	
	// Select optimal overnight stops
	const selectedOvernightStops = selectOvernightStops(overnightStops, idealDailyDistance, days);
	
	// If no overnight stops found, create basic stops along the route
	if (selectedOvernightStops.length === 0) {
		console.warn('No overnight stops found, creating basic route stops');
		const basicStops = [];
		const basicItineraryDays = [];
		
		for (let d = 1; d < days; d++) {
			const targetDistance = idealDailyDistance * d;
			const closestPoint = findClosestPointOnRoute(coordinates, targetDistance);
			if (closestPoint) {
				const locationInfo = await reverseGeocode(closestPoint.lat, closestPoint.lon);
				const basicStop = {
					...closestPoint,
					name: locationInfo ? locationInfo.name : `Stop ${d}`,
					fullAddress: locationInfo ? locationInfo.fullAddress : null,
					type: 'basic'
				};
				basicStops.push(basicStop);
				
				// Create basic itinerary day
				basicItineraryDays.push({
					day: d,
					overnightStop: basicStop,
					roadsideStops: [],
					foodOptions: [],
					totalActivityTime: 2, // Basic activity time
					drivingTime: 6,
					drivingDistance: idealDailyDistance
				});
			}
		}
		console.log(`Created ${basicStops.length} basic stops with attractions`);
		return {
			stops: basicStops,
			roadsideStops: [],
			totalDistance,
			days: basicItineraryDays
		};
	}
	
	// Plan daily segments with roadside stops
	const itineraryDays = [];
	
	for (let day = 1; day <= days; day++) {
		const progress = 70 + (day / days) * 20; // 70-90%
		
		if (progressCallback) {
			progressCallback(progress, `Planning day ${day}/${days}...`);
		}
		
		const dayStart = (day - 1) * idealDailyDistance;
		const dayEnd = day * idealDailyDistance;
		
		// Find overnight stop for this day
		const overnightStop = selectedOvernightStops.find(stop => 
			stop.distanceFromStart >= dayStart && stop.distanceFromStart <= dayEnd
		) || selectedOvernightStops[day - 1];
		
		// Find roadside stops for this day
		const dayRoadsideStops = roadsideStops.filter(stop =>
			stop.distanceFromStart >= dayStart && stop.distanceFromStart <= dayEnd
		).slice(0, config.maxRoadsideStops);
		
		// Find food options for this day
		let dayFoodOptions = [];
		if (overnightStop) {
			try {
				dayFoodOptions = await fetchRestaurants(overnightStop.lat, overnightStop.lon, 10000);
			} catch (error) {
				console.error('Error fetching food options:', error);
			}
		}
		
		// Calculate total activity time for the day
		const totalActivityTime = dayRoadsideStops.reduce((total, stop) => {
			return total + stop.attractions.reduce((stopTotal, attraction) => {
				return stopTotal + (ACTIVITY_TIME_ESTIMATES[attraction.category] || 1);
			}, 0);
		}, 0);
		
		// Check if activities fit within daily time budget
		const maxActivityTime = config.maxDailyDrivingHours * 0.6; // 60% of driving time for activities
		const feasibleRoadsideStops = totalActivityTime <= maxActivityTime ? 
			dayRoadsideStops : 
			dayRoadsideStops.slice(0, Math.floor(config.maxRoadsideStops * 0.7));
		
		// Calculate driving distance for this day
		const dayDrivingDistance = day === 1 ? 
			(overnightStop ? overnightStop.distanceFromStart : idealDailyDistance) :
			(overnightStop ? overnightStop.distanceFromStart - (selectedOvernightStops[day - 2]?.distanceFromStart || 0) : idealDailyDistance);
		
		itineraryDays.push({
			day: day,
			overnightStop: overnightStop,
			roadsideStops: feasibleRoadsideStops,
			foodOptions: dayFoodOptions,
			totalActivityTime: totalActivityTime,
			drivingTime: config.maxDailyDrivingHours,
			drivingDistance: dayDrivingDistance
		});
	}
	
	return {
		stops: selectedOvernightStops,
		roadsideStops: itineraryDays.flatMap(day => day.roadsideStops),
		days: itineraryDays
	};
}

function selectOvernightStops(overnightStops, idealDailyDistance, days) {
	console.log('selectOvernightStops called with:', {
		overnightStopsCount: overnightStops.length,
		idealDailyDistance,
		days
	});
	
	if (overnightStops.length === 0) {
		console.warn('No overnight stops provided to selectOvernightStops');
		return [];
	}
	
	// Sort by accommodation score and distance from ideal
	overnightStops.sort((a, b) => {
		const aDistanceScore = Math.abs(a.distanceFromStart - idealDailyDistance);
		const bDistanceScore = Math.abs(b.distanceFromStart - idealDailyDistance);
		
		if (a.accommodationScore !== b.accommodationScore) {
			return b.accommodationScore - a.accommodationScore;
		}
		return aDistanceScore - bDistanceScore;
	});
	
	// Select stops that are reasonably spaced
	const selectedStops = [];
	const tolerance = idealDailyDistance * 0.5; // 50% tolerance
	
	for (let d = 1; d < days; d++) {
		const targetDistance = idealDailyDistance * d;
		
		const candidateStops = overnightStops.filter(stop => 
			Math.abs(stop.distanceFromStart - targetDistance) <= tolerance &&
			!selectedStops.some(selected => 
				Math.abs(selected.distanceFromStart - stop.distanceFromStart) < idealDailyDistance * 0.3
			)
		);
		
		if (candidateStops.length > 0) {
			selectedStops.push(candidateStops[0]);
		} else {
			// Fallback: find closest available stop
			const closestStop = overnightStops.find(stop => 
				!selectedStops.some(selected => 
					Math.abs(selected.distanceFromStart - stop.distanceFromStart) < idealDailyDistance * 0.3
				)
			);
			if (closestStop) {
				selectedStops.push(closestStop);
			}
		}
	}
	
	return selectedStops.sort((a, b) => a.distanceFromStart - b.distanceFromStart);
}

async function reverseGeocode(lat, lon) {
	const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1`;
	try {
		const res = await fetch(url, {
			headers: {
				'Accept': 'application/json',
				'User-Agent': 'RoadtripPlanner/1.0'
			}
		});
		if (!res.ok) return null;
		const data = await res.json();
		if (!data || !data.display_name) return null;
		
		// Extract meaningful location name from the full address
		const address = data.address || {};
		let locationName = '';
		
		// Try to build a meaningful name from address components
		if (address.city || address.town || address.village) {
			locationName = address.city || address.town || address.village;
			if (address.state || address.county) {
				locationName += `, ${address.state || address.county}`;
			}
		} else if (address.county) {
			locationName = address.county;
			if (address.state) {
				locationName += `, ${address.state}`;
			}
		} else if (address.state) {
			locationName = address.state;
		} else {
			// Fallback to a truncated version of the full display name
			const parts = data.display_name.split(',');
			locationName = parts.slice(0, 2).join(', ').trim();
		}
		
		return {
			name: locationName || 'Unknown Location',
			fullAddress: data.display_name,
			lat: lat,
			lon: lon
		};
	} catch (error) {
		console.error('Reverse geocoding failed:', error);
		return null;
	}
}

// Simplified POI fetching that always returns results
// Removed duplicate fetchPoisSimple function - using the enhanced version below

// Create generic POIs when none are found
function createGenericPois(lat, lon) {
	const genericAttractions = [
		{
			title: 'Local Park',
			distanceMeters: 0,
			lat: lat + (Math.random() - 0.5) * 0.01,
			lon: lon + (Math.random() - 0.5) * 0.01,
			url: `https://www.google.com/maps?q=${lat},${lon}`,
			source: 'generic',
			category: 'Park'
		},
		{
			title: 'Historic Site',
			distanceMeters: 1000,
			lat: lat + (Math.random() - 0.5) * 0.01,
			lon: lon + (Math.random() - 0.5) * 0.01,
			url: `https://www.google.com/maps?q=${lat},${lon}`,
			source: 'generic',
			category: 'Historic Site'
		},
		{
			title: 'Local Restaurant',
			distanceMeters: 500,
			lat: lat + (Math.random() - 0.5) * 0.01,
			lon: lon + (Math.random() - 0.5) * 0.01,
			url: `https://www.google.com/maps?q=${lat},${lon}`,
			source: 'generic',
			category: 'Food & Drink'
		}
	];
	return genericAttractions;
}

// Create basic stops along route when no accommodations are found
async function createBasicStopsAlongRoute(route, days) {
	const geometry = route.geometry;
	const coordinates = geometry.coordinates;
	const totalDistance = route.distance;
	const idealDailyDistance = totalDistance / days;
	
	const basicStops = [];
	
	for (let d = 1; d < days; d++) {
		const targetDistance = idealDailyDistance * d;
		const closestPoint = findClosestPointOnRoute(coordinates, targetDistance);
		
		if (closestPoint) {
			try {
				const locationInfo = await reverseGeocode(closestPoint.lat, closestPoint.lon);
				basicStops.push({
					...closestPoint,
					name: locationInfo ? locationInfo.name : `Stop ${d}`,
					fullAddress: locationInfo ? locationInfo.fullAddress : null,
					type: 'basic',
					accommodations: [],
					accommodationScore: 0
				});
			} catch (error) {
				console.error('Error reverse geocoding basic stop:', error);
				basicStops.push({
					...closestPoint,
					name: `Stop ${d}`,
					fullAddress: null,
					type: 'basic',
					accommodations: [],
					accommodationScore: 0
				});
			}
		}
	}
	
	return basicStops;
}

// Get user preferences from form
function getUserPreferences() {
	const checkboxes = document.querySelectorAll('input[name="preferences"]:checked');
	return Array.from(checkboxes).map(cb => cb.value);
}

// Get trip style from form
// Removed unused getTripStyle function

// Activity time estimates (in hours)
const ACTIVITY_TIME_ESTIMATES = {
	'Museum': 2.5,
	'Zoo/Aquarium': 3,
	'Historic Site': 1.5,
	'Historic Building': 1,
	'Entertainment': 2,
	'Nature': 1,
	'Outdoor': 2,
	'Cultural': 2,
	'Food & Drink': 1.5,
	'Family': 2.5,
	'Adventure': 3,
	'Park': 1,
	'Attraction': 1.5
};

// Trip style configurations
const TRIP_STYLE_CONFIG = {
	lazy: {
		maxDailyDrivingHours: 4,
		maxRoadsideStops: 2,
		minActivityTime: 2,
		preferOvernightStops: true,
		accommodationRadius: 15000
	},
	sightseeing: {
		maxDailyDrivingHours: 6,
		maxRoadsideStops: 5,
		minActivityTime: 0.5,
		preferOvernightStops: false,
		accommodationRadius: 25000
	},
	quick: {
		maxDailyDrivingHours: 8,
		maxRoadsideStops: 1,
		minActivityTime: 1,
		preferOvernightStops: true,
		accommodationRadius: 10000
	}
};

async function fetchWikipediaAttractions(lat, lon, radiusMeters, limit) {
	const url = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}%7C${lon}&gsradius=${radiusMeters}&gslimit=${limit * 2}&format=json&origin=*`;
	try {
		const res = await fetch(url, {
			headers: {
				'Accept': 'application/json',
				'User-Agent': 'RoadtripPlanner/1.0'
			}
		});
		if (!res.ok) {
			console.error('Wikipedia API error:', res.status, res.statusText);
			return [];
		}
		const json = await res.json();
		const items = json?.query?.geosearch || [];
		console.log(`Found ${items.length} Wikipedia attractions`);
		
		return items
		.filter(item => {
			const title = item.title.toLowerCase();
			// Filter out irrelevant results
			const excludeTerms = [
				'highway', 'road', 'street', 'avenue', 'boulevard', 'interstate', 'route',
				'bridge', 'tunnel', 'exit', 'ramp', 'overpass', 'underpass',
				'airport', 'runway', 'taxiway', 'terminal',
				'power plant', 'factory', 'warehouse', 'industrial',
				'residential', 'subdivision', 'neighborhood',
				'cemetery', 'graveyard', 'memorial park'
			];
			
			// Include tourist-relevant terms
			const includeTerms = [
				'museum', 'park', 'zoo', 'aquarium', 'garden', 'botanical',
				'historic', 'monument', 'memorial', 'statue', 'plaza', 'square',
				'theater', 'theatre', 'stadium', 'arena', 'convention',
				'castle', 'palace', 'fort', 'ruins', 'archaeological',
				'beach', 'lake', 'river', 'waterfall', 'canyon', 'mountain',
				'winery', 'brewery', 'distillery', 'vineyard',
				'national park', 'state park', 'forest', 'wildlife',
				'observatory', 'planetarium', 'science center',
				'art gallery', 'cultural center', 'heritage site'
			];
			
			// Exclude if contains exclude terms
			if (excludeTerms.some(term => title.includes(term))) {
				return false;
			}
			
			// Include if contains include terms
			return includeTerms.some(term => title.includes(term));
		})
		.map(x => ({
			title: x.title,
			pageId: x.pageid,
			distanceMeters: x.dist,
			lat: x.lat,
			lon: x.lon,
			url: `https://en.wikipedia.org/?curid=${x.pageid}`,
			source: 'wikipedia',
			category: categorizePoi(x.title)
		}));
	} catch (error) {
		console.error('Wikipedia attractions fetch failed:', error);
		return [];
	}
}

async function fetchOverpassAttractions(lat, lon, radiusMeters, limit) {
	// Overpass API query for tourist attractions
	const query = `
		[out:json][timeout:25];
		(
		  node["tourism"~"^(museum|attraction|zoo|aquarium|theme_park|gallery|artwork|monument|memorial)$"](around:${radiusMeters},${lat},${lon});
		  node["amenity"~"^(museum|theatre|cinema|arts_centre|casino|nightclub|pub|bar|restaurant)$"](around:${radiusMeters},${lat},${lon});
		  node["leisure"~"^(park|garden|nature_reserve|beach_resort|sports_centre|golf_course)$"](around:${radiusMeters},${lat},${lon});
		  node["historic"~"^(castle|palace|fort|ruins|archaeological_site|monument|memorial)$"](around:${radiusMeters},${lat},${lon});
		  node["natural"~"^(beach|waterfall|cave|volcano|geyser)$"](around:${radiusMeters},${lat},${lon});
		);
		out geom;
	`;
	
	try {
		const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
		const res = await fetch(url, {
			headers: {
				'Accept': 'application/json',
				'User-Agent': 'RoadtripPlanner/1.0'
			}
		});
		if (!res.ok) {
			console.error('Overpass API error:', res.status, res.statusText);
			return [];
		}
		const data = await res.json();
		const elements = data.elements || [];
		console.log(`Found ${elements.length} Overpass attractions`);
		
		return elements
		.filter(element => {
			const tags = element.tags || {};
			const name = (tags.name || '').toLowerCase();
			
			// Filter out generic or irrelevant names
			if (!name || name.length < 3) return false;
			if (name.includes('parking') || name.includes('rest area')) return false;
			
			return true;
		})
		.map(element => {
			const tags = element.tags || {};
			const name = tags.name || 'Unnamed Attraction';
			const distance = calculateDistance(lat, lon, element.lat, element.lon);
			
			return {
				title: name,
				distanceMeters: distance,
				lat: element.lat,
				lon: element.lon,
				url: `https://www.openstreetmap.org/node/${element.id}`,
				source: 'overpass',
				category: categorizePoi(name),
				tags: tags
			};
		});
	} catch (error) {
		console.error('Overpass attractions fetch failed:', error);
		return [];
	}
}

function categorizePoi(title) {
	const titleLower = title.toLowerCase();
	
	if (titleLower.includes('museum') || titleLower.includes('gallery')) return 'Museum';
	if (titleLower.includes('park') || titleLower.includes('garden')) return 'Park';
	if (titleLower.includes('zoo') || titleLower.includes('aquarium')) return 'Zoo/Aquarium';
	if (titleLower.includes('historic') || titleLower.includes('monument') || titleLower.includes('memorial')) return 'Historic Site';
	if (titleLower.includes('theater') || titleLower.includes('theatre') || titleLower.includes('stadium')) return 'Entertainment';
	if (titleLower.includes('beach') || titleLower.includes('lake') || titleLower.includes('waterfall')) return 'Nature';
	if (titleLower.includes('winery') || titleLower.includes('brewery')) return 'Food & Drink';
	if (titleLower.includes('castle') || titleLower.includes('palace') || titleLower.includes('fort')) return 'Historic Building';
	
	return 'Attraction';
}

function calculateDistance(lat1, lon1, lat2, lon2) {
	const R = 6371000; // Earth's radius in meters
	const dLat = (lat2 - lat1) * Math.PI / 180;
	const dLon = (lon2 - lon1) * Math.PI / 180;
	const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
		Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
		Math.sin(dLon/2) * Math.sin(dLon/2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
	return R * c;
}

// Specialized POI fetching based on user preferences
// Removed unused fetchSpecializedPois function

// Removed unused specialized POI functions

// Removed unused specialized POI functions

// Removed unused specialized POI functions

// Removed unused specialized POI functions

// Enhanced food search with more specific categories
async function fetchRestaurants(lat, lon, radiusMeters = 15000) {
	const query = `
		[out:json][timeout:25];
		(
		  node["amenity"~"^(restaurant|cafe|fast_food|food_court|ice_cream)$"](around:${radiusMeters},${lat},${lon});
		  node["cuisine"~"^.*"](around:${radiusMeters},${lat},${lon});
		);
		out geom;
	`;
	
	try {
		const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
		const res = await fetch(url);
		if (!res.ok) return [];
		
		const data = await res.json();
		const elements = data.elements || [];
		
		return elements
			.filter(element => {
				const tags = element.tags || {};
				const name = (tags.name || '').toLowerCase();
				return name && name.length > 2;
			})
			.map(element => {
				const tags = element.tags || {};
				const name = tags.name || 'Restaurant';
				const distance = calculateDistance(lat, lon, element.lat, element.lon);
				
				return {
					title: name,
					distanceMeters: distance,
					lat: element.lat,
					lon: element.lon,
					url: `https://www.openstreetmap.org/node/${element.id}`,
					source: 'overpass',
					category: 'Restaurant',
					tags: tags,
					cuisine: tags.cuisine || 'Various',
					type: tags.amenity || 'restaurant'
				};
			})
			.sort((a, b) => a.distanceMeters - b.distanceMeters)
			.slice(0, 5); // Limit to 5 restaurants for better performance
	} catch (error) {
		console.error('Restaurant search failed:', error);
		return [];
	}
}

// Removed unused specialized POI functions

// Removed unused specialized POI functions

async function executeOverpassQuery(query, lat, lon, category) {
	try {
		const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
		const res = await fetch(url, {
			headers: {
				'Accept': 'application/json',
				'User-Agent': 'RoadtripPlanner/1.0'
			}
		});
		if (!res.ok) {
			console.error('Overpass API error:', res.status, res.statusText);
			return [];
		}
		const data = await res.json();
		const elements = data.elements || [];
		console.log(`Found ${elements.length} ${category} attractions`);
	
	return elements
		.filter(element => {
			const tags = element.tags || {};
			const name = (tags.name || '').toLowerCase();
			return name && name.length > 3;
		})
		.map(element => {
			const tags = element.tags || {};
			const name = tags.name || 'Unnamed Attraction';
			const distance = calculateDistance(lat, lon, element.lat, element.lon);
			
			return {
				title: name,
				distanceMeters: distance,
				lat: element.lat,
				lon: element.lon,
				url: `https://www.openstreetmap.org/node/${element.id}`,
				source: 'overpass',
				category: category,
				tags: tags,
				preferenceMatch: true
			};
		});
	} catch (error) {
		console.error(`Overpass query failed for ${category}:`, error);
		return [];
	}
}

function filterAndRankPois(pois, centerLat, centerLon, preferences = []) {
	// Remove duplicates based on title similarity
	const uniquePois = [];
	const seenTitles = new Set();
	
	pois.forEach(poi => {
		const normalizedTitle = poi.title.toLowerCase().trim();
		if (!seenTitles.has(normalizedTitle)) {
			seenTitles.add(normalizedTitle);
			uniquePois.push(poi);
		}
	});
	
	// Rank POIs by preferences, relevance, and distance
	return uniquePois.sort((a, b) => {
		// Boost POIs that match user preferences
		const aPreferenceBoost = a.preferenceMatch ? 10 : 0;
		const bPreferenceBoost = b.preferenceMatch ? 10 : 0;
		
		if (aPreferenceBoost !== bPreferenceBoost) {
			return bPreferenceBoost - aPreferenceBoost;
		}
		
		// Then prioritize by category
		const categoryPriority = {
			'Museum': 5,
			'Zoo/Aquarium': 4,
			'Historic Site': 4,
			'Historic Building': 4,
			'Entertainment': 3,
			'Nature': 3,
			'Outdoor': 4,
			'Cultural': 5,
			'Food & Drink': 3,
			'Family': 4,
			'Adventure': 3,
			'Park': 2,
			'Attraction': 1
		};
		
		const aPriority = categoryPriority[a.category] || 1;
		const bPriority = categoryPriority[b.category] || 1;
		
		if (aPriority !== bPriority) {
			return bPriority - aPriority;
		}
		
		// Finally by distance (closer is better)
		return a.distanceMeters - b.distanceMeters;
	});
}

function renderItinerary(start, end, stops, totalDistanceMeters, totalDurationSeconds, days, itineraryDays = null) {
	const formatKm = (m) => (m / 1000).toFixed(1) + ' km';
	const formatH = (s) => {
		const h = Math.floor(s / 3600);
		const m = Math.round((s % 3600) / 60);
		return `${h}h ${m}m`;
	};

	// If we have detailed itinerary days, render the enhanced version
	if (itineraryDays && itineraryDays.length > 0) {
		renderEnhancedItinerary(start, end, itineraryDays, totalDistanceMeters, totalDurationSeconds, days);
		return;
	}

	// Fallback to old itinerary rendering
	if (itineraryEl) {
		itineraryEl.innerHTML = '';
	}

	// Fallback to simple itinerary
	const liStart = document.createElement('li');
	liStart.textContent = `Start: ${start.displayName}`;
	itineraryEl.appendChild(liStart);

	stops.forEach((stop, i) => {
		const li = document.createElement('li');
		let stopText = `Day ${i + 1}: ${stop.name} (${formatKm(stop.distanceFromStartMeters)} from start)`;
		
		// Add accommodation information if available
		if (stop.accommodations && stop.accommodations.length > 0) {
			const accommodationTypes = [...new Set(stop.accommodations.map(acc => acc.type))];
			stopText += ` • ${stop.accommodations.length} accommodation${stop.accommodations.length > 1 ? 's' : ''} nearby`;
		} else if (stop.urbanScore && stop.urbanScore > 0) {
			stopText += ` • Urban area with amenities`;
		}
		
		li.textContent = stopText;
		itineraryEl.appendChild(li);
	});

	const liEnd = document.createElement('li');
	liEnd.textContent = `End: ${end.displayName}`;
	itineraryEl.appendChild(liEnd);

	const summary = document.createElement('li');
	summary.style.color = '#94a3b8';
	summary.textContent = `Total: ${formatKm(totalDistanceMeters)}, ~${formatH(totalDurationSeconds)} over ${days} day(s)`;
	itineraryEl.appendChild(summary);
}

function renderEnhancedItinerary(start, end, itineraryDays, totalDistanceMeters, totalDurationSeconds, days) {
	const formatKm = (m) => (m / 1000).toFixed(1) + ' km';
	const formatH = (s) => {
		const h = Math.floor(s / 3600);
		const m = Math.round((s % 3600) / 60);
		return `${h}h ${m}m`;
	};

	// Trip Overview Summary (in sidebar)
	renderTripOverview(start, end, itineraryDays, totalDistanceMeters, totalDurationSeconds, days);
	
	// Detailed Day-by-Day Section (below map)
	renderDetailedItinerary(start, end, itineraryDays, totalDistanceMeters, totalDurationSeconds, days);
}

function renderTripOverview(start, end, itineraryDays, totalDistanceMeters, totalDurationSeconds, days) {
	const formatKm = (m) => (m / 1000).toFixed(1) + ' km';
	const formatH = (s) => {
		const h = Math.floor(s / 3600);
		const m = Math.round((s % 3600) / 60);
		return `${h}h ${m}m`;
	};

	// Calculate totals
	const totalDrivingDistance = itineraryDays.reduce((sum, day) => sum + (day.drivingDistance || 0), 0);
	const totalActivityTime = itineraryDays.reduce((sum, day) => sum + day.totalActivityTime, 0);
	const totalOvernightStops = itineraryDays.filter(day => day.overnightStop).length;
	const totalRoadsideStops = itineraryDays.reduce((sum, day) => sum + day.roadsideStops.length, 0);

	// Trip Overview Section (for sidebar)
	const overviewEl = getElementSafely('trip-overview');
	if (!overviewEl) return;
	
	overviewEl.innerHTML = `
		<div class="overview-item">
			<span class="overview-icon">🚀</span>
			<div class="overview-content">
				<h4>Start</h4>
				<p>${start.displayName}</p>
			</div>
		</div>
		<div class="overview-item">
			<span class="overview-icon">🏁</span>
			<div class="overview-content">
				<h4>End</h4>
				<p>${end.displayName}</p>
			</div>
		</div>
		<div class="overview-stats">
			<div class="stat-item">
				<span class="stat-value">${formatKm(totalDistanceMeters)}</span>
				<span class="stat-label">Total Distance</span>
			</div>
			<div class="stat-item">
				<span class="stat-value">${formatH(totalDurationSeconds)}</span>
				<span class="stat-label">Total Time</span>
			</div>
			<div class="stat-item">
				<span class="stat-value">${days}</span>
				<span class="stat-label">Days</span>
			</div>
			<div class="stat-item">
				<span class="stat-value">${totalOvernightStops}</span>
				<span class="stat-label">Overnight Stops</span>
			</div>
			<div class="stat-item">
				<span class="stat-value">${totalRoadsideStops}</span>
				<span class="stat-label">Attractions</span>
			</div>
		</div>
	`;
}

function renderDetailedItinerary(start, end, itineraryDays, totalDistanceMeters, totalDurationSeconds, days) {
	const formatKm = (m) => (m / 1000).toFixed(1) + ' km';
	const formatH = (s) => {
		const h = Math.floor(s / 3600);
		const m = Math.round((s % 3600) / 60);
		return `${h}h ${m}m`;
	};

	// Detailed Itinerary Section (below map)
	const detailedEl = getElementSafely('detailed-itinerary');
	if (!detailedEl) return;
	
	detailedEl.innerHTML = `
		<div class="section-header">
			<h2>📅 Detailed Itinerary</h2>
			<p class="section-subtitle">Click on any day to see detailed information</p>
		</div>
	`;
	
	// Each day
	itineraryDays.forEach((dayData, index) => {
		const dayDiv = document.createElement('div');
		dayDiv.className = 'itinerary-day expandable';
		
		const dayHeader = document.createElement('div');
		dayHeader.className = 'itinerary-day-header clickable';
		dayHeader.innerHTML = `
			<span class="itinerary-day-icon">${getDayIcon(dayData.day)}</span>
			<div class="day-summary">
				<h3 class="itinerary-day-title">Day ${dayData.day}</h3>
				<p class="itinerary-day-subtitle">
					${formatKm(dayData.drivingDistance || 0)} driving • 
					${dayData.totalActivityTime.toFixed(1)}h activities • 
					${dayData.roadsideStops.length} stops
				</p>
			</div>
			<span class="expand-icon">▼</span>
		`;
		
		const dayDetails = document.createElement('div');
		dayDetails.className = 'day-details';
		dayDetails.style.display = 'none';
		
		// Accommodations section
		if (dayData.overnightStop) {
			const accommodationSection = document.createElement('div');
			accommodationSection.className = 'detail-section';
			accommodationSection.innerHTML = `
				<h4 class="detail-section-title">🏨 Overnight Stay</h4>
				<div class="detail-item overnight-stop">
					<span class="detail-icon">🏨</span>
					<div class="detail-content">
						<h5>${dayData.overnightStop.name}</h5>
						<p>${dayData.overnightStop.accommodations?.length || 0} accommodation${(dayData.overnightStop.accommodations?.length || 0) > 1 ? 's' : ''} nearby</p>
						<p class="detail-distance">${formatKm(dayData.overnightStop.distanceFromStart)} from start</p>
					</div>
				</div>
			`;
			dayDetails.appendChild(accommodationSection);
		}
		
		// Attractions section
		if (dayData.roadsideStops.length > 0) {
			const attractionsSection = document.createElement('div');
			attractionsSection.className = 'detail-section';
			attractionsSection.innerHTML = `<h4 class="detail-section-title">📍 Attractions & Activities</h4>`;
			
			dayData.roadsideStops.forEach((stop, stopIndex) => {
				const totalStopTime = stop.attractions.reduce((total, attraction) => {
					return total + (ACTIVITY_TIME_ESTIMATES[attraction.category] || 1);
				}, 0);
				
				const stopDiv = document.createElement('div');
				stopDiv.className = 'detail-item roadside-stop';
				stopDiv.innerHTML = `
					<span class="detail-icon">📍</span>
					<div class="detail-content">
						<h5>${stop.name}</h5>
						<p>${stop.attractions.length} attraction${stop.attractions.length > 1 ? 's' : ''} • ~${totalStopTime.toFixed(1)}h visit time</p>
						<p class="detail-distance">${formatKm(stop.distanceFromStart)} from start</p>
					</div>
				`;
				attractionsSection.appendChild(stopDiv);
			});
			
			dayDetails.appendChild(attractionsSection);
		}
		
		
		// Food section
		if (dayData.foodOptions && dayData.foodOptions.length > 0) {
			const foodSection = document.createElement('div');
			foodSection.className = 'detail-section';
			foodSection.innerHTML = `<h4 class="detail-section-title">🍽️ Dining Options</h4>`;
			
			dayData.foodOptions.slice(0, 3).forEach((restaurant, index) => {
				const restaurantDiv = document.createElement('div');
				restaurantDiv.className = 'detail-item food-stop';
				restaurantDiv.innerHTML = `
					<span class="detail-icon">🍽️</span>
					<div class="detail-content">
						<h5>${restaurant.title}</h5>
						<p>${restaurant.cuisine} • ${restaurant.type}</p>
						<p class="detail-distance">${formatKm(restaurant.distanceMeters)} away</p>
					</div>
				`;
				foodSection.appendChild(restaurantDiv);
			});
			
			dayDetails.appendChild(foodSection);
		}
		
		// Add click handler for expand/collapse
		dayHeader.addEventListener('click', () => {
			const isExpanded = dayDetails.style.display !== 'none';
			dayDetails.style.display = isExpanded ? 'none' : 'block';
			const expandIcon = dayHeader.querySelector('.expand-icon');
			expandIcon.textContent = isExpanded ? '▼' : '▲';
		});
		
		dayDiv.appendChild(dayHeader);
		dayDiv.appendChild(dayDetails);
		detailedEl.appendChild(dayDiv);
	});
}

function getDayIcon(day) {
	const icons = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
	return icons[day - 1] || '📅';
}

function getAttractionIcon(category) {
	const iconMap = {
		'Museum': '🏛️',
		'Park': '🌳',
		'Zoo/Aquarium': '🐾',
		'Historic Site': '🏰',
		'Historic Building': '🏛️',
		'Entertainment': '🎭',
		'Nature': '🌿',
		'Outdoor': '🏔️',
		'Cultural': '🎨',
		'Food & Drink': '🍷',
		'Family': '👨‍👩‍👧‍👦',
		'Adventure': '🎢',
		'Attraction': '📍'
	};
	return iconMap[category] || '📍';
}

function renderPoisForStops(stopPois) {
	poiListEl.innerHTML = '';
	if (!stopPois || stopPois.length === 0) return;
	stopPois.forEach((entry, i) => {
		const { stop, pois } = entry;
		const header = document.createElement('div');
		header.className = 'poi';
		const title = document.createElement('h3');
		title.textContent = `Day ${i + 1}: ${stop.name}`;
		header.appendChild(title);
		
		// Add a brief summary/description
		const summary = document.createElement('p');
		summary.className = 'stop-summary';
		summary.textContent = stop.fullAddress ? `${stop.fullAddress.split(',')[0]} - ${(stop.distanceFromStartMeters / 1000).toFixed(1)} km from start` : `${(stop.distanceFromStartMeters / 1000).toFixed(1)} km from start`;
		summary.style.color = 'var(--muted)';
		summary.style.fontSize = '13px';
		summary.style.margin = '4px 0 8px 0';
		header.appendChild(summary);
		if (!pois || pois.length === 0) {
			const p = document.createElement('p');
			p.textContent = 'No places found nearby.';
			header.appendChild(p);
			poiListEl.appendChild(header);
			return;
		}
		pois.forEach(poi => {
			const div = document.createElement('div');
			div.className = 'poi-item';
			
			// POI title with link
			const h = document.createElement('h4');
			const a = document.createElement('a');
			a.href = poi.url;
			a.target = '_blank';
			a.rel = 'noopener';
			a.textContent = poi.title;
			h.appendChild(a);
			div.appendChild(h);
			
			// Category badge
			if (poi.category) {
				const categorySpan = document.createElement('span');
				categorySpan.className = 'poi-category';
				categorySpan.textContent = poi.category;
				div.appendChild(categorySpan);
			}
			
			// Distance and source info
			const p = document.createElement('p');
			const distanceKm = (poi.distanceMeters / 1000).toFixed(1);
			const sourceText = poi.source === 'overpass' ? 'OSM' : 'Wikipedia';
			p.textContent = `${distanceKm} km away • ${sourceText}`;
			p.style.color = 'var(--muted)';
			p.style.fontSize = '12px';
			p.style.margin = '4px 0 0 0';
			div.appendChild(p);
			
			header.appendChild(div);
		});
		poiListEl.appendChild(header);
	});
}

// Autocomplete functionality
let autocompleteTimeout = null;
let currentSuggestions = [];
let selectedSuggestionIndex = -1;

async function searchLocations(query, limit = 5) {
	if (!query || query.length < 2) return [];
	
	const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=${limit}&q=${encodeURIComponent(query)}&addressdetails=1`;
	try {
		const res = await fetch(url, {
			headers: {
				'Accept': 'application/json',
				'User-Agent': 'RoadtripPlanner/1.0'
			}
		});
		if (!res.ok) return [];
		const data = await res.json();
		return data.map(place => ({
			displayName: place.display_name,
			lat: parseFloat(place.lat),
			lon: parseFloat(place.lon),
			type: place.type,
			importance: place.importance || 0
		})).sort((a, b) => b.importance - a.importance);
	} catch (error) {
		console.error('Autocomplete search failed:', error);
		return [];
	}
}

function validateLocation(location) {
	// Basic validation to ensure location is not malformed
	if (!location || !location.displayName) return false;
	
	// Check if it has reasonable coordinates
	if (isNaN(location.lat) || isNaN(location.lon)) return false;
	if (location.lat < -90 || location.lat > 90) return false;
	if (location.lon < -180 || location.lon > 180) return false;
	
	// Check if display name is not too short or contains only numbers/symbols
	if (location.displayName.length < 3) return false;
	if (/^[\d\s\-\.]+$/.test(location.displayName)) return false;
	
	return true;
}

function renderSuggestions(suggestions, container, input) {
	container.innerHTML = '';
	selectedSuggestionIndex = -1;
	
	if (suggestions.length === 0) {
		container.style.display = 'none';
		return;
	}
	
	container.style.display = 'block';
	
	suggestions.forEach((suggestion, index) => {
		const item = document.createElement('div');
		item.className = 'suggestion-item';
		item.textContent = suggestion.displayName;
		item.setAttribute('role', 'option');
		item.setAttribute('data-index', index);
		
		item.addEventListener('click', () => {
			selectSuggestion(suggestion, input, container);
		});
		
		item.addEventListener('mouseenter', () => {
			selectedSuggestionIndex = index;
			updateSuggestionHighlight(container);
		});
		
		container.appendChild(item);
	});
}

function updateSuggestionHighlight(container) {
	const items = container.querySelectorAll('.suggestion-item');
	items.forEach((item, index) => {
		if (index === selectedSuggestionIndex) {
			item.classList.add('selected');
		} else {
			item.classList.remove('selected');
		}
	});
}

function selectSuggestion(suggestion, input, container) {
	if (!validateLocation(suggestion)) {
		container.style.display = 'none';
		return;
	}
	
	input.value = suggestion.displayName;
	container.style.display = 'none';
	selectedSuggestionIndex = -1;
	
	// Store the selected location data for validation
	input.setAttribute('data-location', JSON.stringify({
		lat: suggestion.lat,
		lon: suggestion.lon,
		displayName: suggestion.displayName
	}));
}

function handleInputKeydown(event, input, container) {
	const items = container.querySelectorAll('.suggestion-item');
	
	switch (event.key) {
		case 'ArrowDown':
			event.preventDefault();
			selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, items.length - 1);
			updateSuggestionHighlight(container);
			break;
		case 'ArrowUp':
			event.preventDefault();
			selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
			updateSuggestionHighlight(container);
			break;
		case 'Enter':
			event.preventDefault();
			if (selectedSuggestionIndex >= 0 && currentSuggestions[selectedSuggestionIndex]) {
				selectSuggestion(currentSuggestions[selectedSuggestionIndex], input, container);
			}
			break;
		case 'Escape':
			container.style.display = 'none';
			selectedSuggestionIndex = -1;
			break;
	}
}

function setupAutocomplete(input, container) {
	let isProcessing = false;
	
	input.addEventListener('input', async (event) => {
		const query = event.target.value.trim();
		
		// Clear any existing timeout
		if (autocompleteTimeout) {
			clearTimeout(autocompleteTimeout);
		}
		
		// Clear stored location data when user types
		input.removeAttribute('data-location');
		
		if (query.length < 2) {
			container.style.display = 'none';
			return;
		}
		
		// Debounce the search
		autocompleteTimeout = setTimeout(async () => {
			if (isProcessing) return;
			isProcessing = true;
			
			try {
				const suggestions = await searchLocations(query);
				currentSuggestions = suggestions.filter(validateLocation);
				renderSuggestions(currentSuggestions, container, input);
			} catch (error) {
				console.error('Autocomplete error:', error);
				container.style.display = 'none';
			} finally {
				isProcessing = false;
			}
		}, 300);
	});
	
	input.addEventListener('keydown', (event) => {
		handleInputKeydown(event, input, container);
	});
	
	// Hide suggestions when clicking outside
	document.addEventListener('click', (event) => {
		if (!input.contains(event.target) && !container.contains(event.target)) {
			container.style.display = 'none';
		}
	});
}

// Initialize autocomplete for both inputs
setupAutocomplete(startInput, startSuggestions);
setupAutocomplete(endInput, endSuggestions);

async function planTrip(event) {
	event.preventDefault();
	const startText = startInput.value.trim();
	const endText = endInput.value.trim();

	if (!startText || !endText) return;

	setStatus('Geocoding start and end...');
	form.querySelector('button[type="submit"]').disabled = true;

	try {
		// Check if we have validated location data from autocomplete
		const startLocationData = startInput.getAttribute('data-location');
		const endLocationData = endInput.getAttribute('data-location');
		
		let start, end;
		
		if (startLocationData) {
			// Use validated data from autocomplete
			start = JSON.parse(startLocationData);
		} else {
			// Fallback to geocoding
			start = await geocode(startText);
		}
		
		if (endLocationData) {
			// Use validated data from autocomplete
			end = JSON.parse(endLocationData);
		} else {
			// Fallback to geocoding
			end = await geocode(endText);
		}
		
		// Validate the final locations
		if (!validateLocation(start) || !validateLocation(end)) {
			throw new Error('Invalid location data. Please select from the suggestions or enter a valid address.');
		}

		clearMap();
		addMarker(start.lat, start.lon, 'Start', '#22c55e');
		addMarker(end.lat, end.lon, 'End', '#ef4444');

		setStatus('Routing...');
		const route = await fetchRoute(start, end);
		renderRoute(route.geometry);

		const totalDuration = route.duration; // seconds
		const totalDistance = route.distance; // meters
		
		// Get user preferences and trip settings
		const tripPace = getTripPace();
		const driveTimeRange = getDriveTimeRange();
		const preferences = getUserPreferences();
		const config = TRIP_PACE_CONFIG[tripPace];
		
		// Adjust config based on user's drive time preferences
		config.maxDailyDrivingHours = Math.min(config.maxDailyDrivingHours, driveTimeRange.max);
		config.minDailyDrivingHours = Math.max(2, driveTimeRange.min);
		
		setStatus('Planning trip with your preferences...');
		showProgress();
		
		// Calculate number of days based on total duration and user preferences
		const totalHours = totalDuration / 3600;
		const idealDays = Math.ceil(totalHours / config.maxDailyDrivingHours);
		const days = Math.max(1, Math.min(idealDays, 7)); // Cap at 7 days
		
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

// Main sophisticated trip planning function
async function computeSmartTripStops(route, days, config, progressCallback) {
	const geometry = route.geometry;
	const coordinates = geometry.coordinates;
	const totalDistance = route.distance;
	const idealDailyDistance = totalDistance / days;
	const idealDailyDuration = (totalDistance / days) / 50; // Assume 50 km/h average
	
	console.log(`Planning ${days}-day trip with sophisticated logic`);
	console.log(`Ideal daily distance: ${(idealDailyDistance/1000).toFixed(1)}km`);
	
	// Step 1: Find overnight stops with accommodations
	if (progressCallback) {
		progressCallback(20, 'Finding accommodations along route...');
	}
	const overnightStops = await findOvernightStops(route, config, progressCallback);
	console.log(`Found ${overnightStops.length} potential overnight stops`);
	
	// Step 2: Find roadside stops for activities
	if (progressCallback) {
		progressCallback(40, 'Finding roadside attractions...');
	}
	const roadsideStops = await findRoadsideStops(route, config, progressCallback);
	console.log(`Found ${roadsideStops.length} roadside stops`);
	
	// Step 3: Create smart itinerary
	if (progressCallback) {
		progressCallback(60, 'Creating optimized itinerary...');
	}
	const itinerary = await createSmartItinerary(route, days, overnightStops, roadsideStops, config, progressCallback);
	
	return {
		stops: itinerary.stops,
		roadsideStops: itinerary.roadsideStops,
		totalDistance: itinerary.totalDistance,
		itinerary: itinerary.days
	};
}

// Find overnight stops with accommodations
async function findOvernightStops(route, config, progressCallback) {
	const geometry = route.geometry;
	const coordinates = geometry.coordinates;
	const totalDistance = route.distance;
	const idealDailyDistance = totalDistance / 3; // Assume 3-day trip for sampling
	
	const overnightStops = [];
	const samplePoints = 20; // Sample 20 points along the route
	
	for (let i = 1; i <= samplePoints; i++) {
		const targetDistance = (totalDistance / samplePoints) * i;
		const closestPoint = findClosestPointOnRoute(coordinates, targetDistance);
		
		if (closestPoint) {
			try {
				// Find accommodations near this point
				const accommodations = await findNearbyAccommodations(
					closestPoint.lat, 
					closestPoint.lon, 
					config.accommodationRadius
				);
				
				if (accommodations.length > 0) {
					// Get location name
					const locationInfo = await reverseGeocode(closestPoint.lat, closestPoint.lon);
					
					const stop = {
						...closestPoint,
						name: locationInfo ? locationInfo.name : `Stop ${i}`,
						fullAddress: locationInfo ? locationInfo.fullAddress : null,
						distanceFromStart: targetDistance,
						accommodations: accommodations,
						accommodationScore: accommodations.length,
						type: 'overnight'
					};
					
					overnightStops.push(stop);
				}
			} catch (error) {
				console.error('Error processing overnight stop:', error);
			}
		}
		
		if (progressCallback) {
			const progress = 20 + (i / samplePoints) * 20; // 20-40%
			progressCallback(progress, `Checking accommodations at point ${i}/${samplePoints}...`);
		}
	}
	
	return overnightStops;
}

// Select optimal overnight stops
function selectOvernightStops(overnightStops, idealDailyDistance, days) {
	const selectedStops = [];
	const totalStops = days - 1;
	
	// Sort stops by accommodation score and distance from ideal
	overnightStops.sort((a, b) => {
		const aDistanceScore = Math.abs(a.distanceFromStart - idealDailyDistance);
		const bDistanceScore = Math.abs(b.distanceFromStart - idealDailyDistance);
		
		// Prioritize stops with more accommodations, then by distance from ideal
		if (a.accommodationScore !== b.accommodationScore) {
			return b.accommodationScore - a.accommodationScore;
		}
		return aDistanceScore - bDistanceScore;
	});
	
	// Select stops that are reasonably spaced
	for (let d = 1; d < days; d++) {
		const targetDistance = idealDailyDistance * d;
		const tolerance = idealDailyDistance * 0.4; // 40% tolerance
		
		// Find the best stop within tolerance
		const candidateStops = overnightStops.filter(stop => 
			Math.abs(stop.distanceFromStart - targetDistance) <= tolerance &&
			!selectedStops.some(selected => 
				Math.abs(selected.distanceFromStart - stop.distanceFromStart) < idealDailyDistance * 0.2
			)
		);
		
		if (candidateStops.length > 0) {
			selectedStops.push(candidateStops[0]);
		} else {
			// Fallback: find closest available stop
			const closestStop = overnightStops.find(stop => 
				!selectedStops.some(selected => 
					Math.abs(selected.distanceFromStart - stop.distanceFromStart) < idealDailyDistance * 0.2
				)
			);
			if (closestStop) {
				selectedStops.push(closestStop);
			}
		}
	}
	
	// Sort selected stops by distance from start
	selectedStops.sort((a, b) => a.distanceFromStart - b.distanceFromStart);
	
	return selectedStops;
}

// Create smart itinerary with optimal stops
async function createSmartItinerary(route, days, overnightStops, roadsideStops, config, progressCallback) {
	const geometry = route.geometry;
	const coordinates = geometry.coordinates;
	const totalDistance = route.distance;
	const idealDailyDistance = totalDistance / days;
	
	// Select optimal overnight stops
	const selectedOvernightStops = selectOvernightStops(overnightStops, idealDailyDistance, days);
	
	// If no overnight stops found, create basic stops along the route
	if (selectedOvernightStops.length === 0) {
		console.warn('No overnight stops found, creating basic route stops');
		const basicStops = [];
		
		for (let d = 1; d < days; d++) {
			const targetDistance = idealDailyDistance * d;
			const closestPoint = findClosestPointOnRoute(coordinates, targetDistance);
			if (closestPoint) {
				const locationInfo = await reverseGeocode(closestPoint.lat, closestPoint.lon);
				const basicStop = {
					...closestPoint,
					name: locationInfo ? locationInfo.name : `Stop ${d}`,
					fullAddress: locationInfo ? locationInfo.fullAddress : null,
					type: 'basic',
					accommodations: [],
					accommodationScore: 0
				};
				basicStops.push(basicStop);
			}
		}
		console.log(`Created ${basicStops.length} basic stops`);
		return {
			stops: basicStops,
			roadsideStops: [],
			totalDistance,
			days: []
		};
	}
	
	console.log(`Selected ${selectedOvernightStops.length} optimal overnight stops`);
	return {
		stops: selectedOvernightStops,
		roadsideStops: roadsideStops,
		totalDistance,
		days: []
	};
}

// Find roadside stops for activities
async function findRoadsideStops(route, config, progressCallback) {
	const geometry = route.geometry;
	const coordinates = geometry.coordinates;
	const totalDistance = route.distance;
	
	const roadsideStops = [];
	const maxSamples = config.maxRoadsideStops * 3; // Sample more points than needed
	
	for (let i = 0; i < maxSamples; i++) {
		const targetDistance = (totalDistance / maxSamples) * i;
		const closestPoint = findClosestPointOnRoute(coordinates, targetDistance);
		
		if (closestPoint) {
			try {
				// Find POIs near this point
				const pois = await fetchPoisSimple(
					closestPoint.lat, 
					closestPoint.lon, 
					config.poiRadius, 
					3 // Just check if there are any POIs
				);
				
				if (pois.length > 0) {
					const locationInfo = await reverseGeocode(closestPoint.lat, closestPoint.lon);
					
					const stop = {
						...closestPoint,
						name: locationInfo ? locationInfo.name : `Activity Stop ${i}`,
						fullAddress: locationInfo ? locationInfo.fullAddress : null,
						distanceFromStart: targetDistance,
						pois: pois,
						type: 'roadside'
					};
					
					roadsideStops.push(stop);
				}
			} catch (error) {
				console.error('Error processing roadside stop:', error);
			}
		}
		
		if (progressCallback) {
			const progress = 40 + (i / maxSamples) * 20; // 40-60%
			progressCallback(progress, `Finding roadside attractions at point ${i}/${maxSamples}...`);
		}
	}
	
	return roadsideStops;
}

// Get trip pace from form
function getTripPace() {
	const selectedPace = document.querySelector('input[name="tripPace"]:checked');
	return selectedPace ? selectedPace.value : 'fast';
}

// Get drive time range from form
function getDriveTimeRange() {
	const minDriveTime = parseFloat(document.getElementById('minDriveTime').value) || 4;
	const maxDriveTime = parseFloat(document.getElementById('maxDriveTime').value) || 8;
	return { min: minDriveTime, max: maxDriveTime };
}

// Get user preferences from form
function getUserPreferences() {
	const checkboxes = document.querySelectorAll('input[name="preferences"]:checked');
	return Array.from(checkboxes).map(cb => cb.value);
}

// Trip pace configurations
const TRIP_PACE_CONFIG = {
	fast: {
		maxDailyDrivingHours: 8,
		maxRoadsideStops: 1,
		minActivityTime: 1,
		preferOvernightStops: true,
		accommodationRadius: 10000,
		poiRadius: 15000,
		maxPoisPerStop: 3
	},
	balanced: {
		maxDailyDrivingHours: 6,
		maxRoadsideStops: 3,
		minActivityTime: 1.5,
		preferOvernightStops: true,
		accommodationRadius: 15000,
		poiRadius: 25000,
		maxPoisPerStop: 5
	},
	explore: {
		maxDailyDrivingHours: 4,
		maxRoadsideStops: 5,
		minActivityTime: 2,
		preferOvernightStops: false,
		accommodationRadius: 20000,
		poiRadius: 30000,
		maxPoisPerStop: 8
	}
};

// Fetch accommodations using Overpass API
async function fetchAccommodations(lat, lon, radiusMeters = 10000, limit = 5) {
	console.log(`Fetching accommodations for ${lat}, ${lon}`);
	
	const query = `
		[out:json][timeout:25];
		(
		  node["tourism"="hotel"](around:${radiusMeters},${lat},${lon});
		  node["tourism"="guest_house"](around:${radiusMeters},${lat},${lon});
		  node["tourism"="hostel"](around:${radiusMeters},${lat},${lon});
		  node["tourism"="motel"](around:${radiusMeters},${lat},${lon});
		  node["tourism"="bed_and_breakfast"](around:${radiusMeters},${lat},${lon});
		  node["tourism"="apartment"](around:${radiusMeters},${lat},${lon});
		  node["tourism"="resort"](around:${radiusMeters},${lat},${lon});
		  node["amenity"="hotel"](around:${radiusMeters},${lat},${lon});
		);
		out center meta;
	`;
	
	try {
		const response = await executeOverpassQuery(query);
		const accommodations = response.elements.map(element => {
			const tags = element.tags || {};
			const name = tags.name || tags['name:en'] || 'Unnamed Accommodation';
			const type = tags.tourism || tags.amenity || 'hotel';
			
			// Calculate distance
			const distanceMeters = calculateDistance(lat, lon, element.lat, element.lon);
			
			return {
				title: name,
				category: getAccommodationCategory(type),
				lat: element.lat,
				lon: element.lon,
				distanceMeters: distanceMeters,
				url: `https://www.google.com/maps?q=${element.lat},${element.lon}`,
				source: 'overpass',
				type: type,
				stars: tags.stars ? parseInt(tags.stars) : null,
				phone: tags.phone || null,
				website: tags.website || null
			};
		}).filter(acc => acc.title !== 'Unnamed Accommodation');
		
		console.log(`Found ${accommodations.length} accommodations`);
		return accommodations.slice(0, limit);
	} catch (error) {
		console.error('Error fetching accommodations:', error);
		return [];
	}
}

// Get accommodation category from type
function getAccommodationCategory(type) {
	const categoryMap = {
		'hotel': 'Hotel',
		'guest_house': 'Guest House',
		'hostel': 'Hostel',
		'motel': 'Motel',
		'bed_and_breakfast': 'B&B',
		'apartment': 'Apartment',
		'resort': 'Resort'
	};
	return categoryMap[type] || 'Accommodation';
}

// Enhanced POI fetching with guaranteed results within 10 miles
async function fetchPoisSimple(lat, lon, radiusMeters = 50000, limit = 12, preferences = []) {
	console.log(`Enhanced POI fetch for ${lat}, ${lon} with radius ${radiusMeters}m (${(radiusMeters/1000).toFixed(1)}km)`);
	const pois = [];
	
	// Start with 10 miles (16km) radius
	const targetRadius = 16000; // 10 miles in meters
	const searchRadii = [targetRadius, targetRadius * 2, targetRadius * 3]; // Try expanding radius if needed
	
	for (const searchRadius of searchRadii) {
		console.log(`Searching within ${(searchRadius/1000).toFixed(1)}km radius...`);
		
		// Try Wikipedia first (most reliable)
		try {
			const wikiPois = await fetchWikipediaAttractions(lat, lon, searchRadius, limit);
			if (wikiPois.length > 0) {
				pois.push(...wikiPois);
				console.log(`Wikipedia: ${wikiPois.length} POIs found`);
			}
		} catch (error) {
			console.error('Wikipedia failed:', error);
		}
		
		// Try Overpass API
		try {
			const overpassPois = await fetchOverpassAttractions(lat, lon, searchRadius, limit);
			if (overpassPois.length > 0) {
				pois.push(...overpassPois);
				console.log(`Overpass: ${overpassPois.length} POIs found`);
			}
		} catch (error) {
			console.error('Overpass failed:', error);
		}
		
		// If we found POIs, break out of the loop
		if (pois.length > 0) {
			console.log(`Found ${pois.length} POIs within ${(searchRadius/1000).toFixed(1)}km`);
			break;
		}
	}
	
	// If still no POIs, create some generic ones based on location
	if (pois.length === 0) {
		console.log('No POIs found in any radius, creating generic attractions');
		const genericPois = createGenericPois(lat, lon);
		pois.push(...genericPois);
	}
	
	// Filter by preferences if specified
	let filteredPois = pois;
	if (preferences.length > 0) {
		filteredPois = pois.filter(poi => {
			const category = poi.category.toLowerCase();
			return preferences.some(pref => {
				switch (pref) {
					case 'outdoor': return category.includes('park') || category.includes('nature') || category.includes('outdoor');
					case 'cultural': return category.includes('museum') || category.includes('historic') || category.includes('cultural');
					case 'entertainment': return category.includes('entertainment') || category.includes('theater');
					case 'food': return category.includes('food') || category.includes('restaurant');
					case 'family': return category.includes('family') || category.includes('zoo') || category.includes('aquarium');
					case 'adventure': return category.includes('adventure') || category.includes('sports');
					default: return true;
				}
			});
		});
		
		// If filtering removed all POIs, use unfiltered results
		if (filteredPois.length === 0) {
			console.log('Preferences filtered out all POIs, using unfiltered results');
			filteredPois = pois;
		}
	}
	
	// Remove duplicates and return
	const uniquePois = removeDuplicatePois(filteredPois);
	console.log(`Final POIs: ${uniquePois.length} (within ${(targetRadius/1000).toFixed(1)}km)`);
	return uniquePois.slice(0, limit);
}

// Create generic POIs when none are found
// Removed duplicate createGenericPois function - using the enhanced version below

// Remove duplicate POIs based on title similarity
function removeDuplicatePois(pois) {
	const seen = new Set();
	return pois.filter(poi => {
		const key = poi.title.toLowerCase().trim();
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

// Create stops along route based on trip configuration
function createStopsAlongRoute(route, days, config) {
	const geometry = route.geometry;
	const coordinates = geometry.coordinates;
	const totalDistance = route.distance;
	const idealDailyDistance = totalDistance / days;
	
	const stops = [];
	
	for (let d = 1; d < days; d++) {
		const targetDistance = idealDailyDistance * d;
		const closestPoint = findClosestPointOnRoute(coordinates, targetDistance);
		
		if (closestPoint) {
			// Try to get location name
			reverseGeocode(closestPoint.lat, closestPoint.lon).then(locationInfo => {
				closestPoint.name = locationInfo ? locationInfo.name : `Stop ${d}`;
			}).catch(() => {
				closestPoint.name = `Stop ${d}`;
			});
			
			stops.push({
				...closestPoint,
				name: `Stop ${d}`, // Will be updated by reverse geocoding
				type: 'stop',
				day: d
			});
		}
	}
	
	return stops;
}

// Render trip results
function renderTripResults(start, end, stops, poisPerStop, totalDistance, totalDuration, days, tripPace) {
	const formatKm = (m) => (m / 1000).toFixed(1) + ' km';
	const formatH = (s) => {
		const h = Math.floor(s / 3600);
		const m = Math.round((s % 3600) / 60);
		return `${h}h ${m}m`;
	};
	
	// Clear existing content in sidebar
	const tripOverviewEl = document.getElementById('trip-overview');
	if (tripOverviewEl) {
		tripOverviewEl.innerHTML = '';
	}
	
	// Create trip overview
	const overview = document.createElement('div');
	overview.className = 'trip-overview';
	overview.innerHTML = `
		<h3>Trip Overview</h3>
		<p><strong>From:</strong> ${start.displayName}</p>
		<p><strong>To:</strong> ${end.displayName}</p>
		<p><strong>Distance:</strong> ${formatKm(totalDistance)}</p>
		<p><strong>Duration:</strong> ${formatH(totalDuration)}</p>
		<p><strong>Days:</strong> ${days}</p>
		<p><strong>Pace:</strong> ${tripPace.charAt(0).toUpperCase() + tripPace.slice(1)}</p>
		<p><strong>Stops:</strong> ${stops.length}</p>
	`;
	
	if (tripOverviewEl) {
		tripOverviewEl.appendChild(overview);
	}
	
	// Render POIs for stops
	renderPoisForStops(poisPerStop);
}

// Removed duplicate renderPoisForStops function - using the original one above

// Format distance in meters to readable string
function formatDistance(meters) {
	if (meters < 1000) {
		return `${Math.round(meters)}m`;
	} else {
		return `${(meters / 1000).toFixed(1)}km`;
	}
}

// Get accommodation icon based on category
function getAccommodationIcon(category) {
	const iconMap = {
		'Hotel': '🏨',
		'Guest House': '🏠',
		'Hostel': '🛏️',
		'Motel': '🚗',
		'B&B': '🍳',
		'Apartment': '🏢',
		'Resort': '🏖️',
		'Accommodation': '🏨'
	};
	return iconMap[category] || '🏨';
}

// Get attraction icon based on category
function getAttractionIcon(category) {
	const iconMap = {
		'Museum': '🏛️',
		'Park': '🌳',
		'Zoo/Aquarium': '🐾',
		'Historic Site': '🏰',
		'Historic Building': '🏛️',
		'Entertainment': '🎭',
		'Nature': '🌿',
		'Outdoor': '🏔️',
		'Cultural': '🎨',
		'Food & Drink': '🍷',
		'Family': '👨‍👩‍👧‍👦',
		'Adventure': '🎢',
		'Attraction': '📍'
	};
	return iconMap[category] || '📍';
}

form.addEventListener('submit', planTrip);