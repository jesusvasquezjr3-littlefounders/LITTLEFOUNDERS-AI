import { useCallback, useEffect, useRef, useState } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button, ButtonGroup, InlineNotice, Skeleton } from '../design/controls';
import { getVoiceConsent, grantVoiceConsent, revokeVoiceConsent, type ConsentState } from './session/tutorApi';
import type { MentorVoiceConsentCopy } from './screen/MentorScreen';
import '../design/tokens.css';
import '../design/system.css';
import './voiceConsent.css';

/*
 * The microphone permission for one child, as the verified Tutor (their
 * parent) meets it (C.2; the guardian surface of T1b's "a grown-up must allow
 * the microphone"). Rebuilt from the legacy control's contract, not its code:
 *
 *   - POLICY BEFORE CONSENT: while Core says minors' voice is not offered at
 *     all (`policy: blocked`, or an answer without the field), there is nothing
 *     to agree to, so no "allow" is offered; the line says why. Revoking is
 *     never gated: a permission granted while the policy was open stays
 *     withdrawable after it closes.
 *   - Granting takes two deliberate presses and shows the wording first; the
 *     EXACT wording shown is what Core stores with the record, so a dispute is
 *     resolved against what was on the screen. Turning it off is one press.
 *   - A failed refresh after a write keeps the confirmed state; only the very
 *     first read has nothing to fall back to.
 *
 * It reads and writes through Core only (`/tutor/consent`, `coreVoiceConsentApi`).
 * Mounted by the family surface that lists a verified Tutor's children (Lane
 * 4's rebuilt Family Hub), with the child's id and name:
 *   <VoiceConsent kidUserId={id} kidName={name} api={coreVoiceConsentApi(getToken)}
 *     copy={mentorCopy(locale).mentorVoiceConsent} locale={locale} />
 */

type State =
  | { status: 'loading' }
  | { status: 'ready'; active: boolean; grantedAt: string | null; policy: 'allowed' | 'blocked' }
  | { status: 'error' };

/** The three Core calls, bound to the signed-in Tutor; the preview and the tests hand in fixtures. Null: Core could not answer. */
export interface VoiceConsentApi {
  read: (kidUserId: string) => Promise<ConsentState | null>;
  grant: (input: { kidUserId: string; consentText: string; locale: string }) => Promise<{ grantedAt: string } | null>;
  revoke: (kidUserId: string) => Promise<boolean>;
}

export function coreVoiceConsentApi(getToken: () => Promise<string | null>): VoiceConsentApi {
  return {
    read: async (kidUserId) => { const token = await getToken(); return token ? (await getVoiceConsent(token, kidUserId)).data : null; },
    grant: async (input) => { const token = await getToken(); return token ? (await grantVoiceConsent(token, input)).data : null; },
    revoke: async (kidUserId) => { const token = await getToken(); return token ? !(await revokeVoiceConsent(token, kidUserId)).error : false; },
  };
}

export interface VoiceConsentProps {
  kidUserId: string;
  /** Shown in the confirmation, so the Tutor sees who they are deciding for. */
  kidName: string;
  api: VoiceConsentApi;
  copy: MentorVoiceConsentCopy;
  locale: Locale;
  /** The wording open from the first render (the development preview and its audits). */
  initiallyConfirming?: boolean;
  /** The title's heading level where it is mounted: under a child's name in the family page (3), or the page's own title (1, the preview). */
  headingLevel?: 1 | 2 | 3;
}

export function VoiceConsent({ kidUserId, kidName, api, copy, locale, initiallyConfirming = false, headingLevel = 3 }: VoiceConsentProps) {
  const Heading = `h${headingLevel}` as const;
  const [state, setState] = useState<State>({ status: 'loading' });
  const [confirming, setConfirming] = useState(initiallyConfirming);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // A caller may build the api inline: it is read through a ref, so a new object is never a reason to read again.
  const calls = useRef(api);
  calls.current = api;

  const load = useCallback(async () => {
    const result = await calls.current.read(kidUserId).catch(() => null);
    if (result) {
      const { active, grantedAt, policy } = result;
      // An answer that lost the policy field is never read as permission.
      setState({ status: 'ready', active, grantedAt, policy: policy === 'allowed' ? 'allowed' : 'blocked' });
      return;
    }
    setState((previous) => (previous.status === 'ready' ? previous : { status: 'error' }));
  }, [kidUserId]);
  useEffect(() => { void load(); }, [load]);

  const grant = async () => {
    setBusy(true); setFailed(false);
    // The rendered wording, never a key: the record keeps what this parent read today.
    const result = await calls.current.grant({ kidUserId, consentText: copy.body, locale }).catch(() => null);
    setBusy(false);
    if (!result) { setFailed(true); return; }
    setConfirming(false);
    setState((previous) => ({ status: 'ready', active: true, grantedAt: result.grantedAt, policy: previous.status === 'ready' ? previous.policy : 'allowed' }));
    await load();
  };

  const revoke = async () => {
    setBusy(true); setFailed(false);
    const revoked = await calls.current.revoke(kidUserId).catch(() => false);
    setBusy(false);
    if (!revoked) { setFailed(true); return; }
    setState((previous) => ({ status: 'ready', active: false, grantedAt: null, policy: previous.status === 'ready' ? previous.policy : 'allowed' }));
    await load();
  };

  const ready = state.status === 'ready' ? state : null;
  const blocked = ready?.policy === 'blocked';
  const date = ready?.grantedAt ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(ready.grantedAt)) : '';
  const status = !ready ? null
    : blocked ? (ready.active ? copy.pausedByPolicy : copy.unavailable)
      : ready.active && date ? copy.activeSince.replace('{date}', date) : copy.inactive;

  return <section className="lf-voice-consent" data-screen="mentor-voice-consent" aria-labelledby={`voice-consent-${kidUserId}`}
    data-consent={ready ? (ready.active ? 'active' : 'off') : state.status} data-policy={ready?.policy}>
    <Heading id={`voice-consent-${kidUserId}`} className="lf-voice-consent-title" data-copy-role="heading">{copy.title}</Heading>
    {state.status === 'loading' ? <div role="status" aria-label={copy.loading}><Skeleton lines={1} /></div> : null}
    {status ? <p className="lf-voice-consent-status" data-copy-role="body">{status}</p> : null}
    {ready?.active
      ? <ButtonGroup><Button variant="secondary" disabled={busy} data-consent-action="revoke" onClick={() => void revoke()}>{copy.revoke}</Button></ButtonGroup>
      : ready && !blocked && !confirming
        ? <ButtonGroup><Button variant="secondary" disabled={busy} aria-expanded={false} data-consent-action="open" onClick={() => setConfirming(true)}>{copy.grant}</Button></ButtonGroup>
        : null}
    {confirming && ready && !ready.active && !blocked ? <div className="lf-voice-consent-confirm">
      <p className="lf-voice-consent-for" data-copy-role="data">{copy.forChild.replace('{name}', kidName)}</p>
      <p className="lf-voice-consent-body" data-copy-role="legal">{copy.body}</p>
      <ButtonGroup>
        <Button variant="accent" disabled={busy} pending={busy} pendingLabel={copy.saving} data-consent-action="grant" onClick={() => void grant()}>{copy.confirm}</Button>
        <Button variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>{copy.cancel}</Button>
      </ButtonGroup>
    </div> : null}
    {failed || state.status === 'error' ? <InlineNotice tone="error" live>{copy.failed}</InlineNotice> : null}
  </section>;
}
