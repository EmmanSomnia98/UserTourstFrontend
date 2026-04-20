import { GeoPoint } from '@/app/utils/travel';

const LOCATION_GRANT_KEY = 'bulusan:location-grant';
const LOCATION_GRANT_TTL_MS = 24 * 60 * 60 * 1000;

type StoredLocationGrant = {
  grantedAt: number;
  location: GeoPoint;
};

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const isValidLocation = (value: unknown): value is GeoPoint => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { lat?: unknown; lng?: unknown };
  return Number.isFinite(candidate.lat) && Number.isFinite(candidate.lng);
};

const isValidStoredGrant = (value: unknown): value is StoredLocationGrant => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { grantedAt?: unknown; location?: unknown };
  return Number.isFinite(candidate.grantedAt) && isValidLocation(candidate.location);
};

export const getRecentLocationGrant = (): StoredLocationGrant | null => {
  if (!isBrowser) return null;
  const raw = window.localStorage.getItem(LOCATION_GRANT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidStoredGrant(parsed)) {
      window.localStorage.removeItem(LOCATION_GRANT_KEY);
      return null;
    }

    const ageMs = Date.now() - parsed.grantedAt;
    if (ageMs > LOCATION_GRANT_TTL_MS) {
      window.localStorage.removeItem(LOCATION_GRANT_KEY);
      return null;
    }

    return parsed;
  } catch {
    window.localStorage.removeItem(LOCATION_GRANT_KEY);
    return null;
  }
};

export const setRecentLocationGrant = (location: GeoPoint): void => {
  if (!isBrowser) return;
  const payload: StoredLocationGrant = {
    grantedAt: Date.now(),
    location,
  };
  window.localStorage.setItem(LOCATION_GRANT_KEY, JSON.stringify(payload));
};

export const clearRecentLocationGrant = (): void => {
  if (!isBrowser) return;
  window.localStorage.removeItem(LOCATION_GRANT_KEY);
};
