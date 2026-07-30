// The game player's four interruptions and its ending — GAME_ENGINE.md §6 (results,
// scoring modes), §10 (motion, hit areas, canvas-vs-chrome), §11 (earned celebration).
//
// All CHROME: kit components, closed DESIGN tokens, `lf-*` type scale, Material
// Symbols, `lf-number` for figures. Every one of these views obeys the Action Color
// Contract — exactly ONE papaya (accent) button on screen at a time — and every control
// is a >= 44x44 tap target.
//
// The two sanctioned interruptions of a run are the PAUSE overlay and an INTERLUDE
// (§10). The quit confirmation is a guard on top of pause, never a third interruption
// that can appear on its own. Nothing here ever advances or scores the simulation.

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import CharacterActor from '@/components/characters/control/CharacterActor'
import type { CharacterId } from '@/components/characters/control/types'
import { Button, Icon } from '@/components/ui'
import { tierForScore } from '@/game-engine/core/scoring'
import type { GameDocument, GameInterlude, GameInterludeOption } from '@/game-engine/core/types'
// MarkdownLite is the platform's ONE MarkdownLite renderer (LESSON_ENGINE.md §8) and is
// a leaf with no lesson coupling — `*_md` fields in a GameDocument carry the same
// restricted syntax, so reusing it is what keeps the two engines rendering authored
// content identically instead of drifting apart.
import MarkdownLite from '@/lesson-engine/core/MarkdownLite'
import { cn } from '@/lib/utils'

import { comboFromStats } from './hud'

const OVERLAY_BUTTON_CLASS = 'min-h-11 min-w-11'

/** The canon lead, used only when a document declares no cast: celebration is part of
 *  the product's feedback language and a results screen with nobody on it reads as an
 *  error page. Appearance is owned by Character Control and never re-drawn here. */
const DEFAULT_CAST: CharacterId[] = ['dina']

function castOf(doc: GameDocument): CharacterId[] {
  const cast = doc.meta.cast
  return cast !== undefined && cast.length > 0 ? cast : DEFAULT_CAST
}

interface OverlayShellProps {
  labelledBy: string
  children: React.ReactNode
}

/** A modal scrim over the running canvas. `overflow-y-auto` because an interlude with
 *  four options and a rationale is taller than a 375x667 viewport. */
function OverlayShell({ labelledBy, children }: OverlayShellProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-inverse/70 px-4 py-6"
    >
      <div className="my-auto w-full max-w-md rounded-lg border border-outline/70 bg-surface p-5 shadow-glass sm:p-6">
        {children}
      </div>
    </div>
  )
}

// ---- Pause -------------------------------------------------------------------

export interface PauseOverlayProps {
  muted: boolean
  onResume: () => void
  onToggleMute: () => void
  onQuit: () => void
}

/**
 * The pause overlay. Resume is the single accent CTA: pausing is a breath, not a
 * decision point, and the fastest path out of it must be back INTO the game.
 */
export function PauseOverlay({ muted, onResume, onToggleMute, onQuit }: PauseOverlayProps) {
  const { t } = useTranslation()
  return (
    <OverlayShell labelledBy="lf-game-pause-title">
      <div className="flex flex-col items-center gap-5 text-center">
        <Icon name="pause_circle" className="text-[44px] text-content-muted" />
        <h2 id="lf-game-pause-title" className="lf-headline text-content">
          {t('games.player.pause')}
        </h2>
        <Button variant="primary" onClick={onResume} className={cn(OVERLAY_BUTTON_CLASS, 'w-full')}>
          {t('games.player.resume')}
        </Button>
        <div className="flex w-full items-center justify-between gap-3">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={t(muted ? 'games.player.unmute' : 'games.player.mute')}
            className="flex h-11 w-11 items-center justify-center rounded-full text-content-muted transition-colors hover:bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Icon name={muted ? 'volume_off' : 'volume_up'} />
          </button>
          <Button variant="secondary" onClick={onQuit} className={OVERLAY_BUTTON_CLASS}>
            {t('games.player.quit')}
          </Button>
        </div>
      </div>
    </OverlayShell>
  )
}

// ---- Quit confirmation -------------------------------------------------------

export interface QuitConfirmOverlayProps {
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Leaving loses the round, so the accent CTA is STAYING. The destructive choice is
 * present, plain and reachable — it is simply not the loud one (no dark patterns, §11).
 */
export function QuitConfirmOverlay({ onConfirm, onCancel }: QuitConfirmOverlayProps) {
  const { t } = useTranslation()
  return (
    <OverlayShell labelledBy="lf-game-quit-title">
      <div className="flex flex-col gap-4">
        <h2 id="lf-game-quit-title" className="lf-headline text-content">
          {t('games.player.quitConfirm.title')}
        </h2>
        <p className="lf-body text-content-muted">{t('games.player.quitConfirm.body')}</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onConfirm} className={OVERLAY_BUTTON_CLASS}>
            {t('games.player.quitConfirm.confirm')}
          </Button>
          <Button variant="primary" onClick={onCancel} className={OVERLAY_BUTTON_CLASS}>
            {t('games.player.quitConfirm.cancel')}
          </Button>
        </div>
      </div>
    </OverlayShell>
  )
}

// ---- Interlude ---------------------------------------------------------------

export interface InterludeOverlayProps {
  interlude: GameInterlude
  reducedMotion: boolean
  onContinue: () => void
}

function optionTone(option: GameInterludeOption, chosen: boolean, revealed: boolean): string {
  if (!revealed) return chosen ? 'border-primary bg-primary-soft text-content' : 'border-outline bg-surface text-content'
  if (option.correct) return 'border-success bg-success-soft text-content'
  // A wrong pick is WARNING, never error: the interlude is a check, not a punishment,
  // and red on a child's mistake is the tone this platform does not use (§11).
  if (chosen) return 'border-warning bg-warning-soft text-content'
  return 'border-outline bg-surface text-content-muted'
}

/**
 * The between-rounds micro-exercise (`pick_one` / `true_false` / `tap_all`). It is a
 * retrieval beat, not a gate: every path ends in Continue and nothing here can cost the
 * player score, lives or XP. The simulation is paused by the shell while it is up, so
 * the interruption is exact rather than a race against falling items.
 */
export function InterludeOverlay({ interlude, reducedMotion, onContinue }: InterludeOverlayProps) {
  const { t } = useTranslation()
  const [chosen, setChosen] = useState<readonly string[]>([])
  const [revealed, setRevealed] = useState(false)
  const multi = interlude.kind === 'tap_all'

  const rationales = useMemo(() => {
    if (!revealed) return []
    const lines: { id: string; text: string }[] = []
    for (const option of interlude.options) {
      // Explain what the player TOUCHED, plus anything correct they missed — the
      // teaching content, not a verdict list.
      const relevant = chosen.includes(option.id) || option.correct
      if (!relevant) continue
      if (option.rationale_md === undefined) continue
      lines.push({ id: option.id, text: option.rationale_md })
    }
    return lines
  }, [revealed, chosen, interlude.options])

  const toggle = (id: string) => {
    if (revealed) return
    if (multi) {
      setChosen((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]))
      return
    }
    setChosen([id])
    setRevealed(true)
  }

  return (
    <OverlayShell labelledBy="lf-game-interlude-title">
      <div className="flex flex-col gap-4">
        <p id="lf-game-interlude-title" className="lf-label text-content-faint">
          {t('games.player.interlude.heading')}
        </p>
        <MarkdownLite text={interlude.prompt_md} className="lf-title text-content" />
        <ul className="flex flex-col gap-2">
          {interlude.options.map((option) => {
            const isChosen = chosen.includes(option.id)
            return (
              <li key={option.id}>
                <button
                  type="button"
                  onClick={() => toggle(option.id)}
                  disabled={revealed}
                  aria-pressed={multi ? isChosen : undefined}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md border px-4 py-3 text-left',
                    OVERLAY_BUTTON_CLASS,
                    optionTone(option, isChosen, revealed),
                    !reducedMotion && 'transition-colors duration-150',
                  )}
                >
                  {revealed ? (
                    <Icon
                      name={option.correct ? 'check_circle' : 'radio_button_unchecked'}
                      className="shrink-0 text-[20px]"
                    />
                  ) : (
                    <Icon
                      name={isChosen ? 'check_circle' : 'radio_button_unchecked'}
                      className="shrink-0 text-[20px]"
                    />
                  )}
                  <MarkdownLite text={option.label_md} as="span" className="lf-body min-w-0 flex-1" />
                </button>
              </li>
            )
          })}
        </ul>
        {rationales.map((line) => (
          <MarkdownLite key={line.id} text={line.text} className="lf-caption text-content-muted" />
        ))}
        {multi && !revealed ? (
          <Button
            variant="primary"
            onClick={() => setRevealed(true)}
            disabled={chosen.length === 0}
            className={cn(OVERLAY_BUTTON_CLASS, 'w-full')}
          >
            {t('games.player.interlude.check')}
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={onContinue}
            disabled={!revealed}
            className={cn(OVERLAY_BUTTON_CLASS, 'w-full')}
          >
            {t('games.player.interlude.continue')}
          </Button>
        )}
      </div>
    </OverlayShell>
  )
}

// ---- The honest results highlight --------------------------------------------

/**
 * One true sentence about the run just played — the Game Engine's twin of the Lesson
 * Engine's Glows & Grows selector (`lesson-engine/core/glowsGrows.ts`): a deterministic
 * pure selector over what actually happened, so the copy needs no moderation pass and
 * i18n owns every word (§1.8).
 *
 * Honesty rules, same as its twin: a kid can smell fake praise, so a strength is only
 * named when the numbers show one. The `effort` fallback is true by construction —
 * reaching this screen means the round was played to its end — which is exactly why it
 * is the fallback rather than an invented compliment.
 */
export type GameHighlight = { kind: 'combo'; count: number } | { kind: 'accuracy' } | { kind: 'effort' }

/** A streak reads as a real streak from three in a row. */
const COMBO_MIN = 3
/** Below this, "you were accurate" would be flattery rather than a description. */
const ACCURACY_MIN = 80

export function gameHighlight(stats: Record<string, number>): GameHighlight {
  const combo = comboFromStats(stats)
  if (combo !== null && combo >= COMBO_MIN) return { kind: 'combo', count: combo }
  const accuracy = stats['accuracy']
  if (typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy >= ACCURACY_MIN) {
    return { kind: 'accuracy' }
  }
  return { kind: 'effort' }
}

// ---- Results -----------------------------------------------------------------

/** `tierForScore` bands → the four authored results titles. */
const TITLE_KEYS = {
  perfect: 'games.player.results.title.perfect',
  great: 'games.player.results.title.great',
  almost: 'games.player.results.title.good',
  tryAgain: 'games.player.results.title.keepGoing',
} as const

interface ResultStatProps {
  icon: string
  label: string
  value: string
}

function ResultStat({ icon, label, value }: ResultStatProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-outline/70 bg-surface px-3 py-3 shadow-glass-sm">
      <Icon name={icon} className="shrink-0 text-[28px] text-content-faint" />
      <div className="min-w-0 text-left">
        <p className="lf-caption leading-tight text-content-faint">{label}</p>
        <p className="lf-title lf-number mt-0.5 font-bold leading-none text-content">{value}</p>
      </div>
    </div>
  )
}

/** mm:ss — locale-independent by construction, so no Intl formatting is needed. */
export function formatGameDuration(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0
  const minutes = Math.floor(total / 60)
  const rest = total - minutes * 60
  return `${minutes}:${rest < 10 ? '0' : ''}${rest}`
}

export interface GameResultsScreenProps {
  document: GameDocument
  /** The server's score once it answers; the simulator's own until then. */
  score: number
  passed: boolean
  xp: number
  durationSeconds: number
  /** The last round/rung the run reached (`SimSnapshot.round`). */
  rounds: number
  /** The mechanic's derived aggregates — the highlight selector's only input. */
  stats: Record<string, number>
  bestScore?: number | null
  newBest?: boolean
  reducedMotion: boolean
  /** Absent when the caller cannot mint a fresh run (a new run id and seed are the
   *  route's to issue, never the player's to invent). */
  onReplay?: () => void
  onExit: () => void
}

export function GameResultsScreen({
  document: doc,
  score,
  passed,
  xp,
  durationSeconds,
  rounds,
  stats,
  bestScore,
  newBest,
  reducedMotion,
  onReplay,
  onExit,
}: GameResultsScreenProps) {
  const { t } = useTranslation()
  const tier = tierForScore(score, doc.scoring.pass_score)
  const highlight = gameHighlight(stats)
  const circumference = 2 * Math.PI * 52

  const highlightText =
    highlight.kind === 'combo'
      ? t('games.player.results.highlight.combo', { count: highlight.count })
      : t(`games.player.results.highlight.${highlight.kind}`)

  return (
    <div className="mx-auto flex w-full max-w-container flex-1 flex-col items-center justify-center gap-6 px-4 py-10 text-center md:px-8">
      {/* Celebration is EARNED: `celebrate` only on a pass, and the loop stops under
          reduced motion — decorative, never the ability to see the result (§10). */}
      <div className="flex items-end justify-center">
        {castOf(doc).map((character) => (
          <CharacterActor
            key={character}
            character={character}
            emotion={passed ? 'proud' : 'encouraging'}
            action={passed ? 'celebrate' : 'wave'}
            loop={passed && !reducedMotion}
            size="md"
            className="-ml-4 first:ml-0"
          />
        ))}
      </div>

      <h2 className="lf-display-lg text-content">{t(TITLE_KEYS[tier])}</h2>

      <div className="relative h-32 w-32">
        {/* The ring is a picture of the number beside it — announcing it twice would
            just be noise, so the figure carries the accessible label. */}
        <svg viewBox="0 0 120 120" aria-hidden="true" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r="52" fill="none" strokeWidth="12" className="stroke-surface-sunken" />
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - Math.min(100, Math.max(0, score)) / 100)}
            className={cn(
              passed ? 'stroke-success' : 'stroke-warning',
              !reducedMotion && 'transition-[stroke-dashoffset] duration-700',
            )}
            style={reducedMotion ? undefined : { transitionTimingFunction: 'var(--lf-ease)' }}
          />
        </svg>
        <span className="lf-headline absolute inset-0 flex items-center justify-center text-content">
          <span className="sr-only">{t('games.player.results.stats.score')}</span>
          <span className="lf-number">{score}</span>
        </span>
      </div>

      <div className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <ResultStat icon="bolt" label={t('games.player.results.xpEarned')} value={`+${xp}`} />
        <ResultStat
          icon="timer"
          label={t('games.player.results.stats.time')}
          value={formatGameDuration(durationSeconds)}
        />
        <ResultStat
          icon="stairs"
          label={t('games.player.results.stats.rounds')}
          value={String(rounds)}
        />
        <ResultStat
          icon="trophy"
          label={t(newBest === true ? 'games.player.results.newBest' : 'games.player.results.bestScore')}
          value={String(bestScore ?? score)}
        />
      </div>

      <div className="flex w-full max-w-xl items-center gap-3 rounded-lg border border-outline/70 bg-surface px-4 py-3 text-left shadow-glass-sm">
        <Icon name="star" fill className="shrink-0 text-[26px] text-warning-strong" />
        <p className="lf-body font-semibold text-content">{highlightText}</p>
      </div>

      {/* The concept line the document itself authored — the reason this was a lesson
          reinforcement and not a toy, restated at the end of the loop. */}
      <MarkdownLite
        text={doc.content.feedback.results_md}
        className="lf-body max-w-xl text-content-muted"
      />

      <div className="flex w-full max-w-md flex-col-reverse gap-2 sm:flex-row sm:justify-center">
        {onReplay !== undefined ? (
          <>
            <Button variant="secondary" onClick={onExit} className={OVERLAY_BUTTON_CLASS}>
              {t('games.player.results.backToHub')}
            </Button>
            <Button variant="primary" onClick={onReplay} className={OVERLAY_BUTTON_CLASS}>
              {t('games.player.results.retry')}
            </Button>
          </>
        ) : (
          <Button variant="primary" onClick={onExit} className={cn(OVERLAY_BUTTON_CLASS, 'sm:px-10')}>
            {t('games.player.results.backToHub')}
          </Button>
        )}
      </div>
    </div>
  )
}

// ---- Unsupported mechanic ----------------------------------------------------

export interface UnsupportedGameCardProps {
  onExit: () => void
}

/**
 * The forward-compatibility card (GAME_ENGINE.md §7): a document whose mechanic this
 * build cannot play is a friendly dead end, never a crash and never XP. It is what lets
 * mechanic #9's CONTENT ship before every client has its code.
 */
export function UnsupportedGameCard({ onExit }: UnsupportedGameCardProps) {
  const { t } = useTranslation()
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <Icon name="extension_off" className="text-[48px] text-content-faint" />
      <h2 className="lf-title text-content">{t('games.states.unsupported.title')}</h2>
      <p className="lf-body text-content-muted">{t('games.states.unsupported.body')}</p>
      <Button variant="primary" onClick={onExit} className={OVERLAY_BUTTON_CLASS}>
        {t('games.states.unsupported.back')}
      </Button>
    </div>
  )
}
