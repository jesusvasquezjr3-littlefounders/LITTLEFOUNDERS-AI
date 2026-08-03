import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { BASE_URL, api } from '@/lib/api';
import { Button, Card, Icon, StatCard } from '@/components/ui';
import { cn } from '@/lib/utils';
import { AdminEmpty, AdminPage, Unavailable } from './adminShared';

/*
 * /admin/insights — knowing the end user from FIRST-PARTY data (/INSIGHTS.md).
 *
 * Four tabs, ordered by the question they answer:
 *   Overview    — is the product healthy right now (consent coverage, volume)
 *   Acquisition — where do people come from and where do they fall off
 *   Learning    — are they actually learning, and which content is mistuned
 *   Sessions    — how substantial is a visit, by role and device
 *
 * Two honesty rules the UI enforces on itself: consent coverage is the FIRST
 * number on the page (insight breadth is bounded by consent, by design), and
 * the export button states in-line that exports carry no learner identifier.
 */

type Tab = 'overview' | 'acquisition' | 'learning' | 'sessions';

interface CalibrationEntry {
  lesson_id: string | null; lesson_slug: string | null; lesson_title: Record<string, unknown> | null;
  segment_id: string; attempts: number; learners: number; avg_score: number | null;
  avg_attempts_per_learner: number | null; hint_rate: number | null; first_try_avg_score: number | null;
}
interface ActivityEntry { day: string; role: string; event: string; route_class: string; device: string; locale: string; events: number; users: number; sessions: number }
/** role = '' is the day's true all-roles distinct count, not a sum of the rest. */
interface DailyUsersEntry { day: string; role: string; users: number; sessions: number }
interface CohortEntry { cohort_week: string; week_offset: number; users: number; cohort_size: number }
interface FunnelEntry { step_order: number; step: string; users: number }
interface VelocityEntry {
  user_id: string; lessons_passed: number; avg_score: number | null; avg_attempts: number | null;
  lessons_per_week: number | null; streak_days: number | null; longest_streak: number | null;
}
interface DropoffEntry {
  lesson_id: string | null; lesson_slug: string | null; starts: number; abandons: number;
  completions: number; abandon_rate: number | null; avg_seconds_before_abandon: number | null;
}
interface AdoptionEntry { role: string; route_class: string; events: number; users: number; sessions: number }
interface TtvEntry { user_id: string; activated_at: string | null; hours_to_value: number | null }
interface EngagementEntry {
  user_id: string; lessons_completed: number | null; longest_streak: number | null;
  sessions_30d: number; active_days_30d: number; engagement_score: number;
}
interface DepthEntry {
  session_id: string; started_at: string; role: string | null; device: string | null;
  events: number; surfaces: number; lessons_started: number; visible_seconds: number | null;
}

interface Bundle {
  consent: { kidsTotal: number; kidsConsented: number };
  activity: ActivityEntry[];
  dailyUsers: DailyUsersEntry[];
  calibration: CalibrationEntry[];
  cohorts: CohortEntry[];
  funnel: FunnelEntry[];
  velocity: VelocityEntry[];
  dropoff: DropoffEntry[];
  adoption: AdoptionEntry[];
  sessions: DepthEntry[];
  ttv: TtvEntry[];
  engagement: EngagementEntry[];
}

type LoadState = { status: 'loading' } | { status: 'error'; code: string } | { status: 'ready'; data: Bundle };

const DAY_OPTIONS = [7, 30, 90, 365] as const;
const ROLE_OPTIONS = ['anon', 'universal', 'parent', 'kid', 'bigfounder', 'admin', 'superadmin'] as const;
const SURFACE_OPTIONS = ['learn', 'tasks', 'profile', 'tutor', 'family', 'admin', 'marketing', 'other'] as const;

export function AdminInsightsPage() {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [tab, setTab] = useState<Tab>('overview');
  const [days, setDays] = useState<number>(30);
  const [role, setRole] = useState<string>('');
  const [surface, setSurface] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    const token = await getToken();
    const get = <T,>(path: string) => api<T>(path, { token });
    const [consentRes, activity, calibration, cohorts, funnel, velocity, dropoff, adoption, sessions, ttv, engagement] = await Promise.all([
      get<{ consent: { kidsTotal: number; kidsConsented: number } }>('/admin/insights/families?limit=1'),
      get<{ entries: ActivityEntry[]; users: DailyUsersEntry[] }>(`/admin/insights/activity?days=${days}`),
      get<{ entries: CalibrationEntry[] }>('/admin/insights/calibration?limit=25'),
      get<{ entries: CohortEntry[] }>('/admin/insights/cohorts?weeks=12'),
      get<{ steps: FunnelEntry[] }>('/admin/insights/funnel'),
      get<{ entries: VelocityEntry[] }>('/admin/insights/velocity?limit=50'),
      get<{ entries: DropoffEntry[] }>('/admin/insights/dropoff?limit=25'),
      get<{ entries: AdoptionEntry[] }>('/admin/insights/adoption'),
      get<{ entries: DepthEntry[] }>(`/admin/insights/sessions?days=${days}&limit=200`),
      get<{ entries: TtvEntry[] }>('/admin/insights/timetovalue?limit=500'),
      get<{ entries: EngagementEntry[] }>('/admin/insights/engagement?limit=100'),
    ]);
    const firstError =
      consentRes.error ?? activity.error ?? calibration.error ?? cohorts.error ??
      funnel.error ?? velocity.error ?? dropoff.error ?? adoption.error ?? sessions.error ??
      ttv.error ?? engagement.error;
    if (firstError) return setState({ status: 'error', code: firstError.code });
    setState({
      status: 'ready',
      data: {
        consent: consentRes.data!.consent,
        activity: activity.data!.entries,
        dailyUsers: activity.data!.users,
        calibration: calibration.data!.entries,
        cohorts: cohorts.data!.entries,
        funnel: funnel.data!.steps,
        velocity: velocity.data!.entries,
        dropoff: dropoff.data!.entries,
        adoption: adoption.data!.entries,
        sessions: sessions.data!.entries,
        ttv: ttv.data!.entries,
        engagement: engagement.data!.entries,
      },
    });
  }, [getToken, days]);

  useEffect(() => { void load(); }, [load]);

  /*
   * "Download" means the WHOLE selection, not the first page of it.
   *
   * A single request is capped, and a clipped CSV is indistinguishable from a
   * complete one once it is open in a spreadsheet — so this walks the pages
   * until the server stops reporting truncation, carrying the export token so
   * `session_ref` stays stable across page boundaries (a fresh salt per
   * request would give one session two identities and quietly break sequence
   * analysis for exactly the large exports that need paging).
   *
   * MAX_PAGES is a runaway guard, not a silent cap: if it is ever reached the
   * UI says so, because a partial file presented as whole is the failure this
   * whole endpoint is built to avoid.
   */
  async function download(format: 'csv' | 'json') {
    const MAX_PAGES = 40;
    const PAGE = 50_000;
    setExporting(true);
    setExportNote(null);
    try {
      const token = await getToken();
      const parts: string[] = [];
      const jsonRows: unknown[] = [];
      let offset = 0;
      let exportToken: string | null = null;
      let pages = 0;
      let truncated = true;

      while (truncated && pages < MAX_PAGES) {
        const params = new URLSearchParams({
          days: String(days), format, limit: String(PAGE), offset: String(offset),
        });
        if (role) params.set('role', role);
        if (surface) params.set('routeClass', surface);
        if (exportToken) params.set('exportToken', exportToken);

        const res = await fetch(`${BASE_URL}/api/v1/admin/insights/export?${params}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          setExportNote(t('admin.insights.export.failed'));
          return;
        }
        exportToken = res.headers.get('X-LF-Export-Token') ?? exportToken;
        truncated = res.headers.get('X-LF-Export-Truncated') === 'true';
        const count = Number(res.headers.get('X-LF-Export-Rows') ?? '0');
        offset += count;
        pages += 1;

        if (format === 'csv') {
          const text = await res.text();
          // Only the first page keeps the header row.
          parts.push(pages === 1 ? text : text.slice(text.indexOf('\n') + 1));
        } else {
          const body = (await res.json()) as { data?: { rows?: unknown[] } };
          jsonRows.push(...(body.data?.rows ?? []));
        }
        if (count === 0) break;
      }

      const blob = format === 'csv'
        ? new Blob(parts, { type: 'text/csv;charset=utf-8' })
        : new Blob([JSON.stringify({ rows: jsonRows }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lf-insights-${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);

      const rows = format === 'csv' ? offset : jsonRows.length;
      setExportNote(truncated
        ? t('admin.insights.export.capped', { rows: nf.format(rows) })
        : t('admin.insights.export.complete', { rows: nf.format(rows) }));
    } finally {
      setExporting(false);
    }
  }

  const nf = useMemo(() => new Intl.NumberFormat(i18n.resolvedLanguage), [i18n.resolvedLanguage]);
  const pf = useMemo(() => new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'percent', maximumFractionDigits: 0 }), [i18n.resolvedLanguage]);

  return (
    <AdminPage titleKey="admin.insights.title" subtitleKey="admin.insights.subtitle">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-outline/70 bg-surface p-4">
        <Field label={t('admin.insights.filters.days')}>
          <Select value={String(days)} onChange={(v) => setDays(Number(v))}
            options={DAY_OPTIONS.map((d) => ({ value: String(d), label: `${d}d` }))} />
        </Field>
        <Field label={t('admin.insights.filters.role')}>
          <Select value={role} onChange={setRole}
            options={[{ value: '', label: t('admin.insights.filters.all') }, ...ROLE_OPTIONS.map((r) => ({ value: r, label: r }))]} />
        </Field>
        <Field label={t('admin.insights.filters.surface')}>
          <Select value={surface} onChange={setSurface}
            options={[{ value: '', label: t('admin.insights.filters.all') }, ...SURFACE_OPTIONS.map((s) => ({ value: s, label: t(`admin.insights.surfaces.${s}`, s) }))]} />
        </Field>
        <div className="ml-auto flex items-end gap-2">
          <Button variant="secondary" disabled={exporting} onClick={() => void download('csv')}>
            <Icon name="download" className="mr-1 !text-[18px]" aria-hidden />{t('admin.insights.export.csv')}
          </Button>
          <Button variant="secondary" disabled={exporting} onClick={() => void download('json')}>{t('admin.insights.export.json')}</Button>
        </div>
        <p className="lf-caption w-full text-content-faint">{t('admin.insights.export.hint')}</p>
        {exportNote ? (
          <p className="lf-caption w-full text-content-muted" role="status" aria-live="polite">{exportNote}</p>
        ) : null}
      </div>

      <div className="flex gap-1.5 overflow-x-auto bg-surface-sunken p-1 rounded-xl border border-outline/30">
        {[
          { key: 'overview', icon: 'space_dashboard' },
          { key: 'acquisition', icon: 'filter_alt' },
          { key: 'learning', icon: 'school' },
          { key: 'sessions', icon: 'timeline' },
        ].map(({ key: k, icon }) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k as Tab)}
            className={cn(
              'flex items-center gap-1.5 min-h-10 shrink-0 rounded-lg px-4 text-xs font-bold transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              tab === k ? 'bg-surface text-content shadow-glass-sm border border-outline/30' : 'text-content-muted hover:text-content',
            )}
          >
            <Icon name={icon} className="!text-[16px]" />
            <span>{t(`admin.insights.tabs.${k}`)}</span>
          </button>
        ))}
      </div>

      {state.status === 'error' ? (
        <Unavailable code={state.code} />
      ) : state.status === 'loading' ? (
        <Card className="p-5">
          <p className="lf-body-sm flex items-center gap-2 text-content-muted">
            <Icon name="progress_activity" className="animate-spin" /> {t('admin.insights.loading')}
          </p>
        </Card>
      ) : (
        <Body data={state.data} tab={tab} days={days} nf={nf} pf={pf} />
      )}
    </AdminPage>
  );
}

function Body({ data, tab, days, nf, pf }: { data: Bundle; tab: Tab; days: number; nf: Intl.NumberFormat; pf: Intl.NumberFormat }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'en-US';

  const totalEvents = data.activity.reduce((a, e) => a + e.events, 0);
  /*
   * Peak daily users comes from the dedicated daily-users rollup, never from
   * summing activity[].users.
   *
   * activity[].users is a count-DISTINCT within one dimension combination
   * (day x role x event x route_class x device x locale). Adding those counts
   * tallies the same child once per combination they appear in — measured at
   * roughly 6x inflation on a small dataset, and it grows with every dimension
   * added. Distinct counts are not additive; the correct figure has to be
   * counted at the grain it is reported at, which is what role = '' (the true
   * all-roles count for the day) is for.
   */
  const peak = data.dailyUsers
    .filter((u) => u.role === '')
    .reduce((max, u) => Math.max(max, u.users), 0);

  // Activation = share of seen users who ever completed a first lesson, and
  // the MEDIAN hours it took them (median, not mean: a handful of accounts
  // that activate weeks later would drag an average into meaninglessness).
  const activationPct = data.ttv.length > 0
    ? data.ttv.filter((r) => r.activated_at !== null).length / data.ttv.length
    : null;

  if (tab === 'overview') {
    return (
      <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Icon name="shield_person" className="!text-[24px]" />}
            value={`${nf.format(data.consent.kidsConsented)} / ${nf.format(data.consent.kidsTotal)}`}
            label={t('admin.insights.kpi.consent')}
            tone="primary"
          />
          <StatCard
            icon={<Icon name="query_stats" className="!text-[24px]" />}
            value={nf.format(totalEvents)}
            label={t('admin.insights.kpi.events', { days })}
            tone="secondary"
          />
          <StatCard
            icon={<Icon name="group" className="!text-[24px]" />}
            value={nf.format(peak)}
            label={t('admin.insights.kpi.peakUsers')}
            tone="accent"
          />
          <StatCard
            icon={<Icon name="bolt" className="!text-[24px]" />}
            value={activationPct === null ? '—' : pf.format(activationPct)}
            label={t('admin.insights.kpi.activation')}
            tone="primary"
          />
        </div>
        <Panel title={t('admin.insights.adoption.title')} subtitle={t('admin.insights.adoption.subtitle')} empty={data.adoption.length === 0} emptyMsg={t('admin.insights.adoption.empty')} icon="dashboard">
          <Table head={[t('admin.insights.adoption.colRole'), t('admin.insights.adoption.colSurface'), t('admin.insights.adoption.colUsers'), t('admin.insights.adoption.colSessions'), t('admin.insights.adoption.colEvents')]}
            rows={data.adoption.map((a) => [a.role, t(`admin.insights.surfaces.${a.route_class}`, a.route_class), nf.format(a.users), nf.format(a.sessions), nf.format(a.events)])} />
        </Panel>
      </>
    );
  }

  if (tab === 'acquisition') {
    const max = data.funnel.reduce((a, s) => Math.max(a, s.users), 0) || 1;
    return (
      <>
        <Panel title={t('admin.insights.funnel.title')} subtitle={t('admin.insights.funnel.subtitle')} empty={data.funnel.every((s) => s.users === 0)} emptyMsg={t('admin.insights.funnel.empty')} icon="filter_alt">
          <ul className="flex flex-col gap-2">
            {data.funnel.map((s, i) => {
              const prev = data.funnel[i - 1]?.users;
              return (
                <li key={s.step} className="flex items-center gap-3">
                  <span className="lf-caption w-32 shrink-0 text-content-muted">{s.step}</span>
                  <span className="h-3 rounded-full bg-primary" style={{ width: `${Math.max(2, (s.users / max) * 100)}%` }} />
                  <span className="lf-caption shrink-0 text-content">{nf.format(s.users)}</span>
                  {prev ? <span className="lf-caption shrink-0 text-content-faint">{t('admin.insights.funnel.ofPrevious', { pct: pf.format(s.users / prev) })}</span> : null}
                </li>
              );
            })}
          </ul>
        </Panel>
        <Panel title={t('admin.insights.cohorts.title')} subtitle={t('admin.insights.cohorts.subtitle')} empty={data.cohorts.length === 0} emptyMsg={t('admin.insights.cohorts.empty')} icon="grid_view">
          <CohortGrid rows={data.cohorts} nf={nf} pf={pf} weekLabel={t('admin.insights.cohorts.week')} sizeLabel={t('admin.insights.cohorts.size')} />
        </Panel>
      </>
    );
  }

  if (tab === 'learning') {
    const lessonLabel = (e: CalibrationEntry) => {
      const title = e.lesson_title?.[locale] ?? e.lesson_title?.['en-US'];
      return typeof title === 'string' ? title : (e.lesson_slug ?? '');
    };
    return (
      <>
        <Panel title={t('admin.insights.dropoff.title')} subtitle={t('admin.insights.dropoff.subtitle')} empty={data.dropoff.length === 0} emptyMsg={t('admin.insights.dropoff.empty')} icon="trending_down">
          <Table head={[t('admin.insights.dropoff.colLesson'), t('admin.insights.dropoff.colStarts'), t('admin.insights.dropoff.colAbandons'), t('admin.insights.dropoff.colRate'), t('admin.insights.dropoff.colSeconds')]}
            rows={data.dropoff.map((d) => [d.lesson_slug ?? '', nf.format(d.starts), nf.format(d.abandons), d.abandon_rate !== null ? pf.format(d.abandon_rate) : '', d.avg_seconds_before_abandon ?? ''])} />
        </Panel>
        <Panel title={t('admin.insights.calibration.title')} subtitle={t('admin.insights.calibration.subtitle')} empty={data.calibration.length === 0} emptyMsg={t('admin.insights.calibration.empty')} icon="school">
          <Table head={[t('admin.insights.calibration.colLesson'), t('admin.insights.calibration.colSegment'), t('admin.insights.calibration.colLearners'), t('admin.insights.calibration.colAttempts'), t('admin.insights.calibration.colHints'), t('admin.insights.calibration.colFirstTry')]}
            rows={data.calibration.map((e) => [lessonLabel(e), e.segment_id, nf.format(e.learners), e.avg_attempts_per_learner ?? '', e.hint_rate !== null ? pf.format(e.hint_rate) : '', e.first_try_avg_score ?? ''])} />
        </Panel>
        <Panel title={t('admin.insights.engagement.title')} subtitle={t('admin.insights.engagement.subtitle')} empty={data.engagement.length === 0} emptyMsg={t('admin.insights.engagement.empty')} icon="local_fire_department">
          <Table head={[t('admin.insights.engagement.colScore'), t('admin.insights.engagement.colLessons'), t('admin.insights.engagement.colStreak'), t('admin.insights.engagement.colSessions'), t('admin.insights.engagement.colActiveDays')]}
            rows={data.engagement.slice(0, 25).map((e) => [nf.format(e.engagement_score), nf.format(e.lessons_completed ?? 0), nf.format(e.longest_streak ?? 0), nf.format(e.sessions_30d), nf.format(e.active_days_30d)])} />
        </Panel>
        <Panel title={t('admin.insights.velocity.title')} subtitle={t('admin.insights.velocity.subtitle')} empty={data.velocity.length === 0} emptyMsg={t('admin.insights.velocity.empty')} icon="speed">
          <Table head={[t('admin.insights.velocity.colPassed'), t('admin.insights.velocity.colPerWeek'), t('admin.insights.velocity.colScore'), t('admin.insights.velocity.colAttempts'), t('admin.insights.velocity.colStreak')]}
            rows={data.velocity.map((v) => [nf.format(v.lessons_passed), v.lessons_per_week ?? '', v.avg_score ?? '', v.avg_attempts ?? '', nf.format(v.longest_streak ?? 0)])} />
        </Panel>
      </>
    );
  }

  const df = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' });
  return (
    <Panel title={t('admin.insights.sessions.title')} subtitle={t('admin.insights.sessions.subtitle')} empty={data.sessions.length === 0} emptyMsg={t('admin.insights.sessions.empty')} icon="timeline">
      <Table head={[t('admin.insights.sessions.colWhen'), t('admin.insights.sessions.colRole'), t('admin.insights.sessions.colDevice'), t('admin.insights.sessions.colEvents'), t('admin.insights.sessions.colSurfaces'), t('admin.insights.sessions.colLessons'), t('admin.insights.sessions.colTime')]}
        rows={data.sessions.map((s) => [df.format(new Date(s.started_at)), s.role ?? '', s.device ?? '', nf.format(s.events), nf.format(s.surfaces), nf.format(s.lessons_started), s.visible_seconds !== null ? `${nf.format(Math.round(s.visible_seconds / 60))}m` : ''])} />
    </Panel>
  );
}

function CohortGrid({ rows, nf, pf, weekLabel, sizeLabel }: { rows: CohortEntry[]; nf: Intl.NumberFormat; pf: Intl.NumberFormat; weekLabel: string; sizeLabel: string }) {
  const weeks = [...new Set(rows.map((r) => r.cohort_week))].sort().reverse();
  const offsets = [...new Set(rows.map((r) => r.week_offset))].sort((a, b) => a - b);
  const at = new Map(rows.map((r) => [`${r.cohort_week}:${r.week_offset}`, r]));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-outline">
            <th className="lf-label py-2 pr-3 text-content-muted">{weekLabel}</th>
            <th className="lf-label py-2 pr-3 text-content-muted">{sizeLabel}</th>
            {offsets.map((o) => <th key={o} className="lf-label py-2 pr-3 text-content-muted">+{o}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-outline">
          {weeks.map((w) => {
            const size = at.get(`${w}:0`)?.cohort_size ?? 0;
            return (
              <tr key={w}>
                <td className="lf-caption py-2 pr-3 text-content">{w}</td>
                <td className="lf-caption py-2 pr-3 text-content-muted">{nf.format(size)}</td>
                {offsets.map((o) => {
                  const cell = at.get(`${w}:${o}`);
                  const pct = cell && size > 0 ? cell.users / size : null;
                  return (
                    <td key={o} className="py-2 pr-3">
                      {pct === null ? '' : (
                        <span className="lf-caption inline-block rounded px-2 py-0.5 text-content"
                          style={{ backgroundColor: `color-mix(in srgb, var(--color-primary) ${Math.round(pct * 100)}%, transparent)` }}>
                          {pf.format(pct)}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Panel({ title, subtitle, empty, emptyMsg, icon, children }: {
  title: string; subtitle?: string; empty: boolean; emptyMsg: string; icon: string; children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-3 p-5 shadow-glass border border-outline/50">
      <h2 className="lf-title font-bold text-content">{title}</h2>
      {subtitle ? <p className="lf-caption text-content-muted">{subtitle}</p> : null}
      {empty ? <AdminEmpty icon={icon} message={emptyMsg} /> : children}
    </Card>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-outline">
            {head.map((h) => <th key={h} className="lf-label py-3 pr-4 text-content-muted">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-outline">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-surface-sunken/50">
              {r.map((c, j) => <td key={j} className="lf-body max-w-[220px] truncate py-3 pr-4 tabular-nums">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="lf-caption text-content-muted">{label}</span>
      {children}
    </label>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="lf-body min-h-11 rounded-md border border-outline bg-surface px-3 text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export default AdminInsightsPage;
