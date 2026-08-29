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

/** The closed step vocabulary of a lesson plan (/ORACLE.md §9.3). */
export const PLAN_STEPS = ['warmup', 'explain', 'practice', 'check', 'stretch'] as const;

/**
 * The closed strategy vocabulary of the v3 pedagogical controller
 * (/ORACLE.md, Tutor v3; blueprint §9.2). The CONTROLLER picks one per turn
 * from mastery bands and events — the model only performs it.
 */
export const STRATEGIES = [
  'DIRECT',
  'WORKED',
  'FADED',
  'SOCRATIC',
  'FLUENCY',
  'SPACED',
  'PROBE',
  'REMEDIATE',
  'RESCUE',
  'ELABORATE',
  'TRANSFER',
  'CELEBRATE',
] as const;

/**
 * The v3 pedagogy state, as the model is allowed to see it (/ORACLE.md §4.1,
 * owner decision 2026-08-28 — the Tutor v3 blueprint adoption).
 *
 * SERVER-DERIVED, same privacy class as `planState`: the strategy and mode
 * are closed enums the controller chose; `kcObjective` and
 * `misconceptionHint` are OUR catalog text (kc.objective and
 * misconception.remediation_hint from migration 0052, localized), bounded,
 * and never learner text by construction — the misconception was DETECTED by
 * arithmetic against the item's own numbers, and what travels is our
 * catalogued wording about the wrong idea, not anything the learner said.
 */
export /**
 * THE ACTIVITY THE LEARNER IS LOOKING AT RIGHT NOW.
 *
 * The tutor used to narrate activities it could not see. It asks the ladder
 * for a SKILL; the ladder picks whichever authored segment on that topic best
 * fits the difficulty, and the tutor was told only the id and the skill key —
 * never a word of what the thing actually says. So it improvised, and the
 * improvisation drifted: observed on 2026-08-29, the tutor framed a task as
 * "you be the cashier, choose how much change to give", the catalog served
 * "the compass costs $12, make exactly that amount", and on success the tutor
 * congratulated the learner for "giving the exact change" they had never
 * given. Every word of that is wrong in a way a child notices.
 *
 * IT IS OUR OWN CATALOG TEXT, not the learner's. `prompt` is the authored
 * question already on the learner's screen — the same class of data as
 * `courseContext`'s titles, written by us, published by us, and containing
 * nothing about the person reading it. Nothing the LEARNER typed or did with
 * the activity travels here: not their answer, not their score, not their
 * taps. §4.1 row + legal §2.2 item 13.
 */
const OpenActivitySchema = z
  .object({
    /** The engine's segment type, e.g. `coin_count` — a closed vocabulary. */
    type: z.string().min(1).max(64),
    /** The authored prompt already on screen. Truncated; never learner text. */
    prompt: z.string().min(1).max(400),
  })
  .strict();

const PedagogyStateSchema = z
  .object({
    strategy: z.enum(STRATEGIES),
    /** 0 = none … 3 = maximum support. The controller's scaffolding level. */
    scaffolding: z.number().int().min(0).max(3),
    /** One objective sentence from OUR kc catalog, localized. */
    kcObjective: z.string().min(1).max(200),
    mode: z.enum(['review', 'new', 'remediation', 'probe']),
    /** OUR catalogued remediation wording, or null when nothing is diagnosed. */
    misconceptionHint: z.string().min(1).max(240).nullable(),
  })
  .strict();

/**
 * The lesson plan's state, as the model is allowed to see it.
 *
 * SERVER-DERIVED, carrying no learner data the other fields do not already
 * carry: the objective is composed from our own course/topic titles and the
 * closed intent vocabulary, the steps are a closed enum, and the stuck fields
 * name a skill key that `skillStates` already names. It exists so the model's
 * teaching has a spine the SERVER owns — which step we are on, what has been
 * tried — instead of a vibe reconstructed from the transcript every turn.
 */
export const PlanStateSchema = z
  .object({
    /** Composed from catalog titles + closed vocab. Never learner text. */
    objective: z.string().min(1).max(200),
    steps: z.array(z.enum(PLAN_STEPS)).min(1).max(8),
    stepIndex: z.number().int().min(0).max(7),
    /** The skill the learner keeps missing, when there is one. */
    stuckSkillKey: z.string().min(1).max(128).nullable(),
    stuckCount: z.number().int().min(0).max(10),
    /** Explanation styles already tried against the stuck skill. */
    stylesTried: z.array(z.enum(ADAPTATIONS)).max(ADAPTATIONS.length),
  })
  .strict();

/**
 * One prior conversation, as a strictly-shaped digest (/ORACLE.md §4.1,
 * owner sign-off 2026-08-28).
 *
 * This is the ONE deliberate exception to "never a previous session's data",
 * and its shape is what makes the exception narrow: no transcript, no learner
 * words, no dates — a catalog topic title, skill keys `skillStates` already
 * exposes, a closed outcome vocabulary, two bounded counters and a day count.
 * Enough for "last time we worked on saving and the division kept tripping
 * you"; not enough to reconstruct a single sentence anyone said.
 */
export const PreviousSessionSchema = z
  .object({
    /** Course/topic title from OUR catalog, or null for an open chat. */
    topic: z.string().min(1).max(160).nullable(),
    skillKeys: z.array(z.string().min(1).max(128)).max(5),
    outcome: z.enum(['completed', 'left', 'stopped']),
    gradedCorrect: z.number().int().min(0).max(50),
    gradedTotal: z.number().int().min(0).max(50),
    daysAgo: z.number().int().min(0).max(90),
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
    /** THIS session only, truncated. Never a prior session's TRANSCRIPT. */
    turnHistory: z.array(TurnSchema).max(40),
    /** The server-owned lesson plan projection. Null before one exists. */
    planState: PlanStateSchema.nullable(),
    /**
     * Up to three prior conversations as strict digests — topic, skills,
     * outcome, counters. NEVER their transcripts (see PreviousSessionSchema).
     * Owner sign-off 2026-08-28; §4.1 row + legal §2.2 item 11.
     */
    previousSessions: z.array(PreviousSessionSchema).max(3),
    /**
     * The v3 controller's state for THIS turn. Null while the v3 brain is
     * off, unseeded, or the session has no plan — the model then teaches as
     * v2 did. §4.1 row + legal §2.2 item 12.
     */
    pedagogy: PedagogyStateSchema.nullable(),
    /**
     * The activity currently on the learner's screen, or null when there is
     * none. Our own authored text, so the tutor stops narrating something it
     * cannot see. §4.1 row + legal §2.2 item 13.
     */
    openActivity: OpenActivitySchema.nullable(),
    /**
     * V4: the curated learner brief (LEARNER + PEDAGOGY stores, /ORACLE.md
     * §20). Derived from this learner's own past sessions by the post-session
     * review, hard-capped, ledgered, guardian-readable. The only prose about
     * the CHILD (rather than the session) that reaches the model.
     */
    learnerBrief: z
      .object({
        learner: z.string().min(1).max(1400).nullable(),
        pedagogy: z.string().min(1).max(2200).nullable(),
      })
      .strict()
      .nullable(),
  })
  .strict();

export type TutorContext = z.infer<typeof TutorContextSchema>;
export type PlanState = z.infer<typeof PlanStateSchema>;
export type PedagogyState = z.infer<typeof PedagogyStateSchema>;
export type Strategy = (typeof STRATEGIES)[number];
export type PreviousSession = z.infer<typeof PreviousSessionSchema>;
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
