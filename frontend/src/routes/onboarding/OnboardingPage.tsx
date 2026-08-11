import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { APP_HOME } from '@/routes/app/navConfig';
import { api } from '@/lib/api';
import { Button, Card, Field, Icon, OptionGroup, ProgressBar, type OptionGroupOption } from '@/components/ui';
import { CharacterActor } from '@/components/characters/control/CharacterActor';
import type { CharacterId } from '@/components/characters/control/types';

/*
 * Guest-first onboarding (Duolingo-style): name (required), an optional
 * discovery-channel survey, optional age, then the create-account-now-or-
 * later offer. One /onboarding/complete call submits everything at once —
 * fewer round-trips, and it also activates day-1 streak server-side.
 *
 * Guest-only in practice (a real account never reaches this route — see
 * RequireOnboarded), but this page defensively redirects home if somehow
 * reached after completion rather than trusting the router alone.
 */

const BIRTH_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DISCOVERY_CHANNELS = ['friend', 'social_media', 'search', 'app_store', 'school', 'ad', 'other'] as const;
type DiscoveryChannel = (typeof DISCOVERY_CHANNELS)[number];

const STEPS = ['name', 'discovery', 'age', 'accountOffer'] as const;

export function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getToken, refreshMe, onboardingComplete } = useAuth();

  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [discoveryChannel, setDiscoveryChannel] = useState<DiscoveryChannel | null>(null);
  const [birthDate, setBirthDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  // The `!submitting` guard matters: refreshMe() below flips onboardingComplete
  // to true via AuthContext BEFORE complete()'s own explicit navigate() call
  // runs (loadMe's setState reaches React's scheduler in fewer microtask hops
  // than complete()'s continuation does), so without it this defensive
  // redirect raced the "created_now" branch's navigate('/upgrade-account')
  // and won, silently skipping the account-creation form for every guest who
  // chose to save their progress. `submitting` stays true for the whole
  // success path specifically so this guard can tell "reached mid-flow, by
  // our own submit" apart from "reached this route after already finishing,
  // via back button/bookmark" — the case the guard exists for.
  if (onboardingComplete && !submitting) return <Navigate to={APP_HOME} replace />;

  const birthDateInvalid = birthDate.length > 0 && !BIRTH_DATE_RE.test(birthDate);
  const discoveryOptions: OptionGroupOption<DiscoveryChannel>[] = DISCOVERY_CHANNELS.map((value) => ({
    value,
    label: t(`onboarding.discovery.options.${value}`),
  }));

  // One character narrates each step, matching each mascot's established
  // personality (LESSON_ENGINE.md §9): Liruf hypes up the name (the very
  // first thing he can cheer), Rho maps the discovery survey, Dina handles
  // the personal/sensitive age question warmly, Zara closes with confidence.
  const trimmedName = displayName.trim();
  const stepCharacter: { character: CharacterId; emotion: 'neutral' | 'happy' | 'excited' | 'encouraging'; bubble: string } =
    STEPS[step] === 'name'
      ? {
          character: 'liruf',
          emotion: trimmedName ? 'excited' : 'encouraging',
          bubble: trimmedName ? t('onboarding.name.characterBubbleFilled', { name: trimmedName }) : t('onboarding.name.characterBubble'),
        }
      : STEPS[step] === 'discovery'
        ? { character: 'rho', emotion: 'neutral', bubble: t('onboarding.discovery.characterBubble') }
        : STEPS[step] === 'age'
          ? {
              character: 'dina',
              emotion: !birthDateInvalid && birthDate ? 'happy' : 'encouraging',
              bubble:
                !birthDateInvalid && birthDate
                  ? t('onboarding.age.characterBubbleFilled')
                  : t('onboarding.age.characterBubble', { name: trimmedName || t('onboarding.name.label') }),
            }
          : { character: 'zara', emotion: 'excited', bubble: t('onboarding.accountOffer.characterBubble') };

  function goNext() {
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function complete(accountOfferChoice: 'created_now' | 'later') {
    setSubmitting(true);
    setError(false);
    const token = await getToken();
    const { error: apiError } = await api<{ streakDays: number }>('/onboarding/complete', {
      body: {
        displayName: displayName.trim(),
        discoveryChannel: discoveryChannel ?? undefined,
        birthDate: birthDate || undefined,
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
    // submitting stays true here (see the top-of-component guard comment) —
    // reset only on the error path above; the success path navigates away.
    await refreshMe();
    navigate(accountOfferChoice === 'created_now' ? '/upgrade-account' : APP_HOME, { replace: true });
  }

  return (
    <div className="relative flex min-h-screen justify-center bg-base px-5 py-14 sm:py-20 md:px-8">
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          {step > 0 && (
            <button
              type="button"
              aria-label={t('onboarding.back')}
              onClick={goBack}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-content-muted transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Icon name="arrow_back" />
            </button>
          )}
          <ProgressBar
            value={((step + 1) / STEPS.length) * 100}
            label={t('onboarding.progressLabel', { current: step + 1, total: STEPS.length })}
            className="flex-1"
          />
        </div>

        <div className="mb-4 flex flex-col items-center gap-3 text-center">
          <CharacterActor character={stepCharacter.character} emotion={stepCharacter.emotion} size="md" />
          <p className="lf-body rounded-2xl bg-surface-sunken px-4 py-2.5 text-content">{stepCharacter.bubble}</p>
        </div>

        <Card className="p-6 sm:p-8">
          {error && (
            <p role="alert" className="lf-caption mb-4 text-error-strong">
              {t('onboarding.error')}
            </p>
          )}

          {STEPS[step] === 'name' && (
            <div className="flex flex-col gap-5">
              <div>
                <h1 className="lf-display-lg text-content">{t('onboarding.name.title')}</h1>
                <p className="lf-body-lg mt-2 text-content-muted">{t('onboarding.name.subtitle')}</p>
              </div>
              <Field
                label={t('onboarding.name.label')}
                autoComplete="name"
                required
                maxLength={80}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <Button className="w-full" disabled={!displayName.trim()} onClick={goNext}>
                {t('onboarding.continue')}
              </Button>
            </div>
          )}

          {STEPS[step] === 'discovery' && (
            <div className="flex flex-col gap-5">
              <div>
                <h1 className="lf-display-lg text-content">{t('onboarding.discovery.title')}</h1>
                <p className="lf-body-lg mt-2 text-content-muted">{t('onboarding.discovery.subtitle')}</p>
              </div>
              <OptionGroup
                value={discoveryChannel}
                options={discoveryOptions}
                ariaLabel={t('onboarding.discovery.title')}
                onChange={(value) => {
                  setDiscoveryChannel(value);
                  goNext();
                }}
              />
              <Button variant="secondary" className="w-full" onClick={goNext}>
                {t('onboarding.skip')}
              </Button>
            </div>
          )}

          {STEPS[step] === 'age' && (
            <div className="flex flex-col gap-5">
              <div>
                <h1 className="lf-display-lg text-content">{t('onboarding.age.title')}</h1>
                <p className="lf-body-lg mt-2 text-content-muted">{t('onboarding.age.subtitle')}</p>
              </div>
              <Field
                label={t('onboarding.age.label')}
                inputMode="numeric"
                placeholder="2016-05-01"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                hint={t('onboarding.age.hint')}
                error={birthDateInvalid ? t('onboarding.age.invalid') : undefined}
              />
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => { setBirthDate(''); goNext(); }}>
                  {t('onboarding.skip')}
                </Button>
                <Button className="flex-1" disabled={birthDateInvalid} onClick={goNext}>
                  {t('onboarding.continue')}
                </Button>
              </div>
            </div>
          )}

          {STEPS[step] === 'accountOffer' && (
            <div className="flex flex-col gap-5">
              <div>
                <h1 className="lf-display-lg text-content">{t('onboarding.accountOffer.title')}</h1>
                <p className="lf-body-lg mt-2 text-content-muted">{t('onboarding.accountOffer.subtitle')}</p>
              </div>
              <Button className="w-full" disabled={submitting} onClick={() => void complete('created_now')}>
                {submitting ? t('onboarding.submitting') : t('onboarding.accountOffer.createNow')}
              </Button>
              <Button variant="secondary" className="w-full" disabled={submitting} onClick={() => void complete('later')}>
                {submitting ? t('onboarding.submitting') : t('onboarding.accountOffer.later')}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
