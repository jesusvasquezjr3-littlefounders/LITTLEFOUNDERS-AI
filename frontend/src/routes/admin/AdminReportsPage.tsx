import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Table, type TableColumn } from '@/components/ui';
import { AdminAction, AdminDialog, AdminEmpty, AdminPage, Unavailable, useAdminData, useAdminMutation } from './adminShared';

/*
 * E.3's platform-level review queue (manage_support). Every social report
 * routes here, and the automatic pattern trigger opens cases with
 * origin "pattern". Detail shows the bounded report records (predefined
 * category + capped optional note — nothing free-form reaches staff), and
 * Resolve closes the case through Core's service-only transaction, which
 * records the deciding actor in the central audit trail.
 */

interface ReportCase {
  subjectId: string;
  origin: 'report' | 'pattern';
  status: 'open' | 'resolved';
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  reportCount: number;
  openReportCount: number;
}

interface ReportRow {
  id: string;
  reporterId: string;
  category: 'unwanted_contact' | 'harassment' | 'inappropriate_content' | 'impersonation' | 'other';
  note: string | null;
  status: 'open' | 'resolved';
  createdAt: string;
  resolvedAt: string | null;
}

interface CaseDetail extends ReportCase {
  reports: ReportRow[];
}

const ORIGIN_TONE: Record<string, string> = {
  report: 'bg-warning-soft text-warning-strong',
  pattern: 'bg-error-soft text-error-strong',
};

function shortId(id: string): string {
  return `${id.slice(0, 8)}…`;
}

export function AdminReportsPage() {
  const { t, i18n } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  const { data, reload } = useAdminData<{ cases: ReportCase[]; total: number }>('/admin/reports');
  const { data: detail, reload: reloadDetail } = useAdminData<CaseDetail>(`/admin/reports/${selected ?? ''}`, selected !== null);
  const mutate = useAdminMutation();
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState(false);

  const dtf = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'medium', timeStyle: 'short' });
  const cases = data.state === 'ready' ? data.data.cases : [];

  const columns: TableColumn<ReportCase>[] = [
    {
      key: 'subject',
      header: t('admin.reports.colSubject'),
      primary: true,
      cell: (entry) => <span className="lf-caption font-mono text-content">{shortId(entry.subjectId)}</span>,
    },
    {
      key: 'origin',
      header: t('admin.reports.colOrigin'),
      cell: (entry) => <Badge className={ORIGIN_TONE[entry.origin]}>{t(`admin.reports.origin.${entry.origin}`)}</Badge>,
    },
    {
      key: 'counts',
      header: t('admin.reports.colCounts'),
      cell: (entry) => <span className="lf-caption text-content-muted">{entry.openReportCount}/{entry.reportCount}</span>,
    },
    {
      key: 'lastSeen',
      header: t('admin.reports.colLastSeen'),
      cell: (entry) => <span className="lf-caption text-content-muted">{dtf.format(new Date(entry.lastSeenAt))}</span>,
    },
    {
      key: 'status',
      header: t('admin.reports.colStatus'),
      cell: (entry) => <Badge className={entry.status === 'open' ? 'bg-warning-soft text-warning-strong' : 'bg-success-soft text-success-strong'}>{t(`admin.reports.status.${entry.status}`)}</Badge>,
    },
    {
      key: 'actions',
      header: t('admin.reports.colActions'),
      cell: (entry) => <AdminAction icon="visibility" onClick={() => { setResolveError(false); setSelected(entry.subjectId); }}>{t('admin.reports.open')}</AdminAction>,
    },
  ];

  async function resolve(subjectId: string) {
    if (resolving) return;
    setResolving(true); setResolveError(false);
    const result = await mutate(`/admin/reports/${subjectId}/status`, { status: 'resolved' });
    setResolving(false);
    if (result.error) {
      setResolveError(true);
      return;
    }
    await reloadDetail();
    await reload();
  }

  const detailReady = detail.state === 'ready' ? detail.data : null;

  return (
    <AdminPage titleKey="admin.reports.title" subtitleKey="admin.reports.subtitle">
      {data.state === 'error' ? (
        <Unavailable code={data.code} />
      ) : cases.length === 0 && data.state === 'ready' ? (
        <AdminEmpty icon="gpp_good" message={t('admin.reports.empty')} />
      ) : (
        <Card className="shadow-glass border border-outline/50">
          <Table columns={columns} rows={cases} rowKey={(entry) => entry.subjectId} />
        </Card>
      )}

      {selected !== null && (
        <AdminDialog title={t('admin.reports.detailTitle')} onClose={() => setSelected(null)}>
          {detail.state === 'loading' ? (
            <p className="lf-body text-content-muted">{t('admin.reports.loading')}</p>
          ) : detail.state === 'error' || !detailReady ? (
            <Unavailable code={detail.state === 'error' ? detail.code : 'INTERNAL'} />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="lf-caption font-mono text-content">{detailReady.subjectId}</span>
                <Badge className={ORIGIN_TONE[detailReady.origin]}>{t(`admin.reports.origin.${detailReady.origin}`)}</Badge>
                <Badge className={detailReady.status === 'open' ? 'bg-warning-soft text-warning-strong' : 'bg-success-soft text-success-strong'}>
                  {t(`admin.reports.status.${detailReady.status}`)}
                </Badge>
              </div>
              <ul className="flex flex-col gap-3">
                {detailReady.reports.map((report) => (
                  <li key={report.id} className="rounded-md border border-outline/50 bg-surface-sunken/40 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-primary-soft text-primary">{t(`profile.report.category.${report.category}`)}</Badge>
                      <span className="lf-caption text-content-muted">{dtf.format(new Date(report.createdAt))}</span>
                      <span className="lf-caption font-mono text-content-faint">{shortId(report.reporterId)}</span>
                    </div>
                    {report.note && <p className="lf-body mt-2 text-content">{report.note}</p>}
                  </li>
                ))}
                {detailReady.reports.length === 0 && <p className="lf-body text-content-muted">{t('admin.reports.noReports')}</p>}
              </ul>
              {resolveError && <p className="lf-body text-error" role="alert">{t('admin.reports.resolveFailed')}</p>}
              <div className="flex flex-wrap items-center gap-2">
                {detailReady.status === 'open' && (
                  <AdminAction tone="success" icon="task_alt" disabled={resolving} onClick={() => void resolve(detailReady.subjectId)}>
                    {t('admin.reports.resolve')}
                  </AdminAction>
                )}
              </div>
            </div>
          )}
        </AdminDialog>
      )}
    </AdminPage>
  );
}
