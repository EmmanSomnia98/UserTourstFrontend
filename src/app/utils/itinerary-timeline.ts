import { Destination } from '@/app/types/destination';
import type { ItineraryStop } from '@/app/types/saved-itinerary';
import { getDestinationStayHours } from '@/app/utils/recommendation';
import { formatDistanceKm, haversineKm } from '@/app/utils/travel';

const DEFAULT_DAY_START_MINUTES = 7 * 60;
const DEFAULT_TRANSFER_BUFFER_MINUTES = 15;
const DEFAULT_TRAVEL_SPEED_KMH = 24;
const MIN_TRANSFER_MINUTES = 10;

type BuildDayTimelineOptions = {
  day?: number;
  stops?: ItineraryStop[];
  dayStartMinutes?: number;
  transferBufferMinutes?: number;
  averageTravelSpeedKmh?: number;
};

export type DayTimelineItem = {
  destination: Destination;
  index: number;
  startMinutes: number;
  endMinutes: number;
  stayMinutes: number;
  timeRangeLabel: string;
  travelMinutesFromPrevious: number | null;
  travelDistanceKmFromPrevious: number | null;
  transferLabel: string | null;
};

function isValidCoordinate(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

function hasValidLocation(destination: Destination): boolean {
  return (
    isValidCoordinate(destination.location?.lat, -90, 90) &&
    isValidCoordinate(destination.location?.lng, -180, 180)
  );
}

function normalizeToPositiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback;
  return Math.max(1, Math.round(value));
}

function parseTimeToMinutes(value: string): number | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
}

function findStop(
  destinationId: string,
  index: number,
  day: number | undefined,
  stops: ItineraryStop[]
): ItineraryStop | undefined {
  const bySequence = stops.find(
    (stop) =>
      stop.destinationId === destinationId &&
      stop.sequence === index &&
      (day === undefined || stop.day === day)
  );
  if (bySequence) return bySequence;
  return stops.find(
    (stop) => stop.destinationId === destinationId && (day === undefined || stop.day === day)
  );
}

function formatClock(minutesFromMidnight: number): string {
  const normalized = ((Math.round(minutesFromMidnight) % 1440) + 1440) % 1440;
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const isPm = hour24 >= 12;
  const hour12 = hour24 % 12 || 12;
  const minuteLabel = minute.toString().padStart(2, '0');
  return `${hour12}:${minuteLabel} ${isPm ? 'PM' : 'AM'}`;
}

function estimateTransfer(
  from: Destination,
  to: Destination,
  averageTravelSpeedKmh: number,
  transferBufferMinutes: number
): {
  travelMinutes: number;
  distanceKm: number | null;
} {
  if (!hasValidLocation(from) || !hasValidLocation(to)) {
    return {
      travelMinutes: MIN_TRANSFER_MINUTES + transferBufferMinutes,
      distanceKm: null,
    };
  }

  const distanceKm = haversineKm(from.location, to.location);
  const rawTravelMinutes = Math.round((distanceKm / averageTravelSpeedKmh) * 60);
  const travelMinutes = Math.max(MIN_TRANSFER_MINUTES, rawTravelMinutes) + transferBufferMinutes;
  return { travelMinutes, distanceKm };
}

export function buildDayTimeline(
  destinations: Destination[],
  options: BuildDayTimelineOptions = {}
): DayTimelineItem[] {
  const stops = Array.isArray(options.stops) ? options.stops : [];
  const day = typeof options.day === 'number' && Number.isFinite(options.day) ? Math.round(options.day) : undefined;
  const dayStartMinutes = normalizeToPositiveInteger(options.dayStartMinutes, DEFAULT_DAY_START_MINUTES);
  const transferBufferMinutes = normalizeToPositiveInteger(
    options.transferBufferMinutes,
    DEFAULT_TRANSFER_BUFFER_MINUTES
  );
  const averageTravelSpeedKmh = normalizeToPositiveInteger(
    options.averageTravelSpeedKmh,
    DEFAULT_TRAVEL_SPEED_KMH
  );

  const timeline: DayTimelineItem[] = [];
  let cursorMinutes = dayStartMinutes;

  destinations.forEach((destination, index) => {
    const explicitStop = findStop(destination.id, index, day, stops);
    const explicitStart = explicitStop ? parseTimeToMinutes(explicitStop.startTime) : null;
    const explicitEnd = explicitStop ? parseTimeToMinutes(explicitStop.endTime) : null;

    let travelMinutesFromPrevious: number | null = null;
    let travelDistanceKmFromPrevious: number | null = null;
    let transferLabel: string | null = null;

    if (index > 0) {
      const previous = destinations[index - 1];
      const previousSlot = timeline[index - 1];
      if (explicitStart !== null && previousSlot?.endMinutes !== undefined) {
        const gapMinutes = explicitStart - previousSlot.endMinutes;
        travelMinutesFromPrevious = gapMinutes;
        transferLabel = `${gapMinutes} min gap`;
      } else {
        const transfer = estimateTransfer(previous, destination, averageTravelSpeedKmh, transferBufferMinutes);
        travelMinutesFromPrevious = transfer.travelMinutes;
        travelDistanceKmFromPrevious = transfer.distanceKm;
        cursorMinutes += transfer.travelMinutes;
      }
    }

    const fallbackStayMinutes = Math.max(30, Math.round(getDestinationStayHours(destination) * 60));
    const hasValidExplicitRange =
      explicitStart !== null && explicitEnd !== null && explicitEnd > explicitStart;
    const startMinutes = hasValidExplicitRange ? explicitStart : cursorMinutes;
    const endMinutes = hasValidExplicitRange ? explicitEnd : startMinutes + fallbackStayMinutes;
    const stayMinutes = Math.max(1, endMinutes - startMinutes);
    cursorMinutes = endMinutes;

    if (transferLabel === null) {
      const transferDistanceLabel =
        travelDistanceKmFromPrevious !== null ? ` (${formatDistanceKm(travelDistanceKmFromPrevious)})` : '';
      transferLabel =
        travelMinutesFromPrevious !== null
          ? `${travelMinutesFromPrevious} min transfer${transferDistanceLabel}`
          : null;
    }

    timeline.push({
      destination,
      index,
      startMinutes,
      endMinutes,
      stayMinutes,
      timeRangeLabel: `${formatClock(startMinutes)} - ${formatClock(endMinutes)}`,
      travelMinutesFromPrevious,
      travelDistanceKmFromPrevious,
      transferLabel,
    });
  });

  return timeline;
}
