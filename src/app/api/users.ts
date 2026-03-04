import { apiGet } from '@/app/api/client';

const USER_SEARCH_ENDPOINT =
  (import.meta.env.VITE_USER_SEARCH_ENDPOINT as string | undefined) ?? '/api/users/search';

type UserSearchItem =
  | string
  | {
      id?: unknown;
      _id?: unknown;
      userId?: unknown;
      username?: unknown;
      email?: unknown;
      name?: unknown;
      fullName?: unknown;
      displayName?: unknown;
    };

type UserSearchPayload =
  | UserSearchItem[]
  | {
      data?: UserSearchItem[];
      users?: UserSearchItem[];
      results?: UserSearchItem[];
      items?: UserSearchItem[];
    };

export type UserSearchResult = {
  id?: string;
  label: string;
  secondary?: string;
};

function toText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toId(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'object' && value !== null && '$oid' in (value as Record<string, unknown>)) {
    const oid = (value as Record<string, unknown>).$oid;
    if (typeof oid === 'string' && oid.trim()) return oid.trim();
  }
  return null;
}

function extractUserResult(item: UserSearchItem): UserSearchResult | null {
  if (typeof item === 'string') {
    const label = toText(item);
    return label ? { label } : null;
  }

  const label =
    toText(item.username) ??
    toText(item.email) ??
    toText(item.displayName) ??
    toText(item.name) ??
    toText(item.fullName);
  if (!label) return null;

  const id = toId(item.id) ?? toId(item._id) ?? toId(item.userId) ?? undefined;
  const secondaryCandidates = [toText(item.email), toText(item.displayName), toText(item.fullName), toText(item.name)];
  const secondary = secondaryCandidates.find((value) => Boolean(value) && value !== label);
  return { id, label, ...(secondary ? { secondary } : {}) };
}

function extractItems(payload: UserSearchPayload): UserSearchItem[] {
  if (Array.isArray(payload)) return payload;
  if ('users' in payload && Array.isArray(payload.users)) return payload.users;
  if ('results' in payload && Array.isArray(payload.results)) return payload.results;
  if ('items' in payload && Array.isArray(payload.items)) return payload.items;
  if ('data' in payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

export async function searchUsers(query: string, limit = 8): Promise<UserSearchResult[]> {
  const normalized = query.trim();
  if (!normalized) return [];

  try {
    const path = `${USER_SEARCH_ENDPOINT}?q=${encodeURIComponent(normalized)}&limit=${encodeURIComponent(String(limit))}`;
    const payload = await apiGet<UserSearchPayload>(path);
    const seen = new Set<string>();
    const values: UserSearchResult[] = [];

    extractItems(payload).forEach((item) => {
      const value = extractUserResult(item);
      if (!value) return;
      const key = value.id ? `id:${value.id}` : `label:${value.label.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      values.push(value);
    });

    return values;
  } catch {
    return [];
  }
}
