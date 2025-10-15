// UI rendering functions for trip results and interface
import { MAP_CONFIG } from './config.js';
import { getElementSafely, formatDistance, formatTime } from './utils.js';

// Initialize Leaflet map
function initializeMap() {
	const mapEl = getElementSafely('map');
	if (!mapEl) {
		console.error('Map element not found');
		return;
	}
	
	const map = L.map('map').setView(MAP_CONFIG.defaultCenter, MAP_CONFIG.defaultZoom);
	
	const baselayer = L.tileLayer(MAP_CONFIG.tileLayer, {
		attribution: MAP_CONFIG.attribution
	}).addTo(map);
	
	// Make map globally available
	window.map = map;
	window.baselayer = baselayer;
	
	console.log('Map initialized successfully');
}

// Render POIs for stops in the sidebar
function renderPoisForStops(stopPois) {
	const poiListEl = getElementSafely('poi-list');
	if (!poiListEl) return;
	
	poiListEl.innerHTML = '';
	if (!stopPois || stopPois.length === 0) return;
	
	// Separate overnight and roadside stops
	const overnightStops = stopPois.filter(entry => entry.type === 'overnight');
	const roadsideStops = stopPois.filter(entry => entry.type === 'roadside');
	
	// Render overnight stops first
	if (overnightStops.length > 0) {
		const overnightSection = document.createElement('div');
		overnightSection.className = 'stops-section';
		
		const overnightHeader = document.createElement('h3');
		overnightHeader.textContent = '🏨 Overnight Stops';
		overnightHeader.style.color = '#f59e0b';
		overnightHeader.style.borderBottom = '2px solid #f59e0b';
		overnightHeader.style.paddingBottom = '8px';
		overnightHeader.style.marginBottom = '16px';
		overnightSection.appendChild(overnightHeader);
		
		overnightStops.forEach((entry, i) => {
			const stopElement = createStopElement(entry, i + 1, 'overnight');
			overnightSection.appendChild(stopElement);
		});
		
		poiListEl.appendChild(overnightSection);
	}
	
	// Render roadside stops
	if (roadsideStops.length > 0) {
		const roadsideSection = document.createElement('div');
		roadsideSection.className = 'stops-section';
		
		const roadsideHeader = document.createElement('h3');
		roadsideHeader.textContent = '🎯 Activity Stops';
		roadsideHeader.style.color = '#3b82f6';
		roadsideHeader.style.borderBottom = '2px solid #3b82f6';
		roadsideHeader.style.paddingBottom = '8px';
		roadsideHeader.style.marginBottom = '16px';
		roadsideHeader.style.marginTop = '24px';
		roadsideSection.appendChild(roadsideHeader);
		
		roadsideStops.forEach((entry, i) => {
			const stopElement = createStopElement(entry, i + 1, 'roadside');
			roadsideSection.appendChild(stopElement);
		});
		
		poiListEl.appendChild(roadsideSection);
	}
}

function createStopElement(entry, index, type) {
	const { stop, pois, accommodations } = entry;
	const header = document.createElement('div');
	header.className = 'poi';
	
	// Add type-specific styling
	if (type === 'overnight') {
		header.style.borderLeft = '4px solid #f59e0b';
		header.style.backgroundColor = '#fef3c7';
	} else {
		header.style.borderLeft = '4px solid #3b82f6';
		header.style.backgroundColor = '#dbeafe';
	}
	
	const title = document.createElement('h4');
	const typeIcon = type === 'overnight' ? '🏨' : '🎯';
	title.textContent = `${typeIcon} ${stop.name}`;
	title.style.margin = '0 0 8px 0';
	header.appendChild(title);
	
	// Add a brief summary/description
	const summary = document.createElement('p');
	summary.className = 'stop-summary';
	summary.textContent = stop.fullAddress ? 
		`${stop.fullAddress.split(',')[0]} - ${formatDistance(stop.distanceFromStart || 0)} from start` : 
		`${formatDistance(stop.distanceFromStart || 0)} from start`;
	summary.style.color = 'var(--muted)';
	summary.style.fontSize = '13px';
	summary.style.margin = '4px 0 8px 0';
	header.appendChild(summary);
	
	// Add accommodations section for overnight stops
	if (type === 'overnight' && accommodations && accommodations.length > 0) {
		const accSection = document.createElement('div');
		accSection.className = 'accommodations-section';
		
		const accHeader = document.createElement('h5');
		accHeader.textContent = 'Where to Stay:';
		accHeader.style.color = '#f59e0b';
		accHeader.style.margin = '12px 0 8px 0';
		accSection.appendChild(accHeader);
		
		accommodations.forEach(acc => {
			const accDiv = document.createElement('div');
			accDiv.className = 'accommodation-item';
			accDiv.style.marginBottom = '8px';
			accDiv.style.padding = '8px';
			accDiv.style.backgroundColor = 'white';
			accDiv.style.borderRadius = '4px';
			accDiv.style.border = '1px solid #e5e7eb';
			
			const accTitle = document.createElement('h6');
			const accLink = document.createElement('a');
			accLink.href = acc.url;
			accLink.target = '_blank';
			accLink.rel = 'noopener';
			accLink.textContent = acc.title;
			accLink.style.color = '#1f2937';
			accTitle.appendChild(accLink);
			accDiv.appendChild(accTitle);
			
			const accCategory = document.createElement('p');
			accCategory.textContent = `${acc.category}${acc.stars ? ` • ${acc.stars}⭐` : ''}`;
			accCategory.style.fontSize = '12px';
			accCategory.style.color = '#6b7280';
			accCategory.style.margin = '4px 0';
			accDiv.appendChild(accCategory);
			
			const accDistance = document.createElement('p');
			accDistance.textContent = `${formatDistance(acc.distanceMeters)} away`;
			accDistance.style.fontSize = '12px';
			accDistance.style.color = '#6b7280';
			accDistance.style.margin = '0';
			accDiv.appendChild(accDistance);
			
			accSection.appendChild(accDiv);
		});
		
		header.appendChild(accSection);
	}
	
	// Add POIs section
	if (!pois || pois.length === 0) {
		const p = document.createElement('p');
		p.textContent = 'No attractions found nearby.';
		p.style.color = '#6b7280';
		p.style.fontStyle = 'italic';
		header.appendChild(p);
	} else {
		const poiSection = document.createElement('div');
		poiSection.className = 'pois-section';
		
		const poiHeader = document.createElement('h5');
		poiHeader.textContent = type === 'overnight' ? 'Things to Do:' : 'Attractions:';
		poiHeader.style.color = type === 'overnight' ? '#f59e0b' : '#3b82f6';
		poiHeader.style.margin = '12px 0 8px 0';
		poiSection.appendChild(poiHeader);
		
		pois.forEach(poi => {
			const div = document.createElement('div');
			div.className = 'poi-item';
			div.style.marginBottom = '8px';
			div.style.padding = '8px';
			div.style.backgroundColor = 'white';
			div.style.borderRadius = '4px';
			div.style.border = '1px solid #e5e7eb';
			
			// POI title with link
			const h = document.createElement('h6');
			const a = document.createElement('a');
			a.href = poi.url;
			a.target = '_blank';
			a.rel = 'noopener';
			a.textContent = poi.title;
			a.style.color = '#1f2937';
			h.appendChild(a);
			div.appendChild(h);
			
			// Category badge
			if (poi.category) {
				const category = document.createElement('span');
				category.textContent = poi.category;
				category.style.fontSize = '11px';
				category.style.color = '#6b7280';
				category.style.backgroundColor = '#f3f4f6';
				category.style.padding = '2px 6px';
				category.style.borderRadius = '3px';
				category.style.marginRight = '8px';
				h.appendChild(category);
			}
			
			// Distance
			if (poi.distanceMeters) {
				const distance = document.createElement('span');
				distance.textContent = formatDistance(poi.distanceMeters);
				distance.style.fontSize = '11px';
				distance.style.color = '#6b7280';
				div.appendChild(distance);
			}
			
			poiSection.appendChild(div);
		});
		
		header.appendChild(poiSection);
	}
	
	return header;
}

// Render trip results in the sidebar
function renderTripResults(start, end, stops, poisPerStop, totalDistance, totalDuration, days, tripPace) {
	const formatKm = (m) => formatDistance(m);
	const formatH = (s) => formatTime(s);
	
	// Clear existing content in sidebar
	const tripOverviewEl = getElementSafely('trip-overview');
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

// Render route on map
function renderRoute(geojson) {
	if (window.routeLayer) {
		window.map.removeLayer(window.routeLayer);
	}
	
	window.routeLayer = L.geoJSON(geojson, {
		style: {
			color: '#3b82f6',
			weight: 4,
			opacity: 0.8
		}
	}).addTo(window.map);
	
	// Fit map to route
	window.map.fitBounds(window.routeLayer.getBounds(), { padding: [20, 20] });
}

// Add marker to map
function addMarker(lat, lon, label, color = '#22c55e') {
	const marker = L.circleMarker([lat, lon], {
		radius: 8,
		fillColor: color,
		color: '#fff',
		weight: 2,
		opacity: 1,
		fillOpacity: 0.8
	}).addTo(window.map);
	
	marker.bindPopup(label);
	return marker;
}

// Clear map
function clearMap() {
	if (window.routeLayer) {
		window.map.removeLayer(window.routeLayer);
		window.routeLayer = null;
	}
	
	// Clear all markers except the base layer
	window.map.eachLayer(layer => {
		if (layer !== window.baselayer) {
			window.map.removeLayer(layer);
		}
	});
}

// Status and progress functions
function setStatus(message) {
	const statusEl = getElementSafely('status');
	if (statusEl) statusEl.textContent = message;
}

function showProgress() {
	const progressContainer = getElementSafely('progress-container');
	if (progressContainer) progressContainer.style.display = 'block';
}

function hideProgress() {
	const progressContainer = getElementSafely('progress-container');
	if (progressContainer) progressContainer.style.display = 'none';
}

function updateProgress(percentage, text) {
	const progressFill = getElementSafely('progress-fill');
	const progressText = getElementSafely('progress-text');
	
	if (progressFill) {
		progressFill.style.width = `${percentage}%`;
	}
	
	if (progressText) {
		progressText.textContent = text;
	}
}

// Form utility functions
function getTripPace() {
	const selectedPace = document.querySelector('input[name="tripPace"]:checked');
	return selectedPace ? selectedPace.value : 'balanced';
}

function getDriveTimeRange() {
	const minDriveTime = parseFloat(document.getElementById('minDriveTime').value) || 4;
	const maxDriveTime = parseFloat(document.getElementById('maxDriveTime').value) || 8;
	return { min: minDriveTime, max: maxDriveTime };
}

function getUserPreferences() {
	const checkboxes = document.querySelectorAll('input[name="preferences"]:checked');
	return Array.from(checkboxes).map(cb => cb.value);
}

// Export for use in other modules
export { 
	initializeMap,
	renderPoisForStops, 
	renderTripResults, 
	renderRoute, 
	addMarker, 
	clearMap, 
	setStatus, 
	showProgress, 
	hideProgress, 
	updateProgress, 
	getTripPace, 
	getDriveTimeRange, 
	getUserPreferences 
};
