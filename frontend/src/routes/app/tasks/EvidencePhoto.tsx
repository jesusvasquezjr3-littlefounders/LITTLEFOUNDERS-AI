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
  onUploaded,
}: {
  taskId: string;
  token: string | null;
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
        {uploading ? t('tasks.kid.evidenceUploading') : t('tasks.kid.evidenceAdd')}
      </label>
      {errorCode && <span className="lf-caption text-error-strong">{t(`errors.api.${errorCode}`, { defaultValue: t('errors.api.INTERNAL') })}</span>}
    </div>
  );
}

export function EvidenceThumbnail({ taskId, token, alt }: { taskId: string; token: string | null; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    void (async () => {
      if (!token) return;
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
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [taskId, token]);

  if (failed) return null;
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
