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
  spawnExplosion,
  spawnWrongParticles,
} from '@/game-engine/phaser/juice'
import { BaseMechanicScene } from '@/game-engine/phaser/scene'
import { Sfx } from '@/game-engine/phaser/sfx'

import { flyerConfigSchema, flyerContentSchema } from './schema'
import {
  beamBox,
  clamp,
  flyerSimulator,
  isInStorm,
  isInThermal,
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

  private stormOverlay: Phaser.GameObjects.Rectangle | null = null

  private lastScore = 0
  private lastCombo = 0
  private lastCollected = 0
  private lastHits = 0
  private lastStalls = 0
  private lastEnemiesDowned = 0
  private lastReach = 0

  private cloudSprites: Array<{ sprite: Phaser.GameObjects.Image; speed: number }> = []
  private _seed = 0

  constructor() {
    super('flyer')
  }

  init(data: MechanicSceneInit): void {
    super.init(data)
    this._seed = data.seed
  }

  createBridge(): { bridge: GameEngineBridge<FlyerState>; simInit: import('@/game-engine/core/types').SimInit } {
    const configParse = flyerConfigSchema.safeParse(this.doc.config)
    const contentParse = flyerContentSchema.safeParse(this.doc.content)
    if (!configParse.success || !contentParse.success) throw new Error('Invalid flyer document')
    const simInit = {
      config: configParse.data,
      content: contentParse.data,
      scoring: this.doc.scoring,
      seed: this._seed,
    }
    return {
      bridge: new GameEngineBridge(flyerSimulator, simInit),
      simInit,
    }
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
    this.distanceText = this.makeText(world.width - 80, 28, '0m', 16, p.text, HUD_DEPTH).setOrigin(1, 0.5)
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

  private createControls(world: FlyerState['config']['world']): void {
    const p = this.palette

    const fireSize = 56
    generatePlaceholderSprite(this, 'fire-btn', fireSize, fireSize, p.accent, 'circle', p.text)
    this.fireBtn = this.add.container(world.width - 44, world.height - 44)
    this.fireBtn.setDepth(HUD_DEPTH)
    const fireImg = this.add.image(0, 0, 'fire-btn').setInteractive({ useHandCursor: true })
    const fireLabel = this.makeText(0, 0, 'FIRE', 11, p.inverse, HUD_DEPTH + 1)
    this.fireBtn.add([fireImg, fireLabel])
    this.fireBtn.setSize(fireSize, fireSize)
    this.fireBtn.setInteractive(
      new Phaser.Geom.Rectangle(-fireSize / 2, -fireSize / 2, fireSize, fireSize),
      Phaser.Geom.Rectangle.Contains,
    )
    this.fireBtn.on('pointerdown', () => {
      if (this.paused || this.finished) return
      this.bridge.enqueue('fire')
    })

    const beamSize = 44
    generatePlaceholderSprite(this, 'beam-btn', beamSize, beamSize, 0xffdd00, 'circle', p.text)
    this.beamBtn = this.add.container(world.width - 44, world.height - 44 - fireSize - 12)
    this.beamBtn.setDepth(HUD_DEPTH)
    const beamImg = this.add.image(0, 0, 'beam-btn').setInteractive({ useHandCursor: true })
    const beamLabel = this.makeText(0, 0, 'BEAM', 10, 0x000000, HUD_DEPTH + 1)
    this.beamBtn.add([beamImg, beamLabel])
    this.beamBtn.setSize(beamSize, beamSize)
    this.beamBtn.setInteractive(
      new Phaser.Geom.Rectangle(-beamSize / 2, -beamSize / 2, beamSize, beamSize),
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
  }

  setupInput(): void {
    const { config } = this.bridge.state
    const world = config.world
    const midY = world.height / 2

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.paused || this.finished) return

      if (this.fireBtn?.getBounds().contains(pointer.x, pointer.y)) return
      if (this.beamBtn?.getBounds().contains(pointer.x, pointer.y)) return

      if (pointer.y < midY) {
        this.bridge.enqueue('climb')
        Sfx.pop()
      } else {
        this.bridge.enqueue('dive')
        Sfx.pop()
      }
    })

    this.input.keyboard?.on('keydown-UP', () => this.bridge.enqueue('climb'))
    this.input.keyboard?.on('keydown-DOWN', () => this.bridge.enqueue('dive'))
    this.input.keyboard?.on('keydown-SPACE', () => this.bridge.enqueue('fire'))
    this.input.keyboard?.on('keydown-B', () => {
      if (this.bridge.state.beamOn) {
        this.bridge.enqueue('beam_end')
      } else {
        this.bridge.enqueue('beam_start')
      }
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
      floatText(this, world.width / 2, 100, `${state.combo}x`, '#ffd700', 600)
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
      floatText(this, world.width / 2, world.height / 3, `${mileStoneCurr * 500}m!`, '#22c55e', 1200)
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
      this.stallWarning?.setText('STALL!').setAlpha(
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
        const sprite = this.makeEntitySprite(entity, screenX)
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
        view.entity = entity
      }
    }
  }

  private makeEntitySprite(entity: FlyerEntity, screenX: number): Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle | null {
    let color: number
    let shape: 'rect' | 'circle' | 'diamond' = 'rect'
    let depth = ENTITY_DEPTH
    let alpha = 1

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
        if (isBoss) {
          color = 0xff00ff
          shape = 'diamond'
          alpha = 0.9
        } else {
          color = 0xcc44cc
          shape = 'diamond'
          alpha = 0.8
        }
        break
      }
      case 'thermal':
        color = this.palette.success
        alpha = 0.2
        shape = 'rect'
        depth = ZONE_DEPTH
        break
      case 'storm':
        color = 0x222244
        alpha = 0.3
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

      if (screenX > this.scale.width + 100 || screenX < -200) {
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

    if (screenX + box.w < 0 || screenX > this.scale.width) return

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
    if (this.distanceText) this.distanceText.setText(`${Math.floor(state.reach)}m`)
    if (this.comboText) {
      this.comboText.setText(state.combo > 1 ? `x${state.combo}` : '')
      this.comboText.setAlpha(state.combo > 1 ? 1 : 0)
    }
    if (this.livesText) {
      this.livesText.setText(state.lives !== null ? `${'\u2665'} ${state.lives}` : '')
    }
    if (this.speedText) {
      this.speedText.setText(`${state.speed.toFixed(1)}u/t`)
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
  }

  private onHit(): void {
    Sfx.hit()
    addShake(this, 'medium')
    addFlash(this, 0xff4444, 80)
    if (this.mount) spawnWrongParticles(this, this.mount.x, this.mount.y)
  }
}

export default FlyerScene
