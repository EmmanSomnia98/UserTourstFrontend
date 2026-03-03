import { apiGet } from '@/app/api/client';

const USER_SEARCH_ENDPOINT =
  (import.meta.env.VITE_USER_SEARCH_ENDPOINT as string | undefined) ?? '/api/users/search';

type UserSearchItem =
  | string
  | {
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

function toText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function extractDisplayValue(item: UserSearchItem): string | null {
  if (typeof item === 'string') return toText(item);
  return (
    toText(item.username) ??
    toText(item.email) ??
    toText(item.displayName) ??
    toText(item.name) ??
    toText(item.fullName)
  );
}

function extractItems(payload: UserSearchPayload): UserSearchItem[] {
  if (Array.isArray(payload)) return payload;
  if ('users' in payload && Array.isArray(payload.users)) return payload.users;
  if ('results' in payload && Array.isArray(payload.results)) return payload.results;
  if ('items' in payload && Array.isArray(payload.items)) return payload.items;
  if ('data' in payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

export async function searchUsers(query: string, limit = 8): Promise<string[]> {
  const normalized = query.trim();
  if (!normalized) return [];

  try {
    const path = `${USER_SEARCH_ENDPOINT}?q=${encodeURIComponent(normalized)}&limit=${encodeURIComponent(String(limit))}`;
    const payload = await apiGet<UserSearchPayload>(path);
    const seen = new Set<string>();
    const values: string[] = [];

    extractItems(payload).forEach((item) => {
      const value = extractDisplayValue(item);
      if (!value) return;
      const key = value.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      values.push(value);
    });

    return values;
  } catch {
    return [];
  }
}
