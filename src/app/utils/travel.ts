export type GeoPoint = {
  lat: number;
  lng: number;
};

export type TravelProfile = 'foot-walking' | 'cycling-regular' | 'driving-car';

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

export async function fetchOrsEstimate(
  origin: GeoPoint,
  destination: GeoPoint,
  profile: TravelProfile
): Promise<TravelEstimate> {
  const apiKey = import.meta.env.VITE_ORS_API_KEY as string | undefined;
  if (!apiKey) {
    throw new Error('Missing VITE_ORS_API_KEY');
  }

  const response = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}`, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      coordinates: [
        [origin.lng, origin.lat],
        [destination.lng, destination.lat],
      ],
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`ORS error: ${response.status} ${message}`);
  }

  const data = (await response.json()) as {
    features?: Array<{
      properties?: { summary?: { distance?: number; duration?: number } };
    }>;
  };
  const summary = data.features?.[0]?.properties?.summary;
  const distanceMeters = summary?.distance ?? 0;
  const durationSeconds = summary?.duration ?? 0;

  return {
    distanceKm: distanceMeters / 1000,
    durationMin: Math.max(1, Math.round(durationSeconds / 60)),
  };
}
