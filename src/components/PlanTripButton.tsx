import React from 'react';
import './PlanTripButton.css';

interface PlanTripButtonProps {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}

/**
 * PlanTripButton Component
 * Single Responsibility: Renders the trip planning action button
 */
export const PlanTripButton: React.FC<PlanTripButtonProps> = ({
  onClick,
  disabled = false,
  label = 'Plan Trip'
}) => {
  return (
    <button
      type="button"
      className="plan-trip-button"
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
};



