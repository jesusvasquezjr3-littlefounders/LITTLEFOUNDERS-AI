#!/usr/bin/env node
// check-family-production-integrity.mjs — Appendix H 1.3 (D.4 "Unauthorized
// State-Transition Rate": zero, verified per release), 1.4 (Retention-Policy
// Compliance Audit: pass, every release) and Part 3 Stage 7 (a structural or
// safety change is REVERTED, not patched forward, when that metric regresses
// after a release), read from PRODUCTION, not from a throwaway cluster.
//
// `npm run family:db-verify` proves the mechanism (every accepted chore, goal,
// redemption, guardian-link and freeze transition is recorded with the request
// role that caused it; the retention sweep deletes what is due) on a local
// cluster. It never reads the real count. This check does:
//
//   public.family_state_integrity(p_since)   rows per table with
//                                            `outside_service`: transitions
//                                            that did not come through Core's
//                                            service role (target 0)
//   public.family_retention_compliance()     rows still held past their
//                                            period plus two days (target 0)
//
// Sources, in order:
//   --export=<file.json>   a saved reply: Core's
//                          GET /api/v1/internal/ops/family-integrity envelope
//                          ({data: {stateIntegrity, retention}}), the same
//                          object bare, or the raw RPC rows
//                          ({family_state_integrity: [...],
//                            family_retention_compliance: [...]})
//   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY   both RPCs, read only
//   neither                a warning: the production check did not run
//
// The window starts at --since=<ISO date>, else at the date of the last
// release tag (v* or release-*), else 30 days ago.
//
// Modes:
//   (default)   findings are warnings
//   --strict    release readiness: any table with outside_service > 0, any
//               table with overdue > 0, or a named source that could not be
//               read fails, naming the table
//   --watch     .github/workflows/family-integrity-watch.yml, daily: an
//               outside-service transition fails and --notify-file=<md>
//               receives the "Block D Stage 7: revert candidate" issue (first
//               line `# <title>`, then the body). An unreadable reply fails
//               too (UNKNOWN is not healthy); overdue retention rows warn
//               there (the nightly sweep and its own watch own them) and fail
//               at release.
//
// The zero targets are the SPEC's own (Appendix H 1.3 and 1.4); this file is
// their only judge outside the staff console's card.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_WINDOW_DAYS = 30;
export const RELEASE_TAG_PATTERNS = ['refs/tags/v*', 'refs/tags/release-*'];
export const REVERT_TITLE = 'Block D Stage 7: revert candidate';
export const UNREAD_TITLE = 'Block D Stage 7: the production integrity watch could not read the metric';

const DAY_MS = 24 * 60 * 60 * 1000;
const count = (value) => (Number.isInteger(value) && value >= 0 ? value : null);

/** The window start: --since, else the last release tag's date, else 30 days before `now`. */
export function windowStart({ argv = [], now = new Date(), lastReleaseTagDate = () => null }) {
  const flag = argv.find((arg) => arg.startsWith('--since='));
  if (flag) {
    const at = new Date(flag.slice('--since='.length));
    if (Number.isNaN(at.getTime())) throw new Error(`--since is not a date: ${flag}`);
    return { since: at.toISOString(), basis: '--since' };
  }
  const tag = lastReleaseTagDate();
  if (tag) return { since: new Date(tag.date).toISOString(), basis: `release tag ${tag.name}` };
  return { since: new Date(now.getTime() - DEFAULT_WINDOW_DAYS * DAY_MS).toISOString(), basis: `the last ${DEFAULT_WINDOW_DAYS} days (no release tag)` };
}

/** The newest v* / release-* tag in this checkout, or null. */
export function gitLastReleaseTag(cwd = fileURLToPath(new URL('../../', import.meta.url))) {
  try {
    const out = execFileSync('git', ['for-each-ref', '--sort=-creatordate', '--count=1', '--format=%(refname:short) %(creatordate:iso-strict)', ...RELEASE_TAG_PATTERNS], { cwd, encoding: 'utf8' }).trim();
    if (!out) return null;
    const [name, date] = out.split(' ');
    return name && date ? { name, date } : null;
  } catch {
    return null;
  }
}

function integrityRows(rows) {
  if (!Array.isArray(rows)) return null;
  const out = [];
  for (const row of rows) {
    const table = row?.table ?? row?.table_name;
    const transitions = count(Number(row?.transitions));
    const outsideService = count(Number(row?.outsideService ?? row?.outside_service));
    if (typeof table !== 'string' || transitions === null || outsideService === null) return null;
    out.push({ table, transitions, outsideService });
  }
  return out;
}

function retentionRows(rows) {
  if (!Array.isArray(rows)) return null;
  const out = [];
  for (const row of rows) {
    const table = row?.table ?? row?.table_name;
    const dataClass = row?.dataClass ?? row?.data_class;
    const retainDays = count(Number(row?.retainDays ?? row?.retain_days));
    const overdue = count(Number(row?.overdue));
    if (typeof table !== 'string' || typeof dataClass !== 'string' || retainDays === null || overdue === null) return null;
    out.push({ table, dataClass, retainDays, overdue });
  }
  return out;
}

/**
 * Any accepted reply shape -> { integrity, retention, since }. A section that
 * is absent or malformed is null (never an empty list: an unreadable metric is
 * not a zero).
 */
export function normalizeReply(json) {
  const body = json && typeof json === 'object' && json.data && typeof json.data === 'object' ? json.data : json;
  if (!body || typeof body !== 'object') return { integrity: null, retention: null, since: null };
  if ('family_state_integrity' in body || 'family_retention_compliance' in body) {
    return { integrity: integrityRows(body.family_state_integrity), retention: retentionRows(body.family_retention_compliance), since: typeof body.since === 'string' ? body.since : null };
  }
  const state = body.stateIntegrity;
  return {
    integrity: state && typeof state === 'object' ? integrityRows(state.tables) : null,
    retention: body.retention && typeof body.retention === 'object' ? retentionRows(body.retention.tables) : null,
    since: typeof state?.since === 'string' ? state.since : null,
  };
}

/** Reads the production metric from --export or the service-role RPCs. Never throws. */
export async function loadProduction({ argv = [], env = {}, readFile, fetchImpl = globalThis.fetch, since }) {
  const flag = argv.find((arg) => arg.startsWith('--export='));
  if (flag) {
    const path = flag.slice('--export='.length);
    try {
      const reply = normalizeReply(JSON.parse(readFile(path)));
      return { ...reply, since: reply.since ?? since, source: path };
    } catch (error) {
      return { integrity: null, retention: null, since, unread: `${path} is missing or not JSON: ${error.message}`, failed: true };
    }
  }
  const base = env.SUPABASE_URL?.replace(/\/+$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) {
    return { integrity: null, retention: null, since, unread: 'no --export file and no SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in this environment' };
  }
  const call = async (fn, body) => {
    const res = await fetchImpl(`${base}/rest/v1/rpc/${fn}`, {
      method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${fn} answered ${res.status}`);
    return res.json();
  };
  try {
    const [state, retention] = await Promise.all([
      call('family_state_integrity', { p_since: since }),
      call('family_retention_compliance', {}),
    ]);
    return { integrity: integrityRows(state), retention: retentionRows(retention), since, source: `${base} (service role, read only)` };
  } catch (error) {
    return { integrity: null, retention: null, since, unread: `the database could not be read: ${error.message}`, failed: true };
  }
}

/** The verdict. Pure, so every refused population is testable. */
export function judge({ integrity, retention, since, source, unread, failed = false, strict = false, watch = false, runUrl = '' }) {
  const failures = [];
  const warnings = [];
  const hard = strict || watch;
  const bypassed = (integrity ?? []).filter((row) => row.outsideService > 0);
  const overdue = (retention ?? []).filter((row) => row.overdue > 0);
  const window = `since ${since}`;

  if (!source) {
    if (watch || (strict && failed)) failures.push(`the production metric could not be read: ${unread}`);
    else warnings.push(`the production state-integrity and retention checks did not run: ${unread}`);
  } else {
    if (integrity === null) (hard ? failures : warnings).push(`${source} carries no readable state-integrity metric (Appendix H 1.3 D.4)`);
    if (retention === null) (strict ? failures : warnings).push(`${source} carries no readable retention audit (Appendix H 1.4)`);
  }
  for (const row of bypassed) {
    (hard ? failures : warnings).push(`Unauthorized State-Transition Rate: ${row.table} has ${row.outsideService} of ${row.transitions} transition(s) outside the service role ${window} (target 0, Appendix H 1.3 D.4)`);
  }
  for (const row of overdue) {
    (strict ? failures : warnings).push(`Retention-Policy Compliance Audit: ${row.table} (${row.dataClass}, ${row.retainDays} days) holds ${row.overdue} row(s) past its period (target 0, Appendix H 1.4)`);
  }

  let notice = null;
  if (watch && failures.length > 0) {
    const tables = bypassed.map((row) => row.table);
    const title = tables.length > 0 ? `${REVERT_TITLE} (${tables.join(', ')}, ${window})` : UNREAD_TITLE;
    notice = [
      `# ${title}`,
      '',
      tables.length > 0
        ? 'Appendix H Part 3 Stage 7: the Unauthorized State-Transition Rate regressed in production. A family state transition (a chore, goal, redemption, guardian link or account freeze) was accepted without passing through Core\'s service layer. The structural or safety change released in this window is **reverted rather than patched forward**; the Engineering Lead and the Pedagogical Lead decide the revert on this issue.'
        : 'Appendix H Part 3 Stage 7: the daily production watch could not read the Unauthorized State-Transition Rate, so nobody can say it is still zero. An unreadable metric is not a healthy one.',
      '',
      ...failures.map((failure) => `- ${failure}`),
      ...(warnings.length > 0 ? ['', 'Also noted:', ...warnings.map((warning) => `- ${warning}`)] : []),
      '',
      'Per table: `GET /api/v1/admin/family/state-integrity?days=1` (staff console, Programme card "stateIntegrity"). The rows are `public.family_state_audit` entries whose `request_role` is not `service_role`.',
      ...(runUrl ? ['', `Run: ${runUrl}`] : []),
      '',
    ].join('\n');
  }
  return { failures, warnings, notice, bypassed, overdue };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const strict = argv.includes('--strict');
  const watch = argv.includes('--watch');
  const notifyFlag = argv.find((arg) => arg.startsWith('--notify-file='));
  const { since, basis } = windowStart({ argv, lastReleaseTagDate: () => gitLastReleaseTag() });
  const loaded = await loadProduction({ argv, env: process.env, readFile: (path) => readFileSync(path, 'utf8'), since });
  const verdict = judge({ ...loaded, strict, watch, runUrl: process.env.RUN_URL ?? '' });
  for (const warning of verdict.warnings) console.warn(`WARN: ${warning}`);
  if (verdict.notice && notifyFlag) writeFileSync(notifyFlag.slice('--notify-file='.length), verdict.notice);
  if (verdict.failures.length > 0) {
    for (const failure of verdict.failures) console.error(`FAIL: ${failure}`);
    process.exit(1);
  }
  if (!loaded.source) {
    console.log(`family-production-integrity SKIP — ${loaded.unread}`);
  } else {
    const transitions = (loaded.integrity ?? []).reduce((sum, row) => sum + row.transitions, 0);
    console.log(`family-production-integrity OK — ${transitions} state transition(s) ${loaded.since ? `since ${loaded.since}` : ''} (${basis}), ${verdict.bypassed.length === 0 ? 'none' : verdict.bypassed.length} outside the service role; retention: ${loaded.retention ? `${verdict.overdue.length === 0 ? 'pass' : `${verdict.overdue.length} table(s) overdue`}` : 'not read'} (${loaded.source})`);
  }
}
