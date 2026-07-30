// backend/src/game-contract/ — the parity copy's own regression suite.
//
// WHAT THIS PROVES AND WHAT IT DOES NOT. That the copy is byte-equivalent to
// frontend/src/game-engine is proved by `npm run game-contract:check`, not here.
// What THIS file proves is the property the reward path actually depends on: that
// replaying a recorded input log through the copied simulator reproduces, exactly,
// the result the run produced — same score, same stats, every time, from a fixed
// seed. If that ever stops holding, Core under-pays or rejects honest children.
//
// The documents below are INLINE on purpose. `frontend/` is not a dependency of
// `backend/` (no workspaces), so importing the frontend fixtures would be both
// impossible at build time and a lie about what Core can reach; their config/content
// VALUES are transcribed instead. They satisfy the production schemas unmodified
// (§1.14: a fixture never gets a relaxed schema) and carry curriculum content only —
// no child, no PII (§1.9).

import { describe, expect, it } from 'vitest';

import { replayGame, runBot } from '../game-contract/core/replay.js';
import type { GameDocument, GameInputEvent } from '../game-contract/core/types.js';
import { MECHANIC_IDS } from '../game-contract/core/types.js';
import { GAME_MECHANICS, getMechanic, isMechanicId } from '../game-contract/registry.js';
import {
  sorterConfigSchema,
  sorterContentSchema,
} from '../game-contract/mechanics/sorter/schema.js';
import { sorterSimulator } from '../game-contract/mechanics/sorter/simulate.js';
import { sorterBots } from '../game-contract/mechanics/sorter/bots.js';
import {
  runnerConfigSchema,
  runnerContentSchema,
} from '../game-contract/mechanics/runner/schema.js';
import { runnerSimulator } from '../game-contract/mechanics/runner/simulate.js';
import { runnerBots } from '../game-contract/mechanics/runner/bots.js';
import {
  launcherConfigSchema,
  launcherContentSchema,
} from '../game-contract/mechanics/launcher/schema.js';
import { launcherSimulator } from '../game-contract/mechanics/launcher/simulate.js';
import { launcherBots } from '../game-contract/mechanics/launcher/bots.js';
import {
  stackerConfigSchema,
  stackerContentSchema,
} from '../game-contract/mechanics/stacker/schema.js';
import { stackerSimulator } from '../game-contract/mechanics/stacker/simulate.js';
import { stackerBots } from '../game-contract/mechanics/stacker/bots.js';
import {
  defenderConfigSchema,
  defenderContentSchema,
} from '../game-contract/mechanics/defender/schema.js';
import { defenderSimulator } from '../game-contract/mechanics/defender/simulate.js';
import { defenderBots } from '../game-contract/mechanics/defender/bots.js';
import {
  autobattlerConfigSchema,
  autobattlerContentSchema,
} from '../game-contract/mechanics/autobattler/schema.js';
import { autobattlerSimulator } from '../game-contract/mechanics/autobattler/simulate.js';
import { autobattlerBots } from '../game-contract/mechanics/autobattler/bots.js';
import {
  explorerConfigSchema,
  explorerContentSchema,
} from '../game-contract/mechanics/explorer/schema.js';
import { explorerSimulator } from '../game-contract/mechanics/explorer/simulate.js';
import { explorerBots } from '../game-contract/mechanics/explorer/bots.js';
import { flyerConfigSchema, flyerContentSchema } from '../game-contract/mechanics/flyer/schema.js';
import { flyerSimulator } from '../game-contract/mechanics/flyer/simulate.js';
import { flyerBots } from '../game-contract/mechanics/flyer/bots.js';
import {
  AUTOBATTLER_DOCUMENT,
  AUTOBATTLER_MAX_TICKS,
  DEFENDER_DOCUMENT,
  DEFENDER_MAX_TICKS,
  EXPLORER_DOCUMENT,
  EXPLORER_MAX_TICKS,
  FLYER_DOCUMENT,
  FLYER_MAX_TICKS,
  LAUNCHER_DOCUMENT,
  LAUNCHER_MAX_TICKS,
  STACKER_DOCUMENT,
  STACKER_MAX_TICKS,
} from './gameContractFixtures.js';

/** Fixed for every replay here: a seed is what makes the run reproducible at all. */
const SEED = 20260730;

// ---- Inline sorter document (tier 1, cheer, static tray) -----------------------

const SORTER_DOCUMENT: GameDocument = {
  schema_version: 1,
  meta: {
    slug: 'necesito-o-quiero',
    title: 'Necesito o quiero',
    locale: 'es-MX',
    mechanic: 'sorter',
    concept: {
      topic_path: 'mi-primer-dinero/decidir-con-calma/necesidades-y-deseos',
      recap_md:
        'Una **necesidad** es algo sin lo que no puedes estar bien; un **deseo** te gusta pero puede esperar.',
    },
    tier: 1,
    estimated_minutes: 3,
    cast: ['dina'],
  },
  skin: { palette: 'forest-pear', sprites: {}, sfx: { correct: 'correct', place: 'drop' } },
  config: {
    mode: 'static',
    category_count: 2,
    field: { width: 900, height: 540, lanes: 3, item_size: 132 },
    ladder: [
      {
        spawn_interval_ticks: 2,
        fall_speed: 0,
        speed_variance: 0,
        max_active: 6,
        item_tiers: [1],
        points_per_correct: 5,
      },
      {
        spawn_interval_ticks: 2,
        fall_speed: 0,
        speed_variance: 0,
        max_active: 6,
        item_tiers: [1, 2],
        points_per_correct: 7,
      },
    ],
    level_up: { correct_per_level: 6 },
    combo: { step: 3, max: 3 },
    penalty: {
      wrong_drop: { score_pct: 4, lives: 0, combo_reset: true, return_item: true },
      miss: { score_pct: 0, lives: 0, combo_reset: false },
    },
    trash_zone: true,
    repeat_items: false,
    initial_fill: 6,
    round: { target_correct: 10, target_points: 90, tick_budget: 2400 },
    score_weights: { accuracy: 0.5, progress: 0.3, points: 0.2 },
  },
  content: {
    categories: [
      { id: 'necesito', label_md: 'Necesito', description_md: 'Cosas sin las que no estoy bien.' },
      { id: 'quiero', label_md: 'Quiero', description_md: 'Cosas que me gustan y pueden esperar.' },
    ],
    items: [
      { id: 'agua', label_md: 'Agua para tomar', category: 'necesito', icon: 'water_drop', tier: 1 },
      { id: 'lonche', label_md: 'El lonche de la escuela', category: 'necesito', icon: 'restaurant', tier: 1 },
      { id: 'medicina', label_md: 'La medicina del doctor', category: 'necesito', icon: 'medical_services', tier: 1 },
      { id: 'cuaderno', label_md: 'Un cuaderno para la tarea', category: 'necesito', icon: 'menu_book', tier: 1 },
      { id: 'videojuego', label_md: 'Un videojuego nuevo', category: 'quiero', icon: 'videogame_asset', tier: 1 },
      { id: 'dulces', label_md: 'Dulces de la tiendita', category: 'quiero', icon: 'cake', tier: 1 },
      { id: 'juguete', label_md: 'Otro juguete igual al que tengo', category: 'quiero', icon: 'toys', tier: 1 },
      { id: 'cine', label_md: 'Un boleto para el cine', category: 'quiero', icon: 'movie', tier: 1 },
      {
        id: 'dia-soleado',
        label_md: 'Un dia soleado',
        icon: 'sunny',
        tier: 1,
        misconception_md: 'No se compra ni se paga, asi que no cabe en ninguna de las dos cajas.',
      },
      {
        id: 'abrazo',
        label_md: 'Un abrazo de tu familia',
        icon: 'volunteer_activism',
        tier: 1,
        misconception_md: 'Es gratis y no se vende: no es un gasto, es algo que ya tienes.',
      },
    ],
    feedback: {
      correct_md: ['Esa va justo ahi.', 'Lo pensaste bien.'],
      incorrect_md: ['Casi. Piensa que pasa si no lo tienes.'],
      results_md: 'Separar lo que necesito de lo que quiero es el primer paso para decidir mi dinero.',
    },
  },
  scoring: { mode: 'cheer', xp_max: 10, pass_score: 60, lives: null, target: 10 },
};

const SORTER_MAX_TICKS = 2400;

// ---- Inline runner document (tier 1, cheer, single jump) -----------------------

const RUNNER_DOCUMENT: GameDocument = {
  schema_version: 1,
  meta: {
    slug: 'carrera-necesidad-o-deseo',
    title: 'Carrera: necesidad o deseo',
    locale: 'es-MX',
    mechanic: 'runner',
    concept: {
      topic_path: 'dinero-basico/necesidades-y-deseos/necesidad-o-deseo',
      recap_md: 'Toma las necesidades y deja pasar los deseos mientras corres el mercado.',
    },
    tier: 1,
    estimated_minutes: 2,
    cast: ['dina'],
  },
  skin: { palette: 'navy-papaya', sprites: {}, sfx: { collect: 'collect', crash: 'impact' } },
  config: {
    world: { width: 900, height: 540, ground_y: 420, avatar_x: 140, avatar_w: 56, avatar_h: 72 },
    action: {
      model: 'jump',
      jump: { dir: 1, impulse: 15, gravity: 1, max_jumps: 1 },
      hold: { enabled: false, glide_gravity: 0, max_hold_ticks: 0 },
    },
    speed: {
      phases: [
        { from_tick: 0, units_per_tick: 6 },
        { from_tick: 300, units_per_tick: 8 },
        { from_tick: 600, units_per_tick: 10 },
      ],
    },
    spawn: {
      lead_units: 200,
      min_gap_units: 140,
      max_gap_units: 240,
      patterns: [
        {
          id: 'hurdle',
          weight: 5,
          length_units: 320,
          elements: [
            { role: 'obstacle', dx: 0, y: 360, w: 44, h: 60, variant: 'static' },
            { role: 'good', dx: 20, y: 280, w: 40, h: 40, variant: 'moving', amplitude: 16, period_ticks: 24 },
            { role: 'good', dx: 280, y: 380, w: 40, h: 40, variant: 'static' },
          ],
        },
        {
          id: 'want-trap',
          weight: 4,
          length_units: 320,
          elements: [
            { role: 'bad', dx: 0, y: 360, w: 44, h: 60, variant: 'static' },
            { role: 'good', dx: 20, y: 280, w: 40, h: 40, variant: 'static' },
            { role: 'good', dx: 280, y: 380, w: 40, h: 40, variant: 'static' },
          ],
        },
      ],
    },
    lives: { policy: 'checkpoint', checkpoint_every_units: 1500, respawn_invulnerable_ticks: 24 },
    scoring: {
      distance_weight: 0.4,
      collect_weight: 0.6,
      collect_points: 10,
      collect_target: 700,
      wrong_penalty_pct: 5,
      crash_penalty_pct: 4,
      combo: { step: 3, max: 4 },
    },
    target_distance: 6000,
    max_ticks: 900,
  },
  content: {
    items: [
      { id: 'agua', label_md: 'Agua', category: 'necesidad', icon: 'water_drop', value: 12, tier: 1 },
      { id: 'frijol', label_md: 'Frijoles', category: 'necesidad', icon: 'restaurant', value: 30, tier: 1 },
      { id: 'cuaderno', label_md: 'Cuaderno', category: 'necesidad', icon: 'menu_book', value: 25, tier: 1 },
      {
        id: 'dulce',
        label_md: 'Dulce extra',
        category: 'deseo',
        icon: 'cake',
        value: 8,
        tier: 1,
        misconception_md: 'Un dulce se antoja, pero no lo necesitas para vivir: es un deseo.',
      },
      {
        id: 'juguete',
        label_md: 'Juguete nuevo',
        category: 'deseo',
        icon: 'toys',
        value: 150,
        tier: 2,
        misconception_md: 'Ya tienes con que jugar: primero van las necesidades.',
      },
    ],
    categories: [
      { id: 'necesidad', label_md: 'Necesidad', description_md: 'Lo que usas para vivir y aprender.' },
      { id: 'deseo', label_md: 'Deseo', description_md: 'Lo que te gusta, pero puede esperar.' },
    ],
    feedback: {
      correct_md: ['Esa si la necesitas.', 'Buena eleccion.'],
      incorrect_md: ['Ese era un deseo, sigue corriendo.'],
      results_md: 'Corriste el mercado eligiendo primero lo que necesitas.',
    },
    roles: { collect: ['agua', 'frijol', 'cuaderno'], avoid: ['dulce', 'juguete'] },
  },
  scoring: { mode: 'cheer', xp_max: 10, pass_score: 65, lives: null, target: 6000 },
};

const RUNNER_MAX_TICKS = 900;

// ---- The suite -----------------------------------------------------------------

describe('game-contract — the copied schemas accept a production document', () => {
  it('parses the sorter document with the production schemas, unmodified', () => {
    expect(sorterConfigSchema.safeParse(SORTER_DOCUMENT.config).success).toBe(true);
    expect(sorterContentSchema.safeParse(SORTER_DOCUMENT.content).success).toBe(true);
  });

  it('parses the runner document with the production schemas, unmodified', () => {
    expect(runnerConfigSchema.safeParse(RUNNER_DOCUMENT.config).success).toBe(true);
    expect(runnerContentSchema.safeParse(RUNNER_DOCUMENT.content).success).toBe(true);
  });

  it('strips nothing a simulator reads — a parsed config round-trips its own fields', () => {
    // Zod strips unknown keys by DEFAULT, which is exactly how a drifted copy deletes a
    // field instead of rejecting it. If this ever fails, the copy is missing a field
    // the frontend authored.
    const parsed = sorterConfigSchema.parse(SORTER_DOCUMENT.config);
    expect(parsed).toEqual(SORTER_DOCUMENT.config);
    const parsedRunner = runnerConfigSchema.parse(RUNNER_DOCUMENT.config);
    expect(parsedRunner).toEqual(RUNNER_DOCUMENT.config);
  });
});

describe('game-contract — replaying a recorded log reproduces the run exactly', () => {
  it('sorter: the perfect bot log replays to an identical result', () => {
    const played = runBot({
      simulator: sorterSimulator,
    bots: sorterBots,
      document: SORTER_DOCUMENT,
      seed: SEED,
      bot: sorterBots.perfect,
      maxTicks: SORTER_MAX_TICKS,
    });

    const replay = replayGame({
      simulator: sorterSimulator,
    bots: sorterBots,
      document: SORTER_DOCUMENT,
      seed: SEED,
      inputLog: played.inputLog,
      maxTicks: SORTER_MAX_TICKS,
      maxEvents: played.inputLog.length,
    });

    expect(replay.ok).toBe(true);
    expect(replay.ok && replay.result).toEqual(played.result);
  });

  it('runner: the perfect bot log replays to an identical result', () => {
    const played = runBot({
      simulator: runnerSimulator,
    bots: runnerBots,
      document: RUNNER_DOCUMENT,
      seed: SEED,
      bot: runnerBots.perfect,
      maxTicks: RUNNER_MAX_TICKS,
    });

    const replay = replayGame({
      simulator: runnerSimulator,
    bots: runnerBots,
      document: RUNNER_DOCUMENT,
      seed: SEED,
      inputLog: played.inputLog,
      maxTicks: RUNNER_MAX_TICKS,
      maxEvents: played.inputLog.length,
    });

    expect(replay.ok).toBe(true);
    expect(replay.ok && replay.result).toEqual(played.result);
  });

  it('replaying the same log twice yields the same result (no hidden state, no clock)', () => {
    const played = runBot({
      simulator: sorterSimulator,
    bots: sorterBots,
      document: SORTER_DOCUMENT,
      seed: SEED,
      bot: sorterBots.perfect,
      maxTicks: SORTER_MAX_TICKS,
    });
    const args = {
      simulator: sorterSimulator,
    bots: sorterBots,
      document: SORTER_DOCUMENT,
      seed: SEED,
      inputLog: played.inputLog,
      maxTicks: SORTER_MAX_TICKS,
      maxEvents: played.inputLog.length,
    };
    expect(replayGame(args)).toEqual(replayGame(args));
  });
});

describe('game-contract — the winnability gate holds server-side', () => {
  it('sorter: perfect passes, random does not', () => {
    const perfect = runBot({
      simulator: sorterSimulator,
    bots: sorterBots,
      document: SORTER_DOCUMENT,
      seed: SEED,
      bot: sorterBots.perfect,
      maxTicks: SORTER_MAX_TICKS,
    });
    expect(perfect.result.finished).toBe(true);
    expect(perfect.result.score).toBeGreaterThanOrEqual(SORTER_DOCUMENT.scoring.pass_score);

    const random = runBot({
      simulator: sorterSimulator,
    bots: sorterBots,
      document: SORTER_DOCUMENT,
      seed: SEED,
      bot: sorterBots.random,
      maxTicks: SORTER_MAX_TICKS,
    });
    expect(random.result.score).toBeLessThan(SORTER_DOCUMENT.scoring.pass_score);
  });

  it('runner: perfect passes, random does not', () => {
    const perfect = runBot({
      simulator: runnerSimulator,
    bots: runnerBots,
      document: RUNNER_DOCUMENT,
      seed: SEED,
      bot: runnerBots.perfect,
      maxTicks: RUNNER_MAX_TICKS,
    });
    expect(perfect.result.score).toBeGreaterThanOrEqual(RUNNER_DOCUMENT.scoring.pass_score);

    const random = runBot({
      simulator: runnerSimulator,
    bots: runnerBots,
      document: RUNNER_DOCUMENT,
      seed: SEED,
      bot: runnerBots.random,
      maxTicks: RUNNER_MAX_TICKS,
    });
    expect(random.result.score).toBeLessThan(RUNNER_DOCUMENT.scoring.pass_score);
  });
});

describe('game-contract — golden replay (the cross-engine regression pin)', () => {
  // These numbers were produced by the copied code at SEED and are pinned so that ANY
  // change to the PRNG, the scoring helpers or a simulator's arithmetic shows up as a
  // failing test rather than as a silently different reward. They are the reason a
  // re-verification of an attempt months later still lands on the same score.
  it('sorter: a fixed seed produces exactly this score and these stats', () => {
    const played = runBot({
      simulator: sorterSimulator,
    bots: sorterBots,
      document: SORTER_DOCUMENT,
      seed: SEED,
      bot: sorterBots.perfect,
      maxTicks: SORTER_MAX_TICKS,
    });
    expect(played.result.score).toBe(100);
    expect(played.result.stats).toEqual({
      correct: 10,
      wrong: 0,
      missed: 0,
      avoided: 0,
      best_combo: 10,
      points: 129,
      accuracy: 100,
      level: 2,
      ticks: 8,
    });
    // 6 from the initial tray on tick 0, then one per spawn until target_correct.
    expect(played.inputLog.length).toBe(10);
  });

  it('runner: a fixed seed produces exactly this score and these stats', () => {
    const played = runBot({
      simulator: runnerSimulator,
    bots: runnerBots,
      document: RUNNER_DOCUMENT,
      seed: SEED,
      bot: runnerBots.perfect,
      maxTicks: RUNNER_MAX_TICKS,
    });
    expect(played.result.score).toBe(96);
    expect(played.result.stats).toEqual({
      distance: 6000,
      collected: 21,
      missed: 0,
      wrong: 0,
      crashes: 0,
      points: 660,
      combo_best: 21,
      acts: 11,
      ticks: 780,
      reached_target: 1,
    });
  });
});

describe('game-contract — a forged log is refused, not scored', () => {
  const base = {
    simulator: sorterSimulator,
    bots: sorterBots,
    document: SORTER_DOCUMENT,
    seed: SEED,
    maxTicks: SORTER_MAX_TICKS,
  };

  it('refuses an action the mechanic does not declare', () => {
    const log: GameInputEvent[] = [{ tick: 0, action: 'teleport', n: 1 }];
    expect(replayGame({ ...base, inputLog: log })).toEqual({ ok: false, reason: 'unknown_action' });
  });

  it('refuses a log whose ticks go backwards', () => {
    const log: GameInputEvent[] = [
      { tick: 5, action: 'place', slot: 'necesito', n: 1 },
      { tick: 2, action: 'place', slot: 'necesito', n: 2 },
    ];
    expect(replayGame({ ...base, inputLog: log })).toEqual({ ok: false, reason: 'tick_out_of_order' });
  });

  it('refuses a log past the tick ceiling', () => {
    const log: GameInputEvent[] = [{ tick: SORTER_MAX_TICKS + 1, action: 'place', slot: 'necesito', n: 1 }];
    expect(replayGame({ ...base, inputLog: log })).toEqual({ ok: false, reason: 'tick_after_max' });
  });

  it('refuses a log longer than the authored event cap', () => {
    const log: GameInputEvent[] = [
      { tick: 0, action: 'place', slot: 'necesito', n: 1 },
      { tick: 0, action: 'place', slot: 'necesito', n: 2 },
    ];
    expect(replayGame({ ...base, inputLog: log, maxEvents: 1 })).toEqual({
      ok: false,
      reason: 'log_too_long',
    });
  });

  it('refuses a non-finite coordinate rather than letting NaN into the score', () => {
    const log: GameInputEvent[] = [{ tick: 0, action: 'place', slot: 'necesito', n: 1, x: Number.NaN }];
    expect(replayGame({ ...base, inputLog: log })).toEqual({ ok: false, reason: 'non_finite_payload' });
  });

  it('scores an empty log at zero instead of throwing', () => {
    const outcome = replayGame({ ...base, inputLog: [] });
    expect(outcome.ok).toBe(true);
    expect(outcome.ok && outcome.result.score).toBe(0);
  });
});

describe('game-contract — the synchronous registry', () => {
  it('carries a row for every declared mechanic', () => {
    expect(Object.keys(GAME_MECHANICS).sort()).toEqual([...MECHANIC_IDS].sort());
  });

  it('resolves the implemented mechanics to their simulator', () => {
    expect(getMechanic('sorter')?.simulator).toBe(sorterSimulator);
    expect(getMechanic('runner')?.simulator).toBe(runnerSimulator);
    expect(getMechanic('launcher')?.simulator).toBe(launcherSimulator);
    expect(getMechanic('stacker')?.simulator).toBe(stackerSimulator);
    expect(getMechanic('defender')?.simulator).toBe(defenderSimulator);
    expect(getMechanic('autobattler')?.simulator).toBe(autobattlerSimulator);
    expect(getMechanic('explorer')?.simulator).toBe(explorerSimulator);
    expect(getMechanic('flyer')?.simulator).toBe(flyerSimulator);
  });

  it('resolves EVERY declared mechanic — no reward path is missing its simulator', () => {
    // The whole closed set is implemented as of this batch. A `null` row here would
    // mean every attempt at that mechanic is refused in production, so assert the
    // absence of holes directly rather than trusting the row-count check above.
    for (const id of MECHANIC_IDS) {
      expect(getMechanic(id), `mechanic "${id}" has no server-side simulator`).not.toBeNull();
    }
  });

  it('answers null — never throws — for an unknown mechanic', () => {
    // Forward compatibility: a document naming a mechanic this release does not know
    // must degrade to a refusal the route turns into an envelope error, never a 500.
    expect(getMechanic('not-a-mechanic')).toBeNull();
    expect(isMechanicId('sorter')).toBe(true);
    expect(isMechanicId('not-a-mechanic')).toBe(false);
  });

  it('declares sprite slots the document schema can check skin.sprites against', () => {
    const sorter = getMechanic('sorter');
    expect(sorter?.spriteSlots).toContain('bin_1');
    expect(getMechanic('runner')?.spriteSlots).toContain('avatar');
    expect(getMechanic('launcher')?.spriteSlots).toContain('projectile');
    expect(getMechanic('stacker')?.spriteSlots).toContain('piece_1');
    expect(getMechanic('defender')?.spriteSlots).toContain('tower_single');
    expect(getMechanic('autobattler')?.spriteSlots).toContain('board');
    expect(getMechanic('explorer')?.spriteSlots).toContain('map');
    expect(getMechanic('flyer')?.spriteSlots).toContain('mount');
  });
});

// ---- The three mechanics added after the first parity batch ---------------------
//
// Same three properties the sorter/runner suites above assert, expressed once per
// mechanic through a table: the copied schemas accept the production document with no
// relaxation and strip nothing from it; the perfect bot's recorded log replays to a
// byte-identical result; the winnability gate (perfect passes, random does not) holds
// on the server side too. A mechanic missing from `backend/src/game-contract/` fails
// every reward for that mechanic in production, so each one gets its own row here.

const LATER_MECHANICS = [
  {
    name: 'launcher',
    simulator: launcherSimulator,
    bots: launcherBots,
    document: LAUNCHER_DOCUMENT,
    maxTicks: LAUNCHER_MAX_TICKS,
    configSchema: launcherConfigSchema,
    contentSchema: launcherContentSchema,
  },
  {
    name: 'stacker',
    simulator: stackerSimulator,
    bots: stackerBots,
    document: STACKER_DOCUMENT,
    maxTicks: STACKER_MAX_TICKS,
    configSchema: stackerConfigSchema,
    contentSchema: stackerContentSchema,
  },
  {
    name: 'defender',
    simulator: defenderSimulator,
    bots: defenderBots,
    document: DEFENDER_DOCUMENT,
    maxTicks: DEFENDER_MAX_TICKS,
    configSchema: defenderConfigSchema,
    contentSchema: defenderContentSchema,
  },
  {
    name: 'autobattler',
    simulator: autobattlerSimulator,
    bots: autobattlerBots,
    document: AUTOBATTLER_DOCUMENT,
    maxTicks: AUTOBATTLER_MAX_TICKS,
    configSchema: autobattlerConfigSchema,
    contentSchema: autobattlerContentSchema,
  },
  {
    name: 'explorer',
    simulator: explorerSimulator,
    bots: explorerBots,
    document: EXPLORER_DOCUMENT,
    maxTicks: EXPLORER_MAX_TICKS,
    configSchema: explorerConfigSchema,
    contentSchema: explorerContentSchema,
  },
  {
    name: 'flyer',
    simulator: flyerSimulator,
    bots: flyerBots,
    document: FLYER_DOCUMENT,
    maxTicks: FLYER_MAX_TICKS,
    configSchema: flyerConfigSchema,
    contentSchema: flyerContentSchema,
  },
] as const;

describe.each(LATER_MECHANICS)(
  'game-contract — $name (parity copy)',
  ({ name, simulator, bots, document, maxTicks, configSchema, contentSchema }) => {
    it('parses the production document with the copied schemas, unmodified', () => {
      expect(configSchema.safeParse(document.config).success).toBe(true);
      expect(contentSchema.safeParse(document.content).success).toBe(true);
    });

    it('strips nothing the simulator reads — the parsed config round-trips', () => {
      // Zod strips unknown keys by DEFAULT. A field the frontend authored and this copy
      // lacks is therefore DELETED here rather than rejected, and the replay then scores
      // a document the child never played. This is the assertion that catches it.
      expect(configSchema.parse(document.config)).toEqual(document.config);
      expect(contentSchema.parse(document.content)).toEqual(document.content);
    });

    it('names the mechanic it is registered under', () => {
      expect(simulator.mechanic).toBe(name);
      expect(getMechanic(name)?.simulator).toBe(simulator);
    });

    it('replays the perfect bot log to an identical result', () => {
      const played = runBot({
        simulator,
        document,
        seed: SEED,
        bot: bots.perfect,
        maxTicks,
      });

      const replay = replayGame({
        simulator,
        document,
        seed: SEED,
        inputLog: played.inputLog,
        maxTicks,
        maxEvents: played.inputLog.length,
      });

      expect(replay.ok).toBe(true);
      expect(replay.ok && replay.result).toEqual(played.result);
    });

    it('replays the same log twice to the same result (no hidden state, no clock)', () => {
      const played = runBot({
        simulator,
        document,
        seed: SEED,
        bot: bots.perfect,
        maxTicks,
      });
      const args = {
        simulator,
        document,
        seed: SEED,
        inputLog: played.inputLog,
        maxTicks,
        maxEvents: played.inputLog.length,
      };
      expect(replayGame(args)).toEqual(replayGame(args));
    });

    it('holds the winnability gate: perfect passes, random does not', () => {
      const perfect = runBot({
        simulator,
        document,
        seed: SEED,
        bot: bots.perfect,
        maxTicks,
      });
      expect(perfect.result.finished).toBe(true);
      expect(perfect.result.score).toBeGreaterThanOrEqual(document.scoring.pass_score);

      const random = runBot({
        simulator,
        document,
        seed: SEED,
        bot: bots.random,
        maxTicks,
      });
      expect(random.result.score).toBeLessThan(document.scoring.pass_score);
    });

    it('refuses a forged action instead of scoring it', () => {
      const log: GameInputEvent[] = [{ tick: 0, action: 'teleport', n: 1 }];
      expect(replayGame({ simulator, document, seed: SEED, inputLog: log, maxTicks })).toEqual({
        ok: false,
        reason: 'unknown_action',
      });
    });
  },
);

describe('game-contract — golden replay for the later mechanics', () => {
  // Pinned exactly as the sorter/runner goldens above: these numbers came out of THIS
  // copy at SEED, so any change to the PRNG, the scoring helpers or a simulator's
  // arithmetic surfaces as a failing test rather than as a silently different reward
  // for a child. Re-verifying an attempt months later must land on the same score.
  it('launcher: a fixed seed produces exactly this score and these stats', () => {
    const played = runBot({
      simulator: launcherSimulator,
    bots: launcherBots,
      document: LAUNCHER_DOCUMENT,
      seed: SEED,
      bot: launcherBots.perfect,
      maxTicks: LAUNCHER_MAX_TICKS,
    });
    expect(played.result.score).toBe(90);
    expect(played.result.stats).toEqual({
      shots_fired: 4,
      shots_budget: 9,
      shots_left: 3,
      correct_hits: 4,
      incorrect_hits: 0,
      targets_destroyed: 4,
      targets_total: 4,
      misses: 0,
      useful_bounces: 0,
      points: 84,
      combo_best: 2,
      rounds_cleared: 2,
      ticks: 111,
    });
    // One `launch` per target: the aim is carried on the launch event itself.
    expect(played.inputLog.length).toBe(4);
  });

  it('stacker: a fixed seed produces exactly this score and these stats', () => {
    const played = runBot({
      simulator: stackerSimulator,
    bots: stackerBots,
      document: STACKER_DOCUMENT,
      seed: SEED,
      bot: stackerBots.perfect,
      maxTicks: STACKER_MAX_TICKS,
    });
    expect(played.result.score).toBe(86);
    expect(played.result.stats).toEqual({
      pieces: 6,
      placements: 6,
      repositions: 0,
      removals: 0,
      collapses: 0,
      shattered: 0,
      avoid_used: 0,
      spent: 85,
      budget_left: 115,
      height: 254,
      margin_x100: 183,
      hold_ticks: 300,
      won: 1,
      assisted: 0,
      ticks: 576,
    });
    // Six placements plus the single `ready` that ends the build phase.
    expect(played.inputLog.length).toBe(7);
  });

  it('defender: a fixed seed produces exactly this score and these stats', () => {
    const played = runBot({
      simulator: defenderSimulator,
    bots: defenderBots,
      document: DEFENDER_DOCUMENT,
      seed: SEED,
      bot: defenderBots.perfect,
      maxTicks: DEFENDER_MAX_TICKS,
    });
    expect(played.result.score).toBe(100);
    expect(played.result.stats).toEqual({
      killed: 32,
      leaked: 0,
      waves_cleared: 3,
      towers_built: 8,
      walls_built: 0,
      gold_left: 449,
      gold_spent: 205,
      gold_earned: 584,
      gems_left: 0,
      abilities_used: 0,
      blocked_builds: 0,
      defeated: 0,
      ticks: 774,
    });
    expect(played.inputLog.length).toBe(8);
  });

  it('autobattler: a fixed seed produces exactly this score and these stats', () => {
    const played = runBot({
      simulator: autobattlerSimulator,
    bots: autobattlerBots,
      document: AUTOBATTLER_DOCUMENT,
      seed: SEED,
      bot: autobattlerBots.perfect,
      maxTicks: AUTOBATTLER_MAX_TICKS,
    });
    expect(played.result.score).toBe(100);
    expect(played.result.stats).toEqual({
      rounds_won: 6,
      rounds_lost: 0,
      health: 20,
      gold: 29,
      level: 3,
      interest_earned: 15,
      income_earned: 38,
      streak_earned: 15,
      gold_spent: 57,
      refreshes: 10,
      merges: 5,
      items_equipped: 2,
      units_owned: 7,
      ticks: 723,
    });
    expect(played.inputLog.length).toBe(53);
  });

  it('explorer: a fixed seed produces exactly this score and these stats', () => {
    const played = runBot({
      simulator: explorerSimulator,
    bots: explorerBots,
      document: EXPLORER_DOCUMENT,
      seed: SEED,
      bot: explorerBots.perfect,
      maxTicks: EXPLORER_MAX_TICKS,
    });
    expect(played.result.score).toBe(100);
    expect(played.result.stats).toEqual({
      visited: 10,
      nodes: 10,
      exploration_pct: 100,
      abilities: 3,
      collectibles: 2,
      locks_opened: 11,
      currency: 90,
      mastery: 4,
      moves: 13,
      uses: 4,
      rests: 1,
      actions: 26,
      deaths: 0,
      wrong: 0,
      reached_goal: 1,
      ticks: 52,
    });
    expect(played.inputLog.length).toBe(26);
  });

  it('flyer: a fixed seed produces exactly this score and these stats', () => {
    const played = runBot({
      simulator: flyerSimulator,
    bots: flyerBots,
      document: FLYER_DOCUMENT,
      seed: SEED,
      bot: flyerBots.perfect,
      maxTicks: FLYER_MAX_TICKS,
    });
    expect(played.result.score).toBe(84);
    expect(played.result.stats).toEqual({
      distance: 6003,
      collected: 14,
      missed: 0,
      wrong: 1,
      points: 200,
      enemies_downed: 0,
      enemy_points: 0,
      slams: 0,
      shots_fired: 0,
      beam_ticks: 0,
      hits: 0,
      stalls: 0,
      thermal_ticks: 0,
      storm_ticks: 50,
      energy_spent: 219,
      energy_left: 102,
      commands: 29,
      combo_best: 10,
      ticks: 537,
      reached_target: 1,
    });
    expect(played.inputLog.length).toBe(29);
  });
});
