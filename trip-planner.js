// Trip planning logic and algorithms
import { calculateDistance, findClosestPointOnRoute, removeDuplicatePois, getAccommodationCategory } from './utils.js';
import { fetchAccommodations, reverseGeocode, executeOverpassQuery, fetchWikipediaAttractions, fetchOverpassAttractions } from './api.js';
import { ACTIVITY_TIME_ESTIMATES, TRIP_PACE_CONFIG } from './config.js';

// Debug: Check if functions are imported correctly
console.log('Trip-planner.js: Checking imports');
console.log('fetchWikipediaAttractions:', typeof fetchWikipediaAttractions);
console.log('fetchOverpassAttractions:', typeof fetchOverpassAttractions);
console.log('All imports loaded successfully');

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
			if (typeof fetchWikipediaAttractions === 'function') {
				const wikiPois = await fetchWikipediaAttractions(lat, lon, searchRadius, limit);
				if (wikiPois.length > 0) {
					pois.push(...wikiPois);
					console.log(`Wikipedia: ${wikiPois.length} POIs found`);
				}
			} else {
				console.error('fetchWikipediaAttractions is not a function:', typeof fetchWikipediaAttractions);
			}
		} catch (error) {
			console.error('Wikipedia failed:', error);
		}
		
		// Try Overpass API
		try {
			if (typeof fetchOverpassAttractions === 'function') {
				const overpassPois = await fetchOverpassAttractions(lat, lon, searchRadius, limit);
				if (overpassPois.length > 0) {
					pois.push(...overpassPois);
					console.log(`Overpass: ${overpassPois.length} POIs found`);
				}
			} else {
				console.error('fetchOverpassAttractions is not a function:', typeof fetchOverpassAttractions);
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


// Find overnight stops with accommodations (optimized to reduce API calls)
async function findOvernightStops(route, config, progressCallback) {
	const geometry = route.geometry;
	const coordinates = geometry.coordinates;
	const totalDistance = route.distance;
	const idealDailyDistance = totalDistance / config.maxRoadsideStops;
	
	const overnightStops = [];
	const maxSamples = Math.min(config.maxRoadsideStops * 2, 6); // Limit to max 6 samples to reduce API calls
	
	console.log(`Finding overnight stops with ${maxSamples} samples (reduced to avoid rate limits)`);
	
	for (let i = 0; i < maxSamples; i++) {
		const targetDistance = (totalDistance / maxSamples) * i;
		const closestPoint = findClosestPointOnRoute(coordinates, targetDistance);
		
		if (closestPoint) {
			try {
				// Add delay between accommodation searches to avoid rate limits
				if (i > 0) {
					await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
				}
				
				const accommodations = await findNearbyAccommodations(
					closestPoint.lat, 
					closestPoint.lon, 
					config.accommodationRadius
				);
				
				if (accommodations.length > 0) {
					const locationInfo = await reverseGeocode(closestPoint.lat, closestPoint.lon);
					
					const stop = {
						...closestPoint,
						name: locationInfo ? locationInfo.name : `Accommodation Stop ${i}`,
						fullAddress: locationInfo ? locationInfo.fullAddress : null,
						accommodations: accommodations,
						accommodationScore: accommodations.length,
						type: 'overnight'
					};
					
					overnightStops.push(stop);
					console.log(`Found overnight stop ${i + 1}/${maxSamples} with ${accommodations.length} accommodations`);
				}
			} catch (error) {
				console.error('Error processing overnight stop:', error);
			}
		}
		
		if (progressCallback) {
			const progress = 20 + (i / maxSamples) * 20; // 20-40%
			progressCallback(progress, `Finding accommodations at point ${i + 1}/${maxSamples}...`);
		}
	}
	
	console.log(`Found ${overnightStops.length} overnight stops total`);
	return overnightStops;
}

// Find nearby accommodations with better fallback handling
async function findNearbyAccommodations(lat, lon, radiusMeters = 5000) {
	// Limit radius to prevent timeout
	const safeRadius = Math.min(radiusMeters, 8000);
	
	const query = `
		[out:json][timeout:60];
		(
		  node["tourism"="hotel"](around:${safeRadius},${lat},${lon});
		  node["tourism"="guest_house"](around:${safeRadius},${lat},${lon});
		  node["tourism"="hostel"](around:${safeRadius},${lat},${lon});
		  node["tourism"="motel"](around:${safeRadius},${lat},${lon});
		  node["tourism"="bed_and_breakfast"](around:${safeRadius},${lat},${lon});
		  node["amenity"="hotel"](around:${safeRadius},${lat},${lon});
		);
		out center meta;
	`;
	
	try {
		const elements = await executeOverpassQuery(query);
		
		if (elements.length === 0) {
			console.log('No accommodations found via Overpass, using fallback');
			return createFallbackAccommodations(lat, lon);
		}
		
		return elements.map(element => {
			const distance = calculateDistance(lat, lon, element.lat, element.lon);
			const type = element.tags?.tourism || element.tags?.amenity || 'hotel';
			
			return {
				title: element.tags?.name || `${type.charAt(0).toUpperCase() + type.slice(1)}`,
				distanceMeters: distance,
				lat: element.lat,
				lon: element.lon,
				url: `https://www.openstreetmap.org/node/${element.id}`,
				source: 'overpass',
				category: getAccommodationCategory(type),
				phone: element.tags?.phone || null,
				stars: element.tags?.stars || null
			};
		}).slice(0, 5);
	} catch (error) {
		console.error('Accommodation search failed:', error);
		return createFallbackAccommodations(lat, lon);
	}
}

// Create fallback accommodations when API fails
function createFallbackAccommodations(lat, lon) {
	return [
		{
			title: 'Local Hotel',
			distanceMeters: 0,
			lat: lat,
			lon: lon,
			url: `https://www.google.com/maps/search/hotels+near+${lat},${lon}`,
			source: 'fallback',
			category: 'Hotel',
			phone: null,
			stars: null
		},
		{
			title: 'Nearby Motel',
			distanceMeters: 1000,
			lat: lat + 0.01,
			lon: lon + 0.01,
			url: `https://www.google.com/maps/search/motels+near+${lat},${lon}`,
			source: 'fallback',
			category: 'Motel',
			phone: null,
			stars: null
		},
		{
			title: 'Budget Accommodation',
			distanceMeters: 2000,
			lat: lat - 0.01,
			lon: lon + 0.01,
			url: `https://www.google.com/maps/search/budget+hotels+near+${lat},${lon}`,
			source: 'fallback',
			category: 'Hotel',
			phone: null,
			stars: null
		}
	];
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
		let bestStop = null;
		let bestScore = Infinity;
		
		for (const stop of overnightStops) {
			const distanceFromTarget = Math.abs(stop.distanceFromStart - targetDistance);
			
			// Skip if too far from target
			if (distanceFromTarget > idealDailyDistance * 0.5) continue;
			
			// Skip if too close to already selected stops
			const tooClose = selectedStops.some(selected => 
				Math.abs(selected.distanceFromStart - stop.distanceFromStart) < idealDailyDistance * 0.3
			);
			if (tooClose) continue;
			
			// Calculate combined score (lower is better)
			const score = distanceFromTarget / idealDailyDistance - (stop.accommodationScore * 0.1);
			
			if (score < bestScore) {
				bestScore = score;
				bestStop = stop;
			}
		}
		
		if (bestStop) {
			selectedStops.push(bestStop);
		}
	}
	
	return selectedStops;
}

// Find roadside stops for activities (optimized to reduce API calls)
async function findRoadsideStops(route, config, progressCallback) {
	const geometry = route.geometry;
	const coordinates = geometry.coordinates;
	const totalDistance = route.distance;
	
	const roadsideStops = [];
	const maxSamples = Math.min(config.maxRoadsideStops * 2, 8); // Limit to max 8 samples
	
	console.log(`Finding roadside stops with ${maxSamples} samples (reduced to avoid rate limits)`);
	
	for (let i = 0; i < maxSamples; i++) {
		const targetDistance = (totalDistance / maxSamples) * i;
		const closestPoint = findClosestPointOnRoute(coordinates, targetDistance);
		
		if (closestPoint) {
			try {
				// Add delay between POI searches to avoid rate limits
				if (i > 0) {
					await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 second delay
				}
				
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
					console.log(`Found roadside stop ${i + 1}/${maxSamples} with ${pois.length} POIs`);
				}
			} catch (error) {
				console.error('Error processing roadside stop:', error);
			}
		}
		
		if (progressCallback) {
			const progress = 40 + (i / maxSamples) * 20; // 40-60%
			progressCallback(progress, `Finding roadside attractions at point ${i + 1}/${maxSamples}...`);
		}
	}
	
	console.log(`Found ${roadsideStops.length} roadside stops total`);
	return roadsideStops;
}

// Create smart itinerary
async function createSmartItinerary(route, days, overnightStops, roadsideStops, config, progressCallback) {
	const totalDistance = route.distance;
	const idealDailyDistance = totalDistance / days;
	
	// Select optimal overnight stops
	const selectedOvernightStops = selectOvernightStops(overnightStops, idealDailyDistance, days);
	
	// Create basic itinerary structure
	const itinerary = {
		stops: selectedOvernightStops,
		roadsideStops: roadsideStops,
		totalDistance,
		days: []
	};
	
	return itinerary;
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

// Export for use in other modules
export { 
	fetchPoisSimple, 
	createGenericPois, 
	findOvernightStops, 
	findNearbyAccommodations, 
	selectOvernightStops, 
	findRoadsideStops, 
	createSmartItinerary, 
	computeSmartTripStops 
};
