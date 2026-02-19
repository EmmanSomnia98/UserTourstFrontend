import { useEffect, useState } from 'react';
import { Destination, UserPreferences } from '@/app/types/destination';
import { SavedItinerary } from '@/app/types/saved-itinerary';
import { fetchDestinations } from '@/app/api/destinations';
import { fetchServerRecommendations } from '@/app/api/recommendations';
import { clearAuthSession, getAuthToken, getAuthUser } from '@/app/api/client';
import { type AuthUser } from '@/app/api/auth';
import { buildFeedbackEvent, flushFeedbackQueue, recordFeedbackEvent } from '@/app/api/feedback';
import { useIsMobile } from '@/app/components/ui/use-mobile';
import { calculateContentScore } from '@/app/utils/recommendation';
import { PreferenceForm } from '@/app/components/PreferenceForm';
import { UserLogin } from '@/app/components/UserLogin';
import { UserSignup } from '@/app/components/UserSignup';
import { RecommendationsView } from '@/app/components/RecommendationsView';
import { ItineraryView } from '@/app/components/ItineraryView';
import { SavedItinerariesView } from '@/app/components/SavedItinerariesView';
import { EditableItineraryView } from '@/app/components/EditableItineraryView';
import { Button } from '@/app/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { MapPin, Sparkles, BookOpen, Menu } from 'lucide-react';
import backgroundImage from '@/assets/bulusan-lake.jpg';

type AppView =
  | 'welcome'
  | 'user-login'
  | 'user-signup'
  | 'preferences'
  | 'itinerary'
  | 'saved-itineraries'
  | 'edit-saved'
  | 'recommendations';

export default function App() {
  const isMobile = useIsMobile();
  const [currentView, setCurrentView] = useState<AppView>('welcome');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [recommendations, setRecommendations] = useState<Destination[]>([]);
  const [itinerary, setItinerary] = useState<Destination[]>([]);
  const [allDestinations, setAllDestinations] = useState<Destination[]>([]);
  const [destinationsStatus, setDestinationsStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [recommendationScores, setRecommendationScores] = useState<Map<string, number>>(new Map());
  const [viewingSavedItinerary, setViewingSavedItinerary] = useState<SavedItinerary | null>(null);
  const [lastRecommendationRequestId, setLastRecommendationRequestId] = useState<string | null>(null);
  const [lastRecommendationModelVersion, setLastRecommendationModelVersion] = useState<string | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [logoutStep, setLogoutStep] = useState<'confirm' | 'thanks'>('confirm');
  const heroDestinations = allDestinations.slice(0, 3);
  const showHeroGrid = heroDestinations.length === 3;
  const feedbackIdentity = {
    userId: currentUser?.id,
    userEmail: currentUser?.email,
  };

  useEffect(() => {
    const storedToken = getAuthToken();
    const storedUser = getAuthUser<AuthUser>();
    if (storedToken) {
      setIsAuthenticated(true);
      setCurrentUser(storedUser ?? null);
      return;
    }
    if (storedUser) clearAuthSession();
    setIsAuthenticated(false);
    setCurrentUser(null);
  }, []);

  useEffect(() => {
    let isMounted = true;
    setDestinationsStatus('loading');
    fetchDestinations()
      .then((data) => {
        if (!isMounted) return;
        setAllDestinations(data);
        setDestinationsStatus('idle');
      })
      .catch((error) => {
        console.error('Failed to load destinations:', error);
        if (!isMounted) return;
        setAllDestinations([]);
        setDestinationsStatus('error');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    void flushFeedbackQueue();
  }, [currentUser?.id, currentUser?.email]);

  const trackEvent = (
    eventType: Parameters<typeof buildFeedbackEvent>[0],
    payload: {
      destinationId?: string;
      itineraryId?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ) => {
    recordFeedbackEvent(buildFeedbackEvent(eventType, feedbackIdentity, payload));
  };

  const normalizeScores = (scoreById: Map<string, number>): Map<string, number> => {
    const normalized = new Map<string, number>();
    if (scoreById.size === 0) return normalized;
    const max = Math.max(...Array.from(scoreById.values()));
    if (max <= 0) {
      scoreById.forEach((_, id) => normalized.set(id, 0));
      return normalized;
    }
    scoreById.forEach((score, id) => {
      normalized.set(id, (score / max) * 100);
    });
    return normalized;
  };

  const calculateDisplayScores = (items: Destination[], prefs: UserPreferences): Map<string, number> => {
    const scores = new Map<string, number>();
    let maxScore = 0;
    items.forEach((dest) => {
      const score = calculateContentScore(dest, prefs);
      if (score > maxScore) maxScore = score;
    });
    items.forEach((dest) => {
      const score = calculateContentScore(dest, prefs);
      const normalizedScore = maxScore > 0 ? (score / maxScore) * 100 : 0;
      scores.set(dest.id, normalizedScore);
    });
    return scores;
  };

  const applyRecommendations = (
    recommended: Destination[],
    prefs: UserPreferences,
    serverScores?: Map<string, number>
  ) => {
    setRecommendations(recommended);
    setItinerary(recommended);
    if (serverScores && serverScores.size > 0) {
      setRecommendationScores(normalizeScores(serverScores));
    } else {
      setRecommendationScores(calculateDisplayScores(recommended, prefs));
    }
    setCurrentView('itinerary');
  };

  const handlePreferencesSubmit = async (prefs: UserPreferences) => {
    setPreferences(prefs);
    const serverResult = await fetchServerRecommendations(prefs, 6, allDestinations);
    if (serverResult.destinations.length === 0) {
      const hasBudgetConstraint = Number.isFinite(prefs.budget) && prefs.budget > 0;
      if (hasBudgetConstraint) {
        throw new Error(
          `No destinations fit your budget of ₱${Math.round(prefs.budget)} per day for ${prefs.duration} day(s). ` +
          'Try increasing your budget or changing your interests.'
        );
      }
      throw new Error('No destinations matched your current preferences. Try selecting different interests.');
    }
    setLastRecommendationRequestId(serverResult.metadata.recommendationRequestId ?? null);
    setLastRecommendationModelVersion(serverResult.metadata.modelVersion ?? null);
    applyRecommendations(serverResult.destinations, prefs, serverResult.scores);

    trackEvent('recommendation_requested', {
      metadata: {
        recommendationRequestId: serverResult.metadata.recommendationRequestId,
        modelVersion: serverResult.metadata.modelVersion,
        requestedLimit: 6,
        returnedCount: serverResult.destinations.length,
        budget: prefs.budget,
        duration: prefs.duration,
        interestCount: prefs.interests.length,
        travelStyleCount: prefs.travelStyle.length,
      },
    });

    serverResult.destinations.forEach((destination, index) => {
      trackEvent('recommendation_impression', {
        destinationId: destination.id,
        metadata: {
          rank: index + 1,
          recommendationRequestId: serverResult.metadata.recommendationRequestId,
          modelVersion: serverResult.metadata.modelVersion,
          score: serverResult.scores.get(destination.id),
        },
      });
    });
  };

  const handleAddToItinerary = (destination: Destination) => {
    if (!itinerary.some(item => item.id === destination.id)) {
      setItinerary([...itinerary, destination]);
      const recommendationIndex = recommendations.findIndex((item) => item.id === destination.id);
      trackEvent('destination_added', {
        destinationId: destination.id,
        metadata: {
          source: recommendationIndex >= 0 ? 'recommended' : 'manual',
          rank: recommendationIndex >= 0 ? recommendationIndex + 1 : undefined,
          recommendationRequestId: lastRecommendationRequestId,
          modelVersion: lastRecommendationModelVersion,
        },
      });
    }
  };

  const handleRemoveFromItinerary = (destinationId: string) => {
    const removed = itinerary.find((item) => item.id === destinationId);
    setItinerary(itinerary.filter(item => item.id !== destinationId));
    if (removed) {
      trackEvent('destination_removed', {
        destinationId: removed.id,
        metadata: {
          recommendationRequestId: lastRecommendationRequestId,
          modelVersion: lastRecommendationModelVersion,
        },
      });
    }
  };

  const handleItinerarySaved = (savedItinerary: SavedItinerary) => {
    trackEvent('itinerary_saved', {
      itineraryId: savedItinerary.id,
      metadata: {
        destinationCount: savedItinerary.destinations.length,
        totalCost: savedItinerary.totalCost,
        totalDuration: savedItinerary.totalDuration,
        recommendationRequestId: lastRecommendationRequestId,
        modelVersion: lastRecommendationModelVersion,
      },
    });
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
    trackEvent('saved_itinerary_viewed', {
      itineraryId: savedItinerary.id,
      metadata: {
        destinationCount: savedItinerary.destinations.length,
        totalCost: savedItinerary.totalCost,
        tripDays: savedItinerary.tripDays,
      },
    });
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

  const handleStartPlanning = () => {
    if (!isAuthenticated) {
      setShowAuthPrompt(true);
      return;
    }
    setCurrentView('preferences');
  };

  const handleLogoutAttempt = () => {
    setLogoutStep('confirm');
    setIsLogoutDialogOpen(true);
  };

  const handleLogoutConfirmed = () => {
    clearAuthSession();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setPreferences(null);
    setRecommendations([]);
    setItinerary([]);
    setViewingSavedItinerary(null);
    setIsMobileNavOpen(false);
    setLogoutStep('thanks');
    setCurrentView('welcome');
  };

  const handleLogoutThanksClose = () => {
    setIsLogoutDialogOpen(false);
    setLogoutStep('confirm');
  };

  const desktopActionButtonClass = 'h-9 px-3';
  const mobileActionButtonClass = 'w-full justify-start h-10';
  const handleMobileNavigate = (view: AppView) => {
    setCurrentView(view);
    setIsMobileNavOpen(false);
  };
  const renderHeaderActions = (mobile: boolean) => (
    <>
      {isAuthenticated && (
        <>
          {!mobile && (
            <div className="hidden items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 sm:flex">
              {currentUser?.name || currentUser?.email || 'Signed in'}
            </div>
          )}
          <Button
            variant="outline"
            className={mobile ? mobileActionButtonClass : desktopActionButtonClass}
            onClick={handleLogoutAttempt}
          >
            Log out
          </Button>
        </>
      )}
      {currentView === 'welcome' && (
        <>
          {!isAuthenticated && (
            <>
              <Button
                className={`${mobile ? mobileActionButtonClass : desktopActionButtonClass} bg-emerald-600 text-white hover:bg-emerald-700`}
                onClick={() => {
                  if (mobile) {
                    handleMobileNavigate('user-signup');
                    return;
                  }
                  setCurrentView('user-signup');
                }}
              >
                Sign Up
              </Button>
              <Button
                variant="outline"
                className={mobile ? mobileActionButtonClass : desktopActionButtonClass}
                onClick={() => {
                  if (mobile) {
                    handleMobileNavigate('user-login');
                    return;
                  }
                  setCurrentView('user-login');
                }}
              >
                Sign In
              </Button>
            </>
          )}
          <Button
            variant="outline"
            className={mobile ? mobileActionButtonClass : desktopActionButtonClass}
            disabled={!isAuthenticated}
            title={!isAuthenticated ? 'Sign in or sign up to view your itineraries.' : undefined}
            onClick={() => {
              if (mobile) {
                handleMobileNavigate('saved-itineraries');
                return;
              }
              setCurrentView('saved-itineraries');
            }}
          >
            <BookOpen className="w-4 h-4 mr-2" />
            View My Itineraries
          </Button>
        </>
      )}
      {currentView === 'itinerary' && (
        <Button
          variant="outline"
          className={mobile ? mobileActionButtonClass : desktopActionButtonClass}
          disabled={!isAuthenticated}
          title={!isAuthenticated ? 'Sign in or sign up to view your itineraries.' : undefined}
          onClick={() => {
            if (mobile) {
              handleMobileNavigate('saved-itineraries');
              return;
            }
            setCurrentView('saved-itineraries');
          }}
        >
          <BookOpen className="w-4 h-4 mr-2" />
          View My Itineraries
        </Button>
      )}
      {currentView === 'edit-saved' && (
        <Button
          variant="outline"
          className={mobile ? mobileActionButtonClass : desktopActionButtonClass}
          disabled={!isAuthenticated}
          title={!isAuthenticated ? 'Sign in or sign up to view your itineraries.' : undefined}
          onClick={() => {
            if (mobile) {
              handleMobileNavigate('saved-itineraries');
              return;
            }
            setCurrentView('saved-itineraries');
          }}
        >
          <BookOpen className="w-4 h-4 mr-2" />
          Back to My Itineraries
        </Button>
      )}
      {currentView === 'user-login' && (
        <Button
          variant="outline"
          className={mobile ? mobileActionButtonClass : desktopActionButtonClass}
          onClick={() => {
            if (mobile) {
              handleMobileNavigate('welcome');
              return;
            }
            setCurrentView('welcome');
          }}
        >
          Back to Home
        </Button>
      )}
      {currentView === 'user-signup' && (
        <Button
          variant="outline"
          className={mobile ? mobileActionButtonClass : desktopActionButtonClass}
          onClick={() => {
            if (mobile) {
              handleMobileNavigate('welcome');
              return;
            }
            setCurrentView('welcome');
          }}
        >
          Back to Home
        </Button>
      )}
    </>
  );

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-50">
      <div
        className="absolute inset-0 bg-cover bg-center blur-0-px scale-105"
        style={{ backgroundImage: `url(${backgroundImage})` }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-white/30" aria-hidden="true" />
      <div className="relative z-10">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-start justify-between sm:items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Bulusan Wanderer</h1>
                <p className="text-sm text-gray-600">Personalized Itinerary Planner</p>
              </div>
            </div>
            <div className="hidden sm:flex flex-wrap items-center gap-2 sm:justify-end">
              {renderHeaderActions(false)}
            </div>
            <div className="sm:hidden">
              <Button
                variant="outline"
                size="icon"
                aria-label="Open navigation menu"
                onClick={() => setIsMobileNavOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {isMobileNavOpen && (
        <div className="fixed inset-0 z-50 sm:hidden" aria-label="Mobile navigation drawer">
          <button
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsMobileNavOpen(false)}
            aria-label="Close navigation menu"
          />
          <aside className="absolute right-0 top-0 h-full w-[85%] max-w-xs bg-white shadow-xl border-l p-4">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-slate-900">Navigation</h2>
              <p className="text-xs text-slate-600 mt-1">Quick actions and account navigation.</p>
            </div>
            <div className="space-y-2">
              {isAuthenticated && (
                <div className="rounded-md bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                  {currentUser?.name || currentUser?.email || 'Signed in'}
                </div>
              )}
              {renderHeaderActions(true)}
            </div>
          </aside>
        </div>
      )}

      <Dialog
        open={isLogoutDialogOpen}
        onOpenChange={(nextOpen) => {
          if (logoutStep === 'confirm') {
            setIsLogoutDialogOpen(nextOpen);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          {logoutStep === 'confirm' ? (
            <>
              <DialogHeader>
                <DialogTitle>Log out</DialogTitle>
                <DialogDescription>
                  Are you sure you want to log out?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsLogoutDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleLogoutConfirmed}>
                  Yes, log out
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Thank you!</DialogTitle>
                <DialogDescription>
                  We hope you had a great experience planning your trip with Bulusan Wanderer. See you again soon!
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={handleLogoutThanksClose}>
                  OK
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'welcome' && (
          <div className="text-center space-y-6 sm:space-y-8 py-8 sm:py-12">
            <div className="space-y-3 sm:space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full">
                <Sparkles className="w-5 h-5" />
                <span className="font-medium">AI-Powered Recommendations</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 sm:text-5xl">
                Discover Bulusan, Sorsogon
              </h2>
              <p className="text-sm text-black-600 font-medium max-w-3xl mx-auto sm:text-xl">
                Let our AI recommendation engine generate a personalized travel itinerary
                based on your preferences, interests, and travel style. Experience the best of
                Bulusan&apos;s natural wonders, cultural heritage, and adventure destinations.
              </p>
            </div>

            {/* Hero Image Grid */}
            {destinationsStatus === 'error' && (
              <div className="max-w-4xl mx-auto rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                We couldn't load destinations from the server. Please try again in a moment.
              </div>
            )}

            {showHeroGrid ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
                {heroDestinations.map((destination, index) => (
                  <div key={destination.id ?? `${destination.name}-${index}`} className="relative h-64 rounded-lg overflow-hidden shadow-lg">
                    <img
                      src={destination.image}
                      alt={destination.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                      <p className="text-white font-semibold">{destination.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="max-w-5xl mx-auto">
                <div className="rounded-lg border border-dashed border-gray-300 bg-white/70 px-6 py-10 text-center text-gray-600">
                  {destinationsStatus === 'loading'
                    ? 'Loading destinations...'
                    : 'Destinations will appear here once the admin adds them to the database.'}
                </div>
              </div>
            )}

            {/* Features */}
            <div className={isMobile ? "flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 text-left" : "grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto text-left"}>
              <div className="min-w-[85%] snap-start bg-white p-6 rounded-lg shadow-md sm:min-w-0">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-lg mb-2">AI Recommendation Engine</h3>
                <p className="text-gray-600 text-sm">
                  Our backend AI service scores destinations using your trip preferences and profile signals
                </p>
              </div>
              <div className="min-w-[85%] snap-start bg-white p-6 rounded-lg shadow-md sm:min-w-0">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <MapPin className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Route and Budget Aware</h3>
                <p className="text-gray-600 text-sm">
                  Recommendations are tailored to your available time and spending preferences
                </p>
              </div>
              <div className="min-w-[85%] snap-start bg-white p-6 rounded-lg shadow-md sm:min-w-0">
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
              className="w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6"
              onClick={handleStartPlanning}
            >
              Start Planning Your Trip!
            </Button>
            <div className="flex flex-col items-stretch sm:items-center gap-2 sm:gap-3 text-sm text-slate-900">
              <div className="inline-flex items-center justify-between gap-2 rounded-full bg-white/90 px-4 py-2 sm:py-1 shadow-sm ring-1 ring-slate-200 backdrop-blur">
                <span className="font-medium">Already have an account?</span>
                <button
                  className="font-semibold text-slate-900 transition hover:text-slate-700"
                  onClick={() => setCurrentView('user-login')}
                >
                  Log in here.
                </button>
              </div>
              <div className="inline-flex items-center justify-between gap-2 rounded-full bg-white/90 px-4 py-2 sm:py-1 shadow-sm ring-1 ring-slate-200 backdrop-blur">
                <span className="font-medium">New to Bulusan Wanderer?</span>
                <button
                  className="font-semibold text-slate-900 transition hover:text-slate-700"
                  onClick={() => setCurrentView('user-signup')}
                >
                  Create your account.
                </button>
              </div>
            </div>

            {showAuthPrompt && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
                <div className="w-full max-w-md rounded-2xl bg-white p-6 text-left shadow-xl">
                  <h3 className="text-lg font-semibold text-slate-900">Sign in required</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    To start planning your trip, please sign in if you already have an account, or create a new one.
                  </p>
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAuthPrompt(false);
                        setCurrentView('user-login');
                      }}
                    >
                      Sign In
                    </Button>
                    <Button
                      className="bg-emerald-700 text-white hover:bg-emerald-800"
                      onClick={() => {
                        setShowAuthPrompt(false);
                        setCurrentView('user-signup');
                      }}
                    >
                      Create Account
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setShowAuthPrompt(false)}
                    >
                      Not now
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {currentView === 'user-login' && (
          <div className="py-8">
            <UserLogin
              onLogin={(session) => {
                const hasToken = Boolean(session.token);
                setIsAuthenticated(hasToken);
                setCurrentUser(hasToken ? (session.user ?? null) : null);
                setCurrentView('welcome');
              }}
              onBack={() => setCurrentView('welcome')}
            />
          </div>
        )}

        {currentView === 'user-signup' && (
          <div className="py-8">
            <UserSignup
              onSignup={(session) => {
                const hasToken = Boolean(session.token);
                setIsAuthenticated(hasToken);
                setCurrentUser(hasToken ? (session.user ?? null) : null);
                setCurrentView('welcome');
              }}
              onBack={() => setCurrentView('welcome')}
            />
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
            allDestinations={allDestinations}
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
            userInterests={preferences.interests}
            onRemoveDestination={handleRemoveFromItinerary}
            onReset={handleReset}
            onSaveSuccess={handleItinerarySaved}
            allDestinations={allDestinations}
            onAddDestination={handleAddToItinerary}
          />
        )}

        {currentView === 'saved-itineraries' && (
          <SavedItinerariesView
            onViewItinerary={handleViewSavedItinerary}
            onBackToWelcome={handleBackToWelcome}
            onDeleteItinerarySuccess={(itineraryId) => {
              trackEvent('saved_itinerary_deleted', { itineraryId });
            }}
          />
        )}

        {currentView === 'edit-saved' && viewingSavedItinerary && (
          <EditableItineraryView
            savedItinerary={viewingSavedItinerary}
            allDestinations={allDestinations}
            onBack={() => setCurrentView('saved-itineraries')}
            onSaveChangesSuccess={(savedItinerary) => {
              trackEvent('saved_itinerary_updated', {
                itineraryId: savedItinerary.id,
                metadata: {
                  destinationCount: savedItinerary.destinations.length,
                  totalCost: savedItinerary.totalCost,
                },
              });
            }}
            onDeleteSuccess={(itineraryId) => {
              trackEvent('saved_itinerary_deleted', { itineraryId });
            }}
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
            <p>© 2026 Bulusan Wanderer. Personalized itinerary planning powered by backend AI recommendations.</p>
            <p className="mt-2">Built for adaptive, data-driven travel planning in Bulusan, Sorsogon.</p>
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
}


