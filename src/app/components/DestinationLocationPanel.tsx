import { Destination } from '@/app/types/destination';
import { MapPin } from 'lucide-react';

interface DestinationLocationPanelProps {
  destination: Destination;
}

export function DestinationLocationPanel({ destination }: DestinationLocationPanelProps) {
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

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-medium text-slate-700">Location</p>
      {destination.address?.fullAddress && (
        <p className="text-xs text-slate-600">{destination.address.fullAddress}</p>
      )}
      <p className="text-xs text-slate-600">
        Purok: {destination.address?.purok || 'Not provided'}
      </p>
      <p className="text-xs text-slate-600">
        Barangay: {destination.address?.barangay || 'Not provided'}
      </p>
      <p className="text-xs text-slate-600">
        City: {destination.address?.city || 'Not provided'}
      </p>
      <p className="text-xs text-slate-600">
        Province: {destination.address?.province || 'Not provided'}
      </p>
      {!hasAddress && !hasExactLocation && (
        <p className="text-xs text-slate-500">Address and coordinates are not available for this destination.</p>
      )}
      {hasExactLocation && (
        <p className="text-[11px] text-slate-500">{exactLocationLabel}</p>
      )}
      {hasExactLocation && (
        <a
          href={exactLocationMapUrl ?? '#'}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
        >
          <MapPin className="h-3.5 w-3.5" />
          View on Google Maps
        </a>
      )}
    </div>
  );
}
