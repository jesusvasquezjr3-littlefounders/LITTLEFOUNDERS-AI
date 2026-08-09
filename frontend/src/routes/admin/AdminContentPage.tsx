import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, Icon, StatCard, Table, type TableColumn } from '@/components/ui';
import LessonPlayer from '@/lesson-engine/player/LessonPlayer';
import type { Grader, LessonDocument } from '@/lesson-engine/core/types';
import type { AudioManifest } from '@/lesson-engine/player/narration';
import { cn } from '@/lib/utils';
import {
  AdminAction,
  AdminDialog,
  AdminEmpty,
  AdminPage,
  StatusBadge,
  Unavailable,
  useAdminData,
  useAdminMutation,
} from './adminShared';

interface Course {
  id: string;
  slug: string;
  title: string;
  description: string;
  subject: string;
  status: string;
  position: number;
  createdAt: string;
  adventureCount: number;
  sagaCount: number;
  topicCount: number;
  lessonCount: number;
  lessonsByStatus: Record<string, number>;
}

interface ContentSummary {
  courses: { total: number; published: number; draft: number; archived: number };
  lessons: { total: number; published: number; review: number; draft: number; archived: number };
}

interface ReviewLesson {
  id: string;
  slug: string;
  title: string;
  status: string;
  courseTitle: string;
  subject: string;
  adventureTitle: string;
  sagaTitle: string;
  topicTitle: string;
  difficulty: number;
  xpTotal: number;
  estimatedMinutes: number;
  createdAt: string;
  locales: string[];
}

interface LessonDetail extends ReviewLesson {
  documents: { locale: string; schemaVersion: number; document: Record<string, unknown>; audio: Record<string, unknown> }[];
}

const TABS = [
  { key: 'courses', icon: 'menu_book' },
  { key: 'lessons', icon: 'shield' },
] as const;
type Tab = (typeof TABS)[number]['key'];

const STATUS_FILTERS = ['published', 'draft', 'review', 'archived'] as const;

const PREVIEW_GRADER: Grader = {
  grade: async () => {
    throw new Error('Preview mode does not grade');
  },
};

function formatDate(value: string, locale: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}

function Metric({ label, value, tone = 'text-content' }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-md bg-surface-sunken/60 p-3">
      <p className="lf-caption text-content-muted">{label}</p>
      <p className={cn('lf-number lf-title mt-1 font-bold', tone)}>{value}</p>
    </div>
  );
}

function CourseDetailDialog({
  course,
  locale,
  busy,
  onClose,
  onStatus,
}: {
  course: Course;
  locale: string;
  busy: boolean;
  onClose: () => void;
  onStatus: (status: string) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const nf = new Intl.NumberFormat(locale);
  const lessons = course.lessonsByStatus;
  return (
    <AdminDialog title={t('admin.content.courseDetailTitle')} onClose={onClose}>
      <div className="flex flex-col gap-6 pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="lf-display-sm text-content">{course.title}</h3>
              <StatusBadge status={course.status} />
            </div>
            <p className="lf-body-sm mt-2 max-w-2xl text-content-muted">{course.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge className="bg-primary-soft text-primary">{course.subject}</Badge>
              <span className="lf-number lf-caption rounded-full bg-surface-sunken px-3 py-1 text-content-muted">{course.slug}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {course.status !== 'published' && (
              <AdminAction tone="success" icon="publish" onClick={() => void onStatus('published')} disabled={busy}>
                {t('admin.content.publish')}
              </AdminAction>
            )}
            {course.status === 'published' && (
              <AdminAction tone="neutral" icon="unpublished" onClick={() => void onStatus('draft')} disabled={busy}>
                {t('admin.content.unpublish')}
              </AdminAction>
            )}
            {course.status !== 'archived' && (
              <AdminAction tone="neutral" icon="archive" onClick={() => void onStatus('archived')} disabled={busy}>
                {t('admin.content.archive')}
              </AdminAction>
            )}
          </div>
        </div>

        <section>
          <h4 className="lf-label font-bold text-content">{t('admin.content.hierarchySummary')}</h4>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
            <Metric label={t('admin.content.adventures')} value={nf.format(course.adventureCount)} />
            <Metric label={t('admin.content.sagas')} value={nf.format(course.sagaCount)} />
            <Metric label={t('admin.content.topics')} value={nf.format(course.topicCount)} />
            <Metric label={t('admin.content.lessons')} value={nf.format(course.lessonCount)} />
            <Metric label={t('admin.content.position')} value={nf.format(course.position)} />
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between gap-3">
            <h4 className="lf-label font-bold text-content">{t('admin.content.lessonBreakdown')}</h4>
            <span className="lf-caption text-content-muted">{t('admin.content.created', { date: formatDate(course.createdAt, locale) })}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label={t('admin.status.published')} value={nf.format(lessons.published ?? 0)} tone="text-success-strong" />
            <Metric label={t('admin.status.review')} value={nf.format(lessons.review ?? 0)} tone="text-warning-strong" />
            <Metric label={t('admin.status.draft')} value={nf.format(lessons.draft ?? 0)} />
            <Metric label={t('admin.status.archived')} value={nf.format(lessons.archived ?? 0)} tone="text-content-muted" />
          </div>
        </section>

        <div className="flex items-start gap-3 rounded-md bg-primary-soft/70 p-4 text-primary">
          <Icon name="verified" className="mt-0.5 shrink-0" />
          <p className="lf-caption">{t('admin.content.publishGateNote')}</p>
        </div>
      </div>
    </AdminDialog>
  );
}

function LessonReviewDialog({
  lessonId,
  locale,
  busy,
  onClose,
  onStatus,
  onLocaleChange,
}: {
  lessonId: string;
  locale: string;
  busy: boolean;
  onClose: () => void;
  onStatus: (status: 'published' | 'draft') => Promise<boolean>;
  onLocaleChange: (locale: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const detailData = useAdminData<LessonDetail>(`/admin/moderation/${lessonId}`);
  const [playing, setPlaying] = useState(false);
  const detail = detailData.data.state === 'ready' ? detailData.data.data : null;
  const documentRow = detail?.documents.find((row) => row.locale === locale) ?? detail?.documents[0];
  const segmentCount = Array.isArray(documentRow?.document.segments) ? documentRow.document.segments.length : 0;
  const nf = new Intl.NumberFormat(i18n.resolvedLanguage);

  if (detailData.data.state === 'loading') {
    return <AdminDialog title={t('admin.moderation.previewTitle')} onClose={onClose}><div className="py-16 text-center lf-body-sm text-content-muted">{t('admin.loading')}</div></AdminDialog>;
  }
  if (detailData.data.state === 'error' || !detail || !documentRow) {
    return <AdminDialog title={t('admin.moderation.previewTitle')} onClose={onClose}><Unavailable code={detailData.data.state === 'error' ? detailData.data.code : 'DATA_UNAVAILABLE'} /></AdminDialog>;
  }

  async function decide(status: 'published' | 'draft') {
    if (await onStatus(status)) onClose();
  }

  const player = (
    <LessonPlayer
      document={documentRow.document as unknown as LessonDocument}
      lessonId={detail.id}
      audio={documentRow.audio as unknown as AudioManifest}
      grader={PREVIEW_GRADER}
      preview
      previewStartLabel={t('admin.moderation.previewStart')}
      previewNextLabel={t('admin.moderation.previewNext')}
      onExit={() => setPlaying(false)}
    />
  );

  if (playing) return player;

  return (
    <AdminDialog title={t('admin.moderation.previewTitle')} onClose={onClose}>
      <div className="flex flex-col gap-6 pt-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="lf-display-sm text-content">{detail.title}</h3>
            <StatusBadge status={detail.status} />
          </div>
          <p className="lf-number lf-caption mt-1 text-content-muted">{detail.slug}</p>
          <p className="lf-body-sm mt-3 text-content-muted">{detail.courseTitle} / {detail.adventureTitle} / {detail.sagaTitle} / {detail.topicTitle}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Metric label={t('admin.content.subject')} value={detail.subject} />
          <Metric label={t('admin.content.difficulty')} value={detail.difficulty} />
          <Metric label={t('admin.content.xp')} value={nf.format(detail.xpTotal)} />
          <Metric label={t('admin.content.duration')} value={t('admin.content.minutes', { count: detail.estimatedMinutes })} />
          <Metric label={t('admin.content.segments')} value={nf.format(segmentCount)} />
        </div>

        <div className="flex flex-col gap-3 rounded-lg bg-surface-sunken/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="lf-label font-bold text-content">{t('admin.moderation.renderTitle')}</h4>
              <p className="lf-caption mt-1 text-content-muted">{t('admin.moderation.renderDescription')}</p>
            </div>
            <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('admin.moderation.localeTabs')}>
              {detail.documents.map((row) => (
                <button
                  key={row.locale}
                  type="button"
                  role="tab"
                  aria-selected={row.locale === documentRow.locale}
                  onClick={() => onLocaleChange(row.locale)}
                  className={cn('min-h-11 rounded-full px-3 py-2 lf-caption font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', row.locale === documentRow.locale ? 'bg-primary text-on-primary' : 'bg-surface text-content-muted hover:text-content')}
                >
                  {row.locale}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline/40 pt-3">
            <span className="lf-caption text-content-muted">{t('admin.moderation.schemaVersion', { version: documentRow.schemaVersion })}</span>
            <Button variant="primary" onClick={() => setPlaying(true)}>
              <Icon name="play_circle" />
              {t('admin.moderation.renderLesson')}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline/50 pt-5">
          <p className="lf-caption text-content-muted">{t('admin.moderation.reviewMeta', { date: formatDate(detail.createdAt, i18n.resolvedLanguage ?? 'en-US'), locales: detail.locales.join(', ') || t('admin.moderation.noLocales') })}</p>
          <div className="flex flex-wrap gap-2">
            <AdminAction tone="danger" icon="undo" onClick={() => void decide('draft')} disabled={busy}>{t('admin.moderation.reject')}</AdminAction>
            <AdminAction tone="success" icon="check" onClick={() => void decide('published')} disabled={busy}>{t('admin.moderation.approve')}</AdminAction>
          </div>
        </div>
      </div>
    </AdminDialog>
  );
}

export function AdminContentPage() {
  const { t, i18n } = useTranslation();
  const contentData = useAdminData<{ courses: Course[]; summary: ContentSummary }>('/admin/content');
  const moderationData = useAdminData<{ lessons: ReviewLesson[]; total: number }>('/admin/moderation');
  const mutate = useAdminMutation();
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('courses');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [courseDetail, setCourseDetail] = useState<Course | null>(null);
  const [lessonDetailId, setLessonDetailId] = useState<string | null>(null);
  const [lessonLocale, setLessonLocale] = useState('es-MX');

  const content = contentData.data.state === 'ready' ? contentData.data.data : null;
  const courses = content?.courses ?? [];
  const summary = content?.summary;
  const reviewLessons = moderationData.data.state === 'ready' ? moderationData.data.data.lessons : [];
  const reviewTotal = moderationData.data.state === 'ready' ? moderationData.data.data.total : null;
  const nf = new Intl.NumberFormat(i18n.resolvedLanguage);

  const filteredCourses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses.filter((course) => {
      const matchesSearch = !q || [course.title, course.slug, course.subject, course.description].some((value) => value.toLowerCase().includes(q));
      return matchesSearch && (statusFilter === 'all' || course.status === statusFilter);
    });
  }, [courses, search, statusFilter]);

  async function setCourseStatus(id: string, status: string): Promise<boolean> {
    setBusy(id);
    setActionError(null);
    const res = await mutate(`/admin/content/${id}/status`, { status });
    if (res.error) {
      setActionError(t(`errors.api.${res.error.code}`, { defaultValue: t('admin.content.actionFailed') }));
      setBusy(null);
      return false;
    }
    await contentData.reload();
    setBusy(null);
    return true;
  }

  async function decideLesson(id: string, status: 'published' | 'draft'): Promise<boolean> {
    setBusy(id);
    setActionError(null);
    const res = await mutate(`/admin/moderation/${id}/status`, { status });
    if (res.error) {
      setActionError(t(`errors.api.${res.error.code}`, { defaultValue: t('admin.content.actionFailed') }));
      setBusy(null);
      return false;
    }
    await moderationData.reload();
    await contentData.reload();
    setBusy(null);
    return true;
  }

  const courseColumns: TableColumn<Course>[] = [
    {
      key: 'title',
      header: t('admin.content.colTitle'),
      primary: true,
      cell: (course) => (
        <div className="min-w-0">
          <p className="truncate font-bold text-content">{course.title}</p>
          <p className="lf-caption mt-0.5 truncate text-content-muted">{course.description}</p>
        </div>
      ),
    },
    { key: 'subject', header: t('admin.content.colSubject'), cell: (course) => <Badge className="bg-surface-sunken text-content-muted">{course.subject}</Badge> },
    { key: 'status', header: t('admin.content.colStatus'), cell: (course) => <StatusBadge status={course.status} /> },
    {
      key: 'structure',
      header: t('admin.content.colStructure'),
      cell: (course) => <span className="lf-caption text-content-muted">{t('admin.content.structureSummary', { topics: course.topicCount, lessons: course.lessonCount })}</span>,
    },
    {
      key: 'published',
      header: t('admin.content.colPublished'),
      numeric: true,
      cell: (course) => <span className="text-success-strong">{nf.format(course.lessonsByStatus.published ?? 0)}</span>,
    },
    {
      key: 'actions',
      header: t('admin.content.colActions'),
      cell: (course) => (
        <div className="flex flex-wrap justify-end gap-1.5">
          <AdminAction tone="neutral" icon="visibility" onClick={() => setCourseDetail(course)}>{t('admin.content.viewDetail')}</AdminAction>
          {course.status !== 'published' && <AdminAction tone="success" icon="publish" onClick={() => void setCourseStatus(course.id, 'published')} disabled={busy === course.id}>{t('admin.content.publish')}</AdminAction>}
          {course.status === 'published' && <AdminAction tone="neutral" icon="unpublished" onClick={() => void setCourseStatus(course.id, 'draft')} disabled={busy === course.id}>{t('admin.content.unpublish')}</AdminAction>}
          {course.status !== 'archived' && <AdminAction tone="neutral" icon="archive" onClick={() => void setCourseStatus(course.id, 'archived')} disabled={busy === course.id}>{t('admin.content.archive')}</AdminAction>}
        </div>
      ),
    },
  ];

  return (
    <AdminPage titleKey="admin.content.title" subtitleKey="admin.content.subtitle">
      <div className="flex flex-col gap-6">
        {contentData.data.state === 'ready' && summary && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <StatCard icon={<Icon name="menu_book" />} value={nf.format(summary.courses.total)} label={t('admin.content.totalCourses')} tone="primary" />
            <StatCard icon={<Icon name="check_circle" />} value={`${summary.courses.total ? Math.round((summary.courses.published / summary.courses.total) * 100) : 0}%`} label={t('admin.content.liveCourses')} tone="secondary" />
            <StatCard icon={<Icon name="library_books" />} value={nf.format(summary.lessons.total)} label={t('admin.content.totalLessons')} tone="primary" />
            <StatCard icon={<Icon name="task_alt" />} value={nf.format(summary.lessons.published)} label={t('admin.content.liveLessons')} tone="secondary" />
            <StatCard icon={<Icon name="gpp_maybe" />} value={nf.format(summary.lessons.review)} label={t('admin.content.pendingModeration')} tone={summary.lessons.review > 0 ? 'accent' : 'primary'} />
            <StatCard icon={<Icon name="edit_note" />} value={nf.format(summary.lessons.draft)} label={t('admin.content.draftLessons')} tone="accent" />
          </div>
        )}

        <nav className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-outline/40 bg-surface-sunken p-1 shadow-sm" role="tablist" aria-label={t('admin.content.tabs.aria')}>
          {TABS.map(({ key, icon }) => {
            const count = key === 'lessons' ? reviewTotal : null;
            return (
              <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={cn('flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-4 py-2 lf-label font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', tab === key ? 'bg-surface text-content shadow-glass-sm' : 'text-content-muted hover:text-content')}>
                <Icon name={icon} className="!text-[18px]" />
                <span>{t(`admin.content.tabs.${key}`)}</span>
                {count !== null && count > 0 && <span className="lf-number rounded-full bg-warning-soft px-2 py-0.5 lf-caption text-warning-strong">{nf.format(count)}</span>}
              </button>
            );
          })}
        </nav>

        {actionError && <div role="alert" className="flex items-center gap-2 rounded-xl bg-error-soft p-3 lf-caption font-semibold text-error-strong"><Icon name="error" className="shrink-0 !text-[18px]" />{actionError}</div>}

        {tab === 'courses' && (
          <section className="flex flex-col gap-4">
            <div>
              <h2 className="lf-title font-bold text-content">{t('admin.content.coursesHeading')}</h2>
              <p className="lf-caption mt-1 text-content-muted">{t('admin.content.coursesHelper')}</p>
            </div>
            <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="relative min-w-[240px] flex-1">
                <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 !text-[18px] text-content-muted" />
                <input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('admin.content.searchPlaceholder')} className="w-full rounded-full border border-outline/40 bg-surface-sunken py-2 pl-9 pr-4 text-sm text-content placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-outline/30 bg-surface-sunken p-1">
                <button type="button" onClick={() => setStatusFilter('all')} className={cn('min-h-11 shrink-0 rounded-full px-3 lf-caption font-bold', statusFilter === 'all' ? 'bg-surface text-content shadow-sm' : 'text-content-muted hover:text-content')}>{t('admin.content.allStatuses')}</button>
                {STATUS_FILTERS.map((status) => <button key={status} type="button" onClick={() => setStatusFilter(status)} className={cn('min-h-11 shrink-0 rounded-full px-3 lf-caption font-bold', statusFilter === status ? 'bg-surface text-content shadow-sm' : 'text-content-muted hover:text-content')}>{t(`admin.status.${status}`, status)}</button>)}
              </div>
            </Card>
            {contentData.data.state === 'error' ? <Unavailable code={contentData.data.code} /> : contentData.data.state === 'ready' ? filteredCourses.length === 0 ? <AdminEmpty icon="menu_book" message={courses.length === 0 ? t('admin.content.empty') : t('admin.content.noMatch')} /> : <Table columns={courseColumns} rows={filteredCourses} rowKey={(course) => course.id} /> : <AdminEmpty icon="hourglass_empty" message={t('admin.loading')} />}
          </section>
        )}

        {tab === 'lessons' && (
          <section className="flex flex-col gap-4">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="lf-title font-bold text-content">{t('admin.moderation.heading')}</h2>
                {reviewTotal !== null && <Badge className="bg-warning-soft text-warning-strong">{t('admin.moderation.queueCount', { count: reviewTotal })}</Badge>}
              </div>
              <p className="lf-caption mt-1 max-w-3xl text-content-muted">{t('admin.moderation.note')}</p>
            </div>
            {moderationData.data.state === 'error' ? <Unavailable code={moderationData.data.code} /> : moderationData.data.state === 'ready' ? reviewLessons.length === 0 ? <AdminEmpty icon="task_alt" message={t('admin.moderation.empty')} /> : <ul className="flex flex-col gap-3">{reviewLessons.map((lesson) => <li key={lesson.id}><Card className="flex flex-col gap-4 p-4 sm:p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="lf-label font-bold text-content">{lesson.title}</p><StatusBadge status={lesson.status} /></div><p className="lf-number lf-caption mt-1 text-content-muted">{lesson.slug}</p><p className="lf-caption mt-2 text-content-muted">{lesson.courseTitle} / {lesson.adventureTitle} / {lesson.sagaTitle} / {lesson.topicTitle}</p></div><div className="flex flex-wrap gap-2 lg:justify-end"><Badge className="bg-surface-sunken text-content-muted">{lesson.subject}</Badge><Badge className="bg-surface-sunken text-content-muted">{t('admin.content.difficultyShort', { count: lesson.difficulty })}</Badge><Badge className="bg-surface-sunken text-content-muted">{t('admin.content.minutes', { count: lesson.estimatedMinutes })}</Badge></div></div><div className="flex flex-col gap-3 border-t border-outline/40 pt-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap gap-3 lf-caption text-content-muted"><span>{t('admin.content.xp')}: <span className="lf-number font-bold text-content">{nf.format(lesson.xpTotal)}</span></span><span>{t('admin.content.locales')}: <span className="font-bold text-content">{lesson.locales.join(', ') || t('admin.moderation.noLocales')}</span></span></div><div className="flex flex-wrap gap-2"><AdminAction tone="neutral" icon="visibility" onClick={() => { setLessonLocale('es-MX'); setLessonDetailId(lesson.id); }}>{t('admin.moderation.preview')}</AdminAction><AdminAction tone="success" icon="check" onClick={() => void decideLesson(lesson.id, 'published')} disabled={busy === lesson.id}>{t('admin.moderation.approve')}</AdminAction><AdminAction tone="danger" icon="undo" onClick={() => void decideLesson(lesson.id, 'draft')} disabled={busy === lesson.id}>{t('admin.moderation.reject')}</AdminAction></div></div></Card></li>)}</ul> : <AdminEmpty icon="hourglass_empty" message={t('admin.loading')} />}
          </section>
        )}
      </div>
      {courseDetail && <CourseDetailDialog course={courseDetail} locale={i18n.resolvedLanguage ?? 'en-US'} busy={busy === courseDetail.id} onClose={() => setCourseDetail(null)} onStatus={async (status) => { const selectedCourseId = courseDetail.id; const ok = await setCourseStatus(selectedCourseId, status); if (ok) setCourseDetail(null); return ok; }} />}
      {lessonDetailId && <LessonReviewDialog lessonId={lessonDetailId} locale={lessonLocale} busy={busy === lessonDetailId} onClose={() => setLessonDetailId(null)} onLocaleChange={setLessonLocale} onStatus={(status) => decideLesson(lessonDetailId, status)} />}
    </AdminPage>
  );
}
