import Phaser from 'phaser'

/**
 * GamePalette values are NOT invented — every hex below is one of the six
 * closed `GAME_PALETTES` rows from /DESIGN.md ("GAME_PALETTES — CLOSED").
 * That table maps each palette id to five DESIGN.md tokens (Stage fill /
 * Stage well / Canvas accent / Highlight / Ink on stage); this module is
 * only responsible for resolving those token NAMES to the hex values
 * already declared in `frontend/src/index.css` (`--lf-*`, light mode) /
 * `frontend/tailwind.config.js`. No new colors are introduced here.
 *
 * Field ↔ DESIGN.md column mapping (see GamePalette below):
 *   bg              = Stage fill
 *   bgAccent/surface = Stage well (two fields, one token — background
 *                      gradient end and card/panel fills read the same
 *                      "interior" depth in the closed table)
 *   primary         = Canvas accent (default game-object tint)
 *   accent          = Highlight (celebration/combo pulses — delight in
 *                      every palette except forest-pear, where pear is
 *                      already the canvas accent so warning is used)
 *   text            = Ink on stage, primary option (`on-inverse` where the
 *                      table offers a pair, matching DESIGN.md's own rule
 *                      that navy-band body text uses `on-inverse`, not the
 *                      `-muted` variant, for anything read at a glance)
 *   inverseText     = the ink token that pairs with whatever fills
 *                      `accent` (i.e. `on-delight` / `on-warning`) — this
 *                      is what every `generateButtonTexture(..., accent,
 *                      inverseText, ...)` call in the mechanics actually
 *                      renders, so it must contrast against a Highlight
 *                      fill, not against the stage background
 *   inverse         = the literal `inverse` token (theme-stable navy,
 *                      identical in both modes per DESIGN.md) — unused by
 *                      any mechanic today, kept as the deep-navy constant
 *                      the field name promises
 *   success/danger/warning = the fixed DESIGN.md semantic signal colors
 *                      (`success` / `error` / `warning`). These are
 *                      feedback signals (correct/wrong/caution), not part
 *                      of the palette table, so they stay constant across
 *                      all six palettes — "the palette never leaves the
 *                      stage" (DESIGN.md).
 *
 * DESIGN.md's `-soft` well tones are PROHIBITED in a palette (they invert
 * between light/dark while the stage does not), and `primary-strong` /
 * `inverse-surface` are the two tokens allowed to shift hue between modes.
 * The game canvas has no live theme signal at texture-generation time, so
 * this file always uses the LIGHT-mode value for those two tokens — see
 * `frontend/src/index.css` `:root` (not `.dark`).
 */
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

// Fixed DESIGN.md feedback-signal tokens — identical across every palette.
const ON_DELIGHT_OR_WARNING = 0x1e1e1e // --lf-on-delight AND --lf-on-warning (both 30 30 30 in index.css)
const SIGNAL_SUCCESS = 0x15b441 // --lf-success (21 180 65)
const SIGNAL_DANGER = 0xba1a1a // --lf-error (186 26 26)
const SIGNAL_WARNING = 0xff8d23 // --lf-warning (255 141 35)
const LITERAL_INVERSE = 0x080f28 // --lf-inverse (8 15 40) — theme-stable, DESIGN.md "identical in light and dark"

export const PALETTES: Record<string, GamePalette> = {
  // Stage fill=inverse, Stage well=inverse-surface, Canvas accent=accent,
  // Highlight=delight, Ink on stage=on-inverse/on-inverse-muted.
  'navy-papaya': {
    bg: 0x080f28, // --lf-inverse
    bgAccent: 0x142563, // --lf-inverse-surface
    surface: 0x142563, // --lf-inverse-surface
    primary: 0xff775c, // --lf-accent (papaya)
    accent: 0xd8e82e, // --lf-delight (pear)
    success: SIGNAL_SUCCESS,
    danger: SIGNAL_DANGER,
    warning: SIGNAL_WARNING,
    text: 0xffffff, // --lf-on-inverse
    inverse: LITERAL_INVERSE,
    inverseText: ON_DELIGHT_OR_WARNING, // --lf-on-delight
  },
  // Stage fill=success-strong, Stage well=success, Canvas accent=delight,
  // Highlight=warning (pear is already the canvas accent here), Ink=on-success.
  'forest-pear': {
    bg: 0x109634, // --lf-success-strong
    bgAccent: 0x15b441, // --lf-success
    surface: 0x15b441, // --lf-success
    primary: 0xd8e82e, // --lf-delight (pear)
    accent: 0xff8d23, // --lf-warning (Highlight exception for this palette)
    success: SIGNAL_SUCCESS,
    danger: SIGNAL_DANGER,
    warning: SIGNAL_WARNING,
    text: 0xffffff, // --lf-on-success
    inverse: LITERAL_INVERSE,
    inverseText: ON_DELIGHT_OR_WARNING, // --lf-on-warning (accent field is warning here)
  },
  // Stage fill=inverse-surface, Stage well=inverse, Canvas accent=accent,
  // Highlight=delight, Ink on stage=on-inverse/on-inverse-muted.
  'ocean-blue': {
    bg: 0x142563, // --lf-inverse-surface
    bgAccent: 0x080f28, // --lf-inverse
    surface: 0x080f28, // --lf-inverse
    primary: 0xff775c, // --lf-accent (papaya)
    accent: 0xd8e82e, // --lf-delight (pear)
    success: SIGNAL_SUCCESS,
    danger: SIGNAL_DANGER,
    warning: SIGNAL_WARNING,
    text: 0xffffff, // --lf-on-inverse
    inverse: LITERAL_INVERSE,
    inverseText: ON_DELIGHT_OR_WARNING, // --lf-on-delight
  },
  // Stage fill=accent-strong, Stage well=accent, Canvas accent=inverse,
  // Highlight=delight, Ink on stage=on-accent.
  'sunset-papaya': {
    bg: 0xe55f45, // --lf-accent-strong
    bgAccent: 0xff775c, // --lf-accent
    surface: 0xff775c, // --lf-accent
    primary: 0x080f28, // --lf-inverse (Canvas accent for this palette)
    accent: 0xd8e82e, // --lf-delight (pear)
    success: SIGNAL_SUCCESS,
    danger: SIGNAL_DANGER,
    warning: SIGNAL_WARNING,
    text: 0x080f28, // --lf-on-accent (dark navy on papaya, never white)
    inverse: LITERAL_INVERSE,
    inverseText: ON_DELIGHT_OR_WARNING, // --lf-on-delight
  },
  // DESIGN.md: no literal violet token exists — realized as the deepest
  // navy stage with a cool primary-strong accent (a night canvas with no
  // papaya competing against chrome). Stage fill=inverse, Stage
  // well=inverse-surface, Canvas accent=primary-strong, Highlight=delight,
  // Ink on stage=on-inverse/on-inverse-muted.
  'violet-night': {
    bg: 0x080f28, // --lf-inverse
    bgAccent: 0x142563, // --lf-inverse-surface
    surface: 0x142563, // --lf-inverse-surface
    primary: 0x375ce3, // --lf-primary-strong (light-mode value: 55 92 227)
    accent: 0xd8e82e, // --lf-delight (pear)
    success: SIGNAL_SUCCESS,
    danger: SIGNAL_DANGER,
    warning: SIGNAL_WARNING,
    text: 0xffffff, // --lf-on-inverse
    inverse: LITERAL_INVERSE,
    inverseText: ON_DELIGHT_OR_WARNING, // --lf-on-delight
  },
  // DESIGN.md: no sand/clay token exists — realized from the warning family,
  // the closest warm earth tone the closed set has. Stage fill=warning-strong,
  // Stage well=warning, Canvas accent=inverse, Highlight=delight, Ink=on-warning.
  'sand-clay': {
    bg: 0xe07412, // --lf-warning-strong
    bgAccent: 0xff8d23, // --lf-warning
    surface: 0xff8d23, // --lf-warning
    primary: 0x080f28, // --lf-inverse (Canvas accent for this palette)
    accent: 0xd8e82e, // --lf-delight (pear)
    success: SIGNAL_SUCCESS,
    danger: SIGNAL_DANGER,
    warning: SIGNAL_WARNING,
    text: ON_DELIGHT_OR_WARNING, // --lf-on-warning (30 30 30, same value as on-delight)
    inverse: LITERAL_INVERSE,
    inverseText: ON_DELIGHT_OR_WARNING, // --lf-on-delight
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
