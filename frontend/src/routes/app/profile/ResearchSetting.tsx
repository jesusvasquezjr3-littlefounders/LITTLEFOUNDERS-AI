import { useMemo } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import type { Session, Transport } from '@/rebuild/family/familyHubApi';
import { AdultResearchPanel } from '../family/GovernancePanels';

/*
 * GAP-FIX-R2 (owner review H-25, D.22): the research answer in the account's
 * own Settings. A Tutor's yes lapses at 18, and a young adult no longer sees
 * the wallet pages where a child's research note lives, so the request to
 * answer again comes here. The panel shows nothing unless Core reports that
 * lapse or the adult's own yes; a guest never asks (Core refuses guests too).
 */
export function ResearchSetting() {
  const { session, isGuest } = useAuth();
  return !session || isGuest ? null : <ScopedResearch key={session.user.id} />;
}

function ScopedResearch() {
  const { getToken } = useAuth();
  // A fresh token per call (getToken refreshes an expiring session); the token field only says the caller is signed in.
  const session = useMemo<Session>(() => {
    const transport: Transport = async (path, options) => api<unknown>(path, { method: options.method, body: options.body, token: await getToken() });
    return { token: 'session', transport };
  }, [getToken]);
  return <AdultResearchPanel session={session} />;
}
