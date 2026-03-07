import { apiDelete, apiGet, apiPost, clearAuthSession, getAuthToken, resolveAssetUrl } from '@/app/api/client';
import { SavedItinerary } from '@/app/types/saved-itinerary';
import { Destination } from '@/app/types/destination';

type BackendItineraryDestination = {
  destination?: (Destination & {
    id?: unknown;
    _id?: unknown;
    destinationId?: unknown;
    durationInHours?: number | string;
    durationHours?: number | string;
    visitDuration?: number | string;
    estimatedTime?: number | string;
    estimated_time?: number | string;
    timeRequired?: number | string;
    hours?: number | string;
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
  }) | string | number;
  destinationId?: unknown;
  cost?: number;
  hybridScore?: number;
};

type BackendItinerary = {
  _id?: string;
  id?: string;
  name?: string;
  createdAt?: string;
  tripDays?: number;
  duration?: number;
  tripDuration?: number;
  trip_duration?: number;
  days?: number;
  totalDays?: number;
  durationDays?: number;
  numberOfDays?: number;
  number_of_days?: number;
  itineraryDays?: number;
  itinerary_days?: number;
  totalCost?: number;
  totalDuration?: number;
  durationHours?: number;
  maxBudget?: number;
  destinations?: BackendItineraryDestination[];
};

type ItineraryPayload =
  | BackendItinerary[]
  | { data: BackendItinerary[] }
  | { itineraries: BackendItinerary[] };

const HOURS_PER_DAY = 8;
const CREATE_DEDUPE_WINDOW_MS = 15_000;
const MERGE_SEGMENT_WINDOW_MS = 5_000;
const LIST_DEDUPE_WINDOW_MS = 15_000;
const inFlightCreateByKey = new Map<string, Promise<SavedItinerary | null>>();
const recentCreateByKey = new Map<string, { at: number; value: SavedItinerary | null }>();

function toDestinationList(items: BackendItineraryDestination[] | undefined): Destination[] {
  if (!items?.length) return [];

  const normalizeText = (value: unknown): string =>
    typeof value === 'string' ? value.trim() : '';
  const normalizeDestinationType = (value: unknown): Destination['type'] => {
    const normalized = normalizeText(value).toLowerCase();
    if (
      normalized === 'nature' ||
      normalized === 'adventure' ||
      normalized === 'cultural' ||
      normalized === 'relaxation' ||
      normalized === 'historical'
    ) {
      return normalized;
    }
    return 'nature';
  };
  const normalizeDifficulty = (value: unknown): Destination['difficulty'] => {
    const normalized = normalizeText(value).toLowerCase();
    if (normalized === 'easy' || normalized === 'moderate' || normalized === 'challenging') {
      return normalized;
    }
    return 'easy';
  };
  const normalizeStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(Boolean);
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
  const fromArray = (value: unknown): string[] => {
    if (!Array.isArray(value) || value.length === 0) return [];
    const images: string[] = [];
    const seen = new Set<string>();
    const append = (entry: unknown) => {
      const asText = normalizeText(entry);
      if (asText && !seen.has(asText)) {
        seen.add(asText);
        images.push(asText);
      }
      const asObject = objectWithUrl(entry);
      if (asObject && !seen.has(asObject)) {
        seen.add(asObject);
        images.push(asObject);
      }
    };
    for (const entry of value) {
      append(entry);
    }
    return images;
  };

  return items
    .map((item) => {
      const destinationRaw = item.destination;
      const destination =
        destinationRaw && typeof destinationRaw === 'object'
          ? (destinationRaw as NonNullable<BackendItineraryDestination['destination']> & Record<string, unknown>)
          : null;
      const normalizedId = normalizeIdentifier(
        destination?.id ??
        destination?._id ??
        destination?.destinationId ??
        item.destinationId ??
        (typeof destinationRaw === 'string' || typeof destinationRaw === 'number' ? destinationRaw : null)
      );
      if (!normalizedId) return null;
      const getImages = (): string[] => {
        const images: string[] = [];
        const seen = new Set<string>();
        const append = (value: unknown) => {
          const normalized = normalizeText(value);
          if (!normalized || seen.has(normalized)) return;
          seen.add(normalized);
          images.push(normalized);
        };
        append(destination?.image);
        append(destination?.imageUrl);
        append(destination?.image_url);
        append(destination?.thumbnail);
        append(destination?.photo);
        fromArray(destination?.images).forEach(append);
        fromArray(destination?.photos).forEach(append);
        return images;
      };
      const estimatedCost = toNumber(destination?.estimatedCost) ?? toNumber(item.cost) ?? 0;
      const location = normalizeLocation(destination as BackendItineraryDestination['destination']);
      const address = normalizeAddress(destination as BackendItineraryDestination['destination']);
      const duration = normalizeDuration(destination as BackendItineraryDestination['destination']);

      const normalizedImages = getImages().map((value) => resolveAssetUrl(value)).filter(Boolean);
      return {
        ...(destination as Destination),
        id: normalizedId,
        name: normalizeText(destination?.name) || 'Unknown destination',
        description: normalizeText(destination?.description),
        image: normalizedImages[0] ?? '',
        images: normalizedImages,
        type: normalizeDestinationType(destination?.type),
        difficulty: normalizeDifficulty(destination?.difficulty),
        duration,
        rating: toNumber(destination?.rating) ?? 0,
        reviewCount: Math.max(0, Math.round(toNumber(destination?.reviewCount) ?? 0)),
        interests: normalizeStringArray(destination?.interests),
        mainInterests: normalizeStringArray(destination?.mainInterests),
        subInterests: normalizeStringArray(destination?.subInterests),
        bestTimeToVisit: normalizeStringArray(destination?.bestTimeToVisit),
        estimatedCost,
        location,
        address,
      } as Destination;
    })
    .filter((dest): dest is Destination => Boolean(dest));
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeLocation(destination: BackendItineraryDestination['destination']): Destination['location'] {
  const candidates: Array<[unknown, unknown]> = [
    [destination?.location?.lat, destination?.location?.lng],
    [destination?.location?.latitude, destination?.location?.longitude],
    [destination?.lat, destination?.lng],
    [destination?.latitude, destination?.longitude],
    [destination?.location?.coordinates?.[1], destination?.location?.coordinates?.[0]],
    [destination?.coordinates?.[1], destination?.coordinates?.[0]],
  ];

  for (const [latRaw, lngRaw] of candidates) {
    const lat = toNumber(latRaw);
    const lng = toNumber(lngRaw);
    if (lat === null || lng === null) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    return { lat, lng };
  }

  return { lat: Number.NaN, lng: Number.NaN };
}

function normalizeAddress(
  destination: BackendItineraryDestination['destination']
): Destination['address'] {
  const normalizeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
  const addressObject =
    destination?.address && typeof destination.address === 'object' && !Array.isArray(destination.address)
      ? destination.address
      : null;
  const cityValue =
    normalizeText(destination?.city) ||
    normalizeText(destination?.municipality) ||
    normalizeText(destination?.location?.city) ||
    normalizeText(destination?.location?.municipality) ||
    normalizeText(addressObject?.city) ||
    normalizeText(addressObject?.municipality);

  const normalized: NonNullable<Destination['address']> = {
    purok:
      normalizeText(destination?.purok) ||
      normalizeText(destination?.location?.purok) ||
      normalizeText(addressObject?.purok),
    barangay:
      normalizeText(destination?.barangay) ||
      normalizeText(destination?.location?.barangay) ||
      normalizeText(addressObject?.barangay),
    city: cityValue,
    province:
      normalizeText(destination?.province) ||
      normalizeText(destination?.location?.province) ||
      normalizeText(addressObject?.province),
    fullAddress:
      normalizeText(destination?.fullAddress) ||
      normalizeText(destination?.full_address) ||
      normalizeText(destination?.location?.fullAddress) ||
      normalizeText(destination?.location?.full_address) ||
      normalizeText(addressObject?.fullAddress) ||
      normalizeText(addressObject?.full_address) ||
      normalizeText(typeof destination?.address === 'string' ? destination.address : ''),
  };

  const hasAnyAddressPart = Object.values(normalized).some(Boolean);
  return hasAnyAddressPart ? normalized : undefined;
}

function parseNumberish(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
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

function normalizeIdentifier(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (value && typeof value === 'object') {
    const oid = (value as { $oid?: unknown }).$oid;
    if (typeof oid === 'string' && oid.trim()) return oid.trim();
  }
  return null;
}

function normalizeDuration(destination: BackendItineraryDestination['destination']): number {
  const candidates = [
    destination?.duration,
    destination?.durationInHours,
    destination?.durationHours,
    destination?.visitDuration,
    destination?.estimatedTime,
    destination?.estimated_time,
    destination?.timeRequired,
    destination?.hours,
    destination?.estimatedDuration,
    destination?.estimated_duration,
  ];
  for (const candidate of candidates) {
    const parsed = parseNumberish(candidate);
    if (parsed !== null && parsed > 0) return parsed;
  }
  return 0;
}

function deriveTripDays(totalDuration: number): number {
  if (!Number.isFinite(totalDuration) || totalDuration <= 0) return 1;
  return Math.max(1, Math.ceil(totalDuration / HOURS_PER_DAY));
}

function parseTripDaysCandidate(itinerary: BackendItinerary): number {
  const rawCandidates = [
    itinerary.tripDays,
    itinerary.duration,
    itinerary.tripDuration,
    itinerary.trip_duration,
    itinerary.days,
    itinerary.totalDays,
    itinerary.durationDays,
    itinerary.numberOfDays,
    itinerary.number_of_days,
    itinerary.itineraryDays,
    itinerary.itinerary_days,
  ];
  for (const candidate of rawCandidates) {
    const parsed = toNumber(candidate);
    if (parsed && parsed > 0) return Math.round(parsed);
  }
  return 0;
}

function normalizeItineraryId(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (value && typeof value === 'object') {
    const maybeOid = (value as { $oid?: unknown }).$oid;
    if (typeof maybeOid === 'string' && maybeOid.trim()) {
      return maybeOid.trim();
    }
  }
  return null;
}

function isSafeRemoteItineraryId(id: string): boolean {
  const trimmed = id.trim();
  if (!trimmed) return false;
  if (trimmed.toLowerCase() === '[object object]') return false;
  if (trimmed.startsWith('itinerary-')) return false;
  return true;
}

function mapBackendItinerary(itinerary: BackendItinerary, index: number): SavedItinerary {
  const destinations = toDestinationList(itinerary.destinations);
  const durationFromDestinations = destinations.reduce((sum, dest) => sum + Number(dest.duration || 0), 0);
  const backendTotalDuration = toNumber(itinerary.totalDuration) ?? toNumber(itinerary.durationHours) ?? 0;
  const totalDuration = Math.max(durationFromDestinations, backendTotalDuration);
  const createdAt = itinerary.createdAt ?? new Date().toISOString();
  const backendTripDays = parseTripDaysCandidate(itinerary);
  const inferredTripDays = deriveTripDays(totalDuration);
  const normalizedId =
    normalizeItineraryId(itinerary.id) ??
    normalizeItineraryId(itinerary._id) ??
    `itinerary-${index}`;
  return {
    id: normalizedId,
    name: itinerary.name?.trim() || `Itinerary ${index + 1}`,
    destinations,
    // Prefer explicit backend day fields when present.
    tripDays: backendTripDays > 0 ? backendTripDays : inferredTripDays,
    createdAt,
    totalCost: Number(itinerary.totalCost ?? 0),
    totalDuration,
  };
}

function buildContentSignature(itinerary: SavedItinerary): string {
  const destinationIds = itinerary.destinations.map((item) => item.id).join(',');
  return [
    itinerary.name.trim().toLowerCase(),
    itinerary.tripDays,
    Math.round(itinerary.totalCost),
    destinationIds,
  ].join('|');
}

function hashString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function parseTimestamp(value: string): number {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function mergeSegmentedItineraries(items: SavedItinerary[]): SavedItinerary[] {
  const groups = new Map<string, SavedItinerary[]>();

  items.forEach((item) => {
    const normalizedName = item.name.trim().toLowerCase();
    const createdAt = parseTimestamp(item.createdAt);
    const bucket = Math.floor(createdAt / MERGE_SEGMENT_WINDOW_MS);
    const key = `${normalizedName}|${bucket}`;
    const current = groups.get(key) ?? [];
    current.push(item);
    groups.set(key, current);
  });

  const merged: SavedItinerary[] = [];

  groups.forEach((group) => {
    if (group.length === 1) {
      merged.push(group[0]);
      return;
    }

    const sorted = [...group].sort((a, b) => parseTimestamp(a.createdAt) - parseTimestamp(b.createdAt));
    const destinationById = new Map<string, Destination>();
    sorted.forEach((item) => {
      item.destinations.forEach((destination) => {
        if (!destinationById.has(destination.id)) {
          destinationById.set(destination.id, destination);
        }
      });
    });

    const destinations = Array.from(destinationById.values());
    const totalDuration = destinations.reduce((sum, destination) => sum + Number(destination.duration || 0), 0);
    const derivedTripDays = deriveTripDays(totalDuration);
    const maxTripDays = sorted.reduce((max, item) => Math.max(max, item.tripDays || 0), 0);
    const summedDestinationCost = destinations.reduce((sum, destination) => sum + Number(destination.estimatedCost || 0), 0);
    const maxReportedCost = sorted.reduce((max, item) => Math.max(max, Number(item.totalCost || 0)), 0);
    const base = sorted[0];

    merged.push({
      ...base,
      destinations,
      totalDuration,
      tripDays: maxTripDays > 0 ? maxTripDays : derivedTripDays,
      totalCost: Math.max(summedDestinationCost, maxReportedCost),
    });
  });

  return merged;
}

function dedupeItineraries(items: SavedItinerary[]): SavedItinerary[] {
  const sorted = [...items].sort((a, b) => parseTimestamp(b.createdAt) - parseTimestamp(a.createdAt));
  const seen = new Set<string>();
  const deduped: SavedItinerary[] = [];

  for (const item of sorted) {
    const createdAt = parseTimestamp(item.createdAt);
    const bucket = Math.floor(createdAt / LIST_DEDUPE_WINDOW_MS);
    const key = `${buildContentSignature(item)}|${bucket}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped.sort((a, b) => parseTimestamp(b.createdAt) - parseTimestamp(a.createdAt));
}

function extractItineraries(payload: ItineraryPayload): SavedItinerary[] {
  const items = Array.isArray(payload)
    ? payload
    : 'itineraries' in payload && Array.isArray(payload.itineraries)
      ? payload.itineraries
      : 'data' in payload && Array.isArray(payload.data)
        ? payload.data
        : [];

  const mapped = items.map(mapBackendItinerary);
  const merged = mergeSegmentedItineraries(mapped);
  return dedupeItineraries(merged);
}

export async function fetchItineraries(): Promise<SavedItinerary[]> {
  const token = getAuthToken();
  if (!token) return [];

  try {
    const payload = await apiGet<ItineraryPayload>('/api/itineraries');
    return extractItineraries(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? '');
    const isAuthError =
      message.includes('(401)') ||
      message.includes('(403)') ||
      message.toLowerCase().includes('unauthorized') ||
      message.toLowerCase().includes('token') ||
      message.toLowerCase().includes('jwt');
    if (isAuthError) {
      clearAuthSession();
      return [];
    }
    console.error('fetchItineraries failed, returning empty list:', error);
    return [];
  }
}

type CreateItineraryResponse =
  | BackendItinerary
  | { data?: BackendItinerary };

function normalizeCreatedItinerary(payload: CreateItineraryResponse): BackendItinerary | null {
  if (!payload) return null;
  if ('data' in payload && payload.data) return payload.data;
  return payload;
}

export async function createItinerary(itinerary: SavedItinerary): Promise<SavedItinerary | null> {
  const token = getAuthToken();
  if (!token) return null;
  const signature = buildContentSignature(itinerary);
  const now = Date.now();
  const recent = recentCreateByKey.get(signature);
  if (recent && now - recent.at < CREATE_DEDUPE_WINDOW_MS) {
    return recent.value;
  }

  const inFlight = inFlightCreateByKey.get(signature);
  if (inFlight) {
    return inFlight;
  }

  const payloadDestinations = itinerary.destinations
    .map((destination) => {
      const destinationId = normalizeIdentifier(destination.id);
      if (!destinationId) return null;
      return {
        destination: destinationId,
        destinationId,
        cost: destination.estimatedCost,
        duration: destination.duration,
        durationHours: destination.duration,
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value));

  if (itinerary.destinations.length > 0 && payloadDestinations.length === 0) {
    throw new Error('Unable to save itinerary: destination IDs are missing.');
  }

  const payload = {
    name: itinerary.name,
    totalCost: itinerary.totalCost,
    maxBudget: itinerary.totalCost,
    tripDays: itinerary.tripDays,
    days: itinerary.tripDays,
    duration: itinerary.tripDays,
    tripDuration: itinerary.tripDays,
    trip_duration: itinerary.tripDays,
    totalDays: itinerary.tripDays,
    durationDays: itinerary.tripDays,
    numberOfDays: itinerary.tripDays,
    number_of_days: itinerary.tripDays,
    itineraryDays: itinerary.tripDays,
    itinerary_days: itinerary.tripDays,
    totalDuration: itinerary.totalDuration,
    durationHours: itinerary.totalDuration,
    destinations: payloadDestinations,
  };

  const request = (async () => {
    const idempotencyKey = `itn-${hashString(signature)}`;
    const response = await apiPost<CreateItineraryResponse>('/api/itineraries', payload, {
      headers: {
        'X-Idempotency-Key': idempotencyKey,
      },
    });
    const created = normalizeCreatedItinerary(response);
    if (!created) return null;
    return mapBackendItinerary(created, 0);
  })();

  inFlightCreateByKey.set(signature, request);
  try {
    const created = await request;
    recentCreateByKey.set(signature, { at: Date.now(), value: created });
    return created;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? '');
    const isAuthError =
      message.includes('(401)') ||
      message.includes('(403)') ||
      message.toLowerCase().includes('unauthorized') ||
      message.toLowerCase().includes('token') ||
      message.toLowerCase().includes('jwt');

    if (isAuthError) {
      clearAuthSession();
      return null;
    }
    throw error;
  } finally {
    inFlightCreateByKey.delete(signature);
  }
}

export async function deleteRemoteItinerary(id: string): Promise<boolean> {
  const token = getAuthToken();
  if (!token) return false;
  if (!isSafeRemoteItineraryId(id)) return false;

  try {
    await apiDelete(`/api/itineraries/${encodeURIComponent(id)}`);
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('(401)')) {
      clearAuthSession();
      return false;
    }
    console.error('deleteRemoteItinerary failed:', error);
    return false;
  }
}
