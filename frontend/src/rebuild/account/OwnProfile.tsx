import { useRef, type ReactNode } from 'react';
import { Art, Button, Card, DashboardLayout, ErrorState, InlineNotice, LoadingState, MentorAvatar, Pill } from '../design/controls';
import { findMentorAvatar, MENTOR_NAMES, type MentorCharacter } from '../design/assets';
import { Stagger } from '../design/motion';
import { StreakStrip, type StreakDay } from '../learning/StreakStrip';
import { CartoonAvatar, CoverArt } from './avatar/CartoonAvatar';
import type { AvatarLook, CoverId } from './avatar/avatarKit';
import { AppLink } from './navLink';
import { useCarryHeadingFocus } from '../social/headingFocus';
import '../design/tokens.css';
import '../design/system.css';
import './account.css';

/*
 * P1, THE LEARNER'S OWN PROFILE (Product 10 Block E; Frontend Bible 02 §4.5,
 * 03 §3.3, 06, 07).
 *
 * A dashboard-style page: a neutral page with cards (02 §4.5). The cover and
 * the cartoon avatar are the person's own presets, drawn from our sprites
 * (E.12: never an upload). What the page shows:
 *
 *   - the name, the handle (or the way to choose one), "member since", the
 *     Tutor pill for a verified parent looking at their own profile (E.5:
 *     the owner may always see it);
 *   - E.13: the notice that says which field keeps a minor's profile hidden;
 *   - progress (streak, lessons, XP, minutes) and the course badges;
 *   - connections as two plain links with NO number anywhere (E.9: the one
 *     comparison-to-others metric is not on the wire), in the supporting
 *     column, never in the same block as the progress numbers;
 *   - a self-registered teen's own connection requests (E.8, the rebuilt
 *     panel the route passes in);
 *   - an invite link for the tiers that manage their own connections (adult,
 *     independent teen). A child's connections are approved by their Tutor
 *     (E.1), so a child is never handed a link to spread (conservative
 *     default, recorded as an owner proposal).
 *
 * Presentation only: the route owns the data and passes a view.
 */

export interface OwnProfileCopy {
  title: string; loading: string; failedTitle: string; failedBody: string; offlineTitle: string; offlineBody: string; retry: string; retrying: string;
  memberSince: string; chooseUsername: string; tutor: string; editLook: string; settings: string;
  progressTitle: string; streak: string; lessons: string; xp: string; minutes: string;
  badgesTitle: string; badgeEarned: string; badgeEarnedUndated: string; badgesEmpty: string;
  peopleTitle: string; followers: string; following: string; peopleManaged: string;
  inviteTitle: string; inviteBody: string; inviteNeedsUsername: string; copyLink: string; copied: string; copyFailed: string; inviteMessage: string;
  /** Bible 08 §8 (GAP-FIX-R1): the Mentor row. */
  mentorTitle: string; mentorChange: string;
}

/** The learner's rhythm as the profile shows it (Core's /learn/rhythm): the chosen Mentor and this week's strip. */
export interface OwnProfileRhythm { character: MentorCharacter; week: StreakDay[] | null }

export type SocialTier = 'guardian' | 'teen' | 'adult' | 'closed' | null;

export interface OwnProfileBadge { slug: string; title: string; completedAt: string | null }

export interface OwnProfileData {
  displayName: string;
  username: string | null;
  memberSince: string;
  look: AvatarLook;
  cover: CoverId;
  stats: { streakDays: number; lessonsCompleted: number; xpPoints: number; minutesLearned: number };
  badges: OwnProfileBadge[];
  /** E.8: the account's own tier, as Core read it (null when it could not). */
  tier: SocialTier;
  /** A verified parent's own profile shows the Tutor pill (roles; display only). */
  tutor: boolean;
}

export type OwnProfileView =
  | { kind: 'loading' }
  | { kind: 'failed'; offline: boolean; retrying: boolean }
  | { kind: 'ready'; data: OwnProfileData };

export type InviteStatus = 'idle' | 'copied' | 'failed';

/** Who is handed an invite link: the tiers that manage their own connections. */
export function invitesAllowed(tier: SocialTier) {
  return tier === 'adult' || tier === 'teen';
}

export function OwnProfile({ copy, locale, dark, ageBand, view, origin, invite = 'idle', safetyNotice, connections, rhythm = null, onNavigate, onRetry, onCopyInvite }: {
  copy: OwnProfileCopy;
  locale: string;
  dark: boolean;
  /** Set for a child's account, so the youngest copy budget applies (06 §3.1). */
  ageBand?: '6-9';
  view: OwnProfileView;
  /** The site the profile link points at (the page's own origin). */
  origin: string;
  invite?: InviteStatus;
  safetyNotice?: ReactNode;
  connections?: ReactNode;
  /** GAP-FIX-R1: the Mentor row and the streak strip; null when the rhythm read failed or is not the learner's. */
  rhythm?: OwnProfileRhythm | null;
  onNavigate: (href: string) => void;
  onRetry: () => void;
  onCopyInvite: (text: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  // The loading heading gives way to the person's name: route focus follows it (W2P.2).
  useCarryHeadingFocus(root, view.kind);
  return <div ref={root} className="lf-rebuild lf-account-screen" data-screen="own-profile" data-theme={dark ? 'dark' : 'light'} lang={locale}
    data-age-band={ageBand} aria-busy={view.kind === 'loading'}>
    {view.kind === 'loading' ? <>
      <header className="lf-account-header"><h1 data-copy-role="heading">{copy.title}</h1></header>
      <LoadingState label={copy.loading} lines={4} />
    </> : view.kind === 'failed' ? <div className="lf-account-state">
      <header className="lf-account-header"><h1 data-copy-role="heading">{copy.title}</h1></header>
      <ErrorState heading={view.offline ? copy.offlineTitle : copy.failedTitle} body={view.offline ? copy.offlineBody : copy.failedBody}
        retryLabel={copy.retry} retryingLabel={copy.retrying} retrying={view.retrying} onRetry={onRetry} />
    </div> : <Ready copy={copy} locale={locale} dark={dark} data={view.data} origin={origin} invite={invite} safetyNotice={safetyNotice}
      connections={connections} rhythm={rhythm} onNavigate={onNavigate} onCopyInvite={onCopyInvite} />}
  </div>;
}

function Ready({ copy, locale, dark, data, origin, invite, safetyNotice, connections, rhythm, onNavigate, onCopyInvite }: {
  copy: OwnProfileCopy; locale: string; dark: boolean; data: OwnProfileData; origin: string; invite: InviteStatus;
  safetyNotice?: ReactNode; connections?: ReactNode; rhythm: OwnProfileRhythm | null; onNavigate: (href: string) => void; onCopyInvite: (text: string) => void;
}) {
  const number = new Intl.NumberFormat(locale);
  const month = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const since = Number.isFinite(Date.parse(data.memberSince)) ? month.format(new Date(data.memberSince)) : null;
  const link = data.username ? `${origin}/@${data.username}` : null;
  const stats: [string, number, string][] = [
    ['streak', data.stats.streakDays, copy.streak],
    ['lessons', data.stats.lessonsCompleted, copy.lessons],
    ['xp', data.stats.xpPoints, copy.xp],
    ['minutes', data.stats.minutesLearned, copy.minutes],
  ];

  const progress = <Card heading={copy.progressTitle}>
    <dl className="lf-profile-stats">
      {stats.map(([id, value, label]) => <div key={id} className={`lf-profile-stat lf-profile-stat--${id}`} data-stat={id}>
        <dt data-copy-role="body">{label}</dt>
        <dd data-copy-role="data">{number.format(value)}</dd>
      </div>)}
    </dl>
    {rhythm?.week && (locale === 'en-US' || locale === 'es-MX' || locale === 'pt-BR') ? <StreakStrip week={rhythm.week} locale={locale} /> : null}
  </Card>;

  // Bible 08 §8 (GAP-FIX-R1): the chosen Mentor fills its profile row: the real render, the name and "Change".
  const avatar = rhythm ? findMentorAvatar(rhythm.character, dark ? 'dark' : 'light') : null;
  const mentor = rhythm ? <Card heading={copy.mentorTitle}>
    <div className="lf-profile-mentor" data-character={rhythm.character}>
      {avatar ? <MentorAvatar renderId={avatar} label={null} size="md" /> : null}
      <p className="lf-profile-mentor-name" data-copy-role="body">{MENTOR_NAMES[rhythm.character]}</p>
      <AppLink href="/tutor?sheet=chooser" onNavigate={onNavigate}>{copy.mentorChange}</AppLink>
    </div>
  </Card> : null;

  const badges = <Card heading={copy.badgesTitle}>
    {data.badges.length === 0 ? <p className="lf-account-muted" data-copy-role="body">{copy.badgesEmpty}</p>
      : <Stagger entryKey="own-profile-badges" as="ul" className="lf-profile-badges">
        {data.badges.map((badge) => <li key={badge.slug} className="lf-profile-badge">
          <Art assetId="badge.course.hexagon" />
          <div className="lf-profile-badge-text">
            <p className="lf-profile-badge-title ugc" data-copy-role="data">{badge.title}</p>
            <p className="lf-account-muted" data-copy-role="body">{badge.completedAt && Number.isFinite(Date.parse(badge.completedAt))
              ? copy.badgeEarned.replace('{date}', day.format(new Date(badge.completedAt))) : copy.badgeEarnedUndated}</p>
          </div>
        </li>)}
      </Stagger>}
  </Card>;

  // E.9: the lists stay reachable, with no number, away from the progress block.
  const people = data.tier === 'closed' ? null : <Card heading={copy.peopleTitle}>
    {data.tier === 'guardian' ? <p className="lf-account-muted" data-copy-role="body">{copy.peopleManaged}</p> : null}
    <div className="lf-account-actions">
      <AppLink href="/profile/followers" onNavigate={onNavigate}>{copy.followers}</AppLink>
      <AppLink href="/profile/following" onNavigate={onNavigate}>{copy.following}</AppLink>
    </div>
  </Card>;

  const share = invitesAllowed(data.tier) ? <Card heading={copy.inviteTitle}>
    {link ? <>
      <p data-copy-role="body">{copy.inviteBody}</p>
      <p className="lf-profile-link ugc" data-copy-role="data">{link}</p>
      <div className="lf-account-actions">
        <Button variant="berry" onClick={() => onCopyInvite(copy.inviteMessage.replace('{link}', link))}>{copy.copyLink}</Button>
      </div>
      <div className="lf-account-live" aria-live="polite">
        {invite === 'copied' ? <InlineNotice tone="success">{copy.copied}</InlineNotice> : null}
        {invite === 'failed' ? <InlineNotice tone="error">{copy.copyFailed}</InlineNotice> : null}
      </div>
    </> : <>
      <p data-copy-role="body">{copy.inviteNeedsUsername}</p>
      <div className="lf-account-actions"><AppLink href="/profile/settings" onNavigate={onNavigate}>{copy.chooseUsername}</AppLink></div>
    </>}
  </Card> : null;

  return <>
    <header className="lf-profile-hero">
      <div className="lf-profile-cover"><CoverArt cover={data.cover} /></div>
      <div className="lf-profile-identity">
        <span className="lf-profile-avatar"><CartoonAvatar look={data.look} size="lg" /></span>
        <div className="lf-profile-names">
          <h1 className="ugc" data-copy-role="data">{data.displayName}</h1>
          {data.username ? <p className="lf-profile-handle ugc" data-copy-role="data">@{data.username}</p> : null}
          {data.tutor ? <Pill tone="primary">{copy.tutor}</Pill> : null}
          {since ? <p className="lf-account-muted" data-copy-role="body">{copy.memberSince.replace('{date}', since)}</p> : null}
        </div>
        <div className="lf-account-actions lf-profile-actions">
          <AppLink href="/profile/avatar" onNavigate={onNavigate}>{copy.editLook}</AppLink>
          {data.username ? null : <AppLink href="/profile/settings" onNavigate={onNavigate}>{copy.chooseUsername}</AppLink>}
          <AppLink href="/profile/settings" onNavigate={onNavigate}>{copy.settings}</AppLink>
        </div>
      </div>
    </header>
    {safetyNotice ? <div className="lf-account-slot">{safetyNotice}</div> : null}
    <DashboardLayout primary={<>{progress}{badges}</>}
      // A teen's pending requests are the one thing on this page that waits for a decision: they come first.
      secondary={mentor || people || share || connections ? <>{connections ? <div className="lf-account-slot">{connections}</div> : null}{mentor}{people}{share}</> : undefined} />
  </>;
}
