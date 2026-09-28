import { z } from 'zod';
import type { Strategy } from '../context/schema.js';
import { HINT_LEVELS, HINT_LEVEL_WORDING, type HintLevel } from './hintLadder.js';

/*
 * C.17: age-band-differentiated dialogue calibration (Appendix D §3.6).
 *
 * The Mentor's hint pacing and scaffolding style follow the learner's AGE
 * BAND, the same four registers as B.23 (young child 6–9, tween 10–12, teen
 * 13–17, adult 18+):
 *
 *   young_child  a SHORTER hint ladder (re-ask → targeted hint → fill in the
 *                blank → tell: the indirect hint, which younger children
 *                cannot yet use productively, is dropped), direct modelling
 *                and "let's do this one together" framing.
 *   tween        the full ladder; recognition tied to the specific step and
 *                a choice of approach (the B.23 graduation band).
 *   teen         the full ladder in AUTONOMY-SUPPORTIVE wording (offered
 *                choices, a reason for every suggestion), a strong bias
 *                toward ASKING before changing pace (the stuck move offers an
 *                adaptation instead of changing approach unilaterally, and
 *                RESCUE/FADED ask first), and NO controlling language: "you
 *                need to", "you have to", "you must", "you should" and their
 *                es-MX / pt-BR equivalents are caught by a deterministic
 *                check on every model turn and repaired once (Reeve & Jang's
 *                coding scheme, applied across all four personas).
 *   adult        as teen, in a direct register.
 *
 * NOT ASSUMED CORRECT ON ADOPTION. Appendix D §3.6 is explicit that no
 * tutoring RCT backs these calibrations, so the SPEC requires an A/B test
 * measured through the alliance-bond and session-closing telemetry. The
 * variant arrives from Core (`dialogueCalibration` in the session context):
 * `calibrated` (the policy above) or `control` (the uniform, pre-C.17
 * register every learner had before). Core assigns it through the H.7
 * experiment runtime and, per OD-23, enrols ADULTS ONLY until Product and
 * Legal widen the ages — every minor receives the SPEC's calibrated default.
 *
 * PRIVACY. The band never enters the sealed model context (still 14 fields,
 * `tier` unchanged). The register note is a fixed, band-free style
 * instruction appended to the turn like the C.15 continuity note: it says how
 * to speak, never how old the learner is.
 */

export const DIALOGUE_BANDS = ['young_child', 'tween', 'teen', 'adult'] as const;
export type DialogueBand = (typeof DIALOGUE_BANDS)[number];
export const DIALOGUE_VARIANTS = ['calibrated', 'control'] as const;
export type DialogueVariant = (typeof DIALOGUE_VARIANTS)[number];
/**
 * How the variant was decided:
 *   experiment           enrolled in the running H.7 experiment
 *   not_eligible         the band is outside the experiment's allowed bands (every minor, per OD-23)
 *   no_consent           a kid account without active guardian analytics consent
 *   no_experiment        no running experiment for this surface
 *   runtime_unavailable  the experiment runtime could not answer (never a guess)
 *   rollback             the C.17 Stage 7 automatic rollback is in force (control for everyone)
 *   tier_fallback        an older Core sent no calibration: the band is derived from the tier
 *   operator_off         TUTOR_DIALOGUE_CALIBRATION=off (control for everyone)
 */
export const DIALOGUE_ASSIGNMENTS = [
  'experiment',
  'not_eligible',
  'no_consent',
  'no_experiment',
  'runtime_unavailable',
  'rollback',
  'tier_fallback',
  'operator_off',
] as const;
export type DialogueAssignment = (typeof DIALOGUE_ASSIGNMENTS)[number];

export const DialogueCalibrationSchema = z
  .object({
    band: z.enum(DIALOGUE_BANDS),
    variant: z.enum(DIALOGUE_VARIANTS),
    assignment: z.enum(DIALOGUE_ASSIGNMENTS),
    experimentId: z.uuid().nullable(),
  })
  .strict();
export type DialogueCalibration = z.infer<typeof DialogueCalibrationSchema>;

/**
 * An older Core sends no calibration: the band comes from the tier, and a
 * tier-3 learner (10+, with no finer age evidence here) gets the TWEEN
 * register — never the teen or adult one without evidence.
 */
export function bandFromTier(tier: 1 | 2 | 3): DialogueBand {
  return tier === 3 ? 'tween' : 'young_child';
}

/** The calibration a session runs with: Core's, else the tier fallback; `off` forces control. */
export function resolveCalibration(
  fromCore: DialogueCalibration | null | undefined,
  tier: 1 | 2 | 3,
  operatorMode: 'act' | 'off',
): DialogueCalibration {
  const base: DialogueCalibration = fromCore ?? {
    band: bandFromTier(tier),
    variant: 'calibrated',
    assignment: 'tier_fallback',
    experimentId: null,
  };
  if (operatorMode === 'off') return { ...base, variant: 'control', assignment: 'operator_off', experimentId: null };
  return base;
}

/** The younger-child ladder: the indirect hint is dropped (Appendix D §3.6, Wood/Bruner/Ross). */
export const YOUNG_CHILD_LADDER: readonly HintLevel[] = ['reask', 'misconception', 'fill_blank', 'tell'];

const YOUNG_CHILD_WORDING: Record<HintLevel, string> = {
  reask: 'say the question again in simpler words and work on it together with them ("let\'s do this one together")',
  indirect: 'give a direct, concrete clue about the next step, doing it together with them',
  misconception: 'name the wrong idea plainly and show with one small, concrete example why it does not work, doing it together',
  fill_blank: 'do the step together: say the first part yourself and let them say only the missing piece',
  tell: 'show the answer once, plainly, doing it together with them, and move on',
};

const AUTONOMY_WORDING: Record<HintLevel, string> = {
  reask: 'invite them, as an option, to put the problem in their own words, and say why that often helps',
  indirect: 'offer an indirect hint as an option ("one way to look at it..."), with the reason it might help, without naming the idea',
  misconception: 'name the idea that seems to be tripping them up, acknowledge why it is a reasonable thought, and ask what they think',
  fill_blank: 'offer a fill-in-the-blank version of the step as one option, and let them choose whether to use it',
  tell: 'state the answer once, plainly, with the reason it works, and let them choose what to do next',
};

const REGISTER_NOTES: Record<DialogueBand, string> = {
  young_child:
    'Dialogue register for this learner: short, concrete sentences and one step at a time. Model the step first and do it together ("let\'s do this one together"), then hand them the next small piece. Keep hints direct rather than hinting from far away.',
  tween:
    'Dialogue register for this learner: tie any recognition to the specific step they did, and when there is more than one way to work something out, offer them the choice of approach.',
  teen:
    'Dialogue register for this learner: autonomy-supportive. Offer real choices, give the reason behind any suggestion, acknowledge their point of view, and ASK before changing the pace, the difficulty or the approach — never change it on your own. Use invitational phrasing ("you could try", "one option is"). Never use controlling phrasing such as "you need to", "you have to", "you must" or "you should", nor the same in the session language. Keep the tone respectful and never childish.',
  adult:
    'Dialogue register for this learner: direct and respectful of their time. Offer options with the reason behind them, and never use controlling phrasing such as "you need to", "you have to", "you must" or "you should", nor the same in the session language.',
};

/** What the ask-first register adds to a strategy that would otherwise change the pace unilaterally. */
const ASK_FIRST_OVERLAY =
  'Before making anything easier or switching the approach, say in one sentence why you suggest it and ASK whether they want it; follow their answer.';
const YOUNG_CHILD_OVERLAY = 'Keep the question concrete; if they hesitate, do the first step together with them.';

export interface DialoguePolicy {
  band: DialogueBand;
  variant: DialogueVariant;
  /** The hint ladder's rungs for this session. */
  ladder: readonly HintLevel[];
  /** The model-facing wording per rung. */
  levelWording: Record<HintLevel, string>;
  /** The fixed, band-free register note appended to every model turn (null: none). */
  registerNote: string | null;
  /** Stuck skills get an accept/decline offer instead of a unilateral change of approach. */
  askBeforePacing: boolean;
  /** Model turns are checked for controlling language and repaired once. */
  controllingGate: boolean;
  /** An extra sentence for a strategy's instruction in this register, or null. */
  strategyOverlay(strategy: Strategy): string | null;
}

/**
 * The policy for a band and variant. `control` is the uniform register every
 * learner had before C.17: the full ladder, the original wording, no note,
 * no ask-first, no controlling-language gate.
 */
export function dialoguePolicy(band: DialogueBand, variant: DialogueVariant): DialoguePolicy {
  if (variant === 'control') {
    return {
      band,
      variant,
      ladder: HINT_LEVELS,
      levelWording: HINT_LEVEL_WORDING,
      registerNote: null,
      askBeforePacing: false,
      controllingGate: false,
      strategyOverlay: () => null,
    };
  }
  const autonomy = band === 'teen' || band === 'adult';
  return {
    band,
    variant,
    ladder: band === 'young_child' ? YOUNG_CHILD_LADDER : HINT_LEVELS,
    levelWording: band === 'young_child' ? YOUNG_CHILD_WORDING : autonomy ? AUTONOMY_WORDING : HINT_LEVEL_WORDING,
    registerNote: REGISTER_NOTES[band],
    askBeforePacing: autonomy,
    controllingGate: autonomy,
    strategyOverlay: (strategy) => {
      if (autonomy && (strategy === 'RESCUE' || strategy === 'FADED' || strategy === 'WORKED')) return ASK_FIRST_OVERLAY;
      if (band === 'young_child' && (strategy === 'SOCRATIC' || strategy === 'FLUENCY' || strategy === 'SPACED')) {
        return YOUNG_CHILD_OVERLAY;
      }
      return null;
    },
  };
}

/*
 * ── THE CONTROLLING-LANGUAGE CHECK ──────────────────────────────────────────
 *
 * Reeve & Jang's controlling-language markers, second person, declarative
 * sentences only: "¿necesitas ayuda?" / "do you need to see it again?" are
 * offers, not commands, so a sentence that is a question is never flagged.
 * Impersonal teaching statements ("hay que sumar", "tem que ser inteiro")
 * are not second person and are not flagged either. Read on FOLDED text
 * (case, accents and apostrophes normalised), whole words only.
 */
const phrase = (alternation: string): RegExp =>
  new RegExp(`(?<![\\p{L}\\p{N}'])(?:${alternation})(?![\\p{L}\\p{N}'])`, 'u');

const CONTROLLING = phrase(
  [
    // en
    "you (?:really |just |still )?(?:need to|have to|must|should|ought to|gotta)",
    "you(?:'ve| have) got to",
    "you'?d better",
    // es-MX (tú, voseo, usted)
    '(?:tu )?(?:tienes|tenes|tendras) que',
    '(?:tu )?(?:debes|deberias|debieras)',
    'necesitas (?:que|[a-z]+(?:ar|er|ir))',
    'usted (?:tiene que|debe|necesita)',
    'estas obligad[oa]',
    // pt-BR
    'voce (?:tem|vai ter) (?:que|de)',
    'voce (?:precisa|deve|deveria)',
    'voce e obrigad[oa]',
    'tu (?:tens|tem) (?:que|de)',
  ].join('|'),
);

function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[’‘`´]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** The first controlling-language marker in a DECLARATIVE sentence of `say`, or null. */
export function controllingLanguage(say: string): string | null {
  const sentences = say.split(/(?<=[.!?…])\s+|\n+/u);
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (sentence === '' || sentence.includes('?') || sentence.includes('¿')) continue;
    const match = CONTROLLING.exec(fold(sentence));
    if (match) return match[0];
  }
  return null;
}

/** The retry correction a caught controlling phrase earns (one attempt, like the other style repairs). */
export const CONTROLLING_LANGUAGE_CORRECTION =
  'used controlling language ("you need to", "you have to", "you must", "you should", or the same in the session language). This learner responds to choice, not orders. Say the same thing again as an invitation with a reason — "you could try…", "one option is…", "want to…?" — and keep everything else';

// ── the per-session record (C.17 Appendix F §1.2) ──────────────────────────

export const DialogueCalibrationSnapshotSchema = z
  .object({
    hintRequests: z.number().int().min(0),
    tellRequests: z.number().int().min(0),
    controllingCaught: z.number().int().min(0),
    controllingDelivered: z.number().int().min(0),
    pacingOffers: z.number().int().min(0),
    unilateralStyleChanges: z.number().int().min(0),
    // Added by the gap-fix round (C.24 tell_honored; OD-13 budget; OD-6 self-naming).
    // Defaulted so a snapshot written before them still restores.
    tellDelivered: z.number().int().min(0).default(0),
    tellWithdrawn: z.number().int().min(0).default(0),
    budgetCaught: z.number().int().min(0).default(0),
    budgetDelivered: z.number().int().min(0).default(0),
    selfNamingCaught: z.number().int().min(0).default(0),
    selfNamingDelivered: z.number().int().min(0).default(0),
  })
  .strict();
export type DialogueCalibrationSnapshot = z.infer<typeof DialogueCalibrationSnapshotSchema>;

export const EMPTY_DIALOGUE_CALIBRATION: DialogueCalibrationSnapshot = {
  hintRequests: 0,
  tellRequests: 0,
  controllingCaught: 0,
  controllingDelivered: 0,
  pacingOffers: 0,
  unilateralStyleChanges: 0,
  tellDelivered: 0,
  tellWithdrawn: 0,
  budgetCaught: 0,
  budgetDelivered: 0,
  selfNamingCaught: 0,
  selfNamingDelivered: 0,
};

export interface DialogueCalibrationReport extends DialogueCalibration {
  ladderRungs: number;
  hintRequests: number;
  tellRequests: number;
  controllingCaught: number;
  controllingDelivered: number;
  pacingOffers: number;
  unilateralStyleChanges: number;
  /** C.13: turns that answered an explicit "just tell me" (C.24 rubric.tell_honored). */
  tellDelivered: number;
  /** C.13: tell requests whose answer turn the learner cut off or a safety response replaced. */
  tellWithdrawn: number;
  /** OD-13: Mentor turns over the Copy Budget, caught on the first attempt / delivered anyway. */
  budgetCaught: number;
  budgetDelivered: number;
  /** OD-6: turns where the Mentor called itself a tutor, bot or assistant. */
  selfNamingCaught: number;
  selfNamingDelivered: number;
}

const cap = (n: number): number => Math.min(n, 10_000);

/** Counts what the policy did this session; labels and numbers only, never the learner's words. */
export class DialogueCalibrationRecorder {
  private counts: DialogueCalibrationSnapshot = { ...EMPTY_DIALOGUE_CALIBRATION };

  constructor(
    readonly calibration: DialogueCalibration,
    readonly policy: DialoguePolicy,
  ) {}

  noteHintRequest(): void {
    this.counts.hintRequests += 1;
  }

  noteTellRequest(): void {
    this.counts.tellRequests += 1;
  }

  noteControllingCaught(): void {
    this.counts.controllingCaught += 1;
  }

  noteControllingDelivered(): void {
    this.counts.controllingDelivered += 1;
  }

  noteTellDelivered(): void {
    this.counts.tellDelivered += 1;
  }

  noteTellWithdrawn(): void {
    this.counts.tellWithdrawn += 1;
  }

  noteBudgetCaught(): void {
    this.counts.budgetCaught += 1;
  }

  noteBudgetDelivered(): void {
    this.counts.budgetDelivered += 1;
  }

  noteSelfNamingCaught(): void {
    this.counts.selfNamingCaught += 1;
  }

  noteSelfNamingDelivered(): void {
    this.counts.selfNamingDelivered += 1;
  }

  noteStuckMove(kind: 'none' | 'style_change' | 'offer' | 'no_offer_left'): void {
    if (kind === 'offer') this.counts.pacingOffers += 1;
    if (kind === 'style_change') this.counts.unilateralStyleChanges += 1;
  }

  report(): DialogueCalibrationReport {
    return {
      ...this.calibration,
      ladderRungs: this.policy.ladder.length,
      hintRequests: cap(this.counts.hintRequests),
      tellRequests: cap(this.counts.tellRequests),
      controllingCaught: cap(this.counts.controllingCaught),
      controllingDelivered: cap(this.counts.controllingDelivered),
      pacingOffers: cap(this.counts.pacingOffers),
      unilateralStyleChanges: cap(this.counts.unilateralStyleChanges),
      tellDelivered: cap(this.counts.tellDelivered),
      tellWithdrawn: cap(this.counts.tellWithdrawn),
      budgetCaught: cap(this.counts.budgetCaught),
      budgetDelivered: cap(this.counts.budgetDelivered),
      selfNamingCaught: cap(this.counts.selfNamingCaught),
      selfNamingDelivered: cap(this.counts.selfNamingDelivered),
    };
  }

  snapshot(): DialogueCalibrationSnapshot {
    return { ...this.counts };
  }

  restore(snapshot: DialogueCalibrationSnapshot): void {
    this.counts = { ...EMPTY_DIALOGUE_CALIBRATION, ...snapshot };
  }
}
