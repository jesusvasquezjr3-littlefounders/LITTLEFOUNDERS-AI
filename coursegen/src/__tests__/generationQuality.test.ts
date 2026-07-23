import { describe, expect, it } from 'vitest';
import { runGenerationQualityGate, ICON_PALETTE } from '../pipeline/generationQuality.js';
import type { LessonDocumentParsed } from '../contract/schema.js';

/** Minimal doc wrapper — gate 7 only reads segments[].{type,payload,answer}. */
function docWith(segments: Array<{ id: string; type: string; payload: unknown; answer?: unknown }>): LessonDocumentParsed {
  return {
    schema_version: 1,
    meta: { cast: ['dina'] },
    scoring: {},
    segments: segments.map((s) => ({ id: s.id, type: s.type, prompt_md: 'x', difficulty: 1, xp: 10, payload: s.payload, answer: s.answer })),
  } as unknown as LessonDocumentParsed;
}

function messages(doc: LessonDocumentParsed): string[] {
  return runGenerationQualityGate(doc).map((p) => p.message);
}

describe('gate 7: generation quality', () => {
  describe('icon whitelist', () => {
    it('flags an invented icon name', () => {
      const problems = runGenerationQualityGate(
        docWith([{ id: 's1', type: 'story_scene', payload: { art: { icon: 'lemonade', tint: 'papaya' }, body_md: 'x' } }]),
      );
      expect(problems).toHaveLength(1);
      expect(problems[0]?.gate).toBe(7);
      expect(problems[0]?.message).toContain('"lemonade"');
    });

    it('accepts a blessed icon and ignores answer-side values', () => {
      expect(ICON_PALETTE.has('savings')).toBe(true);
      const problems = runGenerationQualityGate(
        docWith([{ id: 's1', type: 'key_ideas', payload: { ideas: [{ id: 'i1', text_md: 'x', icon: 'savings' }] } }]),
      );
      expect(problems).toHaveLength(0);
    });

    it('flags nested icons (idea cards)', () => {
      const problems = runGenerationQualityGate(
        docWith([{ id: 's1', type: 'key_ideas', payload: { ideas: [{ id: 'i1', text_md: 'x', icon: 'savings' }, { id: 'i2', text_md: 'y', icon: 'piggy_bank' }] } }]),
      );
      expect(problems.map((p) => p.message).join(' ')).toContain('"piggy_bank"');
      expect(problems).toHaveLength(1);
    });
  });

  describe('quality-scale', () => {
    it('flags a 0–1 best_decision map (correct answer would score ≤1/100)', () => {
      const problems = runGenerationQualityGate(
        docWith([{ id: 's1', type: 'best_decision', payload: { options: [] }, answer: { qualities: { a: 1, b: 0.2 } } }]),
      );
      expect(problems.some((p) => p.message.includes('0–1 scale'))).toBe(true);
    });

    it('accepts a 0–100 best_decision map', () => {
      const problems = runGenerationQualityGate(
        docWith([{ id: 's1', type: 'best_decision', payload: { options: [] }, answer: { qualities: { a: 100, b: 20 } } }]),
      );
      expect(problems).toHaveLength(0);
    });

    it('flags an all-zero best_decision map but ALLOWS all-zero would_you_rather (free choice)', () => {
      const bad = runGenerationQualityGate(
        docWith([{ id: 's1', type: 'best_decision', payload: {}, answer: { qualities: { a: 0, b: 0 } } }]),
      );
      expect(bad.some((p) => p.message.includes('no option can pass'))).toBe(true);
      const ok = runGenerationQualityGate(
        docWith([{ id: 's1', type: 'would_you_rather', payload: {}, answer: { qualities: { a: 0, b: 0 } } }]),
      );
      expect(ok).toHaveLength(0);
    });

    it('rescales dialogue_choice and story_branch nested quality maps', () => {
      expect(messages(docWith([{ id: 's1', type: 'dialogue_choice', payload: {}, answer: { turns: [{ turn_id: 't1', qualities: { r1: 1, r2: 0.3 } }] } }]))).toContainEqual(expect.stringContaining('0–1 scale'));
      expect(messages(docWith([{ id: 's1', type: 'story_branch', payload: {}, answer: { qualities: [{ node_id: 'n1', choice_id: 'a', score: 100 }] } }]))).toHaveLength(0);
    });
  });

  describe('drag verbs (tap-to-place types only)', () => {
    it('flags a prompt that says "arrastra" on a tap-only type (order_steps)', () => {
      const d = docWith([{ id: 's1', type: 'order_steps', payload: { items: [{ id: 'a', text_md: 'a' }, { id: 'b', text_md: 'b' }, { id: 'c', text_md: 'c' }] }, answer: { order: ['a', 'b', 'c'] } }]);
      (d.segments[0] as { prompt_md: string }).prompt_md = 'Arrastra cada ficha en orden';
      expect(runGenerationQualityGate(d).some((p) => p.message.includes('tap-to-place'))).toBe(true);
    });

    it('accepts a prompt that says "toca"', () => {
      const d = docWith([{ id: 's1', type: 'order_steps', payload: { items: [{ id: 'a', text_md: 'a' }, { id: 'b', text_md: 'b' }, { id: 'c', text_md: 'c' }] }, answer: { order: ['a', 'b', 'c'] } }]);
      (d.segments[0] as { prompt_md: string }).prompt_md = 'Toca cada ficha en orden';
      expect(runGenerationQualityGate(d)).toHaveLength(0);
    });

    it('does NOT flag "arrastra" on sort_buckets / group_sets (they support real drag now)', () => {
      const buckets = docWith([{ id: 's1', type: 'sort_buckets', payload: {} }]);
      (buckets.segments[0] as { prompt_md: string }).prompt_md = 'Arrastra cada compra a su grupo';
      expect(runGenerationQualityGate(buckets).some((p) => p.message.includes('tap-to-place'))).toBe(false);

      const groups = docWith([{ id: 's1', type: 'group_sets', payload: {} }]);
      (groups.segments[0] as { prompt_md: string }).prompt_md = 'Arrastra cada cosa a su conjunto';
      expect(runGenerationQualityGate(groups).some((p) => p.message.includes('tap-to-place'))).toBe(false);
    });
  });

  describe('memory_flip icon fields + duplicate pairs', () => {
    it('recognizes a_icon/b_icon (not just "icon") for the whitelist check', () => {
      const problems = runGenerationQualityGate(
        docWith([{
          id: 's1',
          type: 'memory_flip',
          payload: { pairs: [{ a_md: 'Ahorrar', a_icon: 'not_a_real_icon', b_md: 'Guardar', b_icon: 'savings' }] },
        }]),
      );
      expect(problems.some((p) => p.message.includes('"not_a_real_icon"'))).toBe(true);
    });

    it('flags two pairs that share an equivalent value (ambiguous match)', () => {
      const problems = runGenerationQualityGate(
        docWith([{
          id: 's1',
          type: 'memory_flip',
          payload: {
            pairs: [
              { a_md: 'Ahorrar', a_icon: 'savings', b_md: 'Guardar dinero', b_icon: 'savings' },
              { a_md: 'Gastar', a_icon: 'payments', b_md: 'guardar DINERO', b_icon: 'payments' }, // accent/case-insensitive dupe of pair 0's b_md
            ],
          },
        }]),
      );
      expect(problems.some((p) => p.message.includes('shares the value'))).toBe(true);
    });

    it('accepts a memory_flip segment where every card value is unique', () => {
      const problems = runGenerationQualityGate(
        docWith([{
          id: 's1',
          type: 'memory_flip',
          payload: {
            pairs: [
              { a_md: 'Ahorrar', a_icon: 'savings', b_md: 'Guardar dinero', b_icon: 'account_balance_wallet' },
              { a_md: 'Gastar', a_icon: 'shopping_cart', b_md: 'Comprar algo', b_icon: 'payments' },
              { a_md: 'Donar', a_icon: 'volunteer_activism', b_md: 'Regalar para ayudar', b_icon: 'handshake' },
            ],
          },
        }]),
      );
      expect(problems).toHaveLength(0);
    });
  });

  describe('order-family slot/answer length parity', () => {
    it('flags order_steps with a distractor item but no `slots` (unwinnable — every submission is length-6 vs a length-5 key)', () => {
      const problems = runGenerationQualityGate(
        docWith([{
          id: 's1',
          type: 'order_steps',
          payload: { items: [{ id: 'a', text_md: 'a' }, { id: 'b', text_md: 'b' }, { id: 'c', text_md: 'c' }, { id: 'd', text_md: 'd' }, { id: 'e', text_md: 'e' }, { id: 'distractor', text_md: 'x' }] },
          answer: { order: ['a', 'b', 'c', 'd', 'e'] },
        }]),
      );
      expect(problems.some((p) => p.message.includes('order_steps') && p.message.includes('every submission would score 0'))).toBe(true);
    });

    it('accepts order_steps with a distractor WHEN `slots` matches answer.order.length', () => {
      const problems = runGenerationQualityGate(
        docWith([{
          id: 's1',
          type: 'order_steps',
          payload: { items: [{ id: 'a', text_md: 'a' }, { id: 'b', text_md: 'b' }, { id: 'c', text_md: 'c' }, { id: 'd', text_md: 'd' }, { id: 'e', text_md: 'e' }, { id: 'distractor', text_md: 'x' }], slots: 5 },
          answer: { order: ['a', 'b', 'c', 'd', 'e'] },
        }]),
      );
      expect(problems).toHaveLength(0);
    });

    it('accepts order_steps with no distractors and no `slots` field', () => {
      const problems = runGenerationQualityGate(
        docWith([{
          id: 's1',
          type: 'order_steps',
          payload: { items: [{ id: 'a', text_md: 'a' }, { id: 'b', text_md: 'b' }, { id: 'c', text_md: 'c' }] },
          answer: { order: ['a', 'b', 'c'] },
        }]),
      );
      expect(problems).toHaveLength(0);
    });

    it('flags rank_choices / timeline_order when answer.order omits an item (no distractor support there)', () => {
      const rank = runGenerationQualityGate(
        docWith([{ id: 's1', type: 'rank_choices', payload: { items: [{ id: 'a', text_md: 'a' }, { id: 'b', text_md: 'b' }, { id: 'c', text_md: 'c' }] }, answer: { order: ['a', 'b'] } }]),
      );
      expect(rank.some((p) => p.message.includes('rank_choices'))).toBe(true);
      const timeline = runGenerationQualityGate(
        docWith([{ id: 's1', type: 'timeline_order', payload: { events: [{ id: 'a', text_md: 'a' }, { id: 'b', text_md: 'b' }, { id: 'c', text_md: 'c' }] }, answer: { order: ['a', 'b'] } }]),
      );
      expect(timeline.some((p) => p.message.includes('timeline_order'))).toBe(true);
    });

    it('flags build_sentence when `slots` does not match answer.order.length', () => {
      const problems = runGenerationQualityGate(
        docWith([{ id: 's1', type: 'build_sentence', payload: { tokens: [{ id: 'a', text_md: 'a' }, { id: 'b', text_md: 'b' }], slots: 2 }, answer: { order: ['a'] } }]),
      );
      expect(problems.some((p) => p.message.includes('build_sentence'))).toBe(true);
    });
  });

  describe('graded segments must carry an answer key', () => {
    it('flags a graded type (quiz_mcq) with no answer', () => {
      const problems = runGenerationQualityGate(
        docWith([{ id: 's1', type: 'quiz_mcq', payload: { options: [{ id: 'a', text_md: 'A' }, { id: 'b', text_md: 'B' }] } }]),
      );
      expect(problems.some((p) => p.message.includes('NO answer key'))).toBe(true);
    });

    it('accepts keyless-by-design graded types (memory_flip, savings_goal) and content types', () => {
      const memory = runGenerationQualityGate(
        docWith([{ id: 's1', type: 'memory_flip', payload: { pairs: [{ a_md: 'a', a_icon: 'savings', b_md: 'b', b_icon: 'payments' }] } }]),
      );
      expect(memory.some((p) => p.message.includes('NO answer key'))).toBe(false);
      const story = runGenerationQualityGate(
        docWith([{ id: 's1', type: 'story_scene', payload: { backdrop: 'base', body_md: 'x' } }]),
      );
      expect(story.some((p) => p.message.includes('NO answer key'))).toBe(false);
    });

    it('accepts a graded type WITH an answer', () => {
      const problems = runGenerationQualityGate(
        docWith([{ id: 's1', type: 'quiz_mcq', payload: { options: [{ id: 'a', text_md: 'A' }, { id: 'b', text_md: 'B' }] }, answer: { correct_option_id: 'a' } }]),
      );
      expect(problems.some((p) => p.message.includes('NO answer key'))).toBe(false);
    });
  });

  describe('compare_table cell keys', () => {
    it('flags underscore-separated keys', () => {
      const problems = runGenerationQualityGate(
        docWith([{ id: 's1', type: 'compare_table', payload: {}, answer: { cells: { 'proveedor-a_precio': 't1' } } }]),
      );
      expect(problems).toHaveLength(1);
      expect(problems[0]?.message).toContain('colon');
    });

    it('accepts colon keys', () => {
      const problems = runGenerationQualityGate(
        docWith([{ id: 's1', type: 'compare_table', payload: {}, answer: { cells: { 'r1:c1': 't1', 'r2:c2': 't2' } } }]),
      );
      expect(problems).toHaveLength(0);
    });
  });
});
