import { z } from 'zod';

/*
 * B.10 / B.13 (S05.3c) — the guardian's side of course learning, the client of
 * /api/v1/family/learning. Core is the enforcing boundary: it checks the
 * verified parent and the verified link to this child on every request, picks
 * the guardian's locale for every title, and never sends the child's story
 * choices (only how many there were). This module validates shapes and maps
 * refusals; it authorizes nothing. Transport is injected (Bible 02 rule 23).
 */

const title = z.string();

export const narrativeEntrySchema = z.object({
  lessonId: z.string().min(1),
  lessonTitle: title,
  topicTitle: title,
  courseTitle: title,
  completedAt: z.string().min(1),
  skills: z.array(title).max(2),
  struggle: z.enum(['none', 'resolved', 'open']).nullable(),
  usedHint: z.boolean(),
  decisions: z.number().int().min(0),
  topicComplete: z.boolean(),
  conversation: z.enum(['decision', 'explain']),
}).strict();
export type NarrativeEntry = z.infer<typeof narrativeEntrySchema>;

const narrativeSchema = z.object({
  locale: z.enum(['en-US', 'es-MX', 'pt-BR']),
  week: z.object({ lessons: z.number().int().min(0), topicsCompleted: z.number().int().min(0) }),
  entries: z.array(narrativeEntrySchema),
  hasMore: z.boolean(),
});

export const guardianBridgeSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['savings_goal', 'earning_task']),
  skill: title,
  createdAt: z.string().min(1),
  expiresAt: z.string().min(1),
}).strict();
export type GuardianBridge = z.infer<typeof guardianBridgeSchema>;
const bridgesSchema = z.object({ prompts: z.array(guardianBridgeSchema) });

export interface FamilyLearningTransport {
  (path: string, init?: { method: 'GET' | 'POST'; body?: unknown }): Promise<{ data: unknown; error: { code: string } | null }>;
}

async function call(request: FamilyLearningTransport, path: string, init?: Parameters<FamilyLearningTransport>[1]) {
  try {
    return await request(path, init);
  } catch {
    return { data: null, error: { code: 'NETWORK' } };
  }
}

const ACCESS_LOST = new Set(['PARENT_VERIFICATION_REQUIRED', 'FORBIDDEN', 'NOT_FOUND', 'UNAUTHORIZED']);
export const NARRATIVE_PAGE = 5;

export type NarrativeState =
  | { status: 'loading' }
  | { status: 'ready'; week: { lessons: number; topicsCompleted: number }; entries: NarrativeEntry[]; hasMore: boolean }
  | { status: 'no-access' }
  | { status: 'error' };

const base = (kidId: string) => `/family/learning/kids/${encodeURIComponent(kidId)}`;

export async function fetchKidNarrative(request: FamilyLearningTransport, kidId: string, offset = 0): Promise<NarrativeState> {
  const response = await call(request, `${base(kidId)}/narrative?limit=${NARRATIVE_PAGE}&offset=${offset}`);
  if (response.error) return ACCESS_LOST.has(response.error.code) ? { status: 'no-access' } : { status: 'error' };
  const parsed = narrativeSchema.safeParse(response.data);
  return parsed.success ? { status: 'ready', week: parsed.data.week, entries: parsed.data.entries, hasMore: parsed.data.hasMore } : { status: 'error' };
}

export type BridgesState =
  | { status: 'loading' }
  | { status: 'ready'; prompts: GuardianBridge[] }
  | { status: 'no-access' }
  | { status: 'error' };

export async function fetchKidBridges(request: FamilyLearningTransport, kidId: string): Promise<BridgesState> {
  const response = await call(request, `${base(kidId)}/bridges`);
  if (response.error) return ACCESS_LOST.has(response.error.code) ? { status: 'no-access' } : { status: 'error' };
  const parsed = bridgesSchema.safeParse(response.data);
  return parsed.success ? { status: 'ready', prompts: parsed.data.prompts } : { status: 'error' };
}

export type BridgeDetails =
  | { action: 'savings_goal'; title: string; target: number; icon: GoalIcon }
  | { action: 'earning_task'; title: string; rewardCoins: number; recurrence: 'once' | 'weekly' };

export const GOAL_ICONS = ['star', 'game', 'toy', 'book', 'bike', 'trip', 'gift'] as const;
export type GoalIcon = (typeof GOAL_ICONS)[number];
export const GOAL_TARGET_MAX = 100000;
export const TASK_REWARD_MAX = 500;

export type BridgeResult = 'created' | 'dismissed' | 'closed' | 'invalid' | 'no-access' | 'error';

export async function actOnKidBridge(request: FamilyLearningTransport, kidId: string, promptId: string, details: BridgeDetails): Promise<BridgeResult> {
  const response = await call(request, `${base(kidId)}/bridges/${encodeURIComponent(promptId)}/act`, { method: 'POST', body: details });
  if (!response.error) return 'created';
  return mapRefusal(response.error.code);
}

export async function dismissKidBridge(request: FamilyLearningTransport, kidId: string, promptId: string): Promise<BridgeResult> {
  const response = await call(request, `${base(kidId)}/bridges/${encodeURIComponent(promptId)}/dismiss`, { method: 'POST', body: {} });
  if (!response.error) return 'dismissed';
  return mapRefusal(response.error.code);
}

function mapRefusal(code: string): BridgeResult {
  if (code === 'BRIDGE_CLOSED') return 'closed';
  if (code === 'VALIDATION_ERROR') return 'invalid';
  if (ACCESS_LOST.has(code)) return 'no-access';
  return 'error';
}
