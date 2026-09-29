import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import type { AgeBand } from '@/rebuild/design/copyBudget';
import { fetchLearnerRegister, type RegisterTransport } from '@/rebuild/learning/learnerRegister';

/*
 * GAP-FIX-R4 (Bible 06 §7, 06 §3.1, 02 D11 and rule 19): the Copy Budget band
 * of the signed-in learner, once, for the learner shell's design-system root.
 * 06 §7 says the root must carry `data-age-band` in production, so a 6-9
 * child's every learner page (and the shell chrome around it) is budgeted at
 * the 6-9 limits, not only the pages that declare a band of their own.
 *
 * Core decides the band (GET /learn/register, B.23): the client never states
 * an age. While the answer is unknown, or when Core cannot give one, the band
 * is the youngest (the most protective reading, as `bandOf` in the learner
 * page hosts reads it). The last answer per account is remembered, so a shell
 * that remounts on the next route (the age-screen gate) does not flash back to
 * the youngest band.
 */
const remembered = new Map<string, AgeBand>();
const YOUNGEST: AgeBand = '6-9';

export function useLearnerBand(enabled: boolean): AgeBand {
  const { session, getToken } = useAuth();
  const userId = session?.user?.id ?? null;
  const [band, setBand] = useState<AgeBand>(() => (userId ? remembered.get(userId) ?? YOUNGEST : YOUNGEST));
  const transport = useCallback<RegisterTransport>(async (path, init) => {
    const token = await getToken();
    if (!token) return { data: null, error: { code: 'UNAUTHORIZED' } };
    return api<unknown>(path, { token, method: init?.method, body: init?.body });
  }, [getToken]);
  useEffect(() => {
    if (!enabled || !userId) return;
    setBand(remembered.get(userId) ?? YOUNGEST);
    let cancelled = false;
    void fetchLearnerRegister(transport).then((state) => {
      const next = state.status === 'ready' ? state.value.copy_band : YOUNGEST;
      remembered.set(userId, next);
      if (!cancelled) setBand(next);
    });
    return () => { cancelled = true; };
  }, [enabled, userId, transport]);
  return band;
}
