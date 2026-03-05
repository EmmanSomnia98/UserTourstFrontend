import { useMemo, useState } from 'react';
import { Destination } from '@/app/types/destination';
import { SavedItinerary } from '@/app/types/saved-itinerary';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Separator } from '@/app/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { TravelModeBadges } from '@/app/components/TravelModeBadges';
import { Calendar, Clock, Trash2, Plus, Save, X, Edit2, Wallet } from 'lucide-react';
import { calculateItinerarySchedule } from '@/app/utils/recommendation';
import { createItinerary, deleteRemoteItinerary } from '@/app/api/itineraries';
import { formatPeso } from '@/app/utils/currency';
import { inviteCollaboratorToItinerary, pushItinerarySync } from '@/app/api/collaboration';
import { useItineraryCollaboration } from '@/app/hooks/use-itinerary-collaboration';
import { GeoPoint } from '@/app/utils/travel';

interface EditableItineraryViewProps {
  savedItinerary: SavedItinerary;
  allDestinations: Destination[];
  currentUserId?: string;
  userLocation?: GeoPoint | null;
  onBack: () => void;
  onUpdate: () => void;
  onSaveChangesSuccess?: (savedItinerary: SavedItinerary) => void;
  onDeleteSuccess?: (itineraryId: string) => void;
}

export function EditableItineraryView({
  savedItinerary,
  allDestinations,
  currentUserId,
  userLocation,
  onBack,
  onUpdate,
  onSaveChangesSuccess,
  onDeleteSuccess
}: EditableItineraryViewProps) {
  const [destinations, setDestinations] = useState<Destination[]>(savedItinerary.destinations);
  const [tripDays, setTripDays] = useState(savedItinerary.tripDays);
  const [isEditingName, setIsEditingName] = useState(false);
  const [itineraryName, setItineraryName] = useState(savedItinerary.name);
  const [showAddDestinations, setShowAddDestinations] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [inviteQuery, setInviteQuery] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [liveNotice, setLiveNotice] = useState<string | null>(null);
  const getDuration = (value: number) => (Number.isFinite(value) ? value : 0);

  const destinationById = useMemo(() => {
    const map = new Map<string, Destination>();
    allDestinations.forEach((destination) => {
      map.set(destination.id, destination);
    });
    return map;
  }, [allDestinations]);

  const schedule = calculateItinerarySchedule(destinations, tripDays);
  const totalCost = destinations.reduce((sum, dest) => sum + dest.estimatedCost, 0);
  const totalDuration = destinations.reduce((sum, dest) => sum + getDuration(dest.duration), 0);
  // Get destinations not already in itinerary
  const availableDestinations = allDestinations.filter(
    dest => !destinations.some(d => d.id === dest.id)
  );

  const { collaborationStatus, publishEdit } = useItineraryCollaboration({
    itineraryId: savedItinerary.id,
    actorId: currentUserId,
    enabled: Boolean(currentUserId),
    onRemoteEdit: (event) => {
      const nextName = event.edit.name;
      const nextTripDays = event.edit.tripDays;
      const nextDestinationIds = event.edit.destinationIds;
      if (typeof nextName === 'string' && nextName.trim()) {
        setItineraryName(nextName.trim());
      }
      if (typeof nextTripDays === 'number' && Number.isFinite(nextTripDays) && nextTripDays > 0) {
        setTripDays(Math.round(nextTripDays));
      }
      if (Array.isArray(nextDestinationIds)) {
        const mapped = nextDestinationIds
          .map((id) => destinationById.get(id))
          .filter((item): item is Destination => Boolean(item));
        setDestinations(mapped);
      }
      setHasChanges(true);
      setLiveNotice(event.actorName ? `Updated by ${event.actorName}` : 'Itinerary updated by a collaborator.');
    },
  });

  const handleRemoveDestination = (destinationId: string) => {
    let removed = false;
    const next = destinations.filter((destination) => {
      if (removed) return true;
      if (destination.id !== destinationId) return true;
      removed = true;
      return false;
    });
    if (!removed) return;
    setDestinations(next);
    setHasChanges(true);
    publishEdit({ destinationIds: next.map((item) => item.id) });
  };

  const handleAddDestination = (destination: Destination) => {
    if (!destinations.some(d => d.id === destination.id)) {
      const next = [...destinations, destination];
      setDestinations(next);
      setHasChanges(true);
      publishEdit({ destinationIds: next.map((item) => item.id) });
    }
  };

  const handleSaveName = () => {
    if (itineraryName.trim()) {
      setIsEditingName(false);
      setHasChanges(true);
      publishEdit({ name: itineraryName.trim() });
    }
  };

  const handleInviteCollaborator = async () => {
    const trimmed = inviteQuery.trim();
    if (!trimmed) return;
    setInviteMessage(null);
    setIsInviting(true);
    try {
      await inviteCollaboratorToItinerary({
        itineraryId: savedItinerary.id,
        collaboratorLabel: trimmed,
      });
      setInviteQuery('');
      setInviteMessage('Invitation sent.');
    } catch (error) {
      setInviteMessage(error instanceof Error ? error.message : 'Failed to send invitation.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleSaveChanges = async () => {
    setSaveError(null);
    setIsSaving(true);
    // Save new version first, then try to remove old version.
    try {
      const updatedItinerary: SavedItinerary = {
        ...savedItinerary,
        name: itineraryName.trim() || savedItinerary.name,
        destinations,
        tripDays,
        totalCost,
        totalDuration,
      };

      const created = await createItinerary(updatedItinerary);
      if (!created) {
        setSaveError('Please sign in again to update this itinerary.');
        return;
      }
      try {
        await pushItinerarySync({
          itineraryId: created.id,
          name: created.name,
          tripDays: created.tripDays,
          destinationIds: created.destinations.map((item) => item.id),
          sourceUserId: currentUserId,
        });
      } catch (syncError) {
        console.warn('Collaboration sync failed:', syncError);
      }
      publishEdit({
        name: created.name,
        tripDays: created.tripDays,
        destinationIds: created.destinations.map((item) => item.id),
      });

      // Best-effort cleanup of the previous version.
      if (savedItinerary.id && created.id !== savedItinerary.id) {
        const removed = await deleteRemoteItinerary(savedItinerary.id);
        if (!removed) {
          setSaveError('Changes saved as a new itinerary, but we could not remove the old version.');
        }
      }

      setHasChanges(false);
      onSaveChangesSuccess?.(created);
      onUpdate();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('(500)')) {
        setSaveError('Server error while saving changes. Please try again.');
      } else {
        setSaveError(error instanceof Error ? error.message : 'Failed to save changes.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaveError(null);
    setIsSaving(true);
    try {
      const deleted = await deleteRemoteItinerary(savedItinerary.id);
      if (!deleted) {
        setSaveError('Unable to delete this itinerary right now. Please try again.');
        return;
      }
      onDeleteSuccess?.(savedItinerary.id);
      setIsDeleteDialogOpen(false);
      onBack();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to delete itinerary.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with editable name */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={itineraryName}
                    onChange={(e) => setItineraryName(e.target.value)}
                    className="text-2xl font-semibold border-b-2 border-blue-500 focus:outline-none flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') {
                        setItineraryName(savedItinerary.name);
                        setIsEditingName(false);
                      }
                    }}
                  />
                  <Button size="sm" onClick={handleSaveName}>
                    <Save className="w-4 h-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => {
                      setItineraryName(savedItinerary.name);
                      setIsEditingName(false);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-semibold">{itineraryName}</h2>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => setIsEditingName(true)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
              <p className="text-gray-600 mt-1">
                {destinations.length} destinations • Editing mode
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {hasChanges && (
                <Button onClick={() => void handleSaveChanges()} disabled={isSaving}>
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              )}
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(true)}>
                <Trash2 className="w-4 h-4 mr-2 text-red-500" />
                Delete
              </Button>
            </div>
          </div>

          <Separator />

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Live collaboration</p>
                <p className="text-sm text-slate-700">
                  Status: <span className="font-medium">{collaborationStatus}</span>
                </p>
                {liveNotice && <p className="text-xs text-slate-500">{liveNotice}</p>}
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <input
                  type="text"
                  value={inviteQuery}
                  onChange={(event) => setInviteQuery(event.target.value)}
                  placeholder="Invite by username/email"
                  className="h-9 min-w-56 rounded-md border border-slate-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
                />
                <Button
                  size="sm"
                  onClick={() => void handleInviteCollaborator()}
                  disabled={isInviting || !inviteQuery.trim()}
                  className="h-9"
                >
                  {isInviting ? 'Inviting...' : 'Send Invite'}
                </Button>
              </div>
            </div>
            {inviteMessage && <p className="mt-2 text-xs text-slate-600">{inviteMessage}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <Calendar className="w-6 h-6 mx-auto mb-2 text-blue-600" />
              <div className="text-2xl font-semibold">{tripDays}</div>
              <div className="text-sm text-gray-600">Days</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <Clock className="w-6 h-6 mx-auto mb-2 text-green-600" />
              <div className="text-2xl font-semibold">{totalDuration}h</div>
              <div className="text-sm text-gray-600">Total Time</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <Wallet className="w-6 h-6 mx-auto mb-2 text-purple-600" />
              <div className="text-2xl font-semibold">{formatPeso(totalCost)}</div>
              <div className="text-sm text-gray-600">Est. Cost</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Add Destinations Section */}
      <Card className="p-6">
        <Button
          onClick={() => setShowAddDestinations(!showAddDestinations)}
          variant="outline"
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          {showAddDestinations ? 'Hide Available Destinations' : 'Add More Destinations'}
        </Button>

        {showAddDestinations && availableDestinations.length > 0 && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableDestinations.map((dest, index) => (
              <Card key={dest.id ?? `${dest.name}-${index}`} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex gap-4">
                  <img
                    src={dest.image}
                    alt={dest.name}
                    className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                  />
                  <div className="flex-1 space-y-2">
                    <div>
                      <h4 className="font-semibold text-sm">{dest.name}</h4>
                      <p className="text-xs text-gray-600 line-clamp-1">{dest.description}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Clock className="w-3 h-3" />
                      <span>{dest.duration}h</span>
                      <Wallet className="w-3 h-3 ml-2" />
                      <span>{formatPeso(dest.estimatedCost)}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleAddDestination(dest)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {showAddDestinations && availableDestinations.length === 0 && (
          <div className="mt-4 text-center text-gray-500 py-8">
            All destinations are already in your itinerary
          </div>
        )}
      </Card>

      {/* Day by Day Schedule */}
      {destinations.length > 0 ? (
        Array.from(schedule.entries()).map(([day, dayDestinations]) => (
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

              <div className="space-y-3 ml-6 border-l-2 border-gray-200 pl-6">
                {dayDestinations.length === 0 && (
                  <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                    No activities scheduled for this day yet.
                  </div>
                )}
                {dayDestinations.map((dest, index) => (
                  <div key={dest.id ?? `${dest.name}-${day}-${index}`} className="relative">
                    <div className="absolute -left-8 top-4 w-4 h-4 bg-white border-2 border-blue-500 rounded-full"></div>
                    
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
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex gap-3 sm:gap-4 flex-1">
                          <img
                            src={dest.image}
                            alt={dest.name}
                            className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg flex-shrink-0"
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

                            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                <span>{getDuration(dest.duration)}h</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Wallet className="w-4 h-4" />
                                <span>{formatPeso(dest.estimatedCost)}</span>
                              </div>
                            </div>
                          <TravelModeBadges destination={dest} origin={userLocation} />
                        </div>
                      </div>

                        <div className="flex justify-end sm:block">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRemoveDestination(dest.id);
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
        ))
      ) : (
        <Card className="p-8 text-center">
          <p className="text-gray-600">No destinations in this itinerary. Add some destinations to get started!</p>
        </Card>
      )}

      {/* Actions */}
      <Card className="p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="font-semibold">Done editing?</h4>
            <p className="text-sm text-gray-600 mt-1">
              {hasChanges ? 'Remember to save your changes before leaving' : 'All changes saved'}
            </p>
          </div>
          <Button variant="outline" onClick={onBack}>
            Back to My Itineraries
          </Button>
        </div>
        {saveError && (
          <div className="mt-4 text-sm text-red-600">
            {saveError}
          </div>
        )}
      </Card>

      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete itinerary?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this itinerary?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={isSaving}>
              {isSaving ? 'Deleting...' : 'Delete'}
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
                  Destination details from this saved itinerary.
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
                    <Clock className="w-4 h-4" />
                    {getDuration(selectedDestination.duration)}h
                  </span>
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
