export interface Destination {
  id: string;
  name: string;
  description: string;
  image: string;
  type: 'nature' | 'adventure' | 'cultural' | 'relaxation' | 'historical';
  difficulty: 'easy' | 'moderate' | 'challenging';
  duration: number; // in hours
  rating: number;
  reviewCount: number;
  interests: string[];
  bestTimeToVisit: string[];
  estimatedCost: number;
  location: {
    lat: number;
    lng: number;
  };
}

export interface UserPreferences {
  interests: string[];
  interestRanks?: Record<string, number>;
  activityLevel: 'relaxed' | 'moderate' | 'active';
  timePreference?: 'day_only' | 'night_only' | 'whole_day';
  budget: number; // Changed from 'low' | 'medium' | 'high' to number
  duration: number; // days
  travelStyle: string[];
  collaborators?: string[];
}

export interface ItineraryItem {
  destination: Destination;
  day: number;
  timeSlot: 'morning' | 'afternoon' | 'evening';
  notes?: string;
}
