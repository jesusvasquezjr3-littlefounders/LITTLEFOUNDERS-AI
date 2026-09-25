import { useEffect, useRef } from 'react';
import { Button, Copy, InlineNotice, LoadingState } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './badgeShares.css';

/*
 * F.2: the parent's per-link "revoke this link" surface — since OD-20 it
 * lists only LEGACY links issued before new shares became pictures, each
 * until its own expiry date, and says so (legacyNote) — an isolated
 * rebuild component (no legacy imports, Bible 02 rule 23), copy-driven and
 * data-fetch-free exactly like the social panels: the thin Family-page
 * wrapper (routes/app/family/BadgeSharesPanel.tsx) owns transport, this
 * component owns rendering only. Achievement labels and dates are DATA
 * (server-derived), never copy; every string is budget-checked in
 * rebuild/design/previewCopy.test.ts.
 */

export interface BadgeShareEntry {
  token: string;
  achievementLabel: string;
  createdAt: string;
  expiresAt: string;
}

export interface BadgeSharesCopy {
  title: string;
  close: string;
  loading: string;
  failed: string;
  empty: string;
  retry: string;
  revoke: string;
  revoking: string;
  revoked: string;
  revokeFailed: string;
  expires: string;
  legacyNote: string;
}

export function BadgeShares({ copy, locale, dark, open, shares, loading, failed, revokingToken, notice, revokeFailed, onRevoke, onToggle, onRetry }: {
  copy: BadgeSharesCopy;
  locale: string;
  dark: boolean;
  open: boolean;
  shares: BadgeShareEntry[];
  loading: boolean;
  failed: boolean;
  revokingToken: string | null;
  notice: string | null;
  revokeFailed: boolean;
  onRevoke: (token: string) => void;
  onToggle: () => void;
  onRetry: () => void;
}) {
  const root = useRef<HTMLElement>(null);
  const lastAction = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!revokingToken && lastAction.current && document.activeElement === document.body) {
      const target = lastAction.current.isConnected ? lastAction.current : root.current?.querySelector('button');
      target?.focus();
    }
  }, [revokingToken]);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  return <section ref={root} className="lf-rebuild lf-badge-shares" data-share-audit="badges" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-label={copy.title}>
    <Button aria-expanded={open} onClick={onToggle}>{open ? copy.close : copy.title}</Button>
    {open && <>
      <Copy role="heading" as="h2">{copy.title}</Copy>
      <Copy role="body">{copy.legacyNote}</Copy>
      {notice && <InlineNotice tone={revokeFailed ? 'error' : 'info'} live>{notice}</InlineNotice>}
      {revokingToken && <InlineNotice tone="info" live>{copy.revoking}</InlineNotice>}
      {failed ? <><InlineNotice tone="error" live>{copy.failed}</InlineNotice><Button onClick={onRetry}>{copy.retry}</Button></> : <>
        <ul>{shares.map(share => <li key={share.token}>
          <Copy role="option">{share.achievementLabel}</Copy>
          <Copy role="body">{copy.expires.replace('{date}', date.format(new Date(share.expiresAt)))}</Copy>
          <div className="lf-badge-share-actions">
            <Button disabled={loading || revokingToken !== null} onClick={event => { lastAction.current = event.currentTarget; onRevoke(share.token); }}>{copy.revoke}</Button>
          </div>
        </li>)}</ul>
        {!loading && shares.length === 0 && <Copy role="body">{copy.empty}</Copy>}
        {loading && <LoadingState label={copy.loading} lines={2} />}
      </>}
    </>}
  </section>;
}
