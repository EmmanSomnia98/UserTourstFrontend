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
  const payload = await apiPost<RoutingEstimatePayload>('/api/routing/estimate', {
    origin,
    destination,
    profile,
  });

  const distanceKm = toNumber(payload.distanceKm);
  const durationMin = toNumber(payload.durationMin);
  const distanceMeters = toNumber(payload.distanceMeters) ?? toNumber(payload.distance);
  const durationSeconds = toNumber(payload.durationSeconds) ?? toNumber(payload.duration);

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
