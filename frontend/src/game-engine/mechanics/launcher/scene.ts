import Phaser from 'phaser'
import { BaseMechanicScene } from '@/game-engine/phaser/scene'
import { GameEngineBridge } from '@/game-engine/phaser/bridge'
import {
  addShake, addFlash, burstParticles, spawnCorrectParticles, spawnWrongParticles,
  spawnExplosion, spawnConfetti, floatText, scalePunch,
} from '@/game-engine/phaser/juice'
import { generatePlaceholderSprite, generateBackground } from '@/game-engine/phaser/assets'
import { Sfx } from '@/game-engine/phaser/sfx'
import {
  launcherSimulator, type LauncherState, targetRect,
  muzzlePoint, quantizeAngle, quantizePower,
  currentRound, previewPath, environmentAt, windAt,
} from './simulate'
import { launcherConfigSchema, launcherContentSchema } from './schema'

const SCENE_WIDTH = 800
const SCENE_HEIGHT = 600

interface AimGesture { dragging: boolean; startX: number; startY: number; currentX: number; currentY: number }

interface TrackedProj {
  sprite: Phaser.GameObjects.Image
  trail: Phaser.GameObjects.Particles.ParticleEmitter
  explosive: boolean
  guided: boolean
}

export class LauncherScene extends BaseMechanicScene<LauncherState> {
  private bg!: Phaser.GameObjects.Image
  private ground!: Phaser.GameObjects.Rectangle
  private launcherContainer!: Phaser.GameObjects.Container
  private launcherBase!: Phaser.GameObjects.Triangle
  private aimLine!: Phaser.GameObjects.Graphics
  private aimArm!: Phaser.GameObjects.Rectangle
  private powerBarBg!: Phaser.GameObjects.Rectangle
  private powerBarFill!: Phaser.GameObjects.Rectangle
  private scoreText!: Phaser.GameObjects.Text
  private roundText!: Phaser.GameObjects.Text
  private shotsText!: Phaser.GameObjects.Text
  private livesText!: Phaser.GameObjects.Text
  private powerText!: Phaser.GameObjects.Text
  private angleText!: Phaser.GameObjects.Text
  private windArrow!: Phaser.GameObjects.Graphics
  private windText!: Phaser.GameObjects.Text
  private comboText!: Phaser.GameObjects.Text
  private roundStartText!: Phaser.GameObjects.Text
  private trajectoryGfx!: Phaser.GameObjects.Graphics
  private targetMap = new Map<number, { sprite: Phaser.GameObjects.Rectangle; hpBar: Phaser.GameObjects.Rectangle | null; hpBg: Phaser.GameObjects.Rectangle | null; label: Phaser.GameObjects.Text }>()
  private obstacleMap = new Map<number, Phaser.GameObjects.Container>()
  private projMap = new Map<number, TrackedProj>()
  private ammoIcons: Phaser.GameObjects.Container[] = []
  private groundDecor: Phaser.GameObjects.Rectangle[] = []
  private gesture: AimGesture = { dragging: false, startX: 0, startY: 0, currentX: 0, currentY: 0 }
  private aimEnabled = true
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  private lastCorrectHits = 0
  private lastIncorrectHits = 0
  private lastRound = 0
  private lastMisses = 0

  constructor() { super('launcher-scene') }

  createBridge() {
    const c = launcherConfigSchema.safeParse(this.doc.config)
    const t = launcherContentSchema.safeParse(this.doc.content)
    if (!c.success || !t.success) throw new Error('INVALID_DOCUMENT')
    return {
      bridge: new GameEngineBridge(launcherSimulator, {
        config: c.data, content: t.data, scoring: this.doc.scoring,
        seed: (this as unknown as { seed: number }).seed ?? 1,
      }),
      simInit: { config: c.data, content: t.data, scoring: this.doc.scoring, seed: (this as unknown as { seed: number }).seed ?? 1 },
    }
  }

  create() {
    this.generateTextures()
    super.create()
  }

  generateTextures() {
    generateBackground(this, 'launcher-sky', SCENE_WIDTH, SCENE_HEIGHT, this.palette)
    generatePlaceholderSprite(this, 'proj-standard', 16, 16, this.palette.accent, 'circle')
    generatePlaceholderSprite(this, 'proj-explosive', 16, 16, 0xff3300, 'circle')
    generatePlaceholderSprite(this, 'proj-guided', 16, 16, 0x44aaff, 'circle')
    generatePlaceholderSprite(this, 'proj-heavy', 16, 16, 0x884422, 'circle')
    generatePlaceholderSprite(this, 'proj-light', 16, 16, 0xaaffaa, 'circle')
  }

  createGameObjects() {
    const st = this.bridge.state
    this.bg = this.add.image(SCENE_WIDTH / 2, SCENE_HEIGHT / 2, 'launcher-sky').setDepth(0)
    this.ground = this.makeRect(SCENE_WIDTH / 2, st.config.world.ground_y + (SCENE_HEIGHT - st.config.world.ground_y) / 2,
      SCENE_WIDTH, SCENE_HEIGHT - st.config.world.ground_y, 0x2d5a1e, 1, 1)
      .setStrokeStyle(1, 0x3a7028, 0.5)

    this.trajectoryGfx = this.add.graphics().setDepth(7)
    const pad = 16
    this.powerBarBg = this.makeRect(pad, SCENE_HEIGHT / 2, 20, 200, 0x333333, 0.6, 25).setOrigin(0, 0.5)
    this.powerBarFill = this.makeRect(pad, SCENE_HEIGHT / 2 + 100, 20, 0, this.palette.accent, 1, 26).setOrigin(0, 1)
    this.powerText = this.makeText(pad + 10, SCENE_HEIGHT / 2 - 110, `${st.power}%`, 12, this.palette.text, 27)
    this.angleText = this.makeText(pad + 10, SCENE_HEIGHT / 2 + 120, `${st.angle}°`, 12, this.palette.text, 27)
    this.scoreText = this.makeText(SCENE_WIDTH / 2, 20, 'Score: 0', 16, this.palette.accent, 30)
    this.roundText = this.makeText(SCENE_WIDTH / 2, 44, `Round ${st.round + 1}/${st.config.rounds.length}`, 14, this.palette.text, 30)
    this.shotsText = this.makeText(SCENE_WIDTH - pad, 20, `Shots: ${st.shotsLeft}`, 14, this.palette.text, 30).setOrigin(1, 0)
    this.livesText = this.makeText(SCENE_WIDTH - pad, 44, '', 14, this.palette.danger, 30).setOrigin(1, 0).setAlpha(0)
    this.windArrow = this.add.graphics().setDepth(25)
    this.windText = this.makeText(SCENE_WIDTH / 2 + 60, 60, 'Wind: 0', 12, this.palette.text, 30).setOrigin(0, 0.5)
    this.comboText = this.makeText(SCENE_WIDTH / 2, 76, '', 24, this.palette.warning, 30)
    this.roundStartText = this.makeText(SCENE_WIDTH / 2, SCENE_HEIGHT / 2 - 60, '', 20, this.palette.accent, 100).setAlpha(0)

    const groundY = st.config.world.ground_y
    for (let i = 0; i < 40; i++) {
      const gx = i * 22 + 6
      const gy = groundY + 2 + Math.sin(i * 1.7) * 3
      const tuft = this.makeRect(gx, gy, 3, 5 + Math.abs(Math.sin(i * 2.3)) * 4, 0x3a8030, 0.6, 2)
      this.groundDecor.push(tuft)
    }

    this.createLauncher()
    this.syncTargetsFromState(st)
    this.syncObstaclesFromState(st)
    this.syncAmmoFromState(st)
    this.showRoundStart(st)
  }

  createLauncher() {
    const st = this.bridge.state
    const x = st.launcherX + st.config.launcher.w / 2
    const y = st.launcherY + st.config.launcher.h

    this.launcherBase = this.add.triangle(x, y, 0, -st.config.launcher.h,
      st.config.launcher.w / 2, 0, -st.config.launcher.w / 2, 0, this.palette.accent, 1)
    this.launcherContainer = this.add.container(0, 0, [this.launcherBase]).setDepth(8)

    this.aimLine = this.add.graphics().setDepth(9)
    this.aimArm = this.makeRect(x, y - st.config.launcher.h / 2, 50, 6, this.palette.accent, 0.9, 8)
    this.drawAimArm()
  }

  drawAimArm() {
    const st = this.bridge.state
    const pivotX = st.launcherX + st.config.launcher.w / 2
    const pivotY = st.launcherY + st.config.launcher.h / 2
    const len = 50
    const rad = Phaser.Math.DegToRad(st.angle)

    this.aimLine.clear()
    this.aimLine.lineStyle(3, this.palette.accent, 0.8)
    this.aimLine.beginPath()
    this.aimLine.moveTo(pivotX, pivotY)
    this.aimLine.lineTo(pivotX + len * Math.cos(rad), pivotY - len * Math.sin(rad))
    this.aimLine.strokePath()

    this.aimArm.setPosition(pivotX + (len / 2) * Math.cos(rad), pivotY - (len / 2) * Math.sin(rad))
    this.aimArm.setRotation(-rad)
  }

  setupInput() {
    this.keys = (this.input.keyboard!).addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      one: Phaser.Input.Keyboard.KeyCodes.ONE,
      two: Phaser.Input.Keyboard.KeyCodes.TWO,
      three: Phaser.Input.Keyboard.KeyCodes.THREE,
      four: Phaser.Input.Keyboard.KeyCodes.FOUR,
      five: Phaser.Input.Keyboard.KeyCodes.FIVE,
      p: Phaser.Input.Keyboard.KeyCodes.P,
    }) as Record<string, Phaser.Input.Keyboard.Key>

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.paused || this.finished) return
      this.gesture = { dragging: true, startX: p.x, startY: p.y, currentX: p.x, currentY: p.y }
    })

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.gesture.dragging || this.paused || this.finished) return
      this.gesture.currentX = p.x
      this.gesture.currentY = p.y
      this.slingshotAim()
    })

    this.input.on('pointerup', () => {
      if (!this.gesture.dragging) return
      this.gesture.dragging = false
      this.aimEnabled = false
      this.fireLaunch()
    })
  }

  slingshotAim() {
    const st = this.bridge.state
    if (st.projectiles.length > 0 || st.cooldownLeft > 0) return
    const mz = muzzlePoint(st)
    const dx = mz.x - this.gesture.currentX
    const dy = mz.y - this.gesture.currentY
    const dist = Math.sqrt(dx * dx + dy * dy)
    const pct = Math.min(1, dist / st.config.launcher.pull_max_units)
    const angleDeg = Math.round(Phaser.Math.RadToDeg(Math.atan2(-dy, dx)))
    this.bridge.enqueue('aim', { x: quantizeAngle(st.config, angleDeg), y: quantizePower(st.config, Math.round(pct * 100)) })
  }

  fireLaunch() {
    const st = this.bridge.state
    if (st.projectiles.length > 0 || st.cooldownLeft > 0 || st.shotsLeft <= 0) return
    this.bridge.enqueue('launch')
    Sfx.whoosh()
    scalePunch(this, this.launcherContainer, 1.3, 200)
    addShake(this, 'medium')
    const mz = muzzlePoint(st)
    burstParticles(this, mz.x, mz.y, { texture: 'px-circle-white', count: 6, speed: { min: 40, max: 120 }, lifespan: 300, scale: { start: 0.6, end: 0 }, gravityY: -50 })
    this.time.delayedCall(200, () => { this.aimEnabled = true })
  }

  updateGameObjects(_delta: number) {
    if (this.paused) return
    const st = this.bridge.state
    const prev = this.bridge.prevState
    const a = this.bridge.alpha

    this.handleKeys(st)
    this.updateLauncherPos(prev, st, a)
    this.updateTrajectory(st)
    this.updateWind(st)
    this.syncTargetsFromState(st)
    this.syncProjectiles(prev, st, a)
    this.updateHUD(st)
    this.syncAmmoFromState(st)
    this.checkFinish(st)
  }

  handleKeys(st: LauncherState) {
    if (Phaser.Input.Keyboard.JustDown(this.keys.p!)) { this.togglePause(); return }
    const angStep = st.config.launcher.angle_step
    const pwStep = st.config.launcher.power_step
    if (Phaser.Input.Keyboard.JustDown(this.keys.up!)) this.bridge.enqueue('aim', { x: st.angle + angStep })
    if (Phaser.Input.Keyboard.JustDown(this.keys.down!)) this.bridge.enqueue('aim', { x: st.angle - angStep })
    if (Phaser.Input.Keyboard.JustDown(this.keys.left!) && st.cooldownLeft <= 0) this.bridge.enqueue('aim', { y: st.power - pwStep })
    if (Phaser.Input.Keyboard.JustDown(this.keys.right!) && st.cooldownLeft <= 0) this.bridge.enqueue('aim', { y: st.power + pwStep })
    if (Phaser.Input.Keyboard.JustDown(this.keys.space!) && st.projectiles.length === 0 && st.cooldownLeft <= 0) { this.bridge.enqueue('launch'); Sfx.whoosh() }
    if (Phaser.Input.Keyboard.JustDown(this.keys.one!)) this.bridge.enqueue('select', { slot: st.config.projectiles[0]?.id })
    if (Phaser.Input.Keyboard.JustDown(this.keys.two!)) this.bridge.enqueue('select', { slot: st.config.projectiles[1]?.id })
    if (Phaser.Input.Keyboard.JustDown(this.keys.three!)) this.bridge.enqueue('select', { slot: st.config.projectiles[2]?.id })
    if (Phaser.Input.Keyboard.JustDown(this.keys.four!)) this.bridge.enqueue('select', { slot: st.config.projectiles[3]?.id })
    if (Phaser.Input.Keyboard.JustDown(this.keys.five!)) this.bridge.enqueue('select', { slot: st.config.projectiles[4]?.id })
  }

  updateLauncherPos(prev: LauncherState | null, st: LauncherState, a: number) {
    if (!prev) return
    const lx = Phaser.Math.Linear(prev.launcherX, st.launcherX, a)
    const ly = Phaser.Math.Linear(prev.launcherY, st.launcherY, a)
    this.launcherBase.setPosition(lx + st.config.launcher.w / 2, ly + st.config.launcher.h)
    this.launcherContainer.setPosition(0, 0)
    this.drawAimArm()
    const pct = st.power / 100
    this.powerBarFill.setSize(20, pct * 200)
    this.powerText.setText(`${st.power}%`)
    this.angleText.setText(`${st.angle}°`)
  }

  updateTrajectory(st: LauncherState) {
    this.trajectoryGfx.clear()
    const cfg = st.config.aim.trajectory_preview
    if (!cfg.enabled || cfg.dots <= 0 || st.projectiles.length > 0 || st.cooldownLeft > 0) return
    const path = previewPath(st, st.angle, st.power, cfg.dots, cfg.tick_step)
    this.trajectoryGfx.fillStyle(this.palette.accent, 0.4)
    for (const pt of path) {
      this.trajectoryGfx.fillCircle(pt.x, pt.y, 3)
    }
  }

  updateWind(st: LauncherState) {
    const env = environmentAt(st.config, st.round)
    const wnd = windAt(env, st.tick)
    this.windArrow.clear()
    const color = wnd > 0 ? 0x44aaff : 0xff6644
    const cx = SCENE_WIDTH / 2, cy = 60
    const len = Math.abs(wnd) * 5
    const dir = Math.sign(wnd)
    this.windArrow.lineStyle(2, color, 0.8)
    this.windArrow.beginPath()
    this.windArrow.moveTo(cx - dir * len, cy)
    this.windArrow.lineTo(cx + dir * len, cy)
    this.windArrow.strokePath()
    if (len > 2) {
      this.windArrow.fillStyle(color, 0.8)
      const tx = cx + dir * len
      this.windArrow.fillTriangle(tx, cy, tx - dir * 8, cy - 5, tx - dir * 8, cy + 5)
    }
    this.windText.setText(`Wind: ${wnd > 0 ? '→' : '←'} ${Math.abs(wnd).toFixed(1)}`)
  }

  syncTargetsFromState(st: LauncherState) {
    const liveKeys = new Set(st.targets.map(t => t.key))
    for (const [key, obj] of this.targetMap) {
      if (!liveKeys.has(key)) { obj.sprite.destroy(); obj.label.destroy(); obj.hpBar?.destroy(); obj.hpBg?.destroy(); this.targetMap.delete(key) }
    }

    for (const t of st.targets) {
      const rect = targetRect(t, st.tick, st.draws)
      const cx = rect.x + rect.w / 2
      const cy = rect.y + rect.h / 2

      let obj = this.targetMap.get(t.key)
      if (!obj) {
        const color = t.role === 'correct' ? this.palette.success : this.palette.danger
        const s = this.makeRect(cx, cy, rect.w, rect.h, color, 0.85, 6).setStrokeStyle(2, this.palette.text, 0.3)
        const lbl = this.makeText(cx, cy - rect.h / 2 - 10, (t.itemId ?? t.id).substring(0, 14), 10, this.palette.text, 15)
        let hpBar: Phaser.GameObjects.Rectangle | null = null
        let hpBg: Phaser.GameObjects.Rectangle | null = null
        if (t.maxHp > 1) {
          hpBg = this.makeRect(cx, cy + rect.h / 2 + 6, rect.w, 4, 0x333333, 0.7, 16)
          hpBar = this.makeRect(cx - rect.w / 2, cy + rect.h / 2 + 6, rect.w, 4, this.palette.success, 1, 17).setOrigin(0, 0.5)
        }
        obj = { sprite: s, label: lbl, hpBar, hpBg }
        this.targetMap.set(t.key, obj)
      }

      const alive = t.hp > 0
      obj.sprite.setPosition(cx, cy).setSize(rect.w, rect.h).setAlpha(alive ? 0.85 : 0)
      obj.label.setPosition(cx, cy - rect.h / 2 - 10).setAlpha(alive ? 1 : 0)
      if (obj.hpBar && t.maxHp > 1) {
        const pct = Math.max(0, t.hp / t.maxHp)
        obj.hpBar.setSize(rect.w * pct, 4).setPosition(cx - rect.w / 2, cy + rect.h / 2 + 6).setAlpha(alive ? 1 : 0)
        obj.hpBg?.setPosition(cx, cy + rect.h / 2 + 6).setAlpha(alive ? 1 : 0)
      }
    }
  }

  syncObstaclesFromState(st: LauncherState) {
    const liveKeys = new Set(st.obstacles.map(o => o.key))
    for (const [key, c] of this.obstacleMap) {
      if (!liveKeys.has(key)) { c.destroy(); this.obstacleMap.delete(key) }
    }
    for (const o of st.obstacles) {
      if (this.obstacleMap.has(o.key)) continue
      let color = 0x666666
      if (o.material === 'deflect') color = 0x6688aa
      else if (o.material === 'breakable') color = 0x44aa44
      const r = this.makeRect(o.x + o.w / 2, o.y + o.h / 2, o.w, o.h, color, 0.7, 4)
        .setStrokeStyle(o.material === 'deflect' ? 2 : 1, o.material === 'deflect' ? 0x88ccff : 0x555555, 0.5)
      const lbl = this.makeText(o.x + o.w / 2, o.y + o.h / 2, o.material.substring(0, 6), 9, this.palette.text, 15)
      const ct = this.add.container(0, 0, [r, lbl]).setDepth(4)
      this.obstacleMap.set(o.key, ct)
    }
  }

  syncProjectiles(prev: LauncherState | null, st: LauncherState, a: number) {
    const curKeys = new Set(st.projectiles.map(p => p.key))
    for (const [key, tp] of this.projMap) {
      if (!curKeys.has(key)) {
        const prevP = prev?.projectiles.find(p => p.key === key)
        if (prevP) {
          if (tp.explosive) { spawnExplosion(this, prevP.x, prevP.y); addFlash(this, 0xff8800, 120); Sfx.explosion() }
          else if (prevP.hitTarget) { spawnCorrectParticles(this, prevP.x, prevP.y); Sfx.hit() }
          else { burstParticles(this, prevP.x, prevP.y, { texture: 'px-circle-white', count: 4, speed: { min: 30, max: 80 }, lifespan: 300, scale: { start: 0.5, end: 0 }, gravityY: 100 }) }
        }
        tp.trail.destroy()
        tp.sprite.destroy()
        this.projMap.delete(key)
      }
    }

    for (const p of st.projectiles) {
      const kind = st.config.projectiles.find(pj => pj.id === p.projectileId)
      const isExp = kind?.kind === 'explosive'
      const isGui = kind?.kind === 'guided'
      const r = Math.max(4, p.radius)

      let tp = this.projMap.get(p.key)
      if (!tp) {
        let texKey = 'proj-standard'
        if (isExp) texKey = 'proj-explosive'
        else if (isGui) texKey = 'proj-guided'
        else if (kind?.kind === 'heavy') texKey = 'proj-heavy'
        else if (kind?.kind === 'light') texKey = 'proj-light'

        const s = this.add.image(p.x, p.y, texKey).setDepth(10).setDisplaySize(r * 2, r * 2)
        const pt = isExp ? 'px-circle-red' : 'px-circle-white'
        const em = this.add.particles(0, 0, pt, {
          follow: s,
          speed: { min: 5, max: 20 },
          scale: { start: 0.4, end: 0 },
          alpha: { start: 0.6, end: 0 },
          lifespan: 250,
          frequency: 40,
          quantity: 1,
        } as Phaser.Types.GameObjects.Particles.ParticleEmitterConfig).setDepth(9)
        tp = { sprite: s, trail: em, explosive: isExp, guided: isGui }
        this.projMap.set(p.key, tp)
      }

      const prevP = prev?.projectiles.find(pp => pp.key === p.key)
      const lx = prevP ? Phaser.Math.Linear(prevP.x, p.x, a) : p.x
      const ly = prevP ? Phaser.Math.Linear(prevP.y, p.y, a) : p.y
      tp.sprite.setPosition(lx, ly).setDisplaySize(r * 2, r * 2)
    }
  }

  syncAmmoFromState(st: LauncherState) {
    for (const c of this.ammoIcons) c.destroy()
    this.ammoIcons = []
    for (let i = 0; i < st.config.projectiles.length; i++) {
      const p = st.config.projectiles[i]!
      const x = SCENE_WIDTH - 16
      const y = 80 + i * 28
      const active = i === st.ammoIndex
      let clr = this.palette.accent
      if (p.kind === 'explosive') clr = 0xff3300
      else if (p.kind === 'guided') clr = 0x44aaff
      else if (p.kind === 'heavy') clr = 0x884422
      else if (p.kind === 'light') clr = 0xaaffaa
      const bg = this.makeRect(x, y, 24, 24, active ? 0xffffff : 0x222222, active ? 0.3 : 0.15, 25)
        .setStrokeStyle(1, active ? clr : 0x555555, active ? 1 : 0.3)
      const dot = this.makeCircle(x, y, 6, clr, 1, 26)
      const lbl = this.makeText(x, y + 16, p.kind.substring(0, 3).toUpperCase(), 8, this.palette.text, 27)
      this.ammoIcons.push(this.add.container(0, 0, [bg, dot, lbl]).setDepth(25))
    }
  }

  updateHUD(st: LauncherState) {
    const snap = this.bridge.snapshot
    this.scoreText.setText(`Score: ${snap.score}`)
    this.roundText.setText(`Round ${st.round + 1}/${st.config.rounds.length}`)
    this.shotsText.setText(`Shots: ${st.shotsLeft}`)
    if (st.combo > 1) {
      this.comboText.setText(`COMBO x${st.combo}`)
      this.comboText.setAlpha(1)
    } else {
      this.comboText.setAlpha(0)
    }
    if (st.lives !== null) {
      this.livesText.setAlpha(1)
      this.livesText.setText(`❤ ${st.lives}`)
    } else {
      this.livesText.setAlpha(0)
    }
    this.checkHitEffects(st)
    this.checkRoundChange(st)
  }

  checkHitEffects(st: LauncherState) {
    if (st.correctHits > this.lastCorrectHits) {
      const diff = st.correctHits - this.lastCorrectHits
      this.lastCorrectHits = st.correctHits
      Sfx.correct()
      if (st.combo > 1) Sfx.combo()
      floatText(this, SCENE_WIDTH / 2, SCENE_HEIGHT / 2 - 40,
        `+${diff * st.config.scoring.hit_points}`, '#44ff44', 900)
    }
    if (st.incorrectHits > this.lastIncorrectHits) {
      this.lastIncorrectHits = st.incorrectHits
      Sfx.wrong()
      addShake(this, 'wrong')
      addFlash(this, this.palette.danger, 100)
      spawnWrongParticles(this, SCENE_WIDTH / 2, SCENE_HEIGHT / 2)
    }
    if (st.misses > this.lastMisses) {
      this.lastMisses = st.misses
      addShake(this, 'light')
    }
  }

  checkRoundChange(st: LauncherState) {
    if (st.round !== this.lastRound) {
      this.lastRound = st.round
      this.showRoundStart(st)
    }
  }

  showRoundStart(st: LauncherState) {
    const round = currentRound(st)
    this.roundStartText.setText(`Round ${st.round + 1}: ${round?.id ?? '???'}`)
    this.roundStartText.setAlpha(1)
    this.tweens.add({
      targets: this.roundStartText,
      alpha: 0,
      scale: 1.5,
      duration: 1500,
      ease: 'Cubic.easeOut',
      delay: 500,
    })
    burstParticles(this, SCENE_WIDTH / 2, SCENE_HEIGHT / 2 - 40, {
      texture: 'px-circle-gold',
      count: 15,
      speed: { min: 40, max: 160 },
      lifespan: 800,
      scale: { start: 0.8, end: 0 },
      gravityY: -30,
    })
  }

  private _finished = false
  checkFinish(st: LauncherState) {
    if (st.finished && !this._finished) {
      this._finished = true
      spawnConfetti(this, SCENE_WIDTH / 2, SCENE_HEIGHT / 2, 60)
      Sfx.levelUp()
      const snap = this.bridge.snapshot
      const finalText = this.makeText(SCENE_WIDTH / 2, SCENE_HEIGHT / 2, `Score: ${snap.score}`, 28, this.palette.accent, 100)
      this.tweens.add({
        targets: finalText,
        scale: 1.3,
        yoyo: true,
        duration: 600,
        ease: 'Bounce.easeOut',
      })
    }
  }
}
