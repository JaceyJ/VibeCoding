import React from 'react';
import { Hotel } from '../services/HotelService';
import './HotelResult.css';

interface HotelResultProps {
  hotel: Hotel;
  index: number;
  numberOfDays?: number;
}

/**
 * HotelResult Component
 * Single Responsibility: Displays a single hotel search result
 */
export const HotelResult: React.FC<HotelResultProps> = ({ hotel, index, numberOfDays = 1 }) => {
  const formatDistance = (km: number): string => {
    const miles = km * 0.621371;
    return `${miles.toFixed(1)} mi`;
  };

  const formatPriceRange = (range?: { min: number; max: number; currency: string }): string => {
    if (!range) return 'Price not available';
    const perNight = numberOfDays > 1 ? ' per night' : '';
    return `$${range.min.toLocaleString()} - $${range.max.toLocaleString()}${perNight}`;
  };

  return (
    <div className="hotel-result">
      <div className="hotel-result-header">
        <div className="hotel-rank">{index + 1}</div>
        <div className="hotel-info">
          <h4 className="hotel-name">{hotel.name}</h4>
          <p className="hotel-address">{hotel.address}</p>
        </div>
      </div>
      <div className="hotel-result-details">
        {hotel.estimatedPriceRange && (
          <div className="hotel-detail-item hotel-price-range">
            <span className="hotel-detail-label">Price:</span>
            <span className="hotel-detail-value hotel-price">{formatPriceRange(hotel.estimatedPriceRange)}</span>
          </div>
        )}
        <div className="hotel-detail-item">
          <span className="hotel-detail-label">Distance:</span>
          <span className="hotel-detail-value">{formatDistance(hotel.distance)}</span>
        </div>
      </div>
      <div className="hotel-actions">
        {hotel.url && (
          <a
            href={hotel.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hotel-link hotel-link-primary"
          >
            Check Prices on Booking.com →
          </a>
        )}
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${hotel.lat},${hotel.lon}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hotel-link"
        >
          View on Map →
        </a>
      </div>
    </div>
  );
};

