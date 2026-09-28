import { z } from 'zod';
import { serviceRest, serviceRestRaw } from './supabaseRest.js';

/*
 * Appendix J Part 1.1-1.2 for E.1-E.5 (DoD 2.1(3): a requirement is done only
 * when at least one of its metrics is instrumented). The database owns the
 * counting (migration social_protection_metrics): Core reports the events
 * only it sees through record_social_protection_event, which stores counts by
 * day, tier pair and relation, never an identifier, and reads the nine
 * metrics back through social_protection_metrics(days).
 *
 * Recording is best effort and never changes the answer a person gets: a
 * failed write is logged, not surfaced. Reading is strict: a malformed or
 * unreachable answer is null, and the route turns null into a 502, never into
 * a reassuring zero.
 */

export const SOCIAL_PROTECTION_EVENTS = [
  'profile_full', 'profile_card', 'profile_refused',
  'list_full', 'list_refused',
  'action_full', 'action_card', 'action_refused',
  'follow_attempt', 'follow_refused_guardian', 'follow_refused_teen',
  'tutor_badge_shown', 'family_social_panel_view', 'unfollow', 'unblock',
] as const;
export type SocialProtectionEvent = (typeof SOCIAL_PROTECTION_EVENTS)[number];

/** Records one event for the metric; resolves when the write settled. Never throws. */
export async function recordSocialProtectionEvent(event: SocialProtectionEvent, viewerId: string, subjectId: string): Promise<void> {
  try {
    const result = await serviceRestRaw('/rpc/record_social_protection_event', {
      method: 'POST',
      body: JSON.stringify({ p_event: event, p_viewer: viewerId, p_subject: subjectId }),
    });
    if (!result.ok) console.error(`[backend] social protection event ${event} not recorded`);
  } catch (error) {
    console.error(`[backend] social protection event ${event} not recorded:`, error);
  }
}

/** Fire and forget: the metric never delays or fails the request it observes. */
export function noteSocialProtectionEvent(event: SocialProtectionEvent, viewerId: string, subjectId: string): void {
  void recordSocialProtectionEvent(event, viewerId, subjectId);
}

const Count = z.number().int().min(0);
const Rate = z.number().min(0).max(1).nullable();
const Hours = z.number().min(0).nullable();

/** The nine Appendix J metrics, in the order the SPEC lists them. `social:check` pins these keys. */
export const SOCIAL_PROTECTION_METRIC_KEYS = [
  'discovery', 'unauthorizedConnections', 'approvalLatency', 'reports', 'patternEscalation',
  'ageBoundary', 'tutorBadge', 'familySocialPanel', 'auditCompleteness',
] as const;

export const SocialProtectionMetrics = z.object({
  days: z.number().int().min(1).max(366),
  discovery: z.object({ unrelatedAttempts: Count, unrelatedReached: Count, resolutions: Count, rate: Rate }).strict(),
  unauthorizedConnections: z.object({
    followAttempts: Count, refusedGuardianApproval: Count, refusedSubjectConsent: Count,
    guardianRequests: Count, unrelatedGuardianRequests: Count, rate: Rate,
  }).strict(),
  approvalLatency: z.object({
    guardianDecided: Count, guardianPending: Count, guardianP50Hours: Hours, guardianP95Hours: Hours,
    teenDecided: Count, teenP50Hours: Hours, teenP95Hours: Hours,
  }).strict(),
  reports: z.object({ filed: Count, resolved: Count, open: Count, p50ResolutionHours: Hours, p95ResolutionHours: Hours }).strict(),
  patternEscalation: z.object({ qualifying: Count, escalated: Count, rate: Rate }).strict(),
  ageBoundary: z.object({ guardianPath: Count, reviewedFunction: Count, other: Count }).strict(),
  tutorBadge: z.object({ shown: Count, shownUnrelated: Count }).strict(),
  familySocialPanel: z.object({ views: Count, guardiansWithLinkedChild: Count }).strict(),
  auditCompleteness: z.object({
    follows: Count, followsAudited: Count, blocks: Count, blocksAudited: Count, reports: Count, reportsAudited: Count,
    unfollows: Count, unfollowsAudited: Count, unblocks: Count, unblocksAudited: Count, rate: Rate,
  }).strict(),
}).strict();
export type SocialProtectionMetrics = z.infer<typeof SocialProtectionMetrics>;

export async function readSocialProtectionMetrics(days: number): Promise<SocialProtectionMetrics | null> {
  const parsed = SocialProtectionMetrics.safeParse(await serviceRest<unknown>('/rpc/social_protection_metrics', {
    method: 'POST',
    body: JSON.stringify({ p_days: days }),
  }));
  return parsed.success && parsed.data.days === days ? parsed.data : null;
}

/**
 * The Appendix J verdicts, derived from the counts. Targets: discovery,
 * age-boundary bypasses and the badge shown across populations are zero;
 * pattern escalation and audit completeness are 100%. null means no
 * population in the window (never a pass by default).
 */
export function socialProtectionVerdicts(m: SocialProtectionMetrics) {
  return {
    discoveryAtTarget: m.discovery.unrelatedReached === 0,
    ageBoundaryAtTarget: m.ageBoundary.other === 0,
    tutorBadgeAtTarget: m.tutorBadge.shownUnrelated === 0,
    patternEscalationAtTarget: m.patternEscalation.rate === null ? null : m.patternEscalation.rate === 1,
    auditCompletenessAtTarget: m.auditCompleteness.rate === null ? null : m.auditCompleteness.rate === 1,
  };
}
