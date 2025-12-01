import React from 'react';
import './HotelSearchModal.css'; // Reuse existing modal styles
import { Toggle } from './Toggle';
import type { LodgingType } from '../services/OvernightStopService';

interface LodgingSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  value: LodgingType;
  onChange: (value: LodgingType) => void;
}

/**
 * LodgingSettingsModal Component
 * Single Responsibility: Configure advanced lodging preferences (hotel vs campsite)
 */
export const LodgingSettingsModal: React.FC<LodgingSettingsModalProps> = ({
  isOpen,
  onClose,
  value,
  onChange
}) => {
  if (!isOpen) return null;

  const handleToggleChange = (useCampsites: boolean) => {
    onChange(useCampsites ? 'campsite' : 'hotel');
  };

  const handleOverlayClick = () => {
    onClose();
  };

  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const isCampsite = value === 'campsite';

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content" onClick={handleContentClick}>
        <div className="modal-header">
          <h2 className="modal-title">Advanced Settings</h2>
          <button className="modal-close-button" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <p style={{ marginBottom: '1rem', color: '#4b5563', fontSize: '0.9rem' }}>
            Choose your preferred type of overnight stay. This preference will be used when suggesting
            places to stay along your route.
          </p>
          <div style={{ marginBottom: '1rem' }}>
            <Toggle
              label={isCampsite ? 'Prefer campsites for overnight stays' : 'Prefer hotels for overnight stays'}
              checked={isCampsite}
              onChange={handleToggleChange}
              icon={isCampsite ? '⛺' : '🏨'}
            />
          </div>
          <p style={{ fontSize: '0.8rem', color: '#6b7280' }}>
            When enabled, suggested overnight stops will prioritize campgrounds and camping-friendly locations
            instead of hotels (where available).
          </p>
        </div>
        <div className="modal-actions">
          <button type="button" className="button-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};


