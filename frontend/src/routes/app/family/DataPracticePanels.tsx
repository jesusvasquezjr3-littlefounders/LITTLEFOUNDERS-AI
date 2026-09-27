import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import en from '@/i18n/en-US/dataPractices.json';
import es from '@/i18n/es-MX/dataPractices.json';
import pt from '@/i18n/pt-BR/dataPractices.json';
import { DataPracticeConsent, type DataPracticesCopy } from '@/rebuild/family/DataPracticeConsent';
import { MyDataPractices } from '@/rebuild/family/MyDataPractices';
import {
  fetchKidDataPractices, fetchMyDataPractices, setKidDataPractice, setMyDataPractice,
  type DataPractice, type DataPracticeState, type PracticeAnswer, type PracticeKey,
} from '@/rebuild/family/dataPracticesApi';
import type { Session } from '@/rebuild/family/familyHubApi';
import { hubSession } from './familyHubSession';

/*
 * S10.3 (OD-9 section 4.2) data planes: they bind the rebuilt consent surfaces
 * (which import nothing legacy) to the shared Core client, the locale and the
 * theme, and re-read after every write. Core and the database decide who may
 * answer and whether a practice applies to a migrated child.
 */

export function dataPracticesCopy(locale: string | undefined): DataPracticesCopy {
  return (locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en) as DataPracticesCopy;
}

function useLocale() {
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  return { locale, dark: isDark, copy: dataPracticesCopy(locale) };
}

type Notice = { text: string; error: boolean } | null;

/** The Tutor's answers for one migrated child (shows nothing for any other child). */
export function DataPracticeConsentPanel(props: { kidUserId: string; kidName: string; token: string | null }) {
  return <ScopedDataPracticeConsent key={`${props.kidUserId}:${props.token}`} {...props} />;
}

function ScopedDataPracticeConsent({ kidUserId, kidName, token }: { kidUserId: string; kidName: string; token: string | null }) {
  const { locale, dark, copy } = useLocale();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<DataPracticeState | null>(null);
  const [failed, setFailed] = useState(false);
  const [busyKey, setBusyKey] = useState<PracticeKey | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const generation = useRef(0);
  async function load() {
    const current = ++generation.current;
    const res = await fetchKidDataPractices(kidUserId, hubSession(token));
    if (current !== generation.current) return;
    if (!res.ok) { setFailed(true); return; }
    setFailed(false);
    setState(res.data);
  }
  useEffect(() => {
    if (token) void load();
    return () => { generation.current++; };
  }, []);
  async function answer(practice: DataPractice, input: PracticeAnswer) {
    if (busyKey) return;
    setBusyKey(practice.key); setNotice(null);
    const res = await setKidDataPractice(kidUserId, practice.key, input, hubSession(token));
    setBusyKey(null);
    if (res.ok) { setState(res.data); setNotice({ text: copy.tutor.saved, error: false }); } else {
      setNotice({ text: copy.tutor.failed, error: true });
      await load();
    }
  }
  return <DataPracticeConsent copy={copy} kidName={kidName} locale={locale} dark={dark} open={open} state={state} failed={failed} busyKey={busyKey} notice={notice}
    onToggle={() => { setNotice(null); if (open) setOpen(false); else { setOpen(true); if (failed) void load(); } }}
    onAnswer={(practice, input) => void answer(practice, input)} />;
}

/** The account's own answers (a child's own no; a self-registered teen's yes to usage counts). */
export function MyDataPracticesPanel({ session }: { session: Session }) {
  const { locale, dark, copy } = useLocale();
  const [state, setState] = useState<DataPracticeState | null>(null);
  const [busyKey, setBusyKey] = useState<PracticeKey | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  useEffect(() => {
    let live = true;
    void fetchMyDataPractices(session).then((res) => { if (live && res.ok) setState(res.data); });
    return () => { live = false; };
  }, [session]);
  async function answer(practice: DataPractice, input: PracticeAnswer) {
    if (busyKey) return;
    setBusyKey(practice.key); setNotice(null);
    const res = await setMyDataPractice(practice.key, input, session);
    setBusyKey(null);
    if (res.ok) { setState(res.data); setNotice({ text: copy.self.saved, error: false }); } else setNotice({ text: copy.self.failed, error: true });
  }
  return <MyDataPractices copy={copy} locale={locale} dark={dark} state={state} busyKey={busyKey} notice={notice} onAnswer={(practice, input) => void answer(practice, input)} />;
}
