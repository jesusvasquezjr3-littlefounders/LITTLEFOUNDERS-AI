import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { Badge, Card, Icon, StatCard } from '@/components/ui';
import { cn } from '@/lib/utils';
import { AdminPage, RoleChip, Unavailable, useAdminData } from './adminShared';

interface Overview {
  users: { total: number; byRole: Record<string, number> };
  content: { courses: Record<string, number>; lessons: Record<string, number>; reviewQueue: number };
  audit: { recent: number };
}
interface Health {
  summary: { total: number; down: number };
  monitors: { id: number; name: string; status: number }[];
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

  const nf = new Intl.NumberFormat();
  const o = data.state === 'ready' ? data.data : null;
  const staffCount = (o?.users.byRole.admin ?? 0) + (o?.users.byRole.superadmin ?? 0);

  return (
    <AdminPage titleKey="admin.overview.title" subtitleKey="admin.overview.subtitle">
      {data.state === 'error' ? (
        <Unavailable code={data.code} />
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <StatCard dense icon={<Icon name="group" />} value={o ? nf.format(o.users.total) : '…'} label={t('admin.overview.kpiUsers')} />
            <StatCard dense icon={<Icon name="shield_person" />} value={o ? nf.format(staffCount) : '…'} label={t('admin.overview.kpiStaff')} />
            <StatCard dense icon={<Icon name="school" />} value={o ? nf.format(o.content.courses.published ?? 0) : '…'} label={t('admin.overview.kpiCoursesLive')} />
            <StatCard dense tone="accent" icon={<Icon name="gpp_maybe" />} value={o ? nf.format(o.content.reviewQueue) : '…'} label={t('admin.overview.kpiReview')} />
            <StatCard dense icon={<Icon name="menu_book" />} value={o ? nf.format(o.content.lessons.published ?? 0) : '…'} label={t('admin.overview.kpiLessonsLive')} />
            <StatCard dense icon={<Icon name="history" />} value={o ? nf.format(o.audit.recent) : '…'} label={t('admin.overview.kpiAudit')} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Content status */}
            <Card className="flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between">
                <h2 className="lf-title">{t('admin.overview.contentTitle')}</h2>
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
                  to="/admin/moderation"
                  className="motion-safe-press flex items-center justify-between rounded-lg bg-warning-soft px-4 py-3 text-warning-strong transition-colors hover:bg-warning-soft/70"
                >
                  <span className="lf-label flex items-center gap-2">
                    <Icon name="gpp_maybe" /> {t('admin.overview.reviewCta', { count: o.content.reviewQueue })}
                  </span>
                  <Icon name="arrow_forward" />
                </Link>
              )}
            </Card>

            {/* Roles distribution */}
            <Card className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <h2 className="lf-title">{t('admin.overview.rolesTitle')}</h2>
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

          {/* Health strip */}
          <Card className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="lf-title">{t('admin.overview.healthTitle')}</h2>
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
                      'lf-caption flex items-center gap-1.5 rounded-full px-3 py-1.5',
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
        </>
      )}
    </AdminPage>
  );
}
