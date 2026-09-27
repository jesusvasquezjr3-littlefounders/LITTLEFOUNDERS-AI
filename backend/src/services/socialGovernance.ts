import { z } from 'zod';
import { serviceRestRaw } from './supabaseRest.js';

/*
 * E.10, E.11 and E.12 standing guardrails, Core side
 * (policy: docs/rebuild/policies/SOCIAL-GOVERNANCE.md).
 *
 * The database owns the rules: the retention sweep, the consent rule for an
 * edge that exposes a child, the live-catalog messaging scan and the metric
 * are SQL functions (migrations social_standing_guardrails and
 * social_graph_retention). Core only calls them with the service role and
 * validates what comes back. An unreadable or malformed answer is null, and
 * every caller turns null into a 502, never into a reassuring zero (§1.14).
 */

/**
 * E.11 retention windows, in days. The database's
 * public.social_retention_windows() is what the sweep applies; this copy lets
 * the metric route say whether the deployed database still matches the
 * written policy, and `guardrails:check` compares all three literally.
 */
export const SOCIAL_RETENTION_WINDOWS = {
  pendingRequestDays: 30,
  closedRequestDays: 30,
  reportNoteDays: 90,
  resolvedReportDays: 365,
  resolvedCaseDays: 365,
  readNoticeDays: 90,
  unreadNoticeDays: 365,
} as const;

/**
 * E.10 vocabulary: a route, table, column or function whose name carries one
 * of these words is a person-to-person messaging surface until the policy's
 * review says otherwise. Same list as public.social_messaging_surfaces() and
 * `guardrails:check`.
 */
export const MESSAGING_VOCABULARY = [
  'message', 'messages', 'messaging', 'chat', 'chats', 'chatroom', 'chatrooms',
  'comment', 'comments', 'conversation', 'conversations', 'inbox', 'outbox', 'dm', 'dms',
  'directmessage', 'directmessages', 'thread', 'threads', 'reply', 'replies', 'mention', 'mentions',
  'whisper', 'whispers', 'guestbook', 'shoutout', 'shoutouts', 'reaction', 'reactions',
  'sticker', 'stickers', 'pm', 'pms', 'mailbox', 'wallpost', 'wallposts', 'poke', 'pokes',
  'greeting', 'greetings',
] as const;

const VOCABULARY = new Set<string>(MESSAGING_VOCABULARY);

/** The messaging words a name carries, split on every non-alphanumeric boundary and camelCase. */
export function messagingWords(name: string): string[] {
  const tokens = name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return [...new Set(tokens.filter((token) => VOCABULARY.has(token)))];
}

export const SOCIAL_RETENTION_MAX_LIMIT = 5000;

const Count = z.number().int().min(0);

export const SocialRetentionRun = z.object({
  teenPendingExpired: Count,
  guardianPendingExpired: Count,
  teenClosedDeleted: Count,
  guardianClosedDeleted: Count,
  reportNotesCleared: Count,
  resolvedReportsDeleted: Count,
  resolvedCasesDeleted: Count,
  noticesDeleted: Count,
  unconsentedEdgesRemoved: Count,
  // L-04 (OD-27 (1)), migration cooperative_goals_retention. Optional so this
  // Core still reads a database that has not applied it yet.
  coopGoalsReconciled: Count.optional(),
  coopGoalsDeleted: Count.optional(),
  coopConsentsDeleted: Count.optional(),
  limit: z.number().int().min(1).max(SOCIAL_RETENTION_MAX_LIMIT),
  complete: z.boolean(),
}).strict();
export type SocialRetentionRun = z.infer<typeof SocialRetentionRun>;

/** One bounded sweep. The database audits the run (social_retention.sweep_ran) in the same transaction. */
export async function runSocialGraphRetention(limit: number): Promise<SocialRetentionRun | null> {
  const result = await serviceRestRaw('/rpc/run_social_graph_retention', {
    method: 'POST', body: JSON.stringify({ p_limit: limit }),
  });
  if (!result.ok) return null;
  const parsed = SocialRetentionRun.safeParse(result.body);
  return parsed.success && parsed.data.limit === limit ? parsed.data : null;
}

const Windows = z.object(Object.fromEntries(Object.keys(SOCIAL_RETENTION_WINDOWS).map((key) => [key, z.number().int().min(1)])) as Record<keyof typeof SOCIAL_RETENTION_WINDOWS, z.ZodNumber>).strict();

export const SocialGovernanceMetrics = z.object({
  windows: Windows,
  overdue: z.object({
    teenPending: Count, guardianPending: Count, teenClosed: Count, guardianClosed: Count, reportNotes: Count,
    resolvedReports: Count, resolvedCases: Count, notices: Count,
  }).strict(),
  unconsentedChildEdges: Count,
  // Schema object names only (e.g. "table:direct_messages"), never data.
  messagingSurfaces: z.array(z.string().regex(/^(table|view|column|function|text):[a-z0-9_.]{1,200}$/)).max(500),
  offSchema: z.object({ avatars: Count, covers: Count }).strict(),
  lastSweep: z.object({
    at: z.string().datetime({ offset: true }),
    counts: z.record(z.string(), z.unknown()),
  }).strict().nullable(),
}).strict();
export type SocialGovernanceMetrics = z.infer<typeof SocialGovernanceMetrics>;

export async function readSocialGovernanceMetrics(): Promise<SocialGovernanceMetrics | null> {
  const result = await serviceRestRaw('/rpc/social_governance_metrics', { method: 'POST', body: '{}' });
  if (!result.ok) return null;
  const parsed = SocialGovernanceMetrics.safeParse(result.body);
  return parsed.success ? parsed.data : null;
}

/** True when the deployed database applies exactly the windows the written policy states. */
export function windowsMatchPolicy(windows: SocialGovernanceMetrics['windows']): boolean {
  return (Object.keys(SOCIAL_RETENTION_WINDOWS) as (keyof typeof SOCIAL_RETENTION_WINDOWS)[])
    .every((key) => windows[key] === SOCIAL_RETENTION_WINDOWS[key]);
}
