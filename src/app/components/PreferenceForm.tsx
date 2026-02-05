import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Label } from '@/app/components/ui/label';
import { Input } from '@/app/components/ui/input';
import { UserPreferences } from '@/app/types/destination';
import { Mountain, Waves, Heart, Compass, ChevronDown, ChevronUp, Sun, LucideBook, Ship, Camera } from 'lucide-react';

interface PreferenceFormProps {
  onSubmit: (preferences: UserPreferences) => void;
}

// Define sub-interests for each main interest
const interestOptionsWithSubs = [
  { 
    id: 'nature', 
    label: 'Nature', 
    icon: Mountain,
    subInterests: [
      'Rainforest exploration',
      'Wildlife viewing',
      'Botanical gardens',
      'Scenic views',
      'National parks'
    ]
  },
  { 
    id: 'diving', 
    label: 'Diving and Marine Sports', 
    icon: Waves,
    subInterests: [
      'Landscape photography',
      'Wildlife photography',
      'Nature photography',
      'Sunset/sunrise shots',
      'Cultural photography'
    ]
  },
  { 
    id: 'sun_beach', 
    label: 'Sun and Beach', 
    icon: Sun,
    subInterests: [
      'Natural pools',
      'Waterfalls',
      'Lakes',
      'Rivers',
      'Beach swimming'
    ]
  },
  { 
    id: 'health_wellness', 
    label: 'Health and Wellness', 
    icon: Heart,
    subInterests: [
      'Hot springs',
      'Spa & wellness',
      'Meditation spots',
      'Peaceful retreats',
      'Scenic picnics'
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
  }
];

export function PreferenceForm({ onSubmit }: PreferenceFormProps) {
  const [interests, setInterests] = useState<string[]>([]);
  const [expandedInterests, setExpandedInterests] = useState<string[]>([]);
  const [activityLevel, setActivityLevel] = useState<'relaxed' | 'moderate' | 'active'>('moderate');
  const [budget, setBudget] = useState<string>('1000');
  const [duration, setDuration] = useState<string>('3');
  const [travelStyle, setTravelStyle] = useState<string[]>([]);

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
    }
  };

  const toggleSubInterest = (mainInterest: string, subInterest: string) => {
    setInterests(prev => {
      if (prev.includes(subInterest)) {
        return prev.filter(i => i !== subInterest);
      } else {
        // Make sure main interest is also selected
        if (!prev.includes(mainInterest)) {
          return [...prev, mainInterest, subInterest];
        }
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
    setTravelStyle(prev =>
      prev.includes(style)
        ? prev.filter(s => s !== style)
        : [...prev, style]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const budgetNum = parseInt(budget) || 1000;
    const durationNum = parseInt(duration) || 3;
    
    onSubmit({
      interests,
      activityLevel,
      budget: budgetNum,
      duration: durationNum,
      travelStyle,
    });
  };

  return (
    <Card className="p-8 max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-8">
        <div>
          <h2 className="text-2xl mb-2">Tell us about your travel preferences</h2>
          <p className="text-gray-600">We'll create personalized recommendations just for you</p>
        </div>

        {/* Interests with Sub-interests */}
        <div className="space-y-4">
          <Label className="text-lg">What interests you? (Select all that apply)</Label>
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

        {/* Activity Level */}
        <div className="space-y-4">
          <Label className="text-lg">Activity Level</Label>
          <div className="grid grid-cols-3 gap-3">
            {['relaxed', 'moderate', 'active'].map(level => (
              <button
                key={level}
                type="button"
                onClick={() => setActivityLevel(level as any)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  activityLevel === level
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-center">
                  <div className="capitalize">{level}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    {level === 'relaxed' && 'Easy-going pace'}
                    {level === 'moderate' && 'Balanced activities'}
                    {level === 'active' && 'High energy'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Budget Input */}
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

        {/* Travel Style */}
        <div className="space-y-4">
          <Label className="text-lg">Travel Style (Select all that apply)</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['solo', 'couple', 'family', 'group'].map(style => (
              <div key={style} className="flex items-center space-x-2">
                <Checkbox
                  id={style}
                  checked={travelStyle.includes(style)}
                  onCheckedChange={() => toggleTravelStyle(style)}
                />
                <label
                  htmlFor={style}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize cursor-pointer"
                >
                  {style}
                </label>
              </div>
            ))}
          </div>
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={interests.length === 0}>
          Get My Personalized Itinerary
        </Button>
      </form>
    </Card>
  );
}