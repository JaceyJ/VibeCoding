import React from 'react';
import { TripType } from './TripTypeSelector';
import './AttractionsTab.css';

interface AttractionsTabProps {
  tripType: TripType;
}

/**
 * AttractionsTab Component
 * Single Responsibility: Displays attractions tab content (placeholder for future functionality)
 */
export const AttractionsTab: React.FC<AttractionsTabProps> = ({ tripType }) => {
  return (
    <div className="attractions-tab-container">
      <div className="attractions-placeholder">
        <div className="attractions-icon">🎯</div>
        <h3 className="attractions-title">Attractions</h3>
        <p className="attractions-description">
          Attractions along your route will be displayed here.
        </p>
        <p className="attractions-note">
          This feature will show points of interest and attractions based on your route.
        </p>
      </div>
    </div>
  );
};

