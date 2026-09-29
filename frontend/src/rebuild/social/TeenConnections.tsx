import { useEffect, useRef, type MouseEvent } from 'react';
import { Button, Copy, DestructiveAction, InlineNotice, LoadingState } from '../design/controls';
import { ReportDialog, type ReportCategory, type ReportCopy } from './ReportDialog';
import '../design/tokens.css';
import '../design/system.css';
import './socialTiers.css';

/*
 * E.8's lighter tier, managed by the teen: a self-registered 13 to 17 year
 * old sees who asked to connect and accepts or declines each one, and can
 * remove anyone who follows them. No guardian is asked (OD-3: none exists in
 * this flow), and no count of anything is shown (E.9): these are people to
 * decide about, not a number to grow.
 * E.3 (GAP-FIX-R5 social; OD-8, D-19): an inbound request is the first
 * unwanted-contact event, so each one can also be reported (the bounded
 * report dialog) or blocked (behind a confirmation) right here, without
 * opening the requester's profile. Both reach Core by request id. A decline
 * is not the end of that path: the request just declined keeps Report and
 * Block beside the receipt (Core admits both for 30 days).
 * Copy-only, no transport: the route wrapper owns the data plane.
 */

export interface TeenConnectionsCopy {
  title: string; intro: string; introDiscoverable?: string; loading: string; failed: string; retry: string; empty: string;
  accept: string; decline: string; saving: string; accepted: string; declined: string; decisionFailed: string;
  conflict: string; review: string; more: string; followersTitle: string; noFollowers: string; remove: string;
  removed: string; removeFailed: string;
  report: string; reported: string; block: string; blockTitle: string; blockBody: string; blockKeep: string;
  blockConfirm: string; blocking: string; blocked: string; blockFailed: string;
}

export interface TeenRequestView { requestId: string; requestedAt: string; username: string | null; displayName: string | null }
export interface FollowerView { username: string; displayName: string }
export interface TeenNotice { tone: 'status' | 'alert'; text: string }

export function TeenConnections({ copy, reportCopy, locale, dark, discoverable = false, requests, followers, loading, failed, busy, notice, hasMore, closedRequestId = null, onDecide, onReport, onBlock, onRemove, onRetry, onMore }: {
  copy: TeenConnectionsCopy;
  reportCopy: ReportCopy;
  locale: string;
  dark: boolean;
  /** OD-27 (2): a 16-17-year-old who chose to be found; the intro no longer says private. */
  discoverable?: boolean;
  requests: TeenRequestView[];
  followers: FollowerView[];
  loading: boolean;
  failed: boolean;
  busy: boolean;
  notice: TeenNotice | null;
  hasMore: boolean;
  /** E.3: the request the teen just declined, still reportable and blockable beside the receipt. */
  closedRequestId?: string | null;
  onDecide: (requestId: string, decision: 'accept' | 'decline') => void;
  /** E.3: true only on Core's receipt; the dialog keeps what was chosen otherwise. */
  onReport: (requestId: string, category: ReportCategory, note: string | null) => Promise<boolean>;
  /** Runs after the confirmation; the route says whether it landed. */
  onBlock: (requestId: string) => Promise<void>;
  onRemove: (username: string) => void;
  onRetry: () => void;
  onMore: () => void;
}) {
  const root = useRef<HTMLElement>(null);
  const lastAction = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    // Keep keyboard users where they were: back to the same control, or the
    // first control of the panel if that row is gone.
    if (!busy && lastAction.current && document.activeElement === document.body) {
      const target = lastAction.current.isConnected ? lastAction.current : root.current?.querySelector('button');
      target?.focus();
    }
  }, [busy]);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const act = (event: MouseEvent<HTMLButtonElement>, fn: () => void) => { lastAction.current = event.currentTarget; fn(); };
  return <section ref={root} aria-label={copy.title} className="lf-rebuild lf-social-tier-card" data-social-audit="teen-connections" lang={locale} data-theme={dark ? 'dark' : 'light'}>
    <Copy role="heading" as="h2">{copy.title}</Copy>
    <Copy role="body">{discoverable && copy.introDiscoverable ? copy.introDiscoverable : copy.intro}</Copy>
    {notice && <InlineNotice tone={notice.tone === 'alert' ? 'error' : 'info'} live>{notice.text}</InlineNotice>}
    {closedRequestId && !failed && <div className="lf-social-tier-actions" role="group" aria-label={copy.declined} data-closed-request-actions={closedRequestId}>
      <ReportDialog copy={reportCopy} triggerLabel={copy.report} disabled={busy || loading} onSend={(category, note) => onReport(closedRequestId, category, note)} />
      <DestructiveAction label={copy.block} disabled={busy || loading} onConfirm={() => onBlock(closedRequestId)}
        confirm={{ heading: copy.blockTitle, consequence: copy.blockBody, keepLabel: copy.blockKeep, confirmLabel: copy.blockConfirm, pendingLabel: copy.blocking }} />
    </div>}
    {busy && <InlineNotice tone="info" live>{copy.saving}</InlineNotice>}
    {failed ? <div className="lf-social-tier-row">
      <InlineNotice tone="error" live>{copy.failed}</InlineNotice>
      <Button onClick={onRetry}>{copy.retry}</Button>
    </div> : <>
      <ul className="lf-social-tier-list">{requests.map((request) => <li key={request.requestId}>
        <div className="lf-social-tier-who">
          <p className="ugc" data-copy-role="data">{request.displayName ?? ''}</p>
          {request.username && <p className="ugc lf-social-tier-handle" data-copy-role="data">@{request.username}</p>}
          <time dateTime={request.requestedAt} data-copy-role="data">{date.format(new Date(request.requestedAt))}</time>
        </div>
        <div className="lf-social-tier-actions" role="group" aria-label={request.displayName || copy.title} data-request-actions={request.requestId}>
          <Button variant="accent" disabled={busy || loading} onClick={(event) => act(event, () => onDecide(request.requestId, 'accept'))}>{copy.accept}</Button>
          <Button disabled={busy || loading} onClick={(event) => act(event, () => onDecide(request.requestId, 'decline'))}>{copy.decline}</Button>
          <ReportDialog copy={reportCopy} triggerLabel={copy.report} disabled={busy || loading} onSend={(category, note) => onReport(request.requestId, category, note)} />
          <DestructiveAction label={copy.block} disabled={busy || loading} onConfirm={() => onBlock(request.requestId)}
            confirm={{ heading: copy.blockTitle, consequence: copy.blockBody, keepLabel: copy.blockKeep, confirmLabel: copy.blockConfirm, pendingLabel: copy.blocking }} />
        </div>
      </li>)}</ul>
      {!loading && requests.length === 0 && <Copy role="body">{copy.empty}</Copy>}
      {loading && <LoadingState label={copy.loading} lines={2} />}
      {hasMore && <Button disabled={busy || loading} onClick={onMore}>{copy.more}</Button>}
      <Copy role="heading" as="h2">{copy.followersTitle}</Copy>
      <ul className="lf-social-tier-list">{followers.map((follower) => <li key={follower.username}>
        <div className="lf-social-tier-who">
          <p className="ugc" data-copy-role="data">{follower.displayName}</p>
          <p className="ugc lf-social-tier-handle" data-copy-role="data">@{follower.username}</p>
        </div>
        <div className="lf-social-tier-actions">
          <Button disabled={busy || loading} onClick={(event) => act(event, () => onRemove(follower.username))}>{copy.remove}</Button>
        </div>
      </li>)}</ul>
      {!loading && followers.length === 0 && <Copy role="body">{copy.noFollowers}</Copy>}
    </>}
  </section>;
}
