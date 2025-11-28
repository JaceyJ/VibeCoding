import React, { useState } from 'react';
import { AutocompleteLocationInput } from './AutocompleteLocationInput';
import { DrivingTimeInput } from './DrivingTimeInput';
import { PlanTripButton } from './PlanTripButton';
import './TripPlanningForm.css';

export interface TripPlanningFormData {
  startLocation: string;
  endLocation: string;
  minDailyDrivingTime: number;
  maxDailyDrivingTime: number;
}

interface TripPlanningFormProps {
  onSubmit?: (data: TripPlanningFormData) => void;
}

/**
 * TripPlanningForm Component
 * Single Responsibility: Manages form state and coordinates child components
 * Open/Closed: Extensible through onSubmit prop without modification
 */
export const TripPlanningForm: React.FC<TripPlanningFormProps> = ({
  onSubmit
}) => {
  const [formData, setFormData] = useState<TripPlanningFormData>({
    startLocation: '',
    endLocation: '',
    minDailyDrivingTime: 4,
    maxDailyDrivingTime: 8
  });

  const handleStartLocationChange = (value: string) => {
    setFormData(prev => ({ ...prev, startLocation: value }));
  };

  const handleEndLocationChange = (value: string) => {
    setFormData(prev => ({ ...prev, endLocation: value }));
  };

  const handleMinDrivingTimeChange = (value: number) => {
    setFormData(prev => ({ ...prev, minDailyDrivingTime: value }));
  };

  const handleMaxDrivingTimeChange = (value: number) => {
    setFormData(prev => ({ ...prev, maxDailyDrivingTime: value }));
  };

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit(formData);
    } else {
      // Placeholder for future backend integration
      console.log('Trip planning data:', formData);
    }
  };

  const isFormValid = () => {
    return (
      formData.startLocation.trim() !== '' &&
      formData.endLocation.trim() !== '' &&
      formData.minDailyDrivingTime > 0 &&
      formData.maxDailyDrivingTime > 0 &&
      formData.minDailyDrivingTime <= formData.maxDailyDrivingTime
    );
  };

  return (
    <div className="trip-planning-form-container">
      <h1 className="trip-planning-form-title">Plan Your Trip</h1>
      <form
        className="trip-planning-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <AutocompleteLocationInput
          label="Start Location"
          value={formData.startLocation}
          onChange={handleStartLocationChange}
          placeholder="Enter starting location"
        />
        <AutocompleteLocationInput
          label="End Location"
          value={formData.endLocation}
          onChange={handleEndLocationChange}
          placeholder="Enter destination"
        />
        <DrivingTimeInput
          label="Minimum Daily Driving Time"
          value={formData.minDailyDrivingTime}
          onChange={handleMinDrivingTimeChange}
          min={0.5}
          max={formData.maxDailyDrivingTime}
          step={0.5}
          unit="hours"
        />
        <DrivingTimeInput
          label="Maximum Daily Driving Time"
          value={formData.maxDailyDrivingTime}
          onChange={handleMaxDrivingTimeChange}
          min={formData.minDailyDrivingTime}
          max={24}
          step={0.5}
          unit="hours"
        />
        <PlanTripButton
          onClick={handleSubmit}
          disabled={!isFormValid()}
        />
      </form>
    </div>
  );
};

