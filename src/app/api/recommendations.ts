import { apiPost } from '@/app/api/client';
import { Destination, UserPreferences } from '@/app/types/destination';
import { calculateContentScore } from '@/app/utils/recommendation';

const RECOMMENDATIONS_ENDPOINT =
  (import.meta.env.VITE_RECOMMENDATIONS_ENDPOINT as string | undefined) ?? '/api/itineraries/generate';

type RawDestination = Partial<Destination>;

type RecommendationItem =
  | RawDestination
  | {
      destination?: RawDestination | string;
      score?: number | string;
      hybridScore?: number | string;
      recommendationScore?: number | string;
    };

type RecommendationsPayload =
  | RecommendationItem[]
  | {
      data?: RecommendationItem[];
      recommendations?: RecommendationItem[];
      items?: RecommendationItem[];
      destinations?: RecommendationItem[];
      itinerary?: {
        destinations?: Array<{
          destination?: RawDestination | string;
          score?: number | string;
          hybridScore?: number | string;
          recommendationScore?: number | string;
        }>;
      };
      requestId?: string;
      recommendationId?: string;
      modelVersion?: string;
      algorithmVersion?: string;
      algorithmUsed?: string;
      budget?: {
        mode?: string;
        maxBudget?: number | string;
        totalSelectedCost?: number | string;
        remainingBudget?: number | string;
        utilizationPct?: number | string;
      };
    };

function isAuthFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalized = message.toLowerCase();
  return (
    normalized.includes('(401)') ||
    normalized.includes('(403)') ||
    normalized.includes('no token provided') ||
    normalized.includes('unauthorized') ||
    normalized.includes('forbidden')
  );
}

export type ServerRecommendationsResult = {
  destinations: Destination[];
  scores: Map<string, number>;
  metadata: {
    recommendationRequestId?: string;
    modelVersion?: string;
    algorithmUsed?: string;
    budget?: RecommendationBudgetSummary;
  };
};

export type RecommendationBudgetSummary = {
  mode?: string;
  maxBudget?: number;
  totalSelectedCost?: number;
  remainingBudget?: number;
  utilizationPct?: number;
};

function getDestinationId(ref: unknown): string | null {
  if (!ref) return null;
  if (typeof ref === 'string') return ref;
  if (typeof ref !== 'object') return null;

  const candidate = ref as { id?: unknown; _id?: unknown; destinationId?: unknown };
  const rawId = candidate.id ?? candidate._id ?? candidate.destinationId;
  if (rawId == null) return null;
  if (typeof rawId === 'string') return rawId;
  if (typeof rawId === 'number') return String(rawId);
  if (typeof rawId === 'object' && rawId !== null) {
    if ('$oid' in (rawId as Record<string, unknown>)) {
      const oid = (rawId as Record<string, unknown>).$oid;
      if (typeof oid === 'string') return oid;
    }
    return String(rawId);
  }
  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeName(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function normalizeInterestToken(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function filterDestinationsBySelectedSubInterests(
  destinations: Destination[],
  preferences: UserPreferences
): Destination[] {
  const selected = new Set(
    (preferences.subInterests ?? preferences.interests ?? [])
      .map((item) => normalizeInterestToken(item))
      .filter(Boolean)
  );

  if (selected.size === 0) return destinations;

  return destinations.filter((destination) => {
    const destinationInterests = (
      Array.isArray(destination.subInterests) && destination.subInterests.length > 0
        ? destination.subInterests
        : destination.interests
    )
      .map((item) => normalizeInterestToken(item))
      .filter(Boolean);

    if (destinationInterests.length === 0) return false;
    return destinationInterests.some((interest) => selected.has(interest));
  });
}

function extractItems(payload: RecommendationsPayload): RecommendationItem[] {
  if (Array.isArray(payload)) return payload;
  if ('destinations' in payload && Array.isArray(payload.destinations)) return payload.destinations;
  if ('recommendations' in payload && Array.isArray(payload.recommendations)) return payload.recommendations;
  if ('items' in payload && Array.isArray(payload.items)) return payload.items;
  if ('data' in payload && Array.isArray(payload.data)) return payload.data;
  if ('itinerary' in payload && Array.isArray(payload.itinerary?.destinations)) return payload.itinerary.destinations;
  return [];
}

function extractScore(item: RecommendationItem): number | null {
  if (!item || typeof item !== 'object') return null;
  if ('score' in item) return toNumber(item.score);
  if ('hybridScore' in item) return toNumber(item.hybridScore);
  if ('recommendationScore' in item) return toNumber(item.recommendationScore);
  return null;
}

function extractBudgetSummary(payload: RecommendationsPayload): RecommendationBudgetSummary | undefined {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return undefined;
  if (!('budget' in payload) || !payload.budget || typeof payload.budget !== 'object') return undefined;

  const budget = payload.budget;
  const summary: RecommendationBudgetSummary = {
    mode: typeof budget.mode === 'string' ? budget.mode : undefined,
    maxBudget: toNumber(budget.maxBudget) ?? undefined,
    totalSelectedCost: toNumber(budget.totalSelectedCost) ?? undefined,
    remainingBudget: toNumber(budget.remainingBudget) ?? undefined,
    utilizationPct: toNumber(budget.utilizationPct) ?? undefined,
  };

  return Object.values(summary).some((value) => value !== undefined) ? summary : undefined;
}

export async function fetchServerRecommendations(
  preferences: UserPreferences,
  limit = 6,
  allDestinations: Destination[] = []
): Promise<ServerRecommendationsResult> {
  const selectedMainInterests = preferences.mainInterests ?? [];
  const selectedSubInterests = preferences.subInterests ?? preferences.interests ?? [];
  const preferencePayload = {
    mainInterests: selectedMainInterests,
    subInterests: selectedSubInterests,
    // Legacy compatibility
    interests: selectedSubInterests,
    interestRanks: preferences.interestRanks ?? {},
    activityLevel: preferences.activityLevel,
    timePreference: preferences.timePreference ?? 'whole_day',
    matchMode: 'strict' as const,
  };
  const maxBudget = Math.max(1, Math.round(preferences.budget));
  const days = Math.max(1, Math.floor(preferences.duration));
  const hasBudget = Number.isFinite(preferences.budget) && preferences.budget > 0;
  const constrainedBody = {
    ...preferencePayload,
    budgetMode: 'constrained' as const,
    maxBudget,
    days,
  };
  const unconstrainedBody = {
    ...preferencePayload,
    budgetMode: 'unconstrained' as const,
    days,
  };

  // Backend requires `budgetMode`; keep retries compatible without sending known-invalid payloads.
  const requestCandidates = [
    hasBudget ? constrainedBody : unconstrainedBody,
    { ...preferencePayload, budgetMode: hasBudget ? 'constrained' : 'unconstrained', maxBudget, days },
    { ...preferencePayload, budgetMode: hasBudget ? 'constrained' : 'unconstrained', days },
    ...(hasBudget ? [{ ...preferencePayload, budgetMode: 'constrained' as const, maxBudget }] : []),
  ];

  let payload: RecommendationsPayload | null = null;
  let lastError: unknown = null;
  for (const candidate of requestCandidates) {
    try {
      payload = await apiPost<RecommendationsPayload>(RECOMMENDATIONS_ENDPOINT, candidate);
      break;
    } catch (error) {
      lastError = error;
      if (isAuthFailure(error)) {
        break;
      }
    }
  }

  if (!payload) {
    if (allDestinations.length > 0) {
      console.warn('Recommendations API failed; falling back to local scoring.', lastError);
      const fallbackScores = new Map<string, number>();
      const rankedFallbackDestinations = [...allDestinations]
        .map((destination) => {
          const score = calculateContentScore(destination, preferences);
          fallbackScores.set(destination.id, score);
          return { destination, score };
        })
        .sort((a, b) => b.score - a.score)
        .map((item) => item.destination);
      const fallbackDestinations = filterDestinationsBySelectedSubInterests(
        rankedFallbackDestinations,
        preferences
      ).slice(0, Math.max(1, Math.min(limit, allDestinations.length)));

      return {
        destinations: fallbackDestinations,
        scores: fallbackScores,
        metadata: {},
      };
    }
    throw (lastError instanceof Error ? lastError : new Error('Failed to fetch recommendations'));
  }

  const items = extractItems(payload);

  const destinations: Destination[] = [];
  const scores = new Map<string, number>();
  const seenDestinationIds = new Set<string>();
  const destinationById = new Map(allDestinations.map((item) => [item.id, item]));
  const destinationByName = new Map(
    allDestinations
      .map((item) => [normalizeName(item.name), item] as const)
      .filter(([name]) => Boolean(name))
  );
  let unmappedCount = 0;

  items.forEach((item) => {
    const destinationRef = item && typeof item === 'object' && 'destination' in item
      ? item.destination
      : (item as RawDestination | string);
    if (!destinationRef) return;
    const destinationId = getDestinationId(destinationRef);
    const mappedById = destinationId ? destinationById.get(destinationId) : undefined;
    const referenceName =
      typeof destinationRef === 'object' && destinationRef !== null && 'name' in destinationRef
        ? (destinationRef as { name?: unknown }).name
        : undefined;
    const mappedByName = destinationByName.get(normalizeName(referenceName));
    const mapped = mappedById ?? mappedByName;
    if (!mapped) {
      unmappedCount += 1;
      return;
    }
    if (seenDestinationIds.has(mapped.id)) {
      return;
    }
    destinations.push(mapped);
    seenDestinationIds.add(mapped.id);

    const score = extractScore(item);
    if (score !== null) {
      scores.set(mapped.id, score);
    }
  });

  const metadata =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? {
          recommendationRequestId:
            ('requestId' in payload && typeof payload.requestId === 'string' ? payload.requestId : undefined) ??
            ('recommendationId' in payload && typeof payload.recommendationId === 'string'
              ? payload.recommendationId
              : undefined),
          modelVersion:
            ('modelVersion' in payload && typeof payload.modelVersion === 'string' ? payload.modelVersion : undefined) ??
            ('algorithmVersion' in payload && typeof payload.algorithmVersion === 'string'
              ? payload.algorithmVersion
              : undefined),
          algorithmUsed: ('algorithmUsed' in payload && typeof payload.algorithmUsed === 'string')
            ? payload.algorithmUsed
            : undefined,
          budget: extractBudgetSummary(payload),
        }
      : {};

  if (items.length > 0 && destinations.length === 0) {
    if (allDestinations.length > 0) {
      console.warn(
        `Server returned ${items.length} recommendations but none matched loaded destinations (unmapped: ${unmappedCount}). Falling back to local scoring.`
      );
      const fallbackScores = new Map<string, number>();
      const rankedFallbackDestinations = [...allDestinations]
        .map((destination) => {
          const score = calculateContentScore(destination, preferences);
          fallbackScores.set(destination.id, score);
          return { destination, score };
        })
        .sort((a, b) => b.score - a.score)
        .map((item) => item.destination);
      const fallbackDestinations = filterDestinationsBySelectedSubInterests(
        rankedFallbackDestinations,
        preferences
      ).slice(0, Math.max(1, Math.min(limit, allDestinations.length)));

      return {
        destinations: fallbackDestinations,
        scores: fallbackScores,
        metadata: {},
      };
    }
    throw new Error(
      `Server returned ${items.length} recommendations but none matched loaded destinations (unmapped: ${unmappedCount}).`
    );
  }

  const effectiveLimit = Math.max(1, Math.min(limit, allDestinations.length || limit));
  const hardFilteredDestinations = filterDestinationsBySelectedSubInterests(destinations, preferences);
  const limitedDestinations = hardFilteredDestinations.slice(0, effectiveLimit);
  const limitedScores = new Map<string, number>();
  limitedDestinations.forEach((destination) => {
    const score = scores.get(destination.id);
    if (score !== undefined) {
      limitedScores.set(destination.id, score);
    }
  });

  return { destinations: limitedDestinations, scores: limitedScores, metadata };
}
