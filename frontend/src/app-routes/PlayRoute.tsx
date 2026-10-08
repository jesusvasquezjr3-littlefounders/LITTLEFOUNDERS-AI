import { useCallback, useEffect, useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useMentorCharacter } from '@/app-shell/useMentorCharacter';
import { createGamesClient, GAME_ID } from '@/games/kartrush/api';
import { enterImmersive, leaveImmersive, useRotatePrompt } from '@/games/kartrush/immersive';
import { useKartRush } from '@/games/kartrush/useKartRush';
import type { Mentor } from '@/games/kartrush/protocol';
import { gamesCopy } from '@/rebuild/games/gamesCopy';
import { PlayScreen } from '@/rebuild/games/PlayScreen';
import type { GarageSelection, PitOutcome } from '@/rebuild/games/vocabulary';
import { LEARN_LINKS, bandOf, useLearnerRegister, useLearnHost } from '@/routes/app/learn/learnHost';

/*
 * /learn/play/:gameId — the host of a game inside /learn (KRV1-CONTRACT §6), a
 * full-screen layer of its own like the lesson player. This file is the glue:
 * it builds Core's client from the learner's session, runs the visit
 * (games/kartrush/useKartRush) and draws it with the rebuilt screen
 * (rebuild/games/PlayScreen). It decides nothing about time, limits or runs:
 * Core does, and the controller relays.
 *
 * THE KEYS. The game's iframe takes the keyboard while the learner plays, and
 * the game handles Escape as its own pause (the host hears `kr.pauseRequested`).
 * When the keys are NOT in the frame, Escape is the host's: it pauses a race,
 * and leaves from the Garage and the closed and error cards. A card with its
 * own Escape (the pause menu resumes) handles the key first, so this listener
 * never sees it. The frame gets the keyboard back after Go and every time an
 * overlay closes.
 *
 * KartRush is the only game in v1: an unknown game id goes back to /learn.
 */

export function PlayRoute() {
  const { gameId } = useParams();
  if (gameId !== GAME_ID) return <Navigate to={LEARN_LINKS.home} replace />;
  return <KartRushVisit />;
}

function KartRushVisit() {
  const navigate = useNavigate();
  const { locale, dark, transport } = useLearnHost();
  const [register] = useLearnerRegister(transport);
  const chosen = useMentorCharacter(true);
  const client = useMemo(() => createGamesClient(transport), [transport]);
  const t = gamesCopy[locale];
  const onExit = useCallback((destination: 'learn' | 'mentor') => {
    leaveImmersive();
    navigate(destination === 'mentor' ? LEARN_LINKS.mentor ?? LEARN_LINKS.home : LEARN_LINKS.home);
  }, [navigate]);
  const { snapshot, controller, frameRef, focusFrame } = useKartRush({ client, locale, startLabel: t.gamePlay.startLabel, chosenMentor: chosen, onExit });
  const { state } = snapshot;
  const { phase } = state;

  // The keyboard goes back to the game when it can use it, after Go and whenever an overlay closes.
  useEffect(() => {
    if (phase !== 'gate' && phase !== 'racing') return undefined;
    const id = window.setTimeout(focusFrame, 0);
    return () => window.clearTimeout(id);
  }, [phase, focusFrame]);

  // The learner's way out, when the keys are the host's (a focused frame keeps its own Escape as pause).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (phase === 'racing') controller.pause();
      else if (phase === 'garage' || phase === 'closed' || phase === 'error' || phase === 'loading') controller.leave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, controller]);

  // Fullscreen is the host's to give back whichever way the learner leaves (a link, the browser's back button).
  useEffect(() => leaveImmersive, []);

  const rotate = useRotatePrompt(phase === 'loading' || phase === 'gate' || phase === 'racing' || phase === 'paused');
  const run = state.run;
  const outcome: PitOutcome = !run || run.outcome.status === 'none' ? { status: 'none' }
    : run.outcome.status === 'ready' ? { status: 'ready', lens: run.outcome.result.lens }
      : { status: run.outcome.status };
  const mentor: Mentor = state.mentor;
  const showFrame = snapshot.game !== null && state.hasSession && phase !== 'closed' && phase !== 'error';
  const selection: GarageSelection = state.selection;

  return <PlayScreen
    locale={locale} dark={dark} ageBand={bandOf(register)} phase={phase} mentor={mentor} selection={selection} muted={state.muted}
    closed={state.closed} error={state.error} pit={{ outcome, reply: run?.reply ?? null, aiText: run?.aiText ?? null }}
    frame={showFrame && snapshot.game ? <iframe key={snapshot.generation} ref={frameRef} src={snapshot.game.href} title={t.gamePlay.frameTitle}
      allow="fullscreen; gamepad; autoplay" tabIndex={0} /> : null}
    frameHidden={phase === 'garage'} rotate={rotate}
    onSelect={(patch) => controller.select(patch)} onMuted={(muted) => controller.setMuted(muted)}
    onGo={() => { enterImmersive(); controller.go(); }}
    onExit={() => controller.leave()} onResume={() => controller.resume()} onRestart={() => controller.restart()}
    onRaceAgain={() => controller.raceAgain()} onChangeKart={() => controller.changeKart()} onAskMentor={() => controller.askMentor()}
    onReply={(reply) => controller.reflect(reply)} onSoftStop={() => controller.softStop()} onSoftKeep={() => controller.softContinue()}
    onRetry={() => controller.retry()} />;
}

export default PlayRoute;
