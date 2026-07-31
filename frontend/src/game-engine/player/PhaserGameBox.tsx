import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Phaser from 'phaser'

import type { GameDocument, MechanicId } from '@/game-engine/core/types'
import type { BridgeFinishPayload, BridgeSnapshot } from '@/game-engine/phaser/bridge'
import { CANVAS_STRING_KEYS } from '@/game-engine/phaser/scene'
import { loadMechanicScene } from '@/game-engine/phaser/sceneRegistry'
import { MECHANIC_META } from '@/game-engine/registry'
import { cn } from '@/lib/utils'

export interface PhaserGameBoxProps {
  mechanic: MechanicId
  document: GameDocument
  runId: string
  seed: number
  maxTicks: number
  paused: boolean
  reducedMotion: boolean
  className?: string
  onSnapshot?: (snap: BridgeSnapshot) => void
  onFinish?: (payload: BridgeFinishPayload) => void
  /** Fired when the browser takes focus away mid-run (tab hidden, window blurred, OR
   *  — see the boot-time check in the effect below — the tab was ALREADY hidden the
   *  moment this run started, e.g. opened in a background tab) — GAME_ENGINE.md §10's
   *  hidden-tab/auto-pause invariant, restored at this layer since the play path no
   *  longer runs through core/kernel.ts's scheduler. The caller is expected to set
   *  `paused` true in response, which shows the real PauseOverlay rather than leaving
   *  a simulation running (or silently frozen) behind nobody's attention. */
  onAutoPause?: () => void
}

type SceneWithPause = {
  paused: boolean
  togglePause: () => void
}

function extractSceneConstructor(mod: object): (new () => Phaser.Scene) | null {
  for (const value of Object.values(mod)) {
    if (typeof value === 'function' && value.prototype instanceof Phaser.Scene) {
      return value as new () => Phaser.Scene
    }
  }
  return null
}

/**
 * Mounts one Phaser.Game scoped to exactly one run (created on mount, destroyed on
 * unmount — a fresh `runId`/`seed` gets a fresh mount via React's `key`, never a
 * reused instance).
 *
 * SCENE BOOT — the bug this file used to have, and why the fix looks like this:
 * Phaser resolves a scene's key from whatever the scene's OWN `super(key)` call set,
 * not from whatever key you pass to `add()`/`start()` — so a stale/mismatched key
 * argument silently no-ops rather than erroring. And a scene class placed in
 * `GameConfig.scene` auto-starts the moment the Game becomes ready, with EMPTY init
 * data, before any app code can run — so real data arriving later via `scene.start()`
 * either never applies or races an already-crashed `init({})`.
 * The fix is Phaser's own sanctioned pattern for scenes that need runtime data: create
 * the Game with NO scenes configured, `scene.add(key, Class, false)` (explicitly not
 * auto-started) once the class is loaded, then `scene.start(key, realData)` on the
 * Game's `ready` event — exactly once, with exactly the data this run needs. `key` is
 * simply the mechanic id; every scene's constructor now agrees (verified: `super()`
 * calls in every mechanics/*\/scene.ts use their own `MechanicId` verbatim), and since
 * one Game instance is scoped to one run already, the id needs no further scoping.
 */
export function PhaserGameBox({
  mechanic,
  document,
  runId,
  seed,
  maxTicks,
  paused,
  reducedMotion,
  className,
  onSnapshot,
  onFinish,
  onAutoPause,
}: PhaserGameBoxProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const sceneRef = useRef<SceneWithPause | null>(null)

  const onSnapshotRef = useRef(onSnapshot)
  onSnapshotRef.current = onSnapshot
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish
  const onAutoPauseRef = useRef(onAutoPause)
  onAutoPauseRef.current = onAutoPause

  useEffect(() => {
    // Guards the async gap between "effect started" and "Phaser.Game exists": if the
    // component unmounts (or its identity changes) while `loadMechanicScene` is still
    // in flight, the stale continuation must not construct an orphaned Game that
    // nothing would ever destroy (the leak the previous version had — every remount
    // during a slow import left a live WebGL context + RAF loop running forever).
    let cancelled = false
    let game: Phaser.Game | null = null

    async function start() {
      const container = containerRef.current
      if (!container) return

      const mod = await loadMechanicScene(mechanic)
      if (cancelled || !mod) return

      const SceneClass = extractSceneConstructor(mod)
      if (!SceneClass) return

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        parent: container,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        backgroundColor: '#000000',
        audio: { noAudio: false },
        banner: false,
        // No `scene` here on purpose — see the file-level doc comment.
      }

      game = new Phaser.Game(config)
      if (cancelled) {
        game.destroy(true)
        game = null
        return
      }
      gameRef.current = game

      // Registered inactive; `game.events.once('ready', ...)` below is the ONLY thing
      // that starts it, with the real init data.
      game.scene.add(mechanic, SceneClass, false)

      // Resolved ONCE here, on the only side of this component that can call `t()` —
      // see the doc comment on `CANVAS_STRING_KEYS` in phaser/scene.ts for the full
      // contract. Read once at scene start, same convention as `document`/`seed`/
      // `reducedMotion` below: a language change mid-run does not tear down and
      // restart the Game.
      const strings: Record<string, string> = {}
      for (const key of CANVAS_STRING_KEYS) {
        strings[key] = t(`games.canvas.${key}`)
      }

      game.events.once('ready', () => {
        if (cancelled || gameRef.current !== game) return
        game?.scene.start(mechanic, {
          document,
          runId,
          seed,
          maxTicks,
          reducedMotion,
          strings,
          onSnapshot: (snap: BridgeSnapshot) => onSnapshotRef.current?.(snap),
          onFinish: (payload: BridgeFinishPayload) => onFinishRef.current?.(payload),
        })
        // The scene object already exists (added above); `start()` just ran its boot
        // synchronously up to `create()`, so this is available immediately — no async
        // race with a later 'ready'-nested lookup.
        sceneRef.current = game?.scene.getScene(mechanic) as unknown as SceneWithPause

        // A run that STARTS already hidden (opened in a background tab, or the user
        // switched away during the async scene-module import above) gets no signal at
        // all from Phaser's own visibility plumbing: VisibilityHandler only attaches
        // forward-looking `visibilitychange`/blur/focus listeners at Game boot — it
        // never inspects the CURRENT state (verified against the installed Phaser 3.90
        // source, node_modules/phaser/src/core/VisibilityHandler.js) — so with only the
        // event listeners below, a run beginning hidden would tick, unpaused, for as
        // long as it stayed hidden. Checked once, right here, after the scene has real
        // init data. `globalThis.document` (NOT the bare `document` identifier) is
        // deliberate: this component's own `document` prop is a `GameDocument`, which
        // shadows the DOM global of the same name inside this closure.
        if (typeof globalThis.document !== 'undefined' && globalThis.document.hidden) {
          onAutoPauseRef.current?.()
        }
      })

      // §10: a run left running while the tab is hidden or the window loses focus gets
      // no attention from anyone. Phaser's own RAF loop already halts while the tab is
      // hidden (ticks simply stop), but nothing shows the PauseOverlay for it on its
      // own — so both HIDDEN (document.visibilitychange -> hidden) and BLUR (the
      // window losing focus while still visible, e.g. switching to another app) are
      // wired explicitly to the same auto-pause path.
      game.events.on(Phaser.Core.Events.HIDDEN, () => {
        if (cancelled) return
        onAutoPauseRef.current?.()
      })
      game.events.on(Phaser.Core.Events.BLUR, () => {
        if (cancelled) return
        onAutoPauseRef.current?.()
      })
    }

    void start()

    return () => {
      cancelled = true
      if (game) {
        game.destroy(true)
      }
      if (gameRef.current === game) gameRef.current = null
      sceneRef.current = null
    }
    // Deliberately keyed on identity-bearing values only. `document`/`seed`/`maxTicks`/
    // `reducedMotion` are read once at scene start; a change mid-run does not tear down
    // and restart the Game (the same convention the old kernel-driven stage used).
  }, [mechanic, runId])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    if (paused && !scene.paused) {
      scene.togglePause()
    } else if (!paused && scene.paused) {
      scene.togglePause()
    }
  }, [paused])

  const label = t(MECHANIC_META[mechanic].titleKey)

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={t('games.player.canvasLabel', { title: label })}
      className={cn(
        'flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-inverse',
        className,
      )}
    />
  )
}
