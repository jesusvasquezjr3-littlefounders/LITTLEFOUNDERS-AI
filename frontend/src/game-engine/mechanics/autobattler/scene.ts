import Phaser from 'phaser'

import {
  generateButtonTexture,
  generatePlaceholderSprite,
} from '@/game-engine/phaser/assets'
import { GameEngineBridge } from '@/game-engine/phaser/bridge'
import {
  addFlash,
  addShake,
  burstParticles,
  floatText,
  spawnCollectSparkles,
  spawnConfetti,
} from '@/game-engine/phaser/juice'
import { BaseMechanicScene } from '@/game-engine/phaser/scene'
import { Sfx } from '@/game-engine/phaser/sfx'

import {
  autobattlerConfigSchema,
  autobattlerContentSchema,
  type AutobattlerConfig,
} from './schema'
import {
  autobattlerSimulator,
  cellColOf,
  cellIndexOf,
  cellRowOf,
  fieldRows,
  incomePreview,
  interestPreview,
  playerTraitCounts,
  type AutobattlerState,
  type AutobattlerUnitInstance,
} from './simulate'

const CELL_KEY = 'ab-cell'
const SHOP_SLOT_KEY = 'ab-shop-slot'
const BTN_REFRESH_KEY = 'ab-btn-refresh'
const BTN_LEVEL_KEY = 'ab-btn-level'
const BTN_READY_KEY = 'ab-btn-ready'
const BAR_BG_KEY = 'ab-bar-bg'
const BAR_FILL_KEY = 'ab-bar-fill'

const BOARD_DEPTH = 2
const UNIT_DEPTH = 10
const HUD_DEPTH = 20
const SHOP_DEPTH = 15

const RARITY_COLORS: Record<number, number> = {
  1: 0x888888,
  2: 0x22c55e,
  3: 0x3b82f6,
  4: 0xa855f7,
}

const RARITY_GLOW: Record<number, number> = {
  1: 0x666666,
  2: 0x16a34a,
  3: 0x2563eb,
  4: 0x7c3aed,
}

interface UnitView {
  uid: number
  container: Phaser.GameObjects.Container
  rect: Phaser.GameObjects.Rectangle
  starIcon: Phaser.GameObjects.Text
  hpBar: Phaser.GameObjects.Rectangle
  hpBarBg: Phaser.GameObjects.Rectangle
  label: Phaser.GameObjects.Text
}

interface FighterView {
  uid: number
  container: Phaser.GameObjects.Container
  rect: Phaser.GameObjects.Rectangle
  hpBar: Phaser.GameObjects.Rectangle
  hpBarBg: Phaser.GameObjects.Rectangle
  shieldRing: Phaser.GameObjects.Arc
}

interface ShopSlotView {
  slotIndex: number
  container: Phaser.GameObjects.Container
  bg: Phaser.GameObjects.Rectangle
  icon: Phaser.GameObjects.Rectangle
  rarityGlow: Phaser.GameObjects.Rectangle
  nameLabel: Phaser.GameObjects.Text
  costLabel: Phaser.GameObjects.Text
}

/** One clickable/keyboard-activatable action-bar chip — Merge, Bench, an Equip offer
 *  per bag item, or Sell. Built fresh whenever `syncActionBar`'s fingerprint changes. */
interface ActionChipSpec {
  label: string
  bg: number
  onActivate: () => void
}

export class AutobattlerScene extends BaseMechanicScene<AutobattlerState> {
  private cellRects: Phaser.GameObjects.Rectangle[] = []
  private unitViews: Map<number, UnitView> = new Map()
  private fighterViews: Map<number, FighterView> = new Map()
  private shopSlotViews: ShopSlotView[] = []
  private goldLabel: Phaser.GameObjects.Text | null = null
  private levelLabel: Phaser.GameObjects.Text | null = null
  private healthLabel: Phaser.GameObjects.Text | null = null
  private scoreLabel: Phaser.GameObjects.Text | null = null
  private incomeLabel: Phaser.GameObjects.Text | null = null
  private interestLabel: Phaser.GameObjects.Text | null = null
  private roundLabel: Phaser.GameObjects.Text | null = null
  private phaseLabel: Phaser.GameObjects.Text | null = null
  private traitText: Phaser.GameObjects.Text | null = null
  private readyBtn: Phaser.GameObjects.Container | null = null
  private refreshBtn: Phaser.GameObjects.Container | null = null
  private levelBtn: Phaser.GameObjects.Container | null = null
  private benchBg: Phaser.GameObjects.Rectangle | null = null
  /** The unit currently armed for placement AND shown in the action bar. Tapping (or
   *  keyboard-selecting, `N`) a unit sets this; it doubles as "inspected" so a single
   *  selection reaches move/merge/equip/sell/bench without a separate gesture. */
  private selectedUnitUid: number | null = null
  private prevPhase: string | null = null
  private prevMerges = 0
  private prevGold = 0
  private prevLevel = 0
  private prevCombatTick = 0
  private boardX = 0
  private boardY = 0
  private cellPixelSize = 0
  /** The §1.11 44px touch-target floor, converted from real CSS px into this run's
   *  internal-canvas px via Phaser's own FIT-mode ratio (`scale.displayScale.x` =
   *  internal px per CSS px). On a narrow phone the game canvas is FIT-scaled down
   *  well below its 800x600 design resolution, so a literal "44" here would render
   *  as far fewer than 44 real CSS px — see `computeMinTouchPx`. */
  private minTouchPx = 44
  /** Keyboard-only board cursor (§1.11 "arrow+Enter to select/place"), local board
   *  coordinates — same space as `AutobattlerUnitInstance.cell`. */
  private cursorCol = 0
  private cursorRow = 0
  private cursorRect: Phaser.GameObjects.Rectangle | null = null
  /** The Merge / Bench / Equip / Sell row shown under the bench whenever a unit is
   *  selected. Rebuilt only when `actionBarFingerprint` changes (not every frame). */
  private actionBarContainer: Phaser.GameObjects.Container | null = null
  private actionBarFingerprint = ''

  constructor() {
    super('autobattler')
  }

  createBridge(): { bridge: GameEngineBridge<AutobattlerState>; simInit: import('@/game-engine/core/types').SimInit } {
    const configParse = autobattlerConfigSchema.safeParse(this.doc.config)
    const contentParse = autobattlerContentSchema.safeParse(this.doc.content)
    if (!configParse.success || !contentParse.success) throw new Error('Invalid autobattler document')
    const simInit = {
      config: configParse.data,
      content: contentParse.data,
      scoring: this.doc.scoring,
      seed: this.seed,
    }
    return { bridge: new GameEngineBridge(autobattlerSimulator, simInit, this.maxTicks), simInit }
  }

  createGameObjects(): void {
    const state = this.bridge.state
    const config = state.config

    this.minTouchPx = this.computeMinTouchPx()

    this.cellPixelSize = Math.max(
      this.minTouchPx,
      Math.min(
        Math.floor((this.scale.width - 220) / config.board.cols),
        Math.floor((this.scale.height - 80) / (config.board.rows * 2 + 2)),
        72,
      ),
    )

    this.boardX = (this.scale.width - config.board.cols * this.cellPixelSize) / 2 + 20
    this.boardY = 56

    generatePlaceholderSprite(this, CELL_KEY, this.cellPixelSize - 2, this.cellPixelSize - 2, this.palette.bgAccent, 'rect')

    generatePlaceholderSprite(this, BAR_BG_KEY, 120, 10, 0x333333, 'rect')
    generatePlaceholderSprite(this, BAR_FILL_KEY, 120, 10, this.palette.success, 'rect')

    generatePlaceholderSprite(this, SHOP_SLOT_KEY, 72, 72, this.palette.bgAccent, 'rect', this.palette.primary)

    this.createBoard(config)
    this.createShop(config)
    this.createHUD(config, state)
    this.createButtons(config)
    this.createActionBar()
    this.createCursor()

    this.cursorCol = Phaser.Math.Clamp(this.cursorCol, 0, config.board.cols - 1)
    this.cursorRow = Phaser.Math.Clamp(this.cursorRow, 0, config.board.rows - 1)

    this.prevPhase = state.phase
    this.prevGold = state.gold
    this.prevLevel = state.level
  }

  /** §1.11's hard 44px touch-target floor, expressed in THIS run's internal-canvas
   *  px. `displayScale.x` is Phaser's own `baseSize.width / canvasBounds.width` (the
   *  FIT-mode ratio between the fixed 800x600 design resolution and the canvas's
   *  real CSS size) — multiplying 44 CSS px by it gives the internal-px size that
   *  actually measures 44 CSS px on screen. Guarded against 0/NaN (jsdom's headless
   *  layout, or a canvas not yet sized) so the floor degrades to a literal 44
   *  rather than producing Infinity. */
  private computeMinTouchPx(): number {
    const raw = this.scale.displayScale.x
    if (!Number.isFinite(raw) || raw <= 0) return 44
    return Math.max(44, 44 * raw)
  }

  /** The player's own board sits in the BOTTOM half of the field grid (rows
   *  `config.board.rows..fieldRows-1`) — the top half renders the (non-interactive)
   *  rival strip. Local `AutobattlerUnitInstance.cell` values only span the bottom
   *  half's own `cols x rows` grid, so every screen-space computation that touches
   *  a placed unit's cell must add this offset back in. */
  private benchRowY(config: AutobattlerConfig): number {
    return this.boardY + fieldRows(config) * this.cellPixelSize + this.cellPixelSize / 2 + 8
  }

  // ---- i18n canvas-text formatting (phaser/scene.ts CANVAS_STRING_KEYS contract) ----
  // Every autobattler HUD/action-bar string is a `games.canvas.*` template, possibly
  // carrying one or more `{{name}}` placeholders (PhaserGameBox resolves `t()` with
  // no interpolation values, so an unresolved placeholder is left as the literal
  // `{{name}}` rather than vanishing). This substitutes every placeholder by hand and
  // falls back to the KEY name itself — never a hardcoded English literal — when the
  // string bag is missing the entry, so a broken wire-up is loud on screen instead of
  // silently shipping English.
  private fmt(key: string, vars: Record<string, string | number> = {}): string {
    let template = this.strings[key] ?? key
    for (const [name, value] of Object.entries(vars)) {
      template = template.split(`{{${name}}}`).join(String(value))
    }
    return template
  }

  private itemLabelOf(itemId: string): string {
    for (const item of this.doc.content.items) {
      if (item.id === itemId) return item.label_md
    }
    return itemId
  }

  setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.paused || this.finished) return
      const state = this.bridge.state
      if (state.phase !== 'prep') return

      const cellIdx = this.cellIndexAt(pointer.x, pointer.y)
      if (cellIdx >= 0) {
        this.handleBoardClick(cellIdx)
        return
      }

      const slotIdx = this.shopSlotIndexAt(pointer.x, pointer.y)
      if (slotIdx >= 0) {
        this.buySlot(slotIdx)
        return
      }

      const benchUnit = this.benchUnitAt(pointer.x, pointer.y)
      if (benchUnit !== null) {
        this.selectUnit(benchUnit.uid)
        Sfx.click()
        return
      }
    })

    this.setupKeyboard()
  }

  /** Keyboard parity for every prep-phase action (§1.11 — none of the 8 mechanics had
   *  ANY keyboard path before this pass). Number keys shop-buy, R/L refresh/level,
   *  SPACE readies the fight, arrow keys move a board cursor, ENTER activates the
   *  cursor cell exactly like a pointer tap on it (reuses `handleBoardClick`), N
   *  cycles the bench, and M/E/B/X act on whatever is currently selected — the same
   *  action-bar operations a pointer reaches via `doMerge`/`doEquip`/`doBench`/
   *  `doSell`. Event-driven (`keydown-X`), not the per-frame `JustDown` polling style
   *  launcher/defender use for CONTINUOUS aiming — every autobattler action is a
   *  discrete one-shot event, so a `keydown` listener is the simpler, correct match. */
  private setupKeyboard(): void {
    const kb = this.input.keyboard
    if (!kb) return

    kb.on('keydown-P', () => this.togglePause())

    const digitCodes = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT'] as const
    digitCodes.forEach((code, index) => {
      kb.on(`keydown-${code}`, () => {
        if (this.paused || this.finished) return
        const state = this.bridge.state
        if (state.phase !== 'prep') return
        if (index >= state.config.shop.offers) return
        this.buySlot(index)
      })
    })

    kb.on('keydown-R', () => {
      if (this.paused || this.finished) return
      if (this.bridge.state.phase !== 'prep') return
      this.bridge.enqueue('refresh')
      Sfx.click()
    })

    kb.on('keydown-L', () => {
      if (this.paused || this.finished) return
      if (this.bridge.state.phase !== 'prep') return
      this.bridge.enqueue('level')
      Sfx.click()
    })

    kb.on('keydown-SPACE', () => {
      if (this.paused || this.finished) return
      if (this.bridge.state.phase !== 'prep') return
      this.bridge.enqueue('ready')
      Sfx.whoosh()
    })

    kb.on('keydown-UP', () => this.moveCursor(0, -1))
    kb.on('keydown-DOWN', () => this.moveCursor(0, 1))
    kb.on('keydown-LEFT', () => this.moveCursor(-1, 0))
    kb.on('keydown-RIGHT', () => this.moveCursor(1, 0))

    kb.on('keydown-ENTER', () => {
      if (this.paused || this.finished) return
      const state = this.bridge.state
      if (state.phase !== 'prep') return
      const cellIdx = cellIndexOf(state.config.board.cols, this.cursorCol, this.cursorRow)
      this.handleBoardClick(cellIdx)
    })

    kb.on('keydown-N', () => this.cycleBenchSelection())

    kb.on('keydown-M', () => {
      if (this.paused || this.finished) return
      const unit = this.selectedUnit()
      if (unit === undefined) return
      const mergeableId = this.mergeableTypeIdFor(unit)
      if (mergeableId === undefined) return
      this.doMerge(mergeableId)
    })

    kb.on('keydown-E', () => {
      if (this.paused || this.finished) return
      const state = this.bridge.state
      const unit = this.selectedUnit()
      if (unit === undefined || unit.items.length >= 3) return
      const itemId = state.bag[0]
      if (itemId === undefined) return
      this.doEquip(unit.uid, itemId)
    })

    kb.on('keydown-B', () => {
      if (this.paused || this.finished) return
      const unit = this.selectedUnit()
      if (unit === undefined || unit.cell < 0) return
      this.doBench(unit.uid)
    })

    kb.on('keydown-X', () => {
      if (this.paused || this.finished) return
      const unit = this.selectedUnit()
      if (unit === undefined) return
      this.doSell(unit.uid)
    })

    kb.on('keydown-ESC', () => {
      this.selectedUnitUid = null
    })
  }

  private selectedUnit(): AutobattlerUnitInstance | undefined {
    if (this.selectedUnitUid === null) return undefined
    return this.bridge.state.units.find((unit) => unit.uid === this.selectedUnitUid)
  }

  private moveCursor(deltaCol: number, deltaRow: number): void {
    if (this.paused || this.finished) return
    if (this.bridge.state.phase !== 'prep') return
    const config = this.bridge.state.config
    this.cursorCol = Phaser.Math.Clamp(this.cursorCol + deltaCol, 0, config.board.cols - 1)
    this.cursorRow = Phaser.Math.Clamp(this.cursorRow + deltaRow, 0, config.board.rows - 1)
  }

  private cycleBenchSelection(): void {
    if (this.paused || this.finished) return
    const state = this.bridge.state
    if (state.phase !== 'prep') return
    const bench = state.units.filter((unit) => unit.cell < 0)
    if (bench.length === 0) return
    const currentIndex = bench.findIndex((unit) => unit.uid === this.selectedUnitUid)
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % bench.length
    const nextUid = bench[nextIndex]?.uid
    if (nextUid === undefined) return
    this.selectedUnitUid = nextUid
    Sfx.click()
  }

  updateGameObjects(_delta: number): void {
    const state = this.bridge.state
    const config = state.config

    this.syncPrepUnits(state)
    this.syncFighterViews(state)
    this.syncShop(state)
    this.syncActionBar(state)
    this.updateCursor(state)

    if (this.goldLabel) this.goldLabel.setText(this.fmt('goldLabel', { amount: state.gold }))
    if (this.levelLabel) {
      this.levelLabel.setText(
        this.fmt('levelLabel', {
          level: state.level,
          xp: state.xp,
          needed: config.shop.level.xp_needed[state.level - 1] ?? '?',
        }),
      )
    }
    if (this.healthLabel) this.healthLabel.setText(this.fmt('healthLabel', { health: state.health }))
    if (this.scoreLabel) this.scoreLabel.setText(this.fmt('scoreLabel', { score: Math.round(this.bridge.snapshot.score) }))
    if (this.roundLabel) {
      this.roundLabel.setText(this.fmt('roundShort', { current: state.round + 1, total: config.rounds.length }))
    }
    if (this.incomeLabel) this.incomeLabel.setText(this.fmt('incomePreview', { amount: incomePreview(state) }))
    if (this.interestLabel) this.interestLabel.setText(this.fmt('interestPreview', { amount: interestPreview(state) }))

    if (this.phaseLabel) {
      const label = state.phase === 'prep' ? this.fmt('prep') : state.phase === 'combat' ? this.fmt('combat') : this.fmt('over')
      this.phaseLabel.setText(label)
      this.phaseLabel.setColor(state.phase === 'combat' ? '#ef4444' : state.phase === 'prep' ? '#3b82f6' : '#888888')
    }

    const traits = playerTraitCounts(state)
    if (this.traitText) {
      const active = traits.filter((c) => c > 0)
      this.traitText.setText(active.length > 0 ? this.fmt('synergyLabel', { traits: active.join('/') }) : '')
    }

    if (state.phase === 'combat' && state.combatTick !== this.prevCombatTick) {
      this.onCombatTick(state)
    }

    if (state.phase !== this.prevPhase) {
      if (state.phase === 'combat') {
        Sfx.whoosh()
        addFlash(this, this.palette.danger, 120)
        floatText(this, this.scale.width / 2, 40, this.fmt('fight'), '#ef4444', 1200)
        this.selectedUnitUid = null
      }
      if (state.phase === 'prep' && this.prevPhase === 'combat') {
        const won = state.roundsWon > (state.roundsLost > 0 ? state.roundsLost : 0) || state.combatTick === 0
        if (won) {
          Sfx.levelUp()
          spawnConfetti(this, this.scale.width / 2, this.scale.height / 2, 30)
        } else {
          Sfx.gameOver()
          addFlash(this, this.palette.danger, 200)
          addShake(this, 'heavy')
        }
      }
    }

    if (state.merges > this.prevMerges) {
      Sfx.powerUp()
      spawnCollectSparkles(this, this.scale.width / 2, 140)
    }

    if (state.gold > this.prevGold && this.goldLabel) {
      this.tweens.add({
        targets: this.goldLabel,
        scaleX: 1.15,
        scaleY: 1.15,
        duration: 100,
        yoyo: true,
        ease: 'Sine.easeOut',
      })
    }

    if (state.level > this.prevLevel) {
      Sfx.levelUp()
      burstParticles(this, this.scale.width / 2, 100, {
        texture: 'px-circle-gold',
        count: 12,
        speed: { min: 60, max: 180 },
        lifespan: 600,
        scale: { start: 0.8, end: 0 },
        gravityY: 60,
      })
    }

    this.prevPhase = state.phase
    this.prevMerges = state.merges
    this.prevGold = state.gold
    this.prevLevel = state.level
    this.prevCombatTick = state.combatTick
  }

  private createBoard(config: AutobattlerConfig): void {
    const size = this.cellPixelSize
    const FR = fieldRows(config)

    for (let r = 0; r < FR; r += 1) {
      for (let c = 0; c < config.board.cols; c += 1) {
        const x = this.boardX + c * size + size / 2
        const y = this.boardY + r * size + size / 2
        const isEnemySide = r < config.board.rows
        const color = isEnemySide ? 0x1a1a2e : this.palette.bgAccent

        const cell = this.add.rectangle(x, y, size - 2, size - 2, color, 0.6)
        cell.setDepth(BOARD_DEPTH)
        cell.setStrokeStyle(1, this.palette.primary, 0.15)
        this.cellRects.push(cell)
      }
    }

    const benchY = this.benchRowY(config)
    this.benchBg = this.add.rectangle(
      this.boardX + (config.board.cols * size) / 2,
      benchY,
      config.board.cols * size,
      size,
      this.palette.bgAccent,
      0.4,
    )
    this.benchBg.setDepth(BOARD_DEPTH)
    this.benchBg.setStrokeStyle(1, this.palette.primary, 0.15)
  }

  private createCursor(): void {
    this.cursorRect = this.add.rectangle(0, 0, this.cellPixelSize - 6, this.cellPixelSize - 6, 0, 0)
    this.cursorRect.setStrokeStyle(3, this.palette.accent, 0.9)
    this.cursorRect.setDepth(UNIT_DEPTH + 2)
    this.cursorRect.setVisible(false)
  }

  /** Keyboard-only visual focus ring over `cursorCol`/`cursorRow` — the pointer path
   *  needs no equivalent since a tap/click is itself the position indicator. */
  private updateCursor(state: AutobattlerState): void {
    if (!this.cursorRect) return
    const visible = state.phase === 'prep' && !this.paused && !this.finished
    this.cursorRect.setVisible(visible)
    if (!visible) return
    const config = state.config
    const size = this.cellPixelSize
    this.cursorRect.setPosition(
      this.boardX + this.cursorCol * size + size / 2,
      this.boardY + (config.board.rows + this.cursorRow) * size + size / 2,
    )
  }

  private createShop(config: AutobattlerConfig): void {
    const shopX = this.scale.width - 190
    const shopY = 100
    const slotSize = Math.max(this.minTouchPx, 72)

    this.add.rectangle(shopX + 90, this.scale.height / 2, 180, this.scale.height - 20, this.palette.surface, 0.6)
      .setDepth(SHOP_DEPTH - 1)
      .setStrokeStyle(1, this.palette.primary, 0.2)

    const padding = 8
    for (let i = 0; i < config.shop.offers; i += 1) {
      const sx = shopX + 20 + slotSize / 2
      const sy = shopY + 30 + i * (slotSize + padding)

      const container = this.add.container(sx, sy)
      container.setDepth(SHOP_DEPTH)

      const bg = this.add.rectangle(0, 0, slotSize, slotSize, this.palette.bgAccent, 0.8)
      bg.setStrokeStyle(1, this.palette.primary, 0.3)
      bg.setInteractive({ cursor: 'pointer' })
      container.add(bg)

      const icon = this.add.rectangle(0, -8, slotSize - 20, slotSize - 20, this.palette.primary, 1)
      container.add(icon)

      const rarityGlow = this.add.rectangle(0, 0, slotSize + 2, slotSize + 2, 0x888888, 0.2)
      rarityGlow.setDepth(SHOP_DEPTH - 0.5)
      container.add(rarityGlow)

      const nameLabel = this.makeText(0, 22, '', 10, this.palette.text, SHOP_DEPTH + 1)
      container.add(nameLabel)

      const costLabel = this.makeText(0, 34, '', 10, this.palette.warning, SHOP_DEPTH + 1)
      container.add(costLabel)

      container.setVisible(false)

      this.shopSlotViews.push({
        slotIndex: i,
        container,
        bg,
        icon,
        rarityGlow,
        nameLabel,
        costLabel,
      })
    }
  }

  private createHUD(config: AutobattlerConfig, state: AutobattlerState): void {
    const y = 20

    this.goldLabel = this.makeText(60, y, this.fmt('goldLabel', { amount: state.gold }), 18, this.palette.warning, HUD_DEPTH)
    this.levelLabel = this.makeText(
      160,
      y,
      this.fmt('levelLabel', { level: state.level, xp: state.xp, needed: config.shop.level.xp_needed[0] ?? '?' }),
      14,
      this.palette.primary,
      HUD_DEPTH,
    )
    this.healthLabel = this.makeText(260, y, this.fmt('healthLabel', { health: state.health }), 16, this.palette.danger, HUD_DEPTH)
    this.scoreLabel = this.makeText(380, y, this.fmt('scoreLabel', { score: 0 }), 16, this.palette.text, HUD_DEPTH)
    this.roundLabel = this.makeText(480, y, this.fmt('roundShort', { current: 1, total: config.rounds.length }), 14, this.palette.text, HUD_DEPTH)
    this.phaseLabel = this.makeText(this.scale.width / 2, y, this.fmt('prep'), 16, this.palette.primary, HUD_DEPTH)

    this.incomeLabel = this.makeText(60, 44, this.fmt('incomePreview', { amount: 0 }), 12, this.palette.success, HUD_DEPTH)
    this.interestLabel = this.makeText(160, 44, this.fmt('interestPreview', { amount: 0 }), 12, this.palette.warning, HUD_DEPTH)
    this.traitText = this.makeText(320, 44, '', 11, this.palette.text, HUD_DEPTH)
  }

  private createButtons(config: AutobattlerConfig): void {
    const shopX = this.scale.width - 190
    const btnX = shopX + 90
    const gap = 10

    const readyW = Math.max(this.minTouchPx, 130)
    const readyH = Math.max(this.minTouchPx, 44)
    const levelW = Math.max(this.minTouchPx, 90)
    const levelH = Math.max(this.minTouchPx, 36)
    const refreshW = Math.max(this.minTouchPx, 90)
    const refreshH = Math.max(this.minTouchPx, 36)

    generateButtonTexture(this, BTN_REFRESH_KEY, refreshW, refreshH, this.palette.surface, this.palette.text, 6)
    generateButtonTexture(this, BTN_LEVEL_KEY, levelW, levelH, this.palette.surface, this.palette.primary, 6)
    generateButtonTexture(this, BTN_READY_KEY, readyW, readyH, this.palette.accent, this.palette.inverseText, 10)

    // Stacked bottom-up from a fixed baseline so the §1.11 touch-target floor never
    // makes two buttons overlap: each button's own height decides the next gap.
    const readyY = this.scale.height - readyH / 2 - 10
    const levelY = readyY - readyH / 2 - gap - levelH / 2
    const refreshY = levelY - levelH / 2 - gap - refreshH / 2

    const refreshContainer = this.add.container(btnX, refreshY)
    refreshContainer.setDepth(SHOP_DEPTH)
    refreshContainer.setSize(refreshW, refreshH)
    const refreshBg = this.add.image(0, 0, BTN_REFRESH_KEY)
    refreshBg.setInteractive({ cursor: 'pointer' })
    refreshContainer.add(refreshBg)
    const refreshLabel = this.makeText(0, 0, this.fmt('refreshCost', { cost: config.shop.refresh_cost }), 13, this.palette.text, SHOP_DEPTH + 1)
    refreshContainer.add(refreshLabel)
    refreshBg.on('pointerdown', () => {
      if (this.paused || this.finished) return
      this.bridge.enqueue('refresh')
      Sfx.click()
    })
    this.refreshBtn = refreshContainer

    const levelContainer = this.add.container(btnX, levelY)
    levelContainer.setDepth(SHOP_DEPTH)
    levelContainer.setSize(levelW, levelH)
    const levelBg = this.add.image(0, 0, BTN_LEVEL_KEY)
    levelBg.setInteractive({ cursor: 'pointer' })
    levelContainer.add(levelBg)
    const levelBtnLabel = this.makeText(0, 0, this.fmt('levelUpCost', { cost: config.shop.level.xp_cost }), 13, this.palette.primary, SHOP_DEPTH + 1)
    levelContainer.add(levelBtnLabel)
    levelBg.on('pointerdown', () => {
      if (this.paused || this.finished) return
      this.bridge.enqueue('level')
      Sfx.click()
    })
    this.levelBtn = levelContainer

    const readyContainer = this.add.container(btnX, readyY)
    readyContainer.setDepth(SHOP_DEPTH)
    readyContainer.setSize(readyW, readyH)
    const readyBg = this.add.image(0, 0, BTN_READY_KEY)
    readyBg.setInteractive({ cursor: 'pointer' })
    readyContainer.add(readyBg)
    const readyLabel = this.makeText(0, 0, this.fmt('fight'), 16, this.palette.inverseText, SHOP_DEPTH + 1)
    readyContainer.add(readyLabel)
    readyBg.on('pointerdown', () => {
      if (this.paused || this.finished) return
      if (this.bridge.state.phase !== 'prep') return
      this.bridge.enqueue('ready')
      Sfx.whoosh()
    })
    this.readyBtn = readyContainer
  }

  private createActionBar(): void {
    const config = this.bridge.state.config
    const x = this.boardX + (config.board.cols * this.cellPixelSize) / 2
    const y = this.benchRowY(config) + this.cellPixelSize / 2 + Math.max(this.minTouchPx, 36) / 2 + 10
    this.actionBarContainer = this.add.container(x, y)
    this.actionBarContainer.setDepth(SHOP_DEPTH + 2)
    this.actionBarContainer.setVisible(false)
  }

  private makeActionChip(spec: ActionChipSpec): Phaser.GameObjects.Container {
    const h = Math.max(this.minTouchPx, 34)
    const text = this.makeText(0, 0, spec.label, 12, this.palette.inverseText, SHOP_DEPTH + 3)
    const w = Math.max(this.minTouchPx, text.width + 20)
    const bg = this.add.rectangle(0, 0, w, h, spec.bg, 1)
    bg.setStrokeStyle(1, this.palette.text, 0.25)
    bg.setInteractive({ cursor: 'pointer' })
    bg.on('pointerdown', () => {
      if (this.paused || this.finished) return
      spec.onActivate()
    })
    const container = this.add.container(0, 0, [bg, text])
    container.setSize(w, h)
    return container
  }

  /** Rebuilds the action bar's buttons ONLY when what they should show actually
   *  changed (selection, mergeability, board/bench-ness, held items, or the bag) —
   *  not every frame, matching the diff-and-patch convention `syncPrepUnits`/
   *  `syncShop` already use elsewhere in this file. */
  private syncActionBar(state: AutobattlerState): void {
    const uid = this.selectedUnitUid
    if (uid === null || state.phase !== 'prep') {
      this.hideActionBar()
      return
    }
    const unit = state.units.find((candidate) => candidate.uid === uid)
    if (unit === undefined) {
      this.selectedUnitUid = null
      this.hideActionBar()
      return
    }

    const mergeableId = this.mergeableTypeIdFor(unit)
    const fingerprint = `${uid}:${mergeableId ?? ''}:${unit.cell}:${unit.items.length}:${state.bag.join('|')}`
    if (fingerprint === this.actionBarFingerprint) return
    this.actionBarFingerprint = fingerprint
    this.rebuildActionBar(unit, mergeableId, state)
  }

  private hideActionBar(): void {
    if (this.actionBarFingerprint === '') return
    this.actionBarFingerprint = ''
    this.actionBarContainer?.removeAll(true)
    this.actionBarContainer?.setVisible(false)
  }

  private rebuildActionBar(unit: AutobattlerUnitInstance, mergeableId: string | undefined, state: AutobattlerState): void {
    const bar = this.actionBarContainer
    if (!bar) return
    bar.removeAll(true)

    const specs: ActionChipSpec[] = []

    if (mergeableId !== undefined) {
      specs.push({
        label: this.fmt('merge'),
        bg: this.palette.accent,
        onActivate: () => this.doMerge(mergeableId),
      })
    }
    if (unit.cell >= 0) {
      specs.push({
        label: this.fmt('toBench'),
        bg: this.palette.surface,
        onActivate: () => this.doBench(unit.uid),
      })
    }
    const equipSlots = Math.max(0, 3 - unit.items.length)
    for (const itemId of state.bag.slice(0, equipSlots)) {
      specs.push({
        label: `${this.fmt('equip')}: ${this.itemLabelOf(itemId)}`,
        bg: this.palette.surface,
        onActivate: () => this.doEquip(unit.uid, itemId),
      })
    }
    specs.push({
      label: this.fmt('sell'),
      bg: this.palette.danger,
      onActivate: () => this.doSell(unit.uid),
    })

    const chips = specs.map((spec) => this.makeActionChip(spec))
    const gap = 8
    let totalWidth = 0
    for (const chip of chips) totalWidth += chip.width + gap
    totalWidth -= gap

    let x = -totalWidth / 2
    for (const chip of chips) {
      chip.x = x + chip.width / 2
      x += chip.width + gap
      bar.add(chip)
    }
    bar.setVisible(true)
  }

  private mergeableTypeIdFor(unit: AutobattlerUnitInstance): string | undefined {
    const config = this.bridge.state.config
    if (unit.star >= config.merge.max_star) return undefined
    let copies = 0
    for (const candidate of this.bridge.state.units) {
      if (candidate.typeIndex === unit.typeIndex && candidate.star === unit.star) copies += 1
    }
    if (copies < config.merge.copies_needed) return undefined
    return config.units[unit.typeIndex]?.id
  }

  /** Emits the SAME `merge` shape `autobattler.test.ts`/`bots.ts` use:
   *  `{ slot: typeId }` — `simulate.ts`'s `applyMerge` looks the type up by id, not
   *  by uid, since a merge always targets "the type", not one specific copy. */
  private doMerge(typeId: string): void {
    if (this.paused || this.finished) return
    this.bridge.enqueue('merge', { slot: typeId })
    Sfx.powerUp()
    this.selectedUnitUid = null
  }

  private doSell(uid: number): void {
    if (this.paused || this.finished) return
    this.bridge.enqueue('sell', { n: uid })
    Sfx.click()
    this.selectedUnitUid = null
  }

  private doBench(uid: number): void {
    if (this.paused || this.finished) return
    this.bridge.enqueue('place', { n: uid, x: -1, y: -1 })
    Sfx.click()
    this.selectedUnitUid = null
  }

  /** Selection deliberately stays OPEN after an equip (DOM `components.tsx` parity):
   *  a unit may hold up to three items, so a child equipping a fresh camp drop
   *  should not have to re-select the same unit for every item. */
  private doEquip(uid: number, itemId: string): void {
    if (this.paused || this.finished) return
    this.bridge.enqueue('equip', { n: uid, slot: itemId })
    Sfx.click()
  }

  private syncPrepUnits(state: AutobattlerState): void {
    const config = state.config
    const size = this.cellPixelSize
    const currentUids = new Set(state.units.map((u) => u.uid))

    for (const [uid, view] of this.unitViews) {
      if (!currentUids.has(uid)) {
        view.container.destroy()
        this.unitViews.delete(uid)
      }
    }

    for (const unit of state.units) {
      let view = this.unitViews.get(unit.uid)
      const unitType = config.units[unit.typeIndex]
      if (!unitType) continue
      const unitSize = Math.max(24, size - 10)

      let x: number
      let y: number
      if (unit.cell >= 0) {
        const col = cellColOf(config.board.cols, unit.cell)
        const localRow = cellRowOf(config.board.cols, unit.cell)
        x = this.boardX + col * size + size / 2
        // The player's board is the BOTTOM half of the field grid (see `benchRowY`'s
        // doc comment) — `localRow` is 0-based within just the player's own rows, so
        // it needs `config.board.rows` added back to land in the right half instead
        // of the (non-interactive) rival strip above it.
        y = this.boardY + (config.board.rows + localRow) * size + size / 2
      } else {
        const benchIdx = state.units.filter((u) => u.cell < 0).indexOf(unit)
        const benchY = this.benchRowY(config)
        x = this.boardX + benchIdx * size + size / 2
        y = benchY
      }

      if (!view) {
        const container = this.add.container(x, y)
        container.setDepth(unit.cell >= 0 ? UNIT_DEPTH : UNIT_DEPTH - 2)

        const color = RARITY_COLORS[unitType.rarity] ?? this.palette.primary
        const rect = this.add.rectangle(0, 0, unitSize, unitSize, color, 1)
        rect.setStrokeStyle(1, this.palette.text, 0.4)
        container.add(rect)

        const starIcon = this.makeText(0, -unitSize / 2 + 8, '\u{2605}'.repeat(Math.min(unit.star, 3)), 9 + unit.star, RARITY_GLOW[unitType.rarity] ?? this.palette.warning, UNIT_DEPTH + 1)
        container.add(starIcon)

        const hpBarBg = this.add.rectangle(0, unitSize / 2 - 2, unitSize - 4, 4, 0x333333, 0.8)
        container.add(hpBarBg)
        const hpBar = this.add.rectangle(-(unitSize - 4) / 2, unitSize / 2 - 2, unitSize - 4, 4, this.palette.success, 1)
        hpBar.setOrigin(0, 0.5)
        container.add(hpBar)

        const label = this.makeText(0, unitSize / 2 + 10, unitType.id.slice(0, 8), 9, this.palette.text, UNIT_DEPTH + 1)
        container.add(label)

        // Interactive (not click-bound): a board/bench unit is selected via the
        // global pointerdown handler in `setupInput` (`cellIndexAt`/`benchUnitAt`
        // dispatch to `handleBoardClick`/`selectUnit`) — attaching a SECOND handler
        // here would double-fire on the same tap (this container's own listener
        // plus the global one), toggling selection straight back off.
        container.setInteractive(new Phaser.Geom.Rectangle(-unitSize / 2, -unitSize / 2, unitSize, unitSize), Phaser.Geom.Rectangle.Contains)

        view = { uid: unit.uid, container, rect, starIcon, hpBar, hpBarBg, label }
        this.unitViews.set(unit.uid, view)

        this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, from: 0.3, duration: 200, ease: 'Back.easeOut' })
      }

      view.container.x = x
      view.container.y = y
      view.container.setAlpha(unit.cell >= 0 ? 1 : 0.6)
      if (unit.uid === this.selectedUnitUid) {
        view.rect.setStrokeStyle(2, this.palette.accent, 1)
      } else {
        view.rect.setStrokeStyle(1, this.palette.text, 0.4)
      }
    }
  }

  private syncFighterViews(state: AutobattlerState): void {
    if (state.phase !== 'combat') {
      for (const [, view] of this.fighterViews) view.container.destroy()
      this.fighterViews.clear()
      return
    }

    const alpha = this.bridge.alpha
    const prevState = this.bridge.prevState
    const currentUids = new Set(state.fighters.map((f) => f.uid))

    for (const [uid, view] of this.fighterViews) {
      if (!currentUids.has(uid)) {
        this.tweens.add({
          targets: view.container,
          alpha: 0,
          scaleX: 0.5,
          scaleY: 0.5,
          duration: 200,
          onComplete: () => view.container.destroy(),
        })
        this.fighterViews.delete(uid)
      }
    }

    for (const fighter of state.fighters) {
      let view = this.fighterViews.get(fighter.uid)
      const mx = this.boardX + (fighter.x / 1000) * this.cellPixelSize
      const my = this.boardY + (fighter.y / 1000) * this.cellPixelSize
      const unitSize = Math.max(20, this.cellPixelSize - 14)

      if (!view) {
        const container = this.add.container(mx, my)
        container.setDepth(UNIT_DEPTH)

        const color = fighter.side === 0 ? this.palette.primary : this.palette.danger
        const rect = this.add.rectangle(0, 0, unitSize, unitSize, color, 1)
        rect.setStrokeStyle(1, this.palette.text, 0.4)
        container.add(rect)

        const hpBarBg = this.add.rectangle(0, unitSize / 2 + 2, unitSize, 3, 0x333333, 0.8)
        container.add(hpBarBg)
        const hpBar = this.add.rectangle(-unitSize / 2, unitSize / 2 + 2, unitSize, 3, this.palette.success, 1)
        hpBar.setOrigin(0, 0.5)
        container.add(hpBar)

        const shieldRing = this.add.circle(0, 0, unitSize / 2 + 3, this.palette.primary, 0)
        shieldRing.setStrokeStyle(1, this.palette.primary, 0)
        shieldRing.setDepth(UNIT_DEPTH - 0.5)
        container.add(shieldRing)

        view = { uid: fighter.uid, container, rect, hpBar, hpBarBg, shieldRing }
        this.fighterViews.set(fighter.uid, view)

        this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, from: 0, duration: 250, ease: 'Back.easeOut' })
      }

      const prevFighter = prevState?.fighters.find((f) => f.uid === fighter.uid)
      const px = prevFighter ? Phaser.Math.Linear(
        this.boardX + (prevFighter.x / 1000) * this.cellPixelSize,
        mx,
        alpha,
      ) : mx
      const py = prevFighter ? Phaser.Math.Linear(
        this.boardY + (prevFighter.y / 1000) * this.cellPixelSize,
        my,
        alpha,
      ) : my

      view.container.x = px
      view.container.y = py

      const hpPct = Math.max(0, fighter.hp / fighter.maxHp)
      view.hpBar.setDisplaySize(unitSize * hpPct, 3)
      view.hpBar.setFillStyle(hpPct > 0.5 ? this.palette.success : hpPct > 0.25 ? this.palette.warning : this.palette.danger)

      if (fighter.shield > 0) {
        view.shieldRing.setStrokeStyle(1, this.palette.primary, 0.4 + Math.min(1, fighter.shield / 200) * 0.4)
      } else {
        view.shieldRing.setStrokeStyle(1, this.palette.primary, 0)
      }

      if (fighter.hp <= 0) {
        view.container.setAlpha(0.3)
      }
    }
  }

  private syncShop(state: AutobattlerState): void {
    const config = state.config
    if (state.phase !== 'prep') {
      for (const slot of this.shopSlotViews) slot.container.setVisible(false)
      return
    }

    for (const slot of this.shopSlotViews) {
      const typeIndex = state.shop[slot.slotIndex]
      if (typeIndex === undefined || typeIndex < 0) {
        slot.container.setVisible(false)
        continue
      }

      const unitType = config.units[typeIndex]
      if (!unitType) { slot.container.setVisible(false); continue }

      slot.container.setVisible(true)

      const rarityColor = RARITY_COLORS[unitType.rarity] ?? this.palette.primary
      slot.icon.setFillStyle(rarityColor, 1)
      slot.rarityGlow.setStrokeStyle(1, RARITY_GLOW[unitType.rarity] ?? this.palette.primary, 0.4)
      slot.nameLabel.setText(unitType.id.slice(0, 10))
      slot.costLabel.setText(this.fmt('shopCost', { cost: unitType.cost }))
      slot.costLabel.setColor(state.gold >= unitType.cost ? '#ffd700' : '#888888')
    }
  }

  private onCombatTick(state: AutobattlerState): void {
    for (const fighter of state.fighters) {
      const view = this.fighterViews.get(fighter.uid)
      if (!view || fighter.hp <= 0) continue

      burstParticles(this, view.container.x, view.container.y, {
        texture: 'px-circle-white',
        count: 2,
        speed: { min: 20, max: 60 },
        lifespan: 200,
        scale: { start: 0.4, end: 0 },
        gravityY: -40,
      })
    }
    Sfx.hit()
  }

  /** Local board-space cell index (0..cols*rows-1), matching
   *  `AutobattlerUnitInstance.cell`'s own coordinate space — or -1 outside the
   *  player's own (bottom) half of the field grid. Pointer hits on the rival strip
   *  (the top half) are NOT board cells: that area is display-only. */
  private cellIndexAt(x: number, y: number): number {
    const config = this.bridge.state.config
    const size = this.cellPixelSize
    const col = Math.floor((x - this.boardX) / size)
    const fieldRow = Math.floor((y - this.boardY) / size)
    const localRow = fieldRow - config.board.rows
    if (col < 0 || col >= config.board.cols || localRow < 0 || localRow >= config.board.rows) return -1
    return cellIndexOf(config.board.cols, col, localRow)
  }

  private shopSlotIndexAt(x: number, y: number): number {
    for (const slot of this.shopSlotViews) {
      if (!slot.container.visible) continue
      const bounds = slot.container.getBounds()
      if (bounds.contains(x, y)) return slot.slotIndex
    }
    return -1
  }

  private benchUnitAt(x: number, y: number): AutobattlerUnitInstance | null {
    const state = this.bridge.state
    const config = state.config
    const size = this.cellPixelSize
    const benchY = this.benchRowY(config)
    const benchUnits = state.units.filter((u) => u.cell < 0)

    for (let i = 0; i < benchUnits.length; i += 1) {
      const ux = this.boardX + i * size + size / 2
      if (Math.abs(x - ux) < size / 2 && Math.abs(y - benchY) < size / 2) {
        return benchUnits[i] ?? null
      }
    }
    return null
  }

  private buySlot(slotIndex: number): void {
    this.bridge.enqueue('buy', { n: slotIndex })
    Sfx.pop()
    burstParticles(this, this.shopSlotViews[slotIndex]?.container.x ?? 0, this.shopSlotViews[slotIndex]?.container.y ?? 0, {
      texture: 'px-circle-gold',
      count: 5,
      speed: { min: 40, max: 80 },
      lifespan: 300,
      scale: { start: 0.5, end: 0 },
      gravityY: 100,
    })
  }

  /** `cellIdx` is LOCAL board space (see `cellIndexAt`'s doc comment) — shared by
   *  the pointer path (via `cellIndexAt`) and the keyboard path (`ENTER` on the
   *  cursor, via `cellIndexOf` directly), so both reach the same place/select logic. */
  private handleBoardClick(cellIdx: number): void {
    const state = this.bridge.state
    const config = state.config
    const col = cellColOf(config.board.cols, cellIdx)
    const row = cellRowOf(config.board.cols, cellIdx)

    if (this.selectedUnitUid !== null) {
      this.bridge.enqueue('place', { n: this.selectedUnitUid, x: col, y: row })
      Sfx.click()
      this.selectedUnitUid = null
      return
    }

    const occupant = state.units.find((u) => u.cell === cellIdx)
    if (occupant) {
      this.selectUnit(occupant.uid)
      Sfx.click()
    }
  }

  private selectUnit(uid: number): void {
    this.selectedUnitUid = this.selectedUnitUid === uid ? null : uid
    if (this.selectedUnitUid !== null) {
      const view = this.unitViews.get(uid)
      if (view) {
        this.tweens.add({
          targets: view.rect,
          scaleX: 1.12,
          scaleY: 1.12,
          duration: 120,
          yoyo: true,
          ease: 'Back.easeOut',
        })
      }
    }
  }
}

export default AutobattlerScene
