import Phaser from 'phaser'

// Structural, not imported from ./scene — a `type` import of BaseMechanicScene would
// work too (TS erases it), but this avoids any coupling at all: any Phaser.Scene that
// happens to carry a `reducedMotion` flag (which BaseMechanicScene always does, per
// its `init()`) satisfies this without scene.ts and juice.ts knowing about each other.
interface MotionAwareScene extends Phaser.Scene {
  reducedMotion?: boolean
}

/** GAME_ENGINE.md §10 / CLAUDE.md §1.11: reduced motion disables DECORATIVE effects
 *  only — never the simulation, never scoring, never completion. Every camera shake,
 *  flash and particle burst in this file is gated on this at the source, so no scene
 *  call site has to remember to check it. */
function isReduced(scene: Phaser.Scene): boolean {
  return (scene as MotionAwareScene).reducedMotion === true
}

const SHAKE_DEFAULTS = {
  light: { intensity: 0.003, duration: 120 },
  medium: { intensity: 0.008, duration: 220 },
  heavy: { intensity: 0.018, duration: 400 },
  collect: { intensity: 0.002, duration: 80 },
  combo: { intensity: 0.006, duration: 200 },
  explosion: { intensity: 0.025, duration: 600 },
  wrong: { intensity: 0.004, duration: 150 },
}

export function addShake(
  scene: Phaser.Scene,
  preset: keyof typeof SHAKE_DEFAULTS | { intensity: number; duration: number },
): void {
  if (isReduced(scene)) return
  const p = typeof preset === 'string' ? SHAKE_DEFAULTS[preset] : preset
  scene.cameras.main.shake(p.duration, p.intensity)
}

export function addFlash(scene: Phaser.Scene, color: number = 0xffffff, duration: number = 80): void {
  if (isReduced(scene)) return
  scene.cameras.main.flash(duration, (color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff)
}

export function hitPause(scene: Phaser.Scene, ms: number): void {
  scene.time.timeScale = 0
  scene.time.delayedCall(ms, () => {
    scene.time.timeScale = 1
  })
}

export function scalePunch(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Sprite | Phaser.GameObjects.Container | Phaser.GameObjects.Image,
  peakScale: number = 1.18,
  duration: number = 220,
): void {
  if (isReduced(scene)) return
  const origX = target.scaleX
  const origY = target.scaleY
  scene.tweens.add({
    targets: target,
    scaleX: peakScale,
    scaleY: peakScale,
    duration: duration * 0.4,
    yoyo: true,
    hold: 0,
    ease: 'Back.easeOut',
    onComplete: () => {
      target.setScale(origX, origY)
    },
  })
}

export function floatText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color: string = '#ffffff',
  duration: number = 800,
): void {
  const t = scene.add.text(x, y, text, {
    fontFamily: 'Figtree, sans-serif',
    fontSize: '20px',
    fontStyle: 'bold',
    color,
    stroke: '#000000',
    strokeThickness: 3,
  })
  t.setOrigin(0.5)
  t.setDepth(100)

  // The TEXT is informational (a score delta, a label) and stays either way — only the
  // upward float + scale-up motion is decorative and drops under reduced motion; a
  // plain fade keeps the information legible without the translation.
  const reduced = isReduced(scene)
  scene.tweens.add({
    targets: t,
    y: reduced ? y : y - 50,
    alpha: 0,
    scale: reduced ? 1 : 1.3,
    duration: reduced ? Math.min(duration, 400) : duration,
    ease: 'Cubic.easeOut',
    onComplete: () => t.destroy(),
  })
}

export interface ParticleBurstConfig {
  texture: string
  count?: number
  speed?: { min: number; max: number }
  lifespan?: number
  scale?: { start: number; end: number }
  alpha?: { start: number; end: number }
  gravityY?: number
  tint?: number[]
}

export function burstParticles(
  scene: Phaser.Scene,
  x: number,
  y: number,
  config: ParticleBurstConfig,
): void {
  if (isReduced(scene)) return
  const particles = scene.add.particles(x, y, config.texture, {
    speed: config.speed ?? { min: 60, max: 200 },
    lifespan: config.lifespan ?? 500,
    scale: config.scale ?? { start: 0.8, end: 0 },
    alpha: config.alpha ?? { start: 1, end: 0 },
    gravityY: config.gravityY ?? 200,
    tint: config.tint,
    quantity: config.count ?? 10,
    emitting: false,
  })
  particles.setDepth(90)
  particles.explode(config.count ?? 10)

  scene.time.delayedCall((config.lifespan ?? 500) + 100, () => {
    particles.destroy()
  })
}

export function trailParticles(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
  texture: string,
  tint?: number,
): Phaser.GameObjects.Particles.ParticleEmitter {
  // Reduced motion: return a real (but inert) emitter rather than skipping creation —
  // callers may keep the handle for the object's lifetime and call .stop()/.destroy()
  // on it; `frequency: -1` means it simply never emits.
  const reduced = isReduced(scene)
  const emitter = scene.add.particles(0, 0, texture, {
    follow: target,
    followOffset: { x: 0, y: 0 },
    speed: { min: 5, max: 20 },
    scale: { start: 0.4, end: 0 },
    alpha: { start: 0.6, end: 0 },
    lifespan: 250,
    frequency: reduced ? -1 : 40,
    quantity: 1,
    tint: tint !== undefined ? tint : 0xffffff,
  })
  emitter.setDepth(target.depth - 0.5)
  return emitter
}

export function createParticleTextures(scene: Phaser.Scene): void {
  const textures: Array<{ key: string; size: number; color: number; shape: 'circle' | 'square' }> = [
    { key: 'px-circle-white', size: 8, color: 0xffffff, shape: 'circle' },
    { key: 'px-circle-gold', size: 8, color: 0xffd700, shape: 'circle' },
    { key: 'px-circle-red', size: 8, color: 0xff4444, shape: 'circle' },
    { key: 'px-circle-green', size: 8, color: 0x44ff44, shape: 'circle' },
    { key: 'px-square-white', size: 6, color: 0xffffff, shape: 'square' },
    { key: 'px-square-gold', size: 6, color: 0xffd700, shape: 'square' },
  ]

  for (const t of textures) {
    if (scene.textures.exists(t.key)) continue

    const gfx = scene.make.graphics({}, false)
    gfx.fillStyle(t.color, 1)
    if (t.shape === 'circle') {
      gfx.fillCircle(t.size / 2, t.size / 2, t.size / 2)
    } else {
      gfx.fillRect(0, 0, t.size, t.size)
    }
    gfx.generateTexture(t.key, t.size, t.size)
    gfx.destroy()
  }
}

export function spawnCorrectParticles(scene: Phaser.Scene, x: number, y: number): void {
  burstParticles(scene, x, y, {
    texture: 'px-circle-gold',
    count: 8,
    speed: { min: 80, max: 200 },
    lifespan: 500,
    scale: { start: 1, end: 0 },
    gravityY: 150,
  })
  addShake(scene, 'collect')
}

export function spawnWrongParticles(scene: Phaser.Scene, x: number, y: number): void {
  burstParticles(scene, x, y, {
    texture: 'px-circle-red',
    count: 6,
    speed: { min: 50, max: 120 },
    lifespan: 400,
    scale: { start: 0.8, end: 0 },
    gravityY: 100,
  })
  addShake(scene, 'wrong')
}

export function spawnExplosion(scene: Phaser.Scene, x: number, y: number): void {
  burstParticles(scene, x, y, {
    texture: 'px-circle-white',
    count: 20,
    speed: { min: 100, max: 350 },
    lifespan: 700,
    scale: { start: 1.2, end: 0 },
    tint: [0xff6600, 0xffcc00, 0xff3300],
    gravityY: 100,
  })
  burstParticles(scene, x, y, {
    texture: 'px-circle-gold',
    count: 12,
    speed: { min: 150, max: 400 },
    lifespan: 500,
    scale: { start: 0.8, end: 0 },
    gravityY: 50,
  })
  addShake(scene, 'explosion')
  addFlash(scene, 0xff8800, 100)
}

export function spawnCollectSparkles(scene: Phaser.Scene, x: number, y: number): void {
  burstParticles(scene, x, y, {
    texture: 'px-circle-gold',
    count: 12,
    speed: { min: 60, max: 180 },
    lifespan: 450,
    scale: { start: 0.7, end: 0 },
    gravityY: -50,
    alpha: { start: 1, end: 0 },
  })
}

export function spawnConfetti(scene: Phaser.Scene, x: number, y: number, count = 40): void {
  burstParticles(scene, x, y, {
    texture: 'px-square-gold',
    count,
    speed: { min: 60, max: 250 },
    lifespan: 2000,
    scale: { start: 0.8, end: 0.2 },
    gravityY: 80,
    alpha: { start: 1, end: 0 },
  })
  burstParticles(scene, x, y - 20, {
    texture: 'px-circle-white',
    count: Math.floor(count / 2),
    speed: { min: 40, max: 150 },
    lifespan: 1500,
    scale: { start: 0.6, end: 0 },
    gravityY: 120,
    alpha: { start: 1, end: 0 },
  })
}
