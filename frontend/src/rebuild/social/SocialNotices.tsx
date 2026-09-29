import { Button, Copy, InlineNotice, LoadingState } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './socialNotices.css';
import { ConnectionActions, type ConnectionActionHandlers } from './ConnectionActions';

/*
 * E.3's guardian-facing safety notices: the Family panel shows, per verified
 * guardian, when a report involved one of their kids (their kid reported,
 * their kid was reported, or their kid was connected to a reported account).
 * Names resolve through Core's existing E.1 discovery admission — a reported
 * account the guardian cannot otherwise see stays private rather than having
 * its name leaked through the notice. Copy-only, no transport: the routes
 * wrapper owns the data plane.
 */

export interface SocialNoticeEntry {
  noticeId: string;
  kidUserId: string;
  subjectId: string;
  subjectName: string | null;
  createdAt: string;
  /** Core's word that this named account is still connected to a guardian-tier child (E.1/E.13). */
  canEnd: boolean;
}

export interface SocialNoticesCopy {
  title: string;
  close: string;
  loading: string;
  failed: string;
  empty: string;
  retry: string;
  body: string;
  bodyNamed: string;
}

export function SocialNotices({ copy, locale, dark, open, notices, loading, failed, actions, notice = null, onOpen, onClose, onRetry }: {
  copy: SocialNoticesCopy;
  locale: string;
  dark: boolean;
  open: boolean;
  notices: SocialNoticeEntry[];
  loading: boolean;
  failed: boolean;
  /** GAP-FIX-R3 social: a notice that names an account offers the Tutor's actions (keyed by the notice's child). */
  actions?: (kidUserId: string) => ConnectionActionHandlers;
  notice?: { text: string; error: boolean } | null;
  onOpen: () => void;
  onClose: () => void;
  onRetry: () => void;
}) {
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  return <section className="lf-rebuild lf-social-notices" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-label={copy.title}>
    <Button aria-expanded={open} onClick={open ? onClose : onOpen}>{open ? copy.close : copy.title}</Button>
    {open && <>
      <Copy role="heading" as="h2">{copy.title}</Copy>
      {failed ? <><InlineNotice tone="error" live>{copy.failed}</InlineNotice><Button onClick={onRetry}>{copy.retry}</Button></> : <>
        {notice && <InlineNotice tone={notice.error ? 'error' : 'info'} live>{notice.text}</InlineNotice>}
        <ul>{notices.map(entry => <li key={entry.noticeId}>
          <Copy role="body">{entry.subjectName !== null ? copy.bodyNamed.replace('{name}', entry.subjectName) : copy.body}</Copy>
          <Copy role="body">{date.format(new Date(entry.createdAt))}</Copy>
          {actions && entry.subjectName !== null && <ConnectionActions actions={actions(entry.kidUserId)} userId={entry.subjectId} name={entry.subjectName} canEnd={entry.canEnd} />}
        </li>)}</ul>
        {!loading && notices.length === 0 && <Copy role="body">{copy.empty}</Copy>}
        {loading && <LoadingState label={copy.loading} lines={2} />}
      </>}
    </>}
  </section>;
}
