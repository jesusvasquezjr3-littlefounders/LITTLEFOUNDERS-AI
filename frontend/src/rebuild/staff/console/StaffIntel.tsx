import { useEffect, useId, useMemo, useState } from 'react';
import {
  BarChart, Button, Card, Chip, DashboardLayout, DataTable, EmptyState, InlineNotice, SegmentedControl, SelectField, Sheet, TrendChart,
  type StatusTone, type TableColumn,
} from '../../design/controls';
import {
  churnBuckets, cohortGrid, cohortWeeks, customWindow, DELIVERY_WINDOW_DAYS, EXPORT_ROLES, GRANULARITIES, INTEL_PRESETS, INTEL_VIEWS, isAlertDelivery, isAlerts,
  isAnomalies, isChurn, isCohorts, isDisclosureCoverage, isExperiments, isFamilies, isFunnel, isIntelSummary, isLearnerDetail, isLearningOverview, isSkillHealth, isStaffExclusion, isTrend,
  isUserNames, rawExportPath, summaryDays, titleIn, TREND_METRICS, windowQuery,
  type Attention, type CourseHealth, type DeliveryStatus, type EvidenceStatus, type Granularity, type IntelView, type IntelWindow, type LearnerProfile, type LessonHealth,
  type TrendMetric,
} from './intelApi';
import { INSTRUMENTED_EVENTS } from './usageShared';
import { can, useStaffRead, type StaffApi, type StaffViewer } from './staffConsoleApi';
import { Facts, LoadFailure, Loading, Metrics, RangeSheet, saveDownload, shortId, StaffPage, today, useChartLabels, useDay, useFormats } from './ConsoleParts';
import { fill, labelOf, useConsoleCopy, type ConsoleCopy } from './staffConsoleCopy';
import { FamilyMetricsView } from './StaffProgramme';

/*
 * S6 Learning intel, with S8 Insights as one of its views (view_analytics),
 * W2T.3. Everything here is read from the warehouse through Core (read-only
 * for this grant: Core refuses any other method without manage_support) and
 * from Core's own insight views. One window drives every read; the file
 * exports carry the same window, so a file cannot describe another period.
 *
 *   Overview     daily, weekly and monthly users, events, week-1 retention,
 *                activation, the consent coverage (children, and H.1's teen
 *                and guest disclosure against its 100% target, Appendix O
 *                1.1), a trend whose metric and
 *                grain really change the read (the legacy selectors changed
 *                nothing), the activation funnel, who reaches what, and the
 *                unresolved anomalies.
 *   Insights     S8, reached from the navigation (G.5): learning evidence by
 *                course, lesson and learner, skill health, and the paged raw
 *                event export Core has served all along (no screen had
 *                offered it since the Insights page was folded in).
 *   Retention    weekly cohorts, and the family task insight (D.6) with its
 *                whole-population rate.
 *   People       churn risk, worst first, with no names (the legacy
 *                engagement ranking of learners is not rebuilt: DP-05).
 *   Experiments & alerts   what is configured, read-only, with each alert's
 *                latest delivery outcome and the month's delivery rate
 *                against its 100% target (H.3, Appendix O 1.3).
 *
 * H.1 and D.6: rates are the whole population's; per-child rows are only for
 * children the consent gate admits and carry no identity. G.6: nothing here
 * reads a Mentor transcript or a wallet. A learner is named only for a viewer
 * who holds manage_users; everyone else sees a short id.
 */

function useIntelFormats(locale: string) {
  return useMemo(() => {
    const share0 = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
    const share1 = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
    const signed = new Intl.NumberFormat(locale, { maximumFractionDigits: 1, signDisplay: 'exceptZero' });
    return {
      /** A score given as 0-100. */
      score: (value: number | null, missing: string) => (value === null ? missing : share0.format(value / 100)),
      /** A share given as 0-1. */
      share: (value: number | null, missing: string) => (value === null ? missing : share1.format(value)),
      signed: (value: number) => signed.format(value),
    };
  }, [locale]);
}

function evidenceChip(copy: ConsoleCopy, status: EvidenceStatus) {
  const tone: StatusTone = status === 'sufficient' ? 'success' : status === 'limited' ? 'warning' : 'sky';
  return <Chip tone={tone} glyph={status === 'sufficient' ? 'check' : 'info'}>{copy.intel.option[`evidence_${status}`]}</Chip>;
}
function attentionChip(copy: ConsoleCopy, status: Attention | string) {
  const label = labelOf(copy.intel.option as Record<string, string>, `attention_${status}`).replace(/^attention_/, '');
  if (status === 'review') return <Chip tone="error" glyph="warning">{label}</Chip>;
  if (status === 'monitor') return <Chip tone="warning" glyph="info">{label}</Chip>;
  if (status === 'healthy') return <Chip tone="success" glyph="check">{label}</Chip>;
  return <Chip tone="sky" glyph="info">{label}</Chip>;
}

/* ------------------------------------------------------------------------- */
/*  Window, disclosure and export (page level)                                */
/* ------------------------------------------------------------------------- */

function WindowControl({ span: current, onChange }: { span: IntelWindow; onChange: (span: IntelWindow) => void }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.intel;
  const [ranging, setRanging] = useState(false);
  const custom = Boolean(current.from && current.to);
  const initial = useMemo(() => ({ from: current.from ?? today(), to: current.to ?? today() }), [current.from, current.to]);
  return <div className="lf-staff-window">
    <SelectField label={t.body.period} value={custom ? 'custom' : String(current.days)} onChange={(event) => {
      if (event.target.value === 'custom') setRanging(true);
      else onChange({ days: Number(event.target.value) });
    }} options={[...INTEL_PRESETS.map((days) => ({ value: String(days), label: fill(t.option.lastDays, { n: String(days) }) })), { value: 'custom', label: copy.analytics.option.period_custom }]} />
    {custom ? <div className="lf-staff-result-row">
      <p data-copy-role="data">{fill(copy.common.body.range, { from: format.calendar(current.from!), to: format.calendar(current.to!) })}</p>
      <Button size="sm" onClick={() => setRanging(true)}>{copy.common.action.change}</Button>
    </div> : null}
    <RangeSheet open={ranging} initial={initial} onClose={() => setRanging(false)} onApply={(range) => { setRanging(false); onChange(customWindow(range.from, range.to)); }} />
  </div>;
}

function StaffExcluded({ api, span }: { api: StaffApi; span: IntelWindow }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.intel;
  const read = useStaffRead(api, `/admin/intel/quality/staff-exclusion?${windowQuery(span)}`, isStaffExclusion);
  if (read.load.state !== 'ready') return null;
  const { excludedEvents, excludedShare, staffUsers } = read.load.data;
  return <InlineNotice tone="info">
    {fill(t.body.staffExcluded, { n: format.number(excludedEvents), share: excludedShare === null ? format.percent(0) : format.percent(excludedShare), accounts: format.number(staffUsers) })}
  </InlineNotice>;
}

function ExportButtons({ api, span }: { api: StaffApi; span: IntelWindow }) {
  const { copy } = useConsoleCopy();
  const t = copy.intel;
  const [state, setState] = useState<{ busy: 'csv' | 'xlsx' | null; result: 'done' | 'failed' | null }>({ busy: null, result: null });
  if (!api.download) return null;
  const run = async (format: 'csv' | 'xlsx') => {
    setState({ busy: format, result: null });
    const result = await api.download!(`/admin/intel-export.${format}?${windowQuery(span)}`);
    if (result.ok) saveDownload(result.data.blob, `littlefounders-intel-${span.from && span.to ? `${span.from}_to_${span.to}` : `last-${span.days}d`}.${format}`);
    setState({ busy: null, result: result.ok ? 'done' : 'failed' });
  };
  return <div className="lf-staff-stack">
    <div className="lf-staff-actions">
      {(['csv', 'xlsx'] as const).map((format) => <Button key={format} size="sm" pending={state.busy === format} pendingLabel={copy.common.action.downloading}
        disabled={state.busy !== null} onClick={() => void run(format)}>{t.action[`export_${format}`]}</Button>)}
    </div>
    {state.result === 'done' ? <InlineNotice tone="success" live>{copy.analytics.body.downloaded}</InlineNotice> : null}
    {state.result === 'failed' ? <InlineNotice tone="error" live>{copy.analytics.body.downloadFailed}</InlineNotice> : null}
  </div>;
}

/** A rate against its target (Appendix O): the share, the target, and a verdict chip. */
function TargetValue({ value, target }: { value: number | null; target: number }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.intel;
  if (value === null) return <>{t.body.noData}</>;
  const met = value >= target;
  return <span className="lf-staff-inline">
    <span>{fill(t.body.againstTarget, { share: format.percent(value), target: format.percent(target) })}</span>
    {met ? <Chip tone="success" glyph="check">{t.option.status_met}</Chip> : <Chip tone="error" glyph="cross">{t.option.status_missed}</Chip>}
  </span>;
}

/* ------------------------------------------------------------------------- */
/*  Overview                                                                  */
/* ------------------------------------------------------------------------- */

function OverviewView({ api, span }: { api: StaffApi; span: IntelWindow }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const f = useIntelFormats(locale);
  const day = useDay(locale);
  const labels = useChartLabels();
  const t = copy.intel;
  const name = useId();
  const [metric, setMetric] = useState<TrendMetric>('dau');
  const [grain, setGrain] = useState<Granularity>('day');
  const days = summaryDays(span);
  const summary = useStaffRead(api, `/admin/intel/metrics/summary?days=${days}`, isIntelSummary);
  const families = useStaffRead(api, '/admin/insights/families?limit=100', isFamilies);
  const disclosure = useStaffRead(api, `/admin/analytics/consent-coverage?days=${Math.min(366, Math.max(1, span.days))}`, isDisclosureCoverage);
  const trend = useStaffRead(api, `/admin/intel/metrics/trends?metric=${metric}&granularity=${grain}&days=${days}`, isTrend);
  const funnel = useStaffRead(api, `/admin/intel/funnels/activation?${windowQuery(span)}`, isFunnel);
  const anomalies = useStaffRead(api, '/admin/intel/anomalies/active', isAnomalies);
  const data = summary.load.state === 'ready' ? summary.load.data : null;
  const adoption = useMemo(() => {
    if (!data) return [];
    const by = new Map<string, number>();
    for (const row of data.adoption) by.set(row.role, Math.max(by.get(row.role) ?? 0, row.users));
    return [...by].sort((a, b) => b[1] - a[1]);
  }, [data]);
  const open = anomalies.load.state === 'ready' ? anomalies.load.data.filter((a) => !a.resolved) : [];
  const metricLabel = t.option[`metric_${metric}`];

  const primary = <>
    {summary.load.state === 'loading' ? <Loading />
      : summary.load.state === 'error' ? <LoadFailure code={summary.load.code} onRetry={summary.reload} />
        : data ? <Metrics label={copy.intel.heading.summary} items={[
          { id: 'dau', label: t.body.dau, value: format.number(data.dau) },
          { id: 'wau', label: t.body.wau, value: format.number(data.wau) },
          { id: 'mau', label: t.body.mau, value: format.number(data.mau) },
          { id: 'events', label: t.body.events, value: format.number(data.totalEvents) },
          { id: 'week1', label: t.body.week1, value: f.score(data.week1Retention, t.body.noData) },
          { id: 'activation', label: t.body.activation, value: f.score(data.activationRate, t.body.noData) },
        ]} /> : null}
    <Card heading={t.heading.trend}>
      <div className="lf-staff-stack">
        <SegmentedControl legend={t.body.metric} name={`${name}-metric`} value={metric} onValueChange={setMetric}
          options={TREND_METRICS.map((value) => ({ value, label: t.option[`metric_${value}`] }))} />
        <SegmentedControl legend={t.body.grain} name={`${name}-grain`} value={grain} onValueChange={setGrain}
          options={GRANULARITIES.map((value) => ({ value, label: t.option[`grain_${value}`] }))} />
      </div>
      {trend.load.state === 'loading' ? <Loading />
        : trend.load.state === 'error' ? <LoadFailure code={trend.load.code} onRetry={trend.reload} />
          : trend.load.state === 'ready' && trend.load.data.length === 0 ? <p data-copy-role="body">{t.body.noData}</p>
            : trend.load.state === 'ready' ? <TrendChart label={fill(t.body.trendChart, { metric: metricLabel.toLocaleLowerCase(locale) })}
              summary={fill(t.body.trendSummary, { peak: format.number(Math.max(...trend.load.data.map((p) => p.value))), latest: format.number(trend.load.data[trend.load.data.length - 1]!.value) })}
              points={trend.load.data.map((point) => ({ key: point.date, label: day(point.date) }))}
              series={[{ id: metric, label: metricLabel, values: trend.load.data.map((point) => point.value) }]}
              format={format.number} labels={{ ...labels, point: t.body[`grainPoint_${grain}`] }} /> : null}
    </Card>
    <Card heading={t.heading.funnel}>
      {funnel.load.state === 'loading' ? <Loading />
        : funnel.load.state === 'error' ? <LoadFailure code={funnel.load.code} onRetry={funnel.reload} />
          : funnel.load.state === 'ready' && funnel.load.data.length === 0 ? <p data-copy-role="body">{t.body.noData}</p>
            : funnel.load.state === 'ready' ? <BarChart label={t.heading.funnel}
              max={Math.max(1, ...funnel.load.data.map((step) => step.users))}
              rows={[...funnel.load.data].sort((a, b) => a.stepOrder - b.stepOrder).map((step) => ({
                id: step.step, label: labelOf(t.option as Record<string, string>, `step_${step.step}`).replace(/^step_/, ''), value: step.users,
                valueText: step.conversionFromPrevious === null ? format.number(step.users)
                  : fill(t.body.stepValue, { n: format.number(step.users), share: f.score(step.conversionFromPrevious, t.body.noData) }),
              }))} /> : null}
    </Card>
    {anomalies.load.state === 'error' ? <LoadFailure code={anomalies.load.code} onRetry={anomalies.reload} />
      : open.length ? <DataTable caption={t.heading.anomalies} rows={open} rowKey={(a) => `${a.metric}:${a.date}`} columns={[
        { key: 'metric', label: t.body.metric, value: (a) => labelOf(t.option as Record<string, string>, `metric_${a.metric}`).replace(/^metric_/, '') },
        { key: 'date', label: t.body.date, value: (a) => format.calendar(a.date.slice(0, 10)) },
        { key: 'value', label: t.body.value, value: (a) => format.number(a.value) },
        { key: 'expected', label: t.body.expected, value: (a) => format.number(a.expected) },
        { key: 'deviation', label: t.body.deviation, value: (a) => fill(t.body.deviationValue, { n: f.signed(a.zScore) }) },
      ]} /> : null}
  </>;
  const secondary = <>
    <Card heading={t.heading.consent}>
      <p data-copy-role="body" className="lf-staff-muted">{t.body.consentIntro}</p>
      {families.load.state === 'loading' ? <Loading />
        : families.load.state === 'error' ? <LoadFailure code={families.load.code} onRetry={families.reload} />
          : families.load.state === 'ready' ? <Facts items={[
            { id: 'consented', label: t.body.consented, value: fill(t.body.ofTotal, { n: format.number(families.load.data.consent.kidsConsented), total: format.number(families.load.data.consent.kidsTotal) }) },
            { id: 'coverage', label: t.body.coverage, value: families.load.data.consent.kidsTotal > 0 ? format.percent(families.load.data.consent.kidsConsented / families.load.data.consent.kidsTotal) : t.body.noData },
          ]} /> : null}
    </Card>
    <Card heading={t.heading.disclosure}>
      <p data-copy-role="body" className="lf-staff-muted">{t.body.disclosureIntro}</p>
      {disclosure.load.state === 'loading' ? <Loading />
        : disclosure.load.state === 'error' ? <LoadFailure code={disclosure.load.code} onRetry={disclosure.reload} />
          : disclosure.load.state === 'ready' ? <Facts items={[
            { id: 'disclosureCovered', label: t.body.disclosureCovered, value: fill(t.body.ofTotal, { n: format.number(disclosure.load.data.covered), total: format.number(disclosure.load.data.population) }) },
            { id: 'disclosureCoverage', label: t.body.disclosureCoverage, value: <TargetValue value={disclosure.load.data.coverage} target={disclosure.load.data.target} /> },
            { id: 'teensActive', label: t.body.teensActive, value: format.number(disclosure.load.data.teens.active) },
            { id: 'guestsActive', label: t.body.guestsActive, value: format.number(disclosure.load.data.guests.active) },
            { id: 'measuredWithoutChoice', label: t.body.measuredWithoutChoice, value: format.number(disclosure.load.data.teens.measuredWithoutOptIn + disclosure.load.data.guests.measured) },
          ]} /> : null}
    </Card>
    {data ? <Card heading={t.heading.adoption}>
      {adoption.length === 0 ? <p data-copy-role="body">{t.body.noData}</p>
        : <BarChart label={t.heading.adoption} rows={adoption.map(([role, users]) => ({ id: role, label: labelOf(copy.roleNames.option, role), value: users, valueText: fill(t.body.people, { n: format.number(users) }) }))} />}
    </Card> : null}
  </>;
  return <DashboardLayout primary={primary} secondary={secondary} />;
}

/* ------------------------------------------------------------------------- */
/*  Insights (S8)                                                             */
/* ------------------------------------------------------------------------- */

type Directory = 'courses' | 'lessons' | 'learners';

function HealthSheet({ item, onClose }: { item: CourseHealth | LessonHealth; onClose: () => void }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const f = useIntelFormats(locale);
  const t = copy.intel;
  const lesson = 'lessonId' in item;
  const title = lesson ? titleIn(locale, { en: item.lessonTitleEn, es: item.lessonTitleEs, pt: item.lessonTitlePt, slug: item.lessonSlug })
    : titleIn(locale, { en: item.courseTitleEn, es: item.courseTitleEs, pt: item.courseTitlePt, slug: item.courseSlug });
  const none = t.body.noData;
  // The title is content, not copy: it goes in the facts as data, and the sheet keeps a budgeted heading (as Content's sheets do).
  return <Sheet open onClose={onClose} heading={lesson ? copy.content.heading.lesson : copy.content.heading.course} closeLabel={copy.common.action.close}>
    <div className="lf-staff-sheet" data-sheet={lesson ? 'lesson' : 'course'}>
      <div className="lf-staff-chips">{attentionChip(copy, item.attention)}{evidenceChip(copy, item.evidenceStatus)}</div>
      <p data-copy-role="body" className="lf-staff-muted">{t.body[`evidenceHint_${item.evidenceStatus}`]}</p>
      <Facts items={[
        { id: 'title', label: lesson ? t.body.lesson : t.body.course, value: title ?? (lesson ? t.body.untitledLesson : t.body.untitledCourse), ugc: true },
        { id: 'learners', label: t.body.learners, value: format.number(item.learners) },
        { id: 'attempts', label: t.body.attempts, value: format.number(item.attempts) },
        { id: 'score', label: t.body.averageScore, value: f.score(item.avgScore, none) },
        { id: 'firstTry', label: t.body.firstTry, value: f.score(item.firstTryAvgScore, none) },
        { id: 'hints', label: t.body.hintRate, value: f.share(item.hintRate, none) },
        { id: 'retry', label: t.body.retryRate, value: f.share(item.retryRate, none) },
        { id: 'starts', label: t.body.starts, value: format.number(item.starts) },
        { id: 'completions', label: t.body.completions, value: format.number(item.completions) },
        { id: 'abandon', label: t.body.abandonRate, value: f.score(item.abandonRate, none) },
        { id: 'time', label: t.body.timePerAttempt, value: item.avgSecondsPerAttempt === null ? none : fill(t.body.seconds, { n: format.number(Math.round(item.avgSecondsPerAttempt)) }) },
      ]} />
    </div>
  </Sheet>;
}

function LearnerSheet({ api, learner, name, span, onClose }: { api: StaffApi; learner: LearnerProfile; name: string; span: IntelWindow; onClose: () => void }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const f = useIntelFormats(locale);
  const day = useDay(locale);
  const labels = useChartLabels();
  const t = copy.intel;
  const detail = useStaffRead(api, `/admin/intel/learning/learners/${encodeURIComponent(learner.userId)}?days=${summaryDays(span)}&limit=100`, isLearnerDetail);
  const none = t.body.noData;
  return <Sheet open onClose={onClose} heading={name} closeLabel={copy.common.action.close}>
    <div className="lf-staff-sheet" data-sheet="learner">
      {detail.load.state === 'loading' ? <Loading />
        : detail.load.state === 'error' ? <LoadFailure code={detail.load.code} onRetry={detail.reload} />
          : detail.load.state === 'ready' && !detail.load.data.profile ? <p data-copy-role="body">{t.body.noLearnerEvidence}</p>
            : detail.load.state === 'ready' ? (() => {
              const profile = detail.load.data.profile!;
              return <>
                <div className="lf-staff-chips">
                  {profile.recommendedAction ? <Chip tone="primary" glyph="info">{t.option[`action_${profile.recommendedAction}`]}</Chip> : evidenceChip(copy, profile.evidenceStatus)}
                </div>
                <Facts items={[
                  { id: 'attempts', label: t.body.attempts, value: format.number(profile.attempts) },
                  { id: 'score', label: t.body.averageScore, value: f.score(profile.avgScore, none) },
                  { id: 'firstTry', label: t.body.firstTry, value: f.score(profile.firstTryAvgScore, none) },
                  { id: 'mastery', label: t.body.mastery, value: f.share(profile.avgMasteryProbability, none) },
                  { id: 'support', label: t.body.supportSkills, value: format.number(profile.skillsNeedingSupport) },
                  { id: 'hints', label: t.body.hintRate, value: f.share(profile.hintRate, none) },
                ]} />
                {detail.load.data.trends.length ? <TrendChart kind="columns" label={t.body.attemptsChart} summary={t.body.learnerChartSummary}
                  points={detail.load.data.trends.map((p) => ({ key: p.date, label: day(p.date) }))}
                  series={[{ id: 'attempts', label: t.body.attempts, values: detail.load.data.trends.map((p) => p.attempts) }]}
                  format={format.number} labels={labels} /> : null}
                {detail.load.data.states.length ? <DataTable caption={t.heading.skills} rows={detail.load.data.states} rowKey={(s) => s.skillKey} columns={[
                  { key: 'skill', label: t.body.skill, value: (s) => s.skillKey, ugc: true },
                  { key: 'mastery', label: t.body.mastery, value: (s) => f.share(s.masteryProbability, none) },
                  { key: 'next', label: t.body.recommendation, value: (s) => t.option[`action_${s.recommendedAction}`] ?? s.recommendedAction },
                ]} /> : null}
                {detail.load.data.courses.length ? <DataTable caption={t.heading.learnerCourses} rows={detail.load.data.courses} rowKey={(c) => c.courseId} columns={[
                  { key: 'course', label: t.body.course, value: (c) => titleIn(locale, { en: c.courseTitleEn, es: c.courseTitleEs, pt: c.courseTitlePt, slug: c.courseSlug }) ?? t.body.untitledCourse, ugc: true },
                  { key: 'score', label: t.body.averageScore, value: (c) => f.score(c.avgScore, none) },
                  { key: 'attempts', label: t.body.attempts, value: (c) => format.number(c.attempts) },
                ]} /> : null}
              </>;
            })() : null}
    </div>
  </Sheet>;
}

function RawExport({ api, span }: { api: StaffApi; span: IntelWindow }) {
  const { copy } = useConsoleCopy();
  const t = copy.intel;
  const name = useId();
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [role, setRole] = useState('');
  const [event, setEvent] = useState('');
  const [next, setNext] = useState<{ offset: number; token: string; part: number } | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');
  useEffect(() => { setNext(null); setState('idle'); }, [format, role, event, span]);
  if (!api.download) return null;
  const run = async (page: { offset: number; token: string | null; part: number }) => {
    setState('busy');
    const result = await api.download!(rawExportPath({ days: summaryDays(span), format, role, event, offset: page.offset, token: page.token }));
    if (!result.ok) { setState('failed'); return; }
    const headers = result.data.headers;
    saveDownload(result.data.blob, `lf-insights-${today()}${page.part > 1 ? `-part${page.part}` : ''}.${format}`);
    // Core declares a clipped file in its export headers (the host passes them on without their prefix).
    const offset = Number(headers['next-offset']);
    setNext(headers.truncated === 'true' && Number.isFinite(offset) && headers.token ? { offset, token: headers.token, part: page.part + 1 } : null);
    setState('done');
  };
  return <Card heading={t.heading.rawExport}>
    <p data-copy-role="body" className="lf-staff-muted">{t.body.rawExportIntro}</p>
    <SegmentedControl legend={copy.analytics.body.format} name={`${name}-format`} value={format} onValueChange={setFormat}
      options={[{ value: 'csv', label: copy.analytics.option.format_csv }, { value: 'json', label: t.option.format_json }]} />
    <div className="lf-staff-filters">
      <SelectField label={t.body.role} value={role} onChange={(e) => setRole(e.target.value)}
        options={[{ value: '', label: copy.roleNames.option.all }, ...EXPORT_ROLES.map((value) => ({ value, label: value === 'anon' ? t.option.anonymous : labelOf(copy.roleNames.option, value) }))]} />
      <SelectField label={t.body.event} value={event} onChange={(e) => setEvent(e.target.value)}
        options={[{ value: '', label: t.option.allEvents }, ...INSTRUMENTED_EVENTS.map((value) => ({ value, label: value, role: 'data' as const }))]} />
    </div>
    <div className="lf-staff-actions">
      <Button variant="brand" pending={state === 'busy'} pendingLabel={copy.common.action.downloading} onClick={() => void run({ offset: 0, token: null, part: 1 })}>
        {copy.analytics.action.download}
      </Button>
      {next ? <Button pending={state === 'busy'} pendingLabel={copy.common.action.downloading} onClick={() => void run(next)}>{t.action.nextPart}</Button> : null}
    </div>
    {state === 'done' ? <InlineNotice tone={next ? 'info' : 'success'} live>{next ? fill(t.body.truncated, { n: String(next.part) }) : t.body.rawComplete}</InlineNotice> : null}
    {state === 'failed' ? <InlineNotice tone="error" live>{copy.analytics.body.downloadFailed}</InlineNotice> : null}
    <p data-copy-role="body" className="lf-staff-muted">{t.body.rawAudited}</p>
  </Card>;
}

function InsightsView({ api, viewer, span }: { api: StaffApi; viewer: StaffViewer; span: IntelWindow }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const f = useIntelFormats(locale);
  const day = useDay(locale);
  const labels = useChartLabels();
  const t = copy.intel;
  const name = useId();
  const [directory, setDirectory] = useState<Directory>('courses');
  const [item, setItem] = useState<CourseHealth | LessonHealth | null>(null);
  const [learner, setLearner] = useState<LearnerProfile | null>(null);
  const overview = useStaffRead(api, `/admin/intel/learning/overview?limit=100&${windowQuery(span)}`, isLearningOverview);
  const skills = useStaffRead(api, `/admin/intel/learning/content-health?limit=50&${windowQuery(span)}`, isSkillHealth);
  // Names only with the grant that opens the people directory (Core refuses /admin/users without it).
  const names = useStaffRead(api, can(viewer, 'manage_users') ? '/admin/users' : null, isUserNames);
  const nameOf = useMemo(() => {
    const map = new Map(names.load.state === 'ready' ? names.load.data.users.map((user) => [user.userId, user.displayName]) : []);
    return (userId: string) => map.get(userId) ?? fill(t.body.learnerId, { id: shortId(userId) });
  }, [names.load, t]);
  const none = t.body.noData;

  if (overview.load.state === 'loading') return <Loading />;
  if (overview.load.state === 'error') return <LoadFailure code={overview.load.code} onRetry={overview.reload} />;
  if (overview.load.state !== 'ready') return null;
  const data = overview.load.data;
  const courseTitle = (c: CourseHealth) => titleIn(locale, { en: c.courseTitleEn, es: c.courseTitleEs, pt: c.courseTitlePt, slug: c.courseSlug }) ?? t.body.untitledCourse;
  const lessonTitle = (l: LessonHealth) => titleIn(locale, { en: l.lessonTitleEn, es: l.lessonTitleEs, pt: l.lessonTitlePt, slug: l.lessonSlug }) ?? t.body.untitledLesson;
  const open = (label: string, onPress: () => void) => <Button size="sm" aria-label={fill(t.action.openNamed, { name: label })} onClick={onPress}>{copy.common.action.open}</Button>;
  const courseColumns: TableColumn<CourseHealth>[] = [
    { key: 'course', label: t.body.course, value: (c) => courseTitle(c), ugc: true },
    { key: 'attention', label: t.body.attention, value: (c) => attentionChip(copy, c.attention) },
    { key: 'learners', label: t.body.learners, value: (c) => format.number(c.learners) },
    { key: 'score', label: t.body.averageScore, value: (c) => f.score(c.avgScore, none) },
    { key: 'open', label: copy.common.body.details, value: (c) => open(courseTitle(c), () => setItem(c)) },
  ];
  const lessonColumns: TableColumn<LessonHealth>[] = [
    { key: 'lesson', label: t.body.lesson, value: (l) => lessonTitle(l), ugc: true },
    { key: 'course', label: t.body.course, value: (l) => courseTitle(l), ugc: true },
    { key: 'attention', label: t.body.attention, value: (l) => attentionChip(copy, l.attention) },
    { key: 'firstTry', label: t.body.firstTry, value: (l) => f.score(l.firstTryAvgScore, none) },
    { key: 'open', label: copy.common.body.details, value: (l) => open(lessonTitle(l), () => setItem(l)) },
  ];
  const learnerColumns: TableColumn<LearnerProfile>[] = [
    { key: 'learner', label: t.body.learner, value: (l) => nameOf(l.userId), ugc: true },
    { key: 'next', label: t.body.recommendation, value: (l) => (l.recommendedAction ? t.option[`action_${l.recommendedAction}`] : evidenceChip(copy, l.evidenceStatus)) },
    { key: 'mastery', label: t.body.mastery, value: (l) => f.share(l.avgMasteryProbability, none) },
    { key: 'support', label: t.body.supportSkills, value: (l) => format.number(l.skillsNeedingSupport) },
    { key: 'open', label: copy.common.body.details, value: (l) => open(nameOf(l.userId), () => setLearner(l)) },
  ];

  const primary = <>
    <Metrics label={t.heading.evidence} items={[
      { id: 'courses', label: t.body.courses, value: format.number(data.snapshot.courses) },
      { id: 'lessons', label: t.body.lessons, value: format.number(data.snapshot.lessons) },
      { id: 'attempts', label: t.body.attempts, value: format.number(data.snapshot.attempts) },
      { id: 'learners', label: t.body.learners, value: format.number(data.snapshot.learners) },
    ]} />
    <Card heading={t.heading.pulse}>
      <div className="lf-staff-chips">{evidenceChip(copy, data.snapshot.evidenceStatus)}</div>
      <p data-copy-role="body" className="lf-staff-muted">{t.body[`evidenceHint_${data.snapshot.evidenceStatus}`]}</p>
      {data.trends.length === 0 ? <p data-copy-role="body">{t.body.noData}</p>
        : <TrendChart kind="columns" label={t.body.attemptsChart} summary={fill(t.body.pulseSummary, { n: format.number(data.snapshot.attempts), learners: format.number(data.snapshot.learners) })}
          points={data.trends.map((p) => ({ key: p.date, label: day(p.date) }))}
          series={[{ id: 'attempts', label: t.body.attempts, values: data.trends.map((p) => p.attempts) }]} format={format.number} labels={labels} />}
    </Card>
  </>;
  const secondary = <>
    <Card heading={t.heading.readiness}>
      <Facts items={[
        { id: 'score', label: t.body.averageScore, value: f.score(data.snapshot.avgScore, none) },
        { id: 'firstTry', label: t.body.firstTry, value: f.score(data.snapshot.firstTryAvgScore, none) },
        { id: 'hints', label: t.body.hintRate, value: f.share(data.snapshot.hintRate, none) },
        { id: 'retry', label: t.body.retryRate, value: f.share(data.snapshot.retryRate, none) },
      ]} />
    </Card>
    <Card heading={t.heading.skillHealth}>
      {skills.load.state === 'loading' ? <Loading />
        : skills.load.state === 'error' ? <LoadFailure code={skills.load.code} onRetry={skills.reload} />
          : skills.load.state === 'ready' && skills.load.data.skills.length === 0 ? <p data-copy-role="body">{t.body.noEvidence}</p>
            : skills.load.state === 'ready' ? <BarChart label={t.heading.skillHealth} max={1} rows={skills.load.data.skills.slice(0, 12).map((s) => ({
              id: s.skillKey, label: s.skillKey, ugc: true, value: s.avgMasteryProbability,
              valueText: `${f.share(s.avgMasteryProbability, none)} · ${labelOf(t.option as Record<string, string>, `priority_${s.priority}`).replace(/^priority_/, '')}`,
            }))} /> : null}
    </Card>
    <RawExport api={api} span={span} />
  </>;
  return <>
    <DashboardLayout primary={primary} secondary={secondary} />
    <section className="lf-staff-section" aria-labelledby="staff-intel-directory">
      <h2 id="staff-intel-directory" data-copy-role="heading">{t.heading.directory}</h2>
      <SegmentedControl legend={t.body.show} name={`${name}-directory`} value={directory} onValueChange={setDirectory}
        options={(['courses', 'lessons', 'learners'] as const).map((value) => ({ value, label: t.option[`directory_${value}`] }))} />
      {directory === 'courses' ? (data.courses.length ? <DataTable caption={t.option.directory_courses} columns={courseColumns} rows={data.courses} rowKey={(c) => c.courseId} />
        : <EmptyState heading={t.body.noEvidence} />)
        : directory === 'lessons' ? (data.lessons.length ? <DataTable caption={t.option.directory_lessons} columns={lessonColumns} rows={data.lessons} rowKey={(l) => l.lessonId} />
          : <EmptyState heading={t.body.noEvidence} />)
          : data.learners.length ? <>
            {can(viewer, 'manage_users') ? null : <InlineNotice tone="info">{t.body.namesNeedGrant}</InlineNotice>}
            <DataTable caption={t.option.directory_learners} columns={learnerColumns} rows={data.learners} rowKey={(l) => l.userId} />
          </> : <EmptyState heading={t.body.noEvidence} />}
    </section>
    {item ? <HealthSheet item={item} onClose={() => setItem(null)} /> : null}
    {learner ? <LearnerSheet api={api} learner={learner} name={nameOf(learner.userId)} span={span} onClose={() => setLearner(null)} /> : null}
  </>;
}

/* ------------------------------------------------------------------------- */
/*  Retention                                                                 */
/* ------------------------------------------------------------------------- */

function RetentionView({ api, span }: { api: StaffApi; span: IntelWindow }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const labels = useChartLabels();
  const t = copy.intel;
  const cohorts = useStaffRead(api, `/admin/intel/retention/cohorts?weeks=${cohortWeeks(span)}`, isCohorts);
  const families = useStaffRead(api, '/admin/insights/families?limit=100', isFamilies);
  const grid = useMemo(() => (cohorts.load.state === 'ready' ? cohortGrid(cohorts.load.data) : null), [cohorts.load]);
  const week = (offset: number) => fill(t.body.weekN, { n: String(offset) });
  const primary = <Card heading={t.heading.cohorts}>
    {cohorts.load.state === 'loading' ? <Loading />
      : cohorts.load.state === 'error' ? <LoadFailure code={cohorts.load.code} onRetry={cohorts.reload} />
        : !grid || grid.rows.length === 0 ? <p data-copy-role="body">{t.body.noData}</p> : <>
          <TrendChart label={t.body.cohortChart} summary={t.body.cohortSummary}
            points={grid.weeks.map((offset) => ({ key: String(offset), label: week(offset) }))}
            series={[...grid.rows].sort((a, b) => b.shares.filter((share) => share !== null).length - a.shares.filter((share) => share !== null).length).slice(0, 3).map((row) => ({ id: row.cohort, label: fill(t.body.cohortOf, { date: format.calendar(row.cohort.slice(0, 10)) }), values: row.shares }))}
            format={format.percent} labels={{ ...labels, point: t.body.week }} />
        </>}
  </Card>;
  const secondary = <Card heading={t.heading.familyTasks}>
    <p data-copy-role="body" className="lf-staff-muted">{t.body.familyTasksIntro}</p>
    {families.load.state === 'loading' ? <Loading />
      : families.load.state === 'error' ? <LoadFailure code={families.load.code} onRetry={families.reload} />
        : families.load.state === 'ready' ? (() => {
          const { summary, children } = families.load.data;
          const rows = [...children].sort((a, b) => b.tasks_created - a.tasks_created).slice(0, 25);
          return <>
            <Metrics label={t.heading.familyTasks} items={[
              { id: 'approval', label: t.body.approvalRate, value: summary.tasks_created > 0 ? format.percent(summary.tasks_approved / summary.tasks_created) : t.body.noData },
              { id: 'children', label: t.body.childrenLinked, value: format.number(summary.children) },
              { id: 'withTasks', label: t.body.childrenWithTasks, value: format.number(summary.children_with_tasks) },
              { id: 'active', label: t.body.childrenActive, value: format.number(summary.active_children) },
            ]} />
            <InlineNotice tone="info">{fill(t.body.listedOnly, { n: format.number(summary.listed_children) })}</InlineNotice>
            {rows.length ? <DataTable caption={t.heading.familyRows} rows={rows} rowKey={(row) => `${row.first_link_on}:${rows.indexOf(row)}`} columns={[
              { key: 'guardians', label: t.body.guardians, value: (row) => format.number(row.guardians) },
              { key: 'assigned', label: t.body.tasksAssigned, value: (row) => format.number(row.tasks_created) },
              { key: 'approved', label: t.body.tasksApproved, value: (row) => format.number(row.tasks_approved) },
              { key: 'last', label: t.body.lastTask, value: (row) => (row.last_task_on ? format.calendar(row.last_task_on) : t.body.noData) },
            ]} /> : <p data-copy-role="body">{t.body.noListed}</p>}
          </>;
        })() : null}
  </Card>;
  return <>
    <DashboardLayout primary={primary} secondary={secondary} />
    {grid && grid.rows.length ? <>
      <DataTable caption={t.heading.cohortTable} rows={grid.rows} rowKey={(row) => row.cohort} columns={[
            { key: 'cohort', label: t.body.cohort, value: (row) => format.calendar(row.cohort.slice(0, 10)) },
            { key: 'size', label: t.body.cohortSize, value: (row) => format.number(row.size) },
            ...grid.weeks.map((offset, index) => ({ key: `w${offset}`, label: week(offset), value: (row: (typeof grid.rows)[number]) => (row.shares[index] === null ? t.body.noData : format.percent(row.shares[index]!)) })),
      ]} />
    </> : null}
  </>;
}

/* ------------------------------------------------------------------------- */
/*  People                                                                    */
/* ------------------------------------------------------------------------- */

function PeopleView({ api, span }: { api: StaffApi; span: IntelWindow }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.intel;
  const churn = useStaffRead(api, `/admin/intel/churn/risk?limit=100&${windowQuery(span)}`, isChurn);
  const level = (value: string) => labelOf(t.option as Record<string, string>, `churn_${value}`).replace(/^churn_/, '');
  const levelChip = (value: string) => (value === 'high' ? <Chip tone="error" glyph="warning">{level(value)}</Chip>
    : value === 'medium' ? <Chip tone="warning" glyph="info">{level(value)}</Chip>
      : value === 'active' ? <Chip tone="success" glyph="check">{level(value)}</Chip> : <Chip tone="sky" glyph="info">{level(value)}</Chip>);
  if (churn.load.state === 'loading') return <Loading />;
  if (churn.load.state === 'error') return <LoadFailure code={churn.load.code} onRetry={churn.reload} />;
  if (churn.load.state !== 'ready') return null;
  const rows = churn.load.data;
  if (rows.length === 0) return <EmptyState heading={t.body.noChurn} />;
  // Risk first, for triage. The legacy engagement ranking of learners is not rebuilt (DP-05: no ranking of learners).
  const primary = <DataTable caption={t.heading.churnRows} rows={[...rows].sort((a, b) => b.risk_score - a.risk_score).slice(0, 25)} rowKey={(r) => r.user_id} columns={[
    { key: 'risk', label: t.body.risk, value: (r) => levelChip(r.risk_level) },
    { key: 'last', label: t.body.lastActive, value: (r) => format.date(r.last_event_at, t.body.noData) },
    { key: 'lessons', label: t.body.lessonsDone, value: (r) => format.number(r.lessons_completed) },
    { key: 'score', label: t.body.riskScore, value: (r) => format.number(r.risk_score) },
  ]} />;
  const secondary = <Card heading={t.heading.churn}>
    <p data-copy-role="body" className="lf-staff-muted">{t.body.peopleIntro}</p>
    <BarChart label={t.heading.churn} max={rows.length} rows={churnBuckets(rows).map((bucket) => ({
      id: bucket.level, label: level(bucket.level), value: bucket.count,
      valueText: `${format.number(bucket.count)} · ${format.percent(bucket.count / rows.length)}`,
    }))} />
  </Card>;
  return <DashboardLayout primary={primary} secondary={secondary} />;
}

/* ------------------------------------------------------------------------- */
/*  Experiments and alerts                                                    */
/* ------------------------------------------------------------------------- */

function OperationsView({ api }: { api: StaffApi }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.intel;
  const experiments = useStaffRead(api, '/admin/intel/experiments', isExperiments);
  const alerts = useStaffRead(api, '/admin/intel/alerts', isAlerts);
  const delivery = useStaffRead(api, `/admin/intel/alerts/delivery?days=${DELIVERY_WINDOW_DAYS}`, isAlertDelivery);
  const deliveryChip = (value: DeliveryStatus | null | undefined) => {
    if (!value) return <>{t.body.noDelivery}</>;
    const label = t.option[`delivery_${value}`];
    return value === 'delivered' ? <Chip tone="success" glyph="check">{label}</Chip>
      : value === 'failed' ? <Chip tone="error" glyph="cross">{label}</Chip>
        : <Chip tone="warning" glyph="info">{label}</Chip>;
  };
  const status = (value: string) => labelOf(t.option as Record<string, string>, `status_${value}`).replace(/^status_/, '');
  const statusChip = (value: string) => (value === 'running' || value === 'active' ? <Chip tone="success" glyph="check">{status(value)}</Chip>
    : <Chip tone="sky" glyph="info">{status(value)}</Chip>);
  return <div className="lf-staff-section">
    <InlineNotice tone="info">{t.body.readOnly}</InlineNotice>
    <Card heading={t.heading.delivery}>
      <p data-copy-role="body" className="lf-staff-muted">{fill(t.body.deliveryIntro, { n: format.number(DELIVERY_WINDOW_DAYS) })}</p>
      {delivery.load.state === 'loading' ? <Loading />
        : delivery.load.state === 'error' ? <LoadFailure code={delivery.load.code} onRetry={delivery.reload} />
          : delivery.load.state === 'ready' ? <Facts items={[
            { id: 'delivered', label: t.body.delivered, value: fill(t.body.ofTotal, { n: format.number(delivery.load.data.delivered), total: format.number(delivery.load.data.triggered) }) },
            { id: 'deliveryRate', label: t.body.deliveryRate, value: <TargetValue value={delivery.load.data.rate} target={delivery.load.data.target} /> },
            { id: 'deliveryFailed', label: t.body.deliveryFailed, value: format.number(delivery.load.data.failed) },
            { id: 'deliveryUnconfigured', label: t.body.deliveryUnconfigured, value: format.number(delivery.load.data.unconfigured) },
            { id: 'deliveryPending', label: t.body.deliveryPending, value: format.number(delivery.load.data.pending) },
          ]} /> : null}
    </Card>
    <div className="lf-staff-pair">
      <section className="lf-staff-section" aria-label={t.heading.experiments}>
        {experiments.load.state === 'loading' ? <Loading />
          : experiments.load.state === 'error' ? <LoadFailure code={experiments.load.code} onRetry={experiments.reload} />
            : experiments.load.state === 'ready' && experiments.load.data.length === 0 ? <EmptyState heading={t.body.noExperiments} body={t.body.noExperimentsBody} />
              : experiments.load.state === 'ready' ? <DataTable caption={t.heading.experiments} rows={experiments.load.data} rowKey={(e) => e.id} columns={[
                { key: 'name', label: t.body.name, value: (e) => e.name, ugc: true },
                { key: 'status', label: t.body.status, value: (e) => statusChip(e.status) },
                { key: 'metric', label: t.body.metric, value: (e) => labelOf(t.option as Record<string, string>, `metric_${e.metric}`).replace(/^metric_/, '') },
                { key: 'control', label: t.body.control, value: (e) => e.variantA, ugc: true },
                { key: 'variant', label: t.body.variant, value: (e) => e.variantB, ugc: true },
              ]} /> : null}
      </section>
      <section className="lf-staff-section" aria-label={t.heading.alerts}>
        {alerts.load.state === 'loading' ? <Loading />
          : alerts.load.state === 'error' ? <LoadFailure code={alerts.load.code} onRetry={alerts.reload} />
            : alerts.load.state === 'ready' && alerts.load.data.length === 0 ? <EmptyState heading={t.body.noAlerts} body={t.body.noAlertsBody} />
              : alerts.load.state === 'ready' ? <DataTable caption={t.heading.alerts} rows={alerts.load.data} rowKey={(a) => a.id} columns={[
                { key: 'name', label: t.body.name, value: (a) => a.name, ugc: true },
                { key: 'rule', label: t.body.rule, value: (a) => fill(t.body[`condition_${a.condition === 'above' || a.condition === 'below' ? a.condition : 'change'}`], {
                  metric: labelOf(t.option as Record<string, string>, `metric_${a.metric}`).replace(/^metric_/, ''), n: format.number(a.threshold) }) },
                { key: 'channel', label: t.body.channel, value: (a) => labelOf(t.option as Record<string, string>, `channel_${a.channel}`).replace(/^channel_/, '') },
                { key: 'status', label: t.body.status, value: (a) => statusChip(a.status) },
                { key: 'last', label: t.body.lastTriggered, value: (a) => format.dateTime(a.lastTriggeredAt ?? null, t.body.never) },
                { key: 'delivery', label: t.body.lastDelivery, value: (a) => deliveryChip(a.lastDeliveryStatus) },
                { key: 'reason', label: t.body.deliveryReason, value: (a) => a.lastDeliveryError ?? t.body.noReason, ugc: true },
              ]} /> : null}
      </section>
    </div>
  </div>;
}

/* ------------------------------------------------------------------------- */
/*  Page                                                                      */
/* ------------------------------------------------------------------------- */

export function StaffIntel({ api, viewer, initialView = 'overview' }: { api: StaffApi; viewer: StaffViewer; initialView?: IntelView }) {
  const { copy, sections } = useConsoleCopy();
  const t = copy.intel;
  const name = useId();
  const [view, setView] = useState<IntelView>(initialView);
  const [span, setSpan] = useState<IntelWindow>({ days: 30 });
  const [generation, setGeneration] = useState(0);
  useEffect(() => { setView(initialView); }, [initialView]);
  return <StaffPage screen="staff-intel" title={sections.intel}
    actions={<Button size="sm" onClick={() => setGeneration((value) => value + 1)}>{copy.common.action.refresh}</Button>}>
    <div className="lf-staff-controls">
      <SegmentedControl legend={t.body.view} name={`${name}-view`} value={view} onValueChange={setView} className="lf-staff-views"
        options={INTEL_VIEWS.map((value) => ({ value, label: t.option[`view_${value}`] }))} />
      {view === 'operations' ? null : <WindowControl span={span} onChange={setSpan} />}
    </div>
    <StaffExcluded key={`x:${generation}`} api={api} span={span} />
    <div key={`${view}:${generation}:${windowQuery(span)}`} className="lf-staff-section" data-view={view}>
      {view === 'overview' ? <OverviewView api={api} span={span} />
        : view === 'insights' ? <InsightsView api={api} viewer={viewer} span={span} />
          : view === 'retention' ? <RetentionView api={api} span={span} />
            : view === 'people' ? <PeopleView api={api} span={span} />
              : view === 'families' ? <FamilyMetricsView api={api} days={summaryDays(span)} />
                : <OperationsView api={api} />}
    </div>
    {view === 'operations' || view === 'families' ? null : <section className="lf-staff-section" aria-labelledby="staff-intel-export">
      <h2 id="staff-intel-export" data-copy-role="heading">{t.heading.export}</h2>
      <p data-copy-role="body" className="lf-staff-muted">{t.body.exportIntro}</p>
      <ExportButtons api={api} span={span} />
    </section>}
  </StaffPage>;
}
