import React, { useState } from 'react';
import { TripPlanningForm, TripPlanningFormData } from './components/TripPlanningForm';
import { RouteDisplay } from './components/RouteDisplay';
import './App.css';

/**
 * App Component
 * Single Responsibility: Main application entry point and layout
 */
const App: React.FC = () => {
  const [tripData, setTripData] = useState<TripPlanningFormData | null>(null);

  const handleTripSubmit = (data: TripPlanningFormData) => {
    setTripData(data);
    // Scroll to route display
    setTimeout(() => {
      const routeDisplay = document.querySelector('.route-display-container');
      if (routeDisplay) {
        routeDisplay.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  return (
    <div className="app">
      <div className="app-content">
        <TripPlanningForm onSubmit={handleTripSubmit} />
        {tripData && (
          <div className="route-section">
            <RouteDisplay
              startLocation={tripData.startLocation}
              endLocation={tripData.endLocation}
              minDailyDrivingTime={tripData.minDailyDrivingTime}
              maxDailyDrivingTime={tripData.maxDailyDrivingTime}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default App;

