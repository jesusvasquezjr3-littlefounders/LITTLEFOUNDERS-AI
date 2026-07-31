import { useTranslation } from 'react-i18next';
import { Table, type TableColumn } from '@/components/ui';
import { AdminEmpty, AdminPage, Unavailable, useAdminData } from './adminShared';

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
  const dtf = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'short', timeStyle: 'short' });

  const columns: TableColumn<AuditEntry>[] = [
    { key: 'when', header: t('admin.audit.colWhen'), primary: true, cell: (e) => <span className="lf-number">{dtf.format(new Date(e.createdAt))}</span> },
    { key: 'action', header: t('admin.audit.colAction'), cell: (e) => <span className="lf-number text-content">{e.action}</span> },
    { key: 'actor', header: t('admin.audit.colActor'), cell: (e) => <span className="lf-number text-content-muted" title={e.actorId ?? ''}>{shortId(e.actorId)}</span> },
    { key: 'subject', header: t('admin.audit.colSubject'), cell: (e) => <span className="lf-number text-content-muted" title={e.subject}>{e.subject ? `${e.subject.slice(0, 12)}…` : null}</span> },
    {
      key: 'detail',
      header: t('admin.audit.colDetail'),
      cell: (e) => (
        <code className="lf-caption max-w-xs truncate rounded bg-surface-sunken px-1.5 py-0.5 text-content-muted">
          {Object.keys(e.detail).length ? JSON.stringify(e.detail) : null}
        </code>
      ),
    },
  ];

  return (
    <AdminPage titleKey="admin.audit.title" subtitleKey="admin.audit.subtitle">
      {data.state === 'error' ? (
        <Unavailable code={data.code} />
      ) : data.state === 'ready' ? (
        data.data.entries.length === 0 ? (
          <AdminEmpty icon="history" message={t('admin.audit.empty')} />
        ) : (
          <Table columns={columns} rows={data.data.entries} rowKey={(e) => e.id} />
        )
      ) : (
        <AdminEmpty icon="hourglass_empty" message={t('admin.loading')} />
      )}
    </AdminPage>
  );
}
