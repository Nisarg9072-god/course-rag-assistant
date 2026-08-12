import { apiFetch, USE_MOCK } from './client';

const TOKEN_KEY = 'course_rag_admin_token';

export function getAdminToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

export function isAdminAuthenticated(): boolean {
  return USE_MOCK || Boolean(getAdminToken());
}

export async function adminLogin(password: string): Promise<{ token: string }> {
  if (USE_MOCK) {
    setAdminToken('mock-token');
    return { token: 'mock-token' };
  }
  const res = await apiFetch<{ token: string }>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  setAdminToken(res.token);
  return res;
}

export async function adminLogout(): Promise<void> {
  const token = getAdminToken();
  clearAdminToken();
  if (USE_MOCK || !token) return;
  try {
    await apiFetch('/api/admin/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    /* ignore */
  }
}

export async function checkAdminSession(): Promise<boolean> {
  if (USE_MOCK) return true;
  const token = getAdminToken();
  if (!token) return false;
  try {
    await apiFetch<{ authenticated: boolean }>('/api/admin/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return true;
  } catch {
    clearAdminToken();
    return false;
  }
}
