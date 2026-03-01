import { Destination } from '@/app/types/destination';
import { apiGet } from '@/app/api/client';
import { resolveAssetUrl } from '@/app/api/client';

type DestinationPayload =
  | Destination[]
  | { data: Destination[] }
  | { destinations: Destination[] };

type RawDestination = Partial<Destination> & {
  _id?: string;
  destinationId?: string;
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
};

function extractDestinations(payload: DestinationPayload): Destination[] {
  if (Array.isArray(payload)) return normalizeDestinations(payload);
  if ('destinations' in payload && Array.isArray(payload.destinations)) return normalizeDestinations(payload.destinations);
  if ('data' in payload && Array.isArray(payload.data)) return normalizeDestinations(payload.data);
  return [];
}

function normalizeDestinations(items: RawDestination[]): Destination[] {
  return items.map((item, index) => {
    const fallbackId = `destination-${index}-${String(item.name ?? 'unknown')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')}`;

    return {
      ...item,
      id: String(item.id ?? item._id ?? item.destinationId ?? fallbackId),
      duration: normalizeDuration(item),
      location: normalizeLocation(item),
      image: resolveAssetUrl(item.image),
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
