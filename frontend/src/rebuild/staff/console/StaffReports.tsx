import { useId, useMemo, useState } from 'react';
import { Button, Chip, ConfirmDialog, DataTable, EmptyState, InlineNotice, SegmentedControl, SelectField, Sheet, type TableColumn } from '../../design/controls';
import { isCaseDetail, isCases, REPORTS_PATH, useStaffRead, type ReportCase, type StaffApi } from './staffConsoleApi';
import { CopyId, Facts, LoadFailure, Loading, Metrics, shortId, StaffPage, useFormats } from './ConsoleParts';
import { fill, useConsoleCopy, type ConsoleCopy } from './staffConsoleCopy';
import { AutonomyRollback, OpsJobsCard, RetentionSweepCard } from './StaffProgramme';

/*
 * E.3's platform review queue (manage_support). Every social report routes
 * here, and the automatic pattern trigger (reports or blocks from 3 unrelated
 * children in 30 days) opens a case with origin "pattern". A case shows only
 * what Core stores: the predefined category and the capped optional note of
 * each report, never free-form profile data. Resolving is a staff decision:
 * Core closes the case in a service-only transaction and records the deciding
 * staff member in the central audit log; guardian notices are Core's.
 *
 * W2T.4: the same grant (manage_support) opens the support tools as a second
 * view: the D.17 product-team rollback of a child's independence level and
 * the Mentor retention sweep's health. The queue is read only in its view.
 */

function originChip(copy: ConsoleCopy, origin: ReportCase['origin']) {
  return origin === 'pattern' ? <Chip tone="error" glyph="warning">{copy.reports.option.pattern}</Chip> : <Chip tone="sky" glyph="info">{copy.reports.option.report}</Chip>;
}
function statusChip(copy: ConsoleCopy, status: ReportCase['status']) {
  return status === 'open' ? <Chip tone="warning" glyph="info">{copy.reports.option.open}</Chip> : <Chip tone="success" glyph="check">{copy.reports.option.resolved}</Chip>;
}

function CaseDetails({ api, subjectId, onClose, onResolved }: { api: StaffApi; subjectId: string; onClose: () => void; onResolved: () => void }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.reports;
  const detail = useStaffRead(api, `/admin/reports/${subjectId}`, isCaseDetail);
  const [confirming, setConfirming] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [outcome, setOutcome] = useState<'done' | 'failed' | null>(null);
  const resolve = async () => {
    setResolving(true);
    const result = await api.post(`/admin/reports/${subjectId}/status`, { status: 'resolved' });
    setResolving(false);
    setConfirming(false);
    setOutcome(result.ok ? 'done' : 'failed');
    if (result.ok) { detail.reload(); onResolved(); }
  };
  const data = detail.load.state === 'ready' ? detail.load.data : null;
  return <><Sheet open onClose={onClose} heading={t.heading.case} closeLabel={copy.common.action.close}>
    <div className="lf-staff-sheet" data-sheet="report-case">
      {detail.load.state === 'loading' ? <Loading />
        : detail.load.state === 'error' ? <LoadFailure code={detail.load.code} onRetry={detail.reload} />
          : data ? <>
            <Facts items={[
              { id: 'account', label: t.body.account, value: data.subjectId, ugc: true },
              { id: 'origin', label: t.body.origin, value: originChip(copy, data.origin) },
              { id: 'status', label: t.body.status, value: statusChip(copy, data.status) },
              { id: 'counts', label: t.body.reports, value: fill(t.body.counts, { open: format.number(data.openReportCount), total: format.number(data.reportCount) }) },
            ]} />
            <CopyId value={data.subjectId} />
            {data.origin === 'pattern' ? <InlineNotice tone="info">{t.body.patternHelp}</InlineNotice> : null}
            {data.reports.length === 0 ? <p data-copy-role="body">{t.body.noReports}</p>
              : <ul className="lf-staff-reports" aria-label={t.body.reports}>
                {data.reports.map((report) => <li key={report.id} data-report={report.category}>
                  <p data-copy-role="body" className="lf-staff-report-category">{t.option[report.category]}</p>
                  <p data-copy-role="data" className="lf-staff-muted">
                    {format.dateTime(report.createdAt, copy.common.body.notAvailable)} · {fill(t.body.reporter, { id: shortId(report.reporterId) })}
                  </p>
                  {report.note ? <p data-copy-role="data" className="ugc">{report.note}</p> : null}
                </li>)}
              </ul>}
            {data.status === 'open' ? <div><Button variant="success" aria-haspopup="dialog" onClick={() => setConfirming(true)}>{t.action.resolve}</Button></div> : null}
          </> : null}
      {outcome === 'done' ? <InlineNotice tone="success" live>{t.body.resolved}</InlineNotice> : null}
      {outcome === 'failed' ? <InlineNotice tone="error" live>{t.body.resolveFailed}</InlineNotice> : null}
    </div>
  </Sheet>
    <ConfirmDialog open={confirming} heading={t.heading.confirm} consequence={t.body.consequence} keepLabel={t.action.keep}
      confirmLabel={t.action.resolve} pendingLabel={t.action.resolving} pending={resolving}
      onKeep={() => setConfirming(false)} onConfirm={() => void resolve()} />
  </>;
}

export type ReportsView = 'cases' | 'support';
export const reportsView = (value: string | null): ReportsView => (value === 'support' ? 'support' : 'cases');

export function StaffReports({ api, initialView = 'cases' }: { api: StaffApi; initialView?: ReportsView }) {
  const { copy, sections } = useConsoleCopy();
  const t = copy.reports;
  const name = useId();
  const [view, setView] = useState<ReportsView>(initialView);
  const [generation, setGeneration] = useState(0);
  return <StaffPage screen="staff-reports" title={sections.reports}
    actions={<Button size="sm" onClick={() => setGeneration((value) => value + 1)}>{copy.common.action.refresh}</Button>}>
    <SegmentedControl legend={t.body.view} name={`${name}-view`} value={view} onValueChange={setView} className="lf-staff-views"
      options={[{ value: 'cases' as const, label: t.option.view_cases }, { value: 'support' as const, label: t.option.view_support }]} />
    <div key={`${view}:${generation}`} className="lf-staff-section" data-view={view}>
      {view === 'cases' ? <ReportQueue api={api} />
        : <><div className="lf-staff-pair"><AutonomyRollback api={api} /><RetentionSweepCard api={api} /></div><OpsJobsCard api={api} /></>}
    </div>
  </StaffPage>;
}

function ReportQueue({ api }: { api: StaffApi }) {
  const { copy, sections, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.reports;
  const cases = useStaffRead(api, REPORTS_PATH, isCases);
  const [status, setStatus] = useState<'all' | 'open' | 'resolved'>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const list = useMemo(() => (cases.load.state === 'ready' ? cases.load.data.cases : []), [cases.load]);
  const rows = list.filter((entry) => status === 'all' || entry.status === status);
  const open = list.filter((entry) => entry.status === 'open');

  const columns: TableColumn<ReportCase>[] = [
    { key: 'account', label: t.body.account, value: (entry) => shortId(entry.subjectId) },
    { key: 'origin', label: t.body.origin, value: (entry) => originChip(copy, entry.origin) },
    { key: 'reports', label: t.body.reports, value: (entry) => fill(t.body.counts, { open: format.number(entry.openReportCount), total: format.number(entry.reportCount) }) },
    { key: 'lastSeen', label: t.body.lastSeen, value: (entry) => format.dateTime(entry.lastSeenAt, copy.common.body.notAvailable) },
    { key: 'status', label: t.body.status, value: (entry) => statusChip(copy, entry.status) },
    { key: 'details', label: copy.common.body.details, value: (entry) => <Button size="sm" onClick={() => setSelected(entry.subjectId)}>{copy.common.action.open}</Button> },
  ];

  return <>
    {cases.load.state === 'loading' ? <Loading />
      : cases.load.state === 'error' ? <LoadFailure code={cases.load.code} onRetry={cases.reload} />
        : <>
          <Metrics label={sections.reports} items={[
            { id: 'open', label: t.body.open, value: format.number(open.length) },
            { id: 'pattern', label: t.body.pattern, value: format.number(open.filter((entry) => entry.origin === 'pattern').length) },
            { id: 'openReports', label: t.body.openReports, value: format.number(open.reduce((sum, entry) => sum + entry.openReportCount, 0)) },
          ]} />
          {list.length === 0 ? <EmptyState heading={t.body.empty} /> : <section className="lf-staff-section" aria-label={t.heading.cases}>
            <div className="lf-staff-filters">
              <SelectField label={t.body.status} value={status} onChange={(event) => setStatus(event.target.value as typeof status)}
                options={[{ value: 'all', label: t.option.all }, { value: 'open', label: t.option.open }, { value: 'resolved', label: t.option.resolved }]} />
            </div>
            {rows.length === 0 ? <EmptyState heading={copy.common.body.noMatch} />
              : <DataTable caption={t.heading.cases} columns={columns} rows={rows} rowKey={(entry) => entry.subjectId} />}
          </section>}
        </>}
    {selected ? <CaseDetails key={selected} api={api} subjectId={selected} onClose={() => setSelected(null)} onResolved={cases.reload} /> : null}
  </>;
}
