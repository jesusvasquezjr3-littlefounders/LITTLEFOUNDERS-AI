import { Copy } from '../design/controls';
import './kidSuspended.css';

/*
 * A.1's suspended-account screen: a kid whose last verified guardian link
 * disappeared. Core revoked the sessions, so this is the only surface the
 * account can reach — and it must say the truth plainly: the account is
 * paused until an active verified Tutor supervises it again, and how to get
 * help. No blame, no shame, no dead ends (Bible 02 §9.7 failure states).
 *
 * The content only: the route renders it on the standalone single-state
 * screen (app-shell/StandaloneState), which owns the root, the <main>, the
 * skip link, the document title and the language.
 */

export interface KidSuspendedCopy {
  title: string;
  suspendedBody: string;
  deletedBody: string;
  help: string;
  supportEmail: string;
}

export function KidSuspendedScreen({ copy, variant }: {
  copy: KidSuspendedCopy;
  variant: 'suspended' | 'deleted';
}) {
  const [before, after = ''] = copy.help.split('{email}');
  return <div className="lf-kid-suspended" data-screen="account-suspended">
    <Copy role="heading" as="h1">{copy.title}</Copy>
    <Copy role="body">{variant === 'deleted' ? copy.deletedBody : copy.suspendedBody}</Copy>
    {/* "Ask a parent to email {email}." reads as "Ask a parent to email:" with the address on the next line. */}
    <Copy role="body">{`${before}${after}`.replace(/\s*[.!?]$/u, '').trim()}:</Copy>
    {/* The address, on its own line as a link a parent can press on this device (W2S.2): data, not copy. */}
    <a className="lf-kid-suspended-email ugc" href={`mailto:${copy.supportEmail}`} data-copy-role="data">{copy.supportEmail}</a>
  </div>;
}
