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
import { BaseMechanicScene } from '@/game-engine/phaser/scene'
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

interface NodeView {
  nodeIndex: number
  container: Phaser.GameObjects.Container
  shape: Phaser.GameObjects.Arc | Phaser.GameObjects.Rectangle
  label: Phaser.GameObjects.Text
  icon: Phaser.GameObjects.Text
  ring: Phaser.GameObjects.Arc
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
  }

  setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.paused || this.finished) return
      const state = this.bridge.state
      if (state.travelLeft > 0) return

      const clickedNode = this.nodeAt(pointer.x, pointer.y)
      if (clickedNode !== null) {
        this.handleNodeClick(clickedNode)
        return
      }
    })
  }

  updateGameObjects(_delta: number): void {
    const state = this.bridge.state

    this.updateMapView(state)
    this.updateAvatar(state)
    this.updateHUDValues(state)

    if (state.at !== this.prevAt) {
      this.onArrive(state)
    }

    if (state.energy !== this.prevEnergy && state.energy > this.prevEnergy && state.actions > 0) {
      this.onEnergyGain()
    }

    if (state.currency !== this.prevCurrency && state.currency > this.prevCurrency) {
      Sfx.collect()
      floatText(this, this.scale.width / 2, this.scale.height / 2, `+${state.currency - this.prevCurrency}g`, '#ffd700', 600)
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

    const label = this.makeText(0, -radius - 12, node.label_md.slice(0, 14), 10, this.palette.text, NODE_DEPTH + 1)
    container.add(label)

    const ring = this.add.circle(0, 0, radius + 4, kindColor, 0)
    ring.setStrokeStyle(2, kindColor, 0)
    ring.setDepth(NODE_DEPTH - 0.5)
    container.add(ring)

    container.setInteractive(new Phaser.Geom.Circle(0, 0, radius + 6), Phaser.Geom.Circle.Contains)

    this.nodeViews.push({ nodeIndex, container, shape, label, icon, ring })
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

    this.masteryLabel = this.makeText(panelX, startY + 28, 'M:0', 12, this.palette.success, HUD_DEPTH + 1)

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
    const restLabel = this.makeText(0, 0, 'Rest', 13, this.palette.primary, HUD_DEPTH + 1)
    restContainer.add(restLabel)
    restBg.on('pointerdown', () => {
      if (this.paused || this.finished) return
      if (!canRestAt(this.bridge.state, this.bridge.state.at)) return
      this.bridge.enqueue('rest')
      Sfx.collect()
    })
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
      if (isCurrent) {
        const pulse = 0.6 + Math.sin(Date.now() * 0.005) * 0.4
        view.ring.setStrokeStyle(2, this.palette.accent, pulse)
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
    if (this.masteryLabel) this.masteryLabel.setText(`M:${state.mastery}`)
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
        this.infoLabel.setText('Tap node to take')
      } else if (state.cache[state.at] && state.cache[state.at]! > 0) {
        this.infoLabel.setText(`\u{1F4B0} ${state.cache[state.at]} here`)
      } else {
        this.infoLabel.setText('')
      }
    }
  }

  private nodeAt(x: number, y: number): number | null {
    for (const view of this.nodeViews) {
      if (!view.container.visible) continue
      const bounds = view.container.getBounds()
      if (bounds.contains(x, y)) return view.nodeIndex
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
        this.infoLabel.setText(`Locked: ${lock.hint_md ?? 'need ability'}`)
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

      const optLabel = this.makeText(0, optY, option.label_md.slice(0, 40), 12, this.palette.text, CHALLENGE_DEPTH + 2)
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
      floatText(this, this.scale.width / 2, this.scale.height / 2, 'GOAL!', '#f59e0b', 2000)
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

    floatText(this, this.scale.width / 2, this.scale.height / 2 - 40, 'Unlocked!', '#22c55e', 1000)
  }
}

export default ExplorerScene
