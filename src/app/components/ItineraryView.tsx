import { useRef, useState } from 'react';
import { Destination } from '@/app/types/destination';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
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
import { Calendar, Trash2, Download, Share2, Wallet } from 'lucide-react';
import { calculateItinerarySchedule } from '@/app/utils/recommendation';
import { SavedItinerary } from '@/app/types/saved-itinerary';
import { createItinerary } from '@/app/api/itineraries';
import { formatPeso } from '@/app/utils/currency';

interface ItineraryViewProps {
  destinations: Destination[];
  tripDays: number;
  userInterests?: string[];
  onRemoveDestination: (destinationId: string) => void;
  onReset: () => void;
  onSaveSuccess?: (savedItinerary: SavedItinerary) => void;
  allDestinations?: Destination[];
  onAddDestination?: (destination: Destination) => void;
}

export function ItineraryView({
  destinations,
  tripDays,
  userInterests = [],
  onRemoveDestination,
  onReset,
  onSaveSuccess,
  allDestinations,
  onAddDestination
}: ItineraryViewProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [saveNameDraft, setSaveNameDraft] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const saveRequestInFlight = useRef(false);
  const getDuration = (value: number) => (Number.isFinite(value) ? value : 0);
  const schedule = calculateItinerarySchedule(destinations, tripDays, userInterests);
  const emptyDays = Array.from(schedule.entries()).filter(([, dayDestinations]) => dayDestinations.length === 0).length;
  
  const totalCost = destinations.reduce((sum, dest) => sum + dest.estimatedCost, 0);
  const totalDuration = destinations.reduce((sum, dest) => sum + getDuration(dest.duration), 0);

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
      setSaveError('Failed to save itinerary. Please try again.');
    } finally {
      setIsSaving(false);
      saveRequestInFlight.current = false;
    }
  };

  const handleDownload = () => {
    // Create a simple text version of the itinerary
    let itineraryText = `Bulusan Travel Itinerary\n\n`;
    itineraryText += `Total Duration: ${tripDays} days\n`;
    itineraryText += `Total Cost: ${formatPeso(totalCost)}\n`;
    itineraryText += `Total Activity Hours: ${totalDuration}h\n\n`;
    
    schedule.forEach((dayDestinations, day) => {
      itineraryText += `Day ${day}:\n`;
      dayDestinations.forEach(dest => {
        itineraryText += `  - ${dest.name} (${formatPeso(dest.estimatedCost)})\n`;
      });
      itineraryText += `\n`;
    });

    const blob = new Blob([itineraryText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulusan-itinerary.txt';
    a.click();
    URL.revokeObjectURL(url);
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

            <div className="space-y-3 sm:ml-6 sm:border-l-2 sm:border-gray-200 sm:pl-6">
              {dayDestinations.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                  No activities scheduled for this day yet.
                </div>
              )}
              {dayDestinations.map((dest, index) => (
                <div key={dest.id ?? `${dest.name}-${day}-${index}`} className="relative">
                  <div className="hidden sm:block absolute -left-8 top-4 w-4 h-4 bg-white border-2 border-blue-500 rounded-full"></div>
                  
                  <Card
                    className="p-4 cursor-pointer hover:shadow-md transition-shadow"
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
                          
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {dest.type}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {dest.difficulty}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 pt-1">
                            <div className="flex items-center gap-1">
                              <Wallet className="w-4 h-4" />
                              <span>{formatPeso(dest.estimatedCost)}</span>
                            </div>
                          </div>
                          <div className="pt-1">
                            <TravelModeBadges destination={dest} />
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end sm:block pt-1 sm:pt-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            onRemoveDestination(dest.id);
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
                <p className="text-sm text-gray-700">{selectedDestination.description}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{selectedDestination.type}</Badge>
                  <Badge variant="outline">{selectedDestination.difficulty}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                  <span className="inline-flex items-center gap-1">
                    <Wallet className="w-4 h-4" />
                    {formatPeso(selectedDestination.estimatedCost)}
                  </span>
                </div>
                <TravelModeBadges destination={selectedDestination} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
