import React from 'react';
import { TripType } from './TripTypeSelector';
import { DayAttractionResult } from '../services/RouteAttractionService';
import './AttractionsTab.css';

interface AttractionsTabProps {
  tripType: TripType;
  onFindAttractions?: () => void;
  isSearching?: boolean;
  dayAttractions?: DayAttractionResult[];
}

/**
 * AttractionsTab Component
 * Single Responsibility: Displays attractions tab content and entry point for route-wide attraction search
 */
export const AttractionsTab: React.FC<AttractionsTabProps> = ({
  tripType,
  onFindAttractions,
  isSearching = false,
  dayAttractions = []
}) => {
  const handleClick = () => {
    if (onFindAttractions) {
      onFindAttractions();
    } else {
      console.log('[AttractionsTab] Find attractions clicked (no handler wired yet)');
    }
  };

  const hasResults = dayAttractions.some((d) => d.attractions && d.attractions.length > 0);

  return (
    <div className="attractions-tab-container">
      <div className="attractions-tab-header">
        <div>
          <h3 className="attractions-title">Attractions along your route</h3>
          <p className="attractions-description">
            Use your trip type preference ({tripType.replace('-', ' ')}) to discover interesting stops along the way.
          </p>
        </div>
        <button
          className="attractions-tab-button"
          onClick={handleClick}
          disabled={isSearching}
        >
          {isSearching ? 'Finding attractions…' : 'Find attractions along route'}
        </button>
      </div>
      {hasResults ? (
        <div className="attractions-results-summary">
          {dayAttractions.map((dayResult) =>
            dayResult.attractions && dayResult.attractions.length > 0 ? (
              <div key={dayResult.day} className="attractions-day">
                <h4 className="attractions-day-title">Day {dayResult.day}</h4>
                <ul className="attractions-day-list">
                  {dayResult.attractions.map((attraction, index) => (
                    <li key={`${dayResult.day}-${index}`} className="attractions-day-item">
                      {attraction.url ? (
                        <a
                          href={attraction.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="attractions-day-item-link"
                        >
                          <div className="attractions-day-item-main">
                            <span className="attractions-day-item-name">{attraction.name}</span>
                            {attraction.type && (
                              <span className="attractions-day-item-type">
                                {attraction.type.charAt(0).toUpperCase() + attraction.type.slice(1)}
                              </span>
                            )}
                          </div>
                          <div className="attractions-day-item-meta">
                            <span>
                              ~{attraction.distance.toFixed(1)} km from route
                            </span>
                          </div>
                        </a>
                      ) : (
                        <div className="attractions-day-item-main">
                          <span className="attractions-day-item-name">{attraction.name}</span>
                          {attraction.type && (
                            <span className="attractions-day-item-type">
                              {attraction.type.charAt(0).toUpperCase() + attraction.type.slice(1)}
                            </span>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null
          )}
        </div>
      ) : (
        <div className="attractions-placeholder">
          <div className="attractions-icon">🎯</div>
          <p className="attractions-note">
            Click &quot;Find attractions along route&quot; to see suggested stops for each day of your trip.
          </p>
        </div>
      )}
    </div>
  );
};

