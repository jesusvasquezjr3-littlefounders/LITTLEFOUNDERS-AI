import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkForgeV2Rows, forgeV2BehaviourPassRate } from '../services/forgeV2Rows.js';
import { algorithmIsStandard } from '../services/forgeV2Behaviour.js';

/*
 * GAP-FIX-R1 learning (B.7, Appendix C 1.3): the interactive-behaviour gate
 * runs every permitted state of every graded segment through Core's own
 * grading path. The committed Forge fixture passes; each red case below is a
 * lesson that would reach review with a broken interaction.
 */

type Row = { lesson_id: string; locale: string; document: Record<string, any>; answer_keys: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
const here = path.dirname(fileURLToPath(import.meta.url));
const rows = JSON.parse(readFileSync(path.resolve(here, '../../../coursegen/src/v2/fixtures/emitted.json'), 'utf8')) as Row[];
const rowOf = (lessonId: string) => structuredClone(rows.find((row) => row.lesson_id === lessonId && row.locale === 'en-US')!);

describe('the interactive-behaviour gate', () => {
  it('passes every graded segment of the committed Forge fixture and reports its pass rate', () => {
    const rate = forgeV2BehaviourPassRate(rows);
    expect(rate.segments).toBeGreaterThan(60);
    expect(rate.passRate).toBe(1);
    expect(rate.states).toBeGreaterThan(1_000);
  });

  it('blocks an initial board state that is already met', () => {
    const row = rowOf('v2-number-line-whole');
    const segment = row.document.segments[0];
    row.answer_keys[segment.id] = { target: segment.payload.initial };
    expect(checkForgeV2Rows([row]).join('\n')).toMatch(/initial board state is already met/);
  });

  it('blocks a rubric every permitted state meets, and a rubric no permitted state can reach', () => {
    const trivial = rowOf('v2-allocation-bar');
    trivial.answer_keys[trivial.document.segments[0].id] = { minimumSave: 0 };
    expect(checkForgeV2Rows([trivial]).join(' | ')).toMatch(/trivially met/);
    const broken = rowOf('v2-first-release-logic');
    const euler = broken.document.segments.find((s: { type: string }) => s.type === 'logic.euler.v2');
    // "first" does not exist when the first set sits inside the second: the accepted placement is impossible.
    broken.answer_keys[euler.id] = { regions: Object.fromEntries(euler.payload.items.map((item: { id: string }) => [item.id, 'first'])) };
    expect(checkForgeV2Rows([broken]).join(' | ')).toMatch(/refused by Core's v2 contract|interactive-behaviour gate/);
  });

  it('keeps the long-arithmetic check the renderer relies on', () => {
    expect(algorithmIsStandard({ kind: 'long-division', dividend: 156, divisor: 12, steps: [{ digit: 1, product: 12, remainder: 3 }, { digit: 3, product: 36, remainder: 0 }] })).toBe(true);
    expect(algorithmIsStandard({ kind: 'long-division', dividend: 156, divisor: 12, steps: [{ digit: 1, product: 12, remainder: 3 }] })).toBe(false);
  });
});
