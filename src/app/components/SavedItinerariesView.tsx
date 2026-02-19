import { useEffect, useState } from 'react';
import { SavedItinerary } from '@/app/types/saved-itinerary';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Calendar, MapPin, Trash2, Edit, DollarSign } from 'lucide-react';
import { deleteRemoteItinerary, fetchItineraries } from '@/app/api/itineraries';
import { formatPeso } from '@/app/utils/currency';

interface SavedItinerariesViewProps {
  onViewItinerary: (itinerary: SavedItinerary) => void;
  onBackToWelcome: () => void;
  onDeleteItinerarySuccess?: (itineraryId: string) => void;
}

export function SavedItinerariesView({
  onViewItinerary,
  onBackToWelcome,
  onDeleteItinerarySuccess
}: SavedItinerariesViewProps) {
  const [savedItineraries, setSavedItineraries] = useState<SavedItinerary[]>([]);
  const [status, setStatus] = useState<'loading' | 'idle' | 'error'>('loading');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setStatus('loading');
    fetchItineraries()
      .then((data) => {
        if (!isMounted) return;
        setSavedItineraries(data);
        setStatus('idle');
      })
      .catch((error) => {
        console.error('Failed to load itineraries:', error);
        if (!isMounted) return;
        setSavedItineraries([]);
        setStatus('error');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleDelete = async (id: string) => {
    if (!id) return;
    setDeleteError(null);
    setDeletingId(id);
    try {
      const deleted = await deleteRemoteItinerary(id);
      if (!deleted) {
        setDeleteError('Please sign in again to delete server itineraries.');
        return;
      }
      const refreshed = await fetchItineraries();
      setSavedItineraries(refreshed);
      const stillExists = refreshed.some((item) => item.id === id);
      if (stillExists) {
        setDeleteError('Delete request completed but itinerary still exists on server.');
        return;
      }
      onDeleteItinerarySuccess?.(id);
    } catch (error) {
      console.error('Failed to delete itinerary:', error);
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete itinerary.');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">My Saved Itineraries</h2>
          <p className="text-gray-600 mt-2">
            {status === 'loading'
              ? 'Loading your itineraries...'
              : savedItineraries.length === 0 
                ? 'No saved itineraries yet. Start planning your trip!' 
                : `You have ${savedItineraries.length} saved ${savedItineraries.length === 1 ? 'itinerary' : 'itineraries'}`
            }
          </p>
        </div>
        <Button variant="outline" onClick={onBackToWelcome}>
          Back to Home
        </Button>
      </div>

      {status === 'error' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          We couldn&apos;t load itineraries from the server. Please try again.
        </div>
      )}

      {deleteError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {deleteError}
        </div>
      )}

      {/* Empty State */}
      {status !== 'loading' && savedItineraries.length === 0 && (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No saved itineraries yet</h3>
          <p className="text-gray-600 mb-6">
            Create your first personalized itinerary and save it for later
          </p>
          <Button onClick={onBackToWelcome}>
            Start Planning
          </Button>
        </Card>
      )}

      {/* Saved Itineraries Grid */}
      {savedItineraries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedItineraries.map((itinerary, index) => (
            <Card key={itinerary.id ?? `${itinerary.name}-${index}`} className="overflow-hidden hover:shadow-lg transition-shadow">
              {/* Card Header with Image */}
              <div className="relative h-48 bg-gradient-to-br from-blue-400 to-green-400">
                {itinerary.destinations[0]?.image && (
                  <img 
                    src={itinerary.destinations[0].image} 
                    alt={itinerary.destinations[0].name}
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute top-4 right-4">
                  <Badge className="bg-white text-gray-900">
                    {itinerary.tripDays} {itinerary.tripDays === 1 ? 'Day' : 'Days'}
                  </Badge>
                </div>
              </div>

              {/* Card Content */}
              <div className="p-6 space-y-4">
                <div>
                  <h3 className="font-semibold text-lg text-gray-900 mb-1">{itinerary.name}</h3>
                  <p className="text-sm text-gray-500">Created {formatDate(itinerary.createdAt)}</p>
                </div>

                {/* Stats */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>{itinerary.destinations.length} destinations</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <DollarSign className="w-4 h-4" />
                    <span>{formatPeso(itinerary.totalCost)} total cost</span>
                  </div>
                </div>

                {/* Destination Preview */}
                <div className="pt-2">
                  <p className="text-xs text-gray-500 mb-2">Includes:</p>
                  <div className="flex flex-wrap gap-1">
                    {itinerary.destinations.slice(0, 3).map((dest, destIndex) => (
                      <Badge key={dest.id ?? `${dest.name}-${destIndex}`} variant="outline" className="text-xs">
                        {dest.name}
                      </Badge>
                    ))}
                    {itinerary.destinations.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{itinerary.destinations.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button 
                    className="flex-1"
                    onClick={() => onViewItinerary(itinerary)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button 
                    variant="outline"
                    size="icon"
                    onClick={() => setPendingDeleteId(itinerary.id)}
                    disabled={deletingId === itinerary.id}
                    title={deletingId === itinerary.id ? 'Deleting itinerary...' : 'Delete itinerary'}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={pendingDeleteId !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setPendingDeleteId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete itinerary?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this itinerary?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!pendingDeleteId) return;
                void handleDelete(pendingDeleteId);
                setPendingDeleteId(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
