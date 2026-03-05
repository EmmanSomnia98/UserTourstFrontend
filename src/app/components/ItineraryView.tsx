import { useEffect, useRef, useState } from 'react';
import { Destination } from '@/app/types/destination';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Separator } from '@/app/components/ui/separator';
import { Input } from '@/app/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { TravelModeBadges } from '@/app/components/TravelModeBadges';
import { GeoPoint } from '@/app/utils/travel';
import { Calendar, Trash2, Download, Share2, Wallet, Star } from 'lucide-react';
import { calculateItinerarySchedule } from '@/app/utils/recommendation';
import { SavedItinerary } from '@/app/types/saved-itinerary';
import { createItinerary } from '@/app/api/itineraries';
import { formatPeso } from '@/app/utils/currency';

interface ItineraryViewProps {
  destinations: Destination[];
  tripDays: number;
  userInterests?: string[];
  interestRanks?: Record<string, number>;
  onRemoveDestination: (destinationId: string) => void;
  onReset: () => void;
  onViewSavedItineraries?: () => void;
  onSaveSuccess?: (savedItinerary: SavedItinerary) => void;
  onRateDestination?: (destination: Destination, rating: number) => void;
  destinationRatings?: Record<string, number>;
  userLocation?: GeoPoint | null;
}

export function ItineraryView({
  destinations,
  tripDays,
  userInterests = [],
  interestRanks,
  onRemoveDestination,
  onReset,
  onViewSavedItineraries,
  onSaveSuccess,
  onRateDestination,
  destinationRatings,
  userLocation
}: ItineraryViewProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [saveNameDraft, setSaveNameDraft] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [finishedDestinationKeys, setFinishedDestinationKeys] = useState<Set<string>>(new Set());
  const saveRequestInFlight = useRef(false);
  const getDuration = (value: number) => (Number.isFinite(value) ? value : 0);
  const schedule = calculateItinerarySchedule(destinations, tripDays, userInterests, interestRanks);
  const emptyDays = Array.from(schedule.entries()).filter(([, dayDestinations]) => dayDestinations.length === 0).length;
  const getEntryKey = (destination: Destination, day: number, index: number) =>
    `${day}-${index}-${destination.id || destination.name}`;
  const itineraryEntryKeys = Array.from(schedule.entries()).flatMap(([day, dayDestinations]) =>
    dayDestinations.map((destination, index) => getEntryKey(destination, day, index))
  );
  
  const totalCost = destinations.reduce((sum, dest) => sum + dest.estimatedCost, 0);
  const totalDuration = destinations.reduce((sum, dest) => sum + getDuration(dest.duration), 0);
  const isItineraryFinished =
    itineraryEntryKeys.length > 0 &&
    itineraryEntryKeys.every((key) => finishedDestinationKeys.has(key));

  useEffect(() => {
    const validKeys = new Set(itineraryEntryKeys);
    setFinishedDestinationKeys((prev) => {
      const next = new Set(Array.from(prev).filter((key) => validKeys.has(key)));
      return next.size === prev.size ? prev : next;
    });
  }, [itineraryEntryKeys]);

  const toggleFinished = (entryKey: string) => {
    setFinishedDestinationKeys((prev) => {
      const next = new Set(prev);
      if (next.has(entryKey)) {
        next.delete(entryKey);
      } else {
        next.add(entryKey);
      }
      return next;
    });
  };

  const handleRemoveClick = (destinationId: string, entryKey: string) => {
    setFinishedDestinationKeys((prev) => {
      if (!prev.has(entryKey)) return prev;
      const next = new Set(prev);
      next.delete(entryKey);
      return next;
    });
    onRemoveDestination(destinationId);
  };

  const openSaveDialog = () => {
    const defaultName = `Bulusan Trip ${new Date().toLocaleDateString()}`;
    setSaveNameDraft(defaultName);
    setSaveError(null);
    setIsSaveDialogOpen(true);
  };

  const handleSave = async () => {
    if (saveRequestInFlight.current) return;
    const itineraryName = saveNameDraft.trim();
    if (!itineraryName) {
      setSaveError('Please enter an itinerary name.');
      return;
    }

    saveRequestInFlight.current = true;
    setIsSaving(true);
    setSaveError(null);
    try {
      const newItinerary = {
        id: `itinerary_${Date.now()}`,
        name: itineraryName,
        destinations,
        tripDays,
        createdAt: new Date().toISOString(),
        totalCost,
        totalDuration
      } as SavedItinerary;

      const created = await createItinerary(newItinerary);
      if (!created) {
        setSaveError('Please sign in to save itineraries.');
        return;
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      setIsSaveDialogOpen(false);
      onSaveSuccess?.(created);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? '');
      if (message.includes('(401)') || message.includes('(403)')) {
        setSaveError('Your session expired. Please sign in again to save itineraries.');
      } else if (message.includes('(400)') || message.includes('(422)')) {
        setSaveError('Unable to save this itinerary due to invalid trip data. Please adjust destinations and try again.');
      } else if (message.includes('(404)')) {
        setSaveError('Save endpoint was not found on the server. Please verify backend deployment.');
      } else if (message.includes('(500)') || message.includes('(502)') || message.includes('(503)')) {
        setSaveError('Server error while saving itinerary. Please try again in a moment.');
      } else if (message.toLowerCase().includes('failed to fetch')) {
        setSaveError('Cannot reach the server right now. Check your network and try again.');
      } else if (message.trim()) {
        setSaveError(message);
      } else {
        setSaveError('Failed to save itinerary. Please try again.');
      }
    } finally {
      setIsSaving(false);
      saveRequestInFlight.current = false;
    }
  };

  const handleDownload = () => {
    const toAscii = (value: string) => value.replace(/[^\x20-\x7E]/g, '');
    const escapePdfText = (value: string) =>
      value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const makePdfBlob = (lines: string[]): Blob => {
      const lineHeight = 14;
      const startY = 800;
      const safeLines = lines.map((line) => toAscii(line));
      const content = [
        'BT',
        '/F1 12 Tf',
        `1 0 0 1 50 ${startY} Tm`,
        `${lineHeight} TL`,
        ...safeLines.map((line, index) =>
          index === 0 ? `(${escapePdfText(line)}) Tj` : `T* (${escapePdfText(line)}) Tj`
        ),
        'ET',
      ].join('\n');

      const objects = [
        '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
        '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
        `4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`,
        '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
      ];

      let pdf = '%PDF-1.4\n';
      const offsets: number[] = [0];
      objects.forEach((obj) => {
        offsets.push(pdf.length);
        pdf += obj;
      });
      const xrefStart = pdf.length;
      pdf += `xref\n0 ${objects.length + 1}\n`;
      pdf += '0000000000 65535 f \n';
      for (let i = 1; i <= objects.length; i += 1) {
        pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
      }
      pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
      return new Blob([pdf], { type: 'application/pdf' });
    };

    const lines: string[] = [];
    lines.push('Bulusan Travel Itinerary');
    lines.push('');
    lines.push(`Total Duration: ${tripDays} days`);
    lines.push(`Total Cost: ${formatPeso(totalCost)}`);
    lines.push(`Total Activity Hours: ${totalDuration}h`);
    lines.push('');
    schedule.forEach((dayDestinations, day) => {
      lines.push(`Day ${day}:`);
      if (dayDestinations.length === 0) {
        lines.push('  - No activities scheduled');
      } else {
        dayDestinations.forEach((dest) => {
          lines.push(`  - ${dest.name} (${formatPeso(dest.estimatedCost)})`);
        });
      }
      lines.push('');
    });

    const blob = makePdfBlob(lines);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulusan-itinerary.pdf';
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDescriptionLines = (description: string): string[] => {
    return description
      .replace(/\r\n?/g, '\n')
      .replace(/\s*[•●◦▪]\s*/g, '\n• ')
      .replace(/\s*\|\s*/g, '\n')
      .replace(/\n{2,}/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  };

  if (destinations.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-gray-600">Your itinerary is empty. Add destinations to get started!</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Your Bulusan Itinerary</h2>
              <p className="text-gray-600 mt-1">{destinations.length} destinations planned</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button variant="outline" size="sm">
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>

          <Separator />

          {emptyDays > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              We couldn’t fill {emptyDays} {emptyDays === 1 ? 'day' : 'days'} with activities. Add more destinations
              or adjust your preferences to see a fuller schedule.
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <Calendar className="w-6 h-6 mx-auto mb-2 text-blue-600" />
              <div className="text-2xl font-semibold">{tripDays}</div>
              <div className="text-sm text-gray-600">Days</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <Wallet className="w-6 h-6 mx-auto mb-2 text-purple-600" />
              <div className="text-2xl font-semibold">{formatPeso(totalCost)}</div>
              <div className="text-sm text-gray-600">Est. Cost</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Day by Day Schedule */}
      {Array.from(schedule.entries()).map(([day, dayDestinations]) => (
        <Card key={day} className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center font-semibold">
                {day}
              </div>
              <div>
                <h3 className="font-semibold text-lg">Day {day}</h3>
              </div>
            </div>

            <div className="space-y-3 sm:ml-6 sm:pl-6">
              {dayDestinations.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                  No activities scheduled for this day yet.
                </div>
              )}
              {dayDestinations.map((dest, index) => (
                <div key={dest.id ?? `${dest.name}-${day}-${index}`} className="relative">
                  {(() => {
                    const entryKey = getEntryKey(dest, day, index);
                    const isFinished = finishedDestinationKeys.has(entryKey);
                    return (
                      <>
                        <div
                          className={`hidden sm:block absolute -left-8 w-4 h-4 rounded-full transition-all duration-300 ${
                            isFinished
                              ? 'bottom-0 bg-white border-2 border-blue-500'
                              : 'top-0 bg-white border-2 border-blue-500'
                          }`}
                        />
                        <div
                          className="hidden sm:block absolute left-[-1.5rem] -translate-x-1/2 top-0 h-full w-[2px] bg-gray-200"
                        />
                      </>
                    );
                  })()}
                  
                  <Card
                    className={`p-4 cursor-pointer hover:shadow-md transition-shadow ${
                      finishedDestinationKeys.has(getEntryKey(dest, day, index)) ? 'border-emerald-200 bg-emerald-50/30' : ''
                    }`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedDestination(dest)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedDestination(dest);
                      }
                    }}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 flex-1">
                        <img
                          src={dest.image}
                          alt={dest.name}
                          className="w-full h-32 sm:w-24 sm:h-24 object-cover rounded-lg flex-shrink-0"
                        />
                        <div className="flex-1 space-y-2">
                          <div>
                            <h4 className="font-semibold">{dest.name}</h4>
                            <p className="text-sm text-gray-600 line-clamp-2">{dest.description}</p>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 pt-1">
                            <div className="flex items-center gap-1">
                              <Wallet className="w-4 h-4" />
                              <span>{formatPeso(dest.estimatedCost)}</span>
                            </div>
                          </div>
                          <div className="pt-1">
                            <TravelModeBadges destination={dest} origin={userLocation} />
                          </div>
                          {onRateDestination && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-slate-600">Your rating</p>
                              <div className="flex items-center gap-1">
                                {Array.from({ length: 5 }, (_, starIndex) => {
                                  const value = starIndex + 1;
                                  const active = value <= (destinationRatings?.[dest.id] ?? 0);
                                  return (
                                    <button
                                      key={`${dest.id}-itn-rate-${value}`}
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        onRateDestination(dest, value);
                                      }}
                                      className="rounded-sm p-0.5 transition hover:scale-110"
                                      aria-label={`Rate ${dest.name} ${value} star${value > 1 ? 's' : ''}`}
                                      title={`Rate ${value} star${value > 1 ? 's' : ''}`}
                                    >
                                      <Star className={`h-4 w-4 ${active ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                                    </button>
                                  );
                                })}
                                <span className="ml-1 text-xs text-slate-500">
                                  {destinationRatings?.[dest.id] ? `${destinationRatings[dest.id]}/5` : 'Not rated'}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 sm:block pt-1 sm:pt-0">
                        <Button
                          variant={finishedDestinationKeys.has(getEntryKey(dest, day, index)) ? 'secondary' : 'outline'}
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleFinished(getEntryKey(dest, day, index));
                          }}
                          className="flex-shrink-0"
                        >
                          {finishedDestinationKeys.has(getEntryKey(dest, day, index)) ? 'Finished' : 'Finish'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRemoveClick(dest.id, getEntryKey(dest, day, index));
                          }}
                          className="flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ))}

      {/* Actions */}
      <Card className="p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="font-semibold">Ready to explore Bulusan?</h4>
            <p className="text-sm text-gray-600 mt-1">
              Save your itinerary or start planning a new trip
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {onViewSavedItineraries && (
              <Button variant="outline" onClick={onViewSavedItineraries}>
                View My Itineraries
              </Button>
            )}
            <Button
              variant="outline"
              onClick={openSaveDialog}
              disabled={isSaving}
              className={isSaving ? 'cursor-not-allowed' : ''}
            >
              {isSaving ? 'Saving...' : 'Save Itinerary'}
            </Button>
            <Button variant="outline" onClick={onReset}>
              Start New Itinerary
            </Button>
          </div>
        </div>
        {saveSuccess && (
          <div className="mt-4 text-sm text-green-500">
            Itinerary saved successfully!
          </div>
        )}
        {isItineraryFinished && (
          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Great job! You have finished all destinations in this itinerary.
          </div>
        )}
      </Card>

      <Dialog
        open={isSaveDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!isSaving) {
            setIsSaveDialogOpen(nextOpen);
          }
        }}
      >
        <DialogContent className="sm:max-w-md p-5">
          <DialogHeader>
            <DialogTitle>Save Itinerary</DialogTitle>
            <DialogDescription>
              Enter a name for this itinerary.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={saveNameDraft}
              onChange={(e) => setSaveNameDraft(e.target.value)}
              placeholder="Itinerary name"
              className="h-10 text-sm"
              autoFocus
              disabled={isSaving}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleSave();
                }
              }}
            />
            {saveError && (
              <p className="text-sm text-red-600">{saveError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsSaveDialogOpen(false)}
              size="sm"
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} size="sm" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={selectedDestination !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSelectedDestination(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          {selectedDestination && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedDestination.name}</DialogTitle>
                <DialogDescription>
                  Destination details from your itinerary.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <img
                  src={selectedDestination.image}
                  alt={selectedDestination.name}
                  className="w-full h-56 sm:h-72 object-cover rounded-lg"
                />
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1 text-sm text-gray-700">
                  {formatDescriptionLines(selectedDestination.description).map((line, index) => (
                    <p key={`${selectedDestination.id}-desc-${index}`} className="leading-relaxed">
                      {line}
                    </p>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                  <span className="inline-flex items-center gap-1">
                    <Wallet className="w-4 h-4" />
                    {formatPeso(selectedDestination.estimatedCost)}
                  </span>
                </div>
                <TravelModeBadges destination={selectedDestination} origin={userLocation} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
