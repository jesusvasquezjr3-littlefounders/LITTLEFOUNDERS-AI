import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import {
  AgeRecordCard, ageRecordKind, correctionState, type AgeRecordCopy, type AgeRecordKind, type CorrectionFailure, type CorrectionState,
} from '@/rebuild/account/AgeRecordCard';

/*
 * P3 data plane for S-04 (OD-28) and E.4 (OD-3): reads GET /auth/age-screen
 * (the same read the route guard makes) and shows the age card for a
 * self-managed teen, a teen who moved to adult by birth month, or an adult.
 * The declaration itself is never written here (E.4); GET/POST
 * /account/age-correction offers the staff-reviewed correction to the
 * accounts Core says may ask. A failed read shows nothing, never a guess; a
 * failed correction read shows the card without the request.
 */
const FAILURES: Record<string, CorrectionFailure> = { VALIDATION_ERROR: 'invalid', AGE_UNCHANGED: 'unchanged' };

export function AgeRecordSetting({ copy }: { copy: AgeRecordCopy }) {
  const { session, isGuest, getToken } = useAuth();
  const [kind, setKind] = useState<AgeRecordKind | null>(null);
  const [correction, setCorrection] = useState<CorrectionState | null>(null);
  const userId = session?.user.id ?? null;
  useEffect(() => {
    let cancelled = false;
    setKind(null); setCorrection(null);
    if (!userId || isGuest) return () => { cancelled = true; };
    void (async () => {
      const token = await getToken();
      if (cancelled || !token) return;
      const [age, request] = await Promise.all([api<unknown>('/auth/age-screen', { token }), api<unknown>('/account/age-correction', { token })]);
      if (cancelled) return;
      setKind(age.error ? null : ageRecordKind(age.data));
      setCorrection(request.error ? null : correctionState(request.data));
    })();
    return () => { cancelled = true; };
  }, [userId, isGuest, getToken]);

  const onRequest = useCallback(async (birthDate: string): Promise<CorrectionFailure | null> => {
    const token = await getToken();
    if (!token) return 'failed';
    const result = await api<unknown>('/account/age-correction', { token, body: { birthDate } });
    if (result.error) return FAILURES[result.error.code] ?? 'failed';
    const next = correctionState(result.data);
    if (!next) return 'failed';
    setCorrection(next);
    return null;
  }, [getToken]);

  return kind ? <AgeRecordCard copy={copy} kind={kind} correction={correction} onRequest={onRequest} /> : null;
}
