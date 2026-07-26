import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { stringify } from 'yaml';
import { runGeneration } from '../pipeline/run.js';

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
                { position: 1, slug: 'lesson-1', micro_objective: 'x', narrative_beat: 'x', difficulty: 1, suggested_families: ['story'] },
                { position: 2, slug: 'lesson-2', micro_objective: 'y', narrative_beat: 'y', difficulty: 1, suggested_families: ['story'] },
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
        params: { course: 'dry-course', locales: ['es-MX', 'en-US', 'pt-BR'], noImages: false, register: 'kid' },
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
