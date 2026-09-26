import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { api } from '@/lib/api';
import { SocialNotices, type SocialNoticeEntry } from '@/rebuild/social/SocialNotices';
import en from '@/i18n/en-US/rebuild-family.json';
import es from '@/i18n/es-MX/rebuild-family.json';
import pt from '@/i18n/pt-BR/rebuild-family.json';

/*
 * E.3's Family-panel data plane for the rebuild SocialNotices surface: loads
 * the verified guardian's safety notices only when opened, validates every
 * row against the wire shape (an unexpected field set must fail the whole
 * list, never render a stranger-shaped row). Core is the enforcing boundary.
 */

function isValidNotice(value: unknown): value is SocialNoticeEntry {
  if (!value || typeof value !== 'object') return false;
  const notice = value as Record<string, unknown>;
  return typeof notice.noticeId === 'string'
    && typeof notice.kidUserId === 'string'
    && typeof notice.subjectId === 'string'
    && (notice.subjectName === null || typeof notice.subjectName === 'string')
    && typeof notice.createdAt === 'string' && Number.isFinite(Date.parse(notice.createdAt));
}

export function SocialNoticesPanel(props: { token: string | null }) {
  return <ScopedSocialNotices key={props.token} {...props} />;
}

function ScopedSocialNotices({ token }: { token: string | null }) {
  const { i18n } = useTranslation(); const { isDark } = useTheme();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const copy = (locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en).socialNotices;
  const [open, setOpen] = useState(false);
  const [notices, setNotices] = useState<SocialNoticeEntry[]>([]);
  const [loading, setLoading] = useState(false); const [failed, setFailed] = useState(false);
  const generation = useRef(0); const busy = useRef(false);
  useEffect(() => () => { generation.current++; }, []);

  async function load() {
    if (busy.current) return;
    busy.current = true; const current = ++generation.current;
    setLoading(true); setFailed(false);
    try {
      if (!token) throw new Error('Session unavailable');
      const result = await api<{ notices: unknown }>(`/family/social-notices`, { token });
      if (current !== generation.current) return;
      if (result.error || !result.data) throw new Error('Notices unavailable');
      const list = result.data.notices;
      if (!Array.isArray(list)) throw new Error('Invalid notices response');
      const valid = list.filter(isValidNotice);
      if (valid.length !== list.length) throw new Error('Invalid notices response');
      setNotices(valid);
    } catch {
      if (current === generation.current) { setFailed(true); setNotices([]); }
    } finally {
      if (current === generation.current) { busy.current = false; setLoading(false); }
    }
  }

  function reload() {
    generation.current++; busy.current = false; setNotices([]); void load();
  }
  function close() {
    generation.current++; busy.current = false; setOpen(false); setNotices([]); setFailed(false); setLoading(false);
  }
  return <SocialNotices copy={copy} locale={locale} dark={isDark} open={open} notices={notices} loading={loading} failed={failed}
    onOpen={() => { setOpen(true); reload(); }} onClose={close} onRetry={reload} />;
}
