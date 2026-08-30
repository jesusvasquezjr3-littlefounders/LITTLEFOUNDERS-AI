import { z } from 'zod';
import { getConfig } from '../config.js';

/*
 * Core's side of the conversational placement intake.
 *
 * Oracle owns the model call, the injection fence and the moderation pass
 * (oracle/src/tutor/placementIntake.ts). Core owns two things Oracle must never
 * see: the learner's birth date, which is converted to a BAND here and never
 * forwarded (/AGENTS.md §1.9), and the 12+ floor, which is enforced here
 * because Core is the only service that can.
 *
 * EVERY failure returns null, and a null means "run the deterministic path".
 * That is the §1.14 rule applied to an enhancement: the intake is optional
 * infrastructure, so an Oracle that is down, slow, unconfigured or returning
 * nonsense costs a learner a nicer first question and nothing else. It must
 * never be able to stop someone from being placed.
 */

const IntakeEnvelope = z.object({
  data: z
    .object({
      available: z.boolean(),
      priorFraction: z.number().min(0).max(1).nullable(),
      reflection: z.string().max(400).nullable(),
      source: z.enum(['model', 'fallback']).nullable(),
      /**
       * Set ONLY when `source: 'fallback'` was reached because the
       * learner's own text was flagged, never for an ordinary outage. See
       * `oracle/src/tutor/placementIntake.ts`'s `PlacementIntakeResult.
       * flagged` for the full context (found by adversarial review,
       * 2026-08-30, HIGH: a self-harm disclosure during placement used to
       * be indistinguishable from Oracle simply being down).
       */
      flagged: z.object({ category: z.string(), severity: z.string() }).nullable().optional(),
    })
    .nullable(),
  error: z.object({ code: z.string(), message: z.string() }).nullable(),
});

export type AgeBand = '12-14' | '15-17' | '18+';

export interface PlacementIntakeRequest {
  courseTitle: string;
  courseSubject: string;
  outline: string[];
  locale: 'en-US' | 'es-MX' | 'pt-BR';
  ageBand: AgeBand;
  learnerText: string;
  /** Already localized by Core, which owns the i18n catalog. */
  neutralReflection: string;
}

export interface PlacementIntakeOutcome {
  priorFraction: number;
  reflection: string;
  source: 'model' | 'fallback';
  /** Present only when `source: 'fallback'` was a flagged utterance, not an outage. */
  flagged: { category: string; severity: string } | null;
}

/**
 * The 12+ gate, and the only place a birth date becomes an age band.
 *
 * Returns null for anyone under 12 and for an unknown birth date. Unknown maps
 * to "no intake" deliberately: the alternative is offering a free-text box to
 * someone who might be seven, on the strength of a missing field. §1.9's
 * carve-out is for learners we KNOW are old enough, not for ones we cannot rule
 * out.
 */
export function ageBandForIntake(birthDate: string | null | undefined, now: Date): AgeBand | null {
  if (!birthDate) return null;
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return null;
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - born.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < born.getUTCDate())) age -= 1;
  if (age < 12) return null;
  if (age <= 14) return '12-14';
  if (age <= 17) return '15-17';
  return '18+';
}

/** Calls Oracle. Null on any failure — the caller falls back to the deterministic path. */
export async function runPlacementIntake(request: PlacementIntakeRequest): Promise<PlacementIntakeOutcome | null> {
  const { ORACLE_URL, ORACLE_INTERNAL_KEY, ORACLE_TIMEOUT_MS } = getConfig();
  try {
    const res = await fetch(`${ORACLE_URL}/api/v1/tutor/placement-intake`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': ORACLE_INTERNAL_KEY,
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(ORACLE_TIMEOUT_MS),
    });
    const parsed = IntakeEnvelope.safeParse(await res.json());
    if (!res.ok || !parsed.success || parsed.data.error || !parsed.data.data) return null;
    const { available, priorFraction, reflection, source, flagged } = parsed.data.data;
    if (!available || priorFraction === null || reflection === null || source === null) return null;
    if (flagged) {
      // Loud on purpose (§1.9): this is the only signal today that a
      // learner's placement-intake text was flagged rather than Oracle
      // simply being unavailable. `request.learnerText` is deliberately NOT
      // logged here — the category/severity is the actionable part, and the
      // raw text is exactly what §1.9 minimizes exposure of.
      console.error(
        `[core] placement intake blocked a flagged utterance: ${flagged.category} (${flagged.severity})`,
      );
    }
    return { priorFraction, reflection, source, flagged: flagged ?? null };
  } catch {
    return null;
  }
}
