import { useEffect, useMemo, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/app/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { cn } from '@/app/components/ui/utils';

type TimeRangeEditorProps = {
  startTime: string;
  endTime: string;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  label?: string;
};

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value.trim());
}

function toMinutes(value: string): number | null {
  if (!isValidTime(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatDisplayTime(value: string): string {
  const parsed = toMinutes(value);
  if (parsed === null) return '--:--';
  const hours24 = Math.floor(parsed / 60);
  const minutes = parsed % 60;
  const hours12 = hours24 % 12 || 12;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  return `${hours12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function buildRangeError(start: string, end: string): string | null {
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  if (startMinutes === null || endMinutes === null) return 'Please select a valid time range.';
  if (endMinutes < startMinutes) return 'End time cannot be earlier than start time.';
  return null;
}

export function TimeRangeEditor({
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  label = 'Activity time',
}: TimeRangeEditorProps) {
  const [open, setOpen] = useState(false);
  const [draftStartTime, setDraftStartTime] = useState(startTime);
  const [draftEndTime, setDraftEndTime] = useState(endTime);

  useEffect(() => {
    if (open) return;
    setDraftStartTime(startTime);
    setDraftEndTime(endTime);
  }, [endTime, open, startTime]);

  const validationError = useMemo(
    () => buildRangeError(draftStartTime, draftEndTime),
    [draftEndTime, draftStartTime]
  );

  const handleStartTimeDraftChange = (nextStart: string) => {
    setDraftStartTime(nextStart);
    const nextStartMinutes = toMinutes(nextStart);
    const currentEndMinutes = toMinutes(draftEndTime);
    if (nextStartMinutes !== null && currentEndMinutes !== null && currentEndMinutes < nextStartMinutes) {
      setDraftEndTime(nextStart);
    }
  };

  const handleSave = () => {
    if (validationError) return;
    onStartTimeChange(draftStartTime.trim());
    onEndTimeChange(draftEndTime.trim());
    setOpen(false);
  };

  const handleCancel = () => {
    setDraftStartTime(startTime);
    setDraftEndTime(endTime);
    setOpen(false);
  };

  const chipClassName =
    'inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 transition-all duration-200 ease-out group-hover/time-range:border-sky-200 group-hover/time-range:bg-sky-50 group-focus-within/time-range:border-sky-300 group-focus-within/time-range:bg-sky-50 hover:border-sky-300 hover:bg-sky-50 focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-1';

  const iconClassName =
    'h-3.5 w-3.5 text-slate-400 transition-colors duration-200 group-hover/time-range:text-sky-600 group-focus-within/time-range:text-sky-600';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="group/time-range mt-1 inline-flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={chipClassName}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    setOpen(true);
                  }
                }}
                aria-label={`Edit start time for ${label}`}
                aria-haspopup="dialog"
                aria-expanded={open}
              >
                <Clock3 className={iconClassName} />
                <span>{formatDisplayTime(startTime)}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>Edit time</TooltipContent>
          </Tooltip>

          <span className="text-xs text-slate-400">-</span>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={chipClassName}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    setOpen(true);
                  }
                }}
                aria-label={`Edit end time for ${label}`}
                aria-haspopup="dialog"
                aria-expanded={open}
              >
                <Clock3 className={iconClassName} />
                <span>{formatDisplayTime(endTime)}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>Edit time</TooltipContent>
          </Tooltip>
        </div>
      </PopoverAnchor>

      <PopoverContent
        className="w-[19rem] space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
        align="start"
        sideOffset={8}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            handleCancel();
          }
        }}
      >
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Edit time range</p>
          <p className="text-xs text-slate-500">Set the activity start and end time.</p>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <label className="space-y-1">
            <span className="text-xs text-slate-600">Start</span>
            <Input
              type="time"
              step={300}
              value={draftStartTime}
              onChange={(event) => handleStartTimeDraftChange(event.target.value)}
              aria-label={`Start time input for ${label}`}
              className="h-9 rounded-md text-xs"
            />
          </label>
          <span className="pb-2 text-xs text-slate-400">to</span>
          <label className="space-y-1">
            <span className="text-xs text-slate-600">End</span>
            <Input
              type="time"
              step={300}
              value={draftEndTime}
              onChange={(event) => setDraftEndTime(event.target.value)}
              aria-label={`End time input for ${label}`}
              className={cn(
                'h-9 rounded-md text-xs transition-colors duration-200',
                validationError ? 'border-red-300 focus-visible:ring-red-200' : ''
              )}
            />
          </label>
        </div>

        {validationError && <p className="text-xs text-red-600">{validationError}</p>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={Boolean(validationError)}>
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
