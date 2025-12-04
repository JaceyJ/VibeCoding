# Trip Planning App

A modern, responsive trip planning application built with React, TypeScript, and Vite. Plan your road trips with automatic route calculation, overnight stop suggestions, attractions, food recommendations, and interactive maps.

## Features

- **Trip Planning Form**: Enter start and end locations, set driving time preferences, and choose trip type (hotel or camping)
- **Route Calculation**: Automatically calculates optimal routes with overnight stops based on your driving time preferences
- **Interactive Map**: Visualize your route with Leaflet maps showing the path and overnight stops
- **Attractions**: Discover nearby attractions along your route
- **Food Recommendations**: Find restaurants and food places near your stops
- **Lodging Options**: Search for hotels or campsites at each overnight stop
- **Date Selection**: Choose your trip start date to plan accordingly
- **Responsive Design**: Works on desktop and mobile devices

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (version 16 or higher) - [Download Node.js](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn**

To check if you have Node.js installed, run:
```bash
node --version
npm --version
```

## Installation

1. **Clone or navigate to the project directory:**
   ```bash
   cd vib
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```
   
   This will install all required packages including React, TypeScript, Vite, Leaflet, and other dependencies.

## Running the Application

### Development Mode

To start the development server:

```bash
npm run dev
```

The application will start and you'll see output like:
```
  VITE v4.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

3. **Open your browser** and navigate to the URL shown (typically `http://localhost:5173`)

The development server includes:
- Hot Module Replacement (HMR) - changes reflect immediately
- Fast refresh for React components
- Source maps for debugging

### Production Build

To build the application for production:

```bash
npm run build
```

This will:
- Compile TypeScript
- Bundle and optimize the code
- Output production-ready files to the `dist/` directory

### Preview Production Build

To preview the production build locally:

```bash
npm run preview
```

This serves the built files from the `dist/` directory.

## Project Structure

```
vib/
├── src/
│   ├── components/          # React components
│   │   ├── TripPlanningForm.tsx
│   │   ├── RouteDisplay.tsx
│   │   ├── RouteMap.tsx
│   │   ├── OvernightStopsList.tsx
│   │   ├── AttractionsTab.tsx
│   │   ├── FoodSearchModal.tsx
│   │   ├── HotelSearchModal.tsx
│   │   └── ... (other components)
│   ├── services/            # Business logic and API services
│   │   ├── RouteService.ts
│   │   ├── LocationService.ts
│   │   ├── AttractionService.ts
│   │   ├── FoodService.ts
│   │   ├── HotelService.ts
│   │   └── ... (other services)
│   ├── utils/               # Utility functions
│   ├── App.tsx              # Main app component
│   └── main.tsx             # Application entry point
├── docs/                    # Documentation
├── index.html               # HTML template
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite configuration
└── README.md                # This file
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Technology Stack

- **React 18** - UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool and dev server
- **Leaflet** - Interactive maps
- **React Leaflet** - React bindings for Leaflet

## API Usage

This application uses:
- **OpenStreetMap Nominatim API** - For location search and geocoding (no API key required)
- **OpenRouteService API** - For route calculation (no API key required for basic usage)

Note: These are free public APIs. For production use with high traffic, consider setting up your own API keys or using alternative services.

## Troubleshooting

### Port Already in Use

If port 5173 is already in use, Vite will automatically try the next available port. You can also specify a port:

```bash
npm run dev -- --port 3000
```

### Dependencies Issues

If you encounter issues with dependencies:

```bash
# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall dependencies
npm install
```

### TypeScript Errors

If you see TypeScript errors, ensure your TypeScript version is compatible:

```bash
npm install typescript@latest --save-dev
```

## Browser Support

This application works best in modern browsers:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

This project is for educational/demonstration purposes.

## Contributing

This is a personal project. For questions or issues, please refer to the project documentation in the `docs/` directory.
