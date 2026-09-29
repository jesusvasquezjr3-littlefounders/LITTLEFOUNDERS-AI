import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  Banner, Button, Card, Chip, ConfirmDialog, DataTable, EmptyState, InlineNotice, List, ListRow, SegmentedControl, SelectField, Sheet,
  TextAreaField, TextField, useRebuildEnvironment, type StatusTone, type TableColumn,
} from '../../design/controls';
import { LiveContentStatusPanel, PackRelease, type PackResult } from '../../mentor/LiveContentGovernance';
import { reviewBody, type PackStatus, type ReviewDecision } from '../../mentor/liveContentApi';
import { LearningQualityPanel, type DecisionOutcome } from '../../learning/LearningQualityPanel';
import type { ReviewDecisionBody } from '../../learning/learningQualityReport';
import {
  audioAssets, CONTENT_VIEWS, COURSE_STATUSES, imageAssets, isBypassReport, isContentData, isLessonDetail, isLiveQueue, isLiveStatus, isPacks,
  isPendingVersions, isReviewQueue, isVersionDocument, lessonParts, partTitle, previewGradePath, previewVerdict, releaseRefusal, riskCategory,
  versionDocumentPath, versionRefusal, versionTitle, type ContentView, type Course, type LessonDetail, type LessonDocumentRow, type LiveSegment,
  type PendingVersion, type PreviewVerdict, type ReleaseRefusalKey, type RetroCheck, type RetroState, type ReviewLesson,
} from './contentApi';
import { useStaffRead, type StaffApi } from './staffConsoleApi';
import { Stage3Review } from './Stage3Review';
import { CopyId, Facts, LoadFailure, Loading, Metrics, ShareBars, StaffPage, useFormats } from './ConsoleParts';
import { fill, useConsoleCopy, type ConsoleCopy } from './staffConsoleCopy';

/*
 * S2 Content (manage_content), W2T.2. Everything a content reviewer decides
 * before a child sees it, in four views of one page:
 *
 *   Courses            publish, move to draft or archive a course. Publishing
 *                      is a release: Core runs release_course (G.2, S05.4c)
 *                      and each refusal is named with its next step.
 *   Lesson review      the human review queue: inspect a lesson in each
 *                      language (the learner's own player, its parts, audio,
 *                      images and client-safe document), record its Appendix
 *                      C Stage 3 pedagogical review (Stage3Review.tsx), then
 *                      approve (a release through release_lesson, refused
 *                      without a passing review) or send it back.
 *   Live updates       G.2: a new Forge version of a lesson that is already
 *                      live waits here for a staff release (Core re-runs the
 *                      course verification) or a rejection with a reason,
 *                      after the reviewer has played it (GAP-FIX-R6);
 *                      below it, every skipped release check with its 30-day
 *                      retroactive check and Appendix N 1.2's two rates.
 *   Mentor activities  C.5's live-content status, the sampled live Mentor
 *                      activities with three equal verdicts (each one also in
 *                      the audit log, G.3), and C.6's activity packs waiting
 *                      for a human release.
 *   Learning quality   S05.3d's panel (B.19, B.12, B.5).
 *
 * B.3: a course that failed to assemble for a learner is listed at the top
 * until the structure is fixed. Core checks the grant on every read and write;
 * the page never substitutes for that.
 */

/**
 * The learner's own lesson renderer, handed in by the route host (the rebuilt
 * console never imports a player itself). GAP-FIX-R6 (02 rule 23, D13, OD-24):
 * the host follows the learner route's split. A v2 document (schema 2) plays in
 * the rebuilt lesson view; only a v1 document (schema 1) plays in the legacy
 * v1 player, the one sanctioned island. Any other schema has no preview.
 */
export interface LessonPreviewRequest {
  lessonId: string; locale: string; schemaVersion: number; document: Record<string, unknown>; audio: Record<string, unknown>;
  /** v2: the compact Mentor stage and the narration Core delivers beside the document. */
  mentorStage?: unknown; narrationAudio?: unknown;
  /** v2: checks an answer through Core with the learner's scorer, recording nothing; throws when Core cannot answer. */
  grade: (segmentId: string, answer: unknown) => Promise<PreviewVerdict>;
  labels: { start: string; next: string; loading: string; dialog: string; bar: string; close: string }; onExit: () => void;
}
export type LessonPreviewRenderer = (request: LessonPreviewRequest) => ReactNode;
/** The schemas a lesson preview exists for: 1 (the legacy island, OD-24) and 2 (the rebuilt view). */
export const PREVIEW_SCHEMAS: readonly number[] = [1, 2];

/** GAP-FIX-R6: the preview's grader, bound to one document (the named version, or the served document in its locale). */
function previewGrader(api: StaffApi, lessonId: string, row: Pick<LessonDocumentRow, 'locale' | 'documentVersionId'>) {
  return async (segmentId: string, answer: unknown): Promise<PreviewVerdict> => {
    const result = await api.post<unknown>(previewGradePath(lessonId), {
      locale: row.locale, segment_id: segmentId, answer, ...(row.documentVersionId ? { document_version_id: row.documentVersionId } : {}),
    });
    const verdict = result.ok ? previewVerdict(result.data) : null;
    if (!verdict) throw new Error(result.ok ? 'Malformed preview verdict' : result.code);
    return verdict;
  };
}

/** One request for the host's renderer, from a served document row. */
function previewRequest(copy: ConsoleCopy, api: StaffApi, lessonId: string, row: LessonDocumentRow, onExit: () => void): LessonPreviewRequest {
  const t = copy.content;
  return {
    lessonId, locale: row.locale, schemaVersion: row.schemaVersion, document: row.document, audio: row.audio ?? {},
    mentorStage: row.mentorStage, narrationAudio: row.narrationAudio, grade: previewGrader(api, lessonId, row),
    labels: { start: t.action.startPreview, next: t.action.nextPreview, loading: t.body.previewLoading, dialog: t.heading.preview, bar: t.body.previewBar, close: t.action.closePreview },
    onExit,
  };
}

/** The preview panel of a sheet: what opening it does, whether a learner can get this document at all, and the button. */
function PreviewPanel({ row, available, onOpen }: { row: LessonDocumentRow; available: boolean; onOpen: () => void }) {
  const { copy } = useConsoleCopy();
  const t = copy.content;
  const canPreview = available && PREVIEW_SCHEMAS.includes(row.schemaVersion);
  return <div className="lf-staff-stack" data-inspect="preview" data-schema={row.schemaVersion}>
    <p data-copy-role="body">{!canPreview ? t.body.previewUnavailable : row.schemaVersion === 2 ? t.body.previewHelpV2 : t.body.previewHelp}</p>
    {row.schemaVersion === 2 && row.playable === false ? <InlineNotice tone="error">{t.body.notPlayable}</InlineNotice> : null}
    {canPreview ? <div><Button variant="brand" onClick={onOpen}>{t.action.openPlayer}</Button></div> : null}
  </div>;
}

function statusChip(copy: ConsoleCopy, status: string) {
  const t = copy.content.option;
  if (status === 'published') return <Chip tone="success" glyph="check">{t.published}</Chip>;
  if (status === 'review') return <Chip tone="warning" glyph="info">{t.review_status}</Chip>;
  if (status === 'draft') return <Chip tone="sky" glyph="info">{t.draft}</Chip>;
  if (status === 'archived') return <Chip tone="primary" glyph="minus">{t.archived}</Chip>;
  return <Chip tone="sky" glyph="info">{status}</Chip>;
}

/**
 * Keeps focus on the page when a reload removes the row that had it (a decided
 * lesson or activity leaves its queue). Armed only by that reload, so a first
 * load never takes focus from the skip link or the route's own focus.
 */
function useFocusRescue(target: RefObject<HTMLElement>, load: { state: string; refreshing?: boolean }) {
  const armed = useRef(false);
  useEffect(() => {
    if (!armed.current || load.state === 'loading' || load.refreshing) return;
    armed.current = false;
    const active = document.activeElement;
    if ((!active || active === document.body || !active.isConnected) && target.current) target.current.focus();
  }, [load, target]);
  return () => { armed.current = true; };
}

/* ------------------------------------------------------------------------- */
/*  Release refusals (G.2)                                                   */
/* ------------------------------------------------------------------------- */

type Outcome = { kind: 'done'; message: string } | { kind: 'refused'; key: ReleaseRefusalKey | 'versionNotPending'; code: string } | { kind: 'failed' };

function OutcomeNotice({ outcome }: { outcome: Outcome | null }) {
  const { copy } = useConsoleCopy();
  if (!outcome) return null;
  if (outcome.kind === 'done') return <InlineNotice tone="success" live>{outcome.message}</InlineNotice>;
  if (outcome.kind === 'failed') return <InlineNotice tone="error" live>{copy.common.body.actionFailed}</InlineNotice>;
  return <div className="lf-staff-refusal" data-refusal={outcome.code}>
    <h3 data-copy-role="heading" className="lf-staff-subheading">{copy.content.heading.refused}</h3>
    <Banner tone="error">{copy.content.body[outcome.key]}</Banner>
  </div>;
}

function outcomeOf(result: { ok: true } | { ok: false; code: string }, message: string): Outcome {
  if (result.ok) return { kind: 'done', message };
  const key = releaseRefusal(result.code);
  return key ? { kind: 'refused', key, code: result.code } : { kind: 'failed' };
}

/* ------------------------------------------------------------------------- */
/*  Courses                                                                  */
/* ------------------------------------------------------------------------- */

type CourseAction = 'published' | 'draft' | 'archived';

function CourseSheet({ api, course, onClose, onChanged }: { api: StaffApi; course: Course; onClose: () => void; onChanged: () => void }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.content;
  const [confirming, setConfirming] = useState<CourseAction | null>(null);
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const counts = course.lessonsByStatus;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const act = async (status: CourseAction) => {
    setPending(true);
    setOutcome(null);
    const result = await api.post(`/admin/content/${course.id}/status`, { status });
    setPending(false);
    setConfirming(null);
    setOutcome(outcomeOf(result, status === 'published' ? t.body.published : status === 'draft' ? t.body.unpublished : t.body.archived));
    if (result.ok) onChanged();
  };
  const dialog = confirming === 'published' ? { heading: t.heading.confirmPublish, consequence: t.body.consequencePublish, label: t.action.publish }
    : confirming === 'draft' ? { heading: t.heading.confirmUnpublish, consequence: t.body.consequenceUnpublish, label: t.action.unpublish }
      : { heading: t.heading.confirmArchive, consequence: t.body.consequenceArchive, label: t.action.archive };
  return <><Sheet open onClose={onClose} heading={t.heading.course} closeLabel={copy.common.action.close}>
    <div className="lf-staff-sheet" data-sheet="course">
      <Facts items={[
        { id: 'title', label: t.body.course, value: course.title, ugc: true },
        { id: 'status', label: t.body.status, value: statusChip(copy, course.status) },
      ]} />
      <InlineNotice tone="info">{t.body.releaseNote}</InlineNotice>
      <div className="lf-staff-actions">
        {course.status !== 'published' ? <Button variant="success" aria-haspopup="dialog" disabled={pending} onClick={() => setConfirming('published')}>{t.action.publish}</Button> : null}
        {course.status === 'published' ? <Button aria-haspopup="dialog" disabled={pending} onClick={() => setConfirming('draft')}>{t.action.unpublish}</Button> : null}
        {course.status !== 'archived' ? <Button aria-haspopup="dialog" disabled={pending} onClick={() => setConfirming('archived')}>{t.action.archive}</Button> : null}
      </div>
      <OutcomeNotice outcome={outcome} />
      {course.description ? <p data-copy-role="data" className="ugc">{course.description}</p> : null}
      <Facts items={[
        { id: 'subject', label: t.body.subject, value: course.subject, ugc: true },
        { id: 'slug', label: t.body.slug, value: course.slug, ugc: true },
        { id: 'created', label: t.body.created, value: format.date(course.createdAt, copy.common.body.notAvailable) },
        { id: 'position', label: t.body.position, value: format.number(course.position) },
      ]} />
      <h3 data-copy-role="heading" className="lf-staff-subheading">{t.heading.structure}</h3>
      <Facts items={[
        { id: 'adventures', label: t.body.adventures, value: format.number(course.adventureCount) },
        { id: 'sagas', label: t.body.sagas, value: format.number(course.sagaCount) },
        { id: 'topics', label: t.body.topics, value: format.number(course.topicCount) },
        { id: 'lessons', label: t.body.lessons, value: format.number(course.lessonCount) },
      ]} />
      <h3 data-copy-role="heading" className="lf-staff-subheading">{t.heading.readiness}</h3>
      <ShareBars label={t.heading.readiness} locale={locale} total={total}
        rows={COURSE_STATUSES.map((status) => ({ id: status, label: status === 'review' ? t.option.review_status : t.option[status], count: counts[status] ?? 0 }))} />
      <CopyId value={course.id} />
    </div>
  </Sheet>
    <ConfirmDialog open={confirming !== null} heading={dialog.heading} consequence={dialog.consequence} keepLabel={t.action.keep}
      confirmLabel={dialog.label} pendingLabel={t.action.saving} pending={pending} destructive={confirming === 'archived'}
      onKeep={() => setConfirming(null)} onConfirm={() => void act(confirming!)} />
  </>;
}

function CoursesView({ api, courses, summary, onChanged }: {
  api: StaffApi; courses: readonly Course[]; summary: { courses: Record<string, number>; lessons: Record<string, number> }; onChanged: () => void;
}) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.content;
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses.filter((course) => (!q || [course.title, course.slug, course.subject, course.description].some((value) => value?.toLowerCase().includes(q)))
      && (!status || course.status === status));
  }, [courses, search, status]);
  const course = selected ? courses.find((entry) => entry.id === selected) ?? null : null;
  const columns: TableColumn<Course>[] = [
    { key: 'course', label: t.body.course, value: (entry) => entry.title, ugc: true },
    { key: 'subject', label: t.body.subject, value: (entry) => entry.subject, ugc: true },
    { key: 'status', label: t.body.status, value: (entry) => statusChip(copy, entry.status) },
    { key: 'structure', label: t.body.structure, value: (entry) => fill(t.body.structureValue, { topics: format.number(entry.topicCount), lessons: format.number(entry.lessonCount) }) },
    { key: 'live', label: t.body.liveLessons, value: (entry) => format.number(entry.lessonsByStatus.published ?? 0) },
    { key: 'details', label: copy.common.body.details, value: (entry) => <Button size="sm" onClick={() => setSelected(entry.id)}>{copy.common.action.open}</Button> },
  ];
  return <section className="lf-staff-section" aria-label={t.heading.courses} data-view="courses">
    <Metrics label={t.heading.courses} items={[
      { id: 'courses', label: t.body.courses, value: format.number(summary.courses.total ?? courses.length) },
      { id: 'coursesLive', label: t.body.coursesLive, value: format.number(summary.courses.published ?? 0) },
      { id: 'lessons', label: t.body.lessons, value: format.number(summary.lessons.total ?? 0) },
      { id: 'lessonsLive', label: t.body.lessonsLive, value: format.number(summary.lessons.published ?? 0) },
      { id: 'inReview', label: t.body.inReview, value: format.number(summary.lessons.review ?? 0) },
      { id: 'drafts', label: t.body.drafts, value: format.number(summary.lessons.draft ?? 0) },
    ]} />
    {courses.length === 0 ? <EmptyState heading={t.body.coursesEmpty} /> : <>
      <div className="lf-staff-filters">
        <TextField type="search" label={t.body.search} value={search} data-copy-role="data" onChange={(event) => setSearch(event.target.value)} />
        <SelectField label={t.body.status} value={status} onChange={(event) => setStatus(event.target.value)}
          options={[{ value: '', label: t.option.allStatuses }, ...COURSE_STATUSES.map((entry) => ({ value: entry, label: entry === 'review' ? t.option.review_status : t.option[entry] }))]} />
      </div>
      {search || status ? <div className="lf-staff-result-row">
        <Button size="sm" onClick={() => { setSearch(''); setStatus(''); }}>{copy.common.action.clearFilters}</Button>
      </div> : null}
      {rows.length === 0 ? <EmptyState heading={copy.common.body.noMatch} />
        : <DataTable caption={t.heading.courses} columns={columns} rows={rows} rowKey={(entry) => entry.id} />}
    </>}
    {course ? <CourseSheet key={course.id} api={api} course={course} onClose={() => setSelected(null)} onChanged={onChanged} /> : null}
  </section>;
}

/* ------------------------------------------------------------------------- */
/*  Lesson review                                                            */
/* ------------------------------------------------------------------------- */

type Inspect = 'preview' | 'parts' | 'media' | 'data';

function Part({ part, index, audio }: { part: Record<string, unknown>; index: number; audio: Map<string, string> }) {
  const { copy } = useConsoleCopy();
  const t = copy.content;
  const [open, setOpen] = useState(false);
  const id = useId();
  const type = typeof part.type === 'string' ? part.type : t.body.unknownType;
  const audioUnit = typeof part.audio_segment_id === 'string' ? part.audio_segment_id : null;
  const audioUrl = audioUnit ? audio.get(audioUnit) : undefined;
  return <li className="lf-staff-part" data-part={index + 1}>
    <div className="lf-staff-part-head">
      <p data-copy-role="data" className="lf-staff-part-title ugc">{`${index + 1}. ${partTitle(part, index)}`}</p>
      <p data-copy-role="data" className="lf-staff-muted">{type}</p>
      <Button size="sm" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>{open ? t.action.hidePart : t.action.showPart}</Button>
    </div>
    <div id={id} hidden={!open} className="lf-staff-part-body">
      {open ? <>
        {audioUrl ? <div className="lf-staff-audio"><p data-copy-role="body" className="lf-staff-muted">{t.body.linkedAudio}</p>
          <audio controls preload="metadata" src={audioUrl} /></div> : null}
        <pre className="lf-staff-code" data-copy-role="data">{JSON.stringify(part, null, 2)}</pre>
      </> : null}
    </div>
  </li>;
}

function LessonSheet({ api, lessonId, onClose, onDecided, renderLessonPreview }: {
  api: StaffApi; lessonId: string; onClose: () => void; onDecided: () => void; renderLessonPreview?: LessonPreviewRenderer;
}) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.content;
  const name = useId();
  const detail = useStaffRead(api, `/admin/moderation/${lessonId}`, isLessonDetail);
  const data: LessonDetail | null = detail.load.state === 'ready' ? detail.load.data : null;
  const [documentLocale, setDocumentLocale] = useState<string | null>(null);
  const [inspect, setInspect] = useState<Inspect>('preview');
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState<'published' | 'draft' | null>(null);
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [decided, setDecided] = useState(false);
  const row = data ? data.documents.find((entry) => entry.locale === documentLocale)
    ?? data.documents.find((entry) => entry.locale === locale) ?? data.documents[0] ?? null : null;
  const parts = row ? lessonParts(row.document) : [];
  const audio = row ? audioAssets(row.audio) : [];
  const images = row ? imageAssets(row.document) : [];
  const audioByUnit = new Map(audio.map((asset) => [asset.label, asset.url]));
  const decide = async (status: 'published' | 'draft') => {
    setPending(true);
    setOutcome(null);
    const result = await api.post(`/admin/moderation/${lessonId}/status`, { status });
    setPending(false);
    setConfirming(null);
    setOutcome(outcomeOf(result, status === 'published' ? t.body.approved : t.body.returned));
    if (result.ok) { setDecided(true); onDecided(); }
  };
  const close = onClose;

  if (previewing && row && data && renderLessonPreview && PREVIEW_SCHEMAS.includes(row.schemaVersion)) {
    return <>{renderLessonPreview(previewRequest(copy, api, data.id, row, () => setPreviewing(false)))}</>;
  }

  return <><Sheet open onClose={close} heading={t.heading.lesson} closeLabel={copy.common.action.close}>
    <div className="lf-staff-sheet" data-sheet="lesson">
      {detail.load.state === 'loading' ? <Loading />
        : detail.load.state === 'error' ? <LoadFailure code={detail.load.code} onRetry={detail.reload} />
          : data && !row ? <EmptyState heading={t.body.noParts} />
            : data && row ? <>
              <Facts items={[
                { id: 'lesson', label: t.body.lesson, value: data.title, ugc: true },
                { id: 'status', label: t.body.status, value: statusChip(copy, data.status) },
                { id: 'where', label: t.body.where, value: [data.courseTitle, data.adventureTitle, data.sagaTitle, data.topicTitle].filter(Boolean).join(' / '), ugc: true },
              ]} />
              {decided ? null : <div className="lf-staff-actions">
                <Button variant="success" aria-haspopup="dialog" disabled={pending} onClick={() => setConfirming('published')}>{t.action.approve}</Button>
                <Button aria-haspopup="dialog" disabled={pending} onClick={() => setConfirming('draft')}>{t.action.sendBack}</Button>
              </div>}
              <OutcomeNotice outcome={outcome} />
              <Stage3Review api={api} lessonId={data.id} />
              <Facts items={[
                { id: 'subject', label: t.body.subject, value: data.subject, ugc: true },
                { id: 'difficulty', label: t.body.difficulty, value: format.number(data.difficulty) },
                { id: 'xp', label: t.body.xp, value: format.number(data.xpTotal) },
                { id: 'duration', label: t.body.duration, value: fill(t.body.minutes, { n: format.number(data.estimatedMinutes) }) },
                { id: 'parts', label: t.body.parts, value: format.number(parts.length) },
                { id: 'languages', label: t.body.languages, value: data.locales.join(', ') || copy.common.body.notAvailable },
                { id: 'schema', label: t.body.schema, value: format.number(row.schemaVersion) },
                { id: 'created', label: t.body.created, value: format.date(data.createdAt, copy.common.body.notAvailable) },
                { id: 'slug', label: t.body.slug, value: data.slug, ugc: true },
              ]} />
              {data.documents.length > 1 ? <SegmentedControl legend={t.body.language} name={`${name}-locale`} value={row.locale}
                onValueChange={setDocumentLocale} options={data.documents.map((entry) => ({ value: entry.locale, label: entry.locale }))} /> : null}
              <SegmentedControl legend={t.body.inspect} name={`${name}-inspect`} value={inspect} onValueChange={setInspect}
                options={(['preview', 'parts', 'media', 'data'] as const).map((value) => ({ value, label: t.option[value] }))} />
              {inspect === 'preview' ? <PreviewPanel row={row} available={!!renderLessonPreview} onOpen={() => setPreviewing(true)} /> : null}
              {inspect === 'parts' ? <div className="lf-staff-stack" data-inspect="parts">
                <h3 data-copy-role="heading" className="lf-staff-subheading">{t.heading.parts}</h3>
                {parts.length === 0 ? <p data-copy-role="body">{t.body.noParts}</p>
                  : <ol className="lf-staff-parts">{parts.map((part, index) => <Part key={`${row.locale}:${String(part.id ?? index)}`} part={part} index={index} audio={audioByUnit} />)}</ol>}
              </div> : null}
              {inspect === 'media' ? <div className="lf-staff-stack" data-inspect="media">
                <h3 data-copy-role="heading" className="lf-staff-subheading">{t.heading.audio}</h3>
                {audio.length === 0 ? <p data-copy-role="body">{t.body.noAudio}</p>
                  : <ul className="lf-staff-media">{audio.map((asset) => <li key={asset.id} className="lf-staff-audio">
                    <p data-copy-role="data" className="ugc">{asset.durationMs ? `${asset.label} · ${Math.round(asset.durationMs / 1000)} s` : asset.label}</p>
                    <audio controls preload="metadata" src={asset.url} />
                  </li>)}</ul>}
                <h3 data-copy-role="heading" className="lf-staff-subheading">{t.heading.images}</h3>
                {images.length === 0 ? <p data-copy-role="body">{t.body.noImages}</p>
                  : <ul className="lf-staff-images">{images.map((asset) => <li key={asset.id}>
                    <figure className="lf-staff-image">
                      <img src={asset.url} alt={asset.label} loading="lazy" />
                      <figcaption data-copy-role="data" className="ugc">{asset.label}</figcaption>
                    </figure>
                    <a className="lf-staff-inline-link" href={asset.url} target="_blank" rel="noreferrer" data-copy-role="action">{t.action.fullSize}</a>
                  </li>)}</ul>}
              </div> : null}
              {inspect === 'data' ? <div className="lf-staff-stack" data-inspect="data">
                <h3 data-copy-role="heading" className="lf-staff-subheading">{t.heading.document}</h3>
                <p data-copy-role="body">{t.body.documentNote}</p>
                <pre className="lf-staff-code" data-copy-role="data">{JSON.stringify(row.document, null, 2)}</pre>
              </div> : null}
              <CopyId value={data.id} />
            </> : null}
    </div>
  </Sheet>
    <ConfirmDialog open={confirming !== null} heading={confirming === 'published' ? t.heading.confirmApprove : t.heading.confirmReturn}
      consequence={confirming === 'published' ? t.body.consequencePublish : t.body.consequenceReturn} keepLabel={t.action.keep}
      confirmLabel={confirming === 'published' ? t.action.approve : t.action.sendBack} pendingLabel={t.action.saving} pending={pending}
      onKeep={() => setConfirming(null)} onConfirm={() => void decide(confirming!)} />
  </>;
}

function ReviewView({ api, onChanged, renderLessonPreview }: { api: StaffApi; onChanged: () => void; renderLessonPreview?: LessonPreviewRenderer }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.content;
  const queue = useStaffRead(api, '/admin/moderation', isReviewQueue);
  const [selected, setSelected] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const heading = useRef<HTMLElement>(null);
  const armRescue = useFocusRescue(heading, queue.load);
  const lessons = queue.load.state === 'ready' ? queue.load.data.lessons : [];
  const columns: TableColumn<ReviewLesson>[] = [
    { key: 'lesson', label: t.body.lesson, value: (entry) => entry.title, ugc: true },
    { key: 'where', label: t.body.where, value: (entry) => `${entry.courseTitle} / ${entry.topicTitle}`, ugc: true },
    { key: 'languages', label: t.body.languages, value: (entry) => format.number(entry.locales.length) },
    { key: 'created', label: t.body.created, value: (entry) => format.date(entry.createdAt, copy.common.body.notAvailable) },
    { key: 'details', label: copy.common.body.details, value: (entry) => <Button size="sm" onClick={() => setSelected(entry.id)}>{copy.common.action.open}</Button> },
  ];
  const close = () => {
    setSelected(null);
    if (dirty) { setDirty(false); armRescue(); queue.reload(); onChanged(); }
  };
  return <section className="lf-staff-section" aria-label={t.heading.review} ref={heading} tabIndex={-1} data-view="review">
    <p data-copy-role="body" className="lf-staff-muted">{t.body.reviewIntro}</p>
    {queue.load.state === 'loading' ? <Loading />
      : queue.load.state === 'error' ? <LoadFailure code={queue.load.code} onRetry={queue.reload} />
        : lessons.length === 0 ? <EmptyState heading={t.body.reviewEmpty} />
          : <DataTable caption={t.heading.review} columns={columns} rows={lessons} rowKey={(entry) => entry.id} />}
    {selected ? <LessonSheet key={selected} api={api} lessonId={selected} onClose={close} onDecided={() => setDirty(true)} renderLessonPreview={renderLessonPreview} /> : null}
  </section>;
}

/* ------------------------------------------------------------------------- */
/*  Live updates (G.2, Appendix N 1.2)                                       */
/* ------------------------------------------------------------------------- */

function VersionSheet({ api, version, onClose, onDecided, renderLessonPreview }: {
  api: StaffApi; version: PendingVersion; onClose: () => void; onDecided: () => void; renderLessonPreview?: LessonPreviewRenderer;
}) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.content;
  // GAP-FIX-R6: the version is played before it is released or rejected (G.2, Appendix C Part 3 Stage 3).
  const read = useStaffRead(api, versionDocumentPath(version.lessonId, version.documentVersionId), isVersionDocument);
  const versionDocument = read.load.state === 'ready' ? read.load.data : null;
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [decided, setDecided] = useState(false);
  const path = `/admin/content/lessons/${version.lessonId}/versions/${version.documentVersionId}`;
  const settle = (result: { ok: true } | { ok: false; code: string }, message: string) => {
    if (result.ok) { setOutcome({ kind: 'done', message }); setDecided(true); onDecided(); return; }
    const key = versionRefusal(result.code);
    setOutcome(key ? { kind: 'refused', key, code: result.code } : { kind: 'failed' });
  };
  const release = async () => {
    setPending(true); setOutcome(null);
    const result = await api.post(`${path}/release`, {});
    setPending(false); setConfirming(false);
    settle(result, t.body.versionReleased);
  };
  const reject = async () => {
    setPending(true); setOutcome(null);
    const result = await api.post(`${path}/reject`, { reason: reason.trim() });
    setPending(false);
    settle(result, t.body.versionRejected);
  };
  const reasonOk = reason.trim().length >= 10 && reason.trim().length <= 600;
  if (previewing && versionDocument && renderLessonPreview && PREVIEW_SCHEMAS.includes(versionDocument.schemaVersion)) {
    return <>{renderLessonPreview(previewRequest(copy, api, version.lessonId, versionDocument, () => setPreviewing(false)))}</>;
  }
  return <><Sheet open onClose={onClose} heading={t.heading.version} closeLabel={copy.common.action.close}>
    <div className="lf-staff-sheet" data-sheet="version">
      <Facts items={[
        { id: 'lesson', label: t.body.lesson, value: versionTitle(version, locale), ugc: true },
        { id: 'language', label: t.body.language, value: version.locale },
        { id: 'version', label: t.body.version, value: version.versionId, ugc: true },
        { id: 'submitted', label: t.body.submitted, value: format.dateTime(version.submittedAt, copy.common.body.notAvailable) },
      ]} />
      <InlineNotice tone="info">{t.body.releaseCheckNote}</InlineNotice>
      <section className="lf-staff-stack" aria-label={t.heading.preview} data-section="version-preview">
        {read.load.state === 'loading' ? <Loading />
          : read.load.state === 'error' ? <LoadFailure code={read.load.code} onRetry={read.reload} />
            : versionDocument ? <PreviewPanel row={versionDocument} available={!!renderLessonPreview} onOpen={() => setPreviewing(true)} /> : null}
      </section>
      {decided ? null : <div className="lf-staff-actions">
        <Button variant="success" aria-haspopup="dialog" disabled={pending} onClick={() => setConfirming(true)}>{t.action.release}</Button>
        <Button aria-expanded={rejecting} disabled={pending} onClick={() => setRejecting(!rejecting)}>{t.action.reject}</Button>
      </div>}
      {rejecting && !decided ? <form className="lf-staff-stack" data-form="reject-version" onSubmit={(event) => { event.preventDefault(); if (reasonOk) void reject(); }}>
        <TextAreaField label={t.body.reason} help={t.body.reasonHelp} value={reason} maxLength={600} onChange={(event) => setReason(event.target.value)} />
        <div><Button type="submit" disabled={pending || !reasonOk}>{t.action.rejectVersion}</Button></div>
      </form> : null}
      <OutcomeNotice outcome={outcome} />
      <Stage3Review api={api} lessonId={version.lessonId} versionId={version.documentVersionId} />
      <Facts items={[
        { id: 'run', label: t.body.run, value: version.runId ?? copy.common.body.notAvailable, ugc: true },
        { id: 'digest', label: t.body.digest, value: version.documentSha256.slice(0, 16), ugc: true },
      ]} />
      <CopyId value={version.documentVersionId} />
    </div>
  </Sheet>
    <ConfirmDialog open={confirming} heading={t.heading.confirmRelease} consequence={t.body.consequenceRelease} keepLabel={t.action.keep}
      confirmLabel={t.action.release} pendingLabel={t.action.saving} pending={pending}
      onKeep={() => setConfirming(false)} onConfirm={() => void release()} />
  </>;
}

const RETRO_TONE: Record<RetroState, { tone: StatusTone; glyph: 'warning' | 'info' | 'check' }> = {
  overdue: { tone: 'error', glyph: 'warning' },
  open: { tone: 'warning', glyph: 'info' },
  closed_late: { tone: 'warning', glyph: 'check' },
  closed: { tone: 'success', glyph: 'check' },
};

function RetroChecks({ api }: { api: StaffApi }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.content;
  const report = useStaffRead(api, '/admin/content/bypass-checks', isBypassReport);
  const rate = (value: number | null) => (value === null ? t.body.notMeasured : format.percent(value));
  const actionLabel = (action: string) => (action === 'content.live_document_patched' ? t.option.directFix
    : action === 'content.v2_emergency_activation' ? t.option.emergencyRelease : action === 'forge.v2_lesson_published' ? t.option.earlyPublication : action);
  const columns: TableColumn<RetroCheck>[] = [
    { key: 'change', label: t.body.change, value: (entry) => actionLabel(entry.action) },
    { key: 'when', label: t.body.when, value: (entry) => format.date(entry.occurredAt, copy.common.body.notAvailable) },
    { key: 'due', label: t.body.due, value: (entry) => format.date(entry.dueAt, copy.common.body.notAvailable) },
    { key: 'check', label: t.body.check, value: (entry) => <Chip tone={RETRO_TONE[entry.state].tone} glyph={RETRO_TONE[entry.state].glyph}>{t.option[entry.state]}</Chip> },
    { key: 'reason', label: t.body.reasonLogged, value: (entry) => (entry.justified ? t.body.yes : t.body.no) },
  ];
  const data = report.load.state === 'ready' ? report.load.data : null;
  return <section className="lf-staff-section" aria-labelledby="staff-retro-checks" data-section="retro-checks">
    <h2 id="staff-retro-checks" data-copy-role="heading" className="lf-staff-subheading">{t.heading.checks}</h2>
    {report.load.state === 'loading' ? <Loading />
      : report.load.state === 'error' ? <LoadFailure code={report.load.code} onRetry={report.reload} />
        : data ? <>
          <p data-copy-role="body" className="lf-staff-muted">{fill(t.body.checksIntro, { days: format.number(data.retroCheckDays) })}</p>
          {data.counts.overdue > 0 ? <InlineNotice tone="error">{fill(t.body.overdueNotice, { n: format.number(data.counts.overdue) })}</InlineNotice> : null}
          <Metrics label={t.heading.checks} items={[
            { id: 'bypassRate', label: t.body.bypassRate, value: rate(data.bypassRate) },
            { id: 'completeness', label: t.body.completeness, value: rate(data.completenessRate) },
            { id: 'overdue', label: t.body.overdue, value: format.number(data.counts.overdue) },
            { id: 'pending', label: t.body.pendingChecks, value: format.number(data.counts.pending) },
          ]} />
          {data.checks.length === 0 ? <EmptyState heading={t.body.checksEmpty} />
            : <DataTable caption={t.heading.checks} columns={columns} rows={data.checks} rowKey={(entry) => String(entry.id)} />}
        </> : null}
  </section>;
}

function UpdatesView({ api, renderLessonPreview }: { api: StaffApi; renderLessonPreview?: LessonPreviewRenderer }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.content;
  const queue = useStaffRead(api, '/admin/content/lesson-versions', isPendingVersions);
  const [selected, setSelected] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const heading = useRef<HTMLElement>(null);
  const armRescue = useFocusRescue(heading, queue.load);
  const versions = queue.load.state === 'ready' ? queue.load.data.versions : [];
  const version = selected ? versions.find((entry) => entry.requestId === selected) ?? null : null;
  const columns: TableColumn<PendingVersion>[] = [
    { key: 'lesson', label: t.body.lesson, value: (entry) => versionTitle(entry, locale), ugc: true },
    { key: 'language', label: t.body.language, value: (entry) => entry.locale },
    { key: 'version', label: t.body.version, value: (entry) => entry.versionId, ugc: true },
    { key: 'submitted', label: t.body.submitted, value: (entry) => format.date(entry.submittedAt, copy.common.body.notAvailable) },
    { key: 'details', label: copy.common.body.details, value: (entry) => <Button size="sm" onClick={() => setSelected(entry.requestId)}>{copy.common.action.open}</Button> },
  ];
  const close = () => {
    setSelected(null);
    if (dirty) { setDirty(false); armRescue(); queue.reload(); }
  };
  return <div className="lf-staff-section" data-view="updates">
    <section className="lf-staff-section" aria-label={t.heading.updates} ref={heading} tabIndex={-1}>
      <p data-copy-role="body" className="lf-staff-muted">{t.body.updatesIntro}</p>
      {queue.load.state === 'loading' ? <Loading />
        : queue.load.state === 'error' ? <LoadFailure code={queue.load.code} onRetry={queue.reload} />
          : versions.length === 0 ? <EmptyState heading={t.body.updatesEmpty} />
            : <DataTable caption={t.heading.updates} columns={columns} rows={versions} rowKey={(entry) => entry.requestId} />}
    </section>
    <RetroChecks api={api} />
    {version ? <VersionSheet key={version.requestId} api={api} version={version} onClose={close} onDecided={() => setDirty(true)} renderLessonPreview={renderLessonPreview} /> : null}
  </div>;
}

/* ------------------------------------------------------------------------- */
/*  Mentor activities (C.5, C.6, G.3)                                        */
/* ------------------------------------------------------------------------- */

type Verdict = 'recorded' | 'already' | 'failed';

function ActivitySheet({ api, segment, onClose, onDecided }: { api: StaffApi; segment: LiveSegment; onClose: () => void; onDecided: () => void }) {
  const { copy, locale, live } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.content;
  const [state, setState] = useState<'open' | 'saving' | Verdict>('open');
  const category = riskCategory(segment);
  const prompt = typeof segment.payload.prompt_md === 'string' ? segment.payload.prompt_md : null;
  const decide = async (decision: ReviewDecision) => {
    setState('saving');
    const result = await api.post(`/admin/tutor/review-queue/${segment.id}/status`, reviewBody(decision));
    const verdict: Verdict = result.ok ? 'recorded' : result.code === 'ALREADY_DECIDED' ? 'already' : 'failed';
    setState(verdict);
    if (verdict !== 'failed') onDecided();
  };
  const done = state === 'recorded' || state === 'already';
  return <Sheet open onClose={onClose} heading={t.heading.activity} closeLabel={copy.common.action.close}>
    <div className="lf-staff-sheet" data-sheet="activity">
      <Facts items={[
        { id: 'activity', label: t.body.activity, value: segment.segment_type, ugc: true },
        { id: 'category', label: t.body.topicType, value: category ? live.category[category] : t.body.notRecorded },
        { id: 'served', label: t.body.served, value: format.dateTime(segment.created_at, copy.common.body.notAvailable) },
        { id: 'score', label: t.body.score, value: segment.score === null ? t.body.unanswered : format.number(segment.score) },
      ]} />
      {prompt ? <>
        <h3 data-copy-role="heading" className="lf-staff-subheading">{t.body.prompt}</h3>
        <blockquote className="lf-staff-quote ugc" data-copy-role="data">{prompt}</blockquote>
      </> : null}
      {done ? <InlineNotice tone={state === 'recorded' ? 'success' : 'info'} live>{state === 'recorded' ? live.decided : live.alreadyDecided}</InlineNotice> : <>
        {/* Three equal verdicts (C.5): the reviewer is never nudged toward approving. */}
        <div className="lf-staff-decisions" role="group" aria-label={live.reviewLabel}>
          {(['approve', 'quality', 'safety'] as const).map((decision) => <Button key={decision} data-decision={decision} disabled={state === 'saving'}
            onClick={() => void decide(decision)}>{live[decision]}</Button>)}
        </div>
        <p data-copy-role="body" className="lf-staff-muted">{t.body.auditNote}</p>
        {state === 'failed' ? <InlineNotice tone="error" live>{live.decideFailed}</InlineNotice> : null}
      </>}
      <h3 data-copy-role="heading" className="lf-staff-subheading">{t.heading.raw}</h3>
      <pre className="lf-staff-code" data-copy-role="data">{JSON.stringify({ payload: segment.payload, provenance: segment.provenance }, null, 2)}</pre>
      <CopyId value={segment.id} />
    </div>
  </Sheet>;
}

function LiveView({ api }: { api: StaffApi }) {
  const { copy, locale, live } = useConsoleCopy();
  const { theme } = useRebuildEnvironment();
  const format = useFormats(locale);
  const t = copy.content;
  const status = useStaffRead(api, '/admin/tutor/live-content/status', isLiveStatus);
  const queue = useStaffRead(api, '/admin/tutor/review-queue', isLiveQueue);
  const packs = useStaffRead(api, '/admin/tutor/packs?status=review', isPacks);
  const [selected, setSelected] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const heading = useRef<HTMLElement>(null);
  const armRescue = useFocusRescue(heading, queue.load);
  const segments = queue.load.state === 'ready' ? queue.load.data.segments : [];
  const segment = selected ? segments.find((entry) => entry.id === selected) ?? null : null;
  const columns: TableColumn<LiveSegment>[] = [
    { key: 'activity', label: t.body.activity, value: (entry) => entry.segment_type, ugc: true },
    { key: 'category', label: t.body.topicType, value: (entry) => { const category = riskCategory(entry); return category ? live.category[category] : t.body.notRecorded; } },
    { key: 'served', label: t.body.served, value: (entry) => format.dateTime(entry.created_at, copy.common.body.notAvailable) },
    { key: 'score', label: t.body.score, value: (entry) => (entry.score === null ? t.body.unanswered : format.number(entry.score)) },
    { key: 'details', label: copy.common.body.details, value: (entry) => <Button size="sm" onClick={() => setSelected(entry.id)}>{copy.common.action.open}</Button> },
  ];
  const close = () => {
    setSelected(null);
    // A verdict can raise a category's rate or suspend it (C.5): both reads follow it.
    if (dirty) { setDirty(false); armRescue(); queue.reload(); status.reload(); }
  };
  const onPackStatus = async (packId: string, next: PackStatus): Promise<PackResult> => {
    const result = await api.post(`/admin/tutor/packs/${packId}/status`, { status: next });
    if (result.ok) return { ok: true };
    return { ok: false, ...(result.failures && result.failures.length ? { failures: result.failures } : {}) };
  };
  const dark = theme === 'dark';
  return <div className="lf-staff-section" data-view="live">
    {/* The queue first: it is what a reviewer acts on, and the category status follows it. */}
    <section className="lf-staff-section" aria-label={t.heading.queue} ref={heading} tabIndex={-1}>
      <p data-copy-role="body" className="lf-staff-muted">{t.body.queueIntro}</p>
      {queue.load.state === 'loading' ? <Loading />
        : queue.load.state === 'error' ? <LoadFailure code={queue.load.code} onRetry={queue.reload} />
          : segments.length === 0 ? <EmptyState heading={t.body.queueEmpty} />
            : <DataTable caption={t.heading.queue} columns={columns} rows={segments} rowKey={(entry) => entry.id} />}
    </section>
    <div className="lf-staff-pair">
      <div className="lf-staff-stack">
        <LiveContentStatusPanel copy={live} locale={locale} dark={dark}
          phase={status.load.state === 'ready' ? 'ready' : status.load.state === 'error' ? 'failed' : 'loading'}
          status={status.load.state === 'ready' ? status.load.data : null} />
        {status.load.state === 'error' ? <div className="lf-staff-result-row">
          <Button size="sm" onClick={status.reload}>{copy.common.action.retry}</Button>
        </div> : null}
      </div>
      {packs.load.state === 'loading' ? <Loading />
        : packs.load.state === 'error' ? <Card heading={t.heading.packs}>
          <LoadFailure code={packs.load.code} onRetry={packs.reload} />
        </Card>
          : packs.load.state === 'ready' ? <PackRelease copy={live} locale={locale} dark={dark} packs={packs.load.data.packs} onStatus={onPackStatus} /> : null}
    </div>
    {segment ? <ActivitySheet key={segment.id} api={api} segment={segment} onClose={close} onDecided={() => setDirty(true)} /> : null}
  </div>;
}

/* ------------------------------------------------------------------------- */
/*  Learning quality (S05.3d)                                                */
/* ------------------------------------------------------------------------- */

const isAnyRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function QualityView({ api }: { api: StaffApi }) {
  const { locale } = useConsoleCopy();
  const { theme } = useRebuildEnvironment();
  // The panel validates the report itself (learningQualityReportSchema); an invalid one is its error state.
  const report = useStaffRead(api, '/admin/content/learning-quality', isAnyRecord);
  const resolve = async (reviewId: string, body: ReviewDecisionBody): Promise<DecisionOutcome> => {
    const result = await api.post(`/admin/content/learning-quality/reviews/${reviewId}/resolve`, body);
    return result.ok ? 'resolved' : result.code === 'REVIEW_RESOLVED' ? 'conflict' : 'error';
  };
  return <LearningQualityPanel locale={locale} dark={theme === 'dark'}
    state={report.load.state === 'ready' ? { status: 'ready', report: report.load.data } : report.load.state === 'error' ? { status: 'error' } : { status: 'loading' }}
    onRetry={report.reload}
    onSync={async () => (await api.post('/admin/content/learning-quality/reviews/sync', {})).ok}
    onResolve={resolve}
    onRecordEscape={async (body) => (await api.post('/admin/content/learning-quality/defect-escapes', body)).ok} />;
}

/* ------------------------------------------------------------------------- */
/*  The page                                                                 */
/* ------------------------------------------------------------------------- */

export function StaffContent({ api, initialView = 'courses', renderLessonPreview }: {
  api: StaffApi; initialView?: ContentView; renderLessonPreview?: LessonPreviewRenderer;
}) {
  const { copy, sections, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.content;
  const name = useId();
  const [view, setView] = useState<ContentView>(initialView);
  const content = useStaffRead(api, '/admin/content', isContentData);
  const data = content.load.state === 'ready' ? content.load.data : null;
  const incidents = data?.courseAssemblyIncidents ?? [];
  const summary = data?.summary;
  // Course load failures belong to the Courses view: every other view keeps its first screen for its own task.
  const incidentsSection = incidents.length ? <section className="lf-staff-incidents" aria-labelledby="staff-incidents" data-incidents={incidents.length}>
    <h2 id="staff-incidents" data-copy-role="heading">{t.heading.incidents}</h2>
    <InlineNotice tone="error">{t.body.incidents}</InlineNotice>
    <List label={t.heading.incidents}>
      {incidents.map((incident) => <ListRow key={incident.courseId} title={incident.courseTitle} titleRole="data"
        supporting={fill(t.body.incident, { n: format.number(incident.occurrenceCount), date: format.date(incident.lastSeenAt, copy.common.body.notAvailable) })} />)}
    </List>
  </section> : null;
  return <StaffPage screen="staff-content" title={sections.content}
    actions={<Button size="sm" onClick={content.reload}>{copy.common.action.refresh}</Button>}>
    {content.load.state === 'loading' ? <Loading />
      : content.load.state === 'error' ? <LoadFailure code={content.load.code} onRetry={content.reload} /> : null}
    <SegmentedControl legend={t.body.view} name={`${name}-view`} value={view} onValueChange={setView} className="lf-staff-views"
      options={CONTENT_VIEWS.map((value) => ({ value, label: t.option[value] }))} />
    {view === 'courses' ? (data && summary ? <>{incidentsSection}<CoursesView api={api} courses={data.courses} summary={summary} onChanged={content.reload} /></> : null)
      : view === 'review' ? <ReviewView api={api} onChanged={content.reload} renderLessonPreview={renderLessonPreview} />
        : view === 'updates' ? <UpdatesView api={api} renderLessonPreview={renderLessonPreview} />
        : view === 'live' ? <LiveView api={api} />
          : <QualityView api={api} />}
  </StaffPage>;
}

