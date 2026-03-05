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
  updatedAt?: unknown;
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
): Promise<{ destinationId: string; rating: number; updatedAt?: string }> {
  const payload = await apiPost<UpsertRatingResponse>(
    `/api/destinations/${encodeURIComponent(destinationId)}/rating`,
    { rating }
  );

  const normalizedDestinationId = normalizeDestinationId(payload?.destinationId) ?? destinationId;
  const normalizedRating = normalizeRating(payload?.rating) ?? Math.max(1, Math.min(5, Math.round(rating)));
  const updatedAt = typeof payload?.updatedAt === 'string' ? payload.updatedAt : undefined;

  return {
    destinationId: normalizedDestinationId,
    rating: normalizedRating,
    updatedAt,
  };
}

export async function clearDestinationRating(destinationId: string): Promise<void> {
  await apiDelete(`/api/destinations/${encodeURIComponent(destinationId)}/rating`);
}
