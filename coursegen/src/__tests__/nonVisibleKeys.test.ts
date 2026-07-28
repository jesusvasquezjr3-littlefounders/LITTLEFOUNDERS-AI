import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { NON_VISIBLE_KEYS } from '../pipeline/gates.js';
import { TYPE_TO_SCHEMA } from '../contract/registry.js';

/*
 * Regression guard for the enum-corruption class of bug found on the first
 * real QA generation run (2026-07-13): localize.ts freezes structure by
 * skipping NON_VISIBLE_KEYS when extracting translatable strings — any
 * enum-valued payload key NOT in that set gets sent to the translation
 * model, which happily "translates" the enum value (fill_blank's
 * `mode: "typed"` came back as pt-BR prose) and the re-injected document
 * fails contract validation. This test derives every enum-valued object key
 * straight from the live Zod schemas, so adding a new segment type with a
 * new enum field FAILS CI here until the key is added to NON_VISIBLE_KEYS.
 */

interface ZodDefLite {
  type: string;
  shape?: Record<string, z.ZodTypeAny>;
  element?: z.ZodTypeAny;
  innerType?: z.ZodTypeAny;
  options?: z.ZodTypeAny[];
  items?: z.ZodTypeAny[];
  valueType?: z.ZodTypeAny;
}

function defOf(schema: z.ZodTypeAny): ZodDefLite | undefined {
  return (schema as unknown as { _zod?: { def?: ZodDefLite } })._zod?.def;
}

function collectEnumKeys(schema: z.ZodTypeAny, keyName: string | undefined, out: Set<string>): void {
  const def = defOf(schema);
  if (!def) return;
  switch (def.type) {
    case 'enum':
      if (keyName) out.add(keyName);
      return;
    case 'optional':
    case 'nullable':
    case 'default':
      if (def.innerType) collectEnumKeys(def.innerType, keyName, out);
      return;
    case 'array':
      if (def.element) collectEnumKeys(def.element, keyName, out);
      return;
    case 'tuple':
      for (const item of def.items ?? []) collectEnumKeys(item, keyName, out);
      return;
    case 'union':
      for (const option of def.options ?? []) collectEnumKeys(option, keyName, out);
      return;
    case 'record':
      if (def.valueType) collectEnumKeys(def.valueType, keyName, out);
      return;
    case 'object':
      for (const [key, value] of Object.entries(def.shape ?? {})) collectEnumKeys(value, key, out);
      return;
    default:
      return;
  }
}

describe('NON_VISIBLE_KEYS coverage (localize enum-freeze contract)', () => {
  it('covers EVERY enum-valued object key across all 56 segment schemas', () => {
    const enumKeys = new Set<string>();
    for (const [, schema] of TYPE_TO_SCHEMA) collectEnumKeys(schema, undefined, enumKeys);

    // Sanity: the walker actually finds enum keys (guards against the
    // introspection silently breaking on a Zod upgrade and vacuously passing).
    expect(enumKeys.size).toBeGreaterThanOrEqual(10);
    expect(enumKeys.has('backdrop')).toBe(true);

    const uncovered = [...enumKeys].filter((key) => !NON_VISIBLE_KEYS.has(key)).sort();
    expect(
      uncovered,
      `enum-valued keys missing from NON_VISIBLE_KEYS (localize would let the translator corrupt them): ${uncovered.join(', ')}`,
    ).toEqual([]);
  });

  it('covers EVERY icon-valued key (icons are Material Symbols ligatures, never prose)', () => {
    // Icons are FREE STRINGS (not enums), so the enum walker above cannot see
    // them — and exactly that gap shipped: `b_icon: "cookie"` came back from
    // the pt-BR translator as "biscoito" on the first fire-and-forget track
    // (2026-07-26), an icon name that cannot render. The list below is the
    // full grep of `*_icon`-shaped keys across src/contract — extend it (and
    // NON_VISIBLE_KEYS) in the same commit that adds a new icon field.
    const iconKeys = ['icon', 'ask_icon', 'a_icon', 'b_icon'];
    const uncovered = iconKeys.filter((key) => !NON_VISIBLE_KEYS.has(key)).sort();
    expect(
      uncovered,
      `icon-valued keys missing from NON_VISIBLE_KEYS (the translator would "translate" a Material Symbols name): ${uncovered.join(', ')}`,
    ).toEqual([]);
  });
});
