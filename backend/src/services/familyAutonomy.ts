import { z } from 'zod';
import { serviceRest } from './supabaseRest.js';
import { isRefusal, rpc, UNAVAILABLE, type Refusal } from './familyLifecycle.js';

/*
 * S07.5 — D.17 (a graduated-autonomy ladder inside the parent-managed system)
 * and D.18 (a rationale requirement and communication scaffolding for every
 * approval and denial).
 *
 * The database is the boundary (the family_autonomy_* and family_decision_*
 * migrations): it decides who may move a level, whether a chore or a reward
 * needs a Tutor's tap, and whether a "not yet" carries a reason the child can
 * act on, for every writer. Core answers first with the same rules so a
 * caller gets a precise error before any write, passes the CALLER as actor
 * (never a body field), and maps each named database refusal honestly. A
 * transport failure is UNAVAILABLE and is never read as a decision.
 */

export { isRefusal, UNAVAILABLE };
export type { Refusal };

const UUID = z.string().uuid();
const eu = (value: string) => encodeURIComponent(UUID.parse(value));
const inIds = (ids: string[]) => `in.(${ids.map((id) => eu(id)).join(',')})`;
/** PostgREST renders bigint as a number or a numeric string; accept both, never NaN. */
const Int = z.union([z.number(), z.string().regex(/^-?\d+$/)]).transform((v) => Number(v)).pipe(z.number().int());

// ── Thresholds (the Block D threshold log pins every value) ─────────────────
export const AUTONOMY_LEVEL2_MIN_AGE = 8;
export const AUTONOMY_LEVEL2_MIN_APPROVED = 10;
export const AUTONOMY_LEVEL2_MAX_NOT_APPROVED_PCT = 25;
export const AUTONOMY_LEVEL2_PREAPPROVED_CAP = 20;
export const AUTONOMY_LEVEL3_MIN_AGE = 12;
export const AUTONOMY_LEVEL3_MIN_APPROVED = 20;
export const AUTONOMY_LEVEL3_MAX_NOT_APPROVED_PCT = 20;
export const AUTONOMY_LEVEL3_MIN_DAYS_AT_LEVEL2 = 28;
export const AUTONOMY_LEVEL3_PREAPPROVED_CAP = 100;
export const AUTONOMY_LEVEL3_SELF_LOG_MAX_COINS = 100;
export const AUTONOMY_RECORD_WINDOW_DAYS = 60;
export const AUTONOMY_AUTO_STEP_DOWN_QUESTIONED = 3;
export const AUTONOMY_AUTO_STEP_DOWN_WINDOW_DAYS = 30;
export const AUTONOMY_PROGRESSION_WINDOW_DAYS = 30;
export const DECISION_REASON_MIN_CHARS = 12;
export const DECISION_REASON_MAX_CHARS = 240;
export const DECISION_REASON_MIN_WORDS = 3;
export const DECISION_REVISIT_MAX_DAYS = 90;
export const CHILD_NOTE_MAX_CHARS = 140;
export const TALK_NUDGE_DENIALS = 3;
export const TALK_NUDGE_WINDOW_DAYS = 14;

export const PREAPPROVED_CAP: Record<1 | 2 | 3, number> = { 1: 0, 2: AUTONOMY_LEVEL2_PREAPPROVED_CAP, 3: AUTONOMY_LEVEL3_PREAPPROVED_CAP };

// ── D.18: the vocabularies ──────────────────────────────────────────────────
export const TASK_REASON_CODES = ['not_finished', 'redo', 'not_suitable', 'talk_first'] as const;
export const REWARD_REASON_CODES = ['save_more', 'later_date', 'not_suitable', 'talk_first'] as const;
export const LEVEL_REQUEST_REASON_CODES = ['practice_more', 'later_date', 'talk_first'] as const;
export const LEVEL_LOWER_REASON_CODES = ['practice_more', 'talk_first', 'not_suitable'] as const;
export const CHILD_REWARD_REASONS = ['saved_for_it', 'treat', 'need_it', 'for_someone', 'other'] as const;
export const DECISION_OUTCOMES = ['approved', 'self_logged', 'preapproved', 'sent_back', 'cancelled', 'denied', 'granted', 'declined', 'confirmed', 'questioned'] as const;
export type DecisionOutcome = (typeof DECISION_OUTCOMES)[number];
export const NOT_YET_OUTCOMES: readonly DecisionOutcome[] = ['sent_back', 'cancelled', 'denied', 'declined', 'questioned'];

/*
 * The brush-offs D.18 names ("not just 'not now'") and their equivalents in
 * the three locales, normalized exactly as family_reason_actionable() does.
 * Mirrored by the client; all three are pinned to
 * database/scripts/fixtures/denial-reasons.json.
 */
export const GENERIC_REASONS: readonly string[] = [
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

/** PostgreSQL btrim(text): spaces only, never tabs or newlines. */
const btrim = (text: string) => text.replace(/^ +| +$/g, '');
const codePoints = (text: string) => [...text].length;

/** The same verdict as family_reason_actionable(): specific enough to act on, never a brush-off. */
export function reasonActionable(reason: string | null | undefined): boolean {
  const raw = btrim(reason ?? '');
  const length = codePoints(raw);
  if (length < DECISION_REASON_MIN_CHARS || length > DECISION_REASON_MAX_CHARS) return false;
  const translated = [...raw].map((ch) => {
    const at = ACCENTS_FROM.indexOf(ch);
    return at >= 0 ? ACCENTS_TO[at]! : ch;
  }).join('');
  const norm = translated.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/ +/g, ' ').trim();
  if (norm === '') return false;
  if (new Set(norm.split(' ')).size < DECISION_REASON_MIN_WORDS) return false;
  return !GENERIC_REASONS.includes(norm);
}

// ── Reading ─────────────────────────────────────────────────────────────────
const Eligibility = z.object({
  level: z.number().int(), in_family: z.boolean(), age: z.number().int().nullable(), min_age: z.number().int(), age_ok: z.boolean(),
  approved: Int, min_approved: z.number().int(), not_approved: Int, max_not_approved_pct: z.number().int(), share_ok: z.boolean(),
  days_at_level: z.number().int(), min_days: z.number().int(), days_ok: z.boolean(), window_days: z.number().int(), eligible: z.boolean(),
}).strict();

const Status = z.object({
  in_family: z.boolean(),
  level: z.number().int().min(1).max(3),
  preapproved_limit: z.number().int().min(0),
  stored_level: z.number().int().min(1).max(3),
  level_since: z.string().nullable(),
  preapproved_cap: z.number().int().min(0),
  self_log_contributions: z.boolean(),
  self_log_max_coins: z.number().int().nullable(),
  next: Eligibility.nullable(),
  request: z.object({ id: z.string().uuid(), level: z.number().int(), note: z.string().nullable(), created_at: z.string() }).strict().nullable(),
}).strict();
export type AutonomyStatus = z.infer<typeof Status>;

export async function readAutonomyStatus(kidId: string): Promise<AutonomyStatus | null> {
  const parsed = Status.safeParse(await serviceRest<unknown>('/rpc/family_autonomy_status', {
    method: 'POST', body: JSON.stringify({ p_kid: UUID.parse(kidId) }),
  }));
  return parsed.success ? parsed.data : null;
}

/** The wire shape of the ladder: what the level lets the child do, and the rule for the next one. */
export function toWireAutonomy(s: AutonomyStatus) {
  return {
    inFamily: s.in_family,
    level: s.level,
    storedLevel: s.stored_level,
    levelSince: s.level_since,
    preapprovedLimit: s.preapproved_limit,
    preapprovedCap: s.preapproved_cap,
    unlocks: { selfLogContributions: s.self_log_contributions, selfLogMaxCoins: s.self_log_max_coins },
    next: s.next ? {
      level: s.next.level,
      eligible: s.next.eligible,
      age: { value: s.next.age, min: s.next.min_age, ok: s.next.age_ok },
      approved: { value: s.next.approved, min: s.next.min_approved },
      notApproved: { value: s.next.not_approved, maxPct: s.next.max_not_approved_pct, ok: s.next.share_ok },
      daysAtLevel: { value: s.next.days_at_level, min: s.next.min_days, ok: s.next.days_ok },
      windowDays: s.next.window_days,
    } : null,
    request: s.request ? { id: s.request.id, level: s.request.level, note: s.request.note, createdAt: s.request.created_at } : null,
  };
}

const ChangeRows = z.array(z.object({
  id: z.string().uuid(), from_level: z.number().int(), to_level: z.number().int(), from_limit: z.number().int(), to_limit: z.number().int(),
  actor_user_id: z.string().uuid().nullable(), actor_kind: z.enum(['tutor', 'child', 'staff', 'system']),
  reason_code: z.string().nullable(), reason: z.string().nullable(), created_at: z.string(),
}).strict());
export type ChangeRow = z.infer<typeof ChangeRows>[number];

export async function listAutonomyChanges(kidId: string, limit = 10): Promise<ChangeRow[] | null> {
  const parsed = ChangeRows.safeParse(await serviceRest<unknown>(
    `/family_autonomy_changes?kid_user_id=eq.${eu(kidId)}&select=id,from_level,to_level,from_limit,to_limit,actor_user_id,actor_kind,reason_code,reason,created_at&order=created_at.desc&limit=${limit}`,
  ));
  return parsed.success ? parsed.data : null;
}

/** Who changed a level is shared as the child, "a Tutor" (or "you"), the LittleFounders team, or the ladder's own rule. */
export function toWireChange(c: ChangeRow, callerId: string) {
  return {
    id: c.id, fromLevel: c.from_level, toLevel: c.to_level, fromLimit: c.from_limit, toLimit: c.to_limit,
    by: c.actor_kind, byMe: c.actor_user_id === callerId, reasonCode: c.reason_code, reason: c.reason, createdAt: c.created_at,
  };
}

const DecisionRows = z.array(z.object({
  id: z.string().uuid(), kid_user_id: z.string().uuid(), subject: z.enum(['task', 'redemption', 'level_request']),
  task_id: z.string().uuid().nullable(), redemption_id: z.string().uuid().nullable(), level_request_id: z.string().uuid().nullable(),
  prior_status: z.string(), outcome: z.enum(DECISION_OUTCOMES), reviews_decision_id: z.string().uuid().nullable(),
  actor_user_id: z.string().uuid().nullable(), actor_kind: z.enum(['tutor', 'child']),
  reason_code: z.string().nullable(), reason: z.string().nullable(), revisit_on: z.string().nullable(), legacy: z.boolean(), created_at: z.string(),
}).strict());
export type DecisionRow = z.infer<typeof DecisionRows>[number];
const DECISION_FIELDS = 'id,kid_user_id,subject,task_id,redemption_id,level_request_id,prior_status,outcome,reviews_decision_id,actor_user_id,actor_kind,reason_code,reason,revisit_on,legacy,created_at';

export async function listDecisions(kidIds: string[], opts: { sinceDays: number; outcomes?: readonly DecisionOutcome[]; limit?: number }): Promise<DecisionRow[] | null> {
  if (kidIds.length === 0) return [];
  const since = new Date(Date.now() - opts.sinceDays * 86_400_000).toISOString();
  const outcomes = opts.outcomes ? `&outcome=in.(${opts.outcomes.join(',')})` : '';
  const parsed = DecisionRows.safeParse(await serviceRest<unknown>(
    `/family_decisions?kid_user_id=${inIds(kidIds)}&created_at=gte.${encodeURIComponent(since)}${outcomes}&select=${DECISION_FIELDS}&order=created_at.desc&limit=${opts.limit ?? 100}`,
  ));
  return parsed.success ? parsed.data : null;
}

export async function getDecision(id: string): Promise<DecisionRow | null | typeof UNAVAILABLE> {
  const parsed = DecisionRows.safeParse(await serviceRest<unknown>(`/family_decisions?id=eq.${eu(id)}&select=${DECISION_FIELDS}&limit=1`));
  if (!parsed.success) return UNAVAILABLE;
  return parsed.data[0] ?? null;
}

/** The ids of the self-directed decisions already reviewed. */
export async function reviewedIds(decisionIds: string[]): Promise<Set<string> | null> {
  if (decisionIds.length === 0) return new Set();
  const parsed = z.array(z.object({ reviews_decision_id: z.string().uuid() }).strict()).safeParse(await serviceRest<unknown>(
    `/family_decisions?reviews_decision_id=${inIds(decisionIds)}&select=reviews_decision_id`,
  ));
  return parsed.success ? new Set(parsed.data.map((r) => r.reviews_decision_id)) : null;
}

const NudgeRows = z.array(z.object({
  id: z.string().uuid(), kid_user_id: z.string().uuid(), origin: z.enum(['pattern', 'child']), decision_id: z.string().uuid().nullable(),
  denials: z.number().int().nullable(), status: z.enum(['open', 'talked', 'dismissed']), created_at: z.string(), closed_at: z.string().nullable(),
}).strict());
export type NudgeRow = z.infer<typeof NudgeRows>[number];

export async function listNudges(kidIds: string[], opts: { openOnly: boolean; sinceDays?: number }): Promise<NudgeRow[] | null> {
  if (kidIds.length === 0) return [];
  const status = opts.openOnly ? '&status=eq.open' : '';
  const since = opts.sinceDays ? `&created_at=gte.${encodeURIComponent(new Date(Date.now() - opts.sinceDays * 86_400_000).toISOString())}` : '';
  const parsed = NudgeRows.safeParse(await serviceRest<unknown>(
    `/family_talk_nudges?kid_user_id=${inIds(kidIds)}${status}${since}&select=id,kid_user_id,origin,decision_id,denials,status,created_at,closed_at&order=created_at.desc&limit=50`,
  ));
  return parsed.success ? parsed.data : null;
}

const RequestRows = z.array(z.object({
  id: z.string().uuid(), kid_user_id: z.string().uuid(), requested_level: z.number().int(), child_note: z.string().nullable(),
  status: z.enum(['pending', 'granted', 'declined']), created_at: z.string(),
}).strict());
export type LevelRequestRow = z.infer<typeof RequestRows>[number];

export async function listPendingLevelRequests(kidIds: string[]): Promise<LevelRequestRow[] | null> {
  if (kidIds.length === 0) return [];
  const parsed = RequestRows.safeParse(await serviceRest<unknown>(
    `/family_autonomy_requests?kid_user_id=${inIds(kidIds)}&status=eq.pending&select=id,kid_user_id,requested_level,child_note,status,created_at`,
  ));
  return parsed.success ? parsed.data : null;
}

export async function getLevelRequestKid(id: string): Promise<string | null | typeof UNAVAILABLE> {
  const parsed = z.array(z.object({ kid_user_id: z.string().uuid() }).strict()).safeParse(await serviceRest<unknown>(
    `/family_autonomy_requests?id=eq.${eu(id)}&select=kid_user_id&limit=1`,
  ));
  if (!parsed.success) return UNAVAILABLE;
  return parsed.data[0]?.kid_user_id ?? null;
}

export async function getNudgeKid(id: string): Promise<string | null | typeof UNAVAILABLE> {
  const parsed = z.array(z.object({ kid_user_id: z.string().uuid() }).strict()).safeParse(await serviceRest<unknown>(
    `/family_talk_nudges?id=eq.${eu(id)}&select=kid_user_id&limit=1`,
  ));
  if (!parsed.success) return UNAVAILABLE;
  return parsed.data[0]?.kid_user_id ?? null;
}

// ── Writing (every write is one RPC; the database decides) ─────────────────
const nul = (value: string | null | undefined) => value ?? null;

export function markTaskDone(taskId: string, kidId: string, completedOn: string | null, note: string | null) {
  return rpc('family_task_mark_done', { p_task: UUID.parse(taskId), p_kid: UUID.parse(kidId), p_completed_on: completedOn, p_note: note },
    z.object({ status: z.enum(['done', 'approved']), self_logged: z.boolean() }).strict());
}

export function selfLogTask(taskId: string, kidId: string) {
  return rpc('family_task_self_log', { p_task: UUID.parse(taskId), p_kid: UUID.parse(kidId) }, z.boolean());
}

export function decideTask(input: { taskId: string; actorId: string; outcome: 'approved' | 'sent_back' | 'cancelled'; reasonCode?: string | null; reason?: string | null }) {
  return rpc('family_decide_task', {
    p_task: UUID.parse(input.taskId), p_actor: UUID.parse(input.actorId), p_outcome: input.outcome, p_reason_code: nul(input.reasonCode), p_reason: nul(input.reason),
  }, z.enum(['approved', 'open', 'cancelled']));
}

export function requestRedemption(kidId: string, catalogId: string, reasonKind: string, note: string | null) {
  return rpc('family_request_redemption', { p_kid: UUID.parse(kidId), p_catalog: UUID.parse(catalogId), p_reason_kind: reasonKind, p_note: note },
    z.object({ id: z.string().uuid(), status: z.enum(['requested', 'approved']), preapproved: z.boolean() }).strict());
}

export function decideRedemptionWithReason(input: { redemptionId: string; actorId: string; approve: boolean; reasonCode?: string | null; reason?: string | null; revisitOn?: string | null }) {
  return rpc('family_decide_redemption', {
    p_redemption: UUID.parse(input.redemptionId), p_actor: UUID.parse(input.actorId), p_approve: input.approve,
    p_reason_code: nul(input.reasonCode), p_reason: nul(input.reason), p_revisit_on: nul(input.revisitOn),
  }, z.enum(['approved', 'denied']));
}

export function reviewDecision(input: { decisionId: string; actorId: string; outcome: 'confirmed' | 'questioned'; reasonCode?: string | null; reason?: string | null }) {
  return rpc('family_review_decision', {
    p_decision: UUID.parse(input.decisionId), p_actor: UUID.parse(input.actorId), p_outcome: input.outcome, p_reason_code: nul(input.reasonCode), p_reason: nul(input.reason),
  }, z.enum(['confirmed', 'questioned']));
}

export function setAutonomy(input: { kidId: string; actorId: string; level: number; limit: number; reasonCode?: string | null; reason?: string | null }) {
  return rpc('family_autonomy_set', {
    p_kid: UUID.parse(input.kidId), p_actor: UUID.parse(input.actorId), p_level: input.level, p_limit: input.limit,
    p_reason_code: nul(input.reasonCode), p_reason: nul(input.reason),
  }, z.number().int());
}

export function stepDownAutonomy(kidId: string) {
  return rpc('family_autonomy_step_down', { p_kid: UUID.parse(kidId) }, z.number().int());
}

export function staffLowerAutonomy(kidId: string, staffId: string, level: number, reason: string) {
  return rpc('family_autonomy_staff_lower', { p_kid: UUID.parse(kidId), p_staff: UUID.parse(staffId), p_level: level, p_reason: reason }, z.number().int());
}

export function requestLevel(kidId: string, note: string | null) {
  return rpc('family_autonomy_request_level', { p_kid: UUID.parse(kidId), p_note: note }, z.string().uuid());
}

export function decideLevelRequest(input: { requestId: string; actorId: string; grant: boolean; limit?: number | null; reasonCode?: string | null; reason?: string | null; revisitOn?: string | null }) {
  return rpc('family_autonomy_decide_request', {
    p_request: UUID.parse(input.requestId), p_actor: UUID.parse(input.actorId), p_grant: input.grant, p_limit: input.limit ?? null,
    p_reason_code: nul(input.reasonCode), p_reason: nul(input.reason), p_revisit_on: nul(input.revisitOn),
  }, z.enum(['granted', 'declined']));
}

export function requestTalk(kidId: string, decisionId: string) {
  return rpc('family_talk_request', { p_kid: UUID.parse(kidId), p_decision: UUID.parse(decisionId) }, z.string().uuid());
}

export function closeTalk(nudgeId: string, actorId: string, outcome: 'talked' | 'dismissed') {
  return rpc('family_talk_close', { p_nudge: UUID.parse(nudgeId), p_actor: UUID.parse(actorId), p_outcome: outcome }, z.enum(['talked', 'dismissed']));
}

// ── Appendix H metrics (analytics staff) ────────────────────────────────────
const since = (date: Date) => JSON.stringify({ p_since: date.toISOString() });

export async function readAutonomyProgression(from: Date) {
  const rows = z.array(z.object({ level: z.number().int(), judged: Int, progressed: Int, waiting: Int }).strict()).safeParse(
    await serviceRest<unknown>('/rpc/family_autonomy_progression', { method: 'POST', body: JSON.stringify({ p_since: from.toISOString(), p_window_days: AUTONOMY_PROGRESSION_WINDOW_DAYS }) }));
  const downs = z.array(z.object({ actor_kind: z.enum(['tutor', 'child', 'staff', 'system']), step_downs: Int }).strict()).safeParse(
    await serviceRest<unknown>('/rpc/family_autonomy_step_downs', { method: 'POST', body: since(from) }));
  if (!rows.success || !downs.success || rows.data.length !== 2 || downs.data.length !== 4) return null;
  return { levels: rows.data, stepDowns: downs.data };
}

export async function readTalkNudgeRate(from: Date) {
  const rows = z.array(z.object({ patterns: Int, nudged: Int, child_asks: Int, talked: Int, dismissed: Int, still_open: Int }).strict()).length(1).safeParse(
    await serviceRest<unknown>('/rpc/family_talk_nudge_rate', { method: 'POST', body: since(from) }));
  return rows.success ? rows.data[0]! : null;
}

export async function readDenialActionability(from: Date) {
  const rows = z.array(z.object({ denials: Int, structured: Int, admitted: Int, scored: Int, actionable: Int }).strict()).length(1).safeParse(
    await serviceRest<unknown>('/rpc/family_denial_actionability', { method: 'POST', body: since(from) }));
  return rows.success ? rows.data[0]! : null;
}

export async function readDenialReasonSample(from: Date, limit: number) {
  const rows = z.array(z.object({
    decision_id: z.string().uuid(), subject: z.enum(['task', 'redemption', 'level_request']), outcome: z.enum(DECISION_OUTCOMES),
    reason_code: z.string().nullable(), reason: z.string(), created_at: z.string(),
  }).strict()).safeParse(await serviceRest<unknown>('/rpc/family_denial_reason_sample', {
    method: 'POST', body: JSON.stringify({ p_since: from.toISOString(), p_limit: limit }),
  }));
  return rows.success ? rows.data : null;
}

export function scoreDenialReason(decisionId: string, staffId: string, actionable: boolean) {
  return rpc('family_score_denial_reason', { p_decision: UUID.parse(decisionId), p_staff: UUID.parse(staffId), p_actionable: actionable }, z.boolean());
}

// ── Titles for a list of decisions (what the family reads, never an id) ────
const IdTitle = z.array(z.object({ id: z.string().uuid(), title: z.string() }).strict());

/** The chore or reward title behind each decision; null = unreadable. A level request has no title. */
export async function subjectTitles(decisions: DecisionRow[]): Promise<Map<string, string> | null> {
  const taskIds = [...new Set(decisions.flatMap((d) => (d.task_id ? [d.task_id] : [])))];
  const redemptionIds = [...new Set(decisions.flatMap((d) => (d.redemption_id ? [d.redemption_id] : [])))];
  const titles = new Map<string, string>();
  if (taskIds.length > 0) {
    const tasks = IdTitle.safeParse(await serviceRest<unknown>(`/tasks?id=${inIds(taskIds)}&select=id,title`));
    if (!tasks.success) return null;
    for (const t of tasks.data) titles.set(t.id, t.title);
  }
  if (redemptionIds.length > 0) {
    const reds = z.array(z.object({ id: z.string().uuid(), catalog_id: z.string().uuid() }).strict()).safeParse(
      await serviceRest<unknown>(`/redemptions?id=${inIds(redemptionIds)}&select=id,catalog_id`));
    if (!reds.success) return null;
    const catalogIds = [...new Set(reds.data.map((r) => r.catalog_id))];
    const items = catalogIds.length > 0 ? IdTitle.safeParse(await serviceRest<unknown>(`/redemption_catalog?id=${inIds(catalogIds)}&select=id,title`)) : { success: true as const, data: [] };
    if (!items.success) return null;
    const byCatalog = new Map(items.data.map((c) => [c.id, c.title]));
    for (const r of reds.data) {
      const title = byCatalog.get(r.catalog_id);
      if (title) titles.set(r.id, title);
    }
  }
  return titles;
}

/** Catalog titles and costs by id (the rewards waiting for a Tutor). */
export async function catalogItems(ids: string[]): Promise<Map<string, { title: string; cost: number }> | null> {
  if (ids.length === 0) return new Map();
  const parsed = z.array(z.object({ id: z.string().uuid(), title: z.string(), cost: z.number().int() }).strict()).safeParse(
    await serviceRest<unknown>(`/redemption_catalog?id=${inIds([...new Set(ids)])}&select=id,title,cost`));
  return parsed.success ? new Map(parsed.data.map((c) => [c.id, { title: c.title, cost: c.cost }])) : null;
}
