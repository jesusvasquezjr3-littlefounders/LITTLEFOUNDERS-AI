import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { stringify } from 'yaml';
import { planShards, assessShardOutcome, runTrack } from '../pipeline/track.js';
import type { RunSummary } from '../pipeline/run.js';
import type { LoadedAdventure } from '../catalog/loader.js';

/*
 * generate:track — the mass-run coordinator. Pure policy (assessShardOutcome)
 * plus the shard loop with an injected `generate`, so nothing here spends a
 * token. Every case encodes a rule from the 2026-07-26 orchestration review:
 * budgets must compose globally, fatal errors halt the track, unattempted work
 * is resumed (never skipped), and stubborn failures go to mop-up.
 */

function summary(over: Partial<RunSummary> = {}): RunSummary {
  return {
    runId: 'r',
    published: ['a/s/t/l1'],
    failed: [],
    dryRun: [],
    skipped: [],
    alreadyDone: [],
    notAttempted: [],
    slotsEnumerated: 1,
    fatalProviderError: null,
    imagesGenerated: 1,
    imagesBilled: 1,
    imagesInherited: 0,
    imageSkipReasons: [],
    salvagedSlots: [],
    stoppedOnBudget: false,
    tokensUsed: 1000,
    usdUsed: 0.5,
    cachedTokens: 400,
    ...over,
  };
}

describe('assessShardOutcome — the resume-vs-advance policy', () => {
  it('halts on a fatal provider error, whatever else the summary says', () => {
    const v = assessShardOutcome(summary({ fatalProviderError: '402 Insufficient Balance' }), 1, 3);
    expect(v.action).toBe('halt');
  });

  it('halts when EVERY enumerated slot failed — systemic, not lesson-level', () => {
    const v = assessShardOutcome(
      summary({ published: [], failed: [{ slotId: 'a', error: 'x' }, { slotId: 'b', error: 'y' }], slotsEnumerated: 2 }),
      1,
      3,
    );
    expect(v.action).toBe('halt');
  });

  it('advances cleanly when everything published', () => {
    const v = assessShardOutcome(summary(), 1, 3);
    expect(v).toEqual({ action: 'advance', deficit: [] });
  });

  it('retries while passes remain and the last pass made progress (unattempted work)', () => {
    const v = assessShardOutcome(summary({ notAttempted: ['a/s/t/l9'] }), 1, 3);
    expect(v.action).toBe('retry');
  });

  it('retries a budget-stopped pass that still made progress', () => {
    const v = assessShardOutcome(summary({ stoppedOnBudget: true }), 2, 3);
    expect(v.action).toBe('retry');
  });

  it('halts when passes are exhausted with unattempted work — never skips work', () => {
    const v = assessShardOutcome(summary({ notAttempted: ['x'] }), 3, 3);
    expect(v.action).toBe('halt');
  });

  it('halts when the last pass made NO progress and unattempted work remains', () => {
    const v = assessShardOutcome(summary({ published: [], alreadyDone: ['done'], slotsEnumerated: 3, notAttempted: ['x'] }), 2, 3);
    expect(v.action).toBe('halt');
  });

  it('advances past STUBBORN failures (no unattempted work), recording them as the mop-up deficit', () => {
    const v = assessShardOutcome(
      summary({ published: [], alreadyDone: ['a', 'b'], slotsEnumerated: 3, failed: [{ slotId: 'a/s/t/l3', error: 'judge' }] }),
      3,
      3,
    );
    expect(v).toEqual({ action: 'advance', deficit: ['a/s/t/l3'] });
  });
});

describe('planShards', () => {
  it('one shard per adventure with its slot count', () => {
    const adventures = [
      {
        data: {
          adventure: { slug: 'adv-1' },
          sagas: [{ topics: [{ lessons: [{}, {}] }, { lessons: [{}] }] }],
        },
      },
      { data: { adventure: { slug: 'adv-2' }, sagas: [{ topics: [{ lessons: [{}] }] }] } },
    ] as unknown as LoadedAdventure[];
    expect(planShards(adventures)).toEqual([
      { adventureSlug: 'adv-1', slotCount: 3 },
      { adventureSlug: 'adv-2', slotCount: 1 },
    ]);
  });
});

/* ------------------------- runTrack integration (temp course, fake generate) */

function taxonomyFixture() {
  return {
    schema_version: 1,
    themes: ['archipelago'],
    age_tiers: {
      tier1: { ages: '6-7', forbidden_vocabulary: { 'es-MX': ['préstamo'], 'en-US': ['loan'], 'pt-BR': ['empréstimo'] } },
    },
    families: ['story', 'choice', 'money'],
    family_allowlist_by_tier: { tier1: ['story', 'choice', 'money'] },
    type_exceptions: { tier1_extra_allowed: [], tier1_banned_types: [] },
  };
}

function adventureFixture(slug: string, position: number, lessonCount: number) {
  return {
    schema_version: 1,
    adventure: {
      position,
      slug,
      theme: 'archipelago',
      age_tier: 'tier1',
      title: { 'en-US': 'A', 'es-MX': 'A', 'pt-BR': 'A' },
      description: { 'en-US': 'd', 'es-MX': 'd', 'pt-BR': 'd' },
      narrative_arc: 'x',
    },
    sagas: [
      {
        position: 1,
        slug: 'saga-1',
        icon: 'auto_stories',
        title: { 'en-US': 'S', 'es-MX': 'S', 'pt-BR': 'S' },
        description: { 'en-US': 'd', 'es-MX': 'd', 'pt-BR': 'd' },
        topics: [
          {
            position: 1,
            slug: 'topic-1',
            title_es: 'Tema',
            concept: 'x',
            learning_objective: 'x',
            key_vocabulary: ['moneda'],
            prior_knowledge: 'x',
            fact_refs: [],
            lessons: Array.from({ length: lessonCount }, (_, i) => ({
              position: i + 1,
              slug: `lesson-${i + 1}`,
              micro_objective: 'x',
              narrative_beat: 'x',
              difficulty: 1,
              suggested_families: ['story'],
            })),
          },
        ],
      },
    ],
  };
}

let curriculumRoot: string;
let runsRoot: string;

beforeEach(() => {
  curriculumRoot = mkdtempSync(path.join(tmpdir(), 'forge-track-curr-'));
  runsRoot = mkdtempSync(path.join(tmpdir(), 'forge-track-runs-'));
  const courseDir = path.join(curriculumRoot, 'test-course');
  mkdirSync(path.join(courseDir, 'adventures'), { recursive: true });
  writeFileSync(path.join(courseDir, 'taxonomy.yaml'), stringify(taxonomyFixture()));
  writeFileSync(
    path.join(courseDir, 'facts.yaml'),
    stringify({ schema_version: 1, facts: { 'mxn.denominations.coins': { value: [1, 2, 5], unit: 'MXN', verified: true } } }),
  );
  writeFileSync(
    path.join(courseDir, 'catalog.yaml'),
    stringify({
      schema_version: 1,
      course: {
        slug: 'test-course',
        badge_asset: 'course-badges/test-course.png',
        subject: 'money',
        title: { 'en-US': 'T', 'es-MX': 'P', 'pt-BR': 'T' },
        description: { 'en-US': 'd', 'es-MX': 'd', 'pt-BR': 'd' },
        authoring_locale: 'es-MX',
      },
      adventures: [{ file: 'adventures/01-a.yaml' }, { file: 'adventures/02-b.yaml' }],
    }),
  );
  writeFileSync(path.join(courseDir, 'adventures/01-a.yaml'), stringify(adventureFixture('adv-one', 1, 2)));
  writeFileSync(path.join(courseDir, 'adventures/02-b.yaml'), stringify(adventureFixture('adv-two', 2, 3)));
});

afterEach(() => {
  rmSync(curriculumRoot, { recursive: true, force: true });
  rmSync(runsRoot, { recursive: true, force: true });
});

const baseOptions = () => ({
  course: 'test-course',
  trackId: 'trk',
  curriculumRoot,
  runsRoot,
});

describe('runTrack', () => {
  it('rejects a partial locale set before invoking a shard generator', async () => {
    const generate = vi.fn();
    await expect(runTrack({ ...baseOptions(), locales: ['es-MX'] }, { generate: generate as never }))
      .rejects.toThrow(/exactly en-US, es-MX, pt-BR/);
    expect(generate).not.toHaveBeenCalled();
  });

  it('runs the shards sequentially, passes the REMAINING budget down, and writes the report', async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce(summary({ runId: 'trk--adv-one', published: ['a', 'b'], slotsEnumerated: 2, usdUsed: 3 }))
      .mockResolvedValueOnce(summary({ runId: 'trk--adv-two', published: ['c', 'd', 'e'], slotsEnumerated: 3, usdUsed: 4 }));

    const report = await runTrack({ ...baseOptions(), budgetUsd: 10 }, { generate: generate as never });

    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[0]?.[0]).toMatchObject({ runId: 'trk--adv-one', slots: ['adv-one'], maxUsdOverride: 10 });
    // Shard 2 sees the budget MINUS shard 1's spend — the floors can never compose.
    expect(generate.mock.calls[1]?.[0]).toMatchObject({ runId: 'trk--adv-two', slots: ['adv-two'], maxUsdOverride: 7 });
    expect(report.halted).toBeNull();
    expect(report.totals.published).toBe(5);
    expect(report.totals.usd).toBe(7);
    expect(report.shards).toHaveLength(2);

    const onDisk = JSON.parse(readFileSync(path.join(runsRoot, 'trk', 'track-report.json'), 'utf8')) as typeof report;
    expect(onDisk.trackId).toBe('trk');
    expect(onDisk.totals.published).toBe(5);
  });

  it('skips a named shard entirely via --skip-shards — not attempted, not in the report (operator escape hatch for stubborn residuals surviving a redeploy)', async () => {
    const generate = vi.fn().mockResolvedValueOnce(summary({ runId: 'trk--adv-two', published: ['c'], slotsEnumerated: 3, usdUsed: 4 }));

    const report = await runTrack({ ...baseOptions(), skipShards: ['adv-one'] }, { generate: generate as never });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[0]?.[0]).toMatchObject({ runId: 'trk--adv-two', slots: ['adv-two'] });
    expect(report.shards).toHaveLength(1);
    expect(report.shards[0]?.adventure).toBe('adv-two');
  });

  it('halts the track on a fatal provider error — the next shard is never started', async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce(summary({ published: [], failed: [], slotsEnumerated: 2, fatalProviderError: '402 Insufficient Balance' }));

    const report = await runTrack(baseOptions(), { generate: generate as never });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(report.halted).toContain('fatal provider error');
    expect(report.shards).toHaveLength(1);
  });

  it('stops before a shard when the cumulative spend has exhausted the global budget', async () => {
    const generate = vi.fn().mockResolvedValueOnce(summary({ published: ['a', 'b'], slotsEnumerated: 2, usdUsed: 12 }));

    const report = await runTrack({ ...baseOptions(), budgetUsd: 10 }, { generate: generate as never });
    expect(generate).toHaveBeenCalledTimes(1); // shard 2 never invoked
    expect(report.halted).toContain('budget exhausted');
  });

  it('re-invokes the SAME run-id while a shard has unattempted work and is progressing', async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce(summary({ published: ['a'], notAttempted: ['x'], slotsEnumerated: 2, usdUsed: 1 }))
      .mockResolvedValueOnce(summary({ published: ['x'], alreadyDone: ['a'], slotsEnumerated: 2, usdUsed: 1.5 }))
      .mockResolvedValueOnce(summary({ published: ['c', 'd', 'e'], slotsEnumerated: 3, usdUsed: 1 }));

    const report = await runTrack(baseOptions(), { generate: generate as never });
    expect(generate).toHaveBeenCalledTimes(3);
    expect(generate.mock.calls[0]?.[0]).toMatchObject({ runId: 'trk--adv-one' });
    expect(generate.mock.calls[1]?.[0]).toMatchObject({ runId: 'trk--adv-one' }); // resume, same run-id
    expect(generate.mock.calls[2]?.[0]).toMatchObject({ runId: 'trk--adv-two' });
    expect(report.halted).toBeNull();
    // Shard 1's spend is counted ONCE (the final pass's cumulative ledger), not per-pass.
    expect(report.shards[0]?.usd).toBe(1.5);
    expect(report.totals.usd).toBe(2.5);
  });

  it('advances past stubborn failures into the mop-up list and aggregates the failure heatmap by stage', async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce(
        summary({
          published: ['a'],
          failed: [{ slotId: 'adv-one/saga-1/topic-1/lesson-2', error: 'judge gate failed', failedFrom: 'written' }],
          slotsEnumerated: 2,
        }),
      )
      .mockResolvedValueOnce(summary({ published: ['c', 'd', 'e'], slotsEnumerated: 3 }));

    const report = await runTrack({ ...baseOptions(), shardPasses: 1 }, { generate: generate as never });
    expect(report.halted).toBeNull();
    expect(report.mopUp).toEqual(['adv-one/saga-1/topic-1/lesson-2']);
    expect(report.failureHeatmap).toEqual({ written: 1 });
  });
});
