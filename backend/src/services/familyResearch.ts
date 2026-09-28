import { z } from 'zod';
import { isRefusal, rpc, UNAVAILABLE } from './familyLifecycle.js';

/*
 * S07.7 — D.22: the first phase of the long-horizon research instrumentation
 * (docs/operations/BLOCK-D-LONGITUDINAL-RESEARCH-PLAN.md), observational and
 * consent-gated. OD-23: no experiment runs on a minor. The database decides
 * who may say yes (a verified Tutor for a child under 18, an adult for
 * themselves), who is recorded, and deletes everything on a no. Core passes
 * the caller as actor, never a body field, and maps each refusal.
 */

/** The disclosure text a yes refers to; bump it (with the database's) when the text changes. */
export const RESEARCH_DISCLOSURE_VERSION = 1;
export const RESEARCH_COMPLETENESS_MONTHS = 3;
export const RESEARCH_MIN_TENURE_MONTHS = 6;

const Int = z.union([z.number(), z.string().regex(/^-?\d+$/)]).transform((v) => Number(v)).pipe(z.number().int().nonnegative());
const State = z.object({
  participating: z.boolean(), admitted: z.boolean(), grantor: z.enum(['tutor', 'self']).nullable(), since: z.string().nullable(),
  version: Int, adult: z.boolean(), snapshots: Int,
}).strict()
  // A participant always has a grantor and a date; nobody is recorded without a yes.
  .refine((s) => (s.participating ? s.grantor !== null && s.since !== null : s.grantor === null && s.since === null && !s.admitted));

export interface ResearchState {
  participating: boolean;
  recording: boolean;
  grantor: 'tutor' | 'self' | null;
  since: string | null;
  disclosureVersion: number;
  adult: boolean;
  months: number;
  /**
   * H-25: a Tutor's yes that lapsed at 18. The young adult is asked again (their
   * own yes or no); nothing more is recorded meanwhile.
   */
  lapsed: boolean;
}

export function toWireResearch(state: z.infer<typeof State>): ResearchState {
  return {
    participating: state.participating, recording: state.admitted, grantor: state.grantor, since: state.since,
    disclosureVersion: state.version, adult: state.adult, months: state.snapshots,
    lapsed: state.participating && state.grantor === 'tutor' && state.adult && !state.admitted,
  };
}

export function readResearch(subjectId: string) {
  return rpc('family_research_state', { p_subject: subjectId }, State);
}

export function setResearch(subjectId: string, actorId: string, participate: boolean, version: number) {
  return rpc('family_research_set_consent', { p_subject: subjectId, p_actor: actorId, p_participate: participate, p_version: version }, State);
}

/** Appendix H Part 1.4: Longitudinal-Hypothesis Data Completeness (Diagnostic), overall and for the 15+ bridge cohort. */
export async function readResearchCompleteness(months = RESEARCH_COMPLETENESS_MONTHS, tenure = RESEARCH_MIN_TENURE_MONTHS) {
  const rows = await rpc('family_research_completeness', { p_months: months, p_min_tenure_months: tenure }, z.array(z.object({
    cohort: z.enum(['all', 'bridge_age']), long_tenure: Int, enrolled: Int, measurable: Int, complete: Int,
  }).strict()).length(2));
  if (rows === UNAVAILABLE || isRefusal(rows)) return null;
  return {
    windowMonths: months,
    minTenureMonths: tenure,
    cohorts: rows.map((r) => ({
      cohort: r.cohort, longTenure: r.long_tenure, enrolled: r.enrolled, measurable: r.measurable, complete: r.complete,
      coverage: r.long_tenure > 0 ? r.enrolled / r.long_tenure : null,
      completeness: r.measurable > 0 ? r.complete / r.measurable : null,
    })),
  };
}
