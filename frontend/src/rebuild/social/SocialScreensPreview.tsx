import type { ReactNode } from 'react';
import profileEn from '../../i18n/en-US/rebuild-profile.json';
import profileEs from '../../i18n/es-MX/rebuild-profile.json';
import profilePt from '../../i18n/pt-BR/rebuild-profile.json';
import coreEn from '../../i18n/en-US/rebuild-core.json';
import coreEs from '../../i18n/es-MX/rebuild-core.json';
import corePt from '../../i18n/pt-BR/rebuild-core.json';
import { RebuildProvider } from '../design/controls';
import type { Locale } from '../design/copyBudget';
import { resolveLook } from '../account/avatar/avatarKit';
import { PublicProfile, type ConnectView, type PublicPerson, type PublicProfileView } from './PublicProfile';
import { PeopleList, type PeopleNotice, type PeopleView, type PersonRow, type RowAction } from './PeopleList';

/*
 * Fixture-only preview of the profile lane's social screens (W2P.2: P4-P8),
 * for the audits and design review, on the development-only preview entry
 * (`?screen=public-profile|people-list&state=…`). No transport, no session,
 * no spend. Names are long on purpose where a real name can be long, to prove
 * wrapping at 320 px.
 */

const PROFILE = { 'en-US': profileEn, 'es-MX': profileEs, 'pt-BR': profilePt };
const CORE = { 'en-US': coreEn, 'es-MX': coreEs, 'pt-BR': corePt };
const noop = () => undefined;

const MARTA = resolveLook({ skinColor: ['ae5d29'], top: ['bob'], hairColor: ['2c1b18'], eyes: ['happy'], mouth: ['smile'], clothing: ['blazerAndShirt'], clothesColor: ['25557c'] }, 'marta');
const RIO = resolveLook({ skinColor: ['d08b5b'], top: ['shortCurly'], hairColor: ['4a312c'], eyes: ['default'], mouth: ['default'], clothing: ['hoodie'], clothesColor: ['5199e4'] }, 'rio');

const PERSON: PublicPerson = {
  displayName: 'María Fernanda de la Cruz Villanueva', username: 'maria_fernanda_22', memberSince: '2026-01-10T00:00:00Z', look: MARTA, cover: 'ocean', tutor: false,
  stats: { streakDays: 12, lessonsCompleted: 48, xpPoints: 12450, minutesLearned: 1320 },
  badges: [{ slug: 'financial-education', title: 'Financial Education', completedAt: '2026-08-14T12:00:00Z' }],
};

export const PUBLIC_PROFILE_PREVIEW_STATES = ['adult', 'following', 'tutor', 'childSubject', 'childFollowed', 'asked', 'kidViewer', 'private', 'privateAsked', 'privateManaged',
  'self', 'noBadges', 'followFailed', 'askFailed', 'reported', 'blockFailed', 'unavailable', 'loading', 'failed', 'offline'] as const;
export const PEOPLE_LIST_PREVIEW_STATES = ['followers', 'following', 'teenFollowers', 'kidFollowing', 'publicFollowers', 'publicFollowing', 'unfollowed',
  'unfollowFailed', 'emptyOwn', 'emptyPublic', 'closed', 'unavailable', 'loading', 'failed', 'offline'] as const;

function Page({ locale, theme, screen, children }: { locale: Locale; theme: 'light' | 'dark'; screen: string; children: ReactNode }) {
  return <div className="lf-rebuild" data-screen={`${screen}-preview`} data-theme={theme} lang={locale}>
    <RebuildProvider environment={{ theme, locale }} labels={{ dismiss: CORE[locale].appShell.dismiss }}>
      <main className="lf-account-preview-page">{children}</main>
    </RebuildProvider>
  </div>;
}

function publicView(state: string): PublicProfileView {
  const follow = (extra: Partial<Extract<ConnectView, { kind: 'follow' }>> = {}): ConnectView => ({ kind: 'follow', following: false, leaving: false, busy: false, error: null, ...extra });
  switch (state) {
    case 'loading': return { kind: 'loading' };
    case 'unavailable': return { kind: 'unavailable' };
    case 'failed': case 'offline': return { kind: 'failed', offline: state === 'offline', retrying: false };
    case 'private': case 'privateAsked': return { kind: 'private', username: 'rio_montes', look: RIO, cover: 'grape',
      connect: { kind: 'request', decidedBy: 'subject', status: state === 'privateAsked' ? 'pending' : 'idle' } };
    case 'privateManaged': return { kind: 'private', username: 'rio_montes', look: RIO, cover: 'grape', connect: { kind: 'managed' } };
    case 'following': return { kind: 'full', person: PERSON, connect: follow({ following: true }), self: false };
    case 'tutor': return { kind: 'full', person: { ...PERSON, displayName: 'Jesús Vásquez', tutor: true }, connect: follow({ following: true }), self: false };
    case 'childSubject': case 'asked': return { kind: 'full', person: { ...PERSON, displayName: 'Valentina', username: 'vale_rocket', cover: 'forest' },
      connect: { kind: 'request', decidedBy: 'guardian', status: state === 'asked' ? 'pending' : 'idle' }, self: false };
    case 'childFollowed': return { kind: 'full', person: { ...PERSON, displayName: 'Valentina', username: 'vale_rocket', cover: 'forest' }, connect: follow({ following: true, leaving: true }), self: false };
    case 'askFailed': return { kind: 'full', person: PERSON, connect: { kind: 'request', decidedBy: 'subject', status: 'failed' }, self: false };
    case 'kidViewer': return { kind: 'full', person: PERSON, connect: { kind: 'managed' }, self: false };
    case 'self': return { kind: 'full', person: PERSON, connect: { kind: 'self' }, self: true };
    case 'noBadges': return { kind: 'full', person: { ...PERSON, badges: [] }, connect: follow(), self: false };
    case 'followFailed': return { kind: 'full', person: PERSON, connect: follow({ error: 'failed' }), self: false };
    default: return { kind: 'full', person: PERSON, connect: follow(), self: false };
  }
}

export function PublicProfilePreview({ locale, theme, state }: { locale: Locale; theme: 'light' | 'dark'; state: string | null }) {
  const t = PROFILE[locale];
  const name = state ?? 'adult';
  return <Page locale={locale} theme={theme} screen="public-profile">
    <PublicProfile copy={t.publicProfile} reportCopy={t.report} locale={locale} dark={theme === 'dark'} ageBand={name === 'kidViewer' || name === 'privateManaged' ? '6-9' : undefined}
      homeHref="/learn" view={publicView(name)} safety={{ reported: name === 'reported', blockFailed: name === 'blockFailed' }}
      onFollow={noop} onUnfollow={noop} onAsk={noop} onBlock={async () => undefined} onReport={async () => true} onRetry={noop} onNavigate={noop} />
  </Page>;
}

const PEOPLE: PersonRow[] = [
  { userId: 'u1', displayName: 'Bartolomeo Alessandro Rodríguez Villanueva', username: 'bartolomeo_villa', look: MARTA, tutor: false },
  { userId: 'u2', displayName: 'Jesús Vásquez', username: 'jesus_v', look: resolveLook({}, 'jesus'), tutor: true },
  { userId: 'u3', displayName: 'Luz', username: 'luz', look: RIO, tutor: false },
];

export function PeopleListPreview({ locale, theme, state }: { locale: Locale; theme: 'light' | 'dark'; state: string | null }) {
  const t = PROFILE[locale].peopleList;
  const name = state ?? 'followers';
  const list = /[Ff]ollowing|unfollow/.test(name) ? 'following' : 'followers';
  const owner = name.startsWith('public') || name === 'emptyPublic' || name === 'unavailable' ? 'maria_fernanda_22' : 'self';
  const view: PeopleView = name === 'loading' ? { kind: 'loading' } : name === 'failed' || name === 'offline' ? { kind: 'failed', offline: name === 'offline', retrying: false }
    : name === 'unavailable' ? { kind: 'unavailable' } : name === 'closed' ? { kind: 'closed' }
      : { kind: 'ready', people: name.startsWith('empty') ? [] : name === 'unfollowed' ? PEOPLE.slice(1) : PEOPLE, managed: name === 'kidFollowing' };
  const action: RowAction = owner !== 'self' ? null : list === 'following' ? 'unfollow' : name === 'teenFollowers' ? 'remove' : null;
  const notice: PeopleNotice | null = name === 'unfollowed' ? { tone: 'success', text: t.unfollowed } : name === 'unfollowFailed' ? { tone: 'error', text: t.unfollowFailed } : null;
  return <Page locale={locale} theme={theme} screen="people-list">
    <PeopleList copy={t} locale={locale} dark={theme === 'dark'} ageBand={name === 'kidFollowing' ? '6-9' : undefined} list={list} owner={owner} view={view}
      action={action} confirmUnfollow={name === 'kidFollowing'} busyId={null} notice={notice} onAct={noop} onRetry={noop} onNavigate={noop} />
  </Page>;
}
