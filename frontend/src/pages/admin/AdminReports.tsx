import { useState, useEffect } from "react";
import { Flag, AlertCircle, Clock, CheckCircle2, XCircle, Filter, RefreshCw, ExternalLink, Video, FileText, Eye, Play, Music } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PlatformReport {
  public_id: string;
  reporter_email: string;
  reporter_public_id?: string;
  report_type: 'bug' | 'abuse' | 'suggestion' | 'content' | 'other';
  subject: string;
  reported_url?: string;
  context: string;
  evidence_url?: string;
  status: 'pending' | 'in_review' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  report_metadata?: any;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

interface ReportStats {
  total: number;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

function getToken() {
  return localStorage.getItem("token") ?? "";
}

const TYPE_LABELS: Record<string, string> = {
  bug: "🐛 Error técnico",
  abuse: "🚫 Uso indebido",
  suggestion: "💡 Sugerencia",
  content: "⚠️ Contenido",
  other: "📝 Otro",
};

const STATUS_CONFIG: Record<string, { label_key: string; icon: React.ElementType; badge: string }> = {
  pending: { label_key: "admin.stats.pending", icon: Clock, badge: "corp-badge--brand" },
  in_review: { label_key: "admin.stats.in_review", icon: AlertCircle, badge: "corp-badge--info" },
  resolved: { label_key: "admin.stats.resolved", icon: CheckCircle2, badge: "corp-badge--success" },
  closed: { label_key: "admin.stats.closed", icon: XCircle, badge: "" },
};

const PRIORITY_BADGES: Record<string, string> = {
  low: "",
  medium: "corp-badge--brand",
  high: "corp-badge--info",
  critical: "corp-badge--danger",
};

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return "hace un momento";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days}d`;
}

// ── Report Detail Panel ────────────────────────────────────────────────────────

function ReportDetail({
  report,
  onUpdate,
  onClose,
}: {
  report: PlatformReport;
  onUpdate: (updated: PlatformReport) => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState(report.status);
  const [priority, setPriority] = useState(report.priority);
  const [notes, setNotes] = useState(report.admin_notes ?? "");
  const [saving, setSaving] = useState(false);

  const STATUS_OPTIONS = ["pending", "in_review", "resolved", "closed"] as const;
  const PRIORITY_OPTIONS = ["low", "medium", "high", "critical"] as const;

  const { t } = useTranslation("reports");
  const handleSave = async () => {
    setSaving(true);
    try {
      const idToUse = report.public_id;
      const res = await fetch(`${API_BASE}/reports/${idToUse}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ status, priority, admin_notes: notes }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      const updated = await res.json();
      onUpdate(updated);
    } catch {
      alert(t("admin.messages.save_error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="corp-panel overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-slate-200 dark:border-white/10">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-slate-400 dark:text-slate-500">#{report.public_id?.split("-")[0]}</span>
            <span className="corp-badge">
              {TYPE_LABELS[report.report_type] ?? report.report_type}
            </span>
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white text-lg leading-tight">{report.subject}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{report.reporter_email} · {timeAgo(report.created_at)}</p>
        </div>
        <button onClick={onClose} className="corp-btn-ghost p-1.5 rounded-lg">
          <XCircle className="w-5 h-5" />
        </button>
      </div>

      <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
        {/* Context */}
        <div className="space-y-1.5">
          <p className="corp-eyebrow">{t("admin.labels.description")}</p>
          <p className="corp-panel-subtle text-sm text-slate-700 dark:text-slate-300 rounded-xl p-4 leading-relaxed whitespace-pre-wrap">
            {report.context}
          </p>
        </div>

        {/* URL */}
        {report.reported_url && (
          <div className="space-y-1.5">
            <p className="corp-eyebrow">{t('reports:admin.labels.reported_url', 'URL Reportada')}</p>
            <a
              href={report.reported_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline bg-blue-50 dark:bg-blue-950/30 px-4 py-2 rounded-xl"
            >
              <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{report.reported_url}</span>
            </a>
          </div>
        )}

        {/* Evidence Section */}
        {report.evidence_url && (
          <div className="space-y-2">
            <p className="corp-eyebrow ml-1">{t("admin.labels.evidence")}</p>
            <div className="corp-panel-subtle rounded-2xl p-4 group">
              {(() => {
                const url = report.evidence_url || "";

                // Handle local fallback case where file wasn't uploaded completely
                if (url.startsWith("[attached:")) {
                  const filename = url.replace("[attached:", "").replace("]", "");
                  return (
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-500 dark:text-violet-400">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{t('reports:admin.evidence.fallback_title', 'Archivo de Texto / Fallback Local')}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{t('reports:admin.evidence.fallback_desc', 'La evidencia de {{filename}} no se sincronizó a la nube (falta VITE_SUPABASE_URL).', { filename })}</p>
                      </div>
                    </div>
                  );
                }

                const cleanUrl = url.split("?")[0].toLowerCase();

                if (cleanUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
                  return (
                    <div className="space-y-3">
                      <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 bg-slate-200 dark:bg-[#0d1426] group">
                        <img src={url} alt="Evidence" className="w-full h-auto max-h-[300px] object-contain transition-transform duration-500 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <a href={url} target="_blank" rel="noopener noreferrer" className="p-3 bg-white rounded-full text-slate-900 shadow-xl transition-transform hover:scale-110">
                            <Eye className="w-5 h-5" />
                          </a>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 text-center font-medium">{t('reports:admin.evidence.image_preview', 'Previsualización de imagen')}</p>
                    </div>
                  );
                }

                if (cleanUrl.match(/\.(mp4|webm|ogg|mov)$/i)) {
                  return (
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 dark:text-blue-400">
                        <Video className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{t('reports:admin.evidence.video_title', 'Archivo de Video')}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{url.split("/").pop()}</p>
                      </div>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="corp-btn-primary p-2.5 rounded-xl inline-flex">
                        <Play className="w-4 h-4" />
                      </a>
                    </div>
                  );
                }

                if (cleanUrl.match(/\.(mp3|wav|flac)$/i)) {
                  return (
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 dark:text-purple-400">
                        <Music className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{t('reports:admin.evidence.audio_title', 'Archivo de Audio')}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{url.split("/").pop()}</p>
                      </div>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="corp-btn-primary p-2.5 rounded-xl inline-flex">
                        <Play className="w-4 h-4" />
                      </a>
                    </div>
                  );
                }

                return (
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-500/10 flex items-center justify-center text-slate-500 dark:text-slate-400">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{t('reports:admin.evidence.other_title', 'Otro Archivo')}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{url}</p>
                    </div>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="corp-btn-secondary p-2.5 rounded-xl inline-flex">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Admin controls */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="corp-label">{t("admin.labels.status")}</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as PlatformReport["status"])}
              className="corp-input">
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{t(STATUS_CONFIG[s].label_key)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="corp-label">{t("admin.labels.priority")}</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as PlatformReport["priority"])}
              className="corp-input">
              {PRIORITY_OPTIONS.map(p => (
                <option key={p} value={p}>{t(`admin.priorities.${p}`)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Admin Notes */}
        <div className="space-y-1.5">
          <label className="corp-label">{t("admin.labels.admin_notes")}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder={t("admin.labels.notes_placeholder")}
            className="corp-input resize-none"
          />
        </div>

        <button onClick={handleSave} disabled={saving}
          className="corp-btn-primary w-full h-11 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? t("admin.actions.saving") : t("admin.actions.save")}
        </button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AdminReports() {
  const { t } = useTranslation("reports");
  const [reports, setReports] = useState<PlatformReport[]>([]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<PlatformReport | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${getToken()}` };
      const params = new URLSearchParams();
      if (filterStatus) params.set("report_status", filterStatus);
      if (filterType) params.set("report_type", filterType);

      const [reportsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/reports/?${params.toString()}&limit=100`, { headers }),
        fetch(`${API_BASE}/reports/stats`, { headers }),
      ]);

      if (reportsRes.ok) setReports(await reportsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filterStatus, filterType]);

  const handleUpdate = (updated: PlatformReport) => {
    setReports((prev) => prev.map((r) => (r.public_id === updated.public_id ? updated : r)));
    setSelectedReport(updated);
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
    const Icon = cfg.icon;
    return (
      <span className={cn("corp-badge", cfg.badge)}>
        <Icon className="w-3 h-3" />
        {t(cfg.label_key)}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Premium Admin Header */}
      <div className="corp-panel p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex flex-row items-center gap-4 md:gap-5 w-full md:w-auto">
              <div className="corp-icon-chip w-12 h-12 md:w-14 md:h-14 shrink-0">
                  <Flag className="w-5 h-5 md:w-7 md:h-7" />
              </div>
              <div className="text-left">
                  <h1 className="corp-display text-2xl md:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
                      {t("admin.page_title")}
                  </h1>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 leading-tight">
                    {stats?.total ?? 0} {t("admin.stats.total").toLowerCase()} · {stats?.by_status?.pending ?? 0} {t("admin.stats.pending").toLowerCase()}
                  </p>
              </div>
          </div>

          <button onClick={fetchData} disabled={loading}
            className="corp-btn-secondary h-11 px-6 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            {t("admin.actions.refresh")}
          </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const Icon = cfg.icon;
            return (
              <button key={key} onClick={() => setFilterStatus(filterStatus === key ? "" : key)}
                className={cn("corp-card p-4 text-left", filterStatus === key && "ring-2 ring-indigo-400 dark:ring-indigo-500")}>
                <div className="flex items-center justify-between mb-2">
                  <Icon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">{stats.by_status[key] ?? 0}</span>
                </div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t(cfg.label_key)}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="w-4 h-4 text-slate-400 dark:text-slate-500" />
        {Object.entries(TYPE_LABELS).map(([key, label]) => (
          <button key={key} onClick={() => setFilterType(filterType === key ? "" : key)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full border transition-colors",
              filterType === key
                ? "bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-500 dark:border-indigo-500"
                : "bg-white dark:bg-[#0d1426] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-500/50"
            )}>
            {label}
          </button>
        ))}
        {(filterStatus || filterType) && (
          <button onClick={() => { setFilterStatus(""); setFilterType(""); }}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 underline">
            {t("admin.actions.clear_filters")}
          </button>
        )}
      </div>

      {/* Content */}
      <div className={`grid gap-6 ${selectedReport ? "md:grid-cols-[1fr_420px]" : ""}`}>
        {/* Reports List */}
        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-slate-400 dark:text-slate-500 gap-2">
              <RefreshCw className="w-5 h-5 animate-spin" /> {t('reports:admin.messages.loading', 'Cargando...')}
            </div>
          ) : reports.length === 0 ? (
            <div className="corp-empty">
              <CheckCircle2 className="w-10 h-10" />
              <p className="text-sm">{t("admin.messages.no_reports")}</p>
            </div>
          ) : (
            reports.map((report) => (
              <div key={report.public_id}
                onClick={() => setSelectedReport(selectedReport?.public_id === report.public_id ? null : report)}
                className={cn(
                  "corp-card p-4 cursor-pointer",
                  selectedReport?.public_id === report.public_id && "ring-2 ring-indigo-400 dark:ring-indigo-500"
                )}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">#{report.public_id?.split("-")[0]}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{t(`form.types.${report.report_type}`)}</span>
                      <span className={cn("corp-badge", PRIORITY_BADGES[report.priority])}>
                        {t(`admin.priorities.${report.priority}`)}
                      </span>
                    </div>
                    <p className="font-medium text-sm text-slate-900 dark:text-white truncate">{report.subject}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{report.context}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{report.reporter_email} · {timeAgo(report.created_at)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <StatusBadge status={report.status} />
                    {report.evidence_url && (
                      <span className="text-xs text-blue-600 dark:text-blue-400">📎 {t("admin.labels.evidence")}</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail Panel */}
        {selectedReport && (
          <div className="sticky top-4">
            <ReportDetail
              report={selectedReport}
              onUpdate={handleUpdate}
              onClose={() => setSelectedReport(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
