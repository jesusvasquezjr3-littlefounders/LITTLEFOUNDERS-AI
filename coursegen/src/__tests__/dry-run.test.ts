import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parse as parseYaml, stringify } from 'yaml';
import { resetConfigCache } from '../env.js';
import { runGeneration } from '../pipeline/run.js';
import { FORGE_ILLUSTRATION_STYLE_VERSION } from '../pipeline/illustrationStyle.js';

/*
 * --dry-run must spend NOTHING (2026-07-26 orchestration review). It used to
 * only skip the final publish: plan, write, judge, localize and images all ran
 * and billed first — an operator "validating" a 4,192-slot enumeration would
 * have paid the full generation bill. This suite runs WITHOUT any provider API
 * key in the environment: if a regression ever makes a dry run touch a paid
 * stage again, the provider client's missing-key failure (or the
 * requireGenerationKeys guard) fails the test.
 */

function writeCourse(courseDir: string): void {
  mkdirSync(path.join(courseDir, 'adventures'), { recursive: true });
  writeFileSync(
    path.join(courseDir, 'taxonomy.yaml'),
    stringify({
      schema_version: 1,
      themes: ['archipelago'],
      age_tiers: {
        tier1: { ages: '6-7', forbidden_vocabulary: { 'es-MX': ['préstamo'], 'en-US': ['loan'], 'pt-BR': ['empréstimo'] } },
      },
      families: ['story', 'choice', 'money'],
      family_allowlist_by_tier: { tier1: ['story', 'choice', 'money'] },
      type_exceptions: { tier1_extra_allowed: [], tier1_banned_types: [] },
    }),
  );
  writeFileSync(
    path.join(courseDir, 'facts.yaml'),
    stringify({ schema_version: 1, facts: { 'mxn.denominations.coins': { value: [1, 2, 5], unit: 'MXN', verified: true } } }),
  );
  writeFileSync(
    path.join(courseDir, 'catalog.yaml'),
    stringify({
      schema_version: 1,
      course: {
        slug: 'dry-course',
        badge_asset: 'course-badges/dry-course.png',
        subject: 'money',
        title: { 'en-US': 'T', 'es-MX': 'P', 'pt-BR': 'T' },
        description: { 'en-US': 'd', 'es-MX': 'd', 'pt-BR': 'd' },
        authoring_locale: 'es-MX',
      },
      adventures: [{ file: 'adventures/01-a.yaml' }],
    }),
  );
  writeFileSync(
    path.join(courseDir, 'adventures/01-a.yaml'),
    stringify({
      schema_version: 1,
      adventure: {
        position: 1,
        slug: 'adv-1',
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
              lessons: [
                { position: 1, slug: 'lesson-1', micro_objective: 'x', narrative_beat: 'x', difficulty: 1, suggested_families: ['story'], new_concepts: ['moneda'] },
                { position: 2, slug: 'lesson-2', micro_objective: 'y', narrative_beat: 'y', difficulty: 1, suggested_families: ['story'], new_concepts: [] },
              ],
            },
          ],
        },
      ],
    }),
  );
}

let curriculumRoot: string;
let runsRoot: string;

beforeEach(() => {
  curriculumRoot = mkdtempSync(path.join(tmpdir(), 'forge-dry-curr-'));
  runsRoot = mkdtempSync(path.join(tmpdir(), 'forge-dry-runs-'));
  writeCourse(path.join(curriculumRoot, 'dry-course'));
});

afterEach(() => {
  rmSync(curriculumRoot, { recursive: true, force: true });
  rmSync(runsRoot, { recursive: true, force: true });
});

describe('runGeneration --dry-run', () => {
  it('rejects a partial locale bundle before touching providers or checkpoints', async () => {
    await expect(runGeneration({
      course: 'dry-course',
      locales: ['es-MX'],
      dryRun: true,
      runId: 'partial-locale',
      curriculumRoot,
      runsRoot,
    })).rejects.toThrow(/exactly en-US, es-MX, pt-BR/);
    expect(() => readFileSync(path.join(runsRoot, 'partial-locale', 'checkpoint.json'), 'utf8')).toThrow();
  });

  it('NEVER clobbers in-progress checkpoint data, and reports prior publishes as alreadyDone (not published)', async () => {
    /*
     * The 2026-07-26 adversarial review reproduced both defects: (a) the first
     * dry-run implementation marked EVERY unpublished slot 'dry-run', wiping a
     * reviewed slot's judge-approved documents (setSlotState replaces `data`
     * wholesale) so a later real run silently re-paid plan+write+judge; (b)
     * isSlotDone early-returns used to land in `published`, inflating resume
     * passes with phantom progress. This seeds a mid-run checkpoint and pins
     * both fixes.
     */
    const runDir = path.join(runsRoot, 'dry-seeded');
    mkdirSync(runDir, { recursive: true });
    const reviewedData = { skeleton: { segments: [] }, documents: { 'es-MX': { fake: true } }, rubric: { notes: 'ok' } };
    writeFileSync(
      path.join(runDir, 'checkpoint.json'),
      JSON.stringify({
        runId: 'dry-seeded',
        course: 'dry-course',
        startedAt: '2026-07-26T00:00:00.000Z',
        updatedAt: '2026-07-26T00:00:00.000Z',
        params: { course: 'dry-course', locales: ['es-MX', 'en-US', 'pt-BR'], noImages: false, requireImages: false, register: 'kid' },
        slots: {
          'adv-1/saga-1/topic-1/lesson-1': {
            slotId: 'adv-1/saga-1/topic-1/lesson-1',
            state: 'published',
            updatedAt: '2026-07-26T00:00:00.000Z',
            data: { publishResult: { lessonId: 'x' } },
          },
          'adv-1/saga-1/topic-1/lesson-2': {
            slotId: 'adv-1/saga-1/topic-1/lesson-2',
            state: 'reviewed',
            updatedAt: '2026-07-26T00:00:00.000Z',
            data: reviewedData,
          },
        },
      }),
    );

    const summary = await runGeneration({
      course: 'dry-course',
      dryRun: true,
      runId: 'dry-seeded',
      curriculumRoot,
      runsRoot,
    });

    // Prior publish → alreadyDone (never `published`: that bucket is NEW work only).
    expect(summary.published).toHaveLength(0);
    expect(summary.alreadyDone).toEqual(['adv-1/saga-1/topic-1/lesson-1']);
    expect(summary.dryRun).toEqual(['adv-1/saga-1/topic-1/lesson-2']);

    // The reviewed slot's paid, judge-approved work is UNTOUCHED on disk.
    const checkpoint = JSON.parse(readFileSync(path.join(runDir, 'checkpoint.json'), 'utf8')) as {
      slots: Record<string, { state: string; data?: unknown }>;
    };
    expect(checkpoint.slots['adv-1/saga-1/topic-1/lesson-2']).toMatchObject({ state: 'reviewed', data: reviewedData });
    expect(checkpoint.slots['adv-1/saga-1/topic-1/lesson-1']?.state).toBe('published');
  });

  it('marks every slot dry-run, spends zero, and never demands API keys', async () => {
    const summary = await runGeneration({
      course: 'dry-course',
      dryRun: true,
      runId: 'dry-1',
      requireImages: true,
      curriculumRoot,
      runsRoot,
    });

    expect(summary.dryRun.sort()).toEqual(['adv-1/saga-1/topic-1/lesson-1', 'adv-1/saga-1/topic-1/lesson-2']);
    expect(summary.published).toHaveLength(0);
    expect(summary.failed).toHaveLength(0);
    expect(summary.tokensUsed).toBe(0);
    expect(summary.usdUsed).toBe(0);
    expect(summary.imagesGenerated).toBe(0);

    // The checkpoint records the distinct 'dry-run' state, so a real run under
    // the same --run-id still does the actual work.
    const checkpoint = JSON.parse(readFileSync(path.join(runsRoot, 'dry-1', 'checkpoint.json'), 'utf8')) as {
      slots: Record<string, { state: string }>;
    };
    expect(Object.values(checkpoint.slots).map((s) => s.state)).toEqual(['dry-run', 'dry-run']);
  });
});

describe('Prism style-version handshake at run preflight', () => {
  const HANDSHAKE_ENV_KEYS = ['DEEPSEEK_API_KEY', 'QWEN_API_KEY', 'PICTUREGEN_URL', 'PICTUREGEN_INTERNAL_KEY'] as const;
  let envSnapshot: Record<string, string | undefined>;

  beforeEach(() => {
    envSnapshot = Object.fromEntries(HANDSHAKE_ENV_KEYS.map((k) => [k, process.env[k]]));
    process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';
    process.env.QWEN_API_KEY = 'test-qwen-key';
    process.env.PICTUREGEN_URL = 'https://prism.test:4007';
    process.env.PICTUREGEN_INTERNAL_KEY = 'test-internal-picture-key';
    resetConfigCache();
  });

  afterEach(() => {
    for (const k of HANDSHAKE_ENV_KEYS) {
      if (envSnapshot[k] === undefined) delete process.env[k];
      else process.env[k] = envSnapshot[k];
    }
    resetConfigCache();
    vi.unstubAllGlobals();
  });

  function healthEnvelope(styleVersion: string): Response {
    return new Response(
      JSON.stringify({ data: { service: 'picturegen', version: '0.0.0', status: 'ok', style_version: styleVersion }, error: null }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }

  it('refuses a real run on a style-version mismatch BEFORE any provider call', async () => {
    const fetchMock = vi.fn().mockResolvedValue(healthEnvelope('v0-drifted-style'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      runGeneration({ course: 'dry-course', runId: 'style-mismatch', curriculumRoot, runsRoot }),
    ).rejects.toThrow(/style-version mismatch/);

    // The single fetch is the free /health GET — nothing paid ever ran.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toBe('https://prism.test:4007/health');
    expect(() => readFileSync(path.join(runsRoot, 'style-mismatch', 'checkpoint.json'), 'utf8')).toThrow();
  });

  it('refuses a --require-images run when the style version cannot be verified', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    await expect(
      runGeneration({ course: 'dry-course', runId: 'style-unverified', requireImages: true, curriculumRoot, runsRoot }),
    ).rejects.toThrow(/could not verify Prism's illustration style version/);
  });

  it('NEVER calls /health under --dry-run — dry-run stays fully offline', async () => {
    const fetchMock = vi.fn().mockResolvedValue(healthEnvelope(FORGE_ILLUSTRATION_STYLE_VERSION));
    vi.stubGlobal('fetch', fetchMock);

    const summary = await runGeneration({ course: 'dry-course', dryRun: true, runId: 'style-dry', curriculumRoot, runsRoot });

    expect(summary.dryRun).toHaveLength(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('lesson-policy gates decided before any paid stage (S05.4b)', () => {
  function rewriteLessons(mutate: (lessons: Array<Record<string, unknown>>) => void): void {
    const file = path.join(curriculumRoot, 'dry-course', 'adventures/01-a.yaml');
    const data = parseYaml(readFileSync(file, 'utf8')) as { sagas: Array<{ topics: Array<{ lessons: Array<Record<string, unknown>> }> }> };
    mutate(data.sagas[0]!.topics[0]!.lessons);
    writeFileSync(file, stringify(data));
  }

  it('skips a slot whose density is undeclared (B.17) with the itemized reason, and generates the declared one', async () => {
    rewriteLessons((lessons) => {
      delete lessons[1]!.new_concepts;
    });
    const summary = await runGeneration({ course: 'dry-course', dryRun: true, runId: 'policy-b17', curriculumRoot, runsRoot });
    expect(summary.dryRun).toEqual(['adv-1/saga-1/topic-1/lesson-1']);
    expect(summary.skipped).toHaveLength(1);
    expect(summary.skipped[0]!.slotId).toBe('adv-1/saga-1/topic-1/lesson-2');
    expect(summary.skipped[0]!.reason).toMatch(/gate 14 B\.17.*new_concepts is not declared/);
    expect(summary.tokensUsed).toBe(0);
  });

  it('skips a slot that carries Mexico-specific amounts but no market scenarios (B.16)', async () => {
    rewriteLessons((lessons) => {
      lessons[0]!.narrative_beat = 'Liruf cobra 20 pesos por cada vaso de limonada.';
    });
    const summary = await runGeneration({ course: 'dry-course', dryRun: true, runId: 'policy-b16', curriculumRoot, runsRoot });
    expect(summary.dryRun).toEqual(['adv-1/saga-1/topic-1/lesson-2']);
    expect(summary.skipped[0]!.reason).toMatch(/gate 16 B\.16.*needs a scenario per market.*20 pesos/);
  });

  it('skips a lesson over its working-memory ceiling (B.17: split, never ship as authored)', async () => {
    rewriteLessons((lessons) => {
      lessons[0]!.new_concepts = ['moneda', 'precio', 'costo', 'ganancia'];
    });
    const summary = await runGeneration({ course: 'dry-course', dryRun: true, runId: 'policy-ceiling', curriculumRoot, runsRoot });
    expect(summary.skipped.map((s) => s.slotId)).toEqual(['adv-1/saga-1/topic-1/lesson-1']);
    expect(summary.skipped[0]!.reason).toMatch(/4 new concepts exceed the 6-9 working-memory ceiling of 3/);
  });
});
