import { ReactNode, useMemo, useState } from 'react';
import { Clock3, Car, MoreHorizontal, PersonStanding, Bike, ExternalLink, Tag, Wallet, Check } from 'lucide-react';
import { Destination } from '@/app/types/destination';
import { formatDistanceKm, estimateMinutes, GeoPoint, haversineKm } from '@/app/utils/travel';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { TimeRangeEditor } from '@/app/components/TimeRangeEditor';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';

type ItineraryDestinationCardProps = {
  destination: Destination;
  timeLabel?: string | null;
  priceLabel: string;
  durationLabel: string;
  tags?: string[];
  origin?: GeoPoint | null;
  isFinished?: boolean;
  transferLabel?: string | null;
  onFinish?: () => void;
  showFinishButton?: boolean;
  showActionsMenu?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  startTime?: string;
  endTime?: string;
  onStartTimeChange?: (value: string) => void;
  onEndTimeChange?: (value: string) => void;
  canEditTimes?: boolean;
  footerContent?: ReactNode;
  extraContent?: ReactNode;
};

type TransportMode = 'walking' | 'two-wheeler' | 'driving';

type TransportOption = {
  mode: TransportMode;
  label: string;
  durationMin: number;
  distanceLabel: string;
  directionsUrl: string;
};

function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return 'N/A';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining === 0 ? `${hours}h` : `${hours}h ${remaining}m`;
}

function hasValidCoordinates(destination: Destination): boolean {
  const lat = destination.location?.lat;
  const lng = destination.location?.lng;
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function ItineraryDestinationCard({
  destination,
  timeLabel,
  priceLabel,
  durationLabel,
  tags = [],
  origin,
  isFinished = false,
  transferLabel,
  onFinish,
  showFinishButton = false,
  showActionsMenu = true,
  onEdit,
  onDelete,
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  canEditTimes = false,
  footerContent,
  extraContent,
}: ItineraryDestinationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasCoordinates = hasValidCoordinates(destination);
  const hasOrigin =
    origin != null &&
    Number.isFinite(origin.lat) &&
    Number.isFinite(origin.lng) &&
    origin.lat >= -90 &&
    origin.lat <= 90 &&
    origin.lng >= -180 &&
    origin.lng <= 180;

  const transportOptions = useMemo<TransportOption[]>(() => {
    if (!hasCoordinates || !hasOrigin || !origin) return [];
    const distanceKm = haversineKm(origin, destination.location);
    const distanceLabel = formatDistanceKm(distanceKm);
    const originCoords = `${origin.lat},${origin.lng}`;
    const destinationCoords = `${destination.location.lat},${destination.location.lng}`;
    return [
      {
        mode: 'driving',
        label: 'Drive',
        durationMin: estimateMinutes(distanceKm, 30),
        distanceLabel,
        directionsUrl: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originCoords)}&destination=${encodeURIComponent(destinationCoords)}&travelmode=driving`,
      },
      {
        mode: 'two-wheeler',
        label: 'Two-wheeler',
        durationMin: estimateMinutes(distanceKm, 40),
        distanceLabel,
        directionsUrl: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originCoords)}&destination=${encodeURIComponent(destinationCoords)}&travelmode=bicycling`,
      },
      {
        mode: 'walking',
        label: 'Walk',
        durationMin: estimateMinutes(distanceKm, 5),
        distanceLabel,
        directionsUrl: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originCoords)}&destination=${encodeURIComponent(destinationCoords)}&travelmode=walking`,
      },
    ];
  }, [destination.location, hasCoordinates, hasOrigin, origin]);

  const recommendedTransport = useMemo(() => {
    if (transportOptions.length === 0) return null;
    return [...transportOptions].sort((left, right) => left.durationMin - right.durationMin)[0];
  }, [transportOptions]);

  const fallbackMapUrl =
    hasCoordinates && !hasOrigin
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${destination.location.lat},${destination.location.lng}`)}`
      : null;

  const fullAddressLines = [
    destination.address?.fullAddress,
    destination.address?.purok ? `Purok: ${destination.address.purok}` : null,
    destination.address?.barangay ? `Barangay: ${destination.address.barangay}` : null,
    destination.address?.city ? `City: ${destination.address.city}` : null,
    destination.address?.province ? `Province: ${destination.address.province}` : null,
  ].filter((line): line is string => Boolean(line && line.trim()));
  const showEditableTimes = canEditTimes && onStartTimeChange && onEndTimeChange;

  return (
    <div className="space-y-2">
      {transferLabel && <p className="text-xs text-slate-500">{transferLabel}</p>}
      <Card className={`p-4 shadow-sm transition hover:shadow-md ${isFinished ? 'bg-emerald-50/40' : 'bg-white'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {destination.image && (
              <img
                src={destination.image}
                alt={destination.name}
                className="h-14 w-14 flex-shrink-0 rounded-md object-cover sm:h-16 sm:w-16"
              />
            )}
            <div className="min-w-0">
              <h4 className="cursor-pointer truncate text-base font-semibold text-slate-900 sm:text-lg" onClick={onEdit}>
                {destination.name}
              </h4>
              {showEditableTimes ? (
                <TimeRangeEditor
                  startTime={startTime ?? ''}
                  endTime={endTime ?? ''}
                  onStartTimeChange={onStartTimeChange}
                  onEndTimeChange={onEndTimeChange}
                  label={destination.name}
                />
              ) : (
                timeLabel && <p className="text-sm font-medium text-sky-700">{timeLabel}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showFinishButton && onFinish && (
              <Button
                type="button"
                variant="default"
                className={`hidden min-h-10 rounded-full px-4 py-2 text-sm font-semibold text-white sm:inline-flex ${
                  isFinished
                    ? 'bg-emerald-600/80 hover:bg-emerald-600/80 shadow-none'
                    : 'bg-sky-600 hover:bg-sky-700 shadow-sm hover:scale-105 hover:shadow-md active:scale-95'
                }`}
                onClick={(event) => {
                  event.stopPropagation();
                  onFinish();
                }}
              >
                {isFinished ? (
                  <>
                    Completed <Check className="h-3.5 w-3.5" />
                  </>
                ) : (
                  'Complete Visit'
                )}
              </Button>
            )}
            {showActionsMenu && (onFinish || onDelete) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 flex-shrink-0 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                    onClick={(event) => event.stopPropagation()}
                    aria-label="Open destination actions"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onFinish && (
                    <DropdownMenuItem
                      onClick={(event) => {
                        event.stopPropagation();
                        onFinish();
                      }}
                    >
                      {isFinished ? 'Mark as unfinished' : 'Complete Visit'}
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete();
                        }}
                      >
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <p className="mt-3 line-clamp-2 text-sm text-slate-600">{destination.description}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5" />
            {durationLabel}
          </span>
          <span className="inline-flex items-center gap-1">
            <Wallet className="h-3.5 w-3.5" />
            {priceLabel}
          </span>
          {tags.slice(0, 3).map((tag) => (
            <span key={`${destination.id}-tag-${tag}`} className="inline-flex items-center gap-1">
              <Tag className="h-3.5 w-3.5" />
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
          {recommendedTransport ? (
            <a
              href={recommendedTransport.directionsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-slate-900"
              onClick={(event) => event.stopPropagation()}
            >
              <Car className="h-3.5 w-3.5" />
              <span>{formatDuration(recommendedTransport.durationMin)} {recommendedTransport.label.toLowerCase()}</span>
            </a>
          ) : (
            <span className="text-slate-500">Enable location to view recommended transport.</span>
          )}
        </div>

        <div className="mt-3">
          <button
            type="button"
            className="text-xs font-medium text-slate-700 hover:text-slate-900"
            onClick={(event) => {
              event.stopPropagation();
              setIsExpanded((previous) => !previous);
            }}
          >
            {isExpanded ? 'Show Less' : 'Show More'}
          </button>
        </div>

        {showFinishButton && onFinish && (
          <div className="mt-3 sm:hidden">
            <Button
              type="button"
              variant="default"
              className={`min-h-11 min-w-[10rem] rounded-full px-4 py-2.5 text-sm font-semibold text-white ${
                isFinished
                  ? 'bg-emerald-600/80 hover:bg-emerald-600/80 shadow-none'
                  : 'bg-sky-600 hover:bg-sky-700 shadow-sm hover:shadow-md active:scale-95'
              }`}
              onClick={(event) => {
                event.stopPropagation();
                onFinish();
              }}
            >
              {isFinished ? (
                <>
                  Completed <Check className="h-3.5 w-3.5" />
                </>
              ) : (
                'Complete Visit'
              )}
            </Button>
          </div>
        )}

        {footerContent && <div className="mt-3">{footerContent}</div>}

        {isExpanded && (
          <div className="mt-3 space-y-3 text-xs text-slate-600">
            <p className="text-sm leading-relaxed text-slate-700">{destination.description}</p>

            <div className="space-y-1">
              <p className="font-medium text-slate-700">Location details</p>
              {fullAddressLines.length > 0 ? (
                fullAddressLines.map((line, index) => (
                  <p key={`${destination.id}-address-${index}`} className="break-words">
                    {line}
                  </p>
                ))
              ) : (
                <p className="text-slate-500">No address details provided.</p>
              )}
              {hasCoordinates && (
                <p className="text-slate-500">
                  {destination.location.lat.toFixed(6)}, {destination.location.lng.toFixed(6)}
                </p>
              )}
              {(recommendedTransport?.directionsUrl || fallbackMapUrl) && (
                <a
                  href={recommendedTransport?.directionsUrl ?? fallbackMapUrl ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sky-700 hover:underline"
                  onClick={(event) => event.stopPropagation()}
                >
                  View on Google Maps <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            <div className="space-y-1">
              <p className="font-medium text-slate-700">All transport options</p>
              {transportOptions.length > 0 ? (
                transportOptions.map((option) => (
                  <a
                    key={`${destination.id}-${option.mode}`}
                    href={option.directionsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1.5 hover:bg-slate-100"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <span className="inline-flex items-center gap-1">
                      {option.mode === 'walking' && <PersonStanding className="h-3.5 w-3.5" />}
                      {option.mode === 'two-wheeler' && <Bike className="h-3.5 w-3.5" />}
                      {option.mode === 'driving' && <Car className="h-3.5 w-3.5" />}
                      {option.label}
                    </span>
                    <span className="text-slate-500">{formatDuration(option.durationMin)} ({option.distanceLabel})</span>
                  </a>
                ))
              ) : (
                <p className="text-slate-500">Transport estimates require location access.</p>
              )}
            </div>

            {extraContent}
          </div>
        )}
      </Card>
    </div>
  );
}
