import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { Badge, Card, Icon, ProgressBar, StatCard } from '@/components/ui';
import { cn } from '@/lib/utils';
import { AdminPage, RoleChip, Unavailable, useAdminData } from './adminShared';

interface Overview {
  users: { total: number; byRole: Record<string, number>; staff: number };
  content: { courses: Record<string, number>; lessons: Record<string, number>; reviewQueue: number };
  audit: { total: number };
}
interface Health {
  summary: { total: number; down: number };
  monitors: { id: number; name: string; status: number }[];
}
interface Retention {
  buckets: { bucket: string; n: number; avg_first_attempt_score: number }[];
  byTopic: { slug: string; title: string; n: number; avgFirstAttemptScore: number }[];
}

/** ≥80 sticks, 60–79 wobbles, <60 decays — same tone scale as content status. */
function retentionTone(score: number): string {
  if (score >= 80) return 'text-success-strong';
  if (score >= 60) return 'text-warning-strong';
  return 'text-error-strong';
}

function retentionProgressTone(score: number): 'primary' | 'accent' {
  return score >= 80 ? 'primary' : 'accent';
}

const ROLE_ORDER = ['superadmin', 'admin', 'bigfounder', 'parent', 'kid', 'universal'];
const STATUS_ORDER = ['published', 'review', 'draft', 'archived'];

function StatusBar({ counts }: { counts: Record<string, number> }) {
  const { t } = useTranslation();
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const color: Record<string, string> = {
    published: 'bg-success',
    review: 'bg-warning',
    draft: 'bg-outline',
    archived: 'bg-content-faint/40',
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-sunken">
        {STATUS_ORDER.filter((s) => counts[s]).map((s) => (
          <div key={s} className={cn('h-full', color[s])} style={{ width: `${((counts[s] ?? 0) / total) * 100}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {STATUS_ORDER.filter((s) => counts[s]).map((s) => (
          <span key={s} className="lf-caption flex items-center gap-1.5 text-content-muted">
            <span className={cn('h-2 w-2 rounded-full', color[s])} />
            {t(`admin.status.${s}`, s)} <span className="lf-number font-bold text-content">{counts[s]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function AdminOverviewPage() {
  const { t } = useTranslation();
  const { roles } = useAuth();
  const isSuperadmin = roles.includes('superadmin');
  const { data } = useAdminData<Overview>('/admin/overview');
  const { data: health } = useAdminData<Health>('/admin/health/services');
  const { data: retention } = useAdminData<Retention>('/admin/learning/retention');

  const nf = new Intl.NumberFormat();
  const o = data.state === 'ready' ? data.data : null;
  const staffCount = o?.users.staff ?? 0;

  const quickActions = [
    { key: 'content', path: '/admin/content', icon: 'menu_book', desc: t('admin.overview.navContentDesc') },
    { key: 'users', path: '/admin/users', icon: 'group', desc: t('admin.overview.navUsersDesc') },
    { key: 'emails', path: '/admin/emails', icon: 'mail', desc: t('admin.overview.navEmailsDesc') },
    { key: 'generation', path: '/admin/generation', icon: 'precision_manufacturing', desc: t('admin.overview.navGenDesc') },
    { key: 'analytics', path: '/admin/analytics', icon: 'monitoring', desc: t('admin.overview.navAnalyticsDesc') },
  ];

  return (
    <AdminPage titleKey="admin.overview.title" subtitleKey="admin.overview.subtitle">
      {data.state === 'error' ? (
        <Unavailable code={data.code} />
      ) : (
        <div className="flex flex-col gap-6">
          {/* KPI Header Grid */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <StatCard dense icon={<Icon name="group" />} value={o ? nf.format(o.users.total) : '…'} label={t('admin.overview.kpiUsers')} className="shadow-glass border border-outline/50" />
            <StatCard dense icon={<Icon name="shield_person" />} value={o ? nf.format(staffCount) : '…'} label={t('admin.overview.kpiStaff')} className="shadow-glass border border-outline/50" />
            <StatCard dense icon={<Icon name="school" />} value={o ? nf.format(o.content.courses.published ?? 0) : '…'} label={t('admin.overview.kpiCoursesLive')} className="shadow-glass border border-outline/50" />
            <StatCard dense tone="accent" icon={<Icon name="gpp_maybe" />} value={o ? nf.format(o.content.reviewQueue) : '…'} label={t('admin.overview.kpiReview')} className="shadow-glass border border-outline/50" />
            <StatCard dense icon={<Icon name="menu_book" />} value={o ? nf.format(o.content.lessons.published ?? 0) : '…'} label={t('admin.overview.kpiLessonsLive')} className="shadow-glass border border-outline/50" />
            <StatCard dense icon={<Icon name="history" />} value={o ? nf.format(o.audit.total) : '…'} label={t('admin.overview.kpiAudit')} className="shadow-glass border border-outline/50" />
          </div>

          {/* Quick Staff Action Shortcuts Hub */}
          <Card className="flex flex-col gap-3 p-5 shadow-glass border border-outline/50">
            <div>
              <h2 className="lf-title font-bold text-content">{t('admin.overview.quickActionsTitle')}</h2>
              <p className="lf-caption text-content-muted">{t('admin.overview.quickActionsSubtitle')}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mt-1">
              {quickActions.map((act) => (
                <Link
                  key={act.key}
                  to={act.path}
                  className="lf-press motion-safe-press group flex flex-col gap-2 p-3.5 rounded-xl bg-surface-sunken/60 hover:bg-primary-soft/40 border border-outline/30 hover:border-primary/40 transition-all duration-150"
                >
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-surface text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      <Icon name={act.icon} className="!text-[20px]" />
                    </div>
                    <Icon name="arrow_forward" className="!text-[16px] text-content-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div>
                    <span className="lf-label font-bold text-content group-hover:text-primary transition-colors block">
                      {t(`admin.nav.${act.key}`)}
                    </span>
                    <span className="lf-caption text-content-muted text-xs line-clamp-1 block mt-0.5">
                      {act.desc}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Content status */}
            <Card className="flex flex-col gap-4 p-5 sm:p-6 shadow-glass border border-outline/50 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <h2 className="lf-title font-bold text-content">{t('admin.overview.contentTitle')}</h2>
                <Link to="/admin/content" className="lf-caption font-bold text-primary hover:underline">
                  {t('admin.overview.manage')}
                </Link>
              </div>
              <div>
                <p className="lf-caption mb-1.5 text-content-muted">{t('admin.overview.courses')}</p>
                <StatusBar counts={o?.content.courses ?? {}} />
              </div>
              <div>
                <p className="lf-caption mb-1.5 text-content-muted">{t('admin.overview.lessons')}</p>
                <StatusBar counts={o?.content.lessons ?? {}} />
              </div>
              {o && o.content.reviewQueue > 0 && (
                <Link
                  to="/admin/content"
                  className="lf-press motion-safe-press flex items-center justify-between rounded-xl bg-warning-soft px-4 py-3 text-warning-strong transition-colors hover:bg-warning-soft/70"
                >
                  <span className="lf-label flex items-center gap-2">
                    <Icon name="gpp_maybe" /> {t('admin.overview.reviewCta', { count: o.content.reviewQueue })}
                  </span>
                  <Icon name="arrow_forward" />
                </Link>
              )}
            </Card>

            {/* Roles distribution */}
            <Card className="flex flex-col gap-4 p-5 sm:p-6 shadow-glass border border-outline/50 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <h2 className="lf-title font-bold text-content">{t('admin.overview.rolesTitle')}</h2>
                {isSuperadmin && (
                  <Link to="/admin/roles" className="lf-caption font-bold text-primary hover:underline">
                    {t('admin.overview.manage')}
                  </Link>
                )}
              </div>
              <ul className="flex flex-col divide-y divide-outline/50">
                {ROLE_ORDER.filter((r) => o?.users.byRole[r]).map((r) => (
                  <li key={r} className="flex items-center justify-between py-2">
                    <RoleChip role={r} />
                    <span className="lf-number lf-title text-content">{nf.format(o?.users.byRole[r] ?? 0)}</span>
                  </li>
                ))}
                {o && Object.keys(o.users.byRole).length === 0 && (
                  <li className="lf-caption py-2 text-content-faint">{t('admin.overview.noRoles')}</li>
                )}
              </ul>
            </Card>
          </div>

          {/* Learning retention module */}
          <Card className="flex flex-col gap-4 p-5 sm:p-6 shadow-glass border border-outline/50 relative overflow-hidden">
            <div>
              <h2 className="lf-title font-bold text-content">{t('admin.overview.retentionTitle')}</h2>
              <p className="lf-caption mt-1 text-content-muted">{t('admin.overview.retentionSubtitle')}</p>
            </div>
            {retention.state === 'ready' && retention.data.buckets.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2">
                <div className="flex flex-col gap-3">
                  {retention.data.buckets.map((b) => (
                    <div key={b.bucket} className="flex flex-col gap-1.5 p-3 rounded-xl bg-surface-sunken/40 border border-outline/30">
                      <div className="flex items-center justify-between">
                        <span className="lf-label text-content font-bold">{t('admin.overview.retentionBucket', { bucket: b.bucket })}</span>
                        <span className="flex items-baseline gap-2">
                          <span className="lf-caption text-content-muted text-xs">{t('admin.overview.retentionAttempts', { count: b.n })}</span>
                          <span className={cn('lf-number font-bold text-sm', retentionTone(b.avg_first_attempt_score))}>
                            {b.avg_first_attempt_score}%
                          </span>
                        </span>
                      </div>
                      <ProgressBar
                        value={b.avg_first_attempt_score}
                        tone={retentionProgressTone(b.avg_first_attempt_score)}
                        label={t('admin.overview.retentionBucket', { bucket: b.bucket })}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-3">
                  <p className="lf-caption font-bold text-content-muted">{t('admin.overview.retentionWeakest')}</p>
                  <div className="flex flex-col gap-2.5">
                    {retention.data.byTopic.slice(0, 4).map((row) => (
                      <div key={row.slug} className="flex flex-col gap-1 p-2.5 rounded-xl bg-surface-sunken/40 border border-outline/30">
                        <div className="flex items-center justify-between">
                          <span className="lf-label truncate pr-3 text-content font-medium">{row.title}</span>
                          <span className={cn('lf-number font-bold text-sm shrink-0', retentionTone(row.avgFirstAttemptScore))}>
                            {row.avgFirstAttemptScore}%
                          </span>
                        </div>
                        <ProgressBar
                          value={row.avgFirstAttemptScore}
                          tone={retentionProgressTone(row.avgFirstAttemptScore)}
                          label={row.title}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="lf-caption text-content-faint">
                {retention.state === 'error' ? t('admin.overview.healthUnavailable') : t('admin.overview.retentionEmpty')}
              </p>
            )}
          </Card>

          {/* Health strip */}
          <Card className="flex flex-col gap-4 p-5 sm:p-6 shadow-glass border border-outline/50 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <h2 className="lf-title font-bold text-content">{t('admin.overview.healthTitle')}</h2>
              <div className="flex items-center gap-2">
                {health.state === 'ready' &&
                  (health.data.summary.down === 0 ? (
                    <Badge className="bg-success-soft text-success-strong">{t('admin.health.allUp')}</Badge>
                  ) : (
                    <Badge className="bg-error-soft text-error-strong">{t('admin.health.someDown', { count: health.data.summary.down })}</Badge>
                  ))}
                <Link to="/admin/analytics" className="lf-caption font-bold text-primary hover:underline">
                  {t('admin.overview.details')}
                </Link>
              </div>
            </div>
            {health.state === 'ready' ? (
              <div className="flex flex-wrap gap-2">
                {health.data.monitors.map((m) => (
                  <span
                    key={m.id}
                    className={cn(
                      'lf-caption flex items-center gap-1.5 rounded-full px-3 py-1.5 font-bold',
                      m.status === 1 ? 'bg-success-soft text-success-strong' : 'bg-error-soft text-error-strong',
                    )}
                  >
                    <span className={cn('h-2 w-2 rounded-full', m.status === 1 ? 'bg-success' : 'bg-error')} />
                    {m.name}
                  </span>
                ))}
              </div>
            ) : health.state === 'error' ? (
              <p className="lf-caption text-content-faint">{t('admin.overview.healthUnavailable')}</p>
            ) : (
              <p className="lf-caption text-content-faint">{t('admin.health.loading')}</p>
            )}
          </Card>
        </div>
      )}
    </AdminPage>
  );
}
