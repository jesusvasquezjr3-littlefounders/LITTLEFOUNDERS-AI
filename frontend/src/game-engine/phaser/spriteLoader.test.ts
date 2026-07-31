import { describe, expect, it } from 'vitest'

import type { GameSkin } from '@/game-engine/core/types'

import {
  createSpriteLoadTracker,
  queueRealSprites,
  realSpriteKey,
  REAL_BACKGROUND_KEY,
  resolveBackgroundKey,
  resolveSpriteKey,
  type SpriteLoaderTarget,
} from './spriteLoader'

/** A minimal, fully controllable stand-in for Phaser's `load`/`textures` plugins —
 *  the app's global Phaser test stub (src/test-setup.ts) replaces `Scene` with a bare
 *  `class {}`, so a real `Phaser.Scene` cannot be constructed in tests. `spriteLoader`
 *  is written against the narrow `SpriteLoaderTarget` shape specifically so it can be
 *  exercised without one — this fake satisfies that shape exactly, mirroring how
 *  Phaser's real loader queues an image then later fires `loaderror` for URLs that
 *  fail (the fake's `simulateLoadError` stands in for that async fetch failure). */
function createFakeScene() {
  const queued: Array<{ key: string; url: string }> = []
  const loadedTextures = new Set<string>()
  const errorListeners: Array<(file: { key: string }) => void> = []

  const scene: SpriteLoaderTarget = {
    load: {
      image(key: string, url: string) {
        queued.push({ key, url })
        // Simulate a successful fetch by default — texture becomes available.
        loadedTextures.add(key)
        return undefined
      },
      on(event: string, callback: (file: { key: string }) => void) {
        if (event === 'loaderror') errorListeners.push(callback)
        return undefined
      },
    },
    textures: {
      exists(key: string) {
        return loadedTextures.has(key)
      },
    },
  }

  return {
    scene,
    queued,
    /** Marks a previously-queued key as having failed to load: removes it from the
     *  texture cache and fires every registered `loaderror` listener, exactly as
     *  Phaser's real loader would for a 404/network failure. */
    simulateLoadError(key: string) {
      loadedTextures.delete(key)
      for (const listener of errorListeners) listener({ key })
    },
  }
}

describe('spriteLoader', () => {
  describe('queueRealSprites', () => {
    it('loads every declared skin.sprites URL plus the background', () => {
      const { scene, queued } = createFakeScene()
      const skin: GameSkin = {
        palette: 'navy-papaya',
        background_url: 'https://depot.example/bg.webp',
        sprites: {
          item_1: 'https://depot.example/item_1.webp',
          bin_1: 'https://depot.example/bin_1.webp',
        },
      }
      const tracker = createSpriteLoadTracker()

      queueRealSprites(scene, skin, tracker)

      expect(queued).toEqual(
        expect.arrayContaining([
          { key: realSpriteKey('item_1'), url: skin.sprites.item_1 },
          { key: realSpriteKey('bin_1'), url: skin.sprites.bin_1 },
          { key: REAL_BACKGROUND_KEY, url: skin.background_url },
        ]),
      )
      expect(queued).toHaveLength(3)
    })

    it('queues nothing for a document with empty skin.sprites and no background', () => {
      const { scene, queued } = createFakeScene()
      const skin: GameSkin = { palette: 'navy-papaya', sprites: {} }
      const tracker = createSpriteLoadTracker()

      queueRealSprites(scene, skin, tracker)

      expect(queued).toHaveLength(0)
    })

    it('skips falsy URLs without queuing a load for them', () => {
      const { scene, queued } = createFakeScene()
      const skin: GameSkin = {
        palette: 'navy-papaya',
        sprites: { item_1: '' as unknown as string },
      }
      const tracker = createSpriteLoadTracker()

      queueRealSprites(scene, skin, tracker)

      expect(queued).toHaveLength(0)
    })
  })

  describe('resolveSpriteKey', () => {
    it('uses the procedural fallback when skin.sprites is empty (no slot ever queued)', () => {
      const { scene } = createFakeScene()
      const tracker = createSpriteLoadTracker()

      const key = resolveSpriteKey(scene, tracker, 'item_1', 'sorter-item-42')

      expect(key).toBe('sorter-item-42')
    })

    it('uses the procedural fallback when the item has no image_slot bound', () => {
      const { scene, queued } = createFakeScene()
      const skin: GameSkin = { palette: 'navy-papaya', sprites: { item_1: 'https://depot.example/item_1.webp' } }
      const tracker = createSpriteLoadTracker()
      queueRealSprites(scene, skin, tracker)
      expect(queued).toHaveLength(1) // sanity: a real sprite WAS queued for a different slot

      const key = resolveSpriteKey(scene, tracker, undefined, 'sorter-item-42')

      expect(key).toBe('sorter-item-42')
    })

    it('returns the real-sprite texture key once the load has succeeded', () => {
      const { scene } = createFakeScene()
      const skin: GameSkin = { palette: 'navy-papaya', sprites: { item_1: 'https://depot.example/item_1.webp' } }
      const tracker = createSpriteLoadTracker()
      queueRealSprites(scene, skin, tracker)

      const key = resolveSpriteKey(scene, tracker, 'item_1', 'sorter-item-42')

      expect(key).toBe(realSpriteKey('item_1'))
      expect(key).not.toBe('sorter-item-42')
    })

    it('falls back to the procedural key without throwing when the real load errors', () => {
      const { scene, simulateLoadError } = createFakeScene()
      const skin: GameSkin = { palette: 'navy-papaya', sprites: { item_1: 'https://depot.example/item_1.webp' } }
      const tracker = createSpriteLoadTracker()
      queueRealSprites(scene, skin, tracker)

      expect(() => simulateLoadError(realSpriteKey('item_1'))).not.toThrow()

      const key = resolveSpriteKey(scene, tracker, 'item_1', 'sorter-item-42')
      expect(key).toBe('sorter-item-42')
    })
  })

  describe('resolveBackgroundKey', () => {
    it('uses the procedural fallback when no background_url is declared', () => {
      const { scene } = createFakeScene()
      const tracker = createSpriteLoadTracker()

      const key = resolveBackgroundKey(scene, tracker, 'sorter-bg')

      expect(key).toBe('sorter-bg')
    })

    it('returns the real background key once loaded successfully', () => {
      const { scene } = createFakeScene()
      const skin: GameSkin = { palette: 'navy-papaya', background_url: 'https://depot.example/bg.webp', sprites: {} }
      const tracker = createSpriteLoadTracker()
      queueRealSprites(scene, skin, tracker)

      expect(resolveBackgroundKey(scene, tracker, 'sorter-bg')).toBe(REAL_BACKGROUND_KEY)
    })

    it('falls back to the procedural background when the real load errors', () => {
      const { scene, simulateLoadError } = createFakeScene()
      const skin: GameSkin = { palette: 'navy-papaya', background_url: 'https://depot.example/bg.webp', sprites: {} }
      const tracker = createSpriteLoadTracker()
      queueRealSprites(scene, skin, tracker)

      simulateLoadError(REAL_BACKGROUND_KEY)

      expect(resolveBackgroundKey(scene, tracker, 'sorter-bg')).toBe('sorter-bg')
    })
  })
})
