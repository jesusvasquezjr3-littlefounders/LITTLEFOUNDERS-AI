import { subscribeSocialUpdates } from './socialUpdates';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { api } from '@/lib/api';
import { SocialGraph, type SocialMember } from '@/rebuild/social/SocialGraph';
import en from '@/i18n/en-US/rebuild.json';
import es from '@/i18n/es-MX/rebuild.json';
import pt from '@/i18n/pt-BR/rebuild.json';

type Direction = 'followers' | 'following';
interface Page { users: SocialMember[]; nextOffset: number | null }
export function SocialGraphPanel(props: { kidUserId: string; token: string | null }) {
  return <ScopedSocialGraph key={`${props.kidUserId}:${props.token}`} {...props} />;
}
function ScopedSocialGraph({ kidUserId, token }: { kidUserId: string; token: string | null }) {
  const { i18n } = useTranslation(); const { isDark } = useTheme();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const copy = (locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en).socialGraph;
  const [open, setOpen] = useState(false); const [direction, setDirection] = useState<Direction>('followers');
  const [page, setPage] = useState<Page>({ users: [], nextOffset: null });
  const [loading, setLoading] = useState(false); const [failed, setFailed] = useState(false);
  const generation = useRef(0); const busy = useRef(false);
  useEffect(() => () => { generation.current++; }, []);
  async function load(value: Direction, offset = 0) {
    if (busy.current) return;
    busy.current = true; const current = ++generation.current;
    setLoading(true); setFailed(false);
    try {
      if (!token) throw new Error('Session unavailable');
      const result = await api<Page>(`/family/kids/${kidUserId}/social?direction=${value}&offset=${offset}`, { token });
      if (current !== generation.current) return;
      if (result.error || !result.data) throw new Error('Graph unavailable');
      const data = result.data;
      if (!Array.isArray(data.users) || !data.users.every(user => typeof user.userId === 'string' && typeof user.displayName === 'string' && (user.username === null || typeof user.username === 'string')) ||
        !(data.nextOffset === null || (Number.isInteger(data.nextOffset) && data.nextOffset > offset))) throw new Error('Invalid graph response');
      setPage(previous => ({ users: Array.from(new Map([...(offset ? previous.users : []), ...data.users].map(user => [user.userId, user])).values()), nextOffset: data.nextOffset }));
    } catch {
      if (current === generation.current) { setFailed(true); setPage({ users: [], nextOffset: null }); }
    } finally {
      if (current === generation.current) { busy.current = false; setLoading(false); }
    }
  }
  // Refresh only this child's open surface; closed panels retain lazy loading.
  useEffect(() => subscribeSocialUpdates(kidUserId, token, () => {
    generation.current++; busy.current = false;
    setPage({ users: [], nextOffset: null });
    if (open) void load(direction);
  }));
  function change(value: Direction) {
    generation.current++; busy.current = false;
    setPage({ users: [], nextOffset: null }); setDirection(value); void load(value);
  }
  function close() { generation.current++; busy.current = false; setOpen(false); setPage({ users: [], nextOffset: null }); }
  return <SocialGraph copy={copy} locale={locale} dark={isDark} open={open} direction={direction} users={page.users} loading={loading} failed={failed} hasMore={page.nextOffset !== null}
    onOpen={() => { setOpen(true); change(direction); }} onClose={close} onDirection={change}
    onMore={() => { if (page.nextOffset !== null) void load(direction, page.nextOffset); }} onRetry={() => change(direction)} />;
}
