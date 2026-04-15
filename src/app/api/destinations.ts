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
  purok?: string;
  barangay?: string;
  city?: string;
  municipality?: string;
  province?: string;
  fullAddress?: string;
  full_address?: string;
  address?: string | {
    purok?: string;
    barangay?: string;
    city?: string;
    municipality?: string;
    province?: string;
    fullAddress?: string;
    full_address?: string;
  };
  location?: {
    lat?: number | string;
    lng?: number | string;
    latitude?: number | string;
    longitude?: number | string;
    coordinates?: [number, number];
    purok?: string;
    barangay?: string;
    city?: string;
    municipality?: string;
    province?: string;
    fullAddress?: string;
    full_address?: string;
  };
  imageUrl?: string;
  image_url?: string;
  thumbnail?: string;
  photo?: string;
  photos?: string[] | Array<{ url?: string; secure_url?: string; path?: string }>;
  images?: string[] | Array<{ url?: string; secure_url?: string; path?: string }>;
  features?: Record<string, unknown>;
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
  const pickImageValues = (item: RawDestination): string[] => {
    const images: string[] = [];
    const seen = new Set<string>();
    const append = (value: unknown) => {
      const normalized = normalizeText(value);
      if (!normalized) return;
      if (seen.has(normalized)) return;
      seen.add(normalized);
      images.push(normalized);
    };
    const objectWithUrl = (value: unknown): string => {
      if (!value || typeof value !== 'object') return '';
      const candidate = value as { url?: unknown; secure_url?: unknown; path?: unknown };
      return (
        normalizeText(candidate.url) ||
        normalizeText(candidate.secure_url) ||
        normalizeText(candidate.path)
      );
    };

    const fromArray = (value: unknown) => {
      if (!Array.isArray(value) || value.length === 0) return;
      for (const entry of value) {
        append(entry);
        const asObject = objectWithUrl(entry);
        append(asObject);
      }
    };

    append(item.image);
    append(item.imageUrl);
    append(item.image_url);
    append(item.thumbnail);
    append(item.photo);
    fromArray(item.images);
    fromArray(item.photos);

    return images;
  };

  const extractSubInterestsFromFeatures = (value: unknown): string[] => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const features = value as Record<string, unknown>;
    const extracted: string[] = [];

    Object.values(features).forEach((categoryValue) => {
      if (!categoryValue || typeof categoryValue !== 'object' || Array.isArray(categoryValue)) return;
      const flags = categoryValue as Record<string, unknown>;
      Object.entries(flags).forEach(([featureKey, enabled]) => {
        if (!(enabled === 1 || enabled === true || enabled === '1')) return;
        const normalized = featureKey
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
        if (!normalized) return;
        extracted.push(normalized);
      });
    });

    return Array.from(new Set(extracted));
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
    const explicitSubInterests = normalizeStringArray(item.subInterests ?? item.sub_interests);
    const derivedSubInterests = extractSubInterestsFromFeatures(item.features);
    const subInterests = Array.from(new Set([...explicitSubInterests, ...derivedSubInterests]));
    const bestTimeToVisit = normalizeStringArray(item.bestTimeToVisit ?? item.best_time_to_visit);

    const imageCandidates = pickImageValues(item).map((value) => resolveAssetUrl(value)).filter(Boolean);

    const normalizedDuration = normalizeDuration(item);

    return {
      id: String(item.id ?? item._id ?? item.destinationId ?? fallbackId),
      name,
      description,
      duration: normalizedDuration,
      durationHours: normalizedDuration,
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
      address: normalizeAddress(item),
      image: imageCandidates[0] ?? '',
      images: imageCandidates,
    } as Destination;
  });
}

function normalizeAddress(item: RawDestination): Destination['address'] {
  const normalizeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
  const addressObject =
    item.address && typeof item.address === 'object' && !Array.isArray(item.address)
      ? item.address
      : null;
  const cityValue =
    normalizeText(item.city) ||
    normalizeText(item.municipality) ||
    normalizeText(item.location?.city) ||
    normalizeText(item.location?.municipality) ||
    normalizeText(addressObject?.city) ||
    normalizeText(addressObject?.municipality);

  const normalized: NonNullable<Destination['address']> = {
    purok:
      normalizeText(item.purok) ||
      normalizeText(item.location?.purok) ||
      normalizeText(addressObject?.purok),
    barangay:
      normalizeText(item.barangay) ||
      normalizeText(item.location?.barangay) ||
      normalizeText(addressObject?.barangay),
    city: cityValue,
    province:
      normalizeText(item.province) ||
      normalizeText(item.location?.province) ||
      normalizeText(addressObject?.province),
    fullAddress:
      normalizeText(item.fullAddress) ||
      normalizeText(item.full_address) ||
      normalizeText(item.location?.fullAddress) ||
      normalizeText(item.location?.full_address) ||
      normalizeText(addressObject?.fullAddress) ||
      normalizeText(addressObject?.full_address) ||
      normalizeText(typeof item.address === 'string' ? item.address : ''),
  };

  const hasAnyAddressPart = Object.values(normalized).some(Boolean);
  return hasAnyAddressPart ? normalized : undefined;
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
      subInterests?: Array<{
        id?: unknown;
        label?: unknown;
        mainInterestId?: unknown;
        main_interest_id?: unknown;
      }>;
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

function normalizeSubInterestLabel(mainInterestId: string, subInterestId: string, fallbackLabel: string): string {
  const mainId = mainInterestId.trim().toLowerCase();
  const subId = subInterestId.trim().toLowerCase();

  // Canonical labels for Cultural Tourism in user preferences UI.
  if (mainId === 'culture_heritage') {
    if (subId === 'heritage_tours') return 'Heritage Tours';
    if (subId === 'food_tourism') return 'Food Tourism';
    if (subId === 'festivals_events') return 'Festival & Events';
    if (subId === 'culinary_tourism') return 'Culinary Tourism';
  }

  return fallbackLabel;
}

export async function fetchInterestsSchema(): Promise<InterestSchemaMainInterest[]> {
  const payload = await apiGet<InterestsSchemaPayload>('/api/destinations/interests-schema', {
    headers: {
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    },
  });
  const topLevelSubInterests = Array.isArray(payload?.subInterests) ? payload.subInterests : [];
  const subInterestsByMainInterestId = new Map<string, InterestSchemaSubInterest[]>();
  topLevelSubInterests.forEach((sub) => {
    const mainInterestId = normalizeSchemaId(
      (sub as Record<string, unknown>).mainInterestId ??
      (sub as Record<string, unknown>).main_interest_id
    );
    const subId = normalizeSchemaId((sub as Record<string, unknown>).id);
    const rawSubLabel =
      normalizeSchemaLabel((sub as Record<string, unknown>).label) ||
      (subId ? humanizeInterestId(subId) : '');
    const subLabel = normalizeSubInterestLabel(mainInterestId, subId, rawSubLabel);
    if (!mainInterestId || !subId) return;
    const current = subInterestsByMainInterestId.get(mainInterestId) ?? [];
    if (current.some((item) => item.id === subId)) return;
    current.push({ id: subId, label: subLabel });
    subInterestsByMainInterestId.set(mainInterestId, current);
  });

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
          : subInterestsByMainInterestId.get(id) ?? [];
      const seenSubLabels = new Set<string>();
      const subInterests = rawSubs
        .map((sub) => {
          if (typeof sub === 'string') {
            const subId = normalizeSchemaId(sub);
            if (!subId) return null;
            const subLabel = normalizeSubInterestLabel(id, subId, humanizeInterestId(subId));
            const subLabelKey = subLabel.trim().toLowerCase();
            if (!subLabelKey || seenSubLabels.has(subLabelKey)) return null;
            seenSubLabels.add(subLabelKey);
            return { id: subId, label: subLabel };
          }
          const subEntry = sub as Record<string, unknown>;
          const subId = normalizeSchemaId(subEntry.id);
          const rawSubLabel =
            normalizeSchemaLabel(subEntry.label) ||
            (subId ? humanizeInterestId(subId) : '');
          const subLabel = normalizeSubInterestLabel(id, subId, rawSubLabel);
          const subLabelKey = subLabel.trim().toLowerCase();
          if (!subId) return null;
          if (!subLabelKey || seenSubLabels.has(subLabelKey)) return null;
          seenSubLabels.add(subLabelKey);
          return { id: subId, label: subLabel };
        })
        .filter((entry): entry is InterestSchemaSubInterest => Boolean(entry));
      if (!id) return null;
      return { id, label, subInterests };
    })
    .filter((entry): entry is InterestSchemaMainInterest => Boolean(entry));
}
