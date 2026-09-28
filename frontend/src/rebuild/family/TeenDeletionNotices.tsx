import { useId } from 'react';
import type en from '../../i18n/en-US/rebuild-family.json';
import { Button, Copy } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';

/*
 * GAP-FIX-R2 (owner review D-14 (b), E.6, OD-3 section 2): a linked teen who
 * asked to delete their own account, told to each verified Tutor. Notify
 * only: the teen's display name, the date the account is deleted, and that
 * the teen can keep it by signing in before then. No reason, no control: the
 * account is the teen's own (OD-3 Option B), and the Tutor has nothing to
 * approve. Core serves only the open requests, so a teen who keeps the
 * account drops out without a second notice. Renders nothing when there is
 * nothing to tell. Adult register (B.23).
 */

export type TeenDeletionNoticesCopy = typeof en.familyDeletionNotices;
export interface TeenDeletionNoticeItem { id: string; displayName: string; scheduledFor: string }

export function TeenDeletionNotices({ copy, locale, dark, notices, failed, onRetry }: {
  copy: TeenDeletionNoticesCopy;
  locale: string;
  dark: boolean;
  notices: TeenDeletionNoticeItem[] | null;
  failed: boolean;
  onRetry: () => void;
}) {
  const heading = useId();
  if (!failed && (!notices || notices.length === 0)) return null;
  const date = (iso: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
  return <section className="lf-rebuild lf-family-hub" data-family-part="deletion-notices" data-theme={dark ? 'dark' : 'light'} lang={locale}
    aria-labelledby={heading}>
    <h2 id={heading} data-copy-role="heading">{copy.title}</h2>
    {failed ? <>
      <Copy role="body">{copy.failed}</Copy>
      <div className="lf-family-hub-actions"><Button onClick={onRetry}>{copy.retry}</Button></div>
    </> : <ul className="lf-family-hub-list">
      {notices!.map((notice) => {
        const name = notice.displayName.trim() || '…';
        return <li key={notice.id} data-deletion-notice={notice.id}>
          <Copy role="body">{copy.body.replace('{name}', name).replace('{date}', date(notice.scheduledFor))}</Copy>
          <Copy role="body">{copy.keep.replace('{name}', name)}</Copy>
        </li>;
      })}
    </ul>}
  </section>;
}
