import { API_URL } from '@/config/api';

// ─── In-memory auth state (never persisted to localStorage / sessionStorage) ───

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

type TokenListener = (token: string | null) => void;
const listeners = new Set<TokenListener>();

function notifyListeners(token: string | null) {
  listeners.forEach((cb) => cb(token));
}

// ─── Public API ────────────────────────────────────────────────────────────────

export function setAccessToken(token: string | null) {
  accessToken = token;
  notifyListeners(token);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function onTokenChange(cb: TokenListener): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** Initialize on page load — tries to refresh the token via cookie. */
export async function initSession(): Promise<string | null> {
  return getOrRefreshToken();
}

// ─── Silent refresh (cookie-based, no user interaction) ────────────────────────

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = await res.json();
    accessToken = data.access_token;

    // Keep legacy localStorage token in sync for backward compat
    if (data.access_token) {
      localStorage.setItem('token', data.access_token);
    }
    if (data.user) {
      localStorage.setItem('user', JSON.stringify(data.user));
    }

    notifyListeners(accessToken);
    return accessToken;
  } catch {
    return null;
  }
}

/**
 * Returns a valid access token, refreshing from the cookie if necessary.
 * Queues concurrent calls so only one refresh request is in-flight at a time.
 */
async function getOrRefreshToken(): Promise<string | null> {
  if (accessToken) return accessToken;

  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// ─── Authenticated fetch ───────────────────────────────────────────────────────

export async function apiFetch(
  url: string,
  options: RequestInit = {},
  retried = false,
): Promise<Response> {
  const absoluteUrl = url.startsWith('http') ? url : `${API_URL}${url}`;

  const headers = new Headers(options.headers as HeadersInit);
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  let res = await fetch(absoluteUrl, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status === 401 && !retried && accessToken) {
    // Token likely expired — refresh and retry once
    accessToken = null;
    const newToken = await getOrRefreshToken();
    if (newToken && !absoluteUrl.endsWith('/auth/refresh')) {
      headers.set('Authorization', `Bearer ${newToken}`);
      return apiFetch(url, options, true); // retried=true prevents loops
    }
  }

  return res;
}

// ─── Logout ────────────────────────────────────────────────────────────────────

export async function apiLogout(): Promise<void> {
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
  } catch {
    // Best-effort — clear local state regardless
  }
  accessToken = null;
  notifyListeners(null);
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}
