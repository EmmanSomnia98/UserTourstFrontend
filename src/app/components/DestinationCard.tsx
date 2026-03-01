import { Destination } from '@/app/types/destination';
import { Card } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { TravelModeBadges } from '@/app/components/TravelModeBadges';
import { formatPeso } from '@/app/utils/currency';
import { Star, Clock, TrendingUp, MapPin, Plus, Check, Info } from 'lucide-react';

interface DestinationCardProps {
  destination: Destination;
  onAddToItinerary?: (destination: Destination) => void;
  isInItinerary?: boolean;
  showRecommendationScore?: boolean;
  recommendationScore?: number;
  onShowBreakdown?: (destination: Destination) => void;
}

export function DestinationCard({
  destination,
  onAddToItinerary,
  isInItinerary = false,
  showRecommendationScore = false,
  recommendationScore,
  onShowBreakdown
}: DestinationCardProps) {
  const difficultyColors = {
    easy: 'bg-green-100 text-green-800',
    moderate: 'bg-yellow-100 text-yellow-800',
    challenging: 'bg-red-100 text-red-800'
  };

  const typeColors = {
    nature: 'bg-emerald-100 text-emerald-800',
    adventure: 'bg-orange-100 text-orange-800',
    cultural: 'bg-purple-100 text-purple-800',
    relaxation: 'bg-blue-100 text-blue-800',
    historical: 'bg-amber-100 text-amber-800'
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
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
      
      <div className="p-4 space-y-3">
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

        <div className="flex flex-wrap gap-2">
          <Badge className={typeColors[destination.type]}>{destination.type}</Badge>
          <Badge className={difficultyColors[destination.difficulty]}>{destination.difficulty}</Badge>
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

        <TravelModeBadges destination={destination} />

        <div className="flex flex-wrap gap-1">
          {destination.interests.slice(0, 3).map(interest => (
            <span key={interest} className="text-xs px-2 py-1 bg-gray-100 rounded-full">
              {interest}
            </span>
          ))}
          {destination.interests.length > 3 && (
            <span className="text-xs px-2 py-1 bg-gray-100 rounded-full">
              +{destination.interests.length - 3} more
            </span>
          )}
        </div>

        {onAddToItinerary && (
          <Button
            onClick={() => onAddToItinerary(destination)}
            disabled={isInItinerary}
            className="w-full"
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
