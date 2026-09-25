import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { ShareDestinations } from '@/rebuild/family/ShareDestinations';
import {
  archiveKidDestination, createKidDestination, fetchKidShare, fetchKidUsualSplit, settleKidGift, type ShareView, type Split,
} from '@/rebuild/family/moneyHabitsApi';
import { hubSession } from './familyHubSession';
import { moneyHabitsCopy } from './moneyHabitsCopy';

/*
 * S07.4 (D.14) data plane for a Tutor: the real places a child's Share coins
 * go, and what the family did with each pledge. Loads only when opened;
 * every write is re-read. A stale child (link lost) shows the failure copy.
 */
export function ShareDestinationsPanel(props: { kidUserId: string; kidName: string; token: string | null }) {
  return <ScopedShareDestinations key={`${props.kidUserId}:${props.token}`} {...props} />;
}

function ScopedShareDestinations({ kidUserId, kidName, token }: { kidUserId: string; kidName: string; token: string | null }) {
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const copy = moneyHabitsCopy(locale).destinations;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<ShareView | null>(null);
  const [usual, setUsual] = useState<Split | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);

  async function load() {
    const current = ++generation.current;
    setLoading(true); setFailed(false);
    const [shareRes, splitRes] = await Promise.all([fetchKidShare(kidUserId, hubSession(token)), fetchKidUsualSplit(kidUserId, hubSession(token))]);
    if (current !== generation.current) return;
    setLoading(false);
    if (!shareRes.ok) { setFailed(true); return; }
    setView(shareRes.data);
    setUsual(splitRes.ok ? splitRes.data.usual : null);
  }

  const refusals: Record<string, string> = {
    SHARE_DESTINATION_LIMIT: copy.limit, SHARE_GIFT_NOTE_REQUIRED: copy.noteRequired, VALIDATION_ERROR: copy.invalid,
  };

  async function write(run: () => Promise<{ ok: true } | { ok: false; code: string }>, success: string) {
    if (busy) return;
    setBusy(true); setNotice(null);
    const result = await run();
    setBusy(false);
    setNotice(result.ok ? { text: success, error: false } : { text: refusals[result.code] ?? copy.failed, error: true });
    await load();
  }

  const session = () => hubSession(token);
  const named = (text: string) => text.replace('{name}', kidName);
  return <ShareDestinations copy={copy} kidName={kidName} locale={locale} dark={isDark} open={open} view={view} usual={usual}
    loading={loading} failed={failed} busy={busy} notice={notice}
    onToggle={() => { generation.current++; setNotice(null); if (open) { setOpen(false); } else { setOpen(true); void load(); } }}
    onRetry={() => void load()}
    onAdd={(input) => void write(() => createKidDestination(kidUserId, input, session()), copy.added)}
    onRemove={(destination) => void write(() => archiveKidDestination(kidUserId, destination.id, session()), copy.removed)}
    onSettle={(gift, outcome, note) => void write(() => settleKidGift(kidUserId, gift.id, outcome, note, session()),
      named(outcome === 'given' ? copy.givenNotice : copy.returnedNotice))} />;
}
