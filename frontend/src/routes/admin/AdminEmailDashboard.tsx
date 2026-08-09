import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Badge, Card, Icon, ProgressBar, StatCard } from '@/components/ui';
import { AdminAction, AdminDialog, AdminEmpty, AdminPage, Unavailable } from './adminShared';
import { cn } from '@/lib/utils';

interface EmailEntry {
  id: string;
  messageId?: string;
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
  locales?: Record<string, number>;
}

const STATUS_TONES: Record<string, string> = {
  queued: 'bg-warning-soft text-warning-strong',
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [templateFilter, setTemplateFilter] = useState<string>('all');
  const [selectedEntry, setSelectedEntry] = useState<EmailEntry | null>(null);
  const [copiedId, setCopiedId] = useState(false);

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

  // Calculated Stats
  const successRate = useMemo(() => {
    if (!summary || summary.total === 0) return '100';
    const relayed = summary.statuses['relayed'] ?? 0;
    const delivered = summary.statuses['delivered'] ?? 0;
    const successful = relayed + delivered;
    return Math.min(100, Math.round((successful / summary.total) * 100)).toString();
  }, [summary]);

  const activeTemplatesCount = useMemo(() => {
    if (!summary?.templates) return 0;
    return Object.keys(summary.templates).length;
  }, [summary]);

  const topLocale = useMemo(() => {
    if (!summary?.locales || Object.keys(summary.locales).length === 0) return '—';
    let best = '—';
    let max = -1;
    for (const [loc, count] of Object.entries(summary.locales)) {
      if (count > max) {
        max = count;
        best = loc;
      }
    }
    return best;
  }, [summary]);

  const templateBreakdown = useMemo(() => {
    if (!summary?.templates || summary.total === 0) return [];
    return Object.entries(summary.templates)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name,
        count,
        pct: Math.round((count / summary.total) * 100),
      }));
  }, [summary]);

  const localeBreakdown = useMemo(() => {
    if (!summary?.locales || summary.total === 0) return [];
    return Object.entries(summary.locales)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name,
        count,
        pct: Math.round((count / summary.total) * 100),
      }));
  }, [summary]);

  const availableTemplates = useMemo(() => {
    if (!summary?.templates) return [];
    return Object.keys(summary.templates).sort();
  }, [summary]);

  // Client-side filtering over current page entries
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        e.to.toLowerCase().includes(q) ||
        e.subject.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q) ||
        (e.messageId && e.messageId.toLowerCase().includes(q));

      const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
      const matchesTemplate = templateFilter === 'all' || e.templateType === templateFilter;
      return matchesSearch && matchesStatus && matchesTemplate;
    });
  }, [entries, search, statusFilter, templateFilter]);

  const handleCopyId = useCallback((id: string) => {
    void navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  }, []);

  return (
    <AdminPage titleKey="admin.emails.title" subtitleKey="admin.emails.subtitle">
      {errorCode ? (
        <Unavailable code={errorCode} />
      ) : (
        <div className="flex flex-col gap-6">
          {/* KPI Header Grid */}
          {summary && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={<Icon name="mail" className="!text-[24px]" />}
                value={summary.total.toLocaleString()}
                label={t('admin.emails.totalSent')}
                tone="primary"
              />
              <StatCard
                icon={<Icon name="check_circle" className="!text-[24px]" />}
                value={`${successRate}%`}
                label={t('admin.emails.successRate')}
                tone="secondary"
              />
              <StatCard
                icon={<Icon name="layers" className="!text-[24px]" />}
                value={activeTemplatesCount.toString()}
                label={t('admin.emails.activeTemplates')}
                tone="accent"
              />
              <StatCard
                icon={<Icon name="language" className="!text-[24px]" />}
                value={topLocale}
                label={t('admin.emails.topLocale')}
                tone="primary"
              />
            </div>
          )}

          {/* Visual Breakdown Cards (Templates & Locales) */}
          {summary && (templateBreakdown.length > 0 || localeBreakdown.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              {templateBreakdown.length > 0 && (
                <Card className="flex flex-col gap-3 p-5 shadow-glass border border-outline/50">
                  <div className="flex items-center justify-between">
                    <h3 className="lf-label font-bold text-content">{t('admin.emails.templatesBreakdown')}</h3>
                    <Badge className="bg-surface-sunken text-content-muted text-xs font-mono">{templateBreakdown.length}</Badge>
                  </div>
                  <div className="flex flex-col gap-3 mt-1">
                    {templateBreakdown.slice(0, 5).map((item) => (
                      <div key={item.name} className="flex flex-col gap-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-mono text-content">{item.name}</span>
                          <span className="text-content-muted font-mono">{item.count} ({item.pct}%)</span>
                        </div>
                        <ProgressBar value={item.pct} tone="primary" label={item.name} />
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {localeBreakdown.length > 0 && (
                <Card className="flex flex-col gap-3 p-5 shadow-glass border border-outline/50">
                  <div className="flex items-center justify-between">
                    <h3 className="lf-label font-bold text-content">{t('admin.emails.localesBreakdown')}</h3>
                    <Badge className="bg-surface-sunken text-content-muted text-xs font-mono">{localeBreakdown.length}</Badge>
                  </div>
                  <div className="flex flex-col gap-3 mt-1">
                    {localeBreakdown.slice(0, 5).map((item) => (
                      <div key={item.name} className="flex flex-col gap-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-mono text-content">{item.name}</span>
                          <span className="text-content-muted font-mono">{item.count} ({item.pct}%)</span>
                        </div>
                        <ProgressBar value={item.pct} tone="accent" label={item.name} />
                      </div>
                    ))}
                  </div>
                </Card>
              )}
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
                placeholder={t('admin.emails.searchPlaceholder')}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-full bg-surface-sunken border border-outline/40 text-content placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Status Pills */}
              <div className="flex gap-1 bg-surface-sunken p-1 rounded-full border border-outline/30 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={cn(
                    'px-3 py-1 text-xs font-bold rounded-full transition-colors whitespace-nowrap',
                    statusFilter === 'all' ? 'bg-surface text-content shadow-sm' : 'text-content-muted hover:text-content'
                  )}
                >
                  {t('admin.emails.allStatuses')}
                </button>
                {['queued', 'relayed', 'delivered', 'failed'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={cn(
                      'px-3 py-1 text-xs font-bold rounded-full transition-colors whitespace-nowrap',
                      statusFilter === st ? 'bg-surface text-content shadow-sm' : 'text-content-muted hover:text-content'
                    )}
                  >
                    {t(`admin.emails.status.${st}`, st)}
                    {summary?.statuses[st] !== undefined && (
                      <span className="ml-1 opacity-70">({summary.statuses[st]})</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Template Select */}
              {availableTemplates.length > 0 && (
                <select
                  value={templateFilter}
                  onChange={(e) => setTemplateFilter(e.target.value)}
                  aria-label={t('admin.emails.filterTemplate')}
                  className="px-3 py-2 text-xs font-bold rounded-full bg-surface-sunken border border-outline/40 text-content focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="all">{t('admin.emails.allTemplates')}</option>
                  {availableTemplates.map((tmpl) => (
                    <option key={tmpl} value={tmpl}>{tmpl}</option>
                  ))}
                </select>
              )}
            </div>
          </Card>

          {/* Logs Table */}
          {loading ? (
            <AdminEmpty icon="hourglass_empty" message={t('admin.loading')} />
          ) : filteredEntries.length === 0 ? (
            <AdminEmpty icon="mail" message={entries.length === 0 ? t('admin.emails.empty') : t('admin.emails.noMatch')} />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="overflow-x-auto rounded-xl border border-outline/50 bg-surface shadow-glass">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-outline bg-surface-sunken/40">
                      <th className="lf-label py-3 px-4 text-content-muted">{t('admin.emails.colTo')}</th>
                      <th className="lf-label py-3 px-4 text-content-muted">{t('admin.emails.colSubject')}</th>
                      <th className="lf-label py-3 px-4 text-content-muted">{t('admin.emails.colType')}</th>
                      <th className="lf-label py-3 px-4 text-content-muted">{t('admin.emails.colStatus')}</th>
                      <th className="lf-label py-3 px-4 text-content-muted">{t('admin.emails.colDate')}</th>
                      <th className="lf-label py-3 px-4 text-content-muted text-right">{t('admin.emails.colActions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline/50">
                    {filteredEntries.map((e) => (
                      <tr
                        key={e.id}
                        onClick={() => setSelectedEntry(e)}
                        className="hover:bg-surface-sunken/60 cursor-pointer transition-colors duration-150"
                      >
                        <td className="lf-body py-3 px-4 font-medium">{e.to}</td>
                        <td className="lf-body py-3 px-4 max-w-[260px] truncate text-content-muted">{e.subject}</td>
                        <td className="py-3 px-4">
                          <Badge className="bg-surface-sunken text-content-muted text-xs font-mono">{e.templateType}</Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={STATUS_TONES[e.status] ?? 'bg-surface-sunken text-content-muted'}>
                            {t(`admin.emails.status.${e.status}`, e.status)}
                          </Badge>
                        </td>
                        <td className="lf-caption py-3 px-4 text-content-muted">
                          {df.format(new Date(e.createdAt))}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <AdminAction
                            tone="neutral"
                            icon="visibility"
                            onClick={() => setSelectedEntry(e)}
                          >
                            {t('admin.emails.viewDetail')}
                          </AdminAction>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="lf-caption text-content-muted">
                    {t('admin.emails.showing', { from: page * PER_PAGE + 1, to: Math.min((page + 1) * PER_PAGE, total), total })}
                  </p>
                  <div className="flex gap-2">
                    <AdminAction tone="neutral" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>{t('admin.emails.prev')}</AdminAction>
                    <AdminAction tone="neutral" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>{t('admin.emails.next')}</AdminAction>
                  </div>
                </div>
              )}
            </div>
          )}

        {/* Email Detail Inspector Modal */}
        {selectedEntry && (
            <AdminDialog title={t('admin.emails.modalTitle')} onClose={() => setSelectedEntry(null)} className="max-w-2xl gap-5">
                <div className="flex flex-wrap items-center gap-3 border-b border-outline/50 pb-3">
                  <Icon name="mail" className="!text-[24px] text-primary" />
                  <span className="lf-caption text-content-muted">{selectedEntry.to}</span>
                  <Badge className={STATUS_TONES[selectedEntry.status] ?? 'bg-surface-sunken text-content-muted'}>
                    {t(`admin.emails.status.${selectedEntry.status}`, selectedEntry.status)}
                  </Badge>
                </div>

                {/* Message ID Copier Banner */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-surface-sunken/60 border border-outline/40">
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="lf-caption text-content-muted">{t('admin.emails.colMessageId')}</span>
                    <span className="font-mono text-xs text-content truncate font-semibold">
                      {selectedEntry.messageId || selectedEntry.id}
                    </span>
                  </div>
                  <AdminAction
                    tone={copiedId ? 'success' : 'neutral'}
                    icon={copiedId ? 'check' : 'content_copy'}
                    onClick={() => handleCopyId(selectedEntry.messageId || selectedEntry.id)}
                  >
                    {copiedId ? t('admin.emails.copied') : t('admin.emails.copyId')}
                  </AdminAction>
                </div>

                {/* Grid Metadata */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-surface-sunken/30 border border-outline/30 text-sm">
                  <div>
                    <span className="lf-caption text-content-muted block">{t('admin.emails.colType')}</span>
                    <Badge className="bg-surface text-content-muted text-xs font-mono mt-1">{selectedEntry.templateType}</Badge>
                  </div>
                  <div>
                    <span className="lf-caption text-content-muted block">{t('admin.emails.topLocale')}</span>
                    <span className="font-mono text-content font-bold mt-1 block">{selectedEntry.locale || '—'}</span>
                  </div>
                  <div>
                    <span className="lf-caption text-content-muted block">{t('admin.emails.colUserId')}</span>
                    <span className="font-mono text-xs text-content-muted truncate mt-1 block" title={selectedEntry.userId}>
                      {selectedEntry.userId || '—'}
                    </span>
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <span className="lf-caption text-content-muted block">{t('admin.emails.colSubject')}</span>
                    <span className="lf-body text-content font-medium mt-0.5 block">{selectedEntry.subject}</span>
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <span className="lf-caption text-content-muted block">{t('admin.emails.colDate')}</span>
                    <span className="lf-caption text-content font-mono mt-0.5 block">{df.format(new Date(selectedEntry.createdAt))}</span>
                  </div>
                </div>

                {/* Detail Payload Inspector */}
                {selectedEntry.detail && Object.keys(selectedEntry.detail).length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="lf-caption font-bold text-content">{t('admin.emails.colDetail')}</span>
                    <pre className="p-4 rounded-xl bg-surface-sunken text-xs font-mono text-content-muted border border-outline/40 overflow-x-auto max-h-48 leading-relaxed">
                      {JSON.stringify(selectedEntry.detail, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Footer button */}
                <div className="flex justify-end pt-2">
                  <AdminAction tone="neutral" onClick={() => setSelectedEntry(null)}>
                    {t('admin.emails.close')}
                  </AdminAction>
                </div>
            </AdminDialog>
          )}
        </div>
      )}
    </AdminPage>
  );
}
