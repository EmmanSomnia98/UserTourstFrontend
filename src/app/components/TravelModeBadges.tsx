import { useEffect, useMemo, useState } from 'react';
import { Car, PersonStanding } from 'lucide-react';
import { Destination } from '@/app/types/destination';
import {
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
  variant?: 'default' | 'strict-itinerary';
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

function TwoWheelerIcon({ className = 'h-4 w-4 text-slate-600' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="6" cy="17" r="3" />
      <circle cx="18" cy="17" r="3" />
      <path d="M6 17h4l2-4h3l3 4" />
      <path d="M10 13L8 9h3l2 4" />
      <path d="M15 9h3" />
    </svg>
  );
}

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

export function TravelModeBadges({ destination, origin, variant = 'default' }: TravelModeBadgesProps) {
  // Keep routing API opt-in so local/dev runs don't flood the console when backend routing is unavailable.
  const canUseRoutingApi = import.meta.env.VITE_ENABLE_ROUTING_API === 'true';
  const hasLocation = hasValidLocation(destination);
  const hasUserOrigin =
    origin != null &&
    isValidCoordinate(origin.lat, -90, 90) &&
    isValidCoordinate(origin.lng, -180, 180);
  const selectedOrigin = hasUserOrigin ? origin : null;

  const distanceKmFallback =
    hasLocation && selectedOrigin ? haversineKm(selectedOrigin, destination.location) : 0;
  const distanceLabelFallback = formatDistanceKm(distanceKmFallback);
  const fallback = useMemo(
    () => ({
      walk: estimateMinutes(distanceKmFallback, 5),
      // Use a realistic fallback speed for two-wheelers on local roads.
      bike: estimateMinutes(distanceKmFallback, 40),
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
    if (!canUseRoutingApi || !hasLocation || !selectedOrigin || Date.now() < routingDisabledUntil) {
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
    if (!selectedOrigin) {
      setWalk({ loading: false });
      setBike({ loading: false });
      setDrive({ loading: false });
      return;
    }

    setWalk({ loading: true });
    setBike({ loading: true });
    setDrive({ loading: true });

    // Fetch one route profile and derive other mode durations from distance.
    // This avoids tripling API traffic per destination card.
    void loadEstimate('driving', (state) => {
      setDrive(state);
      if (state.loading) return;
      if (state.estimate) {
        const distanceKm = state.estimate.distanceKm;
        setWalk({
          loading: false,
          estimate: {
            distanceKm,
            durationMin: estimateMinutes(distanceKm, 5),
          },
        });
        setBike({
          loading: false,
          estimate: {
            distanceKm,
            // Keep two-wheeler aligned with routed ETA source instead of slow fixed cycling math.
            durationMin: state.estimate.durationMin,
          },
        });
        return;
      }
      setWalk({ loading: false, error: state.error });
      setBike({ loading: false, error: state.error });
    });
  }, [
    destination.id,
    destination.name,
    destination.location?.lat,
    destination.location?.lng,
    canUseRoutingApi,
    hasLocation,
    selectedOrigin?.lat,
    selectedOrigin?.lng,
  ]);

  const renderBadge = (
    icon: React.ReactNode,
    state: ModeState,
    fallbackMinutes: number,
    mode: 'walking' | 'two-wheeler' | 'driving'
  ) => {
    if (!selectedOrigin) return null;
    const minutes = state.estimate?.durationMin ?? fallbackMinutes;
    const distanceLabel = state.estimate
      ? formatDistanceKm(state.estimate.distanceKm)
      : distanceLabelFallback;
    const destinationCoords = `${destination.location.lat},${destination.location.lng}`;
    const originCoords = `${selectedOrigin.lat},${selectedOrigin.lng}`;
    const directionsUrl = hasUserOrigin
      ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originCoords)}&destination=${encodeURIComponent(destinationCoords)}&travelmode=${mode}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationCoords)}&travelmode=${mode}`;
    const modeLabel =
      mode === 'walking' ? 'Walk' : mode === 'two-wheeler' ? 'Two-wheeler' : 'Drive';

    const strict = variant === 'strict-itinerary';
    return (
      <button
        type="button"
        className={
          strict
            ? 'inline-flex h-9 flex-shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 transition hover:bg-slate-50'
            : 'inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1 shadow-sm transition hover:bg-slate-50'
        }
        onClick={() => window.open(directionsUrl, '_blank', 'noopener,noreferrer')}
        title="Open live directions in Google Maps"
      >
        {icon}
        <span className={strict ? 'font-semibold text-slate-700' : ''}>{modeLabel}</span>
        <span className={strict ? 'font-bold text-slate-700' : ''}>{state.loading ? '...' : `${minutes} min`}</span>
        <span className={strict ? 'font-semibold text-slate-400' : 'text-slate-400'}>({distanceLabel})</span>
      </button>
    );
  };

  if (!hasLocation) {
    return <div className="text-xs text-slate-500">Distance unavailable</div>;
  }
  if (!selectedOrigin) {
    return <div className="text-xs text-amber-700">Enable location to see accurate travel distance and time.</div>;
  }

  const strict = variant === 'strict-itinerary';
  return (
    <div className={strict ? 'flex flex-nowrap gap-2 overflow-x-auto pb-1 text-xs text-slate-700' : 'flex flex-wrap gap-2 text-xs text-slate-700'}>
      {renderBadge(<PersonStanding className="h-4 w-4 text-slate-600" />, walk, fallback.walk, 'walking')}
      {renderBadge(<TwoWheelerIcon className="h-4 w-4 text-slate-600" />, bike, fallback.bike, 'two-wheeler')}
      {renderBadge(<Car className="h-4 w-4 text-slate-600" />, drive, fallback.drive, 'driving')}
    </div>
  );
}
