import { apiPost } from '@/app/api/client';

export type GeoPoint = {
  lat: number;
  lng: number;
};

export type TravelProfile = 'walking' | 'cycling' | 'driving';

export type TravelEstimate = {
  distanceKm: number;
  durationMin: number;
};

// Default origin (Bulusan town center). Replace with real user location if available.
export const DEFAULT_ORIGIN: GeoPoint = {
  lat: 12.767,
  lng: 124.133,
};

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  if (!a || !b) return 0;
  if (!Number.isFinite(a.lat) || !Number.isFinite(a.lng)) return 0;
  if (!Number.isFinite(b.lat) || !Number.isFinite(b.lng)) return 0;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistanceKm(value: number): string {
  if (!Number.isFinite(value)) return '0 km';
  if (value < 1) return `${value.toFixed(1)} km`;
  if (value < 10) return `${value.toFixed(1)} km`;
  return `${Math.round(value)} km`;
}

export function estimateMinutes(distanceKm: number, speedKmH: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 0;
  const hours = distanceKm / speedKmH;
  return Math.max(1, Math.round(hours * 60));
}

type RoutingEstimatePayload = {
  data?: RoutingEstimatePayload;
  route?: RoutingEstimatePayload;
  summary?: RoutingEstimatePayload;
  distanceKm?: number | string;
  durationMin?: number | string;
  distanceMeters?: number | string;
  durationSeconds?: number | string;
  distance?: number | string;
  duration?: number | string;
};

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export async function fetchRoutingEstimate(
  origin: GeoPoint,
  destination: GeoPoint,
  profile: TravelProfile
): Promise<TravelEstimate> {
  const payloadCandidates = [
    {
      profile,
      originLongitude: origin.lng,
      originLatitude: origin.lat,
      destinationLongitude: destination.lng,
      destinationLatitude: destination.lat,
    },
    {
      profile,
      coordinates: [
        [origin.lng, origin.lat],
        [destination.lng, destination.lat],
      ],
    },
    {
      profile,
      origin: {
        longitude: origin.lng,
        latitude: origin.lat,
      },
      destination: {
        longitude: destination.lng,
        latitude: destination.lat,
      },
    },
  ];

  let payload: RoutingEstimatePayload | null = null;
  let lastError: unknown = null;
  for (const candidate of payloadCandidates) {
    try {
      payload = await apiPost<RoutingEstimatePayload>('/api/routes/single', candidate);
      break;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error ?? '');
      // Retry alternate payload shapes only for 422 payload validation errors.
      // For 400 responses, stop early to avoid flooding the routing endpoint.
      if (message.includes('Request failed (422)')) {
        continue;
      }
      throw error;
    }
  }

  if (!payload) {
    throw (lastError instanceof Error ? lastError : new Error('Routing API error: request failed'));
  }

  const source = payload.route ?? payload.summary ?? payload.data ?? payload;

  const distanceKm = toNumber(source.distanceKm);
  const durationMin = toNumber(source.durationMin);
  const distanceMeters = toNumber(source.distanceMeters) ?? toNumber(source.distance);
  const durationSeconds = toNumber(source.durationSeconds) ?? toNumber(source.duration);

  if (distanceKm === null && distanceMeters === null) {
    throw new Error('Routing API error: missing distance');
  }
  if (durationMin === null && durationSeconds === null) {
    throw new Error('Routing API error: missing duration');
  }

  return {
    distanceKm: distanceKm ?? (distanceMeters as number) / 1000,
    durationMin: Math.max(1, Math.round(durationMin ?? (durationSeconds as number) / 60)),
  };
}
