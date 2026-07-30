// The fullscreen Game Player — GAME_ENGINE.md §6 (rewards), §7 (slices & the
// unsupported card), §10 (motion, pause, both breakpoints).
//
// The shell that plays ANY mechanic. It owns the flow and nothing else:
//
//   concept recap  ->  tutorial  ->  play  ->  results
//                                     |
//                          pause / interlude overlays
//
// THE RECAP IS NOT DECORATION. `meta.concept.recap_md` is on screen before a single
// tick runs, because it is the lesson link: it is what makes this reinforcement of
// something the child already learned rather than an arcade toy with a curriculum
// sticker on it (§8 — games consolidate, they do not teach).
//
// THE CLIENT NEVER REPORTS A SCORE. On completion this component hands UP exactly three
// things — the seed, the kernel's input log and the elapsed seconds — and Core DERIVES
// the reward by replaying that log (§6). There is deliberately no `score` field in the
// completion payload for a forged client to inflate.
//
// COMPLETION IS NOT NAVIGATION. `onComplete` reports the run; `onExit` navigates. They
// are separate callbacks on purpose: the Lesson Player learned this the hard way — a
// caller that navigates on completion rips the results screen away before the child has
// seen what they earned.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import CharacterActor from '@/components/characters/control/CharacterActor'
import { Button, Icon } from '@/components/ui'
import { isGameAudioMuted, setGameAudioMuted } from '@/game-engine/core/audio'
import type { GameLoopScheduler } from '@/game-engine/core/kernel'
import { TICK_MS } from '@/game-engine/core/types'
import type { BridgeSnapshot } from '@/game-engine/phaser/bridge'
import type {
  GameDocument,
  GameInputEvent,
  GameInterlude,
  MechanicSlice,
  SimResult,
  SimSnapshot,
} from '@/game-engine/core/types'
import { PhaserGameBox } from '@/game-engine/player/PhaserGameBox'
import { MECHANIC_META } from '@/game-engine/registry'
import MarkdownLite from '@/lesson-engine/core/MarkdownLite'
import { cn } from '@/lib/utils'

import { GameHud, HUD_CONTROL_CLASS } from './hud'
import {
  GameResultsScreen,
  InterludeOverlay,
  PauseOverlay,
  QuitConfirmOverlay,
  UnsupportedGameCard,
} from './overlays'

// ---- The completion contract -------------------------------------------------

/** Exactly what `POST /api/v1/games/:gameId/complete` needs from the client, minus the
 *  fields only the route knows (`run_id`, `local_date`). NO score: the server replays
 *  `input_log` under `seed` and derives one. */
export interface GameRunSubmission {
  seed: number
  input_log: GameInputEvent[]
  duration_seconds: number
}

/** The authoritative answer. Every field here OVERRIDES the local, provisional one. */
export interface ServerGameResult {
  score: number
  passed: boolean
  xp_earned: number
  best_score?: number | null
  new_best?: boolean
}

export interface GamePlayerProps {
  /** Client-safe document (the `validation` sidecar is stripped server-side). */
  document: GameDocument
  /** The loaded slice. `null` = this build cannot play this mechanic → the friendly
   *  unsupported card, no XP, no throw (§7). */
  slice: MechanicSlice | null
  /** The run's seed. The server replays under the SAME number, so it is the route's to
   *  mint (from the run id) and never the player's to invent. */
  seed: number
  /** Unique run identifier. Used as part of the Phaser scene key. */
  runId?: string
  /** Hard tick ceiling for the session; defaults from `meta.estimated_minutes`. The
   *  server enforces its own bound from the `validation` sidecar during replay. */
  maxTicks?: number
  /** Reports the run. May resolve the server's authoritative summary, which then
   *  replaces the provisional numbers on the results screen. MUST NOT navigate. */
  onComplete?: (run: GameRunSubmission) => void | Promise<ServerGameResult | null>
  /** Navigates away. The ONLY callback allowed to leave the player. */
  onExit: () => void
  /** Start a fresh run. Absent = no "play again" button, because a new run needs a new
   *  run id and seed and only the caller can issue those. */
  onReplay?: () => void
  /** Testing / dev-lab seam (see core/kernel.ts). MUST be referentially stable. */
  scheduler?: GameLoopScheduler
}

// ---- Tick budget -------------------------------------------------------------

/** 60_000 / TICK_MS. */
export const TICKS_PER_MINUTE = 60_000 / TICK_MS

/** A mechanic ends its own session (`snapshot.finished`); this ceiling only exists so a
 *  simulator that never finishes cannot run forever. Generous on purpose — cutting a
 *  child off early is worse than a long session that the simulator was going to end. */
const MAX_TICKS_HEADROOM = 3

export function defaultMaxTicks(doc: GameDocument): number {
  const minutes = Number.isFinite(doc.meta.estimated_minutes) ? doc.meta.estimated_minutes : 1
  return Math.max(TICKS_PER_MINUTE, Math.round(minutes * TICKS_PER_MINUTE * MAX_TICKS_HEADROOM))
}

/** Ticks are the ONLY clock the simulation, the HUD and the server agree on, so the
 *  reported duration is derived from them and never from the wall clock (core/kernel.ts).
 *  Floored at 1 second: `minutes_learned` credits `max(1, round(seconds / 60))`. */
export function durationSecondsFromTicks(ticks: number): number {
  if (!Number.isFinite(ticks) || ticks <= 0) return 1
  return Math.max(1, Math.round((ticks * TICK_MS) / 1000))
}

/** XP = round(score / 100 * xp_max), capped. Mirrors §6 so the provisional number the
 *  child sees matches what Core grants for the same score. */
export function provisionalXp(score: number, xpMax: number): number {
  if (!Number.isFinite(score) || !Number.isFinite(xpMax)) return 0
  const cap = Math.max(0, Math.floor(xpMax))
  return Math.max(0, Math.min(cap, Math.round((Math.max(0, Math.min(100, score)) / 100) * cap)))
}

// ---- Reduced motion ----------------------------------------------------------

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** Disables DECORATIVE effects only. The simulation still runs, still scores and still
 *  finishes — turning motion off must never turn off the ability to earn XP (§10). */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia(REDUCED_MOTION_QUERY).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(REDUCED_MOTION_QUERY)
    const onChange = () => setReduced(query.matches)
    if (typeof query.addEventListener !== 'function') return
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}

// ---- Phases ------------------------------------------------------------------

type GamePhase = 'intro' | 'tutorial' | 'playing' | 'results'

interface FinishedRun {
  inputLog: GameInputEvent[]
  ticks: number
  /** The last rung/round the run reached (`SimSnapshot.round`) — engine-level, so the
   *  results screen never has to know a mechanic's own stat key names. */
  round: number
  result: SimResult
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-base">{children}</div>
}

// ---- The stage (mounted only while playing) ----------------------------------

interface GameStageProps {
  document: GameDocument
  slice: MechanicSlice
  seed: number
  maxTicks: number
  reducedMotion: boolean
  scheduler?: GameLoopScheduler
  runId: string
  onFinish: (run: FinishedRun) => void
  onExit: () => void
}

function GameStage({
  document: doc,
  seed,
  maxTicks,
  runId,
  onFinish,
  onExit,
}: GameStageProps) {
  const [snapshot, setSnapshot] = useState<SimSnapshot>({
    finished: false, score: 0, lives: null, round: 0,
  })
  const [paused, setPaused] = useState(false)
  const [interlude, setInterlude] = useState<GameInterlude | null>(null)
  const [confirmQuit, setConfirmQuit] = useState(false)
  const [muted, setMuted] = useState(() => isGameAudioMuted())
  const shownInterludes = useRef<Set<string>>(new Set())
  const finishedRef = useRef(false)

  const handleSnapshot = useCallback((snap: BridgeSnapshot) => {
    setSnapshot({
      score: snap.score,
      lives: snap.lives,
      finished: snap.finished,
      round: snap.round,
    })
  }, [])

  const handleFinish = useCallback((inputLog: readonly GameInputEvent[]) => {
    if (finishedRef.current) return
    finishedRef.current = true

    onFinish({
      inputLog: [...inputLog],
      ticks: 0,
      round: 0,
      result: { score: 0, finished: true, stats: {} },
    })
  }, [onFinish])

  useEffect(() => {
    if (interlude !== null || snapshot.finished) return
    const declared = doc.content.interludes ?? []
    for (const candidate of declared) {
      if (shownInterludes.current.has(candidate.id)) continue
      if (snapshot.round <= candidate.after_round) continue
      shownInterludes.current.add(candidate.id)
      setPaused(true)
      setInterlude(candidate)
      return
    }
  }, [doc, interlude, snapshot.finished, snapshot.round])

  const handleResume = useCallback(() => setPaused(false), [])
  const handlePauseAction = useCallback(() => setPaused(true), [])
  const handleQuitRequest = useCallback(() => {
    setPaused(true)
    setConfirmQuit(true)
  }, [])

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => { const next = !prev; setGameAudioMuted(next); return next })
  }, [])

  const showInterlude = interlude !== null && !confirmQuit
  const showPause = paused && !showInterlude && !confirmQuit && !snapshot.finished
  const combo = 0 // Phaser scenes handle their own combo display

  return (
    <>
      <GameHud
        document={doc}
        snapshot={snapshot}
        combo={combo}
        onPause={handlePauseAction}
        onQuit={handleQuitRequest}
      />
      <main className="mx-auto flex w-full min-h-0 max-w-container flex-1 flex-col px-4 py-3 md:px-8">
        <PhaserGameBox
          mechanic={doc.meta.mechanic}
          document={doc}
          runId={runId}
          seed={seed}
          maxTicks={maxTicks}
          paused={paused}
          className="flex-1"
          onSnapshot={handleSnapshot}
          onFinish={handleFinish}
        />
      </main>

      {showPause ? (
        <PauseOverlay
          muted={muted}
          onResume={handleResume}
          onToggleMute={handleToggleMute}
          onQuit={handleQuitRequest}
        />
      ) : null}

      {showInterlude && interlude !== null ? (
        <InterludeOverlay
          interlude={interlude}
          reducedMotion={false}
          onContinue={() => {
            setInterlude(null)
            setPaused(false)
          }}
        />
      ) : null}

      {confirmQuit ? (
        <QuitConfirmOverlay
          onConfirm={onExit}
          onCancel={() => {
            setConfirmQuit(false)
            setPaused(false)
          }}
        />
      ) : null}
    </>
  )
}

// ---- Intro (the concept recap) ------------------------------------------------

interface IntroScreenProps {
  document: GameDocument
  onStart: () => void
  onExit: () => void
}

function IntroScreen({ document: doc, onStart, onExit }: IntroScreenProps) {
  const { t } = useTranslation()
  const meta = MECHANIC_META[doc.meta.mechanic]
  const cast = doc.meta.cast ?? []

  return (
    <div className="mx-auto flex w-full max-w-container flex-1 flex-col px-4 md:px-8">
      <div className="flex justify-start py-3">
        <button
          type="button"
          onClick={onExit}
          aria-label={t('games.player.quit')}
          className={HUD_CONTROL_CLASS}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-5 pb-12 text-center">
        {cast.length > 0 ? (
          <div className="flex items-end justify-center">
            {cast.map((character, index) => (
              <CharacterActor
                key={character}
                character={character}
                emotion="happy"
                action={index === 0 ? 'wave' : 'idle'}
                size={index === 0 ? 'md' : 'sm'}
                className={cn(index > 0 && '-ml-4')}
              />
            ))}
          </div>
        ) : null}

        <h1 className="lf-display-lg text-content">{doc.meta.title}</h1>

        <span className="lf-caption inline-flex items-center gap-1 rounded-full bg-surface-sunken px-3 py-1 font-bold text-content-muted">
          <Icon name={meta.icon} className="text-[16px]" />
          {t(meta.titleKey)}
        </span>

        {/* The lesson link, on screen, before anything is playable. */}
        <div className="w-full rounded-lg border border-outline/70 bg-surface px-4 py-4 text-left shadow-glass-sm">
          <p className="lf-label text-content-faint">{t('games.player.intro.heading')}</p>
          <MarkdownLite
            text={doc.meta.concept.recap_md}
            className="lf-body mt-2 text-content"
          />
        </div>

        <Button variant="primary" onClick={onStart} className="min-h-11 min-w-11 px-10">
          {t('games.player.intro.start')}
          <Icon name="arrow_forward" className="ml-1 text-[18px]" />
        </Button>
      </div>
    </div>
  )
}

// ---- Tutorial ----------------------------------------------------------------

interface TutorialScreenProps {
  document: GameDocument
  onDone: () => void
}

/**
 * One screen, ONE interaction: the mechanic's core loop in a sentence, and a target the
 * child actually taps before the run starts.
 *
 * Tap — not drag — because tap is the guaranteed path on every device and every drag in
 * this engine is progressive enhancement over it (§10). The tap has a second, quieter
 * job: it is a real user gesture, so the browser's autoplay policy is satisfied before
 * the first game sound would fire.
 */
function TutorialScreen({ document: doc, onDone }: TutorialScreenProps) {
  const { t } = useTranslation()
  const meta = MECHANIC_META[doc.meta.mechanic]
  const [tried, setTried] = useState(false)

  return (
    <div className="mx-auto flex w-full max-w-container flex-1 flex-col px-4 md:px-8">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 py-12 text-center">
        <p className="lf-label text-content-faint">{t('games.player.tutorial.heading')}</p>
        <h2 className="lf-headline text-content">{t(meta.titleKey)}</h2>
        <p className="lf-body text-content-muted">{t(meta.blurbKey)}</p>

        <button
          type="button"
          onClick={() => setTried(true)}
          aria-label={t('games.a11y.actionButton')}
          className={cn(
            'flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed text-content transition-colors',
            tried ? 'border-success bg-success-soft' : 'border-outline bg-surface-sunken',
          )}
        >
          <Icon name={tried ? 'check' : meta.icon} className="text-[36px]" />
        </button>
        <p className="lf-caption text-content-faint">{t('games.player.tutorial.tryIt')}</p>

        <Button
          variant="primary"
          onClick={onDone}
          disabled={!tried}
          className="min-h-11 min-w-11 px-10"
        >
          {t('games.player.tutorial.next')}
        </Button>
        <button
          type="button"
          onClick={onDone}
          className="min-h-11 rounded-full px-3 py-2 lf-caption text-content-muted underline underline-offset-2 transition-colors hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          {t('games.player.tutorial.skip')}
        </button>
      </div>
    </div>
  )
}

// ---- The player --------------------------------------------------------------

/** Narrows `void | Promise<T>` without `any` and without assuming the caller returned
 *  a native Promise. */
function asResultPromise(
  value: void | Promise<ServerGameResult | null>,
): Promise<ServerGameResult | null> | null {
  const candidate: unknown = value
  if (candidate === null || candidate === undefined) return null
  if (typeof (candidate as { then?: unknown }).then !== 'function') return null
  return candidate as Promise<ServerGameResult | null>
}

export function GamePlayer({
  document: doc,
  slice,
  seed,
  runId,
  maxTicks,
  onComplete,
  onExit,
  onReplay,
  scheduler,
}: GamePlayerProps) {
  const [phase, setPhase] = useState<GamePhase>('intro')
  const [run, setRun] = useState<FinishedRun | null>(null)
  const [server, setServer] = useState<ServerGameResult | null>(null)
  const reportedRef = useRef(false)
  const reducedMotion = useReducedMotion()
  const ticks = maxTicks ?? defaultMaxTicks(doc)
  const gameRunId = runId ?? doc.meta.slug

  const handleFinish = useCallback(
    (finished: FinishedRun) => {
      setRun(finished)
      setPhase('results')
      if (reportedRef.current) return
      reportedRef.current = true
      const submission: GameRunSubmission = {
        seed,
        input_log: finished.inputLog,
        duration_seconds: durationSecondsFromTicks(finished.ticks),
      }
      const pending = asResultPromise(onComplete?.(submission))
      if (pending === null) return
      // A failed persist must never block the results screen: the child still sees what
      // they did, on the simulator's own numbers, and the server's answer simply never
      // arrives to replace them (§7 of the Lesson Player, same rule).
      void pending
        .then((data) => {
          if (data) setServer(data)
        })
        .catch(() => {
          // Reported by the caller; the results screen is not the place for a network
          // error, and there is nothing here the child could act on.
        })
    },
    [onComplete, seed],
  )

  if (slice === null) {
    return (
      <Shell>
        <UnsupportedGameCard onExit={onExit} />
      </Shell>
    )
  }

  if (phase === 'intro') {
    return (
      <Shell>
        <IntroScreen document={doc} onStart={() => setPhase('tutorial')} onExit={onExit} />
      </Shell>
    )
  }

  if (phase === 'tutorial') {
    return (
      <Shell>
        <TutorialScreen document={doc} onDone={() => setPhase('playing')} />
      </Shell>
    )
  }

  if (phase === 'results') {
    // PROVISIONAL until the server answers. The simulator's own result is shown
    // immediately so the screen never waits on the network — but it is a CLAIM, not the
    // grant: Core replays the input log and its numbers replace every one of these the
    // moment `onComplete` resolves.
    const provisional = run?.result
    const localScore = provisional?.score ?? 0
    const score = server?.score ?? localScore
    const passed = server?.passed ?? score >= doc.scoring.pass_score
    const xp = server?.xp_earned ?? provisionalXp(score, doc.scoring.xp_max)
    return (
      <Shell>
        <GameResultsScreen
          document={doc}
          score={score}
          passed={passed}
          xp={xp}
          durationSeconds={durationSecondsFromTicks(run?.ticks ?? 0)}
          rounds={run?.round ?? 1}
          stats={provisional?.stats ?? {}}
          bestScore={server?.best_score ?? null}
          newBest={server?.new_best ?? false}
          reducedMotion={reducedMotion}
          onReplay={onReplay}
          onExit={onExit}
        />
      </Shell>
    )
  }

  return (
    <Shell>
      <GameStage
        document={doc}
        slice={slice}
        seed={seed}
        maxTicks={ticks}
        reducedMotion={reducedMotion}
        scheduler={scheduler}
        runId={gameRunId}
        onFinish={handleFinish}
        onExit={onExit}
      />
    </Shell>
  )
}

export default GamePlayer
