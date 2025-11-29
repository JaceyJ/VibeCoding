import React, { useState, useEffect } from 'react';
import { RouteMap } from './RouteMap';
import { RouteService, RoutePoint, RouteData } from '../services/RouteService';
import { selectOvernightStops, OvernightStop, ProgressCallback } from '../services/OvernightStopService';
import { OvernightStopsList } from './OvernightStopsList';
import { AttractionsTab } from './AttractionsTab';
import { Tabs } from './Tabs';
import { ProgressBar } from './ProgressBar';
import { TripType } from './TripTypeSelector';
import './RouteDisplay.css';

interface RouteDisplayProps {
  startLocation: string;
  endLocation: string;
  startDate: string;
  tripType: TripType;
  minDailyDrivingTime: number;
  maxDailyDrivingTime: number;
}

/**
 * RouteDisplay Component
 * Single Responsibility: Manages route calculation and display
 * Open/Closed: Extensible through props without modification
 */
export const RouteDisplay: React.FC<RouteDisplayProps> = ({
  startLocation,
  endLocation,
  startDate,
  tripType,
  minDailyDrivingTime,
  maxDailyDrivingTime
}) => {
  const [startPoint, setStartPoint] = useState<RoutePoint | null>(null);
  const [endPoint, setEndPoint] = useState<RoutePoint | null>(null);
  const [route, setRoute] = useState<RouteData | null>(null);
  const [overnightStops, setOvernightStops] = useState<OvernightStop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCalculatingStops, setIsCalculatingStops] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 100, message: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRoute = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Geocode both locations
        const [startCoords, endCoords] = await Promise.all([
          RouteService.geocodeLocation(startLocation),
          RouteService.geocodeLocation(endLocation)
        ]);

        if (!startCoords) {
          setError(`Could not find coordinates for start location: ${startLocation}`);
          setIsLoading(false);
          return;
        }

        if (!endCoords) {
          setError(`Could not find coordinates for end location: ${endLocation}`);
          setIsLoading(false);
          return;
        }

        setStartPoint(startCoords);
        setEndPoint(endCoords);

        // Calculate route
        const routeData = await RouteService.calculateRoute(startCoords, endCoords);

        if (!routeData) {
          setError('Could not calculate route between the selected locations.');
          setIsLoading(false);
          return;
        }

        setRoute(routeData);

        // Calculate overnight stops after route is loaded
        if (routeData) {
          setIsCalculatingStops(true);
          setProgress({ current: 0, total: 100, message: 'Starting overnight stop calculation...' });
          
          const progressCallback: ProgressCallback = (progressUpdate) => {
            setProgress({
              current: progressUpdate.current,
              total: progressUpdate.total,
              message: progressUpdate.message
            });
          };

          try {
            const stops = await selectOvernightStops(
              routeData,
              minDailyDrivingTime,
              maxDailyDrivingTime,
              progressCallback
            );
            setOvernightStops(stops);
            setProgress({ current: 100, total: 100, message: 'Complete!' });
          } catch (err) {
            console.error('Error calculating overnight stops:', err);
            // Don't set error - stops are optional
          } finally {
            setIsCalculatingStops(false);
          }
        }
      } catch (err) {
        setError('An error occurred while calculating the route. Please try again.');
        console.error('Route calculation error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (startLocation && endLocation) {
      fetchRoute();
    }
  }, [startLocation, endLocation, minDailyDrivingTime, maxDailyDrivingTime]);

  if (!startPoint || !endPoint) {
    return (
      <div className="route-display-container">
        {isLoading && (
          <div className="route-display-loading">
            <div className="route-display-spinner"></div>
            <p>Loading route...</p>
          </div>
        )}
        {error && (
          <div className="route-display-error">
            <p>{error}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="route-display-container">
      {route && (
        <div className="route-info">
          <div className="route-info-item">
            <span className="route-info-label">Distance:</span>
            <span className="route-info-value">{route.distance.toFixed(1)} km</span>
          </div>
          <div className="route-info-item">
            <span className="route-info-label">Estimated Time:</span>
            <span className="route-info-value">
              {Math.floor(route.duration / 3600)}h {Math.floor((route.duration % 3600) / 60)}m
            </span>
          </div>
        </div>
      )}
      <RouteMap
        start={startPoint}
        end={endPoint}
        route={route}
        overnightStops={overnightStops}
        isLoading={isLoading}
      />
      {isCalculatingStops && (
        <div className="overnight-stops-progress">
          <ProgressBar
            progress={progress.current}
            message={progress.message}
            showPercentage={true}
          />
        </div>
      )}
      {!isCalculatingStops && (
        <Tabs
          tabs={[
            {
              id: 'overnight-stops',
              label: 'Overnight Stops',
              content: overnightStops.length > 0 ? (
                <OvernightStopsList stops={overnightStops} startDate={startDate} tripType={tripType} />
              ) : (
                <div className="no-stops-message">
                  <p>No overnight stops calculated yet.</p>
                </div>
              )
            },
            {
              id: 'attractions',
              label: 'Attractions',
              content: <AttractionsTab tripType={tripType} />
            }
          ]}
          defaultTab="overnight-stops"
        />
      )}
      {error && (
        <div className="route-display-error">
          <p>{error}</p>
        </div>
      )}
    </div>
  );
};

