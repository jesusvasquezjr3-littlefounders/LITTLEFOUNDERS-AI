import { describe, expect, it } from 'vitest';
import { shapeExample } from '../pipeline/shapeExample.js';
import { TYPE_TO_SCHEMA } from '../contract/registry.js';

describe('shapeExample', () => {
  it('never throws and always produces an object for every registered type', () => {
    for (const [type, schema] of TYPE_TO_SCHEMA) {
      const example = shapeExample(schema);
      expect(example, `type "${type}" produced a non-object example`).toBeTypeOf('object');
      expect((example as Record<string, unknown>).type, `type "${type}" missing literal 'type' field`).toBe(type);
    }
  });

  it('story_scene: gets the correct payload field names and the real backdrop enum option', () => {
    const example = shapeExample(TYPE_TO_SCHEMA.get('story_scene')!) as {
      payload: { backdrop: string; body_md: string };
      prompt_md: string;
    };
    expect(example.prompt_md).toBe('<prompt_md>');
    expect(example.payload.backdrop).toBe('band'); // first enum option, not a placeholder
    expect(example.payload.body_md).toBe('<body_md>');
  });

  it('story_dialogue: array-of-objects payload keeps nested field names', () => {
    const example = shapeExample(TYPE_TO_SCHEMA.get('story_dialogue')!) as {
      payload: { lines: { character: string; text_md: string }[] };
    };
    expect(Array.isArray(example.payload.lines)).toBe(true);
    expect(example.payload.lines[0]!.character).toBe('dina'); // first characterIdSchema enum option
    expect(example.payload.lines[0]!.text_md).toBe('<text_md>');
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
