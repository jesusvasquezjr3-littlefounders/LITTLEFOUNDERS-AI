import Phaser from 'phaser'

import {
  generateButtonTexture,
  generatePlaceholderSprite,
} from '@/game-engine/phaser/assets'
import { GameEngineBridge } from '@/game-engine/phaser/bridge'
import {
  addFlash,
  addShake,
  floatText,
  spawnCollectSparkles,
  spawnConfetti,
  spawnWrongParticles,
} from '@/game-engine/phaser/juice'
import { BaseMechanicScene, type CanvasStringKey } from '@/game-engine/phaser/scene'
import { Sfx } from '@/game-engine/phaser/sfx'

import {
  explorerConfigSchema,
  explorerContentSchema,
  EXPLORER_LOCK_KINDS,
  EXPLORER_NODE_KINDS,
  type ExplorerConfig,
  type ExplorerEdge,
  type ExplorerNode,
} from './schema'
import {
  canRestAt,
  canTraverse,
  explorerSimulator,
  holdingsOfState,
  indexOfNode,
  lockSatisfied,
  nodeIsClaimable,
  nodeIsRevealed,
  type ExplorerState,
} from './simulate'

const NODE_PREFIX = 'explorer-node-'
const LOCK_SIGNPOST_PREFIX = 'explorer-signpost-'
const BTN_REST_KEY = 'explorer-btn-rest'
const BAR_BG_KEY = 'explorer-bar-bg'
const BAR_FILL_KEY = 'explorer-bar-fill'
const CACHE_ICON_KEY = 'explorer-cache-icon'

const EDGE_DEPTH = 1
const NODE_DEPTH = 10
const AVATAR_DEPTH = 15
const HUD_DEPTH = 20
const CHALLENGE_DEPTH = 25

const KIND_COLORS: Record<string, number> = {
  start: 0x22c55e,
  tutorial: 0x3b82f6,
  plain: 0x666666,
  boss: 0xef4444,
  shrine: 0xa855f7,
  shop: 0xffd700,
  fragment: 0x06b6d4,
  goal: 0xf59e0b,
}

const KIND_SHAPES: Record<string, 'circle' | 'rect' | 'diamond'> = {
  start: 'circle',
  tutorial: 'circle',
  plain: 'circle',
  boss: 'circle',
  shrine: 'diamond',
  shop: 'circle',
  fragment: 'circle',
  goal: 'circle',
}

const KIND_RADII: Record<string, number> = {
  start: 16,
  tutorial: 14,
  plain: 12,
  boss: 22,
  shrine: 16,
  shop: 14,
  fragment: 12,
  goal: 22,
}

const SIGNPOST_COLORS: Record<string, number> = {
  primary: 0x3b82f6,
  secondary: 0x666666,
  accent: 0xff6b35,
  success: 0x22c55e,
  warning: 0xf59e0b,
  delight: 0xffd700,
}

/**
 * Minimum tap-target RADIUS in canvas design px, independent of a node's visual
 * `KIND_RADII` size. §1.11's ~44 CSS px touch-target floor cannot be enforced in
 * exact CSS px from here — the 800x600 canvas is scaled by Phaser's FIT mode to
 * whatever CSS size the player's game box renders at, a runtime/device fact this
 * scene has no way to read. What CAN be guaranteed from here is a floor in the
 * canvas's own fixed coordinate space: this keeps the smallest node kind (`plain`/
 * `fragment` at KIND_RADII 12, a 24px-diameter dot) from being a precision-only
 * target once its interactive circle is unioned with this floor. NOTE: the schema
 * (`explorerMapSchema.node_radius`, 12-120) is documented there as "the tap
 * target's floor" but is NOT currently wired into rendering anywhere in this file
 * — KIND_RADII below is the actual visual radius per node kind, unconditionally —
 * so this floor is applied independently of both the visual radius AND the unused
 * config field, per the audit's guidance to decouple the hit-test from the art
 * rather than resize it. Wiring `node_radius` into the actual drawn size (so
 * content authors can tune it per-manifest) is a separate, larger change than this
 * touch-target fix and is called out in the accompanying report as unresolved.
 *
 * Exported so the regression is pinned by a test (explorer.test.ts) even though
 * the geometry it feeds (`createNodeView`'s Phaser `container.setInteractive`
 * call) cannot itself be exercised without a live canvas.
 */
export const MIN_TAP_RADIUS = 48

/** Node-label truncation floor — see `truncateAtWord`. Widened from the pre-fix
 *  14-char cutoff (English-tuned; confirmed cutting es-MX/pt-BR labels mid-word,
 *  since both languages routinely run 20-40% longer than their en-US source) — a
 *  node label floats freely above its marker with no fixed-width box to overflow,
 *  so 22 gives a typical two-word label real room while `truncateAtWord` still
 *  protects the rare longer one. */
const NODE_LABEL_MAX = 22

/** Challenge-option truncation floor — see `truncateAtWord`. Unlike the node
 *  label, the option row IS a fixed-width box (300px at 12px bold), so this
 *  cannot grow as freely as `NODE_LABEL_MAX` did: 48 gives es-MX/pt-BR
 *  meaningfully more room than the pre-fix 40-char English-tuned cutoff for the
 *  common case; `truncateAtWord`'s word-boundary rule is what keeps the rare
 *  overflow from reading as a broken word instead of visual overflow. */
const OPTION_LABEL_MAX = 48

/**
 * Truncates `text` to at most `maxLen` characters without ever cutting a word in
 * half, appending an ellipsis whenever it does cut. Finds the last space at or
 * before `maxLen` and breaks there; only falls back to a hard character cut
 * (still ellipsis-suffixed) when `text` has no space within the first `maxLen`
 * characters at all — a single "word" longer than the whole budget, which has no
 * valid word boundary to break on regardless of locale.
 *
 * Exported as a plain function (not a scene method) so it is testable without
 * instantiating Phaser — see explorer.test.ts's label-truncation suite.
 */
export function truncateAtWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  const slice = text.slice(0, maxLen)
  const lastSpace = slice.lastIndexOf(' ')
  const cut = lastSpace > 0 ? slice.slice(0, lastSpace) : slice
  return `${cut.trimEnd()}…`
}

/**
 * Every node index the keyboard can cycle FOCUS onto from `state.at`: the current
 * node itself (so Enter there can `take`/answer a challenge exactly like tapping
 * it), plus every node connected by an edge FROM the current node (or, for a
 * two-way edge, TO it) that is currently revealed — the same set a sighted player
 * could reach by tapping, since `nodeAt()`'s hit-test only ever matches a visible
 * (revealed) node. Order follows `state.edges` document order, which is what
 * makes Tab/arrow cycling deterministic and testable rather than dependent on
 * node layout/pixel position.
 *
 * A LOCKED edge's target is still included — exactly like tapping a locked node
 * does today (it surfaces the lock's hint via `handleLockedEdge`), so keyboard-
 * only play can discover a lock the same way pointer play does, never silently
 * skipping it.
 *
 * Exported as a plain function (not a scene method) so it is testable without
 * instantiating Phaser — see explorer.test.ts's keyboard-navigation suite.
 */
export function reachableNodeIndices(state: ExplorerState): number[] {
  const result: number[] = [state.at]
  const here = state.nodes[state.at]
  if (!here) return result
  for (const edge of state.edges) {
    if (!edge) continue
    let neighborId: string | null = null
    if (edge.from === here.id) neighborId = edge.to
    else if (!edge.one_way && edge.to === here.id) neighborId = edge.from
    if (neighborId === null) continue
    const idx = indexOfNode(state.nodes, neighborId)
    if (idx < 0 || idx === state.at) continue
    if (!nodeIsRevealed(state, idx)) continue
    if (!result.includes(idx)) result.push(idx)
  }
  return result
}

/**
 * The next (`direction` 1) or previous (`direction` -1) node index to keyboard-
 * focus, wrapping around `reachableNodeIndices(state)`. A `currentFocus` absent
 * from that list (stale after a move, or -1 before any focus was set) starts the
 * cycle from `state.at` — the same "start from where the player stands" default
 * the scene falls back to on arrival.
 */
export function cycleFocusIndex(state: ExplorerState, currentFocus: number, direction: 1 | -1): number {
  const list = reachableNodeIndices(state)
  if (list.length === 0) return state.at
  const pos = list.indexOf(currentFocus)
  const from = pos >= 0 ? pos : 0
  const next = (from + direction + list.length) % list.length
  return list[next] ?? state.at
}

interface NodeView {
  nodeIndex: number
  container: Phaser.GameObjects.Container
  shape: Phaser.GameObjects.Arc | Phaser.GameObjects.Rectangle
  label: Phaser.GameObjects.Text
  icon: Phaser.GameObjects.Text
  ring: Phaser.GameObjects.Arc
  /** Independent of `shape`'s visual radius — see `MIN_TAP_RADIUS`. What `nodeAt()`
   *  actually hit-tests against. */
  tapRadius: number
}

interface EdgeView {
  edgeIndex: number
  line: Phaser.GameObjects.Graphics
  signpost: Phaser.GameObjects.Container | null
}

export class ExplorerScene extends BaseMechanicScene<ExplorerState> {
  private nodeViews: NodeView[] = []
  private edgeViews: EdgeView[] = []
  private avatarSprite: Phaser.GameObjects.Container | null = null
  private avatarTrail: Phaser.GameObjects.Particles.ParticleEmitter | null = null
  private energyBar: Phaser.GameObjects.Image | null = null
  private energyBarBg: Phaser.GameObjects.Image | null = null
  private energyLabel: Phaser.GameObjects.Text | null = null
  private currencyLabel: Phaser.GameObjects.Text | null = null
  private masteryLabel: Phaser.GameObjects.Text | null = null
  private scoreLabel: Phaser.GameObjects.Text | null = null
  private livesLabel: Phaser.GameObjects.Text | null = null
  private abilityList: Phaser.GameObjects.Text | null = null
  private challengeGroup: Phaser.GameObjects.Container | null = null
  private restBtn: Phaser.GameObjects.Container | null = null
  private infoLabel: Phaser.GameObjects.Text | null = null
  /** Keyboard-cycled node focus (Tab/arrows), independent of `state.at` (the
   *  player's actual position) — see `reachableNodeIndices`/`cycleFocusIndex`.
   *  -1 before `createGameObjects()` runs. */
  private focusIndex = -1
  private prevAt = -1
  private prevEnergy = 0
  private prevCurrency = 0
  private prevDeaths = 0
  private prevWrong = 0
  private prevUses = 0
  private prevDeathsReward = 0
  private travelling = false

  constructor() {
    super('explorer')
  }

  createBridge(): { bridge: GameEngineBridge<ExplorerState>; simInit: import('@/game-engine/core/types').SimInit } {
    const configParse = explorerConfigSchema.safeParse(this.doc.config)
    const contentParse = explorerContentSchema.safeParse(this.doc.content)
    if (!configParse.success || !contentParse.success) throw new Error('Invalid explorer document')
    const simInit = {
      config: configParse.data,
      content: contentParse.data,
      scoring: this.doc.scoring,
      seed: this.seed,
    }
    return { bridge: new GameEngineBridge(explorerSimulator, simInit, this.maxTicks), simInit }
  }

  protected override getWorldSize(): { width: number; height: number } {
    // `config.map` is authored per-manifest (320-2000 x 240-1400) and can legitimately
    // differ from the fixed 800x600 canvas.
    const { map } = this.bridge.state.config
    return { width: map.width, height: map.height }
  }

  createGameObjects(): void {
    const state = this.bridge.state
    const config = state.config

    generatePlaceholderSprite(this, BAR_BG_KEY, 140, 12, 0x333333, 'rect')
    generatePlaceholderSprite(this, BAR_FILL_KEY, 140, 12, this.palette.success, 'rect')
    generatePlaceholderSprite(this, CACHE_ICON_KEY, 14, 14, this.palette.warning, 'circle')
    generateButtonTexture(this, BTN_REST_KEY, 90, 32, this.palette.surface, this.palette.primary, 8)

    this.createNodeTextures(state)
    this.createEdgeSignpostTextures(state, config)
    this.createMapView(state)
    this.createAvatar()
    this.createHUD(state)
    this.createButtons()

    this.prevAt = state.at
    this.prevEnergy = state.energy
    this.prevCurrency = state.currency
    this.focusIndex = state.at
  }

  setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.paused || this.finished) return
      const state = this.bridge.state
      if (state.travelLeft > 0) return

      // `worldX`/`worldY` (not `x`/`y`): explorer's `getWorldSize()` zooms the camera
      // for any manifest whose `map` differs from 800x600, and every node's position
      // is a WORLD coordinate — Phaser's own InputManager already writes the correct
      // `camera.getWorldPoint()` result into `pointer.worldX/worldY` before this
      // listener runs. Raw `x`/`y` are pre-zoom canvas coordinates and silently miss
      // every node once the camera isn't at zoom 1.
      const clickedNode = this.nodeAt(pointer.worldX, pointer.worldY)
      if (clickedNode !== null) {
        this.handleNodeClick(clickedNode)
        return
      }
    })

    // Keyboard graph navigation (§4/§5's move/use/take/rest actions have no keyboard
    // path otherwise): Tab/Shift+Tab and the arrow keys cycle `focusIndex` across
    // `reachableNodeIndices()`, Enter runs the exact same `handleNodeClick()` a tap
    // on the focused node would, and R rests — mirroring the rest button's own
    // handler via `attemptRest()` so the two paths can never drift apart. All of it
    // is a no-op while a challenge dialog is open (`this.challengeGroup`): that
    // modal is mouse-only today (its options are individually `pointerdown`-wired),
    // a pre-existing gap this pass does not extend to, so keyboard nav intentionally
    // stands down here rather than double-firing behind it.
    const keyboard = this.input.keyboard
    if (!keyboard) return

    keyboard.on('keydown-TAB', (event: KeyboardEvent) => {
      event.preventDefault()
      this.moveFocus(event.shiftKey ? -1 : 1)
    })
    keyboard.on('keydown-RIGHT', () => this.moveFocus(1))
    keyboard.on('keydown-DOWN', () => this.moveFocus(1))
    keyboard.on('keydown-LEFT', () => this.moveFocus(-1))
    keyboard.on('keydown-UP', () => this.moveFocus(-1))
    keyboard.on('keydown-ENTER', () => this.activateFocusedNode())
    keyboard.on('keydown-R', () => this.attemptRest())
  }

  private str(key: CanvasStringKey): string {
    return this.strings[key] ?? key
  }

  /** Interpolates a `games.canvas.*` template (e.g. `"Locked: {{hint}}"`) against
   *  `vars`. `PhaserGameBox` resolves every `CANVAS_STRING_KEYS` entry via a bare
   *  `t(key)` with no interpolation options (see its doc comment), so `{{name}}`
   *  placeholders survive into `this.strings` verbatim for the scene to fill in
   *  itself — this is that fill-in step. */
  private strFmt(key: CanvasStringKey, vars: Record<string, string>): string {
    const template = this.str(key)
    return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => vars[name] ?? '')
  }

  private moveFocus(direction: 1 | -1): void {
    if (this.paused || this.finished || this.challengeGroup) return
    const state = this.bridge.state
    if (state.travelLeft > 0) return
    this.focusIndex = cycleFocusIndex(state, this.focusIndex, direction)
  }

  private activateFocusedNode(): void {
    if (this.paused || this.finished || this.challengeGroup) return
    const state = this.bridge.state
    if (state.travelLeft > 0) return
    if (this.focusIndex < 0) return
    this.handleNodeClick(this.focusIndex)
  }

  private attemptRest(): void {
    if (this.paused || this.finished || this.challengeGroup) return
    if (!canRestAt(this.bridge.state, this.bridge.state.at)) return
    this.bridge.enqueue('rest')
    Sfx.collect()
  }

  updateGameObjects(_delta: number): void {
    const state = this.bridge.state

    this.updateMapView(state)
    this.updateAvatar(state)
    this.updateHUDValues(state)

    if (state.at !== this.prevAt) {
      this.onArrive(state)
      // Keyboard focus follows the player on arrival, same as a sighted player's
      // eye would — cycling then resumes from wherever they actually landed.
      this.focusIndex = state.at
    }

    if (state.energy !== this.prevEnergy && state.energy > this.prevEnergy && state.actions > 0) {
      this.onEnergyGain()
    }

    if (state.currency !== this.prevCurrency && state.currency > this.prevCurrency) {
      Sfx.collect()
      const amount = String(state.currency - this.prevCurrency)
      floatText(this, this.scale.width / 2, this.scale.height / 2, this.strFmt('incomePreview', { amount }), '#ffd700', 600)
    }

    if (state.deaths > this.prevDeaths) {
      Sfx.gameOver()
      addShake(this, 'heavy')
      addFlash(this, this.palette.danger, 250)
    }

    if (state.wrong > this.prevWrong) {
      Sfx.wrong()
      addShake(this, 'wrong')
      addFlash(this, this.palette.danger, 80)
      spawnWrongParticles(this, this.scale.width / 2, this.scale.height / 2)
    }

    if (state.uses > this.prevUses) {
      this.onEdgeUnlock(state)
    }

    this.prevAt = state.at
    this.prevEnergy = state.energy
    this.prevCurrency = state.currency
    this.prevDeaths = state.deaths
    this.prevWrong = state.wrong
    this.prevUses = state.uses
  }

  private createNodeTextures(_state: ExplorerState): void {
    for (const kind of EXPLORER_NODE_KINDS) {
      const color = KIND_COLORS[kind] ?? this.palette.primary
      const key = `${NODE_PREFIX}${kind}`
      if (this.textures.exists(key)) continue
      const r = KIND_RADII[kind] ?? 14
      generatePlaceholderSprite(this, key, r * 2, r * 2, color, KIND_SHAPES[kind] ?? 'circle', this.palette.text)
    }
  }

  private createEdgeSignpostTextures(_state: ExplorerState, config: ExplorerConfig): void {
    const signposts = config.signposts
    for (const kind of EXPLORER_LOCK_KINDS) {
      const sp = signposts[kind as keyof typeof signposts]
      if (!sp) continue
      const tone = SIGNPOST_COLORS[sp.tone] ?? this.palette.primary
      const key = `${LOCK_SIGNPOST_PREFIX}${kind}`
      if (this.textures.exists(key)) continue
      const shape = sp.shape === 'circle' ? 'circle' : sp.shape === 'triangle' ? 'diamond' : 'rect'
      generatePlaceholderSprite(this, key, 18, 18, tone, shape, this.palette.text)
    }
  }

  private createMapView(state: ExplorerState): void {
    for (let i = 0; i < state.edges.length; i += 1) {
      const edge = state.edges[i]
      if (!edge) continue
      this.createEdgeView(i, edge, state)
    }

    for (let i = 0; i < state.nodes.length; i += 1) {
      const node = state.nodes[i]
      if (!node) continue
      this.createNodeView(i, node, state)
    }
  }

  private createEdgeView(edgeIndex: number, edge: ExplorerEdge, state: ExplorerState): void {
    const fromNode = state.nodes[indexOfNode(state.nodes, edge.from)]
    const toNode = state.nodes[indexOfNode(state.nodes, edge.to)]
    if (!fromNode || !toNode) return

    const gfx = this.add.graphics()
    gfx.setDepth(EDGE_DEPTH)
    this.drawEdgeLine(gfx, fromNode, toNode, edge, state)

    let signpost: Phaser.GameObjects.Container | null = null
    if (edge.lock) {
      signpost = this.createSignpost(edge, fromNode, toNode)
    }

    this.edgeViews.push({ edgeIndex, line: gfx, signpost })
  }

  private drawEdgeLine(
    gfx: Phaser.GameObjects.Graphics,
    from: ExplorerNode,
    to: ExplorerNode,
    edge: ExplorerEdge,
    state: ExplorerState,
  ): void {
    const isOpen = state.open[this.edgeViews.length] === true
    const color = isOpen ? this.palette.primary : this.palette.text
    const alpha = isOpen ? 0.6 : 0.3
    const lineWidth = isOpen ? 2 : 1

    gfx.lineStyle(lineWidth, color, alpha)
    gfx.beginPath()
    gfx.moveTo(from.x * (this.scale.width / state.config.map.width), from.y * (this.scale.height / state.config.map.height))
    gfx.lineTo(to.x * (this.scale.width / state.config.map.width), to.y * (this.scale.height / state.config.map.height))
    gfx.strokePath()

    if (!isOpen && edge.lock) {
      gfx.fillStyle(this.palette.warning, 0.3)
      const mx = (from.x + to.x) / 2 * (this.scale.width / state.config.map.width)
      const my = (from.y + to.y) / 2 * (this.scale.height / state.config.map.height)
      gfx.fillCircle(mx, my, 6)
    }
  }

  private createSignpost(edge: ExplorerEdge, from: ExplorerNode, to: ExplorerNode): Phaser.GameObjects.Container {
    const mx = (from.x + to.x) / 2 * (this.scale.width / this.bridge.state.config.map.width)
    const my = (from.y + to.y) / 2 * (this.scale.height / this.bridge.state.config.map.height)
    const lock = edge.lock!

    const container = this.add.container(mx, my - 10)
    container.setDepth(EDGE_DEPTH + 0.5)
    container.setSize(20, 20)

    const sp = this.bridge.state.config.signposts[lock.kind as keyof typeof this.bridge.state.config.signposts]
    const bgColor = sp ? SIGNPOST_COLORS[sp.tone] ?? this.palette.warning : this.palette.warning

    const sign = this.add.rectangle(0, 0, 16, 16, bgColor, 0.7)
    sign.setStrokeStyle(1, this.palette.text, 0.3)
    container.add(sign)

    return container
  }

  private createNodeView(nodeIndex: number, node: ExplorerNode, state: ExplorerState): void {
    const config = state.config
    const radius = KIND_RADII[node.kind] ?? 14
    const kindColor = KIND_COLORS[node.kind] ?? this.palette.primary
    const sx = node.x * (this.scale.width / config.map.width)
    const sy = node.y * (this.scale.height / config.map.height)

    const container = this.add.container(sx, sy)
    container.setDepth(NODE_DEPTH)
    container.setSize(radius * 2, radius * 2)

    const shapeType = KIND_SHAPES[node.kind] ?? 'circle'
    let shape: Phaser.GameObjects.Arc | Phaser.GameObjects.Rectangle
    if (shapeType === 'circle') {
      shape = this.add.circle(0, 0, radius, kindColor, 1)
      shape.setStrokeStyle(2, this.palette.text, 0.4)
    } else if (shapeType === 'diamond') {
      const gfx = this.add.graphics()
      gfx.fillStyle(kindColor, 1)
      gfx.fillPoints([
        new Phaser.Geom.Point(0, -radius),
        new Phaser.Geom.Point(radius, 0),
        new Phaser.Geom.Point(0, radius),
        new Phaser.Geom.Point(-radius, 0),
      ], true)
      gfx.setDepth(NODE_DEPTH)
      container.add(gfx)
      shape = this.add.circle(0, 0, 1, kindColor, 0) as unknown as Phaser.GameObjects.Rectangle
    } else {
      shape = this.add.rectangle(0, 0, radius * 2, radius * 2, kindColor, 1)
      shape.setStrokeStyle(2, this.palette.text, 0.4)
    }
    if (shapeType !== 'diamond') container.add(shape as Phaser.GameObjects.Arc | Phaser.GameObjects.Rectangle)

    const icon = this.makeText(0, 0, this.nodeIconFor(node), 12, this.palette.inverseText, NODE_DEPTH + 1)
    container.add(icon)

    const label = this.makeText(0, -radius - 12, truncateAtWord(node.label_md, NODE_LABEL_MAX), 10, this.palette.text, NODE_DEPTH + 1)
    container.add(label)

    const ring = this.add.circle(0, 0, radius + 4, kindColor, 0)
    ring.setStrokeStyle(2, kindColor, 0)
    ring.setDepth(NODE_DEPTH - 0.5)
    container.add(ring)

    // Decoupled from `radius` on purpose — see `MIN_TAP_RADIUS`'s doc comment.
    const tapRadius = Math.max(radius + 6, MIN_TAP_RADIUS)
    container.setInteractive(new Phaser.Geom.Circle(0, 0, tapRadius), Phaser.Geom.Circle.Contains)

    this.nodeViews.push({ nodeIndex, container, shape, label, icon, ring, tapRadius })
  }

  private nodeIconFor(node: ExplorerNode): string {
    switch (node.kind) {
      case 'start': return '\u{1F3F4}'
      case 'tutorial': return '\u{1F4D6}'
      case 'boss': return '\u{2620}'
      case 'shrine': return '\u{2B50}'
      case 'shop': return '\u{1FA99}'
      case 'fragment': return '\u{1F9E9}'
      case 'goal': return '\u{1F3C6}'
      default: return '\u{25CF}'
    }
  }

  private createAvatar(): void {
    const state = this.bridge.state
    const config = state.config
    const startNode = state.nodes[state.at]
    if (!startNode) return

    const sx = startNode.x * (this.scale.width / config.map.width)
    const sy = startNode.y * (this.scale.height / config.map.height)

    const container = this.add.container(sx, sy)
    container.setDepth(AVATAR_DEPTH)

    const body = this.add.circle(0, 0, 8, this.palette.accent, 1)
    body.setStrokeStyle(2, this.palette.inverseText, 0.6)
    container.add(body)

    const dot = this.add.circle(0, 0, 3, this.palette.inverseText, 1)
    container.add(dot)

    this.avatarSprite = container
  }

  private createHUD(state: ExplorerState): void {
    const panelX = 70
    const startY = 20

    this.energyBarBg = this.add.image(panelX, startY + 8, BAR_BG_KEY).setOrigin(0, 0.5).setDepth(HUD_DEPTH)
    this.energyBar = this.add.image(panelX, startY + 8, BAR_FILL_KEY).setOrigin(0, 0.5).setDepth(HUD_DEPTH + 0.5)
    this.energyLabel = this.makeText(panelX + 70, startY + 8, `${state.energy}/${state.config.energy.max}`, 12, this.palette.text, HUD_DEPTH + 1)

    this.currencyLabel = this.makeText(panelX + 140, startY + 8, `\u{1FA99} ${state.currency}`, 14, this.palette.warning, HUD_DEPTH + 1)

    this.masteryLabel = this.makeText(panelX, startY + 28, this.strFmt('masteryLabel', { count: '0' }), 12, this.palette.success, HUD_DEPTH + 1)

    this.scoreLabel = this.makeText(this.scale.width - 40, startY + 8, '0', 16, this.palette.text, HUD_DEPTH + 1)

    if (state.lives !== null) {
      this.livesLabel = this.makeText(this.scale.width - 100, startY + 8, `${'\u{2764}'} ${state.lives}`, 14, this.palette.danger, HUD_DEPTH + 1)
    }

    this.abilityList = this.makeText(panelX, startY + 48, '', 11, this.palette.text, HUD_DEPTH + 1)

    this.infoLabel = this.makeText(this.scale.width / 2, this.scale.height - 30, '', 13, this.palette.text, HUD_DEPTH + 1)
  }

  private createButtons(): void {
    const btnX = this.scale.width - 110
    const btnY = this.scale.height - 30

    const restContainer = this.add.container(btnX, btnY)
    restContainer.setDepth(HUD_DEPTH)
    restContainer.setSize(90, 32)
    const restBg = this.add.image(0, 0, BTN_REST_KEY)
    restBg.setInteractive({ cursor: 'pointer' })
    restContainer.add(restBg)
    const restLabel = this.makeText(0, 0, this.str('rest'), 13, this.palette.primary, HUD_DEPTH + 1)
    restContainer.add(restLabel)
    restBg.on('pointerdown', () => this.attemptRest())
    this.restBtn = restContainer
  }

  private updateMapView(state: ExplorerState): void {
    const config = state.config
    const holdings = holdingsOfState(state)

    for (const view of this.nodeViews) {
      const node = state.nodes[view.nodeIndex]
      if (!node) continue

      const visible = nodeIsRevealed(state, view.nodeIndex)
      view.container.setVisible(visible)
      if (!visible) continue

      const visited = state.visited[view.nodeIndex] ?? false
      view.container.setAlpha(visited ? 1 : 0.5)

      const isCurrent = view.nodeIndex === state.at
      // `isFocused` is the KEYBOARD cursor (Tab/arrows) — distinct from `isCurrent`,
      // the player's actual position, so a keyboard user can see which node Enter
      // would act on without it being confused for "you are here".
      const isFocused = !isCurrent && view.nodeIndex === this.focusIndex
      if (isCurrent) {
        const pulse = 0.6 + Math.sin(Date.now() * 0.005) * 0.4
        view.ring.setStrokeStyle(2, this.palette.accent, pulse)
      } else if (isFocused) {
        view.ring.setStrokeStyle(3, this.palette.primary, 0.85)
      } else {
        view.ring.setStrokeStyle(2, this.palette.accent, 0)
      }

      if (state.visited[view.nodeIndex] === true) {
        view.shape.setAlpha(1)
      } else {
        view.shape.setAlpha(0.5)
      }
    }

    for (const edgeView of this.edgeViews) {
      const edge = state.edges[edgeView.edgeIndex]
      if (!edge) continue

      const isOpen = state.open[edgeView.edgeIndex] ?? false
      const fromNode = state.nodes[indexOfNode(state.nodes, edge.from)]
      const toNode = state.nodes[indexOfNode(state.nodes, edge.to)]
      if (!fromNode || !toNode) continue

      edgeView.line.clear()

      let edgeColor: number
      let edgeAlpha: number
      let edgeWidth: number
      if (isOpen) {
        edgeColor = this.palette.primary
        edgeAlpha = 0.6
        edgeWidth = 2
      } else if (edge.lock) {
        const holds = lockSatisfied(edge.lock, state.abilities, config, holdings)
        edgeColor = holds ? 0x22c55e : 0x444444
        edgeAlpha = holds ? 0.6 : 0.3
        edgeWidth = 1
      } else {
        edgeColor = 0x444444
        edgeAlpha = 0.2
        edgeWidth = 1
      }

      edgeView.line.lineStyle(edgeWidth, edgeColor, edgeAlpha)
      edgeView.line.beginPath()
      edgeView.line.moveTo(fromNode.x * (this.scale.width / config.map.width), fromNode.y * (this.scale.height / config.map.height))
      edgeView.line.lineTo(toNode.x * (this.scale.width / config.map.width), toNode.y * (this.scale.height / config.map.height))
      edgeView.line.strokePath()

      if (!isOpen && edge.lock) {
        const holds = lockSatisfied(edge.lock, state.abilities, config, holdings)
        edgeView.line.fillStyle(holds ? this.palette.success : 0x444444, 0.4)
        const mx = (fromNode.x + toNode.x) / 2 * (this.scale.width / config.map.width)
        const my = (fromNode.y + toNode.y) / 2 * (this.scale.height / config.map.height)
        edgeView.line.fillCircle(mx, my, 5)
      }
    }
  }

  private updateAvatar(state: ExplorerState): void {
    if (!this.avatarSprite) return
    const config = state.config
    const node = state.nodes[state.at]
    if (!node) return

    const tx = node.x * (this.scale.width / config.map.width)
    const ty = node.y * (this.scale.height / config.map.height)

    if (state.travelLeft > 0 && state.travelTo >= 0) {
      const targetNode = state.nodes[state.travelTo]
      if (targetNode) {
        const ttx = targetNode.x * (this.scale.width / config.map.width)
        const tty = targetNode.y * (this.scale.height / config.map.height)
        const progress = 1 - state.travelLeft / config.movement.ticks_per_edge
        this.avatarSprite.x = Phaser.Math.Linear(tx, ttx, progress)
        this.avatarSprite.y = Phaser.Math.Linear(ty, tty, progress)

        if (!this.travelling) {
          Sfx.click()
          this.travelling = true
        }
      }
    } else {
      this.avatarSprite.x = tx
      this.avatarSprite.y = ty
      this.travelling = false
    }
  }

  private updateHUDValues(state: ExplorerState): void {
    const config = state.config

    if (this.energyBar && this.energyBarBg) {
      const pct = Math.max(0, Math.min(1, state.energy / config.energy.max))
      this.energyBar.setDisplaySize(this.energyBarBg.width * pct, this.energyBarBg.height)
      this.energyBar.setTint(pct > 0.3 ? this.palette.success : this.palette.danger)
    }
    if (this.energyLabel) this.energyLabel.setText(`${state.energy}/${config.energy.max}`)
    if (this.currencyLabel) this.currencyLabel.setText(`\u{1FA99} ${state.currency}`)
    if (this.masteryLabel) this.masteryLabel.setText(this.strFmt('masteryLabel', { count: String(state.mastery) }))
    if (this.scoreLabel) this.scoreLabel.setText(`${Math.round(this.bridge.snapshot.score)}`)
    if (this.livesLabel && state.lives !== null) {
      this.livesLabel.setText(`${'\u{2764}'} ${state.lives}`)
    }

    if (this.abilityList) {
      const parts: string[] = []
      for (let i = 0; i < state.abilities.length; i += 1) {
        const ability = state.abilities[i]
        if (!ability) continue
        const tier = state.tier[i] ?? 0
        if (tier > 0) {
          parts.push(`${ability.id.slice(0, 4)}:T${tier}`)
        }
      }
      this.abilityList.setText(parts.join(' | '))
    }

    if (this.infoLabel) {
      const node = state.nodes[state.at]
      if (node && nodeIsClaimable(state, state.at)) {
        this.infoLabel.setText(this.str('tapNodeToTake'))
      } else if (state.cache[state.at] && state.cache[state.at]! > 0) {
        const amount = String(state.cache[state.at])
        this.infoLabel.setText(this.strFmt('currencyHere', { amount }))
      } else {
        this.infoLabel.setText('')
      }
    }
  }

  /**
   * A precise circular hit-test against `view.tapRadius` (see `MIN_TAP_RADIUS`) —
   * NOT `container.getBounds()`, which used to union in the label text's own
   * bounds (positioned above the marker) and so produced a hit region that grew
   * or shrank with a node's label LENGTH rather than guaranteeing any actual
   * floor, and was offset upward instead of centered on the marker. A fixed
   * circular radius, decoupled from both the visual dot size and the label, is
   * the only one of the two that can be reasoned about — and guaranteed to clear
   * the touch-target floor — without live-rendering it.
   */
  private nodeAt(x: number, y: number): number | null {
    for (const view of this.nodeViews) {
      if (!view.container.visible) continue
      const dx = x - view.container.x
      const dy = y - view.container.y
      if (dx * dx + dy * dy <= view.tapRadius * view.tapRadius) return view.nodeIndex
    }
    return null
  }

  private handleNodeClick(nodeIndex: number): void {
    const state = this.bridge.state
    if (nodeIndex === state.at) {
      if (state.cache[state.at] && state.cache[state.at]! > 0) {
        this.bridge.enqueue('take', { slot: state.nodes[state.at]?.id })
      } else if (nodeIsClaimable(state, nodeIndex)) {
        const node = state.nodes[nodeIndex]
        if (node?.challenge && !state.solved[nodeIndex]) {
          this.showChallenge(node, nodeIndex)
        } else {
          this.bridge.enqueue('take', { slot: node?.id })
        }
      }
      return
    }

    const here = state.nodes[state.at]
    const there = state.nodes[nodeIndex]
    if (!here || !there) return

    let edgeIdx = -1
    for (let i = 0; i < state.edges.length; i += 1) {
      const edge = state.edges[i]
      if (!edge) continue
      if (!canTraverse(edge, here.id, there.id)) continue
      if (edge.lock !== null && state.open[i] !== true) {
        this.handleLockedEdge(i, edge, state)
        return
      }
      edgeIdx = i
      break
    }

    if (edgeIdx >= 0) {
      this.bridge.enqueue('move', { slot: there.id })
    }
  }

  private handleLockedEdge(edgeIndex: number, edge: ExplorerEdge, state: ExplorerState): void {
    const lock = edge.lock
    if (!lock) return

    const holdings = holdingsOfState(state)
    if (lockSatisfied(lock, state.abilities, state.config, holdings)) {
      this.bridge.enqueue('use', { slot: edge.id, n: undefined })
    } else {
      if (this.infoLabel) {
        const hint = lock.hint_md ?? this.str('needAbility')
        this.infoLabel.setText(this.strFmt('lockedPrefix', { hint }))
        this.time.delayedCall(2000, () => {
          if (this.infoLabel) this.infoLabel.setText('')
        })
      }
    }
  }

  private showChallenge(node: ExplorerNode, _nodeIndex: number): void {
    const challenge = node.challenge
    if (!challenge) return

    if (this.challengeGroup) this.challengeGroup.destroy()
    this.challengeGroup = this.add.container(this.scale.width / 2, this.scale.height / 2)
    this.challengeGroup.setDepth(CHALLENGE_DEPTH)

    const bg = this.add.rectangle(0, 0, 340, 200 + challenge.options.length * 36, this.palette.surface, 0.95)
    bg.setStrokeStyle(2, this.palette.primary, 0.5)
    this.challengeGroup.add(bg)

    const prompt = this.makeText(0, -80, challenge.prompt_md.slice(0, 60), 14, this.palette.text, CHALLENGE_DEPTH + 1)
    this.challengeGroup.add(prompt)

    for (let i = 0; i < challenge.options.length; i += 1) {
      const option = challenge.options[i]
      if (!option) continue
      const optY = -30 + i * 36

      const optBg = this.add.rectangle(0, optY, 300, 32, this.palette.bgAccent, 0.8)
      optBg.setStrokeStyle(1, this.palette.primary, 0.3)
      optBg.setInteractive({ cursor: 'pointer' })
      this.challengeGroup.add(optBg)

      const optLabel = this.makeText(0, optY, truncateAtWord(option.label_md, OPTION_LABEL_MAX), 12, this.palette.text, CHALLENGE_DEPTH + 2)
      this.challengeGroup.add(optLabel)

      const idx = i
      optBg.on('pointerdown', () => {
        this.bridge.enqueue('take', { slot: node.id, n: idx })
        this.destroyChallenge()
      })
    }
  }

  private destroyChallenge(): void {
    if (this.challengeGroup) {
      this.challengeGroup.destroy()
      this.challengeGroup = null
    }
  }

  private onArrive(state: ExplorerState): void {
    Sfx.click()
    if (this.avatarSprite) {
      spawnCollectSparkles(this, this.avatarSprite.x, this.avatarSprite.y)
    }

    const node = state.nodes[state.at]
    if (!node) return

    if (node.kind === 'goal' && !state.finished) {
      Sfx.levelUp()
      spawnConfetti(this, this.scale.width / 2, this.scale.height / 2, 50)
      floatText(this, this.scale.width / 2, this.scale.height / 2, this.str('goal'), '#f59e0b', 2000)
    }

    if (node.challenge && !state.solved[state.at] && !state.claimed[state.at]) {
      this.showChallenge(node, state.at)
    }
  }

  private onEnergyGain(): void {
    if (this.energyBar) {
      this.tweens.add({
        targets: this.energyBar,
        scaleX: 1.05,
        scaleY: 1.3,
        duration: 120,
        yoyo: true,
        ease: 'Sine.easeOut',
      })
    }
  }

  private onEdgeUnlock(_state: ExplorerState): void {
    Sfx.whoosh()
    spawnCollectSparkles(this, this.scale.width / 2, this.scale.height / 2)
    addFlash(this, this.palette.accent, 80)

    floatText(this, this.scale.width / 2, this.scale.height / 2 - 40, this.str('unlocked'), '#22c55e', 1000)
  }
}

export default ExplorerScene
