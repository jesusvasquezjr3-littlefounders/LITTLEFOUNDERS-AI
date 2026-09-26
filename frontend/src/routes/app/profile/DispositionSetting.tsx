import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { useShellLocale } from '@/app-shell/ShellRoot';
import { useTheme } from '@/theme/useTheme';
import { useWalletAccess } from '@/routes/app/wallet/useWalletAccess';
import { useAnnounce } from '@/rebuild/design/controls';
import { DispositionSummary } from '@/rebuild/mentor/DispositionSummary';
import { getOwnDisposition, resetOwnDisposition, type DispositionSummaryData } from '@/rebuild/mentor/allianceApi';
import en from '@/i18n/en-US/rebuild-mentor.json';
import es from '@/i18n/es-MX/rebuild-mentor.json';
import pt from '@/i18n/pt-BR/rebuild-mentor.json';

/*
 * C.7 in Settings: the learner's own disposition profile ("how you learn"),
 * the Mentor lane's rebuilt `DispositionSummary` in its own-view form.
 *
 * Who may reset it is Core's rule (the OD-18 memory rule): a child's profile
 * is reset by their verified Tutor, a teen without a guardian link and an
 * adult reset their own. The reset button is offered only where that rule
 * can allow it: never for the kid role, never for a teen whose wallet
 * classification says they are a child in a family (a verified guardian link
 * exists). Core decides again on the DELETE; a refusal there hides the button
 * and says the reset did not happen, never that it did.
 */

const COPY = { 'en-US': en, 'es-MX': es, 'pt-BR': pt } as const;
const HELP = ['independent', 'hint_seeking', 'tell_early', 'unknown'];
const PERSISTENCE = ['persists', 'disengages_early', 'unknown'];
const EXPLANATION = ['explains', 'needs_scaffold', 'unknown'];
const ADAPTATIONS = ['slower_pacing', 'more_examples', 'less_text', 'more_visual', 'repeat_before_advancing'];

/** Core's answer with every label the summary names checked against the closed vocabulary. */
export function validDisposition(value: unknown): value is DispositionSummaryData {
  const data = value as Partial<DispositionSummaryData> | null;
  return !!data && typeof data.exists === 'boolean' && typeof data.current === 'boolean'
    && HELP.includes(data.helpStyle as string) && PERSISTENCE.includes(data.persistence as string) && EXPLANATION.includes(data.explanation as string)
    && Array.isArray(data.persistentlyDeclined) && data.persistentlyDeclined.every((entry) => ADAPTATIONS.includes(entry))
    && (data.typicalReplySeconds === null || (typeof data.typicalReplySeconds === 'number' && Number.isFinite(data.typicalReplySeconds)));
}

export function DispositionSetting() {
  const { session, isGuest } = useAuth();
  return !session || isGuest ? null : <ScopedDisposition key={session.user.id} />;
}

function ScopedDisposition() {
  const { getToken, roles } = useAuth();
  const wallet = useWalletAccess();
  const locale = useShellLocale();
  const { isDark } = useTheme();
  const [phase, setPhase] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [data, setData] = useState<DispositionSummaryData | null>(null);
  const [resetState, setResetState] = useState<'idle' | 'resetting' | 'done' | 'failed'>('idle');
  const [refused, setRefused] = useState(false);
  const busy = useRef(false);
  const announce = useAnnounce();
  const copy = COPY[locale].mentorProfile;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getToken();
      const result = token ? await getOwnDisposition(token) : null;
      if (cancelled) return;
      if (!result || !validDisposition(result.data)) { setPhase('failed'); return; }
      setData(result.data);
      setPhase('ready');
    })();
    return () => { cancelled = true; };
  }, [getToken]);

  const canReset = !refused && wallet.loaded && !roles.includes('kid') && !wallet.familyChild;

  async function reset() {
    if (busy.current) return;
    busy.current = true;
    setResetState('resetting');
    try {
      const token = await getToken();
      const result = token ? await resetOwnDisposition(token) : null;
      if (result?.data?.reset === true) {
        // The profile is gone: the summary now says so ("nothing yet"), and the outcome is announced once.
        setResetState('done');
        setData((current) => current && { ...current, exists: false, persistentlyDeclined: [], typicalReplySeconds: null });
        announce(copy.resetDone);
        return;
      }
      const code = result?.error?.code;
      if (code === 'GUARDIAN_MANAGED' || code === 'AGE_EVIDENCE_REQUIRED') {
        // Core says this account does not reset its own profile: no button to press again, and the outcome said once.
        setRefused(true);
        announce(copy.resetFailed, 'assertive');
      }
      setResetState('failed');
    } finally {
      busy.current = false;
    }
  }

  return <DispositionSummary copy={copy} locale={locale} dark={isDark} audience="own" phase={phase} data={data}
    canReset={canReset} resetState={resetState} onReset={() => void reset()} />;
}
