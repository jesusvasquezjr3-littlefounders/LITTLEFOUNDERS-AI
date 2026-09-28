import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { CoachingNote } from '@/rebuild/family/CoachingNote';
import { CoachingTip } from '@/rebuild/family/CoachingTip';
import { DataPolicy } from '@/rebuild/family/DataPolicy';
import { AdultResearch } from '@/rebuild/family/AdultResearch';
import { MyResearch } from '@/rebuild/family/MyResearch';
import { ResearchConsent } from '@/rebuild/family/ResearchConsent';
import { ScopeStatement } from '@/rebuild/family/ScopeStatement';
import { MoneyBridge } from '@/rebuild/wallet/MoneyBridge';
import {
  fetchBridge, fetchCoachingTip, fetchDataPolicy, fetchKidResearch, fetchMyResearch, joinMyResearch, markBridge, markCoachingTip, setKidResearch, stopMyResearch,
  type BridgeMoment, type BridgeState, type CoachingTip as Tip, type PolicyLine, type Research, type ResearchView,
} from '@/rebuild/family/governanceApi';
import { fetchUsualSplit, type Split } from '@/rebuild/family/moneyHabitsApi';
import type { Session } from '@/rebuild/family/familyHubApi';
import { hubSession } from './familyHubSession';
import { familyGovernanceCopy } from './familyGovernanceCopy';

/*
 * S07.7 (D.19-D.23) data planes: they bind the rebuilt governance surfaces
 * (which import nothing legacy) to the shared Core client, the locale and
 * the theme, and re-read after every write. Core and the database decide
 * everything: who sees a tip, who may answer for research, who is old
 * enough for the bridge.
 */

function useLocale() {
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  return { locale, dark: isDark, copy: familyGovernanceCopy(locale) };
}

type Notice = { text: string; error: boolean } | null;

/** D.23: this month's reviewed tip, on the Family and Tasks screens (one delivery per month). */
export function CoachingTipPanel({ token }: { token: string | null }) {
  const { locale, dark, copy } = useLocale();
  const [tip, setTip] = useState<Tip | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    if (!token) return;
    void fetchCoachingTip(hubSession(token)).then((res) => {
      if (!live) return;
      if (!res.ok) { setFailed(res.code !== 'COACHING_NOT_ELIGIBLE'); return; }
      setTip(res.data.tip);
    });
    return () => { live = false; };
  }, [token]);
  async function mark(action: 'opened' | 'dismissed') {
    if (!tip || busy) return;
    setBusy(true);
    const res = await markCoachingTip(tip.deliveryId, action, hubSession(token));
    setBusy(false);
    if (res.ok) setTip(res.data.tip);
  }
  return <CoachingTip copy={copy.coaching} tips={copy.tips} locale={locale} dark={dark} tip={tip} failed={failed} busy={busy}
    onOpen={() => void mark('opened')} onDismiss={() => void mark('dismissed')} />;
}

/** D.20: what the practice covers and does not, for Tutors and teens. */
export function ScopeStatementPanel() {
  const { locale, dark, copy } = useLocale();
  return <ScopeStatement copy={copy.scope} locale={locale} dark={dark} />;
}

/** D.23: the spending limit as structure with a reason, next to the Tutor's limit form. */
export function LimitCoachingPanel() {
  const { locale, dark, copy } = useLocale();
  return <CoachingNote name="limit" label={copy.limitNote.open} close={copy.pricing.close} lines={[copy.limitNote.reason, copy.limitNote.review]} locale={locale} dark={dark} />;
}

/** D.21: the periods the database enforces, read from Core when opened. */
export function DataPolicyPanel({ token }: { token: string | null }) {
  const { locale, dark, copy } = useLocale();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<PolicyLine[] | null>(null);
  const [failed, setFailed] = useState(false);
  async function toggle() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    const res = await fetchDataPolicy(hubSession(token));
    if (res.ok) { setLines(res.data.classes); setFailed(false); } else setFailed(true);
  }
  return <DataPolicy copy={copy.dataPolicy} locale={locale} dark={dark} open={open} lines={lines} failed={failed} onToggle={() => void toggle()} />;
}

/** D.22: the Tutor's research answer for one child, loaded when opened. */
export function ResearchConsentPanel(props: { kidUserId: string; kidName: string; token: string | null }) {
  return <ScopedResearchConsent key={`${props.kidUserId}:${props.token}`} {...props} />;
}

function ScopedResearchConsent({ kidUserId, kidName, token }: { kidUserId: string; kidName: string; token: string | null }) {
  const { locale, dark, copy } = useLocale();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ResearchView | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  async function load() {
    const current = ++generation.current;
    setLoading(true); setFailed(false);
    const res = await fetchKidResearch(kidUserId, hubSession(token));
    if (current !== generation.current) return;
    setLoading(false);
    if (!res.ok) { setFailed(true); return; }
    setView(res.data);
  }
  async function answer(input: { participate: true; disclosureVersion: number } | { participate: false }) {
    if (busy) return;
    setBusy(true); setNotice(null);
    const res = await setKidResearch(kidUserId, input, hubSession(token));
    setBusy(false);
    setNotice(res.ok ? { text: input.participate ? copy.research.saved : copy.research.deleted, error: false } : { text: copy.research.failed, error: true });
    await load();
  }
  return <ResearchConsent copy={copy.research} kidName={kidName} locale={locale} dark={dark} open={open} view={view} loading={loading} failed={failed} busy={busy}
    notice={notice} onToggle={() => { setNotice(null); if (open) setOpen(false); else { setOpen(true); void load(); } }} onAnswer={(input) => void answer(input)} />;
}

/** D.22: the participant's own view and their own no (shows nothing otherwise). */
export function MyResearchPanel({ session }: { session: Session }) {
  const { locale, dark, copy } = useLocale();
  const [research, setResearch] = useState<Research | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  useEffect(() => {
    let live = true;
    void fetchMyResearch(session).then((res) => { if (live && res.ok) setResearch(res.data.research); });
    return () => { live = false; };
  }, [session]);
  async function stop() {
    if (busy) return;
    setBusy(true);
    const res = await stopMyResearch(session);
    setBusy(false);
    if (res.ok) { setResearch(res.data.research); setNotice({ text: copy.myResearch.stopped, error: false }); } else setNotice({ text: copy.myResearch.failed, error: true });
  }
  return <MyResearch copy={copy.myResearch} locale={locale} dark={dark} research={research} busy={busy} notice={notice} onStop={() => void stop()} />;
}

/**
 * H-25 (GAP-FIX-R2): research in an adult's own Settings. Shows only when Core
 * reports the Tutor's lapsed yes (the ask) or the adult's own yes (the stop).
 */
export function AdultResearchPanel({ session }: { session: Session }) {
  const { locale, dark, copy } = useLocale();
  const [view, setView] = useState<ResearchView | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  useEffect(() => {
    let live = true;
    void fetchMyResearch(session).then((res) => { if (live && res.ok) setView(res.data); });
    return () => { live = false; };
  }, [session]);
  async function answer(participate: boolean) {
    if (busy || !view) return;
    setBusy(true);
    const res = participate ? await joinMyResearch(view.currentVersion, session) : await stopMyResearch(session);
    setBusy(false);
    if (res.ok) {
      setView(res.data);
      setNotice({ text: participate ? copy.researchAtEighteen.joined : copy.researchAtEighteen.deleted, error: false });
    } else setNotice({ text: copy.researchAtEighteen.failed, error: true });
  }
  return <AdultResearch copy={copy.researchAtEighteen} locale={locale} dark={dark} research={view?.research ?? null} busy={busy} notice={notice}
    onAnswer={(participate) => void answer(participate)} />;
}

/** D.19: "Beyond the app" for a wallet holder the database finds old enough. */
export function MoneyBridgePanel({ session }: { session: Session }) {
  const { locale, dark, copy } = useLocale();
  const [state, setState] = useState<BridgeState | null>(null);
  const [split, setSplit] = useState<Split | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  useEffect(() => {
    let live = true;
    void fetchBridge(session).then((res) => {
      if (!live || !res.ok) return;
      setState(res.data);
      if (res.data.eligible) void fetchUsualSplit(session).then((s) => { if (live && s.ok) setSplit(s.data.usual); });
    });
    return () => { live = false; };
  }, [session]);
  async function mark(input: { milestone: BridgeMoment; step: 0 | 1 | 2 | 3; done: boolean }) {
    if (busy) return;
    setBusy(true); setNotice(null);
    const res = await markBridge(input, session);
    setBusy(false);
    if (res.ok) setState(res.data); else setNotice({ text: copy.bridge.failed, error: true });
  }
  return <MoneyBridge copy={copy.bridge} locale={locale} dark={dark} state={state} split={split} busy={busy} notice={notice} onMark={(input) => void mark(input)} />;
}

/** Binds a panel that takes a Session to a legacy page's token. */
export function tokenSession(token: string | null): Session {
  return hubSession(token);
}
