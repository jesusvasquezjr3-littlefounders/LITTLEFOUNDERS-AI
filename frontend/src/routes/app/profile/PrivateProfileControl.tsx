import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme/useTheme';
import { BASE_URL } from '@/lib/api';
import { PrivateProfile, type PrivateRequestState } from '@/rebuild/social/PrivateProfile';
import { askToConnect } from '@/rebuild/social/teenConnectionsClient';
import en from '@/i18n/en-US/rebuild-profile.json';
import es from '@/i18n/es-MX/rebuild-profile.json';
import pt from '@/i18n/pt-BR/rebuild-profile.json';

/*
 * Data plane for E.8's private teen card on the legacy public-profile route.
 * Keyed by session and handle so a late answer never lands on another
 * profile; a pending state is shown only for a validated receipt.
 */
export function PrivateProfileControl({ username, mode, requestPending }: { username: string; mode: 'teenRequest' | 'managed' | 'none'; requestPending: boolean }) {
  const { session } = useAuth();
  return <Scoped key={`${session?.user.id}:${username}`} username={username} mode={mode} requestPending={requestPending} />;
}

const REFUSALS: Record<string, PrivateRequestState> = {
  SOCIAL_REQUEST_COOLDOWN: 'cooldown',
  SOCIAL_REQUEST_LIMIT: 'limit',
  SOCIAL_ALREADY_CONNECTED: 'connected',
};

function Scoped({ username, mode, requestPending }: { username: string; mode: 'teenRequest' | 'managed' | 'none'; requestPending: boolean }) {
  const { getToken } = useAuth();
  const { isDark } = useTheme();
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const copy = (locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en).privateProfile;
  const [state, setState] = useState<PrivateRequestState>(requestPending ? 'pending' : 'idle');
  const generation = useRef(0);
  const busy = useRef(false);
  useEffect(() => () => { generation.current++; }, []);
  async function submit() {
    if (busy.current) return;
    busy.current = true;
    const current = generation.current;
    setState('saving');
    const token = await getToken();
    if (current !== generation.current) return;
    const result = token ? await askToConnect({ baseUrl: BASE_URL, token }, username) : { ok: false as const, code: 'UNAUTHORIZED' };
    if (current !== generation.current) return;
    if (result.ok && result.value.decidedBy === 'subject') { setState('pending'); return; }
    const refusal = result.ok ? undefined : REFUSALS[result.code];
    if (refusal) { setState(refusal); return; }
    busy.current = false;
    setState('failed');
  }
  return <PrivateProfile copy={copy} locale={locale} dark={isDark} username={username} mode={mode} state={state} onRequest={() => void submit()} />;
}
