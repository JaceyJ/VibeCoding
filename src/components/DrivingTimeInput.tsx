import React from 'react';
import './DrivingTimeInput.css';

interface DrivingTimeInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

/**
 * DrivingTimeInput Component
 * Single Responsibility: Handles numeric input for driving time with increment/decrement controls
 */
export const DrivingTimeInput: React.FC<DrivingTimeInputProps> = ({
  label,
  value,
  onChange,
  min = 0,
  max = 24,
  step = 0.5,
  unit = 'hours'
}) => {
  const handleIncrement = () => {
    const newValue = Math.min(value + step, max);
    onChange(newValue);
  };

  const handleDecrement = () => {
    const newValue = Math.max(value - step, min);
    onChange(newValue);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = parseFloat(event.target.value) || 0;
    const clampedValue = Math.max(min, Math.min(inputValue, max));
    onChange(clampedValue);
  };

  return (
    <div className="driving-time-input-container">
      <label htmlFor={label.toLowerCase().replace(/\s+/g, '-')} className="driving-time-label">
        {label}
      </label>
      <div className="driving-time-input-wrapper">
        <button
          type="button"
          className="driving-time-button driving-time-button-down"
          onClick={handleDecrement}
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4 6L8 10L12 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div className="driving-time-input-inner">
          <input
            id={label.toLowerCase().replace(/\s+/g, '-')}
            type="number"
            className="driving-time-input"
            value={value}
            onChange={handleInputChange}
            min={min}
            max={max}
            step={step}
          />
          <span className="driving-time-unit">{unit}</span>
        </div>
        <button
          type="button"
          className="driving-time-button driving-time-button-up"
          onClick={handleIncrement}
          aria-label={`Increase ${label}`}
          disabled={value >= max}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4 10L8 6L12 10"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};


