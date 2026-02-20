import { useReducer, useCallback, useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSound } from '@/contexts/SoundContext';
import { cn } from '@/lib/utils';

import { gameReducer, createInitialState } from '../gameReducer';
import { useGameEngine } from '../useGameEngine';
import { ITEMS, AUDIO, PICTURES, GAME_CONFIG } from '../constants';
import type { MonsterType } from '../types';

import { GameStartScreen } from './GameStartScreen';
import { TutorialOverlay } from './TutorialOverlay';
import { GameHUD } from './GameHUD';
import { Monster } from './Monster';
import { FallingItemComponent } from './FallingItem';
import { MentorPopup } from './MentorPopup';
import { PauseOverlay } from './PauseOverlay';
import { GameOverScreen } from './GameOverScreen';

export function NamVsYumGame() {
  const { t } = useTranslation('games');
  const navigate = useNavigate();
  const { playFile, playBGM, stopBGM } = useSound();

  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState);
  const gameAreaRef = useRef<HTMLDivElement>(null);

  // Ref that always holds the latest state (for callbacks that can't have state in deps)
  const stateRef = useRef(state);
  stateRef.current = state;

  // Track monster animation states
  const [eatingMonster, setEatingMonster] = useState<MonsterType | null>(null);
  const [rejectingMonster, setRejectingMonster] = useState<MonsterType | null>(null);
  const [highlightedMonster, setHighlightedMonster] = useState<MonsterType | null>(null);
  const [bgError, setBgError] = useState(false);

  // Track the last known drag position (local-coords) so dragEnd doesn't
  // depend on state — which may be stale due to RAF UPDATE_ITEMS dispatches.
  const lastDragPosRef = useRef<{ x: number; y: number } | null>(null);

  // Game engine — reads dimensions directly from the DOM ref each RAF frame
  const { handleDrop } = useGameEngine(state, dispatch, gameAreaRef);

  // ── BGM lifecycle ──
  useEffect(() => {
    if (state.phase === 'PLAYING') {
      playBGM(AUDIO.bgm, { volume: 0.15 });
    } else if (state.phase === 'GAME_OVER' || state.phase === 'START') {
      stopBGM({ fade: true, fadeDuration: 500 });
    }
  }, [state.phase, playBGM, stopBGM]);

  useEffect(() => {
    return () => { stopBGM({ fade: true, fadeDuration: 300 }); };
  }, [stopBGM]);

  // ── Sound effects ──
  useEffect(() => {
    if (!state.lastFeedback) return;
    playFile(state.lastFeedback === 'correct' ? AUDIO.correct : AUDIO.incorrect);
  }, [state.feedbackTimestamp, state.lastFeedback, playFile]);

  const prevLevelRef = useRef(state.level);
  useEffect(() => {
    if (state.level > prevLevelRef.current) playFile(AUDIO.levelUp);
    prevLevelRef.current = state.level;
  }, [state.level, playFile]);

  const prevComboMultRef = useRef(state.comboMultiplier);
  useEffect(() => {
    if (state.comboMultiplier > prevComboMultRef.current && state.comboMultiplier > 1) {
      playFile(AUDIO.combo);
    }
    prevComboMultRef.current = state.comboMultiplier;
  }, [state.comboMultiplier, playFile]);

  useEffect(() => {
    if (state.phase === 'GAME_OVER') {
      playFile(AUDIO.gameOver);
      if (state.score >= state.highScore && state.score > 0) {
        setTimeout(() => playFile(AUDIO.highScore), 500);
      }
    }
  }, [state.phase, state.score, state.highScore, playFile]);

  useEffect(() => {
    if (state.activeMentorTip) playFile(AUDIO.mentorPop);
  }, [state.activeMentorTip, playFile]);

  // ── Drag handling ──
  const handleItemDragStart = useCallback(
    (id: string, offsetX: number, offsetY: number) => {
      dispatch({ type: 'START_DRAG', id, offsetX, offsetY });
    },
    [],
  );

  const handleItemDragMove = useCallback(
    (id: string, clientX: number, clientY: number) => {
      const area = gameAreaRef.current;
      if (!area) return;
      const rect = area.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      // Store position in ref so dragEnd can use it immediately
      lastDragPosRef.current = { x, y };
      dispatch({ type: 'MOVE_DRAG', id, x, y });

      const monsterZoneTop = rect.height * (1 - GAME_CONFIG.monsterZoneHeightPercent / 100);
      if (y > monsterZoneTop) {
        setHighlightedMonster(x < rect.width / 2 ? 'vitalio' : 'capricho');
      } else {
        setHighlightedMonster(null);
      }
    },
    [],
  );

  const handleItemDragEnd = useCallback(
    (id: string) => {
      const area = gameAreaRef.current;
      const pos = lastDragPosRef.current;

      if (!area || !pos) {
        dispatch({ type: 'END_DRAG', id });
        setHighlightedMonster(null);
        lastDragPosRef.current = null;
        return;
      }

      const rect = area.getBoundingClientRect();
      const monsterZoneTop = rect.height * (1 - GAME_CONFIG.monsterZoneHeightPercent / 100);

      // Use the ref position (always fresh) instead of reading from state
      if (pos.y > monsterZoneTop) {
        const targetMonster: MonsterType = pos.x < rect.width / 2 ? 'vitalio' : 'capricho';
        const isCorrect = handleDrop(id, targetMonster);

        if (isCorrect) {
          setEatingMonster(targetMonster);
          playFile(AUDIO.chomp);
          setTimeout(() => setEatingMonster(null), 400);
        } else {
          setRejectingMonster(targetMonster);
          playFile(AUDIO.reject);
          setTimeout(() => setRejectingMonster(null), 600);
        }
      } else {
        dispatch({ type: 'END_DRAG', id });
      }
      setHighlightedMonster(null);
      lastDragPosRef.current = null;
    },
    [handleDrop, playFile],
  );

  // ── Phase handlers ──
  const handlePlay = useCallback(() => dispatch({ type: 'START_PLAYING' }), []);
  const handleTutorial = useCallback(() => dispatch({ type: 'SHOW_TUTORIAL' }), []);
  const handleTutorialComplete = useCallback(() => dispatch({ type: 'START_PLAYING' }), []);
  const handlePause = useCallback(() => dispatch({ type: 'PAUSE' }), []);
  const handleResume = useCallback(() => dispatch({ type: 'RESUME' }), []);

  const handleRestart = useCallback(() => {
    dispatch({ type: 'RESET' });
    setTimeout(() => dispatch({ type: 'START_PLAYING' }), 0);
  }, []);

  const handleExit = useCallback(() => {
    stopBGM({ fade: true, fadeDuration: 300 });
    navigate(-1);
  }, [navigate, stopBGM]);

  const handleRetry = useCallback(() => {
    dispatch({ type: 'RESET' });
    setTimeout(() => dispatch({ type: 'START_PLAYING' }), 0);
  }, []);

  const isPlaying = state.phase === 'PLAYING' || state.phase === 'PAUSED';

  // ── Render ──
  // The game area div is ALWAYS in the DOM so the ref is always attached
  // and the engine can read real dimensions. Overlays sit on top.
  return (
    <div className="w-full h-full relative">
      {/* Background — always visible */}
      <div className="absolute inset-0 game-bg-sky">
        {!bgError && (
          <img
            src={PICTURES.background}
            alt=""
            className="absolute inset-0 w-full h-full object-cover pixel-art opacity-40"
            onError={() => setBgError(true)}
            draggable={false}
          />
        )}
      </div>

      {/* CRT effects — above game content (z-40) but below phase overlays (z-70) */}
      <div className="crt-vignette" />
      <div className="crt-scanlines" />

      {/* Game area — ALWAYS rendered, ref always attached */}
      <div
        ref={gameAreaRef}
        className="relative w-full h-full overflow-hidden"
        style={{ touchAction: 'none' }}
      >
        {isPlaying && (
          <>
            <GameHUD
              score={state.score}
              lives={state.lives}
              maxLives={state.maxLives}
              combo={state.combo}
              comboMultiplier={state.comboMultiplier}
              level={state.level}
              onPause={handlePause}
            />

            {state.fallingItems.map((item) => {
              const def = ITEMS.find((d) => d.key === item.definitionKey);
              if (!def) return null;
              return (
                <FallingItemComponent
                  key={item.id}
                  item={item}
                  definition={def}
                  onDragStart={handleItemDragStart}
                  onDragMove={handleItemDragMove}
                  onDragEnd={handleItemDragEnd}
                />
              );
            })}

            {state.lastFeedback && (
              <div className="absolute top-1/3 left-1/2 -translate-x-1/2 pointer-events-none" style={{ zIndex: 60 }}>
                <span className={cn(
                  'pixel-font text-sm sm:text-base feedback-text',
                  state.lastFeedback === 'correct' ? 'text-green-400' : 'text-red-400',
                )}>
                  {state.lastFeedback === 'correct'
                    ? t('namVsYum.feedback.correct')
                    : t('namVsYum.feedback.incorrect')}
                </span>
              </div>
            )}

            {state.combo > 0 && state.combo % 5 === 0 && state.lastFeedback === 'correct' && (
              <div className="absolute top-[40%] left-1/2 -translate-x-1/2 pointer-events-none" style={{ zIndex: 60 }}>
                <span className="pixel-font text-xs text-orange-400 combo-pop retro-glow">
                  {t('namVsYum.feedback.comboStart', { count: state.comboMultiplier })}
                </span>
              </div>
            )}

            {/* Monster zone */}
            <div
              className="absolute bottom-0 left-0 right-0 flex items-end justify-around px-4 pb-3 sm:pb-4"
              style={{ height: `${GAME_CONFIG.monsterZoneHeightPercent}%` }}
            >
              <Monster
                type="vitalio"
                isEating={eatingMonster === 'vitalio'}
                isRejecting={rejectingMonster === 'vitalio'}
                isHighlighted={highlightedMonster === 'vitalio'}
              />
              <Monster
                type="capricho"
                isEating={eatingMonster === 'capricho'}
                isRejecting={rejectingMonster === 'capricho'}
                isHighlighted={highlightedMonster === 'capricho'}
              />
            </div>

            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px opacity-20 bg-white"
              style={{ height: `${GAME_CONFIG.monsterZoneHeightPercent}%` }}
            />

            {state.activeMentorTip && (
              <MentorPopup
                tip={state.activeMentorTip}
                onDismiss={() => dispatch({ type: 'DISMISS_MENTOR_TIP' })}
              />
            )}

            {state.phase === 'PAUSED' && (
              <PauseOverlay
                onResume={handleResume}
                onRestart={handleRestart}
                onQuit={handleExit}
              />
            )}
          </>
        )}
      </div>

      {/* Phase overlays — sit on top of everything including CRT scanlines (z-60) */}
      {state.phase === 'START' && (
        <div className="absolute inset-0" style={{ zIndex: 70 }}>
          <GameStartScreen
            highScore={state.highScore}
            onPlay={handlePlay}
            onTutorial={handleTutorial}
          />
        </div>
      )}

      {state.phase === 'TUTORIAL' && (
        <div className="absolute inset-0" style={{ zIndex: 70 }}>
          <TutorialOverlay
            onComplete={handleTutorialComplete}
            onSkip={handlePlay}
          />
        </div>
      )}

      {state.phase === 'GAME_OVER' && (
        <div className="absolute inset-0" style={{ zIndex: 70 }}>
          <GameOverScreen
            state={state}
            onRetry={handleRetry}
            onExit={handleExit}
          />
        </div>
      )}
    </div>
  );
}
