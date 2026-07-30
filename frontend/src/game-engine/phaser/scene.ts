import Phaser from 'phaser'

import type { GameDocument } from '@/game-engine/core/types'

import { resolvePalette, type GamePalette } from './assets'
import { GameEngineBridge, type BridgeSnapshot } from './bridge'
import { createParticleTextures } from './juice'

export interface MechanicSceneInit {
  document: GameDocument
  runId: string
  seed: number
  maxTicks: number
  onSnapshot?: (snap: BridgeSnapshot) => void
  onFinish?: (inputLog: readonly import('@/game-engine/core/types').GameInputEvent[]) => void
  onPause?: () => void
}

export abstract class BaseMechanicScene<S> extends Phaser.Scene {
  bridge!: GameEngineBridge<S>
  doc!: GameDocument
  palette!: GamePalette

  private _onSnapshot?: (snap: BridgeSnapshot) => void
  private _onFinish?: (inputLog: readonly import('@/game-engine/core/types').GameInputEvent[]) => void
  private _onPause?: () => void
  private _lastSnapshot: BridgeSnapshot = { score: 0, lives: null, finished: false, round: 0, tick: 0, tickAlpha: 0 }
  private _paused = false

  constructor(key: string) {
    super({ key })
  }

  init(data: MechanicSceneInit): void {
    this.doc = data.document
    this.palette = resolvePalette(data.document.skin.palette)
    this._onSnapshot = data.onSnapshot
    this._onFinish = data.onFinish
    this._onPause = data.onPause
  }

  preload(): void {
    createParticleTextures(this)
  }

  abstract createBridge(): { bridge: GameEngineBridge<S> }

  create(): void {
    const { bridge } = this.createBridge()
    this.bridge = bridge
    this.bridge.start()

    this.cameras.main.setBackgroundColor(this.palette.bg)

    this.setupInput()
    this.createGameObjects()
    this.events.on('shutdown', () => this.bridge.stop())
  }

  update(_time: number, delta: number): void {
    if (this._paused) return

    this.bridge.update(delta)
    this.updateGameObjects(delta)

    const snap = this.bridge.bridgeSnapshot
    if (
      snap.score !== this._lastSnapshot.score ||
      snap.finished !== this._lastSnapshot.finished ||
      snap.lives !== this._lastSnapshot.lives
    ) {
      this._onSnapshot?.(snap)
      if (snap.finished) {
        this._onFinish?.(this.bridge.inputLog)
      }
    }
    this._lastSnapshot = snap
  }

  abstract setupInput(): void
  abstract createGameObjects(): void
  abstract updateGameObjects(delta: number): void

  togglePause(): void {
    if (this._paused) {
      this._paused = false
      this.bridge.resume()
    } else {
      this._paused = true
      this.bridge.pause()
    }
    this._onPause?.()
  }

  get paused(): boolean {
    return this._paused
  }

  get finished(): boolean {
    return this.bridge.finished
  }

  protected makeSprite(x: number, y: number, texture: string, depth = 10): Phaser.GameObjects.Sprite {
    const s = this.add.sprite(x, y, texture)
    s.setDepth(depth)
    return s
  }

  protected makeRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
    alpha = 1,
    depth = 5,
  ): Phaser.GameObjects.Rectangle {
    const r = this.add.rectangle(x, y, width, height, color, alpha)
    r.setDepth(depth)
    return r
  }

  protected makeCircle(x: number, y: number, radius: number, color: number, alpha = 1, depth = 5): Phaser.GameObjects.Arc {
    const c = this.add.circle(x, y, radius, color, alpha)
    c.setDepth(depth)
    return c
  }

  protected makeText(
    x: number,
    y: number,
    text: string,
    size = 16,
    color?: number,
    depth = 20,
  ): Phaser.GameObjects.Text {
    const c = color ?? this.palette.text
    const hex = `#${c.toString(16).padStart(6, '0')}`
    const t = this.add.text(x, y, text, {
      fontFamily: 'Figtree, sans-serif',
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color: hex,
    })
    t.setOrigin(0.5)
    t.setDepth(depth)
    return t
  }
}
