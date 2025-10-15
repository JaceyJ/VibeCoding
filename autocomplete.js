// Autocomplete functionality for location inputs
import { getElementSafely, debounce, validateLocation } from './utils.js';
import { searchLocations } from './api.js';
import { UI_CONFIG } from './config.js';

// Autocomplete state
let autocompleteTimeout = null;
let currentSuggestions = [];
let selectedSuggestionIndex = -1;

// Render suggestions in dropdown
function renderSuggestions(suggestions, container, input) {
	container.innerHTML = '';
	currentSuggestions = suggestions;
	selectedSuggestionIndex = -1;
	
	if (suggestions.length === 0) {
		container.style.display = 'none';
		return;
	}
	
	container.style.display = 'block';
	
	suggestions.forEach((suggestion, index) => {
		const item = document.createElement('div');
		item.className = 'suggestion-item';
		item.textContent = suggestion.name;
		item.addEventListener('click', () => {
			selectSuggestion(suggestion, input, container);
		});
		
		container.appendChild(item);
	});
	
	updateSuggestionHighlight(container);
}

// Update suggestion highlight
function updateSuggestionHighlight(container) {
	const items = container.querySelectorAll('.suggestion-item');
	items.forEach((item, index) => {
		item.classList.toggle('highlighted', index === selectedSuggestionIndex);
	});
}

// Select a suggestion
function selectSuggestion(suggestion, input, container) {
	if (!validateLocation(suggestion)) {
		console.error('Invalid location:', suggestion);
		return;
	}
	
	input.value = suggestion.displayName;
	container.style.display = 'none';
	
	// Store the full location data
	input.dataset.locationData = JSON.stringify({
		lat: suggestion.lat,
		lon: suggestion.lon,
		name: suggestion.name,
		displayName: suggestion.displayName
	});
	
	// Clear suggestions
	currentSuggestions = [];
	selectedSuggestionIndex = -1;
}

// Handle keyboard navigation
function handleInputKeydown(event, input, container) {
	if (!container.style.display || container.style.display === 'none') return;
	
	switch (event.key) {
		case 'ArrowDown':
			event.preventDefault();
			selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, currentSuggestions.length - 1);
			updateSuggestionHighlight(container);
			break;
			
		case 'ArrowUp':
			event.preventDefault();
			selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
			updateSuggestionHighlight(container);
			break;
			
		case 'Enter':
			event.preventDefault();
			if (selectedSuggestionIndex >= 0 && currentSuggestions[selectedSuggestionIndex]) {
				selectSuggestion(currentSuggestions[selectedSuggestionIndex], input, container);
			}
			break;
			
		case 'Escape':
			container.style.display = 'none';
			selectedSuggestionIndex = -1;
			break;
	}
}

// Setup autocomplete for an input field
function setupAutocomplete(input, container) {
	let lastQuery = '';
	
	input.addEventListener('input', debounce(async (event) => {
		const query = event.target.value.trim();
		console.log('Input event triggered, query:', query);
		
		if (query.length < 3) {
			container.style.display = 'none';
			return;
		}
		
		if (query === lastQuery) return;
		lastQuery = query;
		
		console.log('Searching for locations:', query);
		try {
			const suggestions = await searchLocations(query);
			console.log('Found suggestions:', suggestions);
			currentSuggestions = suggestions;
			renderSuggestions(suggestions, container, input);
		} catch (error) {
			console.error('Autocomplete error:', error);
			container.style.display = 'none';
		}
	}, UI_CONFIG.debounceDelay));
	
	input.addEventListener('keydown', (event) => {
		handleInputKeydown(event, input, container);
	});
	
	// Hide suggestions when clicking outside
	document.addEventListener('click', (event) => {
		if (!input.contains(event.target) && !container.contains(event.target)) {
			container.style.display = 'none';
		}
	});
	
	// Show suggestions when input is focused and has content
	input.addEventListener('focus', async () => {
		const query = input.value.trim();
		if (query.length >= 3) {
			try {
				const suggestions = await searchLocations(query);
				currentSuggestions = suggestions;
				renderSuggestions(suggestions, container, input);
			} catch (error) {
				console.error('Autocomplete focus error:', error);
			}
		}
	});
}

// Initialize autocomplete for all location inputs
function initializeAutocomplete() {
	console.log('Initializing autocomplete...');
	const startInput = getElementSafely('start');
	const endInput = getElementSafely('end');
	const startSuggestions = getElementSafely('start-suggestions');
	const endSuggestions = getElementSafely('end-suggestions');
	
	console.log('Elements found:', {
		startInput: !!startInput,
		endInput: !!endInput,
		startSuggestions: !!startSuggestions,
		endSuggestions: !!endSuggestions
	});
	
	if (startInput && startSuggestions) {
		console.log('Setting up autocomplete for start input');
		setupAutocomplete(startInput, startSuggestions);
	}
	
	if (endInput && endSuggestions) {
		console.log('Setting up autocomplete for end input');
		setupAutocomplete(endInput, endSuggestions);
	}
	
	console.log('Autocomplete initialization complete');
}

// Export for use in other modules
export { 
	renderSuggestions, 
	updateSuggestionHighlight, 
	selectSuggestion, 
	handleInputKeydown, 
	setupAutocomplete, 
	initializeAutocomplete 
};
