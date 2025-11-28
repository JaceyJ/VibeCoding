import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LocationService, LocationSuggestion } from '../services/LocationService';
import './AutocompleteLocationInput.css';

interface AutocompleteLocationInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * AutocompleteLocationInput Component
 * Single Responsibility: Handles location input with autocomplete suggestions
 * Open/Closed: Extensible through props without modification
 */
export const AutocompleteLocationInput: React.FC<AutocompleteLocationInputProps> = ({
  label,
  value,
  onChange,
  placeholder = 'Enter location'
}) => {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Debounced search function
  const debouncedSearch = useCallback(
    LocationService.debounce(async (query: string) => {
      if (query.trim().length < 2) {
        setSuggestions([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const results = await LocationService.searchLocations(query);
      setSuggestions(results);
      setIsLoading(false);
    }, 300),
    []
  );

  useEffect(() => {
    debouncedSearch(value);
  }, [value, debouncedSearch]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    onChange(newValue);
    setShowSuggestions(true);
    setSelectedIndex(-1);
  };

  const handleSuggestionClick = (suggestion: LocationSuggestion) => {
    onChange(suggestion.fullAddress);
    setShowSuggestions(false);
    setSuggestions([]);
    inputRef.current?.blur();
  };

  const handleInputFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleInputBlur = () => {
    // Delay to allow click events on suggestions to fire
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        event.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionClick(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  const inputId = label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="autocomplete-location-container">
      <label htmlFor={inputId} className="autocomplete-location-label">
        {label}
      </label>
      <div className="autocomplete-location-wrapper">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          className="autocomplete-location-input"
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
        />
        {isLoading && (
          <div className="autocomplete-loading-indicator">
            <div className="spinner"></div>
          </div>
        )}
        {showSuggestions && suggestions.length > 0 && (
          <div ref={suggestionsRef} className="autocomplete-suggestions">
            {suggestions.map((suggestion, index) => (
              <div
                key={`${suggestion.lat}-${suggestion.lon}-${index}`}
                className={`autocomplete-suggestion ${
                  index === selectedIndex ? 'selected' : ''
                }`}
                onClick={() => handleSuggestionClick(suggestion)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="suggestion-display-name">{suggestion.displayName}</div>
                <div className="suggestion-full-address">{suggestion.fullAddress}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};


