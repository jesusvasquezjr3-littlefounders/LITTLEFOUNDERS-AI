import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Button, Card, Field, Icon, LoadingOverlay, OptionGroup, ProgressBar, type OptionGroupOption } from '@/components/ui';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { CharacterActor } from '@/components/characters/control/CharacterActor';
import type { CharacterId } from '@/components/characters/control/types';

/*
 * /learn/:courseSlug/placement — mandatory, per-course (COURSE_ENGINE.md
 * §3.2). Never start a returning learner from zero: claimed level ->
 * education level -> age (skipped if already known) -> a short quiz,
 * auto-advancing on every optional/single-tap step to keep this as close to
 * "fewer clicks" as a mandatory gate can be. All grading and the actual
 * starting lesson are decided server-side (learn.ts's PLACEMENT_REQUIRED
 * gate is the real enforcement; this page is the UX for clearing it).
 */

type ClaimedLevel = 'new' | 'some' | 'confident';
type EducationLevel = 'preschool' | 'elementary' | 'middle' | 'high' | 'adult';
const EDUCATION_LEVELS: EducationLevel[] = ['preschool', 'elementary', 'middle', 'high', 'adult'];

interface Probe {
  topicId: string;
  prompt: string;
  options: string[];
}

interface ProbeResponse {
  probes: Probe[];
  ageAlreadyKnown: boolean;
}

interface CompleteResponse {
  startLessonId: string | null;
  creditedLessonCount: number;
}

type LoadState = { status: 'loading' } | { status: 'error'; code: string } | { status: 'ready'; probes: Probe[]; ageAlreadyKnown: boolean };

const BIRTH_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function PlacementPage() {
  const { t } = useTranslation();
  const { courseSlug = '' } = useParams();
  const { getToken } = useAuth();

  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [step, setStep] = useState(0);
  const [claimedLevel, setClaimedLevel] = useState<ClaimedLevel | null>(null);
  const [educationLevel, setEducationLevel] = useState<EducationLevel | null>(null);
  const [birthDate, setBirthDate] = useState('');
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const [result, setResult] = useState<CompleteResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    void (async () => {
      const token = await getToken();
      const { data, error: apiError } = await api<ProbeResponse>(`/placement/${courseSlug}/probe`, { token });
      if (cancelled) return;
      setState(apiError ? { status: 'error', code: apiError.code } : { status: 'ready', probes: data.probes, ageAlreadyKnown: data.ageAlreadyKnown });
    })();
    return () => {
      cancelled = true;
    };
  }, [courseSlug, getToken]);

  if (state.status === 'loading') return <LoadingOverlay label={t('placement.loading')} />;
  if (state.status === 'error') return <ErrorBanner code={state.code} />;

  const { probes, ageAlreadyKnown } = state;
  const skipQuiz = claimedLevel === 'new' || probes.length === 0;
  // Step sequence: 0 level, 1 education, 2 age (skipped if known), 3..N quiz (skipped if skipQuiz), last = submit.
  const steps: Array<'level' | 'education' | 'age' | 'quiz' | 'submit'> = [
    'level',
    'education',
    ...(ageAlreadyKnown ? [] : (['age'] as const)),
    ...(skipQuiz ? [] : (Array.from({ length: probes.length }, () => 'quiz' as const))),
    'submit',
  ];
  const currentStepKind = steps[Math.min(step, steps.length - 1)];

  // One character narrates each step kind, matching each mascot's
  // established personality (LESSON_ENGINE.md §9), same pairing spirit as
  // OnboardingPage: Zara opens with confidence ("no matter where you start,
  // we'll take you further"), Rho maps schooling level and the quiz itself,
  // Dina handles the personal age question warmly, Liruf closes with hype.
  const birthDateFilledValid = Boolean(birthDate) && BIRTH_DATE_RE.test(birthDate);
  const stepCharacter: { character: CharacterId; emotion: 'neutral' | 'happy' | 'excited' | 'thinking' | 'encouraging'; bubble: string } =
    currentStepKind === 'level'
      ? { character: 'zara', emotion: 'encouraging', bubble: t('placement.level.characterBubble') }
      : currentStepKind === 'education'
        ? { character: 'rho', emotion: 'neutral', bubble: t('placement.education.characterBubble') }
        : currentStepKind === 'age'
          ? {
              character: 'dina',
              emotion: birthDateFilledValid ? 'happy' : 'encouraging',
              bubble: birthDateFilledValid ? t('placement.age.characterBubbleFilled') : t('placement.age.characterBubble'),
            }
          : currentStepKind === 'quiz'
            ? { character: 'rho', emotion: 'thinking', bubble: t('placement.quiz.characterBubble') }
            : { character: 'liruf', emotion: 'excited', bubble: t('placement.submit.characterBubble') };

  function goNext() {
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }
  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submit() {
    setSubmitting(true);
    setError(false);
    const token = await getToken();
    const quizAnswers = Object.entries(answers).map(([topicId, selectedIndex]) => ({ topicId, selectedIndex }));
    const { data, error: apiError } = await api<CompleteResponse>(`/placement/${courseSlug}/complete`, {
      body: {
        claimedLevel,
        educationLevel,
        birthDate: birthDate || undefined,
        quizAnswers,
      },
      token,
    });
    setSubmitting(false);
    if (apiError) {
      setError(true);
      return;
    }
    setResult(data);
  }

  if (result) {
    return result.startLessonId ? (
      <Navigate to={`/learn/lesson/${result.startLessonId}`} state={{ courseSlug }} replace />
    ) : (
      <Navigate to={`/learn/${courseSlug}`} replace />
    );
  }

  const claimedLevelOptions: OptionGroupOption<ClaimedLevel>[] = (['new', 'some', 'confident'] as const).map((value) => ({
    value,
    label: t(`placement.level.options.${value}`),
  }));
  const educationLevelOptions: OptionGroupOption<EducationLevel>[] = EDUCATION_LEVELS.map((value) => ({
    value,
    label: t(`placement.education.options.${value}`),
  }));
  const birthDateInvalid = birthDate.length > 0 && !BIRTH_DATE_RE.test(birthDate);

  return (
    <div className="relative flex min-h-screen justify-center bg-base px-5 py-14 sm:py-20 md:px-8">
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          {step > 0 && (
            <button
              type="button"
              aria-label={t('placement.back')}
              onClick={goBack}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-content-muted transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Icon name="arrow_back" />
            </button>
          )}
          <ProgressBar
            value={((step + 1) / steps.length) * 100}
            label={t('placement.progressLabel', { current: step + 1, total: steps.length })}
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
              {t('placement.error')}
            </p>
          )}

          {currentStepKind === 'level' && (
            <div className="flex flex-col gap-5">
              <h1 className="lf-display-lg text-content">{t('placement.level.title')}</h1>
              <OptionGroup
                value={claimedLevel}
                options={claimedLevelOptions}
                ariaLabel={t('placement.level.title')}
                onChange={(value) => {
                  setClaimedLevel(value);
                  goNext();
                }}
              />
            </div>
          )}

          {currentStepKind === 'education' && (
            <div className="flex flex-col gap-5">
              <h1 className="lf-display-lg text-content">{t('placement.education.title')}</h1>
              <OptionGroup
                value={educationLevel}
                options={educationLevelOptions}
                ariaLabel={t('placement.education.title')}
                onChange={(value) => {
                  setEducationLevel(value);
                  goNext();
                }}
              />
            </div>
          )}

          {currentStepKind === 'age' && (
            <div className="flex flex-col gap-5">
              <h1 className="lf-display-lg text-content">{t('placement.age.title')}</h1>
              <Field
                label={t('placement.age.label')}
                inputMode="numeric"
                placeholder="2016-05-01"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                hint={t('placement.age.hint')}
                error={birthDateInvalid ? t('placement.age.invalid') : undefined}
              />
              <div className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary-soft p-4">
                <Icon name="family_restroom" className="mt-0.5 shrink-0 text-primary" />
                <p className="lf-caption text-content">
                  {t('placement.age.nudge')}{' '}
                  <Link to="/verify-parent" className="lf-label text-primary hover:underline">
                    {t('placement.age.nudgeLink')}
                  </Link>
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => { setBirthDate(''); goNext(); }}>
                  {t('placement.skip')}
                </Button>
                <Button className="flex-1" disabled={birthDateInvalid} onClick={goNext}>
                  {t('placement.continue')}
                </Button>
              </div>
            </div>
          )}

          {currentStepKind === 'quiz' && (
            (() => {
              const quizStepStart = steps.indexOf('quiz');
              const probe = probes[step - quizStepStart];
              if (!probe) return null;
              return (
                <div className="flex flex-col gap-5">
                  <h1 className="lf-display-lg text-content">{probe.prompt}</h1>
                  <OptionGroup
                    value={answers[probe.topicId] !== undefined ? String(answers[probe.topicId]) : null}
                    options={probe.options.map((label, index) => ({ value: String(index), label }))}
                    ariaLabel={probe.prompt}
                    onChange={(indexStr) => {
                      setAnswers((prev) => ({ ...prev, [probe.topicId]: Number(indexStr) }));
                      goNext();
                    }}
                  />
                </div>
              );
            })()
          )}

          {currentStepKind === 'submit' && (
            <div className="flex flex-col gap-5">
              <h1 className="lf-display-lg text-content">{t('placement.submit.title')}</h1>
              <Button className="w-full" disabled={submitting} onClick={() => void submit()}>
                {submitting ? t('placement.submitting') : t('placement.submit.cta')}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
