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
import { defenderConfigSchema, defenderContentSchema, DEFENDER_PRIORITIES, type DefenderPriority } from './schema'

const GRID_OFFSET_X = 10
const GRID_OFFSET_Y = 40
const PALETTE_HEIGHT = 64
/** §1.11's 44px touch-target floor, in world units — defender never overrides
 *  `getWorldSize()` (both shipped fixtures author below the 800x600 canvas: see
 *  695891c's commit message), so the camera stays at zoom 1 and one world unit is one
 *  real CSS px at the canvas's fit scale, matching launcher's `TOUCH_TARGET` pattern
 *  rather than sorter's zoomed-camera `MIN_TOUCH_DESIGN_PX` workaround. */
const TOUCH_TARGET = 44
/** Namespaces a build-palette selection as a global-ability cast (secondary currency)
 *  rather than a tower/wall placement, so `handleCellClick` can tell them apart —
 *  mirrors `components.tsx`'s own `ABILITY_PREFIX` convention. */
const ABILITY_PREFIX = '__ability__:'

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
  /** Global-ability palette buttons (secondary currency, `config.economy.secondary`).
   *  Empty when a manifest declares no secondary economy — see `createBuildPalette`. */
  private abilityBtns: { id: string; rect: Phaser.GameObjects.Rectangle; icon: Phaser.GameObjects.Arc; label: Phaser.GameObjects.Text }[] = []
  /** Voluntary heat-modifier toggles (`config.heat`), built once and shown only while
   *  no tower is inspected AND no wave has started yet — see `updateHeatPanel`. */
  private heatBtns: { index: number; rect: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }[] = []
  private heatPanel!: Phaser.GameObjects.Container
  private startWaveBtn!: Phaser.GameObjects.Container
  /** The inspected-tower panel: re-populated on every `handleCellClick`/`updateTowerInfo`
   *  with the priority-cycle button, up to 3 upgrade-branch buttons and the sell button
   *  — never just the sell button alone (the audit's confirmed-missing surface). */
  private actionPanel!: Phaser.GameObjects.Container
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

  /** Resolves a `games.canvas.*` key from `this.strings` and fills in `{{var}}`
   *  placeholders — `PhaserGameBox.tsx` resolves each key to its raw, non-interpolated
   *  template exactly once at scene start (see `CANVAS_STRING_KEYS`'s doc comment in
   *  phaser/scene.ts), so a mechanic that needs a parameterized readout does its own
   *  substitution here (same pattern as launcher/scene.ts's `fmt`). Falls back to the
   *  bare key (never a hardcoded English literal) so a missing wire-up is visible
   *  instead of silently shipping English. */
  private fmt(key: string, vars: Record<string, string | number> = {}): string {
    let s = this.strings[key] ?? key
    for (const [name, value] of Object.entries(vars)) s = s.split(`{{${name}}}`).join(String(value))
    return s
  }

  /** The report's 8 fixed archetype ids resolved to their `games.canvas.archetype*`
   *  name — a CLOSED set (schema.ts's `DEFENDER_ARCHETYPES`), so every branch is
   *  covered and the fallback is unreachable in practice. */
  private archetypeLabel(archetype: string): string {
    const key =
      archetype === 'single' ? 'archetypeSingle'
      : archetype === 'area' ? 'archetypeArea'
      : archetype === 'slow' ? 'archetypeSlow'
      : archetype === 'dot' ? 'archetypeDot'
      : archetype === 'antiair' ? 'archetypeAntiair'
      : archetype === 'aura' ? 'archetypeAura'
      : archetype === 'economy' ? 'archetypeEconomy'
      : archetype === 'block' ? 'archetypeBlock'
      : undefined
    return key === undefined ? archetype : (this.strings[key] ?? key)
  }

  /** The 5 switchable target priorities (schema.ts's `DEFENDER_PRIORITIES`), resolved
   *  to their `games.canvas.priority*` name. */
  private priorityLabel(priority: DefenderPriority): string {
    const key =
      priority === 'first' ? 'priorityFirst'
      : priority === 'last' ? 'priorityLast'
      : priority === 'strongest' ? 'priorityStrongest'
      : priority === 'weakest' ? 'priorityWeakest'
      : 'priorityNearest'
    return this.strings[key] ?? key
  }

  private nextPriority(current: DefenderPriority): DefenderPriority {
    const index = DEFENDER_PRIORITIES.indexOf(current)
    return DEFENDER_PRIORITIES[(index + 1) % DEFENDER_PRIORITIES.length] ?? 'first'
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
    this.goldText = this.makeText(GRID_OFFSET_X + 4, y, this.fmt('goldLabel', { amount: st.gold }), 14, 0xffcc00, 20).setOrigin(0, 0)
    this.waveText = this.makeText(GRID_OFFSET_X + this.gridW / 2 + 4, y, this.fmt('waveLabel', { current: st.waveIndex + 1, total: st.config.waves.length }), 14, this.palette.text, 20).setOrigin(0, 0)
    this.phaseText = this.makeText(GRID_OFFSET_X + this.gridW / 2 + 4, y + 16, this.strings['prep'] ?? 'prep', 11, this.palette.primary, 20).setOrigin(0, 0)
    this.livesText = this.makeText(GRID_OFFSET_X + this.gridW - 4, y, st.lives !== null ? this.fmt('livesLabel', { count: st.lives }) : '', 14, this.palette.danger, 20).setOrigin(1, 0)
    if (st.config.economy.secondary) {
      this._gemsText = this.makeText(GRID_OFFSET_X + 120, y, this.fmt('gemsLabel', { amount: st.gems }), 14, 0xcc44cc, 20).setOrigin(0, 0)
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

    // Global abilities (secondary currency): one palette button per declared ability,
    // inserted between the wall and the start-wave button. Empty when the manifest
    // declares no `economy.secondary` — the report's "secondary currency for global
    // abilities" row, previously entirely unreachable (audit finding).
    const secondary = st.config.economy.secondary
    const abilities = secondary?.abilities ?? []
    this.abilityBtns = []
    abilities.forEach((ability, index) => {
      const ax = GRID_OFFSET_X + (st.config.towers.length + 1 + index) * (btnW + 4) + btnW / 2
      const ay = py + ph / 2
      const color = 0xcc44cc
      const abBg = this.makeRect(ax, ay, btnW, btnH, color, 0.15, 4)
        .setStrokeStyle(1, color, 0.4)
        .setInteractive({ useHandCursor: true })
      const abIcon = this.makeCircle(ax, ay - 8, 8, color, 1, 5)
      const abLabel = this.makeText(ax, ay + 14, `${ability.cost}`, 9, this.palette.text, 6)
      const clickSlot = `${ABILITY_PREFIX}${ability.id}`
      abBg.on('pointerdown', () => {
        if (this.paused || this.finished) return
        const current = this.bridge.state
        const cooldown = current.abilityCooldown[index] ?? 0
        if (current.gems < ability.cost || cooldown > 0) { Sfx.wrong(); addShake(this, 'light'); return }
        this.selectedPaletteSlot = clickSlot
        for (const b of this.paletteBtns) b.rect.setStrokeStyle(1, 0x666666, 0.3)
        for (const b of this.abilityBtns) b.rect.setStrokeStyle(1, color, 0.4)
        abBg.setStrokeStyle(3, this.palette.accent, 1)
        Sfx.click()
      })
      this.abilityBtns.push({ id: ability.id, rect: abBg, icon: abIcon, label: abLabel })
    })

    const swX = GRID_OFFSET_X + (st.config.towers.length + 1 + abilities.length) * (btnW + 4) + btnW / 2
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
    this.actionPanel = this.add.container(0, 0, [])
    this.actionPanel.setAlpha(0)

    this.createHeatPanel(st)
  }

  /** Voluntary "heat" modifiers (`config.heat`) — built ONCE (never rebuilt per frame)
   *  and toggled visible only while no tower is inspected and no wave has started yet,
   *  reusing the same vertical slot the tower-inspect `actionPanel` occupies (the two
   *  are mutually exclusive, so there is no layout conflict). */
  createHeatPanel(st: DefenderState) {
    const heats = st.config.heat ?? []
    const y = GRID_OFFSET_Y + this.gridH + PALETTE_HEIGHT + 4 + 26
    this.heatBtns = []
    const children: Phaser.GameObjects.GameObject[] = []
    let cursor = GRID_OFFSET_X
    const gap = 6
    const w = 96
    heats.forEach((heat, index) => {
      const cx = cursor + w / 2
      cursor += w + gap
      const bg = this.makeRect(cx, y, w, TOUCH_TARGET, this.palette.warning, 0.15, 20)
        .setStrokeStyle(1, this.palette.warning, 0.4)
        .setInteractive({ useHandCursor: true })
      const label = this.makeText(cx, y, this.fmt('heatOption', { multiplier: (heat.score_multiplier_pct / 100).toFixed(1) }), 11, this.palette.warning, 21)
      bg.on('pointerdown', () => {
        if (this.paused || this.finished) return
        if (this.bridge.state.wavesStarted > 0) return
        this.bridge.enqueue('heat', { slot: heat.id })
        Sfx.click()
      })
      this.heatBtns.push({ index, rect: bg, label })
      children.push(bg, label)
    })
    this.heatPanel = this.add.container(0, 0, children)
  }

  setupInput() {
    this.keys = (this.input.keyboard!).addKeys({
      p: Phaser.Input.Keyboard.KeyCodes.P,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      // Keyboard access for the newly-wired actions, extending (not replacing) the
      // existing p/w/s/space/esc scheme: 't' cycles target priority and 'u' upgrades
      // the selected tower (both operate on `selectedCell`, exactly like 's' already
      // does for sell); '1'/'2'/'3' cast a global ability by slot; 'h' cycles the
      // voluntary heat modifier before the first wave.
      t: Phaser.Input.Keyboard.KeyCodes.T,
      u: Phaser.Input.Keyboard.KeyCodes.U,
      h: Phaser.Input.Keyboard.KeyCodes.H,
      one: Phaser.Input.Keyboard.KeyCodes.ONE,
      two: Phaser.Input.Keyboard.KeyCodes.TWO,
      three: Phaser.Input.Keyboard.KeyCodes.THREE,
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

    if (this.selectedPaletteSlot.startsWith(ABILITY_PREFIX)) {
      const col = cellCol(st.cols, cell)
      const row = cellRow(st.cols, cell)
      this.bridge.enqueue('ability', { slot: this.selectedPaletteSlot.slice(ABILITY_PREFIX.length), x: col, y: row })
      const cr = this.cellRects[row]?.[col]
      if (cr) {
        this.tweens.add({ targets: cr, scaleX: 1.15, scaleY: 1.15, duration: 90, yoyo: true, ease: 'Back.easeOut',
          onComplete: () => { cr.setScale(1, 1) } })
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
      this.actionPanel.removeAll(true)
      this.actionPanel.setAlpha(0)
    }
  }

  /**
   * Rebuilds the tower-inspect action panel: target-priority cycle, one button per
   * upgrade branch still open to this tower (mutually exclusive once committed — the
   * simulator's own rule, mirrored here rather than re-derived), and sell. Previously
   * this panel held ONLY sell (the audit's confirmed-missing surface for `upgrade` and
   * `priority`); every button here enqueues an action `simulate.ts` already declares.
   */
  updateTowerInfo(st: DefenderState, cell: number) {
    const uid = st.towerAt[cell] ?? 0
    if (uid === 0) return
    const tower = st.towers.find(t => t.uid === uid)
    if (!tower) return
    const type = towerTypeAt(st.config, tower.typeIndex)
    const infoY = GRID_OFFSET_Y + this.gridH + PALETTE_HEIGHT + 4
    this.towerInfoText.setText(this.fmt('towerInfo', {
      archetype: this.archetypeLabel(tower.archetype),
      damage: tower.damage,
      range: tower.range,
      tier: tower.branchTier,
    }))

    const col = cellCol(st.cols, cell)
    const row = cellRow(st.cols, cell)
    const y = infoY + 26
    this.actionPanel.removeAll(true)

    let cursor = GRID_OFFSET_X
    const gap = 6
    const place = (w: number): number => {
      const cx = cursor + w / 2
      cursor += w + gap
      return cx
    }

    // Target priority — cycles through the 5 CLOSED priorities on every tap, exactly
    // like the DOM renderer's `nextPriority` (components.tsx).
    const priW = 92
    const priCx = place(priW)
    const priBg = this.makeRect(priCx, y, priW, TOUCH_TARGET, this.palette.primary, 0.25, 20)
      .setStrokeStyle(1, this.palette.primary, 0.6)
      .setInteractive({ useHandCursor: true })
    const priLabel = this.makeText(priCx, y, this.priorityLabel(tower.priority), 10, this.palette.primary, 21)
    priBg.on('pointerdown', () => {
      if (this.paused || this.finished) return
      this.bridge.enqueue('priority', { slot: this.nextPriority(tower.priority), x: col, y: row })
      Sfx.click()
    })
    this.actionPanel.add([priBg, priLabel])

    // Upgrade branches: only the ones still open to this tower (branchId===null shows
    // every branch; once committed, only the chosen one survives the filter) — and
    // only while that branch still has an unbought tier.
    const branches = (type?.upgrades ?? []).filter((branch) => tower.branchId === null || tower.branchId === branch.id)
    branches.forEach((branch, index) => {
      const tier = branch.tiers[tower.branchTier]
      if (tier === undefined) return
      const affordable = st.gold >= tier.cost
      const upW = 104
      const upCx = place(upW)
      const upBg = this.makeRect(upCx, y, upW, TOUCH_TARGET, this.palette.accent, affordable ? 0.25 : 0.1, 20)
        .setStrokeStyle(1, this.palette.accent, affordable ? 0.6 : 0.2)
        .setInteractive({ useHandCursor: true })
      const upLabel = this.makeText(upCx, y, this.fmt('upgradeBranch', { n: index + 1, tier: tower.branchTier + 1, cost: tier.cost }), 9, this.palette.accent, 21)
      upBg.on('pointerdown', () => {
        if (this.paused || this.finished) return
        if (st.gold < tier.cost) { Sfx.wrong(); addShake(this, 'light'); return }
        this.bridge.enqueue('upgrade', { slot: branch.id, x: col, y: row })
        Sfx.click()
      })
      this.actionPanel.add([upBg, upLabel])
    })

    // Sell, with the exact refund the tap will apply shown underneath it.
    const sellW = 92
    const sellCx = place(sellW)
    const refund = Math.floor((tower.invested * st.config.build.sell_refund_pct) / 100)
    const sellBg = this.makeRect(sellCx, y, sellW, TOUCH_TARGET, this.palette.danger, 0.25, 20)
      .setStrokeStyle(1, this.palette.danger, 0.6)
      .setInteractive({ useHandCursor: true })
    const sellLabel = this.makeText(sellCx, y - 7, this.strings['sell'] ?? 'sell', 10, this.palette.danger, 21)
    const sellSub = this.makeText(sellCx, y + 8, this.fmt('incomePreview', { amount: refund }), 9, this.palette.danger, 21)
    sellBg.on('pointerdown', () => {
      if (this.paused || this.finished) return
      this.bridge.enqueue('sell', { x: col, y: row })
      this.selectedCell = -1
      this.rangeCircle.setAlpha(0)
      this.towerInfoText.setText('')
      this.actionPanel.removeAll(true)
      this.actionPanel.setAlpha(0)
      Sfx.click()
    })
    this.actionPanel.add([sellBg, sellLabel, sellSub])
    this.actionPanel.setAlpha(1)
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
    this.updateAbilityButtons(st)
    this.updateWaveButton(st)
    this.updateHeatPanel(st)
    this.updateSelectedTowerPanel(st)
    this.checkRoundTransition(prev, st)
  }

  /** Live-refreshes the inspect panel (priority/upgrade/sell) whenever anything it
   *  depends on actually changes — the tower's own tier/priority, or the gold that
   *  gates affordability — rather than only on the click that opened it, so buying an
   *  upgrade immediately shows the NEXT tier's cost instead of a stale one. Also
   *  clears the selection if the inspected tower stops existing (sold from elsewhere,
   *  e.g. the keyboard 's' path). */
  private _actionPanelKey = ''

  updateSelectedTowerPanel(st: DefenderState): void {
    if (this.selectedCell < 0) return
    const uid = st.towerAt[this.selectedCell] ?? 0
    const tower = st.towers.find((t) => t.uid === uid)
    if (!tower) {
      this.selectedCell = -1
      this.rangeCircle.setAlpha(0)
      this.towerInfoText.setText('')
      this.actionPanel.removeAll(true)
      this.actionPanel.setAlpha(0)
      return
    }
    this.showRangeIndicator(st, this.selectedCell)
    const key = `${this.selectedCell}:${tower.uid}:${tower.branchTier}:${tower.priority}:${st.gold}`
    if (key !== this._actionPanelKey) {
      this._actionPanelKey = key
      this.updateTowerInfo(st, this.selectedCell)
    }
  }

  handleKeys(st: DefenderState) {
    if (Phaser.Input.Keyboard.JustDown(this.keys.p!)) this.togglePause()
    if (Phaser.Input.Keyboard.JustDown(this.keys.space!) || Phaser.Input.Keyboard.JustDown(this.keys.w!)) {
      this.bridge.enqueue('start_wave')
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.s!) && this.selectedCell >= 0) {
      const col = cellCol(st.cols, this.selectedCell)
      const row = cellRow(st.cols, this.selectedCell)
      this.bridge.enqueue('sell', { x: col, y: row })
      this.selectedCell = -1
      this.rangeCircle.setAlpha(0)
      this.actionPanel.removeAll(true)
      this.actionPanel.setAlpha(0)
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.t!) && this.selectedCell >= 0) {
      const uid = st.towerAt[this.selectedCell] ?? 0
      const tower = st.towers.find((candidate) => candidate.uid === uid)
      if (tower) {
        const col = cellCol(st.cols, this.selectedCell)
        const row = cellRow(st.cols, this.selectedCell)
        this.bridge.enqueue('priority', { slot: this.nextPriority(tower.priority), x: col, y: row })
      }
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.u!) && this.selectedCell >= 0) {
      const uid = st.towerAt[this.selectedCell] ?? 0
      const tower = st.towers.find((candidate) => candidate.uid === uid)
      const type = tower ? towerTypeAt(st.config, tower.typeIndex) : undefined
      const branch = (type?.upgrades ?? []).find((candidate) => tower!.branchId === null || tower!.branchId === candidate.id)
      if (tower && branch) {
        const col = cellCol(st.cols, this.selectedCell)
        const row = cellRow(st.cols, this.selectedCell)
        this.bridge.enqueue('upgrade', { slot: branch.id, x: col, y: row })
      }
    }
    const secondary = st.config.economy.secondary
    if (secondary) {
      const abilityKeys = [this.keys.one, this.keys.two, this.keys.three]
      for (let i = 0; i < secondary.abilities.length; i += 1) {
        const key = abilityKeys[i]
        if (key === undefined || !Phaser.Input.Keyboard.JustDown(key)) continue
        const ability = secondary.abilities[i]
        if (ability === undefined) continue
        // No keyboard cursor exists over the grid — cast at the selected tower's cell
        // when one is inspected, else defend the base (the first exit cell), mirroring
        // the pointer path's own dependency on a prior tap-to-select.
        const target = this.selectedCell >= 0 ? this.selectedCell : (st.exitCells[0] ?? -1)
        if (target >= 0) {
          const col = cellCol(st.cols, target)
          const row = cellRow(st.cols, target)
          this.bridge.enqueue('ability', { slot: ability.id, x: col, y: row })
        }
      }
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.h!) && st.wavesStarted === 0) {
      const heats = st.config.heat ?? []
      if (heats.length > 0) {
        const nextIndex = st.heatIndex >= 0 && st.heatIndex === heats.length - 1 ? st.heatIndex : st.heatIndex + 1
        const next = heats[nextIndex]
        if (next) this.bridge.enqueue('heat', { slot: next.id })
      }
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.esc!)) {
      this.selectedCell = -1
      this.selectedPaletteSlot = ''
      this.rangeCircle.setAlpha(0)
      this.actionPanel.removeAll(true)
      this.actionPanel.setAlpha(0)
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
    this.goldText.setText(this.fmt('goldLabel', { amount: st.gold }))
    this.waveText.setText(this.fmt('waveLabel', { current: st.waveIndex + 1, total: st.config.waves.length }))
    this.phaseText.setText(st.phase === 'prep' ? (this.strings['prep'] ?? 'prep') : (this.strings['fight'] ?? 'fight'))
    if (st.lives !== null) this.livesText.setText(this.fmt('livesLabel', { count: st.lives }))
    else this.livesText.setText('')
    if (this._gemsText && st.config.economy.secondary) {
      this._gemsText.setText(this.fmt('gemsLabel', { amount: st.gems }))
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

  /** Gems + cooldown gate ability affordability — unlike towers, abilities are NOT
   *  phase-gated: their whole purpose is acting on enemies already on the board. */
  updateAbilityButtons(st: DefenderState): void {
    const secondary = st.config.economy.secondary
    const abilities = secondary?.abilities ?? []
    for (let i = 0; i < this.abilityBtns.length; i += 1) {
      const btn = this.abilityBtns[i]!
      const ability = abilities[i]
      if (!ability) continue
      const onCooldown = (st.abilityCooldown[i] ?? 0) > 0
      const canAfford = st.gems >= ability.cost && !onCooldown
      btn.rect.setAlpha(canAfford ? 1 : 0.3)
      btn.icon.setAlpha(canAfford ? 1 : 0.3)
    }
  }

  /** Shown only while no tower is inspected and no wave has started — the exact
   *  window `applyHeat` itself accepts (`draft.wavesStarted > 0` refuses it), so the
   *  panel is never offered dishonestly. */
  updateHeatPanel(st: DefenderState): void {
    const show = this.selectedCell < 0 && st.wavesStarted === 0 && this.heatBtns.length > 0
    this.heatPanel.setVisible(show)
    if (!show) return
    for (const btn of this.heatBtns) {
      const active = st.heatIndex === btn.index
      btn.rect.setStrokeStyle(active ? 2 : 1, this.palette.warning, active ? 1 : 0.4)
      btn.rect.setFillStyle(this.palette.warning, active ? 0.4 : 0.15)
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
      floatText(this, GRID_OFFSET_X + this.gridW / 2, GRID_OFFSET_Y + this.gridH / 2 - 20, this.strings['waveComplete'] ?? 'waveComplete', '#ffcc00', 1200)
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
        this.makeText(GRID_OFFSET_X + this.gridW / 2, GRID_OFFSET_Y + this.gridH / 2, this.strings['defeated'] ?? 'defeated', 28, this.palette.danger, 100)
      } else if (st.finished) {
        spawnConfetti(this, GRID_OFFSET_X + this.gridW / 2, GRID_OFFSET_Y + this.gridH / 2, 50)
        Sfx.levelUp()
        const snap = this.bridge.snapshot
        this.makeText(GRID_OFFSET_X + this.gridW / 2, GRID_OFFSET_Y + this.gridH / 2, this.fmt('victory', { score: snap.score }), 22, this.palette.accent, 100)
      }
    }
  }
  private _finishedDef = false
}
