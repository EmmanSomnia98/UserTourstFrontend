import { Destination } from '@/app/types/destination';
import { GeoPoint } from '@/app/utils/travel';
import { formatDistanceKm, haversineKm } from '@/app/utils/travel';

type GoogleTravelMode = 'driving' | 'walking' | 'two-wheeler' | 'bicycling' | 'transit';

type BuildGoogleMapsRouteOptions = {
  origin?: GeoPoint | null;
  travelMode?: GoogleTravelMode;
};

function isValidCoordinate(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

function toCoordinatePair(lat: number, lng: number): string {
  return `${lat},${lng}`;
}

export function buildGoogleMapsRouteUrl(
  destinations: Destination[],
  options: BuildGoogleMapsRouteOptions = {}
): string | null {
  const stops = destinations
    .map((destination) => destination.location)
    .filter(
      (location) =>
        isValidCoordinate(location?.lat, -90, 90) && isValidCoordinate(location?.lng, -180, 180)
    )
    .map((location) => toCoordinatePair(location.lat, location.lng));

  if (stops.length === 0) return null;

  const travelMode = options.travelMode ?? 'driving';
  const params = new URLSearchParams({
    api: '1',
    travelmode: travelMode,
  });

  const hasValidOrigin =
    options.origin != null &&
    isValidCoordinate(options.origin.lat, -90, 90) &&
    isValidCoordinate(options.origin.lng, -180, 180);

  // For multi-stop day routes, always show distance between itinerary destinations.
  // User origin is only used for single-destination days.
  if (hasValidOrigin && stops.length === 1) {
    params.set('origin', toCoordinatePair(options.origin!.lat, options.origin!.lng));
    params.set('destination', stops[stops.length - 1]);
  } else if (stops.length === 1) {
    // Without explicit origin, Google Maps uses current location.
    params.set('destination', stops[0]);
  } else {
    // Build route between day stops when user location is not available.
    params.set('origin', stops[0]);
    params.set('destination', stops[stops.length - 1]);
    const waypoints = stops.slice(1, -1);
    if (waypoints.length > 0) {
      params.set('waypoints', waypoints.join('|'));
    }
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export type DaySegmentDistance = {
  fromName: string;
  toName: string;
  distanceKm: number;
  distanceLabel: string;
};

export function getDaySegmentDistances(destinations: Destination[]): DaySegmentDistance[] {
  const segments: DaySegmentDistance[] = [];
  for (let index = 0; index < destinations.length - 1; index += 1) {
    const from = destinations[index];
    const to = destinations[index + 1];
    const hasValidFrom =
      isValidCoordinate(from.location?.lat, -90, 90) && isValidCoordinate(from.location?.lng, -180, 180);
    const hasValidTo =
      isValidCoordinate(to.location?.lat, -90, 90) && isValidCoordinate(to.location?.lng, -180, 180);
    if (!hasValidFrom || !hasValidTo) continue;
    const distanceKm = haversineKm(from.location, to.location);
    segments.push({
      fromName: from.name,
      toName: to.name,
      distanceKm,
      distanceLabel: formatDistanceKm(distanceKm),
    });
  }
  return segments;
}
