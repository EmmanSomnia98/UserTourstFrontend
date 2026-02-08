import { Destination } from '@/app/types/destination';
import { apiGet } from '@/app/api/client';

type DestinationPayload =
  | Destination[]
  | { data: Destination[] }
  | { destinations: Destination[] };

function extractDestinations(payload: DestinationPayload): Destination[] {
  if (Array.isArray(payload)) return payload;
  if ('destinations' in payload && Array.isArray(payload.destinations)) return payload.destinations;
  if ('data' in payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

export async function fetchDestinations(): Promise<Destination[]> {
  const payload = await apiGet<DestinationPayload>('/destinations');
  return extractDestinations(payload);
}
