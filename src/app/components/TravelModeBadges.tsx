import { useEffect, useMemo, useState } from 'react';
import { Bike, Car, PersonStanding } from 'lucide-react';
import { Destination } from '@/app/types/destination';
import {
  DEFAULT_ORIGIN,
  estimateMinutes,
  fetchOrsEstimate,
  formatDistanceKm,
  haversineKm,
  TravelEstimate,
  TravelProfile,
} from '@/app/utils/travel';

type TravelModeBadgesProps = {
  destination: Destination;
};

type ModeState = {
  loading: boolean;
  estimate?: TravelEstimate;
  error?: string;
};

const cache = new Map<string, TravelEstimate>();

export function TravelModeBadges({ destination }: TravelModeBadgesProps) {
  if (!destination.location) {
    return (
      <div className="text-xs text-slate-500">
        Distance unavailable
      </div>
    );
  }

  const distanceKmFallback = haversineKm(DEFAULT_ORIGIN, destination.location);
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
    const key = `${destination.id ?? destination.name}-${profile}`;
    const cached = cache.get(key);
    if (cached) {
      setter({ loading: false, estimate: cached });
      return;
    }

    try {
      const estimate = await fetchOrsEstimate(DEFAULT_ORIGIN, destination.location, profile);
      cache.set(key, estimate);
      setter({ loading: false, estimate });
    } catch (error) {
      setter({ loading: false, error: (error as Error).message });
    }
  };

  useEffect(() => {
    setWalk({ loading: true });
    setBike({ loading: true });
    setDrive({ loading: true });

    void loadEstimate('foot-walking', setWalk);
    void loadEstimate('cycling-regular', setBike);
    void loadEstimate('driving-car', setDrive);
  }, [destination.id, destination.name, destination.location?.lat, destination.location?.lng]);

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

  return (
    <div className="flex flex-wrap gap-2 text-xs text-slate-700">
      {renderBadge(<PersonStanding className="h-4 w-4 text-slate-600" />, walk, fallback.walk)}
      {renderBadge(<Bike className="h-4 w-4 text-slate-600" />, bike, fallback.bike)}
      {renderBadge(<Car className="h-4 w-4 text-slate-600" />, drive, fallback.drive)}
    </div>
  );
}
