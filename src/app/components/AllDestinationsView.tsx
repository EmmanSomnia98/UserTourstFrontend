import { useEffect, useMemo, useState } from 'react';
import { Destination } from '@/app/types/destination';
import { DestinationCard } from '@/app/components/DestinationCard';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { GeoPoint } from '@/app/utils/travel';
import { createDestinationComment, DestinationComment, fetchDestinationComments } from '@/app/api/comments';
import { Search, ArrowLeft } from 'lucide-react';

type AllDestinationsViewProps = {
  destinations: Destination[];
  status: 'idle' | 'loading' | 'error';
  onBack: () => void;
  userLocation?: GeoPoint | null;
  onRateDestination?: (destination: Destination, rating: number) => void;
  destinationRatings?: Record<string, number>;
};

export function AllDestinationsView({
  destinations,
  status,
  onBack,
  userLocation,
  onRateDestination,
  destinationRatings,
}: AllDestinationsViewProps) {
  const [query, setQuery] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [commentsByDestination, setCommentsByDestination] = useState<Record<string, DestinationComment[]>>({});
  const [commentDraft, setCommentDraft] = useState('');
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);

  useEffect(() => {
    setCommentDraft('');
    setCommentsError(null);
  }, [selectedDestination?.id]);

  useEffect(() => {
    if (!selectedDestination) return;

    let active = true;
    setIsCommentsLoading(true);
    setCommentsError(null);

    void fetchDestinationComments(selectedDestination.id)
      .then((items) => {
        if (!active) return;
        setCommentsByDestination((prev) => ({
          ...prev,
          [selectedDestination.id]: items,
        }));
      })
      .catch((error) => {
        if (!active) return;
        setCommentsError(error instanceof Error ? error.message : 'Failed to load comments.');
      })
      .finally(() => {
        if (!active) return;
        setIsCommentsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedDestination?.id]);

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

  const selectedComments = selectedDestination ? commentsByDestination[selectedDestination.id] ?? [] : [];

  const handleSubmitComment = async () => {
    if (!selectedDestination) return;
    const trimmed = commentDraft.trim();
    if (!trimmed) return;
    setIsPostingComment(true);
    setCommentsError(null);

    try {
      const created = await createDestinationComment(selectedDestination.id, trimmed);
      setCommentsByDestination((prev) => {
        const current = prev[selectedDestination.id] ?? [];
        return {
          ...prev,
          [selectedDestination.id]: [created, ...current].slice(0, 100),
        };
      });
      setCommentDraft('');
    } catch (error) {
      setCommentsError(error instanceof Error ? error.message : 'Failed to post comment.');
    } finally {
      setIsPostingComment(false);
    }
  };

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
              className="h-full cursor-pointer"
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
                userRating={destinationRatings?.[destination.id]}
                onRateDestination={onRateDestination}
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
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">Feedback / Comments</p>
                    <span className="text-xs text-slate-500">{selectedComments.length} comment(s)</span>
                  </div>
                  <div className="space-y-2">
                    <Textarea
                      value={commentDraft}
                      onChange={(event) => setCommentDraft(event.target.value)}
                      placeholder="Share your feedback for this destination..."
                      maxLength={500}
                      className="min-h-20 bg-white"
                      disabled={isPostingComment}
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">{commentDraft.length}/500</span>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void handleSubmitComment()}
                        disabled={!commentDraft.trim() || isPostingComment}
                      >
                        {isPostingComment ? 'Posting...' : 'Post Comment'}
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1">
                    {commentsError && <p className="text-xs text-red-600">{commentsError}</p>}
                    {isCommentsLoading ? (
                      <p className="text-xs text-slate-500">Loading comments...</p>
                    ) : selectedComments.length === 0 ? (
                      <p className="text-xs text-slate-500">No comments yet. Be the first to leave feedback.</p>
                    ) : (
                      selectedComments.map((comment) => (
                        <div key={comment.id} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                          <p className="text-sm text-slate-700">{comment.body}</p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            {comment.userName ? `${comment.userName} • ` : ''}
                            {new Date(comment.createdAt).toLocaleString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
