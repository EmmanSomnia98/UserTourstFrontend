import { Destination } from '@/app/types/destination';
import { apiGet } from '@/app/api/client';
import { resolveAssetUrl } from '@/app/api/client';

type DestinationPayload =
  | Destination[]
  | { data: Destination[] }
  | { destinations: Destination[] };

export type InterestSchemaSubInterest = {
  id: string;
  label: string;
};

export type InterestSchemaMainInterest = {
  id: string;
  label: string;
  subInterests: InterestSchemaSubInterest[];
};

type RawDestination = Partial<Destination> & {
  _id?: string;
  destinationId?: string;
  destinationName?: string;
  title?: string;
  summary?: string;
  shortDescription?: string;
  short_description?: string;
  category?: string;
  destinationType?: string;
  destination_type?: string;
  activityType?: string;
  activity_type?: string;
  level?: string;
  activityLevel?: string;
  activity_level?: string;
  cost?: number | string;
  price?: number | string;
  estimated_cost?: number | string;
  estimatedCostPerActivity?: number | string;
  estimated_cost_per_activity?: number | string;
  review_count?: number | string;
  reviewCount?: number | string;
  rating_count?: number | string;
  interest?: string[] | string;
  tags?: string[] | string;
  mainInterests?: string[] | string;
  main_interests?: string[] | string;
  subInterests?: string[] | string;
  sub_interests?: string[] | string;
  best_time_to_visit?: string[] | string;
  durationHours?: number | string;
  estimatedDuration?: number | string;
  estimated_duration?: number | string;
  lat?: number | string;
  lng?: number | string;
  latitude?: number | string;
  longitude?: number | string;
  coordinates?: [number, number];
  location?: {
    lat?: number | string;
    lng?: number | string;
    latitude?: number | string;
    longitude?: number | string;
    coordinates?: [number, number];
  };
  imageUrl?: string;
  image_url?: string;
  thumbnail?: string;
  photo?: string;
  photos?: string[] | Array<{ url?: string; secure_url?: string; path?: string }>;
  images?: string[] | Array<{ url?: string; secure_url?: string; path?: string }>;
};

function extractDestinations(payload: DestinationPayload): Destination[] {
  if (Array.isArray(payload)) return normalizeDestinations(payload);
  if ('destinations' in payload && Array.isArray(payload.destinations)) return normalizeDestinations(payload.destinations);
  if ('data' in payload && Array.isArray(payload.data)) return normalizeDestinations(payload.data);
  return [];
}

function normalizeDestinations(items: RawDestination[]): Destination[] {
  const TYPE_FALLBACK: Destination['type'] = 'nature';
  const DIFFICULTY_FALLBACK: Destination['difficulty'] = 'easy';

  const normalizeText = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    return value.trim();
  };

  const normalizeStringArray = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value.map((item) => normalizeText(item)).filter(Boolean);
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  };

  const normalizeType = (value: unknown): Destination['type'] => {
    const normalized = normalizeText(value).toLowerCase();
    if (normalized === 'nature') return 'nature';
    if (normalized === 'adventure') return 'adventure';
    if (normalized === 'cultural') return 'cultural';
    if (normalized === 'relaxation') return 'relaxation';
    if (normalized === 'historical') return 'historical';
    return TYPE_FALLBACK;
  };

  const normalizeDifficulty = (value: unknown): Destination['difficulty'] => {
    const normalized = normalizeText(value).toLowerCase();
    if (normalized === 'easy') return 'easy';
    if (normalized === 'moderate') return 'moderate';
    if (normalized === 'challenging') return 'challenging';
    return DIFFICULTY_FALLBACK;
  };

  const pickImageValue = (item: RawDestination): string => {
    const objectWithUrl = (value: unknown): string => {
      if (!value || typeof value !== 'object') return '';
      const candidate = value as { url?: unknown; secure_url?: unknown; path?: unknown };
      return (
        normalizeText(candidate.url) ||
        normalizeText(candidate.secure_url) ||
        normalizeText(candidate.path)
      );
    };

    const fromArray = (value: unknown): string => {
      if (!Array.isArray(value) || value.length === 0) return '';
      for (const entry of value) {
        const asText = normalizeText(entry);
        if (asText) return asText;
        const asObject = objectWithUrl(entry);
        if (asObject) return asObject;
      }
      return '';
    };

    return (
      normalizeText(item.image) ||
      normalizeText(item.imageUrl) ||
      normalizeText(item.image_url) ||
      normalizeText(item.thumbnail) ||
      normalizeText(item.photo) ||
      fromArray(item.images) ||
      fromArray(item.photos)
    );
  };

  return items.map((item, index) => {
    const fallbackId = `destination-${index}-${String(item.name ?? 'unknown')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')}`;

    const name = normalizeText(item.name) || normalizeText(item.destinationName) || normalizeText(item.title) || 'Unknown destination';
    const description =
      normalizeText(item.description) ||
      normalizeText(item.summary) ||
      normalizeText(item.shortDescription) ||
      normalizeText(item.short_description);
    const estimatedCost =
      toNumber(item.estimatedCost) ??
      toNumber(item.estimated_cost) ??
      toNumber(item.estimatedCostPerActivity) ??
      toNumber(item.estimated_cost_per_activity) ??
      toNumber(item.cost) ??
      toNumber(item.price) ??
      0;
    const rating = toNumber(item.rating) ?? 0;
    const reviewCount = toNumber(item.reviewCount) ?? toNumber(item.review_count) ?? toNumber(item.rating_count) ?? 0;
    const interests = normalizeStringArray(item.interests ?? item.interest ?? item.tags);
    const mainInterests = normalizeStringArray(item.mainInterests ?? item.main_interests);
    const subInterests = normalizeStringArray(item.subInterests ?? item.sub_interests);
    const bestTimeToVisit = normalizeStringArray(item.bestTimeToVisit ?? item.best_time_to_visit);

    return {
      id: String(item.id ?? item._id ?? item.destinationId ?? fallbackId),
      name,
      description,
      duration: normalizeDuration(item),
      type: normalizeType(item.type ?? item.destinationType ?? item.destination_type ?? item.category ?? item.activityType ?? item.activity_type),
      difficulty: normalizeDifficulty(item.difficulty ?? item.level ?? item.activityLevel ?? item.activity_level),
      rating,
      reviewCount: Math.max(0, Math.round(reviewCount)),
      interests,
      mainInterests,
      subInterests,
      bestTimeToVisit,
      estimatedCost: Math.max(0, estimatedCost),
      location: normalizeLocation(item),
      image: resolveAssetUrl(pickImageValue(item)),
    } as Destination;
  });
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeLocation(item: RawDestination): Destination['location'] {
  const candidates: Array<[unknown, unknown]> = [
    [item.location?.lat, item.location?.lng],
    [item.location?.latitude, item.location?.longitude],
    [item.lat, item.lng],
    [item.latitude, item.longitude],
    [item.location?.coordinates?.[1], item.location?.coordinates?.[0]],
    [item.coordinates?.[1], item.coordinates?.[0]],
  ];

  for (const [latRaw, lngRaw] of candidates) {
    const lat = toNumber(latRaw);
    const lng = toNumber(lngRaw);
    if (lat === null || lng === null) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    return { lat, lng };
  }

  // Keep a safe fallback object to avoid undefined access in UI.
  return { lat: Number.NaN, lng: Number.NaN };
}

function parseNumberish(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const direct = Number(trimmed);
  if (Number.isFinite(direct)) return direct;
  const match = trimmed.match(/(\d+(\.\d+)?)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDuration(item: RawDestination): number {
  const candidates = [item.duration, item.durationHours, item.estimatedDuration, item.estimated_duration];
  for (const candidate of candidates) {
    const parsed = parseNumberish(candidate);
    if (parsed !== null && parsed > 0) return parsed;
  }
  return 0;
}

export async function fetchDestinations(): Promise<Destination[]> {
  const payload = await apiGet<DestinationPayload>('/api/destinations');
  return extractDestinations(payload);
}

type InterestsSchemaPayload =
  | InterestSchemaMainInterest[]
  | {
      mainInterests?: Array<{
        id?: unknown;
        label?: unknown;
        subInterests?: Array<{ id?: unknown; label?: unknown }>;
        sub_interests?: Array<{ id?: unknown; label?: unknown }>;
      }> | Record<string, unknown>;
      interests?: Array<{
        id?: unknown;
        label?: unknown;
        subInterests?: Array<{ id?: unknown; label?: unknown }>;
      }> | Record<string, unknown>;
      data?: unknown;
    };

function normalizeSchemaId(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeSchemaLabel(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function humanizeInterestId(id: string): string {
  return id
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export async function fetchInterestsSchema(): Promise<InterestSchemaMainInterest[]> {
  const payload = await apiGet<InterestsSchemaPayload>('/api/destinations/interests-schema');
  const arraySource = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.mainInterests)
      ? payload.mainInterests
      : Array.isArray(payload?.interests)
        ? payload.interests
        : [];
  let source: Array<Record<string, unknown>> = arraySource as Array<Record<string, unknown>>;

  if (source.length === 0 && payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const mapCandidate =
      payload.mainInterests && typeof payload.mainInterests === 'object' && !Array.isArray(payload.mainInterests)
        ? payload.mainInterests
        : payload.interests && typeof payload.interests === 'object' && !Array.isArray(payload.interests)
          ? payload.interests
          : null;

    if (mapCandidate && typeof mapCandidate === 'object') {
      source = Object.entries(mapCandidate).map(([key, value]) => {
        const entry = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
        return {
          id: entry.id ?? key,
          label: entry.label ?? key,
          subInterests: entry.subInterests ?? entry.sub_interests,
          sub_interests: entry.sub_interests ?? entry.subInterests,
        };
      });
    }
  }

  return source
    .map((item) => {
      const entry = item as Record<string, unknown>;
      const id = normalizeSchemaId(entry.id);
      const label = normalizeSchemaLabel(entry.label) || id;
      const subInterestsCandidate = entry.subInterests;
      const subInterestsLegacyCandidate = entry.sub_interests;
      const rawSubs = Array.isArray(subInterestsCandidate)
        ? subInterestsCandidate
        : Array.isArray(subInterestsLegacyCandidate)
          ? subInterestsLegacyCandidate
          : [];
      const subInterests = rawSubs
        .map((sub) => {
          if (typeof sub === 'string') {
            const subId = normalizeSchemaId(sub);
            if (!subId) return null;
            return { id: subId, label: humanizeInterestId(subId) };
          }
          const subEntry = sub as Record<string, unknown>;
          const subId = normalizeSchemaId(subEntry.id);
          const subLabel =
            normalizeSchemaLabel(subEntry.label) ||
            (subId ? humanizeInterestId(subId) : '');
          if (!subId) return null;
          return { id: subId, label: subLabel };
        })
        .filter((entry): entry is InterestSchemaSubInterest => Boolean(entry));
      if (!id) return null;
      return { id, label, subInterests };
    })
    .filter((entry): entry is InterestSchemaMainInterest => Boolean(entry));
}
