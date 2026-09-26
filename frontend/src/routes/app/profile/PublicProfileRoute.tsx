import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { APP_HOME } from '@/app-shell/home';
import { PublicProfile, type ConnectView, type PublicPerson, type PublicProfileView, type RequestStatus, type SafetyView } from '@/rebuild/social/PublicProfile';
import type { ReportCategory } from '@/rebuild/social/ReportDialog';
import { resolveCover, resolveLook } from '@/rebuild/account/avatar/avatarKit';
import { isOffline, useProfileScreenEnvironment } from './profileRouteKit';

/*
 * /@username (P6): the data plane of the rebuilt public profile. Core's
 * GET /profiles/:username decides everything (E.1, E.5, E.8, E.13): whether
 * the profile exists for this viewer at all (one NOT_FOUND for "does not
 * exist", "blocked" and "not visible", never saying which), a private teen's
 * card, the Tutor verdict, and how this viewer may connect. The parser reads
 * only the fields the screen shows (E.13: a field Core might add later never
 * reaches the page by accident), and a malformed answer is a failure with a
 * retry, never a guessed profile. Every action is confirmed by Core's receipt
 * before the page changes.
 */

const USERNAME = /^[a-z0-9_]{3,20}$/;
const MODES = ['follow', 'guardianRequest', 'teenRequest', 'managed', 'none'] as const;
type Mode = (typeof MODES)[number];

const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export type ParsedPublicProfile =
  | { kind: 'private'; username: string; look: PublicPerson['look']; cover: PublicPerson['cover']; mode: Mode; requestPending: boolean }
  | { kind: 'full'; person: PublicPerson; mode: Mode; isFollowing: boolean; guardianTier: boolean; self: boolean };

/** Core's answer, checked field by field. `null` when anything the screen relies on is missing or malformed. */
export function parsePublicProfile(raw: unknown, locale: string, requested: string): ParsedPublicProfile | null {
  if (!isRecord(raw) || typeof raw.username !== 'string' || raw.username !== requested) return null;
  const avatar = isRecord(raw.avatarOptions) ? raw.avatarOptions : {};
  const look = resolveLook(avatar, raw.username);
  const cover = resolveCover(raw.cover);
  const mode = (MODES as readonly unknown[]).includes(raw.connection) ? raw.connection as Mode : null;
  if (raw.visibility === 'private') {
    if (typeof raw.requestPending !== 'boolean') return null;
    return { kind: 'private', username: raw.username, look, cover, mode: mode ?? 'none', requestPending: raw.requestPending };
  }
  if (raw.visibility !== undefined && raw.visibility !== 'full') return null;
  if (typeof raw.displayName !== 'string' || typeof raw.isFollowing !== 'boolean' || typeof raw.isSelf !== 'boolean' || typeof raw.isTutor !== 'boolean') return null;
  const stats = isRecord(raw.learningStats) ? raw.learningStats : null;
  if (!stats) return null;
  const streakDays = count(stats.streakDays), lessonsCompleted = count(stats.lessonsCompleted);
  const xpPoints = count(stats.xpPoints), minutesLearned = count(stats.minutesLearned);
  if (streakDays === null || lessonsCompleted === null || xpPoints === null || minutesLearned === null) return null;
  const badges = Array.isArray(raw.courseBadges) ? raw.courseBadges.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.slug !== 'string' || !isRecord(entry.title)) return [];
    const titles = entry.title;
    const title = [titles[locale], titles['en-US']].find((value): value is string => typeof value === 'string' && value.length > 0) ?? entry.slug;
    return [{ slug: entry.slug, title, completedAt: typeof entry.completedAt === 'string' ? entry.completedAt : null }];
  }) : [];
  const guardianTier = raw.requiresGuardianApproval === true;
  return {
    kind: 'full',
    person: {
      displayName: raw.displayName, username: raw.username, memberSince: typeof raw.memberSince === 'string' ? raw.memberSince : null,
      look, cover, tutor: raw.isTutor, stats: { streakDays, lessonsCompleted, xpPoints, minutesLearned }, badges,
    },
    // An older Core answer without `connection` keeps the earlier child-only rule.
    mode: mode ?? (guardianTier ? 'guardianRequest' : 'follow'),
    isFollowing: raw.isFollowing, guardianTier, self: raw.isSelf,
  };
}

/** How the viewer may connect, from the parsed answer. */
export function connectFor(parsed: ParsedPublicProfile): ConnectView {
  if (parsed.kind === 'private') {
    if (parsed.mode === 'teenRequest') return { kind: 'request', decidedBy: 'subject', status: parsed.requestPending ? 'pending' : 'idle' };
    return parsed.mode === 'managed' ? { kind: 'managed' } : { kind: 'none' };
  }
  if (parsed.self) return { kind: 'self' };
  // Unfollowing a child or a private teen ends what this viewer can see of them.
  if (parsed.isFollowing) return { kind: 'follow', following: true, leaving: parsed.guardianTier || parsed.mode === 'teenRequest', busy: false, error: null };
  switch (parsed.mode) {
    case 'follow': return { kind: 'follow', following: false, leaving: false, busy: false, error: null };
    case 'guardianRequest': return { kind: 'request', decidedBy: 'guardian', status: 'idle' };
    case 'teenRequest': return { kind: 'request', decidedBy: 'subject', status: 'idle' };
    case 'managed': return { kind: 'managed' };
    default: return { kind: 'none' };
  }
}

const REQUEST_REFUSALS: Record<string, RequestStatus> = {
  SOCIAL_REQUEST_COOLDOWN: 'cooldown',
  SOCIAL_REQUEST_LIMIT: 'limit',
  SOCIAL_ALREADY_CONNECTED: 'connected',
  PROFILE_REVIEW_REQUIRED: 'review',
};

export function PublicProfileRoute() {
  const { handle = '' } = useParams();
  const { session } = useAuth();
  // Only /@username is a profile address; anything else goes home, as before.
  if (!handle.startsWith('@')) return <Navigate to={APP_HOME} replace />;
  const username = handle.slice(1).toLowerCase();
  return session ? <ScopedPublicProfile key={`${session.user.id}:${username}`} username={username} /> : null;
}

function ScopedPublicProfile({ username }: { username: string }) {
  const { getToken } = useAuth();
  const { locale, dark, copy, ageBand } = useProfileScreenEnvironment();
  const navigate = useNavigate();
  const [view, setView] = useState<PublicProfileView>({ kind: 'loading' });
  const [safety, setSafety] = useState<SafetyView>({ blockFailed: false, reported: false });
  const [attempt, setAttempt] = useState(0);
  const busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  useEffect(() => {
    let cancelled = false;
    if (!USERNAME.test(username)) { setView({ kind: 'unavailable' }); return; }
    void (async () => {
      const token = await getToken();
      const result = token ? await api<unknown>(`/profiles/${username}`, { token }) : null;
      if (cancelled) return;
      if (result?.error?.code === 'NOT_FOUND') { setView({ kind: 'unavailable' }); return; }
      const parsed = result?.data ? parsePublicProfile(result.data, locale, username) : null;
      if (!parsed) { setView({ kind: 'failed', offline: isOffline(result?.error), retrying: false }); return; }
      const connect = connectFor(parsed);
      setView(parsed.kind === 'private'
        ? { kind: 'private', username: parsed.username, look: parsed.look, cover: parsed.cover, connect }
        : { kind: 'full', person: parsed.person, connect, self: parsed.self });
    })();
    return () => { cancelled = true; };
  }, [getToken, username, locale, attempt]);

  const setConnect = useCallback((update: (connect: ConnectView) => ConnectView) => {
    setView((current) => current.kind === 'full' || current.kind === 'private' ? { ...current, connect: update(current.connect) } : current);
  }, []);

  const follow = useCallback(async (on: boolean) => {
    if (busy.current || view.kind !== 'full' || view.connect.kind !== 'follow') return;
    const leaving = view.connect.leaving;
    busy.current = true;
    setConnect((connect) => connect.kind === 'follow' ? { ...connect, busy: true, error: null } : connect);
    const token = await getToken();
    const result = token ? await api<{ following?: unknown }>(`/profiles/${username}/follow`, { method: on ? 'POST' : 'DELETE', token }) : null;
    busy.current = false;
    if (!alive.current) return;
    if (result?.data && result.data.following === on) {
      // The profile of a child or a private teen is no longer visible to this account once it stops following.
      if (!on && leaving) { navigate(APP_HOME, { replace: true }); return; }
      setConnect((connect) => connect.kind === 'follow' ? { ...connect, following: on, busy: false, error: null } : connect);
      return;
    }
    const code = result?.error?.code;
    if (code === 'GUARDIAN_MANAGED_CONNECTIONS') { setConnect(() => ({ kind: 'managed' })); return; }
    setConnect((connect) => connect.kind === 'follow' ? { ...connect, busy: false, error: code === 'PROFILE_REVIEW_REQUIRED' ? 'review' : 'failed' } : connect);
  }, [getToken, navigate, setConnect, username, view]);

  const ask = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setConnect((connect) => connect.kind === 'request' ? { ...connect, status: 'saving' } : connect);
    const token = await getToken();
    const result = token ? await api<Record<string, unknown>>(`/profiles/${username}/connection-request`, { method: 'POST', token, body: {} }) : null;
    busy.current = false;
    if (!alive.current) return;
    const receipt = result?.data;
    // Only a pending receipt that made no follow is a success (E.1, E.8).
    if (receipt && typeof receipt.requestId === 'string' && receipt.status === 'pending' && receipt.following === false) {
      setConnect((connect) => connect.kind === 'request' ? { ...connect, status: 'pending' } : connect);
      return;
    }
    const code = result?.error?.code ?? '';
    if (code === 'GUARDIAN_MANAGED_CONNECTIONS') { setConnect(() => ({ kind: 'managed' })); return; }
    setConnect((connect) => connect.kind === 'request' ? { ...connect, status: REQUEST_REFUSALS[code] ?? 'failed' } : connect);
  }, [getToken, setConnect, username]);

  const block = useCallback(async () => {
    setSafety((current) => ({ ...current, blockFailed: false }));
    const token = await getToken();
    const result = token ? await api<{ blocked?: unknown }>(`/profiles/${username}/block`, { method: 'POST', token }) : null;
    if (!alive.current) return;
    // A block hides both profiles from each other: this page no longer exists for this account.
    if (result?.data?.blocked === true) { navigate(APP_HOME, { replace: true }); return; }
    setSafety((current) => ({ ...current, blockFailed: true }));
  }, [getToken, navigate, username]);

  const report = useCallback(async (category: ReportCategory, note: string | null) => {
    const token = await getToken();
    const result = token ? await api<{ reported?: unknown }>(`/profiles/${username}/report`, { method: 'POST', token, body: note === null ? { category } : { category, note } }) : null;
    const sent = result?.data?.reported === true;
    if (sent && alive.current) setSafety((current) => ({ ...current, reported: true }));
    return sent;
  }, [getToken, username]);

  return <PublicProfile copy={copy.publicProfile} reportCopy={copy.report} locale={locale} dark={dark} ageBand={ageBand} homeHref={APP_HOME}
    view={view} safety={safety} onFollow={() => void follow(true)} onUnfollow={() => void follow(false)} onAsk={() => void ask()}
    onBlock={block} onReport={report} onNavigate={(href) => navigate(href)}
    onRetry={() => { setView({ kind: 'failed', offline: false, retrying: true }); setAttempt((value) => value + 1); }} />;
}
