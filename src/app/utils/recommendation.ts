import { Destination, UserPreferences } from '@/app/types/destination';

const MIN_INTEREST_RANK = 1;
const MAX_INTEREST_RANK = 9;
const DEFAULT_UNRANKED_WEIGHT = 1;
const UNRANKED_SCHEDULE_OFFSET = 10;

const normalizeInterest = (value: string): string => value.trim().toLowerCase();

function toValidRank(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < MIN_INTEREST_RANK || rounded > MAX_INTEREST_RANK) return null;
  return rounded;
}

function buildNormalizedRankMap(interestRanks?: Record<string, number>): Map<string, number> {
  const rankMap = new Map<string, number>();
  if (!interestRanks) return rankMap;

  Object.entries(interestRanks).forEach(([interest, rank]) => {
    const normalizedInterest = normalizeInterest(interest);
    const validRank = toValidRank(rank);
    if (!normalizedInterest || validRank === null) return;
    rankMap.set(normalizedInterest, validRank);
  });

  return rankMap;
}

function calculateInterestMatchBreakdown(destination: Destination, preferences: UserPreferences): {
  matchCount: number;
  weightedMatchUnits: number;
  bestRank: number | null;
} {
  const destinationInterests = (destination.interests ?? [])
    .map(normalizeInterest)
    .filter(Boolean);
  const userInterests = (preferences.interests ?? [])
    .map(normalizeInterest)
    .filter(Boolean);
  const rankMap = buildNormalizedRankMap(preferences.interestRanks);

  let matchCount = 0;
  let weightedMatchUnits = 0;
  let bestRank: number | null = null;

  destinationInterests.forEach((destinationInterest) => {
    let bestWeightForInterest = DEFAULT_UNRANKED_WEIGHT;
    let hasMatch = false;

    userInterests.forEach((userInterest) => {
      const isMatch =
        destinationInterest.includes(userInterest) ||
        userInterest.includes(destinationInterest);
      if (!isMatch) return;

      hasMatch = true;
      const rank = rankMap.get(userInterest) ?? null;
      const weight = rank === null ? DEFAULT_UNRANKED_WEIGHT : 1 + (10 - rank) / 10;
      if (weight > bestWeightForInterest) {
        bestWeightForInterest = weight;
      }
      if (rank !== null && (bestRank === null || rank < bestRank)) {
        bestRank = rank;
      }
    });

    if (hasMatch) {
      matchCount += 1;
      weightedMatchUnits += bestWeightForInterest;
    }
  });

  return { matchCount, weightedMatchUnits, bestRank };
}

/**
 * Content-based filtering: Calculate similarity score between user preferences and destination
 */
export function calculateContentScore(destination: Destination, preferences: UserPreferences): number {
  let score = 0;
  const { matchCount: interestMatches, weightedMatchUnits, bestRank } =
    calculateInterestMatchBreakdown(destination, preferences);

  // Interest matching (highest weight) with optional rank weighting
  score += weightedMatchUnits * 30;
  if (interestMatches > 2) {
    score += 15;
  }
  if (bestRank !== null) {
    score += (MAX_INTEREST_RANK + 1 - bestRank) * 0.5;
  }

  const activityMap = {
    relaxed: { easy: 30, moderate: 15, challenging: 0 },
    moderate: { easy: 20, moderate: 30, challenging: 20 },
    active: { easy: 10, moderate: 25, challenging: 35 },
  } as const;
  score += activityMap[preferences.activityLevel][destination.difficulty] || 0;

  const budgetDifference = Math.abs(destination.estimatedCost - preferences.budget);
  const budgetRatio = budgetDifference / preferences.budget;

  if (budgetRatio <= 0.1) {
    score += 25;
  } else if (budgetRatio <= 0.3) {
    score += 20;
  } else if (budgetRatio <= 0.5) {
    score += 15;
  } else if (budgetRatio <= 0.8) {
    score += 10;
  } else {
    score += Math.max(0, 5 - budgetRatio * 5);
  }

  if (destination.estimatedCost < preferences.budget) {
    score += 5;
  }

  const styleMatches = preferences.travelStyle.reduce((count, style) => {
    if (destination.type === style) return count + 20;
    if (style === 'adventure' && destination.type === 'nature') return count + 10;
    if (style === 'nature' && destination.type === 'adventure') return count + 10;
    if (style === 'cultural' && destination.type === 'historical') return count + 15;
    if (style === 'relaxation' && destination.type === 'nature') return count + 8;
    return count;
  }, 0);
  score += styleMatches;

  score += destination.rating * 4;

  if (destination.reviewCount > 300) {
    score += 8;
  } else if (destination.reviewCount > 200) {
    score += 5;
  } else if (destination.reviewCount > 100) {
    score += 3;
  }

  const hoursPerDay = 8;
  const maxActivityDuration = preferences.duration * hoursPerDay * 0.3;

  if (destination.duration <= maxActivityDuration) {
    score += 5;
  } else if (destination.duration > preferences.duration * hoursPerDay) {
    score -= 10;
  }

  return Math.max(0, score);
}

/**
 * Calculate optimal itinerary schedule using greedy algorithm
 */
export function calculateItinerarySchedule(
  selectedDestinations: Destination[],
  tripDays: number,
  userInterests: string[] = [],
  interestRanks?: Record<string, number>
): Map<number, Destination[]> {
  const schedule = new Map<number, Destination[]>();
  const totalDays = Math.max(1, Math.floor(tripDays));

  for (let day = 1; day <= totalDays; day++) {
    schedule.set(day, []);
  }

  const normalizedUserInterests = userInterests.map(normalizeInterest).filter(Boolean);
  const normalizedRankMap = buildNormalizedRankMap(interestRanks);
  const hasExplicitRanks = normalizedRankMap.size > 0;
  const interestPriority = new Map<string, number>();
  normalizedUserInterests.forEach((interest, index) => {
    if (!interestPriority.has(interest)) {
      const rankedPriority = normalizedRankMap.get(interest);
      if (rankedPriority !== undefined) {
        interestPriority.set(interest, rankedPriority);
        return;
      }
      interestPriority.set(interest, hasExplicitRanks ? UNRANKED_SCHEDULE_OFFSET + index : index);
    }
  });

  const destinations = [...selectedDestinations]
    .map((destination, originalIndex) => {
      const destinationInterests = (destination.interests ?? []).map(normalizeInterest).filter(Boolean);
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

  const breakdown = {
    interests: 0,
    activityLevel: 0,
    budget: 0,
    travelStyle: 0,
    rating: destination.rating * 4,
  };

  const { matchCount: interestMatches, weightedMatchUnits, bestRank } =
    calculateInterestMatchBreakdown(destination, preferences);
  breakdown.interests = weightedMatchUnits * 30;
  if (interestMatches > 2) {
    breakdown.interests += 15;
  }
  if (bestRank !== null) {
    breakdown.interests += (MAX_INTEREST_RANK + 1 - bestRank) * 0.5;
  }

  const activityMap = {
    relaxed: { easy: 30, moderate: 15, challenging: 0 },
    moderate: { easy: 20, moderate: 30, challenging: 20 },
    active: { easy: 10, moderate: 25, challenging: 35 },
  } as const;
  breakdown.activityLevel = activityMap[preferences.activityLevel][destination.difficulty] || 0;

  const budgetDifference = Math.abs(destination.estimatedCost - preferences.budget);
  const budgetRatio = budgetDifference / preferences.budget;
  if (budgetRatio <= 0.3) {
    breakdown.budget = 20;
  } else {
    breakdown.budget = Math.max(0, 20 - budgetRatio * 20);
  }

  preferences.travelStyle.forEach((style) => {
    if (destination.type === style) {
      breakdown.travelStyle += 20;
    }
  });

  const totalScore = contentScore * 0.5 + cfScore * 5 * 0.35 + popularityScore * 20 * 0.15;

  return {
    contentScore,
    cfScore: cfScore * 5,
    popularityScore: popularityScore * 20,
    totalScore,
    breakdown,
  };
}
