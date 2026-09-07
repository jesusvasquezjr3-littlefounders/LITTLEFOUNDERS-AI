// The fullscreen Lesson Player — LESSON_ENGINE.md §7, §10 and DESIGN.md
// §Screen Recipes → Lesson: focused ~720px column, sticky glass progress header,
// one segment at a time, earned celebration, results screen.

import { useCallback, useEffect, useId, useMemo, useReducer, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { trackInsight } from '@/lib/insights'
import { cn } from '@/lib/utils'
import { Button, CountUp, Icon, LottieIcon, SectionHeading } from '@/components/ui'
import CharacterActor3D from '@/components/characters/control/CharacterActor3D'
import { CharacterLayerProvider } from '@/tutor-scene/CharacterLayer'
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
import { comboBeat } from '../core/combo'
import { glowsAndGrows } from '../core/glowsGrows'
import { SceneAnchor } from '../core/primitives'
import { getRegistryEntry } from '../registry'
import MarkdownLite from '../core/MarkdownLite'
import { NarrationProvider, narrationUnitId, useNarration, type AudioManifest } from './narration'
import { StreakCelebration } from './StreakCelebration'
import { playSfx, playLessonBgm, stopLessonBgm } from './sfx'
import { formatDuration, useCountUp, type ServerCompletion } from './completion'

export interface LessonPlayerProps {
  /** Client-safe document (answers stripped in production; the grader knows them). */
  document: LessonDocument
  /**
   * Vault id of the lesson. Only the route knows it (the document carries a
   * slug, not an id), and insights_lesson_dropoff groups by lesson_id — so
   * without threading it here, `completions` for every lesson is permanently 0.
   */
  lessonId?: string
  grader: Grader
  /** Echo's narration manifest for this locale (Core serves it with the document). Absent/empty = silent lesson. */
  audio?: AudioManifest | null
  /** Staff review mode renders the lesson without grading or learner telemetry. */
  preview?: boolean
  previewStartLabel?: string
  previewNextLabel?: string
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

export function LessonPlayer({ document: doc, lessonId, grader, audio, preview = false, previewStartLabel, previewNextLabel, onExit, onComplete }: LessonPlayerProps) {
  return (
    <NarrationProvider manifest={audio}>
      <LessonPlayerInner
        document={doc}
        lessonId={lessonId}
        grader={grader}
        preview={preview}
        previewStartLabel={previewStartLabel}
        previewNextLabel={previewNextLabel}
        onExit={onExit}
        onComplete={onComplete}
      />
    </NarrationProvider>
  )
}

function LessonPlayerInner({ document: doc, lessonId, grader, preview = false, previewStartLabel, previewNextLabel, onExit, onComplete }: Omit<LessonPlayerProps, 'audio'>) {
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

  // v1 lesson soundtrack: the background loop starts with the lesson and fades
  // out (1500 ms, like v1's stopBGM) when the run ends or the player unmounts.
  // The results effect below also stops it, mirroring v1's completion path.
  useEffect(() => {
    if (preview) return
    playLessonBgm()
    return () => stopLessonBgm()
  }, [preview])

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
  // Insights: one row per exercise actually REACHED (/INSIGHTS.md). With
  // segment_submit/retry this is the per-step funnel INSIDE a lesson — the
  // finest-grained learning signal the platform has.
  useEffect(() => {
    if (state.phase !== 'playing' || !segment) return
    if (!preview) trackInsight('segment_view', { lessonId, segmentId: segment.id.slice(0, 64), routeClass: 'learn' })
  }, [preview, state.phase, segment])

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
      stopLessonBgm()
      secondsSpentRef.current = Math.max(1, Math.round((Date.now() - lessonStartRef.current) / 1000))
      // lesson_complete is emitted SERVER-SIDE only (backend/src/routes/learn.ts,
      // 0072) as of the NSM hardening pass — the results screen is reached on
      // BOTH outcomes (hearts exhausted or a score below threshold also finish
      // the run) after the same POST /complete round trip the server event
      // rides on, so a client-side copy here would double-count every passing
      // completion (client_event_id dedup only collapses RETRIES of the same
      // beacon, not two independently-generated events for one completion).
      // results_view is unconditional: reaching the screen IS the event, and
      // stays client-side since it has no server-side equivalent to duplicate.
      trackInsight('results_view', {
        routeClass: 'learn',
        lessonId,
        value: secondsSpentRef.current,
      })
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
      if (preview) {
        setReaction(null)
        if (state.index >= doc.segments.length - 1) onExit()
        else dispatch({ type: 'NEXT' })
        return
      }
      dispatch({ type: 'SUBMIT' })
      setGradeError(false)
      try {
        trackInsight('segment_submit', {
          lessonId,
          segmentId: segment.id.slice(0, 64),
          routeClass: 'learn',
          value: (segState?.attempts ?? 0) + 1,
        })
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
    [doc.segments.length, onExit, preview, segment, segState, grader, react, state.index, state.streak],
  )

  if (state.phase === 'intro') {
    return (
      <Shell>
        <IntroScreen
          doc={doc}
          onStart={() => {
            lessonStartRef.current = Date.now()
            dispatch({ type: 'BEGIN' })
            if (!preview) react('lesson_start')
          }}
          onExit={onExit}
          startLabel={previewStartLabel}
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
    if (preview && state.index >= doc.segments.length - 1) onExit()
    else dispatch({ type: 'NEXT' })
  }

  return (
    <Shell>
      {/* Sticky glass header */}
      <header className="lf-glass sticky top-0 z-30 shadow-glass-sm">
        {/*
          * Close, then the bar, then the score. The three counters used to be
          * three different objects — a bare icon+number for hearts, a pill for
          * the streak, a pill for XP — which read as three unrelated pieces of
          * information rather than as one score. They are now one chip shape
          * (§Tactile), and the difference between them is tone, which is what
          * distinguishes them anyway.
          *
          * `max-w-board` and not 720: at 1440 a lesson header pinned to 720px
          * leaves the counters floating in the middle of the screen while the
          * close button is nowhere near the corner a learner reaches for.
          */}
        <div className="mx-auto flex w-full max-w-board items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={onExit}
            aria-label={t('lesson.exit')}
            className="lf-slab lf-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-content-muted transition-colors hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Icon name="close" />
          </button>
          {/*
            * The study's gauge, not a hairline. 12px tall with an inner gloss
            * along the top half — a progress bar in a game is read across a
            * room, and `ProgressBar` is sized for a dashboard row.
            */}
          <div className="mx-auto min-w-0 max-w-md flex-1 px-2">
            <div
              className="lf-track"
              role="progressbar"
              aria-valuenow={progressPct(doc, state)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t('lesson.progress')}
            >
              <div className="lf-track-fill" style={{ width: `${progressPct(doc, state)}%` }} />
            </div>
          </div>
          {state.hearts !== null ? (
            /*
             * One line, deliberately. `answerSurfaces.test.tsx` exempts a red
             * HEART from P3's "no red wrong" by matching /hearts|favorite/ on
             * the same source line as the colour — so splitting the className
             * onto its own line silently drops the exemption and the guard
             * reports a life counter as a mistake painted red. The guard is
             * right about the rule; the formatting is what has to give.
             */
            <span className="lf-chip lf-chip-error lf-label" aria-label={t('lesson.chips.hearts', { count: state.hearts })}>
              <Icon name="favorite" fill className="text-[18px]" />
              <span className="lf-number">{state.hearts}</span>
            </span>
          ) : null}
          {state.streak >= 2 ? (
            /*
             * `key` on the streak replays the pop on EVERY increment. Without
             * it the chip animates once, when it first appears at two, and a
             * run of six looks exactly like a run of two.
             *
             * The flame is an Icon, not `streak.lottie`: that file is the DAY
             * streak and `public/lottie/README.md` forbids reusing it for
             * another statistic. An in-lesson combo is a different number.
             */
            <span
              key={state.streak}
              className="lf-pop lf-chip lf-chip-warning lf-label relative"
            >
              {comboBeat(state.streak, true).burst ? <span className="lf-burst" aria-hidden="true" /> : null}
              <Icon name="local_fire_department" fill className="text-[18px]" />
              <span className="lf-number">{state.streak}</span>
            </span>
          ) : null}
          <span className="lf-chip lf-chip-accent lf-label">
            <Icon name="bolt" fill className="text-[18px]" />
            <CountUp value={earnedXp(doc, state)} className="lf-number" />
          </span>
        </div>
      </header>

      {/*
        Segment column.

        `md:my-auto` ON THE CHILD, and that is the whole desktop fix. `main` is
        `flex-1` inside a `flex flex-col` shell, so it always fills the height
        left over — but its content was pinned to the top of it, and a
        three-option question is about 380 px tall. Measured on
        `/dev/lesson-lab` at 1280x800: `order_steps` ended at y=570 and
        `timeline_order` at y=480, leaving 230 and 320 px of empty base colour
        above the footer. /AGENTS.md §1.11 calls that out by name — "no dead
        vertical rhythm", and a desktop screen that does not use the space it
        has is a bug rather than a preference.

        `my-auto`, NOT `justify-center` on the parent. They centre identically
        while the content fits, and they differ in the one case that matters: a
        long segment (a table, a five-option question, a scenario with hints
        already revealed) overflows a `justify-center` flex container in BOTH
        directions, and the top — the prompt, the thing being asked — becomes
        unreachable because a scroll container cannot scroll above its own
        origin. `auto` margins collapse to zero the moment there is no free
        space, so a tall segment behaves exactly as it did before this line
        existed.

        Mobile is deliberately untouched: at 375 the same content already fills
        the viewport, and `pb-40` is reserving room for the fixed footer there.
      */}
      {/*
        TWO COLUMNS ON DESKTOP, AND ONLY WHEN THERE IS A MENTOR TO PUT IN ONE.

        The mentor and the work are two different acts — being told the
        situation, and doing something about it — and stacking them meant a
        1440px screen showed a 720px column with the character scrolled off the
        top by the time the learner was working. Side by side, the mentor stays
        present while the answer is being built, which is the entire reason a
        mentor is on this screen.

        A segment with NO narrator keeps the single column at `max-w-lesson`:
        a two-column grid with an empty left half is worse than a centred
        column, and a plain prompt does not need to be pushed to one side to
        make room for nothing.

        Mobile is one column either way, and untouched. `pb-40` is still
        reserving room for the fixed footer there.
      */}
      <main
        className={`mx-auto flex w-full flex-1 flex-col px-5 pb-40 pt-6 ${
          segment.narrator ? 'max-w-board md:px-6' : 'max-w-lesson md:px-0'
        }`}
      >
        <div
          key={segment.id}
          className={`lf-pop md:my-auto ${
            segment.narrator
              /*
               * The work column is CAPPED, not `1fr`. Given the whole board
               * width it stretched to ~1000px and put two answer buttons a
               * third of a metre apart — the §Tactile layout rule says a
               * lesson stays narrow enough to hold one thought, and `1fr`
               * hands it every pixel that is going spare. `justify-center`
               * then keeps the pair centred instead of leaving the slack on
               * one side.
               */
              ? 'grid gap-5 md:grid-cols-[minmax(0,20rem)_minmax(0,42rem)] md:items-start md:justify-center md:gap-8'
              : 'space-y-5'
          }`}
        >
          {/* Narrator strip */}
          {segment.narrator ? (
            /*
             * A GRID, not a flex guess: one column sized by the presence scale
             * and one that takes the rest, so the speech card's width is a
             * consequence of a stated proportion instead of whatever was left.
             *
             * The avatar used to shrink to 56 px on mobile to keep the bubble
             * readable. It is now 112 px and the bubble is still readable,
             * because the character is framed as a BUST: the old box spent its
             * pixels on legs. See the presence scale.
             */
            /*
             * Mobile: character beside the bubble, as before — vertical space
             * is the scarce thing on a phone. Desktop: the bubble ABOVE the
             * character, both in the left column, so the mentor reads as
             * speaking down into the work rather than across the page. The
             * tail flips with the arrangement for the same reason.
             */
            <div className="grid grid-cols-[auto_1fr] items-end gap-2 sm:gap-3 md:grid-cols-1 md:items-stretch md:gap-4">
              {/*
               * The tail only exists on DESKTOP, where the bubble sits above
               * the portrait and has something to point at. On mobile the
               * character is beside the bubble and the arrangement already
               * says who is speaking, so a tail there would point at the
               * page.
               */}
              <div className="lf-panel lf-bubble-tail-md order-2 flex min-w-0 flex-1 flex-col gap-2 p-4 sm:p-5 md:order-1">
                {/*
                 * A HEADER LINE INSIDE THE BUBBLE, and both halves are read
                 * off real state rather than written into the copy: what kind
                 * of beat this is, and where the learner is in the lesson.
                 * The counter is the half that earns its place — a lesson is a
                 * run of segments behind a progress bar that says a
                 * percentage, and a percentage does not answer "how many more
                 * of these". Hidden on a content segment, which is being read
                 * rather than answered and is not a step in that sense.
                 */}
                {!isContent && doc.segments.length > 1 ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="lf-label rounded-full bg-accent-soft px-2.5 py-1 text-accent-strong">
                      {t('lesson.challenge')}
                    </span>
                    <span className="lf-caption lf-number shrink-0 text-content-faint">
                      {t('lesson.stepOf', { n: state.index + 1, total: doc.segments.length })}
                    </span>
                  </div>
                ) : null}
                <div className="flex min-w-0 items-start gap-2">
                  <MarkdownLite text={segment.prompt_md} markTerms className="lf-title min-w-0 flex-1 text-content" />
                  <NarrationReplayButton unitId={narrationUnitId(segment.id, 'prompt')} lessonId={lessonId} preview={preview} />
                </div>
              </div>
              {/*
               * A PORTRAIT FRAME, on desktop only, and it is not decoration.
               * `presence="talk"` is a BUST crop: the render ends at the box's
               * bottom edge by design. Beside the bubble (mobile, and the old
               * single-column layout) that edge lines up with the bubble's own
               * baseline and reads as the character standing behind it. Moved
               * BELOW the bubble it became a hard horizontal cut across a
               * floating character — the same pixels reading as a broken
               * render. A frame makes the same cut read as a portrait.
               */}
              {/*
               * The frame HUGS the bust rather than forcing a square. The
               * study's avatar card is a square because it holds a photo that
               * fills it edge to edge; ours holds a fixed 144px 3D bust, and a
               * 304px square around it is 160px of empty frame — which reads
               * as a missing image, not as a portrait.
               */}
              <div className="lf-portrait order-1 shrink-0 md:order-2 md:mx-auto md:grid md:place-items-center">
                <CharacterActor3D
                  character={segment.narrator.character}
                  emotion={segment.narrator.emotion ?? 'neutral'}
                  presence="talk"
                  className="shrink-0"
                />
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <MarkdownLite text={segment.prompt_md} className="lf-headline min-w-0 flex-1 text-content" />
              <NarrationReplayButton unitId={narrationUnitId(segment.id, 'prompt')} lessonId={lessonId} preview={preview} />
            </div>
          )}

          {/*
            THE WORK SURFACE.

            One wrapper, and it is load-bearing rather than decorative: in the
            two-column arrangement above, every sibling of the narrator would
            otherwise become its own grid cell — the illustration in one, the
            hints in the next, the exercise in a third — and the layout would
            silently rearrange itself per segment depending on how many of them
            happened to be present. Grouping them makes the right column ONE
            cell whose contents stack, which is also what it is conceptually:
            the place the learner works.
          */}
          <div className="flex min-w-0 flex-col gap-4">
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
            {/*
              THE WORK SURFACE, as an actual surface.

              The exercise used to be drawn straight onto the page background,
              so a question, its options and the empty base colour were all the
              same plane and nothing said where the work was. Framing it makes
              the answer area a place — which is most of what separated this
              screen from the design study it was built against.

              CONTENT segments are deliberately NOT framed: a dialogue, a story
              beat or a reveal is something being read, not somewhere to work,
              and a frame around it turns a narrative moment into a form. The
              families draw their own full-bleed surfaces there.
            */}
            <div className={isContent ? undefined : 'lf-panel flex flex-col gap-4 p-4 sm:p-6'}>
              {/*
                THE PANEL'S OWN HEADER — what this surface IS and how far the
                learner has got inside it. The study gives every work surface
                one, and it is most of why its right column reads as a
                laboratory rather than as loose controls on a page. Both halves
                are real state: the exercise's own kind, and the hint budget
                that already governs the footer button.
              */}
              {!isContent ? (
                <div className="lf-panel-head">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="lf-panel-head-icon">
                      <Icon name="widgets" className="!text-[19px]" aria-hidden />
                    </span>
                    <span className="lf-label truncate font-bold text-content">{t('lesson.workSurface')}</span>
                  </div>
                  {hintsAvailable > 0 ? (
                    <span className="lf-chip lf-chip-accent lf-caption">
                      <Icon name="lightbulb" fill className="!text-[15px]" aria-hidden />
                      {t('lesson.hintsLeft', { count: hintsAvailable })}
                    </span>
                  ) : null}
                </div>
              ) : null}
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
            </div>

            {gradeError ? (
              <div className="rounded-md bg-warning-soft px-4 py-3 lf-body text-content" role="alert">
                {t('lesson.gradeError')}
              </div>
            ) : null}
          </div>
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
            streak={state.streak}
            done={Boolean(segState?.done)}
            lessonId={lessonId}
            onRetry={() => {
              trackInsight('segment_retry', { lessonId, segmentId: segment.id.slice(0, 64), routeClass: 'learn' })
              dispatch({ type: 'RETRY' })
            }}
            onNext={handleNext}
          />
        ) : (
          <div className="lf-glass shadow-pop">
            <div className="mx-auto flex w-full max-w-board items-center justify-between gap-3 px-4 py-3">
              {preview ? (
                <Button variant="primary" onClick={handleNext} className="ml-auto">
                  {previewNextLabel ?? t('lesson.continue')}
                  <Icon name="arrow_forward" className="ml-1 text-[18px]" />
                </Button>
              ) : <>
              {!isContent && hintsAvailable > 0 ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    const hintIndex = segState?.hintsShown ?? 0
                    trackInsight('hint_open', {
                      lessonId,
                      segmentId: segment.id.slice(0, 64),
                      routeClass: 'learn',
                      value: hintIndex + 1,
                    })
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
              </>}
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
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-base">
      {/*
       * AMBIENT (/DESIGN.md §Tactile → gamified surfaces). Two huge blurred
       * gradients behind everything. It is most of why the study's flat screens
       * do not read as flat — the ground is never one colour twice — and it
       * costs two composited layers that never repaint.
       */}
      <div className="lf-ambient" aria-hidden="true" />
      {/*
       * ONE canvas for every character in the lesson, drawn into the screen
       * rectangle of each placeholder (see CharacterLayer).
       *
       * THE STACK IS THE WHOLE DESIGN HERE, because one canvas cannot be both
       * above and below the same element:
       *
       *   z-30  the sticky header — a character scrolling up the column must
       *         disappear BEHIND the progress bar, not over it.
       *   z-20  the character layer.
       *   z-10  the feedback footer — its reacting character is drawn INTO the
       *         banner, so the banner's background has to sit below the canvas.
       *         At z-10 above the layer the banner simply painted over it, and
       *         the most emotional beat in a lesson had no character at all.
       *
       * The footer's own controls are therefore below the canvas too. They do
       * not overlap the character's rectangle, and the layer is
       * `pointer-events: none`, so a tap still reaches the button underneath —
       * but a future control placed UNDER a character would be drawn over, and
       * that is the trade this stack makes.
       */}
      <CharacterLayerProvider className="z-20">{children}</CharacterLayerProvider>
    </div>,
    document.body,
  )
}

/** Speaker button — visible only when Echo narrated this unit. Doubles as the fallback when autoplay was refused. */
function NarrationReplayButton({ unitId, lessonId, preview = false }: { unitId: string; lessonId?: string; preview?: boolean }) {
  const { t } = useTranslation()
  const narration = useNarration()
  if (!narration.has(unitId)) return null
  return (
    <button
      type="button"
      onClick={() => {
        // A deliberate replay is an audio-engagement signal (/INSIGHTS.md).
        // No-op for unconsented kids; segment_id is a content id, never text.
        if (!preview) trackInsight('audio_replay', { lessonId, segmentId: unitId.slice(0, 64), routeClass: 'learn' })
        narration.play(unitId)
      }}
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
  startLabel,
}: {
  doc: LessonDocument
  onStart: () => void
  onExit: () => void
  startLabel?: string
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
          className="lf-press flex h-11 w-11 items-center justify-center rounded-full text-content-muted transition-colors hover:bg-content/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 pb-16 text-center">
        <div className="flex items-end justify-center gap-1 sm:gap-2">
          {doc.meta.cast.map((c, i) => (
            <CharacterActor3D
              key={c}
              character={c}
              emotion="happy"
              action={i === 0 ? 'wave' : 'idle'}
              presence="cast"
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
          {startLabel ?? t('lesson.intro.start')}
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
  streak,
  done,
  lessonId,
  onRetry,
  onNext,
}: {
  verdict: Verdict
  segment: SegmentBase
  segIndex: number
  reaction: Reaction | null
  streak: number
  done: boolean
  lessonId?: string
  onRetry: () => void
  onNext: () => void
}) {
  const { t } = useTranslation()
  const beat = comboBeat(streak, verdict.correct)
  const tierStyles = {
    perfect: 'bg-success-soft',
    great: 'bg-success-soft',
    almost: 'bg-warning-soft',
    tryAgain: 'bg-warning-soft',
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
    tryAgain: 'text-warning-strong',
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

  // The teaching moment itself (/INSIGHTS.md). value=1 when the learner also
  // HEARD it, so "does narrated feedback change the retry outcome" becomes a
  // question the data can answer.
  useEffect(() => {
    if (!teachingMd) return
    trackInsight('explanation_view', {
      lessonId,
      segmentId: segment.id.slice(0, 64),
      routeClass: 'learn',
      value: explanationAudible ? 1 : 0,
    })
  }, [teachingMd, explanationAudible, segment.id])

  return (
    <div className={cn('lf-pop shadow-pop', tierStyles)} role="status">
      {/*
       * WRAPS ON MOBILE. The reacting character now shares this row, and at
       * 375 px a character, a message and two buttons competing for one line
       * left the message about 150 px wide: "Well done!" broke over two lines
       * and the score collided with the button. The actions drop to their own
       * line instead, which is also the thumb-reachable place for them.
       */}
      <div className="mx-auto flex max-w-[720px] flex-wrap items-start gap-3 px-4 py-4 md:flex-nowrap md:px-0">
        {reaction ? (
          /*
           * The reacting character is on MOBILE too now. It used to be
           * `hidden sm:block`, so the single most emotional moment in a lesson
           * — the answer landing — had no character at all on the viewport
           * where most learners are.
           */
          <CharacterActor3D
            character={reaction.character}
            emotion={reaction.emotion}
            action={reaction.action}
            actionKey={reaction.key}
            /*
             * `inline` and not `talk`: the banner is a message with a reacting
             * character beside it, not a character speaking. At 375 px the
             * larger step ate the width the message needs.
             */
            presence="inline"
            className="shrink-0"
          />
        ) : null}
        <div className="min-w-[11rem] flex-1 space-y-1.5">
          {/*
           * THE COMBO, SAID OUT LOUD, at the moment it happens.
           *
           * A run of right answers was already tracked and already changed a
           * number in the header. Nothing told the learner it was a RUN. This
           * is the one line that does, and it appears only while the run is
           * alive — a combo callout on a wrong answer would be the engine
           * congratulating someone for a streak it just ended.
           */}
          {beat.show ? (
            <p
              key={streak}
              className="lf-pop relative inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1 lf-label text-warning-strong"
            >
              {beat.burst ? <span className="lf-burst" aria-hidden="true" /> : null}
              <Icon name="local_fire_department" fill className="text-[18px]" />
              {t('lesson.combo', { count: streak })}
            </p>
          ) : null}
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
              {explanationAudible ? <NarrationReplayButton unitId={explanationUnit} lessonId={lessonId} /> : null}
            </div>
          ) : null}
        </div>
        <div className="flex w-full shrink-0 flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
          {!passed && verdict.allowRetry && !done ? (
            // Failed with tries left: make "Intentar de nuevo" the primary action
            // and demote advancing to a quiet skip link, so the kid doesn't
            // silently forfeit a retake by tapping a prominent Continuar (E5).
            <>
              <button
                type="button"
                onClick={onNext}
                /*
                 * QUIET IS A LOOK, NOT A SIZE. This is deliberately demoted to
                 * a skip link so a child does not forfeit a retake by tapping
                 * something prominent (E5) — but it measured 32px, under
                 * DESIGN's 44px floor, on a control whose whole job is being
                 * pressed by someone who has just got an answer wrong.
                 * `min-h-12` and not `min-h-11`: inside the lesson engine, 48
                 * is the TARGET and 44 is only the floor (§Answer surfaces),
                 * and answerSurfaces.test.tsx enforces the difference. Picking
                 * the floor for a control a frustrated child reaches for is
                 * exactly the case the distinction was written for. It changes
                 * nothing about how loud it looks: still small underlined
                 * muted text.
                 */
                className="lf-press inline-flex min-h-12 items-center rounded-full px-3 py-2 lf-caption text-content-muted underline underline-offset-2 transition-colors hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
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
  const runId = useId()

  // One celebratory fanfare as the summary reveals (after the streak overlay,
  // which plays its own 'streak' sound). Passing only — a failed run exits quiet.
  useEffect(() => {
    if (passed) playSfx('celebration')
    // mount-once by design: the fanfare fires as the summary first reveals
  }, [])

  /*
   * "Today vs your best" — a fact the payload has ALWAYS carried and the
   * screen never showed. `best_score` is documented in `completion.ts` as
   * existing for exactly this comparison, and a summary that reports a score
   * with nothing to measure it against is a number, not a result.
   */
  const best = server?.best_score ?? null
  const beatBest = best !== null && score > best

  /*
   * `justify-center` is not decoration: this column is `flex-1` inside a
   * full-height shell, and without it a short summary — a lesson with no
   * graded segments renders no Glows & Grows — sits jammed against the top
   * with a third of the viewport empty under the one button. Photographed
   * exactly that way before it went back.
   */
  return (
    <div className="mx-auto flex w-full max-w-[46rem] flex-1 flex-col justify-center gap-6 px-5 py-10 md:px-0">
      {/* THE CAST, IN 3D. Never the flat actors — see DESIGN.md §Characters. */}
      <div className="flex items-end justify-center gap-1 sm:gap-2">
        {doc.meta.cast.map((c) => (
          <CharacterActor3D
            key={c}
            character={c}
            emotion={passed ? 'proud' : 'encouraging'}
            action={passed ? 'celebrate' : 'wave'}
            loop={passed}
            presence="cast"
          />
        ))}
      </div>

      {/*
        THE VERDICT AND ITS SCORE, ONE OBJECT.
        They were a centred heading with a bare SVG donut floating under it —
        two things about the same fact, neither framed. The study makes a
        result a CARD: the ring on one side, what it means on the other, so the
        number is read as a sentence rather than as a gauge on its own.
      */}
      <section className="lf-glass flex flex-col items-center gap-5 rounded-md p-6 text-center sm:flex-row sm:gap-7 sm:text-left">
        <div
          className="relative h-32 w-32 shrink-0"
          role="img"
          aria-label={t('lesson.results.score', { score })}
        >
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
          <span className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="lf-headline lf-number leading-none text-content">{score}</span>
            <span className="lf-caption text-content-faint">{t('lesson.results.today')}</span>
          </span>
        </div>
        <div className="flex min-w-0 flex-col items-center gap-2 sm:items-start">
          <h2 className="lf-display-lg text-content">
            {t(passed ? 'lesson.results.passedTitle' : 'lesson.results.failedTitle')}
          </h2>
          <p className="lf-body text-content-muted">
            {t(passed ? 'lesson.results.passedBody' : 'lesson.results.failedBody')}
          </p>
          {best !== null && (
            <span
              className={cn(
                'lf-caption inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3',
                beatBest
                  ? 'border-success/40 bg-success/15 text-content'
                  : 'border-content/15 bg-content/5 text-content-muted',
              )}
            >
              <Icon
                name={beatBest ? 'trending_up' : 'military_tech'}
                className={cn('!text-[15px]', beatBest ? 'text-success' : 'text-content-faint')}
              />
              {beatBest
                ? t('lesson.results.newBest')
                : `${t('lesson.results.yourBest')} ${best}`}
            </span>
          )}
        </div>
      </section>

      {/* THE RUN, under a lockup: four facts about what just happened. */}
      <section aria-labelledby={runId}>
        <SectionHeading id={runId} icon="insights" tone="accent">
          {t('lesson.results.runTitle')}
        </SectionHeading>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ResultStat
            icon={<div className="flex h-14 w-14 shrink-0 items-center justify-center"><LottieIcon name="gold-coin" value={xpShown} activated={true} className="h-full w-full scale-150" /></div>}
            label={t('lesson.results.xp')}
            value={`+${xpShown}`}
            tone="text-primary"
          />
          <ResultStat
            icon={<div className="flex h-14 w-14 shrink-0 items-center justify-center"><LottieIcon name="time" value={secondsSpent} activated={true} className="h-full w-full scale-150" /></div>}
            label={t('lesson.results.time')}
            value={formatDuration(secondsSpent)}
            tone="text-content"
          />
          <ResultStat
            icon={<div className="flex h-14 w-14 shrink-0 items-center justify-center"><LottieIcon name="streak" value={streakShown} activated={true} className="h-full w-full scale-150" /></div>}
            label={t('lesson.results.dayStreak')}
            value={String(streakShown)}
            tone={streakDays > 0 ? 'text-warning-strong' : 'text-content-faint'}
          />
          <ResultStat
            icon="target"
            label={t('lesson.results.bestStreak')}
            // All-time longest day streak (0013): always >= today's streak, so it
            // never reads as the incoherent "Best streak 0" next to "Streak 1".
            value={String(server?.longest_streak ?? streakDays)}
            tone="text-success-strong"
          />
        </div>
      </section>

      <GlowsGrowsBlock doc={doc} state={state} />

      {/*
        ONE ACTION, AND IT OWNS THE ROW. The study's footer is a hierarchy;
        here there is exactly one thing to do, so it gets the full width on a
        phone and stops competing with nothing on a desktop.
      */}
      <Button variant={passed ? 'success' : 'primary'} onClick={onExit} className="w-full sm:w-auto sm:self-center sm:px-10">
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
    <div className="lf-slab w-full max-w-xl rounded-lg px-4 py-1 text-left">
      <div className="flex items-center gap-3 py-3">
        <Icon name="star" className="shrink-0 text-[26px] text-warning-strong" aria-hidden />
        <div>
          <p className="lf-caption text-content-faint leading-tight">{t('lesson.results.glowTitle')}</p>
          <p className="lf-body font-semibold text-content mt-0.5">{glowText}</p>
        </div>
      </div>
      {growText ? (
        <div className="flex items-center gap-3 border-t border-content/10 py-3">
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
    <div className="lf-slab rounded-lg px-3 py-3 flex items-center justify-start gap-3">
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
