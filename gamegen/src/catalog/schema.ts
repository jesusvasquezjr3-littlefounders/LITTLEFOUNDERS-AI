// Zod schemas for the Arcade game catalog — GAME_ENGINE.md §8/§9, gamegen/AGENTS.md
// "Curriculum catalog authoring".
//
// One authored file per course: `gamegen/curriculum/<course-slug>/games.yaml`. Its
// entries are GAME BLUEPRINTS — the human-designed input the `validate` stage checks
// before a single paid call happens. This module owns SHAPE only. Two deliberate
// splits, both copied from Forge (`coursegen/src/catalog/schema.ts`), not invented here:
//
//  1. **Closed-set membership that needs the contract lives in loader.ts, not here.**
//     Forge's schema keeps `forced_types: string[]` and resolves it against
//     `ALL_TYPES` in the loader, precisely so schema.ts imports no contract module.
//     `mechanic` is the one place we bend that, because the closed mechanic set is
//     tiny and stable and the authoring error ("you typed `sorterr`") deserves a
//     message that NAMES the value — see `mechanicIdSchema`.
//  2. **Cross-file resolution lives in loader.ts.** `topic_path` shape is enforced
//     here; whether it resolves to a real Forge topic is a cross-catalog question
//     that needs the whole coursegen course loaded.
//
// The `courseCatalogIndexSchema` / `courseAdventureIndexSchema` pair at the bottom is
// deliberately MINIMAL and permissive — see its header.

import { z } from 'zod';
import { MECHANIC_IDS, GAME_TIERS } from '../contract/core/types.js';

/** kebab-case, the platform-wide slug grammar (AGENTS.md §1.7). */
export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be kebab-case')
  .max(64);

/**
 * `"<adventure>/<saga>/<topic>"` — exactly three kebab segments. This is the SAME
 * grammar Forge uses for `review_of` / `prerequisites` topic paths, kept byte-compatible
 * on purpose: a path an author copies out of an adventure file must validate here.
 */
export const topicPathSchema = z
  .string()
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*\/[a-z0-9]+(-[a-z0-9]+)*\/[a-z0-9]+(-[a-z0-9]+)*$/,
    'topic_path must be "<adventure-slug>/<saga-slug>/<topic-slug>" (three kebab-case segments)',
  );

/** Narrowing guard for the closed mechanic set — exported because the schema's OUTPUT
 *  type is deliberately `string` (see below), so consumers that need `MechanicId` narrow
 *  with this instead of casting. */
export function isMechanicId(value: string): boolean {
  return (MECHANIC_IDS as readonly string[]).includes(value);
}

/**
 * The mechanic id, validated against the closed set of 8 (`contract/core/types.ts`).
 *
 * NOT `z.enum(MECHANIC_IDS)`: zod v4's enum issue reads `Invalid option: expected one
 * of "sorter"|...` and never echoes what the author actually typed, so a one-character
 * typo in a 300-line YAML is a hunt. `superRefine` lets the message name the offending
 * value AND list the closed set. Verified against zod 4.4.3 — `.refine(check, (v) => ...)`
 * (zod 3's value-aware params form) silently degrades to "Invalid input" in v4.
 *
 * Output type is `string`, not `MechanicId`, on purpose: the downstream consumer is
 * `contract/registry.ts`'s `getMechanic(id: string)`, which takes a plain string
 * precisely so a catalog/DB value naming an unimplemented mechanic degrades to `null`
 * instead of crashing a run.
 */
export const mechanicIdSchema = z.string().superRefine((value, ctx) => {
  if (!isMechanicId(value)) {
    ctx.addIssue({
      code: 'custom',
      message: `unknown mechanic "${value}" — the closed set is: ${MECHANIC_IDS.join(', ')}`,
    });
  }
});

/** 1..5, matching Forge's `lessonBlueprintSchema.difficulty` exactly. */
export const difficultySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

/** The document's AUDIENCE tier (Piaget band), not the per-item spawn tier. */
export const tierSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

/** Sanity bound on the coverage-oracle target (see `density` below). */
const MAX_DENSITY = 8;

export const gameBlueprintSchema = z.object({
  /**
   * The concept binding — GAME_ENGINE.md §8. Orphan games do not exist: this path is
   * resolved against `coursegen/curriculum/<course>/catalog.yaml` by loader.ts and, at
   * publish time, becomes the NOT NULL `games.topic_id` FK.
   */
  topic_path: topicPathSchema,
  slug: slugSchema,
  mechanic: mechanicIdSchema,
  /** What ONE thing this game consolidates. Forge parity: same bound as a lesson's. */
  micro_objective: z.string().min(1).max(300),
  /**
   * The art/skin direction handed to `author` (palette intent, setting, props) and,
   * through it, to Prism. Prose for a human and a model — never a URL, never a hex
   * colour: the palette itself is a closed set chosen inside the document.
   */
  skin_brief: z.string().min(1).max(600),
  difficulty: difficultySchema,
  tier: tierSchema,
  /**
   * Ordering within the bound topic. Maps 1:1 to the `games.position` column, which
   * carries `UNIQUE (topic_id, position)` — so loader.ts rejects a duplicate before a
   * paid run discovers it as a publish-time constraint violation. Optional: omit it
   * across a whole topic and declaration order is the order.
   */
  position: z.number().int().min(1).max(64).optional(),
});

export type GameBlueprint = z.infer<typeof gameBlueprintSchema>;

export const gamesFileSchema = z.object({
  schema_version: z.literal(1),
  /**
   * The Forge course this file binds into. Authoritative for cross-catalog resolution
   * (`coursegen/curriculum/<course>/catalog.yaml`); loader.ts additionally requires it
   * to match the containing directory's name, because a disagreement between the two
   * means one is a typo and the consequence is games silently bound to another course.
   */
  course: slugSchema,
  /**
   * OPTIONAL authoring target: how many games each covered topic should carry. Purely a
   * coverage-oracle input — a deviation is a WARNING, never an error (Forge's quota
   * posture). Absent = no per-topic expectation is asserted.
   */
  density: z.number().int().min(1).max(MAX_DENSITY).optional(),
  games: z.array(gameBlueprintSchema).min(1),
});

export type GamesFile = z.infer<typeof gamesFileSchema>;

// ---- Forge catalog readers (MINIMAL BY DESIGN) -----------------------------------
//
// Cross-catalog validation has to enumerate the real topic paths of a Forge course, and
// there are no npm workspaces (AGENTS.md §1.2), so `coursegen/src/catalog/schema.ts`
// cannot be imported. The obvious alternative — copying Forge's full catalog schema —
// would be WRONG: that schema is ~300 lines of Forge's own pedagogy rules (review
// kinds, parent_check placeholders, quota shapes) that Arcade has no business
// asserting, and every future Forge field would break Arcade's gate for no reason.
//
// So these read only the four things a topic path is made of, and nothing else. Zod
// objects are non-strict, so every other Forge field is ignored rather than rejected:
// Forge may grow freely and this keeps resolving. The one thing that DOES break Arcade
// is Forge removing/renaming a slug — which is exactly the breakage this gate exists to
// catch (gamegen/AGENTS.md: "a Forge catalog rename would break the binding with
// nothing failing").

export const courseCatalogIndexSchema = z.object({
  course: z.object({ slug: z.string().min(1) }),
  adventures: z.array(z.object({ file: z.string().min(1) })).min(1),
});

export const courseAdventureIndexSchema = z.object({
  adventure: z.object({
    slug: z.string().min(1),
    /** `"tierN"` in Forge's taxonomy — the only source of a knowable expected game tier. */
    age_tier: z.string().min(1).optional(),
  }),
  sagas: z
    .array(
      z.object({
        slug: z.string().min(1),
        topics: z.array(z.object({ slug: z.string().min(1) })).min(1),
      }),
    )
    .min(1),
});

export type CourseCatalogIndex = z.infer<typeof courseCatalogIndexSchema>;
export type CourseAdventureIndex = z.infer<typeof courseAdventureIndexSchema>;

/** Re-exported so consumers of this module need not reach into the contract copy. */
export { MECHANIC_IDS, GAME_TIERS };
