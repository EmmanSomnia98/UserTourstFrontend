import { apiGet } from '@/app/api/client';
import { SavedItinerary } from '@/app/types/saved-itinerary';
import { Destination } from '@/app/types/destination';

type BackendItineraryDestination = {
  destination?: Destination;
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
    .filter((dest): dest is Destination => Boolean(dest));
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
