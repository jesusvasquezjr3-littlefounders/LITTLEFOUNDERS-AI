import { randomUUID } from 'node:crypto';
import { vi } from 'vitest';
import { jsonResponse } from './helpers.js';

/*
 * An in-memory stand-in for the game_records tables and functions, behind a
 * stubbed global fetch. The SQL semantics it mirrors (the atomic daily cap, run
 * idempotency and bests, heartbeat crediting, compare-and-set, the guardian
 * link) are PROVEN on PostgreSQL in database/scripts/verify-game-records-postgres.py;
 * this exists so games.test.ts can prove CORE's side: what it sends, what it
 * refuses before and after, and how it maps each database answer. Core's real
 * PostgREST URLs are parsed here, so a malformed filter fails the test.
 */

type Row = Record<string, unknown>;

export interface Call { url: string; method: string; body: Record<string, unknown> | null }

export interface GamesWorld {
  catalog: Row[];
  sessions: Row[];
  runs: Row[];
  progress: Row[];
  saves: Row[];
  limits: Map<string, { sessions: number; minutes: number }>;
  /** guardian:kid pairs with a verified link. */
  links: Set<string>;
  /** user:practice pairs with a current consent. */
  consents: Set<string>;
  /** Users the OD-9 step marked as migrated: a practice applies only with consent. */
  migrated: Set<string>;
  locale: string;
  /** Roles by account id (user_roles). */
  roles: Map<string, string[]>;
  /** Accounts with a verified adult identity. */
  verifiedAdults: Set<string>;
  /** Table reads that answer 500, to prove fail-closed behaviour. */
  broken: Set<string>;
  oracle: { status: number; body?: unknown; throws?: boolean };
  calls: Call[];
}

export function newWorld(): GamesWorld {
  return {
    catalog: [{ game_id: 'kartrush', status: 'live', min_band: '6-9' }],
    sessions: [], runs: [], progress: [], saves: [],
    limits: new Map(), links: new Set(), consents: new Set(), migrated: new Set(),
    locale: 'es-MX', roles: new Map(), verifiedAdults: new Set(), broken: new Set(),
    oracle: { status: 200, body: { data: { text: 'Nice patience on those drifts.', costUsd: 0.0002 }, error: null } },
    calls: [],
  };
}

const refusal = (message: string) => jsonResponse(400, { code: 'P0001', message });
const param = (url: string, key: string, op = 'eq') => new RegExp(`[?&]${key}=${op}\\.([^&]+)`).exec(url)?.[1];

export function installFakeFetch(w: GamesWorld): void {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = decodeURIComponent(String(input));
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : null;
    w.calls.push({ url, method, body });
    const json = (b: unknown, status = 200) => jsonResponse(status, b);
    const nowIso = () => new Date().toISOString();

    if (url.includes('/api/v1/game/line')) {
      if (w.oracle.throws) throw new Error('oracle down');
      return w.oracle.status === 204 ? new Response(null, { status: 204 }) : json(w.oracle.body ?? {}, w.oracle.status);
    }

    // Admission and roles, answered the way the real tables would.
    if (url.includes('/rest/v1/profiles?') && url.includes('suspended_at=not.is.null')) return json([]);
    if (url.includes('/rest/v1/profiles?')) return json([{ user_id: param(url, 'user_id'), locale: w.locale, display_name: 'x', username: null, theme: 'system', cover: {}, created_at: nowIso() }]);
    if (url.includes('/rest/v1/user_roles')) return json((w.roles.get(param(url, 'user_id') ?? '') ?? []).map((role) => ({ role })));
    if (url.includes('/rest/v1/parent_verifications')) {
      return json(w.verifiedAdults.has(param(url, 'user_id') ?? '') ? [{ status: 'verified', method: 'local-ocr', birth_date: '1985-03-01' }] : []);
    }

    const rpc = /\/rpc\/([a-z_]+)/.exec(url)?.[1];
    if (rpc && w.broken.has(`rpc:${rpc}`)) return json({ message: 'down' }, 500);
    if (rpc) return rpcAnswer(w, rpc, body ?? {});

    const table = /\/rest\/v1\/([a-z_]+)\?/.exec(url)?.[1];
    if (table && w.broken.has(table)) return json({ message: 'down' }, 500);
    const user = param(url, 'user_id');
    switch (table) {
      case 'game_catalog': return json(w.catalog);
      case 'learner_play_limits': {
        const row = user ? w.limits.get(user) : undefined;
        return json(row ? [{ max_sessions_per_day: row.sessions, max_session_minutes: row.minutes }] : []);
      }
      case 'game_sessions': {
        const since = param(url, 'started_at', 'gte');
        const id = param(url, 'id');
        return json(w.sessions.filter((s) => s.user_id === user && s.game_id === param(url, 'game_id')
          && (!since || String(s.started_at) >= since) && (!id || s.id === id)));
      }
      case 'game_saves': return json(w.saves.filter((s) => s.user_id === user && s.game_id === param(url, 'game_id')));
      case 'game_progress': return json(w.progress.filter((p) => p.user_id === user && p.game_id === param(url, 'game_id')));
      case 'game_runs': {
        const session = param(url, 'session_id');
        const rows = w.runs.filter((r) => r.id === param(url, 'id') && r.user_id === user && (!session || r.session_id === session));
        if (method === 'PATCH') {
          for (const r of rows) Object.assign(r, body);
        }
        return json(rows);
      }
      default: return json([]);
    }
  }));
}

function rpcAnswer(w: GamesWorld, fn: string, a: Record<string, unknown>): Response {
  const json = (b: unknown) => jsonResponse(200, b);
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  switch (fn) {
    case 'start_game_session_checked': {
      const mine = w.sessions.filter((s) => s.user_id === a.p_user_id && s.game_id === a.p_game_id);
      // Reopen (database: start_game_session_checked): the latest session, still open or closed 'left', fresh,
      // with active time left, is the same session again; it is not a new one and the cap does not apply.
      const last = [...mine].sort((x, y) => String(y.started_at).localeCompare(String(x.started_at)))[0];
      if (last) {
        const max = Math.min(Number(last.max_minutes), Number(a.p_max_minutes));
        if ((last.ended_at === null || last.close_reason === 'left')
          && Date.parse(String(last.last_heartbeat_at)) > now - 600_000
          && Number(last.active_seconds) < max * 60
          && Date.parse(String(last.expires_at)) > now - 600_000) {
          Object.assign(last, {
            ended_at: null, close_reason: null, max_minutes: max, expires_at: iso(now + (max * 60 - Number(last.active_seconds) + 60) * 1000),
            last_heartbeat_at: iso(now), last_active_at: iso(now), session_ref: a.p_session_ref,
            mentor: a.p_mentor, locale: a.p_locale, band: a.p_band, client_build: a.p_client_build,
          });
          return json([last]);
        }
      }
      if (mine.filter((s) => String(s.started_at) >= String(a.p_since)).length >= Number(a.p_cap)) return json([]);
      for (const s of mine.filter((x) => x.ended_at === null)) Object.assign(s, { ended_at: iso(now), close_reason: 'left' });
      const row: Row = {
        id: randomUUID(), user_id: a.p_user_id, game_id: a.p_game_id, session_ref: a.p_session_ref, started_at: iso(now),
        expires_at: a.p_expires_at, last_heartbeat_at: iso(now), last_active_at: iso(now), ended_at: null, close_reason: null,
        active_seconds: 0, max_minutes: a.p_max_minutes, mentor: a.p_mentor, locale: a.p_locale, band: a.p_band, client_build: a.p_client_build,
      };
      w.sessions.push(row);
      return json([row]);
    }
    case 'credit_game_session': {
      const s = w.sessions.find((x) => x.id === a.p_session_id && x.user_id === a.p_user_id);
      if (!s) return refusal('GAME_SESSION_NOT_FOUND');
      const prev = s.last_active_at;
      let credit = 0;
      if (s.ended_at === null) {
        if (a.p_credit) credit = Math.max(0, Math.min(Number(a.p_max_credit_seconds), Math.floor((now - Date.parse(String(s.last_heartbeat_at))) / 1000)));
        s.active_seconds = Number(s.active_seconds) + credit;
        s.last_heartbeat_at = iso(now);
        if (a.p_credit) s.last_active_at = iso(now);
      }
      return json({
        active_seconds: s.active_seconds, prev_active_at: prev, now: iso(now), expires_at: s.expires_at,
        ended_at: s.ended_at, close_reason: s.close_reason, max_minutes: s.max_minutes,
      });
    }
    case 'end_game_session': {
      const s = w.sessions.find((x) => x.id === a.p_session_id && x.user_id === a.p_user_id);
      if (!s) return refusal('GAME_SESSION_NOT_FOUND');
      if (s.ended_at === null) Object.assign(s, { ended_at: iso(now), close_reason: a.p_reason });
      return json(true);
    }
    case 'record_game_run': {
      const dup = w.runs.find((r) => r.user_id === a.p_user_id && r.game_id === a.p_game_id && r.run_key === a.p_run_key);
      if (dup) return json({ run_id: dup.id, duplicate: true, new_best: dup.new_best, lens: dup.lens, ai_line_at: dup.ai_line_at });
      const s = w.sessions.find((x) => x.id === a.p_session_id && x.user_id === a.p_user_id && x.game_id === a.p_game_id);
      if (!s) return refusal('GAME_SESSION_NOT_FOUND');
      if (s.ended_at !== null) return refusal('GAME_SESSION_CLOSED');
      if (Date.parse(String(s.expires_at)) <= now) return refusal('GAME_SESSION_EXPIRED');
      const best = w.progress.find((p) => p.user_id === a.p_user_id && p.game_id === a.p_game_id && p.track_id === a.p_track_id
        && p.character === a.p_character && p.speed_class === a.p_speed_class);
      const newBest = !best || Number(a.p_finish_ms) < Number(best.best_finish_ms);
      const run: Row = {
        id: randomUUID(), session_id: a.p_session_id, user_id: a.p_user_id, game_id: a.p_game_id, run_key: a.p_run_key,
        lens: a.p_lens, new_best: newBest, ai_line_at: null, reflection: null, ai_cost_usd: 0, metrics: a.p_metrics, args: a,
      };
      w.runs.push(run);
      if (best) {
        best.best_finish_ms = Math.min(Number(best.best_finish_ms), Number(a.p_finish_ms));
        best.best_lap_ms = Math.min(Number(best.best_lap_ms), Number(a.p_best_lap_ms));
        best.runs = Number(best.runs) + 1;
      } else {
        w.progress.push({
          user_id: a.p_user_id, game_id: a.p_game_id, track_id: a.p_track_id, character: a.p_character, speed_class: a.p_speed_class,
          best_finish_ms: a.p_finish_ms, best_lap_ms: a.p_best_lap_ms, runs: 1,
        });
      }
      return json({ run_id: run.id, duplicate: false, new_best: newBest, lens: run.lens, ai_line_at: null });
    }
    case 'save_game_snapshot': {
      const save = w.saves.find((s) => s.user_id === a.p_user_id && s.game_id === a.p_game_id);
      if (JSON.stringify(a.p_data).length > 65_536) return refusal('GAME_INVALID');
      if (!save) {
        if (a.p_revision !== 0) return json({ ok: false, revision: 0 });
        w.saves.push({ user_id: a.p_user_id, game_id: a.p_game_id, revision: 1, save: a.p_data });
        return json({ ok: true, revision: 1 });
      }
      if (save.revision !== a.p_revision) return json({ ok: false, revision: save.revision });
      Object.assign(save, { revision: Number(save.revision) + 1, save: a.p_data });
      return json({ ok: true, revision: save.revision });
    }
    case 'claim_game_ai_line': {
      const claimed = w.runs.filter((r) => r.user_id === a.p_user_id && r.ai_line_at !== null).length;
      if (claimed >= Number(a.p_cap)) return json(false);
      const run = w.runs.find((r) => r.id === a.p_run_id && r.user_id === a.p_user_id && r.ai_line_at === null);
      if (!run) return json(false);
      run.ai_line_at = iso(now);
      return json(true);
    }
    case 'game_play_limits_read': case 'game_play_limits_write': {
      if (!w.links.has(`${a.p_guardian}:${a.p_kid}`)) return refusal('GAME_GUARDIAN_NOT_LINKED');
      if (fn === 'game_play_limits_write') w.limits.set(String(a.p_kid), { sessions: Number(a.p_sessions), minutes: Number(a.p_minutes) });
      const l = w.limits.get(String(a.p_kid)) ?? { sessions: 2, minutes: 25 };
      return json({ maxSessionsPerDay: l.sessions, maxSessionMinutes: l.minutes });
    }
    case 'data_practice_applies':
      return json(!w.migrated.has(String(a.p_subject)) || w.consents.has(`${a.p_subject}:${a.p_practice}`));
    case 'has_data_practice_consent':
      return json(w.consents.has(`${a.p_subject}:${a.p_practice}`));
    default:
      return jsonResponse(404, { message: `unexpected rpc ${fn}` });
  }
}
