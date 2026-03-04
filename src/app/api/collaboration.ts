import { API_BASE_URL, apiGet, apiPost, getAuthToken } from '@/app/api/client';
import { SavedItinerary } from '@/app/types/saved-itinerary';

const COLLAB_NOTIFICATIONS_ENDPOINT =
  (import.meta.env.VITE_COLLAB_NOTIFICATIONS_ENDPOINT as string | undefined) ?? '/api/collaboration/notifications';
const COLLAB_INVITES_ENDPOINT =
  (import.meta.env.VITE_COLLAB_INVITES_ENDPOINT as string | undefined) ?? '/api/collaboration/invitations';
const COLLAB_SYNC_ENDPOINT =
  (import.meta.env.VITE_COLLAB_SYNC_ENDPOINT as string | undefined) ?? '/api/collaboration/sync';
const COLLAB_WS_URL =
  (import.meta.env.VITE_COLLAB_WS_URL as string | undefined) ?? '';

export type CollaborationNotification = {
  id: string;
  type: 'invite' | 'itinerary_updated' | 'comment' | 'system';
  title: string;
  message: string;
  itineraryId?: string;
  invitationId?: string;
  read: boolean;
  createdAt: string;
  actorName?: string;
};

type NotificationsPayload =
  | CollaborationNotification[]
  | {
      data?: CollaborationNotification[];
      notifications?: CollaborationNotification[];
      items?: CollaborationNotification[];
    };

function extractNotifications(payload: NotificationsPayload): CollaborationNotification[] {
  if (Array.isArray(payload)) return payload;
  if ('notifications' in payload && Array.isArray(payload.notifications)) return payload.notifications;
  if ('items' in payload && Array.isArray(payload.items)) return payload.items;
  if ('data' in payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

function normalizeWsBase(): string | null {
  if (COLLAB_WS_URL.trim()) return COLLAB_WS_URL.trim().replace(/\/+$/, '');
  if (!API_BASE_URL.trim()) return null;
  if (API_BASE_URL.startsWith('https://')) return `wss://${API_BASE_URL.slice('https://'.length)}`;
  if (API_BASE_URL.startsWith('http://')) return `ws://${API_BASE_URL.slice('http://'.length)}`;
  return null;
}

export function getCollaborationWebSocketUrl(itineraryId: string): string | null {
  const base = normalizeWsBase();
  if (!base) return null;
  const token = getAuthToken();
  const query = new URLSearchParams({
    itineraryId,
    ...(token ? { token } : {}),
  });
  return `${base}/api/collaboration/ws?${query.toString()}`;
}

export async function fetchCollaborationNotifications(): Promise<CollaborationNotification[]> {
  const payload = await apiGet<NotificationsPayload>(COLLAB_NOTIFICATIONS_ENDPOINT);
  return extractNotifications(payload).sort(
    (a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || '')
  );
}

export async function respondToInvitation(
  invitationId: string,
  action: 'accept' | 'decline'
): Promise<void> {
  await apiPost(`${COLLAB_INVITES_ENDPOINT}/${encodeURIComponent(invitationId)}/respond`, { action });
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await apiPost(`${COLLAB_NOTIFICATIONS_ENDPOINT}/${encodeURIComponent(notificationId)}/read`, {});
}

export async function inviteCollaboratorToItinerary(payload: {
  itineraryId: string;
  collaboratorId?: string;
  collaboratorLabel?: string;
}): Promise<void> {
  await apiPost(COLLAB_INVITES_ENDPOINT, payload);
}

export type ItinerarySyncPayload = {
  itineraryId: string;
  name: string;
  tripDays: number;
  destinationIds: string[];
  sourceUserId?: string;
};

export async function pushItinerarySync(payload: ItinerarySyncPayload): Promise<void> {
  await apiPost(COLLAB_SYNC_ENDPOINT, payload);
}

export type RealtimeCollaborationEvent =
  | {
      type: 'itinerary_edit';
      itineraryId: string;
      actorId?: string;
      actorName?: string;
      edit: {
        name?: string;
        tripDays?: number;
        destinationIds?: string[];
      };
      updatedAt?: string;
    }
  | {
      type: 'itinerary_presence';
      itineraryId: string;
      users?: Array<{ id?: string; name?: string }>;
    };

