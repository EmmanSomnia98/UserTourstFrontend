export interface Destination {
  id: string;
  name: string;
  description: string;
  image: string;
  images?: string[];
  type: 'nature' | 'adventure' | 'cultural' | 'relaxation' | 'historical';
  difficulty: 'easy' | 'moderate' | 'challenging';
  duration: number; // in hours
  durationHours?: number;
  rating: number;
  reviewCount: number;
  interests: string[];
  mainInterests?: string[];
  subInterests?: string[];
  bestTimeToVisit: string[];
  estimatedCost: number;
  location: {
    lat: number;
    lng: number;
  };
  address?: {
    purok?: string;
    barangay?: string;
    city?: string;
    province?: string;
    fullAddress?: string;
  };
  plannedDay?: number;
}

export interface UserPreferences {
  interests: string[];
  mainInterests?: string[];
  subInterests?: string[];
  interestRanks?: Record<string, number>;
  activityLevel: 'relaxed' | 'moderate' | 'active';
  timePreference?: 'day_only' | 'night_only' | 'whole_day';
  budget: number; // Changed from 'low' | 'medium' | 'high' to number
  duration: number; // days
  selectedDates?: string[]; // ISO date strings
  collaborators?: string[];
  collaboratorIds?: string[];
}

export interface ItineraryItem {
  destination: Destination;
  day: number;
  timeSlot: 'morning' | 'afternoon' | 'evening';
  notes?: string;
}
