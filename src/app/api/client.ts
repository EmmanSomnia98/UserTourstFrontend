export const REMOTE_API_BASE_URL = 'https://backend-thesis-userxadmin-new.vercel.app';
const AUTH_TOKEN_KEY = 'bw_auth_token';
const AUTH_USER_KEY = 'bw_auth_user';
export const AUTH_CHANGE_EVENT = 'bw-auth-change';

const DEFAULT_API_BASE_URL = import.meta.env.DEV ? '' : REMOTE_API_BASE_URL;
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
const ASSET_BASE_URL = (import.meta.env.VITE_ASSET_BASE_URL || REMOTE_API_BASE_URL).replace(/\/+$/, '');

export function resolveAssetUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  const raw = value.trim();
  if (!raw) return '';

  if (
    raw.startsWith('http://') ||
    raw.startsWith('https://') ||
    raw.startsWith('data:') ||
    raw.startsWith('blob:')
  ) {
    return raw;
  }

  if (raw.startsWith('//')) {
    return `https:${raw}`;
  }

  if (raw.startsWith('/')) {
    return `${ASSET_BASE_URL}${raw}`;
  }

  return `${ASSET_BASE_URL}/${raw}`;
}

export type AuthSession<UserShape = unknown> = {
  token?: string;
  user?: UserShape;
};

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getAuthUser<UserShape = unknown>(): UserShape | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? (JSON.parse(raw) as UserShape) : null;
  } catch {
    return null;
  }
}

export function setAuthSession<UserShape = unknown>(token?: string, user?: UserShape) {
  try {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
    if (user !== undefined) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_USER_KEY);
    }
  } catch {
    // Swallow storage errors (private mode, disabled storage, etc.)
  } finally {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
    }
  }
}

export function clearAuthSession() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  } catch {
    // no-op
  } finally {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
    }
  }
}

function buildHeaders(headers: HeadersInit = {}, includeAuth = true) {
  const token = includeAuth ? getAuthToken() : null;
  return {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };
}

function isInvalidTokenResponse(status: number, body: string): boolean {
  if (status !== 401 && status !== 403) return false;
  const normalized = body.toLowerCase();
  return (
    normalized.includes('invalid') ||
    normalized.includes('expired') ||
    normalized.includes('token') ||
    normalized.includes('jwt') ||
    normalized.includes('unauthorized')
  );
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  includeAuth = true,
  allowRetryWithoutAuth = true
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: options.credentials ?? 'omit',
    headers: buildHeaders(options.headers, includeAuth),
  });

  if (!response.ok) {
    const text = await response.text();
    const hadAuthToken = includeAuth && Boolean(getAuthToken());
    const invalidToken = hadAuthToken && isInvalidTokenResponse(response.status, text);

    if (invalidToken) {
      clearAuthSession();
      if (allowRetryWithoutAuth) {
        return apiRequest<T>(path, options, false, false);
      }
    }

    throw new Error(`Request failed (${response.status}): ${text || response.statusText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

export async function apiGet<T>(path: string, options: RequestInit = {}): Promise<T> {
  return apiRequest<T>(path, { ...options, method: 'GET' });
}

export async function apiPost<T>(path: string, body: unknown, options: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers = isFormData ? options.headers : { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const payload = isFormData ? body : JSON.stringify(body);
  return apiRequest<T>(path, {
    ...options,
    method: 'POST',
    headers,
    body: payload,
  });
}

export async function apiDelete<T = void>(path: string, options: RequestInit = {}): Promise<T> {
  return apiRequest<T>(path, { ...options, method: 'DELETE' });
}
