import type { Outcome, Session } from './familyHubApi';

/*
 * S07.5 client API layer: D.17 (the graduated-autonomy ladder inside the
 * parent-managed system) and D.18 (a rationale requirement and communication
 * scaffolding for every approval and denial). Core is the only service
 * called; every response is shape-checked so a surface never renders a
 * state the server did not return. Nothing here authorizes anything: Core
 * and the database decide who may move a level, what needs a Tutor's tap
 * and whether a "not yet" is actionable. The transport is injected by the
 * route wrappers.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isCount = (v: unknown): v is number => isInt(v) && v >= 0;
const isInstant = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isText = (v: unknown): v is string => typeof v === 'string';
const orNull = <T>(check: (v: unknown) => v is T) => (v: unknown): v is T | null => v === null || check(v);

async function call<T>(path: string, session: Session, check: (data: unknown) => data is T, init: { method?: 'GET' | 'POST' | 'PUT'; body?: unknown } = {}): Promise<Outcome<T>> {
  if (!session.token) return { ok: false, code: 'UNAUTHORIZED' };
  const result = await session.transport(path, { token: session.token, method: init.method, body: init.body });
  if (result.error) return { ok: false, code: result.error.code };
  return check(result.data) ? { ok: true, data: result.data } : { ok: false, code: 'INVALID_RESPONSE' };
}

// ── Vocabularies and thresholds (mirrors of Core and the database) ──────────
export const TASK_REASON_CODES = ['not_finished', 'redo', 'not_suitable', 'talk_first'] as const;
export const REWARD_REASON_CODES = ['save_more', 'later_date', 'not_suitable', 'talk_first'] as const;
export const REVIEW_REWARD_REASON_CODES = ['save_more', 'not_suitable', 'talk_first'] as const;
export const LEVEL_REQUEST_REASON_CODES = ['practice_more', 'later_date', 'talk_first'] as const;
export const LEVEL_LOWER_REASON_CODES = ['practice_more', 'talk_first', 'not_suitable'] as const;
export const REASON_CODES = ['not_finished', 'redo', 'save_more', 'later_date', 'not_suitable', 'talk_first', 'practice_more'] as const;
export type ReasonCode = (typeof REASON_CODES)[number];
export const CHILD_REWARD_REASONS = ['saved_for_it', 'treat', 'need_it', 'for_someone', 'other'] as const;
export type ChildRewardReason = (typeof CHILD_REWARD_REASONS)[number];
export const DECISION_OUTCOMES = ['approved', 'self_logged', 'preapproved', 'sent_back', 'cancelled', 'denied', 'granted', 'declined', 'confirmed', 'questioned'] as const;
export type DecisionOutcome = (typeof DECISION_OUTCOMES)[number];
export const PREAPPROVED_CAP: Record<1 | 2 | 3, number> = { 1: 0, 2: 20, 3: 100 };
export const REASON_MAX_CHARS = 240;
export const CHILD_NOTE_MAX_CHARS = 140;
export const REVISIT_MAX_DAYS = 90;

const GENERIC_REASONS: readonly string[] = [
  'not now', 'not right now', 'not today', 'not this time', 'maybe later', 'maybe another time', 'some other time',
  'because i said so', 'because i say so', 'we will see', 'ask me later', 'ask again later', 'no thank you', 'just because',
  'i said no', 'no not now', 'not at the moment', 'we ll see',
  'ahora no', 'ahorita no', 'hoy no', 'mas tarde', 'tal vez despues', 'quizas despues', 'en otro momento', 'otro dia',
  'porque si', 'porque no', 'porque lo digo yo', 'porque yo lo digo', 'ya veremos', 'no por ahora', 'por ahora no',
  'luego vemos', 'despues vemos', 'pregunta despues', 'ahora no se puede',
  'agora nao', 'hoje nao', 'mais tarde', 'talvez depois', 'outro dia', 'outra hora', 'porque sim', 'porque nao',
  'porque eu disse', 'porque eu quero', 'vamos ver', 'depois a gente ve', 'por enquanto nao', 'agora nao da',
  'pergunta depois', 'nao agora',
];
const ACCENTS_FROM = 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ';
const ACCENTS_TO = 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN';

/**
 * The database's verdict on a "not yet" reason (family_reason_actionable),
 * so the Tutor hears it before sending: 12 to 240 characters, three
 * different words, never a brush-off. Pinned to
 * database/scripts/fixtures/denial-reasons.json with Core and PostgreSQL.
 */
export function reasonActionable(reason: string | null | undefined): boolean {
  const raw = (reason ?? '').replace(/^ +| +$/g, '');
  const length = [...raw].length;
  if (length < 12 || length > REASON_MAX_CHARS) return false;
  const translated = [...raw].map((ch) => {
    const at = ACCENTS_FROM.indexOf(ch);
    return at >= 0 ? ACCENTS_TO[at]! : ch;
  }).join('');
  const norm = translated.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/ +/g, ' ').trim();
  if (norm === '' || new Set(norm.split(' ')).size < 3) return false;
  return !GENERIC_REASONS.includes(norm);
}

/** Tomorrow to 90 days ahead, as the database requires for "later". */
export function revisitInRange(date: string, today = new Date()): boolean {
  if (!isDate(date)) return false;
  const base = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - base) / 86_400_000);
  return days >= 1 && days <= REVISIT_MAX_DAYS;
}

export interface NotYet { reasonCode: ReasonCode; reason: string; revisitOn: string | null }

// ── D.17: the ladder ────────────────────────────────────────────────────────
export type Level = 1 | 2 | 3;
const isLevel = (v: unknown): v is Level => v === 1 || v === 2 || v === 3;

export interface Autonomy {
  inFamily: boolean;
  level: Level;
  storedLevel: Level;
  levelSince: string | null;
  preapprovedLimit: number;
  preapprovedCap: number;
  unlocks: { selfLogContributions: boolean; selfLogMaxCoins: number | null };
  next: null | {
    level: Level;
    eligible: boolean;
    age: { value: number | null; min: number; ok: boolean };
    approved: { value: number; min: number };
    notApproved: { value: number; maxPct: number; ok: boolean };
    daysAtLevel: { value: number; min: number; ok: boolean };
    windowDays: number;
  };
  request: null | { id: string; level: Level; note: string | null; createdAt: string };
}

export interface LevelChange { id: string; fromLevel: Level; toLevel: Level; fromLimit: number; toLimit: number; by: 'tutor' | 'child' | 'staff' | 'system'; byMe: boolean; reasonCode: string | null; reason: string | null; createdAt: string }

const isNext = (v: unknown): v is NonNullable<Autonomy['next']> => isObject(v) && isLevel(v.level) && typeof v.eligible === 'boolean'
  && isObject(v.age) && orNull(isInt)(v.age.value) && isInt(v.age.min) && typeof v.age.ok === 'boolean'
  && isObject(v.approved) && isCount(v.approved.value) && isCount(v.approved.min)
  && isObject(v.notApproved) && isCount(v.notApproved.value) && isCount(v.notApproved.maxPct) && typeof v.notApproved.ok === 'boolean'
  && isObject(v.daysAtLevel) && isCount(v.daysAtLevel.value) && isCount(v.daysAtLevel.min) && typeof v.daysAtLevel.ok === 'boolean'
  && isCount(v.windowDays)
  // An "eligible" that contradicts its own parts is refused, never shown.
  && (!v.eligible || (v.age.ok && v.approved.value >= v.approved.min && v.notApproved.ok && v.daysAtLevel.ok));

export const isAutonomy = (v: unknown): v is Autonomy => isObject(v) && typeof v.inFamily === 'boolean' && isLevel(v.level) && isLevel(v.storedLevel)
  && orNull(isInstant)(v.levelSince) && isCount(v.preapprovedLimit) && isCount(v.preapprovedCap) && v.preapprovedLimit <= v.preapprovedCap
  && isObject(v.unlocks) && typeof v.unlocks.selfLogContributions === 'boolean' && orNull(isCount)(v.unlocks.selfLogMaxCoins)
  && (v.next === null || isNext(v.next))
  && (v.request === null || (isObject(v.request) && isUuid(v.request.id) && isLevel(v.request.level) && orNull(isText)(v.request.note) && isInstant(v.request.createdAt)));

const isChange = (v: unknown): v is LevelChange => isObject(v) && isUuid(v.id) && isLevel(v.fromLevel) && isLevel(v.toLevel) && isCount(v.fromLimit) && isCount(v.toLimit)
  && ['tutor', 'child', 'staff', 'system'].includes(v.by as string) && typeof v.byMe === 'boolean' && orNull(isText)(v.reasonCode) && orNull(isText)(v.reason) && isInstant(v.createdAt);

export interface AutonomyView { autonomy: Autonomy; changes: LevelChange[] }
const isAutonomyView = (v: unknown): v is AutonomyView => isObject(v) && isAutonomy(v.autonomy) && Array.isArray(v.changes) && v.changes.every(isChange);

export function fetchMyAutonomy(session: Session) {
  return call('/tasks/autonomy', session, isAutonomyView);
}

export function askForLevel(note: string | null, session: Session) {
  return call('/tasks/autonomy/request', session, (d): d is { requestId: string } => isObject(d) && isUuid(d.requestId), { method: 'POST', body: { note } });
}

export function stepDown(session: Session) {
  return call('/tasks/autonomy/step-down', session, (d): d is { level: Level } => isObject(d) && isLevel(d.level), { method: 'POST', body: {} });
}

export function fetchKidAutonomy(kidId: string, session: Session) {
  return call(`/tasks/${encodeURIComponent(kidId)}/autonomy`, session, isAutonomyView);
}

export function setKidAutonomy(kidId: string, input: { level: Level; preapprovedLimit: number; reasonCode?: string | null; reason?: string | null }, session: Session) {
  return call(`/tasks/${encodeURIComponent(kidId)}/autonomy`, session,
    (d): d is { level: Level } => isObject(d) && d.level === input.level, { method: 'PUT', body: input });
}

export function decideLevelRequest(requestId: string, input: { grant: true; preapprovedLimit: number } | ({ grant: false } & NotYet), session: Session) {
  return call(`/tasks/autonomy/requests/${encodeURIComponent(requestId)}/decide`, session,
    (d): d is { status: 'granted' | 'declined' } => isObject(d) && d.status === (input.grant ? 'granted' : 'declined'), { method: 'POST', body: input });
}

// ── D.18: the Tutor's queue ─────────────────────────────────────────────────
export interface QueueChore { id: string; assignedTo: string; title: string; rewardCoins: number; kind: 'contribution' | 'bonus'; status: 'open' | 'done'; hasEvidence: boolean; requiresEvidence: boolean; childNote: string | null }
export interface QueueReward { id: string; kidUserId: string; title: string | null; cost: number | null; childReasonKind: ChildRewardReason | null; childNote: string | null; createdAt: string }
export interface Decision {
  id: string; subject: 'task' | 'redemption' | 'level_request'; subjectId: string | null; title: string | null; outcome: DecisionOutcome;
  by: 'tutor' | 'child'; byMe: boolean; reasonCode: ReasonCode | null; reason: string | null; revisitOn: string | null; reviewsDecisionId: string | null; createdAt: string;
}
export interface QueueNudge { id: string; kidUserId: string; origin: 'pattern' | 'child'; denials: number | null; decision: Decision | null; createdAt: string }
export interface QueueLevelRequest { id: string; kidUserId: string; level: Level; note: string | null; createdAt: string }
export interface Queue {
  chores: QueueChore[]; openChores: QueueChore[]; rewards: QueueReward[];
  reviews: (Decision & { kidUserId: string })[]; nudges: QueueNudge[]; levelRequests: QueueLevelRequest[];
}

const isChore = (status: 'open' | 'done') => (v: unknown): v is QueueChore => isObject(v) && isUuid(v.id) && isUuid(v.assignedTo) && isText(v.title)
  && isCount(v.rewardCoins) && (v.kind === 'contribution' || v.kind === 'bonus') && v.status === status && typeof v.hasEvidence === 'boolean'
  && typeof v.requiresEvidence === 'boolean' && orNull(isText)(v.childNote);
const isReward = (v: unknown): v is QueueReward => isObject(v) && isUuid(v.id) && isUuid(v.kidUserId) && v.status === 'requested' && orNull(isText)(v.title)
  && orNull(isCount)(v.cost) && (v.childReasonKind === null || CHILD_REWARD_REASONS.includes(v.childReasonKind as ChildRewardReason))
  && orNull(isText)(v.childNote) && isInstant(v.createdAt);
export const isDecision = (v: unknown): v is Decision => isObject(v) && isUuid(v.id) && ['task', 'redemption', 'level_request'].includes(v.subject as string)
  && orNull(isUuid)(v.subjectId) && orNull(isText)(v.title) && DECISION_OUTCOMES.includes(v.outcome as DecisionOutcome)
  && (v.by === 'tutor' || v.by === 'child') && typeof v.byMe === 'boolean'
  && (v.reasonCode === null || REASON_CODES.includes(v.reasonCode as ReasonCode)) && orNull(isText)(v.reason) && orNull(isDate)(v.revisitOn)
  && orNull(isUuid)(v.reviewsDecisionId) && isInstant(v.createdAt)
  // A "not yet" without its reason is refused, never shown (D.18).
  && (!['sent_back', 'cancelled', 'denied', 'declined', 'questioned'].includes(v.outcome as string) || (v.reasonCode !== null && isText(v.reason) && v.reason.length > 0));
const isNudge = (v: unknown): v is QueueNudge => isObject(v) && isUuid(v.id) && isUuid(v.kidUserId) && (v.origin === 'pattern' || v.origin === 'child')
  && orNull(isCount)(v.denials) && v.status === 'open' && (v.decision === null || isDecision(v.decision)) && isInstant(v.createdAt);
const isLevelRequest = (v: unknown): v is QueueLevelRequest => isObject(v) && isUuid(v.id) && isUuid(v.kidUserId) && isLevel(v.level) && orNull(isText)(v.note) && isInstant(v.createdAt);

export const isQueue = (v: unknown): v is Queue => isObject(v)
  && Array.isArray(v.chores) && v.chores.every(isChore('done')) && Array.isArray(v.openChores) && v.openChores.every(isChore('open'))
  && Array.isArray(v.rewards) && v.rewards.every(isReward)
  && Array.isArray(v.reviews) && v.reviews.every((r) => isDecision(r) && isObject(r) && isUuid(r.kidUserId) && ['self_logged', 'preapproved'].includes(r.outcome))
  && Array.isArray(v.nudges) && v.nudges.every(isNudge) && Array.isArray(v.levelRequests) && v.levelRequests.every(isLevelRequest);

export function fetchDecisionQueue(session: Session, kidId?: string) {
  return call(`/tasks/decisions/queue${kidId ? `?kidId=${encodeURIComponent(kidId)}` : ''}`, session, isQueue);
}

const isTaskAnswer = (status: string) => (d: unknown): d is { task: { id: string; status: string } } => isObject(d) && isObject(d.task) && d.task.status === status;

export function approveChore(taskId: string, session: Session) {
  return call(`/tasks/${encodeURIComponent(taskId)}/approve`, session, isTaskAnswer('approved'), { method: 'POST', body: {} });
}

export function sendBackChore(taskId: string, notYet: Pick<NotYet, 'reasonCode' | 'reason'>, session: Session) {
  return call(`/tasks/${encodeURIComponent(taskId)}/send-back`, session, isTaskAnswer('open'), { method: 'POST', body: { reasonCode: notYet.reasonCode, reason: notYet.reason } });
}

export function removeChore(taskId: string, notYet: Pick<NotYet, 'reasonCode' | 'reason'>, session: Session) {
  return call(`/tasks/${encodeURIComponent(taskId)}/cancel`, session, isTaskAnswer('cancelled'), { method: 'POST', body: { reasonCode: notYet.reasonCode, reason: notYet.reason } });
}

export function decideReward(redemptionId: string, input: { approve: true } | ({ approve: false } & NotYet), session: Session) {
  return call(`/tasks/redemptions/${encodeURIComponent(redemptionId)}/decide`, session,
    (d): d is { decided: true; status: 'approved' | 'denied' } => isObject(d) && d.decided === true && d.status === (input.approve ? 'approved' : 'denied'),
    { method: 'POST', body: input });
}

export function reviewSelfDirected(decisionId: string, input: { outcome: 'confirmed' } | ({ outcome: 'questioned' } & Pick<NotYet, 'reasonCode' | 'reason'>), session: Session) {
  return call(`/tasks/decisions/${encodeURIComponent(decisionId)}/review`, session,
    (d): d is { outcome: string } => isObject(d) && d.outcome === input.outcome, { method: 'POST', body: input });
}

export function closeNudge(nudgeId: string, outcome: 'talked' | 'dismissed', session: Session) {
  return call(`/tasks/nudges/${encodeURIComponent(nudgeId)}/close`, session,
    (d): d is { status: string } => isObject(d) && d.status === outcome, { method: 'POST', body: { outcome } });
}

// ── D.18: the child's side ──────────────────────────────────────────────────
export interface MyDecision extends Decision { notYet: boolean; talk: 'open' | 'talked' | 'dismissed' | null }
const isMyDecision = (v: unknown): v is MyDecision => isDecision(v) && isObject(v) && typeof v.notYet === 'boolean'
  && (v.talk === null || ['open', 'talked', 'dismissed'].includes(v.talk as string));

export function fetchMyDecisions(session: Session) {
  return call('/tasks/decisions/mine', session, (d): d is { decisions: MyDecision[] } => isObject(d) && Array.isArray(d.decisions) && d.decisions.every(isMyDecision));
}

export function askToTalk(decisionId: string, session: Session) {
  return call(`/tasks/decisions/${encodeURIComponent(decisionId)}/talk`, session, (d): d is { nudgeId: string } => isObject(d) && isUuid(d.nudgeId), { method: 'POST', body: {} });
}

/** The child marks a chore done (with their own note); the level may count it at once. */
export function markChoreDone(taskId: string, input: { localDate: string; note: string | null }, session: Session) {
  return call(`/tasks/${encodeURIComponent(taskId)}/complete`, session,
    (d): d is { task: Record<string, unknown>; selfLogged: boolean; milestone?: unknown } => isObject(d) && isObject(d.task)
      && typeof d.selfLogged === 'boolean' && (d.task.status === (d.selfLogged ? 'approved' : 'done')),
    { method: 'POST', body: { localDate: input.localDate, ...(input.note ? { note: input.note } : {}) } });
}

/** The child asks for a reward with their reason; the level may approve it at once. */
export function askForReward(catalogId: string, input: { reasonKind: ChildRewardReason; note: string | null }, session: Session) {
  return call('/tasks/redemptions', session,
    (d): d is { redemption: Record<string, unknown>; preapproved: boolean } => isObject(d) && isObject(d.redemption) && typeof d.preapproved === 'boolean'
      && d.redemption.status === (d.preapproved ? 'approved' : 'requested'),
    { method: 'POST', body: { catalogId, reasonKind: input.reasonKind, ...(input.note ? { note: input.note } : {}) } });
}
