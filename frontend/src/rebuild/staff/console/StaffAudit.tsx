import { useMemo, useState } from 'react';
import { Button, ButtonGroup, DataTable, EmptyState, InlineNotice, SelectField, Sheet, TextField, type TableColumn } from '../../design/controls';
import {
  AUDIT_PAGE_SIZE, auditPath, isAuditPage, NO_AUDIT_FILTERS, useStaffRead, UUID, type AuditEntry, type AuditFilters, type StaffApi,
} from './staffConsoleApi';
import { CopyId, Facts, LoadFailure, Loading, Metrics, Pager, shortId, StaffPage, useFormats } from './ConsoleParts';
import { fill, useConsoleCopy } from './staffConsoleCopy';

/*
 * S9 Audit log (manage_support). An append-only record: nothing here writes.
 * Action, actor, subject and dates filter on the server (Core's
 * AuditQuerySchema: exact matches, inclusive days), so a filter covers the
 * whole log and not just the visible page; the search box only narrows the
 * page already loaded, and says so. G.3's live-activity review verdicts
 * (`admin.tutor_activity.review`) and A.5's justification and revocation rows
 * appear here like every other privileged action.
 */

function EventDetails({ entry, onClose }: { entry: AuditEntry; onClose: () => void }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.audit;
  const detail = Object.keys(entry.detail).length ? JSON.stringify(entry.detail, null, 2) : null;
  return <Sheet open onClose={onClose} heading={t.heading.event} closeLabel={copy.common.action.close}>
    <div className="lf-staff-sheet" data-sheet="audit-event">
      <InlineNotice tone="info">{t.body.immutable}</InlineNotice>
      <Facts items={[
        { id: 'eventId', label: t.body.eventId, value: `#${entry.id}` },
        { id: 'when', label: t.body.when, value: format.dateTime(entry.createdAt, copy.common.body.notAvailable) },
        { id: 'action', label: t.body.action, value: entry.action, ugc: true },
        { id: 'actor', label: t.body.actor, value: entry.actorId ?? copy.common.body.system, ugc: true },
        { id: 'subject', label: t.body.subject, value: entry.subject || copy.common.body.notAvailable, ugc: true },
      ]} />
      {entry.actorId ? <CopyId value={entry.actorId} label={t.action.copyActor} /> : null}
      <h3 data-copy-role="heading" className="lf-staff-subheading">{t.body.detail}</h3>
      {detail ? <pre className="lf-staff-code" data-copy-role="data">{detail}</pre> : <p data-copy-role="body">{t.body.noDetail}</p>}
    </div>
  </Sheet>;
}

export function StaffAudit({ api }: { api: StaffApi }) {
  const { copy, sections, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.audit;
  const [draft, setDraft] = useState<AuditFilters>(NO_AUDIT_FILTERS);
  const [applied, setApplied] = useState<AuditFilters>(NO_AUDIT_FILTERS);
  const [checked, setChecked] = useState(false);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const [filtering, setFiltering] = useState(false);
  const audit = useStaffRead(api, auditPath(applied, offset), isAuditPage);
  const page = audit.load.state === 'ready' ? audit.load.data : null;
  const entries = useMemo(() => page?.entries ?? [], [page]);

  const actorInvalid = draft.actorId.trim() !== '' && !UUID.test(draft.actorId.trim());
  const datesInvalid = draft.from !== '' && draft.to !== '' && draft.from > draft.to;
  const apply = () => {
    setChecked(true);
    if (actorInvalid || datesInvalid) return;
    setApplied(draft);
    setOffset(0);
    setFiltering(false);
  };
  const clear = () => { setDraft(NO_AUDIT_FILTERS); setApplied(NO_AUDIT_FILTERS); setOffset(0); setChecked(false); setFiltering(false); };
  const active = Object.values(applied).filter(Boolean).length;
  const filtered = Object.values(applied).some(Boolean) || search.trim() !== '';

  const actions = useMemo(() => [...new Set([...entries.map((entry) => entry.action), ...(applied.action ? [applied.action] : [])])].sort(), [entries, applied.action]);
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter((entry) => [entry.action, entry.actorId ?? '', entry.subject, JSON.stringify(entry.detail)].some((value) => value.toLowerCase().includes(needle)));
  }, [entries, search]);
  const actors = useMemo(() => new Set(entries.map((entry) => entry.actorId).filter(Boolean)).size, [entries]);

  const columns: TableColumn<AuditEntry>[] = [
    { key: 'when', label: t.body.when, value: (entry) => format.dateTime(entry.createdAt, copy.common.body.notAvailable) },
    { key: 'action', label: t.body.action, value: (entry) => entry.action, ugc: true },
    { key: 'actor', label: t.body.actor, value: (entry) => (entry.actorId ? shortId(entry.actorId) : copy.common.body.system) },
    { key: 'subject', label: t.body.subject, value: (entry) => entry.subject || copy.common.body.notAvailable, ugc: true },
    { key: 'details', label: copy.common.body.details, value: (entry) => <Button size="sm" onClick={() => setSelected(entry)}>{copy.common.action.open}</Button> },
  ];

  return <StaffPage screen="staff-audit" title={sections.audit} intro={t.body.intro}
    actions={<>
      <Button size="sm" aria-haspopup="dialog" onClick={() => { setDraft(applied); setChecked(false); setFiltering(true); }}>{t.action.filters}</Button>
      <Button size="sm" onClick={audit.reload}>{copy.common.action.refresh}</Button>
    </>}>
    {audit.load.state === 'loading' ? <Loading />
      : audit.load.state === 'error' ? <LoadFailure code={audit.load.code} onRetry={audit.reload} />
        : page ? <Metrics label={sections.audit} items={[
          { id: 'total', label: t.body.total, value: format.number(page.total) },
          { id: 'onPage', label: t.body.onPage, value: format.number(entries.length) },
          { id: 'actors', label: t.body.actors, value: format.number(actors) },
          { id: 'latest', label: t.body.latest, value: entries[0] ? format.dateTime(entries[0].createdAt, copy.common.body.notAvailable) : copy.common.body.notAvailable },
        ]} /> : null}
    {page ? <section className="lf-staff-section" aria-label={t.heading.events}>
      {active ? <div className="lf-staff-result-row">
        <InlineNotice tone="info">{fill(t.body.activeFilters, { n: active })}</InlineNotice>
        <Button size="sm" onClick={clear}>{copy.common.action.clearFilters}</Button>
      </div> : null}
      <TextField type="search" label={t.body.search} value={search} data-copy-role="data" onChange={(event) => setSearch(event.target.value)} />
      {page.total === 0 && !filtered ? <EmptyState heading={t.body.empty} />
        : visible.length === 0 ? <EmptyState heading={copy.common.body.noMatch} />
          : <DataTable caption={t.heading.events} columns={columns} rows={visible} rowKey={(entry) => String(entry.id)} />}
      {page.total > 0 ? <Pager start={entries.length ? page.offset + 1 : 0} end={page.offset + entries.length} total={page.total}
        onPrevious={page.offset > 0 ? () => setOffset(Math.max(0, page.offset - AUDIT_PAGE_SIZE)) : null}
        onNext={page.offset + entries.length < page.total ? () => setOffset(page.offset + AUDIT_PAGE_SIZE) : null} /> : null}
    </section> : null}
    {filtering ? <Sheet open onClose={() => setFiltering(false)} heading={t.heading.filters} closeLabel={copy.common.action.close}
      footer={<ButtonGroup>
        <Button variant="brand" onClick={apply}>{t.action.apply}</Button>
        <Button onClick={clear}>{copy.common.action.clearFilters}</Button>
      </ButtonGroup>}>
      <div className="lf-staff-sheet" data-sheet="audit-filters">
        <div className="lf-staff-filters">
          <SelectField label={t.body.action} value={draft.action} onChange={(event) => setDraft({ ...draft, action: event.target.value })}
            options={[{ value: '', label: t.option.all }, ...actions.map((action) => ({ value: action, label: action, role: 'data' as const }))]} />
          <TextField label={t.body.actor} value={draft.actorId} data-copy-role="data" autoComplete="off"
            error={checked && actorInvalid ? t.body.actorInvalid : undefined} onChange={(event) => setDraft({ ...draft, actorId: event.target.value })} />
          <TextField label={t.body.subject} value={draft.subject} data-copy-role="data" autoComplete="off" onChange={(event) => setDraft({ ...draft, subject: event.target.value })} />
          <TextField type="date" label={t.body.from} value={draft.from} data-copy-role="data"
            error={checked && datesInvalid ? t.body.dateInvalid : undefined} onChange={(event) => setDraft({ ...draft, from: event.target.value })} />
          <TextField type="date" label={t.body.to} value={draft.to} data-copy-role="data" onChange={(event) => setDraft({ ...draft, to: event.target.value })} />
        </div>
      </div>
    </Sheet> : null}
    {selected ? <EventDetails entry={selected} onClose={() => setSelected(null)} /> : null}
  </StaffPage>;
}
