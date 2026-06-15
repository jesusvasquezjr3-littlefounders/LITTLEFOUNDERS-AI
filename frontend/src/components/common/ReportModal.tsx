import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X, Flag, Upload, CheckCircle2, Loader2, ExternalLink, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ReportType = "bug" | "abuse" | "suggestion" | "content" | "other";

interface ReportModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Called to close the modal */
  onClose: () => void;
  /** Override the reported URL (defaults to window.location.href) */
  reportedUrl?: string;
}

const REPORT_TYPES: ReportType[] = ["bug", "abuse", "suggestion", "content", "other"];

const FILE_MAX_MB = 10;
const ALLOWED_MIME = /^(image\/(jpeg|png|gif|webp)|video\/(mp4|webm|quicktime)|audio\/(mpeg|wav|ogg|mp4))$/;

// ── Helpers ────────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

function getCurrentUser(): { email?: string; token?: string } {
  try {
    const raw = localStorage.getItem("user");
    const user = raw ? JSON.parse(raw) : {};
    const token = localStorage.getItem("token") ?? undefined;
    return { email: user?.email, token };
  } catch {
    return {};
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ReportModal({ open, onClose, reportedUrl }: ReportModalProps) {
  const { t, i18n } = useTranslation("reports");
  const { email: sessionEmail, token } = getCurrentUser();

  // Form state
  const [reportType, setReportType] = useState<ReportType>("bug");
  const [email, setEmail] = useState(sessionEmail ?? "");
  const [subject, setSubject] = useState("");
  const [context, setContext] = useState("");
  const [effectiveUrl] = useState(reportedUrl ?? (typeof window !== "undefined" ? window.location.href : ""));

  // File upload state
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submit state
  const [submitState, setSubmitState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Validation errors
  const [errors, setErrors] = useState<Partial<Record<"email" | "subject" | "context", string>>>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = t("validation.email_required");
    if (!subject.trim()) e.subject = t("validation.subject_required");
    if (!context.trim()) e.context = t("validation.context_required");
    else if (context.trim().length < 10) e.context = t("validation.context_min");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleFileChange = useCallback(async (file: File | null) => {
    if (!file) return;

    // Validation
    if (!ALLOWED_MIME.test(file.type)) {
      setUploadState("error");
      setErrorMsg(t("error.file_type_invalid"));
      return;
    }
    if (file.size > FILE_MAX_MB * 1024 * 1024) {
      setUploadState("error");
      setErrorMsg(t("error.file_too_large"));
      return;
    }

    setEvidenceFile(file);
    setUploadState("uploading");
    setErrorMsg("");

    try {
      const ext = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { data, error } = await supabase.storage
        .from("report-evidence")
        .upload(fileName, file, { contentType: file.type, upsert: false });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("report-evidence")
        .getPublicUrl(data.path);

      setEvidenceUrl(urlData.publicUrl);
      setUploadState("done");
    } catch {
      setUploadState("error");
      setErrorMsg(t("error.upload_failed"));
    }
  }, [t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitState("loading");
    setErrorMsg("");

    try {
      const payload = {
        reporter_email: email.trim(),
        report_type: reportType,
        subject: subject.trim(),
        reported_url: effectiveUrl,
        context: context.trim(),
        evidence_url: evidenceUrl,
        report_metadata: {
          browser: navigator.userAgent,
          platform: navigator.platform,
          language: i18n.language,
        },
      };

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/reports/`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        if (res.status === 429) {
          throw new Error(t("error.rate_limit"));
        }
        if (res.status >= 500) {
          throw new Error(t("error.server_error"));
        }
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail ?? t("error.submit_failed"));
      }

      setSubmitState("success");
    } catch (err: any) {
      setSubmitState("error");
      // Categorize errors for better UX
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        setErrorMsg(t("error.network_error"));
      } else {
        setErrorMsg(err?.message ?? t("error.submit_failed"));
      }
    }
  };

  const handleClose = () => {
    // Reset form
    setReportType("bug");
    if (!sessionEmail) setEmail("");
    setSubject("");
    setContext("");
    setEvidenceFile(null);
    setEvidenceUrl(null);
    setUploadState("idle");
    setSubmitState("idle");
    setErrorMsg("");
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent 
        className="sm:max-w-lg w-full max-h-[92vh] overflow-y-auto corp-dialog rounded-3xl p-0 [&>button]:hidden"
        overlayClassName="backdrop-blur-md bg-black/40"
      >
        {/* Header Section */}
        <div className="p-6 pb-2 relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Flag className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                {t("title")}
              </DialogTitle>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{t("success.description")}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="absolute top-6 right-6 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Success State ── */}
        {submitState === "success" ? (
          <div className="flex flex-col items-center gap-5 py-12 text-center animate-in fade-in zoom-in-95 duration-500">
            <div className="w-20 h-20 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center relative">
              <CheckCircle2 className="w-10 h-10 text-indigo-500" />
            </div>
            <div className="space-y-1 px-8">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{t("success.title")}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{t("success.description")}</p>
            </div>
            <button
              onClick={handleClose}
              className="corp-btn-primary mt-2 h-11 px-8 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2"
            >
              {t("success.close")}
            </button>
          </div>
        ) : (
          /* ── Form ── */
          <form onSubmit={handleSubmit} className="p-6 pt-2 space-y-4">
            {/* Report Type Selector */}
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-500 ml-1">
                {t("form.type_label")}
              </label>
              <div className="flex flex-wrap gap-1.5 mt-0.5">
                {REPORT_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setReportType(type)}
                    className={`
                      px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border
                      ${reportType === type
                        ? "bg-indigo-600 dark:bg-indigo-500 text-white border-transparent shadow-md scale-105"
                        : "bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:border-indigo-300 dark:hover:border-indigo-500/30 hover:text-indigo-700 dark:hover:text-indigo-300"
                      }
                    `}
                  >
                    {t(`form.types.${type}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-500 ml-1">
                  {t("form.email_label")}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!!sessionEmail}
                  placeholder={t("form.email_placeholder")}
                  className={`
                    w-full px-4 py-3 rounded-xl border transition-all outline-none text-sm font-medium
                    ${errors.email ? "border-red-400 bg-red-500/5" : "border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 focus:bg-white dark:focus:bg-white/10"}
                    text-slate-900 dark:text-white placeholder-slate-400
                    ${sessionEmail ? "opacity-40 cursor-not-allowed" : ""}
                  `}
                />
                {errors.email && <p className="text-[10px] font-bold text-red-500 ml-1">{errors.email}</p>}
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-500 ml-1">
                  {t("form.subject_label")}
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t("form.subject_placeholder")}
                  maxLength={200}
                  className={`
                    w-full px-4 py-3 rounded-xl border transition-all outline-none text-sm font-medium
                    ${errors.subject ? "border-red-400 bg-red-500/5" : "border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 focus:bg-white dark:focus:bg-white/10"}
                    text-slate-900 dark:text-white placeholder-slate-400
                  `}
                />
                {errors.subject && <p className="text-[10px] font-bold text-red-500 ml-1">{errors.subject}</p>}
              </div>
            </div>

            {/* Context / Description */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-500 ml-1">
                {t("form.context_label")}
              </label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder={t("form.context_placeholder")}
                rows={3}
                  className={`
                    w-full px-4 py-4 rounded-xl border transition-all outline-none resize-none text-sm leading-relaxed font-medium
                    ${errors.context ? "border-red-400 bg-red-500/5" : "border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 focus:bg-white dark:focus:bg-white/10"}
                    text-slate-900 dark:text-white placeholder-slate-400
                  `}
                />
              {errors.context && <p className="text-[10px] font-bold text-red-500 ml-1">{errors.context}</p>}
            </div>

            {/* Evidence & URL Footer */}
            <div className="flex flex-col gap-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative flex items-center gap-3 px-4 py-3 rounded-2xl border border-dashed transition-all cursor-pointer
                  ${uploadState === "done"
                    ? "border-green-400/50 bg-green-500/5"
                    : uploadState === "error"
                      ? "border-red-400/50 bg-red-500/5"
                      : "border-slate-200 dark:border-white/10 hover:border-slate-400 dark:hover:border-slate-500 bg-slate-50/50 dark:bg-white/5"
                  }
                `}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
                  ${uploadState === "done" ? "bg-green-500" : uploadState === "error" ? "bg-red-500" : "bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-transparent"}
                `}>
                  {uploadState === "uploading" ? (
                    <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
                  ) : uploadState === "done" ? (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  ) : uploadState === "error" ? (
                    <XCircle className="w-4 h-4 text-white" />
                  ) : (
                    <Upload className="w-4 h-4 text-slate-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-[11px] font-bold truncate ${uploadState === "done" ? "text-green-600 dark:text-green-400"
                      : uploadState === "error" ? "text-red-600 dark:text-red-400"
                        : "text-slate-700 dark:text-slate-300"
                    }`}>
                    {uploadState === "uploading" ? t("form.evidence_uploading") : (evidenceFile?.name ?? t("form.evidence_button"))}
                  </p>
                </div>
                {!uploadState || uploadState === "idle" && (
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">10MB Max</span>
                )}
                <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*,audio/*"
                  onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)} />
              </div>

              {/* URL - Compacted */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 text-[10px] text-slate-500 dark:text-slate-400">
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                <span className="truncate opacity-80">URL: {effectiveUrl}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={handleClose}
                className="flex-1 h-12 rounded-xl text-sm font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/5 transition-all">
                {t("form.cancel")}
              </Button>
              <button type="submit" disabled={submitState === "loading"}
                className="corp-btn-primary flex-1 h-12 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none">
                {submitState === "loading" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Flag className="w-4 h-4" />
                )}
                {submitState === "loading" ? t("form.submitting") : t("form.submit")}
              </button>
            </div>

            {/* Global error */}
            {submitState === "error" && errorMsg && (
              <p className="text-[10px] text-center font-bold text-red-500 uppercase tracking-wider">{errorMsg}</p>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>

  );
}
