import { Destination, UserPreferences } from '@/app/types/destination';

const MIN_INTEREST_RANK = 1;
const MAX_INTEREST_RANK = 9;
const DEFAULT_UNRANKED_WEIGHT = 1;
const UNRANKED_SCHEDULE_OFFSET = 10;

const normalizeInterest = (value: string): string => value.trim().toLowerCase();

function isValidCoordinate(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

function hasValidLocation(destination: Destination): boolean {
  const lat = destination.location?.lat;
  const lng = destination.location?.lng;
  return isValidCoordinate(lat, -90, 90) && isValidCoordinate(lng, -180, 180);
}

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

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
  const destinationInterests = (
    destination.subInterests && destination.subInterests.length > 0 ? destination.subInterests : destination.interests
  )
    .map(normalizeInterest)
    .filter(Boolean);
  const userInterests = (
    preferences.subInterests && preferences.subInterests.length > 0 ? preferences.subInterests : preferences.interests
  )
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

function calculateTravelStyleScore(destination: Destination, preferences: UserPreferences): number {
  const selectedStyle = preferences.travelStyle?.[0];
  const duration = Number.isFinite(destination.duration) ? destination.duration : 0;
  const collaboratorCount = (preferences.collaborators ?? []).filter((name) => name.trim() !== '').length;
  let score = 0;

  if (selectedStyle === 'solo') {
    if (destination.difficulty === 'challenging') score += 20;
    else if (destination.difficulty === 'moderate') score += 10;
    else score += 4;

    if (duration >= 8) score += 15;
    else if (duration >= 5) score += 10;
    else if (duration >= 3) score += 5;
  }

  if (selectedStyle === 'couple') {
    if (destination.difficulty === 'easy') score += 12;
    else if (destination.difficulty === 'moderate') score += 10;
    else score -= 8;

    if (duration >= 2 && duration <= 6) score += 10;
    else if (duration > 8) score -= 6;
  }

  if (selectedStyle === 'family_group') {
    if (destination.difficulty === 'easy') score += 18;
    else if (destination.difficulty === 'moderate') score += 8;
    else score -= 18;
    if (duration <= 4) score += 10;
    else if (duration <= 6) score += 5;
    else score -= 10;

    if (collaboratorCount >= 3 && destination.difficulty === 'challenging') {
      score -= 6;
    }
  }

  return score;
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

  score += calculateTravelStyleScore(destination, preferences);

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

  const rankedDestinations = [...selectedDestinations]
    .map((destination, originalIndex) => {
      const destinationInterests = (
        destination.subInterests && destination.subInterests.length > 0 ? destination.subInterests : destination.interests
      )
        .map(normalizeInterest)
        .filter(Boolean);
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
    });

  // Seed each day with one top-ranked destination first, then place the rest by nearest-day fit.
  const dayBuckets = Array.from({ length: totalDays }, () => [] as Destination[]);
  const targetPerDay = Math.ceil(rankedDestinations.length / totalDays);

  const calculateDayDistanceScore = (candidate: Destination, dayDestinations: Destination[]): number => {
    if (!hasValidLocation(candidate)) return Number.POSITIVE_INFINITY;

    const distances = dayDestinations
      .filter(hasValidLocation)
      .map((existing) => haversineKm(candidate.location, existing.location));

    if (distances.length === 0) return Number.POSITIVE_INFINITY;

    const nearest = Math.min(...distances);
    const average = distances.reduce((sum, value) => sum + value, 0) / distances.length;
    return nearest * 0.7 + average * 0.3;
  };

  rankedDestinations.forEach(({ destination }, index) => {
    if (index < totalDays) {
      dayBuckets[index].push(destination);
      return;
    }

    let bestDayIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
      const dayDestinations = dayBuckets[dayIndex];
      const distanceScore = calculateDayDistanceScore(destination, dayDestinations);
      const normalizedDistanceScore = Number.isFinite(distanceScore) ? distanceScore : 50;
      const loadPenalty = dayDestinations.length * 2.5;
      const overTargetPenalty = dayDestinations.length >= targetPerDay ? 20 : 0;
      const combinedScore = normalizedDistanceScore + loadPenalty + overTargetPenalty;

      if (combinedScore < bestScore) {
        bestScore = combinedScore;
        bestDayIndex = dayIndex;
        continue;
      }

      if (combinedScore === bestScore && dayDestinations.length < dayBuckets[bestDayIndex].length) {
        bestDayIndex = dayIndex;
      }
    }

    dayBuckets[bestDayIndex].push(destination);
  });

  for (let day = 1; day <= totalDays; day++) {
    schedule.set(day, dayBuckets[day - 1]);
  }

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
  breakdown.travelStyle = calculateTravelStyleScore(destination, preferences);

  const totalScore = contentScore * 0.5 + cfScore * 5 * 0.35 + popularityScore * 20 * 0.15;

  return {
    contentScore,
    cfScore: cfScore * 5,
    popularityScore: popularityScore * 20,
    totalScore,
    breakdown,
  };
}
