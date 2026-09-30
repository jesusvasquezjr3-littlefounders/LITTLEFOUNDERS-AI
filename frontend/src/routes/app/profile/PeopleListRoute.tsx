import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { APP_HOME } from '@/app-shell/home';
import { PeopleList, type PeopleNotice, type PeopleView, type PersonRow, type RowAction, type RowSafety } from '@/rebuild/social/PeopleList';
import { resolveLook } from '@/rebuild/account/avatar/avatarKit';
import { isOffline, useProfileScreenEnvironment } from './profileRouteKit';

/*
 * The data plane of the four people lists (P4 /profile/followers, P5
 * /profile/following, P7 /@username/followers, P8 /@username/following).
 *
 * Core already filtered each list to the people this viewer may discover and
 * bound each Tutor pill to a relationship (E.1, E.5, E.8, E.13); a malformed
 * answer is a failure with a retry, never a guessed list. The viewer's own
 * lists also read the viewer's tier from GET /profile, only to decide what the
 * page offers: a child's lists say its Tutor approves its connections, a guest
 * has none, and an independent teen may remove a follower (E.8). If the tier
 * cannot be read, the list still shows and offers only what every tier may do.
 * Core decides every action again.
 *
 * GAP-FIX-R8 social (E.3, E.8): the viewer's own rows are addressed by the
 * user id Core sends, never the handle, so an account without a @username is
 * unfollowed, removed, reported and blocked like any other. Report and Block
 * are on every row of the viewer's own lists; another person's lists stay
 * read-only.
 */

const USERNAME = /^[a-z0-9_]{3,20}$/;
type Tier = 'guardian' | 'teen' | 'adult' | 'closed';
const TIERS: readonly Tier[] = ['guardian', 'teen', 'adult', 'closed'];

/** Core's list answer, checked row by row. `null` when it is not a list of people. */
export function parsePeople(raw: unknown): PersonRow[] | null {
  const users = (raw as { users?: unknown } | null)?.users;
  if (!Array.isArray(users)) return null;
  const rows: PersonRow[] = [];
  for (const user of users) {
    const row = user as Record<string, unknown> | null;
    if (!row || typeof row.userId !== 'string' || typeof row.displayName !== 'string' || !(row.username === null || typeof row.username === 'string')) return null;
    const username = typeof row.username === 'string' && USERNAME.test(row.username) ? row.username : null;
    const avatar = row.avatarOptions && typeof row.avatarOptions === 'object' ? row.avatarOptions as Record<string, unknown> : {};
    rows.push({ userId: row.userId, displayName: row.displayName, username, look: resolveLook(avatar, row.userId), tutor: row.isTutor === true });
  }
  return rows;
}

function readTier(raw: unknown): Tier | null {
  const tier = (raw as { social?: { tier?: unknown } | null } | null)?.social?.tier;
  return (TIERS as readonly unknown[]).includes(tier) ? tier as Tier : null;
}

export function OwnFollowersRoute() { return <Scoped list="followers" owner="self" />; }
export function OwnFollowingRoute() { return <Scoped list="following" owner="self" />; }
export function PublicFollowersRoute() { return <PublicList list="followers" />; }
export function PublicFollowingRoute() { return <PublicList list="following" />; }

function PublicList({ list }: { list: 'followers' | 'following' }) {
  const { handle = '' } = useParams();
  if (!handle.startsWith('@')) return <Navigate to={APP_HOME} replace />;
  return <Scoped list={list} owner={handle.slice(1).toLowerCase()} />;
}

function Scoped({ list, owner }: { list: 'followers' | 'following'; owner: 'self' | string }) {
  const { session } = useAuth();
  return session ? <PeopleListData key={`${session.user.id}:${owner}:${list}`} list={list} owner={owner} /> : null;
}

function PeopleListData({ list, owner }: { list: 'followers' | 'following'; owner: 'self' | string }) {
  const { getToken } = useAuth();
  const { locale, dark, copy, ageBand } = useProfileScreenEnvironment();
  const navigate = useNavigate();
  const own = owner === 'self';
  const [view, setView] = useState<PeopleView>({ kind: 'loading' });
  const [tier, setTier] = useState<Tier | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<PeopleNotice | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const strings = copy.peopleList;

  useEffect(() => {
    let cancelled = false;
    if (!own && !USERNAME.test(owner)) { setView({ kind: 'unavailable' }); return; }
    void (async () => {
      const token = await getToken();
      if (!token) { if (!cancelled) setView({ kind: 'failed', offline: false, retrying: false }); return; }
      const path = own ? `/profile/${list}` : `/profiles/${owner}/${list}`;
      const [result, me] = await Promise.all([api<unknown>(path, { token }), own ? api<unknown>('/profile', { token }) : Promise.resolve(null)]);
      if (cancelled) return;
      const ownTier = me?.data ? readTier(me.data) : null;
      if (own && ownTier === 'closed') { setTier(ownTier); setView({ kind: 'closed' }); return; }
      if (!own && result.error?.code === 'NOT_FOUND') { setView({ kind: 'unavailable' }); return; }
      const people = result.data ? parsePeople(result.data) : null;
      if (!people) { setView({ kind: 'failed', offline: isOffline(result.error), retrying: false }); return; }
      setTier(ownTier);
      setView({ kind: 'ready', people, managed: own && ownTier === 'guardian' });
    })();
    return () => { cancelled = true; };
  }, [getToken, list, own, owner, attempt]);

  // P5: the viewer's own edges. P4: only an independent teen removes a follower (E.8).
  const action: RowAction = !own ? null : list === 'following' ? 'unfollow' : tier === 'teen' ? 'remove' : null;

  const act = useCallback(async (person: PersonRow) => {
    if (busyId !== null || action === null) return;
    setBusyId(person.userId);
    setNotice(null);
    const token = await getToken();
    const path = action === 'unfollow' ? `/profile/following/id/${encodeURIComponent(person.userId)}` : `/profile/followers/id/${encodeURIComponent(person.userId)}`;
    const result = token ? await api<{ userId?: unknown; following?: unknown; removed?: unknown }>(path, { method: 'DELETE', token }) : null;
    if (!alive.current) return;
    setBusyId(null);
    const done = result?.data?.userId === person.userId && (action === 'unfollow' ? result.data.following === false : result.data.removed === true);
    // NOT_FOUND: the edge is already gone (another device, a block, the retention sweep), so the row goes too.
    if (done || result?.error?.code === 'NOT_FOUND') {
      setView((current) => current.kind === 'ready' ? { ...current, people: current.people.filter((row) => row.userId !== person.userId) } : current);
      setNotice({ tone: 'success', text: action === 'unfollow' ? strings.unfollowed : strings.removed });
      return;
    }
    setNotice({ tone: 'error', text: action === 'unfollow' ? strings.unfollowFailed : strings.removeFailed });
  }, [action, busyId, getToken, strings]);

  const dropRow = (userId: string) => setView((current) => current.kind === 'ready' ? { ...current, people: current.people.filter((row) => row.userId !== userId) } : current);

  // E.3 on a list entry (GAP-FIX-R8 social): true only on Core's receipt naming this account; the dialog keeps the choice otherwise.
  const safety: RowSafety | undefined = own ? {
    reportCopy: copy.report,
    onReport: async (person, category, note) => {
      const token = await getToken();
      const result = token ? await api<{ userId?: unknown; reported?: unknown }>(`/profile/connections/${encodeURIComponent(person.userId)}/report`,
        { method: 'POST', token, body: note === null ? { category } : { category, note } }) : null;
      const sent = result?.data?.userId === person.userId && result.data.reported === true;
      if (sent && alive.current) setNotice({ tone: 'success', text: strings.reported });
      return sent;
    },
    // A block ends the connection both ways (the database removes each follow), so the row goes.
    onBlock: async (person) => {
      setNotice(null);
      const token = await getToken();
      const result = token ? await api<{ userId?: unknown; blocked?: unknown }>(`/profile/connections/${encodeURIComponent(person.userId)}/block`, { method: 'POST', token, body: {} }) : null;
      if (!alive.current) return;
      if (result?.data?.userId === person.userId && result.data.blocked === true) {
        dropRow(person.userId);
        setNotice({ tone: 'success', text: strings.blocked });
        return;
      }
      // NOT_FOUND: the connection is already gone (the other side ended it, another device), so the row goes, without claiming a block.
      if (result?.error?.code === 'NOT_FOUND') {
        dropRow(person.userId);
        setNotice({ tone: 'error', text: strings.unavailableBody });
        return;
      }
      setNotice({ tone: 'error', text: strings.blockFailed });
    },
  } : undefined;

  return <PeopleList copy={strings} locale={locale} dark={dark} ageBand={ageBand} list={list} owner={owner} view={view}
    // E.1: a child's connections are its Tutor's to approve; an unfollow it might not undo on its own asks first (W2P.3).
    // An unread tier might be a child's, so it asks too (the conservative side: one extra press for an adult).
    action={action} confirmUnfollow={own && tier !== 'adult' && tier !== 'teen'} safety={safety} busyId={busyId} notice={notice} onAct={(person) => void act(person)} onNavigate={(href) => navigate(href)}
    onRetry={() => { setView({ kind: 'failed', offline: false, retrying: true }); setAttempt((value) => value + 1); }} />;
}
