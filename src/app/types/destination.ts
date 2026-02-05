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
  activityLevel: 'relaxed' | 'moderate' | 'active';
  budget: number; // Changed from 'low' | 'medium' | 'high' to number
  duration: number; // days
  travelStyle: string[];
}

export interface ItineraryItem {
  destination: Destination;
  day: number;
  timeSlot: 'morning' | 'afternoon' | 'evening';
  notes?: string;
}