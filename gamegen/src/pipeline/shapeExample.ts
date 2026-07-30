// Per-mechanic JSON shape examples for the Arcade author/judge prompts — generic Zod
// v4 introspection over the REAL contract schemas (`src/contract/`), so this can never
// drift from what `gate` will validate against.
//
// WHY THIS EXISTS (ported verbatim in spirit from `coursegen/src/pipeline/shapeExample.ts`,
// coursegen/AGENTS.md rule 1 "the model cannot infer JSON shapes from type names"): before
// Forge derived its examples, the write prompt gave DeepSeek no structural hint per segment
// type beyond its name, and one type (`story_scene`) produced FOUR entirely different,
// all-invalid shapes across four attempts. A game `config` is an order of magnitude wider
// than a segment payload — `runner.config` alone nests a discriminated action model, a speed
// ramp, a pattern library and a scoring-weight block — so guessing is not a possibility.
// Deriving the example means adding a config field to a mechanic schema updates the prompt
// for free; a hand-maintained example list would be stale on the first schema edit, and the
// resulting document would lose that field silently (Zod objects STRIP unknown keys).
//
// Values are PLACEHOLDERS ("<field_name>"), never realistic content: the creative bar is
// `gamePlaybook.ts`'s job and the numeric bounds are the schema's. This only teaches field
// names, nesting, enum options and cardinality.

import type { z } from 'zod';

import type { MechanicId } from '../contract/core/types.js';
import { getMechanic } from '../contract/registry.js';

/**
 * The shape of a Zod v4 internal def, narrowed to the members this walker reads.
 * Zod does not publish this surface, hence the local structural type rather than an
 * `any` (root AGENTS.md forbids `any`): an unrecognized construct falls through to the
 * placeholder branch instead of throwing.
 */
interface ZodDef {
  type: string;
  shape?: Record<string, z.ZodTypeAny>;
  element?: z.ZodTypeAny;
  innerType?: z.ZodTypeAny;
  options?: z.ZodTypeAny[];
  values?: unknown[];
  entries?: Record<string, unknown>;
  valueType?: z.ZodTypeAny;
  items?: z.ZodTypeAny[];
  left?: z.ZodTypeAny;
  in?: z.ZodTypeAny;
}

function defOf(schema: z.ZodTypeAny): ZodDef | undefined {
  return (schema as unknown as { _zod?: { def?: ZodDef } })._zod?.def;
}

/** Game configs nest deeper than lesson payloads (config → spawn → patterns → elements),
 *  so the ceiling is higher than coursegen's 8 — but still a ceiling, because a cyclic
 *  schema must degrade to a placeholder rather than blow the stack inside a prompt build. */
const MAX_DEPTH = 12;

/** Best-effort example value for any Zod schema — falls back to a placeholder for
 *  constructs it does not recognize. NEVER throws: a prompt builder that dies on an
 *  unfamiliar schema construct would take a whole run down. */
function exampleFor(schema: z.ZodTypeAny, fieldName?: string, depth = 0): unknown {
  const def = defOf(schema);
  if (!def || depth > MAX_DEPTH) return fieldName ? `<${fieldName}>` : '<value>';

  switch (def.type) {
    case 'string':
      return fieldName ? `<${fieldName}>` : '<string>';
    case 'number':
    case 'int':
    case 'bigint':
      return 0;
    case 'boolean':
      return false;
    case 'literal':
      // Zod 4 literals carry an array of accepted values (`z.literal([1,2,3])` is how the
      // numeric tier enums are declared in core/schemaBase.ts).
      return def.values?.[0];
    case 'enum': {
      const first = def.entries ? Object.values(def.entries)[0] : undefined;
      return first ?? '<enum>';
    }
    case 'optional':
    case 'nullable':
    case 'nonoptional':
    case 'default':
    case 'prefault':
    case 'catch':
    case 'readonly':
      return def.innerType ? exampleFor(def.innerType, fieldName, depth) : null;
    case 'pipe':
      return def.in ? exampleFor(def.in, fieldName, depth) : `<${fieldName ?? 'value'}>`;
    case 'array':
      return def.element ? [exampleFor(def.element, fieldName, depth + 1)] : [];
    case 'object': {
      const out: Record<string, unknown> = {};
      for (const [key, valueSchema] of Object.entries(def.shape ?? {})) {
        out[key] = exampleFor(valueSchema, key, depth + 1);
      }
      return out;
    }
    case 'record': {
      // `skin.sprites` and `item.props` are open Records — the KEY is the information the
      // model needs (a declared sprite slot id, a numeric prop name), so show one.
      const valueExample = def.valueType ? exampleFor(def.valueType, fieldName, depth + 1) : '<value>';
      return { '<key>': valueExample };
    }
    case 'tuple':
      return (def.items ?? []).map((item) => exampleFor(item, fieldName, depth + 1));
    case 'union':
      // Includes discriminated unions (`runner.config.action`): the FIRST member is shown,
      // which is why the prompt must also list the alternatives — see mechanicShapeExample.
      return def.options?.[0] ? exampleFor(def.options[0], fieldName, depth) : `<${fieldName ?? 'value'}>`;
    case 'intersection':
      return def.left ? exampleFor(def.left, fieldName, depth) : `<${fieldName ?? 'value'}>`;
    default:
      return fieldName ? `<${fieldName}>` : '<value>';
  }
}

/**
 * One compact JSON-shape example for ANY Zod schema — a mechanic's `configSchema` /
 * `contentSchema`, or a shared document schema (`gameMetaSchema`, `gameSkinSchema`,
 * `gameScoringSchema`, `gameValidationSchema`).
 *
 * `.refine()` / `.superRefine()` wrappers are transparent here because Zod 4 attaches
 * checks to the schema itself rather than wrapping it, so a refined object still reports
 * `type: 'object'` with its shape intact. The refinements themselves (cross-field rules
 * like "static mode: every ladder level must set fall_speed to 0") are NOT visible in the
 * shape and must be surfaced to the model as prose hard-rules — a shape example teaches
 * field names, never semantics.
 */
export function shapeExample(schema: z.ZodTypeAny): unknown {
  return exampleFor(schema, undefined, 0);
}

/**
 * The two mechanic-specific halves of a `GameDocument`, derived from the registry —
 * exactly what the author prompt has to teach and what the judge needs to read a
 * document against. Returns `null` for an unknown or not-yet-implemented mechanic id
 * (`getMechanic` answers `null` rather than throwing), which the caller must treat as a
 * slot failure: a mechanic Arcade cannot look up is also one it cannot bot-gate.
 *
 * Alternative union members are the one thing the shape cannot show — for a
 * discriminated `config` field (e.g. `runner.config.action`) only the first member is
 * rendered, so the enumerated alternatives belong in the prompt's hard rules alongside
 * the declared sprite slots.
 */
export function mechanicShapeExample(
  mechanic: MechanicId | string,
): { config: unknown; content: unknown; spriteSlots: readonly string[] } | null {
  const slice = getMechanic(mechanic);
  if (slice === null) return null;
  return {
    config: shapeExample(slice.configSchema),
    content: shapeExample(slice.contentSchema),
    spriteSlots: slice.spriteSlots,
  };
}
