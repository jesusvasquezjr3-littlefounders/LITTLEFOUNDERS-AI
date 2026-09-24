import { Button, Copy } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './socialNotices.css';

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

export function SocialNotices({ copy, locale, dark, open, notices, loading, failed, onOpen, onClose, onRetry }: {
  copy: SocialNoticesCopy;
  locale: string;
  dark: boolean;
  open: boolean;
  notices: SocialNoticeEntry[];
  loading: boolean;
  failed: boolean;
  onOpen: () => void;
  onClose: () => void;
  onRetry: () => void;
}) {
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  return <section className="lf-rebuild lf-social-notices" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-label={copy.title}>
    <Button aria-expanded={open} onClick={open ? onClose : onOpen}>{open ? copy.close : copy.title}</Button>
    {open && <>
      <Copy role="heading" as="h2">{copy.title}</Copy>
      {failed ? <><div role="alert"><Copy role="body">{copy.failed}</Copy></div><Button onClick={onRetry}>{copy.retry}</Button></> : <>
        <ul>{notices.map(notice => <li key={notice.noticeId}>
          <Copy role="body">{notice.subjectName !== null ? copy.bodyNamed.replace('{name}', notice.subjectName) : copy.body}</Copy>
          <Copy role="body">{date.format(new Date(notice.createdAt))}</Copy>
        </li>)}</ul>
        {!loading && notices.length === 0 && <Copy role="body">{copy.empty}</Copy>}
        {loading && <div role="status"><Copy role="body">{copy.loading}</Copy></div>}
      </>}
    </>}
  </section>;
}
