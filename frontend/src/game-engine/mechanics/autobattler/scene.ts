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
  private fightText: Phaser.GameObjects.Text | null = null
  private traitText: Phaser.GameObjects.Text | null = null
  private readyBtn: Phaser.GameObjects.Container | null = null
  private refreshBtn: Phaser.GameObjects.Container | null = null
  private levelBtn: Phaser.GameObjects.Container | null = null
  private benchBg: Phaser.GameObjects.Rectangle | null = null
  private selectedUnitUid: number | null = null
  private prevPhase: string | null = null
  private prevMerges = 0
  private prevGold = 0
  private prevLevel = 0
  private prevCombatTick = 0
  private boardX = 0
  private boardY = 0
  private cellPixelSize = 0

  constructor() {
    super('autobattler-scene')
  }

  createBridge(): { bridge: GameEngineBridge<AutobattlerState>; simInit: import('@/game-engine/core/types').SimInit } {
    const configParse = autobattlerConfigSchema.safeParse(this.doc.config)
    const contentParse = autobattlerContentSchema.safeParse(this.doc.content)
    if (!configParse.success || !contentParse.success) throw new Error('Invalid autobattler document')
    const simInit = {
      config: configParse.data,
      content: contentParse.data,
      scoring: this.doc.scoring,
      seed: (this.scene.settings.data as Record<string, unknown>)?.seed as number ?? Date.now(),
    }
    return { bridge: new GameEngineBridge(autobattlerSimulator, simInit), simInit }
  }

  createGameObjects(): void {
    const state = this.bridge.state
    const config = state.config

    this.cellPixelSize = Math.min(
      Math.floor((this.scale.width - 220) / config.board.cols),
      Math.floor((this.scale.height - 80) / (config.board.rows * 2 + 2)),
      72,
    )

    this.boardX = (this.scale.width - config.board.cols * this.cellPixelSize) / 2 + 20
    this.boardY = 56

    generatePlaceholderSprite(this, CELL_KEY, this.cellPixelSize - 2, this.cellPixelSize - 2, this.palette.bgAccent, 'rect')

    generatePlaceholderSprite(this, BAR_BG_KEY, 120, 10, 0x333333, 'rect')
    generatePlaceholderSprite(this, BAR_FILL_KEY, 120, 10, this.palette.success, 'rect')

    generatePlaceholderSprite(this, SHOP_SLOT_KEY, 72, 72, this.palette.bgAccent, 'rect', this.palette.primary)

    generateButtonTexture(this, BTN_REFRESH_KEY, 80, 32, this.palette.surface, this.palette.text, 6)
    generateButtonTexture(this, BTN_LEVEL_KEY, 80, 32, this.palette.surface, this.palette.primary, 6)
    generateButtonTexture(this, BTN_READY_KEY, 120, 40, this.palette.accent, this.palette.inverseText, 10)

    this.createBoard(config)
    this.createShop(config)
    this.createHUD(config)
    this.createButtons(config)

    this.prevPhase = state.phase
    this.prevGold = state.gold
    this.prevLevel = state.level
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
        this.handleShopClick(slotIdx)
        return
      }

      const benchUnit = this.benchUnitAt(pointer.x, pointer.y)
      if (benchUnit !== null) {
        this.selectUnit(benchUnit.uid)
        Sfx.click()
        return
      }
    })
  }

  updateGameObjects(_delta: number): void {
    const state = this.bridge.state
    const config = state.config

    this.syncPrepUnits(state)
    this.syncFighterViews(state)
    this.syncShop(state)

    if (this.goldLabel) this.goldLabel.setText(`${state.gold}`)
    if (this.levelLabel) this.levelLabel.setText(`Lv${state.level} ${state.xp}/${config.shop.level.xp_needed[state.level - 1] ?? '?'}`)
    if (this.healthLabel) this.healthLabel.setText(`${'\u{2764}'} ${state.health}`)
    if (this.scoreLabel) this.scoreLabel.setText(`${Math.round(this.bridge.snapshot.score)}`)
    if (this.roundLabel) this.roundLabel.setText(`R${state.round + 1}/${config.rounds.length}`)
    if (this.incomeLabel) this.incomeLabel.setText(`+${incomePreview(state)}g`)
    if (this.interestLabel) this.interestLabel.setText(`int:${interestPreview(state)}g`)

    if (this.phaseLabel) {
      const label = state.phase === 'prep' ? 'PREP' : state.phase === 'combat' ? 'COMBAT' : 'OVER'
      this.phaseLabel.setText(label)
      this.phaseLabel.setColor(label === 'COMBAT' ? '#ef4444' : label === 'PREP' ? '#3b82f6' : '#888888')
    }

    const traits = playerTraitCounts(state)
    if (this.traitText && traits.length > 0) {
      const active = traits.filter((c) => c > 0)
      this.traitText.setText(active.length > 0 ? `Syn: ${active.join('/')}` : '')
    }

    if (state.phase === 'combat' && state.combatTick !== this.prevCombatTick) {
      this.onCombatTick(state)
    }

    if (state.phase !== this.prevPhase) {
      if (state.phase === 'combat') {
        Sfx.whoosh()
        addFlash(this, this.palette.danger, 120)
        floatText(this, this.scale.width / 2, 40, 'FIGHT!', '#ef4444', 1200)
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

    const benchY = this.boardY + FR * size + size / 2 + 8
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

  private createShop(config: AutobattlerConfig): void {
    const shopX = this.scale.width - 190
    const shopY = 100

    this.add.rectangle(shopX + 90, this.scale.height / 2, 180, this.scale.height - 20, this.palette.surface, 0.6)
      .setDepth(SHOP_DEPTH - 1)
      .setStrokeStyle(1, this.palette.primary, 0.2)

    const slotSize = 72
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

  private createHUD(config: AutobattlerConfig): void {
    const y = 20

    this.goldLabel = this.makeText(60, y, `${config.economy.start_gold}`, 18, this.palette.warning, HUD_DEPTH)
    this.levelLabel = this.makeText(160, y, 'Lv1 0/?', 14, this.palette.primary, HUD_DEPTH)
    this.healthLabel = this.makeText(260, y, `${'\u{2764}'} ${config.health.start}`, 16, this.palette.danger, HUD_DEPTH)
    this.scoreLabel = this.makeText(380, y, '0', 16, this.palette.text, HUD_DEPTH)
    this.roundLabel = this.makeText(480, y, `R1/${config.rounds.length}`, 14, this.palette.text, HUD_DEPTH)
    this.phaseLabel = this.makeText(this.scale.width / 2, y, 'PREP', 16, this.palette.primary, HUD_DEPTH)

    this.incomeLabel = this.makeText(60, 44, '+0g', 12, this.palette.success, HUD_DEPTH)
    this.interestLabel = this.makeText(160, 44, 'int:0g', 12, this.palette.warning, HUD_DEPTH)
    this.traitText = this.makeText(320, 44, '', 11, this.palette.text, HUD_DEPTH)
  }

  private createButtons(config: AutobattlerConfig): void {
    const shopX = this.scale.width - 190
    const btnX = shopX + 90

    const refreshContainer = this.add.container(btnX, this.scale.height - 140)
    refreshContainer.setDepth(SHOP_DEPTH)
    refreshContainer.setSize(80, 32)
    const refreshBg = this.add.image(0, 0, BTN_REFRESH_KEY)
    refreshBg.setInteractive({ cursor: 'pointer' })
    refreshContainer.add(refreshBg)
    const refreshLabel = this.makeText(0, 0, `\u{21BB} ${config.shop.refresh_cost}`, 13, this.palette.text, SHOP_DEPTH + 1)
    refreshContainer.add(refreshLabel)
    refreshBg.on('pointerdown', () => {
      if (this.paused || this.finished) return
      this.bridge.enqueue('refresh')
      Sfx.click()
    })
    this.refreshBtn = refreshContainer

    const levelContainer = this.add.container(btnX, this.scale.height - 100)
    levelContainer.setDepth(SHOP_DEPTH)
    levelContainer.setSize(80, 32)
    const levelBg = this.add.image(0, 0, BTN_LEVEL_KEY)
    levelBg.setInteractive({ cursor: 'pointer' })
    levelContainer.add(levelBg)
    const levelLabel = this.makeText(0, 0, `LV ${config.shop.level.xp_cost}g`, 13, this.palette.primary, SHOP_DEPTH + 1)
    levelContainer.add(levelLabel)
    levelBg.on('pointerdown', () => {
      if (this.paused || this.finished) return
      this.bridge.enqueue('level')
      Sfx.click()
    })
    this.levelBtn = levelContainer

    const readyContainer = this.add.container(btnX, this.scale.height - 50)
    readyContainer.setDepth(SHOP_DEPTH)
    readyContainer.setSize(120, 40)
    const readyBg = this.add.image(0, 0, BTN_READY_KEY)
    readyBg.setInteractive({ cursor: 'pointer' })
    readyContainer.add(readyBg)
    const readyLabel = this.makeText(0, 0, 'FIGHT!', 16, this.palette.inverseText, SHOP_DEPTH + 1)
    readyContainer.add(readyLabel)
    readyBg.on('pointerdown', () => {
      if (this.paused || this.finished) return
      if (this.bridge.state.phase !== 'prep') return
      this.bridge.enqueue('ready')
      Sfx.whoosh()
    })
    this.readyBtn = readyContainer
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
        const row = cellRowOf(config.board.cols, unit.cell)
        x = this.boardX + col * size + size / 2
        y = this.boardY + row * size + size / 2
      } else {
        const benchIdx = state.units.filter((u) => u.cell < 0).indexOf(unit)
        const benchY = this.boardY + fieldRows(config) * size + size / 2 + 8
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
      slot.costLabel.setText(`${unitType.cost}g`)
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

  private cellIndexAt(x: number, y: number): number {
    const config = this.bridge.state.config
    const size = this.cellPixelSize
    const FR = fieldRows(config)
    const col = Math.floor((x - this.boardX) / size)
    const row = Math.floor((y - this.boardY) / size)
    if (col < 0 || col >= config.board.cols || row < 0 || row >= FR) return -1
    return cellIndexOf(config.board.cols, col, row)
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
    const FR = fieldRows(config)
    const benchY = this.boardY + FR * size + size / 2 + 8
    const benchUnits = state.units.filter((u) => u.cell < 0)

    for (let i = 0; i < benchUnits.length; i += 1) {
      const ux = this.boardX + i * size + size / 2
      if (Math.abs(x - ux) < size / 2 && Math.abs(y - benchY) < size / 2) {
        return benchUnits[i] ?? null
      }
    }
    return null
  }

  private handleShopClick(slotIndex: number): void {
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
