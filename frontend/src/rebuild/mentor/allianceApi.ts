/*
 * The rebuilt UI imports nothing from the legacy frontend (Bible 02 rule 23;
 * `npm run spec:check`), so this layer carries its own envelope-aware call to
 * Core: every response is `{ data, error }`, and anything else is an error,
 * never a guessed success.
 */
const BASE_URL: string = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:4000';

export type ApiResult<T> = { data: T; error: null } | { data: null; error: { code: string; message: string } };

async function api<T>(path: string, options: { method?: 'GET' | 'POST' | 'DELETE'; token: string; body?: unknown }): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { Authorization: `Bearer ${options.token}` };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/v1${path}`, {
      method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    return { data: null, error: { code: 'INTERNAL', message: 'Network error' } };
  }
  const body: unknown = await res.json().catch(() => null);
  if (body && typeof body === 'object' && 'data' in body && 'error' in body) {
    const { data, error } = body as { data: unknown; error: unknown };
    if (error === null && res.ok && data !== null && data !== undefined) return { data: data as T, error: null };
    if (data === null && error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
      const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
      return { data: null, error: { code: error.code, message } };
    }
  }
  return { data: null, error: { code: 'INTERNAL', message: 'Malformed response' } };
}

/*
 * The client API layer for C.15 (the end-of-session bond proxy) and C.7 (the
 * learner disposition profile, readable and resettable). Hand-mirrored from
 * Core's `routes/tutor.ts` and `services/pedagogy/disposition.ts` (this repo
 * shares no types across packages; `npm run alliance:check` keeps the
 * vocabularies identical).
 *
 * Every call goes to Core, the only service the frontend talks to. Nothing
 * here carries free text: the bond proxy is one of three closed answers, and
 * the profile is closed labels and numbers.
 */

export const BOND_PROXY_ANSWERS = ['yes', 'partly', 'no'] as const;
export type BondProxyAnswer = (typeof BOND_PROXY_ANSWERS)[number];

export type HelpStyle = 'independent' | 'hint_seeking' | 'tell_early' | 'unknown';
export type Persistence = 'persists' | 'disengages_early' | 'unknown';
export type ExplanationStyle = 'explains' | 'needs_scaffold' | 'unknown';
export type Adaptation = 'slower_pacing' | 'more_examples' | 'less_text' | 'more_visual' | 'repeat_before_advancing';
export type DispositionEffect = 'stuck_degrade_early' | 'scaffolded_explanation' | 'seeded_declines' | 'idle_nudge_paced';

/** Mirrors Core's `explainProfile`. */
export interface DispositionSummaryData {
  exists: boolean;
  current: boolean;
  sessionsObserved: number;
  helpStyle: HelpStyle;
  persistence: Persistence;
  explanation: ExplanationStyle;
  persistentlyDeclined: Adaptation[];
  typicalReplySeconds: number | null;
  personas: { character: string; sessions: number }[];
  effects: DispositionEffect[];
  updatedAt: string | null;
}

/**
 * The learner answers "did I get what you were going for today?" after the
 * session closed. `closed` covers every refusal that means the question is
 * simply gone (already answered, too late, not asked, not tracked).
 */
export async function postAllianceCheck(
  token: string,
  sessionId: string,
  answer: BondProxyAnswer,
): Promise<'recorded' | 'failed' | 'closed'> {
  const result = await api<{ recorded: boolean }>(`/tutor/sessions/${encodeURIComponent(sessionId)}/alliance-check`, {
    method: 'POST',
    token,
    body: { answer },
  });
  if (result.data?.recorded === true) return 'recorded';
  const code = result.error?.code;
  return code === 'ALREADY_ANSWERED' || code === 'TOO_LATE' || code === 'NOT_ASKED' || code === 'NOT_TRACKED' ? 'closed' : 'failed';
}

/** The learner's own profile. */
export function getOwnDisposition(token: string): Promise<ApiResult<DispositionSummaryData>> {
  return api<DispositionSummaryData>('/tutor/disposition', { token });
}

/** A verified Tutor reads their child's profile. */
export function getKidDisposition(token: string, kidUserId: string): Promise<ApiResult<DispositionSummaryData>> {
  return api<DispositionSummaryData>(`/tutor/kids/${encodeURIComponent(kidUserId)}/disposition`, { token });
}

/** A teen without a guardian link or an adult resets their own profile. */
export function resetOwnDisposition(token: string): Promise<ApiResult<{ reset: boolean }>> {
  return api<{ reset: boolean }>('/tutor/disposition', { method: 'DELETE', token });
}

/** A verified Tutor resets their child's profile. */
export function resetKidDisposition(token: string, kidUserId: string): Promise<ApiResult<{ reset: boolean }>> {
  return api<{ reset: boolean }>(`/tutor/kids/${encodeURIComponent(kidUserId)}/disposition`, { method: 'DELETE', token });
}
