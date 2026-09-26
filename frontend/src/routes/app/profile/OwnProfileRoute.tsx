import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { OwnProfile, type InviteStatus, type OwnProfileData, type OwnProfileView, type SocialTier } from '@/rebuild/account/OwnProfile';
import { resolveCover, resolveLook } from '@/rebuild/account/avatar/avatarKit';
import { isOffline, useProfileScreenEnvironment } from './profileRouteKit';
import { TeenConnectionsPanel } from './TeenConnectionsPanel';
import { ProfileSafetyControl } from './SocialTierNotes';

/*
 * /profile (P1): the data plane of the rebuilt own-profile screen. Core's
 * GET /profile decides everything the screen shows (the tier, the E.13
 * review, the badges); an answer that does not have the expected shape is a
 * failure with a retry, never a guessed profile.
 */

interface WireProfile {
  displayName: unknown; username: unknown; memberSince: unknown; avatarOptions: unknown; cover: unknown;
  learningStats: { xpPoints: unknown; minutesLearned: unknown; lessonsCompleted: unknown; streakDays: unknown } | null;
  courseBadges?: unknown;
  social?: { tier?: unknown } | null;
  profileReview?: { flagged?: unknown; fields?: unknown } | null;
}

const TIERS = ['guardian', 'teen', 'adult', 'closed'] as const;
const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null);

export interface ParsedProfile { data: OwnProfileData; review: ('username' | 'displayName')[] }

/** Core's answer, checked field by field. `null` when anything the screen relies on is missing. */
export function parseOwnProfile(raw: unknown, locale: string, seed: string, tutor: boolean): ParsedProfile | null {
  const wire = raw as WireProfile | null;
  if (!wire || typeof wire.displayName !== 'string' || typeof wire.memberSince !== 'string') return null;
  if (!(wire.username === null || typeof wire.username === 'string')) return null;
  const stats = wire.learningStats;
  if (!stats) return null;
  const streakDays = count(stats.streakDays), lessonsCompleted = count(stats.lessonsCompleted);
  const xpPoints = count(stats.xpPoints), minutesLearned = count(stats.minutesLearned);
  if (streakDays === null || lessonsCompleted === null || xpPoints === null || minutesLearned === null) return null;
  const badges = Array.isArray(wire.courseBadges) ? wire.courseBadges.flatMap((entry) => {
    const badge = entry as { slug?: unknown; title?: unknown; completedAt?: unknown };
    if (typeof badge.slug !== 'string' || !badge.title || typeof badge.title !== 'object') return [];
    const titles = badge.title as Record<string, unknown>;
    const title = [titles[locale], titles['en-US']].find((value): value is string => typeof value === 'string' && value.length > 0) ?? badge.slug;
    return [{ slug: badge.slug, title, completedAt: typeof badge.completedAt === 'string' ? badge.completedAt : null }];
  }) : [];
  const tier = (TIERS as readonly unknown[]).includes(wire.social?.tier) ? wire.social!.tier as SocialTier : null;
  const review = wire.profileReview?.flagged === true && Array.isArray(wire.profileReview.fields)
    ? wire.profileReview.fields.filter((field): field is 'username' | 'displayName' => field === 'username' || field === 'displayName') : [];
  const avatar = wire.avatarOptions && typeof wire.avatarOptions === 'object' ? wire.avatarOptions as Record<string, unknown> : {};
  return {
    data: {
      displayName: wire.displayName, username: wire.username, memberSince: wire.memberSince,
      look: resolveLook(avatar, seed), cover: resolveCover(wire.cover),
      stats: { streakDays, lessonsCompleted, xpPoints, minutesLearned }, badges, tier, tutor,
    },
    review,
  };
}

export function OwnProfileRoute() {
  const { session } = useAuth();
  return session ? <ScopedOwnProfile key={session.user.id} /> : null;
}

function ScopedOwnProfile() {
  const { session, roles, getToken } = useAuth();
  const { locale, dark, copy, ageBand } = useProfileScreenEnvironment();
  const navigate = useNavigate();
  const seed = session?.user.id ?? 'littlefounder';
  const tutor = roles.includes('parent');
  const [view, setView] = useState<OwnProfileView>({ kind: 'loading' });
  const [review, setReview] = useState<('username' | 'displayName')[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [invite, setInvite] = useState<InviteStatus>('idle');
  const inviteTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getToken();
      const result = token ? await api<unknown>('/profile', { token }) : null;
      if (cancelled) return;
      const parsed = result?.data ? parseOwnProfile(result.data, locale, seed, tutor) : null;
      if (!parsed) { setView({ kind: 'failed', offline: isOffline(result?.error), retrying: false }); return; }
      setReview(parsed.review);
      setView({ kind: 'ready', data: parsed.data });
    })();
    return () => { cancelled = true; };
  }, [getToken, attempt, locale, seed, tutor]);

  useEffect(() => () => { if (inviteTimer.current !== null) window.clearTimeout(inviteTimer.current); }, []);

  const copyInvite = useCallback(async (text: string) => {
    if (inviteTimer.current !== null) window.clearTimeout(inviteTimer.current);
    try {
      await navigator.clipboard.writeText(text);
      setInvite('copied');
    } catch {
      setInvite('failed');
    }
    inviteTimer.current = window.setTimeout(() => setInvite('idle'), 5000);
  }, []);

  const tier = view.kind === 'ready' ? view.data.tier : null;
  // E.13: the owner (a minor) learns which field keeps their profile hidden.
  const safetyNotice = review.length > 0 && (tier === 'teen' || tier === 'guardian')
    ? <ProfileSafetyControl audience={tier === 'teen' ? 'self' : 'kidSelf'} fields={review} /> : null;
  // E.8: the self-registered teen manages their own connection requests.
  const connections = tier === 'teen' ? <TeenConnectionsPanel /> : null;

  return <OwnProfile copy={copy.ownProfile} locale={locale} dark={dark} ageBand={ageBand} view={view} origin={window.location.origin}
    invite={invite} safetyNotice={safetyNotice} connections={connections} onNavigate={(href) => navigate(href)}
    onRetry={() => { setView({ kind: 'failed', offline: false, retrying: true }); setAttempt((value) => value + 1); }}
    onCopyInvite={(text) => void copyInvite(text)} />;
}
