import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme/useTheme';
import { api } from '@/lib/api';
import { ConnectionRequest } from '@/rebuild/social/ConnectionRequest';
import en from '@/i18n/en-US/rebuild.json';
import es from '@/i18n/es-MX/rebuild.json';
import pt from '@/i18n/pt-BR/rebuild.json';
export function ConnectionRequestControl({ username, decidedBy = 'guardian' }: { username: string; decidedBy?: 'guardian' | 'subject' }) {
  const { session } = useAuth();
  return <ScopedRequest key={`${session?.user.id}:${username}`} username={username} decidedBy={decidedBy} />;
}
function ScopedRequest({ username, decidedBy }: { username: string; decidedBy: 'guardian' | 'subject' }) {
  const { getToken } = useAuth(); const { isDark } = useTheme(); const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  // E.8: a child's request goes to its guardian; an independent teen decides for themself.
  const strings = locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en;
  const copy = decidedBy === 'subject' ? strings.socialRequestTeen : strings.socialRequest;
  const [status, setStatus] = useState<'idle' | 'saving' | 'pending' | 'failed'>('idle');
  const generation = useRef(0); const busy = useRef(false);
  useEffect(() => () => { generation.current++; }, []);
  async function submit() {
    if (busy.current) return;
    busy.current = true; const current = generation.current; setStatus('saving');
    try {
      const token = await getToken();
      if (current !== generation.current) return;
      if (!token) throw new Error('Session unavailable');
      const result = await api<{ requestId: string; status: string; following: boolean }>(`/profiles/${encodeURIComponent(username)}/connection-request`, { method: 'POST', token, body: {} });
      if (current !== generation.current) return;
      if (result.error || !result.data || typeof result.data.requestId !== 'string' || result.data.status !== 'pending' || result.data.following !== false) throw new Error('No pending receipt');
      setStatus('pending');
    } catch { if (current === generation.current) { busy.current = false; setStatus('failed'); } }
  }
  return <ConnectionRequest copy={copy} locale={locale} dark={isDark} status={status} onRequest={() => void submit()} />;
}
