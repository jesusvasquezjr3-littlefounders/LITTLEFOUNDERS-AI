import { useState, useEffect } from "react";
import { Flag, AlertCircle, Clock, CheckCircle2, XCircle, Filter, RefreshCw, ExternalLink, ChevronDown, Image, Video, FileText, Eye, Play, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { useTranslation } from "react-i18next";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PlatformReport {
  id: number;
  public_id: string;
  reporter_email: string;
  report_type: string;
  subject: string;
  reported_url?: string;
  context: string;
  evidence_url?: string;
  status: string;
  priority: string;
  user_id?: number;
  admin_notes?: string;
  report_metadata?: Record<string, any>;
  created_at: string;
  updated_at?: string;
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

const STATUS_CONFIG: Record<string, { label_key: string; icon: React.ElementType; color: string }> = {
  pending: { label_key: "admin.stats.pending", icon: Clock, color: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800" },
  in_review: { label_key: "admin.stats.in_review", icon: AlertCircle, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200 dark:border-blue-800" },
  resolved: { label_key: "admin.stats.resolved", icon: CheckCircle2, color: "text-green-600 bg-green-50 dark:bg-green-950/30 dark:text-green-400 border-green-200 dark:border-green-800" },
  closed: { label_key: "admin.stats.closed", icon: XCircle, color: "text-slate-500 bg-slate-50 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700" },
};

const PRIORITY_BADGES: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
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
      const idToUse = report.public_id || report.id;
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

  const cfg = STATUS_CONFIG[report.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = cfg.icon;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-slate-200 dark:border-slate-700">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-slate-400">#{report.public_id?.split("-")[0] || report.id}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {TYPE_LABELS[report.report_type] ?? report.report_type}
            </span>
          </div>
          <h3 className="font-bold text-slate-800 dark:text-white text-lg leading-tight">{report.subject}</h3>
          <p className="text-xs text-slate-500">{report.reporter_email} · {timeAgo(report.created_at)}</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
          <XCircle className="w-5 h-5" />
        </button>
      </div>

      <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
        {/* Context */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t("admin.labels.description")}</p>
          <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-xl p-4 leading-relaxed whitespace-pre-wrap">
            {report.context}
          </p>
        </div>

        {/* URL */}
        {report.reported_url && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">URL Reportada</p>
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
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">{t("admin.labels.evidence")}</p>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/50 group">
              {(() => {
                const url = report.evidence_url || "";

                // Handle local fallback case where file wasn't uploaded completely
                if (url.startsWith("[attached:")) {
                  const filename = url.replace("[attached:", "").replace("]", "");
                  return (
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 dark:text-white">Archivo de Texto / Fallback Local</p>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">La evidencia de {filename} no se sincronizó a la nube (falta VITE_SUPABASE_URL).</p>
                      </div>
                    </div>
                  );
                }

                const cleanUrl = url.split("?")[0].toLowerCase();

                if (cleanUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
                  return (
                    <div className="space-y-3">
                      <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-200 dark:bg-slate-900 group">
                        <img src={url} alt="Evidence" className="w-full h-auto max-h-[300px] object-contain transition-transform duration-500 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <a href={url} target="_blank" rel="noopener noreferrer" className="p-3 bg-white rounded-full text-slate-900 shadow-xl transition-transform hover:scale-110">
                            <Eye className="w-5 h-5" />
                          </a>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 text-center font-medium">Previsualización de imagen</p>
                    </div>
                  );
                }

                if (cleanUrl.match(/\.(mp4|webm|ogg|mov)$/i)) {
                  return (
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <Video className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 dark:text-white">Archivo de Video</p>
                        <p className="text-xs text-slate-500 truncate">{url.split("/").pop()}</p>
                      </div>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-colors">
                        <Play className="w-4 h-4" />
                      </a>
                    </div>
                  );
                }

                if (cleanUrl.match(/\.(mp3|wav|flac)$/i)) {
                  return (
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                        <Music className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 dark:text-white">Archivo de Audio</p>
                        <p className="text-xs text-slate-500 truncate">{url.split("/").pop()}</p>
                      </div>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-xl bg-purple-500 text-white hover:bg-purple-600 transition-colors">
                        <Play className="w-4 h-4" />
                      </a>
                    </div>
                  );
                }

                return (
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-500/10 flex items-center justify-center text-slate-500">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 dark:text-white">Otro Archivo</p>
                      <p className="text-xs text-slate-500 truncate">{url}</p>
                    </div>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-xl bg-slate-500 text-white hover:bg-slate-600 transition-colors">
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
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t("admin.labels.status")}</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white px-3 py-2 outline-none focus:ring-2 focus:ring-blue-300">
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{t(STATUS_CONFIG[s].label_key)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t("admin.labels.priority")}</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white px-3 py-2 outline-none focus:ring-2 focus:ring-blue-300">
              {PRIORITY_OPTIONS.map(p => (
                <option key={p} value={p}>{t(`admin.priorities.${p}`)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Admin Notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t("admin.labels.admin_notes")}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder={t("admin.labels.notes_placeholder")}
            className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white px-3 py-2 outline-none focus:ring-2 focus:ring-blue-300 resize-none"
          />
        </div>

        <Button onClick={handleSave} disabled={saving}
          className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white">
          {saving ? t("admin.actions.saving") : t("admin.actions.save")}
        </Button>
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
    setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setSelectedReport(updated);
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
    const Icon = cfg.icon;
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
        <Icon className="w-3 h-3" />
        {t(cfg.label_key)}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg">
            <Flag className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t("admin.page_title")}</h1>
            <p className="text-sm text-slate-500">{stats?.total ?? 0} {t("admin.stats.total").toLowerCase()} · {stats?.by_status?.pending ?? 0} {t("admin.stats.pending").toLowerCase()}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}
          className="rounded-xl gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {t("admin.actions.refresh")}
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const Icon = cfg.icon;
            return (
              <button key={key} onClick={() => setFilterStatus(filterStatus === key ? "" : key)}
                className={`p-4 rounded-2xl border text-left transition-all hover:scale-[1.02] ${filterStatus === key ? "ring-2 ring-blue-400 " + cfg.color : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"}`}>
                <div className="flex items-center justify-between mb-2">
                  <Icon className="w-5 h-5 text-slate-500" />
                  <span className="text-2xl font-bold text-slate-800 dark:text-white">{stats.by_status[key] ?? 0}</span>
                </div>
                <p className="text-xs font-medium text-slate-500">{t(cfg.label_key)}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="w-4 h-4 text-slate-400" />
        {Object.entries(TYPE_LABELS).map(([key, label]) => (
          <button key={key} onClick={() => setFilterType(filterType === key ? "" : key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all
                ${filterType === key
                ? "bg-red-500 text-white border-red-500"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-red-300"
              }`}>
            {label}
          </button>
        ))}
        {(filterStatus || filterType) && (
          <button onClick={() => { setFilterStatus(""); setFilterType(""); }}
            className="text-xs text-slate-500 hover:text-red-500 underline">
            {t("admin.actions.clear_filters")}
          </button>
        )}
      </div>

      {/* Content */}
      <div className={`grid gap-6 ${selectedReport ? "md:grid-cols-[1fr_420px]" : ""}`}>
        {/* Reports List */}
        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-slate-400 gap-2">
              <RefreshCw className="w-5 h-5 animate-spin" /> Cargando...
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
              <CheckCircle2 className="w-10 h-10" />
              <p className="text-sm">{t("admin.messages.no_reports")}</p>
            </div>
          ) : (
            reports.map((report) => (
              <div key={report.id}
                onClick={() => setSelectedReport(selectedReport?.id === report.id ? null : report)}
                className={`p-4 rounded-xl border cursor-pointer transition-all duration-150 hover:shadow-md
                    ${selectedReport?.id === report.id
                    ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/20"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-slate-300"
                  }
                  `}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-400 font-mono">#{report.public_id?.split("-")[0] || report.id}</span>
                      <span className="text-xs text-slate-500">{t(`form.types.${report.report_type}`)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_BADGES[report.priority]}`}>
                        {t(`admin.priorities.${report.priority}`)}
                      </span>
                    </div>
                    <p className="font-medium text-sm text-slate-800 dark:text-white truncate">{report.subject}</p>
                    <p className="text-xs text-slate-500 truncate">{report.context}</p>
                    <p className="text-xs text-slate-400">{report.reporter_email} · {timeAgo(report.created_at)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <StatusBadge status={report.status} />
                    {report.evidence_url && (
                      <span className="text-xs text-blue-500">📎 {t("admin.labels.evidence")}</span>
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
