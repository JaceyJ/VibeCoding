import React, { useState } from 'react';
import { OvernightStop, LodgingType } from '../services/OvernightStopService';
import { HotelSearchModal, HotelSearchParams } from './HotelSearchModal';
import { searchHotels, Hotel, calculateCheckInDate } from '../services/HotelService';
import { CampsiteService } from '../services/CampsiteService';
import { HotelResult } from './HotelResult';
import { FoodSearchModal, FoodSearchParams } from './FoodSearchModal';
import { FoodService, FoodPlace } from '../services/FoodService';
import { FoodResult } from './FoodResult';
import { AttractionService, Attraction } from '../services/AttractionService';
import { AttractionResult } from './AttractionResult';
import { TripType } from './TripTypeSelector';
import './OvernightStopsList.css';

interface OvernightStopsListProps {
  stops: OvernightStop[];
  startDate: string;
  tripType: TripType;
  lodgingType: LodgingType;
}

type CategoryTab = 'hotels' | 'food' | 'attractions';

/**
 * OvernightStopsList Component
 * Single Responsibility: Displays list of overnight stops with expandable sections and category tabs
 */
export const OvernightStopsList: React.FC<OvernightStopsListProps> = ({
  stops,
  startDate,
  tripType,
  lodgingType
}) => {
  const [expandedStops, setExpandedStops] = useState<Set<number>>(new Set());
  const [activeCategory, setActiveCategory] = useState<Map<number, CategoryTab>>(
    new Map(stops.map(stop => [stop.day, 'hotels']))
  );
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [currentStopDay, setCurrentStopDay] = useState<number | null>(null);
  const [hotelResults, setHotelResults] = useState<Map<number, Hotel[]>>(new Map());
  const [isSearchingHotels, setIsSearchingHotels] = useState<Map<number, boolean>>(new Map());
  const [hotelSearchParams, setHotelSearchParams] = useState<Map<number, HotelSearchParams>>(new Map());
  
  // Food search state
  const [isFoodModalOpen, setIsFoodModalOpen] = useState<boolean>(false);
  const [currentFoodStopDay, setCurrentFoodStopDay] = useState<number | null>(null);
  const [foodResults, setFoodResults] = useState<Map<number, FoodPlace[]>>(new Map());
  const [isSearchingFood, setIsSearchingFood] = useState<Map<number, boolean>>(new Map());
  const [foodSearchParams, setFoodSearchParams] = useState<Map<number, FoodSearchParams>>(new Map());
  
  // Attraction search state
  const [attractionResults, setAttractionResults] = useState<Map<number, Attraction[]>>(new Map());
  const [isSearchingAttractions, setIsSearchingAttractions] = useState<Map<number, boolean>>(new Map());

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatDistance = (km: number): string => {
    return `${km.toFixed(1)} km`;
  };

  const toggleExpanded = (day: number) => {
    const newExpanded = new Set(expandedStops);
    if (newExpanded.has(day)) {
      newExpanded.delete(day);
    } else {
      newExpanded.add(day);
    }
    setExpandedStops(newExpanded);
  };

  const setCategory = (day: number, category: CategoryTab) => {
    const newActiveCategory = new Map(activeCategory);
    newActiveCategory.set(day, category);
    setActiveCategory(newActiveCategory);
  };

  const handleSearch = (day: number) => {
    const category = activeCategory.get(day) || 'hotels';
    console.log(`[OvernightStopsList] handleSearch called for day ${day}, category: ${category}`);
    
    if (category === 'hotels') {
      setCurrentStopDay(day);
      setIsModalOpen(true);
      console.log(`[OvernightStopsList] Opening hotel modal for day ${day}`);
    } else if (category === 'food') {
      setCurrentFoodStopDay(day);
      setIsFoodModalOpen(true);
      console.log(`[OvernightStopsList] Opening food modal for day ${day}`);
    } else if (category === 'attractions') {
      handleAttractionSearch(day);
      console.log(`[OvernightStopsList] Searching attractions for day ${day}`);
    }
  };

  const handleAttractionSearch = async (day: number) => {
    const stop = stops.find(s => s.day === day);
    if (!stop) return;

    setIsSearchingAttractions(prev => {
      const newMap = new Map(prev);
      newMap.set(day, true);
      return newMap;
    });

    try {
      const center = { lat: stop.city.lat, lon: stop.city.lon };
      console.log(`[OvernightStopsList] Searching attractions for day ${day} with trip type: ${tripType}`);
      
      const attractions = await AttractionService.searchAttractions(
        center,
        { tripType },
        25 // 25km radius
      );
      
      setAttractionResults(prev => {
        const newMap = new Map(prev);
        newMap.set(day, attractions);
        return newMap;
      });

      console.log(`[OvernightStopsList] Found ${attractions.length} attractions for day ${day}`);
    } catch (error) {
      console.error(`[OvernightStopsList] Error searching attractions:`, error);
    } finally {
      setIsSearchingAttractions(prev => {
        const newMap = new Map(prev);
        newMap.set(day, false);
        return newMap;
      });
    }
  };

  const handleHotelSearch = async (params: HotelSearchParams) => {
    if (currentStopDay === null) return;

    const stop = stops.find(s => s.day === currentStopDay);
    if (!stop) return;

    // Store search params for this stop
    setHotelSearchParams(prev => {
      const newMap = new Map(prev);
      newMap.set(currentStopDay, params);
      return newMap;
    });

    setIsSearchingHotels(prev => {
      const newMap = new Map(prev);
      newMap.set(currentStopDay, true);
      return newMap;
    });

    try {
      const center = { lat: stop.city.lat, lon: stop.city.lon };

      // When lodgingType is 'campsite', search for campsites instead of hotels.
      const results =
        lodgingType === 'campsite'
          ? await CampsiteService.searchCampsites(center, 60)
          : await searchHotels(center, params, 48.28, stop.city.placeType);

      setHotelResults(prev => {
        const newMap = new Map(prev);
        newMap.set(currentStopDay, results);
        return newMap;
      });

      console.log(
        `[OvernightStopsList] Found ${results.length} ${
          lodgingType === 'campsite' ? 'campsites' : 'hotels'
        } for day ${currentStopDay}`
      );
    } catch (error) {
      console.error(`[OvernightStopsList] Error searching hotels:`, error);
    } finally {
      setIsSearchingHotels(prev => {
        const newMap = new Map(prev);
        newMap.set(currentStopDay, false);
        return newMap;
      });
    }
  };

  const handleFoodSearch = async (params: FoodSearchParams) => {
    if (currentFoodStopDay === null) {
      console.error('[OvernightStopsList] handleFoodSearch: currentFoodStopDay is null');
      return;
    }

    const stop = stops.find(s => s.day === currentFoodStopDay);
    if (!stop) {
      console.error(`[OvernightStopsList] handleFoodSearch: Stop not found for day ${currentFoodStopDay}`);
      return;
    }

    console.log(`[OvernightStopsList] Starting food search for day ${currentFoodStopDay}`, params);

    // Store search params for this stop
    setFoodSearchParams(prev => {
      const newMap = new Map(prev);
      newMap.set(currentFoodStopDay, params);
      return newMap;
    });

    setIsSearchingFood(prev => {
      const newMap = new Map(prev);
      newMap.set(currentFoodStopDay, true);
      return newMap;
    });

    try {
      const center = { lat: stop.city.lat, lon: stop.city.lon };
      console.log(`[OvernightStopsList] Searching food at ${center.lat}, ${center.lon}`);
      const foodPlaces = await FoodService.searchFood(center, params, 48.28, stop.city.placeType);
      
      setFoodResults(prev => {
        const newMap = new Map(prev);
        newMap.set(currentFoodStopDay, foodPlaces);
        return newMap;
      });

      console.log(`[OvernightStopsList] Found ${foodPlaces.length} food places for day ${currentFoodStopDay}`);
    } catch (error) {
      console.error(`[OvernightStopsList] Error searching food:`, error);
    } finally {
      setIsSearchingFood(prev => {
        const newMap = new Map(prev);
        newMap.set(currentFoodStopDay, false);
        return newMap;
      });
    }
  };

  const getCheckInDate = (day: number): string => {
    return calculateCheckInDate(startDate, day);
  };

  const currentStop = currentStopDay ? stops.find(s => s.day === currentStopDay) : null;
  const currentFoodStop = currentFoodStopDay ? stops.find(s => s.day === currentFoodStopDay) : null;

  return (
    <div className="overnight-stops-container">
      <h2 className="overnight-stops-title">Overnight Stops</h2>
      {currentStop && (
        <HotelSearchModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSearch={handleHotelSearch}
          cityName={currentStop.city.name}
        />
      )}
      {currentFoodStop && (
        <FoodSearchModal
          isOpen={isFoodModalOpen}
          onClose={() => setIsFoodModalOpen(false)}
          onSubmit={handleFoodSearch}
          checkInDate={startDate ? getCheckInDate(currentFoodStopDay || 1) : undefined}
        />
      )}
      <div className="overnight-stops-list">
        {stops.map((stop) => {
          const isExpanded = expandedStops.has(stop.day);

          return (
            <div key={stop.day} className="overnight-stop-card">
              <div className="stop-header" onClick={() => toggleExpanded(stop.day)}>
                <div className="stop-header-left">
                  <div className="stop-day-badge">Day {stop.day}</div>
                  <div className="stop-content-summary">
                    <h3 className="stop-city-name">{stop.city.name}</h3>
                    <p className="stop-city-full">{stop.city.displayName}</p>
                  </div>
                </div>
                <div className="stop-expand-icon">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className={isExpanded ? 'expanded' : ''}
                  >
                    <path
                      d="M5 7.5L10 12.5L15 7.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              <div className="stop-details">
                <div className="stop-detail-item">
                  <span className="stop-detail-label">Arrival Time:</span>
                  <span className="stop-detail-value">{formatTime(stop.arrivalTimeSec)}</span>
                </div>
                <div className="stop-detail-item">
                  <span className="stop-detail-label">Distance:</span>
                  <span className="stop-detail-value">{formatDistance(stop.cumulativeDistance)}</span>
                </div>
                <div className="stop-detail-item">
                  <span className="stop-detail-label">Place Type:</span>
                  <span className="stop-detail-value stop-place-type" data-place-type={stop.city.placeType || 'unknown'}>
                    {stop.city.placeType 
                      ? stop.city.placeType.charAt(0).toUpperCase() + stop.city.placeType.slice(1)
                      : 'Unknown'}
                  </span>
                </div>
              </div>

              {isExpanded && (
                <div className="stop-expanded-content">
                  <div className="stop-category-section">
                    <div className="category-header">
                      <h4 className="category-title">Explore this area:</h4>
                      <button
                        className="search-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSearch(stop.day);
                        }}
                      >
                        Search
                      </button>
                    </div>
                    <div className="category-tabs">
                      <button
                        className={`category-tab ${(activeCategory.get(stop.day) || 'hotels') === 'hotels' ? 'active' : ''}`}
                        onClick={() => setCategory(stop.day, 'hotels')}
                      >
                        <span className="category-icon">{lodgingType === 'campsite' ? '⛺' : '🏨'}</span>
                        <span className="category-label">
                          {lodgingType === 'campsite' ? 'Campsites' : 'Hotels'}
                        </span>
                      </button>
                      <button
                        className={`category-tab ${(activeCategory.get(stop.day) || 'hotels') === 'food' ? 'active' : ''}`}
                        onClick={() => setCategory(stop.day, 'food')}
                      >
                        <span className="category-icon">🍽️</span>
                        <span className="category-label">Food</span>
                      </button>
                      <button
                        className={`category-tab ${(activeCategory.get(stop.day) || 'hotels') === 'attractions' ? 'active' : ''}`}
                        onClick={() => setCategory(stop.day, 'attractions')}
                      >
                        <span className="category-icon">🎯</span>
                        <span className="category-label">Attractions</span>
                      </button>
                    </div>
                    <div className="category-content">
                      {activeCategory.get(stop.day) === 'hotels' && (
                        <div className="hotels-content">
                          {isSearchingHotels.get(stop.day) ? (
                            <div className="search-loading">
                              <div className="search-spinner"></div>
                              <p>
                                {lodgingType === 'campsite'
                                  ? 'Searching for campsites...'
                                  : 'Searching for hotels...'}
                              </p>
                            </div>
                          ) : hotelResults.get(stop.day) && hotelResults.get(stop.day)!.length > 0 ? (
                            <div className="hotels-results">
                              <div className="results-header">
                                <p className="results-count">
                                  Found {hotelResults.get(stop.day)!.length}{' '}
                                  {lodgingType === 'campsite' ? 'campsites' : 'hotels'}
                                  {startDate && (
                                    <span className="check-in-date">
                                      {' '}for {getCheckInDate(stop.day)}
                                    </span>
                                  )}
                                </p>
                              </div>
                              {hotelResults.get(stop.day)!.map((hotel, index) => {
                                const searchParams = hotelSearchParams.get(stop.day);
                                const numberOfDays =
                                  searchParams?.numberOfDays || searchParams?.extendStay
                                    ? searchParams.numberOfDays || 1
                                    : 1;
                                return (
                                  <HotelResult 
                                    key={`${hotel.lat}-${hotel.lon}-${index}`} 
                                    hotel={hotel} 
                                    index={index}
                                    numberOfDays={numberOfDays}
                                  />
                                );
                              })}
                            </div>
                          ) : (
                            <p className="category-placeholder">
                              {lodgingType === 'campsite'
                                ? 'Click "Search" to find campsites in this area.'
                                : 'Click "Search" to find hotels in this area.'}
                            </p>
                          )}
                        </div>
                      )}
                      {activeCategory.get(stop.day) === 'food' && (
                        <div className="food-content">
                          {isSearchingFood.get(stop.day) ? (
                            <div className="search-loading">
                              <div className="search-spinner"></div>
                              <p>Searching for restaurants...</p>
                            </div>
                          ) : foodResults.get(stop.day) && foodResults.get(stop.day)!.length > 0 ? (
                            <div className="food-results">
                              <div className="results-header">
                                <p className="results-count">
                                  Found {foodResults.get(stop.day)!.length} food places
                                  {startDate && (
                                    <span className="check-in-date">
                                      {' '}for {getCheckInDate(stop.day)}
                                    </span>
                                  )}
                                </p>
                              </div>
                              {foodResults.get(stop.day)!.map((foodPlace, index) => {
                                const searchParams = foodSearchParams.get(stop.day);
                                return (
                                  <FoodResult 
                                    key={`${foodPlace.lat}-${foodPlace.lon}-${index}`} 
                                    foodPlace={foodPlace} 
                                    index={index}
                                    selectedPriceLevel={searchParams?.priceLevel}
                                  />
                                );
                              })}
                            </div>
                          ) : (
                            <p className="category-placeholder">
                              Click "Search" to find restaurants and food places in this area.
                            </p>
                          )}
                        </div>
                      )}
                      {activeCategory.get(stop.day) === 'attractions' && (
                        <div className="attractions-content">
                          {isSearchingAttractions.get(stop.day) ? (
                            <div className="search-loading">
                              <div className="search-spinner"></div>
                              <p>Searching for attractions...</p>
                            </div>
                          ) : attractionResults.get(stop.day) && attractionResults.get(stop.day)!.length > 0 ? (
                            <div className="attractions-results">
                              <div className="results-header">
                                <p className="results-count">
                                  Found {attractionResults.get(stop.day)!.length} attractions
                                  {tripType !== 'all' && (
                                    <span className="trip-type-badge">
                                      {' '}for {tripType.replace('-', ' ')}
                                    </span>
                                  )}
                                </p>
                              </div>
                              {attractionResults.get(stop.day)!.map((attraction, index) => (
                                <AttractionResult 
                                  key={`${attraction.lat}-${attraction.lon}-${index}`} 
                                  attraction={attraction} 
                                  index={index}
                                />
                              ))}
                            </div>
                          ) : (
                            <p className="category-placeholder">
                              Click "Search" above to find attractions and points of interest in this area.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

