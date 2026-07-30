// The SYNCHRONOUS mechanic registry for Arcade (GAME_ENGINE.md §7, brief §5, §9).
//
// This and `core/schema.ts`'s `parseGameDocumentSync` are the only parts of
// `gamegen/src/contract/` that are not verbatim copies of a frontend module, and this
// one exists because the two registries answer different questions. The frontend's
// `registry.ts` is asynchronous on purpose — eight mechanics must never become one
// bundle every player downloads to play one game, so each slice is a dynamic
// `import()` and its own lazy chunk. Arcade has no bundle: what it needs is to look a
// simulator up by id inside the `simulate` stage — the WINNABILITY GATE that bot-plays
// a freshly authored document before it may be published — without an await and
// without a React component ever entering the process. So it holds the React-free half
// of the slice (`MechanicSimSlice`: configSchema + contentSchema + simulator +
// spriteSlots) eagerly.
//
// Deliberately IDENTICAL in shape to `backend/src/game-contract/registry.ts`: the
// generation gate and the reward replay must agree on what "this mechanic" means, and
// two divergent registry shapes would be a place for them to disagree quietly.
//
// HOW TO PLUG A NEW MECHANIC IN — the only change this file needs:
//   1. copy that mechanic's `schema.ts` and `simulate.ts` from
//      `frontend/src/game-engine/mechanics/<id>/` into
//      `gamegen/src/contract/mechanics/<id>/`, rewriting ONLY the import specifiers to
//      NodeNext `.js` form;
//   2. add the pair to `FULL_FILE_PAIRS` in `gamegen/src/contract/check.ts`;
//   3. add its row below with the same object shape every implemented row uses (a
//      mechanic id declared in the closed set but not yet copied here sits at `null`
//      until then — see FORWARD COMPATIBILITY).
// As of this batch all eight declared mechanics are implemented, so no row is `null`.
//
// FORWARD COMPATIBILITY (mirrors the frontend's `loadMechanic` and Core's
// `getMechanic`). A declared-but-unimplemented mechanic is `null`, never a throwing
// stub: importing this module must be free of side effects and must never fail, and a
// blueprint naming a mechanic this release does not implement has to degrade to a
// refusal the pipeline can turn into a failed slot — not a crashed run. `getMechanic`
// therefore takes a plain `string` (a catalog/DB value, not a narrowed type) and
// answers `null` for both an unknown id and an unimplemented one. In Arcade a `null`
// means the winnability gate cannot be run, which means the document MUST NOT be
// published: an ungated game is exactly what the gate exists to prevent.

import type { GameBots, MechanicId, MechanicSimSlice } from './core/types.js'
import { MECHANIC_IDS } from './core/types.js'

import { sorterBots } from './mechanics/sorter/bots.js'
import { launcherBots } from './mechanics/launcher/bots.js'
import { runnerBots } from './mechanics/runner/bots.js'
import { stackerBots } from './mechanics/stacker/bots.js'
import { autobattlerBots } from './mechanics/autobattler/bots.js'
import { explorerBots } from './mechanics/explorer/bots.js'
import { defenderBots } from './mechanics/defender/bots.js'
import { flyerBots } from './mechanics/flyer/bots.js'

import { sorterConfigSchema, sorterContentSchema, SORTER_SPRITE_SLOTS } from './mechanics/sorter/schema.js'
import { sorterSimulator } from './mechanics/sorter/simulate.js'
import { runnerConfigSchema, runnerContentSchema, RUNNER_SPRITE_SLOTS } from './mechanics/runner/schema.js'
import { runnerSimulator } from './mechanics/runner/simulate.js'
import {
  launcherConfigSchema,
  launcherContentSchema,
  LAUNCHER_SPRITE_SLOTS,
} from './mechanics/launcher/schema.js'
import { launcherSimulator } from './mechanics/launcher/simulate.js'
import {
  stackerConfigSchema,
  stackerContentSchema,
  STACKER_SPRITE_SLOTS,
} from './mechanics/stacker/schema.js'
import { stackerSimulator } from './mechanics/stacker/simulate.js'
import {
  defenderConfigSchema,
  defenderContentSchema,
  DEFENDER_SPRITE_SLOTS,
} from './mechanics/defender/schema.js'
import { defenderSimulator } from './mechanics/defender/simulate.js'
import {
  autobattlerConfigSchema,
  autobattlerContentSchema,
  AUTOBATTLER_SPRITE_SLOTS,
} from './mechanics/autobattler/schema.js'
import { autobattlerSimulator } from './mechanics/autobattler/simulate.js'
import {
  explorerConfigSchema,
  explorerContentSchema,
  EXPLORER_SPRITE_SLOTS,
} from './mechanics/explorer/schema.js'
import { explorerSimulator } from './mechanics/explorer/simulate.js'
import { flyerConfigSchema, flyerContentSchema, FLYER_SPRITE_SLOTS } from './mechanics/flyer/schema.js'
import { flyerSimulator } from './mechanics/flyer/simulate.js'

/**
 * Every declared mechanic, implemented or not. Typed over `MechanicId`, so adding a
 * 9th id to the closed set is a compile error here until its row exists — the same
 * property the frontend's `MECHANIC_LOADERS` table has.
 */
export const GAME_MECHANICS: Record<MechanicId, MechanicSimSlice | null> = {
  sorter: {
    configSchema: sorterConfigSchema,
    contentSchema: sorterContentSchema,
    // The concrete `Simulator<SorterState>` widens to the erased `Simulator<unknown>`
    // because `Simulator.step`/`init` are declared with METHOD syntax (bivariant) in
    // core/types.ts — see the comment on `GameBots` there. No cast, no `any`.
    simulator: sorterSimulator,
    spriteSlots: SORTER_SPRITE_SLOTS,
  },
  launcher: {
    configSchema: launcherConfigSchema,
    contentSchema: launcherContentSchema,
    simulator: launcherSimulator,
    spriteSlots: LAUNCHER_SPRITE_SLOTS,
  },
  runner: {
    configSchema: runnerConfigSchema,
    contentSchema: runnerContentSchema,
    simulator: runnerSimulator,
    spriteSlots: RUNNER_SPRITE_SLOTS,
  },
  stacker: {
    configSchema: stackerConfigSchema,
    contentSchema: stackerContentSchema,
    simulator: stackerSimulator,
    spriteSlots: STACKER_SPRITE_SLOTS,
  },
  autobattler: {
    configSchema: autobattlerConfigSchema,
    contentSchema: autobattlerContentSchema,
    simulator: autobattlerSimulator,
    spriteSlots: AUTOBATTLER_SPRITE_SLOTS,
  },
  explorer: {
    configSchema: explorerConfigSchema,
    contentSchema: explorerContentSchema,
    simulator: explorerSimulator,
    spriteSlots: EXPLORER_SPRITE_SLOTS,
  },
  defender: {
    configSchema: defenderConfigSchema,
    contentSchema: defenderContentSchema,
    simulator: defenderSimulator,
    spriteSlots: DEFENDER_SPRITE_SLOTS,
  },
  flyer: {
    configSchema: flyerConfigSchema,
    contentSchema: flyerContentSchema,
    simulator: flyerSimulator,
    spriteSlots: FLYER_SPRITE_SLOTS,
  },
}

/**
 * The headless bots, in a table of their OWN rather than as a member of the slice.
 *
 * `Simulator` deliberately has no `bots` (see `core/types.ts`): while it did, the
 * frontend's `register.ts` — the root of each mechanic's lazy chunk — dragged an optimal
 * player into the JS every child downloads, and `bots.perfect` returns exactly the input
 * log Core replays to grant XP. Arcade is the one process that legitimately needs them:
 * `simulate` is the WINNABILITY GATE, and it cannot prove a game is beatable without
 * playing it perfectly. So the bots live in each mechanic's `bots.ts` and are imported
 * HERE, in a service that never ships a byte to a browser.
 *
 * Keep this table separate from GAME_MECHANICS rather than folding a `bots` field back
 * into `MechanicSimSlice`: Core builds the same slice shape for the reward replay and has
 * no business holding a bot at all, and one shared shape is how the bot would find its
 * way back onto the client.
 */
export const GAME_MECHANIC_BOTS: Record<MechanicId, GameBots<unknown> | null> = {
  // `GameBots<SorterState>` widens to `GameBots<unknown>` because both members are
  // declared with METHOD syntax (bivariant) in core/types.ts. No cast, no `any`.
  sorter: sorterBots,
  launcher: launcherBots,
  runner: runnerBots,
  stacker: stackerBots,
  autobattler: autobattlerBots,
  explorer: explorerBots,
  defender: defenderBots,
  flyer: flyerBots,
}

/** Narrows an arbitrary string (a catalog `mechanic` value) to a declared id. */
export function isMechanicId(id: string): id is MechanicId {
  return (MECHANIC_IDS as readonly string[]).includes(id)
}

/**
 * The simulation slice for a mechanic id, or `null` when this release cannot play it
 * (unknown id, or declared with no implementation yet). NEVER throws: the caller — the
 * `simulate` winnability gate — turns `null` into a slot failure, which is the correct
 * answer for a document Arcade cannot bot-play. Publishing it unverified instead would
 * be the exact hole the gate exists to close.
 */
export function getMechanic(id: string): MechanicSimSlice | null {
  if (!isMechanicId(id)) return null
  return GAME_MECHANICS[id]
}

/**
 * The bots for a mechanic id, or `null` when this release has none. Same contract and
 * same non-throwing degradation as `getMechanic`, and the caller must treat `null` the
 * same way: no bots means the winnability gate cannot run, which means the document MUST
 * NOT be published.
 */
export function getMechanicBots(id: string): GameBots<unknown> | null {
  if (!isMechanicId(id)) return null
  return GAME_MECHANIC_BOTS[id]
}
