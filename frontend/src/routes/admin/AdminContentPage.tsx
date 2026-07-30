import { useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Card, Icon, Table, type TableColumn } from '@/components/ui';
import { cn } from '@/lib/utils';
import { AdminAction, AdminEmpty, AdminPage, StatusBadge, Unavailable, useAdminData, useAdminMutation } from './adminShared';
import { GamesReviewQueue, type AdminReviewGame } from './GamesReviewQueue';

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

/* The console's own tab grammar (AdminGenerationPage). Courses, lessons and now
 * games are three separate jobs, and the two review queues are HUMAN PUBLISH
 * GATES (§1.9) — so each tab carries a count badge: a queue you cannot see from
 * the tab you are on is a queue that quietly grows. */
const TABS = [
  { key: 'courses', icon: 'menu_book' },
  { key: 'lessons', icon: 'shield' },
  { key: 'games', icon: 'stadia_controller' },
] as const;
type Tab = (typeof TABS)[number]['key'];

/* `admin.content.tabs.lessons` does not exist yet (the locale files carry only
 * `aria`, `courses` and `games`). Until it lands, the lesson tab borrows the
 * review queue's own heading — which IS translated in all three locales — so no
 * reviewer ever sees a raw key. Delete this the moment the key exists. */
function tabFallback(key: Tab, t: TFunction): string {
  return key === 'lessons' ? t('admin.moderation.heading') : key;
}

export function AdminContentPage() {
  const { t } = useTranslation();
  const coursesData = useAdminData<{ courses: Course[] }>('/admin/content');
  const moderationData = useAdminData<{ lessons: ReviewLesson[] }>('/admin/moderation');
  const gamesData = useAdminData<{ games: AdminReviewGame[] }>('/admin/games');
  const mutate = useAdminMutation();
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('courses');

  const pending: Record<Tab, number | null> = {
    courses: null,
    lessons: moderationData.data.state === 'ready' ? moderationData.data.data.lessons.length : null,
    games: gamesData.data.state === 'ready' ? gamesData.data.data.games.length : null,
  };

  async function setCourseStatus(id: string, status: string) {
    setBusy(id);
    await mutate(`/admin/content/${id}/status`, { status });
    await coursesData.reload();
    setBusy(null);
  }

  async function decide(id: string, status: 'published' | 'draft') {
    setBusy(id);
    await mutate(`/admin/moderation/${id}/status`, { status });
    await moderationData.reload();
    setBusy(null);
  }

  const courseColumns: TableColumn<Course>[] = [
    { key: 'title', header: t('admin.content.colTitle'), primary: true, cell: (c) => c.title },
    { key: 'slug', header: t('admin.content.colSlug'), cell: (c) => <span className="lf-number text-content-muted">{c.slug}</span> },
    { key: 'subject', header: t('admin.content.colSubject'), cell: (c) => c.subject },
    { key: 'status', header: t('admin.content.colStatus'), cell: (c) => <StatusBadge status={c.status} /> },
    {
      key: 'actions',
      header: t('admin.content.colActions'),
      cell: (c) => (
        <div className="flex flex-wrap gap-1.5">
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
      {/* Tab bar */}
      <nav className="flex w-fit gap-1 rounded-xl bg-surface-sunken p-1" role="tablist" aria-label={t('admin.content.tabs.aria')}>
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
                'flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                tab === key ? 'bg-base text-content shadow-glass-sm' : 'text-content-muted hover:text-content',
              )}
            >
              <Icon name={icon} className="!text-[18px]" />
              <span className="hidden sm:inline">{t(`admin.content.tabs.${key}`, { defaultValue: tabFallback(key, t) })}</span>
              {count !== null && count > 0 && (
                <span className="lf-caption rounded-full bg-warning-soft px-1.5 font-bold text-warning-strong">{count}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Courses ── */}
      {tab === 'courses' && (
        <section className="flex flex-col gap-4">
          <h2 className="lf-title">{t('admin.content.coursesHeading')}</h2>
          {coursesData.data.state === 'error' ? (
            <Unavailable code={coursesData.data.code} />
          ) : coursesData.data.state === 'ready' ? (
            coursesData.data.data.courses.length === 0 ? (
              <AdminEmpty icon="menu_book" message={t('admin.content.empty')} />
            ) : (
              <Table columns={courseColumns} rows={coursesData.data.data.courses} rowKey={(c) => c.id} />
            )
          ) : (
            <AdminEmpty icon="hourglass_empty" message={t('admin.loading')} />
          )}
        </section>
      )}

      {/* ── Lesson review queue ── */}
      {tab === 'lessons' && (
        <section className="flex flex-col gap-4">
          <h2 className="lf-title">{t('admin.moderation.heading')}</h2>
          <div className="flex items-start gap-2.5 rounded-lg bg-primary-soft px-4 py-3 text-primary">
            <Icon name="shield" className="mt-0.5 shrink-0" />
            <p className="lf-caption">{t('admin.moderation.note')}</p>
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
                    <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="lf-label truncate text-content">{l.title}</p>
                        <p className="lf-number lf-caption text-content-muted">{l.slug}</p>
                      </div>
                      <div className="flex gap-2">
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

      {/* ── Games review queue (the Arcade human publish gate) ── */}
      {tab === 'games' && <GamesReviewQueue data={gamesData.data} reload={gamesData.reload} />}
    </AdminPage>
  );
}
