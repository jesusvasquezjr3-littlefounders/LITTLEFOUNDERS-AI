import { useReducer, useEffect, useCallback, useRef } from 'react';
import { useSound } from '@/contexts/SoundContext';

import { gameReducer, createInitialState } from '../gameReducer';
import { AUDIO, THEME_CONFIG } from '../constants';
import { GamePhase } from '../types';

import { GameStartScreen } from './GameStartScreen';
import { TutorialOverlay } from './TutorialOverlay';
import { GameHUD } from './GameHUD';
import { CustomerScene } from './CustomerScene';
import { TimerFuse } from './TimerFuse';
import { NumericKeypad } from './NumericKeypad';
import { FeedbackOverlay } from './FeedbackOverlay';
import { ShopScreen } from './ShopScreen';
import { PauseOverlay } from './PauseOverlay';
import { GameOverScreen } from './GameOverScreen';

import '../paper-coin.css';

const PHASE_DURATIONS: Partial<Record<GamePhase, number>> = {
  CUSTOMER_ARRIVING: 1000,
  PRESENTING: 700,
  FEEDBACK_CORRECT: 1600,
  FEEDBACK_WRONG: 1600,
  FEEDBACK_TIMEOUT: 1600,
  CUSTOMER_LEAVING: 650,
};

export function PaperCoinGame() {
  const { playFile, playBGM, stopBGM, pauseBGM, resumeBGM } = useSound();

  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState);

  // ── Phase auto-advance (timed transitions) ────────────────────────────────
  useEffect(() => {
    const duration = PHASE_DURATIONS[state.phase];
    if (duration === undefined) return;

    const timer = setTimeout(() => {
      if (state.phase === 'CUSTOMER_ARRIVING') {
        dispatch({ type: 'BEGIN_PRESENTING' });
      } else if (state.phase === 'PRESENTING') {
        dispatch({ type: 'BEGIN_WAITING' });
      } else {
        dispatch({ type: 'ADVANCE_PHASE' });
      }
    }, duration);

    return () => clearTimeout(timer);
  }, [state.phase]);

  // ── Timer tick (100ms interval while WAITING_INPUT) ───────────────────────
  useEffect(() => {
    if (state.phase !== 'WAITING_INPUT') return;
    const interval = setInterval(() => {
      dispatch({ type: 'TIMER_TICK' });
    }, 100);
    return () => clearInterval(interval);
  }, [state.phase]);

  // ── BGM control ───────────────────────────────────────────────────────────
  const bgmStartedRef = useRef(false);
  useEffect(() => {
    const playingPhases: GamePhase[] = [
      'CUSTOMER_ARRIVING',
      'PRESENTING',
      'WAITING_INPUT',
      'FEEDBACK_CORRECT',
      'FEEDBACK_WRONG',
      'FEEDBACK_TIMEOUT',
      'CUSTOMER_LEAVING',
      'SHOP',
    ];

    if (playingPhases.includes(state.phase) && !bgmStartedRef.current) {
      bgmStartedRef.current = true;
      playBGM(AUDIO.bgm, { volume: 0.18 });
    }

    if (state.phase === 'PAUSED') {
      pauseBGM();
    } else if (bgmStartedRef.current) {
      resumeBGM();
    }

    if (state.phase === 'GAME_OVER' || state.phase === 'START') {
      bgmStartedRef.current = false;
      stopBGM({ fade: true, fadeDuration: 800 });
    }
  }, [state.phase, playBGM, stopBGM, pauseBGM, resumeBGM]);

  // ── Sound FX on phase change ──────────────────────────────────────────────
  useEffect(() => {
    switch (state.phase) {
      case 'CUSTOMER_ARRIVING':
        playFile(AUDIO.paperCrumple);
        break;
      case 'FEEDBACK_CORRECT':
        playFile(state.lastWasBonus ? AUDIO.speedBonus : AUDIO.caching);
        break;
      case 'FEEDBACK_WRONG':
      case 'FEEDBACK_TIMEOUT':
        playFile(AUDIO.error);
        break;
      case 'SHOP':
        playFile(AUDIO.levelUp);
        break;
      case 'GAME_OVER':
        playFile(AUDIO.gameOver);
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  // ── Keyboard support ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (state.phase !== 'WAITING_INPUT') return;
      if (e.key >= '0' && e.key <= '9') {
        dispatch({ type: 'KEY_PRESS', key: e.key });
      } else if (e.key === 'Backspace') {
        dispatch({ type: 'KEY_BACKSPACE' });
      } else if (e.key === 'Enter') {
        dispatch({ type: 'SUBMIT_ANSWER' });
      } else if (e.key === 'Escape') {
        dispatch({ type: 'PAUSE' });
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [state.phase]);

  // ── Sound on key press ────────────────────────────────────────────────────
  const handleKeyPress = useCallback(() => {
    playFile(AUDIO.buttonPress);
  }, [playFile]);

  // ── Theme ─────────────────────────────────────────────────────────────────
  const theme = THEME_CONFIG[state.upgrades.theme];

  // ── Render logic ──────────────────────────────────────────────────────────
  if (state.phase === 'START') {
    return <GameStartScreen state={state} dispatch={dispatch} />;
  }

  if (state.phase === 'GAME_OVER') {
    return <GameOverScreen state={state} dispatch={dispatch} />;
  }

  if (state.phase === 'SHOP') {
    return (
      <>
        <ShopScreen state={state} dispatch={dispatch} />
        {/* Tutorial can't appear here */}
      </>
    );
  }

  // ── Main game UI ──────────────────────────────────────────────────────────
  const isFeedback =
    state.phase === 'FEEDBACK_CORRECT' ||
    state.phase === 'FEEDBACK_WRONG' ||
    state.phase === 'FEEDBACK_TIMEOUT';

  const showTimer = state.phase === 'WAITING_INPUT';
  const isTimerWarning = showTimer && state.timeLeft / state.maxTime <= 0.3;

  return (
    <div
      className="pc-root flex flex-col w-full h-full overflow-hidden select-none"
      style={{ background: `linear-gradient(180deg, ${theme.wallTop}, ${theme.wallBottom})` }}
    >
      {/* HUD */}
      <GameHUD state={state} dispatch={dispatch} />

      {/* Scene area */}
      <div className="relative flex-1 flex flex-col overflow-hidden">
        <CustomerScene state={state} />

        {/* Feedback overlay */}
        {isFeedback && <FeedbackOverlay state={state} />}

        {/* Counter surface */}
        <div
          className="pc-counter w-full px-4 py-3 flex flex-col gap-2"
          style={{
            background: `linear-gradient(180deg, ${theme.counter} 0%, #3a1a0a 100%)`,
          }}
        >
          {/* Timer fuse */}
          {(showTimer || state.phase === 'PRESENTING') && (
            <div className={`transition-opacity duration-300 ${state.phase === 'PRESENTING' ? 'opacity-40' : 'opacity-100'}`}>
              <TimerFuse
                timeLeft={state.phase === 'PRESENTING' ? state.maxTime : state.timeLeft}
                maxTime={state.maxTime}
              />
            </div>
          )}

          {/* Timer warn glow */}
          {isTimerWarning && (
            <div
              className="absolute inset-x-0 bottom-0 h-1 opacity-70"
              style={{
                background: `linear-gradient(90deg, transparent, #ef4444, transparent)`,
                animation: 'pcFuseGlow 0.3s ease-in-out infinite',
              }}
            />
          )}
        </div>
      </div>

      {/* Keypad section */}
      <div
        className="shrink-0 pb-safe"
        style={{
          background: `linear-gradient(180deg, #1a0a00 0%, #0a0500 100%)`,
          paddingBottom: 'max(env(safe-area-inset-bottom), 12px)',
          paddingTop: 8,
        }}
      >
        <NumericKeypad
          state={state}
          dispatch={dispatch}
          onKeyPress={handleKeyPress}
        />
      </div>

      {/* Tutorial overlay (if needed) */}
      {state.phase === 'TUTORIAL' && (
        <TutorialOverlay state={state} dispatch={dispatch} />
      )}

      {/* Pause overlay */}
      <PauseOverlay state={state} dispatch={dispatch} />
    </div>
  );
}
