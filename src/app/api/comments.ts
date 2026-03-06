import { apiGet, apiPost } from '@/app/api/client';

export type DestinationComment = {
  id: string;
  body: string;
  createdAt: string;
  userName?: string;
  status?: string;
};

type RawComment = {
  id?: unknown;
  body?: unknown;
  comment?: unknown;
  content?: unknown;
  text?: unknown;
  createdAt?: unknown;
  created_at?: unknown;
  userName?: unknown;
  authorName?: unknown;
  status?: unknown;
};

type ListCommentsResponse = {
  comments?: RawComment[];
  data?: RawComment[];
};

type CreateCommentResponse =
  | RawComment
  | {
      comment?: RawComment;
      data?: RawComment;
    };

function toStringValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function normalizeComment(raw: RawComment, fallbackIndex: number): DestinationComment | null {
  const body =
    toStringValue(raw.body) ??
    toStringValue(raw.comment) ??
    toStringValue(raw.content) ??
    toStringValue(raw.text);
  if (!body) return null;

  const createdAt =
    toStringValue(raw.createdAt) ??
    toStringValue(raw.created_at) ??
    new Date().toISOString();

  return {
    id: toStringValue(raw.id) ?? `comment-${fallbackIndex}`,
    body,
    createdAt,
    userName: toStringValue(raw.userName) ?? toStringValue(raw.authorName) ?? undefined,
    status: toStringValue(raw.status) ?? undefined,
  };
}

export async function fetchDestinationComments(destinationId: string): Promise<DestinationComment[]> {
  const payload = await apiGet<ListCommentsResponse>(
    `/api/destinations/${encodeURIComponent(destinationId)}/comments`
  );
  const items = Array.isArray(payload?.comments)
    ? payload.comments
    : Array.isArray(payload?.data)
      ? payload.data
      : [];

  return items
    .map((item, index) => normalizeComment(item, index))
    .filter((item): item is DestinationComment => Boolean(item))
    .filter((item) => (item.status ? item.status.toLowerCase() !== 'hidden' : true))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function createDestinationComment(destinationId: string, body: string): Promise<DestinationComment> {
  const payload = await apiPost<CreateCommentResponse>(
    `/api/destinations/${encodeURIComponent(destinationId)}/comments`,
    { body }
  );
  const hasWrapperShape = (value: unknown): value is { comment?: RawComment; data?: RawComment } => {
    if (!value || typeof value !== 'object') return false;
    return 'comment' in value || 'data' in value;
  };
  const candidate = hasWrapperShape(payload) ? (payload.comment ?? payload.data) : payload;
  const normalized = normalizeComment((candidate ?? {}) as RawComment, Date.now());
  if (!normalized) {
    return {
      id: `comment-${Date.now()}`,
      body: body.trim(),
      createdAt: new Date().toISOString(),
    };
  }
  return normalized;
}
