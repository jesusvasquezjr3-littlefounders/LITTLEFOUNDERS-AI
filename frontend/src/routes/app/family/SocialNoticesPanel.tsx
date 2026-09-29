import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { api } from '@/lib/api';
import { SocialNotices, type SocialNoticeEntry } from '@/rebuild/social/SocialNotices';
import en from '@/i18n/en-US/rebuild-family.json';
import es from '@/i18n/es-MX/rebuild-family.json';
import pt from '@/i18n/pt-BR/rebuild-family.json';
import enProfile from '@/i18n/en-US/rebuild-profile.json';
import esProfile from '@/i18n/es-MX/rebuild-profile.json';
import ptProfile from '@/i18n/pt-BR/rebuild-profile.json';
import { publishSocialUpdate, subscribeTokenSocialUpdates } from './socialUpdates';
import { guardianEndConnection, guardianReportConnection } from '@/rebuild/social/guardianConnectionsClient';

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
    && typeof notice.canEnd === 'boolean'
    && typeof notice.createdAt === 'string' && Number.isFinite(Date.parse(notice.createdAt));
}

export function SocialNoticesPanel(props: { token: string | null }) {
  return <ScopedSocialNotices key={props.token} {...props} />;
}

function ScopedSocialNotices({ token }: { token: string | null }) {
  const { i18n } = useTranslation(); const { isDark } = useTheme();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const family = locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en;
  const copy = family.socialNotices;
  const actionsCopy = family.socialConnectionActions;
  const reportCopy = (locale === 'es-MX' ? esProfile : locale === 'pt-BR' ? ptProfile : enProfile).report;
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
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
    generation.current++; busy.current = false; setOpen(false); setNotices([]); setFailed(false); setLoading(false); setNotice(null);
  }
  // A connection ended anywhere in the Family panel changes which notices can still end one.
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => subscribeTokenSocialUpdates(token, () => { if (openRef.current) reload(); }));
  // E.1/E.13: end or report the account a notice names, for that notice's child.
  const actions = (kidUserId: string) => ({
    copy: actionsCopy, reportCopy, busyId,
    onEnd: async (userId: string) => {
      if (busyId || !token) return;
      setBusyId(userId); setNotice(null);
      const outcome = await guardianEndConnection(api, kidUserId, userId, token);
      setBusyId(null);
      setNotice(outcome === 'ended' ? { text: actionsCopy.ended, error: false } : outcome === 'gone' ? { text: actionsCopy.endGone, error: false } : { text: actionsCopy.endFailed, error: true });
      if (outcome !== 'failed') publishSocialUpdate(kidUserId, token);
    },
    onReport: async (userId: string, category: Parameters<typeof guardianReportConnection>[3], note: string | null) => {
      if (!token) return false;
      const sent = await guardianReportConnection(api, kidUserId, userId, category, note, token);
      if (sent) setNotice({ text: actionsCopy.reported, error: false });
      return sent;
    },
  });
  return <SocialNotices copy={copy} locale={locale} dark={isDark} open={open} notices={notices} loading={loading} failed={failed}
    actions={actions} notice={notice}
    onOpen={() => { setOpen(true); reload(); }} onClose={close} onRetry={reload} />;
}
