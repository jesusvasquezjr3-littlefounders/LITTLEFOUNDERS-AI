import Phaser from 'phaser'

import type { GameDocument } from '@/game-engine/core/types'

import { resolvePalette, type GamePalette } from './assets'
import { GameEngineBridge, type BridgeFinishPayload, type BridgeSnapshot } from './bridge'
import { createParticleTextures } from './juice'
import {
  createSpriteLoadTracker,
  queueRealSprites,
  resolveBackgroundKey,
  resolveSpriteKey,
  type SpriteLoadTracker,
} from './spriteLoader'

/**
 * The CLOSED set of i18n keys a Phaser scene may read via `this.strings[key]`, each
 * one a bare key under the `games.canvas.*` namespace (e.g. `'sell'` resolves
 * `games.canvas.sell`). Phaser scenes are plain classes with no React context — they
 * cannot call `useTranslation()`/`t()` — so this is the ONLY sanctioned mechanism for
 * a canvas-drawn string to be translated: `PhaserGameBox.tsx` resolves every key in
 * this list through `t()` exactly once (React side, at scene start) and hands the
 * resolved dictionary into `MechanicSceneInit.strings`. A mechanic's `scene.ts` must
 * NEVER hardcode a user-facing string in `makeText`/`setText`/`floatText` — it reads
 * `this.strings['someKey']` instead (falling back only to the key itself, never to a
 * hardcoded English literal, so a missing wire-up is visible instead of silently
 * shipping English).
 *
 * TO ADD A NEW CANVAS STRING: add the English copy under `games.canvas.<name>` in
 * `frontend/src/i18n/en-US/games.json`, add the same key with real translations to
 * `es-MX/games.json` and `pt-BR/games.json` in the SAME commit (§1.8 — no partial
 * locale coverage), then append `'<name>'` to this array. The dictionary is a flat
 * `games.canvas.*` map on purpose — several mechanics reuse the same concept (e.g.
 * "ready", "sell", "rest") under one shared key rather than a mechanic-scoped one, so
 * name each key after its MEANING, not its mechanic.
 */
export const CANVAS_STRING_KEYS = [
  'build', 'test', 'prep', 'ready', 'fight', 'stable', 'defeated', 'victory',
  'waveComplete', 'levelUp', 'unlocked', 'goal', 'faster', 'comboBreak', 'stall',
  'sell', 'help', 'rest', 'trash', 'fire', 'beam',
  'goldLabel', 'gemsLabel', 'waveLabel', 'levelLabel', 'levelUpCost',
  'roundShort', 'roundLabel', 'roundStart', 'incomePreview', 'interestPreview',
  'synergyLabel', 'masteryLabel', 'currencyHere', 'scoreLabel', 'shotsLabel',
  'windLabel', 'comboLabel', 'heightLabel', 'distanceLabel', 'comboMultiplier',
  'speedMultiplier',
  'tapNodeToTake', 'needAbility', 'lockedPrefix', 'pausedLabel', 'hintPrefix',
  // launcher: power/angle/lives readouts, and the translated names behind the ammo
  // rack's and obstacles' abbreviated canvas labels (mechanics/launcher/scene.ts).
  'powerLabel', 'angleLabel', 'livesLabel',
  'ammoStandard', 'ammoHeavy', 'ammoLight', 'ammoGuided', 'ammoExplosive',
  'obstacleSolid', 'obstacleDeflect', 'obstacleAbsorb', 'obstacleBreakable',
  // autobattler: the persistent phase badge (prep/fight already existed), the
  // hearts readout, the refresh button's cost chip, the action-bar's
  // merge/bench/equip verbs, and the shop offer's plain price tag
  // (mechanics/autobattler/scene.ts).
  'combat', 'over', 'healthLabel', 'refreshCost', 'merge', 'toBench', 'equip', 'shopCost',
  // defender: the 8 report archetype names, the 5 switchable target-priority names,
  // the upgrade-branch/tower-info readouts and the voluntary heat-modifier multiplier
  // (mechanics/defender/scene.ts's inspect panel, build palette and heat toggle).
  'archetypeSingle', 'archetypeArea', 'archetypeSlow', 'archetypeDot',
  'archetypeAntiair', 'archetypeAura', 'archetypeEconomy', 'archetypeBlock',
  'priorityFirst', 'priorityLast', 'priorityStrongest', 'priorityWeakest', 'priorityNearest',
  'upgradeBranch', 'towerInfo', 'heatOption',
  // flyer: the lane-shift button's label and the speed (units/tick) HUD readout
  // (mechanics/flyer/scene.ts).
  'lane', 'speedLabel',
] as const

export type CanvasStringKey = (typeof CANVAS_STRING_KEYS)[number]

export interface MechanicSceneInit {
  document: GameDocument
  runId: string
  seed: number
  maxTicks: number
  /** GAME_ENGINE.md §10: disables DECORATIVE effects only — the simulation, scoring
   *  and completion are identical either way. Read by phaser/juice.ts. */
  reducedMotion?: boolean
  /** Every `games.canvas.*` key in `CANVAS_STRING_KEYS`, pre-resolved to the player's
   *  current locale by `PhaserGameBox` (the only place in the tree with `t()`). See
   *  the doc comment on `CANVAS_STRING_KEYS` above for the full contract. */
  strings: Record<string, string>
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
  /** Resolved `games.canvas.*` copy for this run's locale — see `CANVAS_STRING_KEYS`
   *  above. Defaults to `{}` before `init()` runs; a subclass reading a key before
   *  then is a lifecycle bug, not a missing-translation bug. */
  strings: Record<string, string> = {}

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
  /** Tracks which of this run's declared `skin.sprites`/`background_url` real-art
   *  loads failed (see phaser/spriteLoader.ts). One tracker per scene instance. */
  private _spriteTracker: SpriteLoadTracker = createSpriteLoadTracker()

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
    this.strings = data.strings
    this.palette = resolvePalette(data.document.skin.palette)
    this._onSnapshot = data.onSnapshot
    this._onFinish = data.onFinish
    this._onPause = data.onPause
    this._completionFired = false
  }

  preload(): void {
    createParticleTextures(this)
    // GAME_ENGINE.md: skin.sprites/background_url are Prism/Depot real-art URLs the
    // generation pipeline may declare. Queue them here (never in create()) — Phaser
    // does not run create() until this load queue drains, so by the time a mechanic's
    // createGameObjects() calls spriteKeyFor()/backgroundKeyFor() below, every load
    // has already succeeded or failed and there is no "still loading" state to model.
    queueRealSprites(this, this.doc.skin, this._spriteTracker)
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

  /**
   * The seam for real Prism/Depot art (see phaser/spriteLoader.ts). Call from
   * `createGameObjects()` after generating the mechanic's usual procedural
   * placeholder (unconditionally — it's idempotent) to decide which texture key to
   * actually draw:
   *
   *   const fallback = `sorter-item-${entity.uid}`
   *   generatePlaceholderSprite(this, fallback, size, size, tierColor, 'rect', this.palette.text)
   *   const key = this.spriteKeyFor(entity.item.image_slot, fallback)
   *   this.add.image(x, y, key)
   *
   * Returns the real-sprite key if `slot` is bound in `skin.sprites` AND it loaded
   * successfully; otherwise returns `fallbackKey` unchanged. `slot` being `undefined`
   * (no `image_slot` on the item/category) is the normal case, not an error.
   */
  protected spriteKeyFor(slot: string | undefined, fallbackKey: string): string {
    return resolveSpriteKey(this, this._spriteTracker, slot, fallbackKey)
  }

  /** Same decision as `spriteKeyFor`, specialized for `skin.background_url` — pass the
   *  mechanic's own procedurally-generated background key (from `generateBackground`)
   *  as `fallbackKey`. */
  protected backgroundKeyFor(fallbackKey: string): string {
    return resolveBackgroundKey(this, this._spriteTracker, fallbackKey)
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
