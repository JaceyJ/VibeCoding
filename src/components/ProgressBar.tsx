import React, { useState, useEffect, useRef } from 'react';
import './ProgressBar.css';

interface ProgressBarProps {
  progress: number; // 0-100
  message: string;
  showPercentage?: boolean;
}

/**
 * ProgressBar Component
 * Single Responsibility: Displays progress bar with message
 * Ensures progress only moves forward (never backward)
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  message,
  showPercentage = true
}) => {
  const [displayProgress, setDisplayProgress] = useState(0);
  const maxProgressRef = useRef(0);

  useEffect(() => {
    const clampedProgress = Math.max(0, Math.min(100, progress));
    
    // Only update if the new progress is greater than the current maximum
    if (clampedProgress > maxProgressRef.current) {
      maxProgressRef.current = clampedProgress;
      setDisplayProgress(clampedProgress);
    }
  }, [progress]);

  // Reset when progress is reset to 0 (new calculation starting)
  useEffect(() => {
    if (progress === 0) {
      maxProgressRef.current = 0;
      setDisplayProgress(0);
    }
  }, [progress]);

  return (
    <div className="progress-bar-container">
      <div className="progress-bar-header">
        <div className="progress-bar-message-wrapper">
          <span className="progress-bar-message">{message}</span>
          <div className="progress-bar-dots">
            <span className="progress-dot"></span>
            <span className="progress-dot"></span>
            <span className="progress-dot"></span>
          </div>
        </div>
        {showPercentage && (
          <span className="progress-bar-percentage">{Math.round(displayProgress)}%</span>
        )}
      </div>
      <div className="progress-bar-track">
        <div
          className="progress-bar-fill"
          style={{ width: `${displayProgress}%` }}
        >
          <div className="progress-bar-shine"></div>
        </div>
      </div>
    </div>
  );
};



