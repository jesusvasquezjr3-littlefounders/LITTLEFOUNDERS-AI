import { Button, Copy, InlineNotice } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './guardianInvite.css';

/*
 * A.1's second-verified-guardian surfaces, one copy-driven component with
 * two modes:
 *  - "mint": an existing verified parent creates a single-use 7-day invite
 *    link for one kid and copies it out of band to the second parent.
 *  - "accept": the joining verified parent previews the kid (display name
 *    only — the data plane never returns contact data) and accepts; Core's
 *    one-shot exchange writes the verified link and reactivates the kid.
 * No transport here — the routes wrapper owns every call, including the
 * clipboard write behind the copy button.
 */

export interface GuardianInviteCopy {
  title: string;
  close: string;
  invite: string;
  inviting: string;
  linkReady: string;
  copy: string;
  copied: string;
  failed: string;
  copyFailed: string;
  acceptTitle: string;
  acceptBody: string;
  accept: string;
  accepting: string;
  accepted: string;
  acceptFailed: string;
  expired: string;
}

export function GuardianInviteMint({ copy, locale, dark, open, creating, link, copied, notice, noticeIsError, onOpen, onClose, onMint, onCopy }: {
  copy: GuardianInviteCopy;
  locale: string;
  dark: boolean;
  open: boolean;
  creating: boolean;
  link: string | null;
  copied: boolean;
  notice: string | null;
  noticeIsError: boolean;
  onOpen: () => void;
  onClose: () => void;
  onMint: () => void;
  onCopy: () => void;
}) {
  return <section className="lf-rebuild lf-guardian-invite" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-label={copy.title}>
    <Button aria-expanded={open} onClick={open ? onClose : onOpen}>{open ? copy.close : copy.title}</Button>
    {open && <>
      <Copy role="heading" as="h2">{copy.title}</Copy>
      {notice && <InlineNotice tone={noticeIsError ? 'error' : 'info'} live>{notice}</InlineNotice>}
      {link === null && !creating && <Button onClick={onMint}>{copy.invite}</Button>}
      {creating && <InlineNotice tone="info" live>{copy.inviting}</InlineNotice>}
      {link !== null && <div className="lf-guardian-invite-link">
        <Copy role="body">{copy.linkReady}</Copy>
        <div className="lf-guardian-invite-link-row">
          <span className="lf-guardian-invite-link-value" aria-label="invite link">{link}</span>
          <Button onClick={onCopy}>{copied ? copy.copied : copy.copy}</Button>
        </div>
      </div>}
    </>}
  </section>;
}

export function GuardianInviteAccept({ copy, locale, dark, kidName, accepting, accepted, failed, expired, onAccept }: {
  copy: GuardianInviteCopy;
  locale: string;
  dark: boolean;
  kidName: string | null;
  accepting: boolean;
  accepted: boolean;
  failed: boolean;
  expired: boolean;
  onAccept: () => void;
}) {
  return <section className="lf-rebuild lf-guardian-invite" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-label={copy.acceptTitle}>
    <Copy role="heading" as="h2">{copy.acceptTitle}</Copy>
    {accepted ? <InlineNotice tone="success" live>{copy.accepted}</InlineNotice> : expired ? <InlineNotice tone="error" live>{copy.expired}</InlineNotice> : <>
      <Copy role="body">{copy.acceptBody.replace('{name}', kidName ?? '…')}</Copy>
      {failed && <InlineNotice tone="error" live>{copy.acceptFailed}</InlineNotice>}
      <Button onClick={onAccept} disabled={accepting || kidName === null}>{accepting ? copy.accepting : copy.accept}</Button>
    </>}
  </section>;
}
