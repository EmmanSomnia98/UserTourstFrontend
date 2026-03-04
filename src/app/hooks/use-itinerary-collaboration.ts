import { useCallback, useEffect, useRef, useState } from 'react';
import { getCollaborationWebSocketUrl, type RealtimeCollaborationEvent } from '@/app/api/collaboration';

type CollaborationStatus = 'disabled' | 'connecting' | 'connected' | 'error';

type UseItineraryCollaborationParams = {
  itineraryId?: string;
  actorId?: string;
  enabled?: boolean;
  onRemoteEdit?: (event: Extract<RealtimeCollaborationEvent, { type: 'itinerary_edit' }>) => void;
};

function safeParse(input: string): RealtimeCollaborationEvent | null {
  try {
    return JSON.parse(input) as RealtimeCollaborationEvent;
  } catch {
    return null;
  }
}

export function useItineraryCollaboration({
  itineraryId,
  actorId,
  enabled = true,
  onRemoteEdit,
}: UseItineraryCollaborationParams) {
  const [status, setStatus] = useState<CollaborationStatus>('disabled');
  const wsRef = useRef<WebSocket | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const handleEvent = useCallback(
    (event: RealtimeCollaborationEvent) => {
      if (event.type !== 'itinerary_edit') return;
      if (itineraryId && event.itineraryId !== itineraryId) return;
      if (actorId && event.actorId && event.actorId === actorId) return;
      onRemoteEdit?.(event);
    },
    [actorId, itineraryId, onRemoteEdit]
  );

  useEffect(() => {
    if (!enabled || !itineraryId) {
      setStatus('disabled');
      return;
    }

    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(`bw-collab-itinerary-${itineraryId}`);
      channel.onmessage = (message) => {
        const data = message.data;
        if (!data || typeof data !== 'object') return;
        handleEvent(data as RealtimeCollaborationEvent);
      };
      channelRef.current = channel;
    }

    const wsUrl = getCollaborationWebSocketUrl(itineraryId);
    if (!wsUrl || typeof WebSocket === 'undefined') {
      setStatus('disabled');
      return () => {
        channelRef.current?.close();
        channelRef.current = null;
      };
    }

    setStatus('connecting');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onopen = () => setStatus('connected');
    ws.onclose = () => setStatus('error');
    ws.onerror = () => setStatus('error');
    ws.onmessage = (message) => {
      if (typeof message.data !== 'string') return;
      const parsed = safeParse(message.data);
      if (!parsed) return;
      handleEvent(parsed);
    };

    return () => {
      ws.close();
      wsRef.current = null;
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, [actorId, enabled, handleEvent, itineraryId]);

  const publishEdit = useCallback(
    (edit: { name?: string; tripDays?: number; destinationIds?: string[] }) => {
      if (!itineraryId) return;
      const event: RealtimeCollaborationEvent = {
        type: 'itinerary_edit',
        itineraryId,
        actorId,
        edit,
        updatedAt: new Date().toISOString(),
      };
      channelRef.current?.postMessage(event);
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event));
      }
    },
    [actorId, itineraryId]
  );

  return {
    collaborationStatus: status,
    publishEdit,
  };
}

