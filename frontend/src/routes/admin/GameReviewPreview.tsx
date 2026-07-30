import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Button, Icon, LoadingOverlay } from '@/components/ui';
import { isUnsupportedMechanic, parseGameDocument } from '@/game-engine/core/schema';
import { seedFromString } from '@/game-engine/core/rng';
import type { GameDocument, MechanicSlice } from '@/game-engine/core/types';
import { loadMechanic } from '@/game-engine/registry';
import GamePlayer from '@/game-engine/player/GamePlayer';
import { UnsupportedGameCard } from '@/game-engine/player/overlays';
import { Unavailable } from './adminShared';

/*
 * Review preview — the reviewer PLAYS the game before publishing it.
 *
 * This mounts the REAL GamePlayer on the REAL document, so what the reviewer
 * sees is what a child would see: same intro, same tutorial, same simulation,
 * same results screen. A preview built out of screenshots or a metadata dump
 * cannot catch an unwinnable board, a mis-bound concept or a confusing control,
 * which is precisely what the human gate is for (§1.9).
 *
 * Two deliberate differences from `/games/:slug`:
 *   1. NO `onComplete` — the run is never reported, so nothing is scored, no
 *      attempt row is written and no XP is awarded to the staff account.
 *   2. The document comes from the ADMIN endpoint, because a game in `review`
 *      is by definition not published and the player's own catalog route must
 *      keep refusing it.
 *
 * A game in review is not yet trusted content: it is still parsed by the same
 * `parseGameDocument` the child's route uses, and a rejected document renders a
 * friendly failure instead of crashing the console.
 */

interface GameDocumentResponse {
  locale: string;
  /** Client-safe: Core strips the server-only `validation` sidecar. */
  document: unknown;
}

type PreviewState =
  | { status: 'loading' }
  | { status: 'error'; code: string }
  | { status: 'unsupported' }
  | { status: 'broken' }
  | { status: 'ready'; document: GameDocument; slice: MechanicSlice };

export function GameReviewPreview({
  gameId,
  title,
  onClose,
}: {
  gameId: string;
  title: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [state, setState] = useState<PreviewState>({ status: 'loading' });
  /** Bumped by "play again" — a fresh seed and a fresh player, same document. */
  const [attempt, setAttempt] = useState(0);

  // Derived from the game id, so two reviewers replay the same board and can
  // talk about the same run. Bumping `attempt` gives a genuinely different one.
  const seed = useMemo(() => seedFromString(`${gameId}:${attempt}`), [gameId, attempt]);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    void (async () => {
      const token = await getToken();
      const { data, error } = await api<GameDocumentResponse>(
        `/admin/games/${encodeURIComponent(gameId)}/document`,
        { token },
      );
      if (cancelled) return;
      if (error) {
        setState({ status: 'error', code: error.code });
        return;
      }

      const parsed = await parseGameDocument(data.document).catch(() => null);
      if (cancelled) return;
      if (parsed === null) {
        setState({ status: 'broken' });
        return;
      }
      if (!parsed.ok) {
        if (isUnsupportedMechanic(parsed.issues)) {
          setState({ status: 'unsupported' });
          return;
        }
        // A content defect the reviewer must be able to act on — this is exactly
        // the kind of game that must NOT be published.
        console.warn(`[admin/games] document rejected gameId=${gameId}`, parsed.issues);
        setState({ status: 'broken' });
        return;
      }

      const slice = await loadMechanic(parsed.document.meta.mechanic).catch(() => null);
      if (cancelled) return;
      if (slice === null) {
        setState({ status: 'broken' });
        return;
      }
      setState({ status: 'ready', document: parsed.document, slice });
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId, getToken]);

  // Escape closes the preview from any state. GamePlayer owns its own exit
  // affordance, but a reviewer who lands on a broken document needs a way out
  // that does not depend on the player having mounted at all.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (state.status === 'ready') {
    return createPortal(
      <GamePlayer
        // A new seed remounts the player, so "play again" is a genuinely fresh
        // session rather than a reset in place.
        key={seed}
        document={state.document}
        slice={state.slice}
        seed={seed}
        // No onComplete on purpose: a preview is never scored or rewarded.
        onExit={onClose}
        onReplay={() => setAttempt((previous) => previous + 1)}
      />,
      document.body,
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-base">
      <header className="flex items-center justify-between gap-3 border-b border-outline/20 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="lf-label truncate text-content">{title}</p>
          <p className="lf-caption text-content-muted">{t('admin.games.previewNote')}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('admin.games.previewClose')}
          className="min-h-11 min-w-11 shrink-0 rounded-full p-1.5 transition-colors duration-150 hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Icon name="close" className="!text-[20px] text-content-muted" />
        </button>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        {state.status === 'loading' ? (
          <LoadingOverlay label={t('admin.loading')} />
        ) : state.status === 'unsupported' ? (
          <UnsupportedGameCard onExit={onClose} />
        ) : state.status === 'error' ? (
          <div className="w-full max-w-md">
            <Unavailable code={state.code} />
          </div>
        ) : (
          <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
            <Icon name="report" className="!text-[40px] text-content-faint" />
            <p className="lf-body-sm text-content-muted">{t('admin.games.previewBroken')}</p>
            <Button variant="secondary" onClick={onClose}>
              {t('admin.games.previewClose')}
            </Button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default GameReviewPreview;
