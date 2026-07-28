// Per-type JSON shape examples for the write prompt — generic Zod v4
// introspection over TYPE_TO_SCHEMA (contract/registry.ts), so this can
// never drift from the real contract (no hand-maintained 56-type example
// list to keep in sync). Root cause this fixes: write.ts's prompt gave the
// model NO structural hint per segment type beyond its name, so DeepSeek
// guessed field names — inconsistently, and usually wrong (discovered via
// the QA smoke-test run (course slug first-lemonade-stand): story_scene alone produced 4 entirely
// different, all-invalid shapes across 4 attempts). Values are placeholders
// ("<field_name>"), not realistic content — content quality is already
// covered by BASE_HARD_RULES; this only needs to teach field names/nesting/
// enum options.

import type { z } from 'zod';

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
}

function defOf(schema: z.ZodTypeAny): ZodDef | undefined {
  return (schema as unknown as { _zod?: { def?: ZodDef } })._zod?.def;
}

const MAX_DEPTH = 8;

/** Best-effort example value for any Zod schema — falls back to a placeholder for constructs it doesn't recognize (never throws). */
function exampleFor(schema: z.ZodTypeAny, fieldName?: string, depth = 0): unknown {
  const def = defOf(schema);
  if (!def || depth > MAX_DEPTH) return fieldName ? `<${fieldName}>` : '<value>';

  switch (def.type) {
    case 'string':
      return fieldName ? `<${fieldName}>` : '<string>';
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'literal':
      return def.values?.[0];
    case 'enum': {
      const first = def.entries ? Object.values(def.entries)[0] : undefined;
      return first ?? '<enum>';
    }
    case 'optional':
    case 'nullable':
    case 'default':
      return def.innerType ? exampleFor(def.innerType, fieldName, depth) : null;
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
      const valueExample = def.valueType ? exampleFor(def.valueType, fieldName, depth + 1) : '<value>';
      return { '<key>': valueExample };
    }
    case 'tuple':
      return (def.items ?? []).map((item) => exampleFor(item, fieldName, depth + 1));
    case 'union':
      return def.options?.[0] ? exampleFor(def.options[0], fieldName, depth) : `<${fieldName ?? 'value'}>`;
    default:
      return fieldName ? `<${fieldName}>` : '<value>';
  }
}

/** One compact JSON-shape example for ANY Zod object schema — a segment type (envelope + payload + answer) or the top-level meta/scoring schemas. */
export function shapeExample(schema: z.ZodTypeAny): unknown {
  return exampleFor(schema, undefined, 0);
}
