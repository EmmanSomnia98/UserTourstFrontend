import { apiDelete, apiGet, apiPost } from '@/app/api/client';

type RatingItem = {
  destinationId?: unknown;
  rating?: unknown;
};

type MyRatingsResponse = {
  ratings?: RatingItem[];
};

type UpsertRatingResponse = {
  destinationId?: unknown;
  rating?: unknown;
  userRating?: unknown;
  reviewCount?: unknown;
  updatedAt?: unknown;
};

type ClearRatingResponse = {
  destinationId?: unknown;
  rating?: unknown;
  reviewCount?: unknown;
};

function normalizeRating(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed);
  if (rounded < 1 || rounded > 5) return null;
  return rounded;
}

function normalizeDestinationId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export async function fetchMyDestinationRatings(): Promise<Record<string, number>> {
  const payload = await apiGet<MyRatingsResponse>('/api/destinations/ratings/me');
  const items = Array.isArray(payload?.ratings) ? payload.ratings : [];
  const normalized: Record<string, number> = {};

  items.forEach((item) => {
    const destinationId = normalizeDestinationId(item.destinationId);
    const rating = normalizeRating(item.rating);
    if (!destinationId || rating === null) return;
    normalized[destinationId] = rating;
  });

  return normalized;
}

export async function upsertDestinationRating(
  destinationId: string,
  rating: number
): Promise<{
  destinationId: string;
  rating: number;
  aggregateRating?: number;
  reviewCount?: number;
  updatedAt?: string;
}> {
  const payload = await apiPost<UpsertRatingResponse>(
    `/api/destinations/${encodeURIComponent(destinationId)}/rating`,
    { rating }
  );

  const normalizedDestinationId = normalizeDestinationId(payload?.destinationId) ?? destinationId;
  const normalizedRating = normalizeRating(payload?.userRating) ?? Math.max(1, Math.min(5, Math.round(rating)));
  const normalizedAggregateRatingRaw = toFiniteNumber(payload?.rating);
  const normalizedAggregateRating =
    normalizedAggregateRatingRaw !== null
      ? Math.max(0, Math.round(normalizedAggregateRatingRaw * 10) / 10)
      : undefined;
  const normalizedReviewCountRaw =
    typeof payload?.reviewCount === 'number' ? payload.reviewCount : Number(payload?.reviewCount);
  const normalizedReviewCount = Number.isFinite(normalizedReviewCountRaw)
    ? Math.max(0, Math.round(normalizedReviewCountRaw))
    : undefined;
  const updatedAt = typeof payload?.updatedAt === 'string' ? payload.updatedAt : undefined;

  return {
    destinationId: normalizedDestinationId,
    rating: normalizedRating,
    aggregateRating: normalizedAggregateRating,
    reviewCount: normalizedReviewCount,
    updatedAt,
  };
}

export async function clearDestinationRating(
  destinationId: string
): Promise<{ destinationId: string; rating?: number; reviewCount?: number }> {
  const payload = await apiDelete<ClearRatingResponse>(`/api/destinations/${encodeURIComponent(destinationId)}/rating`);
  const normalizedDestinationId = normalizeDestinationId(payload?.destinationId) ?? destinationId;
  const normalizedAggregateRatingRaw = toFiniteNumber(payload?.rating);
  const normalizedAggregateRating =
    normalizedAggregateRatingRaw !== null
      ? Math.max(0, Math.round(normalizedAggregateRatingRaw * 10) / 10)
      : undefined;
  const normalizedReviewCountRaw =
    typeof payload?.reviewCount === 'number' ? payload.reviewCount : Number(payload?.reviewCount);
  const normalizedReviewCount = Number.isFinite(normalizedReviewCountRaw)
    ? Math.max(0, Math.round(normalizedReviewCountRaw))
    : undefined;

  return {
    destinationId: normalizedDestinationId,
    rating: normalizedAggregateRating ?? undefined,
    reviewCount: normalizedReviewCount,
  };
}
