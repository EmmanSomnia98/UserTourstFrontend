import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Label } from '@/app/components/ui/label';
import { Input } from '@/app/components/ui/input';
import { UserPreferences } from '@/app/types/destination';
import { Mountain, Waves, Heart, Compass, ChevronDown, ChevronUp, Sun, LucideBook, Ship, Camera } from 'lucide-react';

interface PreferenceFormProps {
  onSubmit: (preferences: UserPreferences) => void | Promise<void>;
}

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

export function PreferenceForm({ onSubmit }: PreferenceFormProps) {
  const [planningMode, setPlanningMode] = useState<'preferences' | 'budget'>('preferences');
  const [interests, setInterests] = useState<string[]>([]);
  const [expandedInterests, setExpandedInterests] = useState<string[]>([]);
  const [activityLevel, setActivityLevel] = useState<'relaxed' | 'moderate' | 'active'>('moderate');
  const [budget, setBudget] = useState<string>('1000');
  const [duration, setDuration] = useState<string>('');
  const [travelStyle, setTravelStyle] = useState<string[]>(['solo']);
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [showInterestError, setShowInterestError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const preferenceBudgetFallback = 5000;
  const selectedTravelStyle = travelStyle[0] ?? 'solo';
  const collaboratorLimit = selectedTravelStyle === 'couple' ? 1
    : selectedTravelStyle === 'family_group' ? Number.POSITIVE_INFINITY
    : 0;
  const completedCollaborators = collaborators.filter(name => name.trim() !== '');
  const collaboratorInputCount = collaboratorLimit === 0
    ? 0
    : (collaboratorLimit === 1 ? 1 : Math.max(1, completedCollaborators.length + 1));

  const toggleInterest = (interest: string) => {
    const isCurrentlySelected = interests.includes(interest);
    
    if (isCurrentlySelected) {
      // Remove main interest and all its sub-interests
      const interestOption = interestOptionsWithSubs.find(opt => opt.id === interest);
      const subInterestsToRemove = interestOption?.subInterests || [];
      setInterests(prev => prev.filter(i => i !== interest && !subInterestsToRemove.includes(i)));
      setExpandedInterests(prev => prev.filter(i => i !== interest));
    } else {
      // Add main interest and expand to show sub-interests
      setInterests(prev => [...prev, interest]);
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
      setCollaborators(prev => prev.slice(0, 1));
      if (collaborators.length === 0) {
        setCollaborators(['']);
      }
    } else if (nextStyle === 'family_group') {
      setCollaborators(prev => {
        const next = [...prev];
        while (next.length < 1) next.push('');
        return next;
      });
    } else {
      setCollaborators([]);
    }
  };

  const handleCollaboratorChange = (index: number, value: string) => {
    setCollaborators(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

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
    
    try {
      await onSubmit({
        interests,
        activityLevel,
        budget: budgetNum,
        duration: durationNum,
        travelStyle,
      });
    } catch (error) {
      console.error('Failed to submit preferences:', error);
      setSubmitError(error instanceof Error ? error.message : 'We could not generate your itinerary. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
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

        {collaboratorLimit > 0 && (
          <div className="space-y-4">
            <Label className="text-lg">Collaborators</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Array.from({ length: collaboratorInputCount }).map((_, index) => {
                const value = collaborators[index] ?? '';
                const completed = value.trim() !== '';
                return (
                  <div key={`collaborator-${index}`} className="space-y-2">
                    <Input
                      type="text"
                      value={value}
                      onChange={(e) => handleCollaboratorChange(index, e.target.value)}
                      placeholder={`Traveler ${index + 1} name`}
                      className="text-sm"
                    />
                    {completed && (
                      <p className="text-xs text-gray-600">
                        Username: {value.trim()}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-sm text-gray-600">
              Add travelers who will join the trip.
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
              
              return (
                <div key={option.id} className="space-y-2">
                  <button
                    type="button"
                    onClick={() => toggleInterest(option.id)}
                    className={`w-full flex items-center justify-between gap-3 p-4 rounded-lg border-2 transition-all ${
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

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Generating Itinerary...' : 'Get My Personalized Itinerary'}
        </Button>
      </form>
    </Card>
  );
}
