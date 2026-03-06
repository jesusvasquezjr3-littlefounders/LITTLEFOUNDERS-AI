import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSound } from '@/contexts/SoundContext';

import { gameReducer, createInitialState } from '../gameReducer';
import { AUDIO, PICTURES, GAME_CONFIG } from '../constants';

import { GameStartScreen } from './GameStartScreen';
import { TutorialOverlay } from './TutorialOverlay';
import { GameHUD } from './GameHUD';
import { Phase1Inspection } from './Phase1Inspection';
import { Phase2Vault } from './Phase2Vault';
import { PauseOverlay } from './PauseOverlay';
import { GameOverScreen } from './GameOverScreen';
import { WardrobeScreen } from './WardrobeScreen';

// ── Confetti particles ──────────────────────────────
const CONFETTI_COLORS = ['#e74c3c', '#f39c12', '#2ecc71', '#3498db', '#9b59b6', '#e67e22'];

function generateConfetti() {
  return Array.from({ length: 18 }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: `${5 + Math.random() * 90}%`,
    size: 6 + Math.random() * 8,
    duration: 0.8 + Math.random() * 0.6,
    delay: Math.random() * 0.3,
  }));
}

// ── Day transition banner ───────────────────────────
function DayBanner({ day }: { day: number }) {
  const { t } = useTranslation('games');
  return (
    <div className="absolute inset-x-0 top-16 z-50 flex items-center justify-center pointer-events-none">
      <div className="pd-day-banner pd-card px-8 py-4 text-center"
        style={{ background: '#f39c12', borderColor: '#d68910', boxShadow: '4px 4px 0 #7d6608' }}>
        <p className="text-xl font-black text-white">
          🌅 {t('paperDetective.feedback.newDay', { day })}
        </p>
      </div>
    </div>
  );
}

// ── Main game component ─────────────────────────────
export function PaperDetectiveGame() {
  const { t } = useTranslation('games');
  const navigate = useNavigate();
  const { playFile, playBGM, stopBGM } = useSound();

  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState);

  // RAF timer
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Track previous day/combo for SFX
  const prevDayRef = useRef(state.dayNumber);
  const prevMultiplierRef = useRef(state.comboMultiplier);
  const prevFeedbackTimestamp = useRef(state.feedbackTimestamp);

  // UI state for confetti + day banner
  const [confetti, setConfetti] = useState<ReturnType<typeof generateConfetti>>([]);
  const [showDayBanner, setShowDayBanner] = useState(false);
  const [bgError, setBgError] = useState(false);

  // ── Game loop ──────────────────────────────────────
  useEffect(() => {
    if (state.phase !== 'PLAYING') {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        lastTimeRef.current = null;
      }
      return;
    }

    const tick = (timestamp: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
      }
      const delta = Math.min(timestamp - lastTimeRef.current, 100); // cap at 100ms
      lastTimeRef.current = timestamp;
      dispatch({ type: 'TICK', deltaMs: delta });
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        lastTimeRef.current = null;
      }
    };
  }, [state.phase]);

  // ── BGM ──────────────────────────────────────────
  useEffect(() => {
    if (state.phase === 'PLAYING') {
      playBGM(AUDIO.bgm, { volume: 0.12 });
    } else if (state.phase === 'GAME_OVER' || state.phase === 'START') {
      stopBGM({ fade: true, fadeDuration: 500 });
    } else if (state.phase === 'PAUSED') {
      // BGM handled by Howler mute
    }
  }, [state.phase, playBGM, stopBGM]);

  useEffect(() => {
    return () => { stopBGM({ fade: true, fadeDuration: 300 }); };
  }, [stopBGM]);

  // ── SFX: feedback ────────────────────────────────
  useEffect(() => {
    if (!state.lastFeedback || state.feedbackTimestamp === prevFeedbackTimestamp.current) return;
    prevFeedbackTimestamp.current = state.feedbackTimestamp;

    if (state.lastFeedback === 'correct') {
      playFile(
        state.miniGameType === 'VAULT' ? AUDIO.coinIn : AUDIO.correct
      );
      // Show confetti
      setConfetti(generateConfetti());
      setTimeout(() => setConfetti([]), 1500);
    } else {
      playFile(AUDIO.incorrect);
    }
  }, [state.lastFeedback, state.feedbackTimestamp, state.miniGameType, playFile]);

  // ── SFX: combo multiplier ────────────────────────
  useEffect(() => {
    if (state.comboMultiplier > prevMultiplierRef.current && state.comboMultiplier > 1) {
      playFile(AUDIO.combo);
    }
    prevMultiplierRef.current = state.comboMultiplier;
  }, [state.comboMultiplier, playFile]);

  // ── SFX + Banner: day change ─────────────────────
  useEffect(() => {
    if (state.dayNumber > prevDayRef.current) {
      playFile(AUDIO.levelUp);
      setShowDayBanner(true);
      setTimeout(() => setShowDayBanner(false), GAME_CONFIG.dayTransitionMs);
    }
    prevDayRef.current = state.dayNumber;
  }, [state.dayNumber, playFile]);

  // ── SFX: game over ───────────────────────────────
  useEffect(() => {
    if (state.phase === 'GAME_OVER') {
      playFile(AUDIO.gameOver);
      if (state.score > 0 && state.score >= state.highScore) {
        setTimeout(() => playFile(AUDIO.highScore), 600);
      }
    }
  }, [state.phase, state.score, state.highScore, playFile]);

  // ── SFX: eject ───────────────────────────────────
  const prevEjectedRef = useRef<string | null>(null);
  useEffect(() => {
    if (state.p2EjectedId && state.p2EjectedId !== prevEjectedRef.current) {
      playFile(AUDIO.eject);
    }
    prevEjectedRef.current = state.p2EjectedId;
  }, [state.p2EjectedId, playFile]);

  // ── Handlers ─────────────────────────────────────
  const handlePlay = useCallback(() => dispatch({ type: 'START_GAME' }), []);
  const handleTutorial = useCallback(() => dispatch({ type: 'SHOW_TUTORIAL' }), []);
  const handleTutorialComplete = useCallback(() => dispatch({ type: 'START_GAME' }), []);
  const handleSkipTutorial = useCallback(() => dispatch({ type: 'START_GAME' }), []);
  const handlePause = useCallback(() => dispatch({ type: 'PAUSE' }), []);
  const handleResume = useCallback(() => dispatch({ type: 'RESUME' }), []);
  const handleRestart = useCallback(() => {
    lastTimeRef.current = null;
    dispatch({ type: 'RESTART' });
  }, []);
  const handleRetry = useCallback(() => {
    lastTimeRef.current = null;
    dispatch({ type: 'RESTART' });
    setTimeout(() => dispatch({ type: 'START_GAME' }), 0);
  }, []);
  const handleExit = useCallback(() => {
    stopBGM({ fade: true, fadeDuration: 300 });
    navigate(-1);
  }, [navigate, stopBGM]);
  const handleWardrobe = useCallback(() => dispatch({ type: 'OPEN_WARDROBE' }), []);
  const handleCloseWardrobe = useCallback(() => dispatch({ type: 'CLOSE_WARDROBE' }), []);
  const handleWardrobePlayAgain = useCallback(() => {
    lastTimeRef.current = null;
    dispatch({ type: 'CLOSE_WARDROBE' });
    setTimeout(() => {
      dispatch({ type: 'RESTART' });
      setTimeout(() => dispatch({ type: 'START_GAME' }), 0);
    }, 0);
  }, []);

  // Phase handlers
  const handleP1Select = useCallback((coinId: string) => {
    dispatch({ type: 'P1_SELECT', coinId });
  }, []);
  const handleP2AddCoin = useCallback((instanceId: string) => {
    dispatch({ type: 'P2_ADD_COIN', instanceId });
  }, []);
  const handleP2RemoveCoin = useCallback((instanceId: string) => {
    dispatch({ type: 'P2_REMOVE_COIN', instanceId });
  }, []);
  const handleP2ClearVault = useCallback(() => {
    dispatch({ type: 'P2_CLEAR_VAULT' });
  }, []);

  const isPlaying = state.phase === 'PLAYING' || state.phase === 'PAUSED';

  // ── Render ────────────────────────────────────────
  return (
    <div className="w-full h-full relative pd-bg overflow-hidden" style={{ touchAction: 'none' }}>

      {/* Background image */}
      {!bgError && (
        <img
          src={PICTURES.background}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
          onError={() => setBgError(true)}
          draggable={false}
        />
      )}

      {/* ── Playing phase ── */}
      {isPlaying && (
        <>
          <GameHUD
            score={state.score}
            comboCount={state.comboCount}
            comboMultiplier={state.comboMultiplier}
            dayNumber={state.dayNumber}
            timeLeft={state.timeLeft}
            maxTime={state.maxTime}
            onPause={handlePause}
          />

          {/* Mini-game area */}
          <div className="absolute inset-0">
            {state.miniGameType === 'INSPECTION' && state.p1Item && (
              <Phase1Inspection
                item={state.p1Item}
                options={state.p1Options}
                selectedId={state.p1SelectedId}
                feedback={state.lastFeedback}
                onSelect={handleP1Select}
              />
            )}

            {state.miniGameType === 'VAULT' && (
              <Phase2Vault
                target={state.p2Target}
                drawerCoins={state.p2DrawerCoins}
                vaultCoins={state.p2VaultCoins}
                ejectedId={state.p2EjectedId}
                feedback={state.lastFeedback}
                onAddCoin={handleP2AddCoin}
                onRemoveCoin={handleP2RemoveCoin}
                onClearVault={handleP2ClearVault}
              />
            )}
          </div>

          {/* Confetti overlay */}
          {confetti.map(p => (
            <div
              key={p.id}
              className="pd-confetti-particle"
              style={{
                left: p.left,
                top: '30%',
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                animationDuration: `${p.duration}s`,
                animationDelay: `${p.delay}s`,
              }}
            />
          ))}

          {/* Day transition banner */}
          {showDayBanner && <DayBanner day={state.dayNumber} />}

          {/* Pause overlay */}
          {state.phase === 'PAUSED' && (
            <PauseOverlay
              onResume={handleResume}
              onRestart={handleRestart}
              onQuit={handleExit}
            />
          )}
        </>
      )}

      {/* ── Start screen ── */}
      {state.phase === 'START' && (
        <div className="absolute inset-0" style={{ zIndex: 70 }}>
          <GameStartScreen
            highScore={state.highScore}
            totalPoints={state.totalPoints}
            equippedCosmetic={state.equippedCosmetic}
            onPlay={handlePlay}
            onTutorial={handleTutorial}
          />
        </div>
      )}

      {/* ── Tutorial ── */}
      {state.phase === 'TUTORIAL' && (
        <div className="absolute inset-0" style={{ zIndex: 70 }}>
          <TutorialOverlay
            onComplete={handleTutorialComplete}
            onSkip={handleSkipTutorial}
          />
        </div>
      )}

      {/* ── Game over ── */}
      {state.phase === 'GAME_OVER' && (
        <div className="absolute inset-0" style={{ zIndex: 70 }}>
          <GameOverScreen
            state={state}
            onRetry={handleRetry}
            onExit={handleExit}
            onWardrobe={handleWardrobe}
          />
        </div>
      )}

      {/* ── Wardrobe ── */}
      {state.phase === 'WARDROBE' && (
        <div className="absolute inset-0" style={{ zIndex: 70 }}>
          <WardrobeScreen
            state={state}
            dispatch={dispatch}
            onBack={handleCloseWardrobe}
            onPlayAgain={handleWardrobePlayAgain}
          />
        </div>
      )}
    </div>
  );
}
