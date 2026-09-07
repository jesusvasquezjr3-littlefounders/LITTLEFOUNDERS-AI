import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Dropdown, Icon, SectionHeading, StatCard, Table, type DropdownOption, type TableColumn } from '@/components/ui';
import { AdminAction, AdminDialog, AdminEmpty, AdminPage, Unavailable, useAdminData } from './adminShared';

interface AuditEntry {
  id: number;
  actorId: string | null;
  action: string;
  subject: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

interface AuditPage {
  entries: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

function shortId(id: string | null): string | null {
  return id ? `${id.slice(0, 8)}…` : null;
}

function formatNumber(value: number, language: string | undefined): string {
  return new Intl.NumberFormat(language).format(value);
}

export function AdminAuditPage() {
  const { t, i18n } = useTranslation();
  const pageSize = 50;
  const [offset, setOffset] = useState(0);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [copiedActorId, setCopiedActorId] = useState(false);
  const queryPath = useMemo(() => {
    const params = new URLSearchParams({ limit: String(pageSize), offset: String(offset) });
    if (actionFilter !== 'all') params.set('action', actionFilter);
    return `/admin/audit?${params.toString()}`;
  }, [actionFilter, offset]);
  const { data, reload } = useAdminData<AuditPage>(queryPath);

  const dtf = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'medium', timeStyle: 'short' });
  const page = data.state === 'ready' ? data.data : null;
  const entries = page?.entries ?? [];
  const availableActions = useMemo<DropdownOption<string>[]>(() => {
    const actions = Array.from(new Set(entries.map((entry) => entry.action))).sort();
    return [
      { value: 'all', label: t('admin.audit.allActions') },
      ...actions.map((action) => ({ value: action, label: action })),
    ];
  }, [entries, t]);
  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((entry) =>
      [entry.action, entry.actorId ?? '', entry.subject, JSON.stringify(entry.detail)].some((value) => value.toLowerCase().includes(q)),
    );
  }, [entries, search]);
  const uniqueActorsCount = useMemo(() => new Set(entries.map((entry) => entry.actorId).filter(Boolean)).size, [entries]);
  const lastEvent = entries[0];
  const pageStart = page && page.total > 0 ? page.offset + 1 : 0;
  const pageEnd = page ? page.offset + entries.length : 0;
  const hasPrevious = Boolean(page && page.offset > 0);
  const hasNext = Boolean(page && pageEnd < page.total);

  const handleCopyActorId = useCallback(async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedActorId(true);
      window.setTimeout(() => setCopiedActorId(false), 2000);
    } catch {
      setCopiedActorId(false);
    }
  }, []);

  const columns: TableColumn<AuditEntry>[] = [
    {
      key: 'when',
      header: t('admin.audit.colWhen'),
      primary: true,
      cell: (entry) => <span className="lf-caption text-content-muted">{dtf.format(new Date(entry.createdAt))}</span>,
    },
    {
      key: 'action',
      header: t('admin.audit.colAction'),
      cell: (entry) => <Badge className="bg-primary-soft text-primary font-mono text-xs">{entry.action}</Badge>,
    },
    {
      key: 'actor',
      header: t('admin.audit.colActor'),
      cell: (entry) => <span className="lf-caption font-mono text-content-muted" title={entry.actorId ?? undefined}>{shortId(entry.actorId) ?? t('admin.audit.system')}</span>,
    },
    {
      key: 'subject',
      header: t('admin.audit.colSubject'),
      cell: (entry) => <span className="lf-body max-w-[200px] truncate text-content-muted">{entry.subject || t('admin.audit.emptyValue')}</span>,
    },
    {
      key: 'detail',
      header: t('admin.audit.colDetail'),
      cell: (entry) => (
        <code className="lf-caption block max-w-xs truncate rounded-sm bg-surface-sunken px-2 py-0.5 font-mono text-content-muted">
          {Object.keys(entry.detail).length ? JSON.stringify(entry.detail) : t('admin.audit.emptyValue')}
        </code>
      ),
    },
    {
      key: 'actions',
      header: t('admin.audit.colActions'),
      cell: (entry) => (
        <div className="flex justify-end">
          <AdminAction tone="neutral" icon="visibility" onClick={() => setSelectedEntry(entry)}>
            {t('admin.audit.viewDetail')}
          </AdminAction>
        </div>
      ),
    },
  ];

  return (
    <AdminPage titleKey="admin.audit.title" subtitleKey="admin.audit.subtitle">
      <div className="flex flex-col gap-6">
        {page && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={<Icon name="history" className="!text-[24px]" />} value={formatNumber(page.total, i18n.resolvedLanguage)} label={t('admin.audit.totalEvents')} tone="primary" />
            <StatCard icon={<Icon name="view_list" className="!text-[24px]" />} value={formatNumber(entries.length, i18n.resolvedLanguage)} label={t('admin.audit.loadedEvents')} tone="secondary" />
            <StatCard icon={<Icon name="person" className="!text-[24px]" />} value={formatNumber(uniqueActorsCount, i18n.resolvedLanguage)} label={t('admin.audit.uniqueActorsPage')} tone="accent" />
            <StatCard icon={<Icon name="schedule" className="!text-[24px]" />} value={lastEvent ? dtf.format(new Date(lastEvent.createdAt)) : t('admin.audit.noRecentEvent')} label={t('admin.audit.lastEvent')} tone="primary" />
          </div>
        )}

        <Card className="flex flex-col gap-4 border border-outline/50 p-4 shadow-glass lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor="audit-search" className="lf-label text-content">{t('admin.audit.searchLabel')}</label>
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 !text-[18px] -translate-y-1/2 text-content-muted" />
              <input
                id="audit-search"
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('admin.audit.searchPlaceholder')}
                className="w-full rounded-md border border-outline/40 bg-surface-sunken py-2 pl-9 pr-4 text-sm text-content placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <p className="lf-caption text-content-muted">{t('admin.audit.searchScope')}</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="lf-label text-content-muted">{t('admin.audit.actionFilter')}</span>
              <Dropdown value={actionFilter} options={availableActions} onChange={(value) => { setOffset(0); setActionFilter(value); }} ariaLabel={t('admin.audit.actionFilter')} align="left" />
            </div>
            <AdminAction tone="neutral" icon="refresh" onClick={() => void reload()}>{t('admin.audit.refresh')}</AdminAction>
          </div>
        </Card>

        {data.state === 'error' ? (
          <Unavailable code={data.code} />
        ) : data.state === 'ready' ? (
          <>
            {filteredEntries.length === 0 ? (
              <AdminEmpty icon="history" message={entries.length === 0 ? t('admin.audit.empty') : t('admin.audit.noMatch')} />
            ) : (
              <Table columns={columns} rows={filteredEntries} rowKey={(entry) => entry.id} />
            )}
            <div className="flex flex-col gap-3 rounded-md border border-outline/40 bg-surface-sunken/40 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="lf-caption text-content-muted">{t('admin.audit.rangeSummary', { start: pageStart, end: pageEnd, total: data.data.total })}</p>
              <div className="flex items-center gap-2">
                <AdminAction tone="neutral" icon="chevron_left" onClick={() => setOffset(Math.max(0, offset - pageSize))} disabled={!hasPrevious}>{t('admin.audit.previous')}</AdminAction>
                <AdminAction tone="neutral" icon="chevron_right" onClick={() => setOffset(offset + pageSize)} disabled={!hasNext}>{t('admin.audit.next')}</AdminAction>
              </div>
            </div>
          </>
        ) : (
          <AdminEmpty icon="hourglass_empty" message={t('admin.loading')} />
        )}

        {selectedEntry && (
          <AdminDialog title={t('admin.audit.modalTitle')} onClose={() => setSelectedEntry(null)} className="max-w-2xl gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline/50 pb-4">
              <div className="flex items-center gap-3">
                <span className="lf-tile h-10 w-10 text-accent"><Icon name="history" className="!text-[20px]" /></span>
                <div>
                  <p className="lf-label text-content">{selectedEntry.action}</p>
                  <p className="lf-caption text-content-muted">{dtf.format(new Date(selectedEntry.createdAt))}</p>
                </div>
              </div>
              <Badge className="bg-success-soft text-success-strong">{t('admin.audit.immutableRecord')}</Badge>
            </div>
            <div className="grid gap-4 rounded-md border border-outline/30 bg-surface-sunken/30 p-4 sm:grid-cols-2">
              <div><span className="lf-caption block text-content-muted">{t('admin.audit.colEventId')}</span><span className="mt-0.5 block font-mono font-bold text-content">#{selectedEntry.id}</span></div>
              <div><span className="lf-caption block text-content-muted">{t('admin.audit.colSubject')}</span><span className="mt-0.5 block break-all font-mono text-sm text-content">{selectedEntry.subject || t('admin.audit.emptyValue')}</span></div>
              <div className="sm:col-span-2">
                <span className="lf-caption block text-content-muted">{t('admin.audit.colActor')}</span>
                {selectedEntry.actorId ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="break-all font-mono text-xs font-semibold text-content">{selectedEntry.actorId}</span>
                    <AdminAction tone={copiedActorId ? 'success' : 'neutral'} icon={copiedActorId ? 'check' : 'content_copy'} onClick={() => void handleCopyActorId(selectedEntry.actorId!)}>
                      {copiedActorId ? t('admin.audit.copied') : t('admin.audit.copyActorId')}
                    </AdminAction>
                  </div>
                ) : <span className="mt-1 block text-sm text-content-muted">{t('admin.audit.system')}</span>}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <SectionHeading icon="data_object" tone="muted" as="h3" className="mb-0" meta={t('admin.audit.readOnly')}>{t('admin.audit.colDetail')}</SectionHeading>
              <pre className="max-h-[42vh] overflow-auto rounded-md border border-outline/40 bg-surface-sunken p-4 text-xs leading-relaxed text-content-muted">{JSON.stringify(selectedEntry.detail, null, 2)}</pre>
            </div>
            <div className="flex justify-end pt-1"><AdminAction tone="neutral" onClick={() => setSelectedEntry(null)}>{t('admin.audit.close')}</AdminAction></div>
          </AdminDialog>
        )}
      </div>
    </AdminPage>
  );
}
