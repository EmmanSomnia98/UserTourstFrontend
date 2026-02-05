import { useState } from 'react';
import { Destination, UserPreferences } from '@/app/types/destination';
import { SavedItinerary } from '@/app/types/saved-itinerary';
import { destinations } from '@/app/data/destinations';
import { getRecommendations, calculateContentScore } from '@/app/utils/recommendation';
import { PreferenceForm } from '@/app/components/PreferenceForm';
import { RecommendationsView } from '@/app/components/RecommendationsView';
import { ItineraryView } from '@/app/components/ItineraryView';
import { SavedItinerariesView } from '@/app/components/SavedItinerariesView';
import { EditableItineraryView } from '@/app/components/EditableItineraryView';
import { Button } from '@/app/components/ui/button';
import { MapPin, Sparkles, BookOpen } from 'lucide-react';

type AppView = 'welcome' | 'preferences' | 'itinerary' | 'saved-itineraries' | 'edit-saved' | 'recommendations';

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('welcome');
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [recommendations, setRecommendations] = useState<Destination[]>([]);
  const [itinerary, setItinerary] = useState<Destination[]>([]);
  const [recommendationScores, setRecommendationScores] = useState<Map<string, number>>(new Map());
  const [viewingSavedItinerary, setViewingSavedItinerary] = useState<SavedItinerary | null>(null);

  const handlePreferencesSubmit = (prefs: UserPreferences) => {
    setPreferences(prefs);
    
    // Automatically generate a complete itinerary using hybrid algorithm with knapsack optimization
    const recommended = getRecommendations(destinations, prefs, 10); // Get up to 10 destinations
    
    // Set the recommendations as the itinerary automatically
    setItinerary(recommended);
    
    // Calculate and store scores for display
    const scores = new Map<string, number>();
    
    // Find max score for normalization
    let maxScore = 0;
    recommended.forEach(dest => {
      const score = calculateContentScore(dest, prefs);
      if (score > maxScore) maxScore = score;
    });
    
    // Normalize scores to 0-100 for display
    recommended.forEach(dest => {
      const score = calculateContentScore(dest, prefs);
      const normalizedScore = maxScore > 0 ? (score / maxScore) * 100 : 0;
      scores.set(dest.id, normalizedScore);
    });
    
    setRecommendationScores(scores);
    
    // Go directly to itinerary view
    setCurrentView('itinerary');
  };

  const handleAddToItinerary = (destination: Destination) => {
    if (!itinerary.some(item => item.id === destination.id)) {
      setItinerary([...itinerary, destination]);
    }
  };

  const handleRemoveFromItinerary = (destinationId: string) => {
    setItinerary(itinerary.filter(item => item.id !== destinationId));
  };

  const handleReset = () => {
    setCurrentView('preferences');
    setItinerary([]);
    setRecommendations([]);
    setPreferences(null);
    setViewingSavedItinerary(null);
  };

  const handleViewItinerary = () => {
    setCurrentView('itinerary');
  };

  const handleBackToRecommendations = () => {
    setCurrentView('recommendations');
  };

  const handleViewSavedItinerary = (savedItinerary: SavedItinerary) => {
    setViewingSavedItinerary(savedItinerary);
    setItinerary(savedItinerary.destinations);
    setPreferences({ 
      duration: savedItinerary.tripDays,
      budget: savedItinerary.totalCost,
      activityLevel: 'moderate' as const,
      interests: [],
      travelStyle: []
    });
    setCurrentView('edit-saved');
  };

  const handleBackToWelcome = () => {
    setCurrentView('welcome');
    setViewingSavedItinerary(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Bulusan Wanderer</h1>
                <p className="text-sm text-gray-600">Personalized Itinerary Planner</p>
              </div>
            </div>
            <div className="flex gap-2">
              {currentView === 'welcome' && (
                <Button variant="outline" onClick={() => setCurrentView('saved-itineraries')}>
                  <BookOpen className="w-4 h-4 mr-2" />
                  View My Itineraries
                </Button>
              )}
              {currentView === 'itinerary' && (
                <Button variant="outline" onClick={() => setCurrentView('saved-itineraries')}>
                  <BookOpen className="w-4 h-4 mr-2" />
                  View My Itineraries
                </Button>
              )}
              {currentView === 'edit-saved' && (
                <Button variant="outline" onClick={() => setCurrentView('saved-itineraries')}>
                  <BookOpen className="w-4 h-4 mr-2" />
                  Back to My Itineraries
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'welcome' && (
          <div className="text-center space-y-8 py-12">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full">
                <Sparkles className="w-5 h-5" />
                <span className="font-medium">AI-Powered Recommendations</span>
              </div>
              <h2 className="text-5xl font-bold text-gray-900">
                Discover Bulusan, Sorsogon
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Let our hybrid recommendation system create a personalized travel itinerary 
                based on your preferences, interests, and travel style. Experience the best of 
                Bulusan's natural wonders, cultural heritage, and adventure destinations.
              </p>
            </div>

            {/* Hero Image Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
              <div className="relative h-64 rounded-lg overflow-hidden shadow-lg">
                <img
                  src={destinations[0].image}
                  alt="Mount Bulusan"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                  <p className="text-white font-semibold">Volcanic Adventures</p>
                </div>
              </div>
              <div className="relative h-64 rounded-lg overflow-hidden shadow-lg">
                <img
                  src={destinations[1].image}
                  alt="Lake Bulusan"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                  <p className="text-white font-semibold">Serene Lakes</p>
                </div>
              </div>
              <div className="relative h-64 rounded-lg overflow-hidden shadow-lg">
                <img
                  src={destinations[4].image}
                  alt="Waterfalls"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                  <p className="text-white font-semibold">Majestic Waterfalls</p>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto text-left">
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Hybrid Recommendation System</h3>
                <p className="text-gray-600 text-sm">
                  Content-based filtering analyzes your preferences while collaborative filtering learns from similar travelers
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <MapPin className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Knapsack Optimization</h3>
                <p className="text-gray-600 text-sm">
                  Multi-constraint knapsack algorithm maximizes value while respecting budget and time limits
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Smart Itinerary Scheduling</h3>
                <p className="text-gray-600 text-sm">
                  Intelligent scheduling considers difficulty, duration, and optimal daily activity distribution
                </p>
              </div>
            </div>

            <Button 
              size="lg" 
              className="text-lg px-8 py-6"
              onClick={() => setCurrentView('preferences')}
            >
              Start Planning Your Trip!
            </Button>
          </div>
        )}

        {currentView === 'preferences' && (
          <div className="py-8">
            <PreferenceForm onSubmit={handlePreferencesSubmit} />
          </div>
        )}

        {currentView === 'recommendations' && preferences && (
          <RecommendationsView
            recommendations={recommendations}
            allDestinations={destinations}
            preferences={preferences}
            itinerary={itinerary}
            onAddToItinerary={handleAddToItinerary}
            onViewItinerary={handleViewItinerary}
            onRestart={handleReset}
            recommendationScores={recommendationScores}
          />
        )}

        {currentView === 'itinerary' && preferences && (
          <ItineraryView
            destinations={itinerary}
            tripDays={preferences.duration}
            onRemoveDestination={handleRemoveFromItinerary}
            onReset={handleReset}
            allDestinations={destinations}
            onAddDestination={handleAddToItinerary}
          />
        )}

        {currentView === 'saved-itineraries' && (
          <SavedItinerariesView
            onViewItinerary={handleViewSavedItinerary}
            onBackToWelcome={handleBackToWelcome}
          />
        )}

        {currentView === 'edit-saved' && viewingSavedItinerary && (
          <EditableItineraryView
            savedItinerary={viewingSavedItinerary}
            onBack={() => setCurrentView('saved-itineraries')}
            onUpdate={() => {
              // Refresh the saved itinerary list when updates are made
              setViewingSavedItinerary(null);
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-600 text-sm">
            <p>© 2026 Bulusan Wanderer. Personalized itinerary planning powered by hybrid recommendation algorithms.</p>
            <p className="mt-2">Combining content-based filtering with collaborative patterns for optimal travel experiences.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}