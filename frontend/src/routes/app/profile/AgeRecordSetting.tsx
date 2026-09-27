import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { AgeRecordCard, ageRecordKind, type AgeRecordCopy, type AgeRecordKind } from '@/rebuild/account/AgeRecordCard';

/*
 * P3 data plane for S-04 (OD-28): reads GET /auth/age-screen (the same read the
 * route guard makes) and shows the read-only age card for a self-managed teen,
 * or a teen who moved to adult by birth month. Nothing is written here: the
 * declaration is locked (E.4). A failed read shows nothing, never a guess.
 */
export function AgeRecordSetting({ copy }: { copy: AgeRecordCopy }) {
  const { session, isGuest, getToken } = useAuth();
  const [kind, setKind] = useState<AgeRecordKind | null>(null);
  const userId = session?.user.id ?? null;
  useEffect(() => {
    let cancelled = false;
    setKind(null);
    if (!userId || isGuest) return () => { cancelled = true; };
    void (async () => {
      const token = await getToken();
      if (cancelled || !token) return;
      const result = await api<unknown>('/auth/age-screen', { token });
      if (!cancelled) setKind(result.error ? null : ageRecordKind(result.data));
    })();
    return () => { cancelled = true; };
  }, [userId, isGuest, getToken]);
  return kind ? <AgeRecordCard copy={copy} kind={kind} /> : null;
}
