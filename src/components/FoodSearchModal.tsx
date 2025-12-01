import React, { useState } from 'react';
import './FoodSearchModal.css';

export interface FoodSearchParams {
  venueType: 'fast-food' | 'restaurant' | 'both';
  priceLevel: 1 | 2 | 3 | 4; // $, $$, $$$, $$$$
  mealTypes: {
    breakfast: boolean;
    lunch: boolean;
    dinner: boolean;
  };
}

interface FoodSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (params: FoodSearchParams) => void;
  checkInDate?: string;
}

/**
 * FoodSearchModal Component
 * Single Responsibility: Collects food search parameters from user
 */
export const FoodSearchModal: React.FC<FoodSearchModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  checkInDate
}) => {
  const [venueType, setVenueType] = useState<'fast-food' | 'restaurant' | 'both'>('both');
  const [priceLevel, setPriceLevel] = useState<1 | 2 | 3 | 4>(2);
  const [mealTypes, setMealTypes] = useState({
    breakfast: false,
    lunch: false,
    dinner: false
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      venueType,
      priceLevel,
      mealTypes
    });
    onClose();
  };

  const handleMealTypeChange = (type: keyof typeof mealTypes) => {
    setMealTypes(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  const allMealTypesSelected = mealTypes.breakfast && mealTypes.lunch && mealTypes.dinner;
  const noMealTypesSelected = !mealTypes.breakfast && !mealTypes.lunch && !mealTypes.dinner;

  return (
    <div className="food-modal-overlay" onClick={onClose}>
      <div className="food-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="food-modal-header">
          <h2>Search for Food & Restaurants</h2>
          <button className="food-modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="food-modal-form">
          {checkInDate && (
            <div className="food-modal-info">
              <p>Searching for: <strong>{checkInDate}</strong></p>
            </div>
          )}

          <div className="food-modal-field">
            <label className="food-modal-label">Venue Type</label>
            <div className="food-modal-radio-group">
              <label className="food-modal-radio">
                <input
                  type="radio"
                  value="fast-food"
                  checked={venueType === 'fast-food'}
                  onChange={(e) => setVenueType(e.target.value as 'fast-food')}
                />
                <span>Fast Food</span>
              </label>
              <label className="food-modal-radio">
                <input
                  type="radio"
                  value="restaurant"
                  checked={venueType === 'restaurant'}
                  onChange={(e) => setVenueType(e.target.value as 'restaurant')}
                />
                <span>Restaurant</span>
              </label>
              <label className="food-modal-radio">
                <input
                  type="radio"
                  value="both"
                  checked={venueType === 'both'}
                  onChange={(e) => setVenueType(e.target.value as 'both')}
                />
                <span>Both</span>
              </label>
            </div>
          </div>

          <div className="food-modal-field">
            <label className="food-modal-label">Price Level</label>
            <div className="food-modal-price-buttons">
              {[1, 2, 3, 4].map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`food-modal-price-btn ${priceLevel === level ? 'active' : ''}`}
                  onClick={() => setPriceLevel(level as 1 | 2 | 3 | 4)}
                >
                  {'$'.repeat(level)}
                </button>
              ))}
            </div>
          </div>

          <div className="food-modal-field">
            <label className="food-modal-label">Meal Types (Optional)</label>
            <div className="food-modal-checkbox-group">
              <label className="food-modal-checkbox">
                <input
                  type="checkbox"
                  checked={mealTypes.breakfast}
                  onChange={() => handleMealTypeChange('breakfast')}
                />
                <span>Breakfast</span>
              </label>
              <label className="food-modal-checkbox">
                <input
                  type="checkbox"
                  checked={mealTypes.lunch}
                  onChange={() => handleMealTypeChange('lunch')}
                />
                <span>Lunch</span>
              </label>
              <label className="food-modal-checkbox">
                <input
                  type="checkbox"
                  checked={mealTypes.dinner}
                  onChange={() => handleMealTypeChange('dinner')}
                />
                <span>Dinner</span>
              </label>
            </div>
            <p className="food-modal-hint">
              {noMealTypesSelected 
                ? 'Select meal types to filter results, or leave all unchecked to see all options'
                : allMealTypesSelected
                ? 'All meal types selected'
                : 'Some meal types selected'}
            </p>
          </div>

          <div className="food-modal-actions">
            <button type="button" className="food-modal-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="food-modal-submit">
              Search
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


