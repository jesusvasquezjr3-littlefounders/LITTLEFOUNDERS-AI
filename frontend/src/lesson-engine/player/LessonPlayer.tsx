// The fullscreen Lesson Player — LESSON_ENGINE.md §7, §10 and DESIGN.md
// §Screen Recipes → Lesson: focused ~720px column, sticky glass progress header,
// one segment at a time, earned celebration, results screen.

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button, Icon, ProgressBar } from '@/components/ui'
import CharacterActor from '@/components/characters/control/CharacterActor'
import type { CharacterId } from '@/components/characters/control/types'
import type { Grader, LessonDocument, SegmentBase, Verdict } from '../core/types'
import {
  createSessionReducer,
  earnedXp,
  initialSession,
  isGraded,
  lessonScore,
  progressPct,
} from '../core/session'
import { createDirector, type CharacterReaction } from '../core/director'
import { getRegistryEntry } from '../registry'
import MarkdownLite from '../core/MarkdownLite'

export interface LessonPlayerProps {
  /** Client-safe document (answers stripped in production; the grader knows them). */
  document: LessonDocument
  grader: Grader
  onExit: () => void
  onComplete?: (result: { score: number; passed: boolean; xp: number }) => void
}

interface Reaction extends CharacterReaction {
  character: CharacterId
  key: number
}

export function LessonPlayer({ document: doc, grader, onExit, onComplete }: LessonPlayerProps) {
  const { t } = useTranslation()
  const reducer = useMemo(() => createSessionReducer(doc), [doc])
  const [state, dispatch] = useReducer(reducer, doc, initialSession)
  const [draft, setDraft] = useState<unknown>(undefined)
  const [reaction, setReaction] = useState<Reaction | null>(null)
  const [gradeError, setGradeError] = useState(false)
  const director = useMemo(() => createDirector(doc.meta.cast), [doc])
  const segStartRef = useRef<number>(Date.now())
  const completedRef = useRef(false)

  const segment = doc.segments[state.index]
  const segState = segment ? state.seg[segment.id] : undefined
  const entry = segment ? getRegistryEntry(segment.type) : undefined
  const verdict = segState?.verdict ?? null

  useEffect(() => {
    setDraft(undefined)
    setGradeError(false)
    segStartRef.current = Date.now()
  }, [state.index])

  useEffect(() => {
    if (state.phase === 'results' && !completedRef.current) {
      completedRef.current = true
      onComplete?.({
        score: lessonScore(doc, state),
        passed: state.outcome === 'passed',
        xp: earnedXp(doc, state),
      })
    }
  }, [state, doc, onComplete])

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
        })
        dispatch({ type: 'VERDICT', segmentId: segment.id, verdict: v })
        const preferred = segment.narrator?.character
        if (v.tier === 'perfect') react(state.streak >= 2 ? 'streak' : 'perfect', preferred)
        else if (v.tier === 'great') react('correct', preferred)
        else if (v.tier === 'almost') react('almost', preferred)
        else react('wrong', preferred)
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
        <IntroScreen doc={doc} onStart={() => { dispatch({ type: 'BEGIN' }); react('lesson_start') }} onExit={onExit} />
      </Shell>
    )
  }

  if (state.phase === 'results') {
    return (
      <Shell>
        <ResultsScreen doc={doc} state={state} onExit={onExit} />
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
            <div className="flex items-end gap-3">
              <CharacterActor
                character={segment.narrator.character}
                emotion={segment.narrator.emotion ?? 'neutral'}
                size="sm"
                className="shrink-0"
              />
              <div className="rounded-lg rounded-bl-sm border border-outline/70 bg-surface px-4 py-3 shadow-glass-sm">
                <MarkdownLite text={segment.prompt_md} className="lf-title text-content" />
              </div>
            </div>
          ) : (
            <MarkdownLite text={segment.prompt_md} className="lf-headline text-content" />
          )}

          {/* Hints shown so far */}
          {segment.hints?.slice(0, segState?.hintsShown ?? 0).map((hint, i) => (
            <div key={i} className="lf-pop flex items-start gap-2 rounded-md bg-delight-soft px-4 py-3">
              <Icon name="lightbulb" className="mt-0.5 text-[20px] text-content" />
              <p className="lf-body text-content">{hint}</p>
            </div>
          ))}

          {/* Exercise body */}
          <entry.component
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
                    dispatch({ type: 'HINT', segmentId: segment.id })
                    react('hint', segment.narrator?.character)
                  }}
                >
                  <Icon name="lightbulb" className="mr-1 text-[18px]" />
                  {t('lesson.hint')}
                </Button>
              ) : (
                <span />
              )}
              {isContent ? (
                <Button variant="primary" disabled={!segState?.done} onClick={handleNext}>
                  {t('lesson.continue')}
                  <Icon name="arrow_forward" className="ml-1 text-[18px]" />
                </Button>
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
  const gradedCount = doc.segments.filter(isGraded).length
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
            {t('lesson.intro.exercises', { count: gradedCount })}
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
            <span className="lf-number lf-caption text-content-muted">{verdict.score}/100</span>
          </p>
          {verdict.feedback_md ? (
            <MarkdownLite text={verdict.feedback_md} className="lf-body text-content" />
          ) : null}
          {done && segment.explanation_md ? (
            <MarkdownLite text={segment.explanation_md} className="lf-body text-content-muted" />
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {verdict.allowRetry && !done ? (
            <Button variant="secondary" onClick={onRetry}>
              {t('lesson.retry')}
            </Button>
          ) : null}
          <Button variant="primary" onClick={onNext}>
            {t('lesson.continue')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ResultsScreen({
  doc,
  state,
  onExit,
}: {
  doc: LessonDocument
  state: ReturnType<typeof initialSession>
  onExit: () => void
}) {
  const { t } = useTranslation()
  const score = lessonScore(doc, state)
  const xp = earnedXp(doc, state)
  const passed = state.outcome === 'passed'
  const circumference = 2 * Math.PI * 52

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
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-outline/70 bg-surface px-6 py-3 shadow-glass-sm">
          <p className="lf-caption text-content-muted">{t('lesson.results.xp')}</p>
          <p className="lf-headline lf-number text-primary">+{xp}</p>
        </div>
        <div className="rounded-lg border border-outline/70 bg-surface px-6 py-3 shadow-glass-sm">
          <p className="lf-caption text-content-muted">{t('lesson.results.bestStreak')}</p>
          <p className="lf-headline lf-number text-warning-strong">{state.bestStreak}</p>
        </div>
      </div>
      <p className="lf-body text-content-muted">
        {t(passed ? 'lesson.results.passedBody' : 'lesson.results.failedBody')}
      </p>
      <Button variant={passed ? 'success' : 'primary'} onClick={onExit} className="px-10">
        {t('lesson.results.done')}
      </Button>
    </div>
  )
}

export default LessonPlayer
