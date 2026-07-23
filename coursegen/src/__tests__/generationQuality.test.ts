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

  describe('drag verbs (engine is tap-to-place)', () => {
    it('flags a prompt that says "arrastra"', () => {
      const d = docWith([{ id: 's1', type: 'sort_buckets', payload: {} }]);
      (d.segments[0] as { prompt_md: string }).prompt_md = 'Arrastra cada ficha a su caja';
      expect(runGenerationQualityGate(d).some((p) => p.message.includes('tap-to-place'))).toBe(true);
    });

    it('accepts a prompt that says "toca"', () => {
      const d = docWith([{ id: 's1', type: 'sort_buckets', payload: {} }]);
      (d.segments[0] as { prompt_md: string }).prompt_md = 'Toca cada ficha y su caja';
      expect(runGenerationQualityGate(d)).toHaveLength(0);
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
