import { publishSocialUpdate } from './socialUpdates';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { api } from '@/lib/api';
import { SocialRequests, type PendingConnection } from '@/rebuild/social/SocialRequests';
import en from '@/i18n/en-US/rebuild-family.json';
import es from '@/i18n/es-MX/rebuild-family.json';
import pt from '@/i18n/pt-BR/rebuild-family.json';

interface Page { requests: PendingConnection[]; nextOffset: number | null }
export function SocialRequestsPanel(props: { kidUserId: string; token: string | null }) {
  return <ScopedSocialRequests key={`${props.kidUserId}:${props.token}`} {...props} />;
}
function ScopedSocialRequests({ kidUserId, token }: { kidUserId: string; token: string | null }) {
  const { i18n } = useTranslation(); const { isDark } = useTheme();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const copy = (locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en).socialRequests;
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<Page>({ requests: [], nextOffset: null });
  const [loading, setLoading] = useState(false); const [failed, setFailed] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [decisionFailed, setDecisionFailed] = useState(false);
  const generation = useRef(0); const busy = useRef(false);
  useEffect(() => () => { generation.current++; }, []);
  async function load(offset = 0) {
    if (busy.current) return;
    busy.current = true; const current = ++generation.current;
    setLoading(true); setFailed(false);
    try {
      if (!token) throw new Error('Session unavailable');
      const result = await api<Page>(`/family/kids/${kidUserId}/social/requests?offset=${offset}`, { token });
      if (current !== generation.current) return;
      if (result.error || !result.data) throw new Error('Graph unavailable');
      const data = result.data;
      if (!Array.isArray(data.requests) || !data.requests.every(request => typeof request.requestId === 'string' && request.requestId.length > 0 && request.status === 'pending' && (request.requesterName === null || typeof request.requesterName === 'string') && Number.isFinite(Date.parse(request.requestedAt))) ||
        !(data.nextOffset === null || (Number.isInteger(data.nextOffset) && data.nextOffset > offset))) throw new Error('Invalid requests response');
      setPage(previous => ({ requests: Array.from(new Map([...(offset ? previous.requests : []), ...data.requests].map(request => [request.requestId, request])).values()), nextOffset: data.nextOffset }));
    } catch {
      if (current === generation.current) { setFailed(true); setPage({ requests: [], nextOffset: null }); }
    } finally {
      if (current === generation.current) { busy.current = false; setLoading(false); }
    }
  }
  async function decide(requestId: string, decision: 'approve' | 'deny') {
    if (busy.current || !token) return;
    busy.current = true; const current = ++generation.current;
    setDeciding(true); setNotice(null); setDecisionFailed(false);
    let refresh = false;
    try {
      const result = await api<{ requestId: string; status: string }>(`/family/kids/${kidUserId}/social/requests/${encodeURIComponent(requestId)}/decision`, { token, method: 'POST', body: { decision } });
      if (current !== generation.current) return;
      if (result.error && ['GUARDIAN_DECISION_FORBIDDEN', 'PARENT_VERIFICATION_REQUIRED', 'FORBIDDEN', 'NOT_FOUND', 'UNAUTHORIZED'].includes(result.error.code)) {
        setPage({ requests: [], nextOffset: null }); setFailed(true); setNotice(null);
        publishSocialUpdate(kidUserId, token);
        return;
      }
      if (result.error?.code === 'SOCIAL_DECISION_CONFLICT') {
        setNotice(copy.conflict); setDecisionFailed(true); refresh = true;
      } else {
        const status = decision === 'approve' ? 'approved' : 'denied';
        if (result.error || result.data?.requestId !== requestId || result.data.status !== status) throw new Error('Decision not confirmed');
        setNotice(copy[status]); refresh = true;
      }
    } catch {
      if (current === generation.current) { setNotice(copy.decisionFailed); setDecisionFailed(true); }
    } finally {
      if (current === generation.current) {
        busy.current = false; setDeciding(false);
        if (refresh) { publishSocialUpdate(kidUserId, token); setPage({ requests: [], nextOffset: null }); void load(); }
      }
    }
  }
  function reload() {
    generation.current++; busy.current = false; setDeciding(false); setNotice(null);
    setPage({ requests: [], nextOffset: null }); void load();
  }
  function close() { generation.current++; busy.current = false; setOpen(false); setDeciding(false); setNotice(null); setPage({ requests: [], nextOffset: null }); }
  return <SocialRequests deciding={deciding} notice={notice} decisionFailed={decisionFailed} onDecision={(id, decision) => void decide(id, decision)} copy={copy} locale={locale} dark={isDark} open={open} requests={page.requests} loading={loading} failed={failed} hasMore={page.nextOffset !== null}
    onToggle={() => { if (open) close(); else { setOpen(true); reload(); } }}
    onMore={() => { if (page.nextOffset !== null) void load(page.nextOffset); }} onRetry={reload} />;
}
