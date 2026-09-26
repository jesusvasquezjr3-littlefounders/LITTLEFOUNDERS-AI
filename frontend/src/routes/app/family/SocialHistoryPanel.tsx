import { subscribeSocialUpdates } from './socialUpdates';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { api } from '@/lib/api';
import { SocialHistory, type SocialHistoryEntry } from '@/rebuild/social/SocialHistory';
import en from '@/i18n/en-US/rebuild-family.json';
import es from '@/i18n/es-MX/rebuild-family.json';
import pt from '@/i18n/pt-BR/rebuild-family.json';

interface Page { entries: SocialHistoryEntry[]; nextOffset: number | null }
export function SocialHistoryPanel(props: { kidUserId: string; token: string | null }) {
  return <ScopedSocialHistory key={`${props.kidUserId}:${props.token}`} {...props} />;
}
function ScopedSocialHistory({ kidUserId, token }: { kidUserId: string; token: string | null }) {
  const { i18n } = useTranslation(); const { isDark } = useTheme();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const copy = (locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en).socialHistory;
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<Page>({ entries: [], nextOffset: null });
  const [loading, setLoading] = useState(false); const [failed, setFailed] = useState(false);
  const generation = useRef(0); const busy = useRef(false);
  useEffect(() => () => { generation.current++; }, []);
  async function load(offset = 0) {
    if (busy.current) return;
    busy.current = true; const current = ++generation.current;
    setLoading(true); setFailed(false);
    try {
      if (!token) throw new Error('Session unavailable');
      const result = await api<Page>(`/family/kids/${kidUserId}/social/audit?offset=${offset}`, { token });
      if (current !== generation.current) return;
      if (result.error || !result.data) throw new Error('Graph unavailable');
      const data = result.data;
      if (!Array.isArray(data.entries) || !data.entries.every(entry => Number.isSafeInteger(entry.id) && ['social.follow', 'social.unfollow', 'social.block', 'social.unblock'].includes(entry.action) && (entry.sourceName === null || typeof entry.sourceName === 'string') && (entry.targetName === null || typeof entry.targetName === 'string') && Number.isFinite(Date.parse(entry.createdAt))) ||
        !(data.nextOffset === null || (Number.isInteger(data.nextOffset) && data.nextOffset > offset))) throw new Error('Invalid history response');
      setPage(previous => ({ entries: Array.from(new Map([...(offset ? previous.entries : []), ...data.entries].map(entry => [entry.id, entry])).values()), nextOffset: data.nextOffset }));
    } catch {
      if (current === generation.current) { setFailed(true); setPage({ entries: [], nextOffset: null }); }
    } finally {
      if (current === generation.current) { busy.current = false; setLoading(false); }
    }
  }
  // Refresh only this child's open surface; closed panels retain lazy loading.
  useEffect(() => subscribeSocialUpdates(kidUserId, token, () => {
    generation.current++; busy.current = false;
    setPage({ entries: [], nextOffset: null });
    if (open) void load();
  }));
  function reload() {
    generation.current++; busy.current = false;
    setPage({ entries: [], nextOffset: null }); void load();
  }
  function close() { generation.current++; busy.current = false; setOpen(false); setPage({ entries: [], nextOffset: null }); }
  return <SocialHistory copy={copy} locale={locale} dark={isDark} open={open} entries={page.entries} loading={loading} failed={failed} hasMore={page.nextOffset !== null}
    onToggle={() => { if (open) close(); else { setOpen(true); reload(); } }}
    onMore={() => { if (page.nextOffset !== null) void load(page.nextOffset); }} onRetry={reload} />;
}
