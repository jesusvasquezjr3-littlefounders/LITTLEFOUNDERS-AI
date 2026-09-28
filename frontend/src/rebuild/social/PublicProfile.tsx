import { useEffect, useRef, useState } from 'react';
import type enProfile from '../../i18n/en-US/rebuild-profile.json';
import { Art, Button, Card, ConfirmDialog, DashboardLayout, DestructiveAction, ErrorState, InlineNotice, LoadingState, Pill } from '../design/controls';
import { Stagger } from '../design/motion';
import { CartoonAvatar, CoverArt } from '../account/avatar/CartoonAvatar';
import type { AvatarLook, CoverId } from '../account/avatar/avatarKit';
import { AppLink } from '../account/navLink';
import { ReportDialog, type ReportCategory, type ReportCopy } from './ReportDialog';
import { useCarryHeadingFocus } from './headingFocus';
import '../design/tokens.css';
import '../design/system.css';
import '../account/account.css';
import './people.css';

/*
 * P6, ANOTHER PERSON'S PROFILE at /@username (Product 10 Block E; Frontend
 * Bible 02 §4.5, §9.8; 06; 07).
 *
 * Core decides everything this page may show and offer (E.1, E.5, E.8, E.13):
 *
 *   - `private`  an independent teen who has not accepted this viewer (E.8):
 *                only the handle the viewer typed, the cartoon avatar and the
 *                cover preset, a sentence that says the teen decides, and one
 *                way to ask (never for a child viewer: its Tutor manages its
 *                connections);
 *   - `full`     the name, handle, "member since", the Tutor pill exactly as
 *                Core's relationship-bound verdict says (E.5), progress and
 *                course badges; how this viewer may connect (follow, a request
 *                the child's Tutor or the teen decides, or the child viewer's
 *                "your Tutor handles your connections"); the followers and
 *                following lists as plain links with no number, in their own
 *                card away from the progress numbers (E.9).
 *
 * E.13, minimised content: the page renders only the fields listed in the
 * view; nothing about a person's activity date, school, place or contact
 * exists here. E.10: there is no way to write to anyone. The report's
 * optional note goes to the safety team only, and the dialog says so.
 * E.3: Report and Block are on every profile but one's own; Block is behind
 * a confirmation that names its consequence (02 §9.8).
 *
 * Presentation only: the route owns the data and passes a view.
 */

export type PublicProfileCopy = typeof enProfile.publicProfile;

export interface PublicPerson {
  displayName: string;
  username: string;
  memberSince: string | null;
  look: AvatarLook;
  cover: CoverId;
  /** E.5: Core's verdict, shown exactly as served. */
  tutor: boolean;
  stats: { streakDays: number; lessonsCompleted: number; xpPoints: number; minutesLearned: number };
  badges: { slug: string; title: string; completedAt: string | null }[];
}

export type RequestStatus = 'idle' | 'saving' | 'pending' | 'failed' | 'cooldown' | 'limit' | 'connected' | 'review';

/** How this viewer may connect, from Core's `connection` mode (E.1, E.8). */
export type ConnectView =
  | { kind: 'self' }
  | { kind: 'none' }
  | { kind: 'managed' }
  | { kind: 'follow'; following: boolean; leaving: boolean; busy: boolean; error: 'failed' | 'review' | null }
  | { kind: 'request'; decidedBy: 'guardian' | 'subject'; status: RequestStatus };

export type PublicProfileView =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'failed'; offline: boolean; retrying: boolean }
  | { kind: 'private'; username: string; look: AvatarLook; cover: CoverId; connect: ConnectView }
  | { kind: 'full'; person: PublicPerson; connect: ConnectView; self: boolean };

export interface SafetyView { blockFailed: boolean; reported: boolean }

export function PublicProfile({ copy, reportCopy, locale, dark, ageBand, homeHref, view, safety, onFollow, onUnfollow, onAsk, onBlock, onReport, onRetry, onNavigate }: {
  copy: PublicProfileCopy;
  reportCopy: ReportCopy;
  locale: string;
  dark: boolean;
  /** Set for a child viewer, so the youngest copy budget applies (06 §3.1). */
  ageBand?: '6-9';
  /** Where "Go to Learn" leads when the profile is not available. */
  homeHref: string;
  view: PublicProfileView;
  safety: SafetyView;
  onFollow: () => void;
  onUnfollow: () => void;
  onAsk: () => void;
  onBlock: () => Promise<void>;
  onReport: (category: ReportCategory, note: string | null) => Promise<boolean>;
  onRetry: () => void;
  onNavigate: (href: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  useCarryHeadingFocus(root, view.kind);
  const pageHeader = (heading: string) => <header className="lf-account-header"><h1 data-copy-role="heading">{heading}</h1></header>;
  return <div ref={root} className="lf-rebuild lf-account-screen" data-screen="public-profile" data-theme={dark ? 'dark' : 'light'} lang={locale}
    data-age-band={ageBand} aria-busy={view.kind === 'loading'}>
    {view.kind === 'loading' ? <>{pageHeader(copy.title)}<LoadingState label={copy.loading} lines={4} /></>
      : view.kind === 'unavailable' ? <div className="lf-account-state">
        {pageHeader(copy.unavailableTitle)}
        <p data-copy-role="body">{copy.unavailableBody}</p>
        <div className="lf-account-actions"><AppLink href={homeHref} onNavigate={onNavigate}>{copy.home}</AppLink></div>
      </div>
        : view.kind === 'failed' ? <div className="lf-account-state">
          {pageHeader(copy.title)}
          <ErrorState heading={view.offline ? copy.offlineTitle : copy.failedTitle} body={view.offline ? copy.offlineBody : copy.failedBody}
            retryLabel={copy.retry} retryingLabel={copy.retrying} retrying={view.retrying} onRetry={onRetry} />
        </div>
          : <Profile copy={copy} reportCopy={reportCopy} locale={locale} young={ageBand === '6-9'} view={view} safety={safety} onFollow={onFollow} onUnfollow={onUnfollow}
            onAsk={onAsk} onBlock={onBlock} onReport={onReport} onNavigate={onNavigate} />}
  </div>;
}

function Profile({ copy, reportCopy, locale, young, view, safety, onFollow, onUnfollow, onAsk, onBlock, onReport, onNavigate }: {
  copy: PublicProfileCopy; reportCopy: ReportCopy; locale: string; young: boolean; view: Extract<PublicProfileView, { kind: 'private' | 'full' }>; safety: SafetyView;
  onFollow: () => void; onUnfollow: () => void; onAsk: () => void; onBlock: () => Promise<void>;
  onReport: (category: ReportCategory, note: string | null) => Promise<boolean>; onNavigate: (href: string) => void;
}) {
  const person = view.kind === 'full' ? view.person : null;
  const username = person ? person.username : view.kind === 'private' ? view.username : '';
  const self = view.kind === 'full' && view.self;
  const month = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  const since = person?.memberSince && Number.isFinite(Date.parse(person.memberSince)) ? month.format(new Date(person.memberSince)) : null;

  const hero = <header className="lf-profile-hero">
    <div className="lf-profile-cover"><CoverArt cover={person ? person.cover : (view as { cover: CoverId }).cover} /></div>
    <div className="lf-profile-identity">
      <span className="lf-profile-avatar"><CartoonAvatar look={person ? person.look : (view as { look: AvatarLook }).look} size="lg" /></span>
      <div className="lf-profile-names">
        {person ? <>
          <h1 className="ugc" data-copy-role="data">{person.displayName}</h1>
          <p className="lf-profile-handle ugc" data-copy-role="data">@{person.username}</p>
          {person.tutor ? <Pill tone="primary">{copy.tutor}</Pill> : null}
          {since ? <p className="lf-account-muted" data-copy-role="body">{copy.memberSince.replace('{date}', since)}</p> : null}
        </> : <h1 className="ugc" data-copy-role="data">@{username}</h1>}
      </div>
      <Connect copy={copy} connect={view.connect} onFollow={onFollow} onUnfollow={onUnfollow} onAsk={onAsk} onNavigate={onNavigate} />
    </div>
  </header>;

  const safetyCard = self ? null : <Card heading={copy.safetyTitle}>
    {/* The youngest register leaves out the helper line: the two named buttons say it (06 §3.1 first view). */}
    {young ? null : <p data-copy-role="body">{copy.safetyBody}</p>}
    <div className="lf-account-actions">
      <ReportDialog copy={reportCopy} triggerLabel={copy.report} onSend={onReport} />
      <DestructiveAction label={copy.block} onConfirm={onBlock}
        confirm={{ heading: copy.blockTitle, consequence: copy.blockBody, keepLabel: copy.blockKeep, confirmLabel: copy.blockConfirm, pendingLabel: copy.blocking }} />
    </div>
    <div className="lf-account-live" aria-live="polite">
      {safety.reported ? <InlineNotice tone="success">{copy.reportSent}</InlineNotice> : null}
      {safety.blockFailed ? <InlineNotice tone="error">{copy.blockFailed}</InlineNotice> : null}
    </div>
  </Card>;

  if (!person) {
    // E.8: a private teen. Nothing but the handle, the cartoon avatar and the cover is on the wire.
    return <>
      {hero}
      <DashboardLayout primary={<Card heading={copy.privateTitle}><p data-copy-role="body">{copy.privateBody}</p></Card>} secondary={safetyCard} />
    </>;
  }

  const number = new Intl.NumberFormat(locale);
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const stats: [string, number, string][] = [
    ['streak', person.stats.streakDays, copy.streak],
    ['lessons', person.stats.lessonsCompleted, copy.lessons],
    ['xp', person.stats.xpPoints, copy.xp],
    ['minutes', person.stats.minutesLearned, copy.minutes],
  ];
  const progress = <Card heading={copy.progressTitle}>
    <dl className="lf-profile-stats">
      {stats.map(([id, value, label]) => <div key={id} className={`lf-profile-stat lf-profile-stat--${id}`} data-stat={id}>
        <dt data-copy-role="body">{label}</dt>
        <dd data-copy-role="data">{number.format(value)}</dd>
      </div>)}
    </dl>
  </Card>;
  const badges = <Card heading={copy.badgesTitle}>
    {person.badges.length === 0 ? <p className="lf-account-muted" data-copy-role="body">{copy.badgesEmpty}</p>
      : <Stagger entryKey="public-profile-badges" as="ul" className="lf-profile-badges">
        {person.badges.map((badge) => <li key={badge.slug} className="lf-profile-badge">
          <Art assetId="badge.course.hexagon" />
          <div className="lf-profile-badge-text">
            <p className="lf-profile-badge-title ugc" data-copy-role="data">{badge.title}</p>
            {/* The youngest register shows the badge and its name only: the earned date is not first-view
                copy a 6-9 reader needs (06 §3.1), and the art already says it was earned. */}
            {young ? null : <p className="lf-account-muted" data-copy-role="body">{badge.completedAt && Number.isFinite(Date.parse(badge.completedAt))
              ? copy.badgeEarned.replace('{date}', day.format(new Date(badge.completedAt))) : copy.badgeEarnedUndated}</p>}
          </div>
        </li>)}
      </Stagger>}
  </Card>;
  // E.9: the lists stay reachable, with no number, away from the progress block.
  const people = <Card heading={copy.peopleTitle}>
    <div className="lf-account-actions">
      <AppLink href={`/@${person.username}/followers`} onNavigate={onNavigate}>{copy.followers}</AppLink>
      <AppLink href={`/@${person.username}/following`} onNavigate={onNavigate}>{copy.following}</AppLink>
    </div>
  </Card>;

  return <>
    {hero}
    <DashboardLayout primary={<>{progress}{badges}</>} secondary={<>{people}{safetyCard}</>} />
  </>;
}

/** The viewer's one way to connect, as Core's mode allows it, and what happened to it. */
function Connect({ copy, connect, onFollow, onUnfollow, onAsk, onNavigate }: {
  copy: PublicProfileCopy; connect: ConnectView; onFollow: () => void; onUnfollow: () => void; onAsk: () => void; onNavigate: (href: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const actions = useRef<HTMLDivElement>(null);
  const following = connect.kind === 'follow' ? connect.following : null;
  const previous = useRef(following);
  useEffect(() => {
    // Follow and Unfollow swap places: keep a keyboard user on the control that replaced the one they pressed.
    const changed = previous.current !== null && following !== null && previous.current !== following;
    previous.current = following;
    if (!changed || (document.activeElement && document.activeElement !== document.body)) return;
    actions.current?.querySelector<HTMLElement>('button')?.focus();
  }, [following]);
  if (connect.kind === 'none') return null;
  if (connect.kind === 'self') {
    return <div className="lf-profile-connect">
      <div className="lf-account-actions lf-profile-actions"><AppLink href="/profile" onNavigate={onNavigate}>{copy.editMine}</AppLink></div>
    </div>;
  }
  if (connect.kind === 'managed') return <p className="lf-profile-connect-note" data-copy-role="body">{copy.managed}</p>;
  if (connect.kind === 'follow') {
    const unfollow = () => { if (connect.leaving) setConfirming(true); else onUnfollow(); };
    return <div className="lf-profile-connect">
      <div ref={actions} className="lf-account-actions lf-profile-actions">
        {connect.following ? <>
          <Pill tone="success">{copy.youFollow}</Pill>
          <Button pending={connect.busy} pendingLabel={copy.saving} onClick={unfollow}>{copy.unfollow}</Button>
        </> : <Button variant="accent" pending={connect.busy} pendingLabel={copy.saving} onClick={onFollow}>{copy.follow}</Button>}
      </div>
      <div className="lf-account-live" aria-live="polite">
        {connect.error ? <InlineNotice tone="error">{connect.error === 'review' ? copy.askReview : copy.followFailed}</InlineNotice> : null}
      </div>
      {/* Unfollowing a child or a private teen ends what this viewer can see: it takes a new request to come back. */}
      <ConfirmDialog open={confirming} heading={copy.leaveTitle} consequence={copy.leaveBody} keepLabel={copy.leaveKeep} confirmLabel={copy.leaveConfirm}
        onKeep={() => setConfirming(false)} onConfirm={() => { setConfirming(false); onUnfollow(); }} />
    </div>;
  }
  const { status } = connect;
  const settled = status === 'pending' || status === 'cooldown' || status === 'limit' || status === 'connected';
  const notice = status === 'pending' ? (connect.decidedBy === 'guardian' ? copy.askedGuardian : copy.askedTeen)
    : status === 'cooldown' ? copy.askCooldown : status === 'limit' ? copy.askLimit : status === 'connected' ? copy.askConnected : null;
  return <div className="lf-profile-connect">
    <div className="lf-account-actions lf-profile-actions">
      <Button variant="accent" disabled={settled} pending={status === 'saving'} pendingLabel={copy.asking} onClick={onAsk}>{copy.ask}</Button>
    </div>
    <div className="lf-account-live" aria-live="polite">
      {notice ? <InlineNotice tone={status === 'connected' ? 'success' : 'info'}>{notice}</InlineNotice> : null}
      {status === 'failed' ? <InlineNotice tone="error">{copy.askFailed}</InlineNotice> : null}
      {status === 'review' ? <InlineNotice tone="error">{copy.askReview}</InlineNotice> : null}
    </div>
  </div>;
}
