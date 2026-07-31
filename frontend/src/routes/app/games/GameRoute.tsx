import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { trackInsight } from '@/lib/insights';
import { Button, Icon, LoadingOverlay } from '@/components/ui';
import CharacterActor from '@/components/characters/control/CharacterActor';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { isUnsupportedMechanic, parseGameDocument } from '@/game-engine/core/schema';
import { seedFromString } from '@/game-engine/core/rng';
import type { GameDocument, MechanicSlice } from '@/game-engine/core/types';
import { loadMechanic } from '@/game-engine/registry';
import GamePlayer from '@/game-engine/player/GamePlayer';
import type { GameRunSubmission, ServerGameResult } from '@/game-engine/player/GamePlayer';
import { UnsupportedGameCard } from '@/game-engine/player/overlays';
import {
  fetchGame,
  fetchGameCatalog,
  findCatalogGameBySlug,
  localCalendarDate,
  submitGameRun,
  toServerGameResult,
} from './api';

/*
 * /games/:slug — the fullscreen Game Player wired to Core (GAME_ENGINE.md §6/§8,
 * /DESIGN.md §Screen Recipes → Game player). Registered OUTSIDE the AppLayout
 * route group in App.tsx so no dashboard chrome ever renders behind it —
 * GamePlayer already owns a `fixed inset-0` layer, exactly like the Lesson
 * player.
 *
 * COMPLETION IS NOT NAVIGATION — the precedent set in
 * `routes/app/learn/LessonRoute.tsx` and encoded in GamePlayer's two callbacks.
 * `onComplete` only reports the run; navigating there would rip the results
 * screen (score, XP, cast celebration) away before the child ever saw what they
 * earned. `onExit` navigates, and fires when they leave the results screen.
 *
 * THE CLIENT NEVER REPORTS A SCORE. The payload carries the seed, the input log
 * and the elapsed seconds; Core replays the log and DERIVES the reward. What
 * comes back is authoritative and replaces the player's provisional numbers.
 */

type LoadState =
  | { status: 'loading' }
  /** An API failure — rendered through the shared `errors.api.<code>` banner. */
  | { status: 'error'; code: string }
  /** A mechanic this build cannot play. Friendly card, no XP, no crash (§7). */
  | { status: 'unsupported' }
  /** A document that failed validation, or a mechanic chunk that would not load.
   *  Distinct from `unsupported`: that one means "your app is older than this
   *  content", this one means "we could not run this right now". */
  | { status: 'broken' }
  | { status: 'ready'; gameId: string; document: GameDocument; slice: MechanicSlice };

/** The hub passes the id it already has; a bare deep link has to look it up. */
function readGameIdFromState(state: unknown): string | null {
  if (typeof state !== 'object' || state === null) return null;
  const { gameId } = state as { gameId?: unknown };
  return typeof gameId === 'string' && gameId.length > 0 ? gameId : null;
}

/**
 * One run id per entry — and per replay, since a replay is a new run: Core treats
 * a run id as single-use and rejects a second POST under the same one.
 *
 * The fallback only ever runs where `crypto.randomUUID` is missing (old WebViews,
 * jsdom). It is UUID-SHAPED on purpose — Core validates `run_id` as a uuid, so the
 * Lesson player's `${id}-${Date.now()}` fallback shape would be a 400 here. What
 * the server needs from a run id is uniqueness, not unpredictability.
 */
function newRunId(): string {
  const native = globalThis.crypto?.randomUUID?.();
  if (typeof native === 'string') return native;
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function FullscreenShell({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-base">{children}</div>;
}

export function GameRoute() {
  const { t } = useTranslation();
  const { slug = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  /** Bumped by "play again" — a fresh run id, a fresh seed, a fresh player. */
  const [attempt, setAttempt] = useState(0);

  const stateGameId = readGameIdFromState(location.state);

  const runId = useMemo(() => newRunId(), [slug, attempt]);
  // Derived from the run id, so the same run always replays under the same
  // stream — including on a re-verification months after the attempt was scored.
  const seed = useMemo(() => seedFromString(runId), [runId]);

  // Insights (/INSIGHTS.md): `game_start` is a CLIENT event by design — the server
  // cannot assert it, because fetching a document is not starting a game. Fired per
  // run (a replay is a new run), mirroring how LessonRoute fires `lesson_start` on
  // entry. `game_complete` is emitted server-side, where the derived score lives.
  useEffect(() => {
    trackInsight('game_start', { routeClass: 'games' });
  }, [slug, attempt]);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    void (async () => {
      const token = await getToken();

      let gameId = stateGameId;
      if (gameId === null) {
        const catalog = await fetchGameCatalog(token);
        if (cancelled) return;
        if (catalog.error) {
          setState({ status: 'error', code: catalog.error.code });
          return;
        }
        const found = findCatalogGameBySlug(catalog.data.courses, slug);
        if (!found) {
          setState({ status: 'error', code: 'NOT_FOUND' });
          return;
        }
        gameId = found.game.id;
      }

      // 403 GAME_LOCKED and 404 NOT_FOUND both land in the banner with their own
      // i18n copy: lock state is Core's answer, never re-derived here.
      const { data, error } = await fetchGame(gameId, token);
      if (cancelled) return;
      if (error) {
        setState({ status: 'error', code: error.code });
        return;
      }

      // parseGameDocument loads exactly ONE mechanic chunk and never throws for a
      // content reason; it can only reject when that chunk fails to download.
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
        // A content bug, not a client-version gap. Logged so it is diagnosable;
        // the child sees a friendly, honest failure either way.
        console.warn(`[games] document rejected slug=${slug}`, parsed.issues);
        setState({ status: 'broken' });
        return;
      }

      // Cached by the parse above, so this resolves without a second download.
      const slice = await loadMechanic(parsed.document.meta.mechanic).catch(() => null);
      if (cancelled) return;
      if (slice === null) {
        setState({ status: 'broken' });
        return;
      }
      setState({ status: 'ready', gameId, document: parsed.document, slice });
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, stateGameId, getToken]);

  const goBack = useCallback(() => {
    navigate('/games');
  }, [navigate]);

  const gameId = state.status === 'ready' ? state.gameId : null;

  /**
   * Report the run. A failed POST returns `null`, which the player treats as "the
   * server's answer simply never arrived" — it keeps the child's results screen on
   * the simulator's own provisional numbers instead of destroying it. Never punish
   * the kid for our outage.
   */
  const persistRun = useCallback(
    async (run: GameRunSubmission): Promise<ServerGameResult | null> => {
      if (gameId === null) return null;
      const token = await getToken();
      const { data, error } = await submitGameRun(gameId, token, {
        run_id: runId,
        seed: run.seed,
        input_log: run.input_log,
        duration_seconds: run.duration_seconds,
        // The kid's LOCAL calendar day anchors the streak, not the server's UTC.
        local_date: localCalendarDate(),
      });
      return error ? null : toServerGameResult(data);
    },
    [gameId, getToken, runId],
  );

  const replay = useCallback(() => {
    setAttempt((previous) => previous + 1);
  }, []);

  if (state.status === 'loading') {
    return (
      <FullscreenShell>
        <div className="flex flex-1 items-center justify-center">
          <LoadingOverlay label={t('games.states.loading')} />
        </div>
      </FullscreenShell>
    );
  }

  if (state.status === 'unsupported') {
    return (
      <FullscreenShell>
        <UnsupportedGameCard onExit={goBack} />
      </FullscreenShell>
    );
  }

  if (state.status === 'error' || state.status === 'broken') {
    return (
      <FullscreenShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-5 text-center">
          <CharacterActor character="dina" emotion="neutral" action="idle" size="lg" />
          <div className="w-full max-w-md">
            {state.status === 'error' ? (
              <ErrorBanner code={state.code} />
            ) : (
              <p className="lf-body text-content-muted">{t('games.states.loadFailed')}</p>
            )}
          </div>
          <Button variant="secondary" onClick={goBack}>
            <Icon name="arrow_back" className="mr-1" />
            {t('games.states.unsupported.back')}
          </Button>
        </div>
      </FullscreenShell>
    );
  }

  return (
    <GamePlayer
      // A new run id remounts the player, so "play again" starts a genuinely fresh
      // session instead of resetting one in place.
      key={runId}
      document={state.document}
      slice={state.slice}
      seed={seed}
      runId={runId}
      onComplete={persistRun}
      onExit={goBack}
      onReplay={replay}
    />
  );
}

export default GameRoute;
