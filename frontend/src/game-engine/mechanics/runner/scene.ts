import Phaser from 'phaser'

import type { MechanicSceneInit } from '@/game-engine/phaser/scene'

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
  spawnConfetti,
  spawnWrongParticles,
} from '@/game-engine/phaser/juice'
import { BaseMechanicScene } from '@/game-engine/phaser/scene'
import { Sfx } from '@/game-engine/phaser/sfx'

import { runnerConfigSchema, runnerContentSchema } from './schema'
import {
  avatarTopY,
  entityTopY,
  isEntityArmed,
  phaseIndexAt,
  runnerSimulator,
  speedAt,
  type RunnerEntity,
  type RunnerState,
} from './simulate'

const BG_LAYER_0 = 'runner-bg-0'
const BG_LAYER_1 = 'runner-bg-1'
const BG_LAYER_2 = 'runner-bg-2'
const GROUND_KEY = 'runner-ground'
const AVATAR_KEY = 'runner-avatar'
const BG_DEPTH = 0
const OBSTACLE_DEPTH = 5
const ITEM_DEPTH = 8
const AVATAR_DEPTH = 15
const HUD_DEPTH = 20

interface EntityView {
  entity: RunnerEntity
  sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle
}

export class RunnerScene extends BaseMechanicScene<RunnerState> {
  private bgLayers: Array<{ img: Phaser.GameObjects.Image; speed: number }> = []
  private ground: Phaser.GameObjects.Image | null = null
  private avatar: Phaser.GameObjects.Container | null = null
  private avatarBody: Phaser.GameObjects.Rectangle | null = null
  private avatarTrail: Phaser.GameObjects.Particles.ParticleEmitter | null = null
  private entityViews: Map<number, EntityView> = new Map()

  private distanceText: Phaser.GameObjects.Text | null = null
  private scoreText: Phaser.GameObjects.Text | null = null
  private livesText: Phaser.GameObjects.Text | null = null
  private comboText: Phaser.GameObjects.Text | null = null
  private speedText: Phaser.GameObjects.Text | null = null

  private lastScore = 0
  private lastCombo = 0
  private lastCrashes = 0
  private lastCollected = 0
  private holding = false
  private lastPhaseIdx = 0
  private _seed = 0

  constructor() {
    super('runner')
  }

  init(data: MechanicSceneInit): void {
    super.init(data)
    this._seed = data.seed
  }

  createBridge(): { bridge: GameEngineBridge<RunnerState>; simInit: import('@/game-engine/core/types').SimInit } {
    const configParse = runnerConfigSchema.safeParse(this.doc.config)
    const contentParse = runnerContentSchema.safeParse(this.doc.content)
    if (!configParse.success || !contentParse.success) throw new Error('Invalid runner document')
    const simInit = {
      config: configParse.data,
      content: contentParse.data,
      scoring: this.doc.scoring,
      seed: this._seed,
    }
    return {
      bridge: new GameEngineBridge(runnerSimulator, simInit),
      simInit,
    }
  }

  createGameObjects(): void {
    const { config } = this.bridge.state
    const { world } = config

    const p = this.palette
    const darker = Phaser.Display.Color.ValueToColor(p.bg).darken(30).color

    generateBackground(this, BG_LAYER_0, world.width, world.height, { ...p, bg: darker, bgAccent: p.bg })
    generateBackground(this, BG_LAYER_1, world.width * 2, world.height, { ...p, bg: p.bg, bgAccent: p.surface })
    generateBackground(this, BG_LAYER_2, world.width * 3, world.height, { ...p, bg: p.surface, bgAccent: p.primary })

    this.bgLayers = [
      { img: this.add.image(world.width / 2, world.height / 2, BG_LAYER_0).setDepth(BG_DEPTH), speed: 0.05 },
      { img: this.add.image(world.width / 2, world.height / 2, BG_LAYER_1).setDepth(BG_DEPTH + 0.1), speed: 0.2 },
      { img: this.add.image(world.width / 2, world.height / 2, BG_LAYER_2).setDepth(BG_DEPTH + 0.2), speed: 0.4 },
    ]

    generatePlaceholderSprite(
      this,
      GROUND_KEY,
      world.width * 3,
      16,
      p.primary,
      'rect',
      p.text,
    )
    this.ground = this.add.image(world.width / 2, world.ground_y + 8, GROUND_KEY).setDepth(3)

    generatePlaceholderSprite(this, AVATAR_KEY, world.avatar_w, world.avatar_h, p.accent, 'rect', p.inverse)
    this.avatar = this.add.container(world.avatar_x + world.avatar_w / 2, world.ground_y - world.avatar_h / 2)
    this.avatar.setDepth(AVATAR_DEPTH)
    this.avatarBody = this.makeRect(0, 0, world.avatar_w, world.avatar_h, p.accent, 1, AVATAR_DEPTH)
    this.avatar.add(this.avatarBody)

    if (this.textures.exists('px-circle-white')) {
      this.avatarTrail = this.add.particles(0, 0, 'px-circle-white', {
        follow: this.avatar,
        followOffset: { x: -world.avatar_w / 2, y: 0 },
        speed: { min: 5, max: 30 },
        scale: { start: 0.5, end: 0 },
        alpha: { start: 0.6, end: 0 },
        lifespan: 300,
        frequency: 50,
        quantity: 1,
        tint: p.accent,
      })
      this.avatarTrail.setDepth(AVATAR_DEPTH - 1)
      this.avatarTrail.stop()
    }

    this.distanceText = this.makeText(world.width - 80, 36, '0m', 18, p.text, HUD_DEPTH).setOrigin(1, 0.5)
    this.scoreText = this.makeText(80, 36, '0', 20, p.text, HUD_DEPTH).setOrigin(0, 0.5)
    this.comboText = this.makeText(world.width / 2, 36, '', 16, p.accent, HUD_DEPTH)
    this.speedText = this.makeText(world.width - 80, 60, '', 12, p.primary, HUD_DEPTH).setOrigin(1, 0.5)

    const snap = this.bridge.snapshot
    if (snap.lives !== null && snap.lives !== undefined) {
      this.livesText = this.makeText(world.width / 2, 36, '', 18, p.danger, HUD_DEPTH)
    }
  }

  setupInput(): void {
    this.input.on('pointerdown', () => {
      if (this.paused || this.finished) return
      this.bridge.enqueue('act')
      this.holding = true
      Sfx.pop()
    })

    this.input.on('pointerup', () => {
      if (!this.holding) return
      this.holding = false
      this.bridge.enqueue('hold_end')
    })
  }

  updateGameObjects(_delta: number): void {
    const state = this.bridge.state
    const { config } = state
    const world = config.world
    const alpha = this.bridge.alpha
    const speed = speedAt(config, state.tick)

    this.updateParallax(state, alpha, speed)
    this.updateAvatar(state, alpha)
    this.updateEntities(state, alpha)
    this.updateHUD(state)

    if (state.crashes !== this.lastCrashes && state.crashes > this.lastCrashes) {
      this.onCrash()
    }
    if (state.collected !== this.lastCollected && state.collected > this.lastCollected) {
      this.onCollect()
    }
    if (state.combo !== this.lastCombo && state.combo > this.lastCombo && state.combo % 3 === 0) {
      Sfx.combo()
      floatText(this, world.avatar_x + world.avatar_w / 2, world.ground_y - 80, `${state.combo}x`, '#ffd700', 600)
    }
    if (state.combo < this.lastCombo) {
      this.onComboBreak()
    }
    const phaseIdx = phaseIndexAt(config, state.tick)
    if (phaseIdx > this.lastPhaseIdx) {
      Sfx.levelUp()
      floatText(this, world.width / 2, world.height / 2, 'Faster!', '#22c55e', 1200)
      spawnConfetti(this, world.width / 2, world.height / 3, 20)
    }

    this.lastScore = this.bridge.snapshot.score
    this.lastCombo = state.combo
    this.lastCrashes = state.crashes
    this.lastCollected = state.collected
    this.lastPhaseIdx = phaseIdx
  }

  private updateParallax(state: RunnerState, alpha: number, speed: number): void {
    const { config } = state
    const world = config.world

    for (const layer of this.bgLayers) {
      const offset = ((state.distance * layer.speed) % (world.width * layer.img.scaleX)) * -1
      layer.img.x = world.width / 2 + offset
      layer.img.setOrigin(0.5 - (offset / (world.width * layer.img.scaleX)), 0.5)
    }

    if (this.ground) {
      const gOff = (state.distance % (world.width * 3)) * -1
      this.ground.x = world.width / 2 + gOff * speed
    }

    if (this.avatarTrail) {
      this.avatarTrail.frequency = Math.max(20, 60 - speed * 1.5)
      if (speed > 2) this.avatarTrail.start()
      else this.avatarTrail.stop()
    }
  }

  private updateAvatar(state: RunnerState, alpha: number): void {
    if (!this.avatar || !this.avatarBody) return
    const { config } = state
    const world = config.world

    const ay = avatarTopY(state)
    const prevState = this.bridge.prevState
    const prevAy = prevState ? avatarTopY(prevState) : ay
    const smoothY = Phaser.Math.Linear(prevAy, ay, alpha)

    this.avatar.y = smoothY + world.avatar_h / 2

    const grounded = state.grounded
    if (!grounded) {
      const scaleX = 1 - state.offset * 0.001
      const scaleY = 1 + state.offset * 0.001
      this.avatarBody.setScale(
        Phaser.Math.Clamp(scaleX, 0.7, 1.3),
        Phaser.Math.Clamp(scaleY, 0.7, 1.3),
      )
    } else {
      this.avatarBody.setScale(1, 1)
    }

    if (!grounded && state.vy > 1) {
      this.avatar.rotation = -0.1
    } else {
      this.avatar.rotation = Phaser.Math.Linear(this.avatar.rotation, 0, 0.1)
    }

    const bobY = Math.sin(this.time.now * 0.004) * 2
    this.avatar.y += grounded ? bobY : 0
  }

  private updateEntities(state: RunnerState, alpha: number): void {
    const { config } = state
    const world = config.world
    const currentKeys = new Set(state.entities.map((e) => e.key))

    for (const [key, view] of this.entityViews) {
      if (!currentKeys.has(key)) {
        view.sprite.destroy()
        this.entityViews.delete(key)
      }
    }

    for (const entity of state.entities) {
      const armed = isEntityArmed(entity, state)
      let view = this.entityViews.get(entity.key)

      if (view === undefined) {
        const screenX = entity.x - state.distance
        const screenY = entityTopY(entity, state.tick) + entity.h / 2

        if (screenX > world.width + 100 || screenX < -100) continue

        let color: number
        let shape: 'rect' | 'circle' | 'diamond' = 'rect'

        if (entity.role === 'obstacle') {
          color = this.palette.danger
          shape = entity.variant === 'sudden' ? 'diamond' : 'rect'
        } else if (entity.role === 'good') {
          color = this.palette.success
          shape = 'circle'
        } else {
          color = this.palette.warning
          shape = 'diamond'
        }

        const gfxKey = `runner-ent-${entity.key}`
        generatePlaceholderSprite(this, gfxKey, entity.w, entity.h, color, shape, this.palette.text)

        const sprite = this.add.image(screenX, screenY, gfxKey)
          .setDepth(entity.role === 'obstacle' ? OBSTACLE_DEPTH : ITEM_DEPTH)

        if (!armed) {
          sprite.setAlpha(0.3)
        }

        view = { entity, sprite }
        this.entityViews.set(entity.key, view)
      } else {
        const prevState = this.bridge.prevState
        const prevEnt = prevState?.entities.find((pe) => pe.key === entity.key)
        const prevX = prevEnt ? prevEnt.x - (prevState?.distance ?? state.distance) : entity.x - state.distance
        const curX = entity.x - state.distance

        const smoothX = Phaser.Math.Linear(prevX, curX, alpha)

        const ey = entityTopY(entity, state.tick)
        const prevEY = prevEnt ? entityTopY(prevEnt, prevState?.tick ?? state.tick) : ey
        const smoothY = Phaser.Math.Linear(prevEY, ey, alpha) + entity.h / 2

        view.sprite.x = smoothX
        view.sprite.y = smoothY

        if (!armed) {
          view.sprite.setAlpha(0.3)
        } else if (view.sprite.alpha < 1) {
          view.sprite.setAlpha(Phaser.Math.Linear(view.sprite.alpha, 1, 0.2))
        }

        view.entity = entity
      }
    }
  }

  private updateHUD(state: RunnerState): void {
    const snap = this.bridge.snapshot
    const { config } = state
    const speed = speedAt(config, state.tick)

    if (this.distanceText) {
      this.distanceText.setText(`${Math.floor(state.reach)}m`)
    }
    if (this.scoreText) {
      this.scoreText.setText(`${Math.round(snap.score)}`)
    }
    if (this.comboText) {
      this.comboText.setText(state.combo > 1 ? `x${state.combo}` : '')
      this.comboText.setAlpha(state.combo > 1 ? 1 : 0)
    }
    if (this.livesText) {
      this.livesText.setText(state.lives !== null ? `${'\u2665'} ${state.lives}` : '')
    }
    if (this.speedText) {
      this.speedText.setText(`${speed.toFixed(1)}x`)
    }
  }

  private onCollect(): void {
    Sfx.collect()
    spawnCollectSparkles(
      this,
      this.avatar?.x ?? this.scale.width / 3,
      this.avatar?.y ?? this.scale.height / 2,
    )
    if (this.avatar) {
      scalePunch(this, this.avatar, 1.15, 180)
    }
  }

  private onCrash(): void {
    Sfx.hit()
    addShake(this, 'medium')
    addFlash(this, 0xff4444, 80)
    spawnWrongParticles(
      this,
      this.avatar?.x ?? this.scale.width / 3,
      this.avatar?.y ?? this.scale.height / 2,
    )
  }

  private onComboBreak(): void {
    if (this.lastCombo >= 5) {
      addShake(this, 'light')
      floatText(this, this.scale.width / 2, this.scale.height / 3, 'Break!', '#ef4444', 600)
    }
  }
}

export default RunnerScene
