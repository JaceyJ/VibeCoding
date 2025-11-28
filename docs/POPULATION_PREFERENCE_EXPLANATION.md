# How the Population Preference Feature Works

## Overview

The overnight stop selection algorithm uses a **scoring system** that balances three factors:
1. **Timing** - How close the arrival time is to the ideal time
2. **Detour** - How much extra distance/time is required
3. **City Size** - Preference for larger cities (more amenities, hotels, services)

## The Scoring Formula

```typescript
finalScore = timePenalty + detourPenalty + populationBonus
```

Where:
- `timePenalty = -abs(cityTime - idealCenter) / 3600` (in hours, negative = penalty)
- `detourPenalty = -detourTime / 3600` (in hours, negative = penalty)
- `populationBonus = log(population + 1)` (always positive = bonus)

## Why Logarithmic Scale?

The population bonus uses **logarithmic scaling** (`log(population + 1)`) instead of linear scaling. This is important because:

### 1. **Prevents Dominance**
- Without log scaling, a city with 1 million people would completely dominate the score
- The log function creates diminishing returns, so larger cities get a bonus but don't overwhelm other factors

### 2. **Balanced Trade-offs**
- A small city (1,000 people) might still win if it's perfectly timed and has no detour
- A large city (100,000 people) gets a meaningful bonus but can still lose if it's far off-route

### 3. **Realistic Preferences**
- Reflects real-world behavior: people prefer larger cities, but not at any cost
- A 2-hour detour to a big city isn't worth it if a smaller city is right on the route

## Population Bonus Examples

Here's how different city sizes contribute to the score:

| Population | log(population + 1) | Bonus Contribution |
|------------|---------------------|-------------------|
| 1,000      | 6.91                | Small bonus       |
| 5,000      | 8.52                | Moderate bonus    |
| 10,000     | 9.21                | Good bonus        |
| 50,000     | 10.82               | Strong bonus      |
| 100,000    | 11.51               | Very strong bonus |
| 500,000    | 13.12               | Excellent bonus   |
| 1,000,000  | 13.82               | Maximum bonus     |

### Key Observations:
- **Small differences at low populations**: 1,000 vs 5,000 = 1.61 point difference
- **Larger differences at high populations**: 100,000 vs 500,000 = 1.61 point difference
- **Diminishing returns**: Going from 500K to 1M only adds 0.70 points

## Real-World Example

Imagine two candidate cities for an overnight stop:

### City A: Small Town
- Population: 5,000
- Arrival time: Perfect (0 hours from ideal)
- Detour: 0 km (on route)
- **Score calculation:**
  - Time penalty: 0 (perfect timing)
  - Detour penalty: 0 (no detour)
  - Population bonus: log(5001) = 8.52
  - **Total: 8.52**

### City B: Medium City
- Population: 50,000
- Arrival time: 0.5 hours early
- Detour: 10 km (adds ~0.15 hours)
- **Score calculation:**
  - Time penalty: -0.5 (0.5 hours off ideal)
  - Detour penalty: -0.15 (0.15 hours detour)
  - Population bonus: log(50001) = 10.82
  - **Total: 10.17**

**Result:** City B wins despite the small detour and timing penalty, because the population bonus (2.3 points) outweighs the penalties (0.65 points total).

### City C: Large City (Far Away)
- Population: 200,000
- Arrival time: 2 hours early
- Detour: 30 km (adds ~0.5 hours)
- **Score calculation:**
  - Time penalty: -2.0 (2 hours off ideal)
  - Detour penalty: -0.5 (0.5 hours detour)
  - Population bonus: log(200001) = 12.21
  - **Total: 9.71**

**Result:** City C loses to City B! Even though it's much larger, the timing and detour penalties (2.5 points) are too high compared to the population bonus advantage (only 1.39 points more than City B).

## Code Location

The scoring function is in `src/services/OvernightStopService.ts`:

```typescript
function scoreCity(
  city: City,
  cityTime: number,
  idealCenter: number,
  detourTime: number
): number {
  // Closeness to ideal time (negative penalty for being far from ideal)
  const timePenalty = -Math.abs(cityTime - idealCenter) / 3600;
  
  // Detour penalty (negative penalty for long detours)
  const detourPenalty = -detourTime / 3600;
  
  // Population bonus (preference for larger cities)
  const populationBonus = Math.log(city.population + 1);
  
  // Final score
  const finalScore = timePenalty + detourPenalty + populationBonus;
  
  return finalScore;
}
```

## Why This Design Works

1. **Balanced**: No single factor dominates the decision
2. **Flexible**: Can be tuned by adjusting the formula weights
3. **Realistic**: Matches human preferences (prefer cities, but not at any cost)
4. **Robust**: Handles edge cases (missing population data defaults to 1000)

## Potential Improvements

If you wanted to adjust the preference strength, you could:

1. **Increase preference**: Multiply by a factor
   ```typescript
   const populationBonus = Math.log(city.population + 1) * 1.5;
   ```

2. **Decrease preference**: Use a smaller multiplier
   ```typescript
   const populationBonus = Math.log(city.population + 1) * 0.5;
   ```

3. **Use square root instead**: Less aggressive than log
   ```typescript
   const populationBonus = Math.sqrt(city.population);
   ```

4. **Add minimum threshold**: Only apply bonus above a certain size
   ```typescript
   const populationBonus = city.population > 10000 
     ? Math.log(city.population + 1) 
     : 0;
   ```


