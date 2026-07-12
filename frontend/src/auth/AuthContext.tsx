import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, type ApiError } from '@/lib/api';

/*
 * Session state for the whole app. Tokens live in localStorage (SPA + Core
 * on separate origins → Authorization header, not cookies) and refresh via
 * /auth/refresh. Social providers (Google first) will reuse this context —
 * only the acquisition step changes.
 */

export interface SessionUser {
  id: string;
  email: string;
}

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  user: SessionUser;
}

export interface Profile {
  display_name: string;
  locale: string;
  theme: string;
}

export interface SignupInput {
  email: string;
  password: string;
  displayName: string;
  locale: string;
  parentIntent: boolean;
}

interface SessionPayload {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: { id: string; email: string } | null;
}

interface AuthContextValue {
  /** undefined = still restoring from storage */
  session: StoredSession | null | undefined;
  profile: Profile | null;
  roles: string[];
  /** true once profile+roles for the current session have been fetched (or there is no session) */
  meLoaded: boolean;
  login(email: string, password: string): Promise<ApiError | null>;
  signup(input: SignupInput): Promise<{ error: ApiError | null; confirmationRequired: boolean }>;
  logout(): Promise<void>;
  /** Re-fetch profile + roles (e.g. after the Tutor upgrade). */
  refreshMe(): Promise<void>;
  /** Authorization for API calls; refreshes first when close to expiry. */
  getToken(): Promise<string | null>;
}

const STORAGE_KEY = 'lf.session.v1';
const AuthContext = createContext<AuthContextValue | null>(null);

function readStorage(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function toStored(payload: SessionPayload): StoredSession | null {
  if (!payload.user) return null;
  return {
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    expiresAt: Date.now() + payload.expiresIn * 1000,
    user: payload.user,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [meLoaded, setMeLoaded] = useState(false);
  const sessionRef = useRef<StoredSession | null>(null);

  const persist = useCallback((next: StoredSession | null) => {
    sessionRef.current = next;
    setSession(next);
    try {
      if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable (private mode) — session stays in memory */
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<StoredSession | null> => {
    const current = sessionRef.current;
    if (!current) return null;
    const { data } = await api<{ session: SessionPayload | null }>('/auth/refresh', {
      body: { refreshToken: current.refreshToken },
    });
    const next = data?.session ? toStored(data.session) : null;
    persist(next);
    return next;
  }, [persist]);

  const getToken = useCallback(async (): Promise<string | null> => {
    let current = sessionRef.current;
    if (!current) return null;
    if (current.expiresAt - Date.now() < 60_000) current = await refreshSession();
    return current?.accessToken ?? null;
  }, [refreshSession]);

  const loadMe = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setMeLoaded(true);
      return;
    }
    const { data } = await api<{ profile: Profile | null; roles: string[] }>('/auth/me', { token });
    if (data) {
      setProfile(data.profile);
      setRoles(data.roles);
    }
    setMeLoaded(true);
  }, [getToken]);

  // Restore once on mount.
  useEffect(() => {
    const stored = readStorage();
    sessionRef.current = stored;
    setSession(stored);
    if (stored) void loadMe();
    else setMeLoaded(true);
  }, [loadMe]);

  const login = useCallback(
    async (email: string, password: string): Promise<ApiError | null> => {
      const { data, error } = await api<{ session: SessionPayload | null }>('/auth/login', {
        body: { email, password },
      });
      if (error) return error;
      const next = data.session ? toStored(data.session) : null;
      if (!next) return { code: 'INTERNAL', message: 'No session returned' };
      persist(next);
      void loadMe();
      return null;
    },
    [persist, loadMe],
  );

  const signup = useCallback(
    async (input: SignupInput) => {
      const { data, error } = await api<{ session: SessionPayload | null; confirmationRequired: boolean }>(
        '/auth/signup',
        { body: input },
      );
      if (error) return { error, confirmationRequired: false };
      const next = data.session ? toStored(data.session) : null;
      if (next) {
        persist(next);
        void loadMe();
      }
      return { error: null, confirmationRequired: data.confirmationRequired };
    },
    [persist, loadMe],
  );

  const logout = useCallback(async () => {
    const token = sessionRef.current?.accessToken;
    persist(null);
    setProfile(null);
    setRoles([]);
    setMeLoaded(true);
    if (token) await api('/auth/logout', { method: 'POST', body: {}, token });
  }, [persist]);

  const value = useMemo<AuthContextValue>(
    () => ({ session, profile, roles, meLoaded, login, signup, logout, refreshMe: loadMe, getToken }),
    [session, profile, roles, meLoaded, login, signup, logout, loadMe, getToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
