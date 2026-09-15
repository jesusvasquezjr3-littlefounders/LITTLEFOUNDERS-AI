import { getConfig } from '../config.js';
import type { EmailLogEntry, EmailLogSummary, EmailLogPage } from '../services/emailLog.js';

/*
 * Service-role PostgREST access to `email_logs`
 * (database/migrations/0021_email_logs.sql) — the DURABLE delivery history.
 *
 * Before this, Courier's history was a 1000-entry in-process ring buffer that
 * was wiped by every redeploy, every Railway restart, and every Haraka
 * child-process death (src/index.ts exits non-zero on purpose so the platform
 * restarts us). The admin dashboard therefore showed an empty table in
 * production almost all of the time.
 *
 * The ring buffer survives as the development fallback: SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY are optional, so `npm run dev` and `npm test` need
 * no database and behave exactly as before. A configured Vault outage is
 * returned to the caller instead of being hidden by partial in-memory data.
 *
 * Posture matches 0017/0018: RLS is on with ZERO client policies, so the
 * service role is the only access path and the browser reaches this data only
 * through Core's authenticated /api/v1/admin/emails/* proxy.
 */

/** A row as stored. snake_case — this is the wire shape of the table. */
interface EmailLogRow {
  id: string;
  message_id: string | null;
  to_address: string;
  subject: string;
  template_type: string;
  locale: string | null;
  user_id: string | null;
  status: string;
  detail: Record<string, unknown>;
  created_at: string;
}

const SELECT = 'id,message_id,to_address,subject,template_type,locale,user_id,status,detail,created_at';

/**
 * Vault credentials, or null if history cannot be durable.
 *
 * getConfig() is wrapped because it PARSES AND THROWS on a bad environment,
 * and this module sits on the /api/v1/send path. Logging is a secondary
 * concern: a config problem must degrade the audit trail, never turn a
 * password-reset dispatch into a 500. Fail-safe, not fail-fast, here only —
 * boot-time validation still happens in src/index.ts.
 */
function vaultCreds(): { url: string; key: string } | null {
  try {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getConfig();
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
    return { url: SUPABASE_URL, key: SUPABASE_SERVICE_ROLE_KEY };
  } catch {
    return null;
  }
}

/** True when Vault credentials are present, i.e. history should be durable. */
export function isVaultConfigured(): boolean {
  return vaultCreds() !== null;
}

interface RestResult<T> {
  ok: boolean;
  status: number;
  body: T | null;
  contentRange: string | null;
}

async function rest<T>(
  path: string,
  init: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<RestResult<T>> {
  const creds = vaultCreds();
  if (!creds) {
    return { ok: false, status: 0, body: null, contentRange: null };
  }
  let res: Response;
  try {
    res = await fetch(`${creds.url}/rest/v1${path}`, {
      ...init,
      headers: {
        apikey: creds.key,
        Authorization: `Bearer ${creds.key}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, status: 0, body: null, contentRange: null };
  }
  const text = await res.text().catch(() => '');
  let body: T | null = null;
  if (text) {
    try {
      body = JSON.parse(text) as T;
    } catch {
      body = null;
    }
  }
  return { ok: res.ok, status: res.status, body, contentRange: res.headers.get('content-range') };
}

function toEntry(row: EmailLogRow): EmailLogEntry {
  return {
    id: row.id,
    messageId: row.message_id ?? row.id,
    to: row.to_address,
    subject: row.subject,
    status: row.status,
    templateType: row.template_type,
    locale: row.locale ?? undefined,
    userId: row.user_id ?? undefined,
    detail: row.detail ?? {},
    createdAt: row.created_at,
  };
}

/**
 * PostgREST reports the total row count in `Content-Range: 0-24/1337` when the
 * request asks for `count=exact`. Parse the part after the slash; `*` means the
 * count was not computed.
 */
function parseTotal(contentRange: string | null): number | null {
  if (!contentRange) return null;
  const total = contentRange.split('/')[1];
  if (!total || total === '*') return null;
  const n = Number(total);
  return Number.isFinite(n) ? n : null;
}

/**
 * Write-through. NEVER throws and NEVER rejects: a Vault outage must not turn
 * into a failed email dispatch or a 500 on the SMTP capture path. Returns
 * whether the row landed, purely so callers can decide about logging.
 */
export async function insertEmailLog(entry: EmailLogEntry): Promise<boolean> {
  if (!isVaultConfigured()) return false;
  const row = {
    message_id: entry.messageId,
    to_address: entry.to,
    subject: entry.subject,
    template_type: entry.templateType,
    locale: entry.locale ?? null,
    // Only a real UUID may go here — the column is FK-constrained to
    // auth.users(id), so a non-UUID would make PostgREST reject the whole row
    // and we would silently lose the log line.
    user_id: isUuid(entry.userId) ? entry.userId : null,
    status: entry.status,
    detail: entry.detail ?? {},
    created_at: entry.createdAt,
  };
  const res = await rest<unknown>('/email_logs', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
  return res.ok;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(v: string | undefined): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

/** Newest-first page of durable history, or null if Vault did not answer. */
export async function listEmailLogs(opts: { limit: number; offset: number; q?: string; status?: string; templateType?: string }): Promise<EmailLogPage | null> {
  const { limit, offset } = opts;
  const filters: string[] = [];
  if (opts.q) {
    const value = opts.q.replace(/[\\,*()]/g, '');
    if (value) filters.push(`or=${encodeURIComponent(`(to_address.ilike.*${value}*,subject.ilike.*${value}*,message_id.ilike.*${value}*)`)}`);
  }
  if (opts.status) filters.push(`status=eq.${encodeURIComponent(opts.status)}`);
  if (opts.templateType) filters.push(`template_type=eq.${encodeURIComponent(opts.templateType)}`);
  const res = await rest<EmailLogRow[]>(
    `/email_logs?select=${SELECT}&order=created_at.desc&limit=${limit}&offset=${offset}${filters.length ? `&${filters.join('&')}` : ''}`,
    { headers: { Prefer: 'count=exact' } },
  );
  if (!res.ok || !res.body) return null;
  return {
    entries: res.body.map(toEntry),
    total: parseTotal(res.contentRange) ?? res.body.length,
  };
}

/**
 * Aggregate counts, computed from ONE bounded, sequentially-paginated fetch
 * of the window rather than N HTTP requests.
 *
 * The previous version issued one exact-count request per UTC day for the
 * trend (`Promise.all` over `days` — 365 concurrent requests for the
 * dashboard's own default "1y" range) PLUS one per distinct status/template/
 * locale value, all fired at once. Against a 10s proxy timeout on Core's side
 * (`backend/src/routes/admin.ts`) that fan-out reliably lost the race, and
 * the admin console showed "Courier no respondió" — a 2026-09 incident that
 * had nothing to do with mail delivery (Haraka kept relaying the whole time)
 * and everything to do with this being the SAME shape of bug the README
 * already documents for `GET /learn/courses`: an unbounded `Promise.all`
 * whose request count scales with data nobody reviews at deploy time.
 *
 * The fix is the same one applied there: one row in flight's worth of work
 * per page, not one request per day/value. `WINDOW_ROW_CAP` bounds the worst
 * case for a table that is append-only and grows without bound — generous
 * for a transactional-mail volume, and a summary computed from a truncated
 * tail is still a far better answer than a summary that never arrives.
 */
export async function summarizeEmailLogs(days = 30): Promise<EmailLogSummary | null> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));

  const rows = await fetchWindow(since.toISOString());
  if (rows === null) return null;

  const statuses: Record<string, number> = {};
  const templates: Record<string, number> = {};
  const locales: Record<string, number> = {};
  const trendByDay = new Map<string, number>();
  for (let i = 0; i < days; i += 1) {
    const day = new Date(since);
    day.setUTCDate(day.getUTCDate() + i);
    trendByDay.set(day.toISOString().slice(0, 10), 0);
  }

  for (const row of rows) {
    statuses[row.status] = (statuses[row.status] ?? 0) + 1;
    templates[row.template_type] = (templates[row.template_type] ?? 0) + 1;
    if (row.locale) locales[row.locale] = (locales[row.locale] ?? 0) + 1;
    const day = row.created_at.slice(0, 10);
    if (trendByDay.has(day)) trendByDay.set(day, (trendByDay.get(day) ?? 0) + 1);
  }

  const trend = [...trendByDay.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([date, count]) => ({ date, count }));
  return { total: rows.length, statuses, templates, locales, trend };
}

interface WindowRow {
  status: string;
  template_type: string;
  locale: string | null;
  created_at: string;
}

const WINDOW_PAGE_SIZE = 1000;
/** 20 pages: bounds the worst case to 20 SEQUENTIAL requests, never a fan-out. */
const WINDOW_ROW_CAP = 20_000;

/**
 * Every row created_at >= since, ascending, one page in flight at a time —
 * or null if any page failed, matching this file's existing "refuse partial
 * history" posture (`getEmailLogs`/`getEmailSummary` in emailLog.ts) rather
 * than presenting a truncated-by-error summary as complete.
 */
async function fetchWindow(sinceIso: string): Promise<WindowRow[] | null> {
  const rows: WindowRow[] = [];
  let offset = 0;
  for (;;) {
    const res = await rest<WindowRow[]>(
      `/email_logs?select=status,template_type,locale,created_at&created_at=gte.${encodeURIComponent(sinceIso)}&order=created_at.asc&limit=${WINDOW_PAGE_SIZE}&offset=${offset}`,
    );
    if (!res.ok || !res.body) return null;
    rows.push(...res.body);
    if (res.body.length < WINDOW_PAGE_SIZE || rows.length >= WINDOW_ROW_CAP) return rows;
    offset += WINDOW_PAGE_SIZE;
  }
}
