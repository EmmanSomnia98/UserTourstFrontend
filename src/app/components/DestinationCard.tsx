import { Destination } from '@/app/types/destination';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { TravelModeBadges } from '@/app/components/TravelModeBadges';
import { formatPeso } from '@/app/utils/currency';
import { GeoPoint } from '@/app/utils/travel';
import { Star, Clock, TrendingUp, MapPin, Plus, Check, Info } from 'lucide-react';

interface DestinationCardProps {
  destination: Destination;
  onAddToItinerary?: (destination: Destination) => void;
  isInItinerary?: boolean;
  showRecommendationScore?: boolean;
  recommendationScore?: number;
  onShowBreakdown?: (destination: Destination) => void;
  onRateDestination?: (destination: Destination, rating: number) => void;
  userRating?: number;
  userLocation?: GeoPoint | null;
}

export function DestinationCard({
  destination,
  onAddToItinerary,
  isInItinerary = false,
  showRecommendationScore = false,
  recommendationScore,
  onShowBreakdown,
  onRateDestination,
  userRating = 0,
  userLocation
}: DestinationCardProps) {
  const hasExactLocation =
    Number.isFinite(destination.location?.lat) &&
    Number.isFinite(destination.location?.lng) &&
    destination.location.lat >= -90 &&
    destination.location.lat <= 90 &&
    destination.location.lng >= -180 &&
    destination.location.lng <= 180;
  const hasAddress =
    Boolean(destination.address?.fullAddress) ||
    Boolean(destination.address?.purok) ||
    Boolean(destination.address?.barangay) ||
    Boolean(destination.address?.city) ||
    Boolean(destination.address?.province);

  const exactLocationLabel = hasExactLocation
    ? `${destination.location.lat.toFixed(6)}, ${destination.location.lng.toFixed(6)}`
    : null;
  const exactLocationMapUrl = hasExactLocation
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${destination.location.lat},${destination.location.lng}`
      )}`
    : null;
  return (
    <Card className="h-full overflow-hidden transition-shadow hover:shadow-lg flex flex-col">
      <div className="relative h-40 sm:h-48 overflow-hidden">
        <img
          src={destination.image}
          alt={destination.name}
          className="w-full h-full object-cover"
        />
        {showRecommendationScore && recommendationScore && (
          <div className="absolute top-3 right-3 bg-white rounded-full px-3 py-1 flex items-center gap-1 shadow-md">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-semibold">{Math.round(recommendationScore)}%</span>
          </div>
        )}
      </div>
      
      <div className="p-4 space-y-3 flex-1 flex flex-col">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-base sm:text-lg">{destination.name}</h3>
            <div className="flex items-center gap-1 text-sm flex-shrink-0">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{destination.rating}</span>
              <span className="hidden sm:inline text-gray-500">({destination.reviewCount})</span>
            </div>
          </div>
          
          <p className="text-sm text-gray-600 line-clamp-2">{destination.description}</p>
        </div>

        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{destination.duration}h</span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            <span>{formatPeso(destination.estimatedCost)}</span>
          </div>
        </div>

        <TravelModeBadges destination={destination} origin={userLocation} />

        {onRateDestination && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-600">Your rating</p>
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }, (_, index) => {
                const value = index + 1;
                const active = value <= userRating;
                return (
                  <button
                    key={`${destination.id}-rate-${value}`}
                    type="button"
                    aria-label={`Rate ${destination.name} ${value} star${value > 1 ? 's' : ''}`}
                    title={`Rate ${value} star${value > 1 ? 's' : ''}`}
                    onClick={() => onRateDestination(destination, value)}
                    className="rounded-sm p-0.5 transition hover:scale-110"
                  >
                    <Star className={`h-4 w-4 ${active ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                  </button>
                );
              })}
              <span className="ml-1 text-xs text-slate-500">
                {userRating > 0 ? `${userRating}/5` : 'Not rated'}
              </span>
            </div>
          </div>
        )}

        {(hasAddress || hasExactLocation) && (
          <div className="mt-auto rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs font-medium text-slate-700">Location</p>
            {destination.address?.fullAddress && (
              <p className="text-xs text-slate-600">{destination.address.fullAddress}</p>
            )}
            <p className="text-xs text-slate-600">
              Purok: {destination.address?.purok || 'Not provided'}
            </p>
            <p className="text-xs text-slate-600">
              Barangay: {destination.address?.barangay || 'Not provided'}
            </p>
            <p className="text-xs text-slate-600">
              City: {destination.address?.city || 'Not provided'}
            </p>
            <p className="text-xs text-slate-600">
              Province: {destination.address?.province || 'Not provided'}
            </p>
            {hasExactLocation && (
              <p className="text-[11px] text-slate-500">{exactLocationLabel}</p>
            )}
            {hasExactLocation && (
              <a
                href={exactLocationMapUrl ?? '#'}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
              >
                <MapPin className="h-3.5 w-3.5" />
                View on Google Maps
              </a>
            )}
          </div>
        )}

        {onAddToItinerary && (
          <Button
            onClick={() => onAddToItinerary(destination)}
            disabled={isInItinerary}
            className={`w-full ${hasAddress || hasExactLocation ? '' : 'mt-auto'}`}
            variant={isInItinerary ? "secondary" : "default"}
          >
            {isInItinerary ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Added to Itinerary
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Add to Itinerary
              </>
            )}
          </Button>
        )}

        {onShowBreakdown && (
          <Button
            onClick={() => onShowBreakdown(destination)}
            className="w-full mt-2"
            variant="outline"
          >
            <Info className="w-4 h-4 mr-2" />
            Show Breakdown
          </Button>
        )}
      </div>
    </Card>
  );
}
