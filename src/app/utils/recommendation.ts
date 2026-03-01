import { Destination, UserPreferences } from '@/app/types/destination';

/**
 * Content-based filtering: Calculate similarity score between user preferences and destination
 */
export function calculateContentScore(destination: Destination, preferences: UserPreferences): number {
  let score = 0;
  const destinationInterests = destination.interests ?? [];
  const userInterests = preferences.interests ?? [];
  
  // Interest matching (highest weight) - exact and fuzzy matching
  const interestMatches = destinationInterests.filter(interest =>
    userInterests.some(userInterest =>
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
 * Calculate optimal itinerary schedule using greedy algorithm
 * Considers difficulty progression and time constraints
 */
export function calculateItinerarySchedule(
  selectedDestinations: Destination[],
  tripDays: number,
  userInterests: string[] = []
): Map<number, Destination[]> {
  const schedule = new Map<number, Destination[]>();
  const totalDays = Math.max(1, Math.floor(tripDays));

  for (let day = 1; day <= totalDays; day++) {
    schedule.set(day, []);
  }

  const normalize = (value: string) => value.trim().toLowerCase();
  const normalizedUserInterests = userInterests.map(normalize).filter(Boolean);
  const interestPriority = new Map<string, number>();
  normalizedUserInterests.forEach((interest, index) => {
    if (!interestPriority.has(interest)) {
      interestPriority.set(interest, index);
    }
  });

  // Keep AI order by default, but prioritize stronger interest/sub-interest matches first.
  const destinations = [...selectedDestinations]
    .map((destination, originalIndex) => {
      const destinationInterests = (destination.interests ?? []).map(normalize).filter(Boolean);
      let matchCount = 0;
      let bestPriority = Number.POSITIVE_INFINITY;

      for (const destinationInterest of destinationInterests) {
        for (const userInterest of normalizedUserInterests) {
          const isMatch =
            destinationInterest.includes(userInterest) ||
            userInterest.includes(destinationInterest);
          if (!isMatch) continue;
          matchCount += 1;
          const priority = interestPriority.get(userInterest) ?? Number.POSITIVE_INFINITY;
          if (priority < bestPriority) {
            bestPriority = priority;
          }
        }
      }

      return {
        destination,
        originalIndex,
        matchCount,
        bestPriority,
      };
    })
    .sort((a, b) => {
      if (a.matchCount !== b.matchCount) return b.matchCount - a.matchCount;
      if (a.bestPriority !== b.bestPriority) return a.bestPriority - b.bestPriority;
      return a.originalIndex - b.originalIndex;
    })
    .map((item) => item.destination);

  destinations.forEach((destination, index) => {
    const dayIndex = index % totalDays;
    const day = dayIndex + 1;
    const dayDestinations = schedule.get(day) || [];
    dayDestinations.push(destination);
    schedule.set(day, dayDestinations);
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
  const cfScore = 0;
  const popularityScore = 0;
  
  // Calculate breakdown
  const breakdown = {
    interests: 0,
    activityLevel: 0,
    budget: 0,
    travelStyle: 0,
    rating: destination.rating * 4
  };
  
  // Interest matching
  const destinationInterests = destination.interests ?? [];
  const userInterests = preferences.interests ?? [];
  const interestMatches = destinationInterests.filter(interest =>
    userInterests.some(userInterest =>
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
