import { describe, expect, it, vi } from 'vitest';
import { CONTENT_PLAYBOOK, tierReasoningGuidance, JUDGE_PLAYBOOK_ANCHORS } from '../pipeline/contentPlaybook.js';
import { writeLessonDocument, type WriteInput } from '../pipeline/write.js';
import { reviewLesson } from '../pipeline/review.js';
import { buildFacts, buildTaxonomy, baseSegments, buildDocument } from './fixtures.js';
import type { ChatCompleteResult, ChatCompleteRequest } from '../providers/openaiChat.js';

describe('content playbook module', () => {
  it('names the core quality principles the author must follow', () => {
    // application-not-recall + distractor-teaches + outcome-neutral feedback are the load-bearing rules
    expect(CONTENT_PLAYBOOK).toMatch(/APPLICATION, NEVER DEFINITION-RECALL/);
    expect(CONTENT_PLAYBOOK).toMatch(/misconception/i);
    expect(CONTENT_PLAYBOOK).toMatch(/outcome-neutral/i);
    expect(CONTENT_PLAYBOOK).toMatch(/curiosity gap/i);
    expect(CONTENT_PLAYBOOK).toMatch(/FORBIDDEN/);
  });

  it('enforces the age-tier abstraction ceiling (no profit/interest/percent for the youngest)', () => {
    const t1 = tierReasoningGuidance('tier1');
    expect(t1).toMatch(/6-7/);
    expect(t1).toMatch(/FORBIDDEN/);
    expect(t1.toLowerCase()).toMatch(/percentage|percent|interest|future value|porcentaje|interés|valor/);
    // tier3 unlocks profit / buying-to-sell
    const t3 = tierReasoningGuidance('tier3');
    expect(t3.toLowerCase()).toMatch(/profit|interest|revender|opportunity/);
    // unknown tier still returns non-empty guidance
    expect(tierReasoningGuidance('tierX').length).toBeGreaterThan(0);
  });

  it('gives the judge binary, checkable engagement signals', () => {
    expect(JUDGE_PLAYBOOK_ANCHORS).toMatch(/concrete number/i);
    expect(JUDGE_PLAYBOOK_ANCHORS).toMatch(/DECISION/);
    expect(JUDGE_PLAYBOOK_ANCHORS).toMatch(/boring/i);
  });
});

describe('playbook wiring', () => {
  function baseInput(): WriteInput {
    return {
      ctx: {
        tier: 'tier1',
        taxonomy: undefined as never,
        courseTitle: 'Educación Financiera',
        adventureNarrativeArc: 'x',
        topic: { concept: 'x', learningObjective: 'x', keyVocabulary: ['moneda'], priorKnowledge: 'x', factRefs: [] },
        lesson: { microObjective: 'x', narrativeBeat: 'x', difficulty: 1, suggestedFamilies: ['money'] },
      },
      skeleton: { segments: [{ type: 'story_scene', brief: 'intro' }] },
      facts: buildFacts(),
      locale: 'es-MX',
      slug: 'test-lesson',
      subject: 'money',
    };
  }

  function validDoc() {
    return {
      schema_version: 1,
      meta: { slug: 'test-lesson', title: 'Lección', locale: 'es-MX', subject: 'money', estimated_minutes: 5, objectives: ['x'], cast: ['dina'] },
      scoring: { pass_threshold: 70, hint_penalty_pct: 10, max_attempts: 2, hearts: null },
      segments: baseSegments(),
    };
  }

  it('injects the CONTENT PLAYBOOK and the tier ceiling into the author prompt', async () => {
    const complete = vi.fn(async (): Promise<ChatCompleteResult> => ({ content: JSON.stringify(validDoc()), promptTokens: 1, completionTokens: 1 }));
    await writeLessonDocument(baseInput(), { complete: complete as never });
    const sent = (complete.mock.calls[0]![0] as ChatCompleteRequest).messages.map((m) => m.content).join('\n');
    expect(sent).toContain('CONTENT PLAYBOOK');
    expect(sent).toContain('AGE-TIER REASONING CEILING');
    expect(sent).toMatch(/AGE 6-7/); // tier1 guidance made it in
  });

  it('injects the judge anchors into the review prompt', async () => {
    const judge = vi.fn(async (): Promise<ChatCompleteResult> => ({
      content: JSON.stringify({ age_fit: 5, pedagogy: 5, narrative_quality: 5, kid_safety: 5, naturalness: 5, concreteness: 5, cognitive_engagement: 5, feedback_quality: 5, distractor_quality: 5, notes: 'ok' }),
      promptTokens: 1,
      completionTokens: 1,
    }));
    await reviewLesson(buildDocument(), { taxonomy: buildTaxonomy(), tier: 'tier1', facts: buildFacts() }, { judge: judge as never, author: vi.fn() as never });
    const sent = (judge.mock.calls[0]![0] as ChatCompleteRequest).messages.map((m) => m.content).join('\n');
    expect(sent).toMatch(/BINARY signals|binary/i);
  });
});
