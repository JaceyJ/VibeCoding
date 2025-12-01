import React from 'react';
import './TripTypeSelector.css';

export type TripType = 
  | 'family-friendly'
  | 'outdoors-adventure'
  | 'cultural'
  | 'relaxation'
  | 'nightlife'
  | 'shopping'
  | 'all';

export interface TripTypeOption {
  value: TripType;
  label: string;
  icon: string;
  description: string;
}

export const TRIP_TYPE_OPTIONS: TripTypeOption[] = [
  {
    value: 'family-friendly',
    label: 'Family Friendly',
    icon: '👨‍👩‍👧‍👦',
    description: 'Parks, playgrounds, kid-friendly attractions'
  },
  {
    value: 'outdoors-adventure',
    label: 'Outdoors & Adventure',
    icon: '🏔️',
    description: 'Hiking, nature, parks, outdoor activities, extreme sports'
  },
  {
    value: 'cultural',
    label: 'Cultural',
    icon: '🎭',
    description: 'Museums, galleries, historic sites, theaters'
  },
  {
    value: 'relaxation',
    label: 'Relaxation',
    icon: '🌴',
    description: 'Spas, beaches, scenic spots, wellness'
  },
  {
    value: 'nightlife',
    label: 'Nightlife',
    icon: '🌃',
    description: 'Bars, clubs, entertainment venues'
  },
  {
    value: 'shopping',
    label: 'Shopping',
    icon: '🛍️',
    description: 'Malls, markets, shopping districts'
  },
  {
    value: 'all',
    label: 'All Types',
    icon: '🌟',
    description: 'Show all types of attractions and activities'
  }
];

interface TripTypeSelectorProps {
  value: TripType;
  onChange: (tripType: TripType) => void;
}

/**
 * TripTypeSelector Component
 * Single Responsibility: Allows user to select trip type preference
 */
export const TripTypeSelector: React.FC<TripTypeSelectorProps> = ({ value, onChange }) => {
  return (
    <div className="trip-type-selector">
      <label className="trip-type-label">
        Trip Type <span className="optional-text">(Optional)</span>
      </label>
      <p className="trip-type-hint">
        Select your preferred trip type to personalize recommendations
      </p>
      <div className="trip-type-options">
        {TRIP_TYPE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`trip-type-option ${value === option.value ? 'selected' : ''}`}
            onClick={() => onChange(option.value)}
            title={option.description}
          >
            <span className="trip-type-icon">{option.icon}</span>
            <span className="trip-type-label-text">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

