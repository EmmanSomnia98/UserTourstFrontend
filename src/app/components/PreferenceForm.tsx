import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Label } from '@/app/components/ui/label';
import { Input } from '@/app/components/ui/input';
import { UserPreferences } from '@/app/types/destination';
import { searchUsers, type UserSearchResult } from '@/app/api/users';
import { GeoPoint } from '@/app/utils/travel';
import { Mountain, Waves, Heart, Compass, ChevronDown, ChevronUp, Sun, LucideBook, Ship, Camera, LocateFixed, Sunrise, MoonStar, Clock3 } from 'lucide-react';

interface PreferenceFormProps {
  onSubmit: (preferences: UserPreferences) => void | Promise<void>;
  onLocationChange?: (location: GeoPoint | null) => void;
}

type CollaboratorSelection = {
  id?: string;
  label: string;
  secondary?: string;
};

// Define sub-interests for each main interest
const interestOptionsWithSubs = [
  { 
    id: 'nature', 
    label: 'Nature', 
    icon: Mountain,
    subInterests: [
      'Eco-tours',
      'Wilderness trekking',
      'Volcanic sites',
      'Caves and canyons'
    ]
  },
  { 
    id: 'diving', 
    label: 'Diving and Marine Sports', 
    icon: Waves,
    subInterests: [
      'Scuba diving',
      'Snorkeling',
      'Wreck diving',
      'Freediving'
    ]
  },
  { 
    id: 'sun_beach', 
    label: 'Sun and Beach', 
    icon: Sun,
    subInterests: [
      'Island hopping',
      'Beach resorts',
      'Surfing and skimboarding',
      'Coastal relaxation'
    ]
  },
  { 
    id: 'health_wellness', 
    label: 'Health and Wellness', 
    icon: Heart,
    subInterests: [
      'Spa and retreats',
      'Medical tourism',
      'Retirement villages',
      'Beauty and wellness services'
    ]
  },
  { 
    id: 'events', 
    label: 'MICE and Events', 
    icon: Compass,
    subInterests: [
      'Corporate meetings',
      'Incentives & Team Building',
      'Exhibitions',
      'Conventions'
    ]
  },
  { 
    id: 'culture_heritage', 
    label: 'Culture and Heritage', 
    icon: Camera,
    subInterests: [
      'Heritage Tours',
      'Food tourism',
      'Culinary Tourism',
      'Festivals & events'
    ]
  },
  { 
    id: 'education', 
    label: 'Education', 
    icon: LucideBook,
    subInterests: [
      'Study tours',
      'Historical site learning',
      'Culinary schools',
      'Language immersion'
    ]
  },
  {
    id: 'cruise',
    label: 'Cruise and Nautical Tourism',
    icon: Ship,
    subInterests: [
      'Luxury cruises',
      'Yachting and sailing',
      'Ferry travel',
      'Water taxis'
    ]
  },
  {
    id: 'leisure',
    label: 'Leisure and Entertainment',
    icon: Heart,
    subInterests: [
      'Theme parks',
      'Casinos',
      'Shopping and retail',
      'Nightlife and bars'
    ]
  }
];

export function PreferenceForm({ onSubmit, onLocationChange }: PreferenceFormProps) {
  const [planningMode, setPlanningMode] = useState<'preferences' | 'budget'>('preferences');
  const [interests, setInterests] = useState<string[]>([]);
  const [mainInterestOrder, setMainInterestOrder] = useState<string[]>([]);
  const [expandedInterests, setExpandedInterests] = useState<string[]>([]);
  const [activityLevel, setActivityLevel] = useState<'relaxed' | 'moderate' | 'active'>('moderate');
  const [timePreference, setTimePreference] = useState<'day_only' | 'night_only' | 'whole_day'>('whole_day');
  const [budget, setBudget] = useState<string>('1000');
  const [duration, setDuration] = useState<string>('');
  const [travelStyle, setTravelStyle] = useState<string[]>(['solo']);
  const [collaborators, setCollaborators] = useState<CollaboratorSelection[]>([]);
  const [collaboratorQuery, setCollaboratorQuery] = useState('');
  const [collaboratorSuggestions, setCollaboratorSuggestions] = useState<UserSearchResult[]>([]);
  const [isSearchingCollaborators, setIsSearchingCollaborators] = useState(false);
  const [showInterestError, setShowInterestError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [locationWarningOpen, setLocationWarningOpen] = useState(false);
  const [locationWarningMessage, setLocationWarningMessage] = useState('');
  const [locationStatus, setLocationStatus] = useState<
    'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable' | 'error'
  >('idle');
  const [locationMessage, setLocationMessage] = useState<string>('');
  const preferenceBudgetFallback = 5000;
  const selectedTravelStyle = travelStyle[0] ?? 'solo';
  const collaboratorLimit = selectedTravelStyle === 'couple' ? 1
    : selectedTravelStyle === 'family_group' ? Number.POSITIVE_INFINITY
    : 0;
  const completedCollaborators = useMemo(
    () => collaborators.filter((item) => item.label.trim() !== ''),
    [collaborators]
  );
  const canAddMoreCollaborators =
    collaboratorLimit === 0
      ? false
      : (collaboratorLimit === Number.POSITIVE_INFINITY || completedCollaborators.length < collaboratorLimit);

  const mainInterestIds = interestOptionsWithSubs.map((option) => option.id);

  const toggleInterest = (interest: string) => {
    const isCurrentlySelected = interests.includes(interest);
    
    if (isCurrentlySelected) {
      // Remove main interest and all its sub-interests
      const interestOption = interestOptionsWithSubs.find(opt => opt.id === interest);
      const subInterestsToRemove = interestOption?.subInterests || [];
      setInterests(prev => prev.filter(i => i !== interest && !subInterestsToRemove.includes(i)));
      setMainInterestOrder(prev => prev.filter(id => id !== interest));
      setExpandedInterests(prev => prev.filter(i => i !== interest));
    } else {
      // Add main interest and expand to show sub-interests
      setInterests(prev => [...prev, interest]);
      setMainInterestOrder(prev => (prev.includes(interest) ? prev : [...prev, interest]));
      setExpandedInterests(prev => [...prev, interest]);
      setShowInterestError(false);
    }
  };

  const toggleSubInterest = (mainInterest: string, subInterest: string) => {
    setInterests(prev => {
      if (prev.includes(subInterest)) {
        return prev.filter(i => i !== subInterest);
      } else {
        // Make sure main interest is also selected
        if (!prev.includes(mainInterest)) {
          setMainInterestOrder(order => (order.includes(mainInterest) ? order : [...order, mainInterest]));
          setShowInterestError(false);
          return [...prev, mainInterest, subInterest];
        }
        setShowInterestError(false);
        return [...prev, subInterest];
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

  const toggleTravelStyle = (style: string) => {
    const nextStyle = selectedTravelStyle === style ? 'solo' : style;
    setTravelStyle([nextStyle]);
    if (nextStyle === 'couple') {
      setCollaborators(prev => prev.filter((item) => item.label.trim() !== '').slice(0, 1));
    } else if (nextStyle === 'family_group') {
      setCollaborators(prev => prev.filter((item) => item.label.trim() !== ''));
    } else {
      setCollaborators([]);
    }
    setCollaboratorQuery('');
    setCollaboratorSuggestions([]);
  };

  const addCollaborator = (value: string | UserSearchResult) => {
    const draft: CollaboratorSelection = typeof value === 'string'
      ? { label: value.trim() }
      : {
          id: value.id?.trim() || undefined,
          label: value.label.trim(),
          secondary: value.secondary,
        };
    if (!draft.label || !canAddMoreCollaborators) return;
    const exists = completedCollaborators.some((collaborator) => {
      if (collaborator.id && draft.id) {
        return collaborator.id === draft.id;
      }
      return collaborator.label.toLowerCase() === draft.label.toLowerCase();
    });
    if (exists) {
      setCollaboratorQuery('');
      setCollaboratorSuggestions([]);
      return;
    }
    setCollaborators((prev) => {
      const next = [...prev, draft];
      if (selectedTravelStyle === 'couple') {
        return next.slice(0, 1);
      }
      return next;
    });
    setCollaboratorQuery('');
    setCollaboratorSuggestions([]);
  };

  const removeCollaborator = (target: CollaboratorSelection) => {
    setCollaborators((prev) => prev.filter((collaborator) => {
      if (collaborator.id && target.id) {
        return collaborator.id !== target.id;
      }
      return collaborator.label !== target.label;
    }));
  };

  useEffect(() => {
    if (collaboratorLimit === 0) {
      setCollaboratorSuggestions([]);
      setIsSearchingCollaborators(false);
      return;
    }
    const query = collaboratorQuery.trim();
    if (query.length < 2) {
      setCollaboratorSuggestions([]);
      setIsSearchingCollaborators(false);
      return;
    }

    let cancelled = false;
    setIsSearchingCollaborators(true);
    const timer = setTimeout(() => {
      void searchUsers(query)
        .then((results) => {
          if (cancelled) return;
          const selectedIds = new Set(
            completedCollaborators
              .map((item) => item.id)
              .filter((id): id is string => Boolean(id))
          );
          const selectedLabels = new Set(completedCollaborators.map((item) => item.label.toLowerCase()));
          setCollaboratorSuggestions(
            results.filter((item) => {
              if (item.id && selectedIds.has(item.id)) return false;
              return !selectedLabels.has(item.label.toLowerCase());
            })
          );
        })
        .finally(() => {
          if (cancelled) return;
          setIsSearchingCollaborators(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [collaboratorLimit, collaboratorQuery, completedCollaborators]);

  useEffect(() => {
    if (!canAddMoreCollaborators) {
      setCollaboratorSuggestions([]);
    }
  }, [canAddMoreCollaborators]);

  const handleCollaboratorInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addCollaborator(collaboratorQuery);
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

    if (collaboratorLimit > 0 && completedCollaborators.length === 0) {
      setSubmitError('Please add at least one collaborator for this travel style.');
      setIsSubmitting(false);
      return;
    }
    
    try {
      const autoRankedMainInterests = mainInterestOrder
        .filter((interestId) => mainInterestIds.includes(interestId) && interests.includes(interestId))
        .slice(0, 9);

      const interestRanks = autoRankedMainInterests.reduce<Record<string, number>>((acc, interestId, index) => {
        acc[interestId] = index + 1;
        return acc;
      }, {});
      const collaboratorLabels = completedCollaborators.map((item) => item.label);
      const collaboratorIds = completedCollaborators
        .map((item) => item.id)
        .filter((id): id is string => Boolean(id));

      await onSubmit({
        interests,
        ...(Object.keys(interestRanks).length > 0 ? { interestRanks } : {}),
        activityLevel,
        timePreference,
        budget: budgetNum,
        duration: durationNum,
        travelStyle,
        collaborators: collaboratorLabels,
        ...(collaboratorIds.length > 0 ? { collaboratorIds } : {}),
      });
    } catch (error) {
      console.error('Failed to submit preferences:', error);
      setSubmitError(error instanceof Error ? error.message : 'We could not generate your itinerary. Please try again.');
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

    setLocationStatus('requesting');
    setLocationMessage('Requesting location access...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        onLocationChange?.(nextLocation);
        setLocationStatus('granted');
        setLocationMessage('Location access enabled. Travel times will use your current location.');
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocationStatus('denied');
          setLocationMessage('Location access was denied. You can enable it and try again.');
          onLocationChange?.(null);
          return;
        }
        setLocationStatus('error');
        setLocationMessage('Could not get your location. Please try again.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
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
              className={`rounded-lg border-2 px-4 py-3 text-left transition-all ${
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
              className={`rounded-lg border-2 px-4 py-3 text-left transition-all ${
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
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
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
                variant={locationStatus === 'granted' ? 'outline' : 'default'}
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
        
        {/* Travel Style */}
        <div className="space-y-4">
          <Label className="text-lg">Travel Style</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {['solo', 'couple', 'family_group'].map(style => {
              const isSelected = selectedTravelStyle === style;
              const label = style === 'family_group' ? 'family/group' : style;
              return (
                <button
                  key={style}
                  type="button"
                  onClick={() => toggleTravelStyle(style)}
                  className={`rounded-lg border-2 px-4 py-3 text-left transition-all capitalize ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-xs text-gray-600">
                    {style === 'solo' && 'Just you.'}
                    {style === 'couple' && 'You + 1 traveler.'}
                    {style === 'family_group' && 'Add travelers as needed.'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <Label className="text-lg">Preferred Time</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                id: 'day_only',
                title: 'Day only',
                description: 'Show activities best during daytime.',
                icon: Sunrise,
              },
              {
                id: 'night_only',
                title: 'Night only',
                description: 'Focus on evening and night activities.',
                icon: MoonStar,
              },
              {
                id: 'whole_day',
                title: 'Whole day',
                description: 'Include both daytime and nighttime options.',
                icon: Clock3,
              },
            ].map((option) => {
              const Icon = option.icon;
              const isSelected = timePreference === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTimePreference(option.id as 'day_only' | 'night_only' | 'whole_day')}
                  className={`rounded-lg border-2 px-4 py-3 text-left transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-blue-500' : 'text-gray-500'}`} />
                    <p className="text-sm font-semibold">{option.title}</p>
                  </div>
                  <p className="mt-1 text-xs text-gray-600">{option.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {collaboratorLimit > 0 && (
          <div className="space-y-4">
            <Label className="text-lg">Collaborators</Label>
            <div className="space-y-3">
              {completedCollaborators.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {completedCollaborators.map((collaborator) => (
                    <span
                      key={`${collaborator.id ?? collaborator.label}`}
                      className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700"
                    >
                      @{collaborator.label}
                      <button
                        type="button"
                        onClick={() => removeCollaborator(collaborator)}
                        className="text-blue-600 hover:text-blue-800"
                        aria-label={`Remove ${collaborator.label}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <Input
                type="text"
                value={collaboratorQuery}
                onChange={(e) => setCollaboratorQuery(e.target.value)}
                onKeyDown={handleCollaboratorInputKeyDown}
                placeholder={
                  canAddMoreCollaborators
                    ? (selectedTravelStyle === 'couple'
                        ? 'Type username or email, then press Enter'
                        : 'Add collaborator username/email')
                    : 'Collaborator limit reached'
                }
                className="text-sm"
                disabled={!canAddMoreCollaborators}
              />

              {isSearchingCollaborators && (
                <p className="text-xs text-gray-500">Searching users...</p>
              )}

              {!isSearchingCollaborators && collaboratorSuggestions.length > 0 && (
                <div className="rounded-md border border-gray-200 bg-white p-2">
                  <div className="flex flex-wrap gap-2">
                    {collaboratorSuggestions.map((suggestion) => (
                      <button
                        key={`${suggestion.id ?? suggestion.label}`}
                        type="button"
                        onClick={() => addCollaborator(suggestion)}
                        className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:border-blue-400 hover:text-blue-700"
                        disabled={!canAddMoreCollaborators}
                        title={suggestion.secondary}
                      >
                        @{suggestion.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!isSearchingCollaborators && collaboratorQuery.trim().length >= 2 && collaboratorSuggestions.length === 0 && canAddMoreCollaborators && (
                <p className="text-xs text-gray-500">
                  No suggested users found. Press Enter to add manually.
                </p>
              )}
            </div>
            <p className="text-sm text-gray-600">
              Add collaborators by username or email. You can still type manually and press Enter.
            </p>
          </div>
        )}

        {/* Interests with Sub-interests */}
        <div className="space-y-4">
          <Label className="text-lg">What interests you? (Select all that apply)</Label>
          {showInterestError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Please select at least one interest to continue.
            </p>
          )}
          {submitError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {interestOptionsWithSubs.map(option => {
              const Icon = option.icon;
              const isSelected = interests.includes(option.id);
              const isExpanded = expandedInterests.includes(option.id);
              const rankIndex = mainInterestOrder.findIndex((interestId) => interestId === option.id);
              const mainInterestRank = rankIndex >= 0 ? rankIndex + 1 : null;
              
              return (
                <div key={option.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleInterest(option.id)}
                      className={`flex-1 flex items-center justify-between gap-3 p-4 rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-6 h-6 ${isSelected ? 'text-blue-500' : 'text-gray-600'}`} />
                        <span className={`text-sm ${isSelected ? 'font-medium' : ''}`}>
                          {option.label}
                        </span>
                      </div>
                      {isSelected && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(option.id);
                          }}
                          className="p-1 hover:bg-blue-100 rounded cursor-pointer"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-blue-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-blue-500" />
                          )}
                        </div>
                      )}
                    </button>
                    {isSelected && (
                      <div className="w-20 h-9 rounded-md bg-gray-100 text-gray-700 text-xs font-medium flex items-center justify-center">
                        {mainInterestRank ? `#${mainInterestRank}` : ''}
                      </div>
                    )}
                  </div>
                  
                  {/* Sub-interests */}
                  {isSelected && isExpanded && (
                    <div className="ml-4 pl-4 border-l-2 border-blue-200 space-y-2 py-2">
                      {option.subInterests.map(subInterest => (
                        <div key={subInterest} className="flex items-center space-x-2">
                          <Checkbox
                            id={`${option.id}-${subInterest}`}
                            checked={interests.includes(subInterest)}
                            onCheckedChange={() => toggleSubInterest(option.id, subInterest)}
                          />
                          <label
                            htmlFor={`${option.id}-${subInterest}`}
                            className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {subInterest}
                          </label>
                        </div>
                      ))}
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
            <Label htmlFor="budget" className="text-lg">Budget per Activity (₱)</Label>
            <div className="space-y-2">
              <Input
                id="budget"
                type="number"
                min="0"
                step="100"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="Enter your budget per activity"
                className="text-lg"
              />
              <p className="text-sm text-gray-600">
                Set your maximum budget per activity. Activities within this range will be prioritized.
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
              className="text-lg"
            />
            <p className="text-sm text-gray-600">
              How many days will you be staying in Bulusan? (1-30 days)
            </p>
          </div>
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
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
