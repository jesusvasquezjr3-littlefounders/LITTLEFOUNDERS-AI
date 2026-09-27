import { z } from 'zod';

/*
 * OD-27 (3), owner review item L-13 — the verified Tutor's read of a
 * parent-created child's story choices, the client of
 * GET /api/v1/family/learning/kids/:kidId/decisions.
 *
 * Core is the enforcing boundary: a parent role with a current verified adult
 * identity, a verified link to this exact child, and the child under 13 and
 * parent-created (journalSharing.ts). A teen's journal is private: Core answers
 * JOURNAL_PRIVATE and this module reports it as 'private', which the panel
 * renders as nothing at all. Titles arrive in the Tutor's locale. Each entry
 * is minimised to the situation and the chosen option.
 *
 * Transport is injected (Bible 02 rule 23); this module authorizes nothing.
 */

const text = z.string().min(1).max(280);
export const childDecisionSchema = z.object({
  id: z.string().min(1),
  courseTitle: z.string(),
  lessonTitle: z.string(),
  situation: text,
  choice: text,
  recordedAt: z.string().min(1),
}).strict();
export type ChildDecision = z.infer<typeof childDecisionSchema>;
const pageSchema = z.object({ locale: z.enum(['en-US', 'es-MX', 'pt-BR']), entries: z.array(childDecisionSchema), hasMore: z.boolean() }).strict();

export type ChildDecisionsState =
  | { status: 'loading' }
  | { status: 'ready'; entries: ChildDecision[]; hasMore: boolean }
  | { status: 'private' }
  | { status: 'error' };

export interface ChildDecisionsTransport {
  (path: string, init?: { method: 'GET' }): Promise<{ data: unknown; error: { code: string } | null }>;
}

export const CHILD_DECISIONS_PAGE = 10;

export async function fetchChildDecisions(request: ChildDecisionsTransport, kidId: string, offset = 0): Promise<ChildDecisionsState> {
  let response: Awaited<ReturnType<ChildDecisionsTransport>>;
  try {
    response = await request(`/family/learning/kids/${encodeURIComponent(kidId)}/decisions?limit=${CHILD_DECISIONS_PAGE}&offset=${offset}`);
  } catch {
    return { status: 'error' };
  }
  // A private journal, a lost link and a lapsed verification all show nothing: the answer reveals nothing either.
  if (response.error) return ['JOURNAL_PRIVATE', 'NOT_FOUND', 'PARENT_VERIFICATION_REQUIRED', 'FORBIDDEN'].includes(response.error.code)
    ? { status: 'private' } : { status: 'error' };
  const parsed = pageSchema.safeParse(response.data);
  return parsed.success ? { status: 'ready', entries: parsed.data.entries, hasMore: parsed.data.hasMore } : { status: 'error' };
}
