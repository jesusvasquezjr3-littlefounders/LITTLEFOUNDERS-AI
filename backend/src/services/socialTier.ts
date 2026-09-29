import { z } from 'zod';
import { requestStillActionable, serviceRest, serviceRestRaw } from './supabaseRest.js';

/*
 * E.8 — the age-tiered social layer, Core side.
 *
 * The tier is decided by the database (public.social_tier, migration
 * social_age_tiers) from service-owned age evidence, never from anything the
 * caller says about itself and never from the role alone (OD-3: every minor
 * safeguard follows age):
 *
 *   guardian  parent-created child, or a linked under-13 origin: strictest
 *   teen      self-registered 13-17: private, the teen decides connections
 *   adult     screened adult or ID-verified parent: public, open follow
 *   closed    guest, unlinked under-13 origin, unscreened: no social layer
 *
 * Core asks the same function the database's own follow trigger and
 * visibility policy use, so the two cannot disagree about who is who. A
 * failed or malformed read is null, and every caller treats null as "no
 * access" (§1.14: an unreadable tier must not become an adult).
 */

export const SOCIAL_TIERS = ['guardian', 'teen', 'adult', 'closed'] as const;
export const SocialTier = z.enum(SOCIAL_TIERS);
export type SocialTier = z.infer<typeof SocialTier>;
export const MINOR_SOCIAL_TIERS: readonly SocialTier[] = ['guardian', 'teen'];

const UUID = z.string().uuid();
const LIST_LIMIT = 60;

export async function readSocialTier(userId: string): Promise<SocialTier | null> {
  const id = UUID.safeParse(userId);
  if (!id.success) return null;
  const result = SocialTier.safeParse(await serviceRest<unknown>('/rpc/social_tier', {
    method: 'POST', body: JSON.stringify({ p_user: id.data }),
  }));
  return result.success ? result.data : null;
}

/** A current, accepted, live and unblocked teen consent. Only a literal true counts. */
export async function hasCurrentTeenConsent(viewerId: string, subjectId: string): Promise<boolean> {
  if (!UUID.safeParse(viewerId).success || !UUID.safeParse(subjectId).success) return false;
  return await serviceRest<unknown>('/rpc/has_current_teen_consent', {
    method: 'POST', body: JSON.stringify({ p_viewer: viewerId, p_subject: subjectId }),
  }) === true;
}

type DbRefusal = { code: 'P0001'; message: string };
const Refusal = z.object({ code: z.literal('P0001'), message: z.string() });

function refusal(body: unknown): DbRefusal | null {
  const parsed = Refusal.safeParse(body);
  return parsed.success ? parsed.data : null;
}

export type TeenRequestOutcome =
  | { status: 'pending'; requestId: string }
  | { status: 'cooldown' | 'limit' | 'connected' | 'review' | 'managed' | 'unavailable' | 'error' };

export async function requestTeenConnection(requesterId: string, subjectId: string): Promise<TeenRequestOutcome> {
  if (!UUID.safeParse(requesterId).success || !UUID.safeParse(subjectId).success) return { status: 'error' };
  const result = await serviceRestRaw('/rpc/request_teen_connection', {
    method: 'POST', body: JSON.stringify({ p_requester_id: requesterId, p_subject_id: subjectId }),
  });
  if (result.ok) {
    const id = UUID.safeParse(result.body);
    return id.success ? { status: 'pending', requestId: id.data } : { status: 'error' };
  }
  const error = refusal(result.body);
  switch (error?.message) {
    case 'SOCIAL_REQUEST_COOLDOWN': return { status: 'cooldown' };
    case 'SOCIAL_REQUEST_LIMIT': return { status: 'limit' };
    case 'SOCIAL_ALREADY_CONNECTED': return { status: 'connected' };
    case 'PROFILE_REVIEW_REQUIRED': return { status: 'review' };
    case 'GUARDIAN_MANAGED_CONNECTIONS': return { status: 'managed' };
    case 'SOCIAL_REQUEST_UNAVAILABLE': return { status: 'unavailable' };
    default: return { status: 'error' };
  }
}

export type TeenDecisionOutcome = 'accepted' | 'declined' | 'not-found' | 'conflict' | 'review' | 'unavailable';

/** The teen decides; Core always passes the session identity as the subject. */
export async function decideTeenConnection(requestId: string, subjectId: string, accept: boolean): Promise<TeenDecisionOutcome> {
  if (!UUID.safeParse(requestId).success || !UUID.safeParse(subjectId).success) return 'not-found';
  const result = await serviceRestRaw('/rpc/decide_teen_connection', {
    method: 'POST', body: JSON.stringify({ p_request_id: requestId, p_subject_id: subjectId, p_accept: accept }),
  });
  const expected = accept ? 'accepted' : 'declined';
  if (result.ok) return result.body === expected ? expected : 'unavailable';
  const error = refusal(result.body);
  if (!error) return 'unavailable';
  if (error.message === 'SOCIAL_REQUEST_NOT_FOUND') return 'not-found';
  if (error.message === 'PROFILE_REVIEW_REQUIRED') return 'review';
  if (['SOCIAL_DECISION_CONFLICT', 'SOCIAL_CONNECTION_BLOCKED', 'SOCIAL_REQUEST_UNAVAILABLE'].includes(error.message)) return 'conflict';
  return 'unavailable';
}

export interface PendingTeenRequest { requestId: string; requesterId: string; requestedAt: string }

/** The teen's own pending queue, oldest first. The subject filter is bound by Core, never the browser. */
export async function getPendingTeenRequests(subjectId: string, offset: number): Promise<{ requests: PendingTeenRequest[]; nextOffset: number | null } | null> {
  if (!UUID.safeParse(subjectId).success) return null;
  const raw = await serviceRest<unknown>(
    `/social_consent_requests?subject_id=eq.${encodeURIComponent(subjectId)}&status=eq.pending&select=id,requester_id,subject_id,status,requested_at&order=requested_at.asc,id.asc&offset=${offset}&limit=${LIST_LIMIT + 1}`,
  );
  const parsed = z.array(z.object({
    id: UUID, requester_id: UUID, subject_id: UUID, status: z.literal('pending'), requested_at: z.string().datetime({ offset: true }),
  })).safeParse(raw);
  if (!parsed.success || parsed.data.some((row) => row.subject_id !== subjectId)) return null;
  return {
    requests: parsed.data.slice(0, LIST_LIMIT).map((row) => ({ requestId: row.id, requesterId: row.requester_id, requestedAt: row.requested_at })),
    nextOffset: parsed.data.length > LIST_LIMIT ? offset + LIST_LIMIT : null,
  };
}

/** A teen request closed without a connection: declined, removed (a block, or the teen removing them) or withdrawn. */
export const TEEN_REQUEST_CLOSED = ['declined', 'removed', 'withdrawn'] as const;

/**
 * E.3 from the teen's own queue (GAP-FIX-R5 social, D-19): the requester of a
 * request addressed to THIS session that the teen may report or block,
 * whatever the requester's profile visibility: pending, or closed without a
 * connection in the last 30 days. 'not-found' for anything else (someone
 * else's request, an accepted one, an old one); null when unreadable.
 */
export async function getTeenActionableRequest(requestId: string, subjectId: string): Promise<{ requesterId: string } | 'not-found' | null> {
  if (!UUID.safeParse(requestId).success || !UUID.safeParse(subjectId).success) return null;
  const raw = await serviceRest<unknown>(
    `/social_consent_requests?id=eq.${encodeURIComponent(requestId)}&subject_id=eq.${encodeURIComponent(subjectId)}&select=id,requester_id,subject_id,status,decided_at&limit=1`,
  );
  const rows = z.array(z.object({
    id: UUID, requester_id: UUID, subject_id: UUID, status: z.string(), decided_at: z.string().datetime({ offset: true }).nullable(),
  })).max(1).safeParse(raw);
  if (!rows.success) return null;
  const row = rows.data[0];
  if (!row) return 'not-found';
  if (row.id !== requestId || row.subject_id !== subjectId) return null;
  return requestStillActionable(row.status, row.decided_at, TEEN_REQUEST_CLOSED) ? { requesterId: row.requester_id } : 'not-found';
}

/** Whether this requester has a pending request to this teen (null: unreadable). */
export async function hasPendingTeenRequest(requesterId: string, subjectId: string): Promise<boolean | null> {
  if (!UUID.safeParse(requesterId).success || !UUID.safeParse(subjectId).success) return null;
  const raw = await serviceRest<unknown>(
    `/social_consent_requests?requester_id=eq.${encodeURIComponent(requesterId)}&subject_id=eq.${encodeURIComponent(subjectId)}&status=eq.pending&select=id&limit=1`,
  );
  const parsed = z.array(z.object({ id: UUID })).max(1).safeParse(raw);
  return parsed.success ? parsed.data.length === 1 : null;
}

/** The followed account removes one of its followers. true removed, false no such follower, null failure. */
export async function removeSocialFollower(subjectId: string, followerId: string): Promise<boolean | null> {
  if (!UUID.safeParse(subjectId).success || !UUID.safeParse(followerId).success) return null;
  const result = await serviceRestRaw('/rpc/remove_social_follower', {
    method: 'POST', body: JSON.stringify({ p_subject_id: subjectId, p_follower_id: followerId }),
  });
  if (!result.ok) return null;
  return typeof result.body === 'boolean' ? result.body : null;
}

const Count = z.number().int().min(0);
export const SocialSafetyMetrics = z.object({
  accountsByTier: z.object({ guardian: Count, teen: Count, adult: Count, closed: Count }).strict(),
  profileReview: z.object({
    inScope: Count, reviewed: Count, flagged: Count, guardianTierInScope: Count, guardianTierReviewed: Count,
  }).strict(),
  teenConsent: z.object({ pending: Count, accepted: Count, declined: Count, withdrawnOrRemoved: Count }).strict(),
}).strict();
export type SocialSafetyMetrics = z.infer<typeof SocialSafetyMetrics>;

/** Appendix J counts (E.8 tier coverage, E.13 review coverage). Counts only; a malformed answer is a failure. */
export async function readSocialSafetyMetrics(): Promise<SocialSafetyMetrics | null> {
  const parsed = SocialSafetyMetrics.safeParse(await serviceRest<unknown>('/rpc/social_safety_metrics', { method: 'POST', body: '{}' }));
  return parsed.success ? parsed.data : null;
}
