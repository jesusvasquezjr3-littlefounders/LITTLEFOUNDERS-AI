import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { trackInsight } from '@/lib/insights';
import { randomAvatarOptions } from '@/lib/avatarOptions';
import { LookEditor, type LookEditorView } from '@/rebuild/account/LookEditor';
import { lookToStored, resolveCover, resolveLook, type AvatarLook, type CoverId } from '@/rebuild/account/avatar/avatarKit';
import { isOffline, useProfileScreenEnvironment } from './profileRouteKit';

/*
 * /profile/avatar (P2): the data plane of the rebuilt look editor. It reads
 * the stored avatar and cover from Core (served through Core's E.12
 * projection), keeps the person's edits locally, and on save writes the avatar
 * (PUT /profile/avatar: exactly the closed option set) and, only when it
 * changed, the cover (PUT /profile/cover: a preset id). Nothing is written
 * until the person saves, and a failed write leaves the edits on screen.
 */

interface Loaded { look: AvatarLook; cover: CoverId; storedCover: CoverId; seed?: string }

export function LookEditorRoute() {
  const { session } = useAuth();
  return session ? <ScopedLookEditor key={session.user.id} /> : null;
}

function ScopedLookEditor() {
  const { session, getToken, refreshMe } = useAuth();
  const { locale, dark, copy, ageBand } = useProfileScreenEnvironment();
  const navigate = useNavigate();
  const fallbackSeed = session?.user.id ?? 'littlefounder';
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState<{ offline: boolean; retrying: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<'failed' | 'offline' | null>(null);
  const [attempt, setAttempt] = useState(0);
  const saveInFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getToken();
      const result = token ? await api<{ avatarOptions?: unknown; cover?: unknown }>('/profile', { token }) : null;
      if (cancelled) return;
      const data = result?.data;
      if (!data || typeof data !== 'object') { setFailed({ offline: isOffline(result?.error), retrying: false }); return; }
      const stored = data.avatarOptions && typeof data.avatarOptions === 'object' ? data.avatarOptions as Record<string, unknown> : {};
      const cover = resolveCover(data.cover);
      setFailed(null);
      setLoaded({ look: resolveLook(stored, fallbackSeed), cover, storedCover: cover, seed: typeof stored.seed === 'string' ? stored.seed : undefined });
    })();
    return () => { cancelled = true; };
  }, [getToken, attempt, fallbackSeed]);

  async function save() {
    if (!loaded || saveInFlight.current) return;
    saveInFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      const avatar = token ? await api('/profile/avatar', { method: 'PUT', token, body: { options: lookToStored(loaded.look, loaded.seed) } }) : null;
      if (!avatar || avatar.error) { setError(isOffline(avatar?.error) ? 'offline' : 'failed'); return; }
      trackInsight('avatar_edit', { routeClass: 'profile' });
      if (loaded.cover !== loaded.storedCover) {
        const cover = await api('/profile/cover', { method: 'PUT', token, body: { preset: loaded.cover } });
        if (cover.error) { setError(isOffline(cover.error) ? 'offline' : 'failed'); return; }
        setLoaded((current) => current && { ...current, storedCover: loaded.cover });
      }
      await refreshMe();
      navigate('/profile');
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }

  const view: LookEditorView = loaded
    ? { kind: 'ready', look: loaded.look, cover: loaded.cover, saving, error }
    : failed ? { kind: 'failed', ...failed } : { kind: 'loading' };

  return <LookEditor copy={copy.lookEditor} locale={locale} dark={dark} ageBand={ageBand} view={view}
    onChange={(look) => { setError(null); setLoaded((current) => current && { ...current, look }); }}
    onCover={(cover) => { setError(null); setLoaded((current) => current && { ...current, cover }); }}
    // A cosmetic draw (B.22 allowlist: lib/avatarOptions.ts); nothing is earned or unlocked.
    onRandom={() => { setError(null); setLoaded((current) => current && { ...current, look: resolveLook({ ...randomAvatarOptions() }, fallbackSeed) }); }}
    onSave={() => void save()}
    onRetry={() => { setFailed({ offline: false, retrying: true }); setAttempt((value) => value + 1); }}
    onNavigate={(href) => navigate(href)} />;
}
