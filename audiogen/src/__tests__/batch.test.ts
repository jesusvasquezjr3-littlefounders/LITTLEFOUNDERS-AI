import { describe, expect, it, vi } from 'vitest';
import { runBatchNarration, type BatchNarrationDeps } from '../batch.js';
import type { LessonDocumentRow } from '../db/lessonDocumentsRepo.js';
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

const row: LessonDocumentRow = {
  lesson_id: 'lesson-1',
  locale: 'en-US',
  document,
  audio: {
    units: {
      's1.prompt': {
        file_id: 'lesson-audio/prompt.mp3',
        url: 'https://filebase.example/prompt.mp3',
        hash: 'old-hash',
        bytes: 1,
        duration_ms: 1,
        voice: 'Jennifer',
      },
    },
  },
};

function deps(): BatchNarrationDeps {
  return {
    listPendingLessonDocuments: vi.fn().mockResolvedValue([{ lesson_id: 'lesson-1', locale: 'en-US' }]),
    getLessonDocument: vi.fn().mockResolvedValue(row),
    narrateLesson: vi.fn(),
  };
}

describe('runBatchNarration dry-run', () => {
  it('counts pending units without invoking TTS or writing Vault', async () => {
    const injected = deps();

    const summary = await runBatchNarration('financial-education', { dryRun: true }, injected);

    expect(summary).toMatchObject({
      dryRun: true,
      lessonsAttempted: 1,
      unitsInspected: 2,
      manifestEntriesPresent: 1,
      estimatedTtsCalls: 1,
      guardBlocked: 0,
      lessonErrors: 0,
    });
    expect(injected.narrateLesson).not.toHaveBeenCalled();
  });
});
