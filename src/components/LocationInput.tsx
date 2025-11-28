import React from 'react';
import './LocationInput.css';

interface LocationInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * LocationInput Component
 * Single Responsibility: Handles location input field rendering and value changes
 */
export const LocationInput: React.FC<LocationInputProps> = ({
  label,
  value,
  onChange,
  placeholder = 'Enter location'
}) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className="location-input-container">
      <label htmlFor={label.toLowerCase().replace(/\s+/g, '-')} className="location-label">
        {label}
      </label>
      <input
        id={label.toLowerCase().replace(/\s+/g, '-')}
        type="text"
        className="location-input"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
      />
    </div>
  );
};


