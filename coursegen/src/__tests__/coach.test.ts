import { describe, expect, it } from 'vitest';
import { diagnose, groupErrors, renderMarkdown, type CoachInput } from '../pipeline/coach.js';
import { newRunCheckpoint, setSlotState } from '../pipeline/checkpoint.js';
import type { RubricLogEntry } from '../pipeline/rubricLog.js';

/*
 * forge:coach — the propose-only improvement loop. These tests pin the
 * contract: diagnosis is deterministic, every action carries evidence, and
 * the kid_safety escalation fires on ANY sub-5 verdict regardless of volume.
 */

function rubric(over: Partial<RubricLogEntry['rubric']> = {}): RubricLogEntry['rubric'] {
  return {
    age_fit: 5,
    pedagogy: 5,
    narrative_quality: 5,
    kid_safety: 5,
    naturalness: 5,
    concreteness: 5,
    cognitive_engagement: 5,
    feedback_quality: 5,
    distractor_quality: 5,
    notes: 'ok',
    ...over,
  };
}

function entry(slotId: string, over: Partial<RubricLogEntry> = {}): RubricLogEntry {
  return { ts: '2026-07-26T00:00:00.000Z', slotId, outcome: 'passed', cycles: 0, earlyStopped: false, rubric: rubric(), ...over };
}

function baseInput(over: Partial<CoachInput> = {}): CoachInput {
  let cp = newRunCheckpoint('r1', 'c1');
  cp = setSlotState(cp, 'a/s/t/l1', 'published', { data: { publishResult: {} } });
  cp = setSlotState(cp, 'a/s/t/l2', 'failed', { error: 'review: judge gate failed after 1 revise cycle(s)', failedFrom: 'written' });
  return { label: 'r1', checkpoints: [cp], ledger: [], rubrics: [], ...over };
}

describe('coach.diagnose', () => {
  it('aggregates outcomes and the failure heatmap from checkpoint final states', () => {
    const d = diagnose(baseInput());
    expect(d.outcomes).toEqual({ published: 1, failed: 1, dryRun: 0, other: 0 });
    expect(d.failureHeatmap).toEqual({ written: 1 });
    expect(d.topErrors[0]?.count).toBe(1);
  });

  it('ESCALATES on any kid_safety < 5 verdict, regardless of sample size', () => {
    const d = diagnose(baseInput({ rubrics: [entry('a/s/t/l1', { rubric: rubric({ kid_safety: 4 }) })] }));
    expect(d.actions.some((a) => a.tag === 'safety:kid_safety')).toBe(true);
  });

  it('proposes a playbook action for a dragging dimension only with enough judged lessons', () => {
    const few = diagnose(baseInput({ rubrics: [entry('l1', { rubric: rubric({ distractor_quality: 2 }) })] }));
    expect(few.actions.some((a) => a.tag === 'playbook:distractor_quality')).toBe(false); // <10 judged: noise

    const many = diagnose(
      baseInput({
        rubrics: Array.from({ length: 12 }, (_, i) => entry(`a/s/t/l${i}`, { rubric: rubric({ distractor_quality: 2 }) })),
      }),
    );
    const action = many.actions.find((a) => a.tag === 'playbook:distractor_quality');
    expect(action).toBeDefined();
    expect(action?.evidence).toContain('12 judged'); // evidence always attached
  });

  it('computes cache-hit % per operation and flags low write-stage cache hits', () => {
    const ledger = Array.from({ length: 25 }, () => ({
      operation: 'write',
      prompt_tokens: 1000,
      completion_tokens: 500,
      cached_prompt_tokens: 100,
      est_usd: 0.01,
    }));
    const d = diagnose(baseInput({ ledger }));
    expect(d.cost.perOperation['write']?.cacheHitPct).toBe(10);
    expect(d.actions.some((a) => a.tag === 'cost:prefix-cache')).toBe(true);
  });

  it('takes the LAST rubric per slot (later passes supersede earlier verdicts)', () => {
    const d = diagnose(
      baseInput({
        rubrics: [
          entry('a/s/t/l1', { outcome: 'failed', rubric: rubric({ pedagogy: 1 }) }),
          entry('a/s/t/l1', { outcome: 'passed', rubric: rubric() }),
        ],
      }),
    );
    expect(d.judge.judged).toBe(1);
    expect(d.judge.failedVerdicts).toBe(0);
    expect(d.judge.dimensionMeans['pedagogy']).toBe(5);
  });
});

describe('coach.groupErrors', () => {
  it('groups recurring error prefixes and keeps a readable sample', () => {
    const groups = groupErrors([
      'localize: en-US re-gate found 2 forbidden-vocabulary hit(s) after translation',
      'localize: en-US re-gate found 5 forbidden-vocabulary hit(s) after translation',
      'gate failure on es-MX write: something else',
    ]);
    expect(groups[0]?.count).toBe(2);
    expect(groups[0]?.sample).toContain('localize');
  });
});

describe('coach.renderMarkdown', () => {
  it('renders the propose-only banner, the noise-floor disclaimer, and every action with evidence', () => {
    const input = baseInput({ rubrics: [entry('a/s/t/l1', { rubric: rubric({ kid_safety: 4 }) })] });
    const md = renderMarkdown('r1', diagnose(input));
    expect(md).toContain('PROPOSE-ONLY');
    expect(md).toContain('±0.4');
    expect(md).toContain('safety:kid_safety');
    expect(md).toContain('evidence:');
  });
});
