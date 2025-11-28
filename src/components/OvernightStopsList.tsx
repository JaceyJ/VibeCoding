import React from 'react';
import { OvernightStop } from '../services/OvernightStopService';
import './OvernightStopsList.css';

interface OvernightStopsListProps {
  stops: OvernightStop[];
}

/**
 * OvernightStopsList Component
 * Single Responsibility: Displays list of overnight stops
 */
export const OvernightStopsList: React.FC<OvernightStopsListProps> = ({
  stops
}) => {
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatDistance = (km: number): string => {
    return `${km.toFixed(1)} km`;
  };

  return (
    <div className="overnight-stops-container">
      <h2 className="overnight-stops-title">Overnight Stops</h2>
      <div className="overnight-stops-list">
        {stops.map((stop) => (
          <div key={stop.day} className="overnight-stop-card">
            <div className="stop-day-badge">Day {stop.day}</div>
            <div className="stop-content">
              <h3 className="stop-city-name">{stop.city.name}</h3>
              <p className="stop-city-full">{stop.city.displayName}</p>
              <div className="stop-details">
                <div className="stop-detail-item">
                  <span className="stop-detail-label">Arrival Time:</span>
                  <span className="stop-detail-value">{formatTime(stop.arrivalTimeSec)}</span>
                </div>
                <div className="stop-detail-item">
                  <span className="stop-detail-label">Distance:</span>
                  <span className="stop-detail-value">{formatDistance(stop.cumulativeDistance)}</span>
                </div>
                <div className="stop-detail-item">
                  <span className="stop-detail-label">Place Type:</span>
                  <span className="stop-detail-value stop-place-type" data-place-type={stop.city.placeType || 'unknown'}>
                    {stop.city.placeType 
                      ? stop.city.placeType.charAt(0).toUpperCase() + stop.city.placeType.slice(1)
                      : 'Unknown'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

