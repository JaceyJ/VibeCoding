# Roadtrip Planner

A single-page website to plan a roadtrip by entering start, end, and number of days. It maps the driving route, splits it into day-based stop points, and suggests nearby points of interest for each stop.

## Run locally

Open `index.html` directly in a modern browser, or serve the directory with any static server:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

No API keys are required.

## Features

- Start/End geocoding (Nominatim)
- Driving route (OSRM) rendered on a Leaflet map
- Evenly spaced stops by distance across selected days
- Wikipedia GeoSearch POIs near each stop
- Responsive, dark-themed UI

## Services used

- OpenStreetMap tiles: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
- Nominatim geocoding: `https://nominatim.openstreetmap.org/`
- OSRM routing: `https://router.project-osrm.org/`
- Wikipedia API (GeoSearch): `https://www.wikipedia.org/`

## Notes

- Be respectful of public API usage policies and rate limits.
- For production, consider hosting your own Nominatim/OSRM or using a commercial provider with SLAs.