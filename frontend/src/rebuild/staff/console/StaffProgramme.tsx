import { useMemo, useState } from 'react';
import { Button, Card, Chip, ConfirmDialog, DataTable, InlineNotice, SelectField } from '../../design/controls';
import {
  identityPath, isIdentityReport, isOpsJobs, isRetentionSweep, isStaffAccount, metricGuard, onTarget, OPS_JOBS_PATH, OWNERS_PATH, readField,
  RETENTION_SWEEP_PATH, TRUST_METRICS, undeliveredAlertsOf,
  type IdentityMetric, type MetricField, type MetricSpec,
} from './programmeApi';
import { isUsers, useStaffRead, type StaffApi } from './staffConsoleApi';
import { Facts, LoadFailure, Loading, shortId, useFormats } from './ConsoleParts';
import { fill, labelOf, useConsoleCopy, type ConsoleCopy } from './staffConsoleCopy';
import { OWNER_ROLES, type MentorQualityDashboardData, type OwnerRole } from '../mentorQualityApi';

/*
 * Staff surfaces over Core's programme reads:
 *
 *   Trust (Analytics & Health, view_analytics)  the social,
 *     and deletion metrics, and the identity
 *     metrics.
 *   Support tools (Reports, manage_support)    the Mentor retention sweep's
 *     health and the operations watchdog.
 *   Named owners (Mentor quality, manage_users) the owner roster.
 *
 * Core refuses every read and write without the grant; these screens only
 * decide what to ask for.
 */

type Formats = ReturnType<typeof useFormats>;

function formatField(field: MetricField, value: unknown, copy: ConsoleCopy, format: Formats): string {
  const t = copy.programme;
  if (value === null || value === undefined) return field.kind === 'date' ? t.body.never : t.body.noData;
  switch (field.kind) {
    case 'rate': return format.percent(value as number);
    case 'decimal': case 'count': return format.number(value as number);
    case 'hours': return fill(t.body.hours, { n: format.number(value as number) });
    case 'length': return format.number((value as unknown[]).length);
    case 'flag': return value ? t.option.yes : t.option.no;
    case 'date': return format.dateTime(value as string, t.body.never);
  }
}

const optionLabel = (copy: ConsoleCopy, key: string) => labelOf(copy.programme.option as Record<string, string>, key);

function TargetChip({ spec, value }: { spec: MetricSpec; value: unknown }) {
  const { copy } = useConsoleCopy();
  const met = onTarget(spec, value);
  if (met === null) return spec.target ? <Chip tone="sky" glyph="info">{copy.programme.option.noTargetData}</Chip> : <Chip tone="sky" glyph="info">{copy.programme.option.diagnostic}</Chip>;
  return met ? <Chip tone="success" glyph="check">{copy.programme.option.onTarget}</Chip> : <Chip tone="warning" glyph="warning">{copy.programme.option.offTarget}</Chip>;
}

/** One described metric: its heading, what it measures, the headline against its target and the supporting figures. */
export function MetricCard({ api, spec, days }: { api: StaffApi; spec: MetricSpec; days: number }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.programme;
  const guard = useMemo(() => metricGuard(spec), [spec]);
  const read = useStaffRead(api, spec.path(days), guard);
  const heading = labelOf(t.heading as Record<string, string>, spec.id);
  const data = read.load.state === 'ready' ? read.load.data : null;
  return <Card heading={heading} headingLevel={3}>
    <div className="lf-staff-section" data-metric-card={spec.id}>
      <p data-copy-role="body" className="lf-staff-muted">{labelOf(t.body as Record<string, string>, spec.id)}</p>
      {read.load.state === 'loading' ? <Loading />
        : read.load.state === 'error' ? <LoadFailure code={read.load.code} onRetry={read.reload} />
          : data ? <>
            <div><TargetChip spec={spec} value={spec.headline ? readField(data, spec.headline) : undefined} /></div>
            <Facts items={[...(spec.headline ? [spec.headline] : []), ...spec.facts].map((field) => ({
              id: field.key, label: optionLabel(copy, field.key), value: formatField(field, readField(data, field), copy, format),
            }))} />
          </> : null}
    </div>
  </Card>;
}

/** Analytics & Health → Trust: the trust metrics and the identity metrics. */
export function TrustMetricsView({ api, days }: { api: StaffApi; days: number }) {
  return <div className="lf-staff-section">
    <IdentityMetricsCard api={api} days={days} />
    <div className="lf-staff-pair">
      {TRUST_METRICS.map((spec) => <MetricCard key={spec.id} api={api} spec={spec} days={days} />)}
    </div>
  </div>;
}

function IdentityStatusChip({ metric }: { metric: IdentityMetric }) {
  const { copy } = useConsoleCopy();
  const t = copy.identity.option;
  if (metric.status === 'met') return <Chip tone="success" glyph="check">{t.met}</Chip>;
  if (metric.status === 'missed') return <Chip tone="warning" glyph="warning">{t.missed}</Chip>;
  if (metric.status === 'no_data') return <Chip tone="sky" glyph="info">{t.no_data}</Chip>;
  return <Chip tone="sky" glyph="info">{t.diagnostic}</Chip>;
}

/**
 * Each acquisition and identity metric, marked
 * as a release-gate target (held to 100%) or a diagnostic (a trend), with
 * the counts behind it. The adversarial metrics are listed as the tests that
 * prove them every release, never as a rate.
 */
export function IdentityMetricsCard({ api, days }: { api: StaffApi; days: number }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.identity;
  const read = useStaffRead(api, identityPath(days), isIdentityReport);
  const label = (id: string) => labelOf(t.option as Record<string, string>, id);
  const data = read.load.state === 'ready' ? read.load.data : null;
  return <Card heading={t.heading.title} headingLevel={3}>
    <div className="lf-staff-section" data-metric-card="identity">
      <p data-copy-role="body" className="lf-staff-muted">{t.body.intro}</p>
      {read.load.state === 'loading' ? <Loading />
        : read.load.state === 'error' ? <LoadFailure code={read.load.code} onRetry={read.reload} />
          : data ? <>
            {data.releaseGate.missed > 0
              ? <InlineNotice tone="error">{fill(t.body.gatesMissed, { n: format.number(data.releaseGate.missed) })}</InlineNotice>
              : <InlineNotice tone="success">{fill(t.body.gatesMet, { met: format.number(data.releaseGate.met), total: format.number(data.releaseGate.total) })}</InlineNotice>}
            <DataTable caption={t.heading.title} rows={data.metrics} rowKey={(m) => m.id} columns={[
              { key: 'metric', label: t.body.metric, value: (m) => label(m.id) },
              { key: 'kind', label: t.body.kind, value: (m) => (m.kind === 'release_gate' ? t.option.release_gate : t.option.diagnostic) },
              { key: 'value', label: t.body.value, value: (m) => (m.value === null ? t.option.no_data
                : `${format.percent(m.value)} · ${fill(t.body.ratio, { num: format.number(m.numerator), den: format.number(m.denominator) })}`) },
              { key: 'status', label: t.body.status, value: (m) => <IdentityStatusChip metric={m} /> },
            ]} />
            <h4 data-copy-role="heading" className="lf-staff-subheading">{t.heading.adversarial}</h4>
            <p data-copy-role="body" className="lf-staff-muted">{t.body.adversarialIntro}</p>
            <ul className="lf-staff-reports" aria-label={t.heading.adversarial}>
              {data.adversarial.map((entry) => <li key={entry.id} data-adversarial={entry.id}>
                <p data-copy-role="body">{label(`adv_${entry.id}`)}</p>
              </li>)}
            </ul>
          </> : null}
    </div>
  </Card>;
}

/* ------------------------------------------------------------------------- */
/*  Support tools (manage_support)                                            */
/* ------------------------------------------------------------------------- */

/** The nightly Mentor retention sweep: when it last ran and whether the 90-day promise is being kept. */
export function RetentionSweepCard({ api }: { api: StaffApi }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.support;
  const read = useStaffRead(api, RETENTION_SWEEP_PATH, isRetentionSweep);
  return <Card heading={t.heading.sweep} headingLevel={2}>
    <div className="lf-staff-section" data-tool="retention-sweep">
      <p data-copy-role="body" className="lf-staff-muted">{t.body.sweepIntro}</p>
      {read.load.state === 'loading' ? <Loading />
        : read.load.state === 'error' ? <LoadFailure code={read.load.code} onRetry={read.reload} />
          : read.load.state === 'ready' ? <>
            <div>{read.load.data.stale ? <Chip tone="warning" glyph="warning">{t.option.stale}</Chip> : <Chip tone="success" glyph="check">{t.option.fresh}</Chip>}</div>
            <Facts items={[
              { id: 'last', label: t.body.lastRun, value: format.dateTime(read.load.data.lastRunAt, copy.programme.body.never) },
              { id: 'hours', label: t.body.hoursSince, value: read.load.data.hoursSinceLastRun === null ? copy.programme.body.never : fill(copy.programme.body.hours, { n: format.number(read.load.data.hoursSinceLastRun) }) },
            ]} />
            {read.load.data.stale ? <InlineNotice tone="error">{t.body.staleHelp}</InlineNotice> : null}
          </> : null}
    </div>
  </Card>;
}

/**
 * The daily Vault and Pulse backups and the schema
 * drift probe, beside the retention sweep. The account-deletion,
 * social and learning retention sweeps and the insights prune are
 * listed too, and erasures stalled past a day are named in words. `stale` comes from Core (one home
 * for each window); a stale job is also what fails ops-job-watch.yml and
 * notifies the team.
 */
export function OpsJobsCard({ api }: { api: StaffApi }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.support;
  const read = useStaffRead(api, OPS_JOBS_PATH, isOpsJobs);
  return <Card heading={t.heading.jobs} headingLevel={2}>
    <div className="lf-staff-section" data-tool="ops-jobs">
      <p data-copy-role="body" className="lf-staff-muted">{t.body.jobsIntro}</p>
      {read.load.state === 'loading' ? <Loading />
        : read.load.state === 'error' ? <LoadFailure code={read.load.code} onRetry={read.reload} />
          : read.load.state === 'ready' ? <>
          {read.load.data.accountDeletionFailures.stuck > 0
            ? <InlineNotice tone="error">{fill(t.body.deletionsStuck, {
              n: format.number(read.load.data.accountDeletionFailures.stuck), hours: format.number(read.load.data.accountDeletionFailures.afterHours),
            })}</InlineNotice> : null}
          <ul className="lf-staff-reports" aria-label={t.heading.jobs}>
            {read.load.data.jobs.map((job) => {
              const name = t.option[`job_${job.job}`];
              return <li key={job.job} data-job={job.job} data-stale={job.stale ? 'true' : 'false'}>
                <p data-copy-role="body" className="lf-staff-report-category">{name}</p>
                <div>{job.stale ? <Chip tone="warning" glyph="warning">{t.option.stale}</Chip> : <Chip tone="success" glyph="check">{t.option.fresh}</Chip>}</div>
                <Facts items={[
                  { id: `${job.job}-last`, label: t.body.lastRun, value: format.dateTime(job.lastRunAt, copy.programme.body.never) },
                  { id: `${job.job}-attempt`, label: t.body.lastAttempt, value: format.dateTime(job.lastAttemptAt, copy.programme.body.never) },
                ]} />
                {job.unreadable ? <InlineNotice tone="error">{fill(t.body.jobUnread, { job: name })}</InlineNotice>
                  : job.stale ? <InlineNotice tone="error">{fill(t.body.jobStaleHelp, { job: name, n: format.number(job.staleAfterHours) })}</InlineNotice> : null}
                {job.lastAttemptOk === false ? <InlineNotice tone="error">{t.body.lastAttemptFailed}</InlineNotice> : null}
              </li>;
            })}
            <AlertsDeliveryItem data={read.load.data} />
          </ul></> : null}
    </div>
  </Card>;
}

/** The warehouse alerts that notified nobody, on the same watchdog card (and the same watchdog issue). */
function AlertsDeliveryItem({ data }: { data: unknown }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.support;
  const alerts = undeliveredAlertsOf(data);
  const count = alerts?.undelivered ?? null;
  return <li data-job="alerts" data-stale={count === 0 ? 'false' : 'true'}>
    <p data-copy-role="body" className="lf-staff-report-category">{t.option.job_alerts}</p>
    <div>{count === 0 ? <Chip tone="success" glyph="check">{t.option.alertsDelivered}</Chip> : <Chip tone="warning" glyph="warning">{t.option.alertsUndelivered}</Chip>}</div>
    {count === null ? <InlineNotice tone="error">{t.body.alertsUnread}</InlineNotice>
      : count > 0 ? <InlineNotice tone="error">{fill(t.body.alertsUndelivered, { n: format.number(count) })}</InlineNotice> : null}
  </li>;
}

/* ------------------------------------------------------------------------- */
/*  Named owners (manage_users)                                         */
/* ------------------------------------------------------------------------- */

export function MentorOwners({ api, data, roleNames, onChanged }: {
  api: StaffApi; data: MentorQualityDashboardData; roleNames: Record<OwnerRole, string>; onChanged: () => void;
}) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.owners;
  const staff = useStaffRead(api, '/admin/users', isUsers);
  const [role, setRole] = useState<OwnerRole>(OWNER_ROLES[0]);
  const [person, setPerson] = useState('');
  const [removing, setRemoving] = useState<{ role: OwnerRole; userId: string; name: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const candidates = staff.load.state === 'ready' ? staff.load.data.users.filter((user) => isStaffAccount(user.roles)) : [];
  const change = async (body: { role: OwnerRole; userId: string; action: 'add' | 'remove' }) => {
    setPending(true);
    const result = await api.post(OWNERS_PATH, body);
    setPending(false);
    setRemoving(null);
    setOutcome(result.ok ? body.action : result.code);
    if (result.ok) { setPerson(''); onChanged(); }
  };
  const message = outcome === 'add' ? t.body.added : outcome === 'remove' ? t.body.removed
    : outcome === 'NOT_ELIGIBLE_OWNER' ? t.body.notEligible : outcome === 'UNCHANGED' ? t.body.unchanged
      : outcome === 'FORBIDDEN' ? copy.common.body.refused : outcome ? copy.common.body.actionFailed : null;
  return <Card heading={t.heading.owners} headingLevel={2}>
    <div className="lf-staff-section" data-tool="mentor-owners">
      <p data-copy-role="body" className="lf-staff-muted">{t.body.intro}</p>
      <ul className="lf-staff-reports" aria-label={t.heading.owners}>
        {OWNER_ROLES.map((ownerRole) => {
          const named = data.owners.filter((owner) => owner.role === ownerRole);
          return <li key={ownerRole} data-owner-role={ownerRole}>
            <p data-copy-role="body" className="lf-staff-report-category">{roleNames[ownerRole]}</p>
            {named.length === 0 ? <p data-copy-role="body" className="lf-staff-muted">{t.body.nobody}</p>
              : named.map((owner) => <div key={owner.userId} className="lf-staff-actions">
                <p data-copy-role="data" className="ugc">{owner.displayName ?? shortId(owner.userId)} · {format.date(owner.assignedAt, copy.common.body.notAvailable)}</p>
                <Button size="sm" aria-haspopup="dialog"
                  onClick={() => setRemoving({ role: ownerRole, userId: owner.userId, name: owner.displayName ?? shortId(owner.userId) })}>{t.action.remove}</Button>
              </div>)}
          </li>;
        })}
      </ul>
      {staff.load.state === 'loading' ? <Loading />
        : staff.load.state === 'error' ? <LoadFailure code={staff.load.code} onRetry={staff.reload} />
          : <form className="lf-staff-form" data-form="mentor-owner" noValidate onSubmit={(event) => {
            event.preventDefault();
            if (person) void change({ role, userId: person, action: 'add' });
          }}>
            <div className="lf-staff-filters">
              <SelectField label={t.body.role} value={role} onChange={(event) => setRole(event.target.value as OwnerRole)}
                options={OWNER_ROLES.map((value) => ({ value, label: roleNames[value] }))} />
              <SelectField label={t.body.person} value={person} onChange={(event) => setPerson(event.target.value)}
                options={[{ value: '', label: t.option.choose }, ...candidates.map((user) => ({ value: user.userId, label: user.displayName || shortId(user.userId) }))]} />
            </div>
            <p data-copy-role="body" className="lf-staff-muted">{t.body.eligibility}</p>
            <div className="lf-staff-actions"><Button type="submit" variant="brand" disabled={!person} pending={pending && !removing} pendingLabel={copy.common.action.saving}>{t.action.add}</Button></div>
          </form>}
      {message ? <InlineNotice tone={outcome === 'add' || outcome === 'remove' ? 'success' : 'error'} live>{message}</InlineNotice> : null}
    </div>
    <ConfirmDialog open={removing !== null} heading={t.heading.confirmRemove}
      consequence={removing ? fill(t.body.removeConsequence, { name: removing.name, role: roleNames[removing.role] }) : ''}
      keepLabel={t.action.keep} confirmLabel={t.action.remove} pendingLabel={copy.common.action.saving} pending={pending} destructive
      onKeep={() => setRemoving(null)} onConfirm={() => { if (removing) void change({ role: removing.role, userId: removing.userId, action: 'remove' }); }} />
  </Card>;
}
