import { z } from 'zod';
import { BANDS, LENS_KEYS, MENTORS, type RunReport } from '../../games/runReport.js';
import { isRefusal, rpc, UNAVAILABLE } from '../familyLifecycle.js';
import { serviceRest } from '../supabaseRest.js';
import { PLATFORM_LIMITS, type PlayLimits } from './limits.js';
import { metricsOf } from './lens.js';

/*
 * Core's reads and writes of the game records (database: game_records and
 * game_records_functions). Core is the only writer and always uses the service
 * role; every call names the learner from the session, never from a body.
 *
 * The database owns the rules that must be atomic or must survive a race: the
 * daily session cap, run idempotency and bests, heartbeat crediting, the save's
 * compare-and-set and the guardian's verified link. Core validates every answer
 * and treats anything it cannot read as UNAVAILABLE, never as an empty success
 * (a read that fails must not look like "no sessions today", or a learner would
 * be admitted past a cap the database could not count).
 */

export type Unavailable = typeof UNAVAILABLE;

const UUID = z.string().uuid();
const eu = (value: string) => encodeURIComponent(UUID.parse(value));
const es = (value: string) => encodeURIComponent(value);

/** A database refusal (named, SCREAMING_SNAKE) or an unreadable answer, as one value. */
export type GameFailure = { refused: string } | Unavailable;
export type GameResult<T> = { ok: true; value: T } | { ok: false; failure: GameFailure };

async function call<T>(fn: string, args: Record<string, unknown>, shape: z.ZodType<T>): Promise<GameResult<T>> {
  const answer = await rpc(fn, args, shape);
  if (answer === UNAVAILABLE) return { ok: false, failure: UNAVAILABLE };
  if (isRefusal(answer)) return { ok: false, failure: answer };
  return { ok: true, value: answer as T };
}

// ── Catalog ────────────────────────────────────────────────────────────────

const Catalog = z.array(z.object({
  game_id: z.string(),
  status: z.enum(['live', 'hidden', 'retired']),
  min_band: z.enum(BANDS),
}));
export interface CatalogEntry { gameId: string; status: 'live' | 'hidden' | 'retired'; minBand: (typeof BANDS)[number] }

/** Every game in the catalog; null when the catalog cannot be read. */
export async function readCatalog(): Promise<CatalogEntry[] | null> {
  const parsed = Catalog.safeParse(await serviceRest<unknown>('/game_catalog?select=game_id,status,min_band&order=game_id.asc'));
  return parsed.success ? parsed.data.map((row) => ({ gameId: row.game_id, status: row.status, minBand: row.min_band })) : null;
}

// ── Limits ─────────────────────────────────────────────────────────────────

const LimitsRow = z.array(z.object({
  max_sessions_per_day: z.number().int().min(0).max(2),
  max_session_minutes: z.number().int().min(5).max(25),
}));

/** What a guardian lowered, or the platform ceiling when nothing is set; null when unreadable. */
export async function readPlayLimits(userId: string): Promise<PlayLimits | null> {
  const parsed = LimitsRow.safeParse(await serviceRest<unknown>(
    `/learner_play_limits?user_id=eq.${eu(userId)}&select=max_sessions_per_day,max_session_minutes&limit=1`,
  ));
  if (!parsed.success) return null;
  const row = parsed.data[0];
  return row ? { maxSessionsPerDay: row.max_sessions_per_day, maxSessionMinutes: row.max_session_minutes } : { ...PLATFORM_LIMITS };
}

const LimitsAnswer = z.object({ maxSessionsPerDay: z.number().int().min(0).max(2), maxSessionMinutes: z.number().int().min(5).max(25) }).strict();

export function readLimitsAsGuardian(guardianId: string, kidId: string) {
  return call('game_play_limits_read', { p_guardian: guardianId, p_kid: kidId }, LimitsAnswer);
}

export function writeLimitsAsGuardian(guardianId: string, kidId: string, limits: PlayLimits) {
  return call('game_play_limits_write', {
    p_guardian: guardianId, p_kid: kidId, p_sessions: limits.maxSessionsPerDay, p_minutes: limits.maxSessionMinutes,
  }, LimitsAnswer);
}

// ── Sessions ───────────────────────────────────────────────────────────────

const SessionRow = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  game_id: z.string(),
  session_ref: z.string(),
  started_at: z.string(),
  expires_at: z.string(),
  ended_at: z.string().nullable(),
  close_reason: z.enum(['soft', 'hard', 'idle', 'left']).nullable(),
  active_seconds: z.number().int().min(0),
  max_minutes: z.number().int().min(5).max(25),
  mentor: z.enum(MENTORS).nullable(),
  locale: z.enum(['en-US', 'es-MX', 'pt-BR']),
  band: z.enum(BANDS),
});
export type SessionRow = z.infer<typeof SessionRow>;

const SESSION_COLUMNS = 'id,user_id,game_id,session_ref,started_at,expires_at,ended_at,close_reason,active_seconds,max_minutes,mentor,locale,band';

/** How many sessions the learner has started since `sinceIso` (their local midnight); null when unreadable. */
export async function countSessionsSince(userId: string, gameId: string, sinceIso: string): Promise<number | null> {
  const rows = await serviceRest<unknown>(
    `/game_sessions?user_id=eq.${eu(userId)}&game_id=eq.${es(gameId)}&started_at=gte.${es(sinceIso)}&select=id&limit=10`,
  );
  return Array.isArray(rows) ? rows.length : null;
}

export interface StartSessionInput {
  userId: string;
  gameId: string;
  sinceIso: string;
  cap: number;
  sessionRef: string;
  mentor: string | null;
  locale: 'en-US' | 'es-MX' | 'pt-BR';
  band: (typeof BANDS)[number];
  clientBuild: string;
  maxMinutes: number;
  expiresAtIso: string;
}

/** The atomic start. `cap_reached` is the database's answer that the daily cap is used up; null is unreadable. */
export async function startSessionChecked(input: StartSessionInput): Promise<{ status: 'created'; session: SessionRow } | { status: 'cap_reached' } | null> {
  const answer = await rpc('start_game_session_checked', {
    p_user_id: input.userId, p_game_id: input.gameId, p_since: input.sinceIso, p_cap: input.cap,
    p_session_ref: input.sessionRef, p_mentor: input.mentor, p_locale: input.locale, p_band: input.band,
    p_client_build: input.clientBuild, p_max_minutes: input.maxMinutes, p_expires_at: input.expiresAtIso,
  }, z.array(SessionRow));
  if (answer === UNAVAILABLE || isRefusal(answer)) return null;
  const session = answer[0];
  return session ? { status: 'created', session } : { status: 'cap_reached' };
}

/** The learner's own session, `'none'` when there is no such session for them; null when unreadable. */
export async function readOwnSession(userId: string, gameId: string, sessionId: string): Promise<SessionRow | 'none' | null> {
  const parsed = z.array(SessionRow).safeParse(await serviceRest<unknown>(
    `/game_sessions?id=eq.${eu(sessionId)}&user_id=eq.${eu(userId)}&game_id=eq.${es(gameId)}&select=${SESSION_COLUMNS}&limit=1`,
  ));
  if (!parsed.success) return null;
  return parsed.data[0] ?? 'none';
}

const Credit = z.object({
  active_seconds: z.number().int().min(0),
  prev_active_at: z.string(),
  now: z.string(),
  expires_at: z.string(),
  ended_at: z.string().nullable(),
  close_reason: z.enum(['soft', 'hard', 'idle', 'left']).nullable(),
  max_minutes: z.number().int().min(5).max(25),
});
export type CreditedSession = z.infer<typeof Credit>;

export function creditSession(sessionId: string, userId: string, credit: boolean, maxCreditSeconds: number) {
  return call('credit_game_session', {
    p_session_id: sessionId, p_user_id: userId, p_credit: credit, p_max_credit_seconds: maxCreditSeconds,
  }, Credit);
}

export function endSession(sessionId: string, userId: string, reason: 'soft' | 'hard' | 'idle' | 'left') {
  return call('end_game_session', { p_session_id: sessionId, p_user_id: userId, p_reason: reason }, z.boolean());
}

// ── Runs, bests, save ──────────────────────────────────────────────────────

const RunAnswer = z.object({
  run_id: z.string().uuid(),
  duplicate: z.boolean(),
  new_best: z.boolean(),
  lens: z.enum(LENS_KEYS),
  ai_line_at: z.string().nullable(),
});
export type RecordedRun = z.infer<typeof RunAnswer>;

export function recordRun(input: { sessionId: string; userId: string; gameId: string; report: RunReport; lens: (typeof LENS_KEYS)[number] }) {
  const { report } = input;
  return call('record_game_run', {
    p_session_id: input.sessionId, p_user_id: input.userId, p_game_id: input.gameId, p_run_key: report.runKey,
    p_mode: report.mode, p_track_id: report.trackId, p_character: report.character, p_kart_body: report.kartBody,
    p_speed_class: report.speedClass, p_finish_ms: report.finishMs, p_best_lap_ms: report.bestLapMs, p_lap_ms: report.lapMs,
    p_rank: report.rank, p_lens: input.lens, p_metrics: metricsOf(report.lens),
  }, RunAnswer);
}

export interface BestRow {
  trackId: string;
  character: string;
  speedClass: string;
  bestFinishMs: number;
  bestLapMs: number;
  runs: number;
}

const Bests = z.array(z.object({
  track_id: z.string(),
  character: z.string(),
  speed_class: z.string(),
  best_finish_ms: z.number().int(),
  best_lap_ms: z.number().int(),
  runs: z.number().int(),
}));

/** The contract's BestRow shape: bestFinishMs and bestLapMs, never another learner's. Null when unreadable. */
export async function readBests(userId: string, gameId: string): Promise<BestRow[] | null> {
  const parsed = Bests.safeParse(await serviceRest<unknown>(
    `/game_progress?user_id=eq.${eu(userId)}&game_id=eq.${es(gameId)}&select=track_id,character,speed_class,best_finish_ms,best_lap_ms,runs&order=track_id.asc,character.asc,speed_class.asc&limit=200`,
  ));
  return parsed.success
    ? parsed.data.map((row) => ({
      trackId: row.track_id, character: row.character, speedClass: row.speed_class,
      bestFinishMs: row.best_finish_ms, bestLapMs: row.best_lap_ms, runs: row.runs,
    }))
    : null;
}

const Run = z.array(z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  lens: z.enum(LENS_KEYS),
  ai_line_at: z.string().nullable(),
}));
export interface OwnRun { id: string; sessionId: string; lens: (typeof LENS_KEYS)[number]; aiLineAt: string | null }

/** A run of this learner in this session, `'none'` when there is none; null when unreadable. */
export async function readOwnRun(userId: string, sessionId: string, runId: string): Promise<OwnRun | 'none' | null> {
  const parsed = Run.safeParse(await serviceRest<unknown>(
    `/game_runs?id=eq.${eu(runId)}&session_id=eq.${eu(sessionId)}&user_id=eq.${eu(userId)}&select=id,session_id,lens,ai_line_at&limit=1`,
  ));
  if (!parsed.success) return null;
  const row = parsed.data[0];
  return row ? { id: row.id, sessionId: row.session_id, lens: row.lens, aiLineAt: row.ai_line_at } : 'none';
}

/** Stores the learner's self-report for a run they own; true when a row was updated, null when unreadable. */
export async function setReflection(userId: string, sessionId: string, runId: string, reply: 'a' | 'b' | 'unsure'): Promise<boolean | null> {
  const rows = await serviceRest<unknown>(
    `/game_runs?id=eq.${eu(runId)}&session_id=eq.${eu(sessionId)}&user_id=eq.${eu(userId)}&select=id`,
    { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ reflection: reply }) },
  );
  return Array.isArray(rows) ? rows.length > 0 : null;
}

const Save = z.array(z.object({ revision: z.number().int().min(1), save: z.record(z.string(), z.unknown()) }));

/** The server copy of the game's save: revision 0 and no data when there is none yet; null when unreadable. */
export async function readSave(userId: string, gameId: string): Promise<{ revision: number; data: Record<string, unknown> | null } | null> {
  const parsed = Save.safeParse(await serviceRest<unknown>(
    `/game_saves?user_id=eq.${eu(userId)}&game_id=eq.${es(gameId)}&select=revision,save&limit=1`,
  ));
  if (!parsed.success) return null;
  const row = parsed.data[0];
  return row ? { revision: row.revision, data: row.save } : { revision: 0, data: null };
}

const SaveAnswer = z.object({ ok: z.boolean(), revision: z.number().int().min(0) });

export function saveSnapshot(userId: string, gameId: string, revision: number, data: Record<string, unknown>) {
  return call('save_game_snapshot', { p_user_id: userId, p_game_id: gameId, p_revision: revision, p_data: data }, SaveAnswer);
}

// ── The AI debrief's per-learner daily cap, consent and cost ───────────────

export function claimAiLine(userId: string, runId: string, sinceIso: string, cap: number) {
  return call('claim_game_ai_line', { p_user_id: userId, p_run_id: runId, p_since: sinceIso, p_cap: cap }, z.boolean());
}

/** Records what the one paid line cost on the run it narrated (spend is also kept by Oracle's own guard). */
export async function recordAiCost(userId: string, runId: string, costUsd: number): Promise<boolean> {
  const usd = Math.min(1, Math.max(0, Math.round(costUsd * 1_000_000) / 1_000_000));
  const rows = await serviceRest<unknown>(`/game_runs?id=eq.${eu(runId)}&user_id=eq.${eu(userId)}&select=id`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ ai_cost_usd: usd }),
  });
  return Array.isArray(rows) && rows.length > 0;
}

/** True only on a recorded, current consent to the practice; a refusal or an unreadable answer is a no. */
export async function hasPracticeConsent(userId: string, practice: string): Promise<boolean> {
  const answer = await rpc('has_data_practice_consent', { p_subject: userId, p_practice: practice }, z.boolean());
  return answer === true;
}
