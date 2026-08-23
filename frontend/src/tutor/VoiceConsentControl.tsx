import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from '@/components/ui';
import { getVoiceConsent, grantVoiceConsent, revokeVoiceConsent } from './tutorApi';

/*
 * The microphone gate, as a guardian meets it (/ORACLE.md §4.3).
 *
 * DELIBERATELY NOT A BARE SWITCH, unlike the analytics toggle beside it. This
 * consent sends a child's voice to a third party, and the server stores the
 * EXACT WORDING the guardian was shown so a later dispute is resolved against
 * what was on the screen. A switch that flips without showing that wording
 * would make the stored record a lie by omission.
 *
 * So: turning it ON opens the text and requires a second, deliberate press.
 * Turning it OFF is immediate. **Revocation must always be easier than
 * granting** — if a parent has second thoughts, the product must not make them
 * read anything first.
 *
 * The control fetches its own state rather than being fed from the family
 * payload. That is one request per child, which for a family is trivial, and
 * it keeps this feature from widening an endpoint that has nothing to do with
 * the Tutor.
 */

export interface VoiceConsentControlProps {
  kidUserId: string;
  token: string | null;
  /** Shown in the confirmation, so the guardian sees who they are consenting for. */
  kidName: string;
}

type State =
  | { status: 'loading' }
  | { status: 'ready'; active: boolean; grantedAt: string | null; policy: 'allowed' | 'blocked' }
  | { status: 'error' };

export function VoiceConsentControl({ kidUserId, token, kidName }: VoiceConsentControlProps) {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const result = await getVoiceConsent(token, kidUserId);
    setState(
      result.data
        ? {
            status: 'ready',
            active: result.data.active,
            grantedAt: result.data.grantedAt,
            // An older build, or a payload that lost the field, must not be
            // read as permission. Absent means blocked.
            policy: result.data.policy === 'allowed' ? 'allowed' : 'blocked',
          }
        : { status: 'error' },
    );
  }, [token, kidUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const grant = async () => {
    if (!token) return;
    setBusy(true);
    setFailed(false);
    /*
     * The rendered string, not the key. Core stores it verbatim: a translation
     * file can change tomorrow, and the record must keep saying what this
     * guardian actually read today.
     */
    const consentText = t('tutor.consent.body');
    const locale = normalizeLocale(i18n.language);
    const result = await grantVoiceConsent(token, { kidUserId, consentText, locale });
    setBusy(false);
    if (result.error || !result.data) {
      setFailed(true);
      return;
    }
    setConfirming(false);
    await load();
  };

  const revoke = async () => {
    if (!token) return;
    setBusy(true);
    setFailed(false);
    const result = await revokeVoiceConsent(token, kidUserId);
    setBusy(false);
    if (result.error) {
      setFailed(true);
      return;
    }
    await load();
  };

  if (state.status === 'loading') return null;

  const active = state.status === 'ready' && state.active;
  const formatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' });

  /*
   * POLICY BEFORE CONSENT (/ORACLE.md §16).
   *
   * While the platform is not offering minors' voice at all, there is nothing
   * here for a guardian to decide. Showing them a switch would be asking for
   * agreement to wording that is still a placeholder, in exchange for a
   * microphone that stays shut either way.
   *
   * So the control STAYS — hiding it would leave a parent wondering whether
   * they missed a setting — and says the true reason instead of offering a
   * permission that does nothing. Revocation is never gated: a consent granted
   * while the policy was open must remain withdrawable after it closes.
   */
  const policyBlocked = state.status === 'ready' && state.policy === 'blocked';
  const canGrant = !policyBlocked;

  const statusLine = policyBlocked
    ? t(active ? 'tutor.consent.pausedByPolicy' : 'tutor.consent.unavailable')
    : active && state.status === 'ready' && state.grantedAt
      ? t('tutor.consent.activeSince', { date: formatter.format(new Date(state.grantedAt)) })
      : t('tutor.consent.inactive');

  return (
    <div className="border-t border-outline/50 px-4 py-2.5">
      {/*
        STACKED ON MOBILE, side by side from `sm`. Not a preference: at 375 px
        the buttons here carry a full sentence ("Allow the microphone",
        "Permitir el micrófono"), and a `shrink-0` button that wide leaves the
        label about eighty pixels — which renders as one word per line. Caught
        by looking at it, which is why §1.11 asks for both breakpoints rather
        than for a test.
      */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <span className="flex min-w-0 flex-1 items-start gap-3">
          <Icon name="mic" className="mt-0.5 shrink-0 text-[18px] text-content-faint" aria-hidden />
          <span className="min-w-0">
            <span className="lf-caption block text-content">{t('tutor.consent.title')}</span>
            {/*
              `content-muted` (7.6:1), never `content-faint` (2.56:1 — a WCAG
              AA failure caught by axe). This sentence tells a parent whether
              their child's microphone is on; it is status, not decoration, and
              the one line here that must never be hard to read.
            */}
            <span className="lf-caption block text-content-muted">{statusLine}</span>
          </span>
        </span>

        {active ? (
          <Button
            variant="secondary"
            onClick={() => void revoke()}
            disabled={busy}
            className="w-full sm:w-auto sm:shrink-0"
          >
            {t('tutor.consent.revoke')}
          </Button>
        ) : canGrant ? (
          <Button
            variant="secondary"
            onClick={() => setConfirming((open) => !open)}
            disabled={busy}
            aria-expanded={confirming}
            className="w-full sm:w-auto sm:shrink-0"
          >
            {t('tutor.consent.grant')}
          </Button>
        ) : null}
      </div>

      {confirming && !active && canGrant && (
        <div className="mt-3 rounded-md bg-surface-sunken p-3">
          <p className="lf-label mb-1 text-content">
            {t('tutor.consent.forChild', { name: kidName })}
          </p>
          {/* The wording that will be stored with the record, shown before it is. */}
          <p className="lf-body mb-3 text-content">{t('tutor.consent.body')}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={() => void grant()} disabled={busy} className="w-full sm:w-auto">
              {busy ? t('tutor.consent.granting') : t('tutor.consent.confirm')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="w-full sm:w-auto"
            >
              {t('tutor.consent.cancel')}
            </Button>
          </div>
        </div>
      )}

      {(failed || state.status === 'error') && (
        <p className="lf-caption mt-2 text-content-muted" role="status">
          {t('tutor.consent.failed')}
        </p>
      )}
    </div>
  );
}

function normalizeLocale(raw: string): 'en-US' | 'es-MX' | 'pt-BR' {
  if (raw.startsWith('en')) return 'en-US';
  if (raw.startsWith('pt')) return 'pt-BR';
  return 'es-MX';
}
