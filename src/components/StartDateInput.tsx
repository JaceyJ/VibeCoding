import React from 'react';
import './StartDateInput.css';

interface StartDateInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * StartDateInput Component
 * Single Responsibility: Handles date input field rendering and value changes
 */
export const StartDateInput: React.FC<StartDateInputProps> = ({
  label,
  value,
  onChange
}) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  // Get today's date in YYYY-MM-DD format for min attribute
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="start-date-input-container">
      <label htmlFor="start-date" className="start-date-label">
        {label}
      </label>
      <input
        id="start-date"
        type="date"
        className="start-date-input"
        value={value}
        onChange={handleChange}
        min={today}
      />
    </div>
  );
};

