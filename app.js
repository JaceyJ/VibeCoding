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
	const tripStyle = getTripStyle();
	const config = TRIP_STYLE_CONFIG[tripStyle];
	
	if (progressCallback) {
		progressCallback(10, `Planning ${tripStyle} trip with ${days} days...`);
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
	const geometry = route.geometry;
	const coordinates = geometry.coordinates;
	const totalDistance = route.distance;
	
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
	const maxSamples = Math.min(samplePoints.length, 20); // Limit for performance
	
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
				fetchPois(point.lat, point.lon, 20000, 8, preferences),
				new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 6000))
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
	const totalDistance = route.distance;
	const idealDailyDistance = totalDistance / days;
	
	// Select optimal overnight stops
	const selectedOvernightStops = selectOvernightStops(overnightStops, idealDailyDistance, days);
	
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
	if (overnightStops.length === 0) return [];
	
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

// Enhanced POI fetching with preference-based filtering
async function fetchPois(lat, lon, radiusMeters = 50000, limit = 12, preferences = []) {
	const pois = [];
	
	// 1. Wikipedia attractions (filtered for relevance)
	try {
		const wikiPois = await fetchWikipediaAttractions(lat, lon, radiusMeters, Math.min(limit, 8));
		pois.push(...wikiPois);
	} catch (error) {
		console.error('Wikipedia POI fetch failed:', error);
	}
	
	// 2. Overpass API for tourist attractions, museums, parks, etc.
	try {
		const overpassPois = await fetchOverpassAttractions(lat, lon, radiusMeters, Math.min(limit, 8));
		pois.push(...overpassPois);
	} catch (error) {
		console.error('Overpass POI fetch failed:', error);
	}
	
	// 3. Specialized API calls based on preferences
	if (preferences.length > 0) {
		try {
			const specializedPois = await fetchSpecializedPois(lat, lon, radiusMeters, preferences, Math.min(limit, 6));
			pois.push(...specializedPois);
		} catch (error) {
			console.error('Specialized POI fetch failed:', error);
		}
	}
	
	// 4. Filter, deduplicate, and rank POIs based on preferences
	const filteredPois = filterAndRankPois(pois, lat, lon, preferences);
	
	return filteredPois.slice(0, limit);
}

// Get user preferences from form
function getUserPreferences() {
	const checkboxes = document.querySelectorAll('input[name="preferences"]:checked');
	return Array.from(checkboxes).map(cb => cb.value);
}

// Get trip style from form
function getTripStyle() {
	const selectedStyle = document.querySelector('input[name="tripStyle"]:checked');
	return selectedStyle ? selectedStyle.value : 'lazy';
}

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
	const res = await fetch(url);
	if (!res.ok) return [];
	const json = await res.json();
	const items = json?.query?.geosearch || [];
	
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
	
	const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
	const res = await fetch(url);
	if (!res.ok) return [];
	const data = await res.json();
	const elements = data.elements || [];
	
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
async function fetchSpecializedPois(lat, lon, radiusMeters, preferences, limit) {
	const specializedPois = [];
	
	for (const preference of preferences) {
		try {
			let pois = [];
			
			switch (preference) {
				case 'outdoor':
					pois = await fetchOutdoorActivities(lat, lon, radiusMeters);
					break;
				case 'cultural':
					pois = await fetchCulturalSites(lat, lon, radiusMeters);
					break;
				case 'entertainment':
					pois = await fetchEntertainmentVenues(lat, lon, radiusMeters);
					break;
				case 'food':
					pois = await fetchFoodAndDrink(lat, lon, radiusMeters);
					break;
				case 'family':
					pois = await fetchFamilyActivities(lat, lon, radiusMeters);
					break;
				case 'adventure':
					pois = await fetchAdventureActivities(lat, lon, radiusMeters);
					break;
			}
			
			specializedPois.push(...pois);
		} catch (error) {
			console.error(`Failed to fetch ${preference} POIs:`, error);
		}
	}
	
	return specializedPois;
}

async function fetchOutdoorActivities(lat, lon, radiusMeters) {
	// Enhanced Overpass query for outdoor activities
	const query = `
		[out:json][timeout:25];
		(
		  node["leisure"~"^(park|nature_reserve|beach_resort|golf_course|sports_centre|fitness_centre)$"](around:${radiusMeters},${lat},${lon});
		  node["natural"~"^(beach|waterfall|cave|volcano|geyser|peak|cliff)$"](around:${radiusMeters},${lat},${lon});
		  node["tourism"~"^(viewpoint|camp_site|picnic_site)$"](around:${radiusMeters},${lat},${lon});
		  way["leisure"~"^(park|nature_reserve|golf_course)$"](around:${radiusMeters},${lat},${lon});
		);
		out geom;
	`;
	
	return await executeOverpassQuery(query, lat, lon, 'Outdoor');
}

async function fetchCulturalSites(lat, lon, radiusMeters) {
	const query = `
		[out:json][timeout:25];
		(
		  node["tourism"~"^(museum|gallery|artwork|monument|memorial)$"](around:${radiusMeters},${lat},${lon});
		  node["amenity"~"^(museum|arts_centre|theatre|cinema)$"](around:${radiusMeters},${lat},${lon});
		  node["historic"~"^(castle|palace|fort|ruins|archaeological_site|monument|memorial|tower)$"](around:${radiusMeters},${lat},${lon});
		);
		out geom;
	`;
	
	return await executeOverpassQuery(query, lat, lon, 'Cultural');
}

async function fetchEntertainmentVenues(lat, lon, radiusMeters) {
	const query = `
		[out:json][timeout:25];
		(
		  node["amenity"~"^(theatre|cinema|nightclub|casino|pub|bar)$"](around:${radiusMeters},${lat},${lon});
		  node["leisure"~"^(sports_centre|stadium|bowling_alley|amusement_arcade)$"](around:${radiusMeters},${lat},${lon});
		  node["tourism"~"^(attraction|theme_park)$"](around:${radiusMeters},${lat},${lon});
		);
		out geom;
	`;
	
	return await executeOverpassQuery(query, lat, lon, 'Entertainment');
}

async function fetchFoodAndDrink(lat, lon, radiusMeters) {
	const query = `
		[out:json][timeout:25];
		(
		  node["craft"~"^(winery|brewery|distillery)$"](around:${radiusMeters},${lat},${lon});
		  node["amenity"~"^(restaurant|pub|bar|cafe|fast_food|food_court|ice_cream)$"](around:${radiusMeters},${lat},${lon});
		  node["tourism"~"^(vineyard)$"](around:${radiusMeters},${lat},${lon});
		  node["cuisine"~"^.*"](around:${radiusMeters},${lat},${lon});
		);
		out geom;
	`;
	
	return await executeOverpassQuery(query, lat, lon, 'Food & Drink');
}

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
			.slice(0, 8); // Limit to 8 restaurants
	} catch (error) {
		console.error('Restaurant search failed:', error);
		return [];
	}
}

async function fetchFamilyActivities(lat, lon, radiusMeters) {
	const query = `
		[out:json][timeout:25];
		(
		  node["tourism"~"^(zoo|aquarium|theme_park)$"](around:${radiusMeters},${lat},${lon});
		  node["leisure"~"^(park|playground|sports_centre)$"](around:${radiusMeters},${lat},${lon});
		  node["amenity"~"^(cinema|theatre)$"](around:${radiusMeters},${lat},${lon});
		);
		out geom;
	`;
	
	return await executeOverpassQuery(query, lat, lon, 'Family');
}

async function fetchAdventureActivities(lat, lon, radiusMeters) {
	const query = `
		[out:json][timeout:25];
		(
		  node["leisure"~"^(sports_centre|stadium|golf_course|fitness_centre)$"](around:${radiusMeters},${lat},${lon});
		  node["tourism"~"^(attraction|adventure)$"](around:${radiusMeters},${lat},${lon});
		  node["natural"~"^(cliff|peak|cave)$"](around:${radiusMeters},${lat},${lon});
		);
		out geom;
	`;
	
	return await executeOverpassQuery(query, lat, lon, 'Adventure');
}

async function executeOverpassQuery(query, lat, lon, category) {
	const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
	const res = await fetch(url);
	if (!res.ok) return [];
	const data = await res.json();
	const elements = data.elements || [];
	
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
	itineraryEl.innerHTML = '';
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

	// Trip Overview Summary
	renderTripOverview(start, end, itineraryDays, totalDistanceMeters, totalDurationSeconds, days);
	
	// Detailed Day-by-Day Section
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

	// Trip Overview Section
	const overviewDiv = document.createElement('div');
	overviewDiv.className = 'itinerary-section';
	overviewDiv.innerHTML = `
		<div class="section-header">
			<h2>🗺️ Trip Overview</h2>
		</div>
		<div class="trip-overview">
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
		</div>
	`;
	itineraryEl.appendChild(overviewDiv);
}

function renderDetailedItinerary(start, end, itineraryDays, totalDistanceMeters, totalDurationSeconds, days) {
	const formatKm = (m) => (m / 1000).toFixed(1) + ' km';
	const formatH = (s) => {
		const h = Math.floor(s / 3600);
		const m = Math.round((s % 3600) / 60);
		return `${h}h ${m}m`;
	};

	// Detailed Itinerary Section
	const detailedDiv = document.createElement('div');
	detailedDiv.className = 'itinerary-section';
	detailedDiv.innerHTML = `
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
			
			dayData.foodOptions.slice(0, 5).forEach((restaurant, index) => {
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
		detailedDiv.appendChild(dayDiv);
	});
	
	itineraryEl.appendChild(detailedDiv);
}

function getDayIcon(day) {
	const icons = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
	return icons[day - 1] || '📅';
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
	const days = Math.max(1, Math.min(30, parseInt(daysInput.value, 10) || 1));

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
		setStatus('Finding optimal stop locations with accommodations...');
		showProgress();
		
		const result = await computeStopsByDistance(route, days, (progress, text) => {
			updateProgress(progress, text);
		});
		
		// Add markers for overnight stops
		if (result.stops) {
			result.stops.forEach((stop, i) => addMarker(stop.lat, stop.lon, `Day ${i + 1}: ${stop.name}`, '#f59e0b'));
		}
		
		// Add markers for roadside stops
		if (result.roadsideStops) {
			result.roadsideStops.forEach((stop, i) => addMarker(stop.lat, stop.lon, `Stop: ${stop.name}`, '#38bdf8'));
		}

		renderItinerary(start, end, result.stops, result.totalDistance, totalDuration, days, result.itinerary);

		// Get user preferences
		const preferences = getUserPreferences();
		const preferenceText = preferences.length > 0 ? ` based on your preferences (${preferences.join(', ')})` : '';
		
		setStatus(`Finding personalized attractions and activities near each stop${preferenceText}...`);
		updateProgress(95, 'Finding attractions and activities...');
		
		const poisPerStop = await Promise.all(stops.map(async (stop, index) => {
			try {
				const pois = await fetchPois(stop.lat, stop.lon, 50000, 12, preferences);
				const progress = 95 + ((index + 1) / stops.length) * 4; // 95-99%
				updateProgress(progress, `Finding activities for stop ${index + 1}/${stops.length}...`);
				return { stop, pois };
			} catch (e) {
				return { stop, pois: [] };
			}
		}));
		
		renderPoisForStops(poisPerStop);
		updateProgress(100, 'Complete!');
		setStatus('Done.');
		
		// Hide progress bar after a short delay
		setTimeout(() => {
			hideProgress();
		}, 2000);
	} catch (err) {
		console.error(err);
		setStatus(err.message || 'Something went wrong. Try different inputs.');
		hideProgress();
	} finally {
		form.querySelector('button[type="submit"]').disabled = false;
	}
}

form.addEventListener('submit', planTrip);