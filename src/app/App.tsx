import { useEffect, useState } from 'react';
import { Destination, UserPreferences } from '@/app/types/destination';
import { SavedItinerary } from '@/app/types/saved-itinerary';
import { fetchDestinations } from '@/app/api/destinations';
import { fetchServerRecommendations } from '@/app/api/recommendations';
import type { RecommendationBudgetSummary } from '@/app/api/recommendations';
import { fetchItineraries } from '@/app/api/itineraries';
import { clearDestinationRating, fetchMyDestinationRatings, upsertDestinationRating } from '@/app/api/ratings';
import { AUTH_CHANGE_EVENT, clearAuthSession, getAuthToken, getAuthUser } from '@/app/api/client';
import { type AuthUser } from '@/app/api/auth';
import { buildFeedbackEvent, flushFeedbackQueue, recordFeedbackEvent } from '@/app/api/feedback';
import { useIsMobile } from '@/app/components/ui/use-mobile';
import { calculateContentScore } from '@/app/utils/recommendation';
import { GeoPoint } from '@/app/utils/travel';
import { PreferenceForm } from '@/app/components/PreferenceForm';
import { UserLogin } from '@/app/components/UserLogin';
import { UserSignup } from '@/app/components/UserSignup';
import { RecommendationsView } from '@/app/components/RecommendationsView';
import { ItineraryView } from '@/app/components/ItineraryView';
import { SavedItinerariesView } from '@/app/components/SavedItinerariesView';
import { EditableItineraryView } from '@/app/components/EditableItineraryView';
import { AllDestinationsView } from '@/app/components/AllDestinationsView';
import { CollaborationNotifications } from '@/app/components/CollaborationNotifications';
import { Button } from '@/app/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { MapPin, Sparkles, BookOpen, LocateFixed } from 'lucide-react';
import backgroundImage from '@/assets/bulusan-lake.jpg';

type AppView =
  | 'welcome'
  | 'user-login'
  | 'user-signup'
  | 'preferences'
  | 'itinerary'
  | 'saved-itineraries'
  | 'edit-saved'
  | 'all-destinations'
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
  const [lastRecommendationAlgorithm, setLastRecommendationAlgorithm] = useState<string | null>(null);
  const [lastRecommendationBudget, setLastRecommendationBudget] = useState<RecommendationBudgetSummary | null>(null);
  const [destinationRatings, setDestinationRatings] = useState<Record<string, number>>({});
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [logoutStep, setLogoutStep] = useState<'confirm' | 'thanks'>('confirm');
  const [userLocation, setUserLocation] = useState<GeoPoint | null>(null);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [locationStatus, setLocationStatus] = useState<
    'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable' | 'error'
  >('idle');
  const showHeroGrid = allDestinations.length > 0;
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
    const syncAuthFromStorage = () => {
      const token = getAuthToken();
      const user = getAuthUser<AuthUser>();
      if (!token) {
        setIsAuthenticated(false);
        setCurrentUser(null);
        return;
      }
      setIsAuthenticated(true);
      setCurrentUser(user ?? null);
    };

    window.addEventListener(AUTH_CHANGE_EVENT, syncAuthFromStorage);
    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, syncAuthFromStorage);
    };
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

  useEffect(() => {
    if (allDestinations.length === 0) {
      setActiveHeroIndex(0);
      return;
    }

    setActiveHeroIndex((prev) => prev % allDestinations.length);
    const timer = window.setInterval(() => {
      setActiveHeroIndex((prev) => (prev + 1) % allDestinations.length);
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [allDestinations.length]);

  useEffect(() => {
    let active = true;
    setDestinationRatings({});
    if (!isAuthenticated) {
      return () => {
        active = false;
      };
    }

    void fetchMyDestinationRatings()
      .then((serverRatings) => {
        if (!active) return;
        setDestinationRatings(serverRatings);
      })
      .catch((error) => {
        if (!active) return;
        console.error('Failed to load destination ratings from server:', error);
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated]);

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
    const uniqueRecommended: Destination[] = [];
    const seenIds = new Set<string>();
    recommended.forEach((destination) => {
      if (seenIds.has(destination.id)) return;
      seenIds.add(destination.id);
      uniqueRecommended.push(destination);
    });

    setRecommendations(uniqueRecommended);
    // Keep itinerary strict: do not inject non-matching destinations via client-side backfill.
    setItinerary(uniqueRecommended);
    if (serverScores && serverScores.size > 0) {
      setRecommendationScores(normalizeScores(serverScores));
    } else {
      setRecommendationScores(calculateDisplayScores(uniqueRecommended, prefs));
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
          `No destinations fit your total budget of ₱${Math.round(prefs.budget)} for ${prefs.duration} day(s). ` +
          'Try increasing your budget or changing your interests.'
        );
      }
      throw new Error('No destinations matched your current preferences. Try selecting different interests.');
    }

    const hasBudgetConstraint = Number.isFinite(prefs.budget) && prefs.budget > 0;
    const itineraryTotalCost = serverResult.destinations.reduce(
      (sum, destination) => sum + Number(destination.estimatedCost || 0),
      0
    );
    const selectedCost =
      serverResult.metadata.budget?.totalSelectedCost ?? itineraryTotalCost;
    if (hasBudgetConstraint && Number.isFinite(selectedCost) && selectedCost > prefs.budget) {
      const overBy = Math.max(0, selectedCost - prefs.budget);
      throw new Error(
        `Your total budget of ₱${Math.round(prefs.budget)} is not enough for ${prefs.duration} day(s). ` +
        `Current itinerary estimate is ₱${Math.round(selectedCost)} (over by ₱${Math.round(overBy)}). ` +
        'Please increase your budget or reduce your trip days.'
      );
    }

    setLastRecommendationRequestId(serverResult.metadata.recommendationRequestId ?? null);
    setLastRecommendationModelVersion(serverResult.metadata.modelVersion ?? null);
    setLastRecommendationAlgorithm(serverResult.metadata.algorithmUsed ?? null);
    setLastRecommendationBudget(serverResult.metadata.budget ?? null);
    applyRecommendations(serverResult.destinations, prefs, serverResult.scores);

    trackEvent('recommendation_requested', {
      metadata: {
        recommendationRequestId: serverResult.metadata.recommendationRequestId,
        modelVersion: serverResult.metadata.modelVersion,
        algorithmUsed: serverResult.metadata.algorithmUsed,
        budgetSummary: serverResult.metadata.budget,
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

  const handleRateDestination = (destination: Destination, rating: number) => {
    if (!isAuthenticated) return;

    const refreshDestinationAggregatesFromServer = () => {
      void fetchDestinations()
        .then((freshDestinations) => {
          setAllDestinations(freshDestinations);
          const byId = new Map(freshDestinations.map((item) => [item.id, item]));
          const apply = (item: Destination): Destination => {
            const fresh = byId.get(item.id);
            return fresh
              ? {
                  ...item,
                  rating: fresh.rating,
                  reviewCount: fresh.reviewCount,
                }
              : item;
          };
          setRecommendations((prev) => prev.map(apply));
          setItinerary((prev) => prev.map(apply));
        })
        .catch((error) => {
          console.error('Failed to refresh destination aggregates:', error);
        });
    };

    const applyDestinationAggregate = (
      destinationId: string,
      aggregateRating?: number,
      aggregateReviewCount?: number
    ) => {
      if (aggregateRating === undefined && aggregateReviewCount === undefined) {
        refreshDestinationAggregatesFromServer();
        return;
      }
      const apply = (item: Destination): Destination =>
        item.id === destinationId
          ? {
              ...item,
              rating: aggregateRating ?? item.rating,
              reviewCount: aggregateReviewCount ?? item.reviewCount,
            }
          : item;

      setAllDestinations((prev) => prev.map(apply));
      setRecommendations((prev) => prev.map(apply));
      setItinerary((prev) => prev.map(apply));
    };

    const previousRating = destinationRatings[destination.id] ?? 0;
    const requestedRating = Math.max(1, Math.min(5, Math.round(rating)));
    const nextRating = previousRating === requestedRating ? 0 : requestedRating;

    trackEvent('destination_rated', {
      destinationId: destination.id,
      metadata: {
        rating: nextRating,
        cleared: nextRating === 0,
        previousRating,
        recommendationRequestId: lastRecommendationRequestId,
        modelVersion: lastRecommendationModelVersion,
      },
    });

    if (nextRating > 0) {
      void upsertDestinationRating(destination.id, nextRating)
        .then((result) => {
          setDestinationRatings((prev) => ({
            ...prev,
            [result.destinationId]: result.rating,
          }));
          applyDestinationAggregate(result.destinationId, result.aggregateRating, result.reviewCount);
          refreshDestinationAggregatesFromServer();
        })
        .catch((error) => {
          console.error('Failed to sync destination rating:', error);
        });
      return;
    }

    void clearDestinationRating(destination.id)
      .then((result) => {
        setDestinationRatings((prev) => ({
          ...prev,
          [result.destinationId]: 0,
        }));
        applyDestinationAggregate(result.destinationId, result.rating, result.reviewCount);
        refreshDestinationAggregatesFromServer();
      })
      .catch((error) => {
        console.error('Failed to clear destination rating:', error);
      });
  };

  const handleReset = () => {
    setCurrentView('preferences');
    setItinerary([]);
    setRecommendations([]);
    setPreferences(null);
    setViewingSavedItinerary(null);
    setLastRecommendationRequestId(null);
    setLastRecommendationModelVersion(null);
    setLastRecommendationAlgorithm(null);
    setLastRecommendationBudget(null);
  };

  const handleViewItinerary = () => {
    setCurrentView('itinerary');
  };

  const handleBackToRecommendations = () => {
    setCurrentView('recommendations');
  };

  const hydrateSavedItineraryState = (savedItinerary: SavedItinerary) => {
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
    setLastRecommendationRequestId(null);
    setLastRecommendationModelVersion(null);
    setLastRecommendationAlgorithm(null);
    setLastRecommendationBudget(null);
    setPreferences({ 
      duration: savedItinerary.tripDays,
      budget: savedItinerary.totalCost,
      activityLevel: 'moderate' as const,
      interests: [],
      travelStyle: []
    });
  };

  const handleViewSavedItinerary = (savedItinerary: SavedItinerary) => {
    hydrateSavedItineraryState(savedItinerary);
    setCurrentView('itinerary');
  };

  const handleEditSavedItinerary = (savedItinerary: SavedItinerary) => {
    hydrateSavedItineraryState(savedItinerary);
    setCurrentView('edit-saved');
  };

  const handleBackToWelcome = () => {
    setCurrentView('welcome');
    setViewingSavedItinerary(null);
  };

  const handleOpenCollaborativeItinerary = async (itineraryId: string) => {
    try {
      const all = await fetchItineraries();
      const found = all.find((item) => item.id === itineraryId);
      if (found) {
        hydrateSavedItineraryState(found);
        setCurrentView('edit-saved');
        return;
      }
      setCurrentView('saved-itineraries');
    } catch {
      setCurrentView('saved-itineraries');
    }
  };

  const handleAllowLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('unavailable');
      setUserLocation(null);
      return;
    }

    setLocationStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationStatus('granted');
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocationStatus('denied');
          setUserLocation(null);
          return;
        }
        setLocationStatus('error');
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 300_000,
      }
    );
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

  const mobileActionButtonClass =
    'group relative h-11 w-full justify-start overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-900 hover:shadow-md active:translate-y-0';
  const handleMobileNavigate = (view: AppView) => {
    setCurrentView(view);
    setIsMobileNavOpen(false);
  };
  const renderDrawerActions = () => (
    <>
      {isAuthenticated && (
        <div className="rounded-md bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
          {currentUser?.name || currentUser?.email || 'Signed in'}
        </div>
      )}
      {isMobile && (currentView === 'welcome' || currentView === 'all-destinations') && (
        <Button
          variant={locationStatus === 'granted' ? 'secondary' : 'outline'}
          className={mobileActionButtonClass}
          onClick={handleAllowLocation}
          disabled={locationStatus === 'requesting'}
          title={
            locationStatus === 'denied'
              ? 'Location denied. Allow location in browser settings and try again.'
              : locationStatus === 'unavailable'
                ? 'Location is not supported by this browser/device.'
                : undefined
          }
        >
          <LocateFixed className="mr-2 h-4 w-4" />
          <span>
            {locationStatus === 'requesting'
              ? 'Requesting...'
              : locationStatus === 'granted'
                ? 'Location On'
                : 'Allow Location'}
          </span>
        </Button>
      )}
      {isMobile && (
        <CollaborationNotifications
          isAuthenticated={isAuthenticated}
          onOpenItinerary={handleOpenCollaborativeItinerary}
          showLabel
          buttonClassName={mobileActionButtonClass}
        />
      )}

      {isAuthenticated ? (
        <>
          <Button
            variant="outline"
            className={mobileActionButtonClass}
            onClick={() => handleMobileNavigate('all-destinations')}
          >
            <MapPin className="mr-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            <span className="transition-transform duration-300 group-hover:translate-x-0.5">View All Destination</span>
          </Button>
          <Button
            variant="outline"
            className={mobileActionButtonClass}
            onClick={() => handleMobileNavigate('saved-itineraries')}
          >
            <BookOpen className="mr-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            <span className="transition-transform duration-300 group-hover:translate-x-0.5">View My Itineraries</span>
          </Button>
          <Button
            variant="outline"
            className={`${mobileActionButtonClass} text-red-600 hover:!border-red-300 hover:!bg-red-50 hover:!text-red-700`}
            onClick={handleLogoutAttempt}
          >
            Log out
          </Button>
        </>
      ) : (
        <>
          <Button
            className={`${mobileActionButtonClass} bg-emerald-600 text-white hover:bg-emerald-700`}
            onClick={() => handleMobileNavigate('user-signup')}
          >
            Sign Up
          </Button>
          <Button
            variant="outline"
            className={mobileActionButtonClass}
            onClick={() => handleMobileNavigate('user-login')}
          >
            Sign In
          </Button>
          <Button
            variant="outline"
            className={mobileActionButtonClass}
            onClick={() => handleMobileNavigate('all-destinations')}
          >
            <MapPin className="mr-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            <span className="transition-transform duration-300 group-hover:translate-x-0.5">View All Destination</span>
          </Button>
        </>
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
          <div className="flex items-center justify-between gap-3 sm:gap-4">
            <button
              type="button"
              onClick={handleBackToWelcome}
              className="flex min-w-0 items-center gap-3 text-left"
              aria-label="Go to homepage"
            >
              <div className="h-10 w-10 shrink-0 rounded-lg bg-blue-500 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold leading-tight text-gray-900 sm:text-2xl">Bulusan Wanderer</h1>
                <p className="truncate text-xs leading-tight text-gray-600 sm:text-sm">Personalized Itinerary Planner</p>
              </div>
            </button>
            <div className="flex shrink-0 items-center gap-2">
              {!isMobile && (currentView === 'welcome' || currentView === 'all-destinations') && (
                <Button
                  variant={locationStatus === 'granted' ? 'secondary' : 'outline'}
                  className="h-9 px-3"
                  onClick={handleAllowLocation}
                  disabled={locationStatus === 'requesting'}
                  title={
                    locationStatus === 'denied'
                      ? 'Location denied. Allow location in browser settings and try again.'
                      : locationStatus === 'unavailable'
                        ? 'Location is not supported by this browser/device.'
                        : undefined
                  }
                >
                  <LocateFixed className="mr-2 h-4 w-4" />
                  <span className="text-sm">
                    {locationStatus === 'requesting'
                      ? 'Requesting...'
                      : locationStatus === 'granted'
                        ? 'Location On'
                        : 'Allow Location'}
                  </span>
                </Button>
              )}
              {!isMobile && (
                <CollaborationNotifications
                  isAuthenticated={isAuthenticated}
                  onOpenItinerary={handleOpenCollaborativeItinerary}
                />
              )}
              <Button
                variant="outline"
                aria-label="Open navigation menu"
                className={
                  isMobile
                    ? 'h-10 w-10 rounded-full border border-slate-300 bg-slate-100 px-0 text-slate-700 shadow-[0_2px_6px_rgba(15,23,42,0.12)] transition-colors hover:bg-slate-50 hover:text-slate-900'
                    : 'group h-10 w-10 overflow-hidden rounded-full border border-slate-300 bg-slate-100 px-0 text-slate-700 shadow-[0_2px_6px_rgba(15,23,42,0.12)] transition-all duration-300 ease-out hover:w-24 hover:px-3 hover:bg-slate-50 hover:text-slate-900'
                }
                onClick={() => setIsMobileNavOpen(true)}
              >
                <span
                  aria-hidden="true"
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-base leading-none text-slate-700"
                >
                  ≡
                </span>
                {!isMobile && (
                  <span className="ml-2 whitespace-nowrap text-xs font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    Menu
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {isMobileNavOpen && (
        <div className="fixed inset-0 z-50" aria-label="Navigation drawer">
          <button
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsMobileNavOpen(false)}
            aria-label="Close navigation menu"
          />
          <aside className="absolute right-0 top-0 h-full w-[85%] max-w-sm bg-white shadow-xl border-l p-4">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-slate-900">Navigation</h2>
              <p className="text-xs text-slate-600 mt-1">Quick actions and account navigation.</p>
            </div>
            <div className="space-y-2">
              {renderDrawerActions()}
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
              <div className="max-w-5xl mx-auto">
                <>
                  {(() => {
                    const total = allDestinations.length;
                    if (total === 1) {
                      const destination = allDestinations[0];
                      return (
                        <div className="mx-auto max-w-[720px]">
                          <div className="relative h-56 overflow-hidden rounded-2xl border border-white/60 bg-black shadow-xl sm:h-64">
                            <img src={destination.image} alt={destination.name} className="h-full w-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                            <div className="absolute inset-x-0 bottom-0 p-4">
                              <p className="text-lg font-semibold text-white sm:text-xl">{destination.name}</p>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const leftIndex = (activeHeroIndex - 1 + total) % total;
                    const centerIndex = activeHeroIndex % total;
                    const rightIndex = (activeHeroIndex + 1) % total;
                    const slots = [leftIndex, centerIndex, rightIndex];

                    return (
                      <div className="overflow-hidden pb-2">
                        <div className="flex items-center justify-center gap-2 sm:gap-4">
                          {slots.map((destinationIndex, slotIndex) => {
                            const destination = allDestinations[destinationIndex];
                            const isCenter = slotIndex === 1;
                            return (
                              <div
                                key={`hero-slot-${slotIndex}-${destination.id ?? destination.name}`}
                                className={`relative overflow-hidden rounded-2xl border border-white/60 bg-black transition-all duration-700 ease-out ${
                                  isCenter
                                    ? 'h-56 w-[64vw] scale-100 opacity-100 shadow-2xl sm:h-64 sm:w-[380px]'
                                    : 'h-48 w-[48vw] scale-95 opacity-85 shadow-lg sm:h-56 sm:w-[320px]'
                                }`}
                              >
                                <img
                                  src={destination.image}
                                  alt={destination.name}
                                  className="h-full w-full object-cover transition-transform duration-700 ease-out"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                                  <p className={`text-white drop-shadow-sm ${isCenter ? 'text-base font-semibold sm:text-2xl' : 'text-sm font-medium sm:text-lg'}`}>
                                    {destination.name}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  <div className="mt-2 flex items-center justify-center gap-2">
                    {allDestinations.map((destination, index) => (
                      <button
                        key={`hero-dot-${destination.id ?? destination.name}-${index}`}
                        type="button"
                        onClick={() => setActiveHeroIndex(index)}
                        className={`h-2.5 rounded-full transition-all duration-300 ${
                          index === activeHeroIndex ? 'w-6 bg-slate-900' : 'w-2.5 bg-white/80'
                        }`}
                        aria-label={`Show destination ${index + 1}`}
                      />
                    ))}
                  </div>
                </>
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
              <div className="group min-w-[85%] snap-start rounded-lg border border-white/70 bg-white p-6 shadow-md transition-all duration-300 ease-out hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl sm:min-w-0">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 transition-transform duration-300 group-hover:scale-110">
                  <Sparkles className="h-6 w-6 text-blue-600 transition-transform duration-300 group-hover:rotate-6" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">AI Recommendation Engine</h3>
                <p className="text-sm text-gray-600">
                  Our backend AI service scores destinations using your trip preferences and profile signals
                </p>
              </div>
              <div className="group min-w-[85%] snap-start rounded-lg border border-white/70 bg-white p-6 shadow-md transition-all duration-300 ease-out hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl sm:min-w-0">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 transition-transform duration-300 group-hover:scale-110">
                  <MapPin className="h-6 w-6 text-green-600 transition-transform duration-300 group-hover:rotate-6" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">Route and Budget Aware</h3>
                <p className="text-sm text-gray-600">
                  Recommendations are tailored to your available time and spending preferences
                </p>
              </div>
              <div className="group min-w-[85%] snap-start rounded-lg border border-white/70 bg-white p-6 shadow-md transition-all duration-300 ease-out hover:-translate-y-1 hover:border-violet-200 hover:shadow-xl sm:min-w-0">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 transition-transform duration-300 group-hover:scale-110">
                  <Sparkles className="h-6 w-6 text-purple-600 transition-transform duration-300 group-hover:rotate-6" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">Smart Itinerary Scheduling</h3>
                <p className="text-sm text-gray-600">
                  Intelligent scheduling considers difficulty, duration, and optimal daily activity distribution
                </p>
              </div>
            </div>

            <Button 
              size="lg" 
              className="w-full px-6 py-5 text-base transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-xl sm:w-auto sm:px-8 sm:py-6 sm:text-lg"
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
            <PreferenceForm onSubmit={handlePreferencesSubmit} onLocationChange={setUserLocation} />
          </div>
        )}

        {currentView === 'recommendations' && preferences && (
          <RecommendationsView
            recommendations={recommendations}
            allDestinations={allDestinations}
            preferences={preferences}
            itinerary={itinerary}
            onAddToItinerary={handleAddToItinerary}
            onRateDestination={isAuthenticated ? handleRateDestination : undefined}
            onViewItinerary={handleViewItinerary}
            onRestart={handleReset}
            recommendationScores={recommendationScores}
            destinationRatings={destinationRatings}
            userLocation={userLocation}
          />
        )}

        {currentView === 'itinerary' && preferences && (
          <ItineraryView
            destinations={itinerary}
            tripDays={preferences.duration}
            userInterests={preferences.interests}
            interestRanks={preferences.interestRanks}
            recommendationAlgorithm={lastRecommendationAlgorithm}
            recommendationBudget={lastRecommendationBudget}
            onRemoveDestination={handleRemoveFromItinerary}
            onReset={handleReset}
            onViewSavedItineraries={() => setCurrentView('saved-itineraries')}
            onSaveSuccess={handleItinerarySaved}
            onRateDestination={isAuthenticated ? handleRateDestination : undefined}
            destinationRatings={destinationRatings}
            userLocation={userLocation}
          />
        )}

        {currentView === 'saved-itineraries' && (
          <SavedItinerariesView
            onViewItinerary={handleViewSavedItinerary}
            onEditItinerary={handleEditSavedItinerary}
            onBackToWelcome={handleBackToWelcome}
            onDeleteItinerarySuccess={(itineraryId) => {
              trackEvent('saved_itinerary_deleted', { itineraryId });
            }}
          />
        )}

        {currentView === 'all-destinations' && (
          <AllDestinationsView
            destinations={allDestinations}
            status={destinationsStatus}
            userLocation={userLocation}
            onRateDestination={isAuthenticated ? handleRateDestination : undefined}
            destinationRatings={destinationRatings}
            onBack={() => setCurrentView('welcome')}
          />
        )}

        {currentView === 'edit-saved' && viewingSavedItinerary && (
          <EditableItineraryView
            savedItinerary={viewingSavedItinerary}
            allDestinations={allDestinations}
            currentUserId={currentUser?.id}
            userLocation={userLocation}
            onRateDestination={isAuthenticated ? handleRateDestination : undefined}
            destinationRatings={destinationRatings}
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
              // Return to saved itineraries after updates to avoid empty edit state.
              setViewingSavedItinerary(null);
              setCurrentView('saved-itineraries');
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
