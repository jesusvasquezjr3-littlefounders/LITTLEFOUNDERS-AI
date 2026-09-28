import { Card, Chip, DashboardLayout, InlineNotice, List, ListRow, ProgressBar } from '../../design/controls';
import type { StaffPermission } from '../../design/controls';
import {
  can, isHealth, isOverview, isRetention, ROLE_ORDER, useStaffRead, type StaffApi, type StaffViewer,
} from './staffConsoleApi';
import { ConsoleLink, consoleLinkHandler, LoadFailure, Loading, Metrics, ShareBars, StaffPage, useFormats, type Metric } from './ConsoleParts';
import { fill, labelOf, useConsoleCopy, type SectionNames } from './staffConsoleCopy';

/*
 * S1 Overview (G.1: mixed by the viewer's current grants). Core projects
 * /admin/overview by grant (users with manage_users, content with
 * manage_content, audit with manage_support) and refuses it with none; health
 * and retention are read only with view_analytics, so an account without that
 * grant never asks for them. Every block and every section link below exists
 * only for a grant the viewer holds; the section list mirrors
 * app-routes/staffGrants.ts (pinned by app-routes/__tests__/staffConsole.test.tsx).
 */

export type ConsoleSection = Exclude<keyof SectionNames, 'overview'>;
export const OVERVIEW_SECTIONS: readonly { id: ConsoleSection; path: string; grant: StaffPermission | 'superadmin' }[] = [
  { id: 'content', path: '/admin/content', grant: 'manage_content' },
  { id: 'users', path: '/admin/users', grant: 'manage_users' },
  { id: 'ageCorrections', path: '/admin/age-corrections', grant: 'manage_users' },
  { id: 'emails', path: '/admin/emails', grant: 'manage_support' },
  { id: 'analytics', path: '/admin/analytics', grant: 'view_analytics' },
  { id: 'intel', path: '/admin/intel', grant: 'view_analytics' },
  { id: 'mentorQuality', path: '/admin/mentor-quality', grant: 'view_analytics' },
  { id: 'generation', path: '/admin/generation', grant: 'manage_content' },
  { id: 'audit', path: '/admin/audit', grant: 'manage_support' },
  { id: 'reports', path: '/admin/reports', grant: 'manage_support' },
  { id: 'roles', path: '/admin/roles', grant: 'superadmin' },
];

const STATUS_ORDER = ['published', 'review', 'draft', 'archived'] as const;

export function StaffOverview({ api, viewer, onNavigate }: { api: StaffApi; viewer: StaffViewer; onNavigate: (href: string) => void }) {
  const { copy, sections, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.overview;
  const analytics = can(viewer, 'view_analytics');
  const overview = useStaffRead(api, '/admin/overview', isOverview);
  const health = useStaffRead(api, analytics ? '/admin/health/services' : null, isHealth);
  const retention = useStaffRead(api, analytics ? '/admin/learning/retention' : null, isRetention);
  const data = overview.load.state === 'ready' ? overview.load.data : null;
  const open = OVERVIEW_SECTIONS.filter((section) => (section.grant === 'superadmin' ? viewer.superadmin : can(viewer, section.grant)));

  const metrics: Metric[] = [];
  if (data?.users) metrics.push({ id: 'accounts', label: t.body.accounts, value: format.number(data.users.total) },
    { id: 'staff', label: t.body.staff, value: format.number(data.users.staff) });
  if (data?.content) metrics.push({ id: 'coursesLive', label: t.body.coursesLive, value: format.number(data.content.courses.published ?? 0) },
    { id: 'lessonsReview', label: t.body.lessonsReview, value: format.number(data.content.reviewQueue) },
    { id: 'lessonsLive', label: t.body.lessonsLive, value: format.number(data.content.lessons.published ?? 0) });
  if (data?.audit) metrics.push({ id: 'auditEvents', label: t.body.auditEvents, value: format.number(data.audit.total) });

  const statusRows = (counts: Record<string, number>) => STATUS_ORDER.filter((status) => counts[status])
    .map((status) => ({ id: status, label: t.option[status], count: counts[status]! }));
  const sum = (counts: Record<string, number>) => Object.values(counts).reduce((a, b) => a + b, 0);

  const primary = <>
    {overview.load.state === 'loading' ? <Loading />
      : overview.load.state === 'error' ? <LoadFailure code={overview.load.code} onRetry={overview.reload} />
        : metrics.length ? <Metrics label={sections.overview} items={metrics} /> : null}
    {data?.content ? <Card heading={t.heading.content}>
      <h3 data-copy-role="heading" className="lf-staff-subheading">{t.body.courses}</h3>
      <ShareBars label={t.body.courses} locale={locale} total={sum(data.content.courses)} rows={statusRows(data.content.courses)} />
      <h3 data-copy-role="heading" className="lf-staff-subheading">{t.body.lessons}</h3>
      <ShareBars label={t.body.lessons} locale={locale} total={sum(data.content.lessons)} rows={statusRows(data.content.lessons)} tone="mint" />
      {data.content.reviewQueue > 0 ? <InlineNotice tone="info">{fill(t.body.reviewQueue, { n: format.number(data.content.reviewQueue) })}</InlineNotice> : null}
      <div><ConsoleLink href="/admin/content?view=review" onNavigate={onNavigate} variant="brand">{t.action.review}</ConsoleLink></div>
    </Card> : null}
    {data?.users ? <Card heading={t.heading.roles}>
      {Object.keys(data.users.byRole).length === 0 ? <p data-copy-role="body">{t.body.noRoles}</p>
        : <ShareBars label={t.heading.roles} locale={locale} total={data.users.total}
          rows={ROLE_ORDER.filter((role) => data.users!.byRole[role]).map((role) => ({ id: role, label: labelOf(copy.roleNames.option, role), count: data.users!.byRole[role]! }))} />}
      {viewer.superadmin ? <div><ConsoleLink href="/admin/roles" onNavigate={onNavigate}>{t.action.manageRoles}</ConsoleLink></div> : null}
    </Card> : null}
    {analytics ? <Card heading={t.heading.retention}>
      <p data-copy-role="body">{t.body.retentionIntro}</p>
      {retention.load.state === 'loading' ? <Loading />
        : retention.load.state === 'error' ? <InlineNotice tone="error">{t.body.retentionFailed}</InlineNotice>
          : retention.load.state === 'ready' && retention.load.data.buckets.length === 0 ? <p data-copy-role="body">{t.body.retentionEmpty}</p>
            : retention.load.state === 'ready' ? <>
              <ul className="lf-staff-bars" aria-label={t.heading.retention}>
                {retention.load.data.buckets.map((bucket) => <li key={bucket.bucket}>
                  <ProgressBar label={fill(t.body.retentionBucket, { bucket: bucket.bucket })} value={bucket.avg_first_attempt_score} max={100}
                    valueText={`${format.number(bucket.avg_first_attempt_score)}% · ${fill(t.body.retentionTries, { n: format.number(bucket.n) })}`} />
                </li>)}
              </ul>
              {retention.load.data.byTopic.length ? <>
                <h3 data-copy-role="heading" className="lf-staff-subheading">{t.body.weakest}</h3>
                <ul className="lf-staff-bars" aria-label={t.body.weakest}>
                  {retention.load.data.byTopic.slice(0, 4).map((topic) => <li key={topic.slug}>
                    <ProgressBar label={topic.title} value={topic.avgFirstAttemptScore} max={100} tone="reward" valueText={`${format.number(topic.avgFirstAttemptScore)}%`} />
                  </li>)}
                </ul>
              </> : null}
            </> : null}
    </Card> : null}
  </>;

  const secondary = <>
    <Card heading={t.heading.sections}>
      <ul className="lf-staff-links">
        {open.map((section) => <li key={section.id}>
          <a href={section.path} onClick={consoleLinkHandler(section.path, onNavigate)} className="lf-staff-link" data-console-section={section.id}>
            <span className="lf-staff-link-title" data-copy-role="action">{sections[section.id]}</span>
            <span className="lf-staff-link-body" data-copy-role="body">{t.body[section.id]}</span>
          </a>
        </li>)}
      </ul>
    </Card>
    {analytics ? <Card heading={t.heading.health}>
      {health.load.state === 'loading' ? <Loading />
        : health.load.state === 'error' ? <InlineNotice tone="error">{health.load.code === 'PULSE_UNCONFIGURED' ? t.body.healthUnconfigured : t.body.healthFailed}</InlineNotice>
          : health.load.state === 'ready' ? <>
            {health.load.data.monitors.length === 0 ? <p data-copy-role="body">{t.body.noMonitors}</p>
              : health.load.data.summary.down === 0 ? <InlineNotice tone="success">{t.body.allUp}</InlineNotice>
                : <InlineNotice tone="error">{fill(t.body.someDown, { n: format.number(health.load.data.summary.down) })}</InlineNotice>}
            {health.load.data.monitors.length ? <List label={t.heading.health}>
              {health.load.data.monitors.map((monitor) => <ListRow key={monitor.id} title={monitor.name} titleRole="data"
                trailing={monitor.status === 1 ? <Chip tone="success" glyph="check">{t.body.up}</Chip> : <Chip tone="error" glyph="cross">{t.body.down}</Chip>} />)}
            </List> : null}
          </> : null}
      <div><ConsoleLink href="/admin/analytics" onNavigate={onNavigate}>{t.action.details}</ConsoleLink></div>
    </Card> : null}
  </>;

  return <StaffPage screen="staff-overview" title={sections.overview} intro={t.body.intro}>
    <DashboardLayout primary={primary} secondary={secondary} />
  </StaffPage>;
}
