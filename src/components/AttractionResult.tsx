import React from 'react';
import { Attraction } from '../services/AttractionService';
import './AttractionResult.css';

interface AttractionResultProps {
  attraction: Attraction;
  index: number;
}

/**
 * AttractionResult Component
 * Single Responsibility: Displays a single attraction search result
 */
export const AttractionResult: React.FC<AttractionResultProps> = ({ attraction, index }) => {
  const formatDistance = (km: number): string => {
    const miles = km * 0.621371;
    return `${miles.toFixed(1)} mi`;
  };

  const getTypeLabel = (type: string): string => {
    return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
  };

  return (
    <div className="attraction-result">
      <div className="attraction-result-header">
        <div className="attraction-rank">{index + 1}</div>
        <div className="attraction-info">
          <h4 className="attraction-name">{attraction.name}</h4>
          <p className="attraction-address">{attraction.address}</p>
        </div>
      </div>
      <div className="attraction-result-details">
        <div className="attraction-detail-item">
          <span className="attraction-detail-label">Type:</span>
          <span className="attraction-detail-value">{getTypeLabel(attraction.type)}</span>
        </div>
        {attraction.category && (
          <div className="attraction-detail-item">
            <span className="attraction-detail-label">Category:</span>
            <span className="attraction-detail-value">{attraction.category}</span>
          </div>
        )}
        <div className="attraction-detail-item">
          <span className="attraction-detail-label">Distance:</span>
          <span className="attraction-detail-value">{formatDistance(attraction.distance)}</span>
        </div>
      </div>
      {attraction.description && (
        <p className="attraction-description">{attraction.description}</p>
      )}
      <div className="attraction-actions">
        {attraction.url && (
          <a
            href={attraction.url}
            target="_blank"
            rel="noopener noreferrer"
            className="attraction-link"
          >
            View on Map →
          </a>
        )}
      </div>
    </div>
  );
};


