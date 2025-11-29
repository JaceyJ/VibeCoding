import React, { useState } from 'react';
import './HotelSearchModal.css';

export interface HotelSearchParams {
  budget: '$' | '$$' | '$$$' | '$$$$';
  numberOfGuests: number;
  extendStay: boolean;
  numberOfDays?: number;
}

interface HotelSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (params: HotelSearchParams) => void;
  cityName: string;
}

/**
 * HotelSearchModal Component
 * Single Responsibility: Collects hotel search parameters from user
 */
export const HotelSearchModal: React.FC<HotelSearchModalProps> = ({
  isOpen,
  onClose,
  onSearch,
  cityName
}) => {
  const [budget, setBudget] = useState<'$' | '$$' | '$$$' | '$$$$'>('$$');
  const [numberOfGuests, setNumberOfGuests] = useState<number>(2);
  const [extendStay, setExtendStay] = useState<boolean>(false);
  const [numberOfDays, setNumberOfDays] = useState<number>(1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params: HotelSearchParams = {
      budget,
      numberOfGuests,
      extendStay,
      numberOfDays: extendStay ? numberOfDays : undefined
    };
    onSearch(params);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Search Hotels in {cityName}</h2>
          <button className="modal-close-button" onClick={handleCancel}>
            ×
          </button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="budget" className="form-label">
              Budget
            </label>
            <div className="budget-options">
              {(['$', '$$', '$$$', '$$$$'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`budget-option ${budget === option ? 'selected' : ''}`}
                  onClick={() => setBudget(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="guests" className="form-label">
              Number of Guests
            </label>
            <input
              id="guests"
              type="number"
              className="form-input"
              min="1"
              max="10"
              value={numberOfGuests}
              onChange={(e) => setNumberOfGuests(parseInt(e.target.value) || 1)}
              required
            />
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={extendStay}
                onChange={(e) => setExtendStay(e.target.checked)}
                className="checkbox-input"
              />
              <span className="checkbox-text">Extend your stay?</span>
            </label>
          </div>

          {extendStay && (
            <div className="form-group">
              <label htmlFor="days" className="form-label">
                Number of Days
              </label>
              <input
                id="days"
                type="number"
                className="form-input"
                min="1"
                max="30"
                value={numberOfDays}
                onChange={(e) => setNumberOfDays(parseInt(e.target.value) || 1)}
                required={extendStay}
              />
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="button-secondary" onClick={handleCancel}>
              Cancel
            </button>
            <button type="submit" className="button-primary">
              Search
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

