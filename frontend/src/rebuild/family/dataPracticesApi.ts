import type { Outcome, Session } from './familyHubApi';

/*
 * S10.3 client API layer (OD-9 section 4.2): the data practices the rebuild
 * introduced and a migrated child's specific consent to each. Core is the only
 * service called; every response is shape-checked, so a surface never renders
 * a state the server did not return. Nothing here authorizes anything: the
 * database decides who may say yes and whether a practice applies.
 */

export const PRACTICE_KINDS = ['analytics_event_class', 'mentor_memory_type', 'learner_record', 'sharing_surface', 'research'] as const;
export type PracticeKind = (typeof PRACTICE_KINDS)[number];

/** The practices the copy knows; a key outside this list is refused, never shown as a raw key. */
export const PRACTICE_KEYS = [
  'analytics.learning_quality_events', 'analytics.motivation_events', 'analytics.engagement_heartbeats', 'analytics.family_money_events',
  'analytics.achievement_share_initiations', 'analytics.mentor_behavioral_telemetry', 'analytics.mentor_integrity_evidence',
  'mentor.disposition_profile', 'mentor.alliance_record', 'mentor.dialogue_calibration',
  'learning.decision_journal', 'sharing.social_connections', 'sharing.learning_family_bridge', 'sharing.cooperative_goals',
  'research.family_longitudinal',
] as const;
export type PracticeKey = (typeof PRACTICE_KEYS)[number];

export interface DataPractice {
  key: PracticeKey; kind: PracticeKind; requirement: string; disclosureVersion: number; ownFlow: boolean;
  consented: boolean; applies: boolean; grantor: 'tutor' | 'self' | null; since: string | null; selfGrantable: boolean;
}
export interface DataPracticeState { migrated: boolean; hasTutor: boolean; practices: DataPractice[] }

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isInstant = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));

const isPractice = (v: unknown): v is DataPractice => isObject(v) && PRACTICE_KEYS.includes(v.key as PracticeKey)
  && PRACTICE_KINDS.includes(v.kind as PracticeKind) && typeof v.requirement === 'string'
  && typeof v.disclosureVersion === 'number' && Number.isInteger(v.disclosureVersion) && v.disclosureVersion >= 1
  && typeof v.ownFlow === 'boolean' && typeof v.consented === 'boolean' && typeof v.applies === 'boolean' && typeof v.selfGrantable === 'boolean'
  && (v.grantor === null || v.grantor === 'tutor' || v.grantor === 'self') && (v.since === null || isInstant(v.since))
  // A consent recorded here always has its grantor and date.
  && (v.consented && !v.ownFlow ? v.grantor !== null && v.since !== null : v.grantor === null && v.since === null);

export const isDataPracticeState = (v: unknown): v is DataPracticeState => isObject(v) && typeof v.migrated === 'boolean'
  && typeof v.hasTutor === 'boolean' && Array.isArray(v.practices) && v.practices.every(isPractice);

async function call(path: string, session: Session, check: (data: unknown) => data is DataPracticeState, init: { method?: 'GET' | 'PUT'; body?: unknown } = {}): Promise<Outcome<DataPracticeState>> {
  if (!session.token) return { ok: false, code: 'UNAUTHORIZED' };
  const result = await session.transport(path, { token: session.token, method: init.method, body: init.body });
  if (result.error) return { ok: false, code: result.error.code };
  return check(result.data) ? { ok: true, data: result.data } : { ok: false, code: 'INVALID_RESPONSE' };
}

export type PracticeAnswer = { grant: true; disclosureVersion: number } | { grant: false };

const answered = (key: PracticeKey, answer: PracticeAnswer) => (d: unknown): d is DataPracticeState => isDataPracticeState(d)
  && d.practices.some((p) => p.key === key && p.consented === answer.grant);

export function fetchKidDataPractices(kidId: string, session: Session) {
  return call(`/family-hub/kids/${encodeURIComponent(kidId)}/data-practices`, session, isDataPracticeState);
}

export function setKidDataPractice(kidId: string, key: PracticeKey, answer: PracticeAnswer, session: Session) {
  return call(`/family-hub/kids/${encodeURIComponent(kidId)}/data-practices/${encodeURIComponent(key)}`, session, answered(key, answer), { method: 'PUT', body: answer });
}

export function fetchMyDataPractices(session: Session) {
  return call('/family-hub/data-practices/me', session, isDataPracticeState);
}

export function setMyDataPractice(key: PracticeKey, answer: PracticeAnswer, session: Session) {
  return call(`/family-hub/data-practices/me/${encodeURIComponent(key)}`, session, answered(key, answer), { method: 'PUT', body: answer });
}

/** The groups a Tutor reads, in order; research is answered in its own section (D.22). */
export const PRACTICE_GROUPS = ['analytics_event_class', 'mentor_memory_type', 'learner_record', 'sharing_surface'] as const;
export type PracticeGroup = (typeof PRACTICE_GROUPS)[number];
