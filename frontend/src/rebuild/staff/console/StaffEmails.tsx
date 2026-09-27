import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Chip, DashboardLayout, DataTable, EmptyState, InlineNotice, SelectField, Sheet, TextField, type TableColumn } from '../../design/controls';
import {
  EMAIL_PAGE_SIZE, EMAIL_STATUSES, EMAIL_TREND_DAYS, emailLogsPath, isEmailLogs, isEmailSummary, useStaffRead,
  type EmailEntry, type EmailFilters, type StaffApi,
} from './staffConsoleApi';
import { CopyId, Facts, LoadFailure, Loading, Metrics, Pager, ShareBars, StaffPage, useFormats } from './ConsoleParts';
import { DailyChart } from './DailyChart';
import { labelOf, useConsoleCopy, type ConsoleCopy } from './staffConsoleCopy';

/*
 * S4 Emails (manage_support): the transactional email history Core proxies
 * from the email server. Search, status and template filter on the server
 * (Core's EmailLogsQuerySchema), so a filter covers the whole history, not
 * the visible page. The totals and the history load separately and fail
 * separately: one missing half says which, the other half stays usable.
 * Recipients are people's addresses: shown to support staff as data, wrapped,
 * never truncated.
 */

function statusChip(copy: ConsoleCopy, status: string) {
  const label = labelOf(copy.emails.option, status);
  if (status === 'failed') return <Chip tone="error" glyph="cross">{label}</Chip>;
  if (status === 'relayed' || status === 'delivered') return <Chip tone="success" glyph="check">{label}</Chip>;
  if (status === 'queued') return <Chip tone="warning" glyph="info">{label}</Chip>;
  return <Chip tone="sky" glyph="info">{label}</Chip>;
}

function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

function EmailDetails({ entry, onClose }: { entry: EmailEntry; onClose: () => void }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.emails;
  const detail = entry.detail && Object.keys(entry.detail).length ? JSON.stringify(entry.detail, null, 2) : null;
  return <Sheet open onClose={onClose} heading={t.heading.email} closeLabel={copy.common.action.close}>
    <div className="lf-staff-sheet" data-sheet="email">
      <Facts items={[
        { id: 'to', label: t.body.to, value: entry.to, ugc: true },
        { id: 'status', label: t.body.status, value: statusChip(copy, entry.status) },
        { id: 'subject', label: t.body.subject, value: entry.subject || t.body.noSubject, ugc: true },
        { id: 'template', label: t.body.template, value: entry.templateType, ugc: true },
        { id: 'language', label: t.body.language, value: entry.locale || copy.common.body.notAvailable },
        { id: 'sent', label: t.body.sent, value: format.dateTime(entry.createdAt, copy.common.body.notAvailable) },
        { id: 'messageId', label: t.body.messageId, value: entry.messageId || entry.id, ugc: true },
        { id: 'userId', label: t.body.userId, value: entry.userId || copy.common.body.notAvailable, ugc: true },
      ]} />
      <CopyId value={entry.messageId || entry.id} />
      {detail ? <>
        <h3 data-copy-role="heading" className="lf-staff-subheading">{t.body.detail}</h3>
        <pre className="lf-staff-code" data-copy-role="data">{detail}</pre>
      </> : null}
    </div>
  </Sheet>;
}

export function StaffEmails({ api }: { api: StaffApi }) {
  const { copy, sections, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.emails;
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [template, setTemplate] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<EmailEntry | null>(null);
  const q = useDebounced(search, 300);
  const filters: EmailFilters = useMemo(() => ({ q, status, templateType: template }), [q, status, template]);
  useEffect(() => { setPage(0); }, [filters]);
  const summary = useStaffRead(api, `/admin/emails/summary?days=${EMAIL_TREND_DAYS}`, isEmailSummary);
  const logs = useStaffRead(api, emailLogsPath(filters, page), isEmailLogs);
  const data = summary.load.state === 'ready' ? summary.load.data : null;
  const history = logs.load.state === 'ready' ? logs.load.data : null;
  const refresh = () => { summary.reload(); logs.reload(); };
  const filtered = search.trim() !== '' || status !== '' || template !== '';

  const statusKeys = useMemo(() => [...EMAIL_STATUSES, ...Object.keys(data?.statuses ?? {}).filter((key) => !(EMAIL_STATUSES as readonly string[]).includes(key)).sort()], [data]);
  const share = (counts: Record<string, number> | undefined, label: (key: string) => string) => Object.entries(counts ?? {})
    .sort((a, b) => b[1] - a[1]).slice(0, 6).map(([key, count]) => ({ id: key, label: label(key), count }));
  const success = (data?.statuses.relayed ?? 0) + (data?.statuses.delivered ?? 0);
  const failed = data?.statuses.failed ?? 0;
  const rate = (count: number) => (data && data.total > 0 ? format.percent(count / data.total) : copy.common.body.notAvailable);

  const columns: TableColumn<EmailEntry>[] = [
    { key: 'to', label: t.body.to, value: (entry) => entry.to, ugc: true },
    { key: 'subject', label: t.body.subject, value: (entry) => entry.subject || t.body.noSubject, ugc: true },
    { key: 'template', label: t.body.template, value: (entry) => entry.templateType, ugc: true },
    { key: 'language', label: t.body.language, value: (entry) => entry.locale || copy.common.body.notAvailable },
    { key: 'status', label: t.body.status, value: (entry) => statusChip(copy, entry.status) },
    { key: 'sent', label: t.body.sent, value: (entry) => format.dateTime(entry.createdAt, copy.common.body.notAvailable) },
    { key: 'details', label: copy.common.body.details, value: (entry) => <Button size="sm" onClick={() => setSelected(entry)}>{copy.common.action.open}</Button> },
  ];

  const bothFailed = summary.load.state === 'error' && logs.load.state === 'error';
  return <StaffPage screen="staff-emails" title={sections.emails} intro={t.body.intro}
    actions={<Button size="sm" onClick={refresh}>{copy.common.action.refresh}</Button>}>
    {bothFailed ? <LoadFailure code={summary.load.state === 'error' ? summary.load.code : 'INTERNAL'} onRetry={refresh} /> : <>
      {summary.load.state === 'loading' ? <Loading />
        : summary.load.state === 'error' ? <InlineNotice tone="error">{t.body.summaryFailed}</InlineNotice>
          : data ? <Metrics label={sections.emails} items={[
            { id: 'total', label: t.body.total, value: format.number(data.total) },
            { id: 'success', label: t.body.success, value: rate(success) },
            { id: 'failed', label: t.body.failed, value: format.number(failed) },
            { id: 'failureRate', label: t.body.failureRate, value: rate(failed) },
            { id: 'pending', label: t.body.pending, value: format.number(data.statuses.queued ?? 0) },
            { id: 'templates', label: t.body.templates, value: format.number(Object.keys(data.templates).length) },
          ]} /> : null}
      {data ? <DashboardLayout
        primary={<Card heading={t.heading.trend}>
          <p data-copy-role="body" className="lf-staff-muted">{t.body.window}</p>
          {data.trend === undefined ? <p data-copy-role="body">{t.body.trendUnavailable}</p> : <DailyChart points={data.trend} seriesLabel={t.body.emails} />}
        </Card>}
        secondary={<>
          <Card heading={t.heading.statuses}>
            <ShareBars label={t.heading.statuses} locale={locale} total={data.total}
              rows={statusKeys.map((key) => ({ id: key, label: labelOf(t.option, key), count: data.statuses[key] ?? 0 }))} />
          </Card>
          {Object.keys(data.templates).length ? <Card heading={t.heading.templates}>
            <ShareBars label={t.heading.templates} locale={locale} total={data.total} tone="mint" rows={share(data.templates, (key) => key)} />
          </Card> : null}
          {Object.keys(data.locales ?? {}).length ? <Card heading={t.heading.languages}>
            <ShareBars label={t.heading.languages} locale={locale} total={data.total} tone="mint" rows={share(data.locales, (key) => labelOf(copy.users.option, key))} />
          </Card> : null}
        </>} /> : null}
      <section className="lf-staff-section" aria-label={t.heading.history}>
        <div className="lf-staff-filters">
          <TextField type="search" label={t.body.search} value={search} data-copy-role="data" onChange={(event) => setSearch(event.target.value)} />
          <SelectField label={t.body.status} value={status} onChange={(event) => setStatus(event.target.value)}
            options={[{ value: '', label: t.option.allStatuses }, ...statusKeys.map((key) => ({ value: key, label: labelOf(t.option, key) }))]} />
          {data && Object.keys(data.templates).length ? <SelectField label={t.body.template} value={template} onChange={(event) => setTemplate(event.target.value)}
            options={[{ value: '', label: t.option.allTemplates }, ...Object.keys(data.templates).sort().map((key) => ({ value: key, label: key, role: 'data' as const }))]} /> : null}
        </div>
        {filtered ? <div className="lf-staff-result-row">
          <Button size="sm" onClick={() => { setSearch(''); setStatus(''); setTemplate(''); }}>{copy.common.action.clearFilters}</Button>
        </div> : null}
        {logs.load.state === 'loading' ? <Loading />
          : logs.load.state === 'error' ? (bothFailed ? null : <LoadFailure code={logs.load.code} onRetry={logs.reload} />)
            : history && history.entries.length === 0 ? <EmptyState heading={filtered ? copy.common.body.noMatch : t.body.empty} />
              : history ? <>
                <DataTable caption={t.heading.history} columns={columns} rows={history.entries} rowKey={(entry) => entry.id} />
                <Pager start={page * EMAIL_PAGE_SIZE + 1} end={page * EMAIL_PAGE_SIZE + history.entries.length} total={history.total}
                  onPrevious={page > 0 ? () => setPage(page - 1) : null}
                  onNext={(page + 1) * EMAIL_PAGE_SIZE < history.total ? () => setPage(page + 1) : null} />
              </> : null}
      </section>
    </>}
    {selected ? <EmailDetails entry={selected} onClose={() => setSelected(null)} /> : null}
  </StaffPage>;
}
