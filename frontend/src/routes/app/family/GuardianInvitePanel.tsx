import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { GuardianInviteMint, GuardianInviteAccept } from '@/rebuild/family/GuardianInvite';
import en from '@/i18n/en-US/rebuild-family.json';
import es from '@/i18n/es-MX/rebuild-family.json';
import pt from '@/i18n/pt-BR/rebuild-family.json';

/*
 * A.1's second-verified-guardian data plane. Two surfaces:
 *  - GuardianInvitePanel: a verified parent mints a single-use invite for
 *    one kid; the resulting link points at /family?join=TOKEN.
 *  - GuardianInviteJoin: the joining verified parent sees the invite at
 *    /family?join=TOKEN, previews the kid's display name (server-derived,
 *    never contact data) and accepts through the one-shot exchange.
 * Core remains the enforcing boundary — these panels authorize nothing.
 */

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

export function GuardianInvitePanel(props: { kidUserId: string; token: string | null }) {
  return <ScopedGuardianInvite key={`${props.kidUserId}:${props.token}`} {...props} />;
}

function ScopedGuardianInvite({ kidUserId, token }: { kidUserId: string; token: string | null }) {
  const { i18n } = useTranslation(); const { isDark } = useTheme();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const copy = (locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en).guardianInvite;
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeIsError, setNoticeIsError] = useState(false);
  const generation = useRef(0); const busy = useRef(false);
  useEffect(() => () => { generation.current++; }, []);

  async function mint() {
    if (busy.current || !token) return;
    busy.current = true; const current = ++generation.current;
    setCreating(true); setNotice(null);
    try {
      const result = await api<{ token: string }>(`/family/kids/${kidUserId}/guardian-invite`, { method: 'POST', token });
      if (current !== generation.current) return;
      if (result.error || !result.data) throw new Error('Invite unavailable');
      setLink(`${window.location.origin}/family?join=${encodeURIComponent(result.data.token)}`);
      setNotice(copy.linkReady);
    } catch {
      if (current === generation.current) { setNotice(copy.failed); setNoticeIsError(true); }
    } finally {
      if (current === generation.current) { busy.current = false; setCreating(false); }
    }
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setNotice(copy.copyFailed); setNoticeIsError(true);
    }
  }

  function close() {
    generation.current++; busy.current = false;
    setOpen(false); setCreating(false); setLink(null); setCopied(false); setNotice(null); setNoticeIsError(false);
  }

  return <GuardianInviteMint copy={copy} locale={locale} dark={isDark} open={open} creating={creating} link={link} copied={copied}
    notice={notice} noticeIsError={noticeIsError}
    onOpen={() => setOpen(true)} onClose={close} onMint={() => void mint()} onCopy={() => void copyLink()} />;
}

export function GuardianInviteJoin({ inviteToken }: { inviteToken: string }) {
  const { i18n } = useTranslation(); const { isDark } = useTheme();
  const { getToken } = useAuth();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const copy = (locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en).guardianInvite;
  const [kidName, setKidName] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selfIssued, setSelfIssued] = useState(false);
  const validToken = TOKEN_RE.test(inviteToken);

  useEffect(() => {
    if (!validToken) { setExpired(true); return; }
    let cancelled = false;
    void (async () => {
      const token = await getToken();
      if (cancelled) return;
      if (!token) return;
      const result = await api<{ displayName: string | null; confirmedBy?: string }>(`/family/guardian-invite/${inviteToken}`, { token });
      if (cancelled) return;
      if (result.error || !result.data) { setExpired(true); return; }
      // S07.2: a teen's own invite is confirmed by the teen, not a current Tutor.
      setSelfIssued(result.data.confirmedBy === 'account_holder');
      setKidName(result.data.displayName);
    })();
    return () => { cancelled = true; };
  }, [inviteToken, getToken, validToken]);

  async function accept() {
    if (accepting || kidName === null) return;
    setAccepting(true); setFailed(false);
    const token = await getToken();
    const result = await api<{ linked: boolean; status: string }>(`/family/guardian-invite/${inviteToken}/accept`, { method: 'POST', token });
    setAccepting(false);
    // S07.1: 'pending' until the child's current Tutor confirms; only a
    // confirmed shape is shown, never an assumed link.
    const status = result.data?.status;
    if (result.error || !((status === 'verified' && result.data?.linked === true) || (status === 'pending' && result.data?.linked === false))) { setFailed(true); return; }
    setPending(status === 'pending');
    setAccepted(true);
  }

  return <GuardianInviteAccept copy={copy} locale={locale} dark={isDark} kidName={kidName} accepting={accepting}
    accepted={accepted} pending={pending} selfIssued={selfIssued} failed={failed} expired={expired} onAccept={() => void accept()} />;
}
