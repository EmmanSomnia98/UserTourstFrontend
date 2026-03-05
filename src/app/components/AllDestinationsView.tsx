import { useMemo, useState } from 'react';
import { Destination } from '@/app/types/destination';
import { DestinationCard } from '@/app/components/DestinationCard';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { GeoPoint } from '@/app/utils/travel';
import { Search, ArrowLeft } from 'lucide-react';

type AllDestinationsViewProps = {
  destinations: Destination[];
  status: 'idle' | 'loading' | 'error';
  onBack: () => void;
  userLocation?: GeoPoint | null;
};

export function AllDestinationsView({
  destinations,
  status,
  onBack,
  userLocation,
}: AllDestinationsViewProps) {
  const [query, setQuery] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);

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

  const filteredDestinations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return destinations;

    return destinations.filter((destination) => {
      const searchable = [
        destination.name,
        destination.description,
        destination.type,
        destination.difficulty,
        ...destination.interests,
      ]
        .join(' ')
        .toLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [destinations, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">All Destinations</h2>
          <p className="text-sm text-slate-600">
            Browse all destinations in the system and search quickly by name, type, or interest.
          </p>
        </div>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-500" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search destination, description, type, or interests..."
            aria-label="Search destinations"
          />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Showing {filteredDestinations.length} of {destinations.length} destinations
        </p>
      </Card>

      {status === 'loading' && (
        <Card className="p-6 text-center text-sm text-slate-600">Loading destinations...</Card>
      )}
      {status === 'error' && (
        <Card className="p-6 text-center text-sm text-red-700">
          We couldn&apos;t load destinations from the server. Please try again.
        </Card>
      )}
      {status !== 'loading' && filteredDestinations.length === 0 && (
        <Card className="p-6 text-center text-sm text-slate-600">
          No destinations matched your search.
        </Card>
      )}

      {filteredDestinations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDestinations.map((destination) => (
            <div
              key={destination.id}
              role="button"
              tabIndex={0}
              className="cursor-pointer"
              onClick={() => setSelectedDestination(destination)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedDestination(destination);
                }
              }}
            >
              <DestinationCard
                destination={destination}
                userLocation={userLocation}
              />
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={selectedDestination !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSelectedDestination(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          {selectedDestination && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedDestination.name}</DialogTitle>
                <DialogDescription>
                  Destination details from all destinations list.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <img
                  src={selectedDestination.image}
                  alt={selectedDestination.name}
                  className="w-full h-56 sm:h-72 object-cover rounded-lg"
                />
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1 text-sm text-slate-700">
                  {formatDescriptionLines(selectedDestination.description).map((line, index) => (
                    <p key={`${selectedDestination.id}-desc-${index}`} className="leading-relaxed">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
