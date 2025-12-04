# RouteGenie AI - Intelligent Road Trip Planning

**Created by Jacey Jonson and Evan Schuller**  
*Project for CSCI598A - Large Language Models Course*

---

## About the Project

RouteGenie AI is an intelligent, AI-powered road trip planning application that helps you plan the perfect journey. Whether you're planning a cross-country adventure, a weekend getaway, or a family vacation, RouteGenie AI takes the guesswork out of trip planning by automatically calculating optimal routes, finding the best overnight stops, and discovering attractions and dining options along your journey.

### What Makes RouteGenie AI Special?

- **Smart Route Planning**: Automatically calculates the best route between your start and end destinations
- **Intelligent Stop Selection**: Finds optimal overnight stops based on your preferred driving time (minimum and maximum hours per day)
- **Personalized Recommendations**: Discovers attractions, restaurants, and lodging options tailored to your trip type preferences
- **Interactive Maps**: Visualize your entire trip with an interactive map showing your route and all stops
- **Flexible Trip Types**: Choose from family-friendly, outdoors-adventure, cultural, relaxation, nightlife, shopping, or all-inclusive trips
- **Lodging Options**: Search for hotels or campsites at each overnight stop
- **Real-time Progress Tracking**: Beautiful, engaging progress indicators keep you informed during route calculation

---

## Capabilities

### Route Planning
- Calculate optimal driving routes between any two locations
- Automatically determine the number of driving days based on your time preferences
- Ensure stops meet your minimum and maximum daily driving time requirements
- Exclude your starting location from being selected as a stop

### Overnight Stops
- Automatically find the best cities/towns for overnight stops along your route
- Filter stops based on your preferred lodging type (hotels or campsites)
- Display arrival times and distances for each stop
- Organize stops by day with check-in dates

### Attractions Discovery
- Find attractions along your route based on your trip type preference
- Discover museums, parks, historic sites, and more
- View attractions organized by day of your trip
- Get distance information for each attraction

### Food & Dining
- Search for restaurants and food places near each overnight stop
- Filter by venue type (fast food, restaurant, or both)
- Select your preferred price level ($, $$, $$$, $$$$)
- Filter by meal types (breakfast, lunch, dinner)
- View cuisine types and distances

### Lodging Search
- Search for hotels or campsites at each stop
- Filter by budget level and number of guests
- View estimated price ranges
- Get distance information from your stop location

---

## How to Use RouteGenie AI

### Step 1: Install Prerequisites

Before you begin, make sure you have Node.js installed on your computer:

1. **Check if Node.js is installed:**
   ```bash
   node --version
   npm --version
   ```
   
2. **If not installed, download Node.js:**
   - Visit [nodejs.org](https://nodejs.org/)
   - Download and install Node.js version 16 or higher
   - npm comes bundled with Node.js

### Step 2: Set Up the Project

1. **Navigate to the project directory:**
   ```bash
   cd VibeCoding
   ```

2. **Install all required dependencies:**
   ```bash
   npm install
   ```
   
   This will install React, TypeScript, Vite, Leaflet, and all other necessary packages.

### Step 3: Start the Application

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Open your browser:**
   - The terminal will display a URL (typically `http://localhost:5173`)
   - Open this URL in your web browser
   - You should see the RouteGenie AI trip planning interface

### Step 4: Plan Your Trip

#### 4.1 Enter Your Trip Details

1. **Start Location:**
   - Click in the "Start Location" field
   - Type your starting city or address
   - Select from the autocomplete suggestions that appear

2. **End Location:**
   - Click in the "End Location" field
   - Type your destination city or address
   - Select from the autocomplete suggestions

3. **Start Date:**
   - Click the date field
   - Select your trip start date from the calendar

4. **Trip Type:**
   - Choose your preferred trip style:
     - **All** - General recommendations
     - **Family-Friendly** - Kid-friendly attractions
     - **Outdoors-Adventure** - Hiking, parks, nature
     - **Cultural** - Museums, galleries, historic sites
     - **Relaxation** - Spas, beaches, scenic spots
     - **Nightlife** - Bars, clubs, entertainment
     - **Shopping** - Malls, markets, shopping districts

5. **Lodging Type:**
   - Select **Hotels** for traditional accommodations
   - Select **Campsites** for camping options

6. **Driving Time Preferences:**
   - **Minimum Daily Driving Time**: Set the minimum hours you want to drive per day (e.g., 3 hours)
   - **Maximum Daily Driving Time**: Set the maximum hours you want to drive per day (e.g., 8 hours)
   - Use the up/down arrows or type directly in the fields

#### 4.2 Plan Your Trip

1. **Click the "Plan Trip" button**
   - The application will begin calculating your route
   - You'll see engaging loading messages that rotate every 10 seconds
   - A progress bar shows the calculation progress

2. **Wait for Route Calculation:**
   - The system will:
     - Calculate the optimal route between your locations
     - Determine how many days your trip will take
     - Find the best overnight stops based on your preferences
   - This process typically takes 30-60 seconds depending on route length

#### 4.3 Explore Your Route

Once calculation is complete, you'll see:

1. **Route Information:**
   - Total distance in kilometers
   - Estimated total driving time
   - Your selected lodging type

2. **Interactive Map:**
   - View your entire route on an interactive map
   - See your start point, end point, and all overnight stops
   - Zoom in/out and pan around to explore

3. **Overnight Stops Tab:**
   - Click on any stop to expand and see details
   - View arrival time, distance, and place type for each stop
   - Each stop has three tabs:
     - **Hotels/Campsites**: Search for lodging
     - **Food**: Search for restaurants
     - **Attractions**: Search for nearby attractions

#### 4.4 Search for Lodging

1. **Click on an overnight stop** to expand it
2. **Click the "Search" button** in the Hotels/Campsites tab
3. **In the search modal:**
   - Select your budget level ($, $$, $$$, $$$$)
   - Enter number of guests
   - Choose number of nights
   - Click "Search"
4. **View results:**
   - See hotels/campsites with prices, distances, and links
   - Click "Check Prices on Booking.com" to view booking options
   - Click "View on Map" to see location

#### 4.5 Search for Food

1. **Click on an overnight stop** to expand it
2. **Switch to the "Food" tab**
3. **Click the "Search" button**
4. **In the search modal:**
   - Select venue type (Fast Food, Restaurant, or Both)
   - Choose your price level ($, $$, $$$, $$$$)
   - Optionally select meal types (Breakfast, Lunch, Dinner)
   - Click "Search"
5. **View results:**
   - See restaurants with cuisine types, prices, and distances
   - Click "View on Map" to see location

#### 4.6 Discover Attractions

1. **Click on an overnight stop** to expand it
2. **Switch to the "Attractions" tab**
3. **Click the "Search" button**
4. **View results:**
   - See attractions filtered by your trip type preference
   - View attraction types, categories, and distances
   - Click "View on Map" to see location

#### 4.7 Find Attractions Along Your Route

1. **Click the "Attractions" tab** at the top (next to "Overnight Stops")
2. **Click "Find attractions along route"**
3. **Wait for the search to complete**
4. **View results:**
   - Attractions are organized by day
   - See attractions for each day of your trip
   - View distances from your route

---

## Technical Details

### Technology Stack

- **React 18** - Modern UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool and dev server
- **Leaflet** - Interactive mapping library
- **OpenStreetMap Nominatim API** - Location search and geocoding
- **OSRM API** - Route calculation

### Project Structure

```
VibeCoding/
├── src/
│   ├── components/          # React UI components
│   ├── services/            # Business logic and API services
│   ├── hooks/               # Custom React hooks
│   ├── utils/               # Utility functions
│   ├── App.tsx              # Main app component
│   └── main.tsx             # Application entry point
├── docs/                    # Documentation
├── index.html               # HTML template
├── package.json             # Dependencies and scripts
└── README.md                # This file
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

---

## Troubleshooting

### Port Already in Use

If port 5173 is already in use, Vite will automatically try the next available port. You can also specify a port:

```bash
npm run dev -- --port 3000
```

### Dependencies Issues

If you encounter issues with dependencies:

```bash
# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall dependencies
npm install
```

### Route Calculation Takes Too Long

- Longer routes (1000+ km) may take 1-2 minutes to calculate
- The progress bar will show you the current status
- Be patient - the algorithm is finding the best stops for your trip!

---

## Browser Support

This application works best in modern browsers:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

---

## License

This project is for educational purposes as part of the CSCI598A - Large Language Models course.

---

## Authors

**Jacey Jonson** and **Evan Schuller**  
*CSCI598A - Large Language Models Course*
