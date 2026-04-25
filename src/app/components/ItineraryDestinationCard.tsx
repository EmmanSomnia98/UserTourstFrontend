import { ReactNode } from 'react';
import { Clock3, Trash2, Wallet, Check } from 'lucide-react';
import { Destination } from '@/app/types/destination';
import { GeoPoint } from '@/app/utils/travel';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { TimeRangeEditor } from '@/app/components/TimeRangeEditor';
import { TravelModeBadges } from '@/app/components/TravelModeBadges';
import { DestinationLocationPanel } from '@/app/components/DestinationLocationPanel';

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
  const formatTimeForDisplay = (value?: string): string | null => {
    if (!value) return null;
    const trimmed = value.trim();
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(trimmed);
    if (!match) return trimmed;
    const hours24 = Number(match[1]);
    const minutes = match[2];
    const period = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 || 12;
    return `${hours12}:${minutes} ${period}`;
  };

  const startLabel = formatTimeForDisplay(startTime);
  const endLabel = formatTimeForDisplay(endTime);
  const scheduledTimeLabel =
    timeLabel?.trim() ||
    (startLabel && endLabel ? `${startLabel} - ${endLabel}` : startLabel || endLabel || 'Not set');
  const subInterestsLabel = tags.length > 0 ? tags.join(', ') : 'Not specified';

  return (
    <div className="space-y-2">
      {transferLabel && <p className="text-xs text-slate-500">{transferLabel}</p>}
      <Card className={`p-3 shadow-sm transition hover:shadow-md sm:p-4 ${isFinished ? 'bg-emerald-50/40' : 'bg-slate-50/70'}`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[104px_minmax(0,1fr)] sm:gap-4">
          <div className="sm:pt-1">
            {destination.image ? (
              <img
                src={destination.image}
                alt={destination.name}
                className="h-24 w-24 rounded-lg object-cover sm:h-[96px] sm:w-[96px]"
              />
            ) : (
              <div className="h-24 w-24 rounded-lg bg-slate-200 sm:h-[96px] sm:w-[96px]" />
            )}
          </div>

          <div className="space-y-3 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="cursor-pointer text-2xl font-bold leading-tight text-slate-900" onClick={onEdit}>
                  {destination.name}
                </h4>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                {showFinishButton && onFinish && (
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    className={`h-9 px-3 text-sm font-semibold text-white ${
                      isFinished ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onFinish();
                    }}
                  >
                    {isFinished ? (
                      <>
                        Finished <Check className="h-3.5 w-3.5" />
                      </>
                    ) : (
                      'Finish'
                    )}
                  </Button>
                )}
                {onDelete && showActionsMenu && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete();
                    }}
                    aria-label={`Remove ${destination.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <p className="line-clamp-3 min-h-[3.75rem] overflow-hidden text-sm leading-5 text-slate-700">
              {destination.description}
            </p>

            {canEditTimes && onStartTimeChange && onEndTimeChange ? (
              <div className="rounded-md border border-slate-300 bg-slate-100/80 px-3 py-2">
                <TimeRangeEditor
                  startTime={startTime ?? ''}
                  endTime={endTime ?? ''}
                  onStartTimeChange={onStartTimeChange}
                  onEndTimeChange={onEndTimeChange}
                  label={destination.name}
                />
              </div>
            ) : (
              <div className="rounded-md border border-slate-300 bg-slate-100/80 px-3 py-2 text-sm font-medium text-slate-700">
                Scheduled time: {scheduledTimeLabel}
              </div>
            )}

            <p className="text-sm text-slate-700">
              <span className="font-medium">Sub-interests:</span> {subInterestsLabel}
            </p>

            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Wallet className="h-3.5 w-3.5" />
                {priceLabel}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5" />
                Average Visit Time: {durationLabel}
              </span>
            </div>

            <TravelModeBadges destination={destination} origin={origin} variant="strict-itinerary" />
            <DestinationLocationPanel destination={destination} variant="strict-itinerary" />

            {footerContent && <div>{footerContent}</div>}
            {extraContent && <div>{extraContent}</div>}
          </div>
        </div>
      </Card>
    </div>
  );
}
