import { type ComponentType, useEffect, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Label } from '@/app/components/ui/label';
import { Input } from '@/app/components/ui/input';
import { UserPreferences } from '@/app/types/destination';
import { GeoPoint } from '@/app/utils/travel';
import { toUserFacingErrorMessage } from '@/app/utils/user-facing-error';
import { clearRecentLocationGrant, getRecentLocationGrant, setRecentLocationGrant } from '@/app/utils/location-access';
import { fetchInterestsSchema, InterestSchemaMainInterest } from '@/app/api/destinations';
import { Mountain, Waves, Heart, Compass, ChevronDown, ChevronUp, Sun, LucideBook, Ship, Camera, LocateFixed } from 'lucide-react';

interface PreferenceFormProps {
  onSubmit: (preferences: UserPreferences) => void | Promise<void>;
  onLocationChange?: (location: GeoPoint | null) => void;
}

// Fallback interest schema when backend schema is unavailable.
const fallbackInterestOptions: InterestSchemaMainInterest[] = [
  { 
    id: 'nature', 
    label: 'Nature', 
    subInterests: [
      { id: 'eco_tours', label: 'Eco-tours' },
      { id: 'wilderness_trekking', label: 'Wilderness trekking' },
      { id: 'volcanic_sites', label: 'Volcanic sites' },
      { id: 'caves_and_canyons', label: 'Caves and canyons' },
    ]
  },
  { 
    id: 'diving', 
    label: 'Diving and Marine Sports', 
    subInterests: [
      { id: 'scuba_diving', label: 'Scuba diving' },
      { id: 'snorkeling', label: 'Snorkeling' },
      { id: 'wreck_diving', label: 'Wreck diving' },
      { id: 'freediving', label: 'Freediving' },
    ]
  },
  { 
    id: 'sun_beach', 
    label: 'Sun and Beach', 
    subInterests: [
      { id: 'island_hopping', label: 'Island hopping' },
      { id: 'beach_resorts', label: 'Beach resorts' },
      { id: 'surfing_skimboarding', label: 'Surfing and skimboarding' },
      { id: 'coastal_relaxation', label: 'Coastal relaxation' },
    ]
  },
  { 
    id: 'health_wellness', 
    label: 'Health and Wellness', 
    subInterests: [
      { id: 'spa_retreats', label: 'Spa and retreats' },
      { id: 'medical_tourism', label: 'Medical tourism' },
      { id: 'retirement_villages', label: 'Retirement villages' },
      { id: 'beauty_wellness_services', label: 'Beauty and wellness services' },
    ]
  },
  { 
    id: 'events', 
    label: 'MICE and Events', 
    subInterests: [
      { id: 'corporate_meetings', label: 'Corporate meetings' },
      { id: 'incentives_team_building', label: 'Incentives & Team Building' },
      { id: 'exhibitions', label: 'Exhibitions' },
      { id: 'conventions', label: 'Conventions' },
    ]
  },
  { 
    id: 'culture_heritage', 
    label: 'Culture and Heritage', 
    subInterests: [
      { id: 'heritage_tours', label: 'Heritage Tours' },
      { id: 'food_tourism', label: 'Food tourism' },
      { id: 'culinary_tourism', label: 'Culinary Tourism' },
      { id: 'festivals_events', label: 'Festivals & events' },
    ]
  },
  { 
    id: 'education', 
    label: 'Education', 
    subInterests: [
      { id: 'study_tours', label: 'Study tours' },
      { id: 'historical_site_learning', label: 'Historical site learning' },
      { id: 'culinary_schools', label: 'Culinary schools' },
      { id: 'language_immersion', label: 'Language immersion' },
    ]
  },
  {
    id: 'cruise',
    label: 'Cruise and Nautical Tourism',
    subInterests: [
      { id: 'luxury_cruises', label: 'Luxury cruises' },
      { id: 'yachting_sailing', label: 'Yachting and sailing' },
      { id: 'ferry_travel', label: 'Ferry travel' },
      { id: 'water_taxis', label: 'Water taxis' },
    ]
  },
  {
    id: 'leisure',
    label: 'Leisure and Entertainment',
    subInterests: [
      { id: 'theme_parks', label: 'Theme parks' },
      { id: 'casinos', label: 'Casinos' },
      { id: 'shopping_retail', label: 'Shopping and retail' },
      { id: 'nightlife_bars', label: 'Nightlife and bars' },
    ]
  }
];

const interestIcons: Record<string, ComponentType<{ className?: string }>> = {
  nature: Mountain,
  diving: Waves,
  sun_beach: Sun,
  health_wellness: Heart,
  events: Compass,
  culture_heritage: Camera,
  education: LucideBook,
  cruise: Ship,
  leisure: Heart,
};

export function PreferenceForm({ onSubmit, onLocationChange }: PreferenceFormProps) {
  const [interestOptionsWithSubs, setInterestOptionsWithSubs] = useState<InterestSchemaMainInterest[]>(fallbackInterestOptions);
  const [isUsingFallbackSchema, setIsUsingFallbackSchema] = useState<boolean>(true);
  const [planningMode, setPlanningMode] = useState<'preferences' | 'budget'>('preferences');
  const [interests, setInterests] = useState<string[]>([]);
  const [mainInterestOrder, setMainInterestOrder] = useState<string[]>([]);
  const [expandedInterests, setExpandedInterests] = useState<string[]>([]);
  const [activityLevel, setActivityLevel] = useState<'relaxed' | 'moderate' | 'active'>('moderate');
  const [budget, setBudget] = useState<string>('1000');
  const [duration, setDuration] = useState<string>('');
  const [showInterestError, setShowInterestError] = useState(false);
  const [showSubInterestError, setShowSubInterestError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [locationWarningOpen, setLocationWarningOpen] = useState(false);
  const [locationWarningMessage, setLocationWarningMessage] = useState('');
  const [locationStatus, setLocationStatus] = useState<
    'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable' | 'error'
  >('idle');
  const [locationMessage, setLocationMessage] = useState<string>('');
  // In Preferences mode, do not enforce a budget cap.
  // This keeps recommendations driven by interests/activity/time preference.
  const preferenceBudgetFallback = 0;

  const mainInterestIds = interestOptionsWithSubs.map((option) => option.id);
  const allSubInterestIds = interestOptionsWithSubs.flatMap((option) => option.subInterests.map((sub) => sub.id));
  const hasSelectedSubInterest = (mainInterestId: string, selectedInterests: string[]) => {
    const mainOption = interestOptionsWithSubs.find((opt) => opt.id === mainInterestId);
    if (!mainOption) return false;
    return mainOption.subInterests.some((sub) => selectedInterests.includes(sub.id));
  };

  const normalizeSchemaEntry = (entry: InterestSchemaMainInterest): InterestSchemaMainInterest | null => {
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    const label = typeof entry.label === 'string' ? entry.label.trim() : '';
    if (!id || !label) return null;

    const seenSubIds = new Set<string>();
    const subInterests = (Array.isArray(entry.subInterests) ? entry.subInterests : [])
      .map((sub) => {
        const subId = typeof sub.id === 'string' ? sub.id.trim() : '';
        const subLabel = typeof sub.label === 'string' ? sub.label.trim() : '';
        if (!subId || !subLabel) return null;
        if (seenSubIds.has(subId)) return null;
        seenSubIds.add(subId);
        return { id: subId, label: subLabel };
      })
      .filter((sub): sub is { id: string; label: string } => Boolean(sub));

    return {
      id,
      label,
      subInterests,
    };
  };

  useEffect(() => {
    let active = true;
    void fetchInterestsSchema()
      .then((schema) => {
        if (!active) return;
        const normalizedSchema = schema
          .map(normalizeSchemaEntry)
          .filter((entry): entry is InterestSchemaMainInterest => Boolean(entry));
        if (normalizedSchema.length === 0) {
          setIsUsingFallbackSchema(true);
          setInterestOptionsWithSubs(fallbackInterestOptions);
          return;
        }
        const hasSubInterests = normalizedSchema.some((entry) => (entry.subInterests ?? []).length > 0);
        if (!hasSubInterests) {
          console.warn('Interests schema returned without sub-interests. Using fallback schema.');
          setIsUsingFallbackSchema(true);
          setInterestOptionsWithSubs(fallbackInterestOptions);
          return;
        }
        setIsUsingFallbackSchema(false);
        setInterestOptionsWithSubs(normalizedSchema);
      })
      .catch((error) => {
        console.error('Failed to load interests schema, using fallback:', error);
        if (!active) return;
        setIsUsingFallbackSchema(true);
        setInterestOptionsWithSubs(fallbackInterestOptions);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    // Keep selected values aligned with the currently loaded schema.
    const allowedIds = new Set([...mainInterestIds, ...allSubInterestIds]);
    setInterests((prev) => prev.filter((id) => allowedIds.has(id)));
    setMainInterestOrder((prev) => prev.filter((id) => mainInterestIds.includes(id)));
    setExpandedInterests((prev) => prev.filter((id) => mainInterestIds.includes(id)));
  }, [mainInterestIds.join('|'), allSubInterestIds.join('|')]);

  useEffect(() => {
    const recentGrant = getRecentLocationGrant();
    if (!recentGrant) return;
    setLocationStatus('granted');
    setLocationMessage('Location already enabled recently. Using your saved location.');
    onLocationChange?.(recentGrant.location);
  }, [onLocationChange]);

  const toggleInterest = (interest: string) => {
    const isCurrentlySelected = interests.includes(interest);
    
    if (isCurrentlySelected) {
      // Remove main interest and all its sub-interests
      const interestOption = interestOptionsWithSubs.find(opt => opt.id === interest);
      const subInterestsToRemove = (interestOption?.subInterests ?? []).map((sub) => sub.id);
      setInterests(prev => prev.filter(i => i !== interest && !subInterestsToRemove.includes(i)));
      setMainInterestOrder(prev => prev.filter(id => id !== interest));
      setExpandedInterests(prev => prev.filter(i => i !== interest));
    } else {
      // Keep rank once main interest is picked.
      // Auto-close other dropdowns only if they have no selected sub-interests.
      const nextInterests = [...interests, interest];
      setInterests(nextInterests);
      setMainInterestOrder((prev) => {
        const kept = prev.filter((id) => hasSelectedSubInterest(id, nextInterests));
        return kept.includes(interest) ? kept : [...kept, interest];
      });
      setExpandedInterests((prev) => {
        const kept = prev.filter((id) => hasSelectedSubInterest(id, nextInterests));
        return kept.includes(interest) ? kept : [...kept, interest];
      });
      setShowInterestError(false);
      setShowSubInterestError(false);
    }
  };

  const toggleSubInterest = (mainInterest: string, subInterestId: string) => {
    setInterests(prev => {
      if (prev.includes(subInterestId)) {
        const nextInterests = prev.filter(i => i !== subInterestId);
        const mainOption = interestOptionsWithSubs.find((opt) => opt.id === mainInterest);
        const subIds = (mainOption?.subInterests ?? []).map((sub) => sub.id);
        const hasAnySelectedSub = subIds.some((id) => nextInterests.includes(id));
        if (!hasAnySelectedSub) {
          // Auto-close when no sub-interest is selected for this main interest.
          setExpandedInterests(expanded => expanded.filter(id => id !== mainInterest));
        }
        return nextInterests;
      } else {
        // Make sure main interest is also selected
        setMainInterestOrder(order => (order.includes(mainInterest) ? order : [...order, mainInterest]));
        if (!prev.includes(mainInterest)) {
          setShowInterestError(false);
          setShowSubInterestError(false);
          return [...prev, mainInterest, subInterestId];
        }
        setShowInterestError(false);
        setShowSubInterestError(false);
        return [...prev, subInterestId];
      }
    });
  };

  const toggleExpanded = (interest: string) => {
    setExpandedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (locationStatus !== 'granted') {
      if (locationStatus === 'unavailable') {
        setLocationWarningMessage('Location is not supported on this device/browser. Please use a browser that supports location services.');
      } else if (locationStatus === 'denied') {
        setLocationWarningMessage('Please allow location access before generating your itinerary.');
      } else {
        setLocationWarningMessage('Location access is required. Please tap "Allow Location" first.');
      }
      setLocationWarningOpen(true);
      return;
    }

    if (interests.length === 0) {
      setShowInterestError(true);
      return;
    }
    const selectedSubInterests = interests.filter((interestId) => allSubInterestIds.includes(interestId));
    if (selectedSubInterests.length === 0) {
      setShowSubInterestError(true);
      return;
    }

    setIsSubmitting(true);
    
    const budgetNum = planningMode === 'budget'
      ? (parseInt(budget) || 1000)
      : preferenceBudgetFallback;
    const durationNum = parseInt(duration, 10);
    if (!Number.isFinite(durationNum) || durationNum < 1 || durationNum > 30) {
      setSubmitError('Please enter a trip duration between 1 and 30 days.');
      setIsSubmitting(false);
      return;
    }

    try {
      const autoRankedMainInterests = mainInterestOrder
        .filter(
          (interestId) =>
            mainInterestIds.includes(interestId) &&
            interests.includes(interestId) &&
            hasSelectedSubInterest(interestId, interests)
        )
        .slice(0, 9);
      const selectedMainInterests = autoRankedMainInterests;

      const interestRanks = autoRankedMainInterests.reduce<Record<string, number>>((acc, interestId, index) => {
        acc[interestId] = index + 1;
        return acc;
      }, {});

      await onSubmit({
        interests: selectedSubInterests,
        mainInterests: selectedMainInterests,
        subInterests: selectedSubInterests,
        ...(Object.keys(interestRanks).length > 0 ? { interestRanks } : {}),
        activityLevel,
        timePreference: 'whole_day',
        budget: budgetNum,
        duration: durationNum,
      });
    } catch (error) {
      console.error('Failed to submit preferences:', error);
      setSubmitError(
        toUserFacingErrorMessage(error, {
          action: 'generate your itinerary',
          fallback: 'We could not generate your itinerary. Please try again.',
        })
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAllowLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('unavailable');
      setLocationMessage('Location is not supported on this device/browser.');
      onLocationChange?.(null);
      return;
    }

    const applyPosition = (position: GeolocationPosition) => {
      const nextLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      onLocationChange?.(nextLocation);
      setRecentLocationGrant(nextLocation);
      setLocationStatus('granted');
      setLocationMessage('Location access enabled. Travel times will use your current location.');
    };

    const handleTerminalLocationError = (error: GeolocationPositionError) => {
      if (error.code === error.PERMISSION_DENIED) {
        clearRecentLocationGrant();
        setLocationStatus('denied');
        setLocationMessage('Location access was denied. You can enable it and try again.');
        onLocationChange?.(null);
        return;
      }
      if (error.code === error.TIMEOUT) {
        setLocationStatus('error');
        setLocationMessage('Location request timed out. Move to an open area and try again.');
        onLocationChange?.(null);
        return;
      }
      if (error.code === error.POSITION_UNAVAILABLE) {
        setLocationStatus('error');
        setLocationMessage('Location is currently unavailable on this device. Please try again.');
        onLocationChange?.(null);
        return;
      }
      setLocationStatus('error');
      setLocationMessage('Could not get your location. Please try again.');
      onLocationChange?.(null);
    };

    const requestHighAccuracyRetry = () => {
      setLocationMessage('Coarse location failed. Retrying with GPS accuracy...');
      navigator.geolocation.getCurrentPosition(
        applyPosition,
        handleTerminalLocationError,
        {
          enableHighAccuracy: true,
          timeout: 30_000,
          maximumAge: 0,
        }
      );
    };

    setLocationStatus('requesting');
    setLocationMessage('Requesting location access...');
    navigator.geolocation.getCurrentPosition(
      applyPosition,
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          clearRecentLocationGrant();
          setLocationStatus('denied');
          setLocationMessage('Location access was denied. You can enable it and try again.');
          onLocationChange?.(null);
          return;
        }
        requestHighAccuracyRetry();
      },
      {
        enableHighAccuracy: false,
        timeout: 20_000,
        maximumAge: 600_000,
      }
    );
  };

  return (
    <Card className="p-4 sm:p-8 max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
        <div>
          <h2 className="text-xl sm:text-2xl mb-2">Tell us about your travel preferences</h2>
          <p className="text-gray-600">We'll create personalized itineraries just for you</p>
        </div>

        {/* Planning Mode */}
        <div className="space-y-4">
          <Label className="text-lg">Plan By</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPlanningMode('preferences')}
              className={`rounded-lg border-2 px-4 py-3 text-left transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md ${
                planningMode === 'preferences'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="text-sm font-semibold">Preferences</p>
              <p className="text-xs text-gray-600">
                We focus on your interests and activity level.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setPlanningMode('budget')}
              className={`rounded-lg border-2 px-4 py-3 text-left transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md ${
                planningMode === 'budget'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="text-sm font-semibold">Budget</p>
              <p className="text-xs text-gray-600">
                We prioritize activities within your budget.
              </p>
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <Label className="text-lg">Location Access</Label>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 transition-all duration-300 ease-out hover:border-slate-300 hover:shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm text-slate-700">
                  Allow location access for more accurate travel distance and time estimates.
                </p>
                {locationMessage && (
                  <p className="text-xs text-slate-600">{locationMessage}</p>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                className={
                  locationStatus === 'granted'
                    ? undefined
                    : 'border-red-500 text-red-600 hover:border-red-600 hover:bg-red-50 hover:text-red-700'
                }
                onClick={handleAllowLocation}
                disabled={locationStatus === 'requesting'}
              >
                <LocateFixed className="w-4 h-4 mr-2" />
                {locationStatus === 'requesting'
                  ? 'Requesting...'
                  : locationStatus === 'granted'
                    ? 'Refresh Location'
                    : 'Allow Location'}
              </Button>
            </div>
          </div>
        </div>
        
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          If you want to collaborate with other users, open <span className="font-semibold">Edit Itinerary</span> and use
          <span className="font-semibold"> Send Invite</span>.
        </div>
        {/* Interests with Sub-interests */}
        <div className="space-y-4">
          <Label className="text-lg">What interests you? (Select all that apply)</Label>
          {showInterestError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Please select at least one interest to continue.
            </p>
          )}
          {showSubInterestError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Please select at least one sub-interest to continue.
            </p>
          )}
          {submitError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError}
            </p>
          )}
          {isUsingFallbackSchema && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Using fallback interest taxonomy because backend schema is incomplete.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {interestOptionsWithSubs.map(option => {
              const Icon = interestIcons[option.id] ?? Heart;
              const isSelected = interests.includes(option.id);
              const isExpanded = expandedInterests.includes(option.id);
              const rankIndex = mainInterestOrder.findIndex((interestId) => interestId === option.id);
              const mainInterestRank = rankIndex >= 0 ? rankIndex + 1 : null;
              const isRanked = mainInterestRank !== null;
              
              return (
                <div key={option.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleInterest(option.id)}
                      className={`flex-1 flex items-center justify-between gap-3 rounded-lg border-2 p-4 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md ${
                        isRanked
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-6 h-6 ${isRanked ? 'text-blue-500' : 'text-gray-600'}`} />
                        <span className={`text-sm ${isRanked ? 'font-medium' : ''}`}>
                          {option.label}
                        </span>
                      </div>
                      {isSelected && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(option.id);
                          }}
                          className="cursor-pointer rounded p-1 transition-colors hover:bg-blue-100"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-blue-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-blue-500" />
                          )}
                        </div>
                      )}
                    </button>
                    {isSelected && mainInterestRank !== null && (
                      <div className="w-24 h-9 rounded-md bg-gray-100 text-gray-700 text-xs font-medium flex items-center justify-center">
                        {`Rank ${mainInterestRank}`}
                      </div>
                    )}
                  </div>
                  
                  {/* Sub-interests */}
                  {isSelected && (
                    <div
                      className={`ml-4 overflow-hidden border-l-2 border-blue-200 pl-4 transition-all duration-300 ease-out ${
                        isExpanded
                          ? 'max-h-96 py-2 opacity-100'
                          : 'pointer-events-none max-h-0 py-0 opacity-0'
                      }`}
                    >
                      <div className="space-y-2">
                        {option.subInterests.map((subInterest) => (
                          <div key={subInterest.id} className="flex items-center space-x-2 rounded-md px-2 py-1 transition-colors hover:bg-blue-50">
                            <Checkbox
                              id={`${option.id}-${subInterest.id}`}
                              checked={interests.includes(subInterest.id)}
                              onCheckedChange={() => toggleSubInterest(option.id, subInterest.id)}
                            />
                            <label
                              htmlFor={`${option.id}-${subInterest.id}`}
                              className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {subInterest.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Budget Input */}
        {planningMode === 'budget' && (
          <div className="space-y-4">
            <Label htmlFor="budget" className="text-lg">Total Trip Budget (₱)</Label>
            <div className="space-y-2">
              <Input
                id="budget"
                type="number"
                min="0"
                step="100"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="Enter your total budget"
                className="text-lg transition-colors hover:border-slate-400 focus-visible:ring-blue-200"
              />
              <p className="text-sm text-gray-600">
                Set your maximum total budget for the whole trip duration.
              </p>
            </div>
          </div>
        )}
        {/* Duration Input */}
        <div className="space-y-4">
          <Label htmlFor="duration" className="text-lg">Trip Duration (days)</Label>
          <div className="space-y-2">
            <Input
              id="duration"
              type="number"
              min="1"
              max="30"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="Enter number of days"
              className="text-lg transition-colors hover:border-slate-400 focus-visible:ring-blue-200"
            />
            <p className="text-sm text-gray-600">
              How many days will you be staying in Bulusan?
            </p>
          </div>
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Generating Itinerary...' : 'Get My Personalized Itinerary'}
        </Button>
      </form>
      <Dialog open={locationWarningOpen} onOpenChange={setLocationWarningOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Location Required</DialogTitle>
            <DialogDescription>
              {locationWarningMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLocationWarningOpen(false)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
