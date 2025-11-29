import React from 'react';
import './Toggle.css';

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: string;
}

/**
 * Toggle Component
 * Single Responsibility: Renders a toggle switch for boolean options
 */
export const Toggle: React.FC<ToggleProps> = ({
  label,
  checked,
  onChange,
  icon
}) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.checked);
  };

  return (
    <label className="toggle-container">
      <div className="toggle-label-content">
        {icon && <span className="toggle-icon">{icon}</span>}
        <span className="toggle-label">{label}</span>
      </div>
      <div className="toggle-switch-wrapper">
        <input
          type="checkbox"
          className="toggle-input"
          checked={checked}
          onChange={handleChange}
        />
        <span className={`toggle-slider ${checked ? 'checked' : ''}`} />
      </div>
    </label>
  );
};

