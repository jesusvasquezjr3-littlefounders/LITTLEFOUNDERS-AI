/*
 * A minimal in-memory PostgREST stand-in for tests that exercise
 * routes/learn.ts end to end (it makes many sequential REST calls per
 * request — course-chain walks, tree assembly, attempts, progress, stats —
 * hand-sequencing every fetch() call per test would be unreadable). Supports
 * just enough of the query-string dialect services/supabaseRest.ts actually
 * emits: `eq.`, `in.(...)`, `select=` / `order=` / `on_conflict=` (ignored
 * for filtering), `limit=` / `offset=` (applied — the insights export pages
 * with them, and a fake that silently ignored them made a broken pager look
 * correct), plus GET/POST/PATCH.
 */

import { advanceHabitStreak, habitStateFromStats, pausedDays, type HabitStreakState } from '../services/habitStreak.js';

export type FakeRow = Record<string, unknown>;
export type FakeDb = Record<string, FakeRow[]>;

function matchesFilters(row: FakeRow, params: URLSearchParams): boolean {
  for (const [key, value] of params.entries()) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(key)) continue;
    if (value.startsWith('eq.')) {
      if (String(row[key]) !== value.slice(3)) return false;
    } else if (value.startsWith('in.(') && value.endsWith(')')) {
      const list = value.slice(4, -1).split(',');
      if (!list.includes(String(row[key]))) return false;
    } else if (value === 'is.null') {
      // analytics_consents active-consent lookups filter on revoked_at=is.null.
      if (row[key] !== null && row[key] !== undefined) return false;
    }
    // Other operators (or=, etc.) aren't used by the routes under test — ignored.
  }
  return true;
}

/**
 * `order=col.desc` / `col.asc` on the first column, applied only when every
 * matched row carries that column (rows seeded without it keep insertion
 * order, as before). Stable, like PostgreSQL with a unique tiebreak.
 */
function applyOrder(rows: FakeRow[], params: URLSearchParams): FakeRow[] {
  const order = params.get('order');
  if (!order) return rows;
  const [column, direction] = (order.split(',')[0] ?? '').split('.');
  if (!column || !rows.every((row) => row[column] !== undefined && row[column] !== null)) return rows;
  const sign = direction === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = a[column] as string | number;
    const y = b[column] as string | number;
    return x < y ? -sign : x > y ? sign : 0;
  });
}

/** Strictly increasing timestamps for rows the doubles insert (the real columns DEFAULT now()). */
let lastFakeTime = 0;
export function fakeNow(): string {
  lastFakeTime = Math.max(Date.now(), lastFakeTime + 1);
  return new Date(lastFakeTime).toISOString();
}

/** PostgREST applies offset then limit; the export's truncation probe needs both. */
function applyRange(rows: FakeRow[], params: URLSearchParams): FakeRow[] {
  const offset = Number(params.get('offset') ?? '0');
  const limit = params.get('limit');
  const start = Number.isFinite(offset) && offset > 0 ? offset : 0;
  const sliced = start > 0 ? rows.slice(start) : rows;
  const n = limit === null ? NaN : Number(limit);
  return Number.isFinite(n) && n >= 0 ? sliced.slice(0, n) : sliced;
}

function respond(status: number, body: unknown, minimal = false): Response {
  const text = minimal ? '' : JSON.stringify(body);
  // Fetch forbids even an empty-string body on 204. Passing null preserves
  // PostgREST's return=minimal contract instead of turning a successful fake
  // service write into a constructor exception after it already mutated db.
  return new Response(minimal ? null : text, { status, headers: { 'Content-Type': 'application/json' } });
}

/** Mirrors complete_lesson (0083 + the S05.3d replay receipt) closely enough for route contracts. */
interface FakeCompletionInput {
  p_user_id: unknown; p_lesson_id: unknown; p_run_id: unknown;
  p_score: number; p_passed: boolean; p_xp: number; p_minutes: number; p_local_date: string;
}
function fakeCompleteLesson(db: FakeDb, p: FakeCompletionInput): FakeRow | null {
  const stats = db.learning_stats?.find(r => r.user_id === p.p_user_id);
  if (!stats) return null;
  const receipts = db.lesson_completion_receipts ??= [];
  const receipt = receipts.find(r => r.user_id === p.p_user_id && r.lesson_id === p.p_lesson_id && r.run_id === p.p_run_id);
  if (receipt) return { ...(receipt.result as FakeRow), replayed: true };
  const progress = db.lesson_progress ??= [];
  let previous = progress.find(r => r.user_id === p.p_user_id && r.lesson_id === p.p_lesson_id);
  const xpDelta = Math.max(0, p.p_xp - Number(previous?.xp_earned ?? 0));
  const newlyPassed = p.p_passed && !previous?.passed;
  // S05.3e: the habit streak model, exactly as habit_streak_advance runs it.
  const before = fakeHabitState(stats);
  const advanced = p.p_passed ? advanceHabitStreak(before, p.p_local_date, fakePausedDays(db, p.p_user_id)) : null;
  const after: HabitStreakState = advanced ? advanced.state : before;
  const streak = after.current;
  const dayPassed = !p.p_passed ? Number(stats.day_lessons_passed ?? 0)
    : stats.last_active_date === p.p_local_date ? Number(stats.day_lessons_passed ?? 0) + 1
      : !stats.last_active_date || String(stats.last_active_date) < p.p_local_date ? 1 : Number(stats.day_lessons_passed ?? 0);
  const kind = !previous || (Number(previous.attempts ?? 0) === 0 && !previous.passed) ? 'first' : previous.passed ? 'replay' : 'retry';
  const priorBest = kind === 'first' ? null : Number(previous?.best_score ?? 0);
  const result = {
    score: p.p_score, passed: p.p_passed,
    best_score: Math.max(Number(previous?.best_score ?? 0), p.p_score),
    xp_earned: Math.max(Number(previous?.xp_earned ?? 0), p.p_xp),
    xp_delta: xpDelta, streak_days: streak,
    longest_streak: Math.max(Number(stats.longest_streak ?? 0), streak),
    streak_extended: streak > Number(stats.streak_days),
    first_today: p.p_passed && stats.last_active_date !== p.p_local_date,
    minutes_learned: Number(stats.minutes_learned) + p.p_minutes,
    lessons_completed: Number(stats.lessons_completed) + Number(newlyPassed),
    first_completion: newlyPassed && stats.lessons_completed === 0, replayed: false,
    replay: { kind, previous_best_score: priorBest, best_score_kept: priorBest !== null && p.p_score < priorBest,
      notice: priorBest !== null && p.p_score < priorBest ? 'best_kept' : priorBest !== null && p.p_score > priorBest ? 'new_best' : 'none',
      xp_policy: 'improvement_only' },
    streak: { model: 'rest-days-v1', outcome: advanced ? advanced.outcome : 'not_practised',
      rest_days_bridged: advanced?.restDaysBridged ?? 0, rest_days_left: 2 - after.restDaysUsed,
      milestone: advanced?.milestone ?? null, days_practiced: after.daysPracticed,
      best: Math.max(Number(stats.longest_streak ?? 0), after.best), run_before: Number(stats.streak_days) },
    pace: { lessons_passed_today: after.lastActiveDate === p.p_local_date ? dayPassed : 0 },
  };
  if (!previous) { previous = { user_id: p.p_user_id, lesson_id: p.p_lesson_id }; progress.push(previous); }
  Object.assign(previous, { best_score: result.best_score, passed: Boolean(previous.passed || p.p_passed),
    xp_earned: result.xp_earned, attempts: Number(previous.attempts ?? 0) + 1, completed_at: new Date().toISOString() });
  Object.assign(stats, { xp_points: Number(stats.xp_points) + xpDelta,
    minutes_learned: result.minutes_learned, lessons_completed: result.lessons_completed,
    streak_days: streak, longest_streak: Math.max(result.longest_streak, after.best),
    last_active_date: after.lastActiveDate, rest_days_used: after.restDaysUsed, days_practiced: after.daysPracticed,
    day_lessons_passed: dayPassed });
  if (p.p_run_id) receipts.push({ user_id: p.p_user_id, lesson_id: p.p_lesson_id, run_id: p.p_run_id, result });
  return result;
}

function fakeHabitState(stats: FakeRow): HabitStreakState {
  return habitStateFromStats({
    streak_days: Number(stats.streak_days ?? 0), longest_streak: Number(stats.longest_streak ?? 0),
    last_active_date: (stats.last_active_date as string | null | undefined) ?? null,
    rest_days_used: Number(stats.rest_days_used ?? 0), days_practiced: Number(stats.days_practiced ?? 0),
  });
}

function fakePausedDays(db: FakeDb, userId: unknown): Set<number> {
  return pausedDays((db.learning_streak_pauses ?? [])
    .filter(r => r.learner_id === userId && !r.cancelled_at)
    .map(r => ({ startsOn: String(r.starts_on), endsOn: String(r.ends_on) })));
}

/** Mirrors the guardian check in set_/cancel_learning_streak_pause (S05.3e). */
function fakeVerifiedGuardian(db: FakeDb, guardianId: unknown, learnerId: unknown): boolean {
  return (db.guardian_links ?? []).some(l => l.parent_user_id === guardianId && l.kid_user_id === learnerId && l.verification_status === 'verified');
}

const fakeDay = (date: string) => Math.round(Date.parse(date + 'T00:00:00Z') / 86_400_000);

/** Builds a `global.fetch` replacement backed by `db` (mutated in place by writes). */
export function createFakeFetch(db: FakeDb): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const marker = '/rest/v1/';
    const idx = url.indexOf(marker);
    if (idx === -1) throw new Error(`fakePostgrest: non-PostgREST URL: ${url}`);
    const [table, queryString = ''] = url.slice(idx + marker.length).split('?');
    if (!table) throw new Error(`fakePostgrest: could not parse table from ${url}`);
    const params = new URLSearchParams(queryString);
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const prefer = headers.Prefer ?? '';
    if (table === 'rpc/record_course_assembly_incident' && method === 'POST') {
      const { p_course_id: courseId } = JSON.parse(String(init?.body)) as { p_course_id: string };
      const incidents = db.course_assembly_incidents ??= [];
      const existing = incidents.find((row) => row.course_id === courseId);
      const now = new Date().toISOString();
      if (existing) {
        existing.occurrence_count = Number(existing.occurrence_count) + 1;
        existing.last_seen_at = now;
      } else {
        incidents.push({ course_id: courseId, occurrence_count: 1, first_seen_at: now, last_seen_at: now });
      }
      return respond(204, null, true);
    }
    // E.8's social tier (public.social_tier). Like the real function, an
    // account with no role evidence is closed and a kid role is the guardian
    // tier; otherwise a seeded age declaration decides, and the fixtures'
    // role-holding accounts default to screened adults. A test may pin any
    // tier through db.social_tiers.
    if (table === 'rpc/social_tier' && method === 'POST') {
      const { p_user: userId } = JSON.parse(String(init?.body)) as { p_user: string };
      const pinned = (db.social_tiers ?? []).find((row) => row.user_id === userId);
      if (pinned) return respond(200, pinned.tier);
      const roles = (db.user_roles ?? []).filter((row) => row.user_id === userId);
      if (roles.length === 0) return respond(200, 'closed');
      if (roles.some((row) => row.role === 'kid')) return respond(200, 'guardian');
      const band = (db.account_age_declarations ?? []).find((row) => row.user_id === userId)?.declared_age_band;
      return respond(200, band === '13_to_17' ? 'teen' : band === 'under_13' ? 'closed' : 'adult');
    }
    // S10.3 (OD-9 4.2) contract double of *_od9_consent_enforcement.sql's
    // data_practice_applies: a practice applies unless the subject is a
    // migrated child (db.legacy_consent_subjects) with no live consent for it
    // (db.data_practice_consents). Grantor lapse rules are proven natively.
    if (table === 'rpc/data_practice_applies' && method === 'POST') {
      const { p_subject: subject, p_practice: practice } = JSON.parse(String(init?.body)) as { p_subject: string; p_practice: string };
      const migrated = (db.legacy_consent_subjects ?? []).some((row) => row.user_id === subject && !row.released_at);
      const consented = (db.data_practice_consents ?? []).some((row) => row.subject_user_id === subject && row.practice_key === practice && !row.revoked_at);
      return respond(200, !migrated || consented);
    }
    // B.2's completed-course set, read through the badge RPC the same way
    // routes/learn.ts does. Tests seed db.completed_course_badges.
    if (table === 'rpc/get_completed_course_badges' && method === 'POST') {
      const { p_user_id: userId } = JSON.parse(String(init?.body)) as { p_user_id: string };
      return respond(200, (db.completed_course_badges ?? []).filter((row) => row.user_id === userId));
    }
    if (table === 'rpc/commit_course_placement' && method === 'POST') {
      const { p_result: row, p_lesson_ids: ids } = JSON.parse(String(init?.body)) as { p_result: FakeRow; p_lesson_ids: string[] };
      const placements = db.course_placements ??= [];
      const credits = db.placement_credits ??= [];
      const prior = placements.find(item => item.user_id === row.user_id && item.course_id === row.course_id);
      if (prior) {
        const previousIds = credits.filter(item => item.user_id === row.user_id && item.course_id === row.course_id).map(item => item.lesson_id).sort();
        const same = Object.keys(row).every(key => JSON.stringify(row[key]) === JSON.stringify(prior[key]));
        return respond(200, same && JSON.stringify(previousIds) === JSON.stringify([...new Set(ids)].sort()) ? 'replayed' : 'conflict');
      }
      placements.push(row);
      for (const id of new Set(ids)) credits.push({ user_id: row.user_id, course_id: row.course_id, lesson_id: id, topic_id: db.lessons?.find(item => item.id === id)?.topic_id });
      return respond(200, 'created');
    }
    // Contract double for B.6's stage-entry placement (S05.3b). It mirrors the
    // SQL's refusals that Core relies on: credits only inside the course's
    // published lessons of the SAME pathway stage (legacy age tiers map
    // tier1/tier2 child, tier3 tween, tier4 teen), replay vs conflict per
    // stage, B.1's per-course row kept when absent, earlier credits untouched.
    if (table === 'rpc/commit_course_pathway_placement' && method === 'POST') {
      const { p_result: row, p_lesson_ids: ids } = JSON.parse(String(init?.body)) as { p_result: FakeRow; p_lesson_ids: string[] };
      const tierStage: Record<string, string> = { tier1: 'child', tier2: 'child', tier3: 'tween', tier4: 'teen' };
      const stageOfLesson = (lessonId: string): string | null => {
        const lesson = db.lessons?.find(item => item.id === lessonId);
        const topic = db.topics?.find(item => item.id === lesson?.topic_id);
        const saga = db.sagas?.find(item => item.id === topic?.saga_id);
        const adventure = db.adventures?.find(item => item.id === saga?.adventure_id);
        if (!lesson || !adventure || adventure.course_id !== row.course_id || lesson.status !== 'published') return null;
        return (adventure.pathway_stage as string | null | undefined) ?? tierStage[String(adventure.age_tier ?? 'tier1')] ?? null;
      };
      if (ids.some(id => stageOfLesson(id) !== row.pathway_stage)) return respond(400, { message: 'Credit outside the pathway stage' });
      const entries = db.course_pathway_placements ??= [];
      const credits = db.placement_credits ??= [];
      const prior = entries.find(item => item.user_id === row.user_id && item.course_id === row.course_id && item.pathway_stage === row.pathway_stage);
      if (prior) {
        const same = prior.method === row.method && prior.start_topic_id === row.start_topic_id && prior.credited_topics === row.credited_topics
          && ids.every(id => credits.some(item => item.user_id === row.user_id && item.lesson_id === id));
        return respond(200, same ? 'replayed' : 'conflict');
      }
      entries.push({ user_id: row.user_id, course_id: row.course_id, pathway_stage: row.pathway_stage, method: row.method, start_topic_id: row.start_topic_id, credited_topics: row.credited_topics });
      const placements = db.course_placements ??= [];
      if (!placements.some(item => item.user_id === row.user_id && item.course_id === row.course_id)) {
        placements.push({ user_id: row.user_id, course_id: row.course_id, claimed_level: row.claimed_level, education_level: row.education_level,
          quiz_answers: row.quiz_answers, start_topic_id: row.start_topic_id, start_lesson_id: row.start_lesson_id, method: row.method });
      }
      for (const id of new Set(ids)) {
        if (!credits.some(item => item.user_id === row.user_id && item.lesson_id === id)) {
          credits.push({ user_id: row.user_id, course_id: row.course_id, lesson_id: id, topic_id: db.lessons?.find(item => item.id === id)?.topic_id });
        }
      }
      return respond(200, 'created');
    }
    if (table === 'rpc/record_lesson_grade' && method === 'POST') {
      const p = JSON.parse(String(init?.body));
      const receipts = db.lesson_grade_receipts ??= [];
      const prior = p.p_run_id && receipts.find(r => r.user_id === p.p_user_id && r.lesson_id === p.p_lesson_id && r.run_id === p.p_run_id && r.segment_id === p.p_segment_id && r.client_attempt === p.p_client_attempt);
      if (prior) return respond(200, { exhausted: false, verdict: prior.verdict });
      const attempts = db.lesson_segment_attempts ??= [];
      const count = attempts.filter(r => r.user_id === p.p_user_id && r.lesson_id === p.p_lesson_id && r.segment_id === p.p_segment_id && (!p.p_run_id || r.run_id === p.p_run_id)).length;
      if (count >= p.p_max_attempts) return respond(200, { exhausted: true });
      const verdict = { ...p.p_verdict, allowRetry: p.p_verdict.score < 100 && count + 1 < p.p_max_attempts };
      if (verdict.allowRetry) delete verdict.reveal;
      attempts.push({ user_id: p.p_user_id, lesson_id: p.p_lesson_id, segment_id: p.p_segment_id,
        run_id: p.p_run_id, attempt_number: count + 1, score: verdict.score, hints_used: p.p_hints_used,
        time_spent_seconds: p.p_context.timeSpentSeconds, course_id: p.p_context.courseId,
        topic_id: p.p_context.topicId, skill_key: p.p_context.skillKey, document_updated_at: p.p_context.documentUpdatedAt,
        diagnostic_code: p.p_hints_used > 0 ? 'hint_assisted' : count > 0 && verdict.correct ? 'retry_recovery' : !verdict.correct ? 'initial_incorrect' : undefined,
        created_at: fakeNow(),
      });
      if (p.p_run_id) receipts.push({ user_id: p.p_user_id, lesson_id: p.p_lesson_id, run_id: p.p_run_id, segment_id: p.p_segment_id, client_attempt: p.p_client_attempt, verdict });
      return respond(200, { exhausted: false, verdict });
    }
    // Contract double only: the migration test exercises SQL locks, RLS and
    // retries. This branch mirrors the Core-facing receipt shape so route
    // tests can prove that a v2 browser token is bound to one stored nonce.
    if ((table === 'rpc/record_v2_lesson_grade_ordered' || table === 'rpc/record_v2_lesson_grade_retry' || table === 'rpc/record_v2_cpa_grade_retry') && method === 'POST') {
      const p = JSON.parse(String(init?.body)) as FakeRow;
      const nonces = db.lesson_v2_attempt_nonces ??= [];
      const runs = db.lesson_v2_runs ??= [];
      const receipts = db.lesson_v2_grade_receipts ??= [];
      const nonce = nonces.find(row => row.jti === p.p_jti);
      const run = runs.find(row => row.id === p.p_run_id);
      if (!nonce || !run || nonce.user_id !== p.p_user_id || nonce.run_id !== p.p_run_id
        || nonce.document_version_id !== p.p_document_version_id || nonce.segment_id !== p.p_segment_id
        || run.user_id !== p.p_user_id || run.document_version_id !== p.p_document_version_id
        || run.completed_at !== undefined && run.completed_at !== null) return respond(400, { message: 'Invalid v2 attempt' });
      const prior = receipts.find(row => row.jti === p.p_jti);
      if (nonce.consumed_at !== undefined && nonce.consumed_at !== null) {
        return prior ? respond(200, { replayed: true, verdict: prior.verdict }) : respond(400, { message: 'Consumed nonce' });
      }
      if (typeof p.p_required_met_segment_id === 'string') {
        const prerequisite = receipts.find(row => row.user_id === p.p_user_id && row.run_id === p.p_run_id
          && row.document_version_id === p.p_document_version_id && row.segment_id === p.p_required_met_segment_id);
        if (!prerequisite || (prerequisite.verdict as FakeRow).correct !== true || (prerequisite.verdict as FakeRow).score !== 100) {
          return respond(200, { blocked: true });
        }
      }
      if (typeof p.p_required_attempted_segment_id === 'string') {
        const prerequisite = receipts.find(row => row.user_id === p.p_user_id && row.run_id === p.p_run_id
          && row.document_version_id === p.p_document_version_id && row.segment_id === p.p_required_attempted_segment_id);
        if (!prerequisite) return respond(200, { blocked: true });
      }
      nonce.consumed_at = new Date().toISOString();
      const receipt = { jti: p.p_jti, user_id: p.p_user_id, run_id: p.p_run_id,
        document_version_id: p.p_document_version_id, segment_id: p.p_segment_id, verdict: p.p_verdict, created_at: fakeNow() };
      receipts.push(receipt);
      if ((table === 'rpc/record_v2_lesson_grade_retry' || table === 'rpc/record_v2_cpa_grade_retry') && (p.p_verdict as FakeRow).correct === false) {
        nonces.push({ jti: p.p_next_jti, user_id: p.p_user_id, run_id: p.p_run_id, document_version_id: p.p_document_version_id,
          segment_id: p.p_segment_id, expires_at: p.p_next_expires_at });
        return respond(200, { replayed: false, verdict: p.p_verdict, retry_jti: p.p_next_jti });
      }
      return respond(200, { replayed: false, verdict: p.p_verdict });
    }
    if (table === 'rpc/record_v2_first_unaided_stage' && method === 'POST') {
      const p = JSON.parse(String(init?.body)) as FakeRow;
      const receipts = db.lesson_v2_grade_receipts ??= [];
      const receipt = receipts.find(row => row.jti === p.p_receipt_jti && row.user_id === p.p_user_id
        && row.document_version_id === p.p_document_version_id && (row.verdict as FakeRow).correct === true
        && (row.verdict as FakeRow).score === 100);
      if (!receipt) return respond(400, { message: 'A met receipt is required' });
      const diagnostics = db.lesson_v2_first_unaided_stages ??= [];
      if (!diagnostics.some(row => row.user_id === p.p_user_id && row.document_version_id === p.p_document_version_id
        && row.fading_group_id === p.p_fading_group_id)) {
        diagnostics.push({ user_id: p.p_user_id, document_version_id: p.p_document_version_id,
          fading_group_id: p.p_fading_group_id, stage: p.p_stage, receipt_jti: p.p_receipt_jti });
      }
      return respond(204, null, true);
    }
    // S05.3e: onboarding's day one on the habit model (record_learning_practice_day).
    if (table === 'rpc/record_learning_practice_day' && method === 'POST') {
      const p = JSON.parse(String(init?.body)) as { p_user_id: string; p_local_date: string };
      const statsRows = db.learning_stats ??= [];
      let stats = statsRows.find(r => r.user_id === p.p_user_id);
      if (!stats) {
        stats = { user_id: p.p_user_id, xp_points: 0, minutes_learned: 0, lessons_completed: 0, streak_days: 0, longest_streak: 0, last_active_date: null };
        statsRows.push(stats);
      }
      const advanced = advanceHabitStreak(fakeHabitState(stats), p.p_local_date, fakePausedDays(db, p.p_user_id));
      Object.assign(stats, { streak_days: advanced.state.current, longest_streak: Math.max(Number(stats.longest_streak ?? 0), advanced.state.best),
        last_active_date: advanced.state.lastActiveDate, rest_days_used: advanced.state.restDaysUsed, days_practiced: advanced.state.daysPracticed });
      return respond(200, { current: advanced.state.current, best: advanced.state.best, outcome: advanced.outcome, milestone: advanced.milestone });
    }
    // S05.3e: the guardian's holiday pause, with the SQL's own link and range checks.
    if (table === 'rpc/set_learning_streak_pause' && method === 'POST') {
      const p = JSON.parse(String(init?.body)) as { p_guardian_id: string; p_learner_id: string; p_starts_on: string; p_ends_on: string; p_today: string };
      if (!fakeVerifiedGuardian(db, p.p_guardian_id, p.p_learner_id)) return respond(200, { status: 'forbidden' });
      if (fakeDay(p.p_ends_on) < fakeDay(p.p_starts_on) || fakeDay(p.p_ends_on) - fakeDay(p.p_starts_on) > 20
        || fakeDay(p.p_starts_on) < fakeDay(p.p_today) - 7 || fakeDay(p.p_starts_on) > fakeDay(p.p_today) + 60) return respond(200, { status: 'invalid' });
      const pauses = db.learning_streak_pauses ??= [];
      for (const row of pauses) {
        if (row.learner_id === p.p_learner_id && !row.cancelled_at && String(row.ends_on) >= p.p_today) row.cancelled_at = new Date().toISOString();
      }
      const id = 'aaaaaaaa-0000-4000-8000-' + String(pauses.length + 1).padStart(12, '0');
      pauses.push({ id, learner_id: p.p_learner_id, starts_on: p.p_starts_on, ends_on: p.p_ends_on, set_by: p.p_guardian_id, cancelled_at: null });
      return respond(200, { status: 'set', id, starts_on: p.p_starts_on, ends_on: p.p_ends_on });
    }
    if (table === 'rpc/cancel_learning_streak_pause' && method === 'POST') {
      const p = JSON.parse(String(init?.body)) as { p_guardian_id: string; p_learner_id: string; p_today: string };
      if (!fakeVerifiedGuardian(db, p.p_guardian_id, p.p_learner_id)) return respond(200, { status: 'forbidden' });
      let changed = 0;
      for (const row of db.learning_streak_pauses ?? []) {
        if (row.learner_id !== p.p_learner_id || row.cancelled_at) continue;
        if (String(row.starts_on) >= p.p_today) {
          row.cancelled_at = new Date().toISOString();
          changed += 1;
        } else if (String(row.ends_on) >= p.p_today) {
          row.ends_on = new Date((fakeDay(p.p_today) - 1) * 86_400_000).toISOString().slice(0, 10);
          changed += 1;
        }
      }
      return respond(200, { status: changed > 0 ? 'cancelled' : 'none' });
    }
    // Contract double only: SQL rollback/concurrency is verified separately.
    if (table === 'rpc/complete_lesson' && method === 'POST') {
      const p = JSON.parse(String(init?.body));
      const outcome = fakeCompleteLesson(db, p);
      return outcome === null ? respond(500, { message: 'Missing learning stats' }) : respond(200, outcome);
    }
    if (table === 'rpc/complete_v2_lesson' && method === 'POST') {
      const p = JSON.parse(String(init?.body)) as FakeRow;
      const run = (db.lesson_v2_runs ?? []).find(row => row.id === p.p_run_id && row.user_id === p.p_user_id
        && row.lesson_id === p.p_lesson_id && row.document_version_id === p.p_document_version_id);
      const required = p.p_required_segment_ids as string[];
      const receipts = (db.lesson_v2_grade_receipts ?? []).filter(row => row.user_id === p.p_user_id && row.run_id === p.p_run_id
        && row.document_version_id === p.p_document_version_id);
      const met = required.every(segmentId => receipts.some(row => row.segment_id === segmentId
        && (row.verdict as FakeRow).correct === true && (row.verdict as FakeRow).score === 100));
      if (!run || !met) return respond(400, { message: 'Pending learning steps' });
      // First receipt per required segment (receipts are appended in grading order).
      const firsts = required.map(segmentId => receipts.find(row => row.segment_id === segmentId)!.verdict as FakeRow);
      const firstCorrect = firsts.filter(verdict => verdict.correct === true).length;
      const quality = (name: string) => firsts.filter(verdict => (verdict.judgment as FakeRow | undefined)?.quality === name).length;
      const score = Math.round(100 * firstCorrect / required.length);
      const result = fakeCompleteLesson(db, { p_user_id: p.p_user_id, p_lesson_id: p.p_lesson_id, p_run_id: p.p_run_id,
        p_score: score, p_passed: true, p_xp: Number(p.p_xp), p_minutes: Number(p.p_minutes), p_local_date: String(p.p_local_date) });
      if (result === null) return respond(500, { message: 'Missing learning stats' });
      run.completed_at ??= new Date().toISOString();
      if (result.replayed === true) return respond(200, result);
      const extras = { first_try_correct: firstCorrect, graded_count: required.length,
        judgment: { assessed: quality('sound') + quality('partial') + quality('unsupported'),
          sound: quality('sound'), partial: quality('partial'), unsupported: quality('unsupported') } };
      const stored = (db.lesson_completion_receipts ?? []).find(r => r.user_id === p.p_user_id && r.lesson_id === p.p_lesson_id && r.run_id === p.p_run_id);
      if (stored) stored.result = { ...(stored.result as FakeRow), ...extras };
      return respond(200, { ...result, ...extras });
    }
    // GAP-FIX-R1 (0205): view receipts for non-scored steps, and mixed completion.
    if (table === 'rpc/record_v2_segment_view' && method === 'POST') {
      const p = JSON.parse(String(init?.body)) as FakeRow;
      const run = (db.lesson_v2_runs ?? []).find(row => row.id === p.p_run_id);
      if (!run || run.user_id !== p.p_user_id || run.document_version_id !== p.p_document_version_id
        || (run.completed_at !== undefined && run.completed_at !== null)) return respond(400, { message: 'Invalid v2 lesson run' });
      const views = db.lesson_v2_segment_views ??= [];
      if (!views.some(row => row.run_id === p.p_run_id && row.segment_id === p.p_segment_id)) {
        views.push({ user_id: p.p_user_id, run_id: p.p_run_id, document_version_id: p.p_document_version_id, segment_id: p.p_segment_id, created_at: fakeNow() });
      }
      return respond(200, true);
    }
    // GAP-FIX-R4 (0236): time on task, set once on the learner's own receipt or view.
    if (table === 'rpc/record_v2_time_on_task' && method === 'POST') {
      const p = JSON.parse(String(init?.body)) as FakeRow;
      if (typeof p.p_seconds !== 'number' || p.p_seconds < 0 || p.p_seconds > 7200) return respond(400, { message: 'Invalid time on task' });
      const rows = p.p_receipt_jti === null
        ? (db.lesson_v2_segment_views ?? []).filter(row => row.run_id === p.p_run_id && row.segment_id === p.p_segment_id && row.user_id === p.p_user_id)
        : (db.lesson_v2_grade_receipts ?? []).filter(row => row.jti === p.p_receipt_jti && row.run_id === p.p_run_id && row.segment_id === p.p_segment_id && row.user_id === p.p_user_id);
      const open = rows.filter(row => row.time_spent_seconds === undefined || row.time_spent_seconds === null);
      for (const row of open) row.time_spent_seconds = p.p_seconds;
      return respond(200, open.length === 1);
    }
    if (table === 'rpc/complete_v2_mixed_lesson' && method === 'POST') {
      const p = JSON.parse(String(init?.body)) as FakeRow;
      const run = (db.lesson_v2_runs ?? []).find(row => row.id === p.p_run_id && row.user_id === p.p_user_id
        && row.lesson_id === p.p_lesson_id && row.document_version_id === p.p_document_version_id);
      const required = p.p_required_segment_ids as string[];
      const viewed = p.p_viewed_segment_ids as string[];
      if (required.length + viewed.length === 0) return respond(400, { message: 'Invalid v2 completion input' });
      const receipts = (db.lesson_v2_grade_receipts ?? []).filter(row => row.user_id === p.p_user_id && row.run_id === p.p_run_id
        && row.document_version_id === p.p_document_version_id);
      const views = (db.lesson_v2_segment_views ?? []).filter(row => row.user_id === p.p_user_id && row.run_id === p.p_run_id
        && row.document_version_id === p.p_document_version_id);
      const met = required.every(segmentId => receipts.some(row => row.segment_id === segmentId
        && (row.verdict as FakeRow).correct === true && (row.verdict as FakeRow).score === 100));
      const seen = viewed.every(segmentId => views.some(row => row.segment_id === segmentId));
      if (!run || !met || !seen) return respond(400, { message: 'Pending learning steps' });
      const firsts = required.map(segmentId => receipts.find(row => row.segment_id === segmentId)!.verdict as FakeRow);
      const firstCorrect = firsts.filter(verdict => verdict.correct === true).length;
      const quality = (name: string) => firsts.filter(verdict => (verdict.judgment as FakeRow | undefined)?.quality === name).length;
      const hints = receipts.reduce((sum, row) => sum + Number((row.verdict as FakeRow).hints_used ?? 0), 0);
      const score = required.length === 0 ? 100 : Math.round(100 * firstCorrect / required.length);
      const result = fakeCompleteLesson(db, { p_user_id: p.p_user_id, p_lesson_id: p.p_lesson_id, p_run_id: p.p_run_id,
        p_score: score, p_passed: true, p_xp: Number(p.p_xp), p_minutes: Number(p.p_minutes), p_local_date: String(p.p_local_date) });
      if (result === null) return respond(500, { message: 'Missing learning stats' });
      run.completed_at ??= new Date().toISOString();
      if (result.replayed === true) return respond(200, result);
      const extras = { first_try_correct: firstCorrect, graded_count: required.length, viewed_count: viewed.length, hints_used: hints,
        judgment: { assessed: quality('sound') + quality('partial') + quality('unsupported'),
          sound: quality('sound'), partial: quality('partial'), unsupported: quality('unsupported') } };
      const stored = (db.lesson_completion_receipts ?? []).find(r => r.user_id === p.p_user_id && r.lesson_id === p.p_lesson_id && r.run_id === p.p_run_id);
      if (stored) stored.result = { ...(stored.result as FakeRow), ...extras };
      return respond(200, { ...result, ...extras });
    }
    if (table.startsWith('rpc/') && db.__rpc) {
      // Scripted service RPC results for staff reads (learning quality): the
      // SQL itself is exercised by database/scripts/test-learning-quality.sql.
      const name = table.slice(4);
      const scripted = db.__rpc.find(row => row.name === name);
      if (scripted) {
        (db.__rpc_calls ??= []).push({ name, body: init?.body ? JSON.parse(String(init.body)) : null });
        return respond(Number(scripted.status ?? 200), scripted.body);
      }
    }
    db[table] ??= [];
    const rows = db[table];

    if (method === 'GET') {
      const matched = applyOrder(rows.filter((r) => matchesFilters(r, params)), params);
      const select = params.get('select');
      if (select && /^[a-z_][a-z0-9_]*(?:,[a-z_][a-z0-9_]*)*$/.test(select)) {
        return respond(200, applyRange(matched, params).map(row => Object.fromEntries(
          select.split(',').map(key => [key, row[key]]),
        )));
      }
      return respond(200, applyRange(matched, params));
    }

    if (method === 'HEAD') {
      // count=exact consumers read Content-Range, never a body.
      const n = rows.filter((r) => matchesFilters(r, params)).length;
      return new Response(null, { status: 200, headers: { 'Content-Range': `0-${Math.max(0, n - 1)}/${n}` } });
    }

    if (method === 'POST') {
      const parsed = init?.body ? (JSON.parse(String(init.body)) as FakeRow | FakeRow[]) : {};
      // Batch inserts (learning_events) POST an array — one row each.
      if (Array.isArray(parsed)) {
        const onConflict = params.get('on_conflict');
        if (!onConflict) {
          rows.push(...parsed);
          return prefer.includes('return=minimal') ? respond(201, null, true) : respond(201, parsed);
        }
        const keys = onConflict.split(',');
        const inserted: FakeRow[] = [];
        for (const body of parsed) {
          const idxExisting = rows.findIndex((r) => keys.every((key) => r[key] === body[key]));
          if (idxExisting >= 0) {
            if (prefer.includes('merge-duplicates')) {
              rows[idxExisting] = { ...rows[idxExisting], ...body };
              inserted.push(rows[idxExisting]!);
            }
            continue;
          }
          rows.push(body);
          inserted.push(body);
        }
        return prefer.includes('return=minimal') ? respond(201, null, true) : respond(201, inserted);
      }
      const body = parsed;
      const onConflict = params.get('on_conflict');
      if (onConflict) {
        const keys = onConflict.split(',');
        const idxExisting = rows.findIndex((r) => keys.every((k) => r[k] === body[k]));
        if (idxExisting >= 0) {
          if (prefer.includes('merge-duplicates')) rows[idxExisting] = { ...rows[idxExisting], ...body };
          // ignore-duplicates: leave the existing row untouched.
        } else {
          rows.push(body);
        }
      } else {
        rows.push(body);
      }
      return prefer.includes('return=minimal') ? respond(201, null, true) : respond(201, [body]);
    }

    if (method === 'PATCH') {
      const body = init?.body ? (JSON.parse(String(init.body)) as FakeRow) : {};
      const matched: FakeRow[] = [];
      db[table] = rows.map((r) => {
        if (!matchesFilters(r, params)) return r;
        const updated = { ...r, ...body };
        matched.push(updated);
        return updated;
      });
      return prefer.includes('return=minimal') ? respond(200, null, true) : respond(200, matched);
    }

    if (method === 'DELETE') {
      db[table] = rows.filter((r) => !matchesFilters(r, params));
      return respond(200, null, true);
    }

    throw new Error(`fakePostgrest: unsupported method ${method}`);
  }) as unknown as typeof fetch;
}
