// The game HUD — GAME_ENGINE.md §10 (canvas-vs-chrome boundary, hit areas, both
// breakpoints first-class) and DESIGN.md §Screen Recipes.
//
// This is CHROME, not canvas: kit components, closed DESIGN tokens, the `lf-*` type
// scale, Material Symbols, `lf-number` for every figure. No arcade font — the arcade
// feel comes from weight, size and motion (§10). It is the exact twin of the Lesson
// Player's sticky glass header, so a child meets ONE progress language across lessons
// and games rather than two.
//
// It reads a `SimSnapshot` and calls back. It never scores, never advances a tick and
// never touches the simulator — the same renderer/simulator split the mechanic views
// obey, applied to the shell.
//
// ACTION COLOR CONTRACT: there is NO papaya control here. The single accent CTA of the
// play view belongs to the mechanic canvas / the overlays; the HUD's pause and quit are
// deliberately quiet, because the loudest thing on the screen must be the game.

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Icon, ProgressBar } from '@/components/ui'
import type { GameDocument, SimSnapshot } from '@/game-engine/core/types'
import { cn } from '@/lib/utils'

/** Every shell control is a >= 44x44 tap target at every breakpoint (§1.11, §10). */
export const HUD_CONTROL_CLASS =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-content-muted transition-colors hover:bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary'

/**
 * `SimSnapshot` carries `finished/score/lives/round` and NOT a combo, so the shell has
 * no engine-level live combo to read. Each mechanic does publish a combo aggregate in
 * `result(state).stats`, under its own key — this is the closed lookup over those keys.
 *
 * What it yields is therefore the run's BEST combo so far, not the streak that is live
 * this tick (mechanics that want a live streak draw it on their own canvas, as `sorter`
 * does with its multiplier badge). Returns null when the mechanic publishes no combo at
 * all, and the HUD then renders no combo chip rather than a zero.
 */
const COMBO_STAT_KEYS = ['best_combo', 'combo_best', 'best_streak'] as const

export function comboFromStats(stats: Record<string, number>): number | null {
  for (const key of COMBO_STAT_KEYS) {
    const value = stats[key]
    if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value))
  }
  return null
}

interface HudChipProps {
  icon: string
  label: string
  value: string
  tone: string
}

/** Icon + figure. The word is `sr-only` rather than an `aria-label` on the wrapper on
 *  purpose: an `aria-label` REPLACES the element's contents in the accessible name, so
 *  it would announce "Lives" and swallow the number. Sighted users get the icon (four
 *  spelled-out labels do not fit at 375px and would push the progress bar out of the
 *  thumb zone); assistive tech gets "Lives 3". */
function HudChip({ icon, label, value, tone }: HudChipProps) {
  return (
    <span className={cn('flex items-center gap-1 rounded-full px-3 py-1 lf-label', tone)}>
      <Icon name={icon} fill className="text-[18px]" />
      <span className="sr-only">{label}</span>
      <span className="lf-number">{value}</span>
    </span>
  )
}

// ---- Live region (screen-reader state announcements) -------------------------
//
// The canvas is pointer-driven Phaser — a screen reader cannot operate it, and making
// it fully AT-operable is out of scope for this pass (the same boundary mainstream
// canvas games draw). What IS in scope, and was missing until now: an AT user must
// never be left silent about what is HAPPENING. `role="img"` on the canvas container
// (PhaserGameBox.tsx) names the game once; this announces the state changes that a
// sighted player reads off the HUD as they happen — score, round and completion — so
// a screen-reader user gets the same "what just happened" signal, even though they
// cannot reach into the canvas to change it themselves.
//
// Throttling is not a timer — it is identity. The announcement text only changes (and
// therefore only gets picked up by the live region's mutation observer / announced by
// the AT) on the exact score/round/finished DELTA the HUD's own chips re-render on, via
// the same `snapshot` prop; a tick that moves nothing announced stays silent.

type LiveSnapshot = Pick<SimSnapshot, 'score' | 'round' | 'finished'>

/** Exported for its own focused test — this is the only piece of the live region that
 *  has real branching logic; the JSX around it is a static `aria-live` div. */
export function useLiveAnnouncement(
  snapshot: LiveSnapshot,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const [message, setMessage] = useState('')
  const prevRef = useRef<LiveSnapshot | null>(null)

  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = snapshot

    // The very first snapshot a run mounts with is not news — announcing "Score 0,
    // round 0" the instant the canvas appears would just be noise ahead of anything
    // actually happening.
    if (prev === null) return

    if (snapshot.finished && !prev.finished) {
      setMessage(t('games.a11y.live.finished', { score: snapshot.score }))
      return
    }
    // Once completion has been announced, further churn (results screen forming,
    // etc.) is not this region's job to narrate.
    if (snapshot.finished) return

    if (snapshot.round !== prev.round) {
      setMessage(t('games.a11y.live.round', { round: snapshot.round, score: snapshot.score }))
    } else if (snapshot.score !== prev.score) {
      setMessage(t('games.a11y.live.score', { score: snapshot.score }))
    }
  }, [snapshot.score, snapshot.round, snapshot.finished, t])

  return message
}

export interface GameHudProps {
  document: GameDocument
  snapshot: SimSnapshot
  /** Best combo so far, or null when this mechanic publishes none. See COMBO_STAT_KEYS. */
  combo?: number | null
  onPause: () => void
  onQuit: () => void
}

export function GameHud({ document: doc, snapshot, combo, onPause, onQuit }: GameHudProps) {
  const { t } = useTranslation()

  // Cheer mode has NO fail state (§6): lives are `null`, and the chip is not rendered
  // dimmed or as a zero — it is absent entirely, because showing a lives slot a child
  // can never lose invents a threat the mode exists to remove.
  const showLives = doc.scoring.mode !== 'cheer' && snapshot.lives !== null
  const showCombo = typeof combo === 'number' && combo >= 2
  const liveMessage = useLiveAnnouncement(snapshot, t)

  return (
    <header className="lf-glass sticky top-0 z-20 shadow-glass-sm">
      {/* See "Live region" doc comment above: score/round/completion, for a screen
          reader that cannot operate the canvas but must not be left guessing what it
          is doing. */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {liveMessage}
      </div>
      <div className="mx-auto flex w-full max-w-container flex-wrap items-center gap-2 px-4 py-2 md:px-8">
        <button
          type="button"
          onClick={onQuit}
          aria-label={t('games.player.quit')}
          className={HUD_CONTROL_CLASS}
        >
          <Icon name="close" />
        </button>

        {/* Progress toward the bar that actually grants the reward. The mechanic's own
            win target is mechanic-shaped and lives on its canvas; what the shell can
            state honestly at every breakpoint is "how close is this run to passing". */}
        <div className="order-last flex w-full min-w-0 items-center gap-2 sm:order-none sm:w-auto sm:flex-1">
          <ProgressBar
            value={snapshot.score}
            label={t('games.player.hud.progress')}
            className="min-w-0 flex-1"
          />
          <span className="lf-caption shrink-0 text-content-faint">
            <span className="sr-only">{t('games.player.hud.target')}</span>
            <span className="lf-number">{doc.scoring.pass_score}</span>
          </span>
        </div>

        <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
          <HudChip
            icon="sports_score"
            label={t('games.player.hud.score')}
            value={String(snapshot.score)}
            tone="bg-primary-soft text-primary"
          />
          {showLives ? (
            <HudChip
              icon="favorite"
              label={t('games.player.hud.lives')}
              value={String(snapshot.lives)}
              tone="bg-error-soft text-error-strong"
            />
          ) : null}
          {showCombo ? (
            <HudChip
              icon="local_fire_department"
              label={t('games.player.hud.combo')}
              value={String(combo)}
              tone="bg-warning-soft text-warning-strong"
            />
          ) : null}
        </div>

        {/* Pause is reachable in ONE tap from any play state (§10). It is last in the
            row so it lands under the thumb on mobile. */}
        <button
          type="button"
          onClick={onPause}
          aria-label={t('games.a11y.pause')}
          className={HUD_CONTROL_CLASS}
        >
          <Icon name="pause" />
        </button>
      </div>
    </header>
  )
}

export default GameHud
