import { useEffect, useRef } from 'react';
import { Button, Copy, InlineNotice } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './socialTiers.css';

/*
 * E.8's private-by-default teen, as another account sees it before the teen
 * has accepted them: the handle they already typed, a sentence that says the
 * teen decides, and one way to ask. Nothing else about the teen is on the
 * wire (Core serves only username, cartoon avatar and cover preset). A child
 * viewer gets no ask at all: its Tutor manages its connections.
 * Copy-only, no transport: the route wrapper owns the data plane.
 */

export interface PrivateProfileCopy {
  title: string; body: string; request: string; saving: string; pending: string; failed: string;
  managed: string; cooldown: string; limit: string; connected: string;
}

export type PrivateRequestState = 'idle' | 'saving' | 'pending' | 'failed' | 'cooldown' | 'limit' | 'connected';

export function PrivateProfile({ copy, locale, dark, username, mode, state, onRequest }: {
  copy: PrivateProfileCopy;
  locale: string;
  dark: boolean;
  username: string;
  mode: 'teenRequest' | 'managed' | 'none';
  state: PrivateRequestState;
  onRequest: () => void;
}) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (state === 'failed' && document.activeElement === document.body) root.current?.querySelector('button')?.focus();
  }, [state]);
  const settled = state === 'pending' || state === 'cooldown' || state === 'limit' || state === 'connected';
  const notice = state === 'pending' ? copy.pending : state === 'cooldown' ? copy.cooldown : state === 'limit' ? copy.limit : state === 'connected' ? copy.connected : null;
  return <section ref={root} aria-label={copy.title} className="lf-rebuild lf-social-tier-card" data-social-audit="private-profile" lang={locale} data-theme={dark ? 'dark' : 'light'}>
    <Copy role="heading" as="h2">{copy.title}</Copy>
    <p className="ugc lf-social-tier-handle" data-copy-role="data">@{username}</p>
    <Copy role="body">{copy.body}</Copy>
    {mode === 'teenRequest' && <Button variant="accent" disabled={state === 'saving' || settled} onClick={onRequest}>{state === 'saving' ? copy.saving : copy.request}</Button>}
    {mode === 'managed' && <Copy role="body">{copy.managed}</Copy>}
    {notice && <InlineNotice tone={state === 'connected' ? 'success' : 'info'} live>{notice}</InlineNotice>}
    {state === 'failed' && <InlineNotice tone="error" live>{copy.failed}</InlineNotice>}
  </section>;
}

/** The same "your Tutor handles your connections" line for a child on a public adult's full profile. */
export function ManagedConnectionsNote({ copy, locale, dark }: { copy: Pick<PrivateProfileCopy, 'managed'>; locale: string; dark: boolean }) {
  return <section className="lf-rebuild lf-social-tier-card" data-social-audit="managed-note" lang={locale} data-theme={dark ? 'dark' : 'light'}>
    <Copy role="body">{copy.managed}</Copy>
  </section>;
}
