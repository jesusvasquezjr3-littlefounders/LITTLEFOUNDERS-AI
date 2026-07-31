// GAME_ENGINE.md: skin.sprites (Prism → Depot raster URLs, keyed by the mechanic's
// declared sprite slot ids) and skin.background_url are part of the document contract
// and are authored by the generation pipeline, but before this file NOTHING ever
// called `this.load.image(...)` for them — `assets.ts`'s procedural placeholders were
// the only rendering path, unconditionally, even when real art was declared. This
// file is the seam: it queues the real URLs in `preload()` and hands mechanics a
// single decision point (`resolveSpriteKey`) for "did the real art actually load, or
// do I draw the placeholder" — so no mechanic has to know which path is active.
//
// Kept as free functions over a narrow duck-typed `SpriteLoaderTarget` (not methods
// hung directly off `Phaser.Scene`) on purpose: the app's global Phaser test stub
// (src/test-setup.ts) replaces the whole `phaser` module with a bare `class {}` for
// `Scene`, so nothing here can depend on constructing a real `Phaser.Scene` instance,
// or on `Phaser.Loader.Events` existing at import time, and still be unit-testable.

import type { GameSkin } from '@/game-engine/core/types'

/** Distinguishes a REAL (Prism/Depot) texture key from any mechanic's own procedural
 *  placeholder key (e.g. sorter's `sorter-item-3`) so the two can never collide in
 *  Phaser's shared, scene-global texture cache. */
const REAL_PREFIX = 'real-sprite:'

/** The texture key a real sprite for `slot` is loaded/looked-up under. Both
 *  `queueRealSprites` and `resolveSpriteKey` route through this so they always agree. */
export function realSpriteKey(slot: string): string {
  return `${REAL_PREFIX}${slot}`
}

/** The texture key `skin.background_url` (if present) is loaded/looked-up under. */
export const REAL_BACKGROUND_KEY = `${REAL_PREFIX}__background__`

/** The literal value of `Phaser.Loader.Events.FILE_LOAD_ERROR` (see
 *  node_modules/phaser/src/loader/events/FILE_LOAD_ERROR_EVENT.js). Used as a string
 *  constant — never `Phaser.Loader.Events.FILE_LOAD_ERROR` — so this module has no
 *  runtime dependency on the `Loader` namespace existing, which the app's global
 *  Phaser test stub does not model. */
const LOAD_ERROR_EVENT = 'loaderror'

/** The minimal shape this module needs from a Phaser scene. A real `Phaser.Scene`
 *  satisfies this structurally (its `load`/`textures` plugins are supersets), so
 *  production call sites just pass `this`; tests pass a plain object literal. */
export interface SpriteLoaderTarget {
  load: {
    image(key: string, url: string): unknown
    on(event: string, callback: (file: { key: string }) => void): unknown
  }
  textures: {
    exists(key: string): boolean
  }
}

/** Tracks which of THIS run's queued real-sprite loads errored, so a bad Depot URL
 *  falls back to the procedural placeholder instead of leaving a blank/broken
 *  texture. One tracker per scene instance — never shared across runs. */
export interface SpriteLoadTracker {
  readonly failed: Set<string>
}

export function createSpriteLoadTracker(): SpriteLoadTracker {
  return { failed: new Set<string>() }
}

/**
 * Call from `preload()`. Queues `this.load.image(...)` for every URL declared in
 * `skin.sprites` plus `skin.background_url` (if present), and wires the loader's
 * error event so a failed fetch is recorded in `tracker` rather than left to silently
 * produce a blank/missing texture. Phaser does not call `create()` until its load
 * queue drains, so by the time a mechanic's `createGameObjects()` runs, `tracker`
 * already reflects every outcome — no race, no "loading" state to model.
 *
 * A document with an empty `skin.sprites` (and no `background_url`) queues nothing:
 * the procedural path in `assets.ts` remains the only one exercised, as it was before
 * this file existed.
 */
export function queueRealSprites(scene: SpriteLoaderTarget, skin: GameSkin, tracker: SpriteLoadTracker): void {
  const watched = new Set<string>()

  for (const [slot, url] of Object.entries(skin.sprites)) {
    if (!url) continue
    const key = realSpriteKey(slot)
    watched.add(key)
    scene.load.image(key, url)
  }

  if (skin.background_url) {
    watched.add(REAL_BACKGROUND_KEY)
    scene.load.image(REAL_BACKGROUND_KEY, skin.background_url)
  }

  // Nothing queued -> no listener needed, and nothing to ever mark failed.
  if (watched.size === 0) return

  scene.load.on(LOAD_ERROR_EVENT, (file: { key: string }) => {
    if (watched.has(file.key)) tracker.failed.add(file.key)
  })
}

/**
 * The seam a mechanic's `createGameObjects()` calls to pick a texture key. Returns the
 * real-sprite key for `slot` if Prism/Depot art was declared for it AND it finished
 * loading without error; otherwise returns `fallbackKey` unchanged. Callers keep
 * generating their placeholder unconditionally exactly as before (it's idempotent —
 * `generatePlaceholderSprite` no-ops if the key already exists) and let this decide
 * which key actually gets drawn:
 *
 *   const fallback = `sorter-item-${entity.uid}`
 *   generatePlaceholderSprite(this, fallback, size, size, tierColor, 'rect', this.palette.text)
 *   const key = this.spriteKeyFor(entity.item.image_slot, fallback)
 *   this.add.image(x, y, key)
 *
 * `slot` is `undefined` whenever the item/category has no `image_slot` bound — that's
 * the normal "this content has no dedicated art" case, not an error, so it silently
 * resolves to `fallbackKey`.
 */
export function resolveSpriteKey(
  scene: SpriteLoaderTarget,
  tracker: SpriteLoadTracker,
  slot: string | undefined,
  fallbackKey: string,
): string {
  if (!slot) return fallbackKey
  const key = realSpriteKey(slot)
  if (tracker.failed.has(key)) return fallbackKey
  if (!scene.textures.exists(key)) return fallbackKey
  return key
}

/** Same decision as `resolveSpriteKey`, specialized for `skin.background_url`. */
export function resolveBackgroundKey(scene: SpriteLoaderTarget, tracker: SpriteLoadTracker, fallbackKey: string): string {
  if (tracker.failed.has(REAL_BACKGROUND_KEY)) return fallbackKey
  if (!scene.textures.exists(REAL_BACKGROUND_KEY)) return fallbackKey
  return REAL_BACKGROUND_KEY
}
