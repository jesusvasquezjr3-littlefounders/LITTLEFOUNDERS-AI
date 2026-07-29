import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Badge, Card } from '@/components/ui';
import { AdminAction, AdminEmpty, AdminPage, Unavailable } from './adminShared';

interface EmailEntry {
  id: string;
  to: string;
  subject: string;
  status: string;
  templateType: string;
  locale?: string;
  userId?: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

interface EmailSummary {
  total: number;
  statuses: Record<string, number>;
  templates: Record<string, number>;
}

const STATUS_TONES: Record<string, string> = {
  queued: 'bg-warning-soft text-warning-strong',
  // 'relayed' = the SMTP path handed the message to Amazon SES and SES accepted
  // it. That is a success as far as Courier can observe; only a downstream
  // bounce webhook could promote it to 'delivered'.
  relayed: 'bg-success-soft text-success-strong',
  delivered: 'bg-success-soft text-success-strong',
  failed: 'bg-error-soft text-error-strong',
};

export function AdminEmailDashboard() {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [entries, setEntries] = useState<EmailEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<EmailSummary | null>(null);
  const [page, setPage] = useState(0);
  const PER_PAGE = 25;

  const load = useCallback(async (p: number) => {
    setLoading(true);
    const token = await getToken();
    const [logsRes, summaryRes] = await Promise.all([
      api<{ entries: EmailEntry[]; total: number }>(`/admin/emails/logs?limit=${PER_PAGE}&offset=${p * PER_PAGE}`, { token }),
      api<EmailSummary>('/admin/emails/summary', { token }),
    ]);
    if (logsRes.error) { setErrorCode(logsRes.error.code); setLoading(false); return; }
    setEntries(logsRes.data.entries);
    setTotal(logsRes.data.total);
    if (!summaryRes.error) setSummary(summaryRes.data);
    setErrorCode(null);
    setLoading(false);
  }, [getToken]);

  useEffect(() => { void load(page); }, [load, page]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const df = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <AdminPage titleKey="admin.emails.title" subtitleKey="admin.emails.subtitle">
      {errorCode ? (
        <Unavailable code={errorCode} />
      ) : (
        <>
          {summary && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="flex flex-col gap-1 p-4">
                <p className="lf-caption text-content-muted">{t('admin.emails.totalSent')}</p>
                <p className="lf-display-lg text-content">{summary.total}</p>
              </Card>
              {Object.entries(summary.statuses).map(([k, v]) => (
                <Card key={k} className="flex flex-col gap-1 p-4">
                  <p className="lf-caption text-content-muted">
                    {t(`admin.emails.status.${k}`, k)}
                  </p>
                  <p className="lf-display-lg text-content">{v}</p>
                </Card>
              ))}
            </div>
          )}

          {loading ? (
            <AdminEmpty icon="hourglass_empty" message={t('admin.loading')} />
          ) : entries.length === 0 ? (
            <AdminEmpty icon="mail" message={t('admin.emails.empty')} />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-outline">
                      <th className="lf-label py-3 pr-4 text-content-muted">{t('admin.emails.colTo')}</th>
                      <th className="lf-label py-3 pr-4 text-content-muted">{t('admin.emails.colSubject')}</th>
                      <th className="lf-label py-3 pr-4 text-content-muted">{t('admin.emails.colType')}</th>
                      <th className="lf-label py-3 pr-4 text-content-muted">{t('admin.emails.colStatus')}</th>
                      <th className="lf-label py-3 pr-4 text-content-muted">{t('admin.emails.colDate')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline">
                    {entries.map((e) => (
                      <tr key={e.id} className="hover:bg-surface-sunken/50">
                        <td className="lf-body py-3 pr-4">{e.to}</td>
                        <td className="lf-body py-3 pr-4 max-w-[200px] truncate text-content-muted">{e.subject}</td>
                        <td className="py-3 pr-4">
                          <Badge className="bg-surface-sunken text-content-muted text-xs">{e.templateType}</Badge>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge className={STATUS_TONES[e.status] ?? 'bg-surface-sunken text-content-muted'}>
                            {t(`admin.emails.status.${e.status}`, e.status)}
                          </Badge>
                        </td>
                        <td className="lf-caption py-3 pr-4 text-content-muted">
                          {df.format(new Date(e.createdAt))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="lf-caption text-content-muted">
                    {t('admin.emails.showing', { from: page * PER_PAGE + 1, to: Math.min((page + 1) * PER_PAGE, total), total })}
                  </p>
                  <div className="flex gap-2">
                    <AdminAction tone="neutral" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>{t('admin.emails.prev')}</AdminAction>
                    <AdminAction tone="neutral" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>{t('admin.emails.next')}</AdminAction>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </AdminPage>
  );
}
