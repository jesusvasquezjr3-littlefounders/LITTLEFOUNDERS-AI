import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { CoGuardians, GuardianRequests } from '@/rebuild/family/CoGuardians';
import { decideCoGuardian, fetchCoGuardians, fetchOwnLinks, leaveChild, type CoGuardian, type OwnLink } from '@/rebuild/family/familyHubApi';
import { hubSession } from './familyHubSession';
import en from '@/i18n/en-US/familyHub.json';
import es from '@/i18n/es-MX/familyHub.json';
import pt from '@/i18n/pt-BR/familyHub.json';

/*
 * S07.1 data plane for the guardian-link lifecycle (D.5 / OD-21). Core and
 * the database decide every transition; these panels only render the state
 * the server confirmed and never assume a decision landed.
 */

function useFamilyHubCopy() {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  return { locale, copy: locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en };
}

const ACCESS_LOST = ['NOT_FOUND', 'FORBIDDEN', 'UNAUTHORIZED', 'PARENT_VERIFICATION_REQUIRED'];

export function CoGuardiansPanel(props: { kidUserId: string; kidName: string; token: string | null; onAccessLost?: () => void }) {
  return <ScopedCoGuardians key={`${props.kidUserId}:${props.token}`} {...props} />;
}

function ScopedCoGuardians({ kidUserId, kidName, token, onAccessLost }: { kidUserId: string; kidName: string; token: string | null; onAccessLost?: () => void }) {
  const { locale, copy } = useFamilyHubCopy();
  const { isDark } = useTheme();
  const c = copy.coGuardians;
  const [open, setOpen] = useState(false);
  const [guardians, setGuardians] = useState<CoGuardian[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);

  async function load() {
    const current = ++generation.current;
    setLoading(true); setFailed(false);
    const result = await fetchCoGuardians(kidUserId, hubSession(token));
    if (current !== generation.current) return;
    setLoading(false);
    if (!result.ok) { setGuardians([]); setFailed(true); return; }
    setGuardians(result.data.guardians);
  }

  async function decide(linkId: string, decision: 'confirm' | 'reject') {
    if (busy) return;
    const current = ++generation.current;
    setBusy(true); setNotice(null);
    const result = await decideCoGuardian(kidUserId, linkId, decision, hubSession(token));
    if (current !== generation.current) return;
    setBusy(false);
    if (result.ok) setNotice({ text: decision === 'confirm' ? c.confirmed : c.rejectedNotice, error: false });
    else setNotice({ text: result.code === 'GUARDIAN_LINK_NOT_PENDING' ? c.conflict : c.decisionFailed, error: true });
    void load();
  }

  async function leave() {
    if (busy) return;
    const current = ++generation.current;
    setBusy(true); setNotice(null);
    const result = await leaveChild(kidUserId, hubSession(token));
    if (current !== generation.current) return;
    setBusy(false); setConfirmingLeave(false);
    if (result.ok) {
      setNotice({ text: c.left, error: false });
      onAccessLost?.();
      return;
    }
    setNotice({ text: result.code === 'LAST_GUARDIAN' ? c.leaveLast : c.leaveFailed, error: true });
    if (ACCESS_LOST.includes(result.code)) onAccessLost?.();
    else void load();
  }

  function toggle() {
    generation.current++;
    if (open) { setOpen(false); setBusy(false); setNotice(null); setConfirmingLeave(false); setGuardians([]); return; }
    setOpen(true); void load();
  }

  return <CoGuardians copy={c} locale={locale} dark={isDark} kidName={kidName} open={open} guardians={guardians} loading={loading} failed={failed}
    busy={busy} notice={notice?.text ?? null} noticeIsError={notice?.error ?? false} confirmingLeave={confirmingLeave}
    onToggle={toggle} onRetry={() => void load()} onDecision={(id, decision) => void decide(id, decision)}
    onLeaveStart={() => setConfirmingLeave(true)} onLeaveCancel={() => setConfirmingLeave(false)} onLeaveConfirm={() => void leave()} />;
}

/** The invited or departed adult's own link states; renders nothing when there are none. */
export function GuardianRequestsPanel({ token }: { token: string | null }) {
  const { locale, copy } = useFamilyHubCopy();
  const { isDark } = useTheme();
  const [links, setLinks] = useState<OwnLink[]>([]);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void fetchOwnLinks(hubSession(token)).then((result) => {
      if (cancelled) return;
      if (result.ok) { setLinks(result.data.links); setFailed(false); } else { setLinks([]); setFailed(true); }
    });
    return () => { cancelled = true; };
  }, [token, attempt]);
  return <GuardianRequests copy={copy.guardianRequests} locale={locale} dark={isDark} links={links} failed={failed} onRetry={() => setAttempt((n) => n + 1)} />;
}
