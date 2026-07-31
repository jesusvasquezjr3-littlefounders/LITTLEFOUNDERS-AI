import Phaser from 'phaser'

import type { GameDocument } from '@/game-engine/core/types'

import { resolvePalette, type GamePalette } from './assets'
import { GameEngineBridge, type BridgeFinishPayload, type BridgeSnapshot } from './bridge'
import { createParticleTextures } from './juice'

export interface MechanicSceneInit {
  document: GameDocument
  runId: string
  seed: number
  maxTicks: number
  /** GAME_ENGINE.md §10: disables DECORATIVE effects only — the simulation, scoring
   *  and completion are identical either way. Read by phaser/juice.ts. */
  reducedMotion?: boolean
  onSnapshot?: (snap: BridgeSnapshot) => void
  onFinish?: (payload: BridgeFinishPayload) => void
  onPause?: () => void
}

export abstract class BaseMechanicScene<S> extends Phaser.Scene {
  bridge!: GameEngineBridge<S>
  doc!: GameDocument
  palette!: GamePalette
  /** The run's seed — the ONLY source a subclass's `createBridge()` may read. Set here,
   *  once, from the real init data. §1.14: no mechanic may fall back to `?? 1` or
   *  `?? Date.now()` — a missing seed is a wiring bug and must be LOUD, never a silent
   *  default that seeds a world the server's replay can never reproduce. */
  seed!: number
  runId!: string
  maxTicks!: number
  reducedMotion = false

  private _onSnapshot?: (snap: BridgeSnapshot) => void
  private _onFinish?: (payload: BridgeFinishPayload) => void
  private _onPause?: () => void
  private _lastSnapshot: BridgeSnapshot = {
    score: 0, lives: null, finished: false, round: 0, tick: 0, tickAlpha: 0, stats: {},
  }
  private _paused = false
  /** Named distinctly from any subclass's own "finished" bookkeeping (e.g. a scene's
   *  one-shot celebration-effect flag) — this one gates the `_onFinish` callback and
   *  must never collide with a subclass's private field of a similar name. */
  private _completionFired = false

  constructor(key: string) {
    super({ key })
  }

  init(data: MechanicSceneInit): void {
    if (!Number.isFinite(data.seed)) {
      throw new Error(
        `[game-engine] scene "${this.scene.key}" booted without a valid seed — the server's ` +
          'replay can never reproduce an undefined/Date.now() world (GAME_ENGINE.md §5).',
      )
    }
    this.doc = data.document
    this.runId = data.runId
    this.seed = data.seed
    this.maxTicks = data.maxTicks
    this.reducedMotion = data.reducedMotion === true
    this.palette = resolvePalette(data.document.skin.palette)
    this._onSnapshot = data.onSnapshot
    this._onFinish = data.onFinish
    this._onPause = data.onPause
    this._completionFired = false
  }

  preload(): void {
    createParticleTextures(this)
  }

  abstract createBridge(): { bridge: GameEngineBridge<S> }

  /**
   * A mechanic whose authored world (its own `config.field`/`config.map`/equivalent)
   * is a different size than the fixed 800x600 game canvas returns it here; the base
   * class fits the camera to it. Returning `null` (the default) means "my content is
   * already authored at 800x600" and leaves the camera untouched.
   *
   * WHY THIS EXISTS: a real fixture (`sorter`'s tier-3 "arcade" manifest) declares
   * `field: { width: 900, height: 540 }` — wider than the canvas — and with no camera
   * fit, content past x=800 (here, the trash/discard zone) is silently clipped off the
   * right edge on every device, mobile included, regardless of viewport size (verified
   * live). `setZoom` + `centerOn` make the WHOLE authored world visible (letterboxed
   * if the aspect differs) instead of cropped, and because it scales the camera rather
   * than each object, every mechanic's existing draw calls keep using its own field's
   * native coordinates unchanged.
   */
  protected getWorldSize(): { width: number; height: number } | null {
    return null
  }

  create(): void {
    const { bridge } = this.createBridge()
    this.bridge = bridge
    this.bridge.start()

    this.cameras.main.setBackgroundColor(this.palette.bg)

    const world = this.getWorldSize()
    if (world && world.width > 0 && world.height > 0) {
      const zoom = Math.min(this.scale.width / world.width, this.scale.height / world.height)
      this.cameras.main.setZoom(zoom)
      this.cameras.main.centerOn(world.width / 2, world.height / 2)
    }

    this.setupInput()
    this.createGameObjects()
    this.events.on('shutdown', () => this.bridge.stop())

    // Fire the FIRST snapshot unconditionally. The change-gate in update() only calls
    // back when a value differs from `_lastSnapshot` — which starts out equal to a
    // fresh run's actual tick-0 values for most mechanics (score 0, round 0, no
    // finished) — so without this, a consumer (the HUD's starting-lives display, the
    // dev lab's live readout) would see nothing at all until the first real change,
    // which for an arcade-mode mechanic whose true starting `lives` is e.g. 3 means
    // showing no lives count rather than a wrong one.
    const initial = this.bridge.bridgeSnapshot
    this._lastSnapshot = initial
    this._onSnapshot?.(initial)
  }

  update(_time: number, delta: number): void {
    if (this._paused) return

    this.bridge.update(delta)
    this.updateGameObjects(delta)

    const snap = this.bridge.bridgeSnapshot
    if (
      snap.score !== this._lastSnapshot.score ||
      snap.finished !== this._lastSnapshot.finished ||
      snap.lives !== this._lastSnapshot.lives ||
      snap.round !== this._lastSnapshot.round
    ) {
      this._onSnapshot?.(snap)
    }
    this._lastSnapshot = snap

    // A ONE-TIME edge on `finished`, checked independently of the snapshot-changed
    // gate above: a run that reaches its tick ceiling with no same-frame score/lives/
    // round delta must still fire completion exactly once.
    if (snap.finished && !this._completionFired) {
      this._completionFired = true
      this._onFinish?.(this.bridge.finishPayload)
    }
  }

  abstract setupInput(): void
  abstract createGameObjects(): void
  abstract updateGameObjects(delta: number): void

  togglePause(): void {
    if (this._paused) {
      this._paused = false
      this.bridge.resume()
    } else {
      this._paused = true
      this.bridge.pause()
    }
    this._onPause?.()
  }

  get paused(): boolean {
    return this._paused
  }

  get finished(): boolean {
    return this.bridge.finished
  }

  protected makeSprite(x: number, y: number, texture: string, depth = 10): Phaser.GameObjects.Sprite {
    const s = this.add.sprite(x, y, texture)
    s.setDepth(depth)
    return s
  }

  protected makeRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
    alpha = 1,
    depth = 5,
  ): Phaser.GameObjects.Rectangle {
    const r = this.add.rectangle(x, y, width, height, color, alpha)
    r.setDepth(depth)
    return r
  }

  protected makeCircle(x: number, y: number, radius: number, color: number, alpha = 1, depth = 5): Phaser.GameObjects.Arc {
    const c = this.add.circle(x, y, radius, color, alpha)
    c.setDepth(depth)
    return c
  }

  protected makeText(
    x: number,
    y: number,
    text: string,
    size = 16,
    color?: number,
    depth = 20,
  ): Phaser.GameObjects.Text {
    const c = color ?? this.palette.text
    const hex = `#${c.toString(16).padStart(6, '0')}`
    const t = this.add.text(x, y, text, {
      fontFamily: 'Figtree, sans-serif',
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color: hex,
    })
    t.setOrigin(0.5)
    t.setDepth(depth)
    return t
  }
}
