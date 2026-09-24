import { Copy } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './kidSuspended.css';

/*
 * A.1's suspended-account screen: a kid whose last verified guardian link
 * disappeared. Core revoked the sessions, so this is the only surface the
 * account can reach — and it must say the truth plainly: the account is
 * paused until an active verified Tutor supervises it again, and how to get
 * help. No blame, no shame, no dead ends (Bible 02 §9.7 failure states).
 */

export interface KidSuspendedCopy {
  title: string;
  suspendedBody: string;
  deletedBody: string;
  help: string;
  supportEmail: string;
}

export function KidSuspendedScreen({ copy, locale, dark, variant }: {
  copy: KidSuspendedCopy;
  locale: string;
  dark: boolean;
  variant: 'suspended' | 'deleted';
}) {
  return <main className="lf-rebuild lf-kid-suspended" data-theme={dark ? 'dark' : 'light'} lang={locale}>
    <Copy role="heading" as="h1">{copy.title}</Copy>
    <Copy role="body">{variant === 'deleted' ? copy.deletedBody : copy.suspendedBody}</Copy>
    <Copy role="body">{copy.help.replace('{email}', copy.supportEmail)}</Copy>
  </main>;
}
