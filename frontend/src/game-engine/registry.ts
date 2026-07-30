// The mechanic registry — GAME_ENGINE.md §7.
//
// Three exports, and the split between the first two is the whole point:
//
//   MECHANIC_META    SYNCHRONOUS metadata (i18n keys + a Material Symbols ligature).
//                    The /games hub renders entirely from this, so browsing the hub
//                    loads ZERO mechanic code — no schema, no simulator, no view.
//   MECHANIC_LOADERS one dynamic import() per mechanic, so each mechanic is its own
//                    lazy chunk. Eight mechanics must never become one bundle every
//                    player downloads in order to play one game.
//   loadMechanic()   the cached loader. An id with no slice returns null; it NEVER
//                    throws.
//
// FORWARD COMPATIBILITY (non-negotiable, GAME_ENGINE.md §7). `loadMechanic` answers
// null for BOTH an id outside MECHANIC_IDS and a declared id whose slice does not
// exist yet, and the caller renders the i18n unsupported-game card and awards no XP.
// That is what lets mechanic #9 ship into production CONTENT without a coordinated
// client release: an older cached SPA meets `mechanic: 'newthing'`, shows a friendly
// card, and keeps working. Throwing here would turn every such document into a blank
// screen for every client that predates it.
//
// This module imports NO mechanic code eagerly — only `core/types` (type-only plus
// the MECHANIC_IDS constant). Keep it that way: an eager `import` of any register.ts
// would silently pull every mechanic into the hub's bundle.

import { MECHANIC_IDS } from './core/types'
import type { MechanicId, MechanicSlice } from './core/types'

/** Hub-card metadata for one mechanic. Strings are i18n KEYS, never copy (§1.8). */
export interface MechanicMeta {
  /** `games.mechanics.<id>.title` */
  titleKey: string
  /** Material Symbols Outlined ligature name (DESIGN.md — the only icon set). */
  icon: string
  /** `games.mechanics.<id>.blurb` */
  blurbKey: string
}

/** Typed over MechanicId, so adding a 9th id is a compile error until its card exists. */
export const MECHANIC_META: Record<MechanicId, MechanicMeta> = {
  sorter: {
    titleKey: 'games.mechanics.sorter.title',
    icon: 'category',
    blurbKey: 'games.mechanics.sorter.blurb',
  },
  launcher: {
    titleKey: 'games.mechanics.launcher.title',
    icon: 'rocket_launch',
    blurbKey: 'games.mechanics.launcher.blurb',
  },
  runner: {
    titleKey: 'games.mechanics.runner.title',
    icon: 'directions_run',
    blurbKey: 'games.mechanics.runner.blurb',
  },
  stacker: {
    titleKey: 'games.mechanics.stacker.title',
    icon: 'layers',
    blurbKey: 'games.mechanics.stacker.blurb',
  },
  autobattler: {
    titleKey: 'games.mechanics.autobattler.title',
    icon: 'swords',
    blurbKey: 'games.mechanics.autobattler.blurb',
  },
  explorer: {
    titleKey: 'games.mechanics.explorer.title',
    icon: 'explore',
    blurbKey: 'games.mechanics.explorer.blurb',
  },
  defender: {
    titleKey: 'games.mechanics.defender.title',
    icon: 'shield',
    blurbKey: 'games.mechanics.defender.blurb',
  },
  flyer: {
    titleKey: 'games.mechanics.flyer.title',
    icon: 'flight',
    blurbKey: 'games.mechanics.flyer.blurb',
  },
}

/** Resolves the slice of ONE mechanic — always a dynamic `import()`, never a static one. */
export type MechanicLoader = () => Promise<MechanicSlice>

/**
 * Loader table. `null` means "declared in MECHANIC_IDS, slice not written yet" — the
 * document layer and the player both treat it exactly like an unknown mechanic.
 *
 * HOW TO PLUG A NEW MECHANIC IN (the only change this file needs): replace that
 * mechanic's `null` with its loader, mirroring the two implemented rows —
 *
 *   launcher: () => import('./mechanics/launcher/register').then((m) => m.launcherSlice),
 *
 * The path must stay a plain relative literal so the bundler can statically discover
 * the chunk, and the row must resolve to the slice VALUE (not the module namespace).
 * `registry.test.tsx` fails until MECHANIC_META and this table agree on every id.
 */
export const MECHANIC_LOADERS: Record<MechanicId, MechanicLoader | null> = {
  sorter: () => import('./mechanics/sorter/register').then((m) => m.sorterSlice),
  launcher: null,
  runner: () => import('./mechanics/runner/register').then((m) => m.runnerSlice),
  stacker: null,
  autobattler: null,
  explorer: null,
  defender: null,
  flyer: null,
}

/** Narrows an arbitrary string (a document's `meta.mechanic`) to a declared id. */
export function isMechanicId(id: string): id is MechanicId {
  return (MECHANIC_IDS as readonly string[]).includes(id)
}

/** Resolved slices, keyed by id: a mechanic's chunk is evaluated at most once. */
const sliceCache = new Map<MechanicId, MechanicSlice>()
/** In-flight loads, so two concurrent players of the same mechanic share one promise. */
const pendingLoads = new Map<MechanicId, Promise<MechanicSlice>>()

/**
 * Load a mechanic slice. Returns `null` — never throws — for an id that is not a
 * declared mechanic and for a declared mechanic with no slice yet (see the
 * forward-compatibility note at the top of this file).
 *
 * A genuine chunk-load failure (network) DOES reject: that is a transient transport
 * error, not an unsupported document, and collapsing the two would tell a child their
 * game does not exist when their connection merely blinked. The in-flight entry is
 * dropped on failure so a later attempt can retry.
 */
export async function loadMechanic(id: string): Promise<MechanicSlice | null> {
  if (!isMechanicId(id)) return null

  const cached = sliceCache.get(id)
  if (cached !== undefined) return cached

  const loader = MECHANIC_LOADERS[id]
  if (loader === null) return null

  const inFlight = pendingLoads.get(id)
  if (inFlight !== undefined) return inFlight

  const load = loader()
    .then((slice) => {
      sliceCache.set(id, slice)
      return slice
    })
    .finally(() => {
      pendingLoads.delete(id)
    })
  pendingLoads.set(id, load)
  return load
}
