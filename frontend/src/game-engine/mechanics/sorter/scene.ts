import Phaser from 'phaser'

import {
  generateBackground,
  generatePlaceholderSprite,
} from '@/game-engine/phaser/assets'
import { GameEngineBridge } from '@/game-engine/phaser/bridge'
import {
  addShake,
  floatText,
  spawnConfetti,
  spawnCorrectParticles,
  spawnWrongParticles,
} from '@/game-engine/phaser/juice'
import { BaseMechanicScene } from '@/game-engine/phaser/scene'
import { Sfx } from '@/game-engine/phaser/sfx'
import type { GameCategory, GameItem } from '@/game-engine/core/types'

import { sorterConfigSchema, sorterContentSchema } from './schema'
import { sorterSimulator, type SorterAction, type SorterEntity, type SorterState } from './simulate'

const BG_KEY = 'sorter-bg'
const ITEM_PREFIX = 'sorter-item-'
const BIN_PREFIX = 'sorter-bin-'
const TRASH_KEY = 'sorter-trash'

/** Sentinel bin id for the discard target — namespaced so it can never collide with a
 *  generated (kebab-case) category id, matching the DOM-era `SORTER_TRASH_ZONE`. */
export const TRASH_BIN_ID = '__trash__'

const ITEM_DEPTH = 10
const BIN_DEPTH = 5
const HUD_DEPTH = 20
const COMBO_DEPTH = 25
const GLOW_ALPHA = 0.4
const HOVER_SCALE_PEAK = 1.06
const BIN_HIGHLIGHT_SCALE = 1.04

/** §1.11: a real 44px touch target at the canvas's FIT scale. The canvas is a fixed
 *  800x600 world and a common phone renders it around 350-375 CSS px wide (scale
 *  ~0.44-0.47), so any interactive object's DESIGN-space footprint must clear
 *  44 / 0.44 ~= 100 design px in both dimensions to clear the real minimum — applied
 *  as a floor under whatever a document authors (`field.item_size` has a schema
 *  minimum of only 24, and the bin row's height was a bare 80), never a silent
 *  shrink of anything already larger. */
const MIN_TOUCH_DESIGN_PX = 100

/** Design-px pointer travel, in a NON-static mode, that distinguishes a DRAG from a
 *  TAP on pointerup. Below this, `onPointerUp` treats the gesture as a tap-select
 *  (the §1.11 drag alternative) instead of a drop attempt. */
const DRAG_MOVE_THRESHOLD = 12

const TIER_COLORS: Record<number, number> = {
  1: 0x3b82f6,
  2: 0x22c55e,
  3: 0xf59e0b,
  4: 0xef4444,
}

// Exported so `sorter.test.ts` can type a minimal fake scene against the real shape
// (see the doc comment there) instead of duplicating it.
export interface ItemView {
  entity: SorterEntity
  container: Phaser.GameObjects.Container
  rect: Phaser.GameObjects.Image
  label: Phaser.GameObjects.Text
  tierColor: number
  uid: number
}

export interface BinView {
  categoryId: string
  container: Phaser.GameObjects.Container
  rect: Phaser.GameObjects.Image
  label: Phaser.GameObjects.Text
  glow: Phaser.GameObjects.Rectangle
}

/** Minimal pointer shape every input handler below actually reads — lets the real
 *  handlers run against a plain `{x, y}` fixture in tests, with no fake
 *  `Phaser.Input.Pointer` required. `worldX`/`worldY` are optional (test fixtures never
 *  set them) but MUST be preferred over `x`/`y` whenever present: `x`/`y` are raw
 *  canvas-design coordinates, while every item/bin `container.x/y` this file hit-tests
 *  against is a WORLD coordinate — identical to canvas space only when the camera is
 *  unzoomed. `getWorldSize()` (this scene overrides it) zooms the camera for any
 *  fixture whose authored `field` differs from 800x600, so `x`/`y` alone silently
 *  miss every tap once a real fixture triggers that path — confirmed live: taps
 *  computed against `x`/`y` landed tens of design-px away from the actual item/bin.
 *  Phaser's own `InputManager.hitTest` (called for every pointer event, before any
 *  listener runs) already writes the correct `camera.getWorldPoint(x, y)` result into
 *  `pointer.worldX/worldY` — real `Phaser.Input.Pointer` objects always carry it. */
interface PointerLike {
  x: number
  y: number
  worldX?: number
  worldY?: number
}

/** The coordinate every hit test in this file must use — see `PointerLike`'s doc
 *  comment for why `worldX`/`worldY` (when present) wins over `x`/`y`. */
function pointerPos(pointer: PointerLike): { x: number; y: number } {
  return { x: pointer.worldX ?? pointer.x, y: pointer.worldY ?? pointer.y }
}

/**
 * The content-authored display text for an item/category id — the DOM-era renderer's
 * proven resolution (`components.tsx`'s `itemsById.get(entity.itemId)?.label_md ??
 * entity.itemId`), lifted out to a pure function so it is exercised by a real id-map
 * lookup in a test rather than only read by eye. Falls back to the raw id (never a
 * hardcoded placeholder) so a document with a genuinely missing entry stays legible
 * instead of throwing.
 */
export function resolveLabel(source: ReadonlyMap<string, { label_md: string }>, id: string): string {
  return source.get(id)?.label_md ?? id
}

/**
 * Wraps `current` by `direction` (+-1) over a list of `length` items, treating a
 * negative `current` (nothing focused yet) as "enter the list" rather than requiring
 * a caller-side special case. Returns -1 only when `length` is 0 (nothing to focus) —
 * the ONE state the keyboard-focus methods below treat as "no focus target exists".
 * Pure and Phaser-free on purpose: the keyboard-cycling behaviour is asserted here
 * directly rather than only through a simulated keydown sequence.
 */
export function cycleFocusIndex(length: number, current: number, direction: 1 | -1): number {
  if (length <= 0) return -1
  if (current < 0 || current >= length) return direction === 1 ? 0 : length - 1
  return (current + direction + length) % length
}

/**
 * The ONE place a (uid, bin target) pair becomes a logical `SorterAction` + payload —
 * called by every input path (pointer-drag drop, non-static tap-select, keyboard
 * confirm) so a keyboard-driven placement and a pointer-driven placement are
 * PROVABLY the same bridge call: they run the same function, not two hand-written
 * copies that could drift.
 */
export function resolvePlacementEvent(
  uid: number,
  binId: string,
): { action: SorterAction; payload: { n: number; slot?: string } } {
  if (binId === TRASH_BIN_ID) return { action: 'discard', payload: { n: uid } }
  return { action: 'place', payload: { slot: binId, n: uid } }
}

export class SorterScene extends BaseMechanicScene<SorterState> {
  private itemViews: Map<number, ItemView> = new Map()
  private binViews: Map<string, BinView> = new Map()
  private trashView: BinView | null = null
  private itemsById: Map<string, GameItem> = new Map()
  private categoriesById: Map<string, GameCategory> = new Map()
  private comboText: Phaser.GameObjects.Text | null = null
  private scoreText: Phaser.GameObjects.Text | null = null
  private livesText: Phaser.GameObjects.Text | null = null
  private dragItem: ItemView | null = null
  private selectedItem: ItemView | null = null
  private dragOffsetX = 0
  private dragOffsetY = 0
  private dragStartX = 0
  private dragStartY = 0
  /** Set the moment a NON-static drag crosses `DRAG_MOVE_THRESHOLD`; read once on
   *  pointerup to decide drag-drop vs tap-select. Reset on every pointerdown. */
  private dragMoved = false
  private binGlowTarget: BinView | null = null
  /** Keyboard focus ring (§1.11 keyboard-access path), independent of `selectedItem`/
   *  `dragItem` (pointer state): a focused-but-not-yet-confirmed item, cycled with
   *  Tab/Arrow keys and confirmed with Enter/Space — mirroring the DOM-era renderer's
   *  real `tabIndex`-driven focus, the closest a canvas scene can get to it. */
  private kbFocusUid: number | null = null
  /** Same idea, once an item is selected: the bin the keyboard is currently on. */
  private kbFocusBinId: string | null = null
  private lastCorrect = 0
  private lastWrong = 0
  private lastCombo = 0
  private lastPoints = 0
  private lastLives: number | null = null

  constructor() {
    super('sorter')
  }

  createBridge(): { bridge: GameEngineBridge<SorterState>; simInit: import('@/game-engine/core/types').SimInit } {
    const configParse = sorterConfigSchema.safeParse(this.doc.config)
    const contentParse = sorterContentSchema.safeParse(this.doc.content)
    if (!configParse.success || !contentParse.success) throw new Error('Invalid sorter document')
    const simInit = {
      config: configParse.data,
      content: contentParse.data,
      scoring: this.doc.scoring,
      seed: this.seed,
    }
    return {
      bridge: new GameEngineBridge(sorterSimulator, simInit, this.maxTicks),
      simInit,
    }
  }

  protected override getWorldSize(): { width: number; height: number } {
    // `config.field` is authored per-manifest and can differ from the fixed 800x600
    // canvas (confirmed: a real fixture declares 900x540) — fit the camera to it.
    // Read off the bridge's already-Zod-parsed state (properly typed) rather than the
    // raw `this.doc.config`, so no cast is needed.
    const { field } = this.bridge.state.config
    return { width: field.width, height: field.height }
  }

  /** `config.field.item_size` floored at `MIN_TOUCH_DESIGN_PX` (§1.11) — the ONE value
   *  used for BOTH the rendered sprite/container size and the `findItemAt` hit-test
   *  radius, so the tap target is never invisibly larger than what a child sees. */
  private effectiveItemSize(): number {
    return Math.max(this.bridge.state.config.field.item_size, MIN_TOUCH_DESIGN_PX)
  }

  createGameObjects(): void {
    const { config } = this.bridge.state

    for (const item of this.doc.content.items) this.itemsById.set(item.id, item)
    for (const category of this.doc.content.categories ?? []) this.categoriesById.set(category.id, category)

    generateBackground(this, BG_KEY, config.field.width, config.field.height, this.palette)
    this.add.image(config.field.width / 2, config.field.height / 2, BG_KEY).setDepth(0)

    const itemSize = this.effectiveItemSize()
    generatePlaceholderSprite(
      this,
      TRASH_KEY,
      itemSize + 20,
      itemSize + 20,
      this.palette.danger,
      'rect',
      this.palette.text,
    )

    this.createBins(config)
    this.comboText = this.makeText(config.field.width - 80, 48, '', 16, this.palette.accent, COMBO_DEPTH)
    this.scoreText = this.makeText(80, 48, '0', 20, this.palette.text, HUD_DEPTH).setOrigin(0, 0.5)
    if (config.ladder.length > 0 && this.bridge.state.lives !== null) {
      this.livesText = this.makeText(config.field.width / 2, 48, '', 18, this.palette.warning, HUD_DEPTH)
    }
  }

  setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPointerDown(pointer))
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.onPointerMove(pointer))
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.onPointerUp(pointer))
    // §1.11 keyboard-access path: Tab/Arrow cycles focus, Enter/Space confirms, Escape
    // bails out. `this.input.keyboard` is undefined only if the keyboard plugin was
    // explicitly disabled in GameConfig (it is not), so the optional chain is a
    // defensive no-op in practice, never a silent feature loss.
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.handleKeyDown(event))
  }

  private onPointerDown(pointer: PointerLike): void {
    if (this.paused || this.finished) return

    const { config } = this.bridge.state
    const { x: px, y: py } = pointerPos(pointer)
    const item = this.findItemAt(px, py)
    if (item !== null && item !== this.selectedItem) {
      if (config.mode === 'static') {
        this.clearSelection()
        this.selectedItem = item
        this.setItemHighlight(item, true)
        Sfx.click()
        return
      }

      // NON-static (falling/conveyor): pointerdown always ARMS a potential drag.
      // `onPointerUp` decides drag-drop vs tap-select from the travel distance — a
      // tap that never moves selects the item exactly like static mode does, so
      // drag is never the ONLY way to place an element (§1.11). A different item
      // (or a keyboard-driven selection, mid-cross-modality) already selected must
      // lose its highlight and any leftover bin-focus glow here, the same way the
      // static branch above clears it, or it would linger stale.
      this.clearSelection()
      this.dragItem = item
      this.dragStartX = px
      this.dragStartY = py
      this.dragMoved = false
      this.dragOffsetX = px - item.container.x
      this.dragOffsetY = py - item.container.y
      item.container.setDepth(50)
      this.tweens.add({
        targets: item.container,
        scaleX: 1.08,
        scaleY: 1.08,
        duration: 100,
        ease: 'Back.easeOut',
      })
      Sfx.click()
      return
    }

    if (this.selectedItem !== null) {
      const binId = this.findBinIdAt(px, py)
      if (binId !== null) {
        this.commitPlace(this.selectedItem.uid, binId)
      }
      this.setItemHighlight(this.selectedItem, false)
      this.selectedItem = null
    }
  }

  private onPointerMove(pointer: PointerLike): void {
    const prevGlow = this.binGlowTarget
    const { x: px, y: py } = pointerPos(pointer)

    if (this.dragItem !== null) {
      const travelled = Math.hypot(px - this.dragStartX, py - this.dragStartY)
      if (travelled > DRAG_MOVE_THRESHOLD) this.dragMoved = true

      this.dragItem.container.x = px - this.dragOffsetX
      this.dragItem.container.y = py - this.dragOffsetY

      const binId = this.findBinIdAt(px, py)
      if (binId !== null) {
        const bin = this.binViews.get(binId) ?? this.trashView
        this.setBinGlow(bin ?? null)
      } else {
        this.setBinGlow(null)
      }
    } else if (this.selectedItem !== null) {
      const binId = this.findBinIdAt(px, py)
      if (binId !== null) {
        const bin = this.binViews.get(binId) ?? this.trashView
        this.setBinGlow(bin ?? null)
      } else {
        this.setBinGlow(null)
      }
    } else {
      const item = this.findItemAt(px, py)
      if (item && item.container.scaleX < HOVER_SCALE_PEAK) {
        this.tweens.add({
          targets: item.container,
          scaleX: HOVER_SCALE_PEAK,
          scaleY: HOVER_SCALE_PEAK,
          duration: 120,
          ease: 'Sine.easeOut',
        })
      }
    }

    if (prevGlow !== this.binGlowTarget && prevGlow) {
      this.setBinHighlight(prevGlow, false)
    }
    if (this.binGlowTarget && this.binGlowTarget !== prevGlow) {
      this.setBinHighlight(this.binGlowTarget, true)
    }
  }

  private onPointerUp(pointer: PointerLike): void {
    if (this.dragItem === null) return

    const item = this.dragItem
    const uid = item.uid
    const moved = this.dragMoved
    this.dragItem = null
    this.dragMoved = false
    this.setBinGlow(null)

    if (!moved) {
      // A TAP, not a drag — the NON-static tap-equivalent (§1.11): arm selection
      // exactly like static mode instead of committing or snapping back. The very
      // next tap (on the bin-commit branch in `onPointerDown`, or the keyboard's
      // confirm-a-bin branch) resolves it through the SAME `commitPlace` call a
      // drag-drop would have made.
      item.container.setDepth(ITEM_DEPTH)
      this.selectedItem = item
      this.setItemHighlight(item, true)
      return
    }

    const { x: px, y: py } = pointerPos(pointer)
    const binId = this.findBinIdAt(px, py)
    if (binId !== null) {
      this.commitPlace(uid, binId)
    } else {
      this.tweens.add({
        targets: item.container,
        x: item.entity.x,
        y: item.entity.y,
        scaleX: 1,
        scaleY: 1,
        duration: 250,
        ease: 'Back.easeOut',
        onComplete: () => item.container.setDepth(ITEM_DEPTH),
      })
    }
  }

  /** §1.11 keyboard path. With nothing selected, Tab/Arrow cycles a FOCUS ring among
   *  items and Enter/Space confirms the focused one into `selectedItem` — the same
   *  field the pointer/tap paths use. With an item already selected, the same keys
   *  cycle a focus ring among bins (including the trash target) and Enter/Space
   *  commits through `commitPlace`, so a keyboard-only placement and a pointer
   *  placement are the same call. Escape clears everything. */
  private handleKeyDown(event: { key: string }): void {
    if (this.paused || this.finished) return

    const key = event.key
    if (key === 'Escape') {
      this.clearSelection()
      return
    }

    const forward = key === 'ArrowRight' || key === 'ArrowDown' || key === 'Tab'
    const backward = key === 'ArrowLeft' || key === 'ArrowUp'
    const confirm = key === 'Enter' || key === ' ' || key === 'Spacebar'
    if (!forward && !backward && !confirm) return

    if (this.selectedItem === null) {
      if (forward || backward) {
        this.moveItemFocus(forward ? 1 : -1)
        return
      }
      if (this.kbFocusUid === null) return
      const item = this.itemViews.get(this.kbFocusUid)
      if (item === undefined) return
      this.kbFocusUid = null
      this.selectedItem = item
      this.setItemHighlight(item, true)
      Sfx.click()
      return
    }

    if (forward || backward) {
      this.moveBinFocus(forward ? 1 : -1)
      return
    }
    if (this.kbFocusBinId === null) return
    this.commitPlace(this.selectedItem.uid, this.kbFocusBinId)
    this.setItemHighlight(this.selectedItem, false)
    this.selectedItem = null
    this.kbFocusBinId = null
    this.setBinGlow(null)
  }

  private orderedItemUids(): number[] {
    return [...this.itemViews.keys()].sort((a, b) => a - b)
  }

  private orderedBinIds(): string[] {
    const ids = [...this.binViews.keys()]
    if (this.trashView) ids.push(TRASH_BIN_ID)
    return ids
  }

  private moveItemFocus(direction: 1 | -1): void {
    const uids = this.orderedItemUids()
    const currentIndex = this.kbFocusUid === null ? -1 : uids.indexOf(this.kbFocusUid)
    const nextIndex = cycleFocusIndex(uids.length, currentIndex, direction)

    if (this.kbFocusUid !== null) {
      const prevView = this.itemViews.get(this.kbFocusUid)
      if (prevView) this.setItemHighlight(prevView, false)
    }

    const nextUid = nextIndex === -1 ? null : (uids[nextIndex] ?? null)
    this.kbFocusUid = nextUid
    if (nextUid !== null) {
      const view = this.itemViews.get(nextUid)
      if (view) this.setItemHighlight(view, true)
    }
  }

  private moveBinFocus(direction: 1 | -1): void {
    const ids = this.orderedBinIds()
    const currentIndex = this.kbFocusBinId === null ? -1 : ids.indexOf(this.kbFocusBinId)
    const nextIndex = cycleFocusIndex(ids.length, currentIndex, direction)
    const nextId = nextIndex === -1 ? null : (ids[nextIndex] ?? null)
    this.kbFocusBinId = nextId
    const bin = nextId === null ? null : nextId === TRASH_BIN_ID ? this.trashView : (this.binViews.get(nextId) ?? null)
    this.setBinGlow(bin)
  }

  /** Shared teardown for Escape and for anything that discovers a selection can no
   *  longer be honoured — clears every visual highlight along with the state. */
  private clearSelection(): void {
    if (this.kbFocusUid !== null) {
      const view = this.itemViews.get(this.kbFocusUid)
      if (view) this.setItemHighlight(view, false)
      this.kbFocusUid = null
    }
    if (this.selectedItem !== null) {
      this.setItemHighlight(this.selectedItem, false)
      this.selectedItem = null
    }
    this.kbFocusBinId = null
    this.setBinGlow(null)
  }

  updateGameObjects(_delta: number): void {
    const state = this.bridge.state

    this.syncItems(state, this.bridge.alpha)

    if (state.correct !== this.lastCorrect && state.correct > this.lastCorrect) {
      this.onCorrectPlacement()
    }
    if (state.wrong !== this.lastWrong && state.wrong > this.lastWrong) {
      this.onWrongPlacement()
    }
    if (state.combo !== this.lastCombo && state.combo > 1) {
      this.onComboStep(state.combo)
    }
    if (state.points !== this.lastPoints && state.points > this.lastPoints) {
      this.tweens.add({
        targets: this.scoreText,
        scaleX: 1.15,
        scaleY: 1.15,
        duration: 80,
        yoyo: true,
        ease: 'Sine.easeOut',
      })
    }

    this.lastCorrect = state.correct
    this.lastWrong = state.wrong
    this.lastCombo = state.combo
    this.lastPoints = state.points
    this.lastLives = state.lives

    if (this.comboText) {
      const comboLabel = this.strings['comboLabel'] ?? 'comboLabel'
      this.comboText.setText(state.combo > 1 ? comboLabel.replace('{{count}}', `${state.combo}`) : '')
      this.comboText.setAlpha(state.combo > 1 ? 1 : 0)
    }
    if (this.scoreText) {
      this.scoreText.setText(`${Math.round(this.bridge.snapshot.score)}`)
    }
    if (this.livesText) {
      this.livesText.setText(state.lives !== null ? `${'♥'} ${state.lives}` : '')
    }
  }

  private createBins(config: SorterState['config']): void {
    const state = this.bridge.state
    const { categories } = state
    const field = config.field
    const catCount = categories.length
    const hasTrash = config.trash_zone
    const total = hasTrash ? catCount + 1 : catCount
    // §1.11: floored at MIN_TOUCH_DESIGN_PX so a document with many containers (up to
    // the report's ceiling of 8 + trash) never renders a bin real devices can't
    // reliably tap, even though the packing formula alone could go much narrower.
    const binW = Math.max(MIN_TOUCH_DESIGN_PX, Math.min(160, (field.width - 40) / total - 12))
    const binH = MIN_TOUCH_DESIGN_PX
    const binY = field.height - binH / 2 - 16
    const totalW = total * (binW + 8) - 8
    const startX = (field.width - totalW) / 2 + binW / 2

    for (let i = 0; i < catCount; i += 1) {
      const catId = categories[i]
      if (catId === undefined) continue
      const x = startX + i * (binW + 8)
      const key = `${BIN_PREFIX}${catId}`

      generatePlaceholderSprite(this, key, binW, binH, this.palette.surface, 'rect', this.palette.primary)

      const container = this.add.container(x, binY)
      container.setDepth(BIN_DEPTH)
      container.setSize(binW, binH)
      container.setInteractive(new Phaser.Geom.Rectangle(-binW / 2, -binH / 2, binW, binH), Phaser.Geom.Rectangle.Contains)

      const rect = this.add.image(0, 0, key)
      container.add(rect)

      const glowRect = this.makeRect(0, 0, binW + 6, binH + 6, this.palette.accent, 0)
      glowRect.setAlpha(0)
      container.add(glowRect)

      const catLabel = this.makeText(0, 0, resolveLabel(this.categoriesById, catId), 13, this.palette.text, BIN_DEPTH + 1)
      container.add(catLabel)

      const binView: BinView = { categoryId: catId, container, rect, label: catLabel, glow: glowRect }
      this.binViews.set(catId, binView)

      container.on('pointerdown', () => {
        if (this.selectedItem !== null && this.selectedItem.uid !== undefined) {
          this.commitPlace(this.selectedItem.uid, catId)
          this.setItemHighlight(this.selectedItem, false)
          this.selectedItem = null
        }
      })
    }

    if (hasTrash) {
      const x = startX + catCount * (binW + 8)
      const container = this.add.container(x, binY)
      container.setDepth(BIN_DEPTH)
      container.setSize(binW, binH)
      container.setInteractive(new Phaser.Geom.Rectangle(-binW / 2, -binH / 2, binW, binH), Phaser.Geom.Rectangle.Contains)

      const rect = this.add.image(0, 0, TRASH_KEY)
      container.add(rect)

      const glowRect = this.makeRect(0, 0, binW + 6, binH + 6, this.palette.danger, 0)
      glowRect.setAlpha(0)
      container.add(glowRect)

      const trashLabel = this.strings['trash'] ?? 'trash'
      const label = this.makeText(0, 0, trashLabel, 13, this.palette.danger, BIN_DEPTH + 1)
      container.add(label)

      this.trashView = { categoryId: TRASH_BIN_ID, container, rect, label, glow: glowRect }

      container.on('pointerdown', () => {
        if (this.selectedItem !== null && this.selectedItem.uid !== undefined) {
          this.bridge.enqueue('discard', { n: this.selectedItem.uid })
          this.setItemHighlight(this.selectedItem, false)
          this.selectedItem = null
        }
      })
    }
  }

  private syncItems(state: SorterState, alpha: number): void {
    const currentUids = new Set(state.active.map((e) => e.uid))

    for (const [uid, view] of this.itemViews) {
      if (!currentUids.has(uid)) {
        if (this.kbFocusUid === uid) this.kbFocusUid = null
        if (view === this.dragItem || view === this.selectedItem) {
          if (view === this.dragItem) this.dragItem = null
          if (view === this.selectedItem) this.selectedItem = null
          view.container.setAlpha(0)
          view.container.destroy()
          this.itemViews.delete(uid)
          continue
        }
        spawnCorrectParticles(this, view.container.x, view.container.y)
        view.container.destroy()
        this.itemViews.delete(uid)
      }
    }

    const itemSize = this.effectiveItemSize()

    for (const entity of state.active) {
      let view = this.itemViews.get(entity.uid)
      const tierColor = TIER_COLORS[entity.tier] ?? this.palette.primary

      if (view === undefined) {
        const key = `${ITEM_PREFIX}${entity.uid}`

        generatePlaceholderSprite(this, key, itemSize, itemSize, tierColor, 'rect', this.palette.text)

        const container = this.add.container(entity.x, entity.y)
        container.setDepth(ITEM_DEPTH)
        container.setSize(itemSize, itemSize)

        const rect = this.add.image(0, 0, key)
        container.add(rect)

        const label = this.makeText(0, 0, resolveLabel(this.itemsById, entity.itemId), 11, this.palette.text, ITEM_DEPTH + 1)
        container.add(label)

        container.setInteractive(
          new Phaser.Geom.Rectangle(-itemSize / 2, -itemSize / 2, itemSize, itemSize),
          Phaser.Geom.Rectangle.Contains,
        )

        view = { entity, container, rect, label, tierColor, uid: entity.uid }
        this.itemViews.set(entity.uid, view)

        this.tweens.add({
          targets: container,
          scaleX: 1,
          scaleY: 1,
          from: 0.5,
          duration: 200,
          ease: 'Back.easeOut',
        })
      }

      if (view !== this.dragItem && view !== this.selectedItem) {
        const prevState = this.bridge.prevState
        const prevEntity = prevState?.active.find((e) => e.uid === entity.uid)
        const px = prevEntity ? Phaser.Math.Linear(prevEntity.x, entity.x, alpha) : entity.x
        const py = prevEntity ? Phaser.Math.Linear(prevEntity.y, entity.y, alpha) : entity.y

        view.container.x = px
        view.container.y = py
        view.entity = entity
      }
    }
  }

  private findItemAt(x: number, y: number): ItemView | null {
    const half = this.effectiveItemSize() / 2 + 4
    for (const view of this.itemViews.values()) {
      const cx = view.container.x
      const cy = view.container.y
      if (Math.abs(x - cx) < half && Math.abs(y - cy) < half) {
        return view
      }
    }
    return null
  }

  private findBinIdAt(x: number, y: number): string | null {
    for (const [id, bin] of this.binViews) {
      if (bin.container.getBounds().contains(x, y)) return id
    }
    if (this.trashView?.container.getBounds().contains(x, y)) return TRASH_BIN_ID
    return null
  }

  private commitPlace(uid: number, binId: string): void {
    const { action, payload } = resolvePlacementEvent(uid, binId)
    this.bridge.enqueue(action, payload)
  }

  private setBinGlow(bin: BinView | null): void {
    if (this.binGlowTarget) {
      this.setBinHighlight(this.binGlowTarget, false)
    }
    this.binGlowTarget = bin
    if (bin) {
      this.setBinHighlight(bin, true)
    }
  }

  private setBinHighlight(bin: BinView, on: boolean): void {
    this.tweens.killTweensOf(bin.glow)
    this.tweens.killTweensOf(bin.container)
    if (on) {
      this.tweens.add({ targets: bin.glow, alpha: GLOW_ALPHA, duration: 100 })
      this.tweens.add({ targets: bin.container, scaleX: BIN_HIGHLIGHT_SCALE, scaleY: BIN_HIGHLIGHT_SCALE, duration: 100, ease: 'Sine.easeOut' })
    } else {
      this.tweens.add({ targets: bin.glow, alpha: 0, duration: 150 })
      this.tweens.add({ targets: bin.container, scaleX: 1, scaleY: 1, duration: 150, ease: 'Sine.easeOut' })
    }
  }

  private setItemHighlight(item: ItemView, on: boolean): void {
    this.tweens.killTweensOf(item.rect)
    if (on) {
      this.tweens.add({ targets: item.rect, alpha: 0.6, duration: 100 })
      this.tweens.add({ targets: item.container, scaleX: 1.08, scaleY: 1.08, duration: 100, ease: 'Sine.easeOut' })
    } else {
      this.tweens.add({ targets: item.rect, alpha: 1, duration: 150 })
      this.tweens.add({ targets: item.container, scaleX: 1, scaleY: 1, duration: 150, ease: 'Sine.easeOut' })
    }
  }

  private onCorrectPlacement(): void {
    Sfx.correct()
    addShake(this, 'collect')
    spawnCorrectParticles(this, this.scale.width / 2, this.scale.height / 2)

    const { config } = this.bridge.state
    const levelIdx = Math.floor(this.bridge.state.correct / config.level_up.correct_per_level)
    const prevLevelIdx = Math.floor((this.bridge.state.correct - 1) / config.level_up.correct_per_level)
    if (levelIdx > prevLevelIdx) {
      Sfx.levelUp()
      const levelUpLabel = this.strings['levelUp'] ?? 'levelUp'
      floatText(this, config.field.width / 2, config.field.height / 2, levelUpLabel, '#22c55e', 1200)
      spawnConfetti(this, config.field.width / 2, config.field.height / 2, 30)
    }
  }

  private onWrongPlacement(): void {
    Sfx.wrong()
    addShake(this, 'wrong')
    spawnWrongParticles(this, this.scale.width / 2, this.scale.height / 2)
  }

  private onComboStep(combo: number): void {
    if (combo % 3 === 0) {
      Sfx.combo()
      const comboLabel = this.strings['comboLabel'] ?? 'comboLabel'
      floatText(this, this.scale.width / 2, 60, comboLabel.replace('{{count}}', `${combo}`), '#ffd700', 600)
    }
  }
}

export default SorterScene
