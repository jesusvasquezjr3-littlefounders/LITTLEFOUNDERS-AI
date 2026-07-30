import Phaser from 'phaser'

export interface GamePalette {
  bg: number
  bgAccent: number
  surface: number
  primary: number
  accent: number
  success: number
  danger: number
  warning: number
  text: number
  inverse: number
  inverseText: number
}

export const PALETTES: Record<string, GamePalette> = {
  'navy-papaya': {
    bg: 0x0a1628,
    bgAccent: 0x122444,
    surface: 0x1a2d5a,
    primary: 0x3b82f6,
    accent: 0xff6b35,
    success: 0x22c55e,
    danger: 0xef4444,
    warning: 0xf59e0b,
    text: 0xf0f4ff,
    inverse: 0xffffff,
    inverseText: 0x0a1628,
  },
  'forest-pear': {
    bg: 0x0a1f14,
    bgAccent: 0x143022,
    surface: 0x1d4532,
    primary: 0x4ade80,
    accent: 0xc3d629,
    success: 0x22c55e,
    danger: 0xef4444,
    warning: 0xf59e0b,
    text: 0xe8f5e9,
    inverse: 0xe8f5e9,
    inverseText: 0x0a1f14,
  },
  'ocean-blue': {
    bg: 0x0c1929,
    bgAccent: 0x142840,
    surface: 0x1a3a5c,
    primary: 0x38bdf8,
    accent: 0xf97316,
    success: 0x22c55e,
    danger: 0xef4444,
    warning: 0xf59e0b,
    text: 0xe0f2fe,
    inverse: 0xe0f2fe,
    inverseText: 0x0c1929,
  },
  'sunset-papaya': {
    bg: 0x1a0f0a,
    bgAccent: 0x2d1a12,
    surface: 0x42281c,
    primary: 0xfbbf24,
    accent: 0xff6b35,
    success: 0x22c55e,
    danger: 0xef4444,
    warning: 0xf59e0b,
    text: 0xfef3c7,
    inverse: 0xfef3c7,
    inverseText: 0x1a0f0a,
  },
  'violet-night': {
    bg: 0x120a1e,
    bgAccent: 0x1e1432,
    surface: 0x2d1f4e,
    primary: 0xa78bfa,
    accent: 0xf472b6,
    success: 0x22c55e,
    danger: 0xef4444,
    warning: 0xf59e0b,
    text: 0xf3e8ff,
    inverse: 0xf3e8ff,
    inverseText: 0x120a1e,
  },
  'sand-clay': {
    bg: 0x1a1814,
    bgAccent: 0x2d2a24,
    surface: 0x423d34,
    primary: 0x94a3b8,
    accent: 0xe8854a,
    success: 0x22c55e,
    danger: 0xef4444,
    warning: 0xf59e0b,
    text: 0xf5f0e8,
    inverse: 0xf5f0e8,
    inverseText: 0x1a1814,
  },
}

export function resolvePalette(paletteId: string): GamePalette {
  const found = (PALETTES as Record<string, GamePalette | undefined>)[paletteId]
  return found ?? PALETTES['navy-papaya']!
}

export function generatePlaceholderSprite(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  color: number,
  shape: 'rect' | 'circle' | 'diamond' = 'rect',
  borderColor?: number,
): void {
  if (scene.textures.exists(key)) return

  const gfx = scene.make.graphics({}, false)

  if (borderColor !== undefined) {
    gfx.lineStyle(2, borderColor, 0.8)
  }

  gfx.fillStyle(color, 1)

  if (shape === 'circle') {
    const r = Math.min(width, height) / 2
    gfx.fillCircle(width / 2, height / 2, r)
    if (borderColor) gfx.strokeCircle(width / 2, height / 2, r)
  } else if (shape === 'diamond') {
    gfx.fillPoints([
      new Phaser.Geom.Point(width / 2, 0),
      new Phaser.Geom.Point(width, height / 2),
      new Phaser.Geom.Point(width / 2, height),
      new Phaser.Geom.Point(0, height / 2),
    ], true)
  } else {
    gfx.fillRoundedRect(0, 0, width, height, 4)
    if (borderColor) gfx.strokeRoundedRect(0, 0, width, height, 4)
  }

  gfx.generateTexture(key, width, height)
  gfx.destroy()
}

export function generateAllPlaceholders(
  scene: Phaser.Scene,
  palette: GamePalette,
  items: Array<{ id: string; color?: number; shape?: 'rect' | 'circle' | 'diamond' }>,
  size: number = 48,
): void {
  for (const item of items) {
    const color = item.color ?? palette.primary
    const shape = item.shape ?? 'rect'
    const key = `item-${item.id}`

    if (scene.textures.exists(key)) continue

    generatePlaceholderSprite(scene, key, size, size, color, shape, palette.text)
  }
}

export function generateBackground(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  palette: GamePalette,
): void {
  if (scene.textures.exists(key)) return

  const gfx = scene.make.graphics({}, false)

  for (let y = 0; y < height; y += 2) {
    const t = y / height
    const r = Phaser.Math.Interpolation.Linear([(palette.bg >> 16) & 0xff, (palette.bgAccent >> 16) & 0xff], t)
    const g = Phaser.Math.Interpolation.Linear([(palette.bg >> 8) & 0xff, (palette.bgAccent >> 8) & 0xff], t)
    const b = Phaser.Math.Interpolation.Linear([palette.bg & 0xff, palette.bgAccent & 0xff], t)
    const color = (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b)
    gfx.fillStyle(color, 1)
    gfx.fillRect(0, y, width, 2)
  }

  gfx.generateTexture(key, width, height)
  gfx.destroy()
}

export function generateButtonTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  bgColor: number,
  textColor: number,
  radius: number = 8,
): void {
  if (scene.textures.exists(key)) return

  const gfx = scene.make.graphics({}, false)

  gfx.fillStyle(bgColor, 1)
  gfx.fillRoundedRect(0, 0, width, height, radius)

  gfx.lineStyle(1, textColor, 0.15)
  gfx.strokeRoundedRect(0, 0, width, height, radius)

  gfx.generateTexture(key, width, height)
  gfx.destroy()
}
