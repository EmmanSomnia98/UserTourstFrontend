import { apiPost } from '@/app/api/client';

const FEEDBACK_QUEUE_KEY = 'bw_feedback_queue_v1';
const FEEDBACK_SESSION_KEY = 'bw_feedback_session_id_v1';
const MAX_QUEUE_SIZE = 500;
const FEEDBACK_ENDPOINT =
  (import.meta.env.VITE_FEEDBACK_ENDPOINT as string | undefined) ?? '/api/recommendations/feedback';
const FEEDBACK_BATCH_ENDPOINT =
  (import.meta.env.VITE_FEEDBACK_BATCH_ENDPOINT as string | undefined) ?? '/api/recommendations/feedback/batch';

export type FeedbackEventType =
  | 'recommendation_requested'
  | 'recommendation_impression'
  | 'destination_added'
  | 'destination_removed'
  | 'itinerary_saved'
  | 'saved_itinerary_viewed'
  | 'saved_itinerary_updated'
  | 'saved_itinerary_deleted';

export type FeedbackEvent = {
  eventType: FeedbackEventType;
  timestamp: string;
  sessionId: string;
  userId?: string;
  userEmail?: string;
  destinationId?: string;
  itineraryId?: string;
  metadata?: Record<string, unknown>;
};

type FeedbackIdentity = {
  userId?: string;
  userEmail?: string;
};

function readQueue(): FeedbackEvent[] {
  try {
    const raw = localStorage.getItem(FEEDBACK_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FeedbackEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: FeedbackEvent[]) {
  try {
    localStorage.setItem(FEEDBACK_QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE_SIZE)));
  } catch {
    // Ignore storage failures.
  }
}

function pushToQueue(event: FeedbackEvent): FeedbackEvent[] {
  const queue = readQueue();
  queue.push(event);
  writeQueue(queue);
  return queue;
}

function setQueue(queue: FeedbackEvent[]) {
  writeQueue(queue);
}

function randomId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getFeedbackSessionId(): string {
  try {
    const existing = localStorage.getItem(FEEDBACK_SESSION_KEY);
    if (existing) return existing;
    const created = randomId();
    localStorage.setItem(FEEDBACK_SESSION_KEY, created);
    return created;
  } catch {
    return 'session-unavailable';
  }
}

async function sendBatch(events: FeedbackEvent[]): Promise<void> {
  await apiPost(FEEDBACK_BATCH_ENDPOINT, { events });
}

async function sendSingle(event: FeedbackEvent): Promise<void> {
  await apiPost(FEEDBACK_ENDPOINT, event);
}

async function attemptSend(events: FeedbackEvent[]): Promise<number> {
  if (events.length === 0) return 0;
  try {
    await sendBatch(events);
    return events.length;
  } catch {
    let sent = 0;
    for (const event of events) {
      try {
        await sendSingle(event);
        sent += 1;
      } catch {
        break;
      }
    }
    return sent;
  }
}

let flushInFlight = false;

export async function flushFeedbackQueue(batchSize = 30): Promise<void> {
  if (flushInFlight) return;
  flushInFlight = true;
  try {
    while (true) {
      const queue = readQueue();
      if (queue.length === 0) return;
      const batch = queue.slice(0, batchSize);
      const sentCount = await attemptSend(batch);
      if (sentCount <= 0) return;
      const remaining = queue.slice(sentCount);
      setQueue(remaining);
      if (sentCount < batch.length) return;
    }
  } finally {
    flushInFlight = false;
  }
}

export function buildFeedbackEvent(
  eventType: FeedbackEventType,
  identity: FeedbackIdentity = {},
  payload: {
    destinationId?: string;
    itineraryId?: string;
    metadata?: Record<string, unknown>;
  } = {}
): FeedbackEvent {
  return {
    eventType,
    timestamp: new Date().toISOString(),
    sessionId: getFeedbackSessionId(),
    userId: identity.userId,
    userEmail: identity.userEmail,
    destinationId: payload.destinationId,
    itineraryId: payload.itineraryId,
    metadata: payload.metadata,
  };
}

export function recordFeedbackEvent(event: FeedbackEvent): void {
  pushToQueue(event);
  void flushFeedbackQueue();
}
