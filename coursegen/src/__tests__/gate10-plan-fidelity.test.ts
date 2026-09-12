// Gate 10 — the written document must be the plan that was approved.
//
// The mix rules are enforced deterministically on the PLAN (planRepair in
// pipeline/plan.ts), and then merely REQUESTED of the author in prose:
// "Produce EXACTLY one segment per skeleton entry, IN THE SAME ORDER, with the
// SAME `type`" (pipeline/write.ts). Nine gates ran on the result and none of
// them read a segment's type, so compliance was never verified.
//
// It is not always given. A production lesson opens on a graded challenge —
// see the "the defect this gate was written for" case below.

import { describe, expect, it } from 'vitest';
import { runPlanFidelityGate, runAllGates } from '../pipeline/gates.js';
import { buildDocument, buildTaxonomy, buildFacts } from './fixtures.js';

const typesOf = (doc: ReturnType<typeof buildDocument>) => doc.segments.map((s) => s.type);

describe('gate 10: the document follows its approved plan', () => {
  it('passes when every segment matches the plan, in order', () => {
    const doc = buildDocument();
    expect(runPlanFidelityGate(doc, typesOf(doc))).toEqual([]);
  });

  it('is inert when no plan was supplied — review and localization gate documents with no skeleton behind them', () => {
    const doc = buildDocument();
    expect(runPlanFidelityGate(doc, undefined)).toEqual([]);
    expect(runPlanFidelityGate(doc, [])).toEqual([]);
  });

  /*
   * THE DEFECT THIS GATE WAS WRITTEN FOR.
   *
   * "Mismo deseo, distinta razón" (financial-education) ships opening with
   * sort_buckets: which of four characters wanted which object, in a lesson
   * that has not introduced any of them. The mapping appears only in that
   * segment's explanation_md, AFTER the attempt is scored, and both hints say
   * "drag each wish to the character who mentioned it" without ever saying who
   * did. planRepair guarantees segment 1 is a story type; the author returned
   * something else and nothing looked.
   */
  it('catches a graded opener where the plan called for a story segment', () => {
    const doc = buildDocument();
    const planned = [...typesOf(doc)];
    planned[0] = 'story_dialogue';
    doc.segments[0]!.type = 'sort_buckets' as typeof doc.segments[0]['type'];

    const problems = runPlanFidelityGate(doc, planned);

    expect(problems).toHaveLength(1);
    expect(problems[0]!.gate).toBe(10);
    expect(problems[0]!.message).toContain('segment 1');
    expect(problems[0]!.message).toContain('sort_buckets');
    expect(problems[0]!.message).toContain('story_dialogue');
    // The message has to explain the RULE, not just the mismatch: it is fed
    // back to the author as a corrective-retry instruction.
    expect(problems[0]!.message).toMatch(/TEACHES before it grades/);
  });

  it('names the position when a later segment drifts', () => {
    const doc = buildDocument();
    const planned = [...typesOf(doc)];
    expect(planned.length).toBeGreaterThan(1);
    planned[1] = 'true_false';

    const problems = runPlanFidelityGate(doc, planned);

    expect(problems).toHaveLength(1);
    expect(problems[0]!.message).toContain('segment 2');
  });

  it('catches a document that is shorter or longer than its plan', () => {
    const doc = buildDocument();
    const short = runPlanFidelityGate(doc, [...typesOf(doc), 'true_false']);
    expect(short.some((p) => p.message.includes('segment(s) and the document has'))).toBe(true);

    const long = runPlanFidelityGate(doc, typesOf(doc).slice(0, 1));
    expect(long.some((p) => p.message.includes('segment(s) and the document has'))).toBe(true);
  });

  /*
   * The drift is expressed on the PLAN side here, not by retyping a segment:
   * gate 1 is the schema and it runs first, so a segment whose `type` no
   * longer matches its payload never reaches gate 10 — the document would be
   * rejected as malformed, which is a different (and already covered) failure.
   * A valid document that simply is not the plan is the case gate 10 owns.
   */
  it('is wired into runAllGates, not just exported', () => {
    const doc = buildDocument();
    const planned = [...typesOf(doc)];
    planned[0] = planned[0] === 'true_false' ? 'story_dialogue' : 'true_false';

    const report = runAllGates(doc, {
      taxonomy: buildTaxonomy(),
      facts: buildFacts(),
      tier: '6-8',
      plannedSegmentTypes: planned,
    });

    expect(report.ok).toBe(false);
    expect(report.problems.some((p) => p.gate === 10)).toBe(true);
  });
});
