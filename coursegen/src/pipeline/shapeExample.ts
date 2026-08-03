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

interface CheckDef {
  check?: string;
  minimum?: number;
  maximum?: number;
  value?: number;
  inclusive?: boolean;
}

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
  checks?: unknown[];
}

function defOf(schema: z.ZodTypeAny): ZodDef | undefined {
  return (schema as unknown as { _zod?: { def?: ZodDef } })._zod?.def;
}

/** Zod v4 keeps `.min()`/`.max()` as separate CHECKS on the schema's own def, not as fields of it. */
function checksOf(schema: z.ZodTypeAny): CheckDef[] {
  const raw = defOf(schema)?.checks ?? [];
  return raw
    .map((c) => (c as { _zod?: { def?: CheckDef } })._zod?.def)
    .filter((d): d is CheckDef => d !== undefined);
}

/** `.min(N)` on an array/string is a `min_length` check — this IS the count the schema requires. */
function minLengthOf(schema: z.ZodTypeAny): number | undefined {
  return checksOf(schema).find((c) => c.check === 'min_length')?.minimum;
}

/** `.min(N)` on a number is a `greater_than` check with `inclusive` disambiguating >= vs >. */
function minValueOf(schema: z.ZodTypeAny): number | undefined {
  const check = checksOf(schema).find((c) => c.check === 'greater_than');
  if (!check || typeof check.value !== 'number') return undefined;
  return check.inclusive ? check.value : check.value + 1;
}

/** A shown array example this long teaches the count without bloating the prompt for a loose upper bound. */
const MAX_EXAMPLE_ARRAY_ITEMS = 8;

const MAX_DEPTH = 8;

/** Best-effort example value for any Zod schema — falls back to a placeholder for constructs it doesn't recognize (never throws). */
function exampleFor(schema: z.ZodTypeAny, fieldName?: string, depth = 0): unknown {
  const def = defOf(schema);
  if (!def || depth > MAX_DEPTH) return fieldName ? `<${fieldName}>` : '<value>';

  switch (def.type) {
    case 'string':
      return fieldName ? `<${fieldName}>` : '<string>';
    case 'number':
      return minValueOf(schema) ?? 0;
    case 'boolean':
      return false;
    case 'literal':
      return def.values?.[0];
    case 'enum': {
      // A single first-option placeholder ("band") reads as ONE valid example,
      // not as "this field is a closed set" — the model then invents plausible
      // but illegal values for every option it never saw (production incident
      // 2026-08-03: story_scene backdrop / story_dialogue line character both
      // failed validation this way, repeatedly, across retries). Listing every
      // option inside an obvious placeholder token teaches the actual
      // constraint instead of one accidentally-legal instance of it.
      const values = def.entries ? Object.values(def.entries) : [];
      if (values.length === 0) return '<enum>';
      if (values.length === 1) return values[0];
      return `<one of: ${values.join('|')}>`;
    }
    case 'optional':
    case 'nullable':
    case 'default':
      return def.innerType ? exampleFor(def.innerType, fieldName, depth) : null;
    case 'array': {
      if (!def.element) return [];
      // A schema requiring >=N items shown as a 1-item example reads as "one
      // item is fine" — the model then routinely under-fills arrays with a
      // real minimum (production incident 2026-08-03: cards/reasons/turns/
      // ideas all failed "Too small" repeatedly). Showing the real minimum
      // count (capped so a loose upper bound like speed_tap's 6-14 doesn't
      // bloat the prompt) teaches the count the same way the enum fix above
      // teaches the legal values.
      const count = Math.min(Math.max(minLengthOf(schema) ?? 1, 1), MAX_EXAMPLE_ARRAY_ITEMS);
      return Array.from({ length: count }, () => exampleFor(def.element!, fieldName, depth + 1));
    }
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
