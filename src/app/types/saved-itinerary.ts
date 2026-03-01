import { Destination } from './destination';

export interface SavedItinerary {
  id: string;
  name: string;
  destinations: Destination[];
  tripDays: number;
  createdAt: string;
  totalCost: number;
  totalDuration: number;
}
