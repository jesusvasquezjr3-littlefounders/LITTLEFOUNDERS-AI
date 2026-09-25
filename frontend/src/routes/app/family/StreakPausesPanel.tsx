import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { StreakPauses, type PauseNotice } from '@/rebuild/family/StreakPauses';
import { endPause, fetchKidStreak, pauseStreak, type ChoreStreak, type StreakPause } from '@/rebuild/family/familyMoneyApi';
import { hubSession } from './familyHubSession';
import { familyMoneyCopy } from './familyMoneyCopy';

/*
 * S07.3 (D.2) data plane for a Tutor's holiday pause of a child's chore
 * streak. Loads only when opened; every write is re-read so the surface
 * shows what the server holds.
 */
export function StreakPausesPanel(props: { kidUserId: string; kidName: string; token: string | null }) {
  return <ScopedStreakPauses key={`${props.kidUserId}:${props.token}`} {...props} />;
}

const REFUSAL_COPY: Record<string, 'invalid' | 'overlap' | 'limit' | 'over'> = {
  STREAK_PAUSE_INVALID: 'invalid', STREAK_PAUSE_OVERLAP: 'overlap', STREAK_PAUSE_LIMIT: 'limit', STREAK_PAUSE_OVER: 'over',
};

function ScopedStreakPauses({ kidUserId, kidName, token }: { kidUserId: string; kidName: string; token: string | null }) {
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const copy = familyMoneyCopy(locale).streakPauses;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<PauseNotice>(null);
  const [streak, setStreak] = useState<ChoreStreak | null>(null);
  const [pauses, setPauses] = useState<StreakPause[]>([]);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);

  async function load(keepNotice = false) {
    const current = ++generation.current;
    setLoading(true); setFailed(false);
    if (!keepNotice) setNotice(null);
    const res = await fetchKidStreak(kidUserId, hubSession(token));
    if (current !== generation.current) return;
    setLoading(false);
    if (!res.ok) { setFailed(true); return; }
    setStreak(res.data.streak);
    setPauses(res.data.pauses);
  }

  function toggle() {
    generation.current++;
    if (open) { setOpen(false); setNotice(null); return; }
    setOpen(true); void load();
  }

  async function pause(input: { startsOn: string; endsOn: string }) {
    setBusy(true); setNotice(null);
    const res = await pauseStreak(kidUserId, input, hubSession(token));
    setBusy(false);
    setNotice(res.ok ? { text: copy.saved, error: false } : { text: copy[REFUSAL_COPY[res.code] ?? 'saveFailed'], error: true });
    await load(true);
  }

  async function end(pauseItem: StreakPause) {
    setBusy(true); setNotice(null);
    const res = await endPause(kidUserId, pauseItem.id, hubSession(token));
    setBusy(false);
    setNotice(res.ok ? { text: res.data.outcome === 'ended' ? copy.ended : copy.cancelled, error: false } : { text: copy[REFUSAL_COPY[res.code] ?? 'saveFailed'], error: true });
    await load(true);
  }

  return <StreakPauses copy={copy} locale={locale} dark={isDark} kidName={kidName} open={open} loading={loading} failed={failed} busy={busy}
    notice={notice} streak={streak} pauses={pauses} onToggle={toggle} onRetry={() => void load()} onPause={(input) => void pause(input)} onEnd={(p) => void end(p)} />;
}
