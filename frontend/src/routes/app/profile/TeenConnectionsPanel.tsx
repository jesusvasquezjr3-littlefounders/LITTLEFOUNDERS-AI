import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme/useTheme';
import { BASE_URL } from '@/lib/api';
import { TeenConnections, type FollowerView, type TeenNotice, type TeenRequestView } from '@/rebuild/social/TeenConnections';
import { decideTeenRequest, getFollowers, getTeenRequests, removeFollower } from '@/rebuild/social/teenConnectionsClient';
import en from '@/i18n/en-US/rebuild-profile.json';
import es from '@/i18n/es-MX/rebuild-profile.json';
import pt from '@/i18n/pt-BR/rebuild-profile.json';

/*
 * Data plane for E.8's self-managed teen connections on the legacy own-profile
 * route. Every decision is confirmed by a matching receipt before the list
 * changes; a conflict or a removal reloads both lists from the first page.
 * Session changes invalidate in-flight answers.
 */
export function TeenConnectionsPanel({ discoverable = false }: { discoverable?: boolean }) {
  const { session } = useAuth();
  return <Scoped key={session?.user.id ?? 'none'} discoverable={discoverable} />;
}

function Scoped({ discoverable }: { discoverable: boolean }) {
  const { getToken } = useAuth();
  const { isDark } = useTheme();
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const copy = (locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en).teenConnections;
  const [requests, setRequests] = useState<TeenRequestView[]>([]);
  const [followers, setFollowers] = useState<FollowerView[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<TeenNotice | null>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);

  const load = useCallback(async (offset: number) => {
    const current = ++generation.current;
    setLoading(true);
    setFailed(false);
    const token = await getToken();
    if (current !== generation.current) return;
    if (!token) { setLoading(false); setFailed(true); return; }
    const [page, list] = await Promise.all([
      getTeenRequests({ baseUrl: BASE_URL, token }, offset),
      offset === 0 ? getFollowers({ baseUrl: BASE_URL, token }) : Promise.resolve(null),
    ]);
    if (current !== generation.current) return;
    setLoading(false);
    if (!page.ok || (list && !list.ok)) { setFailed(true); return; }
    setRequests((existing) => (offset === 0 ? page.value.requests : [...existing, ...page.value.requests]));
    setNextOffset(page.value.nextOffset);
    if (list && list.ok) setFollowers(list.value);
  }, [getToken]);

  useEffect(() => { void load(0); }, [load]);

  async function decide(requestId: string, decision: 'accept' | 'decline') {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const current = generation.current;
    const token = await getToken();
    const result = token ? await decideTeenRequest({ baseUrl: BASE_URL, token }, requestId, decision) : { ok: false as const, code: 'UNAUTHORIZED' };
    if (current !== generation.current) return;
    setBusy(false);
    if (result.ok) {
      setNotice({ tone: 'status', text: result.value === 'accepted' ? copy.accepted : copy.declined });
      void load(0);
      return;
    }
    if (result.code === 'SOCIAL_DECISION_CONFLICT' || result.code === 'NOT_FOUND') {
      setNotice({ tone: 'status', text: copy.conflict });
      void load(0);
      return;
    }
    setNotice({ tone: 'alert', text: result.code === 'PROFILE_REVIEW_REQUIRED' ? copy.review : copy.decisionFailed });
  }

  async function remove(username: string) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const current = generation.current;
    const token = await getToken();
    const result = token ? await removeFollower({ baseUrl: BASE_URL, token }, username) : { ok: false as const, code: 'UNAUTHORIZED' };
    if (current !== generation.current) return;
    setBusy(false);
    if (result.ok || result.code === 'NOT_FOUND') {
      setNotice({ tone: 'status', text: result.ok ? copy.removed : copy.conflict });
      void load(0);
      return;
    }
    setNotice({ tone: 'alert', text: copy.removeFailed });
  }

  return <TeenConnections copy={copy} locale={locale} dark={isDark} discoverable={discoverable} requests={requests} followers={followers} loading={loading}
    failed={failed} busy={busy} notice={notice} hasMore={nextOffset !== null}
    onDecide={(id, decision) => void decide(id, decision)} onRemove={(username) => void remove(username)}
    onRetry={() => void load(0)} onMore={() => { if (nextOffset !== null) void load(nextOffset); }} />;
}
