import { useCallback, useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Button, LoadingOverlay, OptionGroup, type OptionGroupOption } from '@/components/ui';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { GuidedStage } from '@/guided-voice/GuidedStage';
import { characterFor, useGuidedVoice } from '@/guided-voice/useGuidedVoice';

/*
 * /learn/:courseSlug/placement — finding where a learner actually belongs.
 *
 * WHAT THIS REPLACED, AND WHY. The old screen asked three self-report questions
 * and then administered up to six fixed questions from the front of the course.
 * Six was the ceiling on how far anyone could be placed, over a course of 216
 * topics, so an adult who answered everything correctly still started at topic
 * seven. In production it was worse: with no probes authored it never asked a
 * question at all and dropped every learner at lesson one — including two who
 * had just told it they were confident adults. That is the experience the
 * testers described, and it was not a tuning problem.
 *
 * THE SHAPE NOW. A learner is asked, adaptively, until the answers bracket
 * their frontier — around eight questions to locate any point in a 216-topic
 * course. Learners 12 and over are offered a conversation first: they say in
 * their own words what they know, and that decides where the FIRST question is
 * asked. Nothing else. Every topic credited is established by a graded answer.
 *
 * AND THEY GET THE LAST WORD. The result screen is not a verdict to accept. If
 * the placement feels too far ahead, they move it back, right there. The
 * complaint was never that the questions were bad — it was ending up somewhere
 * that was not theirs, with no way to say so.
 */

interface Probe {
  topicId: string;
  prompt: string;
  options: string[];
}

interface Answer {
  topicId: string;
  selectedIndex: number;
}

interface PlacementResult {
  frontier: number;
  startTopicId: string | null;
  startLessonId: string | null;
  creditedLessonCount: number;
  creditedTopicCount: number;
  totalTopicCount: number;
  method: string;
  cappedByPrerequisite: boolean;
}

type StepResponse =
  | { kind: 'ask'; probe: Probe; questionNumber: number; questionsRemaining: number; phase: 'search' | 'confirm' }
  | { kind: 'done'; result: PlacementResult };

interface IntakeInfo {
  ageAlreadyKnown: boolean;
  conversationalIntakeAvailable: boolean;
}

type Screen = 'welcome' | 'intake' | 'quiz' | 'result';

/**
 * "I don't know this yet", as an answer index.
 *
 * Deliberately one PAST the last option: `correctIndex` is always a valid index
 * into the options, so this can never accidentally be right, and the client
 * still learns nothing about which option was. Saying "I don't know" is real
 * evidence about where the frontier is and is worth exactly as much to the
 * search as a wrong guess — without making the learner guess.
 */
function dontKnowIndex(probe: Probe): number {
  return probe.options.length;
}

export function PlacementPage() {
  const { t } = useTranslation();
  const { courseSlug = '' } = useParams();
  const { getToken } = useAuth();
  const voice = useGuidedVoice();
  const { speak, stop } = voice;

  const [screen, setScreen] = useState<Screen>('welcome');
  const [info, setInfo] = useState<IntakeInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [learnerText, setLearnerText] = useState('');
  const [aiPriorFraction, setAiPriorFraction] = useState<number | undefined>(undefined);
  const [reflection, setReflection] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);

  const [answers, setAnswers] = useState<Answer[]>([]);
  const [current, setCurrent] = useState<StepResponse | null>(null);
  const [result, setResult] = useState<PlacementResult | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [committedLessonId, setCommittedLessonId] = useState<string | null>(null);
  const [committed, setCommitted] = useState(false);
  const [gestured, setGestured] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getToken();
      const { data, error: apiError } = await api<IntakeInfo>(`/placement/${courseSlug}/intake`, { token });
      if (cancelled) return;
      if (apiError) setLoadError(apiError.code);
      else setInfo(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [courseSlug, getToken]);

  /** Which fixed line the character is saying on this screen. */
  const narrationKey =
    screen === 'welcome'
      ? 'placement.welcome'
      : screen === 'intake'
        ? 'placement.intake'
        : screen === 'quiz'
          ? current?.kind === 'ask' && current.phase === 'confirm'
            ? 'placement.confirm'
            : 'placement.quiz'
          : adjusting
            ? 'placement.adjust'
            : (result?.creditedLessonCount ?? 0) > 0
              ? 'placement.resultAhead'
              : 'placement.resultStart';

  const narrationSuffix = narrationKey.slice('placement.'.length);
  const line = t(`placement.narration.${narrationSuffix}`);

  useEffect(() => {
    if (!gestured) return;
    speak(narrationKey, line);
    return () => stop();
  }, [narrationKey, line, speak, stop, gestured]);

  const runStep = useCallback(
    async (nextAnswers: Answer[], prior: number | undefined) => {
      setBusy(true);
      setError(false);
      const token = await getToken();
      const { data, error: apiError } = await api<StepResponse>(`/placement/${courseSlug}/step`, {
        body: { signals: prior === undefined ? {} : { aiPriorFraction: prior }, answers: nextAnswers },
        token,
      });
      setBusy(false);
      if (apiError) {
        setError(true);
        return;
      }
      if (data.kind === 'done') {
        setResult(data.result);
        setScreen('result');
      } else {
        setCurrent(data);
        setScreen('quiz');
      }
    },
    [courseSlug, getToken],
  );

  async function submitIntake() {
    setThinking(true);
    setError(false);
    const token = await getToken();
    const { data, error: apiError } = await api<{ available: boolean; priorFraction: number | null; reflection: string | null }>(
      `/placement/${courseSlug}/intake`,
      { body: { learnerText: learnerText.trim(), neutralReflection: t('placement.intake.neutral') }, token },
    );
    setThinking(false);
    // A failed or unavailable intake is not an error the learner should see: it
    // just means the quiz opens where it would have anyway.
    const prior = !apiError && data.available && data.priorFraction !== null ? data.priorFraction : undefined;
    if (!apiError && data.reflection) setReflection(data.reflection);
    setAiPriorFraction(prior);
    await runStep([], prior);
  }

  async function answer(selectedIndex: number) {
    if (current?.kind !== 'ask') return;
    const next = [...answers, { topicId: current.probe.topicId, selectedIndex }];
    setAnswers(next);
    await runStep(next, aiPriorFraction);
  }

  function goBackOneAnswer() {
    stop();
    const next = answers.slice(0, -1);
    setAnswers(next);
    void runStep(next, aiPriorFraction);
  }

  async function commit(options: { chosenFrontier?: number; startFromBeginning?: boolean } = {}) {
    setBusy(true);
    setError(false);
    stop();
    const token = await getToken();
    const { data, error: apiError } = await api<PlacementResult>(`/placement/${courseSlug}/commit`, {
      body: {
        signals: aiPriorFraction === undefined ? {} : { aiPriorFraction },
        answers,
        ...(options.chosenFrontier !== undefined ? { chosenFrontier: options.chosenFrontier } : {}),
        startFromBeginning: options.startFromBeginning ?? false,
      },
      token,
    });
    setBusy(false);
    if (apiError) {
      setError(true);
      return;
    }
    setCommittedLessonId(data.startLessonId);
    setCommitted(true);
  }

  if (loadError) return <ErrorBanner code={loadError} />;
  if (!info) return <LoadingOverlay label={t('placement.loading')} />;

  if (committed) {
    return committedLessonId ? (
      <Navigate to={`/learn/lesson/${committedLessonId}`} state={{ courseSlug }} replace />
    ) : (
      <Navigate to={`/learn/${courseSlug}`} replace />
    );
  }

  const quizProbe = current?.kind === 'ask' ? current.probe : null;
  const quizOptions: OptionGroupOption<string>[] = quizProbe
    ? [
        ...quizProbe.options.map((label, index) => ({ value: String(index), label })),
        { value: String(dontKnowIndex(quizProbe)), label: t('placement.quiz.dontKnow') },
      ]
    : [];

  const questionNumber = current?.kind === 'ask' ? current.questionNumber : 0;
  const questionsRemaining = current?.kind === 'ask' ? current.questionsRemaining : 0;

  return (
    <GuidedStage
      character={characterFor(narrationKey)}
      speaking={voice.speaking}
      line={line}
      aside={screen === 'quiz' || screen === 'result' ? reflection : null}
      onReplay={() => {
        setGestured(true);
        speak(narrationKey, line);
      }}
      voice={voice}
      onBack={screen === 'quiz' && answers.length > 0 ? goBackOneAnswer : undefined}
      backLabel={t('placement.back')}
      soundOnLabel={t('placement.soundOn')}
      soundOffLabel={t('placement.soundOff')}
      replayLabel={t('placement.replayLine')}
      progress={
        screen === 'quiz'
          ? {
              current: questionNumber,
              total: questionNumber + questionsRemaining,
              label: t('placement.progressLabelOf', { current: questionNumber, total: questionNumber + questionsRemaining }),
            }
          : undefined
      }
      error={error ? t('placement.error') : null}
    >
      {screen === 'welcome' && (
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="lf-display-lg text-content">{t('placement.welcome.title')}</h1>
            <p className="lf-body-lg mt-2 text-content-muted">{t('placement.welcome.subtitle')}</p>
          </div>
          <Button
            className="w-full"
            disabled={busy}
            onClick={() => {
              setGestured(true);
              if (info.conversationalIntakeAvailable) setScreen('intake');
              else void runStep([], undefined);
            }}
          >
            {t('placement.welcome.cta')}
          </Button>
          {/*
           * An explicit, always-present way out. A learner who knows they want
           * the beginning should never have to prove it question by question.
           */}
          <Button variant="secondary" className="w-full" disabled={busy} onClick={() => void commit({ startFromBeginning: true })}>
            {t('placement.welcome.startFromZero')}
          </Button>
        </div>
      )}

      {screen === 'intake' && (
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (learnerText.trim()) void submitIntake();
          }}
        >
          <div>
            <h1 className="lf-display-lg text-content">{t('placement.intake.title')}</h1>
            <p className="lf-body-lg mt-2 text-content-muted">{t('placement.intake.subtitle')}</p>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="lf-label text-content">{t('placement.intake.label')}</span>
            <textarea
              rows={4}
              maxLength={600}
              autoFocus
              value={learnerText}
              onChange={(e) => setLearnerText(e.target.value)}
              placeholder={t('placement.intake.placeholder')}
              className="w-full rounded-md border border-border bg-surface px-4 py-3 text-content placeholder:text-content-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </label>
          <Button type="submit" className="w-full" disabled={thinking || busy || !learnerText.trim()}>
            {thinking ? t('placement.intake.thinking') : t('placement.intake.cta')}
          </Button>
          <Button variant="secondary" className="w-full" disabled={thinking || busy} onClick={() => void runStep([], undefined)}>
            {t('placement.intake.skip')}
          </Button>
        </form>
      )}

      {screen === 'quiz' && quizProbe && (
        <div className="flex flex-col gap-5">
          <h1 className="lf-display-lg text-content">{quizProbe.prompt}</h1>
          <OptionGroup
            value={null}
            options={quizOptions}
            ariaLabel={quizProbe.prompt}
            onChange={(value) => void answer(Number(value))}
          />
        </div>
      )}

      {screen === 'result' && result && !adjusting && (
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="lf-display-lg text-content">
              {result.creditedLessonCount > 0 ? t('placement.result.titleAhead') : t('placement.result.titleStart')}
            </h1>
            <p className="lf-body-lg mt-2 text-content-muted">
              {result.creditedLessonCount > 0
                ? t('placement.result.creditedLessons', { count: result.creditedLessonCount })
                : t('placement.result.creditedNone')}
            </p>
          </div>

          <div className="rounded-md bg-surface-sunken px-4 py-3">
            <p className="lf-caption text-content-muted">{t('placement.result.positionLabel')}</p>
            <p className="lf-body-lg text-content">
              {t('placement.result.positionValue', { position: result.frontier + 1, total: result.totalTopicCount })}
            </p>
            {result.cappedByPrerequisite && (
              <p className="lf-caption mt-2 text-content-muted">{t('placement.result.cappedByPrerequisite')}</p>
            )}
          </div>

          <Button className="w-full" disabled={busy} onClick={() => void commit()}>
            {busy ? t('placement.submitting') : t('placement.result.cta')}
          </Button>
          {result.frontier > 0 && (
            <Button variant="secondary" className="w-full" disabled={busy} onClick={() => setAdjusting(true)}>
              {t('placement.result.tooHigh')}
            </Button>
          )}
        </div>
      )}

      {screen === 'result' && result && adjusting && (
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="lf-display-lg text-content">{t('placement.result.adjustTitle')}</h1>
            <p className="lf-body-lg mt-2 text-content-muted">{t('placement.result.adjustHint')}</p>
          </div>
          <Button
            className="w-full"
            disabled={busy}
            onClick={() => void commit({ chosenFrontier: Math.max(0, Math.floor(result.frontier * 0.6)) })}
          >
            {t('placement.result.adjustEarlier')}
          </Button>
          <Button variant="secondary" className="w-full" disabled={busy} onClick={() => void commit({ chosenFrontier: 0 })}>
            {t('placement.result.adjustBeginning')}
          </Button>
          <Button variant="secondary" className="w-full" disabled={busy} onClick={() => setAdjusting(false)}>
            {t('placement.result.adjustKeep')}
          </Button>
        </div>
      )}
    </GuidedStage>
  );
}
