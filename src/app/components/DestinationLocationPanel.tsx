import { Destination } from '@/app/types/destination';
import { MapPin } from 'lucide-react';

interface DestinationLocationPanelProps {
  destination: Destination;
  variant?: 'default' | 'strict-itinerary';
}

export function DestinationLocationPanel({ destination, variant = 'default' }: DestinationLocationPanelProps) {
  const lat = Number(destination.location?.lat);
  const lng = Number(destination.location?.lng);
  const hasExactLocation =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;

  const hasAddress =
    Boolean(destination.address?.fullAddress) ||
    Boolean(destination.address?.purok) ||
    Boolean(destination.address?.barangay) ||
    Boolean(destination.address?.city) ||
    Boolean(destination.address?.province);

  const exactLocationLabel = hasExactLocation
    ? `${lat.toFixed(6)}, ${lng.toFixed(6)}`
    : null;

  const exactLocationMapUrl = hasExactLocation
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${lat},${lng}`
      )}`
    : null;

  const strict = variant === 'strict-itinerary';
  return (
    <div className={`min-w-0 rounded-md border px-3 py-2 ${strict ? 'border-slate-300 bg-slate-50' : 'border-slate-200 bg-slate-50'}`}>
      <p className={`${strict ? 'text-sm font-medium text-slate-700' : 'text-xs font-medium text-slate-700'}`}>Location</p>
      {destination.address?.fullAddress && (
        <p className={`break-words ${strict ? 'text-sm text-slate-600' : 'text-xs text-slate-600'}`}>{destination.address.fullAddress}</p>
      )}
      <p className={`break-words ${strict ? 'text-sm text-slate-600' : 'text-xs text-slate-600'}`}>
        Purok: {destination.address?.purok || 'Not provided'}
      </p>
      <p className={`break-words ${strict ? 'text-sm text-slate-600' : 'text-xs text-slate-600'}`}>
        Barangay: {destination.address?.barangay || 'Not provided'}
      </p>
      <p className={`break-words ${strict ? 'text-sm text-slate-600' : 'text-xs text-slate-600'}`}>
        City: {destination.address?.city || 'Not provided'}
      </p>
      <p className={`break-words ${strict ? 'text-sm text-slate-600' : 'text-xs text-slate-600'}`}>
        Province: {destination.address?.province || 'Not provided'}
      </p>
      {!hasAddress && !hasExactLocation && (
        <p className={`${strict ? 'text-sm text-slate-500' : 'text-xs text-slate-500'}`}>Address and coordinates are not available for this destination.</p>
      )}
      {hasExactLocation && (
        <p className={`break-words ${strict ? 'text-xs text-slate-500' : 'text-[11px] text-slate-500'}`}>{exactLocationLabel}</p>
      )}
      {hasExactLocation && (
        <a
          href={exactLocationMapUrl ?? '#'}
          target="_blank"
          rel="noreferrer"
          className={`mt-1 inline-flex items-center gap-1 font-medium text-blue-700 hover:underline ${strict ? 'text-sm' : 'text-xs'}`}
        >
          <MapPin className="h-3.5 w-3.5" />
          View on Google Maps
        </a>
      )}
    </div>
  );
}
