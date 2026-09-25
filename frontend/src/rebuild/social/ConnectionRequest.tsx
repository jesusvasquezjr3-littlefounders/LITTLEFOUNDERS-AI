import { useEffect, useRef } from 'react';
import { Button, InlineNotice } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './socialGraph.css';
export interface RequestCopy { action: string; saving: string; pending: string; failed: string }
export function ConnectionRequest({ copy, locale, dark, status, onRequest }: { copy: RequestCopy; locale: string; dark: boolean; status: 'idle' | 'saving' | 'pending' | 'failed'; onRequest: () => void }) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (status === 'failed' && document.activeElement === document.body) root.current?.querySelector('button')?.focus();
  }, [status]);
  return <section ref={root} aria-label={copy.action} className="lf-rebuild lf-social-graph" data-social-audit="connection-request" lang={locale} data-theme={dark ? 'dark' : 'light'}>
    <Button variant="accent" disabled={status === 'saving' || status === 'pending'} onClick={onRequest}>{status === 'saving' ? copy.saving : copy.action}</Button>
    {status === 'pending' && <InlineNotice tone="info" live>{copy.pending}</InlineNotice>}
    {status === 'failed' && <InlineNotice tone="error" live>{copy.failed}</InlineNotice>}
  </section>;
}
