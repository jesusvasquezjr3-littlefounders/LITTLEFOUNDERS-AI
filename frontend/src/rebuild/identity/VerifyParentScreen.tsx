import { useState } from 'react';
import { Button, ButtonGroup, ButtonLink, Chip, ErrorState, Glyph, InlineNotice, LoadingState, TextField } from '../design/controls';
import type { Locale } from '../design/copyBudget';
import {
  AuthError, AuthForm, AuthIntro, AuthOutcome, AuthSwitch, DateFields, EMPTY_DATE, follow, identityCopy, isoDate,
  type DateParts, type Navigate,
} from './authBlocks';
import { IdDocumentField } from './IdDocumentField';

/*
 * A7 Become a Tutor (the verified parent, OD-6), rebuilt on the sign-in shell
 * (W2S.2). The Core contract is unchanged (S01, A.5):
 *
 *   - the status comes from Core before anything is claimed: a parent role
 *     alone never shows "already a Tutor"; an unreadable status offers a retry,
 *     never a verdict;
 *   - a revoked verification is not another upload: a person reviews it, so the
 *     screen offers the support address and no form;
 *   - a child account cannot verify as an adult (Core answers FORBIDDEN): the
 *     screen says who can, and offers no retry that could never succeed;
 *   - an account whose own age record is under 18 (AGE_RECORD_MINOR, F3):
 *     no form; the way out is the staff-reviewed age correction in Settings,
 *     or a person when the record cannot be corrected there;
 *   - the steps are explained before the form opens, and the privacy promise
 *     (the photo is checked in memory and never kept) comes first on the form;
 *   - no document-type field (A.5: a declaration that cannot be checked against
 *     the image is not collected);
 *   - every failed check is named, with a way out to a person.
 */

export const ID_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ID_PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const VERIFICATION_CHECKS = ['documentReadable', 'nameMatch', 'birthDateMatch', 'notExpired'] as const;
export type VerificationCheck = (typeof VERIFICATION_CHECKS)[number];

export interface VerifyValues { givenNames: string; surnames: string; birthDate: string; document: File }

export type VerifyView =
  | { kind: 'checking' }
  | { kind: 'status-error'; retrying: boolean }
  | { kind: 'revoked' }
  | { kind: 'ineligible' }
  | { kind: 'minor' }
  | { kind: 'verified' }
  | { kind: 'intro' }
    /** `failedChecks`: null until Core returns a verdict; then the checks it reported as failed (possibly none named). */
  | { kind: 'form'; pending: boolean; errorCode: string | null; failedChecks: readonly VerificationCheck[] | null }
  | { kind: 'success' };

export function VerifyParentScreen({ locale, view, homeHref, familyHref, inviteWaiting = false, settingsHref = '/profile/settings', onRetryStatus, onStart, onSubmit, onNavigate }: {
  locale: Locale; view: VerifyView; homeHref: string; familyHref: string;
  /** GAP-FIX-R5: a Tutor invite waits at `familyHref`; the way on names it. */
  inviteWaiting?: boolean; settingsHref?: string;
  onRetryStatus: () => void; onStart: () => void; onSubmit: (values: VerifyValues) => void; onNavigate?: Navigate;
}) {
  const copy = identityCopy(locale);
  const v = copy.authVerify;
  const [givenNames, setGivenNames] = useState('');
  const [surnames, setSurnames] = useState('');
  const [birth, setBirth] = useState<DateParts>(EMPTY_DATE);
  const [file, setFile] = useState<File | null>(null);
  const support = <a className="lf-auth-link ugc" href={`mailto:${v.supportEmail}?subject=${encodeURIComponent(v.title)}`} data-copy-role="data">{v.supportEmail}</a>;

  switch (view.kind) {
    case 'checking':
      return <div className="lf-auth-page" data-screen="verify-parent" data-surface="app">
        <AuthIntro title={v.title} />
        <LoadingState label={v.checking} lines={2} />
      </div>;
    case 'status-error':
      return <div className="lf-auth-page" data-screen="verify-parent" data-surface="app">
        <AuthIntro title={v.title} />
        <ErrorState heading={v.statusFailedTitle} body={v.statusFailedBody} retryLabel={v.retry} retryingLabel={v.retrying} retrying={view.retrying} onRetry={onRetryStatus} />
      </div>;
    case 'revoked':
      return <AuthOutcome screen="verify-revoked" title={v.revokedTitle} lead={<p className="lf-auth-lead" data-copy-role="body">{v.revokedBody}</p>}>
        <p className="lf-auth-switch">{support}</p>
      </AuthOutcome>;
    case 'minor':
      return <AuthOutcome screen="verify-minor" title={v.minorTitle} lead={<p className="lf-auth-lead" data-copy-role="body">{v.minorBody}</p>}>
        <AuthSwitch label={v.openSettings} href={settingsHref} onNavigate={onNavigate} />
        <p className="lf-auth-switch">{support}</p>
      </AuthOutcome>;
    case 'ineligible':
      return <AuthOutcome screen="verify-ineligible" title={v.ineligibleTitle} lead={<p className="lf-auth-lead" data-copy-role="body">{v.ineligibleBody}</p>}>
        <AuthSwitch label={v.home} href={homeHref} onNavigate={onNavigate} />
      </AuthOutcome>;
    case 'verified':
    case 'success': {
      const done = view.kind === 'success';
      return <AuthOutcome screen={done ? 'verify-success' : 'verify-already'} title={done ? v.successTitle : v.alreadyTitle} focusOnMount={done}
        lead={<p className="lf-auth-lead" data-copy-role="body">{done ? v.successBody : v.alreadyBody}</p>}>
        <p className="lf-auth-chip"><Chip tone="success" glyph="check">{v.verified}</Chip></p>
        <ButtonLink variant="accent" size="lg" href={familyHref} onClick={follow(familyHref, onNavigate)} data-auth="family">{inviteWaiting ? v.openInvite : v.openFamily}</ButtonLink>
      </AuthOutcome>;
    }
    case 'intro':
      return <div className="lf-auth-page" data-screen="verify-intro" data-surface="app">
        <AuthIntro title={v.title} />
        <ol className="lf-auth-steps">
          {[v.step1, v.step2, v.step3].map((step, index) => <li key={step} className="lf-auth-step">
            <span className="lf-auth-step-number" data-copy-role="data" aria-hidden="true">{index + 1}</span>
            <span data-copy-role="body">{step}</span>
          </li>)}
        </ol>
        <ButtonGroup>
          <Button variant="accent" size="lg" onClick={onStart} data-auth="start">{v.ready}</Button>
          <ButtonLink size="lg" href={homeHref} onClick={follow(homeHref, onNavigate)} data-auth="not-now">{v.notNow}</ButtonLink>
        </ButtonGroup>
      </div>;
    case 'form':
      break;
  }

  const birthDate = isoDate(birth);
  const birthTyped = birth.year.length === 4 && birth.day !== '' && birth.month !== '';
  const fileError = file && !(ID_PHOTO_TYPES as readonly string[]).includes(file.type) ? v.photoType
    : file && file.size > ID_PHOTO_MAX_BYTES ? v.photoSize : undefined;
  const ready = givenNames.trim() !== '' && surnames.trim() !== '' && birthDate !== null && file !== null && !fileError;
  const failed = view.failedChecks;
  return <div className="lf-auth-page" data-screen="verify-form" data-surface="app">
    <AuthIntro title={v.title} />
    <p className="lf-auth-privacy" data-copy-role="legal"><Glyph name="info" /><span>{v.privacy}</span></p>
    <AuthForm busy={view.pending} data-auth-form="verify"
      onSubmit={() => { if (ready && !view.pending) onSubmit({ givenNames: givenNames.trim(), surnames: surnames.trim(), birthDate: birthDate!, document: file! }); }}>
      <AuthError copy={copy} code={view.errorCode} />
      {failed ? <section className="lf-auth-checks" data-verify-failed>
        <InlineNotice tone="retry" live>{v.failTitle}</InlineNotice>
        {failed.length > 0 ? <ul className="lf-auth-check-list">
          {failed.map((check) => <li key={check} data-check={check}><Glyph name="cross" /><span data-copy-role="body">{v.checks[check]}</span></li>)}
        </ul> : null}
        <p data-copy-role="body">{v.retryHint}</p>
        <div className="lf-auth-help">
          <p data-copy-role="body">{v.helpBody}</p>
          <a className="lf-auth-link" href={`mailto:${v.supportEmail}?subject=${encodeURIComponent(v.title)}`} data-copy-role="action" data-auth-link="support">{v.writeToUs}</a>
        </div>
      </section> : null}
      <section className="lf-auth-group" aria-labelledby="verify-identity-heading">
        <h2 id="verify-identity-heading" data-copy-role="heading">{v.identity}</h2>
        <TextField label={v.givenNames} value={givenNames} onChange={(event) => setGivenNames(event.target.value)} autoComplete="given-name" maxLength={120} required />
        <TextField label={v.surnames} value={surnames} onChange={(event) => setSurnames(event.target.value)} autoComplete="family-name" maxLength={120} required />
        <DateFields copy={copy} legend={copy.authCommon.birthDate} help={v.birthHelp} value={birth} onChange={setBirth}
          error={birthTyped && birthDate === null ? copy.authCommon.dateInvalid : undefined} />
      </section>
      <section className="lf-auth-group" aria-labelledby="verify-document-heading">
        <h2 id="verify-document-heading" data-copy-role="heading">{v.document}</h2>
        <IdDocumentField label={v.photo} help={v.photoHelp} accept={ID_PHOTO_TYPES.join(',')} file={file} onFileChange={setFile}
          chooseLabel={v.choosePhoto} replaceLabel={v.changePhoto} error={fileError} disabled={view.pending} />
      </section>
      <Button type="submit" variant="accent" size="lg" disabled={!ready} pending={view.pending} pendingLabel={v.submitting} data-auth="submit">{v.submit}</Button>
    </AuthForm>
  </div>;
}
