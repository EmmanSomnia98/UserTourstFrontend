import { useEffect, useMemo, useState } from 'react';
import { Bike, Car, PersonStanding } from 'lucide-react';
import { Destination } from '@/app/types/destination';
import {
  DEFAULT_ORIGIN,
  estimateMinutes,
  fetchRoutingEstimate,
  formatDistanceKm,
  GeoPoint,
  haversineKm,
  TravelEstimate,
  TravelProfile,
} from '@/app/utils/travel';

type TravelModeBadgesProps = {
  destination: Destination;
  origin?: GeoPoint | null;
};

type ModeState = {
  loading: boolean;
  estimate?: TravelEstimate;
  error?: string;
};

const cache = new Map<string, TravelEstimate>();
const inFlight = new Map<string, Promise<TravelEstimate>>();
const failedAt = new Map<string, number>();
const FAILURE_RETRY_MS = 5 * 60 * 1000;
const GLOBAL_DISABLE_MS = 2 * 60 * 1000;
let routingDisabledUntil = 0;

function isValidCoordinate(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

function hasValidLocation(destination: Destination): boolean {
  const lat = destination.location?.lat;
  const lng = destination.location?.lng;
  return isValidCoordinate(lat, -90, 90) && isValidCoordinate(lng, -180, 180);
}

function isRoutingProviderUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return message.includes('Request failed (4') || message.includes('Request failed (5') || message.includes('Routing API error:');
}

export function TravelModeBadges({ destination, origin }: TravelModeBadgesProps) {
  const canUseRoutingApi = import.meta.env.VITE_ENABLE_ROUTING_API !== 'false';
  const hasLocation = hasValidLocation(destination);
  const selectedOrigin = origin ?? DEFAULT_ORIGIN;

  const distanceKmFallback = hasLocation ? haversineKm(selectedOrigin, destination.location) : 0;
  const distanceLabelFallback = formatDistanceKm(distanceKmFallback);
  const fallback = useMemo(
    () => ({
      walk: estimateMinutes(distanceKmFallback, 5),
      bike: estimateMinutes(distanceKmFallback, 15),
      drive: estimateMinutes(distanceKmFallback, 30),
    }),
    [distanceKmFallback]
  );

  const [walk, setWalk] = useState<ModeState>({ loading: true });
  const [bike, setBike] = useState<ModeState>({ loading: true });
  const [drive, setDrive] = useState<ModeState>({ loading: true });

  const loadEstimate = async (
    profile: TravelProfile,
    setter: (state: ModeState) => void
  ) => {
    if (!canUseRoutingApi || !hasLocation || Date.now() < routingDisabledUntil) {
      setter({ loading: false });
      return;
    }

    const originKey = `${selectedOrigin.lat.toFixed(5)},${selectedOrigin.lng.toFixed(5)}`;
    const key = `${destination.id ?? destination.name}-${profile}-${originKey}`;
    const cached = cache.get(key);
    if (cached) {
      setter({ loading: false, estimate: cached });
      return;
    }

    const lastFailure = failedAt.get(key);
    if (lastFailure && Date.now() - lastFailure < FAILURE_RETRY_MS) {
      setter({ loading: false });
      return;
    }

    const pending = inFlight.get(key);
    if (pending) {
      try {
        const estimate = await pending;
        setter({ loading: false, estimate });
      } catch (error) {
        setter({ loading: false, error: (error as Error).message });
      }
      return;
    }

    const request = fetchRoutingEstimate(selectedOrigin, destination.location, profile);
    inFlight.set(key, request);
    try {
      const estimate = await request;
      cache.set(key, estimate);
      setter({ loading: false, estimate });
    } catch (error) {
      failedAt.set(key, Date.now());
      if (isRoutingProviderUnavailable(error)) {
        routingDisabledUntil = Date.now() + GLOBAL_DISABLE_MS;
      }
      setter({ loading: false, error: (error as Error).message });
    } finally {
      inFlight.delete(key);
    }
  };

  useEffect(() => {
    if (!hasLocation) {
      setWalk({ loading: false, error: 'Distance unavailable' });
      setBike({ loading: false, error: 'Distance unavailable' });
      setDrive({ loading: false, error: 'Distance unavailable' });
      return;
    }

    setWalk({ loading: true });
    setBike({ loading: true });
    setDrive({ loading: true });

    void loadEstimate('walking', setWalk);
    void loadEstimate('cycling', setBike);
    void loadEstimate('driving', setDrive);
  }, [destination.id, destination.name, destination.location?.lat, destination.location?.lng, canUseRoutingApi, hasLocation, selectedOrigin.lat, selectedOrigin.lng]);

  const renderBadge = (
    icon: React.ReactNode,
    state: ModeState,
    fallbackMinutes: number
  ) => {
    const minutes = state.estimate?.durationMin ?? fallbackMinutes;
    const distanceLabel = state.estimate
      ? formatDistanceKm(state.estimate.distanceKm)
      : distanceLabelFallback;

    return (
      <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1 shadow-sm">
        {icon}
        <span>{state.loading ? '...' : `${minutes} min`}</span>
        <span className="text-slate-400">({distanceLabel})</span>
      </div>
    );
  };

  if (!hasLocation) {
    return <div className="text-xs text-slate-500">Distance unavailable</div>;
  }

  return (
    <div className="flex flex-wrap gap-2 text-xs text-slate-700">
      {renderBadge(<PersonStanding className="h-4 w-4 text-slate-600" />, walk, fallback.walk)}
      {renderBadge(<Bike className="h-4 w-4 text-slate-600" />, bike, fallback.bike)}
      {renderBadge(<Car className="h-4 w-4 text-slate-600" />, drive, fallback.drive)}
    </div>
  );
}
