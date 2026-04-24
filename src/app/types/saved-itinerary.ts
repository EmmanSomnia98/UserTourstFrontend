import { Destination } from './destination';

export interface SavedItineraryProgress {
  finishedEntryKeys: string[];
  ratingUnlockedDays: number[];
}

export interface ItineraryStop {
  destinationId: string;
  day: number;
  sequence: number;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

export interface SavedItinerary {
  id: string;
  name: string;
  destinations: Destination[];
  stops?: ItineraryStop[];
  tripDays: number;
  selectedDates?: string[];
  createdAt: string;
  totalCost: number;
  totalDuration: number;
  progress?: SavedItineraryProgress;
}
