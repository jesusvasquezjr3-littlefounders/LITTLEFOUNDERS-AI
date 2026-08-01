import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Icon, StatCard, Table, type TableColumn } from '@/components/ui';
import { AdminAction, AdminEmpty, AdminPage, Unavailable, useAdminData } from './adminShared';

interface AuditEntry {
  id: number;
  actorId: string | null;
  action: string;
  subject: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

function shortId(id: string | null): string | null {
  return id ? `${id.slice(0, 8)}…` : null;
}

export function AdminAuditPage() {
  const { t, i18n } = useTranslation();
  const { data } = useAdminData<{ entries: AuditEntry[] }>('/admin/audit?limit=100');
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [copiedActorId, setCopiedActorId] = useState(false);

  const dtf = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'medium', timeStyle: 'short' });
  const entries = useMemo(() => (data.state === 'ready' ? data.data.entries : []), [data]);

  // Statistics
  const totalEvents = entries.length;
  const uniqueActorsCount = useMemo(() => {
    const set = new Set(entries.map((e) => e.actorId).filter(Boolean));
    return set.size;
  }, [entries]);

  const topAction = useMemo(() => {
    if (entries.length === 0) return '—';
    const counts: Record<string, number> = {};
    for (const e of entries) {
      counts[e.action] = (counts[e.action] ?? 0) + 1;
    }
    let best = '—';
    let max = -1;
    for (const [act, c] of Object.entries(counts)) {
      if (c > max) {
        max = c;
        best = act;
      }
    }
    return best;
  }, [entries]);

  const availableActions = useMemo(() => {
    const set = new Set(entries.map((e) => e.action));
    return Array.from(set).sort();
  }, [entries]);

  // Filtered rows
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        e.action.toLowerCase().includes(q) ||
        (e.actorId && e.actorId.toLowerCase().includes(q)) ||
        (e.subject && e.subject.toLowerCase().includes(q)) ||
        JSON.stringify(e.detail).toLowerCase().includes(q);

      const matchesAction = actionFilter === 'all' || e.action === actionFilter;
      return matchesSearch && matchesAction;
    });
  }, [entries, search, actionFilter]);

  const handleCopyActorId = useCallback((id: string) => {
    void navigator.clipboard.writeText(id);
    setCopiedActorId(true);
    setTimeout(() => setCopiedActorId(false), 2000);
  }, []);

  const columns: TableColumn<AuditEntry>[] = [
    { key: 'when', header: t('admin.audit.colWhen'), primary: true, cell: (e) => <span className="lf-caption text-content-muted">{dtf.format(new Date(e.createdAt))}</span> },
    { key: 'action', header: t('admin.audit.colAction'), cell: (e) => <Badge className="bg-primary-soft text-primary font-mono text-xs">{e.action}</Badge> },
    { key: 'actor', header: t('admin.audit.colActor'), cell: (e) => <span className="lf-caption font-mono text-content-muted" title={e.actorId ?? ''}>{shortId(e.actorId) || 'system'}</span> },
    { key: 'subject', header: t('admin.audit.colSubject'), cell: (e) => <span className="lf-body max-w-[200px] truncate text-content-muted">{e.subject || '—'}</span> },
    {
      key: 'detail',
      header: t('admin.audit.colDetail'),
      cell: (e) => (
        <code className="lf-caption max-w-xs truncate rounded bg-surface-sunken px-2 py-0.5 text-content-muted font-mono block">
          {Object.keys(e.detail).length ? JSON.stringify(e.detail) : '—'}
        </code>
      ),
    },
    {
      key: 'actions',
      header: t('admin.audit.colActions'),
      cell: (e) => (
        <div className="flex justify-end">
          <AdminAction tone="neutral" icon="visibility" onClick={() => setSelectedEntry(e)}>
            {t('admin.audit.viewDetail')}
          </AdminAction>
        </div>
      ),
    },
  ];

  return (
    <AdminPage titleKey="admin.audit.title" subtitleKey="admin.audit.subtitle">
      <div className="flex flex-col gap-6">
        {/* KPI Summary Header Cards */}
        {data.state === 'ready' && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard
              icon={<Icon name="history" className="!text-[24px]" />}
              value={totalEvents.toString()}
              label={t('admin.audit.totalEvents')}
              tone="primary"
            />
            <StatCard
              icon={<Icon name="person" className="!text-[24px]" />}
              value={uniqueActorsCount.toString()}
              label={t('admin.audit.uniqueActors')}
              tone="secondary"
            />
            <StatCard
              icon={<Icon name="bolt" className="!text-[24px]" />}
              value={topAction}
              label={t('admin.audit.topAction')}
              tone="accent"
            />
          </div>
        )}

        {/* Filter & Search Bar */}
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4 shadow-glass border border-outline/50">
          <div className="relative flex-1 min-w-[240px]">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 !text-[18px] text-content-muted pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('admin.audit.searchPlaceholder')}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-full bg-surface-sunken border border-outline/40 text-content placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>

          {availableActions.length > 0 && (
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3.5 py-2 text-xs font-bold rounded-full bg-surface-sunken border border-outline/40 text-content focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="all">{t('admin.audit.allActions')}</option>
              {availableActions.map((act) => (
                <option key={act} value={act}>{act}</option>
              ))}
            </select>
          )}
        </Card>

        {/* Audit Log Table */}
        {data.state === 'error' ? (
          <Unavailable code={data.code} />
        ) : data.state === 'ready' ? (
          filteredEntries.length === 0 ? (
            <AdminEmpty icon="history" message={entries.length === 0 ? t('admin.audit.empty') : t('admin.audit.noMatch')} />
          ) : (
            <Table columns={columns} rows={filteredEntries} rowKey={(e) => e.id} />
          )
        ) : (
          <AdminEmpty icon="hourglass_empty" message={t('admin.loading')} />
        )}

        {/* Audit Detail Inspector Modal */}
        {selectedEntry && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={() => setSelectedEntry(null)}
          >
            <div
              className="w-full max-w-xl bg-surface border border-outline rounded-2xl p-6 shadow-glass flex flex-col gap-5 max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4 pb-3 border-b border-outline/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary-soft text-primary">
                    <Icon name="history" className="!text-[24px]" />
                  </div>
                  <div>
                    <h2 className="lf-title text-content font-bold">{t('admin.audit.modalTitle')}</h2>
                    <p className="lf-caption text-content-muted mt-0.5">{dtf.format(new Date(selectedEntry.createdAt))}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEntry(null)}
                  className="p-1 rounded-full text-content-muted hover:text-content hover:bg-surface-sunken transition-colors"
                >
                  <Icon name="close" className="!text-[20px]" />
                </button>
              </div>

              {/* Actor ID Copier Banner */}
              {selectedEntry.actorId && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-surface-sunken/60 border border-outline/40">
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="lf-caption text-content-muted">{t('admin.audit.colActor')}</span>
                    <span className="font-mono text-xs text-content truncate font-semibold">{selectedEntry.actorId}</span>
                  </div>
                  <AdminAction
                    tone={copiedActorId ? 'success' : 'neutral'}
                    icon={copiedActorId ? 'check' : 'content_copy'}
                    onClick={() => handleCopyActorId(selectedEntry.actorId!)}
                  >
                    {copiedActorId ? t('admin.audit.copied') : t('admin.audit.copyActorId')}
                  </AdminAction>
                </div>
              )}

              {/* Grid Metadata */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-surface-sunken/30 border border-outline/30 text-sm">
                <div>
                  <span className="lf-caption text-content-muted block">{t('admin.audit.colEventId')}</span>
                  <span className="font-mono text-content font-bold mt-0.5 block">#{selectedEntry.id}</span>
                </div>
                <div>
                  <span className="lf-caption text-content-muted block">{t('admin.audit.colAction')}</span>
                  <Badge className="bg-primary-soft text-primary font-mono text-xs mt-1">{selectedEntry.action}</Badge>
                </div>
                <div className="col-span-2">
                  <span className="lf-caption text-content-muted block">{t('admin.audit.colSubject')}</span>
                  <span className="lf-body text-content font-medium mt-0.5 block">{selectedEntry.subject || '—'}</span>
                </div>
              </div>

              {/* Detail Payload Viewer */}
              {selectedEntry.detail && Object.keys(selectedEntry.detail).length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="lf-caption font-bold text-content">{t('admin.audit.colDetail')}</span>
                  <pre className="p-4 rounded-xl bg-surface-sunken text-xs font-mono text-content-muted border border-outline/40 overflow-x-auto max-h-48 leading-relaxed">
                    {JSON.stringify(selectedEntry.detail, null, 2)}
                  </pre>
                </div>
              )}

              {/* Footer */}
              <div className="flex justify-end pt-2">
                <AdminAction tone="neutral" onClick={() => setSelectedEntry(null)}>
                  {t('admin.audit.close')}
                </AdminAction>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminPage>
  );
}
