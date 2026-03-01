import { apiPost } from '@/app/api/client';
import { Destination, UserPreferences } from '@/app/types/destination';

const RECOMMENDATIONS_ENDPOINT =
  (import.meta.env.VITE_RECOMMENDATIONS_ENDPOINT as string | undefined) ?? '/api/recommendations/itinerary';

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
    };

export type ServerRecommendationsResult = {
  destinations: Destination[];
  scores: Map<string, number>;
  metadata: {
    recommendationRequestId?: string;
    modelVersion?: string;
  };
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

function extractItems(payload: RecommendationsPayload): RecommendationItem[] {
  if (Array.isArray(payload)) return payload;
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

export async function fetchServerRecommendations(
  preferences: UserPreferences,
  limit = 6,
  allDestinations: Destination[] = []
): Promise<ServerRecommendationsResult> {
  const hasBudget = Number.isFinite(preferences.budget) && preferences.budget > 0;
  const constrainedBody = {
    budgetMode: 'constrained' as const,
    // Backend expects a trip-level budget ceiling.
    maxBudget: Math.max(1, Math.round(preferences.budget * Math.max(1, preferences.duration))),
  };
  const unconstrainedBody = {
    budgetMode: 'unconstrained' as const,
  };
  let payload = await apiPost<RecommendationsPayload>(
    RECOMMENDATIONS_ENDPOINT,
    hasBudget ? constrainedBody : unconstrainedBody
  );

  let items = extractItems(payload);

  // Backend-only fallback: if constrained mode returns nothing, retry unconstrained.
  if (items.length === 0 && hasBudget) {
    payload = await apiPost<RecommendationsPayload>(RECOMMENDATIONS_ENDPOINT, unconstrainedBody);
    items = extractItems(payload);
  }

  const destinations: Destination[] = [];
  const scores = new Map<string, number>();
  const destinationById = new Map(allDestinations.map((item) => [item.id, item]));
  let unmappedCount = 0;

  items.forEach((item) => {
    const destinationRef = item && typeof item === 'object' && 'destination' in item
      ? item.destination
      : (item as RawDestination | string);
    if (!destinationRef) return;
    const destinationId = getDestinationId(destinationRef);
    if (!destinationId) return;
    const mapped = destinationById.get(destinationId);
    if (!mapped) {
      unmappedCount += 1;
      return;
    }
    destinations.push(mapped);

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
        }
      : {};

  if (items.length > 0 && destinations.length === 0) {
    throw new Error(
      `Server returned ${items.length} recommendations but none matched loaded destinations (unmapped: ${unmappedCount}).`
    );
  }

  return { destinations, scores, metadata };
}
