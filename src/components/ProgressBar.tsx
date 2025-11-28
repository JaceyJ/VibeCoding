import React from 'react';
import './ProgressBar.css';

interface ProgressBarProps {
  progress: number; // 0-100
  message: string;
  showPercentage?: boolean;
}

/**
 * ProgressBar Component
 * Single Responsibility: Displays progress bar with message
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  message,
  showPercentage = true
}) => {
  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div className="progress-bar-container">
      <div className="progress-bar-header">
        <span className="progress-bar-message">{message}</span>
        {showPercentage && (
          <span className="progress-bar-percentage">{Math.round(clampedProgress)}%</span>
        )}
      </div>
      <div className="progress-bar-track">
        <div
          className="progress-bar-fill"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
};


