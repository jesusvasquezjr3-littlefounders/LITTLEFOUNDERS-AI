import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Icon, StatCard, Table, type TableColumn } from '@/components/ui';
import { cn } from '@/lib/utils';
import { AdminAction, AdminEmpty, AdminPage, StatusBadge, Unavailable, useAdminData, useAdminMutation } from './adminShared';

interface Course {
  id: string;
  slug: string;
  title: string;
  subject: string;
  status: string;
  position: number;
}

interface ReviewLesson {
  id: string;
  slug: string;
  title: string;
  status: string;
}

const TABS = [
  { key: 'courses', icon: 'menu_book' },
  { key: 'lessons', icon: 'shield' },
] as const;
type Tab = (typeof TABS)[number]['key'];

export function AdminContentPage() {
  const { t } = useTranslation();
  const coursesData = useAdminData<{ courses: Course[] }>('/admin/content');
  const moderationData = useAdminData<{ lessons: ReviewLesson[] }>('/admin/moderation');
  const mutate = useAdminMutation();
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('courses');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [previewLesson, setPreviewLesson] = useState<ReviewLesson | null>(null);

  const pending: Record<Tab, number | null> = {
    courses: null,
    lessons: moderationData.data.state === 'ready' ? moderationData.data.data.lessons.length : null,
  };

  const courses = coursesData.data.state === 'ready' ? coursesData.data.data.courses : [];
  const reviewLessons = moderationData.data.state === 'ready' ? moderationData.data.data.lessons : [];

  // Summary Metrics
  const totalCourses = courses.length;
  const publishedCoursesCount = useMemo(() => courses.filter((c) => c.status === 'published').length, [courses]);
  const livePct = totalCourses > 0 ? Math.round((publishedCoursesCount / totalCourses) * 100) : 0;
  const draftCoursesCount = useMemo(() => courses.filter((c) => c.status === 'draft' || c.status === 'review').length, [courses]);

  // Client-side Filtered Courses
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        c.title.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        c.subject.toLowerCase().includes(q);

      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [courses, search, statusFilter]);

  // The backend refuses a publish with a distinct error code per cause (e.g.
  // RELEASE_VERIFICATION_REQUIRED) — it must reach the admin, not be dropped.
  async function setCourseStatus(id: string, status: string) {
    setBusy(id);
    setActionError(null);
    const res = await mutate(`/admin/content/${id}/status`, { status });
    if (res.error) {
      setActionError(t(`errors.api.${res.error.code}`, { defaultValue: t('admin.content.actionFailed') }));
    } else {
      await coursesData.reload();
    }
    setBusy(null);
  }

  async function decide(id: string, status: 'published' | 'draft') {
    setBusy(id);
    setActionError(null);
    const res = await mutate(`/admin/moderation/${id}/status`, { status });
    if (res.error) {
      setActionError(t(`errors.api.${res.error.code}`, { defaultValue: t('admin.content.actionFailed') }));
    } else {
      await moderationData.reload();
    }
    if (previewLesson?.id === id) setPreviewLesson(null);
    setBusy(null);
  }

  const courseColumns: TableColumn<Course>[] = [
    { key: 'title', header: t('admin.content.colTitle'), primary: true, cell: (c) => c.title },
    { key: 'slug', header: t('admin.content.colSlug'), cell: (c) => <span className="lf-number font-mono text-content-muted text-xs">{c.slug}</span> },
    { key: 'subject', header: t('admin.content.colSubject'), cell: (c) => <Badge className="bg-surface-sunken text-content-muted text-xs">{c.subject}</Badge> },
    { key: 'status', header: t('admin.content.colStatus'), cell: (c) => <StatusBadge status={c.status} /> },
    {
      key: 'actions',
      header: t('admin.content.colActions'),
      cell: (c) => (
        <div className="flex flex-wrap gap-1.5 justify-end">
          {c.status !== 'published' && (
            <AdminAction tone="success" icon="publish" onClick={() => void setCourseStatus(c.id, 'published')} disabled={busy === c.id}>
              {t('admin.content.publish')}
            </AdminAction>
          )}
          {c.status === 'published' && (
            <AdminAction tone="neutral" icon="unpublished" onClick={() => void setCourseStatus(c.id, 'draft')} disabled={busy === c.id}>
              {t('admin.content.unpublish')}
            </AdminAction>
          )}
          {c.status !== 'archived' && (
            <AdminAction tone="neutral" icon="archive" onClick={() => void setCourseStatus(c.id, 'archived')} disabled={busy === c.id}>
              {t('admin.content.archive')}
            </AdminAction>
          )}
        </div>
      ),
    },
  ];

  return (
    <AdminPage titleKey="admin.content.title" subtitleKey="admin.content.subtitle">
      <div className="flex flex-col gap-6">
        {/* Top KPI Header Cards */}
        {coursesData.data.state === 'ready' && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon={<Icon name="menu_book" className="!text-[24px]" />}
              value={totalCourses.toString()}
              label={t('admin.content.totalCourses')}
              tone="primary"
            />
            <StatCard
              icon={<Icon name="check_circle" className="!text-[24px]" />}
              value={`${livePct}%`}
              label={t('admin.content.liveCourses')}
              tone="secondary"
            />
            <StatCard
              icon={<Icon name="edit_note" className="!text-[24px]" />}
              value={draftCoursesCount.toString()}
              label={t('admin.content.draftCourses')}
              tone="accent"
            />
            <StatCard
              icon={<Icon name="gpp_maybe" className="!text-[24px]" />}
              value={reviewLessons.length.toString()}
              label={t('admin.content.pendingModeration')}
              tone={reviewLessons.length > 0 ? 'accent' : 'primary'}
            />
          </div>
        )}

        {/* Tab Bar Navigation */}
        <nav className="flex w-fit gap-1 rounded-xl bg-surface-sunken p-1 border border-outline/40 shadow-sm" role="tablist" aria-label={t('admin.content.tabs.aria')}>
          {TABS.map(({ key, icon }) => {
            const count = pending[key];
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  'flex min-h-11 items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  tab === key ? 'bg-surface text-content shadow-glass-sm border border-outline/30' : 'text-content-muted hover:text-content',
                )}
              >
                <Icon name={icon} className="!text-[18px]" />
                <span>{t(`admin.content.tabs.${key}`)}</span>
                {count !== null && count > 0 && (
                  <span className="lf-caption rounded-full bg-warning-soft px-2 py-0.5 font-bold text-warning-strong text-xs">{count}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Last action outcome — a refused publish must be visible, never silent */}
        {actionError && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-xl bg-error-soft p-3 lf-caption font-semibold text-error-strong"
          >
            <Icon name="error" className="shrink-0 !text-[18px]" />
            {actionError}
          </div>
        )}

        {/* ── Courses Tab ── */}
        {tab === 'courses' && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="lf-title font-bold text-content">{t('admin.content.coursesHeading')}</h2>
            </div>

            {/* Filter & Search Bar */}
            <Card className="flex flex-wrap items-center justify-between gap-3 p-4 shadow-glass border border-outline/50">
              <div className="relative flex-1 min-w-[240px]">
                <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 !text-[18px] text-content-muted pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('admin.content.searchPlaceholder')}
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-full bg-surface-sunken border border-outline/40 text-content placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
              </div>

              {/* Status Filter Pills */}
              <div className="flex gap-1 bg-surface-sunken p-1 rounded-full border border-outline/30 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={cn(
                    'px-3 py-1 text-xs font-bold rounded-full transition-colors whitespace-nowrap',
                    statusFilter === 'all' ? 'bg-surface text-content shadow-sm' : 'text-content-muted hover:text-content'
                  )}
                >
                  {t('admin.content.allStatuses')}
                </button>
                {['published', 'draft', 'review', 'archived'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={cn(
                      'px-3 py-1 text-xs font-bold rounded-full transition-colors whitespace-nowrap',
                      statusFilter === st ? 'bg-surface text-content shadow-sm' : 'text-content-muted hover:text-content'
                    )}
                  >
                    {t(`admin.status.${st}`, st)}
                  </button>
                ))}
              </div>
            </Card>

            {coursesData.data.state === 'error' ? (
              <Unavailable code={coursesData.data.code} />
            ) : coursesData.data.state === 'ready' ? (
              filteredCourses.length === 0 ? (
                <AdminEmpty icon="menu_book" message={courses.length === 0 ? t('admin.content.empty') : t('admin.content.noMatch')} />
              ) : (
                <Table columns={courseColumns} rows={filteredCourses} rowKey={(c) => c.id} />
              )
            ) : (
              <AdminEmpty icon="hourglass_empty" message={t('admin.loading')} />
            )}
          </section>
        )}

        {/* ── Lesson Review Queue Tab ── */}
        {tab === 'lessons' && (
          <section className="flex flex-col gap-4">
            <h2 className="lf-title font-bold text-content">{t('admin.moderation.heading')}</h2>
            <div className="flex items-start gap-3 rounded-xl bg-primary-soft/80 border border-primary/20 p-4 text-primary">
              <Icon name="shield" className="mt-0.5 shrink-0 !text-[20px]" />
              <p className="lf-caption font-medium">{t('admin.moderation.note')}</p>
            </div>

            {moderationData.data.state === 'error' ? (
              <Unavailable code={moderationData.data.code} />
            ) : moderationData.data.state === 'ready' ? (
              moderationData.data.data.lessons.length === 0 ? (
                <AdminEmpty icon="task_alt" message={t('admin.moderation.empty')} />
              ) : (
                <ul className="flex flex-col gap-3">
                  {moderationData.data.data.lessons.map((l) => (
                    <li key={l.id}>
                      <Card className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 shadow-glass border border-outline/50 hover:border-outline transition-all">
                        <div className="min-w-0 flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-surface-sunken text-content-muted">
                            <Icon name="school" className="!text-[20px]" />
                          </div>
                          <div>
                            <p className="lf-label truncate text-content font-bold">{l.title}</p>
                            <p className="lf-number lf-caption text-content-muted font-mono text-xs mt-0.5">{l.slug}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <AdminAction tone="neutral" icon="visibility" onClick={() => setPreviewLesson(l)}>
                            {t('admin.moderation.preview')}
                          </AdminAction>
                          <AdminAction tone="success" icon="check" onClick={() => void decide(l.id, 'published')} disabled={busy === l.id}>
                            {t('admin.moderation.approve')}
                          </AdminAction>
                          <AdminAction tone="danger" icon="undo" onClick={() => void decide(l.id, 'draft')} disabled={busy === l.id}>
                            {t('admin.moderation.reject')}
                          </AdminAction>
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <AdminEmpty icon="hourglass_empty" message={t('admin.loading')} />
            )}
          </section>
        )}

        {/* Lesson Moderation Preview Modal */}
        {previewLesson && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={() => setPreviewLesson(null)}
          >
            <div
              className="w-full max-w-lg bg-surface border border-outline rounded-2xl p-6 shadow-glass flex flex-col gap-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 pb-3 border-b border-outline/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary-soft text-primary">
                    <Icon name="shield" className="!text-[24px]" />
                  </div>
                  <div>
                    <h2 className="lf-title text-content font-bold">{t('admin.moderation.previewTitle')}</h2>
                    <p className="lf-caption text-content-muted mt-0.5">{previewLesson.title}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewLesson(null)}
                  className="p-1 rounded-full text-content-muted hover:text-content hover:bg-surface-sunken transition-colors"
                >
                  <Icon name="close" className="!text-[20px]" />
                </button>
              </div>

              <div className="flex flex-col gap-3 p-4 rounded-xl bg-surface-sunken/40 border border-outline/30 text-sm">
                <div>
                  <span className="lf-caption text-content-muted block">{t('admin.content.colTitle')}</span>
                  <span className="lf-body text-content font-bold mt-0.5 block">{previewLesson.title}</span>
                </div>
                <div>
                  <span className="lf-caption text-content-muted block">{t('admin.content.colSlug')}</span>
                  <span className="font-mono text-xs text-content bg-surface px-2.5 py-1 rounded-md border border-outline/30 mt-1 inline-block">
                    {previewLesson.slug}
                  </span>
                </div>
                <div>
                  <span className="lf-caption text-content-muted block">{t('admin.moderation.colLessonId')}</span>
                  <span className="font-mono text-xs text-content-muted mt-0.5 block">{previewLesson.id}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <AdminAction tone="danger" icon="undo" onClick={() => void decide(previewLesson.id, 'draft')} disabled={busy === previewLesson.id}>
                  {t('admin.moderation.reject')}
                </AdminAction>
                <AdminAction tone="success" icon="check" onClick={() => void decide(previewLesson.id, 'published')} disabled={busy === previewLesson.id}>
                  {t('admin.moderation.approve')}
                </AdminAction>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminPage>
  );
}
