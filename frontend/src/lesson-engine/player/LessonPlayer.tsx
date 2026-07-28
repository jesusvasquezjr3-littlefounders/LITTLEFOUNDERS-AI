// The fullscreen Lesson Player — LESSON_ENGINE.md §7, §10 and DESIGN.md
// §Screen Recipes → Lesson: focused ~720px column, sticky glass progress header,
// one segment at a time, earned celebration, results screen.

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button, Icon, ProgressBar, LottieIcon } from '@/components/ui'
import CharacterActor from '@/components/characters/control/CharacterActor'
import type { CharacterId } from '@/components/characters/control/types'
import type { Grader, LessonDocument, SegmentBase, Verdict } from '../core/types'
import {
  createSessionReducer,
  earnedXp,
  initialSession,
  lessonScore,
  progressPct,
} from '../core/session'
import { createDirector, type CharacterReaction } from '../core/director'
import { glowsAndGrows } from '../core/glowsGrows'
import { SceneAnchor } from '../core/primitives'
import { getRegistryEntry } from '../registry'
import MarkdownLite from '../core/MarkdownLite'
import { NarrationProvider, narrationUnitId, useNarration, type AudioManifest } from './narration'
import { StreakCelebration } from './StreakCelebration'
import { playSfx } from './sfx'
import { formatDuration, useCountUp, type ServerCompletion } from './completion'

export interface LessonPlayerProps {
  /** Client-safe document (answers stripped in production; the grader knows them). */
  document: LessonDocument
  grader: Grader
  /** Echo's narration manifest for this locale (Core serves it with the document). Absent/empty = silent lesson. */
  audio?: AudioManifest | null
  onExit: () => void
  /**
   * Fired once on reaching results. May resolve the server's completion
   * summary (POST /complete response) — the results screen then shows the
   * authoritative XP delta / day streak, and the streak celebration runs
   * when today's pass extended it.
   */
  onComplete?: (result: {
    score: number
    passed: boolean
    xp: number
    seconds_spent: number
  }) => void | Promise<ServerCompletion | null>
}

interface Reaction extends CharacterReaction {
  character: CharacterId
  key: number
}

export function LessonPlayer({ document: doc, grader, audio, onExit, onComplete }: LessonPlayerProps) {
  return (
    <NarrationProvider manifest={audio}>
      <LessonPlayerInner document={doc} grader={grader} onExit={onExit} onComplete={onComplete} />
    </NarrationProvider>
  )
}

function LessonPlayerInner({ document: doc, grader, onExit, onComplete }: Omit<LessonPlayerProps, 'audio'>) {
  const { t } = useTranslation()
  const reducer = useMemo(() => createSessionReducer(doc), [doc])
  const [state, dispatch] = useReducer(reducer, doc, initialSession)
  const [draft, setDraft] = useState<unknown>(undefined)
  const [reaction, setReaction] = useState<Reaction | null>(null)
  const [gradeError, setGradeError] = useState(false)
  const [server, setServer] = useState<ServerCompletion | null>(null)
  const [celebrationDone, setCelebrationDone] = useState(false)
  const director = useMemo(() => createDirector(doc.meta.cast), [doc])
  const narration = useNarration()
  const segStartRef = useRef<number>(Date.now())
  const lessonStartRef = useRef<number>(Date.now())
  const secondsSpentRef = useRef(0)
  const completedRef = useRef(false)

  const segment = doc.segments[state.index]
  const segState = segment ? state.seg[segment.id] : undefined
  const entry = segment ? getRegistryEntry(segment.type) : undefined
  const verdict = segState?.verdict ?? null

  // Reset the draft, error and per-attempt timer on a new segment AND on every
  // retry (retries bumps). Clearing the draft on retry is what stops the stale
  // co-submit / keypad-append bugs and disables Comprobar until a fresh answer.
  const retryCount = segState?.retries ?? 0
  useEffect(() => {
    setDraft(undefined)
    setGradeError(false)
    segStartRef.current = Date.now()
  }, [state.index, retryCount])

  // Auto-narrate each segment's prompt as it appears. Content-family components
  // (story_scene, key_ideas, concept_reveal, checkpoint, story_dialogue) own
  // their FULL narration — prompt plus body/idea/card/recap/line units — so the
  // player must not also fire the prompt for them (it would talk over the
  // sequence, and the body/card audio would otherwise never play at all, B2/B3).
  // Segment changes are click-driven, so play() has activation.
  useEffect(() => {
    if (state.phase !== 'playing' || !segment) return
    if (getRegistryEntry(segment.type)?.kind === 'content') return
    // Prompt then the choices roll-up (option labels read in order) so a
    // pre-reader HEARS the whole exercise, not just the question. `choices` is
    // a no-op when the manifest has no such unit (B4).
    narration.playSequence([narrationUnitId(segment.id, 'prompt'), narrationUnitId(segment.id, 'choices')])
    return () => narration.stop()
  }, [state.phase, segment, narration])

  useEffect(() => {
    if (state.phase === 'results' && !completedRef.current) {
      completedRef.current = true
      narration.stop()
      secondsSpentRef.current = Math.max(1, Math.round((Date.now() - lessonStartRef.current) / 1000))
      const maybe = onComplete?.({
        score: lessonScore(doc, state),
        passed: state.outcome === 'passed',
        xp: earnedXp(doc, state),
        seconds_spent: secondsSpentRef.current,
      })
      if (maybe && typeof (maybe as Promise<ServerCompletion | null>).then === 'function') {
        void (maybe as Promise<ServerCompletion | null>).then((data) => {
          if (data) setServer(data)
        })
      }
    }
  }, [state, doc, onComplete, narration])

  const react = useCallback(
    (event: Parameters<typeof director.react>[0], preferred?: CharacterId) => {
      const r = director.react(event, preferred)
      setReaction((prev) => ({ ...r, key: (prev?.key ?? 0) + 1 }))
    },
    [director],
  )

  const submit = useCallback(
    async (answer: unknown) => {
      if (!segment) return
      dispatch({ type: 'SUBMIT' })
      setGradeError(false)
      try {
        const v: Verdict = await grader.grade(segment.id, answer, {
          attempt_number: (segState?.attempts ?? 0) + 1,
          time_spent_seconds: Math.round((Date.now() - segStartRef.current) / 1000),
          // Server applies the hint penalty authoritatively (0012).
          hints_used: segState?.hintsShown ?? 0,
        })
        dispatch({ type: 'VERDICT', segmentId: segment.id, verdict: v })
        const preferred = segment.narrator?.character
        if (v.tier === 'perfect') react(state.streak >= 2 ? 'streak' : 'perfect', preferred)
        else if (v.tier === 'great') react('correct', preferred)
        else if (v.tier === 'almost') react('almost', preferred)
        else react('wrong', preferred)
        // UI sound mirrors the character reaction — win chimes vs. a soft,
        // kind retry tap (never a buzzer).
        if (v.tier === 'perfect') playSfx('perfect')
        else if (v.tier === 'great') playSfx('correct')
        else playSfx('tryagain')
      } catch {
        // Grader unavailable: never punish the kid for our outage (§7).
        dispatch({ type: 'GRADE_FAILED' })
        setGradeError(true)
      }
    },
    [segment, segState, grader, react, state.streak],
  )

  if (state.phase === 'intro') {
    return (
      <Shell>
        <IntroScreen
          doc={doc}
          onStart={() => {
            lessonStartRef.current = Date.now()
            dispatch({ type: 'BEGIN' })
            react('lesson_start')
          }}
          onExit={onExit}
        />
      </Shell>
    )
  }

  if (state.phase === 'results') {
    // v1 flow: the cinematic streak overlay runs FIRST (once per day, when
    // this pass extended the day streak), then reveals the results summary.
    const showStreakCelebration =
      !celebrationDone && server !== null && server.streak_extended && server.first_today && server.streak_days > 0
    if (showStreakCelebration) {
      return <StreakCelebration streakDays={server.streak_days} onContinue={() => setCelebrationDone(true)} />
    }
    return (
      <Shell>
        <ResultsScreen doc={doc} state={state} server={server} secondsSpent={secondsSpentRef.current} onExit={onExit} />
      </Shell>
    )
  }

  if (!segment || !entry) {
    return (
      <Shell>
        <div className="mx-auto flex max-w-[720px] flex-1 flex-col items-center justify-center gap-4 px-5 text-center">
          <Icon name="extension_off" className="text-[48px] text-content-faint" />
          <p className="lf-body text-content-muted">{t('lesson.unsupported')}</p>
          <Button variant="secondary" onClick={() => dispatch({ type: 'NEXT' })}>
            {t('lesson.continue')}
          </Button>
        </div>
      </Shell>
    )
  }

  const isContent = entry.kind === 'content'
  const isFlow = entry.kind === 'flow'
  const inFeedback = state.stepPhase === 'feedback'
  const checking = state.stepPhase === 'checking'
  const canCheck =
    entry.kind === 'input' && !inFeedback && !checking &&
    (entry.canSubmit ? entry.canSubmit(draft, segment) : draft !== undefined)
  const hintsAvailable = (segment.hints?.length ?? 0) - (segState?.hintsShown ?? 0)

  const handleCheck = () => {
    const answer = entry.buildAnswer ? entry.buildAnswer(draft, segment) : draft
    void submit(answer)
  }

  const handleNext = () => {
    setReaction(null)
    dispatch({ type: 'NEXT' })
  }

  return (
    <Shell>
      {/* Sticky glass header */}
      <header className="lf-glass sticky top-0 z-10 shadow-glass-sm">
        <div className="mx-auto flex max-w-[720px] items-center gap-3 px-4 py-3 md:px-0">
          <button
            type="button"
            onClick={onExit}
            aria-label={t('lesson.exit')}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-content-muted transition-colors hover:bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Icon name="close" />
          </button>
          <div className="min-w-0 flex-1">
            <ProgressBar value={progressPct(doc, state)} label={t('lesson.progress')} />
          </div>
          {state.hearts !== null ? (
            <span className="flex items-center gap-1 lf-label text-error-strong" aria-label={t('lesson.chips.hearts', { count: state.hearts })}>
              <Icon name="favorite" fill className="text-[20px]" />
              <span className="lf-number">{state.hearts}</span>
            </span>
          ) : null}
          {state.streak >= 2 ? (
            <span className="lf-pop flex items-center gap-1 rounded-full bg-warning-soft px-3 py-1 lf-label text-warning-strong">
              <Icon name="local_fire_department" fill className="text-[18px]" />
              <span className="lf-number">{state.streak}</span>
            </span>
          ) : null}
          <span className="flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1 lf-label text-primary">
            <Icon name="bolt" fill className="text-[18px]" />
            <span className="lf-number">{earnedXp(doc, state)}</span>
          </span>
        </div>
      </header>

      {/* Segment column */}
      <main className="mx-auto w-full max-w-[720px] flex-1 px-5 pb-40 pt-6 md:px-0">
        <div key={segment.id} className="lf-pop space-y-5">
          {/* Narrator strip */}
          {segment.narrator ? (
            // Avatar shrinks on mobile (56px) so the speech bubble keeps a
            // readable width at 375px instead of squeezing the prompt to
            // 2-3 words per line (§1.11). Full 96px from sm: up.
            <div className="flex items-end gap-2 sm:gap-3">
              <div className="h-14 w-14 shrink-0 sm:h-24 sm:w-24">
                <CharacterActor
                  character={segment.narrator.character}
                  emotion={segment.narrator.emotion ?? 'neutral'}
                  size="fill"
                />
              </div>
              <div className="flex min-w-0 flex-1 items-start gap-2 rounded-lg rounded-bl-sm border border-outline/70 bg-surface px-4 py-3 shadow-glass-sm">
                <MarkdownLite text={segment.prompt_md} className="lf-title min-w-0 flex-1 text-content" />
                <NarrationReplayButton unitId={narrationUnitId(segment.id, 'prompt')} />
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <MarkdownLite text={segment.prompt_md} className="lf-headline min-w-0 flex-1 text-content" />
              <NarrationReplayButton unitId={narrationUnitId(segment.id, 'prompt')} />
            </div>
          )}

          {/* Scene anchor — one concrete illustration setting up the situation,
              shown for any segment the pipeline illustrated at the segment level. */}
          {segment.image_url ? <SceneAnchor imageUrl={segment.image_url} /> : null}

          {/* Hints shown so far */}
          {segment.hints?.slice(0, segState?.hintsShown ?? 0).map((hint, i) => (
            <div key={i} className="lf-pop flex items-start gap-2 rounded-md bg-delight-soft px-4 py-3">
              <Icon name="lightbulb" className="mt-0.5 text-[20px] text-content" />
              <p className="lf-body text-content">{hint}</p>
            </div>
          ))}

          {/* Exercise body — keyed by segment + retry count so "Intentar de
              nuevo" forces a clean remount (timers, boards and keypads reset;
              no stale phase state survives into the new attempt). */}
          <entry.component
            key={`${segment.id}:${retryCount}`}
            segment={segment}
            value={draft}
            onChange={setDraft}
            disabled={inFeedback || checking || Boolean(segState?.done)}
            onFinish={isFlow ? (answer) => void submit(answer) : undefined}
            onContentDone={
              isContent
                ? (signal) => dispatch({ type: 'CONTENT_DONE', segmentId: segment.id, selfMark: signal })
                : undefined
            }
            verdict={verdict}
          />

          {gradeError ? (
            <div className="rounded-md bg-warning-soft px-4 py-3 lf-body text-content" role="alert">
              {t('lesson.gradeError')}
            </div>
          ) : null}
        </div>
      </main>

      {/* Feedback banner + footer actions */}
      <footer className="fixed inset-x-0 bottom-0 z-10">
        {inFeedback && verdict ? (
          <FeedbackBanner
            verdict={verdict}
            segment={segment}
            segIndex={state.index}
            reaction={reaction}
            done={Boolean(segState?.done)}
            onRetry={() => dispatch({ type: 'RETRY' })}
            onNext={handleNext}
          />
        ) : (
          <div className="lf-glass shadow-pop">
            <div className="mx-auto flex max-w-[720px] items-center justify-between gap-3 px-4 py-3 md:px-0">
              {!isContent && hintsAvailable > 0 ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    const hintIndex = segState?.hintsShown ?? 0
                    dispatch({ type: 'HINT', segmentId: segment.id })
                    react('hint', segment.narrator?.character)
                    playSfx('hint')
                    // Voice the hint being revealed — the key scaffold for
                    // weaker readers, silent in 55/62 lessons before (B4).
                    narration.play(narrationUnitId(segment.id, `hint.${hintIndex}`))
                  }}
                >
                  <Icon name="lightbulb" className="mr-1 text-[18px]" />
                  {t('lesson.hint')}
                </Button>
              ) : (
                <span />
              )}
              {isContent ? (
                // Only show the footer Continuar once the content segment is
                // done. While it's being consumed the content component owns
                // its own advance affordance (e.g. story_dialogue's tap/CTA);
                // a second, disabled "Continuar" here was a confusing duplicate.
                segState?.done ? (
                  <Button variant="primary" onClick={handleNext}>
                    {t('lesson.continue')}
                    <Icon name="arrow_forward" className="ml-1 text-[18px]" />
                  </Button>
                ) : (
                  <span />
                )
              ) : isFlow ? (
                <span className="lf-caption text-content-faint">{checking ? t('lesson.checking') : ''}</span>
              ) : (
                <Button variant="primary" disabled={!canCheck} onClick={handleCheck}>
                  {checking ? t('lesson.checking') : t('lesson.check')}
                </Button>
              )}
            </div>
          </div>
        )}
      </footer>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-base">
      {children}
    </div>
  )
}

/** Speaker button — visible only when Echo narrated this unit. Doubles as the fallback when autoplay was refused. */
function NarrationReplayButton({ unitId }: { unitId: string }) {
  const { t } = useTranslation()
  const narration = useNarration()
  if (!narration.has(unitId)) return null
  return (
    <button
      type="button"
      onClick={() => narration.play(unitId)}
      aria-label={t('lesson.audio.replay')}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    >
      <Icon name="volume_up" className="text-[20px]" />
    </button>
  )
}

function IntroScreen({
  doc,
  onStart,
  onExit,
}: {
  doc: LessonDocument
  onStart: () => void
  onExit: () => void
}) {
  const { t } = useTranslation()
  // "Retos" counts INTERACTIVE segments, not xp>0: content types carry xp:0,
  // and some graded segments were authored with xp:0 too, so the old xp>0 count
  // read "0 retos" on 37/62 lessons that plainly have challenges.
  const challengeCount = doc.segments.filter((s) => getRegistryEntry(s.type)?.kind !== 'content').length
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col px-5 md:px-0">
      <div className="flex justify-start py-4">
        <button
          type="button"
          onClick={onExit}
          aria-label={t('lesson.exit')}
          className="flex h-11 w-11 items-center justify-center rounded-full text-content-muted transition-colors hover:bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 pb-16 text-center">
        <div className="flex items-end justify-center">
          {doc.meta.cast.map((c, i) => (
            <CharacterActor
              key={c}
              character={c}
              emotion="happy"
              action={i === 0 ? 'wave' : 'idle'}
              size={i === 0 ? 'lg' : 'md'}
              className={cn(i > 0 && '-ml-6')}
            />
          ))}
        </div>
        <h1 className="lf-display-lg text-content">{doc.meta.title}</h1>
        <ul className="space-y-2">
          {doc.meta.objectives.map((objective, i) => (
            <li key={i} className="flex items-center justify-center gap-2 lf-body text-content-muted">
              <Icon name="check_circle" className="text-[20px] text-success-strong" />
              {objective}
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-4 lf-caption text-content-faint">
          <span className="flex items-center gap-1">
            <Icon name="timer" className="text-[16px]" />
            {t('lesson.intro.minutes', { count: doc.meta.estimated_minutes })}
          </span>
          <span className="flex items-center gap-1">
            <Icon name="stars" className="text-[16px]" />
            {t('lesson.intro.exercises', { count: challengeCount })}
          </span>
        </div>
        <Button variant="primary" onClick={onStart} className="px-10">
          {t('lesson.intro.start')}
          <Icon name="arrow_forward" className="ml-1 text-[18px]" />
        </Button>
      </div>
    </div>
  )
}

function FeedbackBanner({
  verdict,
  segment,
  segIndex,
  reaction,
  done,
  onRetry,
  onNext,
}: {
  verdict: Verdict
  segment: SegmentBase
  segIndex: number
  reaction: Reaction | null
  done: boolean
  onRetry: () => void
  onNext: () => void
}) {
  const { t } = useTranslation()
  const tierStyles = {
    perfect: 'bg-success-soft',
    great: 'bg-success-soft',
    almost: 'bg-warning-soft',
    tryAgain: 'bg-error-soft',
  }[verdict.tier]
  const tierIcon = {
    perfect: 'celebration',
    great: 'check_circle',
    almost: 'trending_up',
    tryAgain: 'psychology_alt',
  }[verdict.tier]
  const tierText = {
    perfect: 'text-success-strong',
    great: 'text-success-strong',
    almost: 'text-warning-strong',
    tryAgain: 'text-error-strong',
  }[verdict.tier]
  const variant = (segIndex % 3) + 1

  // Teaching content reveal (E3): show it when the segment RESOLVES for the kid
  // — on a pass, or once no retries remain — never success-worded copy under a
  // failure banner. On a resolved fail prefer the server's outcome-accurate
  // correction (spot_error's reveal.correction_md) over the authored
  // explanation, which may be phrased as a success.
  const narration = useNarration()
  const reveal = verdict.reveal as { correction_md?: unknown } | undefined
  const passed = verdict.correct
  const showTeaching = passed || done
  const correctionMd =
    !passed && done && typeof reveal?.correction_md === 'string' ? reveal.correction_md : undefined
  const teachingMd = correctionMd ?? (showTeaching ? segment.explanation_md : undefined)
  const explanationUnit = narrationUnitId(segment.id, 'explanation')
  // Auto-play the explanation narration whenever we show the authored
  // explanation — the paid TTS that played in 0/62 lessons before this. Skip
  // it for the server correction (no matching audio unit).
  const explanationAudible =
    showTeaching && !correctionMd && Boolean(segment.explanation_md) && narration.has(explanationUnit)
  useEffect(() => {
    if (!explanationAudible) return
    narration.play(explanationUnit)
    return () => narration.stop()
  }, [explanationAudible, explanationUnit, narration])

  return (
    <div className={cn('lf-pop shadow-pop', tierStyles)} role="status">
      <div className="mx-auto flex max-w-[720px] items-start gap-3 px-4 py-4 md:px-0">
        {reaction ? (
          <CharacterActor
            character={reaction.character}
            emotion={reaction.emotion}
            action={reaction.action}
            actionKey={reaction.key}
            size="sm"
            className="hidden shrink-0 sm:block"
          />
        ) : null}
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className={cn('flex items-center gap-2 lf-title', tierText)}>
            <Icon name={tierIcon} fill className="text-[22px]" />
            {t(`lesson.feedback.${verdict.tier}.v${variant}`)}
            {/* Keep the exam-style number only on a pass; on a fail it reads as
                harsh "0/100" chrome for an 8-year-old (E6) — the tier microcopy
                and teaching carry the message. */}
            {passed ? <span className="lf-number lf-caption text-content-muted">{verdict.score}/100</span> : null}
          </p>
          {verdict.feedback_md ? (
            <MarkdownLite text={verdict.feedback_md} className="lf-body text-content" />
          ) : null}
          {teachingMd ? (
            <div className="flex items-start gap-2">
              <MarkdownLite text={teachingMd} className="lf-body min-w-0 flex-1 text-content-muted" />
              {explanationAudible ? <NarrationReplayButton unitId={explanationUnit} /> : null}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          {!passed && verdict.allowRetry && !done ? (
            // Failed with tries left: make "Intentar de nuevo" the primary action
            // and demote advancing to a quiet skip link, so the kid doesn't
            // silently forfeit a retake by tapping a prominent Continuar (E5).
            <>
              <button
                type="button"
                onClick={onNext}
                className="rounded-full px-3 py-2 lf-caption text-content-muted underline underline-offset-2 transition-colors hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                {t('lesson.skip')}
              </button>
              <Button variant="primary" onClick={onRetry}>
                {t('lesson.retry')}
              </Button>
            </>
          ) : (
            <>
              {verdict.allowRetry && !done ? (
                <Button variant="secondary" onClick={onRetry}>
                  {t('lesson.retry')}
                </Button>
              ) : null}
              <Button variant="primary" onClick={onNext}>
                {t('lesson.continue')}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ResultsScreen({
  doc,
  state,
  server,
  secondsSpent,
  onExit,
}: {
  doc: LessonDocument
  state: ReturnType<typeof initialSession>
  server: ServerCompletion | null
  secondsSpent: number
  onExit: () => void
}) {
  const { t } = useTranslation()
  // Server truth wins once /complete responds; the client's own numbers are
  // the instant fallback so the screen never waits on the network (§7).
  const score = server?.score ?? lessonScore(doc, state)
  const xp = server?.xp_delta ?? earnedXp(doc, state)
  const passed = server?.passed ?? state.outcome === 'passed'
  const streakDays = server?.streak_days ?? 0
  const circumference = 2 * Math.PI * 52
  const xpShown = useCountUp(xp, 1000)
  const streakShown = useCountUp(streakDays, 800)

  // One celebratory fanfare as the summary reveals (after the streak overlay,
  // which plays its own 'streak' sound). Passing only — a failed run exits quiet.
  useEffect(() => {
    if (passed) playSfx('celebration')
    // mount-once by design: the fanfare fires as the summary first reveals
  }, [])

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col items-center justify-center gap-6 px-5 py-10 text-center md:px-0">
      <div className="flex items-end justify-center">
        {doc.meta.cast.map((c) => (
          <CharacterActor
            key={c}
            character={c}
            emotion={passed ? 'proud' : 'encouraging'}
            action={passed ? 'celebrate' : 'wave'}
            loop={passed}
            size="md"
            className="-ml-4 first:ml-0"
          />
        ))}
      </div>
      <h2 className="lf-display-lg text-content">
        {t(passed ? 'lesson.results.passedTitle' : 'lesson.results.failedTitle')}
      </h2>
      <div className="relative h-32 w-32" role="img" aria-label={t('lesson.results.score', { score })}>
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r="52" fill="none" strokeWidth="12" className="stroke-surface-sunken" />
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - score / 100)}
            className={cn('transition-[stroke-dashoffset] duration-700', passed ? 'stroke-success' : 'stroke-warning')}
            style={{ transitionTimingFunction: 'var(--lf-ease)' }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center lf-headline lf-number text-content">
          {score}
        </span>
      </div>
      {/* v1-parity stat row: XP · real time · day streak · best answer streak */}
      <div className="grid w-full max-w-4xl grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
        <ResultStat icon={<div className="flex w-14 h-14 shrink-0 items-center justify-center"><LottieIcon name="gold-coin" value={xpShown} activated={true} className="w-full h-full scale-150" /></div>} label={t('lesson.results.xp')} value={`+${xpShown}`} tone="text-primary" />
        <ResultStat icon={<div className="flex w-14 h-14 shrink-0 items-center justify-center"><LottieIcon name="time" value={secondsSpent} activated={true} className="w-full h-full scale-150" /></div>} label={t('lesson.results.time')} value={formatDuration(secondsSpent)} tone="text-content" />
        <ResultStat
          icon={<div className="flex w-14 h-14 shrink-0 items-center justify-center"><LottieIcon name="streak" value={streakShown} activated={true} className="w-full h-full scale-150" /></div>}
          label={t('lesson.results.dayStreak')}
          value={String(streakShown)}
          tone={streakDays > 0 ? 'text-warning-strong' : 'text-content-faint'}
        />
        <ResultStat
          icon="target"
          label={t('lesson.results.bestStreak')}
          // All-time longest day streak (0013): always >= today's streak, so it
          // never reads as the incoherent "Mejor racha 0" next to "Racha 1".
          value={String(server?.longest_streak ?? streakDays)}
          tone="text-success-strong"
        />
      </div>
      <GlowsGrowsBlock doc={doc} state={state} />
      <p className="lf-body text-content-muted">
        {t(passed ? 'lesson.results.passedBody' : 'lesson.results.failedBody')}
      </p>
      <Button variant={passed ? 'success' : 'primary'} onClick={onExit} className="px-10">
        {t('lesson.results.done')}
      </Button>
    </div>
  )
}

/**
 * Glows & Grows — two deterministic feedback lines from the session just
 * played (core/glowsGrows.ts): a real strength, and one growth area framed as
 * a quest. All-content lessons (no graded segments) render nothing.
 */
function GlowsGrowsBlock({ doc, state }: { doc: LessonDocument; state: ReturnType<typeof initialSession> }) {
  const { t } = useTranslation()
  const gg = useMemo(() => glowsAndGrows(doc, state), [doc, state])
  if (!gg) return null

  const glowText =
    gg.glow.kind === 'family' ? t(`lesson.results.glow.family.${gg.glow.family}`) : t('lesson.results.glow.effort')
  const growText =
    gg.grow === null
      ? null
      : gg.grow.kind === 'family'
        ? t(`lesson.results.grow.family.${gg.grow.family}`)
        : t('lesson.results.grow.mastered')

  return (
    <div className="w-full max-w-xl rounded-lg border border-outline/70 bg-surface px-4 py-1 shadow-glass-sm text-left">
      <div className="flex items-center gap-3 py-3">
        <Icon name="star" className="shrink-0 text-[26px] text-warning-strong" aria-hidden />
        <div>
          <p className="lf-caption text-content-faint leading-tight">{t('lesson.results.glowTitle')}</p>
          <p className="lf-body font-semibold text-content mt-0.5">{glowText}</p>
        </div>
      </div>
      {growText ? (
        <div className="flex items-center gap-3 border-t border-outline/50 py-3">
          <Icon name="flag" className="shrink-0 text-[26px] text-primary" aria-hidden />
          <div>
            <p className="lf-caption text-content-faint leading-tight">{t('lesson.results.growTitle')}</p>
            <p className="lf-body font-semibold text-content mt-0.5">{growText}</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ResultStat({ icon, label, value, tone }: { icon: React.ReactNode | string; label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-outline/70 bg-surface px-3 py-3 shadow-glass-sm flex items-center justify-start gap-3">
      <div className="flex shrink-0 items-center justify-center text-content-faint">
        {typeof icon === 'string' ? <Icon name={icon} className="text-[32px]" /> : icon}
      </div>
      <div className="flex flex-col text-left">
        <p className="lf-caption text-content-faint leading-tight">{label}</p>
        <p className={cn('lf-title font-bold leading-none mt-1', tone)}>{value}</p>
      </div>
    </div>
  )
}

export default LessonPlayer
