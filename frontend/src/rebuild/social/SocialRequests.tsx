import { useEffect, useRef } from 'react';
import { Button, Copy, InlineNotice, LoadingState } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './socialGraph.css';
export interface PendingConnection { requestId: string; requesterName: string | null; requestedAt: string; status: 'pending' }
export interface RequestsCopy { title: string; close: string; loading: string; failed: string; empty: string; retry: string; more: string; hidden: string; pending: string; approve: string; deny: string; saving: string; decisionFailed: string; conflict: string; approved: string; denied: string }
export function SocialRequests({ copy, locale, dark, open, requests, loading, failed, hasMore, deciding, notice, decisionFailed, onDecision, onToggle, onMore, onRetry }: {
  copy: RequestsCopy; locale: string; dark: boolean; open: boolean; requests: PendingConnection[];
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
      {deciding && <InlineNotice tone="info" live>{copy.saving}</InlineNotice>}
      {failed ? <><InlineNotice tone="error" live>{copy.failed}</InlineNotice><Button onClick={onRetry}>{copy.retry}</Button></> : <>
        <ul>{requests.map(request => <li key={request.requestId}>
          <Copy role="option">{request.requesterName || copy.hidden}</Copy>
          <Copy role="body">{copy.pending}</Copy>
          <time dateTime={request.requestedAt} data-copy-role="data">{date.format(new Date(request.requestedAt))}</time>
          <div className="lf-social-request-actions">
            <Button disabled={loading || deciding} onClick={event => { lastAction.current = event.currentTarget; onDecision(request.requestId, 'approve'); }}>{copy.approve}</Button>
            <Button disabled={loading || deciding} onClick={event => { lastAction.current = event.currentTarget; onDecision(request.requestId, 'deny'); }}>{copy.deny}</Button>
          </div>
        </li>)}</ul>
        {!loading && requests.length === 0 && <Copy role="body">{copy.empty}</Copy>}
        {loading && <LoadingState label={copy.loading} lines={2} />}
        {hasMore && <Button disabled={loading || deciding} onClick={onMore}>{copy.more}</Button>}
      </>}
    </>}
  </section>;
}
