import { apiGet, apiPost, getAuthToken } from '@/app/api/client';
import { SavedItinerary } from '@/app/types/saved-itinerary';
import { Destination } from '@/app/types/destination';

type BackendItineraryDestination = {
  destination?: Destination & {
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
  createdAt?: string;
  totalCost?: number;
  maxBudget?: number;
  destinations?: BackendItineraryDestination[];
};

type ItineraryPayload =
  | BackendItinerary[]
  | { data: BackendItinerary[] }
  | { itineraries: BackendItinerary[] };

const HOURS_PER_DAY = 8;

function toDestinationList(items: BackendItineraryDestination[] | undefined): Destination[] {
  if (!items?.length) return [];
  return items
    .map((item) => item.destination)
    .map((destination) => (destination ? ({ ...destination, location: normalizeLocation(destination) } as Destination) : destination))
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

function deriveTripDays(totalDuration: number): number {
  if (!Number.isFinite(totalDuration) || totalDuration <= 0) return 1;
  return Math.max(1, Math.ceil(totalDuration / HOURS_PER_DAY));
}

function mapBackendItinerary(itinerary: BackendItinerary, index: number): SavedItinerary {
  const destinations = toDestinationList(itinerary.destinations);
  const totalDuration = destinations.reduce((sum, dest) => sum + Number(dest.duration || 0), 0);
  const createdAt = itinerary.createdAt ?? new Date().toISOString();
  return {
    id: itinerary.id ?? itinerary._id ?? `itinerary-${index}`,
    name: `Itinerary ${index + 1}`,
    destinations,
    tripDays: deriveTripDays(totalDuration),
    createdAt,
    totalCost: Number(itinerary.totalCost ?? 0),
    totalDuration,
  };
}

function extractItineraries(payload: ItineraryPayload): SavedItinerary[] {
  const items = Array.isArray(payload)
    ? payload
    : 'itineraries' in payload && Array.isArray(payload.itineraries)
      ? payload.itineraries
      : 'data' in payload && Array.isArray(payload.data)
        ? payload.data
        : [];

  return items.map(mapBackendItinerary);
}

export async function fetchItineraries(): Promise<SavedItinerary[]> {
  const payload = await apiGet<ItineraryPayload>('/api/itineraries');
  return extractItineraries(payload);
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

  const payload = {
    name: itinerary.name,
    totalCost: itinerary.totalCost,
    maxBudget: itinerary.totalCost,
    tripDays: itinerary.tripDays,
    destinations: itinerary.destinations.map((destination) => ({
      destinationId: destination.id,
      destination,
      cost: destination.estimatedCost,
    })),
  };

  const response = await apiPost<CreateItineraryResponse>('/api/itineraries', payload);
  const created = normalizeCreatedItinerary(response);
  if (!created) return null;
  return mapBackendItinerary(created, 0);
}
