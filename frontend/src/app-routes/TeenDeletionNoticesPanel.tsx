import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { TeenDeletionNotices, type TeenDeletionNoticeItem } from '@/rebuild/family/TeenDeletionNotices';
import { useConsoleEnvironment } from '@/routes/app/family/consoleSession';

/*
 * GAP-FIX-R2 (owner review D-14 (b)): the data plane of a linked teen's own
 * account deletion, told to the Tutor on /family. GET
 * /family-hub/deletion-notices answers only this Tutor's open notices (the
 * database wrote them in the teen's request, one per verified Tutor). A
 * malformed answer is a failure, never "nothing to tell".
 */

const isNotice = (v: unknown): v is TeenDeletionNoticeItem => {
  if (typeof v !== 'object' || v === null) return false;
  const { id, displayName, scheduledFor } = v as Record<string, unknown>;
  return typeof id === 'string' && typeof displayName === 'string' && typeof scheduledFor === 'string' && Number.isFinite(Date.parse(scheduledFor));
};

export function TeenDeletionNoticesPanel({ token }: { token: string | null }) {
  return <ScopedNotices key={token ?? 'none'} token={token} />;
}

function ScopedNotices({ token }: { token: string | null }) {
  const { locale, dark, family } = useConsoleEnvironment();
  const [notices, setNotices] = useState<TeenDeletionNoticeItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    if (!token) return;
    void api<{ notices?: unknown }>('/family-hub/deletion-notices', { token }).then((result) => {
      if (!live) return;
      const list = result.data?.notices;
      if (result.error || !Array.isArray(list) || !list.every(isNotice)) { setFailed(true); return; }
      setFailed(false);
      setNotices(list.map((n) => ({ id: n.id, displayName: n.displayName, scheduledFor: n.scheduledFor })));
    });
    return () => { live = false; };
  }, [token, attempt]);
  return <TeenDeletionNotices copy={family.familyDeletionNotices} locale={locale} dark={dark} notices={notices} failed={failed}
    onRetry={() => { setFailed(false); setAttempt((n) => n + 1); }} />;
}
