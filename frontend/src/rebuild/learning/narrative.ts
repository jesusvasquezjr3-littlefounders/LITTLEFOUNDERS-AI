import { z } from 'zod';

/*
 * B.9 / B.13 (S05.3c) — the learner's side of the narrative layer.
 *
 *   narrative_recall   an earlier story decision Core resurfaced when this
 *                      lesson opened (GET /learn/lessons/:id). Core chose it,
 *                      recorded it as resurfaced, and bounded every text to
 *                      the narrative Copy Budget; the client only renders it.
 *   /learn/journal     the learner's own decision journal: read and clear.
 *   /learn/bridges     self-directed "try it for real" prompts. Core returns
 *                      them only to an independent teen (Option B); every
 *                      other learner gets an empty list.
 *
 * A malformed payload is unavailable, never partially shown. Transport is
 * injected, so this module imports nothing from the legacy app (Bible 02
 * rule 23).
 */

const localized = z.record(z.string(), z.unknown());
const snapshot = z.string().min(1).max(280);

export const narrativeRecallSchema = z.object({
  entry_id: z.string().min(1),
  lesson_title: localized,
  situation: snapshot,
  choice: snapshot,
  first_choice: snapshot.nullable(),
  outcome: snapshot.nullable(),
  relevance: z.enum(['shared-skill', 'same-arc']),
  recorded_at: z.string().min(1),
});
export type NarrativeRecall = z.infer<typeof narrativeRecallSchema>;

/** The lesson response's optional recall. Absent or malformed means no recall screen, never a broken lesson. */
export function parseNarrativeRecall(raw: unknown): NarrativeRecall | null {
  if (raw === undefined || raw === null) return null;
  const parsed = narrativeRecallSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export const journalEntrySchema = z.object({
  id: z.string().min(1),
  course: z.object({ slug: z.string().min(1), title: localized }),
  lesson: z.object({ id: z.string().min(1), title: localized }),
  situation: snapshot,
  choice: snapshot,
  firstChoice: snapshot.nullable(),
  outcome: snapshot.nullable(),
  timesDecided: z.number().int().min(1),
  resurfaced: z.number().int().min(0),
  recordedAt: z.string().min(1),
});
export type JournalEntry = z.infer<typeof journalEntrySchema>;
const journalSchema = z.object({ entries: z.array(journalEntrySchema), hasMore: z.boolean() });

export const selfBridgeSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['savings_goal', 'earning_task']),
  skill: localized,
  createdAt: z.string().min(1),
  expiresAt: z.string().min(1),
});
export type SelfBridge = z.infer<typeof selfBridgeSchema>;
const selfBridgesSchema = z.object({ prompts: z.array(selfBridgeSchema) });

export interface NarrativeTransport {
  (path: string, init?: { method: 'GET' | 'POST' | 'DELETE'; body?: unknown }): Promise<{ data: unknown; error: { code: string } | null }>;
}

async function call(request: NarrativeTransport, path: string, init?: Parameters<NarrativeTransport>[1]) {
  try {
    return await request(path, init);
  } catch {
    return { data: null, error: { code: 'NETWORK' } };
  }
}

export type JournalState =
  | { status: 'loading' }
  | { status: 'ready'; entries: JournalEntry[]; hasMore: boolean; bridges: SelfBridge[] }
  | { status: 'error' };

export const JOURNAL_PAGE = 10;

/** The journal page and, alongside, any self prompt. A failed prompt read leaves the journal usable. */
export async function fetchJournal(request: NarrativeTransport, offset = 0): Promise<JournalState> {
  const [journal, bridges] = await Promise.all([
    call(request, `/learn/journal?limit=${JOURNAL_PAGE}&offset=${offset}`),
    offset === 0 ? call(request, '/learn/bridges') : Promise.resolve({ data: { prompts: [] }, error: null }),
  ]);
  if (journal.error) return { status: 'error' };
  const parsed = journalSchema.safeParse(journal.data);
  if (!parsed.success) return { status: 'error' };
  const prompts = bridges.error ? null : selfBridgesSchema.safeParse(bridges.data);
  return { status: 'ready', entries: parsed.data.entries, hasMore: parsed.data.hasMore, bridges: prompts?.success ? prompts.data.prompts : [] };
}

/** Only the self prompts, for the learner shortcut. Unavailable reads as none: a suggestion is never worth an error. */
export async function fetchSelfBridges(request: NarrativeTransport): Promise<SelfBridge[]> {
  const response = await call(request, '/learn/bridges');
  if (response.error) return [];
  const parsed = selfBridgesSchema.safeParse(response.data);
  return parsed.success ? parsed.data.prompts : [];
}

export async function clearJournal(request: NarrativeTransport): Promise<boolean> {
  const response = await call(request, '/learn/journal', { method: 'DELETE' });
  return response.error === null;
}

export type BridgeOutcome = 'done' | 'closed' | 'error';

/** Acting on a self prompt records the teen's own commitment; it creates nothing and takes no details. */
export async function answerSelfBridge(request: NarrativeTransport, id: string, answer: 'act' | 'dismiss'): Promise<BridgeOutcome> {
  const response = await call(request, `/learn/bridges/${encodeURIComponent(id)}/${answer}`, { method: 'POST', body: {} });
  if (!response.error) return 'done';
  return response.error.code === 'BRIDGE_CLOSED' || response.error.code === 'NOT_FOUND' ? 'closed' : 'error';
}
