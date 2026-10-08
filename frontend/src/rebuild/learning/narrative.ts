import { z } from 'zod';

/*
 * B.9 / B.13 (S05.3c) — the learner's side of the narrative layer.
 *
 *   narrative_recall   an earlier story decision Core resurfaced when this
 *                      lesson opened (GET /learn/lessons/:id). Core chose it,
 *                      recorded it as resurfaced, and bounded every text to
 *                      the narrative Copy Budget; the client only renders it.
 *   /learn/journal     the learner's own decision journal: read and clear.
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
  | { status: 'ready'; entries: JournalEntry[]; hasMore: boolean }
  | { status: 'error' };

export const JOURNAL_PAGE = 10;

export async function fetchJournal(request: NarrativeTransport, offset = 0): Promise<JournalState> {
  const journal = await call(request, `/learn/journal?limit=${JOURNAL_PAGE}&offset=${offset}`);
  if (journal.error) return { status: 'error' };
  const parsed = journalSchema.safeParse(journal.data);
  return parsed.success ? { status: 'ready', entries: parsed.data.entries, hasMore: parsed.data.hasMore } : { status: 'error' };
}

export async function clearJournal(request: NarrativeTransport): Promise<boolean> {
  const response = await call(request, '/learn/journal', { method: 'DELETE' });
  return response.error === null;
}
