import { z } from 'zod';
import { isRefusal, rpc, UNAVAILABLE } from './familyLifecycle.js';

/*
 * S10.3 — OD-9 section 4.2: parental consent carries over only for the
 * practices it covered. Every data practice the rebuild introduced is listed
 * in public.data_practices; a migrated child (marked by the OD-9 consent step
 * at the cutover) is subject to one only with a fresh, specific consent. The
 * database decides everything: who may say yes (a verified Tutor; a
 * self-registered 13-17 with no Tutor for the analytics classes only), whether
 * a consent still counts, and whether a practice applies. Triggers at the
 * tables enforce it for Core and Oracle alike; Core also asks before a write
 * that carries no child identifier. Core passes the caller as actor, never a
 * body field, and maps each named refusal. A failed read is never a yes.
 */

export const DATA_PRACTICE_KINDS = ['analytics_event_class', 'mentor_memory_type', 'sharing_surface', 'learner_record', 'research'] as const;

const PracticeRow = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_.-]{2,63}$/),
  kind: z.enum(DATA_PRACTICE_KINDS),
  requirement: z.string().min(1).max(16),
  version: z.number().int().min(1),
  source: z.enum(['data_practice_consents', 'family_research_consents']),
  consented: z.boolean(),
  applies: z.boolean(),
  grantor: z.enum(['tutor', 'self']).nullable(),
  since: z.string().nullable(),
  self_grantable: z.boolean(),
}).strict()
  // A consent recorded here always has its grantor and date; research is answered in its own flow.
  .refine((p) => (p.consented && p.source === 'data_practice_consents' ? p.grantor !== null && p.since !== null : p.grantor === null && p.since === null));

const State = z.object({ migrated: z.boolean(), has_tutor: z.boolean(), practices: z.array(PracticeRow) }).strict();
export type DataPracticeStateRow = z.infer<typeof State>;

export interface DataPracticeView {
  key: string;
  kind: (typeof DATA_PRACTICE_KINDS)[number];
  requirement: string;
  disclosureVersion: number;
  ownFlow: boolean;
  consented: boolean;
  applies: boolean;
  grantor: 'tutor' | 'self' | null;
  since: string | null;
  selfGrantable: boolean;
}

export interface DataPracticeState { migrated: boolean; hasTutor: boolean; practices: DataPracticeView[] }

export function toWireDataPractices(state: DataPracticeStateRow): DataPracticeState {
  return {
    migrated: state.migrated,
    hasTutor: state.has_tutor,
    practices: state.practices.map((p) => ({
      key: p.key, kind: p.kind, requirement: p.requirement, disclosureVersion: p.version, ownFlow: p.source !== 'data_practice_consents',
      consented: p.consented, applies: p.applies, grantor: p.grantor, since: p.since, selfGrantable: p.self_grantable,
    })),
  };
}

export function readDataPractices(subjectId: string) {
  return rpc('data_practice_state', { p_subject: subjectId }, State);
}

export function setDataPractice(subjectId: string, actorId: string, practice: string, grant: boolean, version: number) {
  return rpc('data_practice_set_consent', { p_subject: subjectId, p_actor: actorId, p_practice: practice, p_grant: grant, p_version: version }, State);
}

/**
 * Whether a practice applies to this subject right now. Anything but a clear
 * yes (a refusal, an unreachable database) is a no: the write is skipped.
 */
export async function dataPracticeApplies(subjectId: string, practice: string): Promise<boolean> {
  const answer = await rpc('data_practice_applies', { p_subject: subjectId, p_practice: practice }, z.boolean());
  return answer !== UNAVAILABLE && !isRefusal(answer) && answer === true;
}

/**
 * The same question when the caller must tell a clear no apart from an
 * unreadable answer (to name the refusal): true or false only when the
 * database answered, null otherwise.
 */
export async function readDataPracticeApplies(subjectId: string, practice: string): Promise<boolean | null> {
  const answer = await rpc('data_practice_applies', { p_subject: subjectId, p_practice: practice }, z.boolean());
  return answer === UNAVAILABLE || isRefusal(answer) ? null : answer;
}
