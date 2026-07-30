import { useCallback, useEffect, useRef } from 'react'
import Phaser from 'phaser'

import type { GameDocument, GameInputEvent, MechanicId } from '@/game-engine/core/types'
import type { BridgeSnapshot } from '@/game-engine/phaser/bridge'
import { loadMechanicScene } from '@/game-engine/phaser/sceneRegistry'
import { cn } from '@/lib/utils'

export interface PhaserGameBoxProps {
  mechanic: MechanicId
  document: GameDocument
  runId: string
  seed: number
  maxTicks: number
  paused: boolean
  className?: string
  onSnapshot?: (snap: BridgeSnapshot) => void
  onFinish?: (inputLog: readonly GameInputEvent[]) => void
}

type SceneWithPause = {
  paused: boolean
  togglePause: () => void
}

function extractSceneConstructor(
  mod: object,
): (new () => Phaser.Scene) | null {
  for (const value of Object.values(mod)) {
    if (typeof value === 'function' && value.prototype instanceof Phaser.Scene) {
      return value as new () => Phaser.Scene
    }
  }
  return null
}

export function PhaserGameBox({
  mechanic,
  document,
  runId,
  seed,
  maxTicks,
  paused,
  className,
  onSnapshot,
  onFinish,
}: PhaserGameBoxProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const sceneRef = useRef<SceneWithPause | null>(null)

  const onSnapshotRef = useRef(onSnapshot)
  onSnapshotRef.current = onSnapshot
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish

  const startGame = useCallback(async () => {
    const container = containerRef.current
    if (!container) return

    const mod = await loadMechanicScene(mechanic)
    if (!mod) return

    const SceneClass = extractSceneConstructor(mod)
    if (!SceneClass) return

    const sceneKey = `${mechanic}-${runId}`

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      parent: container,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      backgroundColor: '#000000',
      audio: { noAudio: false },
      scene: [SceneClass],
      banner: false,
    }

    const game = new Phaser.Game(config)
    gameRef.current = game

    game.events.once('ready', () => {
      game.scene.start(sceneKey, {
        document,
        runId,
        seed,
        maxTicks,
        onSnapshot: (snap: BridgeSnapshot) => onSnapshotRef.current?.(snap),
        onFinish: (log: readonly GameInputEvent[]) => onFinishRef.current?.(log),
      })

      const scene = game.scene.getScene(sceneKey) as unknown as SceneWithPause
      if (scene) sceneRef.current = scene
    })
  }, [mechanic, document, runId, seed, maxTicks])

  useEffect(() => {
    startGame()
    return () => {
      const game = gameRef.current
      if (game) {
        game.destroy(true)
        gameRef.current = null
        sceneRef.current = null
      }
    }
  }, [startGame])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    if (paused && !scene.paused) {
      scene.togglePause()
    } else if (!paused && scene.paused) {
      scene.togglePause()
    }
  }, [paused])

  return (
    <div
      ref={containerRef}
      className={cn('w-full h-full flex items-center justify-center bg-black', className)}
    />
  )
}
