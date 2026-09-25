import { z } from 'zod';
import type { Locale } from '../design/copyBudget';

/*
 * B.6 / S05.3b — the client side of GET /learn/courses/:slug/path.
 *
 * Core decides everything on this screen: which chapters are the learner's
 * pathway, what is open now, what waits and why, and whether placement comes
 * first. The client only validates the shape and renders it. It never
 * re-derives a lock, never receives an age or a birth date (only the stage
 * names Core resolved), and treats a malformed payload as unavailable rather
 * than guessing. Transport is injected, so this module imports nothing from
 * the legacy app (Bible 02 rule 23).
 */

const stage = z.enum(['child', 'tween', 'teen', 'adult']);
const localized = z.record(z.string(), z.unknown());
const progress = z.object({ passed: z.number().int().nonnegative(), total: z.number().int().nonnegative(), pct: z.number().min(0).max(100) });
const skillRef = z.object({ key: z.string().min(1), title: localized });

export const coursePathSchema = z.object({
  course: z.object({ slug: z.string().min(1), title: localized, badgeAsset: z.string().nullable(), progress }),
  pathway: z.object({
    learnerStage: stage,
    pathwayStage: stage.nullable(),
    basis: z.enum(['own-stage', 'younger-bridge', 'older-early', 'unavailable']),
    placementRequired: z.boolean(),
    badge: z.object({ earnedStages: z.array(stage), eligible: z.boolean(), stage: stage.nullable(), contentGap: z.boolean() }),
    progress: progress.extend({ skillsTaught: z.number().int().nonnegative(), skillsShown: z.number().int().nonnegative(), complete: z.boolean() }),
    advisorySkills: z.array(skillRef),
  }),
  chapters: z.array(z.object({
    id: z.string().min(1), slug: z.string().min(1), title: localized, position: z.number(),
    access: z.enum(['pathway', 'optional', 'closed']), stage: stage.nullable(),
    state: z.enum(['locked', 'available', 'completed']), progress,
  })),
  items: z.array(z.object({
    lessonId: z.string().min(1), lessonTitle: localized, topicId: z.string().min(1), topicTitle: localized, chapterId: z.string(),
    reason: z.enum(['next', 'review', 'review-due', 'bridge', 'known']), access: z.enum(['pathway', 'optional']),
    estimatedMinutes: z.number().nonnegative(), recommended: z.boolean(),
  })),
  blocked: z.array(z.object({ topicId: z.string(), topicTitle: localized, chapterId: z.string(), missingSkills: z.array(skillRef), missingTopics: z.array(z.object({ id: z.string(), title: localized })) })),
  skills: z.array(skillRef.extend({ shown: z.enum(['course', 'mentor', 'none']) })),
});

export type CoursePath = z.infer<typeof coursePathSchema>;
export type CoursePathItem = CoursePath['items'][number];

export type CoursePathState =
  | { status: 'loading' }
  | { status: 'ready'; path: CoursePath }
  | { status: 'age-restricted' }
  | { status: 'prerequisite'; missing: string[] }
  | { status: 'disabled' }
  | { status: 'error' };

/** Shape validation only; an invalid payload is unavailable, never partially shown. */
export function parseCoursePath(raw: unknown): CoursePath | null {
  const parsed = coursePathSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Catalog titles are localized objects: the learner's locale, then the authoring locale, then any. */
export function localizedText(value: Record<string, unknown>, locale: Locale): string {
  const pick = (key: string): string | null => (typeof value[key] === 'string' && (value[key] as string).trim() ? value[key] as string : null);
  return pick(locale) ?? pick('es-MX') ?? pick('en-US') ?? Object.values(value).find((v): v is string => typeof v === 'string' && v.trim().length > 0) ?? '';
}

export interface CoursePathTransport {
  (path: string): Promise<{ data: unknown; error: { code: string; missingPrerequisites?: string[] } | null }>;
}

/** Fetch and map one course path. Every refusal Core can give has its own state. */
export async function fetchCoursePath(slug: string, request: CoursePathTransport): Promise<CoursePathState> {
  let response: Awaited<ReturnType<CoursePathTransport>>;
  try {
    response = await request(`/learn/courses/${encodeURIComponent(slug)}/path`);
  } catch {
    return { status: 'error' };
  }
  if (response.error) {
    switch (response.error.code) {
      case 'COURSE_AGE_RESTRICTED': return { status: 'age-restricted' };
      case 'COURSE_PREREQUISITE_REQUIRED': return { status: 'prerequisite', missing: response.error.missingPrerequisites ?? [] };
      case 'PATHWAY_ENGINE_DISABLED': return { status: 'disabled' };
      default: return { status: 'error' };
    }
  }
  const path = parseCoursePath(response.data);
  return path ? { status: 'ready', path } : { status: 'error' };
}
