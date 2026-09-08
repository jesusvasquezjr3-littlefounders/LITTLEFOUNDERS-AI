import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BASE_URL, api } from '@/lib/api';
import { Icon } from '@/components/ui';

/*
 * Proof-of-work photo (0077, FAMILY_HUB.md). The image is never a plain
 * <img src> — it lives behind Core's authenticated GET /tasks/:id/evidence
 * proxy (never a raw Depot URL, §1.9), so every render here fetches it with
 * the caller's own token and turns the bytes into a local blob: URL.
 */

export function EvidenceUploadButton({
  taskId,
  token,
  replace = false,
  onUploaded,
}: {
  taskId: string;
  token: string | null;
  /** true once a photo already exists — same control, relabelled so a kid understands they're swapping it, not adding a second one. */
  replace?: boolean;
  onUploaded: () => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !token || uploading) return;
    setUploading(true);
    setErrorCode(null);
    const form = new FormData();
    form.set('photo', file);
    const res = await api<{ task: unknown }>(`/tasks/${taskId}/evidence`, { method: 'POST', token, formData: form });
    setUploading(false);
    if (res.error) {
      setErrorCode(res.error.code);
      return;
    }
    onUploaded();
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="lf-caption lf-press inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-outline px-3 py-1.5 font-bold text-content-muted transition-colors duration-150 hover:border-primary hover:text-primary">
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(e) => void handleChange(e)} />
        <Icon name="add_a_photo" className="text-[15px]" aria-hidden />
        {uploading ? t('tasks.kid.evidenceUploading') : replace ? t('tasks.kid.evidenceReplace') : t('tasks.kid.evidenceAdd')}
      </label>
      {errorCode && <span className="lf-caption text-error-strong">{t(`errors.api.${errorCode}`, { defaultValue: t('errors.api.INTERNAL') })}</span>}
    </div>
  );
}

export function EvidenceThumbnail({ taskId, token, alt }: { taskId: string; token: string | null; alt: string }) {
  const { t } = useTranslation();
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setFailed(false);
    setSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    void (async () => {
      if (!token) return;
      try {
        const res = await fetch(`${BASE_URL}/api/v1/tasks/${taskId}/evidence`, { headers: { Authorization: `Bearer ${token}` } });
        if (cancelled) return;
        if (!res.ok) {
          setFailed(true);
          return;
        }
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch {
        // Network failure (offline, DNS, timeout) — same visible outcome as
        // an HTTP error above: a retry affordance, never a stuck skeleton.
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [taskId, token, attempt]);

  if (failed) {
    return (
      <button
        type="button"
        onClick={() => setAttempt((n) => n + 1)}
        className="lf-press flex h-14 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-error-strong/60 text-error-strong"
        aria-label={t('tasks.kid.evidenceRetry')}
      >
        <Icon name="refresh" className="text-[16px]" aria-hidden />
        <span className="text-[9px] font-bold leading-none">{t('tasks.kid.evidenceRetryLabel')}</span>
      </button>
    );
  }
  if (!src) return <div className="h-14 w-14 shrink-0 animate-pulse rounded-md bg-surface-sunken" aria-hidden />;

  return (
    <button
      type="button"
      onClick={() => window.open(src, '_blank', 'noopener')}
      className="lf-press h-14 w-14 shrink-0 overflow-hidden rounded-md border border-outline/60"
      aria-label={alt}
    >
      <img src={src} alt={alt} className="h-full w-full object-cover" />
    </button>
  );
}
