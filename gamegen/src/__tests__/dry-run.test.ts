// THE MOST IMPORTANT TEST IN THIS SERVICE.
//
// `--dry-run` must spend NOTHING and destroy NOTHING (GAME_ENGINE.md §9). The guard
// short-circuits BEFORE all five paid stages (plan, author, judge, localize,
// illustrate), `runGeneration` skips the key check entirely for a dry run, and this
// suite is the structural regression pin: it runs the WHOLE pipeline end to end with
// **every API key deleted from the environment** and a `fetch` that fails the test if
// it is ever called.
//
// If a regression ever moves a paid call above the guard, one of three things fails
// loudly here — the missing-key refusal (`ProviderNotConfiguredError`), the
// `require*Keys()` gate, or the fetch trap. That is the whole point: Forge's first
// dry-run implementation only skipped the final publish, so an operator "validating"
// a large enumeration ran and BILLED the entire generation while the summary claimed
// nothing was paid for.
//
// The second invariant here is destruction: `setSlotState` replaces `data` wholesale,
// so marking an in-progress slot 'dry-run' would WIPE its judge-approved manifest and
// a later real run would silently re-pay plan + author + judge for it. Only PRISTINE
// pending slots may be marked.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { stringify } from 'yaml';

import { runGeneration, namespaceRunId, enumerateSlots, RUN_ID_PREFIX } from '../pipeline/run.js';
import { resetConfigCache } from '../env.js';
import type { RunCheckpoint } from '../pipeline/checkpoint.js';

const COURSE = 'dry-course';
const TOPIC = 'adv-uno/saga-uno/tema-uno';

/** Every variable a paid stage would need. All deleted for this suite. */
const KEY_ENV = [
  'DEEPSEEK_API_KEY',
  'QWEN_API_KEY',
  'PICTUREGEN_URL',
  'PICTUREGEN_INTERNAL_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;
const saved: Record<string, string | undefined> = {};

let curriculumRoot: string;
let coursegenRoot: string;
let runsRoot: string;
let fetchTrap: ReturnType<typeof vi.fn>;

/** The Arcade catalog: two blueprints on one bound topic. */
function writeGameCatalog(root: string): void {
  const dir = path.join(root, COURSE);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, 'games.yaml'),
    stringify({
      schema_version: 1,
      course: COURSE,
      games: [
        {
          topic_path: TOPIC,
          slug: 'reparte-la-mesada',
          mechanic: 'sorter',
          micro_objective: 'Separar lo que necesito de lo que quiero.',
          skin_brief: 'Un mercado de barrio con cajas de madera y luz de tarde.',
          difficulty: 1,
          tier: 1,
        },
        {
          topic_path: TOPIC,
          slug: 'lanza-la-alcancia',
          mechanic: 'launcher',
          micro_objective: 'Guardar una parte antes de gastar.',
          skin_brief: 'Una feria con globos de papel y una alcancia de barro.',
          difficulty: 2,
          tier: 1,
        },
      ],
    }),
  );
}

/** The Forge course the blueprints bind into — cross-catalog validation reads this. */
function writeCourseCatalog(root: string): void {
  const dir = path.join(root, COURSE);
  mkdirSync(path.join(dir, 'adventures'), { recursive: true });
  writeFileSync(
    path.join(dir, 'catalog.yaml'),
    stringify({
      schema_version: 1,
      course: { slug: COURSE, subject: 'money', authoring_locale: 'es-MX' },
      adventures: [{ file: 'adventures/01-a.yaml' }],
    }),
  );
  writeFileSync(
    path.join(dir, 'adventures/01-a.yaml'),
    stringify({
      schema_version: 1,
      adventure: { position: 1, slug: 'adv-uno', age_tier: 'tier1' },
      sagas: [{ position: 1, slug: 'saga-uno', topics: [{ position: 1, slug: 'tema-uno' }] }],
    }),
  );
}

beforeEach(() => {
  for (const key of KEY_ENV) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  resetConfigCache();

  curriculumRoot = mkdtempSync(path.join(tmpdir(), 'arcade-dry-curr-'));
  coursegenRoot = mkdtempSync(path.join(tmpdir(), 'arcade-dry-forge-'));
  runsRoot = mkdtempSync(path.join(tmpdir(), 'arcade-dry-runs-'));
  writeGameCatalog(curriculumRoot);
  writeCourseCatalog(coursegenRoot);

  // ZERO provider calls. Not "no paid calls we know about" — no network at all.
  fetchTrap = vi.fn(() => {
    throw new Error('a --dry-run reached the network');
  });
  vi.stubGlobal('fetch', fetchTrap);
});

afterEach(() => {
  for (const key of KEY_ENV) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  resetConfigCache();
  for (const dir of [curriculumRoot, coursegenRoot, runsRoot]) rmSync(dir, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

function readCheckpoint(runId: string): RunCheckpoint {
  return JSON.parse(readFileSync(path.join(runsRoot, runId, 'checkpoint.json'), 'utf8')) as RunCheckpoint;
}

function dryRunOptions(runId: string) {
  return {
    course: COURSE,
    dryRun: true,
    runId,
    curriculumRoot,
    runsRoot,
    coursegenCurriculumRoot: coursegenRoot,
  };
}

describe('runGeneration --dry-run, with NO API keys in the environment', () => {
  it('completes, marks every pristine slot dry-run, and makes ZERO provider calls', async () => {
    const summary = await runGeneration(dryRunOptions('dry-1'));

    expect(summary.dryRun.sort()).toEqual([`${TOPIC}/lanza-la-alcancia`, `${TOPIC}/reparte-la-mesada`]);
    expect(summary.published).toHaveLength(0);
    expect(summary.failed).toHaveLength(0);
    expect(summary.escalated).toHaveLength(0);
    expect(summary.notAttempted).toHaveLength(0);
    expect(summary.slotsEnumerated).toBe(2);

    // Nothing was paid for, by any meter.
    expect(summary.tokensUsed).toBe(0);
    expect(summary.usdUsed).toBe(0);
    expect(summary.imagesGenerated).toBe(0);
    expect(summary.imagesBilled).toBe(0);
    expect(summary.stoppedOnBudget).toBe(false);
    expect(summary.fatalProviderError).toBeNull();

    // …and nothing was even ASKED for.
    expect(fetchTrap).not.toHaveBeenCalled();
  });

  it("persists the DISTINCT 'dry-run' state, so a real run under the same --run-id still does the work", async () => {
    const summary = await runGeneration(dryRunOptions('dry-2'));

    const checkpoint = readCheckpoint(summary.runId);
    expect(Object.values(checkpoint.slots).map((slot) => slot.state)).toEqual(['dry-run', 'dry-run']);
    // The regression this state exists for: a dry-run marker read as a real publish
    // meant the subsequent real run skipped every slot and published nothing.
    expect(Object.values(checkpoint.slots).every((slot) => slot.state !== 'published')).toBe(true);
    expect(checkpoint.params).toMatchObject({ kind: 'games', course: COURSE });
  });

  it('NEVER clobbers in-progress checkpoint data, and reports a prior publish as alreadyDone', async () => {
    // A seeded mid-run checkpoint: one slot already published, one holding a
    // judge-approved manifest that a naive dry run would overwrite with {dryRun:true}.
    const runId = namespaceRunId('dry-seeded');
    const runDir = path.join(runsRoot, runId);
    mkdirSync(runDir, { recursive: true });
    const judgedData = {
      skeleton: { rounds: 3 },
      documents: { 'es-MX': { meta: { slug: 'lanza-la-alcancia' } } },
      rubric: { kid_safety: 5 },
    };
    writeFileSync(
      path.join(runDir, 'checkpoint.json'),
      JSON.stringify({
        runId,
        course: COURSE,
        startedAt: '2026-07-30T00:00:00.000Z',
        updatedAt: '2026-07-30T00:00:00.000Z',
        params: { kind: 'games', course: COURSE, locales: ['es-MX', 'en-US', 'pt-BR'], noImages: false },
        slots: {
          [`${TOPIC}/reparte-la-mesada`]: {
            slotId: `${TOPIC}/reparte-la-mesada`,
            state: 'published',
            updatedAt: '2026-07-30T00:00:00.000Z',
            data: { publishResult: { gameId: 'game-uuid' } },
          },
          [`${TOPIC}/lanza-la-alcancia`]: {
            slotId: `${TOPIC}/lanza-la-alcancia`,
            state: 'judged',
            updatedAt: '2026-07-30T00:00:00.000Z',
            data: judgedData,
          },
        },
      }),
    );

    const summary = await runGeneration(dryRunOptions('dry-seeded'));

    // A prior publish is alreadyDone — `published` is NEW work only, or a resume pass
    // reports phantom progress.
    expect(summary.published).toHaveLength(0);
    expect(summary.alreadyDone).toEqual([`${TOPIC}/reparte-la-mesada`]);
    // The in-progress slot is counted as validated WITHOUT being marked…
    expect(summary.dryRun).toEqual([`${TOPIC}/lanza-la-alcancia`]);

    // …and its paid, judge-approved work is byte-identical on disk.
    const checkpoint = readCheckpoint(runId);
    expect(checkpoint.slots[`${TOPIC}/lanza-la-alcancia`]).toMatchObject({ state: 'judged', data: judgedData });
    expect(checkpoint.slots[`${TOPIC}/reparte-la-mesada`]?.state).toBe('published');
    expect(fetchTrap).not.toHaveBeenCalled();
  });

  it('still runs the FREE validate stage: an unbound topic_path fails the run before any key is needed', async () => {
    // Orphan games do not exist (GAME_ENGINE.md §8) — and the cross-catalog check is
    // free, so it must fail here, on a keyless machine, not after the first paid call.
    const dir = path.join(curriculumRoot, COURSE);
    const broken = {
      schema_version: 1,
      course: COURSE,
      games: [
        {
          topic_path: 'adv-uno/saga-uno/tema-que-no-existe',
          slug: 'huerfano',
          mechanic: 'sorter',
          micro_objective: 'x',
          skin_brief: 'y',
          difficulty: 1,
          tier: 1,
        },
      ],
    };
    writeFileSync(path.join(dir, 'games.yaml'), stringify(broken));

    await expect(runGeneration(dryRunOptions('dry-3'))).rejects.toThrow(/catalog failed to validate/);
    expect(fetchTrap).not.toHaveBeenCalled();
  });

  it('respects --slots without touching the slots it filtered out', async () => {
    const summary = await runGeneration({
      ...dryRunOptions('dry-4'),
      slots: [`${TOPIC}/reparte-la-mesada`],
    });

    expect(summary.slotsEnumerated).toBe(1);
    expect(summary.dryRun).toEqual([`${TOPIC}/reparte-la-mesada`]);
    expect(Object.keys(readCheckpoint(summary.runId).slots)).toEqual([`${TOPIC}/reparte-la-mesada`]);
  });

  it('is idempotent: a second dry run over the same run id changes nothing', async () => {
    const first = await runGeneration(dryRunOptions('dry-5'));
    const afterFirst = readFileSync(path.join(runsRoot, first.runId, 'checkpoint.json'), 'utf8');

    const second = await runGeneration(dryRunOptions('dry-5'));
    expect(second.dryRun).toHaveLength(2);
    expect(second.published).toHaveLength(0);

    const afterSecond = JSON.parse(
      readFileSync(path.join(runsRoot, second.runId, 'checkpoint.json'), 'utf8'),
    ) as RunCheckpoint;
    // Slot STATES are unchanged (only the updatedAt timestamps may move), and the
    // second pass never re-marks a slot that already carries the dry-run marker.
    expect(Object.values(afterSecond.slots).map((s) => s.state)).toEqual(['dry-run', 'dry-run']);
    expect(JSON.parse(afterFirst)).toMatchObject({ course: COURSE });
    expect(fetchTrap).not.toHaveBeenCalled();
  });
});

describe('run id namespacing', () => {
  it('prefixes an operator-supplied id so it can never collide with a Forge run id', async () => {
    const summary = await runGeneration(dryRunOptions('nightly'));
    expect(summary.runId).toBe(`${RUN_ID_PREFIX}nightly`);
    // Idempotent: a resume with the already-namespaced id resolves to the same dir.
    expect(namespaceRunId(summary.runId)).toBe(summary.runId);
  });
});

describe('enumerateSlots', () => {
  it('is declaration order, and resolves positions without ever duplicating one', () => {
    const slots = enumerateSlots({
      schema_version: 1,
      course: COURSE,
      games: [
        { topic_path: TOPIC, slug: 'b', mechanic: 'sorter', micro_objective: 'x', skin_brief: 'y', difficulty: 1, tier: 1 },
        { topic_path: TOPIC, slug: 'a', mechanic: 'runner', micro_objective: 'x', skin_brief: 'y', difficulty: 1, tier: 1, position: 1 },
        { topic_path: TOPIC, slug: 'c', mechanic: 'flyer', micro_objective: 'x', skin_brief: 'y', difficulty: 1, tier: 1 },
      ],
    });

    expect(slots.map((s) => s.slotId)).toEqual([`${TOPIC}/b`, `${TOPIC}/a`, `${TOPIC}/c`]);
    // `games` carries UNIQUE (topic_id, position): the pinned 1 is reserved, the
    // implicit ones take the next free integers.
    expect(new Set(slots.map((s) => s.position)).size).toBe(3);
    expect(slots.find((s) => s.slotId.endsWith('/a'))?.position).toBe(1);
  });
});
