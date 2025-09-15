/* Roadtrip Planner App */

const form = document.getElementById('planner-form');
const startInput = document.getElementById('start');
const endInput = document.getElementById('end');
const daysInput = document.getElementById('days');
const statusEl = document.getElementById('status');
const itineraryEl = document.getElementById('itinerary');
const poiListEl = document.getElementById('poi-list');

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

function computeStopsByDistance(route, days) {
	const geometry = route.geometry; // GeoJSON LineString
	const coordinates = geometry.coordinates; // [lon, lat]
	// OSRM returns legs[].annotation.distance arrays per leg. We'll combine them to match segments.
	const legAnnotations = route.legs?.flatMap(l => (l.annotation && l.annotation.distance) ? l.annotation.distance : []) || [];

	// Fallback: If no annotation present (some servers), approximate by equal spacing along coords
	let perSegmentDistances = legAnnotations;
	if (!perSegmentDistances || perSegmentDistances.length === 0) {
		perSegmentDistances = new Array(Math.max(0, coordinates.length - 1)).fill(route.distance / Math.max(1, coordinates.length - 1));
	}

	const cumulative = [0];
	for (let i = 0; i < perSegmentDistances.length; i++) {
		cumulative.push(cumulative[cumulative.length - 1] + perSegmentDistances[i]);
	}
	const totalDistance = cumulative[cumulative.length - 1] || route.distance;
	const stops = [];
	for (let d = 1; d < days; d++) {
		const target = totalDistance * (d / days);
		// binary search for closest index in cumulative
		let lo = 0, hi = cumulative.length - 1, idx = 0;
		while (lo <= hi) {
			const mid = Math.floor((lo + hi) / 2);
			if (cumulative[mid] < target) lo = mid + 1; else { idx = mid; hi = mid - 1; }
		}
		const clamped = Math.min(Math.max(1, idx), coordinates.length - 1);
		const [lon, lat] = coordinates[clamped];
		stops.push({ lat, lon, index: clamped, distanceFromStartMeters: cumulative[clamped] });
	}
	return { stops, totalDistance };
}

async function fetchPois(lat, lon, radiusMeters = 15000, limit = 10) {
	const url = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}%7C${lon}&gsradius=${radiusMeters}&gslimit=${limit}&format=json&origin=*`;
	const res = await fetch(url);
	if (!res.ok) throw new Error('POI fetch failed');
	const json = await res.json();
	const items = json?.query?.geosearch || [];
	return items.map(x => ({
		title: x.title,
		pageId: x.pageid,
		distanceMeters: x.dist,
		lat: x.lat,
		lon: x.lon,
		url: `https://en.wikipedia.org/?curid=${x.pageid}`
	}));
}

function renderItinerary(start, end, stops, totalDistanceMeters, totalDurationSeconds, days) {
	itineraryEl.innerHTML = '';
	const formatKm = (m) => (m / 1000).toFixed(1) + ' km';
	const formatH = (s) => {
		const h = Math.floor(s / 3600);
		const m = Math.round((s % 3600) / 60);
		return `${h}h ${m}m`;
	};

	const liStart = document.createElement('li');
	liStart.textContent = `Start: ${start.displayName}`;
	itineraryEl.appendChild(liStart);

	stops.forEach((stop, i) => {
		const li = document.createElement('li');
		li.textContent = `Day ${i + 1} stop @ ${stop.lat.toFixed(3)}, ${stop.lon.toFixed(3)} (${formatKm(stop.distanceFromStartMeters)} from start)`;
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

function renderPoisForStops(stopPois) {
	poiListEl.innerHTML = '';
	if (!stopPois || stopPois.length === 0) return;
	stopPois.forEach((entry, i) => {
		const { stop, pois } = entry;
		const header = document.createElement('div');
		header.className = 'poi';
		const title = document.createElement('h3');
		title.textContent = `Day ${i + 1} stop @ ${stop.lat.toFixed(3)}, ${stop.lon.toFixed(3)}`;
		header.appendChild(title);
		if (!pois || pois.length === 0) {
			const p = document.createElement('p');
			p.textContent = 'No places found nearby.';
			header.appendChild(p);
			poiListEl.appendChild(header);
			return;
		}
		pois.forEach(poi => {
			const div = document.createElement('div');
			div.className = 'poi';
			const h = document.createElement('h3');
			const a = document.createElement('a');
			a.href = poi.url;
			a.target = '_blank';
			a.rel = 'noopener';
			a.textContent = poi.title;
			h.appendChild(a);
			div.appendChild(h);
			const p = document.createElement('p');
			p.textContent = `${(poi.distanceMeters / 1000).toFixed(1)} km away`;
			div.appendChild(p);
			header.appendChild(div);
		});
		poiListEl.appendChild(header);
	});
}

async function planTrip(event) {
	event.preventDefault();
	const startText = startInput.value.trim();
	const endText = endInput.value.trim();
	const days = Math.max(1, Math.min(30, parseInt(daysInput.value, 10) || 1));

	if (!startText || !endText) return;

	setStatus('Geocoding start and end...');
	form.querySelector('button[type="submit"]').disabled = true;

	try {
		const [start, end] = await Promise.all([
			geocode(startText),
			geocode(endText)
		]);

		clearMap();
		addMarker(start.lat, start.lon, 'Start', '#22c55e');
		addMarker(end.lat, end.lon, 'End', '#ef4444');

		setStatus('Routing...');
		const route = await fetchRoute(start, end);
		renderRoute(route.geometry);

		const totalDuration = route.duration; // seconds
		const { stops, totalDistance } = computeStopsByDistance(route, days);
		stops.forEach((stop, i) => addMarker(stop.lat, stop.lon, `Day ${i + 1}`, '#f59e0b'));

		renderItinerary(start, end, stops, totalDistance, totalDuration, days);

		setStatus('Finding things to do near each stop...');
		const poisPerStop = await Promise.all(stops.map(async (stop) => {
			try {
				const pois = await fetchPois(stop.lat, stop.lon, 15000, 8);
				return { stop, pois };
			} catch (e) {
				return { stop, pois: [] };
			}
		}));
		renderPoisForStops(poisPerStop);
		setStatus('Done.');
	} catch (err) {
		console.error(err);
		setStatus(err.message || 'Something went wrong. Try different inputs.');
	} finally {
		form.querySelector('button[type="submit"]').disabled = false;
	}
}

form.addEventListener('submit', planTrip);