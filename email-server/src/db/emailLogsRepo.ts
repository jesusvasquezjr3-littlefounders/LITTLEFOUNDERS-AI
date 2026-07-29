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
 * The ring buffer survives as the fallback: SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY are optional, so `npm run dev` and `npm test` need
 * no database and behave exactly as before.
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
export async function listEmailLogs(opts: { limit: number; offset: number }): Promise<EmailLogPage | null> {
  const { limit, offset } = opts;
  const res = await rest<EmailLogRow[]>(
    `/email_logs?select=${SELECT}&order=created_at.desc&limit=${limit}&offset=${offset}`,
    { headers: { Prefer: 'count=exact' } },
  );
  if (!res.ok || !res.body) return null;
  return {
    entries: res.body.map(toEntry),
    total: parseTotal(res.contentRange) ?? res.body.length,
  };
}

/**
 * Aggregate counts. Deliberately aggregates in Postgres-shaped fetches rather
 * than pulling every row: `status` and `template_type` are low-cardinality, so
 * one HEAD-style count per distinct value stays cheap, and the table is
 * append-only and will grow without bound.
 */
export async function summarizeEmailLogs(): Promise<EmailLogSummary | null> {
  const total = await countWhere('');
  if (total === null) return null;

  const [statuses, templates] = await Promise.all([
    countByColumn('status'),
    countByColumn('template_type'),
  ]);
  if (!statuses || !templates) return null;

  return { total, statuses, templates };
}

/** Row count matching a PostgREST filter, via a 0-row request + count=exact. */
async function countWhere(filter: string): Promise<number | null> {
  const res = await rest<unknown[]>(`/email_logs?select=id&limit=1${filter}`, {
    headers: { Prefer: 'count=exact' },
  });
  if (!res.ok) return null;
  return parseTotal(res.contentRange) ?? 0;
}

/**
 * Distinct values of a low-cardinality column and their counts. PostgREST has
 * no GROUP BY, so we read the distinct set once (capped) and then issue one
 * exact count per value.
 */
async function countByColumn(column: 'status' | 'template_type'): Promise<Record<string, number> | null> {
  const res = await rest<Record<string, string>[]>(`/email_logs?select=${column}&limit=5000`);
  if (!res.ok || !res.body) return null;

  const values = [...new Set(res.body.map((r) => r[column]).filter((v): v is string => typeof v === 'string'))];
  const counts = await Promise.all(
    values.map(async (v) => [v, await countWhere(`&${column}=eq.${encodeURIComponent(v)}`)] as const),
  );

  const out: Record<string, number> = {};
  for (const [value, count] of counts) {
    if (count !== null) out[value] = count;
  }
  return out;
}
