import Phaser from 'phaser'

import {
  generateBackground,
  generateButtonTexture,
  generatePlaceholderSprite,
} from '@/game-engine/phaser/assets'
import { GameEngineBridge } from '@/game-engine/phaser/bridge'
import {
  addFlash,
  addShake,
  burstParticles,
  floatText,
  scalePunch,
  spawnConfetti,
  spawnExplosion,
} from '@/game-engine/phaser/juice'
import { BaseMechanicScene } from '@/game-engine/phaser/scene'
import { Sfx } from '@/game-engine/phaser/sfx'

import {
  costOfPiece,
  stackerConfigSchema,
  stackerContentSchema,
  type StackerConfig,
  type StackerPiece,
} from './schema'
import {
  assistActive,
  budgetLeft,
  heightOf,
  rotatedSize,
  seatY,
  snapX,
  stackerSimulator,
  type StackerBody,
  type StackerState,
} from './simulate'

const BG_KEY = 'stacker-bg'
const GROUND_KEY = 'stacker-ground'
const BASE_KEY = 'stacker-base'
const GHOST_KEY = 'stacker-ghost'
const PIECE_PREFIX = 'stacker-piece-'
const CATALOG_BG_KEY = 'stacker-catalog-bg'
const BTN_ROTATE_KEY = 'stacker-btn-rotate'
const BTN_READY_KEY = 'stacker-btn-ready'
const BTN_REMOVE_KEY = 'stacker-btn-remove'
const BTN_ASSIST_KEY = 'stacker-btn-assist'
const BAR_BG_KEY = 'stacker-bar-bg'
const BAR_FILL_KEY = 'stacker-bar-fill'
const CATALOG_SLOT_KEY = 'stacker-catalog-slot'

const FIELD_DEPTH = 0
const GROUND_DEPTH = 2
const BASE_DEPTH = 3
const PIECE_DEPTH = 10
const GHOST_DEPTH = 9
const HUD_DEPTH = 20
const CATALOG_DEPTH = 15
const TIMELINE_DEPTH = 18

const PROPERTY_COLORS: Record<string, number> = {
  adhesive: 0xffdd44,
  brittle: 0x888888,
  magnetic: 0x44aaff,
  elastic: 0x44ff44,
  counterweight: 0xff8800,
}

const FORCE_ICONS: Record<string, string> = {
  wind: '\u{1F4A8}',
  vibration: '\u{223C}',
  earthquake: '\u{1F30B}',
  rain: '\u{1F327}',
  load: '\u{1F4A3}',
}

// ---- Touch-target floor (GAME_ENGINE.md §10, CLAUDE.md §1.11: >= 44x44 REAL px for
// every control, including in-canvas ones) ----------------------------------------
//
// Phaser draws in DESIGN-SPACE pixels; what actually reaches a child's finger is that
// size run through Phaser.Scale.FIT (PhaserGameBox authors a fixed 800x600 canvas and
// lets FIT scale the whole thing down to whatever the container measures). The worst
// case this platform supports is mobile at 375px wide, with content filling it inside
// DESIGN.md's 16px `margin-mobile` on each side (CLAUDE.md §1.11) — so the container is
// never narrower than 375 - 2*16 = 343px, and the FIT ratio never below 343 / 800. A
// design-space control needs 44 / (343/800) ~= 102.7 design px on a side to still read
// as >=44 real px at that floor; 104 gives a small safety margin.
//
// KNOWN SIMPLIFICATION: this assumes the scene's own camera zoom is 1. Stacker (like
// sorter and explorer, 695891c) overrides `getWorldSize()` to fit the camera to its own
// `config.field`, which can be LARGER than the 800x600 canvas — a manifest that does
// zooms every draw call down further, buttons included, so the true worst-case floor
// for such a manifest is larger than 104. Both reference fixtures (fixtures.ts:
// 900x540 and 960x560) sit close enough to the canvas's own aspect that the zoom stays
// near 0.83-0.89, not far off 1 — so 104 is a reasonable floor for the documents this
// engine ships today, but it is NOT camera-zoom-aware, and a future manifest with a
// much larger `field` would need a bigger floor than this constant provides. Flagged as
// a follow-up rather than solved here since a camera-zoom-aware floor is a change that
// belongs to every mechanic with a getWorldSize override, not just this file.
// Exported so stacker.test.ts can assert the floor's own arithmetic against the
// documented 44-real-px requirement without re-deriving (and risking silently
// diverging from) the same formula inside the test file.
export const MIN_HIT_DESIGN_PX = 104
export const READY_BTN_WIDTH = Math.round(MIN_HIT_DESIGN_PX * 1.6)
/** Bottom catalog tray height: the enlarged slot plus room for its cost/mass labels
 *  and a little breathing room, so the >=104px slots (below) are not clipped. */
const CATALOG_HEIGHT = MIN_HIT_DESIGN_PX + 28

interface PieceView {
  uid: number
  body: StackerBody
  rect: Phaser.GameObjects.Rectangle
  propGlow: Phaser.GameObjects.Rectangle | null
  label: Phaser.GameObjects.Text | null
}

interface CatalogSlot {
  pieceIndex: number
  piece: StackerPiece
  container: Phaser.GameObjects.Container
  bg: Phaser.GameObjects.Image
  icon: Phaser.GameObjects.Rectangle
  costLabel: Phaser.GameObjects.Text
  massLabel: Phaser.GameObjects.Text
  propIndicator: Phaser.GameObjects.Rectangle | null
}

export class StackerScene extends BaseMechanicScene<StackerState> {
  private pieceViews: Map<number, PieceView> = new Map()
  private catalogSlots: CatalogSlot[] = []
  private ghostRect: Phaser.GameObjects.Rectangle | null = null
  private budgetBar: Phaser.GameObjects.Image | null = null
  private budgetBarBg: Phaser.GameObjects.Image | null = null
  private heightBar: Phaser.GameObjects.Image | null = null
  private heightBarBg: Phaser.GameObjects.Image | null = null
  private budgetLabel: Phaser.GameObjects.Text | null = null
  private heightLabel: Phaser.GameObjects.Text | null = null
  private scoreLabel: Phaser.GameObjects.Text | null = null
  private phaseLabel: Phaser.GameObjects.Text | null = null
  private livesLabel: Phaser.GameObjects.Text | null = null
  private timelineTexts: Phaser.GameObjects.Text[] = []
  private marginBar: Phaser.GameObjects.Rectangle | null = null
  private marginBarFill: Phaser.GameObjects.Rectangle | null = null
  private holdBar: Phaser.GameObjects.Rectangle | null = null
  private holdBarFill: Phaser.GameObjects.Rectangle | null = null
  private readyBtn: Phaser.GameObjects.Container | null = null
  private removeBtn: Phaser.GameObjects.Container | null = null
  private rotateBtn: Phaser.GameObjects.Container | null = null
  private assistBtn: Phaser.GameObjects.Container | null = null
  private rotationStep = 0
  /** Design-space x of the current ghost preview — set by pointer HOVER and by the
   *  keyboard's ArrowLeft/ArrowRight (`nudgeGhostX`), so both input paths share one
   *  "where would this piece land" idea instead of drifting out of sync. `null` means
   *  no piece is selected/no ghost is showing. */
  private ghostX: number | null = null
  private prevPhase: string | null = null
  private prevCollapses = 0
  private prevPlacements = 0
  private prevRemovals = 0
  private prevWon = false
  private prevTestTicks = 0
  private forceParticles: Phaser.GameObjects.Particles.ParticleEmitter[] = []

  constructor() {
    super('stacker')
  }

  createBridge(): { bridge: GameEngineBridge<StackerState>; simInit: import('@/game-engine/core/types').SimInit } {
    const configParse = stackerConfigSchema.safeParse(this.doc.config)
    const contentParse = stackerContentSchema.safeParse(this.doc.content)
    if (!configParse.success || !contentParse.success) throw new Error('Invalid stacker document')
    const simInit = {
      config: configParse.data,
      content: contentParse.data,
      scoring: this.doc.scoring,
      seed: this.seed,
    }
    return { bridge: new GameEngineBridge(stackerSimulator, simInit, this.maxTicks), simInit }
  }

  protected override getWorldSize(): { width: number; height: number } {
    // Same rationale as sorter: `config.field` is authored per-manifest and can
    // legitimately differ from the fixed 800x600 canvas.
    const { field } = this.bridge.state.config
    return { width: field.width, height: field.height }
  }

  createGameObjects(): void {
    const state = this.bridge.state
    const { config } = state
    const W = config.field.width
    const H = config.field.height

    generateBackground(this, BG_KEY, W, H, this.palette)
    this.add.image(W / 2, H / 2, BG_KEY).setDepth(FIELD_DEPTH)

    generatePlaceholderSprite(this, GROUND_KEY, W, 40, this.palette.surface, 'rect')
    this.add.image(W / 2, config.field.ground_y, GROUND_KEY).setOrigin(0.5, 0).setDepth(GROUND_DEPTH)

    const baseW = config.field.base_width
    const baseX = config.field.base_x
    const baseY = config.field.ground_y
    generatePlaceholderSprite(this, BASE_KEY, baseW, 16, this.palette.accent, 'rect', this.palette.text)
    this.add.image(baseX, baseY, BASE_KEY).setOrigin(0.5, 1).setDepth(BASE_DEPTH)

    generatePlaceholderSprite(this, GHOST_KEY, 48, 48, this.palette.accent, 'rect', this.palette.text)

    generatePlaceholderSprite(this, BAR_BG_KEY, 200, 14, this.palette.bgAccent, 'rect')
    generatePlaceholderSprite(this, BAR_FILL_KEY, 200, 14, this.palette.success, 'rect')
    generatePlaceholderSprite(this, CATALOG_BG_KEY, W, CATALOG_HEIGHT, this.palette.bgAccent, 'rect')

    // Catalog slots and every in-canvas button share the same >=44px-real touch-target
    // floor (GAME_ENGINE.md §10) — see MIN_HIT_DESIGN_PX's doc comment above.
    generatePlaceholderSprite(this, CATALOG_SLOT_KEY, MIN_HIT_DESIGN_PX, MIN_HIT_DESIGN_PX, this.palette.surface, 'rect', this.palette.primary)

    generateButtonTexture(this, BTN_ROTATE_KEY, MIN_HIT_DESIGN_PX, MIN_HIT_DESIGN_PX, this.palette.surface, this.palette.text, 12)
    generateButtonTexture(this, BTN_REMOVE_KEY, MIN_HIT_DESIGN_PX, MIN_HIT_DESIGN_PX, this.palette.warning, this.palette.text, 12)
    generateButtonTexture(this, BTN_ASSIST_KEY, MIN_HIT_DESIGN_PX, MIN_HIT_DESIGN_PX, this.palette.surface, this.palette.text, 12)
    generateButtonTexture(this, BTN_READY_KEY, READY_BTN_WIDTH, MIN_HIT_DESIGN_PX, this.palette.accent, this.palette.inverseText, 14)

    this.createCatalog(config)
    this.createHUD(config)
    this.createButtons()

    this.prevPhase = state.phase
  }

  setupInput(): void {
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.paused || this.finished) return
      const state = this.bridge.state
      if (state.phase !== 'build') return

      const selectedIdx = this.catalogSlots.findIndex((slot) => {
        return this.catalogSlots.indexOf(slot) === this.getLastClickedSlotIndex()
      })
      if (selectedIdx < 0) return

      const piece = this.catalogSlots[selectedIdx]?.piece
      if (!piece) return
      // `worldX`/`worldY` (not `x`/`y`): `getWorldSize()` zooms the camera for any
      // manifest whose `field` differs from 800x600, and `ground_y`/piece placement
      // are all WORLD coordinates — `camera.getWorldPoint()`'s result, which Phaser's
      // own InputManager already wrote into `pointer.worldX/worldY` before this
      // listener runs (verified against node_modules/phaser/src/input/
      // InputManager.js's `hitTest`). Raw `x`/`y` are pre-zoom canvas coordinates and
      // silently miss the field whenever the camera isn't at zoom 1.
      if (pointer.worldY < state.config.field.ground_y - 20) {
        const snapXPos = snapX(state.config, pointer.worldX, piece.w)
        // Kept in sync with pointer hover so a subsequent keyboard nudge (ArrowLeft/
        // ArrowRight) continues from wherever the mouse last left the ghost, instead
        // of jumping back to a stale keyboard-only position.
        this.ghostX = snapXPos
        this.updateGhost(snapXPos, this.ghostSeatY(snapXPos, piece, selectedIdx), piece.w, piece.h)
      } else {
        this.hideGhost()
      }
    })

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.paused || this.finished) return
      const state = this.bridge.state

      if (state.phase === 'build' && pointer.worldY < state.config.field.ground_y - 20) {
        const selectedIdx = this.getLastClickedSlotIndex()
        if (selectedIdx < 0) return
        const slot = this.catalogSlots[selectedIdx]
        if (!slot) return
        this.placePiece(slot, pointer.worldX)
        return
      }
    })

    this.setupKeyboard()
  }

  /**
   * Keyboard equivalents for the report's placement controls (GAME_ENGINE.md §4/§5:
   * "ghost preview, step rotation, drop vs snap") and for the in-canvas buttons
   * (§10: "every interaction has a tap/keyboard path"). Each handler below is the
   * SAME method the matching pointer control calls (`rotateGhost`, `removeLastPiece`,
   * `toggleAssist`, `triggerReady`), so the two input paths can never drift apart:
   *
   *   Tab / Shift+Tab   — cycle which catalog piece is selected (the pointer path's
   *                       equivalent is tapping a catalog slot; without this there is
   *                       no way to choose a piece at all without a pointer, so the
   *                       three controls named in the report would be unreachable).
   *   ArrowLeft/Right   — move the ghost preview (nudges by one `snap_grid` step).
   *   R                 — step rotation (same as the rotate button).
   *   Enter / Space     — commit: drop/snap the ghost if a piece is selected and
   *                       showing, otherwise end the build phase early (same as the
   *                       READY button) — the same two-purpose "confirm the current
   *                       step" the pointer flow already has (tap a bin location to
   *                       drop; tap READY, unrelated to any selection, to end early).
   *   Backspace/Delete  — remove the most recently placed piece (same as the remove
   *                       button).
   *   A                 — toggle adaptive assistance (same as the Help/assist button).
   */
  private setupKeyboard(): void {
    const keyboard = this.input.keyboard
    if (!keyboard) return

    keyboard.on('keydown-LEFT', () => this.nudgeGhostX(-1))
    keyboard.on('keydown-RIGHT', () => this.nudgeGhostX(1))
    keyboard.on('keydown-R', () => this.rotateGhost())
    keyboard.on('keydown-ENTER', () => this.confirmBuildAction())
    keyboard.on('keydown-SPACE', () => this.confirmBuildAction())
    keyboard.on('keydown-TAB', (event: KeyboardEvent) => {
      // Tab normally moves DOM focus away from the canvas; this is the one key this
      // scene claims for its own purpose, so (and only so) it prevents that default.
      event.preventDefault()
      this.cycleCatalogSelection(event.shiftKey ? -1 : 1)
    })
    keyboard.on('keydown-BACKSPACE', () => this.removeLastPiece())
    keyboard.on('keydown-DELETE', () => this.removeLastPiece())
    keyboard.on('keydown-A', () => this.toggleAssist())
  }

  updateGameObjects(_delta: number): void {
    const state = this.bridge.state
    const { config } = state

    this.syncPieces()

    if (this.budgetLabel) {
      const remaining = budgetLeft(state)
      this.budgetLabel.setText(`${remaining}`)
    }
    if (this.budgetBar && this.budgetBarBg) {
      const pct = Math.max(0, Math.min(1, budgetLeft(state) / config.economy.budget))
      this.budgetBar.setDisplaySize(this.budgetBarBg.width * pct, this.budgetBarBg.height)
    }
    if (this.heightLabel) {
      const h = heightOf(state)
      this.heightLabel.setText(this.formatHeight(Math.round(h)))
    }
    if (this.heightBar && this.heightBarBg) {
      const pct = Math.max(0, Math.min(1, heightOf(state) / config.stability.target_height))
      this.heightBar.setDisplaySize(this.heightBarBg.width * pct, this.heightBarBg.height)
    }
    if (this.scoreLabel) {
      this.scoreLabel.setText(`${Math.round(this.bridge.snapshot.score)}`)
    }
    if (this.phaseLabel) {
      this.phaseLabel.setText(state.phase === 'build' ? (this.strings['build'] ?? 'build') : (this.strings['test'] ?? 'test'))
      this.phaseLabel.setColor(state.phase === 'test' ? '#ff6b35' : '#3b82f6')
    }
    if (this.livesLabel && state.lives !== null) {
      this.livesLabel.setText(`${'\u{2764}'} ${state.lives}`)
    }

    this.syncTimeline(state)

    if (state.phase === 'test') {
      this.syncMarginUI(state)
      this.syncForceEffects(state)
    }

    if (state.phase !== this.prevPhase && state.phase === 'test') {
      Sfx.whoosh()
      addFlash(this, this.palette.accent, 150)
      this.hideGhost()
    }

    if (state.collapses > this.prevCollapses) {
      Sfx.explosion()
      spawnExplosion(this, config.field.width / 2, config.field.ground_y - 40)
      addShake(this, 'heavy')
      addFlash(this, this.palette.danger, 200)
    }

    if (state.placements > this.prevPlacements) {
      Sfx.click()
      const lastBody = state.bodies[state.bodies.length - 1]
      if (lastBody) {
        this.scalePunchPiece(lastBody.uid)
        this.spawnPlaceParticles(lastBody.x, lastBody.y)
      }
    }

    if (state.removals > this.prevRemovals) {
      Sfx.pop()
    }

    if (state.won && !this.prevWon) {
      Sfx.levelUp()
      spawnConfetti(this, config.field.width / 2, config.field.ground_y - 60, 50)
      floatText(this, config.field.width / 2, config.field.ground_y - 120, this.strings['stable'] ?? 'stable', '#22c55e', 2000)
    }

    if (state.assistOn && state.collapses >= config.assist.ease_after_failures) {
      Sfx.powerUp()
    }

    this.updateCatalogUseCounts(state)
    this.updateRemoveButton(state)
    this.updateAssistButton(state)

    this.prevPhase = state.phase
    this.prevCollapses = state.collapses
    this.prevPlacements = state.placements
    this.prevRemovals = state.removals
    this.prevWon = state.won
    this.prevTestTicks = state.testTicks
  }

  private createCatalog(config: StackerConfig): void {
    const catalogH = CATALOG_HEIGHT
    const catalogY = config.field.height - catalogH / 2

    this.add.image(config.field.width / 2, catalogY, CATALOG_BG_KEY).setDepth(CATALOG_DEPTH)

    const slotSize = MIN_HIT_DESIGN_PX
    const padding = 10
    const totalW = config.catalog.length * (slotSize + padding) - padding
    const startX = (config.field.width - totalW) / 2 + slotSize / 2

    for (let i = 0; i < config.catalog.length; i += 1) {
      const piece = config.catalog[i]
      if (!piece) continue

      const slotX = startX + i * (slotSize + padding)
      const container = this.add.container(slotX, catalogY)
      container.setDepth(CATALOG_DEPTH + 1)
      container.setSize(slotSize, slotSize)

      const bg = this.add.image(0, 0, CATALOG_SLOT_KEY)
      bg.setInteractive({ cursor: 'pointer' })
      container.add(bg)

      const pieceKey = `${PIECE_PREFIX}${piece.item_id}`
      const color = this.getPieceColor(piece)
      const shape = piece.shape === 'circle' ? 'circle' : 'rect'
      generatePlaceholderSprite(this, pieceKey, slotSize - 12, slotSize - 12, color, shape, this.palette.text)

      const icon = this.add.rectangle(0, -4, slotSize - 12, slotSize - 12, color, 1)
      icon.setStrokeStyle(1, this.palette.text, 0.4)
      container.add(icon)

      const costLabel = this.makeText(0, slotSize / 2 - 10, `${costOfPiece(config, piece)}`, 11, this.palette.text, CATALOG_DEPTH + 2)
      container.add(costLabel)

      const massLabel = this.makeText(0, -slotSize / 2 + 10, `${piece.mass}`, 10, this.palette.primary, CATALOG_DEPTH + 2)
      container.add(massLabel)

      let propIndicator: Phaser.GameObjects.Rectangle | null = null
      if (piece.property !== 'none') {
        const propColor = PROPERTY_COLORS[piece.property] ?? this.palette.warning
        propIndicator = this.add.rectangle(slotSize / 2 - 6, -slotSize / 2 + 6, 8, 8, propColor, 1)
        propIndicator.setDepth(CATALOG_DEPTH + 3)
        container.add(propIndicator)
      }

      const idx = i
      bg.on('pointerdown', () => {
        if (this.paused || this.finished) return
        if (this.bridge.state.phase !== 'build') return
        this.selectCatalogSlot(idx)
        // A newly-tapped piece may be a different size than whatever was previously
        // selected; drop the stale x so the ghost re-derives a fresh, valid one
        // (`refreshGhostForSelection`/pointermove both handle `null` as "no position
        // yet, use the base's centre").
        this.ghostX = null
        Sfx.click()
      })

      bg.on('pointerover', () => {
        this.tweens.add({ targets: container, scaleX: 1.08, scaleY: 1.08, duration: 100, ease: 'Sine.easeOut' })
      })
      bg.on('pointerout', () => {
        if (this.getLastClickedSlotIndex() !== idx) {
          this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 100, ease: 'Sine.easeOut' })
        }
      })

      this.catalogSlots.push({
        pieceIndex: i,
        piece,
        container,
        bg,
        icon,
        costLabel,
        massLabel,
        propIndicator,
      })
    }
  }

  private lastClickedSlotIndex = -1

  private getLastClickedSlotIndex(): number {
    return this.lastClickedSlotIndex
  }

  private selectCatalogSlot(index: number): void {
    const prev = this.catalogSlots[this.lastClickedSlotIndex]
    if (prev) {
      this.tweens.add({ targets: prev.container, scaleX: 1, scaleY: 1, duration: 100, ease: 'Sine.easeOut' })
    }
    this.lastClickedSlotIndex = index
    const next = this.catalogSlots[index]
    if (next) {
      this.tweens.add({ targets: next.container, scaleX: 1.12, scaleY: 1.12, duration: 100, ease: 'Back.easeOut' })
    }
  }

  /** Selects the next/previous catalog slot (Tab / Shift+Tab) — the keyboard-only
   *  equivalent of tapping a catalog tile, since without it there is no way to choose
   *  WHICH piece the other keyboard controls (nudge/rotate/drop) act on. */
  private cycleCatalogSelection(direction: number): void {
    if (this.paused || this.finished) return
    if (this.bridge.state.phase !== 'build') return
    const count = this.catalogSlots.length
    if (count === 0) return
    const current = this.getLastClickedSlotIndex()
    const next = current < 0 ? (direction > 0 ? 0 : count - 1) : (current + direction + count) % count
    this.selectCatalogSlot(next)
    this.ghostX = null
    Sfx.click()
    this.refreshGhostForSelection()
  }

  /** ArrowLeft/ArrowRight: move the ghost preview by one `snap_grid` step — the
   *  keyboard equivalent of dragging the pointer over the build column. */
  private nudgeGhostX(direction: number): void {
    if (this.paused || this.finished) return
    const state = this.bridge.state
    if (state.phase !== 'build') return
    const selectedIdx = this.getLastClickedSlotIndex()
    if (!this.catalogSlots[selectedIdx]) return
    const grid = state.config.placement.snap_grid
    const base = this.ghostX ?? state.config.field.base_x
    this.ghostX = base + direction * grid
    this.refreshGhostForSelection()
  }

  /** Re-derives and redraws the ghost from the current selection/rotation/`ghostX` —
   *  shared by the keyboard path (which has no pointer position to read) and by
   *  `nudgeGhostX`/`cycleCatalogSelection`/`rotateGhost` so all three stay in sync. */
  private refreshGhostForSelection(): void {
    const selectedIdx = this.getLastClickedSlotIndex()
    const slot = this.catalogSlots[selectedIdx]
    const state = this.bridge.state
    if (!slot || state.phase !== 'build') {
      this.hideGhost()
      return
    }
    if (this.ghostX === null) this.ghostX = state.config.field.base_x
    const size = rotatedSize(
      slot.piece,
      this.rotationStep % state.config.placement.rotation_steps,
      state.config.placement.rotation_steps,
    )
    const clamped = snapX(state.config, this.ghostX, size.w)
    this.ghostX = clamped
    this.updateGhost(clamped, this.ghostSeatY(clamped, slot.piece, selectedIdx), size.w, size.h)
  }

  /** Step rotation — shared by the rotate button's `pointerdown` and the 'R' key. */
  private rotateGhost(): void {
    if (this.paused || this.finished) return
    const config = this.bridge.state.config
    this.rotationStep = (this.rotationStep + 1) % config.placement.rotation_steps
    if (this.rotateBtn) {
      const bg = this.rotateBtn.getAt(0) as Phaser.GameObjects.Image
      if (bg) scalePunch(this, bg, 1.1, 120)
    }
    Sfx.click()
    this.refreshGhostForSelection()
  }

  /** Drop/snap the ghost if a piece is selected and positioned; otherwise end the
   *  build phase early — Enter/Space's dual purpose, mirroring how the pointer flow
   *  already has two independent "commit" gestures (tap a spot to drop; tap READY,
   *  unrelated to any selection, to end the phase). */
  private confirmBuildAction(): void {
    if (this.paused || this.finished) return
    const state = this.bridge.state
    if (state.phase !== 'build') return
    const selectedIdx = this.getLastClickedSlotIndex()
    const slot = this.catalogSlots[selectedIdx]
    if (slot && this.ghostX !== null) {
      this.placePiece(slot, this.ghostX)
      return
    }
    this.triggerReady()
  }

  /** Ends the build phase early — shared by the READY button and Enter/Space (when no
   *  piece is selected). */
  private triggerReady(): void {
    if (this.paused || this.finished) return
    if (this.bridge.state.phase !== 'build') return
    this.bridge.enqueue('ready')
    Sfx.whoosh()
  }

  /** Removes the most recently placed piece — shared by the remove button and
   *  Backspace/Delete. */
  private removeLastPiece(): void {
    if (this.paused || this.finished) return
    const { bodies } = this.bridge.state
    if (bodies.length === 0) return
    const last = bodies[bodies.length - 1]
    if (last) this.bridge.enqueue('remove', { n: last.uid })
  }

  /** Toggles adaptive assistance — shared by the Help/assist button and the 'A' key. */
  private toggleAssist(): void {
    if (this.paused || this.finished) return
    const { assistOn } = this.bridge.state
    this.bridge.enqueue(assistOn ? 'assist_off' : 'assist_on')
  }

  /** `games.canvas.heightLabel` is a number+unit template ("H:{{value}}") — the
   *  resolved copy still carries the literal `{{value}}` placeholder (PhaserGameBox
   *  resolves `t()` with no interpolation values; see phaser/scene.ts's
   *  CANVAS_STRING_KEYS doc comment and runner/scene.ts's `formatDistance` for the
   *  same pattern), so this substitutes it by hand rather than hardcoding "H:". */
  private formatHeight(value: number): string {
    const template = this.strings['heightLabel'] ?? 'heightLabel'
    return template.replace('{{value}}', String(value))
  }

  private placePiece(slot: CatalogSlot, x: number): void {
    const state = this.bridge.state
    const config = state.config
    const snapped = snapX(config, x, slot.piece.w)
    const rotation = this.rotationStep % config.placement.rotation_steps
    this.bridge.enqueue('place', { slot: slot.piece.item_id, x: snapped, n: rotation })
  }

  private ghostSeatY(x: number, piece: StackerPiece, _slotIndex: number): number {
    const state = this.bridge.state
    const size = rotatedSize(piece, this.rotationStep % state.config.placement.rotation_steps, state.config.placement.rotation_steps)
    return seatY(state, x, size.w, size.h)
  }

  private updateGhost(x: number, y: number, w: number, h: number): void {
    if (this.ghostRect) {
      this.ghostRect.setPosition(x, y)
      this.ghostRect.setDisplaySize(w, h)
      this.ghostRect.setAlpha(0.5)
      this.ghostRect.setVisible(true)
    }
  }

  private hideGhost(): void {
    if (this.ghostRect) this.ghostRect.setVisible(false)
  }

  private syncPieces(): void {
    const state = this.bridge.state
    const prevState = this.bridge.prevState
    const alpha = this.bridge.alpha

    const currentUids = new Set(state.bodies.map((b) => b.uid))
    for (const [uid, view] of this.pieceViews) {
      if (!currentUids.has(uid)) {
        if (view.propGlow) view.propGlow.destroy()
        view.rect.destroy()
        if (view.label) view.label.destroy()
        this.pieceViews.delete(uid)
      }
    }

    for (const body of state.bodies) {
      let view = this.pieceViews.get(body.uid)
      if (!view) {
        const piece = state.config.catalog[body.pieceIndex]
        const color = piece ? this.getPieceColor(piece) : this.palette.primary
        const rect = this.add.rectangle(body.x, body.y, body.w, body.h, color, 1)
        rect.setDepth(PIECE_DEPTH)
        rect.setStrokeStyle(1, this.palette.text, 0.3)

        let propGlow: Phaser.GameObjects.Rectangle | null = null
        if (body.property !== 'none') {
          const glowColor = PROPERTY_COLORS[body.property] ?? this.palette.warning
          propGlow = this.add.rectangle(body.x, body.y, body.w + 4, body.h + 4, glowColor, 0.3)
          propGlow.setDepth(PIECE_DEPTH - 0.5)
        }

        const label = this.makeText(body.x, body.y, body.itemId.slice(0, 6), 9, this.palette.text, PIECE_DEPTH + 1)

        view = { uid: body.uid, body, rect, propGlow, label }
        this.pieceViews.set(body.uid, view)

        this.tweens.add({
          targets: rect,
          scaleX: 1,
          scaleY: 1,
          from: 0.5,
          duration: 200,
          ease: 'Back.easeOut',
        })
      }

      const prevBody = prevState?.bodies.find((b) => b.uid === body.uid)
      const px = prevBody ? Phaser.Math.Linear(prevBody.x, body.x, alpha) : body.x
      const py = prevBody ? Phaser.Math.Linear(prevBody.y, body.y, alpha) : body.y

      view.rect.setPosition(px, py)
      view.rect.setDisplaySize(body.w, body.h)
      if (view.label) view.label.setPosition(px, py)
      if (view.propGlow) view.propGlow.setPosition(px, py)

      view.body = body
    }
  }

  private syncTimeline(state: StackerState): void {
    for (const t of this.timelineTexts) t.destroy()
    this.timelineTexts = []

    if (state.phase !== 'test') return
    const config = state.config
    const elapsed = state.tick - state.testStartTick

    for (const event of config.timeline.events) {
      const remaining = event.at_tick - elapsed
      if (remaining < -config.timeline.announce_ticks) continue
      if (remaining > config.timeline.announce_ticks + event.duration_ticks) continue

      const isActive = remaining <= 0 && remaining > -event.duration_ticks
      const icon = FORCE_ICONS[event.kind] ?? '?'
      let label = `${icon} ${event.kind}`
      if (remaining > 0) label += ` in ${Math.round((remaining * 0.05) * 10) / 10}s`

      const x = config.field.width / 2
      const y = 60 + this.timelineTexts.length * 22
      const t = this.makeText(x, y, label, 14, isActive ? this.palette.danger : this.palette.warning, TIMELINE_DEPTH)
      this.timelineTexts.push(t)
    }
  }

  private syncMarginUI(state: StackerState): void {
    const config = state.config
    if (!this.marginBar || !this.marginBarFill) return

    const marginPct = Math.max(0, Math.min(1, state.margin / config.stability.margin_threshold))
    this.marginBarFill.setDisplaySize(this.marginBar.width * marginPct, this.marginBar.height)
    this.marginBarFill.setFillStyle(marginPct >= 1 ? this.palette.success : this.palette.danger)

    if (this.holdBarFill && this.holdBar) {
      const holdPct = Math.max(0, Math.min(1, state.holdTicks / config.stability.hold_ticks))
      this.holdBarFill.setDisplaySize(this.holdBar.width * holdPct, this.holdBar.height)
    }
  }

  private syncForceEffects(state: StackerState): void {
    for (const emitter of this.forceParticles) emitter.destroy()
    this.forceParticles = []

    const forces = (() => {
      let px = 0
      let py = 0
      let wakes = false
      let any = false
      const elapsed = state.tick - state.testStartTick
      const ease = assistActive(state) ? state.config.assist.ease_factor : 1
      for (const [idx, event] of state.config.timeline.events.entries()) {
        if (elapsed < event.at_tick || elapsed >= event.at_tick + event.duration_ticks) continue
        const gust = state.gusts[idx] ?? 1
        const mag = event.magnitude * gust * ease
        if (event.kind === 'wind' || event.kind === 'vibration' || event.kind === 'earthquake') {
          px += mag
          if (event.kind === 'earthquake') { py += mag * 0.5; wakes = true }
        }
        any = true
      }
      return { px, py, wakes, any }
    })()

    if (!forces.any) return

    if (Math.abs(forces.px) > 0.5) {
      const dir = forces.px > 0 ? 1 : -1
      const emitter = this.add.particles(this.scale.width / 2, this.scale.height / 2, 'px-circle-white', {
        speed: { min: 60, max: 200 },
        lifespan: 600,
        scale: { start: 0.3, end: 0 },
        alpha: { start: 0.4, end: 0 },
        gravityY: 0,
        angle: dir > 0 ? 0 : 180,
        quantity: 2,
        frequency: 80,
        tint: 0x88ccff,
      })
      emitter.setDepth(5)
      this.forceParticles.push(emitter)
    }

    if (forces.wakes) addShake(this, 'medium')
  }

  private createHUD(config: StackerConfig): void {
    const W = config.field.width

    this.budgetBarBg = this.add.image(60, 24, BAR_BG_KEY).setOrigin(0, 0.5).setDepth(HUD_DEPTH)
    this.budgetBar = this.add.image(60, 24, BAR_FILL_KEY).setOrigin(0, 0.5).setDepth(HUD_DEPTH + 0.5)
    this.budgetLabel = this.makeText(60 + 100, 24, `${config.economy.budget}`, 14, this.palette.text, HUD_DEPTH + 1)

    this.heightBarBg = this.add.image(200, 24, BAR_BG_KEY).setOrigin(0, 0.5).setDepth(HUD_DEPTH)
    this.heightBarBg.setDisplaySize(100, 14)
    this.heightBar = this.add.image(200, 24, BAR_FILL_KEY).setOrigin(0, 0.5).setDepth(HUD_DEPTH + 0.5)
    this.heightBar.setDisplaySize(100, 14)
    this.heightLabel = this.makeText(200 + 50, 24, this.formatHeight(0), 14, this.palette.text, HUD_DEPTH + 1)

    this.scoreLabel = this.makeText(W - 40, 24, '0', 18, this.palette.text, HUD_DEPTH)
    this.phaseLabel = this.makeText(W / 2, 24, this.strings['build'] ?? 'build', 16, this.palette.primary, HUD_DEPTH)

    if (this.bridge.state.lives !== null) {
      this.livesLabel = this.makeText(W - 120, 24, '', 16, this.palette.warning, HUD_DEPTH)
    }

    const marginY = config.field.ground_y + 30
    this.marginBar = this.add.rectangle(40, marginY, 80, 10, this.palette.bgAccent, 0.8)
    this.marginBar.setOrigin(0, 0.5).setDepth(HUD_DEPTH)
    this.marginBarFill = this.add.rectangle(40, marginY, 80, 10, this.palette.success, 1)
    this.marginBarFill.setOrigin(0, 0.5).setDepth(HUD_DEPTH + 0.5)

    const holdY = marginY + 16
    this.holdBar = this.add.rectangle(40, holdY, 80, 10, this.palette.bgAccent, 0.8)
    this.holdBar.setOrigin(0, 0.5).setDepth(HUD_DEPTH)
    this.holdBarFill = this.add.rectangle(40, holdY, 80, 10, this.palette.success, 1)
    this.holdBarFill.setOrigin(0, 0.5).setDepth(HUD_DEPTH + 0.5)

    this.ghostRect = this.add.rectangle(0, 0, 40, 40, this.palette.accent, 0.3)
    this.ghostRect.setDepth(GHOST_DEPTH)
    this.ghostRect.setVisible(false)
  }

  /**
   * Anchored to the field's TOP-RIGHT corner rather than below `ground_y` (the
   * original layout): once every hit area grows to the >=104px design-space floor
   * (MIN_HIT_DESIGN_PX above), four stacked buttons no longer fit the ~100px band
   * between `ground_y` and the bottom catalog tray for either reference fixture
   * (900x540 / 960x560 — fixtures.ts). The top-right corner is clear of the HUD text
   * row (y ~= 24), clear of the base column (both reference fixtures centre `base_x`
   * well left of this corner), and — drawn at HUD_DEPTH, above every piece's
   * PIECE_DEPTH — stays tappable even on the rare placement that overhangs underneath
   * it. A DOM-overlay chrome layer (outside the canvas entirely) would sidestep this
   * tension for good; see the doc comment on MIN_HIT_DESIGN_PX and the module-level
   * report for why that larger rework is out of scope here.
   */
  private createButtons(): void {
    const config = this.bridge.state.config
    const W = config.field.width
    const hit = MIN_HIT_DESIGN_PX
    const gap = 12
    const rightEdge = W - gap
    const row1Y = 24 + 14 + gap + hit / 2
    const row2Y = row1Y + hit + gap

    // Row 1: two square icon buttons, right-aligned.
    const removeCenterX = rightEdge - hit / 2
    const rotateCenterX = removeCenterX - hit - gap
    // Row 2: the wider READY button, right-aligned under `remove`; ASSIST to its left.
    const readyCenterX = rightEdge - READY_BTN_WIDTH / 2
    const assistCenterX = readyCenterX - READY_BTN_WIDTH / 2 - gap - hit / 2

    const rotateContainer = this.add.container(rotateCenterX, row1Y)
    rotateContainer.setDepth(HUD_DEPTH)
    rotateContainer.setSize(hit, hit)
    const rotateBg = this.add.image(0, 0, BTN_ROTATE_KEY)
    rotateBg.setInteractive({ cursor: 'pointer' })
    rotateContainer.add(rotateBg)
    const rotateLabel = this.makeText(0, 0, '\u{21BB}', 22, this.palette.text, HUD_DEPTH + 1)
    rotateContainer.add(rotateLabel)
    rotateBg.on('pointerdown', () => this.rotateGhost())
    this.rotateBtn = rotateContainer

    const removeContainer = this.add.container(removeCenterX, row1Y)
    removeContainer.setDepth(HUD_DEPTH)
    removeContainer.setSize(hit, hit)
    const removeBg = this.add.image(0, 0, BTN_REMOVE_KEY)
    removeBg.setInteractive({ cursor: 'pointer' })
    removeContainer.add(removeBg)
    const removeLabel = this.makeText(0, 0, '\u{2716}', 20, this.palette.text, HUD_DEPTH + 1)
    removeContainer.add(removeLabel)
    removeBg.on('pointerdown', () => this.removeLastPiece())
    removeBg.setAlpha(0.5)
    this.removeBtn = removeContainer

    const assistContainer = this.add.container(assistCenterX, row2Y)
    assistContainer.setDepth(HUD_DEPTH)
    assistContainer.setSize(hit, hit)
    const assistBg = this.add.image(0, 0, BTN_ASSIST_KEY)
    assistBg.setInteractive({ cursor: 'pointer' })
    assistContainer.add(assistBg)
    const assistLabel = this.makeText(0, 0, this.strings['help'] ?? 'help', 14, this.palette.text, HUD_DEPTH + 1)
    assistContainer.add(assistLabel)
    assistBg.on('pointerdown', () => this.toggleAssist())
    assistBg.setAlpha(0.5)
    this.assistBtn = assistContainer

    const readyContainer = this.add.container(readyCenterX, row2Y)
    readyContainer.setDepth(HUD_DEPTH + 1)
    readyContainer.setSize(READY_BTN_WIDTH, hit)
    const readyBg = this.add.image(0, 0, BTN_READY_KEY)
    readyBg.setInteractive({ cursor: 'pointer' })
    readyContainer.add(readyBg)
    const readyLabel = this.makeText(0, 0, this.strings['ready'] ?? 'ready', 16, this.palette.inverseText, HUD_DEPTH + 2)
    readyContainer.add(readyLabel)
    readyBg.on('pointerdown', () => this.triggerReady())
    this.readyBtn = readyContainer
  }

  private updateRemoveButton(state: StackerState): void {
    if (!this.removeBtn || !this.readyBtn) return
    const canRemove = state.phase === 'build' && state.bodies.length > 0
    const btnBg = this.removeBtn.getAt(0) as Phaser.GameObjects.Image
    if (btnBg) btnBg.setAlpha(canRemove ? 1 : 0.4)
  }

  private updateAssistButton(state: StackerState): void {
    if (!this.assistBtn || !this.readyBtn) return
    const config = state.config
    const available = config.assist.enabled && state.collapses >= config.assist.ease_after_failures
    const btnBg = this.assistBtn.getAt(0) as Phaser.GameObjects.Image
    if (btnBg) btnBg.setAlpha(available ? 1 : 0.4)
  }

  private updateCatalogUseCounts(state: StackerState): void {
    for (const slot of this.catalogSlots) {
      const used = state.usesByPiece[slot.pieceIndex] ?? 0
      const canAfford = costOfPiece(state.config, slot.piece) <= budgetLeft(state)
      const canUse = used < slot.piece.max_uses && canAfford
      slot.container.setAlpha(canUse ? 1 : 0.4)
    }
  }

  private scalePunchPiece(uid: number): void {
    const view = this.pieceViews.get(uid)
    if (!view) return
    this.tweens.add({
      targets: view.rect,
      scaleX: 1.18,
      scaleY: 1.18,
      duration: 88,
      yoyo: true,
      ease: 'Back.easeOut',
    })
  }

  private spawnPlaceParticles(x: number, y: number): void {
    burstParticles(this, x, y, {
      texture: 'px-circle-gold',
      count: 6,
      speed: { min: 40, max: 100 },
      lifespan: 400,
      scale: { start: 0.6, end: 0 },
      gravityY: 100,
    })
  }

  private getPieceColor(piece: StackerPiece): number {
    if (piece.property === 'adhesive') return 0xffdd44
    if (piece.property === 'magnetic') return 0x44aaff
    if (piece.property === 'elastic') return 0x44ff44
    if (piece.property === 'brittle') return 0x888888
    if (piece.property === 'counterweight') return 0xff8800
    return this.palette.primary
  }
}

export default StackerScene
