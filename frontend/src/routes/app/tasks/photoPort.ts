import { useMemo } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { api, BASE_URL } from '@/lib/api';
import type { PhotoPort } from '@/rebuild/family/tasks/tasksApi';

/*
 * W2F.2 route adapter: the evidence photo for the rebuilt Tasks screens
 * (0077, FAMILY_HUB.md). An upload is multipart through the shared Core
 * client. The picture lives behind Core's authenticated
 * GET /tasks/:id/evidence proxy, never a raw storage URL (§1.9): it is
 * fetched with a fresh token and shown from a local object URL, which the
 * screen releases when it closes the photo. Only Core's code is passed on,
 * never its message; a failure while the browser is offline is NETWORK.
 */
const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

export function usePhotoPort(): PhotoPort {
  const { getToken } = useAuth();
  return useMemo<PhotoPort>(() => ({
    async upload(taskId, file) {
      const token = await getToken();
      if (!token) return { ok: false, code: 'UNAUTHORIZED' };
      const form = new FormData();
      form.set('photo', file);
      const result = await api<unknown>(`/tasks/${encodeURIComponent(taskId)}/evidence`, { method: 'POST', token, formData: form });
      if (result.error) return { ok: false, code: offline() ? 'NETWORK' : result.error.code };
      return { ok: true, data: true };
    },
    async load(taskId) {
      const token = await getToken();
      if (!token) return { ok: false, code: 'UNAUTHORIZED' };
      try {
        const response = await fetch(`${BASE_URL}/api/v1/tasks/${encodeURIComponent(taskId)}/evidence`, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) return { ok: false, code: response.status === 404 ? 'NOT_FOUND' : 'DATA_UNAVAILABLE' };
        const blob = await response.blob();
        return { ok: true, data: URL.createObjectURL(blob) };
      } catch {
        return { ok: false, code: offline() ? 'NETWORK' : 'DATA_UNAVAILABLE' };
      }
    },
    release(url) { URL.revokeObjectURL(url); },
    // The platform's camera or file chooser: a transient element that is never drawn in the page.
    pick() {
      return new Promise<File | null>((resolve) => {
        const chooser = document.createElement('input');
        chooser.type = 'file';
        chooser.accept = 'image/jpeg,image/png,image/webp';
        chooser.setAttribute('capture', 'environment');
        chooser.addEventListener('change', () => resolve(chooser.files?.[0] ?? null), { once: true });
        chooser.addEventListener('cancel', () => resolve(null), { once: true });
        chooser.click();
      });
    },
  }), [getToken]);
}
