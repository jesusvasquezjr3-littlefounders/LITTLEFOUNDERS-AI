import Phaser from 'phaser'

import {
  generateBackground,
  generatePlaceholderSprite,
} from '@/game-engine/phaser/assets'
import { GameEngineBridge } from '@/game-engine/phaser/bridge'
import {
  addFlash,
  addShake,
  floatText,
  scalePunch,
  spawnCollectSparkles,
  spawnExplosion,
  spawnWrongParticles,
} from '@/game-engine/phaser/juice'
import { BaseMechanicScene, type CanvasStringKey } from '@/game-engine/phaser/scene'
import { Sfx } from '@/game-engine/phaser/sfx'

import { flyerConfigSchema, flyerContentSchema } from './schema'
import {
  beamBox,
  clamp,
  flyerSimulator,
  isInStorm,
  isInThermal,
  laneMatches,
  type FlyerEntity,
  type FlyerShot,
  type FlyerState,
} from './simulate'

const BG_KEY = 'flyer-bg'
const CLOUD_PREFIX = 'flyer-cloud-'
const MOUNT_KEY = 'flyer-mount'
const BEAM_COLOR = 0xffdd00

const BG_DEPTH = 0
const CLOUD_DEPTH = 1
const ZONE_DEPTH = 2
const ENTITY_DEPTH = 5
const SHOT_DEPTH = 7
const MOUNT_DEPTH = 10
const BEAM_DEPTH = 9
const HUD_DEPTH = 20
const OVERLAY_DEPTH = 15

// ---- Touch-target floor (CLAUDE.md §1.11: >= 44x44 REAL px for every control,
// including in-canvas ones) --------------------------------------------------------
//
// Phaser draws in DESIGN-SPACE pixels; what actually reaches a child's finger is that
// size run through Phaser.Scale.FIT (PhaserGameBox authors a fixed 800x600 canvas and
// lets FIT scale the whole thing down to whatever the container measures). The worst
// case this platform supports is mobile at 375px wide, with content filling it inside
// DESIGN.md's 16px `margin-mobile` on each side (CLAUDE.md §1.11) — so the container is
// never narrower than 375 - 2*16 = 343px, and the FIT ratio never below 343 / 800. A
// design-space control needs 44 / (343/800) ~= 102.7 design px on a side to still read
// as >=44 real px at that floor; 104 gives a small safety margin. Same derivation and
// constant as `mechanics/stacker/scene.ts`'s `MIN_HIT_DESIGN_PX` (duplicated rather
// than imported — §0/register.ts: zero cross-slice imports between mechanics).
//
// KNOWN SIMPLIFICATION (shared with sorter/stacker, flagged there as a follow-up, not
// re-solved per-mechanic here): this assumes the scene's own camera zoom is 1. Flyer's
// `getWorldSize()` below fits the camera to `config.world`, which can be LARGER than
// the 800x600 canvas — a manifest that does zooms every draw call down further, buttons
// included. Both shipped fixtures (fixtures.ts: 900x540 and 960x560) sit close enough
// to the canvas's own 4:3 aspect that the zoom stays near 0.83-0.89, not far off 1, so
// 104 is a reasonable floor for the documents this engine ships today.
// Exported so flyer.test.ts can assert the real button-layout math against the
// documented 44-real-px requirement and the getWorldSize() bounds without re-deriving
// (and risking silently diverging from) the same constants scene.ts draws with.
export const MIN_TOUCH_DESIGN_PX = 104
export const CONTROL_MARGIN = 16
export const CONTROL_GAP = 12

interface EntityView {
  entity: FlyerEntity
  sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle
}

interface ShotView {
  shot: FlyerShot
  sprite: Phaser.GameObjects.Image
}

export class FlyerScene extends BaseMechanicScene<FlyerState> {
  private mount: Phaser.GameObjects.Container | null = null
  private mountBody: Phaser.GameObjects.Rectangle | null = null
  private mountTrail: Phaser.GameObjects.Particles.ParticleEmitter | null = null
  private beamGfx: Phaser.GameObjects.Graphics | null = null
  private entityViews: Map<number, EntityView> = new Map()
  private shotViews: Map<number, ShotView> = new Map()

  private energyBarBg: Phaser.GameObjects.Rectangle | null = null
  private energyBarFill: Phaser.GameObjects.Rectangle | null = null
  private energyText: Phaser.GameObjects.Text | null = null
  private scoreText: Phaser.GameObjects.Text | null = null
  private distanceText: Phaser.GameObjects.Text | null = null
  private livesText: Phaser.GameObjects.Text | null = null
  private comboText: Phaser.GameObjects.Text | null = null
  private speedText: Phaser.GameObjects.Text | null = null
  private stallWarning: Phaser.GameObjects.Text | null = null
  private fireBtn: Phaser.GameObjects.Container | null = null
  private beamBtn: Phaser.GameObjects.Container | null = null
  private laneBtn: Phaser.GameObjects.Container | null = null
  private laneDots: Phaser.GameObjects.Arc[] = []

  private stormOverlay: Phaser.GameObjects.Rectangle | null = null

  private lastScore = 0
  private lastCombo = 0
  private lastCollected = 0
  private lastHits = 0
  private lastStalls = 0
  private lastEnemiesDowned = 0
  private lastReach = 0

  private cloudSprites: Array<{ sprite: Phaser.GameObjects.Image; speed: number }> = []

  constructor() {
    super('flyer')
  }

  createBridge(): { bridge: GameEngineBridge<FlyerState>; simInit: import('@/game-engine/core/types').SimInit } {
    const configParse = flyerConfigSchema.safeParse(this.doc.config)
    const contentParse = flyerContentSchema.safeParse(this.doc.content)
    if (!configParse.success || !contentParse.success) throw new Error('Invalid flyer document')
    const simInit = {
      config: configParse.data,
      content: contentParse.data,
      scoring: this.doc.scoring,
      seed: this.seed,
    }
    return {
      bridge: new GameEngineBridge(flyerSimulator, simInit, this.maxTicks),
      simInit,
    }
  }

  /** `config.world` is authored per-manifest (200-2000 x 120-1200 per schema.ts) and can
   *  legitimately differ from the fixed 800x600 canvas — both shipped fixtures author
   *  900x540 and 960x560. Without this, on-canvas controls positioned in world-space
   *  (below, `createControls`) render outside the visible 800x600 viewport whenever a
   *  manifest's world isn't exactly canvas-sized (the confirmed audit finding: fire/beam
   *  rendered off-canvas on some layouts). Same pattern as sorter/stacker/explorer
   *  (695891c): read off the bridge's already-Zod-parsed state, so no cast is needed.
   */
  protected override getWorldSize(): { width: number; height: number } {
    const { world } = this.bridge.state.config
    return { width: world.width, height: world.height }
  }

  /** Resolves a `games.canvas.*` key from `this.strings`, falling back to the bare key
   *  (never a hardcoded English literal) so a missing wire-up is visible instead of
   *  silently English — same contract as `phaser/scene.ts`'s `CANVAS_STRING_KEYS` doc
   *  comment and the same helper shape `explorer/scene.ts` already uses. */
  private str(key: CanvasStringKey): string {
    return this.strings[key] ?? key
  }

  /** Interpolates a `games.canvas.*` template's `{{var}}` placeholders — `PhaserGameBox`
   *  resolves every key via a bare `t(key)` with no interpolation options, so the
   *  template survives into `this.strings` verbatim for the scene to fill in itself. */
  private strFmt(key: CanvasStringKey, vars: Record<string, string | number>): string {
    const template = this.str(key)
    return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(vars[name] ?? ''))
  }

  createGameObjects(): void {
    const { config } = this.bridge.state
    const { world } = config
    const p = this.palette

    generateBackground(this, BG_KEY, world.width, world.height, p)
    this.add.image(world.width / 2, world.height / 2, BG_KEY).setDepth(BG_DEPTH)

    generatePlaceholderSprite(this, CLOUD_PREFIX + '0', 60, 20, p.inverse, 'circle')
    for (let i = 0; i < 8; i += 1) {
      const k = this.textures.exists(CLOUD_PREFIX + '0') ? CLOUD_PREFIX + '0' : 'px-circle-white'
      const cloud = this.add.image(
        Math.random() * world.width,
        Math.random() * world.height * 0.6 + 40,
        k,
      )
      cloud.setAlpha(0.12 + Math.random() * 0.08)
      cloud.setDepth(CLOUD_DEPTH)
      cloud.setScale(0.5 + Math.random() * 1.5)
      this.cloudSprites.push({ sprite: cloud, speed: 0.03 + Math.random() * 0.06 })
    }

    generatePlaceholderSprite(this, MOUNT_KEY, world.mount_w, world.mount_h, p.accent, 'diamond', p.inverse)
    this.mount = this.add.container(world.avatar_x + world.mount_w / 2, 0)
    this.mount.setDepth(MOUNT_DEPTH)
    this.mountBody = this.makeRect(0, 0, world.mount_w, world.mount_h, p.accent, 1, MOUNT_DEPTH)
    this.mount.add(this.mountBody)

    if (this.textures.exists('px-circle-white')) {
      this.mountTrail = this.add.particles(0, 0, 'px-circle-white', {
        follow: this.mount,
        followOffset: { x: -world.mount_w / 2, y: 0 },
        speed: { min: 5, max: 25 },
        scale: { start: 0.4, end: 0 },
        alpha: { start: 0.5, end: 0 },
        lifespan: 250,
        frequency: 60,
        quantity: 1,
        tint: p.accent,
      })
      this.mountTrail.setDepth(MOUNT_DEPTH - 1)
    }

    this.beamGfx = this.add.graphics().setDepth(BEAM_DEPTH)

    this.stormOverlay = this.makeRect(world.width / 2, world.height / 2, world.width, world.height, 0x000000, 0)
    this.stormOverlay.setDepth(OVERLAY_DEPTH)

    this.scoreText = this.makeText(80, 28, '0', 18, p.text, HUD_DEPTH).setOrigin(0, 0.5)
    this.distanceText = this.makeText(world.width - 80, 28, this.strFmt('distanceLabel', { value: 0 }), 16, p.text, HUD_DEPTH).setOrigin(1, 0.5)
    this.comboText = this.makeText(world.width / 2, 28, '', 16, p.accent, HUD_DEPTH)
    this.speedText = this.makeText(world.width - 80, 50, '', 12, p.primary, HUD_DEPTH).setOrigin(1, 0.5)

    this.energyBarBg = this.makeRect(18, world.height - 28, 140, 14, p.surface, 0.6, HUD_DEPTH).setOrigin(0, 0.5)
    this.energyBarFill = this.makeRect(18, world.height - 28, 140, 14, p.success, 1, HUD_DEPTH + 1).setOrigin(0, 0.5)
    this.energyText = this.makeText(18 + 70, world.height - 28, '', 11, p.text, HUD_DEPTH + 2)

    const snap = this.bridge.snapshot
    if (snap.lives !== null && snap.lives !== undefined) {
      this.livesText = this.makeText(world.width / 2, 50, '', 14, p.danger, HUD_DEPTH)
    }

    this.stallWarning = this.makeText(world.width / 2, world.height / 2 - 60, '', 28, 0xff4444, HUD_DEPTH + 5).setAlpha(0)

    this.createControls(world)
  }

  /** Every button below is sized `MIN_TOUCH_DESIGN_PX` and positioned from `world.width`/
   *  `world.height` — the SAME coordinate space `getWorldSize()` fits the camera to, so a
   *  button at (say) `world.width - CONTROL_MARGIN - size/2` lands at the visible
   *  viewport's own right edge (minus the margin) regardless of what a manifest's
   *  `config.world` authors, instead of the fixed-800x600 assumption that clipped it off
   *  the real canvas whenever a manifest's world wasn't exactly canvas-sized. */
  private createControls(world: FlyerState['config']['world']): void {
    const p = this.palette
    const size = MIN_TOUCH_DESIGN_PX

    const fireX = world.width - CONTROL_MARGIN - size / 2
    const fireY = world.height - CONTROL_MARGIN - size / 2
    generatePlaceholderSprite(this, 'fire-btn', size, size, p.accent, 'circle', p.text)
    this.fireBtn = this.add.container(fireX, fireY)
    this.fireBtn.setDepth(HUD_DEPTH)
    const fireImg = this.add.image(0, 0, 'fire-btn').setInteractive({ useHandCursor: true })
    const fireLabel = this.makeText(0, 0, this.str('fire'), 12, p.inverse, HUD_DEPTH + 1)
    this.fireBtn.add([fireImg, fireLabel])
    this.fireBtn.setSize(size, size)
    this.fireBtn.setInteractive(
      new Phaser.Geom.Rectangle(-size / 2, -size / 2, size, size),
      Phaser.Geom.Rectangle.Contains,
    )
    this.fireBtn.on('pointerdown', () => {
      if (this.paused || this.finished) return
      this.bridge.enqueue('fire')
    })

    const beamX = fireX
    const beamY = fireY - size - CONTROL_GAP
    generatePlaceholderSprite(this, 'beam-btn', size, size, 0xffdd00, 'circle', p.text)
    this.beamBtn = this.add.container(beamX, beamY)
    this.beamBtn.setDepth(HUD_DEPTH)
    const beamImg = this.add.image(0, 0, 'beam-btn').setInteractive({ useHandCursor: true })
    const beamLabel = this.makeText(0, 0, this.str('beam'), 11, 0x000000, HUD_DEPTH + 1)
    this.beamBtn.add([beamImg, beamLabel])
    this.beamBtn.setSize(size, size)
    this.beamBtn.setInteractive(
      new Phaser.Geom.Rectangle(-size / 2, -size / 2, size, size),
      Phaser.Geom.Rectangle.Contains,
    )
    this.beamBtn.on('pointerdown', () => {
      if (this.paused || this.finished) return
      if (this.bridge.state.beamOn) {
        this.bridge.enqueue('beam_end')
      } else {
        this.bridge.enqueue('beam_start')
      }
    })

    // The lane-shift control (GAME_ENGINE.md §4's flight-model `lanes` block): the
    // simulator already declares `lane` in FLYER_ACTIONS and handles it unconditionally
    // (a no-op when `config.lanes.enabled` is false — "an inert but VALID action", per
    // `simulate.ts`'s own comment on the handler), the same always-shown-even-if-inert
    // convention `fire`/`beam` above already use when their own config disables them. A
    // bare `enqueue('lane')` (no `n`) steps to the next lane and wraps, so one button
    // reaches every lane with repeated taps — no drag, no second control needed.
    const laneX = beamX
    const laneY = beamY - size - CONTROL_GAP
    generatePlaceholderSprite(this, 'lane-btn', size, size, p.primary, 'diamond', p.text)
    this.laneBtn = this.add.container(laneX, laneY)
    this.laneBtn.setDepth(HUD_DEPTH)
    const laneImg = this.add.image(0, 0, 'lane-btn').setInteractive({ useHandCursor: true })
    const laneLabel = this.makeText(0, 0, this.str('lane'), 11, p.inverse, HUD_DEPTH + 1)
    this.laneBtn.add([laneImg, laneLabel])
    this.laneBtn.setSize(size, size)
    this.laneBtn.setInteractive(
      new Phaser.Geom.Rectangle(-size / 2, -size / 2, size, size),
      Phaser.Geom.Rectangle.Contains,
    )
    this.laneBtn.on('pointerdown', () => {
      if (this.paused || this.finished) return
      this.bridge.enqueue('lane')
    })

    this.createLaneDots()
  }

  /** A small non-interactive readout of "which lane is the mount in, out of how many" —
   *  needs no i18n (it draws no text, only palette-coloured dots), and gives the newly
   *  reachable `lane` action a visible effect beyond the hit-testing `laneMatches`
   *  already gates silently. Rebuilt once at create time; `count` is fixed for the run
   *  (schema: `lanes.count` is not a live-tunable field), so `updateGameObjects` only
   *  ever needs to re-tint, never re-lay-out, these. Positioned off `laneBtn.x`/`.y`
   *  (already computed in `createControls`), so it needs no `world` of its own. */
  private createLaneDots(): void {
    const { lanes } = this.bridge.state.config
    if (!lanes.enabled || lanes.count < 2 || this.laneBtn === null) return

    const dotRadius = 4
    const dotGap = 12
    const totalWidth = (lanes.count - 1) * dotGap
    const startX = this.laneBtn.x - totalWidth / 2
    const y = this.laneBtn.y - MIN_TOUCH_DESIGN_PX / 2 - 10

    for (let i = 0; i < lanes.count; i += 1) {
      const dot = this.makeCircle(startX + i * dotGap, y, dotRadius, this.palette.surface, 1, HUD_DEPTH + 1)
      this.laneDots.push(dot)
    }
  }

  setupInput(): void {
    const { config } = this.bridge.state
    const world = config.world
    const midY = world.height / 2

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.paused || this.finished) return

      // `worldX`/`worldY` (not `x`/`y`): flyer's `getWorldSize()` (see the fix in this
      // same task) zooms the camera for any manifest whose `world` differs from
      // 800x600, and both the buttons' `getBounds()` and `midY` are WORLD coordinates
      // — Phaser's own InputManager already writes the correct
      // `camera.getWorldPoint()` result into `pointer.worldX/worldY` before this
      // listener runs. Raw `x`/`y` are pre-zoom canvas coordinates and silently miss
      // every control/lane split once the camera isn't at zoom 1.
      if (this.fireBtn?.getBounds().contains(pointer.worldX, pointer.worldY)) return
      if (this.beamBtn?.getBounds().contains(pointer.worldX, pointer.worldY)) return
      if (this.laneBtn?.getBounds().contains(pointer.worldX, pointer.worldY)) return

      if (pointer.worldY < midY) {
        this.bridge.enqueue('climb')
        Sfx.pop()
      } else {
        this.bridge.enqueue('dive')
        Sfx.pop()
      }
    })

    // Guarded against paused/finished on every branch (BUGFIX while verifying keyboard
    // access still works, per the task brief: only the pointerdown handler above and
    // the beam toggle below used to check this, so UP/DOWN/SPACE kept commanding the
    // sim through a pause — the same class of bug `Sfx.pop()`'s pointer path never had).
    this.input.keyboard?.on('keydown-UP', () => {
      if (this.paused || this.finished) return
      this.bridge.enqueue('climb')
    })
    this.input.keyboard?.on('keydown-DOWN', () => {
      if (this.paused || this.finished) return
      this.bridge.enqueue('dive')
    })
    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.paused || this.finished) return
      this.bridge.enqueue('fire')
    })
    this.input.keyboard?.on('keydown-B', () => {
      if (this.paused || this.finished) return
      if (this.bridge.state.beamOn) {
        this.bridge.enqueue('beam_end')
      } else {
        this.bridge.enqueue('beam_start')
      }
    })
    // The lane-shift action's keyboard path (CLAUDE.md §1.11) — `L` mirrors the pointer
    // button's bare `enqueue('lane')`, stepping to the next lane and wrapping.
    this.input.keyboard?.on('keydown-L', () => {
      if (this.paused || this.finished) return
      this.bridge.enqueue('lane')
    })
  }

  updateGameObjects(_delta: number): void {
    const state = this.bridge.state
    const world = state.config.world

    this.updateClouds(state)
    this.updateMount(state)
    this.updateEntities(state)
    this.updateShots(state)
    this.updateBeam(state)
    this.updateEnvironment(state)
    this.updateHUD(state)
    this.updateControls(state)

    if (state.collected !== this.lastCollected && state.collected > this.lastCollected) {
      Sfx.collect()
      if (this.mount) spawnCollectSparkles(this, this.mount.x, this.mount.y)
      if (this.mount) scalePunch(this, this.mount, 1.12, 150)
    }
    if (state.combo !== this.lastCombo && state.combo > this.lastCombo && state.combo % 3 === 0) {
      Sfx.combo()
      floatText(this, world.width / 2, 100, this.strFmt('comboMultiplier', { count: state.combo }), '#ffd700', 600)
    }
    if (state.hits !== this.lastHits && state.hits > this.lastHits) {
      this.onHit()
    }
    if (state.enemiesDowned !== this.lastEnemiesDowned && state.enemiesDowned > this.lastEnemiesDowned) {
      Sfx.explosion()
      spawnExplosion(this, world.width * 0.7, world.height / 2)
    }
    if (state.stalls !== this.lastStalls && state.stalls > this.lastStalls) {
      Sfx.wrong()
      addShake(this, 'heavy')
      addFlash(this, 0xff2222, 150)
    }

    const mileStonePrev = Math.floor(this.lastReach / 500)
    const mileStoneCurr = Math.floor(state.reach / 500)
    if (mileStoneCurr > mileStonePrev) {
      Sfx.levelUp()
      floatText(
        this,
        world.width / 2,
        world.height / 3,
        this.strFmt('distanceLabel', { value: mileStoneCurr * 500 }),
        '#22c55e',
        1200,
      )
    }

    this.lastScore = this.bridge.snapshot.score
    this.lastCombo = state.combo
    this.lastCollected = state.collected
    this.lastHits = state.hits
    this.lastStalls = state.stalls
    this.lastEnemiesDowned = state.enemiesDowned
    this.lastReach = state.reach
  }

  private updateClouds(state: FlyerState): void {
    const world = state.config.world
    for (const cloud of this.cloudSprites) {
      cloud.sprite.x -= cloud.speed * state.speed
      if (cloud.sprite.x < -30) {
        cloud.sprite.x = world.width + 30
        cloud.sprite.y = Math.random() * world.ceiling_y * 0.8 + 20
      }
    }
  }

  private updateMount(state: FlyerState): void {
    if (!this.mount || !this.mountBody) return
    const world = state.config.world

    const mx = world.avatar_x + world.mount_w / 2
    const my = state.altitude + world.mount_h / 2

    this.mount.x = mx
    this.mount.y = my

    const pitchRad = Phaser.Math.DegToRad(state.pitch)
    this.mount.rotation = -pitchRad

    const inThermal = isInThermal(state)
    if (inThermal && this.mountTrail) {
      if (!this.mountTrail.on) this.mountTrail.start()
      this.mountTrail.setParticleTint(this.palette.success)
    } else if (this.mountTrail) {
      this.mountTrail.setParticleTint(this.palette.accent)
    }

    this.mountBody.setFillStyle(state.stalled ? 0xff4444 : this.palette.accent)

    if (state.stalled) {
      this.stallWarning?.setText(this.str('stall')).setAlpha(
        0.5 + Math.sin(this.time.now * 0.01) * 0.5,
      )
    } else {
      this.stallWarning?.setAlpha(0)
    }

    if (state.graceUntil > state.tick && state.graceUntil > 0) {
      this.mount.setAlpha(0.4 + Math.sin(this.time.now * 0.02) * 0.3)
    } else {
      this.mount.setAlpha(1)
    }
  }

  private updateEntities(state: FlyerState): void {
    const world = state.config.world
    const currentKeys = new Set(state.entities.map((e) => e.key))

    for (const [key, view] of this.entityViews) {
      if (!currentKeys.has(key)) {
        view.sprite.destroy()
        this.entityViews.delete(key)
      }
    }

    for (const entity of state.entities) {
      let view = this.entityViews.get(entity.key)
      const screenX = entity.x - state.distance

      if (screenX > world.width + 200 || screenX < -200) {
        if (view) {
          view.sprite.destroy()
          this.entityViews.delete(entity.key)
        }
        continue
      }

      if (view === undefined) {
        const sprite = this.makeEntitySprite(entity, screenX, state)
        if (sprite === null) continue
        view = { entity, sprite }
        this.entityViews.set(entity.key, view)
      } else {
        const prevState = this.bridge.prevState
        const prevEnt = prevState?.entities.find((pe) => pe.key === entity.key)
        const prevX = prevEnt ? prevEnt.x - (prevState?.distance ?? state.distance) : entity.x - state.distance
        const curX = entity.x - state.distance

        view.sprite.x = Phaser.Math.Linear(prevX, curX, this.bridge.alpha)
        view.sprite.y = entity.y + entity.h / 2
        view.sprite.setAlpha(this.baseAlphaFor(entity) * this.laneDimFor(entity, state))
        view.entity = entity
      }
    }
  }

  /** Entities the sim actually collision-gates by lane (everything except the
   *  non-lane-gated `thermal`/`storm` zones — `simulate.ts`'s hit-test skips the
   *  `laneMatches` check for those two roles entirely, before it ever runs). Dimming
   *  an off-lane entity is the only visual signal the newly-reachable `lane` action
   *  gets today: without it, a child who taps LANE sees the dot indicator move but
   *  nothing about the sky itself explains why an obstacle stopped hurting them. */
  private laneDimFor(entity: FlyerEntity, state: FlyerState): number {
    if (entity.role === 'thermal' || entity.role === 'storm') return 1
    return laneMatches(state, entity.lane) ? 1 : 0.35
  }

  private baseAlphaFor(entity: FlyerEntity): number {
    switch (entity.role) {
      case 'enemy':
        return entity.enemyTypeId !== null && entity.enemyTypeId !== undefined ? 0.9 : 0.8
      case 'thermal':
        return 0.2
      case 'storm':
        return 0.3
      default:
        return 1
    }
  }

  private makeEntitySprite(
    entity: FlyerEntity,
    screenX: number,
    state: FlyerState,
  ): Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle | null {
    let color: number
    let shape: 'rect' | 'circle' | 'diamond' = 'rect'
    let depth = ENTITY_DEPTH
    const alpha = this.baseAlphaFor(entity) * this.laneDimFor(entity, state)

    switch (entity.role) {
      case 'good':
        color = this.palette.success
        shape = 'circle'
        depth = ENTITY_DEPTH + 1
        break
      case 'bad':
        color = this.palette.warning
        shape = 'diamond'
        break
      case 'obstacle':
        color = this.palette.danger
        shape = 'rect'
        break
      case 'enemy': {
        const isBoss = entity.enemyTypeId !== null && entity.enemyTypeId !== undefined
        color = isBoss ? 0xff00ff : 0xcc44cc
        shape = 'diamond'
        break
      }
      case 'thermal':
        color = this.palette.success
        shape = 'rect'
        depth = ZONE_DEPTH
        break
      case 'storm':
        color = 0x222244
        shape = 'rect'
        depth = ZONE_DEPTH
        break
      default:
        return null
    }

    const key = `flyer-ent-${entity.key}`
    generatePlaceholderSprite(this, key, entity.w, entity.h, color, shape, this.palette.text)

    const sprite = this.add.image(screenX, entity.y + entity.h / 2, key)
    sprite.setDepth(depth)
    sprite.setAlpha(alpha)
    return sprite
  }

  private updateShots(state: FlyerState): void {
    const world = state.config.world
    const currentKeys = new Set(state.shots.map((s) => s.key))

    for (const [key, view] of this.shotViews) {
      if (!currentKeys.has(key)) {
        view.sprite.destroy()
        this.shotViews.delete(key)
      }
    }

    for (const shot of state.shots) {
      let view = this.shotViews.get(shot.key)
      const screenX = shot.x - state.distance

      // BUGFIX (found while wiring `getWorldSize()`): culling against the fixed
      // `this.scale.width` (800) instead of `world.width` — the SAME world-space a
      // shot's `screenX` is already expressed in — hid shots early on both shipped
      // fixtures (900/960 wide): a shot at x=850 is still visible in the camera-fitted
      // viewport once `world.width` > 800, but the old check culled it at 800 anyway.
      // `updateEntities` above already used `world.width` for this exact reason.
      if (screenX > world.width + 100 || screenX < -200) {
        if (view) {
          view.sprite.destroy()
          this.shotViews.delete(shot.key)
        }
        continue
      }

      if (view === undefined) {
        const key = `flyer-shot-${shot.key}`
        generatePlaceholderSprite(
          this,
          key,
          shot.w,
          shot.h,
          shot.fromMount ? this.palette.accent : 0xff4444,
          'circle',
          this.palette.text,
        )
        const sprite = this.add.image(screenX, shot.y + shot.h / 2, key).setDepth(SHOT_DEPTH)
        const shotView: ShotView = { shot, sprite }
        this.shotViews.set(shot.key, shotView)
        view = shotView
      } else {
        view.sprite.x = screenX
        view.sprite.y = shot.y + shot.h / 2
        view.shot = shot
      }
    }
  }

  private updateBeam(state: FlyerState): void {
    if (!this.beamGfx) return
    this.beamGfx.clear()

    if (!state.beamOn) return

    const box = beamBox(state)
    const screenX = box.x - state.distance

    // Same BUGFIX as `updateShots` above: cull against `world.width`, not the fixed
    // canvas resolution, or the beam stops drawing before the visible right edge on
    // any manifest whose world is wider than 800.
    if (screenX + box.w < 0 || screenX > state.config.world.width) return

    this.beamGfx.setDepth(BEAM_DEPTH)
    this.beamGfx.setAlpha(0.3)
    this.beamGfx.fillStyle(BEAM_COLOR, 1)
    this.beamGfx.fillRect(screenX, box.y, box.w, box.h)

    this.beamGfx.lineStyle(2, BEAM_COLOR, 0.8)
    this.beamGfx.strokeRect(screenX, box.y, box.w, box.h)
  }

  private updateEnvironment(state: FlyerState): void {
    const inStorm = isInStorm(state)
    const { config } = state
    const stormCfg = config.environment.storm

    if (inStorm && this.stormOverlay) {
      const targetAlpha = 1 - stormCfg.visibility_pct / 100
      this.stormOverlay.setAlpha(
        Phaser.Math.Linear(this.stormOverlay.alpha, targetAlpha, 0.1),
      )
    } else if (this.stormOverlay) {
      this.stormOverlay.setAlpha(
        Phaser.Math.Linear(this.stormOverlay.alpha, 0, 0.15),
      )
    }
  }

  private updateHUD(state: FlyerState): void {
    const snap = this.bridge.snapshot

    if (this.scoreText) this.scoreText.setText(`${Math.round(snap.score)}`)
    if (this.distanceText) {
      this.distanceText.setText(this.strFmt('distanceLabel', { value: Math.floor(state.reach) }))
    }
    if (this.comboText) {
      this.comboText.setText(state.combo > 1 ? this.strFmt('comboMultiplier', { count: state.combo }) : '')
      this.comboText.setAlpha(state.combo > 1 ? 1 : 0)
    }
    if (this.livesText) {
      this.livesText.setText(state.lives !== null ? `${'\u2665'} ${state.lives}` : '')
    }
    if (this.speedText) {
      this.speedText.setText(this.strFmt('speedLabel', { value: state.speed.toFixed(1) }))
    }

    const capacity = state.config.energy.capacity + state.config.upgrades.energy_capacity_bonus
    const ratio = clamp(state.energy / capacity, 0, 1)

    if (this.energyBarFill && this.energyBarBg) {
      this.energyBarFill.width = 140 * ratio

      if (ratio < 0.2) {
        this.energyBarFill.setFillStyle(0xef4444)
      } else if (ratio < 0.5) {
        this.energyBarFill.setFillStyle(0xf59e0b)
      } else {
        this.energyBarFill.setFillStyle(0x22c55e)
      }
    }
    if (this.energyText) {
      this.energyText.setText(`${Math.round(state.energy)}/${Math.round(capacity)}`)
    }
  }

  private updateControls(state: FlyerState): void {
    if (this.beamBtn) {
      const beamImg = this.beamBtn.getAt(0) as Phaser.GameObjects.Image | undefined
      if (beamImg && state.beamOn) {
        beamImg.setTint(0x00ff00)
      } else if (beamImg) {
        beamImg.clearTint()
      }
    }

    // Highlights the dot matching `laneTarget` (the commanded lane, not the still-
    // interpolating `lanePos`) so a tap registers its effect on the very next frame
    // rather than waiting out `lanes.shift_ticks`' visual travel.
    const activeIndex = Math.round(state.laneTarget)
    for (let i = 0; i < this.laneDots.length; i += 1) {
      const dot = this.laneDots[i]
      if (dot === undefined) continue
      dot.setFillStyle(i === activeIndex ? this.palette.accent : this.palette.surface)
    }
  }

  private onHit(): void {
    Sfx.hit()
    addShake(this, 'medium')
    addFlash(this, 0xff4444, 80)
    if (this.mount) spawnWrongParticles(this, this.mount.x, this.mount.y)
  }
}

export default FlyerScene
