import Phaser from 'phaser'
import { BaseMechanicScene } from '@/game-engine/phaser/scene'
import { GameEngineBridge } from '@/game-engine/phaser/bridge'
import {
  addShake, addFlash, spawnConfetti, spawnCollectSparkles, floatText,
} from '@/game-engine/phaser/juice'
import { generatePlaceholderSprite } from '@/game-engine/phaser/assets'
import { Sfx } from '@/game-engine/phaser/sfx'
import {
  defenderSimulator, type DefenderState, cellIndex, cellCol, cellRow, cellCentre,
  enemyPosition, towerTypeAt, TERRAIN_ROCK, TERRAIN_ROAD, TERRAIN_ENTRY, TERRAIN_EXIT,
} from './simulate'
import { defenderConfigSchema, defenderContentSchema } from './schema'

const GRID_OFFSET_X = 10
const GRID_OFFSET_Y = 40
const PALETTE_HEIGHT = 64

export class DefenderScene extends BaseMechanicScene<DefenderState> {
  private cellSize = 32
  private gridW = 800
  private gridH = 0

  private gridGfx!: Phaser.GameObjects.Graphics
  private cellRects: Phaser.GameObjects.Rectangle[][] = []
  private towerSprites = new Map<number, Phaser.GameObjects.Container>()
  private wallRects = new Map<number, Phaser.GameObjects.Rectangle>()
  private enemySprites = new Map<number, { sprite: Phaser.GameObjects.Container; hpBar: Phaser.GameObjects.Rectangle; hpBg: Phaser.GameObjects.Rectangle }>()
  private rangeCircle!: Phaser.GameObjects.Graphics
  private statusBar!: Phaser.GameObjects.Container
  private goldText!: Phaser.GameObjects.Text
  private waveText!: Phaser.GameObjects.Text
  private livesText!: Phaser.GameObjects.Text
  private phaseText!: Phaser.GameObjects.Text
  private paletteBg!: Phaser.GameObjects.Rectangle
  private paletteBtnGfx!: Phaser.GameObjects.Graphics
  private paletteBtns: { cell: number; rect: Phaser.GameObjects.Rectangle; icon: Phaser.GameObjects.Arc; label: Phaser.GameObjects.Text }[] = []
  private startWaveBtn!: Phaser.GameObjects.Container
  private sellBtn!: Phaser.GameObjects.Container
  private towerInfoText!: Phaser.GameObjects.Text
  private selectedCell = -1
  private selectedPaletteSlot = ''
  private keys!: Record<string, Phaser.Input.Keyboard.Key>

  constructor() { super('defender') }

  createBridge() {
    const c = defenderConfigSchema.safeParse(this.doc.config)
    const t = defenderContentSchema.safeParse(this.doc.content)
    if (!c.success || !t.success) throw new Error('INVALID_DOCUMENT')
    const simInit = { config: c.data, content: t.data, scoring: this.doc.scoring, seed: this.seed }
    return {
      bridge: new GameEngineBridge(defenderSimulator, simInit, this.maxTicks),
      simInit,
    }
  }

  create() {
    this.generateTextures()
    super.create()
  }

  generateTextures() {
    generatePlaceholderSprite(this, 'dtower-single', 24, 24, 0x3388ff, 'circle')
    generatePlaceholderSprite(this, 'dtower-area', 24, 24, 0xff8800, 'circle')
    generatePlaceholderSprite(this, 'dtower-slow', 24, 24, 0x44cccc, 'diamond')
    generatePlaceholderSprite(this, 'dtower-dot', 24, 24, 0x44dd44, 'circle')
    generatePlaceholderSprite(this, 'dtower-antiair', 24, 24, 0xaa44ff, 'diamond')
    generatePlaceholderSprite(this, 'dtower-aura', 24, 24, 0xffdd00, 'circle')
    generatePlaceholderSprite(this, 'dtower-economy', 24, 24, 0xffcc00, 'rect')
    generatePlaceholderSprite(this, 'dtower-block', 24, 24, 0x888888, 'rect')
  }

  createGameObjects() {
    const st = this.bridge.state
    this.cellSize = st.config.grid.cell_size
    this.gridW = st.cols * this.cellSize
    this.gridH = st.rows * this.cellSize

    this.gridGfx = this.add.graphics().setDepth(1)

    this.rangeCircle = this.add.graphics().setDepth(5)
    this.rangeCircle.setAlpha(0)

    this.drawGrid(st)
    this.createStatusBar()
    this.createBuildPalette(st)
    this.syncTowersFromState(st)
    this.syncWallsFromState(st)
    this.syncEnemiesFromState(st, null, 0)
  }

  drawGrid(st: DefenderState) {
    this.gridGfx.clear()
    for (let r = 0; r < st.rows; r++) {
      const row: Phaser.GameObjects.Rectangle[] = []
      for (let c = 0; c < st.cols; c++) {
        const ci = cellIndex(st.cols, c, r)
        const terrain = st.terrain[ci] ?? TERRAIN_ROCK
        const x = GRID_OFFSET_X + c * this.cellSize + this.cellSize / 2
        const y = GRID_OFFSET_Y + r * this.cellSize + this.cellSize / 2
        const s = this.cellSize

        let color = this.palette.surface
        if (terrain === TERRAIN_ROCK) color = 0x444444
        else if (terrain === TERRAIN_ROAD) color = 0x3a3028
        else if (terrain === TERRAIN_ENTRY) color = 0x224422
        else if (terrain === TERRAIN_EXIT) color = 0x441111

        const rect = this.makeRect(x, y, s - 1, s - 1, color, 1, 2)
        rect.setStrokeStyle(1, 0x666666, 0.15)
        rect.setInteractive({ useHandCursor: true })
        rect.on('pointerover', () => {
          if (this.paused || this.finished) return
          rect.setStrokeStyle(2, this.palette.accent, 0.6)
        })
        rect.on('pointerout', () => {
          rect.setStrokeStyle(1, 0x666666, 0.15)
        })
        rect.on('pointerdown', () => {
          if (this.paused || this.finished) return
          this.handleCellClick(ci)
        })

        if (!row[c]) row[c] = rect
      }
      this.cellRects.push(row)
    }
  }

  createStatusBar() {
    const st = this.bridge.state
    const y = 6
    this.goldText = this.makeText(GRID_OFFSET_X + 4, y, `Gold: ${st.gold}`, 14, 0xffcc00, 20).setOrigin(0, 0)
    this.waveText = this.makeText(GRID_OFFSET_X + this.gridW / 2 + 4, y, `Wave ${st.waveIndex + 1}/${st.config.waves.length}`, 14, this.palette.text, 20).setOrigin(0, 0)
    this.phaseText = this.makeText(GRID_OFFSET_X + this.gridW / 2 + 4, y + 16, st.phase, 11, this.palette.primary, 20).setOrigin(0, 0)
    this.livesText = this.makeText(GRID_OFFSET_X + this.gridW - 4, y, st.lives !== null ? `❤ ${st.lives}` : '', 14, this.palette.danger, 20).setOrigin(1, 0)
    if (st.config.economy.secondary) {
      this._gemsText = this.makeText(GRID_OFFSET_X + 120, y, `Gems: ${st.gems}`, 14, 0xcc44cc, 20).setOrigin(0, 0)
    }
  }
  private _gemsText?: Phaser.GameObjects.Text

  createBuildPalette(st: DefenderState) {
    const py = GRID_OFFSET_Y + this.gridH + 8
    const ph = PALETTE_HEIGHT - 8
    this.paletteBg = this.makeRect(0, py, GRID_OFFSET_X + this.gridW, PALETTE_HEIGHT, this.palette.surface, 0.6, 3)
    this.paletteBg.setOrigin(0, 0)

    this.paletteBtns = []
    const btnW = 56; const btnH = ph
    for (let i = 0; i < st.config.towers.length; i++) {
      const t = st.config.towers[i]!
      const bx = GRID_OFFSET_X + i * (btnW + 4) + btnW / 2
      const by = py + ph / 2

      let color = 0x3388ff
      if (t.archetype === 'area') color = 0xff8800
      else if (t.archetype === 'slow') color = 0x44cccc
      else if (t.archetype === 'dot') color = 0x44dd44
      else if (t.archetype === 'antiair') color = 0xaa44ff
      else if (t.archetype === 'aura') color = 0xffdd00
      else if (t.archetype === 'economy') color = 0xffcc00
      else if (t.archetype === 'block') color = 0x888888

      const btnRect = this.makeRect(bx, by, btnW, btnH, color, 0.15, 4)
        .setStrokeStyle(1, color, 0.4)
        .setInteractive({ useHandCursor: true })
      const icon = this.makeCircle(bx, by - 8, 8, color, 1, 5)
      const label = this.makeText(bx, by + 14, `${t.cost}`, 9, this.palette.text, 6)
      const clickSlot = t.id
      btnRect.on('pointerdown', () => {
        if (this.paused || this.finished) return
        if (st.gold < t.cost) { Sfx.wrong(); addShake(this, 'light'); return }
        this.selectedPaletteSlot = clickSlot
        for (const b of this.paletteBtns) b.rect.setStrokeStyle(1, 0x666666, 0.3)
        btnRect.setStrokeStyle(3, this.palette.accent, 1)
        Sfx.click()
      })

      this.paletteBtns.push({ cell: -1, rect: btnRect, icon, label })
    }

    const wallX = GRID_OFFSET_X + st.config.towers.length * (btnW + 4) + btnW / 2
    const wallY = py + ph / 2
    const wallRect = this.makeRect(wallX, wallY, btnW, btnH, 0x888888, 0.15, 4)
      .setStrokeStyle(1, 0x888888, 0.4)
      .setInteractive({ useHandCursor: true })
    this.makeCircle(wallX, wallY - 8, 8, 0x777777, 1, 5)
    this.makeText(wallX, wallY + 14, `${st.config.build.wall_cost}`, 9, this.palette.text, 6)
    wallRect.on('pointerdown', () => {
      if (this.paused || this.finished) return
      this.selectedPaletteSlot = '__wall__'
      for (const b of this.paletteBtns) b.rect.setStrokeStyle(1, 0x666666, 0.3)
      wallRect.setStrokeStyle(3, this.palette.accent, 1)
      Sfx.click()
    })

    const swX = GRID_OFFSET_X + (st.config.towers.length + 1) * (btnW + 4) + btnW / 2
    const swBtn = this.makeRect(swX, wallY, btnW + 10, btnH, this.palette.success, 0.25, 4)
      .setStrokeStyle(2, this.palette.success, 0.8)
      .setInteractive({ useHandCursor: true })
    this.makeText(swX, wallY, '▶', 18, this.palette.success, 6)
    swBtn.on('pointerdown', () => {
      if (this.paused || this.finished) return
      this.bridge.enqueue('start_wave')
      Sfx.click()
    })
    this.startWaveBtn = this.add.container(0, 0, [swBtn])

    this.towerInfoText = this.makeText(10, GRID_OFFSET_Y + this.gridH + PALETTE_HEIGHT + 4, '', 10, this.palette.text, 20).setOrigin(0, 0)
    this.sellBtn = this.add.container(-100, -100, [])
    this.sellBtn.setAlpha(0)
  }

  setupInput() {
    this.keys = (this.input.keyboard!).addKeys({
      p: Phaser.Input.Keyboard.KeyCodes.P,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      esc: Phaser.Input.Keyboard.KeyCodes.ESC,
    }) as Record<string, Phaser.Input.Keyboard.Key>
  }

  handleCellClick(cell: number) {
    const st = this.bridge.state
    Sfx.click()

    if (this.selectedPaletteSlot === '__wall__') {
      const c = cellCol(st.cols, cell)
      const r = cellRow(st.cols, cell)
      this.bridge.enqueue('build_wall', { x: c, y: r })
      const wr = this.cellRects[r]?.[c]
      if (wr) {
        this.tweens.add({ targets: wr, scaleX: 1.15, scaleY: 1.15, duration: 90, yoyo: true, ease: 'Back.easeOut',
          onComplete: () => { wr.setScale(1, 1) } })
      }
      return
    }

    if (this.selectedPaletteSlot) {
      const col = cellCol(st.cols, cell)
      const row = cellRow(st.cols, cell)
      this.bridge.enqueue('build_tower', { x: col, y: row, slot: this.selectedPaletteSlot })
      const cr = this.cellRects[row]?.[col]
      if (cr) {
        this.tweens.add({ targets: cr, scaleX: 1.15, scaleY: 1.15, duration: 90, yoyo: true, ease: 'Back.easeOut',
          onComplete: () => { cr.setScale(1, 1) } })
      }
      return
    }

    const uid = st.towerAt[cell] ?? 0
    if (uid > 0) {
      this.selectedCell = cell
      this.updateTowerInfo(st, cell)
      this.showRangeIndicator(st, cell)
    } else {
      this.selectedCell = -1
      this.rangeCircle.setAlpha(0)
      this.towerInfoText.setText('')
      this.sellBtn.setAlpha(0)
    }
  }

  updateTowerInfo(st: DefenderState, cell: number) {
    const uid = st.towerAt[cell] ?? 0
    if (uid === 0) return
    const tower = st.towers.find(t => t.uid === uid)
    if (!tower) return
    const type = towerTypeAt(st.config, tower.typeIndex)
    const infoY = GRID_OFFSET_Y + this.gridH + PALETTE_HEIGHT + 4
    this.towerInfoText.setText(`${type?.archetype ?? ''} | Dmg:${tower.damage} | Rng:${tower.range} | Tier:${tower.branchTier}`)

    const sellX = GRID_OFFSET_X + this.gridW - 40
    const sellY = infoY + 10
    this.sellBtn.removeAll(true)
    const sellBg = this.makeRect(sellX, sellY, 32, 20, this.palette.danger, 0.3, 20)
      .setStrokeStyle(1, this.palette.danger, 0.6)
      .setInteractive({ useHandCursor: true })
    const sellLabel = this.makeText(sellX, sellY, 'Sell', 9, this.palette.danger, 21)
    sellBg.on('pointerdown', () => {
      if (this.paused || this.finished) return
      const col = cellCol(st.cols, cell)
      const row = cellRow(st.cols, cell)
      this.bridge.enqueue('sell', { x: col, y: row })
      this.selectedCell = -1
      this.rangeCircle.setAlpha(0)
      this.towerInfoText.setText('')
      this.sellBtn.setAlpha(0)
      Sfx.click()
    })
    this.sellBtn.add([sellBg, sellLabel])
    this.sellBtn.setPosition(0, 0)
    this.sellBtn.setAlpha(1)
  }

  showRangeIndicator(st: DefenderState, cell: number) {
    const uid = st.towerAt[cell] ?? 0
    if (uid === 0) return
    const tower = st.towers.find(t => t.uid === uid)
    if (!tower) return
    const centre = cellCentre(st.cols, cell)
    const rx = GRID_OFFSET_X + centre.x / 1000 * this.cellSize
    const ry = GRID_OFFSET_Y + centre.y / 1000 * this.cellSize
    const rangePx = (tower.range / 1000) * this.cellSize

    this.rangeCircle.clear()
    this.rangeCircle.lineStyle(1, this.palette.accent, 0.4)
    this.rangeCircle.fillStyle(this.palette.accent, 0.08)
    this.rangeCircle.fillCircle(rx, ry, rangePx)
    this.rangeCircle.strokeCircle(rx, ry, rangePx)
    this.rangeCircle.setAlpha(1)
  }

  updateGameObjects(_delta: number) {
    if (this.paused) return
    const st = this.bridge.state
    const prev = this.bridge.prevState
    const a = this.bridge.alpha

    this.handleKeys(st)
    this.syncTowersFromState(st)
    this.syncWallsFromState(st)
    this.syncEnemiesFromState(st, prev, a)
    this.updateStatusBar(st)
    this.updatePaletteButtons(st)
    this.updateWaveButton(st)
    if (this.selectedCell >= 0) this.showRangeIndicator(st, this.selectedCell)
    this.checkRoundTransition(prev, st)
  }

  handleKeys(st: DefenderState) {
    if (Phaser.Input.Keyboard.JustDown(this.keys.p!)) this.togglePause()
    if (Phaser.Input.Keyboard.JustDown(this.keys.space!) || Phaser.Input.Keyboard.JustDown(this.keys.w!)) {
      this.bridge.enqueue('start_wave')
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.s!)) {
      const col = cellCol(st.cols, this.selectedCell)
      const row = cellRow(st.cols, this.selectedCell)
      this.bridge.enqueue('sell', { x: col, y: row })
      this.selectedCell = -1
      this.rangeCircle.setAlpha(0)
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.esc!)) {
      this.selectedCell = -1
      this.selectedPaletteSlot = ''
      this.rangeCircle.setAlpha(0)
      this.sellBtn.setAlpha(0)
    }
  }

  syncTowersFromState(st: DefenderState) {
    const curKeys = new Set(st.towers.map(t => t.uid))
    for (const [uid, ct] of this.towerSprites) {
      if (!curKeys.has(uid)) { ct.destroy(); this.towerSprites.delete(uid) }
    }
    for (const t of st.towers) {
      if (this.towerSprites.has(t.uid)) continue
      const centre = cellCentre(st.cols, t.cell)
      const x = GRID_OFFSET_X + (centre.x / 1000) * this.cellSize
      const y = GRID_OFFSET_Y + (centre.y / 1000) * this.cellSize
      const s = this.cellSize * 0.6

      let color = 0x3388ff; let shape: 'circle' | 'diamond' | 'rect' = 'circle'
      if (t.archetype === 'area') color = 0xff8800
      else if (t.archetype === 'slow') { color = 0x44cccc; shape = 'diamond' }
      else if (t.archetype === 'dot') color = 0x44dd44
      else if (t.archetype === 'antiair') { color = 0xaa44ff; shape = 'diamond' }
      else if (t.archetype === 'aura') color = 0xffdd00
      else if (t.archetype === 'economy') { color = 0xffcc00; shape = 'rect' }
      else if (t.archetype === 'block') { color = 0x888888; shape = 'rect' }

      let gfx: Phaser.GameObjects.Shape
      if (shape === 'diamond') {
        const pts = [
          new Phaser.Geom.Point(x, y - s / 2),
          new Phaser.Geom.Point(x + s / 2, y),
          new Phaser.Geom.Point(x, y + s / 2),
          new Phaser.Geom.Point(x - s / 2, y),
        ]
        const poly = this.add.polygon(x, y, pts, color, 0.9)
        poly.setStrokeStyle(1, this.palette.text, 0.3)
        gfx = poly
      } else if (shape === 'rect') {
        gfx = this.makeRect(x, y, s, s, color, 0.85, 6).setStrokeStyle(1, this.palette.text, 0.3)
      } else {
        gfx = this.makeCircle(x, y, s / 2, color, 0.85, 6).setStrokeStyle(1, this.palette.text, 0.3)
      }

      const ct = this.add.container(0, 0, [gfx]).setDepth(5)

      if (t.branchTier > 0) {
        const tierMark = this.makeText(x + s / 2 - 2, y - s / 2 + 2, `${t.branchTier}`, 7, 0xffffff, 7)
        ct.add(tierMark)
      }

      ct.setInteractive(new Phaser.Geom.Circle(x, y, s / 2), Phaser.Geom.Circle.Contains)
      ct.on('pointerdown', () => {
        if (this.paused || this.finished) return
        this.handleCellClick(t.cell)
      })

      this.towerSprites.set(t.uid, ct)
    }
  }

  syncWallsFromState(st: DefenderState) {
    const curCells = new Set<number>()
    for (let i = 0; i < st.wallAt.length; i++) {
      if ((st.wallAt[i] ?? 0) > 0) curCells.add(i)
    }
    for (const [cell, rect] of this.wallRects) {
      if (!curCells.has(cell)) { rect.destroy(); this.wallRects.delete(cell) }
    }
    for (const cell of curCells) {
      if (this.wallRects.has(cell)) continue
      const c = cellCol(st.cols, cell)
      const r = cellRow(st.cols, cell)
      const x = GRID_OFFSET_X + c * this.cellSize + this.cellSize / 2
      const y = GRID_OFFSET_Y + r * this.cellSize + this.cellSize / 2
      const rect = this.makeRect(x, y, this.cellSize - 2, this.cellSize - 2, 0x554444, 0.7, 4)
        .setStrokeStyle(1, 0x775555, 0.4)
      rect.setInteractive({ useHandCursor: true })
      rect.on('pointerdown', () => { this.handleCellClick(cell) })
      this.wallRects.set(cell, rect)
    }
  }

  syncEnemiesFromState(st: DefenderState, prev: DefenderState | null, alpha: number) {
    const curUids = new Set(st.enemies.map(e => e.uid))
    for (const [uid, obj] of this.enemySprites) {
      if (!curUids.has(uid)) {
        obj.sprite.destroy(); obj.hpBar.destroy(); obj.hpBg.destroy()
        this.enemySprites.delete(uid)
      }
    }

    for (const e of st.enemies) {
      let obj = this.enemySprites.get(e.uid)
      if (!obj) {
        const pos = enemyPosition(st, e)
        const x = GRID_OFFSET_X + (pos.x / 1000) * this.cellSize
        const y = GRID_OFFSET_Y + (pos.y / 1000) * this.cellSize
        const rad = Math.max(4, this.cellSize * 0.22)

        const sprite = this.makeCircle(x, y, rad, e.flying ? 0xcc88ff : (e.isBoss ? 0xcc2222 : 0xdd4444), 0.9, 8)
          .setStrokeStyle(1, this.palette.text, 0.2)

        if (e.slowPct > 0) sprite.setFillStyle(0x4488ff, 0.9)
        if (e.frozenLeft > 0) sprite.setFillStyle(0x44ccff, 0.95)

        const barW = rad * 2 + 4
        const hpBg = this.makeRect(x, y - rad - 6, barW, 3, 0x333333, 0.8, 9)
        const hpBar = this.makeRect(x - barW / 2, y - rad - 6, barW, 3, e.flying ? 0xcc88ff : this.palette.danger, 1, 10).setOrigin(0, 0.5)

        const ct = this.add.container(0, 0, [sprite])
        obj = { sprite: ct, hpBar, hpBg }
        this.enemySprites.set(e.uid, obj)
      }

      if (e.hp <= 0) {
        obj.sprite.setAlpha(0)
        obj.hpBar.setAlpha(0)
        obj.hpBg.setAlpha(0)
        continue
      }

      const curPos = enemyPosition(st, e)
      let x = GRID_OFFSET_X + (curPos.x / 1000) * this.cellSize
      let y = GRID_OFFSET_Y + (curPos.y / 1000) * this.cellSize

      const prevE = prev?.enemies.find(pe => pe.uid === e.uid)
      if (prevE && prev && alpha > 0) {
        const prevPos = enemyPosition(prev, prevE)
        x = Phaser.Math.Linear(GRID_OFFSET_X + (prevPos.x / 1000) * this.cellSize, x, alpha)
        y = Phaser.Math.Linear(GRID_OFFSET_Y + (prevPos.y / 1000) * this.cellSize, y, alpha)
      }

      const rad = Math.max(4, this.cellSize * 0.22)
      const sprite = obj.sprite.list[0] as Phaser.GameObjects.Arc
      if (sprite) {
        sprite.setPosition(x, y)
        sprite.setRadius(rad)
      }

      const hpPct = Math.max(0, e.hp / e.maxHp)
      const barW = rad * 2 + 4
      obj.hpBar.setSize(barW * hpPct, 3).setPosition(x - barW / 2, y - rad - 6).setAlpha(1)
      obj.hpBg.setPosition(x, y - rad - 6).setSize(barW, 3).setAlpha(1)

      if (e.slowPct > 0) {
        sprite.setFillStyle(0x4488ff, 0.9)
      } else if (e.frozenLeft > 0) {
        sprite.setFillStyle(0x44ccff, 0.95)
      } else {
        sprite.setFillStyle(e.flying ? 0xcc88ff : (e.isBoss ? 0xcc2222 : 0xdd4444), 0.9)
      }
    }
  }

  updateStatusBar(st: DefenderState) {
    this.goldText.setText(`Gold: ${st.gold}`)
    this.waveText.setText(`Wave ${st.waveIndex + 1}/${st.config.waves.length}`)
    this.phaseText.setText(st.phase === 'prep' ? 'Prep' : `Wave ${st.waveIndex + 1}`)
    if (st.lives !== null) this.livesText.setText(`❤ ${st.lives}`)
    else this.livesText.setText('')
    if (this._gemsText && st.config.economy.secondary) {
      this._gemsText.setText(`Gems: ${st.gems}`)
    }
  }

  updatePaletteButtons(st: DefenderState) {
    for (let i = 0; i < this.paletteBtns.length; i++) {
      const btn = this.paletteBtns[i]!
      const t = st.config.towers[i]!
      const canAfford = st.gold >= t.cost && st.phase === 'prep'
      btn.rect.setAlpha(canAfford ? 1 : 0.3)
      btn.icon.setAlpha(canAfford ? 1 : 0.3)
    }
  }

  updateWaveButton(st: DefenderState) {
    const canStart = st.phase === 'prep' && st.waveIndex < st.config.waves.length
    this.startWaveBtn.setAlpha(canStart ? 1 : 0.3)
  }

  private _lastWaveCleared = 0
  private _lastKilled = 0
  private _lastLeaked = 0

  checkRoundTransition(_prev: DefenderState | null, st: DefenderState) {
    if (st.wavesCleared > this._lastWaveCleared) {
      this._lastWaveCleared = st.wavesCleared
      spawnConfetti(this, GRID_OFFSET_X + this.gridW / 2, GRID_OFFSET_Y + this.gridH / 2, 30)
      Sfx.levelUp()
      floatText(this, GRID_OFFSET_X + this.gridW / 2, GRID_OFFSET_Y + this.gridH / 2 - 20, 'Wave Complete!', '#ffcc00', 1200)
    }
    if (st.killed > this._lastKilled) {
      const diff = st.killed - this._lastKilled
      this._lastKilled = st.killed
      for (let i = 0; i < Math.min(diff, 3); i++) {
        spawnCollectSparkles(this, GRID_OFFSET_X + this.gridW / 2 + Phaser.Math.Between(-40, 40), GRID_OFFSET_Y + this.gridH / 2 + Phaser.Math.Between(-40, 40))
      }
      Sfx.collect()
    }
    if (st.leaked > this._lastLeaked) {
      this._lastLeaked = st.leaked
      addShake(this, 'wrong')
      addFlash(this, this.palette.danger, 80)
      Sfx.wrong()
    }
    if (st.defeated || (st.finished && !this._finishedDef)) {
      this._finishedDef = true
      if (st.defeated) {
        addShake(this, 'heavy')
        Sfx.heavyHit()
        this.makeText(GRID_OFFSET_X + this.gridW / 2, GRID_OFFSET_Y + this.gridH / 2, 'Defeated!', 28, this.palette.danger, 100)
      } else if (st.finished) {
        spawnConfetti(this, GRID_OFFSET_X + this.gridW / 2, GRID_OFFSET_Y + this.gridH / 2, 50)
        Sfx.levelUp()
        const snap = this.bridge.snapshot
        this.makeText(GRID_OFFSET_X + this.gridW / 2, GRID_OFFSET_Y + this.gridH / 2, `Victory! Score: ${snap.score}`, 22, this.palette.accent, 100)
      }
    }
  }
  private _finishedDef = false
}
