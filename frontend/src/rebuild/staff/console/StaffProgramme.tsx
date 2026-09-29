import { useId, useMemo, useState } from 'react';
import { Button, ButtonGroup, Card, Chip, ConfirmDialog, DataTable, EmptyState, InlineNotice, SegmentedControl, SelectField, TextField } from '../../design/controls';
import { reasonActionable } from '../../family/familyAutonomyApi';
import {
  autonomyPath, denialSamplePath, FAMILY_GROUPS, FAMILY_METRICS, identityPath, isDenialSample, isIdentityReport, isOpsJobs, isRetentionSweep,
  isStaffAccount, isStaffAutonomy, lowerLevels, LOWER_REASON_MAX, metricGuard, onTarget, OPS_JOBS_PATH, OWNERS_PATH, readField,
  RETENTION_SWEEP_PATH, TRUST_METRICS, pick,
  type AutonomyLevel, type FamilyGroup, type IdentityMetric, type MetricField, type MetricSpec, type StaffAutonomyChange,
} from './programmeApi';
import { isUsers, UUID, useStaffRead, type StaffApi } from './staffConsoleApi';
import { CopyId, Facts, LoadFailure, Loading, shortId, useFormats } from './ConsoleParts';
import { fill, labelOf, useConsoleCopy, type ConsoleCopy } from './staffConsoleCopy';
import { OWNER_ROLES, type MentorQualityDashboardData, type OwnerRole } from '../mentorQualityApi';

/*
 * W2T.4. Four staff surfaces Core already served without a screen:
 *
 *   Families (Learning intel, view_analytics)  the Appendix H family metrics
 *     in four groups, one group read at a time, and the D.18 denial-reason
 *     sample staff score (owner answer D-23: only children the H.1 analytics
 *     gate admits; the reason text and its code, never an identity).
 *   Trust (Analytics & Health, view_analytics)  the Appendix J/L social,
 *     deletion and achievement-sharing metrics.
 *   Support tools (Reports, manage_support)    the D.17 product-team rollback
 *     of a child's independence level (a lower level only, an actionable
 *     reason, a keep-first confirmation, Core's audit row) and the Mentor
 *     retention sweep's health.
 *   Named owners (Mentor quality, manage_users) the C.24 owner roster.
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

/** One described metric: its heading, what it measures, the headline against its target, the supporting figures and any row tables. */
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
            {(spec.rows ?? []).map((rows) => {
              const list = (pick(data, rows.path) as Record<string, unknown>[]) ?? [];
              const caption = labelOf(t.heading as Record<string, string>, rows.caption);
              return list.length === 0 ? <p key={rows.caption} data-copy-role="body">{fill(t.body.noRows, { name: caption })}</p>
                : <DataTable key={rows.caption} caption={caption} rows={list} rowKey={(row) => String(row[rows.label])} columns={[
                  { key: 'label', label: optionLabel(copy, rows.labelKey), value: (row) => optionLabel(copy, `v_${String(row[rows.label])}`).replace(/^v_/, '') },
                  ...rows.columns.map((column) => ({ key: column.key, label: optionLabel(copy, column.key), value: (row: Record<string, unknown>) => formatField(column, pick(row, column.path), copy, format) })),
                ]} />;
            })}
          </> : null}
    </div>
  </Card>;
}

/* ------------------------------------------------------------------------- */
/*  D.18: the denial-reason sample staff score                                */
/* ------------------------------------------------------------------------- */

function DenialSample({ api, days }: { api: StaffApi; days: number }) {
  const { copy } = useConsoleCopy();
  const t = copy.programme;
  const sample = useStaffRead(api, denialSamplePath(days), isDenialSample);
  const [scores, setScores] = useState<Record<string, 'saving' | 'yes' | 'no' | 'failed' | 'refused' | 'gone'>>({});
  const score = async (id: string, actionable: boolean) => {
    setScores((previous) => ({ ...previous, [id]: 'saving' }));
    const result = await api.post(`/admin/family/denial-reasons/${encodeURIComponent(id)}/score`, { actionable });
    setScores((previous) => ({ ...previous, [id]: result.ok ? (actionable ? 'yes' : 'no') : result.code === 'FORBIDDEN' ? 'refused' : result.code === 'NOT_FOUND' ? 'gone' : 'failed' }));
  };
  return <Card heading={t.heading.denialSample} headingLevel={3}>
    <div className="lf-staff-section" data-sheet="denial-sample">
      <p data-copy-role="body" className="lf-staff-muted">{t.body.denialSample}</p>
      <InlineNotice tone="info">{t.body.denialPrivacy}</InlineNotice>
      {sample.load.state === 'loading' ? <Loading />
        : sample.load.state === 'error' ? <LoadFailure code={sample.load.code} onRetry={sample.reload} />
          : sample.load.state === 'ready' && sample.load.data.reasons.length === 0 ? <EmptyState heading={t.body.noSample} />
            : sample.load.state === 'ready' ? <ul className="lf-staff-reports" aria-label={t.heading.denialSample}>
              {sample.load.data.reasons.map((reason) => {
                const state = scores[reason.id];
                return <li key={reason.id} data-reason={reason.id}>
                  <p data-copy-role="data" className="lf-staff-muted">
                    {optionLabel(copy, `v_${reason.subject}`).replace(/^v_/, '')} · {optionLabel(copy, `v_${reason.outcome}`).replace(/^v_/, '')}
                    {reason.reasonCode ? ` · ${optionLabel(copy, `v_${reason.reasonCode}`).replace(/^v_/, '')}` : ''}
                  </p>
                  <p data-copy-role="data" className="ugc">{reason.reason ?? t.body.noReason}</p>
                  <p data-copy-role="body">{reason.passesStructuralCheck ? t.body.structuralPass : t.body.structuralFail}</p>
                  {state === 'yes' || state === 'no' ? <InlineNotice tone="success" live>{state === 'yes' ? t.body.scoredYes : t.body.scoredNo}</InlineNotice>
                    : <ButtonGroup>
                      <Button size="sm" pending={state === 'saving'} pendingLabel={copy.common.action.saving} onClick={() => void score(reason.id, true)}>{t.action.actionable}</Button>
                      <Button size="sm" disabled={state === 'saving'} onClick={() => void score(reason.id, false)}>{t.action.notActionable}</Button>
                    </ButtonGroup>}
                  {state === 'failed' ? <InlineNotice tone="error" live>{copy.common.body.actionFailed}</InlineNotice> : null}
                  {state === 'refused' ? <InlineNotice tone="error" live>{t.body.scoreRefused}</InlineNotice> : null}
                  {state === 'gone' ? <InlineNotice tone="retry" live>{t.body.scoreGone}</InlineNotice> : null}
                </li>;
              })}
            </ul> : null}
    </div>
  </Card>;
}

/** Learning intel → Families: one Appendix H group at a time (each group reads only its own metrics). */
export function FamilyMetricsView({ api, days }: { api: StaffApi; days: number }) {
  const { copy } = useConsoleCopy();
  const t = copy.programme;
  const name = useId();
  const [group, setGroup] = useState<FamilyGroup>('integrity');
  return <div className="lf-staff-section" data-view-group={group}>
    <p data-copy-role="body" className="lf-staff-muted">{t.body.familiesIntro}</p>
    <SegmentedControl legend={t.body.group} name={`${name}-group`} value={group} onValueChange={setGroup} className="lf-staff-views"
      options={FAMILY_GROUPS.map((value) => ({ value, label: t.option[`group_${value}`] }))} />
    <div key={group} className="lf-staff-pair">
      {FAMILY_METRICS[group].map((spec) => <MetricCard key={spec.id} api={api} spec={spec} days={days} />)}
      {group === 'decisions' ? <DenialSample api={api} days={days} /> : null}
    </div>
  </div>;
}

/** Analytics & Health → Trust: the Appendix J/L trust metrics, and Appendix M's identity metrics. */
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
 * Appendix M Part 1 (Block A): each acquisition and identity metric, marked
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

function LevelChanges({ changes }: { changes: StaffAutonomyChange[] }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.support;
  if (changes.length === 0) return <p data-copy-role="body">{t.body.noChanges}</p>;
  return <DataTable caption={t.heading.changes} rows={changes} rowKey={(c) => c.id} columns={[
    { key: 'when', label: t.body.when, value: (c) => format.dateTime(c.createdAt, copy.common.body.notAvailable) },
    { key: 'move', label: t.body.move, value: (c) => fill(t.body.fromTo, { from: String(c.fromLevel), to: String(c.toLevel) }) },
    { key: 'by', label: t.body.by, value: (c) => t.option[`by_${c.by}`] },
    { key: 'reason', label: t.body.reason, value: (c) => c.reason ?? copy.common.body.notAvailable, ugc: true },
  ]} />;
}

/** D.17: look up a child's independence level and lower it, with an actionable reason and a keep-first confirmation. */
export function AutonomyRollback({ api }: { api: StaffApi }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.support;
  const [draft, setDraft] = useState('');
  const [checked, setChecked] = useState(false);
  const [kidId, setKidId] = useState<string | null>(null);
  const read = useStaffRead(api, kidId ? autonomyPath(kidId) : null, isStaffAutonomy);
  const [target, setTarget] = useState<AutonomyLevel | null>(null);
  const [reason, setReason] = useState('');
  const [reasonChecked, setReasonChecked] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const idError = !UUID.test(draft.trim()) ? t.body.idInvalid : undefined;
  const data = read.load.state === 'ready' ? read.load.data : null;
  const options = data ? lowerLevels(data.autonomy.level) : [];
  const chosen = target !== null && options.includes(target) ? target : options[options.length - 1] ?? null;
  const reasonError = [...reason.trim()].length > LOWER_REASON_MAX ? t.body.reasonLong : !reasonActionable(reason) ? t.body.reasonWeak : undefined;
  const lower = async () => {
    if (!kidId || chosen === null) return;
    setPending(true);
    const result = await api.post(`${autonomyPath(kidId)}/lower`, { level: chosen, reason: reason.trim() });
    setPending(false);
    setConfirming(false);
    setOutcome(result.ok ? 'done' : result.code);
    if (result.ok) { setReason(''); setReasonChecked(false); read.reload(); }
  };
  const failure = outcome && outcome !== 'done'
    ? outcome === 'AUTONOMY_REASON_REQUIRED' ? t.body.reasonWeak
      : outcome === 'AUTONOMY_STAFF_FORBIDDEN' || outcome === 'FORBIDDEN' ? t.body.lowerRefused
        : outcome === 'NOT_FOUND' || outcome === 'AUTONOMY_NOT_IN_FAMILY' ? t.body.notInFamily
          : outcome === 'VALIDATION_ERROR' || outcome === 'DATA_UNAVAILABLE' ? copy.common.body.actionFailed : t.body.lowerConflict
    : null;
  return <Card heading={t.heading.autonomy} headingLevel={2}>
    <div className="lf-staff-section" data-tool="autonomy">
      <p data-copy-role="body" className="lf-staff-muted">{t.body.autonomyIntro}</p>
      <form className="lf-staff-form" data-form="autonomy-lookup" noValidate onSubmit={(event) => {
        event.preventDefault();
        setChecked(true);
        if (!idError) { setOutcome(null); setTarget(null); setKidId(draft.trim()); }
      }}>
        <TextField label={t.body.childId} value={draft} data-copy-role="data" autoComplete="off" spellCheck={false}
          error={checked ? idError : undefined} errorLive onChange={(event) => setDraft(event.target.value)} />
        <div className="lf-staff-actions"><Button type="submit">{t.action.lookUp}</Button></div>
      </form>
      {read.load.state === 'loading' ? <Loading />
        : read.load.state === 'error' ? (read.load.code === 'NOT_FOUND' ? <InlineNotice tone="info" live>{t.body.notInFamily}</InlineNotice>
          : <LoadFailure code={read.load.code} onRetry={read.reload} />)
          : data ? <>
            <Facts items={[
              { id: 'child', label: t.body.childId, value: kidId ?? '', ugc: true },
              { id: 'level', label: t.body.level, value: fill(t.body.levelN, { n: String(data.autonomy.level) }) },
              { id: 'since', label: t.body.since, value: format.dateTime(data.autonomy.levelSince, copy.common.body.notAvailable) },
              { id: 'limit', label: t.body.preapproved, value: fill(t.body.coins, { n: format.number(data.autonomy.preapprovedLimit) }) },
            ]} />
            {kidId ? <CopyId value={kidId} /> : null}
            <LevelChanges changes={data.changes} />
            {options.length === 0 ? <InlineNotice tone="info">{t.body.lowest}</InlineNotice>
              : <form className="lf-staff-form" data-form="autonomy-lower" noValidate onSubmit={(event) => {
                event.preventDefault();
                setReasonChecked(true);
                if (!reasonError) setConfirming(true);
              }}>
                <SelectField label={t.body.newLevel} value={String(chosen)} onChange={(event) => setTarget(Number(event.target.value) as AutonomyLevel)}
                  options={options.map((level) => ({ value: String(level), label: fill(t.body.levelN, { n: String(level) }) }))} />
                <TextField label={t.body.reason} help={t.body.reasonHelp} value={reason} maxLength={LOWER_REASON_MAX}
                  error={reasonChecked ? reasonError : undefined} errorLive onChange={(event) => setReason(event.target.value)} />
                <div className="lf-staff-actions"><Button type="submit" aria-haspopup="dialog">{t.action.lower}</Button></div>
              </form>}
            {outcome === 'done' ? <InlineNotice tone="success" live>{t.body.lowered}</InlineNotice> : null}
            {failure ? <InlineNotice tone="error" live>{failure}</InlineNotice> : null}
          </> : null}
    </div>
    <ConfirmDialog open={confirming} heading={t.heading.confirmLower} consequence={fill(t.body.lowerConsequence, { n: String(chosen ?? 1) })}
      keepLabel={t.action.keep} confirmLabel={t.action.lower} pendingLabel={copy.common.action.saving} pending={pending} destructive
      onKeep={() => setConfirming(false)} onConfirm={() => void lower()} />
  </Card>;
}

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
 * H.4 (Appendix O 1.3): the daily Vault and Pulse backups and the schema
 * drift probe, beside the retention sweep. GAP-FIX-R6: the account-deletion,
 * family, social and learning retention sweeps and the insights prune are
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
                {job.stale ? <InlineNotice tone="error">{fill(t.body.jobStaleHelp, { job: name, n: format.number(job.staleAfterHours) })}</InlineNotice> : null}
                {job.lastAttemptOk === false ? <InlineNotice tone="error">{t.body.lastAttemptFailed}</InlineNotice> : null}
              </li>;
            })}
          </ul></> : null}
    </div>
  </Card>;
}

/* ------------------------------------------------------------------------- */
/*  C.24: named owners (manage_users)                                         */
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
