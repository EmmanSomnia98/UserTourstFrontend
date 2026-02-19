import { apiDelete, apiGet, apiPost, clearAuthSession, getAuthToken, resolveAssetUrl } from '@/app/api/client';
import { SavedItinerary } from '@/app/types/saved-itinerary';
import { Destination } from '@/app/types/destination';

type BackendItineraryDestination = {
  destination?: Destination & {
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
    location?: {
      lat?: number | string;
      lng?: number | string;
      latitude?: number | string;
      longitude?: number | string;
      coordinates?: [number, number];
    };
  };
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
  return items
    .map((item) => item.destination)
    .map((destination) =>
      destination
        ? ({
            ...destination,
            duration: normalizeDuration(destination),
            location: normalizeLocation(destination),
            image: resolveAssetUrl(destination.image),
          } as Destination)
        : destination
    )
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

function mapBackendItinerary(itinerary: BackendItinerary, index: number): SavedItinerary {
  const destinations = toDestinationList(itinerary.destinations);
  const durationFromDestinations = destinations.reduce((sum, dest) => sum + Number(dest.duration || 0), 0);
  const backendTotalDuration = toNumber(itinerary.totalDuration) ?? toNumber(itinerary.durationHours) ?? 0;
  const totalDuration = Math.max(durationFromDestinations, backendTotalDuration);
  const createdAt = itinerary.createdAt ?? new Date().toISOString();
  const backendTripDays = parseTripDaysCandidate(itinerary);
  const inferredTripDays = deriveTripDays(totalDuration);
  return {
    id: itinerary.id ?? itinerary._id ?? `itinerary-${index}`,
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
    if (error instanceof Error && error.message.includes('(401)')) {
      clearAuthSession();
      return [];
    }
    throw error;
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
    destinations: itinerary.destinations.map((destination) => ({
      // Send identifiers only for compatibility with Mongoose ObjectId refs.
      destination: destination.id,
      destinationId: destination.id,
      cost: destination.estimatedCost,
      duration: destination.duration,
      durationHours: destination.duration,
    })),
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
  } finally {
    inFlightCreateByKey.delete(signature);
  }
}

export async function deleteRemoteItinerary(id: string): Promise<boolean> {
  const token = getAuthToken();
  if (!token) return false;

  try {
    await apiDelete(`/api/itineraries/${encodeURIComponent(id)}`);
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('(401)')) {
      clearAuthSession();
      return false;
    }
    throw error;
  }
}
