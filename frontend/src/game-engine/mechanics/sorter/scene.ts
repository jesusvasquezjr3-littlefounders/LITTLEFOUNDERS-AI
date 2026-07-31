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

import { sorterConfigSchema, sorterContentSchema } from './schema'
import { sorterSimulator, type SorterEntity, type SorterState } from './simulate'

const BG_KEY = 'sorter-bg'
const ITEM_PREFIX = 'sorter-item-'
const BIN_PREFIX = 'sorter-bin-'
const TRASH_KEY = 'sorter-trash'

const ITEM_DEPTH = 10
const BIN_DEPTH = 5
const HUD_DEPTH = 20
const COMBO_DEPTH = 25
const GLOW_ALPHA = 0.4
const HOVER_SCALE_PEAK = 1.06
const BIN_HIGHLIGHT_SCALE = 1.04

const TIER_COLORS: Record<number, number> = {
  1: 0x3b82f6,
  2: 0x22c55e,
  3: 0xf59e0b,
  4: 0xef4444,
}

interface ItemView {
  entity: SorterEntity
  container: Phaser.GameObjects.Container
  rect: Phaser.GameObjects.Image
  label: Phaser.GameObjects.Text
  tierColor: number
  uid: number
}

interface BinView {
  categoryId: string
  container: Phaser.GameObjects.Container
  rect: Phaser.GameObjects.Image
  label: Phaser.GameObjects.Text
  glow: Phaser.GameObjects.Rectangle
}

export class SorterScene extends BaseMechanicScene<SorterState> {
  private itemViews: Map<number, ItemView> = new Map()
  private binViews: Map<string, BinView> = new Map()
  private trashView: BinView | null = null
  private comboText: Phaser.GameObjects.Text | null = null
  private scoreText: Phaser.GameObjects.Text | null = null
  private livesText: Phaser.GameObjects.Text | null = null
  private dragItem: ItemView | null = null
  private selectedItem: ItemView | null = null
  private dragOffsetX = 0
  private dragOffsetY = 0
  private binGlowTarget: BinView | null = null
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

  createGameObjects(): void {
    const { config } = this.bridge.state
    generateBackground(this, BG_KEY, config.field.width, config.field.height, this.palette)
    this.add.image(config.field.width / 2, config.field.height / 2, BG_KEY).setDepth(0)

    generatePlaceholderSprite(
      this,
      TRASH_KEY,
      config.field.item_size + 20,
      config.field.item_size + 20,
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
    const { config } = this.bridge.state

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.paused || this.finished) return

      const item = this.findItemAt(pointer.x, pointer.y)
      if (item !== null && item !== this.selectedItem) {
        if (config.mode === 'static') {
          if (this.selectedItem) {
            this.setItemHighlight(this.selectedItem, false)
          }
          this.selectedItem = item
          this.setItemHighlight(item, true)
          Sfx.click()
          return
        }
        this.dragItem = item
        this.dragOffsetX = pointer.x - item.container.x
        this.dragOffsetY = pointer.y - item.container.y
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
        const binId = this.findBinIdAt(pointer.x, pointer.y)
        if (binId !== null) {
          this.commitPlace(this.selectedItem.uid, binId)
        }
        this.setItemHighlight(this.selectedItem, false)
        this.selectedItem = null
      }
    })

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const prevGlow = this.binGlowTarget

      if (this.dragItem !== null) {
        this.dragItem.container.x = pointer.x - this.dragOffsetX
        this.dragItem.container.y = pointer.y - this.dragOffsetY

        const binId = this.findBinIdAt(pointer.x, pointer.y)
        if (binId !== null) {
          const bin = this.binViews.get(binId) ?? this.trashView
          this.setBinGlow(bin ?? null)
        } else {
          this.setBinGlow(null)
        }
      } else if (this.selectedItem !== null) {
        const binId = this.findBinIdAt(pointer.x, pointer.y)
        if (binId !== null) {
          const bin = this.binViews.get(binId) ?? this.trashView
          this.setBinGlow(bin ?? null)
        } else {
          this.setBinGlow(null)
        }
      } else {
        const item = this.findItemAt(pointer.x, pointer.y)
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
    })

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.dragItem === null) return

      const uid = this.dragItem.uid
      const binId = this.findBinIdAt(pointer.x, pointer.y)

      const item = this.dragItem
      this.dragItem = null
      this.setBinGlow(null)

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
    })
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
      this.comboText.setText(state.combo > 1 ? `x${state.combo}` : '')
      this.comboText.setAlpha(state.combo > 1 ? 1 : 0)
    }
    if (this.scoreText) {
      this.scoreText.setText(`${Math.round(this.bridge.snapshot.score)}`)
    }
    if (this.livesText) {
      this.livesText.setText(state.lives !== null ? `${'\u2665'} ${state.lives}` : '')
    }
  }

  private createBins(config: SorterState['config']): void {
    const state = this.bridge.state
    const { categories } = state
    const field = config.field
    const catCount = categories.length
    const hasTrash = config.trash_zone
    const total = hasTrash ? catCount + 1 : catCount
    const binW = Math.min(160, (field.width - 40) / total - 12)
    const binH = 80
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

      const catLabel = this.makeText(0, 0, catId, 13, this.palette.text, BIN_DEPTH + 1)
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

      const label = this.makeText(0, 0, 'Trash', 13, this.palette.danger, BIN_DEPTH + 1)
      container.add(label)

      this.trashView = { categoryId: '__trash__', container, rect, label, glow: glowRect }

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
        if (view === this.dragItem || view === this.selectedItem) {
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

    for (const entity of state.active) {
      let view = this.itemViews.get(entity.uid)
      const tierColor = TIER_COLORS[entity.tier] ?? this.palette.primary

      if (view === undefined) {
        const key = `${ITEM_PREFIX}${entity.uid}`
        const size = state.config.field.item_size

        generatePlaceholderSprite(this, key, size, size, tierColor, 'rect', this.palette.text)

        const container = this.add.container(entity.x, entity.y)
        container.setDepth(ITEM_DEPTH)
        container.setSize(size, size)

        const rect = this.add.image(0, 0, key)
        container.add(rect)

        const label = this.makeText(0, 0, entity.itemId, 11, this.palette.text, ITEM_DEPTH + 1)
        container.add(label)

        container.setInteractive(
          new Phaser.Geom.Rectangle(-size / 2, -size / 2, size, size),
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
    for (const view of this.itemViews.values()) {
      const cx = view.container.x
      const cy = view.container.y
      const half = view.entity !== undefined
        ? this.bridge.state.config.field.item_size / 2 + 4
        : 30
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
    if (this.trashView?.container.getBounds().contains(x, y)) return '__trash__'
    return null
  }

  private commitPlace(uid: number, binId: string): void {
    if (binId === '__trash__') {
      this.bridge.enqueue('discard', { n: uid })
    } else {
      this.bridge.enqueue('place', { slot: binId, n: uid })
    }
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
      floatText(this, config.field.width / 2, config.field.height / 2, 'Level Up!', '#22c55e', 1200)
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
      floatText(this, this.scale.width / 2, 60, `${combo}x`, '#ffd700', 600)
    }
  }
}

export default SorterScene
