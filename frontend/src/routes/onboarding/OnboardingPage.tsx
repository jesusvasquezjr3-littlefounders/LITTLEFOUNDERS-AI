import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { APP_HOME } from '@/routes/app/navConfig';
import { api } from '@/lib/api';
import { Button, Field, OptionGroup, SectionHeading, type OptionGroupOption } from '@/components/ui';
import { GuidedStage } from '@/guided-voice/GuidedStage';
import { characterFor, useGuidedVoice } from '@/guided-voice/useGuidedVoice';

/*
 * Guest-first onboarding, narrated by the characters in their own voices.
 *
 * WHAT CHANGED. This was four silent form steps with a static mascot beside
 * them. It is now a guided sequence: one character on screen at a time, saying
 * one line out loud, asking for one thing. Everything that is not those three
 * elements has been taken off the screen on purpose — a first-run screen
 * competing for attention is a first-run screen people leave.
 *
 * WHY THE FIRST LINE IS TAP-TO-HEAR. Browsers refuse audio until the page has
 * been touched, on every browser, for every learner. Rather than fight that
 * with a silent-clip unlock and hope, the welcome step simply shows its line
 * and offers a speaker button; the tap that starts the flow is the gesture, and
 * every line after it plays on its own. Honest about the platform instead of
 * appearing broken on the one screen that forms a first impression.
 *
 * SUBTITLES ALWAYS. Every spoken line is on screen as text, at all times, for
 * whoever cannot hear it, has sound off, or is on the majority of first visits
 * where audio has not been unlocked yet.
 */

const DISCOVERY_CHANNELS = ['friend', 'social_media', 'search', 'app_store', 'school', 'ad', 'other'] as const;
type DiscoveryChannel = (typeof DISCOVERY_CHANNELS)[number];

// Mandatory age declaration happens in RequireAgeScreen before this flow.
const STEPS = ['welcome', 'name', 'discovery', 'account'] as const;
type StepName = (typeof STEPS)[number];

export function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getToken, refreshMe, onboardingComplete } = useAuth();
  const voice = useGuidedVoice();

  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [discoveryChannel, setDiscoveryChannel] = useState<DiscoveryChannel | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  /** Flips on the first tap. Until then the browser will refuse to make noise anyway. */
  const gestured = useRef(false);

  const current: StepName = STEPS[step]!;
  const narrationKey = `onboarding.${current}`;
  const line = t(`onboarding.narration.${current}`);
  // Pulled out because these two are stable across a `speaking` change, and the
  // narration effect below must not re-run when the mouth starts moving.
  const { speak, stop } = voice;

  // Speak each step as it arrives — but never before the learner has touched
  // the page, where the browser would refuse and the failure would look like a
  // bug rather than a policy.
  useEffect(() => {
    if (!gestured.current) return;
    speak(narrationKey, line);
    return () => stop();
  }, [narrationKey, line, speak, stop]);

  // The `!submitting` guard matters: refreshMe() flips onboardingComplete via
  // AuthContext BEFORE complete()'s own navigate() runs (loadMe's setState
  // reaches React's scheduler in fewer microtask hops), so without it this
  // defensive redirect raced the "created_now" branch's navigate to
  // /upgrade-account and won, silently skipping account creation for every
  // guest who chose to save their progress. `submitting` stays true for the
  // whole success path specifically so this guard can tell "mid-flow, by our
  // own submit" apart from "returned here after finishing, via back button".
  if (onboardingComplete && !submitting) return <Navigate to={APP_HOME} replace />;

  const trimmedName = displayName.trim();

  function advance(delta: 1 | -1) {
    gestured.current = true;
    stop();
    setStep((s) => Math.min(Math.max(s + delta, 0), STEPS.length - 1));
  }

  async function complete(accountOfferChoice: 'created_now' | 'later') {
    setSubmitting(true);
    setError(false);
    stop();
    const token = await getToken();
    const { error: apiError } = await api<{ streakDays: number }>('/onboarding/complete', {
      body: {
        displayName: trimmedName,
        discoveryChannel: discoveryChannel ?? undefined,
        accountOfferChoice,
        localDate: new Date().toISOString().slice(0, 10),
      },
      token,
    });
    if (apiError) {
      setSubmitting(false);
      setError(true);
      return;
    }
    // submitting stays true (see the guard above) — reset only on the error path.
    await refreshMe();
    navigate(accountOfferChoice === 'created_now' ? '/upgrade-account' : APP_HOME, { replace: true });
  }

  const discoveryOptions: OptionGroupOption<DiscoveryChannel>[] = DISCOVERY_CHANNELS.map((value) => ({
    value,
    label: t(`onboarding.discovery.options.${value}`),
  }));

  /*
   * The character reacts to the learner's filled name with an on-screen aside.
   * These are interpolated and so have
   * no recorded audio by construction; the spoken line stays the fixed one.
   */
  const aside =
    current === 'name' && trimmedName
      ? t('onboarding.name.bubbleFilled', { name: trimmedName })
      : null;

  return (
    <GuidedStage
      character={characterFor(narrationKey)}
      speaking={voice.speaking}
      line={line}
      aside={aside}
      onReplay={() => {
        gestured.current = true;
        speak(narrationKey, line);
      }}
      voice={voice}
      onBack={step > 0 ? () => advance(-1) : undefined}
      backLabel={t('onboarding.back')}
      soundOnLabel={t('onboarding.soundOn')}
      soundOffLabel={t('onboarding.soundOff')}
      replayLabel={t('onboarding.replayLine')}
      progress={{ current: step + 1, total: STEPS.length, label: t('onboarding.progressLabel', { current: step + 1, total: STEPS.length }) }}
      error={error ? t('onboarding.error') : null}
    >
      {current === 'welcome' && (
        <div className="flex flex-col gap-6 text-center">
          <div>
            <h1 className="lf-display-lg text-content">{t('onboarding.welcome.title')}</h1>
            <p className="lf-body-lg mt-2 text-content-muted">{t('onboarding.welcome.subtitle')}</p>
          </div>
          <Button className="w-full" onClick={() => advance(1)}>
            {t('onboarding.welcome.cta')}
          </Button>
        </div>
      )}

      {current === 'name' && (
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (trimmedName) advance(1);
          }}
        >
          <div>
            <h1 className="lf-display-lg text-content">{t('onboarding.name.title')}</h1>
            <p className="lf-body-lg mt-2 text-content-muted">{t('onboarding.name.subtitle')}</p>
          </div>
          <Field
            label={t('onboarding.name.label')}
            autoComplete="name"
            autoFocus
            required
            maxLength={80}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <Button type="submit" className="w-full" disabled={!trimmedName}>
            {t('onboarding.continue')}
          </Button>
        </form>
      )}

      {current === 'discovery' && (
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="lf-display-lg text-content">{t('onboarding.discovery.title')}</h1>
            <p className="lf-body-lg mt-2 text-content-muted">{t('onboarding.discovery.subtitle')}</p>
          </div>
          {/*
            THE ONE GROUP OF CONTROLS IN THE WHOLE FLOW gets the study's
            section lockup (/DESIGN.md §The study's component set): a tinted
            icon well plus a wide-tracked small-caps label, wired to the
            radiogroup with `aria-labelledby` so the list is NAMED rather than
            merely decorated. Delight, because this question is curiosity
            rather than something the product needs.
          */}
          <div>
            <SectionHeading as="h2" icon="travel_explore" tone="delight">
              {t('onboarding.discovery.section')}
            </SectionHeading>
            <OptionGroup
              value={discoveryChannel}
              options={discoveryOptions}
              ariaLabel={t('onboarding.discovery.title')}
              onChange={(value) => {
                setDiscoveryChannel(value);
                advance(1);
              }}
            />
          </div>
          {/* Ghost tier: skipping is a real answer here, and it must not look
              like a second call to action beside seven live options. */}
          <button
            type="button"
            onClick={() => advance(1)}
            className="lf-press lf-label inline-flex min-h-11 items-center justify-center self-center rounded-full px-4 text-content-muted transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t('onboarding.skip')}
          </button>
        </div>
      )}

      {current === 'account' && (
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="lf-display-lg text-content">{t('onboarding.account.title')}</h1>
            <p className="lf-body-lg mt-2 text-content-muted">{t('onboarding.account.subtitle')}</p>
          </div>
          {/*
            THE STUDY'S ACTION TIERS, and this is the row that most needed
            them: two full-width buttons stacked one on the other read as two
            equal offers, and the whole point of this step is that saving your
            progress is the recommended one. Ghost (no surface, muted ink) for
            "Later", primary for the account — and `flex-col-reverse` keeps the
            primary on top at 375px, where a column has no left and right.
          */}
          <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              disabled={submitting}
              onClick={() => void complete('later')}
              className="lf-press lf-label inline-flex min-h-11 items-center justify-center rounded-full px-4 text-content-muted transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50"
            >
              {submitting ? t('onboarding.submitting') : t('onboarding.account.later')}
            </button>
            <Button
              className="w-full sm:w-auto"
              disabled={submitting}
              onClick={() => void complete('created_now')}
            >
              {submitting ? t('onboarding.submitting') : t('onboarding.account.createNow')}
            </Button>
          </div>
        </div>
      )}
    </GuidedStage>
  );
}
