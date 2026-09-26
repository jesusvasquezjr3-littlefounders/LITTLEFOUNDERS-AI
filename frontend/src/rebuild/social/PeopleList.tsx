import { useEffect, useRef } from 'react';
import type enProfile from '../../i18n/en-US/rebuild-profile.json';
import { Button, Card, EmptyState, ErrorState, InlineNotice, LoadingState, Pill } from '../design/controls';
import { CartoonAvatar } from '../account/avatar/CartoonAvatar';
import type { AvatarLook } from '../account/avatar/avatarKit';
import { BackLink, followInApp } from '../account/navLink';
import { useCarryHeadingFocus } from './headingFocus';
import '../design/tokens.css';
import '../design/system.css';
import '../account/account.css';
import './people.css';

/*
 * P4 MY FOLLOWERS, P5 WHO I FOLLOW, P7 and P8 ANOTHER PERSON'S FOLLOWERS AND
 * FOLLOWING (Product 10 Block E; Frontend Bible 02 §4.5, §7, §8; 06; 07).
 *
 * One screen for the four lists: people, never a number (E.9). Core has
 * already filtered every list to the people this viewer may discover (E.1,
 * E.8, E.13) and bound each Tutor pill to an established relationship (E.5);
 * this screen shows exactly that. Each person opens their profile, where
 * Report and Block live (E.3).
 *
 *   - Who I follow (P5): each row can be unfollowed (the viewer's own edge).
 *   - My followers (P4): read-only, except for an independent teen, who
 *     manages their own connections (E.8) and can remove a follower.
 *   - A child's own lists say who approves their connections (E.1).
 *   - A guest has no social layer (OD-3): the list says so.
 *   - Another person's lists (P7, P8) are read-only and name whose they are.
 *
 * Presentation only: the route owns the data and passes a view.
 */

export type PeopleListCopy = typeof enProfile.peopleList;

export interface PersonRow { userId: string; displayName: string; username: string | null; look: AvatarLook; tutor: boolean }

export type PeopleView =
  | { kind: 'loading' }
  | { kind: 'failed'; offline: boolean; retrying: boolean }
  | { kind: 'unavailable' }
  | { kind: 'closed' }
  | { kind: 'ready'; people: PersonRow[]; managed: boolean };

/** What a row's one action does: unfollow (own following), remove (a teen's own followers), or nothing. */
export type RowAction = 'unfollow' | 'remove' | null;
export interface PeopleNotice { tone: 'success' | 'error'; text: string }

export function PeopleList({ copy, locale, dark, ageBand, list, owner, view, action, busyId, notice, onAct, onRetry, onNavigate }: {
  copy: PeopleListCopy;
  locale: string;
  dark: boolean;
  ageBand?: '6-9';
  list: 'followers' | 'following';
  /** `self` for the viewer's own lists; otherwise the handle whose lists these are. */
  owner: 'self' | string;
  view: PeopleView;
  action: RowAction;
  busyId: string | null;
  notice: PeopleNotice | null;
  onAct: (person: PersonRow) => void;
  onRetry: () => void;
  onNavigate: (href: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  useCarryHeadingFocus(root, view.kind);
  const own = owner === 'self';
  const title = list === 'followers' ? copy.followersTitle : copy.followingTitle;
  const backHref = own ? '/profile' : `/@${owner}`;
  const people = view.kind === 'ready' ? view.people : null;

  // A row that leaves the list takes the focused button with it: keep the keyboard on the next row, or on the heading.
  const lastActed = useRef<number | null>(null);
  const rowCount = people?.length ?? 0;
  useEffect(() => {
    if (lastActed.current === null || (document.activeElement && document.activeElement !== document.body)) return;
    const rows = root.current?.querySelectorAll<HTMLElement>('.lf-people-row') ?? [];
    const row = rows[Math.min(lastActed.current, rows.length - 1)];
    const target = row?.querySelector<HTMLElement>('button, a') ?? root.current?.querySelector<HTMLElement>('h1');
    if (target?.tagName === 'H1' && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target?.focus();
    lastActed.current = null;
  }, [rowCount]);

  const empty = list === 'followers'
    ? (own ? { heading: copy.emptyFollowers, body: copy.emptyFollowersBody } : { heading: copy.emptyPublic, body: undefined })
    : (own ? { heading: copy.emptyFollowing, body: copy.emptyFollowingBody } : { heading: copy.emptyPublic, body: undefined });

  return <div ref={root} className="lf-rebuild lf-account-screen" data-screen="people-list" data-list={list} data-owner={own ? 'self' : 'other'}
    data-theme={dark ? 'dark' : 'light'} lang={locale} data-age-band={ageBand} aria-busy={view.kind === 'loading'}>
    <header className="lf-account-header">
      <BackLink href={backHref} label={copy.back} onNavigate={onNavigate} />
      <h1 data-copy-role="heading">{title}</h1>
      {own ? null : <p className="lf-profile-handle ugc" data-copy-role="data">@{owner}</p>}
    </header>
    <div className="lf-people-column">
      {view.kind === 'loading' ? <LoadingState label={copy.loading} lines={3} />
        : view.kind === 'failed' ? <ErrorState heading={view.offline ? copy.offlineTitle : copy.failedTitle} body={view.offline ? copy.offlineBody : copy.failedBody}
          retryLabel={copy.retry} retryingLabel={copy.retrying} retrying={view.retrying} onRetry={onRetry} />
          : view.kind === 'unavailable' ? <EmptyState heading={copy.unavailableTitle} body={copy.unavailableBody} />
            : view.kind === 'closed' ? <EmptyState heading={copy.closedTitle} body={copy.closedBody} />
              : <>
                {view.managed ? <p className="lf-account-muted" data-copy-role="body">{copy.managed}</p> : null}
                <div className="lf-account-live" aria-live="polite">
                  {notice ? <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice> : null}
                </div>
                {view.people.length === 0 ? <EmptyState heading={empty.heading} body={empty.body} />
                  : <Card>
                    <ul className="lf-people-list" aria-label={title}>
                      {view.people.map((person, index) => <li key={person.userId} className="lf-people-row">
                        <Person person={person} tutorLabel={copy.tutor} onNavigate={onNavigate} />
                        {action && person.username ? <Button size="sm" disabled={busyId !== null && busyId !== person.userId}
                          pending={busyId === person.userId} pendingLabel={action === 'unfollow' ? copy.unfollowing : copy.removing}
                          onClick={() => { lastActed.current = index; onAct(person); }}>{action === 'unfollow' ? copy.unfollow : copy.remove}</Button> : null}
                      </li>)}
                    </ul>
                  </Card>}
              </>}
    </div>
  </div>;
}

/** One person: the cartoon avatar, the name, the handle and the Tutor pill as Core bound it (E.5). Opens their profile when they have a handle. */
function Person({ person, tutorLabel, onNavigate }: { person: PersonRow; tutorLabel: string; onNavigate: (href: string) => void }) {
  const content = <>
    <CartoonAvatar look={person.look} size="sm" />
    <span className="lf-people-text">
      <span className="lf-people-name ugc" data-copy-role="data">{person.displayName || person.username}</span>
      {person.username ? <span className="lf-people-handle ugc" data-copy-role="data">@{person.username}</span> : null}
      {person.tutor ? <Pill tone="primary">{tutorLabel}</Pill> : null}
    </span>
  </>;
  if (!person.username) return <span className="lf-people-person">{content}</span>;
  const href = `/@${person.username}`;
  return <a className="lf-people-person lf-people-link" href={href} onClick={(event) => followInApp(event, href, onNavigate)}>{content}</a>;
}
