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
import { getAnonId } from '@/lib/visitor';
import { clearCoursesCache } from '@/routes/app/learn/coursesCache';

/*
 * Session state for the whole app. Tokens live in localStorage (SPA + Core
 * on separate origins → Authorization header, not cookies) and refresh via
 * /auth/refresh. Social providers (Google first) will reuse this context —
 * only the acquisition step changes.
 */

export interface SessionUser {
  id: string;
  /** undefined for a guest session — GoTrue never issues an email for one. */
  email?: string;
}

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  user: SessionUser;
  /** Decoded from the JWT's is_anonymous claim at persist time (see jwtClaims) — a guest session, never the unrelated pre-signup lf_aid marketing visitor id. Confirmed authoritatively by /auth/me once it resolves. */
  isGuest: boolean;
}

export interface Profile {
  display_name: string;
  username: string | null;
  locale: string;
  theme: string;
  cover: Record<string, unknown>;
}

export interface SignupInput {
  email: string;
  password: string;
  displayName: string;
  locale: string;
  parentIntent: boolean;
  /** ISO date. Core SCREENS on it and discards it; it is never persisted. */
  birthDate: string;
}

interface SessionPayload {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: { id: string; email: string | null } | null;
}

interface AuthContextValue {
  /** undefined = still restoring from storage */
  session: StoredSession | null | undefined;
  profile: Profile | null;
  roles: string[];
  /** DiceBear Avataaars option set (empty until the user customizes). */
  avatarOptions: Record<string, unknown>;
  /** true once profile+roles for the current session have been fetched (or there is no session) */
  meLoaded: boolean;
  /** Whether the usage beacon may transmit for this account (/INSIGHTS.md). Kids: only with active guardian consent. */
  analyticsEnabled: boolean;
  /** True for a guest (GoTrue anonymous) session — never the unrelated pre-signup lf_aid marketing visitor id. */
  isGuest: boolean;
  /** Whether this account has completed the onboarding wizard. Guest-only concept — a real account is always effectively "onboarded" via signup, never redirected to /onboarding regardless of this flag. */
  onboardingComplete: boolean;
  /** Start using the platform with zero signup friction (Duolingo-style guest). */
  startGuestSession(): Promise<{ error: ApiError | null; analyticsEnabled: boolean }>;
  /** Attach a permanent email+password identity to the CURRENT guest session, in place — never /signup, which would mint a second, blank identity. */
  upgradeAccount(input: { email: string; password: string }): Promise<{ error: ApiError | null }>;
  /** `identifier` is an email for an adult or a username for a child. */
  login(identifier: string, password: string): Promise<{ error: ApiError | null; analyticsEnabled: boolean }>;
  signup(
    input: SignupInput,
  ): Promise<{ error: ApiError | null; confirmationRequired: boolean; analyticsEnabled: boolean }>;
  /** Establish a session from OAuth tokens returned to /auth/callback (social login). */
  completeOAuth(
    tokens: { accessToken: string; refreshToken: string; expiresIn: number },
  ): Promise<{ error: ApiError | null; newAccount: boolean; analyticsEnabled: boolean }>;
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
    user: { id: payload.user.id, email: payload.user.email ?? undefined },
    isGuest: jwtClaims(payload.accessToken).is_anonymous === true,
  };
}

/** Read {id,email,is_anonymous} from a GoTrue access-token JWT (claims only — Core verifies on every API call). */
function jwtClaims(token: string): { sub?: string; email?: string; is_anonymous?: boolean } {
  try {
    const part = token.split('.')[1];
    if (!part) return {};
    const claims = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
    return {
      sub: typeof claims.sub === 'string' ? claims.sub : undefined,
      email: typeof claims.email === 'string' ? claims.email : undefined,
      is_anonymous: claims.is_anonymous === true,
    };
  } catch {
    return {};
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [avatarOptions, setAvatarOptions] = useState<Record<string, unknown>>({});
  const [meLoaded, setMeLoaded] = useState(false);
  // Fail-closed default: the beacon stays silent until /me confirms it may run.
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
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

  const loadMe = useCallback(async (): Promise<{ newAccount: boolean; analyticsEnabled: boolean }> => {
    const token = await getToken();
    if (!token) {
      setMeLoaded(true);
      return { newAccount: false, analyticsEnabled: false };
    }
    const { data } = await api<{
      profile: Profile | null;
      roles: string[];
      avatarOptions: Record<string, unknown>;
      analyticsEnabled?: boolean;
      newAccount?: boolean;
      onboardingComplete?: boolean;
    }>('/auth/me', { token });
    const resolvedAnalyticsEnabled = data?.analyticsEnabled ?? false;
    if (data) {
      setProfile(data.profile);
      setRoles(data.roles);
      setAvatarOptions(data.avatarOptions ?? {});
      setAnalyticsEnabled(resolvedAnalyticsEnabled);
      setOnboardingComplete(data.onboardingComplete === true);
    }
    setMeLoaded(true);
    // Core's verdict on "was this account created just now" — the OAuth
    // landing needs it to pick the right funnel event and cannot tell on its
    // own. analyticsEnabled is returned alongside it (not just left in state)
    // because completeOAuth's caller must configure the insights beacon with
    // the FRESH value the instant it's known — waiting for the next render's
    // useInsightsBeacon effect to pick it up from context left a signup/
    // login funnel event sitting in insights.ts's pre-consent buffer, which
    // configureInsights() can legitimately wipe if analyticsEnabled is false.
    return { newAccount: data?.newAccount === true, analyticsEnabled: resolvedAnalyticsEnabled };
  }, [getToken]);

  // Restore once on mount.
  useEffect(() => {
    const stored = readStorage();
    sessionRef.current = stored;
    setSession(stored);
    if (stored) void loadMe();
    else setMeLoaded(true);
  }, [loadMe]);

  const startGuestSession = useCallback(async (): Promise<{ error: ApiError | null; analyticsEnabled: boolean }> => {
    const { data, error } = await api<{ session: SessionPayload | null }>('/auth/guest', { method: 'POST', body: {} });
    if (error) return { error, analyticsEnabled: false };
    const next = data.session ? toStored(data.session) : null;
    if (!next) return { error: { code: 'INTERNAL', message: 'No session returned' }, analyticsEnabled: false };
    // See login(): fail-closed during the identity switch.
    setMeLoaded(false);
    setAnalyticsEnabled(false);
    persist(next);
    const { analyticsEnabled } = await loadMe();
    return { error: null, analyticsEnabled };
  }, [persist, loadMe]);

  const upgradeAccount = useCallback(
    async (input: { email: string; password: string }): Promise<{ error: ApiError | null }> => {
      const current = sessionRef.current;
      if (!current) return { error: { code: 'UNAUTHORIZED', message: 'No active session' } };
      const anonId = getAnonId() ?? undefined;
      const { data, error } = await api<{ session: SessionPayload | null }>('/auth/upgrade', {
        body: { ...input, refreshToken: current.refreshToken, anonId },
        token: current.accessToken,
      });
      if (error) return { error };
      const next = data.session ? toStored(data.session) : null;
      if (!next) return { error: { code: 'INTERNAL', message: 'No session returned' } };
      // Same identity, upgraded in place — no fail-closed reset needed (unlike
      // login/signup/startGuestSession, this is not an identity SWITCH), but
      // meLoaded still needs a fresh /me pass since roles/profile can now
      // reflect a permanent account.
      persist(next);
      await loadMe();
      return { error: null };
    },
    [persist, loadMe],
  );

  const login = useCallback(
    async (email: string, password: string): Promise<{ error: ApiError | null; analyticsEnabled: boolean }> => {
      const { data, error } = await api<{ session: SessionPayload | null }>('/auth/login', {
        // `identifier`, because a child signs in with the username their
        // parent chose and has no mailbox to use instead. Core disambiguates
        // on `@`, which `profiles.username` cannot contain (migration 0005).
        body: { identifier: email, password },
      });
      if (error) return { error, analyticsEnabled: false };
      const next = data.session ? toStored(data.session) : null;
      if (!next) return { error: { code: 'INTERNAL', message: 'No session returned' }, analyticsEnabled: false };
      // Fail-closed during the identity switch: without this, a same-tab
      // login while meLoaded is already true from a prior identity leaves
      // `ready` (meLoaded && !!session) true with the PREVIOUS identity's
      // analyticsEnabled still in state until this loadMe() resolves.
      setMeLoaded(false);
      setAnalyticsEnabled(false);
      persist(next);
      // Awaited (not fire-and-forget) so the caller has the FRESH
      // analyticsEnabled value in hand before it configures the insights
      // beacon and tracks login_complete — see AuthCallbackPage's comment
      // for why waiting on the next render's effect isn't good enough.
      const { analyticsEnabled } = await loadMe();
      return { error: null, analyticsEnabled };
    },
    [persist, loadMe],
  );

  const signup = useCallback(
    async (input: SignupInput) => {
      // Attribution: carry the first-party visitor id so Core can link this
      // signup to the channel that produced it (/INSIGHTS.md §7). Null
      // without cookie consent — attribution is opt-in like everything else.
      const anonId = getAnonId() ?? undefined;
      const { data, error } = await api<{ session: SessionPayload | null; confirmationRequired: boolean }>(
        '/auth/signup',
        { body: { ...input, anonId } },
      );
      if (error) return { error, confirmationRequired: false, analyticsEnabled: false };
      const next = data.session ? toStored(data.session) : null;
      let analyticsEnabled = false;
      if (next) {
        // See login(): fail-closed during the identity switch, and awaited
        // (not fire-and-forget) so the caller has the fresh value in hand
        // before configuring the insights beacon and tracking signup_complete.
        setMeLoaded(false);
        setAnalyticsEnabled(false);
        persist(next);
        ({ analyticsEnabled } = await loadMe());
      }
      return { error: null, confirmationRequired: data.confirmationRequired, analyticsEnabled };
    },
    [persist, loadMe],
  );

  /*
   * loadMe returns a value only completeOAuth cares about; refreshMe is the
   * public "re-fetch my profile" affordance and stays void so no caller can
   * mistake a stale newAccount flag for meaningful state.
   */
  const refreshMe = useCallback(async (): Promise<void> => {
    await loadMe();
  }, [loadMe]);

  const completeOAuth = useCallback(
    async (
      tokens: { accessToken: string; refreshToken: string; expiresIn: number },
    ): Promise<{ error: ApiError | null; newAccount: boolean; analyticsEnabled: boolean }> => {
      const { sub, email, is_anonymous } = jwtClaims(tokens.accessToken);
      if (!sub) {
        return { error: { code: 'INTERNAL', message: 'Invalid session token' }, newAccount: false, analyticsEnabled: false };
      }
      // See login(): fail-closed during the identity switch.
      setMeLoaded(false);
      setAnalyticsEnabled(false);
      persist({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: Date.now() + tokens.expiresIn * 1000,
        user: { id: sub, email },
        isGuest: is_anonymous === true,
      });
      const { newAccount, analyticsEnabled } = await loadMe();
      return { error: null, newAccount, analyticsEnabled };
    },
    [persist, loadMe],
  );

  const logout = useCallback(async () => {
    const token = sessionRef.current?.accessToken;
    // Progress is personal: a cache that outlived a sign-out would show the
    // next account this one's shelf. The cache checks the user id too, but one
    // child seeing another's progress is not a thing to leave to a single guard.
    clearCoursesCache();
    persist(null);
    setProfile(null);
    setRoles([]);
    setAnalyticsEnabled(false);
    setMeLoaded(true);
    if (token) await api('/auth/logout', { method: 'POST', body: {}, token });
  }, [persist]);

  const isGuest = session?.isGuest === true;

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      roles,
      avatarOptions,
      meLoaded,
      analyticsEnabled,
      isGuest,
      onboardingComplete,
      startGuestSession,
      upgradeAccount,
      login,
      signup,
      completeOAuth,
      logout,
      refreshMe,
      getToken,
    }),
    [
      session,
      profile,
      roles,
      avatarOptions,
      meLoaded,
      analyticsEnabled,
      isGuest,
      onboardingComplete,
      startGuestSession,
      upgradeAccount,
      login,
      signup,
      completeOAuth,
      logout,
      refreshMe,
      getToken,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
