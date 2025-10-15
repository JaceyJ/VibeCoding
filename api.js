// External API functions for geocoding, routing, and POI fetching
import { API_CONFIG } from './config.js';
import { calculateDistance, categorizePoi, getAccommodationCategory } from './utils.js';

// Geocode address to coordinates using Nominatim
async function geocode(text) {
	const url = `${API_CONFIG.nominatim.baseUrl}/search?format=json&q=${encodeURIComponent(text)}&limit=1`;
	
	try {
		const res = await fetch(url, {
			headers: {
				'User-Agent': API_CONFIG.nominatim.userAgent,
				'Accept': 'application/json'
			}
		});
		
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		
		const data = await res.json();
		if (data.length === 0) throw new Error('No results found');
		
		return {
			lat: parseFloat(data[0].lat),
			lon: parseFloat(data[0].lon),
			name: data[0].display_name,
			displayName: data[0].display_name.split(',')[0]
		};
	} catch (error) {
		console.error('Geocoding failed:', error);
		throw new Error(`Failed to find location: ${text}`);
	}
}

// Reverse geocode coordinates to address
async function reverseGeocode(lat, lon) {
	const url = `${API_CONFIG.nominatim.baseUrl}/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`;
	
	try {
		const res = await fetch(url, {
			headers: {
				'User-Agent': API_CONFIG.nominatim.userAgent,
				'Accept': 'application/json'
			}
		});
		
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		
		const data = await res.json();
		return {
			name: data.display_name.split(',')[0],
			fullAddress: data.display_name
		};
	} catch (error) {
		console.error('Reverse geocoding failed:', error);
		return null;
	}
}

// Fetch driving route using OSRM
async function fetchRoute(start, end) {
	const url = `${API_CONFIG.osrm.baseUrl}/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson`;
	
	try {
		const res = await fetch(url);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		
		const data = await res.json();
		if (data.routes.length === 0) throw new Error('No route found');
		
		return {
			geometry: data.routes[0].geometry,
			distance: data.routes[0].distance,
			duration: data.routes[0].duration
		};
	} catch (error) {
		console.error('Route fetching failed:', error);
		throw new Error('Failed to find route');
	}
}

// Rate limiting for Overpass API
let lastOverpassRequest = 0;
const OVERPASS_MIN_DELAY = 2000; // 2 seconds between requests

// Execute Overpass API query with rate limiting
async function executeOverpassQuery(query) {
	try {
		// Rate limiting: ensure minimum delay between requests
		const now = Date.now();
		const timeSinceLastRequest = now - lastOverpassRequest;
		if (timeSinceLastRequest < OVERPASS_MIN_DELAY) {
			const delay = OVERPASS_MIN_DELAY - timeSinceLastRequest;
			console.log(`Rate limiting: waiting ${delay}ms before next Overpass request`);
			await new Promise(resolve => setTimeout(resolve, delay));
		}
		
		const url = `${API_CONFIG.overpass.baseUrl}?data=${encodeURIComponent(query)}`;
		console.log('Making Overpass API request...');
		
		const res = await fetch(url, {
			headers: {
				'User-Agent': 'RoadtripPlanner/1.0',
				'Accept': 'application/json'
			}
		});
		
		lastOverpassRequest = Date.now();
		
		if (!res.ok) {
			if (res.status === 429) {
				console.warn('Overpass API rate limit hit, skipping this request');
				return [];
			}
			throw new Error(`HTTP ${res.status}`);
		}
		
		const data = await res.json();
		return data.elements || [];
	} catch (error) {
		console.error('Overpass query failed:', error);
		return [];
	}
}

// Fetch Wikipedia attractions near coordinates
async function fetchWikipediaAttractions(lat, lon, radiusMeters, limit) {
	const radiusKm = radiusMeters / 1000;
	const url = `${API_CONFIG.wikipedia.baseUrl}?action=query&list=geosearch&gsradius=${radiusKm * 1000}&gscoord=${lat}|${lon}&gslimit=${limit}&format=json&origin=*`;
	
	try {
		const res = await fetch(url, {
			headers: {
				'User-Agent': 'RoadtripPlanner/1.0',
				'Accept': 'application/json'
			}
		});
		
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		
		const data = await res.json();
		const items = data.query?.geosearch || [];
		
		// Filter out irrelevant results
		const excludeTerms = [
			'highway', 'road', 'street', 'avenue', 'boulevard', 'lane', 'drive',
			'airport', 'station', 'terminal', 'platform', 'stop', 'bus', 'train',
			'bridge', 'tunnel', 'intersection', 'junction', 'crossing'
		];
		
		const includeTerms = [
			'museum', 'park', 'garden', 'historic', 'monument', 'memorial',
			'restaurant', 'cafe', 'bar', 'theater', 'theatre', 'cinema',
			'zoo', 'aquarium', 'beach', 'lake', 'river', 'viewpoint',
			'church', 'cathedral', 'castle', 'palace', 'fort', 'ruins'
		];
		
		const filteredItems = items.filter(item => {
			const title = item.title.toLowerCase();
			const hasExcludeTerm = excludeTerms.some(term => title.includes(term));
			const hasIncludeTerm = includeTerms.some(term => title.includes(term));
			return !hasExcludeTerm && hasIncludeTerm;
		});
		
		return filteredItems.map(x => ({
			title: x.title,
			distanceMeters: x.dist * 1000,
			lat: x.lat,
			lon: x.lon,
			url: `https://en.wikipedia.org/wiki/${encodeURIComponent(x.title)}`,
			source: 'wikipedia',
			category: categorizePoi(x.title)
		}));
	} catch (error) {
		console.error('Wikipedia search failed:', error);
		return [];
	}
}

// Fetch Overpass attractions near coordinates
async function fetchOverpassAttractions(lat, lon, radiusMeters, limit) {
	const query = `
		[out:json][timeout:25];
		(
		  node["tourism"~"^(museum|gallery|artwork|attraction|theme_park|zoo|aquarium)$"](around:${radiusMeters},${lat},${lon});
		  node["amenity"~"^(museum|arts_centre|theatre|cinema|restaurant|cafe|bar)$"](around:${radiusMeters},${lat},${lon});
		  node["leisure"~"^(park|nature_reserve|beach_resort|golf_course|sports_centre|fitness_centre)$"](around:${radiusMeters},${lat},${lon});
		  node["historic"~"^(monument|memorial|tomb|ruins|castle|church|cathedral|tower)$"](around:${radiusMeters},${lat},${lon});
		  node["natural"~"^(beach|waterfall|cave|volcano|geyser|peak|cliff)$"](around:${radiusMeters},${lat},${lon});
		  node["tourism"~"^(viewpoint|camp_site|picnic_site)$"](around:${radiusMeters},${lat},${lon});
		);
		out center meta;
	`;
	
	try {
		const elements = await executeOverpassQuery(query);
		
		return elements.map(element => {
			const name = element.tags?.name || element.tags?.tourism || element.tags?.amenity || 'Unnamed Location';
			const distance = calculateDistance(lat, lon, element.lat, element.lon);
			
			return {
				title: name,
				distanceMeters: distance,
				lat: element.lat,
				lon: element.lon,
				url: `https://www.openstreetmap.org/node/${element.id}`,
				source: 'overpass',
				category: categorizePoi(name)
			};
		}).slice(0, limit);
	} catch (error) {
		console.error('Overpass attractions failed:', error);
		return [];
	}
}

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
		
		return response.map(element => {
			const distanceMeters = calculateDistance(lat, lon, element.lat, element.lon);
			const type = element.tags?.tourism || element.tags?.amenity || 'hotel';
			
			return {
				title: element.tags?.name || `${type.charAt(0).toUpperCase() + type.slice(1)}`,
				distanceMeters: distanceMeters,
				lat: element.lat,
				lon: element.lon,
				url: `https://www.openstreetmap.org/node/${element.id}`,
				source: 'overpass',
				category: getAccommodationCategory(type),
				phone: element.tags?.phone || null,
				stars: element.tags?.stars || null
			};
		}).slice(0, limit);
	} catch (error) {
		console.error('Accommodation search failed:', error);
		return [];
	}
}

// Search locations for autocomplete
async function searchLocations(query, limit = 5) {
	if (query.length < 3) return [];
	
	const url = `${API_CONFIG.nominatim.baseUrl}/search?format=json&q=${encodeURIComponent(query)}&limit=${limit}&addressdetails=1`;
	
	try {
		const res = await fetch(url, {
			headers: {
				'User-Agent': API_CONFIG.nominatim.userAgent,
				'Accept': 'application/json'
			}
		});
		
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		
		const data = await res.json();
		return data.map(place => ({
			name: place.display_name,
			lat: parseFloat(place.lat),
			lon: parseFloat(place.lon),
			displayName: place.display_name.split(',')[0]
		}));
	} catch (error) {
		console.error('Location search failed:', error);
		return [];
	}
}

// Debug: Log what we're exporting
console.log('API.js: About to export functions');
console.log('fetchWikipediaAttractions:', typeof fetchWikipediaAttractions);
console.log('fetchOverpassAttractions:', typeof fetchOverpassAttractions);

// Export for use in other modules
export { 
	geocode, 
	reverseGeocode, 
	fetchRoute, 
	executeOverpassQuery, 
	fetchWikipediaAttractions, 
	fetchOverpassAttractions, 
	fetchAccommodations, 
	searchLocations
};
