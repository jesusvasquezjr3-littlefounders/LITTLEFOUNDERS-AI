import { z } from 'zod';

/*
 * THE PRIVACY BOUNDARY (/ORACLE.md §4.1).
 *
 * This file is the complete, enumerated set of things that may reach a
 * third-party pedagogical model about a learner. If a field is not declared
 * here it cannot travel, and `.strict()` is what makes that a runtime fact
 * rather than a code-review habit.
 *
 * WHY .strict() AND NOT .passthrough() OR A PLAIN OBJECT: Zod's default drops
 * unknown keys silently, which reads as safe and is not — a silent drop means
 * a developer who adds `birthDate` to the builder sees their feature "work"
 * (it just has no effect) and ships. `.strict()` REJECTS, loudly, in a test,
 * at the boundary. This is the same lesson §1.14 records about defaults: the
 * dangerous failure is the one that looks like success.
 *
 * The forbidden list is stated POSITIVELY in /ORACLE.md §4.1 for the same
 * reason a prompt must name what it wants: a prohibition expressed only by
 * omission gets filled in with a default.
 *
 * Adding ANY field here requires: a /ORACLE.md §4.1 table row, an entry in
 * /LEGAL/AI_TUTOR_LEGAL_REVIEW.md, and a test. It is not a refactor.
 */

export const CHARACTER_IDS = ['dina', 'liruf', 'rho', 'zara'] as const;
export const LOCALES = ['en-US', 'es-MX', 'pt-BR'] as const;

/** The closed adaptation vocabulary (/ORACLE.md §11), mirrored by migration 0047. */
export const ADAPTATIONS = [
  'slower_pacing',
  'more_examples',
  'less_text',
  'more_visual',
  'repeat_before_advancing',
] as const;

/** The closed intent vocabulary from the offer screen (/ORACLE.md §9.2). */
export const INTENTS = ['course_topic', 'weak_skill', 'faq', 'open', 'diagnostic'] as const;

/** Data Intel's explainable recommendation (/ORACLE.md, Data Intel contract). */
export const RECOMMENDED_ACTIONS = ['remediate', 'practice', 'retrieve', 'continue'] as const;

/**
 * A nickname, not a name.
 *
 * The charset is deliberately narrow. A free-form 24 characters is a channel:
 * it is learner-controlled text that lands inside the model's context, so it
 * is an injection vector AND a place to hide a surname. Letters (including
 * accented ones), digits, spaces and a couple of joiners is everything a
 * nickname legitimately needs.
 */
export const NicknameSchema = z
  .string()
  .trim()
  .min(1)
  .max(24)
  .regex(
    /^[\p{L}\p{N}][\p{L}\p{N} '_-]*$/u,
    'A nickname may only contain letters, numbers, spaces, apostrophes, hyphens and underscores',
  );

export const SkillStateSchema = z
  .object({
    skillKey: z.string().min(1).max(128),
    masteryProbability: z.number().min(0).max(1),
    uncertainty: z.number().min(0).max(1),
    evidenceCount: z.number().int().nonnegative(),
    recommendedAction: z.enum(RECOMMENDED_ACTIONS),
    reasonCode: z.string().min(1).max(64),
  })
  .strict();

export const CourseContextSchema = z
  .object({
    courseId: z.uuid().nullable(),
    courseTitle: z.string().min(1).max(160).nullable(),
    topicId: z.uuid().nullable(),
    topicTitle: z.string().min(1).max(160).nullable(),
  })
  .strict();

export const TurnSchema = z
  .object({
    speaker: z.enum(['learner', 'tutor']),
    text: z.string().max(2_000),
  })
  .strict();

/**
 * The complete model context. Nothing else reaches a third-party model.
 *
 * Note what is NOT here and cannot be added by accident: userId, sessionId,
 * email, displayName, birthDate, age, avatar, city, school, family, or any
 * identifier that could be joined back to a person outside our infrastructure.
 * The model does not need to know WHO it is teaching, only WHAT they need.
 */
export const TutorContextSchema = z
  .object({
    nickname: NicknameSchema,
    /** Derived age band, never the birth date and never an exact age. */
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    locale: z.enum(LOCALES),
    character: z.enum(CHARACTER_IDS),
    intent: z.enum(INTENTS),
    adaptations: z.array(z.enum(ADAPTATIONS)).max(ADAPTATIONS.length),
    courseContext: CourseContextSchema.nullable(),
    skillStates: z.array(SkillStateSchema).max(12),
    /** THIS session only, truncated. Never a prior session's transcript. */
    turnHistory: z.array(TurnSchema).max(40),
  })
  .strict();

export type TutorContext = z.infer<typeof TutorContextSchema>;
export type SkillState = z.infer<typeof SkillStateSchema>;
export type TutorIntent = (typeof INTENTS)[number];
export type Adaptation = (typeof ADAPTATIONS)[number];
export type CharacterId = (typeof CHARACTER_IDS)[number];
export type Locale = (typeof LOCALES)[number];

/**
 * The ONE function allowed to produce a model-bound context.
 *
 * It throws rather than returning a partial object: a context that failed
 * validation is not a degraded context, it is a bug, and §1.14's rule is that
 * failure must stay distinguishable from emptiness. Callers do not get to
 * decide to send it anyway.
 */
export function sealContext(candidate: unknown): TutorContext {
  const parsed = TutorContextSchema.safeParse(candidate);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    throw new Error(`[oracle] refusing to send an invalid model context — ${detail}`);
  }
  return parsed.data;
}

/*
 * THE SECOND DOOR (/ORACLE.md §7.3).
 *
 * Tier-3 generation sends a different, much smaller thing to the model: a
 * BRIEF describing what activity to write, not a description of a learner.
 * It gets its own `.strict()` gate rather than reusing `TutorContextSchema`,
 * for two reasons:
 *
 * 1. It genuinely carries different fields, and forcing it through the
 *    conversational schema would mean loosening that schema — making the
 *    tighter of the two gates weaker to accommodate the looser use.
 * 2. Every path that reaches the model must pass A seal. Two schemas is fine;
 *    an unsealed path is not, and `boundaries.test.ts` fails on one.
 *
 * Note what is NOT here, and could plausibly have been: the nickname. A
 * generated exercise has no reason to address the learner by name, and a
 * nickname inside authored content would outlive the session it was written
 * in — it would end up in `tutor_segments.payload`, in a replay, and in a
 * post-hoc review queue.
 */
export const GenerationBriefSchema = z
  .object({
    skillKey: z.string().min(1).max(128),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    locale: z.enum(LOCALES),
    difficulty: z.number().int().min(1).max(5),
    /** The tutor's own already-moderated line. Not learner text. */
    framing: z.string().min(1).max(240),
    rationale: z.string().min(1).max(400),
    allowedTypes: z.array(z.string().min(1).max(64)).min(1).max(32),
    /** TUTOR turns only, so the generator does not repeat itself. */
    recentTutorLines: z.array(z.string().max(700)).max(6),
  })
  .strict();

export type GenerationBrief = z.infer<typeof GenerationBriefSchema>;

/** The one function allowed to produce a generation-bound brief. Throws, like `sealContext`. */
export function sealGenerationBrief(candidate: unknown): GenerationBrief {
  const parsed = GenerationBriefSchema.safeParse(candidate);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    throw new Error(`[oracle] refusing to send an invalid generation brief — ${detail}`);
  }
  return parsed.data;
}

/**
 * Derives the tier band from a birth date (/ORACLE.md §4.1).
 *
 * The birth date is read INSIDE our infrastructure and converted here; the
 * date itself never leaves this function's caller. An unknown birth date
 * yields tier 2, the middle band — not tier 3, which would hand a seven year
 * old adult vocabulary on the strength of a missing field.
 */
export function tierForBirthDate(birthDate: string | null | undefined, now: Date): 1 | 2 | 3 {
  if (!birthDate) return 2;
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return 2;
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - born.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < born.getUTCDate())) age -= 1;
  if (age < 0) return 2;
  if (age <= 7) return 1;
  if (age <= 9) return 2;
  return 3;
}
