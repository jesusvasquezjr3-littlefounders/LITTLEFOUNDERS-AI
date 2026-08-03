import { describe, expect, it } from 'vitest';
import { shapeExample } from '../pipeline/shapeExample.js';
import { TYPE_TO_SCHEMA } from '../contract/registry.js';
import { lessonMetaSchema } from '../contract/core/schemaBase.js';

describe('shapeExample', () => {
  it('never throws and always produces an object for every registered type', () => {
    for (const [type, schema] of TYPE_TO_SCHEMA) {
      const example = shapeExample(schema);
      expect(example, `type "${type}" produced a non-object example`).toBeTypeOf('object');
      expect((example as Record<string, unknown>).type, `type "${type}" missing literal 'type' field`).toBe(type);
    }
  });

  it('story_scene: gets the correct payload field names and lists EVERY backdrop enum option', () => {
    const example = shapeExample(TYPE_TO_SCHEMA.get('story_scene')!) as {
      payload: { backdrop: string; body_md: string };
      prompt_md: string;
    };
    expect(example.prompt_md).toBe('<prompt_md>');
    // Showing only the first legal value ("band") reads as ONE valid example,
    // not "this is a closed set" — the model then invents illegal values for
    // every option it never saw (production incident 2026-08-03). Every enum
    // option must be visible.
    expect(example.payload.backdrop).toBe('<one of: band|inverse|base>');
    expect(example.payload.body_md).toBe('<body_md>');
  });

  it('story_dialogue: array-of-objects payload keeps nested field names and lists every character option', () => {
    const example = shapeExample(TYPE_TO_SCHEMA.get('story_dialogue')!) as {
      payload: { lines: { character: string; text_md: string }[] };
    };
    expect(Array.isArray(example.payload.lines)).toBe(true);
    expect(example.payload.lines[0]!.character).toBe('<one of: dina|liruf|rho|zara>');
    expect(example.payload.lines[0]!.text_md).toBe('<text_md>');
  });

  it('key_ideas: renders the schema minimum of 2 ideas, not 1', () => {
    // `ideas: z.array(...).min(2).max(5)` — a 1-item example under-communicates
    // the real floor and the model routinely under-fills (production incident
    // 2026-08-03: "ideas: Too small").
    const example = shapeExample(TYPE_TO_SCHEMA.get('key_ideas')!) as { payload: { ideas: unknown[] } };
    expect(example.payload.ideas).toHaveLength(2);
  });

  it('speed_tap: caps the shown example count instead of rendering the full schema maximum', () => {
    // `items: z.array(...).min(6).max(14)` — showing the true minimum (6) teaches
    // the floor without ballooning the prompt to the loose upper bound.
    const example = shapeExample(TYPE_TO_SCHEMA.get('speed_tap')!) as { payload: { items: unknown[] } };
    expect(example.payload.items).toHaveLength(6);
  });

  it('meta.estimated_minutes: uses the schema minimum (1) instead of 0', () => {
    // `estimated_minutes: z.number().int().min(1).max(30)` — 0 is itself
    // invalid, so the OLD placeholder was already an illegal example
    // (production incident 2026-08-03: "estimated_minutes: Too small").
    const example = shapeExample(lessonMetaSchema) as { estimated_minutes: number };
    expect(example.estimated_minutes).toBe(1);
  });

  it('handles a record-shaped payload (e.g. matching/assignment types) without throwing', () => {
    // Any type using z.record in its payload — arrange/analyze families.
    const recordType = [...TYPE_TO_SCHEMA.entries()].find(([, schema]) => {
      const rendered = JSON.stringify(shapeExample(schema));
      return rendered.includes('<key>');
    });
    expect(recordType, 'expected at least one type with a z.record payload to exist').toBeDefined();
  });
});
