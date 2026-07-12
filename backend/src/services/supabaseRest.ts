import { getConfig } from '../config.js';

/*
 * PostgREST access in two grades:
 *  - asUser(token): the USER's JWT — RLS enforced by the database. Default.
 *  - asServiceRole(): bypasses RLS. ONLY for writes the schema deliberately
 *    reserves to the service role (role grants, parent_verifications,
 *    audit_logs) — never for reads on behalf of a user.
 */

interface RestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

async function rest<T>(path: string, token: string, init: RestInit = {}): Promise<T | null> {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = getConfig();
  let res: globalThis.Response;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
      ...init,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  // Prefer: return=minimal and 204s come back with an empty body — success.
  const text = await res.text().catch(() => '');
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export interface ProfileRow {
  user_id: string;
  display_name: string;
  locale: string;
  theme: string;
}

export interface RoleRow {
  role: string;
}

export function getOwnProfile(accessToken: string, userId: string): Promise<ProfileRow[] | null> {
  return rest<ProfileRow[]>(`/profiles?user_id=eq.${userId}&select=user_id,display_name,locale,theme`, accessToken);
}

export function getOwnRoles(accessToken: string, userId: string): Promise<RoleRow[] | null> {
  return rest<RoleRow[]>(`/user_roles?user_id=eq.${userId}&select=role`, accessToken);
}

export interface CourseRow {
  id: string;
  slug: string;
  title: Record<string, string>;
  lessons: { count: number }[];
}

/** Published courses only — the user's own token, so RLS decides. */
export function getPublishedCourses(accessToken: string): Promise<CourseRow[] | null> {
  return rest<CourseRow[]>('/courses?select=id,slug,title,lessons(count)&order=slug.asc', accessToken);
}

// ── Service-role writes ─────────────────────────────────────

function serviceToken(): string {
  return getConfig().SUPABASE_SERVICE_ROLE_KEY;
}

export interface ParentVerificationInsert {
  user_id: string;
  given_names: string;
  surnames: string;
  birth_date: string;
  address: string;
  document_type: string;
  checks: Record<string, boolean>;
}

export async function insertParentVerification(row: ParentVerificationInsert): Promise<boolean> {
  const res = await rest<unknown>('/parent_verifications', serviceToken(), {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
  return res !== null;
}

/** Idempotent role grant (PK user_id+role → duplicates ignored). */
export async function grantRole(userId: string, role: string, grantedBy: string): Promise<boolean> {
  const res = await rest<unknown>('/user_roles?on_conflict=user_id,role', serviceToken(), {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify({ user_id: userId, role, granted_by: grantedBy }),
  });
  return res !== null;
}

export async function hasRole(userId: string, role: string): Promise<boolean> {
  const rows = await rest<RoleRow[]>(`/user_roles?user_id=eq.${userId}&role=eq.${role}&select=role`, serviceToken());
  return Array.isArray(rows) && rows.length > 0;
}

/** Append-only audit entry (no PII in detail — booleans/ids only). */
export async function insertAuditLog(actorId: string, action: string, subject: string, detail: Record<string, unknown>): Promise<void> {
  await rest<unknown>('/audit_logs', serviceToken(), {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ actor_id: actorId, action, subject, detail }),
  });
}
