import { useEffect, useRef } from 'react';
import { Button, Copy, InlineNotice, LoadingState } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './socialGraph.css';
import { ReportDialog, type ReportCategory, type ReportCopy } from './ReportDialog';

/*
 * The Tutor's queue of a child's inbound connection requests (E.1/E.2). Each
 * row is decided (approve or deny) and, since GAP-FIX-R5 social, can be
 * reported: an inbound request is the first unwanted-contact event, so the
 * queue carries E.3's path to act on a concern (OD-8, D-19) with the same
 * bounded dialog as a profile. Reporting does not decide the request; the
 * Tutor still approves or denies it. A denial is not the end of that path:
 * the request the Tutor just denied keeps a Report action beside the receipt
 * (Core admits it for 30 days). Copy-only, no transport.
 */
export interface PendingConnection { requestId: string; requesterName: string | null; requestedAt: string; status: 'pending' }
export interface RequestsCopy { title: string; close: string; loading: string; failed: string; empty: string; retry: string; more: string; hidden: string; pending: string; approve: string; deny: string; saving: string; decisionFailed: string; conflict: string; approved: string; denied: string; report: string; reported: string }
export function SocialRequests({ copy, reportCopy, locale, dark, open, requests, loading, failed, hasMore, deciding, notice, decisionFailed, closedRequestId = null, onDecision, onReport, onToggle, onMore, onRetry }: {
  copy: RequestsCopy; reportCopy: ReportCopy; locale: string; dark: boolean; open: boolean; requests: PendingConnection[];
  /** E.3: true only on Core's receipt; the dialog keeps what was chosen otherwise. */
  onReport: (requestId: string, category: ReportCategory, note: string | null) => Promise<boolean>;
  /** E.3: the request the Tutor just denied, still reportable beside the receipt. */
  closedRequestId?: string | null;
  deciding: boolean; notice: string | null; decisionFailed: boolean; onDecision: (id: string, decision: 'approve' | 'deny') => void;
  loading: boolean; failed: boolean; hasMore: boolean; onToggle: () => void; onMore: () => void; onRetry: () => void;
}) {
  const root = useRef<HTMLElement>(null);
  const lastAction = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!deciding && lastAction.current && document.activeElement === document.body) {
      const target = lastAction.current.isConnected ? lastAction.current : root.current?.querySelector('button');
      target?.focus();
    }
  }, [deciding]);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
  return <section ref={root} className="lf-rebuild lf-social-graph" data-social-audit="requests" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-label={copy.title}>
    <Button aria-expanded={open} onClick={onToggle}>{open ? copy.close : copy.title}</Button>
    {open && <>
      <Copy role="heading" as="h2">{copy.title}</Copy>
      {notice && <InlineNotice tone={decisionFailed ? 'error' : 'info'} live>{notice}</InlineNotice>}
      {closedRequestId && !deciding && <div className="lf-social-request-actions" role="group" aria-label={copy.denied} data-closed-request-actions={closedRequestId}>
        <ReportDialog copy={reportCopy} triggerLabel={copy.report} disabled={loading} onSend={(category, note) => onReport(closedRequestId, category, note)} />
      </div>}
      {deciding && <InlineNotice tone="info" live>{copy.saving}</InlineNotice>}
      {failed ? <><InlineNotice tone="error" live>{copy.failed}</InlineNotice><Button onClick={onRetry}>{copy.retry}</Button></> : <>
        <ul>{requests.map(request => <li key={request.requestId}>
          <Copy role="option">{request.requesterName || copy.hidden}</Copy>
          <Copy role="body">{copy.pending}</Copy>
          <time dateTime={request.requestedAt} data-copy-role="data">{date.format(new Date(request.requestedAt))}</time>
          <div className="lf-social-request-actions" role="group" aria-label={request.requesterName || copy.hidden} data-request-actions={request.requestId}>
            <Button disabled={loading || deciding} onClick={event => { lastAction.current = event.currentTarget; onDecision(request.requestId, 'approve'); }}>{copy.approve}</Button>
            <Button disabled={loading || deciding} onClick={event => { lastAction.current = event.currentTarget; onDecision(request.requestId, 'deny'); }}>{copy.deny}</Button>
            <ReportDialog copy={reportCopy} triggerLabel={copy.report} disabled={loading || deciding} onSend={(category, note) => onReport(request.requestId, category, note)} />
          </div>
        </li>)}</ul>
        {!loading && requests.length === 0 && <Copy role="body">{copy.empty}</Copy>}
        {loading && <LoadingState label={copy.loading} lines={2} />}
        {hasMore && <Button disabled={loading || deciding} onClick={onMore}>{copy.more}</Button>}
      </>}
    </>}
  </section>;
}
