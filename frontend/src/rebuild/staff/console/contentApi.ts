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
 *   GET  /admin/content/lesson-versions     new versions of live lessons waiting (G.2)
 *   POST /admin/content/lessons/:id/versions/:v/release|reject   the staff decision (G.2)
 *   GET  /admin/content/bypass-checks       Appendix N 1.2 rates and the retroactive checks
 *   GET  /admin/content/lessons/:id/versions/:v   one version's document, as a learner is served it (GAP-FIX-R6)
 *   POST /admin/content/lessons/:id/preview-grade  a preview answer checked, nothing recorded (GAP-FIX-R6)
 *   GET|POST /admin/content/lessons/:id/pedagogical-review   Appendix C Stage 3 (stage3Api.ts)
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
  // GAP-FIX-R6: no passing Appendix C Stage 3 pedagogical review covers the content (Stage3Review.tsx records one).
  RELEASE_STAGE3_REVIEW_REQUIRED: 'releaseStage3Required',
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
/**
 * A document as the learner is served it (Core's staffLessonPreview.ts). For
 * v2: the immutable version it is, whether Core would deliver it at all
 * (`playable`), and the Mentor stage and narration delivered beside it.
 */
export interface LessonDocumentRow {
  locale: string; schemaVersion: number; document: Record<string, unknown>; audio: Record<string, unknown>;
  documentVersionId?: string | null; playable?: boolean; mentorStage?: unknown; narrationAudio?: unknown;
}
export interface LessonDetail extends ReviewLesson { documents: LessonDocumentRow[] }

const isReviewLesson = (l: unknown): l is ReviewLesson => isRecord(l) && isString(l.id) && isString(l.title) && isString(l.status)
  && isString(l.courseTitle) && isString(l.topicTitle) && isString(l.createdAt) && arrayOf(l.locales, isString);
export const isReviewQueue = (value: unknown): value is { lessons: ReviewLesson[]; total: number } => isRecord(value)
  && arrayOf(value.lessons, isReviewLesson) && isNumber(value.total);
const isLessonDocumentRow = (d: unknown): d is LessonDocumentRow => isRecord(d) && isString(d.locale)
  && isNumber(d.schemaVersion) && isRecord(d.document) && (d.audio === undefined || d.audio === null || isRecord(d.audio))
  && (d.documentVersionId === undefined || d.documentVersionId === null || isString(d.documentVersionId))
  && (d.playable === undefined || typeof d.playable === 'boolean');
export const isLessonDetail = (value: unknown): value is LessonDetail => isReviewLesson(value)
  && arrayOf((value as unknown as Record<string, unknown>).documents, isLessonDocumentRow);

/** GAP-FIX-R6: a pending version's document for the Live updates preview. */
export type VersionDocument = LessonDocumentRow & { lessonId: string };
export const isVersionDocument = (value: unknown): value is VersionDocument => isLessonDocumentRow(value) && isString((value as unknown as Record<string, unknown>).lessonId);
export const versionDocumentPath = (lessonId: string, documentVersionId: string) =>
  `/admin/content/lessons/${encodeURIComponent(lessonId)}/versions/${encodeURIComponent(documentVersionId)}`;

/**
 * GAP-FIX-R6: the reviewer's answer, checked by Core with the learner's scorer
 * and recorded nowhere. `met` / `review` is what the learner's board shows.
 */
export interface PreviewVerdict { verdict: 'met' | 'review'; judgment?: string; diagnostic?: string }
export const previewGradePath = (lessonId: string) => `/admin/content/lessons/${encodeURIComponent(lessonId)}/preview-grade`;
export function previewVerdict(value: unknown): PreviewVerdict | null {
  if (!isRecord(value) || !isRecord(value.verdict) || typeof value.verdict.correct !== 'boolean') return null;
  const { correct, judgment, diagnostic } = value.verdict;
  return { verdict: correct ? 'met' : 'review', ...(isString(judgment) ? { judgment } : {}), ...(isString(diagnostic) ? { diagnostic } : {}) };
}

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

/* ---- Live updates: pending v2 versions and the retroactive checks (G.2) -- */

/** A new version of a lesson that is already live, waiting for a staff release (Core services/contentRelease.ts). */
export interface PendingVersion {
  requestId: string; lessonId: string; lessonSlug: string | null; lessonTitle: Record<string, string>; lessonStatus: string | null;
  locale: string; documentVersionId: string; versionId: string; documentSha256: string; runId: string | null; submittedAt: string;
}
const isPendingVersion = (v: unknown): v is PendingVersion => isRecord(v) && isString(v.requestId) && isString(v.lessonId)
  && (v.lessonSlug === null || isString(v.lessonSlug)) && isRecord(v.lessonTitle) && Object.values(v.lessonTitle).every(isString)
  && isString(v.locale) && isString(v.documentVersionId) && isString(v.versionId) && isString(v.submittedAt);
export const isPendingVersions = (value: unknown): value is { versions: PendingVersion[]; total: number } => isRecord(value)
  && arrayOf(value.versions, isPendingVersion) && isNumber(value.total);

/** The lesson's title in the reader's language, then English, then its slug. */
export function versionTitle(version: PendingVersion, locale: string): string {
  return version.lessonTitle[locale] ?? version.lessonTitle['en-US'] ?? Object.values(version.lessonTitle)[0] ?? version.lessonSlug ?? version.lessonId;
}

export const RETRO_STATES = ['overdue', 'open', 'closed_late', 'closed'] as const;
export type RetroState = (typeof RETRO_STATES)[number];
export const BYPASS_ACTIONS = ['content.live_document_patched', 'content.v2_emergency_activation', 'forge.v2_lesson_published'] as const;
export interface RetroCheck {
  id: number; action: string; lessonId: string | null; courseId: string | null; locale: string | null;
  occurredAt: string; dueAt: string; justified: boolean; closedAt: string | null; closingVerifiedAt: string | null; state: RetroState;
}
export interface BypassReport {
  windowDays: number; retroCheckDays: number; bypassRate: number | null; completenessRate: number | null;
  counts: { publishActions: number; bypasses: number; decided: number; unverified: number; complete: number; pending: number; overdue: number };
  checks: RetroCheck[];
}
const isNullableNumber = (value: unknown): value is number | null => value === null || isNumber(value);
const isRetroCheck = (c: unknown): c is RetroCheck => isRecord(c) && isNumber(c.id) && isString(c.action) && isString(c.occurredAt)
  && isString(c.dueAt) && typeof c.justified === 'boolean' && (RETRO_STATES as readonly unknown[]).includes(c.state);
/** A malformed report is an error state: a missing rate is never shown as a calm zero. */
export const isBypassReport = (value: unknown): value is BypassReport => isRecord(value) && isNumber(value.windowDays)
  && isNumber(value.retroCheckDays) && isNullableNumber(value.bypassRate) && isNullableNumber(value.completenessRate)
  && isCounts(value.counts) && ['publishActions', 'bypasses', 'decided', 'unverified', 'complete', 'pending', 'overdue'].every((k) => isNumber((value.counts as Record<string, unknown>)[k]))
  && arrayOf(value.checks, isRetroCheck);

/** Core's codes for a version decision: a release refusal (named by RELEASE_REFUSALS) or one of these. */
export function versionRefusal(code: string): ReleaseRefusalKey | 'versionNotPending' | null {
  if (code === 'VERSION_NOT_PENDING') return 'versionNotPending';
  return releaseRefusal(code);
}

/** The views of the Content page, in order. `?view=` on the route opens one directly. */
export const CONTENT_VIEWS = ['courses', 'review', 'updates', 'live', 'quality'] as const;
export type ContentView = (typeof CONTENT_VIEWS)[number];
export function contentView(value: string | null | undefined): ContentView {
  return (CONTENT_VIEWS as readonly string[]).includes(value ?? '') ? value as ContentView : 'courses';
}
