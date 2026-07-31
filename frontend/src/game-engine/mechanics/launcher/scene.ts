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
  muzzlePoint, quantizeAngle, quantizePower, activeProjectile,
  currentRound, previewPath, environmentAt, windAt,
} from './simulate'
import {
  launcherConfigSchema, launcherContentSchema,
  type LauncherProjectileKind, type LauncherMaterial,
} from './schema'

/** Touch-target floor for every canvas-drawn button (ammo slots, the limited-axis move
 *  buttons) — 44 DESIGN units, matching `flyer/scene.ts`'s `beamBtn` (the one other
 *  Phaser mechanic that already ships a sized, interactive canvas button). The canvas
 *  is authored at a fixed 800x600 and letterboxed onto the real viewport by
 *  `Phaser.Scale.FIT` (`PhaserGameBox.tsx`), so on a viewport narrower than 800 CSS px
 *  a design unit renders SMALLER than 1 CSS px — 44 design units is therefore the
 *  floor assumed by the sibling mechanics already shipped, not a value re-derived here;
 *  verifying the actual rendered CSS size on a real small viewport needs live rendering
 *  this task cannot perform (flagged in the review notes). */
const TOUCH_TARGET = 44

/** Kind → the `games.canvas.*` key carrying its translated name (see `CANVAS_STRING_KEYS`
 *  in phaser/scene.ts). The ammo icon shows only the first 3 letters, uppercased, of
 *  whichever locale this resolves to — same layout the old hardcoded English abbreviation
 *  used, but now every locale gets its OWN abbreviation instead of always English. */
const AMMO_LABEL_KEY: Record<LauncherProjectileKind, string> = {
  standard: 'ammoStandard',
  heavy: 'ammoHeavy',
  light: 'ammoLight',
  guided: 'ammoGuided',
  explosive: 'ammoExplosive',
}

/** Obstacle material → its translated name, same rationale as `AMMO_LABEL_KEY`. */
const OBSTACLE_LABEL_KEY: Record<LauncherMaterial, string> = {
  solid: 'obstacleSolid',
  deflect: 'obstacleDeflect',
  absorb: 'obstacleAbsorb',
  breakable: 'obstacleBreakable',
}

/**
 * The pure decision behind `slingshotAim`'s aim-event throttling — deliberately kept
 * FRAMEWORK-FREE (no `this`, no Phaser) and exported so `launcher.test.ts` can drive it
 * directly: this project's vitest environment globally stubs the `phaser` module
 * (`src/test-setup.ts`'s `vi.mock('phaser', …)`, applied to every test file via
 * `setupFiles`), so booting a real `Phaser.Scene` inside a unit test is not available
 * here — the same reason no sibling mechanic's `scene.ts` has a scene-level test today.
 * Extracting the actual decision into a plain function keeps the regression coverage
 * real (byte-for-byte the logic `slingshotAim` runs) rather than a re-implementation a
 * test could drift from.
 *
 * `pointermove` fires at the browser's native pointer rate (commonly 60-240Hz) for the
 * whole span of a drag, but `GameEngineBridge.enqueue` has no dedup of its own — every
 * call is a permanent, unbounded append to `inputLog`, and the server replays against
 * `validation.max_events` (core/replay.ts's `log_too_long`/`RESULT_REJECTED`). An
 * honest few-second pull-back at 120Hz could log 200+ raw samples for a shot the
 * config's own angle/power grid resolves into at most a few dozen DISTINCT states.
 *
 * FIX: value-change dedup, not time-throttling. `angle`/`power` are already quantized
 * to the manifest's discrete grid before they ever reach here — a time-based throttle
 * (e.g. "at most one aim per N ticks") would either drop a real bucket transition
 * during a fast flick (the aim the child actually released on) or, tuned generously
 * enough not to, still let a slow, jittery drag emit many redundant events while
 * sitting inside the same bucket. Comparing against the LAST value actually enqueued
 * guarantees at most one event per real state change — bounded by the config's own
 * (max_angle-min_angle)/angle_step * (max_power-min_power)/power_step grid size
 * regardless of how fast the pointer fires — while every genuine change is still
 * emitted the instant it happens, so the aim feels exactly as responsive as before.
 *
 * Returns the pair to enqueue, or `null` when it exactly repeats `last` (nothing to
 * send). `last` should be reset to `{ angle: null, power: null }` on `pointerdown` so a
 * new gesture's first sample always sends even if it happens to match where the
 * previous shot's drag ended.
 */
export function nextAimToEnqueue(
  last: { angle: number | null; power: number | null },
  angle: number,
  power: number,
): { angle: number; power: number } | null {
  if (angle === last.angle && power === last.power) return null
  return { angle, power }
}

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
  private moveButtons: Phaser.GameObjects.Container[] = []
  private groundDecor: Phaser.GameObjects.Rectangle[] = []
  private gesture: AimGesture = { dragging: false, startX: 0, startY: 0, currentX: 0, currentY: 0 }
  private aimEnabled = true
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  private lastCorrectHits = 0
  private lastIncorrectHits = 0
  private lastRound = 0
  private lastMisses = 0
  /** The last QUANTIZED (angle, power) pair actually enqueued as an `aim` event during
   *  the CURRENT drag — see `slingshotAim`'s doc comment for why this exists. `null`
   *  outside a drag so a fresh gesture's first sample is always sent regardless of what
   *  the previous gesture ended on. */
  private lastEnqueuedAngle: number | null = null
  private lastEnqueuedPower: number | null = null
  /** The bridge tick a `nudge` was last enqueued on — see `handleKeys`'s guided-steering
   *  branch: `isDown` is polled every RENDER frame (far more often than the 50ms fixed
   *  tick), so without this a held key would flood the log with several `nudge` events
   *  per tick the simulator only ever reads once (`MAX_STEER_UNITS` collapses them
   *  anyway, but the log itself must still stay near one event per tick — the same
   *  `max_events` budget `slingshotAim`'s fix protects). */
  private lastNudgeTick = -1

  constructor() { super('launcher') }

  createBridge() {
    const c = launcherConfigSchema.safeParse(this.doc.config)
    const t = launcherContentSchema.safeParse(this.doc.content)
    if (!c.success || !t.success) throw new Error('INVALID_DOCUMENT')
    const simInit = { config: c.data, content: t.data, scoring: this.doc.scoring, seed: this.seed }
    return {
      bridge: new GameEngineBridge(launcherSimulator, simInit, this.maxTicks),
      simInit,
    }
  }

  protected override getWorldSize(): { width: number; height: number } {
    // `config.world` is authored per-manifest and can legitimately differ from the
    // fixed 800x600 canvas — confirmed: both shipped fixtures declare 900x540, and one
    // target (`fondo`, x:780 w:80 → right edge 860) sits well past the canvas's x=800
    // edge, so without this fit it renders silently clipped on every device (the exact
    // sorter/stacker bug fixed in 695891c). Same rationale as those siblings.
    const { world } = this.bridge.state.config
    return { width: world.width, height: world.height }
  }

  /** Resolves a `games.canvas.*` key from `this.strings` and fills in `{{var}}`
   *  placeholders — `PhaserGameBox.tsx` resolves each key to its raw, non-interpolated
   *  template exactly once at scene start (see `CANVAS_STRING_KEYS`'s doc comment in
   *  phaser/scene.ts), so a mechanic that needs a parameterized readout (the score, the
   *  round counter, the wind reading) does its own substitution here rather than a
   *  second ad-hoc i18n mechanism. Falls back to the bare key (never a hardcoded
   *  English literal) so a missing wire-up is visible instead of silently English. */
  private fmt(key: string, vars: Record<string, string | number> = {}): string {
    let s = this.strings[key] ?? key
    for (const [name, value] of Object.entries(vars)) s = s.split(`{{${name}}}`).join(String(value))
    return s
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
    this.powerText = this.makeText(pad + 10, SCENE_HEIGHT / 2 - 110, this.fmt('powerLabel', { value: st.power }), 12, this.palette.text, 27)
    this.angleText = this.makeText(pad + 10, SCENE_HEIGHT / 2 + 120, this.fmt('angleLabel', { value: st.angle }), 12, this.palette.text, 27)
    this.scoreText = this.makeText(SCENE_WIDTH / 2, 20, this.fmt('scoreLabel', { score: 0 }), 16, this.palette.accent, 30)
    this.roundText = this.makeText(SCENE_WIDTH / 2, 44, this.fmt('roundLabel', { current: st.round + 1, total: st.config.rounds.length }), 14, this.palette.text, 30)
    this.shotsText = this.makeText(SCENE_WIDTH - pad, 20, this.fmt('shotsLabel', { count: st.shotsLeft }), 14, this.palette.text, 30).setOrigin(1, 0)
    this.livesText = this.makeText(SCENE_WIDTH - pad, 44, '', 14, this.palette.danger, 30).setOrigin(1, 0).setAlpha(0)
    this.windArrow = this.add.graphics().setDepth(25)
    this.windText = this.makeText(SCENE_WIDTH / 2 + 60, 60, this.fmt('windLabel', { value: 0 }), 12, this.palette.text, 30).setOrigin(0, 0.5)
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
    this.createMoveControls(st)
    this.syncTargetsFromState(st)
    this.syncObstaclesFromState(st)
    this.syncAmmoFromState(st)
    this.showRoundStart(st)
  }

  /**
   * `config.launcher.move` (LAUNCHER_ACTIONS's `move`) has a keyboard path (A/D, added
   * in `setupInput`) but was reachable from NO input at all before this — confirmed
   * against a real fixture (`fixtures.ts`'s wind-round manifest declares
   * `move: { axis: 'x', min: 40, max: 200, step: 20 }`) which a touch-only player could
   * never trigger. Only rendered when the manifest actually declares an axis — a fixed
   * emplacement (`axis: 'none'`, every other fixture) gets no buttons cluttering the
   * field for a control that would be a permanent no-op.
   */
  createMoveControls(st: LauncherState) {
    if (st.config.launcher.move.axis === 'none') return
    const y = SCENE_HEIGHT - TOUCH_TARGET / 2 - 8
    this.moveButtons.push(this.makeMoveButton(TOUCH_TARGET / 2 + 8, y, '‹', -1))
    this.moveButtons.push(this.makeMoveButton(TOUCH_TARGET / 2 + 8 + TOUCH_TARGET + 8, y, '›', 1))
  }

  makeMoveButton(x: number, y: number, glyph: string, direction: -1 | 1): Phaser.GameObjects.Container {
    const bg = this.makeRect(0, 0, TOUCH_TARGET, TOUCH_TARGET, 0x222222, 0.5, 0)
      .setStrokeStyle(1, this.palette.accent, 0.6)
    // A bare directional glyph, not a word — no i18n key needed (see phaser/scene.ts's
    // CANVAS_STRING_KEYS doc comment: only LETTERS require translation).
    const lbl = this.makeText(0, 0, glyph, 22, this.palette.text, 1)
    const c = this.add.container(x, y, [bg, lbl]).setDepth(25)
    c.setSize(TOUCH_TARGET, TOUCH_TARGET)
    c.setInteractive(
      new Phaser.Geom.Rectangle(-TOUCH_TARGET / 2, -TOUCH_TARGET / 2, TOUCH_TARGET, TOUCH_TARGET),
      Phaser.Geom.Rectangle.Contains,
    )
    c.on('pointerdown', () => {
      if (this.paused || this.finished) return
      this.bridge.enqueue('move', { n: direction })
    })
    return c
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
      // The launcher's own limited-axis movement (`config.launcher.move`, LAUNCHER_
      // ACTIONS's `move`) — arrows/space/1-5 are already spoken for, so this is a new
      // binding rather than an overload, and it is direction-generic (works for an
      // 'x' or a 'y' axis) since the config, not the key, decides which axis moves.
      a: Phaser.Input.Keyboard.KeyCodes.A,
      d: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Record<string, Phaser.Input.Keyboard.Key>

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.paused || this.finished || !this.aimEnabled) return
      // A tap on the ammo rack or a move button must NOT also start a slingshot drag
      // from that same point — same bounds-check-and-return pattern flyer/scene.ts
      // uses for its fireBtn/beamBtn against its own whole-canvas pointerdown handler.
      for (const icon of this.ammoIcons) if (icon.getBounds().contains(p.x, p.y)) return
      for (const btn of this.moveButtons) if (btn.getBounds().contains(p.x, p.y)) return
      this.gesture = { dragging: true, startX: p.x, startY: p.y, currentX: p.x, currentY: p.y }
      this.lastEnqueuedAngle = null
      this.lastEnqueuedPower = null
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

  /** Computes the drag's current (angle, power) and enqueues it through
   *  `nextAimToEnqueue`'s dedup — see that function's doc comment for the full
   *  rationale (aim-event flood risk against `validation.max_events`) and why the
   *  decision itself lives in a plain, directly-testable function rather than here. */
  slingshotAim() {
    const st = this.bridge.state
    if (st.projectiles.length > 0 || st.cooldownLeft > 0) return
    const mz = muzzlePoint(st)
    const dx = mz.x - this.gesture.currentX
    const dy = mz.y - this.gesture.currentY
    const dist = Math.sqrt(dx * dx + dy * dy)
    const pct = Math.min(1, dist / st.config.launcher.pull_max_units)
    const angleDeg = Math.round(Phaser.Math.RadToDeg(Math.atan2(-dy, dx)))
    const angle = quantizeAngle(st.config, angleDeg)
    const power = quantizePower(st.config, Math.round(pct * 100))
    const decision = nextAimToEnqueue(
      { angle: this.lastEnqueuedAngle, power: this.lastEnqueuedPower },
      angle,
      power,
    )
    if (!decision) return
    this.lastEnqueuedAngle = decision.angle
    this.lastEnqueuedPower = decision.power
    this.bridge.enqueue('aim', { x: decision.angle, y: decision.power })
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
    const kind = activeProjectile(st)
    // A `guided` projectile accepts in-flight steering (`nudge`) — while one is
    // airborne, LEFT/RIGHT steer it instead of adjusting power (which is meaningless
    // once the shot has already left the launcher). Same two keys, context-switched by
    // flight phase, rather than a second binding nobody would discover.
    const inFlightGuided = st.projectiles.length > 0 && kind?.kind === 'guided'

    if (Phaser.Input.Keyboard.JustDown(this.keys.up!)) this.bridge.enqueue('aim', { x: st.angle + angStep })
    if (Phaser.Input.Keyboard.JustDown(this.keys.down!)) this.bridge.enqueue('aim', { x: st.angle - angStep })

    if (inFlightGuided) {
      // `isDown` is polled every render frame — far more often than the fixed 50ms
      // tick the simulator actually steps on — so this is gated to at most one `nudge`
      // per tick (see `lastNudgeTick`'s doc comment), the same log-growth discipline
      // `slingshotAim` applies to `aim`.
      const dir = this.keys.left!.isDown ? -1 : this.keys.right!.isDown ? 1 : 0
      if (dir !== 0 && this.bridge.tick !== this.lastNudgeTick) {
        this.bridge.enqueue('nudge', { n: dir })
        this.lastNudgeTick = this.bridge.tick
      }
    } else {
      if (Phaser.Input.Keyboard.JustDown(this.keys.left!) && st.cooldownLeft <= 0) this.bridge.enqueue('aim', { y: st.power - pwStep })
      if (Phaser.Input.Keyboard.JustDown(this.keys.right!) && st.cooldownLeft <= 0) this.bridge.enqueue('aim', { y: st.power + pwStep })
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.space!) && st.projectiles.length === 0 && st.cooldownLeft <= 0) { this.bridge.enqueue('launch'); Sfx.whoosh() }
    if (Phaser.Input.Keyboard.JustDown(this.keys.one!)) this.bridge.enqueue('select', { slot: st.config.projectiles[0]?.id })
    if (Phaser.Input.Keyboard.JustDown(this.keys.two!)) this.bridge.enqueue('select', { slot: st.config.projectiles[1]?.id })
    if (Phaser.Input.Keyboard.JustDown(this.keys.three!)) this.bridge.enqueue('select', { slot: st.config.projectiles[2]?.id })
    if (Phaser.Input.Keyboard.JustDown(this.keys.four!)) this.bridge.enqueue('select', { slot: st.config.projectiles[3]?.id })
    if (Phaser.Input.Keyboard.JustDown(this.keys.five!)) this.bridge.enqueue('select', { slot: st.config.projectiles[4]?.id })

    // Limited-axis movement (see `createMoveControls`'s doc comment) — discrete, one
    // step per press, matching `n = -1 | +1` ("one step") in simulate.ts's action doc.
    if (st.config.launcher.move.axis !== 'none') {
      if (Phaser.Input.Keyboard.JustDown(this.keys.a!)) this.bridge.enqueue('move', { n: -1 })
      if (Phaser.Input.Keyboard.JustDown(this.keys.d!)) this.bridge.enqueue('move', { n: 1 })
    }
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
    this.powerText.setText(this.fmt('powerLabel', { value: st.power }))
    this.angleText.setText(this.fmt('angleLabel', { value: st.angle }))
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
    const arrow = wnd > 0 ? '→' : '←'
    this.windText.setText(this.fmt('windLabel', { value: `${arrow} ${Math.abs(wnd).toFixed(1)}` }))
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
      const lbl = this.makeText(o.x + o.w / 2, o.y + o.h / 2, this.fmt(OBSTACLE_LABEL_KEY[o.material]).substring(0, 6), 9, this.palette.text, 15)
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

  /**
   * The ammo rack. Rebuilt every frame (matches this mechanic's existing sync-from-
   * state style for targets/obstacles/projectiles) — cheap relative to the rest of the
   * per-frame work, and destroy() cleanly drops each frame's interactive hit area with
   * it, so there is nothing to leak.
   *
   * Was PURELY DECORATIVE before this fix: `select` (LAUNCHER_ACTIONS) had a keyboard
   * path (keys 1-5) but nothing here was ever `setInteractive()`'d, so a touch-only
   * player — the primary input on this platform (§1.11) — had no way to change ammo at
   * all. Now each slot is a real TOUCH_TARGET (44 design units) button.
   */
  syncAmmoFromState(st: LauncherState) {
    for (const c of this.ammoIcons) c.destroy()
    this.ammoIcons = []
    const x = SCENE_WIDTH - 16 - TOUCH_TARGET / 2
    for (let i = 0; i < st.config.projectiles.length; i++) {
      const p = st.config.projectiles[i]!
      const y = 80 + i * (TOUCH_TARGET + 8)
      const active = i === st.ammoIndex
      let clr = this.palette.accent
      if (p.kind === 'explosive') clr = 0xff3300
      else if (p.kind === 'guided') clr = 0x44aaff
      else if (p.kind === 'heavy') clr = 0x884422
      else if (p.kind === 'light') clr = 0xaaffaa
      const bg = this.makeRect(0, 0, TOUCH_TARGET, TOUCH_TARGET, active ? 0xffffff : 0x222222, active ? 0.3 : 0.15, 0)
        .setStrokeStyle(1, active ? clr : 0x555555, active ? 1 : 0.3)
      const dot = this.makeCircle(0, -8, 7, clr, 1, 1)
      const lbl = this.makeText(0, 12, this.fmt(AMMO_LABEL_KEY[p.kind]).substring(0, 3).toUpperCase(), 9, this.palette.text, 1)
      const container = this.add.container(x, y, [bg, dot, lbl]).setDepth(25)
      container.setSize(TOUCH_TARGET, TOUCH_TARGET)
      container.setInteractive(
        new Phaser.Geom.Rectangle(-TOUCH_TARGET / 2, -TOUCH_TARGET / 2, TOUCH_TARGET, TOUCH_TARGET),
        Phaser.Geom.Rectangle.Contains,
      )
      const slot = p.id
      container.on('pointerdown', () => {
        if (this.paused || this.finished) return
        this.bridge.enqueue('select', { slot })
      })
      this.ammoIcons.push(container)
    }
  }

  updateHUD(st: LauncherState) {
    const snap = this.bridge.snapshot
    this.scoreText.setText(this.fmt('scoreLabel', { score: snap.score }))
    this.roundText.setText(this.fmt('roundLabel', { current: st.round + 1, total: st.config.rounds.length }))
    this.shotsText.setText(this.fmt('shotsLabel', { count: st.shotsLeft }))
    if (st.combo > 1) {
      this.comboText.setText(this.fmt('comboLabel', { count: st.combo }))
      this.comboText.setAlpha(1)
    } else {
      this.comboText.setAlpha(0)
    }
    if (st.lives !== null) {
      this.livesText.setAlpha(1)
      this.livesText.setText(this.fmt('livesLabel', { count: st.lives }))
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
    this.roundStartText.setText(this.fmt('roundStart', { current: st.round + 1, name: round?.id ?? '???' }))
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
      const finalText = this.makeText(SCENE_WIDTH / 2, SCENE_HEIGHT / 2, this.fmt('victory', { score: snap.score }), 28, this.palette.accent, 100)
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
