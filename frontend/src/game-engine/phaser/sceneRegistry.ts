import type { MechanicId } from '@/game-engine/core/types'

type SceneModule = object

const SCENE_LOADERS: Record<MechanicId, () => Promise<SceneModule>> = {
  sorter: () => import('@/game-engine/mechanics/sorter/scene'),
  launcher: () => import('@/game-engine/mechanics/launcher/scene'),
  runner: () => import('@/game-engine/mechanics/runner/scene'),
  stacker: () => import('@/game-engine/mechanics/stacker/scene'),
  autobattler: () => import('@/game-engine/mechanics/autobattler/scene'),
  explorer: () => import('@/game-engine/mechanics/explorer/scene'),
  defender: () => import('@/game-engine/mechanics/defender/scene'),
  flyer: () => import('@/game-engine/mechanics/flyer/scene'),
}

const cache = new Map<MechanicId, SceneModule>()
const pending = new Map<MechanicId, Promise<SceneModule>>()

export async function loadMechanicScene(id: MechanicId): Promise<SceneModule | null> {
  const cached = cache.get(id)
  if (cached) return cached

  const inflight = pending.get(id)
  if (inflight) return inflight

  const loader = SCENE_LOADERS[id]
  if (!loader) return null

  const promise = loader()
    .then((mod) => {
      cache.set(id, mod)
      return mod
    })
    .finally(() => {
      pending.delete(id)
    })

  pending.set(id, promise)
  return promise
}
