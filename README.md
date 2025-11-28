# Trip Planning App

A modern, responsive trip planning application UI built with React and TypeScript, following SOLID design principles and Object-Oriented Design patterns.

## Features

- **Start Location Input**: Text field for entering the trip's starting point
- **End Location Input**: Text field for entering the trip's destination
- **Minimum Daily Driving Time**: Numeric input with up/down arrows (0.5-24 hours)
- **Maximum Daily Driving Time**: Numeric input with up/down arrows (0.5-24 hours)
- **Plan Trip Button**: Submits the form when all fields are valid

## Architecture

The application follows SOLID principles:

- **Single Responsibility**: Each component has one clear purpose
  - `LocationInput`: Handles location text input
  - `DrivingTimeInput`: Handles numeric driving time input with controls
  - `PlanTripButton`: Renders the action button
  - `TripPlanningForm`: Manages form state and composition

- **Open/Closed**: Components are extensible through props without modification

- **Liskov Substitution**: Components can be replaced with compatible implementations

- **Interface Segregation**: Focused prop interfaces for each component

- **Dependency Inversion**: Components depend on abstractions (props) rather than concrete implementations

## Project Structure

```
src/
├── components/
│   ├── LocationInput.tsx          # Location input component
│   ├── LocationInput.css
│   ├── DrivingTimeInput.tsx        # Driving time input with arrows
│   ├── DrivingTimeInput.css
│   ├── PlanTripButton.tsx          # Submit button component
│   ├── PlanTripButton.css
│   ├── TripPlanningForm.tsx        # Main form component
│   └── TripPlanningForm.css
├── App.tsx                          # Main app component
├── App.css
└── main.tsx                         # Application entry point
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to the URL shown in the terminal (typically `http://localhost:5173`)

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Usage

1. Enter your starting location in the "Start Location" field
2. Enter your destination in the "End Location" field
3. Adjust the minimum and maximum daily driving time using the up/down arrows or by typing directly
4. Click "Plan Trip" to submit (currently shows an alert - backend integration pending)

## Future Enhancements

- Backend API integration for trip planning
- Route visualization
- Multiple waypoints support
- Trip history
- Save and load trip configurations


