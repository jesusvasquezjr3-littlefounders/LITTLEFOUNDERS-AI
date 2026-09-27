import { describe, expect, it, vi } from 'vitest';
import { runBatchNarration, type BatchNarrationDeps } from '../batch.js';
import { getConfig, voiceFor, type LessonLocale } from '../env.js';
import { extractNarratables } from '../narrate/extractNarratables.js';
import { contentHash } from '../narrate/types.js';
import type { AudioUnitEntry, LessonDocumentRow } from '../db/lessonDocumentsRepo.js';
import type { NarrateLessonDeps, NarrateLessonOptions, NarrateLessonSummary } from '../service/lessonAudio.js';
import type { LessonDocument } from '../types/lessonDocument.js';

const document: LessonDocument = {
  schema_version: 1,
  meta: { slug: 'demo', title: 'Demo', locale: 'en-US', subject: 'money', estimated_minutes: 5, objectives: ['x'], cast: ['dina'] },
  scoring: { pass_threshold: 70, hint_penalty_pct: 10, max_attempts: 2, hearts: null },
  segments: [{
    id: 's1',
    type: 'story_scene',
    prompt_md: 'A prompt',
    difficulty: 1,
    xp: 0,
    payload: { body_md: 'A story body', character: 'dina' },
  }],
};

function manifestEntry(hash: string): AudioUnitEntry {
  return {
    file_id: 'lesson-audio/prompt.mp3',
    url: 'https://filebase.example/prompt.mp3',
    hash,
    bytes: 1,
    duration_ms: 1,
    voice: 'Jennifer',
  };
}

const row: LessonDocumentRow = {
  lesson_id: 'lesson-1',
  locale: 'en-US',
  document,
  audio: { units: { 's1.prompt': manifestEntry('stale-hash') } },
};

function deps(documentRow: LessonDocumentRow = row): BatchNarrationDeps {
  return {
    listPendingLessonDocuments: vi.fn().mockResolvedValue([{ lesson_id: 'lesson-1', locale: 'en-US' }]),
    getLessonDocument: vi.fn().mockResolvedValue(documentRow),
    narrateLesson: vi.fn(),
  };
}

describe('runBatchNarration dry-run', () => {
  it('counts a stale-hash manifest entry as a paid TTS call, like the live run will', async () => {
    const injected = deps();

    const summary = await runBatchNarration('financial-education', { dryRun: true }, injected);

    // The 's1.prompt' entry exists but its hash no longer matches the current
    // text/voice/model, so the live run would re-synthesize (and pay for) it.
    expect(summary).toMatchObject({
      dryRun: true,
      lessonsAttempted: 1,
      unitsInspected: 2,
      manifestEntriesPresent: 0,
      estimatedTtsCalls: 2,
      guardBlocked: 0,
      lessonErrors: 0,
    });
    expect(injected.narrateLesson).not.toHaveBeenCalled();
  });

  it('counts hash-matching manifest entries as free reuse', async () => {
    // Build the manifest exactly the way the live run stamps it: hash =
    // contentHash(text, voice, model) with the unit's resolved voice.
    const config = getConfig();
    const units: Record<string, AudioUnitEntry> = {};
    for (const unit of extractNarratables(document)) {
      const { voice, model } = voiceFor(unit.character, 'en-US', config);
      units[unit.unit_id] = manifestEntry(contentHash(unit.text, voice, model));
    }
    const injected = deps({ ...row, audio: { units } });

    const summary = await runBatchNarration('financial-education', { dryRun: true }, injected);

    expect(summary).toMatchObject({
      unitsInspected: 2,
      manifestEntriesPresent: 2,
      estimatedTtsCalls: 0,
      guardBlocked: 0,
      lessonErrors: 0,
    });
  });
});

describe('runBatchNarration TTS budget', () => {
  it('stops touching pending rows once the budget is exhausted', async () => {
    const pendingRows = [
      { lesson_id: 'lesson-1', locale: 'en-US' as const },
      { lesson_id: 'lesson-2', locale: 'en-US' as const },
      { lesson_id: 'lesson-3', locale: 'en-US' as const },
    ];
    const narrateLesson = vi.fn(
      async (
        _lessonId: string,
        _locale: LessonLocale,
        _overrides?: Partial<NarrateLessonDeps>,
        options?: NarrateLessonOptions,
      ): Promise<NarrateLessonSummary | null> => {
        // Live behavior: an un-cached unit reserves a call right before synthesis.
        options?.ttsBudget?.tryReserve();
        return { units_total: 1, generated: 1, reused: 0, cached: 0, failed: [] };
      },
    );
    const injected: BatchNarrationDeps = {
      listPendingLessonDocuments: vi.fn().mockResolvedValue(pendingRows),
      getLessonDocument: vi.fn(),
      narrateLesson,
    };

    const summary = await runBatchNarration(undefined, { maxTtsCalls: 1, maxUsd: 100, usdPer1kChars: 0.1 }, injected);

    // Row 1 consumed the whole budget; rows 2-3 must be left untouched — no
    // Vault read and no manifest PATCH, i.e. narrateLesson never runs for them.
    expect(narrateLesson).toHaveBeenCalledTimes(1);
    expect(narrateLesson).toHaveBeenCalledWith('lesson-1', 'en-US', {}, expect.anything());
    expect(injected.getLessonDocument).not.toHaveBeenCalled();
    expect(summary.budgetSkippedLessons).toBe(2);
    expect(summary.lessonsAttempted).toBe(1);
    expect(summary.generated).toBe(1);
    expect(summary.unitFailures).toBe(0);
  });
});

/*
 * OD-28 (owner review D-03): a paid batch states the owner-approved USD
 * ceiling, and the ceiling binds per character.
 */
describe('runBatchNarration owner USD ceiling (OD-28)', () => {
  const pendingRows = [
    { lesson_id: 'lesson-1', locale: 'en-US' as const },
    { lesson_id: 'lesson-2', locale: 'en-US' as const },
    { lesson_id: 'lesson-3', locale: 'en-US' as const },
  ];

  it.each([undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses a paid batch with ceiling %s before the pending query',
    async (maxUsd) => {
      const injected = deps();
      await expect(runBatchNarration(undefined, { maxUsd, usdPer1kChars: 0.1 }, injected)).rejects.toThrow(
        /narrate:all: a paid run needs the owner-approved USD ceiling \(--max-usd <n>\)/,
      );
      expect(injected.listPendingLessonDocuments).not.toHaveBeenCalled();
      expect(injected.narrateLesson).not.toHaveBeenCalled();
    },
  );

  it('refuses a paid batch when no per-character price is configured', async () => {
    const injected = deps();
    const previous = process.env.AUDIOGEN_USD_PER_1K_CHARS;
    delete process.env.AUDIOGEN_USD_PER_1K_CHARS;
    const { resetConfigCache } = await import('../env.js');
    resetConfigCache();
    try {
      await expect(runBatchNarration(undefined, { maxUsd: 5 }, injected)).rejects.toThrow(/AUDIOGEN_USD_PER_1K_CHARS/);
      expect(injected.listPendingLessonDocuments).not.toHaveBeenCalled();
    } finally {
      if (previous !== undefined) process.env.AUDIOGEN_USD_PER_1K_CHARS = previous;
      resetConfigCache();
    }
  });

  it('needs no ceiling for a dry-run', async () => {
    const summary = await runBatchNarration('financial-education', { dryRun: true }, deps());
    expect(summary.dryRun).toBe(true);
    expect(summary.estimatedTtsChars).toBeGreaterThan(0);
  });

  it('stops the batch once a reservation would pass the ceiling', async () => {
    // 1,000 characters per synthesis at $0.10 per 1,000 → $0.10 each; $0.25 admits two.
    const narrateLesson = vi.fn(
      async (
        _lessonId: string,
        _locale: LessonLocale,
        _overrides?: Partial<NarrateLessonDeps>,
        options?: NarrateLessonOptions,
      ): Promise<NarrateLessonSummary | null> => {
        const admitted = options?.ttsBudget?.tryReserve(1000) ?? true;
        return admitted
          ? { units_total: 1, generated: 1, reused: 0, cached: 0, failed: [] }
          : { units_total: 1, generated: 0, reused: 0, cached: 0, failed: [{ unit_id: 'u', reason: 'TTS budget exhausted before synthesis' }] };
      },
    );
    const injected: BatchNarrationDeps = {
      listPendingLessonDocuments: vi.fn().mockResolvedValue([...pendingRows, { lesson_id: 'lesson-4', locale: 'en-US' as const }]),
      getLessonDocument: vi.fn(),
      narrateLesson,
    };

    const summary = await runBatchNarration(undefined, { maxUsd: 0.25, usdPer1kChars: 0.1 }, injected);

    expect(summary.generated).toBe(2);
    expect(summary.usdReserved).toBeCloseTo(0.2, 6);
    // The third lesson's reservation was refused; the fourth is never touched.
    expect(narrateLesson).toHaveBeenCalledTimes(3);
    expect(summary.budgetSkippedLessons).toBe(1);
    expect(summary.unitFailures).toBe(1);
  });
});
