import { describe, expect, it } from 'vitest';
import { extractNarratables } from '../narrate/extractNarratables.js';
import { stripMarkdown } from '../narrate/stripMarkdown.js';
import type { LessonDocument } from '../types/lessonDocument.js';

// Covers every `story` family type (LESSON_ENGINE.md §5.1) plus a graded
// type, to prove Echo narrates prompt_md + explanation_md everywhere but
// only walks story bodies for story types (§12).
const fixture: LessonDocument = {
  schema_version: 1,
  meta: {
    slug: 'demo-lesson',
    title: 'Demo',
    locale: 'en-US',
    subject: 'money',
    estimated_minutes: 5,
    objectives: ['learn'],
    cast: ['dina'],
  },
  scoring: { pass_threshold: 70, hint_penalty_pct: 10, max_attempts: 2, hearts: null },
  segments: [
    {
      id: 's1',
      type: 'story_dialogue',
      prompt_md: '**Listen up!**',
      difficulty: 1,
      xp: 0,
      payload: {
        lines: [
          { character: 'dina', text_md: 'Hi *kid*!' },
          { character: 'liruf', text_md: '`Save` first.' },
        ],
      },
    },
    {
      id: 's2',
      type: 'story_scene',
      prompt_md: 'Scene prompt',
      difficulty: 1,
      xp: 0,
      payload: { backdrop: 'band', body_md: '- one\n- two' },
    },
    {
      id: 's3',
      type: 'key_ideas',
      prompt_md: 'Key ideas prompt',
      difficulty: 1,
      xp: 0,
      payload: {
        ideas: [
          { icon: 'a', title: 'T1', body_md: 'idea one' },
          { icon: 'b', title: 'T2', body_md: 'idea two' },
        ],
      },
    },
    {
      id: 's4',
      type: 'concept_reveal',
      prompt_md: 'Reveal prompt',
      difficulty: 1,
      xp: 0,
      payload: {
        cards: [
          { front_md: 'front1', back_md: 'back1' },
          { front_md: 'front2', back_md: 'back2' },
        ],
      },
    },
    {
      id: 's5',
      type: 'checkpoint',
      prompt_md: 'Checkpoint prompt',
      difficulty: 1,
      xp: 0,
      payload: { recap_md: 'Recap text' },
    },
    {
      id: 's6',
      type: 'quiz_mcq',
      prompt_md: 'Quiz prompt',
      explanation_md: '**Great job**',
      difficulty: 2,
      xp: 10,
      payload: { options: [{ id: 'a', text_md: 'A', rationale_md: 'because' }] },
    },
  ],
};

describe('extractNarratables', () => {
  it('extracts prompt_md for every segment, in document order', () => {
    const units = extractNarratables(fixture);
    const prompts = units.filter((u) => u.field === 'prompt');
    expect(prompts.map((u) => u.segment_id)).toEqual(['s1', 's2', 's3', 's4', 's5', 's6']);
    expect(prompts[0]?.text).toBe('Listen up!');
  });

  it('strips MarkdownLite from prompt_md', () => {
    const units = extractNarratables(fixture);
    const p1 = units.find((u) => u.unit_id === 's1.prompt');
    expect(p1?.text).toBe('Listen up!');
  });

  it('extracts one unit per story_dialogue line, markdown-stripped', () => {
    const units = extractNarratables(fixture);
    const line0 = units.find((u) => u.unit_id === 's1.line.0');
    const line1 = units.find((u) => u.unit_id === 's1.line.1');
    expect(line0?.text).toBe('Hi kid!');
    expect(line1?.text).toBe('Save first.');
  });

  it('tags each story_dialogue line with its OWN speaker (not one narrator per segment)', () => {
    const units = extractNarratables(fixture);
    expect(units.find((u) => u.unit_id === 's1.line.0')?.character).toBe('dina');
    expect(units.find((u) => u.unit_id === 's1.line.1')?.character).toBe('liruf');
  });

  it('leaves character undefined when a segment has no narrator and the field has no per-line speaker', () => {
    const units = extractNarratables(fixture);
    expect(units.find((u) => u.unit_id === 's1.prompt')?.character).toBeUndefined();
    expect(units.find((u) => u.unit_id === 's2.body')?.character).toBeUndefined();
  });

  it('falls back to the segment envelope narrator when a story field has no character of its own', () => {
    const narrated: LessonDocument = structuredClone(fixture);
    narrated.segments[1]!.narrator = { character: 'rho' };
    const units = extractNarratables(narrated);
    expect(units.find((u) => u.unit_id === 's2.body')?.character).toBe('rho');
    expect(units.find((u) => u.unit_id === 's2.prompt')?.character).toBe('rho');
  });

  it('extracts story_scene body_md, list syntax stripped', () => {
    const units = extractNarratables(fixture);
    const body = units.find((u) => u.unit_id === 's2.body');
    expect(body?.text).toBe('one. two');
  });

  it('extracts one unit per key_ideas idea', () => {
    const units = extractNarratables(fixture);
    expect(units.find((u) => u.unit_id === 's3.idea.0')?.text).toBe('idea one');
    expect(units.find((u) => u.unit_id === 's3.idea.1')?.text).toBe('idea two');
  });

  it('extracts ONLY concept_reveal card backs, not fronts', () => {
    const units = extractNarratables(fixture);
    expect(units.find((u) => u.unit_id === 's4.card.0.back')?.text).toBe('back1');
    expect(units.find((u) => u.unit_id === 's4.card.1.back')?.text).toBe('back2');
    expect(units.some((u) => u.text === 'front1' || u.text === 'front2')).toBe(false);
  });

  it('extracts checkpoint recap_md', () => {
    const units = extractNarratables(fixture);
    expect(units.find((u) => u.unit_id === 's5.recap')?.text).toBe('Recap text');
  });

  it('extracts explanation_md when present, regardless of family', () => {
    const units = extractNarratables(fixture);
    expect(units.find((u) => u.unit_id === 's6.explanation')?.text).toBe('Great job');
  });

  it('does not walk non-story payloads for body text (e.g. quiz_mcq options)', () => {
    const units = extractNarratables(fixture);
    expect(units.some((u) => u.text === 'A' || u.text === 'because')).toBe(false);
  });

  it('total unit count matches the extraction contract', () => {
    const units = extractNarratables(fixture);
    // 6 prompts + 2 dialogue lines + 1 scene body + 2 ideas + 2 card backs + 1 recap + 1 explanation
    expect(units).toHaveLength(6 + 2 + 1 + 2 + 2 + 1 + 1);
  });
});

describe('stripMarkdown', () => {
  it('strips bold, italic, code and list markers', () => {
    expect(stripMarkdown('**bold** and *italic* and `code`')).toBe('bold and italic and code');
    expect(stripMarkdown('- a\n- b\n- c')).toBe('a. b. c');
  });

  it('drops blank lines and trims', () => {
    expect(stripMarkdown('  hello  \n\n  world  ')).toBe('hello. world');
  });
});
