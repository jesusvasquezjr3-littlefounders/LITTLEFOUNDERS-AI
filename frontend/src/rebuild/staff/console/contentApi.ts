/*
 * The Content section's wire shapes (S2, W2T.2), hand-mirrored from Core's
 * `routes/admin.ts` and `services/adminData.ts` (no shared types across
 * packages by design) and checked on arrival: a payload of the wrong shape is
 * an error state, never a guessed zero. Every path sits behind Core's
 * `manage_content` grant (G.1).
 *
 *   GET  /admin/content                     courses, summary, B.3 incidents
 *   POST /admin/content/:id/status          publish runs release_course (G.2)
 *   GET  /admin/moderation(/:id)            the lesson review queue and one lesson
 *   POST /admin/moderation/:id/status       approve runs release_lesson (G.2)
 *   GET  /admin/tutor/review-queue          live Mentor activities sampled (C.5)
 *   POST /admin/tutor/review-queue/:id/status   a verdict, audited (G.3)
 *   GET  /admin/tutor/live-content/status   C.5 rates, suspensions, backlog
 *   GET  /admin/tutor/packs?status=review   C.6 packs waiting for a release
 *   GET  /admin/content/learning-quality    B.19 / B.12 / B.5 (S05.3d)
 */

import type { LiveContentStatus, TutorPackSummary } from '../../mentor/liveContentApi';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isCounts = (value: unknown): value is Record<string, number> => isRecord(value) && Object.values(value).every(isNumber);
const arrayOf = <T>(value: unknown, item: (entry: unknown) => entry is T): value is T[] => Array.isArray(value) && value.every(item);

/* ---- Courses and the B.3 incident counter -------------------------------- */

export const COURSE_STATUSES = ['published', 'review', 'draft', 'archived'] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export interface Course {
  id: string; slug: string; title: string; description: string; subject: string; status: string; position: number; createdAt: string;
  adventureCount: number; sagaCount: number; topicCount: number; lessonCount: number; lessonsByStatus: Record<string, number>;
}
/** B.3: one row per course that failed to assemble for a learner, with how often and when last (migration 0107). */
export interface AssemblyIncident { courseId: string; courseTitle: string; occurrenceCount: number; firstSeenAt: string; lastSeenAt: string }
export interface ContentData {
  courses: Course[];
  summary: { courses: Record<string, number>; lessons: Record<string, number> };
  /** Absent from an older Core: read as "none recorded". */
  courseAssemblyIncidents?: AssemblyIncident[];
}

const isCourse = (c: unknown): c is Course => isRecord(c) && isString(c.id) && isString(c.slug) && isString(c.title) && isString(c.subject)
  && isString(c.status) && isNumber(c.topicCount) && isNumber(c.lessonCount) && isCounts(c.lessonsByStatus);
const isIncident = (i: unknown): i is AssemblyIncident => isRecord(i) && isString(i.courseId) && isString(i.courseTitle)
  && isNumber(i.occurrenceCount) && isString(i.lastSeenAt);

/** A malformed incident list is an error, never a silently empty signal (B.3). */
export const isContentData = (value: unknown): value is ContentData => isRecord(value) && arrayOf(value.courses, isCourse)
  && isRecord(value.summary) && isCounts(value.summary.courses) && isCounts(value.summary.lessons)
  && (value.courseAssemblyIncidents === undefined || arrayOf(value.courseAssemblyIncidents, isIncident));

/* ---- The release preflight's refusals (G.2, S05.4c) ---------------------- */

/**
 * Core maps each refusal of `release_course` / `release_lesson` to its own
 * code (routes/admin.ts RELEASE_REFUSALS). The console names the reason and
 * the next step; an unknown code reads as the generic RELEASE_BLOCKED.
 */
export const RELEASE_REFUSALS = {
  RELEASE_NOT_FOUND: 'releaseNotFound',
  RELEASE_ARCHIVED: 'releaseArchived',
  RELEASE_INCOMPLETE_HIERARCHY: 'releaseHierarchy',
  RELEASE_LESSONS_NOT_REVIEWABLE: 'releaseNotReviewable',
  RELEASE_INCOMPLETE_LOCALES: 'releaseLocales',
  RELEASE_VERIFICATION_REQUIRED: 'releaseVerificationRequired',
  RELEASE_VERIFICATION_INCOMPLETE: 'releaseVerificationIncomplete',
  RELEASE_COURSE_RELEASE_REQUIRED: 'releaseCourseRequired',
  RELEASE_BLOCKED: 'releaseBlocked',
} as const;
export type ReleaseRefusalKey = (typeof RELEASE_REFUSALS)[keyof typeof RELEASE_REFUSALS];

/** The copy key of a refusal, or null when the code is not a release refusal (an outage, a refused grant). */
export function releaseRefusal(code: string): ReleaseRefusalKey | null {
  if (code in RELEASE_REFUSALS) return RELEASE_REFUSALS[code as keyof typeof RELEASE_REFUSALS];
  return code.startsWith('RELEASE_') ? RELEASE_REFUSALS.RELEASE_BLOCKED : null;
}

/* ---- The lesson review queue --------------------------------------------- */

export interface ReviewLesson {
  id: string; slug: string; title: string; status: string; courseTitle: string; subject: string;
  adventureTitle: string; sagaTitle: string; topicTitle: string; difficulty: number; xpTotal: number; estimatedMinutes: number;
  createdAt: string; locales: string[];
}
export interface LessonDocumentRow { locale: string; schemaVersion: number; document: Record<string, unknown>; audio: Record<string, unknown> }
export interface LessonDetail extends ReviewLesson { documents: LessonDocumentRow[] }

const isReviewLesson = (l: unknown): l is ReviewLesson => isRecord(l) && isString(l.id) && isString(l.title) && isString(l.status)
  && isString(l.courseTitle) && isString(l.topicTitle) && isString(l.createdAt) && arrayOf(l.locales, isString);
export const isReviewQueue = (value: unknown): value is { lessons: ReviewLesson[]; total: number } => isRecord(value)
  && arrayOf(value.lessons, isReviewLesson) && isNumber(value.total);
export const isLessonDetail = (value: unknown): value is LessonDetail => isReviewLesson(value)
  && arrayOf((value as unknown as Record<string, unknown>).documents, (d): d is LessonDocumentRow => isRecord(d) && isString(d.locale)
    && isNumber(d.schemaVersion) && isRecord(d.document) && (d.audio === undefined || d.audio === null || isRecord(d.audio)));

/** Reading a lesson document for inspection: its parts, its audio and its images, never guessed. */
export interface MediaAsset { id: string; kind: 'audio' | 'image'; label: string; url: string; durationMs?: number }

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);

export function lessonParts(document: Record<string, unknown>): Record<string, unknown>[] {
  return Array.isArray(document.segments) ? document.segments.filter(isRecord) : [];
}

export function partTitle(part: Record<string, unknown>, index: number): string {
  return text(part.title) ?? text(part.prompt_md) ?? text(part.id) ?? String(index + 1);
}

export function audioAssets(audio: Record<string, unknown> | null | undefined): MediaAsset[] {
  const units = audio && isRecord(audio.units) ? audio.units : null;
  if (!units) return [];
  return Object.entries(units).flatMap(([unitId, unit]) => {
    const url = isRecord(unit) ? text(unit.url) : null;
    if (!url || !isRecord(unit)) return [];
    return [{ id: `audio:${unitId}`, kind: 'audio' as const, label: unitId, url, ...(isNumber(unit.duration_ms) ? { durationMs: unit.duration_ms } : {}) }];
  });
}

/** Every distinct `image_url` under the document's parts, with where it sits. */
export function imageAssets(document: Record<string, unknown>): MediaAsset[] {
  const seen = new Set<string>();
  const visited = new WeakSet<object>();
  const found: MediaAsset[] = [];
  const visit = (value: unknown, path: string) => {
    if (Array.isArray(value)) { value.forEach((item, index) => visit(item, `${path}[${index}]`)); return; }
    if (!isRecord(value) || visited.has(value)) return;
    visited.add(value);
    for (const [key, child] of Object.entries(value)) {
      const url = key === 'image_url' ? text(child) : null;
      if (url && !seen.has(url)) { seen.add(url); found.push({ id: `image:${found.length}`, kind: 'image', label: path, url }); }
      visit(child, `${path}.${key}`);
    }
  };
  visit(document.segments, 'segments');
  return found;
}

/* ---- Live Mentor activities (C.5, G.3) and activity packs (C.6) ----------- */

export interface LiveSegment {
  id: string; segment_type: string; payload: Record<string, unknown>; provenance: Record<string, unknown>;
  score: number | null; review_status: string; created_at: string;
}
const isLiveSegment = (s: unknown): s is LiveSegment => isRecord(s) && isString(s.id) && isString(s.segment_type) && isRecord(s.payload)
  && isRecord(s.provenance) && (s.score === null || isNumber(s.score)) && isString(s.created_at);
export const isLiveQueue = (value: unknown): value is { segments: LiveSegment[]; total: number } => isRecord(value)
  && arrayOf(value.segments, isLiveSegment) && isNumber(value.total);

/** Core stamps its own content-risk classification on every live item since S06.12; an older item has none. */
export function riskCategory(segment: LiveSegment): 'standard' | 'sensitive' | null {
  const value = segment.provenance.risk_category;
  return value === 'standard' || value === 'sensitive' ? value : null;
}

/** GET /admin/tutor/live-content/status (the panel reads its own fields; the shape is checked here). */
export const isLiveStatus = (value: unknown): value is LiveContentStatus => isRecord(value)
  && isRecord(value.calibration) && isString(value.calibration.state) && isNumber(value.reviewSlaDays)
  && arrayOf(value.categories, (c): c is Record<string, unknown> => isRecord(c) && (c.category === 'standard' || c.category === 'sensitive')
    && typeof c.suspended === 'boolean' && Array.isArray(c.reasons) && isNumber(c.rate) && isNumber(c.floor) && isNumber(c.overdue));

export const isPacks = (value: unknown): value is { packs: TutorPackSummary[]; total: number } => isRecord(value)
  && isNumber(value.total) && arrayOf(value.packs, (p): p is TutorPackSummary => isRecord(p) && isString(p.id)
    && isString(p.skill_key) && isNumber(p.tier) && isString(p.locale) && isRecord(p.pack) && Array.isArray(p.pack.segments));

/** The views of the Content page, in order. `?view=` on the route opens one directly. */
export const CONTENT_VIEWS = ['courses', 'review', 'live', 'quality'] as const;
export type ContentView = (typeof CONTENT_VIEWS)[number];
export function contentView(value: string | null | undefined): ContentView {
  return (CONTENT_VIEWS as readonly string[]).includes(value ?? '') ? value as ContentView : 'courses';
}
