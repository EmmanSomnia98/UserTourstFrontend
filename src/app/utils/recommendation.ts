import { Destination, UserPreferences } from '@/app/types/destination';
import { 
  hybridCollaborativeFiltering, 
  calculatePopularityScore 
} from '@/app/utils/collaborativeFiltering';
import { 
  knapsackOptimization, 
  multiConstraintKnapsack,
  fractionalKnapsackRanking,
  KnapsackItem 
} from '@/app/utils/knapsack';

/**
 * Content-based filtering: Calculate similarity score between user preferences and destination
 */
export function calculateContentScore(destination: Destination, preferences: UserPreferences): number {
  let score = 0;
  
  // Interest matching (highest weight) - exact and fuzzy matching
  const interestMatches = destination.interests.filter(interest =>
    preferences.interests.some(userInterest =>
      interest.toLowerCase().includes(userInterest.toLowerCase()) ||
      userInterest.toLowerCase().includes(interest.toLowerCase())
    )
  ).length;
  
  // Bonus for multiple interest matches
  score += interestMatches * 30;
  if (interestMatches > 2) {
    score += 15; // Bonus for strong interest alignment
  }
  
  // Activity level matching with nuanced scoring
  const activityMap = {
    'relaxed': { easy: 30, moderate: 15, challenging: 0 },
    'moderate': { easy: 20, moderate: 30, challenging: 20 },
    'active': { easy: 10, moderate: 25, challenging: 35 }
  };
  score += activityMap[preferences.activityLevel][destination.difficulty] || 0;
  
  // Budget matching with graduated scoring
  const budgetDifference = Math.abs(destination.estimatedCost - preferences.budget);
  const budgetRatio = budgetDifference / preferences.budget;
  
  if (budgetRatio <= 0.1) {
    score += 25; // Perfect budget match
  } else if (budgetRatio <= 0.3) {
    score += 20; // Close to budget
  } else if (budgetRatio <= 0.5) {
    score += 15; // Acceptable
  } else if (budgetRatio <= 0.8) {
    score += 10; // Stretching budget
  } else {
    score += Math.max(0, 5 - budgetRatio * 5); // Beyond budget
  }
  
  // Under budget bonus
  if (destination.estimatedCost < preferences.budget) {
    score += 5;
  }
  
  // Travel style matching with cross-type bonuses
  const styleMatches = preferences.travelStyle.reduce((count, style) => {
    if (destination.type === style) return count + 20;
    
    // Cross-compatibility bonuses
    if (style === 'adventure' && destination.type === 'nature') return count + 10;
    if (style === 'nature' && destination.type === 'adventure') return count + 10;
    if (style === 'cultural' && destination.type === 'historical') return count + 15;
    if (style === 'relaxation' && destination.type === 'nature') return count + 8;
    
    return count;
  }, 0);
  score += styleMatches;
  
  // Rating and popularity boost
  score += destination.rating * 4;
  
  // Review count confidence boost (more reviews = more reliable)
  if (destination.reviewCount > 300) {
    score += 8;
  } else if (destination.reviewCount > 200) {
    score += 5;
  } else if (destination.reviewCount > 100) {
    score += 3;
  }
  
  // Duration appropriateness (not too long for trip duration)
  const hoursPerDay = 8;
  const maxActivityDuration = preferences.duration * hoursPerDay * 0.3; // Max 30% of trip on one activity
  
  if (destination.duration <= maxActivityDuration) {
    score += 5;
  } else if (destination.duration > preferences.duration * hoursPerDay) {
    score -= 10; // Activity too long for trip
  }
  
  return Math.max(0, score);
}

/**
 * Enhanced hybrid recommendation system
 * Combines content-based filtering, collaborative filtering, and knapsack optimization
 */
export function getRecommendations(
  allDestinations: Destination[],
  preferences: UserPreferences,
  limit: number = 6
): Destination[] {
  // Step 1: Calculate content-based scores
  const contentScores = new Map<string, number>();
  allDestinations.forEach(dest => {
    const score = calculateContentScore(dest, preferences);
    contentScores.set(dest.id, score);
  });
  
  // Step 2: Get collaborative filtering scores
  const cfScores = hybridCollaborativeFiltering(preferences, allDestinations);
  
  // Step 3: Calculate popularity scores
  const popularityScores = new Map<string, number>();
  allDestinations.forEach(dest => {
    const popScore = calculatePopularityScore(dest.id);
    popularityScores.set(dest.id, popScore);
  });
  
  // Step 4: Combine all scores with weighted approach
  const hybridScores = new Map<string, number>();
  const contentWeight = 0.5;  // Content-based filtering
  const cfWeight = 0.35;       // Collaborative filtering
  const popularityWeight = 0.15; // Popularity
  
  allDestinations.forEach(dest => {
    const contentScore = contentScores.get(dest.id) || 0;
    const cfScore = cfScores.get(dest.id) || 0;
    const popScore = popularityScores.get(dest.id) || 0;
    
    // Normalize scores to 0-100 scale
    const normalizedContent = Math.min(100, contentScore);
    const normalizedCF = Math.min(100, cfScore * 5); // CF scores are typically lower
    const normalizedPop = Math.min(100, popScore * 20);
    
    const finalScore = 
      (normalizedContent * contentWeight) +
      (normalizedCF * cfWeight) +
      (normalizedPop * popularityWeight);
    
    hybridScores.set(dest.id, finalScore);
  });
  
  // Step 5: Create knapsack items with hybrid scores
  const knapsackItems: KnapsackItem[] = allDestinations.map(dest => ({
    destination: dest,
    value: hybridScores.get(dest.id) || 0,
    weight: dest.estimatedCost
  }));
  
  // Step 6: Apply knapsack optimization with constraints
  const totalBudget = preferences.budget * Math.min(limit * 1.5, 10); // Total budget for all activities
  const totalDuration = preferences.duration * 8; // 8 hours per day
  
  const optimizedDestinations = multiConstraintKnapsack(
    knapsackItems,
    {
      maxBudget: totalBudget,
      maxDuration: totalDuration,
      minItems: Math.min(3, limit),
      maxItems: limit
    },
    0.3 // Diversity weight
  );
  
  // Step 7: If knapsack returned fewer items than desired, fill with top-ranked items
  if (optimizedDestinations.length < limit) {
    const ranked = fractionalKnapsackRanking(knapsackItems);
    const remainingSlots = limit - optimizedDestinations.length;
    
    let added = 0;
    for (const item of ranked) {
      if (added >= remainingSlots) break;
      // Check for duplicates before adding
      if (!optimizedDestinations.some(d => d.id === item.destination.id)) {
        optimizedDestinations.push(item.destination);
        added++;
      }
    }
  }
  
  // Step 8: Final ranking by hybrid score - remove any potential duplicates
  const uniqueDestinations = Array.from(
    new Map(optimizedDestinations.map(d => [d.id, d])).values()
  );
  
  const finalRanked = uniqueDestinations.sort((a, b) => {
    const scoreA = hybridScores.get(a.id) || 0;
    const scoreB = hybridScores.get(b.id) || 0;
    return scoreB - scoreA;
  });
  
  return finalRanked.slice(0, limit);
}

/**
 * Calculate optimal itinerary schedule using greedy algorithm
 * Considers difficulty progression and time constraints
 */
export function calculateItinerarySchedule(
  selectedDestinations: Destination[],
  tripDays: number
): Map<number, Destination[]> {
  const schedule = new Map<number, Destination[]>();
  
  // Sort destinations intelligently:
  // 1. Challenging activities first (when energy is highest)
  // 2. Then by duration (longer activities first)
  // 3. Spread different types across days
  const sorted = [...selectedDestinations].sort((a, b) => {
    // Difficulty priority
    const difficultyOrder = { challenging: 3, moderate: 2, easy: 1 };
    const diffA = difficultyOrder[a.difficulty];
    const diffB = difficultyOrder[b.difficulty];
    
    if (diffA !== diffB) {
      return diffB - diffA;
    }
    
    // Duration as secondary
    return b.duration - a.duration;
  });
  
  let currentDay = 1;
  let currentDayHours = 0;
  const maxHoursPerDay = 8;
  const minHoursPerDay = 3; // Minimum to make a day worthwhile
  
  sorted.forEach(dest => {
    if (currentDay > tripDays) return;
    
    // Check if adding this destination would exceed daily limit
    if (currentDayHours + dest.duration > maxHoursPerDay && currentDayHours >= minHoursPerDay) {
      currentDay++;
      currentDayHours = 0;
    }
    
    if (currentDay <= tripDays) {
      const dayDestinations = schedule.get(currentDay) || [];
      dayDestinations.push(dest);
      schedule.set(currentDay, dayDestinations);
      currentDayHours += dest.duration;
    }
  });
  
  return schedule;
}

/**
 * Get detailed recommendation scores for transparency
 */
export function getRecommendationScores(
  destination: Destination,
  preferences: UserPreferences
): {
  contentScore: number;
  cfScore: number;
  popularityScore: number;
  totalScore: number;
  breakdown: {
    interests: number;
    activityLevel: number;
    budget: number;
    travelStyle: number;
    rating: number;
  };
} {
  const contentScore = calculateContentScore(destination, preferences);
  const cfScores = hybridCollaborativeFiltering(preferences, [destination]);
  const cfScore = cfScores.get(destination.id) || 0;
  const popularityScore = calculatePopularityScore(destination.id);
  
  // Calculate breakdown
  const breakdown = {
    interests: 0,
    activityLevel: 0,
    budget: 0,
    travelStyle: 0,
    rating: destination.rating * 4
  };
  
  // Interest matching
  const interestMatches = destination.interests.filter(interest =>
    preferences.interests.some(userInterest =>
      interest.toLowerCase().includes(userInterest.toLowerCase()) ||
      userInterest.toLowerCase().includes(interest.toLowerCase())
    )
  ).length;
  breakdown.interests = interestMatches * 30;
  
  // Activity level
  const activityMap = {
    'relaxed': { easy: 30, moderate: 15, challenging: 0 },
    'moderate': { easy: 20, moderate: 30, challenging: 20 },
    'active': { easy: 10, moderate: 25, challenging: 35 }
  };
  breakdown.activityLevel = activityMap[preferences.activityLevel][destination.difficulty] || 0;
  
  // Budget
  const budgetDifference = Math.abs(destination.estimatedCost - preferences.budget);
  const budgetRatio = budgetDifference / preferences.budget;
  if (budgetRatio <= 0.3) {
    breakdown.budget = 20;
  } else {
    breakdown.budget = Math.max(0, 20 - budgetRatio * 20);
  }
  
  // Travel style
  preferences.travelStyle.forEach(style => {
    if (destination.type === style) {
      breakdown.travelStyle += 20;
    }
  });
  
  const totalScore = 
    (contentScore * 0.5) +
    (cfScore * 5 * 0.35) +
    (popularityScore * 20 * 0.15);
  
  return {
    contentScore,
    cfScore: cfScore * 5,
    popularityScore: popularityScore * 20,
    totalScore,
    breakdown
  };
}