// Forge-only derived registry over the copied contract (NOT part of the
// byte-diffed contract-parity set in src/contract/check.ts — this file has
// no frontend counterpart). Builds type→family/schema lookups straight from
// the family `*Schemas` arrays so the 56-type list can never drift from the
// actual Zod contract: add a type to a family schema.ts and it appears here
// automatically without touching this file.

import type { z } from 'zod';
import { storySchemas } from './families/story/schema.js';
import { choiceSchemas } from './families/choice/schema.js';
import { inputSchemas } from './families/input/schema.js';
import { arrangeSchemas } from './families/arrange/schema.js';
import { moneySchemas } from './families/money/schema.js';
import { analyzeSchemas } from './families/analyze/schema.js';
import { storyplaySchemas } from './families/storyplay/schema.js';
import { makerSchemas } from './families/maker/schema.js';

export const FAMILY_NAMES = [
  'story',
  'choice',
  'input',
  'arrange',
  'money',
  'analyze',
  'storyplay',
  'maker',
] as const;
export type FamilyName = (typeof FAMILY_NAMES)[number];

const FAMILY_SCHEMAS: Record<FamilyName, readonly z.ZodTypeAny[]> = {
  story: storySchemas,
  choice: choiceSchemas,
  input: inputSchemas,
  arrange: arrangeSchemas,
  money: moneySchemas,
  analyze: analyzeSchemas,
  storyplay: storyplaySchemas,
  maker: makerSchemas,
};

/** `story` is the only ungraded/content family (LESSON_ENGINE.md §4). */
export const CONTENT_FAMILIES: readonly FamilyName[] = ['story'];

/** Flow types self-drive (timers, simulations, branching) — no plain Check button. */
export const FLOW_TYPES = new Set([
  'speed_tap',
  'memory_flip',
  'interest_peek',
  'story_branch',
  'dialogue_choice',
  'flash_match',
  'lightning_round',
  'robot_path',
]);

function typeIdOf(schema: z.ZodTypeAny): string {
  // Every segment schema is z.object({ ..., type: z.literal('x'), ... }).
  const shape = (schema as unknown as { shape: Record<string, { value: string }> }).shape;
  const typeField = shape.type;
  if (!typeField) throw new Error('contract registry: segment schema has no `type` literal field');
  return typeField.value;
}

export interface TypeInfo {
  type: string;
  family: FamilyName;
  graded: boolean;
  flow: boolean;
  schema: z.ZodTypeAny;
}

export const TYPE_INFO: readonly TypeInfo[] = FAMILY_NAMES.flatMap((family) =>
  FAMILY_SCHEMAS[family].map((schema) => {
    const type = typeIdOf(schema);
    return {
      type,
      family,
      graded: !CONTENT_FAMILIES.includes(family),
      flow: FLOW_TYPES.has(type),
      schema,
    };
  }),
);

export const ALL_TYPES: readonly string[] = TYPE_INFO.map((t) => t.type);
export const GRADED_TYPES: readonly string[] = TYPE_INFO.filter((t) => t.graded).map((t) => t.type);
export const CONTENT_TYPES: readonly string[] = TYPE_INFO.filter((t) => !t.graded).map((t) => t.type);
export const MONEY_TYPES: readonly string[] = TYPE_INFO.filter((t) => t.family === 'money').map((t) => t.type);

export const TYPE_TO_FAMILY: ReadonlyMap<string, FamilyName> = new Map(
  TYPE_INFO.map((t) => [t.type, t.family]),
);
export const TYPE_TO_SCHEMA: ReadonlyMap<string, z.ZodTypeAny> = new Map(
  TYPE_INFO.map((t) => [t.type, t.schema]),
);

export function isKnownType(type: string): boolean {
  return TYPE_TO_SCHEMA.has(type);
}
