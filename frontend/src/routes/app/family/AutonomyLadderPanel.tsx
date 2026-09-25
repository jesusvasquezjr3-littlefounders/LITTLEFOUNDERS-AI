import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { AutonomyLadder } from '@/rebuild/family/AutonomyLadder';
import { fetchKidAutonomy, setKidAutonomy, type AutonomyView, type Level } from '@/rebuild/family/familyAutonomyApi';
import { hubSession } from './familyHubSession';
import { familyAutonomyCopy } from './familyAutonomyCopy';

/*
 * S07.5 (D.17) data plane for one child's independence level on the Family
 * screen. Loads only when opened; every write is re-read. A stale child
 * (link lost) shows the failure copy.
 */
export function AutonomyLadderPanel(props: { kidUserId: string; kidName: string; token: string | null }) {
  return <ScopedAutonomyLadder key={`${props.kidUserId}:${props.token}`} {...props} />;
}

function ScopedAutonomyLadder({ kidUserId, kidName, token }: { kidUserId: string; kidName: string; token: string | null }) {
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const copy = familyAutonomyCopy(locale);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<AutonomyView | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);

  async function load() {
    const current = ++generation.current;
    setLoading(true); setFailed(false);
    const res = await fetchKidAutonomy(kidUserId, hubSession(token));
    if (current !== generation.current) return;
    setLoading(false);
    if (!res.ok) { setFailed(true); return; }
    setView(res.data);
  }

  const refusals: Record<string, string> = {
    AUTONOMY_NOT_ELIGIBLE: copy.ladder.notReady, AUTONOMY_REASON_REQUIRED: copy.notYet.tooVague, DECISION_REASON_NOT_ACTIONABLE: copy.notYet.tooVague,
  };

  async function set(input: { level: Level; preapprovedLimit: number; reasonCode?: string; reason?: string }) {
    if (busy) return;
    setBusy(true); setNotice(null);
    const result = await setKidAutonomy(kidUserId, input, hubSession(token));
    setBusy(false);
    setNotice(result.ok ? { text: copy.ladder.saved, error: false } : { text: refusals[result.code] ?? copy.ladder.failed, error: true });
    await load();
  }

  const levels = { ...copy.levelsTutor, name1: copy.levels.name1, name2: copy.levels.name2, name3: copy.levels.name3, label: copy.levels.label };
  return <AutonomyLadder copy={copy.ladder} levels={levels} notYetCopy={copy.notYet} kidName={kidName} locale={locale} dark={isDark} open={open}
    view={view} loading={loading} failed={failed} busy={busy} notice={notice}
    onToggle={() => { generation.current++; setNotice(null); if (open) { setOpen(false); } else { setOpen(true); void load(); } }}
    onRetry={() => void load()} onSet={(input) => void set(input)} />;
}
