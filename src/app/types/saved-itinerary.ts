import { Destination } from './destination';

export interface SavedItineraryProgress {
  finishedEntryKeys: string[];
  ratingUnlockedDays: number[];
}

export interface SavedItinerary {
  id: string;
  name: string;
  destinations: Destination[];
  tripDays: number;
  selectedDates?: string[];
  createdAt: string;
  totalCost: number;
  totalDuration: number;
  progress?: SavedItineraryProgress;
}
