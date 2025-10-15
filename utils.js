// Utility functions for common operations

// Calculate distance between two coordinates using Haversine formula
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

// Format distance in meters to readable string
function formatDistance(meters) {
	if (meters < 1000) {
		return `${Math.round(meters)}m`;
	} else {
		return `${(meters / 1000).toFixed(1)}km`;
	}
}

// Format time in seconds to readable string
function formatTime(seconds) {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.round((seconds % 3600) / 60);
	return `${hours}h ${minutes}m`;
}

// Remove duplicate POIs based on title similarity
function removeDuplicatePois(pois) {
	const uniquePois = [];
	const seenTitles = new Set();
	
	for (const poi of pois) {
		const normalizedTitle = poi.title.toLowerCase().trim();
		if (!seenTitles.has(normalizedTitle)) {
			seenTitles.add(normalizedTitle);
			uniquePois.push(poi);
		}
	}
	
	return uniquePois;
}

// Categorize POI based on title keywords
function categorizePoi(title) {
	const titleLower = title.toLowerCase();
	
	if (titleLower.includes('museum') || titleLower.includes('gallery')) return 'Museum';
	if (titleLower.includes('park') || titleLower.includes('garden')) return 'Park';
	if (titleLower.includes('historic') || titleLower.includes('monument') || titleLower.includes('memorial')) return 'Historic Site';
	if (titleLower.includes('restaurant') || titleLower.includes('cafe') || titleLower.includes('bar')) return 'Food & Drink';
	if (titleLower.includes('zoo') || titleLower.includes('aquarium')) return 'Zoo/Aquarium';
	if (titleLower.includes('theater') || titleLower.includes('theatre') || titleLower.includes('cinema')) return 'Entertainment';
	if (titleLower.includes('beach') || titleLower.includes('lake') || titleLower.includes('river')) return 'Scenic View';
	if (titleLower.includes('church') || titleLower.includes('cathedral') || titleLower.includes('temple')) return 'Historic Site';
	if (titleLower.includes('castle') || titleLower.includes('palace') || titleLower.includes('fort')) return 'Historic Site';
	if (titleLower.includes('viewpoint') || titleLower.includes('overlook') || titleLower.includes('scenic')) return 'Scenic View';
	
	return 'Attraction';
}

// Get accommodation category from type
function getAccommodationCategory(type) {
	const categoryMap = {
		'hotel': 'Hotel',
		'motel': 'Motel',
		'hostel': 'Hostel',
		'guest_house': 'Guest House',
		'bed_and_breakfast': 'Bed & Breakfast',
		'apartment': 'Apartment',
		'resort': 'Resort'
	};
	return categoryMap[type] || 'Accommodation';
}

// Find closest point on route to target distance
function findClosestPointOnRoute(coordinates, targetDistance) {
	let currentDistance = 0;
	
	for (let i = 0; i < coordinates.length - 1; i++) {
		const [lon1, lat1] = coordinates[i];
		const [lon2, lat2] = coordinates[i + 1];
		const segmentDistance = calculateDistance(lat1, lon1, lat2, lon2);
		
		if (currentDistance + segmentDistance >= targetDistance) {
			// Interpolate between the two points
			const ratio = (targetDistance - currentDistance) / segmentDistance;
			return {
				lat: lat1 + (lat2 - lat1) * ratio,
				lon: lon1 + (lon2 - lon1) * ratio,
				distanceFromStart: targetDistance
			};
		}
		
		currentDistance += segmentDistance;
	}
	
	return null;
}

// Get attraction icon based on category
function getAttractionIcon(category) {
	const iconMap = {
		'Museum': '🏛️',
		'Park': '🌳',
		'Historic Site': '🏛️',
		'Food & Drink': '🍽️',
		'Zoo/Aquarium': '🐾',
		'Entertainment': '🎭',
		'Scenic View': '🌅',
		'Outdoor Activity': '🏃',
		'Cultural Site': '🎨',
		'Family Activity': '👨‍👩‍👧‍👦',
		'Adventure': '🧗',
		'Attraction': '📍'
	};
	return iconMap[category] || '📍';
}

// Get accommodation icon based on category
function getAccommodationIcon(category) {
	const iconMap = {
		'Hotel': '🏨',
		'Motel': '🏨',
		'Hostel': '🏨',
		'Guest House': '🏨',
		'Bed & Breakfast': '🏨',
		'Apartment': '🏠',
		'Resort': '🏖️',
		'Accommodation': '🏨'
	};
	return iconMap[category] || '🏨';
}

// Get day icon for itinerary
function getDayIcon(day) {
	const icons = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
	return icons[day - 1] || '📅';
}

// Validate location object
function validateLocation(location) {
	return location && 
		   typeof location.lat === 'number' && 
		   typeof location.lon === 'number' &&
		   location.lat >= -90 && location.lat <= 90 &&
		   location.lon >= -180 && location.lon <= 180;
}

// Safe element getter with error handling
function getElementSafely(id) {
	const element = document.getElementById(id);
	if (!element) {
		console.warn(`Element with id '${id}' not found`);
	}
	return element;
}

// Debounce function for input handling
function debounce(func, wait) {
	let timeout;
	return function executedFunction(...args) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

// Export for use in other modules
export { 
	calculateDistance, 
	formatDistance, 
	formatTime, 
	removeDuplicatePois, 
	categorizePoi, 
	getAccommodationCategory,
	findClosestPointOnRoute,
	getAttractionIcon, 
	getAccommodationIcon, 
	getDayIcon, 
	validateLocation, 
	getElementSafely, 
	debounce 
};
