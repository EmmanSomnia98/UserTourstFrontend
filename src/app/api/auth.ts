import { apiPost, setAuthSession, type AuthSession } from '@/app/api/client';

export type AuthUser = {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
};

type AuthPayload =
  | AuthSession<AuthUser>
  | { data?: AuthSession<AuthUser> }
  | { token?: string; user?: AuthUser }
  | { accessToken?: string; user?: AuthUser };

function normalizeAuth(payload: AuthPayload): AuthSession<AuthUser> {
  if (!payload) return {};
  if ('data' in payload && payload.data) return payload.data;
  if ('accessToken' in payload) return { token: payload.accessToken, user: payload.user };
  if ('token' in payload || 'user' in payload) return payload as AuthSession<AuthUser>;
  return {};
}

export async function registerUser(name: string, email: string, password: string) {
  const payload = await apiPost<AuthPayload>('/api/auth/register', { fullName: name, email, password });
  const session = normalizeAuth(payload);
  if (session.token || session.user) {
    setAuthSession(session.token, session.user);
  }
  return session;
}

export async function loginUser(email: string, password: string) {
  const payload = await apiPost<AuthPayload>('/api/auth/login', { email, password });
  const session = normalizeAuth(payload);
  if (session.token || session.user) {
    setAuthSession(session.token, session.user);
  }
  return session;
}
