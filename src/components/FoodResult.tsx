import React from 'react';
import { FoodPlace } from '../services/FoodService';
import './FoodResult.css';

interface FoodResultProps {
  foodPlace: FoodPlace;
  index: number;
  selectedPriceLevel?: 1 | 2 | 3 | 4; // User's selected price level from search
}

/**
 * FoodResult Component
 * Single Responsibility: Displays a single food place search result
 */
export const FoodResult: React.FC<FoodResultProps> = ({ foodPlace, index, selectedPriceLevel }) => {
  const formatDistance = (km: number): string => {
    const miles = km * 0.621371;
    return `${miles.toFixed(1)} mi`;
  };

  const renderPriceLevel = (level?: number, userSelected?: number): string => {
    // If restaurant has a price level, use it; otherwise use user's selected price level
    const displayLevel = level || userSelected;
    if (!displayLevel) return 'N/A';
    return '$'.repeat(displayLevel);
  };

  const getVenueTypeLabel = (type: string): string => {
    switch (type) {
      case 'fast-food':
        return 'Fast Food';
      case 'restaurant':
        return 'Restaurant';
      default:
        return 'Food Place';
    }
  };

  return (
    <div className="food-result">
      <div className="food-result-header">
        <div className="food-rank">{index + 1}</div>
        <div className="food-info">
          <h4 className="food-name">{foodPlace.name}</h4>
          <p className="food-address">{foodPlace.address}</p>
        </div>
      </div>
      <div className="food-result-details">
        <div className="food-detail-item">
          <span className="food-detail-label">Type:</span>
          <span className="food-detail-value">{getVenueTypeLabel(foodPlace.venueType)}</span>
        </div>
        <div className="food-detail-item">
          <span className="food-detail-label">Price:</span>
          <span className="food-detail-value">{renderPriceLevel(foodPlace.priceLevel, selectedPriceLevel)}</span>
        </div>
        {foodPlace.cuisine && (
          <div className="food-detail-item">
            <span className="food-detail-label">Cuisine:</span>
            <span className="food-detail-value">{foodPlace.cuisine.charAt(0).toUpperCase() + foodPlace.cuisine.slice(1)}</span>
          </div>
        )}
        <div className="food-detail-item">
          <span className="food-detail-label">Distance:</span>
          <span className="food-detail-value">{formatDistance(foodPlace.distance)}</span>
        </div>
      </div>
      <div className="food-actions">
        {foodPlace.url && (
          <a
            href={foodPlace.url}
            target="_blank"
            rel="noopener noreferrer"
            className="food-link"
          >
            View on Map →
          </a>
        )}
      </div>
    </div>
  );
};


