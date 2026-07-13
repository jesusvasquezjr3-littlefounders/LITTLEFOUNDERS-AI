// Zod schemas for the curriculum catalog files — COURSE_ENGINE.md §3.
//
// Two intentional widenings versus the terse task brief, discovered against
// the real `coursegen/curriculum/financial-education/*.yaml` authored by a
// sibling agent (reported in the final task summary, content NOT altered):
//   1. `facts.<id>.value` also accepts string[] and Record<string,string>
//      (e.g. `characters.canon_ids`, `characters.roles`) — the brief said
//      "number|number[]|string" but real facts legitimately need a labeled
//      map and a string list.
//   2. `facts.<id>.range` (a `[min,max]` authoring aid on `verified:false`
//      reference-price facts) is accepted as an optional extra field.

import { z } from 'zod';

export const LOCALE_KEYS = ['en-US', 'es-MX', 'pt-BR'] as const;

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be kebab-case')
  .max(80);

const tierKeySchema = z.string().regex(/^tier\d+$/, 'age tier keys must look like "tier1"');

function localized(max: number) {
  return z.object({
    'en-US': z.string().min(1).max(max),
    'es-MX': z.string().min(1).max(max),
    'pt-BR': z.string().min(1).max(max),
  });
}

// ---- taxonomy.yaml ---------------------------------------------------------

export const ageTierSchema = z.object({
  ages: z.string().min(1).max(16),
  forbidden_vocabulary: z.record(z.string().min(2).max(8), z.array(z.string().min(1).max(120))),
});

export const taxonomyFileSchema = z.object({
  schema_version: z.literal(1),
  themes: z.array(z.string().min(1).max(40)).min(1),
  age_tiers: z
    .record(tierKeySchema, ageTierSchema)
    .refine((o) => Object.keys(o).length > 0, { message: 'age_tiers must not be empty' }),
  families: z.array(z.string().min(1).max(40)).min(1),
  family_allowlist_by_tier: z.record(tierKeySchema, z.array(z.string().min(1).max(40)).min(1)),
  // Named exception lists (`tier1_extra_allowed`, `tier1_banned_types`, and
  // any future `tierN_*` list) — a flat map keeps this open-ended.
  type_exceptions: z.record(z.string().min(1).max(60), z.array(z.string().min(1).max(60))),
});

export type TaxonomyFile = z.infer<typeof taxonomyFileSchema>;

// ---- facts.yaml -------------------------------------------------------------

const factValueSchema = z.union([
  z.number(),
  z.array(z.number()),
  z.string(),
  z.array(z.string()),
  z.record(z.string(), z.string()),
]);

export const factEntrySchema = z.object({
  value: factValueSchema,
  unit: z.string().min(1).max(24).optional(),
  label_es: z.string().min(1).max(240).optional(),
  verified: z.boolean(),
  notes: z.string().min(1).max(1000).optional(),
  enforce: z.boolean().optional(),
  /** Authoring aid on approximate reference-price facts — [min, max]. */
  range: z.tuple([z.number(), z.number()]).optional(),
});

export const factsFileSchema = z.object({
  schema_version: z.literal(1),
  facts: z
    .record(z.string().min(1).max(120), factEntrySchema)
    .refine((o) => Object.keys(o).length > 0, { message: 'facts must not be empty' }),
});

export type FactsFile = z.infer<typeof factsFileSchema>;

// ---- catalog.yaml -----------------------------------------------------------

export const catalogFileSchema = z.object({
  schema_version: z.literal(1),
  course: z.object({
    slug: slugSchema,
    subject: z.string().min(1).max(40),
    title: localized(160),
    description: localized(600),
    authoring_locale: z.enum(LOCALE_KEYS),
  }),
  adventures: z.array(z.object({ file: z.string().min(1).max(200) })).min(1),
});

export type CatalogFile = z.infer<typeof catalogFileSchema>;

// ---- adventures/*.yaml -------------------------------------------------------

export const lessonBlueprintSchema = z.object({
  position: z.number().int().min(1),
  slug: slugSchema,
  micro_objective: z.string().min(1).max(300),
  narrative_beat: z.string().min(1).max(600),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  suggested_families: z.array(z.string().min(1).max(40)).min(1),
});

// ---- spaced-review layer (COURSE_ENGINE.md §3.1) ---------------------------
//
// Sagas default to `teaching`; a saga may instead be the adventure's single
// `review` saga (La Gran Misión). Topics default to `teaching`; a review-kind
// topic MUST cite the teaching content it consolidates via `review_of` — a
// list of slug PATHS of the form "<adventure-slug>/<saga-slug>" (a whole
// saga) or "<adventure-slug>/<saga-slug>/<topic-slug>" (a single topic).
// Path RESOLUTION against the loaded catalog happens in loader.ts (it needs
// the full cross-adventure picture); this schema only enforces the local
// shape: review kinds require a non-empty review_of, teaching kind must not
// carry one at all.

export const sagaKindSchema = z.enum(['teaching', 'review']);
export const topicKindSchema = z.enum(['teaching', 'review_spaced', 'review_interleaved', 'review_quest']);
export type SagaKind = z.infer<typeof sagaKindSchema>;
export type TopicKind = z.infer<typeof topicKindSchema>;

export const reviewOfPathSchema = z
  .string()
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*\/[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)?$/,
    'review_of entries must be "<adventure-slug>/<saga-slug>" or "<adventure-slug>/<saga-slug>/<topic-slug>"',
  );

export const topicBlueprintSchema = z
  .object({
    position: z.number().int().min(1),
    slug: slugSchema,
    kind: topicKindSchema.default('teaching'),
    review_of: z.array(reviewOfPathSchema).min(1).optional(),
    title_es: z.string().min(1).max(160),
    concept: z.string().min(1).max(600),
    learning_objective: z.string().min(1).max(600),
    key_vocabulary: z.array(z.string().min(1).max(80)).min(1),
    prior_knowledge: z.string().min(1).max(600),
    fact_refs: z.array(z.string().min(1).max(120)).default([]),
    lessons: z.array(lessonBlueprintSchema).min(1),
  })
  .refine((t) => t.kind === 'teaching' || (t.review_of !== undefined && t.review_of.length > 0), {
    message: 'review-kind topics (review_spaced/review_interleaved/review_quest) require a non-empty review_of',
    path: ['review_of'],
  })
  .refine((t) => t.kind !== 'teaching' || t.review_of === undefined, {
    message: 'teaching-kind topics must not carry review_of',
    path: ['review_of'],
  });

export const sagaBlueprintSchema = z.object({
  position: z.number().int().min(1),
  slug: slugSchema,
  kind: sagaKindSchema.default('teaching'),
  icon: z.string().min(1).max(60),
  title: localized(160),
  description: localized(600),
  topics: z.array(topicBlueprintSchema).min(1),
});

export const adventureFileSchema = z.object({
  schema_version: z.literal(1),
  adventure: z.object({
    position: z.number().int().min(1),
    slug: slugSchema,
    theme: z.string().min(1).max(40),
    age_tier: tierKeySchema,
    title: localized(160),
    description: localized(600),
    narrative_arc: z.string().min(1).max(1200),
  }),
  sagas: z.array(sagaBlueprintSchema).min(1),
});

export type AdventureFile = z.infer<typeof adventureFileSchema>;
