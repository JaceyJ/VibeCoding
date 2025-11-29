import React, { useState } from 'react';
import { AutocompleteLocationInput } from './AutocompleteLocationInput';
import { StartDateInput } from './StartDateInput';
import { DrivingTimeInput } from './DrivingTimeInput';
import { PlanTripButton } from './PlanTripButton';
import { TripTypeSelector, TripType } from './TripTypeSelector';
import { LodgingSettingsModal } from './LodgingSettingsModal';
import type { LodgingType } from '../services/OvernightStopService';
import './TripPlanningForm.css';

export interface TripPlanningFormData {
  startLocation: string;
  endLocation: string;
  startDate: string;
  tripType: TripType;
  lodgingType: LodgingType;
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
    startDate: '',
    tripType: 'all',
    lodgingType: 'hotel',
    minDailyDrivingTime: 4,
    maxDailyDrivingTime: 8
  });
  const [isLodgingSettingsOpen, setIsLodgingSettingsOpen] = useState(false);

  const handleStartLocationChange = (value: string) => {
    setFormData(prev => ({ ...prev, startLocation: value }));
  };

  const handleEndLocationChange = (value: string) => {
    setFormData(prev => ({ ...prev, endLocation: value }));
  };

  const handleStartDateChange = (value: string) => {
    setFormData(prev => ({ ...prev, startDate: value }));
  };

  const handleTripTypeChange = (tripType: TripType) => {
    setFormData(prev => ({ ...prev, tripType }));
  };

  const handleLodgingTypeChange = (lodgingType: LodgingType) => {
    setFormData(prev => ({ ...prev, lodgingType }));
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
        <StartDateInput
          label="Start Date"
          value={formData.startDate}
          onChange={handleStartDateChange}
        />
        <TripTypeSelector
          value={formData.tripType}
          onChange={handleTripTypeChange}
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
        <div className="advanced-settings-row">
          <button
            type="button"
            className="advanced-settings-link"
            onClick={() => setIsLodgingSettingsOpen(true)}
          >
            Advanced settings
          </button>
          <span className="advanced-settings-summary">
            {formData.lodgingType === 'hotel'
              ? 'Overnight stays: Hotels'
              : 'Overnight stays: Campsites'}
          </span>
        </div>
      </form>
      <LodgingSettingsModal
        isOpen={isLodgingSettingsOpen}
        onClose={() => setIsLodgingSettingsOpen(false)}
        value={formData.lodgingType}
        onChange={handleLodgingTypeChange}
      />
    </div>
  );
};

