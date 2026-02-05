import { SavedItinerary } from '@/app/types/saved-itinerary';

const STORAGE_KEY = 'bulusan_saved_itineraries';

export function getSavedItineraries(): SavedItinerary[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading saved itineraries:', error);
    return [];
  }
}

export function saveItinerary(itinerary: SavedItinerary): void {
  try {
    const existing = getSavedItineraries();
    const updated = [...existing, itinerary];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving itinerary:', error);
    throw new Error('Failed to save itinerary');
  }
}

export function deleteItinerary(id: string): void {
  try {
    const existing = getSavedItineraries();
    const updated = existing.filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error deleting itinerary:', error);
    throw new Error('Failed to delete itinerary');
  }
}

export function updateItineraryName(id: string, newName: string): void {
  try {
    const existing = getSavedItineraries();
    const updated = existing.map(item => 
      item.id === id ? { ...item, name: newName } : item
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error updating itinerary name:', error);
    throw new Error('Failed to update itinerary name');
  }
}
