import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { api } from '@/lib/api';
import { BadgeShares, type BadgeShareEntry } from '@/rebuild/family/BadgeShares';
import en from '@/i18n/en-US/rebuild.json';
import es from '@/i18n/es-MX/rebuild.json';
import pt from '@/i18n/pt-BR/rebuild.json';

/*
 * F.2's Family-panel data plane for the rebuild BadgeShares surface: loads a
 * kid's live badge shares only when opened, validates every row against the
 * wire shape (an unexpected field set must fail the whole list, never render
 * a stranger-shaped row), and revokes through the parent-only DELETE route.
 * Core is the enforcing boundary — this panel cannot authorize anything.
 */

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
const ACCESS_LOST = ['PARENT_VERIFICATION_REQUIRED', 'FORBIDDEN', 'NOT_FOUND', 'UNAUTHORIZED'];

function isValidShare(value: unknown): value is BadgeShareEntry {
  if (!value || typeof value !== 'object') return false;
  const share = value as Record<string, unknown>;
  return typeof share.token === 'string' && TOKEN_RE.test(share.token)
    && typeof share.achievementLabel === 'string' && share.achievementLabel.length > 0
    && typeof share.createdAt === 'string' && Number.isFinite(Date.parse(share.createdAt))
    && typeof share.expiresAt === 'string' && Number.isFinite(Date.parse(share.expiresAt));
}

export function BadgeSharesPanel(props: { kidUserId: string; token: string | null }) {
  return <ScopedBadgeShares key={`${props.kidUserId}:${props.token}`} {...props} />;
}

function ScopedBadgeShares({ kidUserId, token }: { kidUserId: string; token: string | null }) {
  const { i18n } = useTranslation(); const { isDark } = useTheme();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const copy = (locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en).badgeShares;
  const [open, setOpen] = useState(false);
  const [shares, setShares] = useState<BadgeShareEntry[]>([]);
  const [loading, setLoading] = useState(false); const [failed, setFailed] = useState(false);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revokeFailed, setRevokeFailed] = useState(false);
  const generation = useRef(0); const busy = useRef(false);
  useEffect(() => () => { generation.current++; }, []);

  async function load() {
    if (busy.current) return;
    busy.current = true; const current = ++generation.current;
    setLoading(true); setFailed(false);
    try {
      if (!token) throw new Error('Session unavailable');
      const result = await api<{ shares: unknown }>(`/family/kids/${kidUserId}/badges`, { token });
      if (current !== generation.current) return;
      if (result.error || !result.data) throw new Error('Shares unavailable');
      const list = result.data.shares;
      if (!Array.isArray(list)) throw new Error('Invalid shares response');
      const valid = list.filter(isValidShare);
      if (valid.length !== list.length) throw new Error('Invalid shares response');
      setShares(valid.map((share) => ({
        token: share.token,
        achievementLabel: share.achievementLabel,
        createdAt: share.createdAt,
        expiresAt: share.expiresAt,
      })));
    } catch {
      if (current === generation.current) { setFailed(true); setShares([]); }
    } finally {
      if (current === generation.current) { busy.current = false; setLoading(false); }
    }
  }

  async function revoke(shareToken: string) {
    if (busy.current || !token) return;
    busy.current = true; const current = ++generation.current;
    setRevokingToken(shareToken); setNotice(null); setRevokeFailed(false);
    try {
      const result = await api<{ revoked: boolean }>(
        `/family/kids/${kidUserId}/badges/${encodeURIComponent(shareToken)}`,
        { token, method: 'DELETE' },
      );
      if (current !== generation.current) return;
      if (result.error && ACCESS_LOST.includes(result.error.code)) {
        setShares([]); setFailed(true); setNotice(null);
        return;
      }
      if (result.error || result.data?.revoked !== true) throw new Error('Revocation not confirmed');
      setShares((previous) => previous.filter((share) => share.token !== shareToken));
      setNotice(copy.revoked);
    } catch {
      if (current === generation.current) { setNotice(copy.revokeFailed); setRevokeFailed(true); }
    } finally {
      if (current === generation.current) { busy.current = false; setRevokingToken(null); }
    }
  }

  function reload() {
    generation.current++; busy.current = false; setRevokingToken(null); setNotice(null); setRevokeFailed(false);
    setShares([]); void load();
  }
  function close() {
    generation.current++; busy.current = false; setOpen(false); setRevokingToken(null); setNotice(null); setRevokeFailed(false);
    setShares([]); setFailed(false); setLoading(false);
  }
  return <BadgeShares revokingToken={revokingToken} notice={notice} revokeFailed={revokeFailed} onRevoke={(shareToken) => void revoke(shareToken)}
    copy={copy} locale={locale} dark={isDark} open={open} shares={shares} loading={loading} failed={failed}
    onToggle={() => { if (open) close(); else { setOpen(true); reload(); } }}
    onRetry={reload} />;
}
