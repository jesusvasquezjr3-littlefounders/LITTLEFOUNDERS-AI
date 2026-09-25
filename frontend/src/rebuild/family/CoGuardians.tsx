import { useEffect, useRef } from 'react';
import { Button, Copy, StatusMark } from '../design/controls';
import type { CoGuardian, OwnLink } from './familyHubApi';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';

/*
 * D.5 / OD-21 guardian-link lifecycle, rebuilt surfaces (no transport here;
 * the routes wrappers own every call):
 *  - CoGuardians: a verified Tutor sees the child's Tutors in every state,
 *    confirms or rejects a PENDING second Tutor, and steps away (REVOKED)
 *    while another verified Tutor remains. Stepping away asks first and
 *    offers "Stay" before the destructive choice (Bible 02 §9.8).
 *  - GuardianRequests: the invited or departed adult sees their own
 *    pending / rejected / revoked links. Renders nothing when there are none.
 */

export interface CoGuardiansCopy {
  title: string; close: string; heading: string; loading: string; failed: string; retry: string;
  you: string; unnamed: string; verified: string; pending: string; rejected: string; revoked: string;
  confirm: string; reject: string; confirmed: string; rejectedNotice: string; conflict: string; decisionFailed: string;
  leave: string; leavePrompt: string; keep: string; leaveConfirm: string; leaveLast: string; left: string; leaveFailed: string; saving: string;
}

export function CoGuardians({ copy, locale, dark, kidName, open, guardians, loading, failed, busy, notice, noticeIsError, confirmingLeave, onToggle, onRetry, onDecision, onLeaveStart, onLeaveCancel, onLeaveConfirm }: {
  copy: CoGuardiansCopy; locale: string; dark: boolean; kidName: string; open: boolean;
  guardians: CoGuardian[]; loading: boolean; failed: boolean; busy: boolean;
  notice: string | null; noticeIsError: boolean; confirmingLeave: boolean;
  onToggle: () => void; onRetry: () => void; onDecision: (linkId: string, decision: 'confirm' | 'reject') => void;
  onLeaveStart: () => void; onLeaveCancel: () => void; onLeaveConfirm: () => void;
}) {
  const root = useRef<HTMLElement>(null);
  const lastAction = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!busy && lastAction.current && document.activeElement === document.body) {
      const target = lastAction.current.isConnected ? lastAction.current : root.current?.querySelector('button');
      target?.focus();
    }
  }, [busy, confirmingLeave]);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const me = guardians.find((g) => g.isMe && g.status === 'verified');
  const otherVerified = guardians.some((g) => !g.isMe && g.status === 'verified');
  const statusText = (g: CoGuardian) => g.status === 'verified' ? copy.verified : g.status === 'pending' ? copy.pending : g.status === 'rejected' ? copy.rejected : copy.revoked;
  const act = (event: React.MouseEvent<HTMLButtonElement>, run: () => void) => { lastAction.current = event.currentTarget; run(); };

  return <section ref={root} className="lf-rebuild lf-family-hub" data-family-hub="co-guardians" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-label={copy.heading.replace('{name}', kidName)}>
    <Button aria-expanded={open} onClick={onToggle}>{open ? copy.close : copy.title}</Button>
    {open && <>
      <Copy role="heading" as="h2">{copy.heading.replace('{name}', kidName)}</Copy>
      {notice && <div className="lf-family-hub-notice" role={noticeIsError ? 'alert' : 'status'}>{noticeIsError && <StatusMark correct={false} />}<Copy role="body">{notice}</Copy></div>}
      {busy && <div role="status"><Copy role="body">{copy.saving}</Copy></div>}
      {failed ? <>
        <div className="lf-family-hub-notice" role="alert"><StatusMark correct={false} /><Copy role="body">{copy.failed}</Copy></div>
        <Button onClick={onRetry}>{copy.retry}</Button>
      </> : <>
        {loading && <div role="status"><Copy role="body">{copy.loading}</Copy></div>}
        <ul>{guardians.map((g) => <li key={g.linkId} data-link-status={g.status}>
          <div className="lf-family-hub-row">
            <span data-copy-role="data" className="ugc">{g.isMe ? copy.you : g.displayName || copy.unnamed}</span>
            <time data-copy-role="data" className="lf-family-hub-muted" dateTime={g.revokedAt ?? g.decidedAt ?? g.since}>{date.format(new Date(g.revokedAt ?? g.decidedAt ?? g.since))}</time>
          </div>
          <Copy role="body">{statusText(g)}</Copy>
          {g.status === 'pending' && me && <div className="lf-family-hub-actions">
            <Button variant="success" disabled={busy || loading} onClick={(e) => act(e, () => onDecision(g.linkId, 'confirm'))}>{copy.confirm}</Button>
            <Button disabled={busy || loading} onClick={(e) => act(e, () => onDecision(g.linkId, 'reject'))}>{copy.reject}</Button>
          </div>}
        </li>)}</ul>
        {me && !loading && (otherVerified ? (confirmingLeave ? <div className="lf-family-hub-notice" role="group" aria-label={copy.leave}>
          <div><Copy role="body">{copy.leavePrompt}</Copy>
            <div className="lf-family-hub-actions">
              <Button variant="accent" disabled={busy} onClick={(e) => act(e, onLeaveCancel)}>{copy.keep}</Button>
              <Button disabled={busy} onClick={(e) => act(e, onLeaveConfirm)}>{copy.leaveConfirm}</Button>
            </div>
          </div>
        </div> : <Button disabled={busy} onClick={(e) => act(e, onLeaveStart)}>{copy.leave}</Button>)
          : <Copy role="body">{copy.leaveLast}</Copy>)}
      </>}
    </>}
  </section>;
}

export interface GuardianRequestsCopy { title: string; pending: string; rejected: string; revoked: string; unnamed: string; failed: string; retry: string }

export function GuardianRequests({ copy, locale, dark, links, failed, onRetry }: {
  copy: GuardianRequestsCopy; locale: string; dark: boolean; links: OwnLink[]; failed: boolean; onRetry: () => void;
}) {
  if (!failed && links.length === 0) return null;
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  return <section className="lf-rebuild lf-family-hub" data-family-hub="guardian-requests" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-label={copy.title}>
    <Copy role="heading" as="h2">{copy.title}</Copy>
    {failed ? <>
      <div className="lf-family-hub-notice" role="alert"><StatusMark correct={false} /><Copy role="body">{copy.failed}</Copy></div>
      <Button onClick={onRetry}>{copy.retry}</Button>
    </> : <ul>{links.map((l) => <li key={l.linkId} data-link-status={l.status}>
      <Copy role="body"><span className="ugc">{copy[l.status].replace('{name}', l.kidDisplayName || copy.unnamed)}</span></Copy>
      <time data-copy-role="data" className="lf-family-hub-muted" dateTime={l.updatedAt}>{date.format(new Date(l.updatedAt))}</time>
    </li>)}</ul>}
  </section>;
}
