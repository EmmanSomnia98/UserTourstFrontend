import { Destination, UserPreferences } from '@/app/types/destination';
import { DestinationCard } from '@/app/components/DestinationCard';
import { RecommendationBreakdown } from '@/app/components/RecommendationBreakdown';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Sparkles, RefreshCw, Map } from 'lucide-react';
import { useState } from 'react';

interface RecommendationsViewProps {
  recommendations: Destination[];
  allDestinations: Destination[];
  preferences: UserPreferences;
  itinerary: Destination[];
  onAddToItinerary: (destination: Destination) => void;
  onViewItinerary: () => void;
  onRestart: () => void;
  recommendationScores?: Map<string, number>;
}

export function RecommendationsView({
  recommendations,
  allDestinations,
  preferences,
  itinerary,
  onAddToItinerary,
  onViewItinerary,
  onRestart,
  recommendationScores
}: RecommendationsViewProps) {
  const otherDestinations = allDestinations.filter(
    dest => !recommendations.some(rec => rec.id === dest.id)
  );

  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full">
          <Sparkles className="w-5 h-5" />
          <span className="font-medium">Personalized for you</span>
        </div>
        <h2 className="text-3xl font-semibold">Your Recommended Destinations</h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Based on your preferences, we've curated the perfect destinations for your {preferences.duration}-day trip to Bulusan, Sorsogon
        </p>
      </div>

      {/* Itinerary Status */}
      {itinerary.length > 0 && (
        <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center font-semibold">
                {itinerary.length}
              </div>
              <div>
                <h3 className="font-semibold">Destinations added to your itinerary</h3>
                <p className="text-sm text-gray-600">
                  Keep adding destinations or view your complete itinerary
                </p>
              </div>
            </div>
            <Button onClick={onViewItinerary}>
              <Map className="w-4 h-4 mr-2" />
              View Itinerary
            </Button>
          </div>
        </Card>
      )}

      {/* Top Recommendations */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xl font-semibold">Top Picks for You</h3>
          <Button variant="outline" onClick={onRestart}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Change Preferences
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recommendations.map(destination => (
            <DestinationCard
              key={destination.id}
              destination={destination}
              onAddToItinerary={onAddToItinerary}
              isInItinerary={itinerary.some(item => item.id === destination.id)}
              showRecommendationScore={true}
              recommendationScore={recommendationScores?.get(destination.id)}
              onShowBreakdown={() => setSelectedDestination(destination)}
            />
          ))}
        </div>
      </div>

      {/* Other Destinations */}
      {otherDestinations.length > 0 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-semibold">Other Destinations</h3>
            <p className="text-gray-600">Explore more options that might interest you</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {otherDestinations.map(destination => (
              <DestinationCard
                key={destination.id}
                destination={destination}
                onAddToItinerary={onAddToItinerary}
                isInItinerary={itinerary.some(item => item.id === destination.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recommendation Breakdown Dialog */}
      {selectedDestination && (
        <Dialog open={true} onOpenChange={() => setSelectedDestination(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedDestination.name} - Recommendation Analysis</DialogTitle>
            </DialogHeader>
            <RecommendationBreakdown
              destination={selectedDestination}
              preferences={preferences}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
