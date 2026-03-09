/* ──────────────────────────────────────────────────────────────
   Néctar de las Sombras – Main Game Component
   ────────────────────────────────────────────────────────────── */

import { useReducer, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSound } from '@/contexts/SoundContext';
import { AUDIO } from '../constants';
import { gameReducer, createInitialState } from '../gameReducer';
import type { Recipe, DayResult, UpgradeKey, MentorTip } from '../types';

import { GameStartScreen } from './GameStartScreen';
import { TutorialOverlay } from './TutorialOverlay';
import { RunnerPhase } from './RunnerPhase';
import { StandPhase } from './StandPhase';
import { MarketPhase } from './MarketPhase';
import { DaySummary } from './DaySummary';
import { UpgradeShop } from './UpgradeShop';
import { GameOverScreen } from './GameOverScreen';
import { PauseOverlay } from './PauseOverlay';
import { MentorPopup } from './MentorPopup';

export function NectarGame() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState);
  const navigate = useNavigate();
  const { t } = useTranslation('games');
  const { playFile, playBGM, stopBGM, mute, toggleMute } = useSound();

  /* ── Sound helpers ──────────────────────────────────────── */
  const playSfx = useCallback(
    (key: keyof typeof AUDIO) => {
      playFile(AUDIO[key]);
    },
    [playFile]
  );

  const playSfxByName = useCallback(
    (name: string) => {
      const audioKey = name as keyof typeof AUDIO;
      if (AUDIO[audioKey]) {
        playFile(AUDIO[audioKey]);
      }
    },
    [playFile]
  );

  /* ── Phase handlers ─────────────────────────────────────── */
  const handlePlay = useCallback(() => {
    playBGM(AUDIO.bgm, { volume: 0.4 });
    dispatch({ type: 'START_DAY' });
  }, [playBGM]);

  const handleTutorial = useCallback(() => {
    dispatch({ type: 'SHOW_TUTORIAL' });
  }, []);

  const handleTutorialComplete = useCallback(() => {
    playBGM(AUDIO.bgm, { volume: 0.4 });
    dispatch({ type: 'START_DAY' });
  }, [playBGM]);

  /* ── BGM Lifecycle ─────────────────────────────────────── */
  useEffect(() => {
    if (state.phase === 'GAME_OVER' || state.phase === 'START') {
      stopBGM({ fade: true, fadeDuration: 500 });
    }
  }, [state.phase, stopBGM]);

  useEffect(() => {
    return () => {
      stopBGM({ fade: true, fadeDuration: 300 });
    };
  }, [stopBGM]);

  const handleRunnerFinish = useCallback(
    (lemons: number, sugar: number) => {
      playSfx('dayEnd');
      dispatch({ type: 'FINISH_RUNNER', lemons, sugar });
    },
    [playSfx]
  );

  const handleSell = useCallback(
    (recipe: Recipe) => {
      playSfx('sell');
      dispatch({ type: 'SET_RECIPE', recipe });
      dispatch({ type: 'START_MARKET' });
    },
    [playSfx]
  );

  const handleMarketFinish = useCallback(
    (result: DayResult) => {
      playSfx('dayEnd');
      dispatch({ type: 'FINISH_MARKET', result });
    },
    [playSfx]
  );

  const handleDaySummaryContinue = useCallback(() => {
    dispatch({ type: 'GO_TO_SHOP' });
  }, []);

  const handlePurchase = useCallback(
    (key: UpgradeKey) => {
      playSfx('upgrade');
      dispatch({ type: 'PURCHASE_UPGRADE', key });
    },
    [playSfx]
  );

  const handleSaveToVault = useCallback(
    (amount: number) => {
      playSfx('coinCollect');
      dispatch({ type: 'SAVE_TO_VAULT', amount });
    },
    [playSfx]
  );

  const handleNextDay = useCallback(() => {
    dispatch({ type: 'NEXT_DAY' });
  }, []);

  const handleShowMentor = useCallback(
    (tip: MentorTip) => {
      playSfx('mentorPop');
      dispatch({ type: 'SHOW_MENTOR_TIP', tip });
    },
    [playSfx]
  );

  const handleDismissMentor = useCallback(() => {
    dispatch({ type: 'DISMISS_MENTOR_TIP' });
  }, []);

  const handlePause = useCallback(() => {
    dispatch({ type: 'PAUSE' });
  }, []);

  const handleResume = useCallback(() => {
    dispatch({ type: 'RESUME' });
  }, []);

  const handleRestart = useCallback(() => {
    stopBGM();
    dispatch({ type: 'RESET' });
  }, [stopBGM]);

  const handleRetry = useCallback(() => {
    dispatch({ type: 'RESET' });
    playBGM(AUDIO.bgm, { volume: 0.4 });
    dispatch({ type: 'START_DAY' });
  }, [playBGM]);

  const handleExit = useCallback(() => {
    stopBGM({ fade: true });
    navigate('/investment-games');
  }, [stopBGM, navigate]);

  /* ── Derived state ──────────────────────────────────────── */
  const hasSqueezer = state.upgrades.find((u) => u.key === 'squeezer')?.purchased ?? false;
  const hasAwning = state.upgrades.find((u) => u.key === 'awning')?.purchased ?? false;
  const hasSign = state.upgrades.find((u) => u.key === 'sign')?.purchased ?? false;
  const hasVault = state.upgrades.find((u) => u.key === 'vault')?.purchased ?? false;

  /*
   * Pause strategy: When paused, we keep the underlying gameplay phase
   * mounted (so its state/refs are preserved) but hidden with CSS.
   * The actual "active" phase is stored in previousPhase while paused.
   */
  const isPaused = state.phase === 'PAUSED';
  const activePhase = isPaused ? state.previousPhase : state.phase;

  /* ── Pause button (shown during gameplay phases) ────────── */
  const showPauseBtn = ['RUNNER', 'STAND_PREP', 'MARKET'].includes(activePhase || '');

  // CSS to hide the underlying phase while paused (keep it mounted!)
  const pauseHideStyle: React.CSSProperties = isPaused
    ? { visibility: 'hidden' as const, pointerEvents: 'none' as const }
    : {};

  return (
    <div className="nectar-game-container">
      {/* Pause button */}
      {showPauseBtn && !isPaused && (
        <button className="nectar-pause-btn" onClick={handlePause} aria-label={t('nectar.pause.title')}>
          ⏸
        </button>
      )}

      {/* Coins display (persistent during gameplay) */}
      {activePhase !== 'START' && activePhase !== 'TUTORIAL' && activePhase !== 'GAME_OVER' && (
        <div className="nectar-persistent-coins" style={pauseHideStyle}>
          <span className="nectar-persistent-coin-icon">🪙</span>
          <span>{state.coins}</span>
        </div>
      )}

      {/* ── Phase rendering ─────────────────────────────────── */}

      {activePhase === 'START' && (
        <GameStartScreen
          highScore={state.highScore}
          bestDay={state.bestDay}
          onPlay={handlePlay}
          onTutorial={handleTutorial}
        />
      )}

      {activePhase === 'TUTORIAL' && (
        <TutorialOverlay onComplete={handleTutorialComplete} />
      )}

      {(activePhase === 'RUNNER') && (
        <div style={pauseHideStyle} className="nectar-phase-wrap">
          <RunnerPhase
            day={state.day}
            onFinish={handleRunnerFinish}
            hasSqueezer={hasSqueezer}
            playSound={playSfxByName}
            paused={isPaused}
          />
        </div>
      )}

      {(activePhase === 'STAND_PREP') && (
        <div style={pauseHideStyle} className="nectar-phase-wrap">
          <StandPhase
            weather={state.weather}
            lemonsAvailable={state.lemonsCollected}
            sugarAvailable={state.sugarCollected}
            day={state.day}
            onSell={handleSell}
            onShowMentor={handleShowMentor}
          />
        </div>
      )}

      {(activePhase === 'MARKET') && (
        <div style={pauseHideStyle} className="nectar-phase-wrap">
          <MarketPhase
            recipe={state.recipe}
            weather={state.weather}
            day={state.day}
            coins={state.coins}
            hasAwning={hasAwning}
            hasSign={hasSign}
            onFinish={handleMarketFinish}
            playSound={playSfxByName}
            paused={isPaused}
          />
        </div>
      )}

      {activePhase === 'DAY_SUMMARY' && state.dayResult && (
        <DaySummary
          day={state.day}
          result={state.dayResult}
          totalCoins={state.coins}
          onContinue={handleDaySummaryContinue}
          onShowMentor={handleShowMentor}
        />
      )}

      {activePhase === 'UPGRADE_SHOP' && (
        <UpgradeShop
          coins={state.coins}
          vaultSavings={state.vaultSavings}
          upgrades={state.upgrades}
          hasVault={hasVault}
          onPurchase={handlePurchase}
          onSaveToVault={handleSaveToVault}
          onContinue={handleNextDay}
        />
      )}

      {activePhase === 'GAME_OVER' && (
        <GameOverScreen
          day={state.day}
          totalCoinsEarned={state.totalCoinsEarned}
          highScore={state.highScore}
          bestDay={state.bestDay}
          isNewHighScore={state.totalCoinsEarned > 0 && state.totalCoinsEarned >= state.highScore}
          onRetry={handleRetry}
          onExit={handleExit}
        />
      )}

      {isPaused && (
        <PauseOverlay
          soundOn={!mute}
          onResume={handleResume}
          onRestart={handleRestart}
          onQuit={handleExit}
          onToggleSound={toggleMute}
        />
      )}

      {/* Mentor popup (overlays any phase) */}
      {state.activeMentorTip && (
        <MentorPopup
          tip={state.activeMentorTip}
          onDismiss={handleDismissMentor}
        />
      )}
    </div>
  );
}
