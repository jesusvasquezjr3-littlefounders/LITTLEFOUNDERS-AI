import { useReducer, useCallback, useRef, useEffect, useState } from 'react';
import { AssetImg } from '@/components/ui/AssetImg';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSound } from '@/contexts/SoundContext';
import { cn } from '@/lib/utils';

import { gameReducer, createInitialState } from '../gameReducer';
import { useGameEngine } from '../useGameEngine';
import { ITEMS, AUDIO, PICTURES, GAME_CONFIG, DIFFICULTY_LEVELS, THEME_GRADIENTS, SKIN_CONFIG } from '../constants';
import type { MonsterType } from '../types';
import { usePlayerProgress } from '../hooks/usePlayerProgress';
import { useAchievements } from '../hooks/useAchievements';
import { useKeyboardControls } from '../hooks/useKeyboardControls';

import { GameStartScreen } from './GameStartScreen';
import { TutorialOverlay } from './TutorialOverlay';
import { GameHUD } from './GameHUD';
import { Monster } from './Monster';
import { FallingItemComponent } from './FallingItem';
import { MentorPopup } from './MentorPopup';
import { PauseOverlay } from './PauseOverlay';
import { GameOverScreen } from './GameOverScreen';
import { ParticleSystem } from './ParticleSystem';
import { FloatingText } from './FloatingText';
import { WeatherOverlay } from './WeatherOverlay';
import { PowerUpIndicator } from './PowerUpIndicator';
import { FrenzyBar } from './FrenzyBar';
import { TrashZone } from './TrashZone';
import { LevelCompleteScreen } from './LevelCompleteScreen';
import { AchievementPopup } from './AchievementPopup';
import { AchievementGallery } from './AchievementGallery';
import { MonsterShop } from './MonsterShop';
import { StatsScreen } from './StatsScreen';
import { LeaderboardScreen, loadLeaderboard, saveLeaderboard } from './LeaderboardScreen';

export function NamVsYumGame({ onExit, embeddedMode = false }: { onExit?: () => void; embeddedMode?: boolean } = {}) {
  const { t } = useTranslation('games');
  const navigate = useNavigate();
  const { playFile, playBGM, stopBGM } = useSound();

  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState);
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const playerProgress = usePlayerProgress();
  const { checkAchievements, achievements: achievementDefs } = useAchievements();

  const [isExpanded, setIsExpanded] = useState(false);

  const [eatingMonster, setEatingMonster] = useState<MonsterType | null>(null);
  const [rejectingMonster, setRejectingMonster] = useState<MonsterType | null>(null);
  const [highlightedMonster, setHighlightedMonster] = useState<MonsterType | null>(null);
  const [highlightedTrash, setHighlightedTrash] = useState(false);

  const [showAchievements, setShowAchievements] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardEntries, setLeaderboardEntries] = useState(() => loadLeaderboard());

  const [konamiActive, setKonamiActive] = useState(false);

  const gameStartTimeRef = useRef<number>(0);
  const powerUpsUsedRef = useRef(0);
  const bombsDefusedRef = useRef(0);
  const goldenCollectedRef = useRef(0);
  const mentorTipsReceivedRef = useRef(0);
  const easterEggTriggeredRef = useRef(false);

  const [particles, setParticles] = useState<{ id: string; x: number; y: number; color: string; count: number }[]>([]);
  const [gameDimensions, setGameDimensions] = useState({ width: 0, height: 0 });

  const lastDragPosRef = useRef<{ x: number; y: number } | null>(null);

  const { handleDrop, handleTrashDrop } = useGameEngine(state, dispatch, gameAreaRef);

  useEffect(() => {
    const updateDims = () => {
      if (gameAreaRef.current) {
        setGameDimensions({
          width: gameAreaRef.current.clientWidth,
          height: gameAreaRef.current.clientHeight,
        });
      }
    };
    updateDims();
    window.addEventListener('resize', updateDims);
    return () => window.removeEventListener('resize', updateDims);
  }, []);

  useKeyboardControls({
    isPlaying: state.phase === 'PLAYING',
    onPause: () => dispatch({ type: 'PAUSE' }),
    onKonami: () => {
      setKonamiActive(true);
      easterEggTriggeredRef.current = true;
      playerProgress.unlockAchievement('konamiMaster');
      playerProgress.addCoins(100);
      setTimeout(() => setKonamiActive(false), 30000);
    },
  });

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
    if (state.level > prevLevelRef.current) {
      playFile(AUDIO.levelUp);
    }
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
    if (state.activeMentorTip) {
      playFile(AUDIO.mentorPop);
      mentorTipsReceivedRef.current++;
    }
  }, [state.activeMentorTip, playFile]);

  useEffect(() => {
    if (state.isFrenzyMode) {
      playFile(AUDIO.perfectStreak);
    }
  }, [state.isFrenzyMode, playFile]);

  useEffect(() => {
    if (state.activePowerUp) {
      playFile(AUDIO.powerUp);
      powerUpsUsedRef.current++;
    }
  }, [state.activePowerUp, playFile]);

  // ── Achievement checking ──
  useEffect(() => {
    if (state.phase !== 'PLAYING' && state.phase !== 'GAME_OVER') return;

    const result = checkAchievements(
      state,
      playerProgress.progress.totalItemsSorted + state.itemsSorted,
      Math.max(playerProgress.progress.maxComboEver, state.maxCombo),
      Math.max(playerProgress.progress.highestLevelReached, state.level),
      powerUpsUsedRef.current,
      bombsDefusedRef.current,
      goldenCollectedRef.current,
      mentorTipsReceivedRef.current,
      easterEggTriggeredRef.current,
      playerProgress.progress.achievements.konamiMaster?.unlocked || false,
    );

    result.newlyUnlocked.forEach((id) => {
      dispatch({ type: 'ADD_ACHIEVEMENT', id });
      playerProgress.unlockAchievement(id);
      const ach = achievementDefs.find((a) => a.id === id);
      if (ach) playerProgress.addCoins(ach.reward);
    });

    result.progressUpdates.forEach(({ id, progress }) => {
      playerProgress.updateAchievementProgress(id, progress);
    });
  }, [state.score, state.combo, state.level, state.itemsSorted, state.phase]);

  // ── Record game end stats ──
  useEffect(() => {
    if (state.phase === 'GAME_OVER' && gameStartTimeRef.current > 0) {
      const duration = Date.now() - gameStartTimeRef.current;
      const correct = state.itemsSorted - (GAME_CONFIG.maxLives - state.lives);
      playerProgress.recordGameEnd(state.score, state.itemsSorted, state.maxCombo, state.level, duration, correct, state.itemsSorted);
      gameStartTimeRef.current = 0;
    }
  }, [state.phase]);

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

      lastDragPosRef.current = { x, y };
      dispatch({ type: 'MOVE_DRAG', id, x, y });

      const monsterZoneTop = rect.height * (1 - GAME_CONFIG.monsterZoneHeightPercent / 100);
      const trashZoneWidth = rect.width * (GAME_CONFIG.trashZoneWidthPercent / 100);
      const centerLeft = rect.width / 2 - trashZoneWidth / 2;
      const centerRight = rect.width / 2 + trashZoneWidth / 2;

      if (y > monsterZoneTop) {
        if (x >= centerLeft && x <= centerRight) {
          setHighlightedTrash(true);
          setHighlightedMonster(null);
        } else {
          setHighlightedTrash(false);
          setHighlightedMonster(x < rect.width / 2 ? 'vitalio' : 'capricho');
        }
      } else {
        setHighlightedTrash(false);
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
        setHighlightedTrash(false);
        lastDragPosRef.current = null;
        return;
      }

      const rect = area.getBoundingClientRect();
      const monsterZoneTop = rect.height * (1 - GAME_CONFIG.monsterZoneHeightPercent / 100);
      const trashZoneWidth = rect.width * (GAME_CONFIG.trashZoneWidthPercent / 100);
      const centerLeft = rect.width / 2 - trashZoneWidth / 2;
      const centerRight = rect.width / 2 + trashZoneWidth / 2;

      if (pos.y > monsterZoneTop) {
        if (pos.x >= centerLeft && pos.x <= centerRight) {
          const defused = handleTrashDrop(id);
          if (defused) {
            setEatingMonster('vitalio');
            playFile(AUDIO.chomp);
            bombsDefusedRef.current++;
            addParticles(pos.x, pos.y, '#22c55e', 15);
            addFloatingText(pos.x, pos.y, t('namVsYum.feedback.bombDefused'), '#22c55e');
            setTimeout(() => setEatingMonster(null), 400);
          } else {
            setRejectingMonster('vitalio');
            playFile(AUDIO.reject);
            setTimeout(() => setRejectingMonster(null), 600);
          }
        } else {
          const targetMonster: MonsterType = pos.x < rect.width / 2 ? 'vitalio' : 'capricho';
          const result = handleDrop(id, targetMonster);

          if (result.correct) {
            setEatingMonster(targetMonster);
            playFile(AUDIO.chomp);

            if (result.wasSpecial) {
              if (result.wasBomb) {
                addParticles(pos.x, pos.y, '#ef4444', 30);
                addFloatingText(pos.x, pos.y, t('namVsYum.feedback.bombExploded'), '#ef4444');
              } else if (result.powerUp) {
                addParticles(pos.x, pos.y, '#3b82f6', 20);
              } else {
                addParticles(pos.x, pos.y, '#eab308', 25);
                addFloatingText(pos.x, pos.y, `+${result.points}`, '#eab308');
                if ((result as { wasGolden?: boolean }).wasGolden) {
                  goldenCollectedRef.current++;
                  addFloatingText(pos.x, pos.y - 20, t('namVsYum.feedback.goldenCollected'), '#eab308');
                }
              }
            } else {
              const isGolden = stateRef.current.fallingItems.find((i) => i.id === id)?.variant === 'golden';
              const color = isGolden ? '#eab308' : '#22c55e';
              addParticles(pos.x, pos.y, color, 12);
              addFloatingText(pos.x, pos.y, `+${result.points}`, color);
            }

            setTimeout(() => setEatingMonster(null), 400);
          } else {
            setRejectingMonster(targetMonster);
            playFile(AUDIO.reject);
            addParticles(pos.x, pos.y, '#ef4444', 15);
            addFloatingText(pos.x, pos.y, t('namVsYum.feedback.incorrect'), '#ef4444');
            setTimeout(() => setRejectingMonster(null), 600);
          }
        }
      } else {
        dispatch({ type: 'END_DRAG', id });
      }

      setHighlightedMonster(null);
      setHighlightedTrash(false);
      lastDragPosRef.current = null;
    },
    [handleDrop, handleTrashDrop, playFile, t],
  );

  const addParticles = useCallback((x: number, y: number, color: string, count: number) => {
    const id = `burst-${Date.now()}-${Math.random()}`;
    setParticles((prev) => [...prev, { id, x, y, color, count }]);
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== id));
    }, 1000);
  }, []);

  const addFloatingText = useCallback((x: number, y: number, text: string, color: string) => {
    const id = `ft-${Date.now()}-${Math.random()}`;
    dispatch({ type: 'ADD_FLOATING_TEXT', text: { id, x, y, text, color, createdAt: Date.now() } });
    setTimeout(() => {
      dispatch({ type: 'REMOVE_FLOATING_TEXT', id });
    }, 1200);
  }, [dispatch]);

  const handlePlay = useCallback(() => {
    dispatch({ type: 'START_PLAYING' });
    gameStartTimeRef.current = Date.now();
    powerUpsUsedRef.current = 0;
    bombsDefusedRef.current = 0;
    goldenCollectedRef.current = 0;
    mentorTipsReceivedRef.current = 0;
    easterEggTriggeredRef.current = false;
  }, []);

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
    if (onExit) onExit();
    else navigate(-1);
  }, [navigate, stopBGM, onExit]);

  const handleRetry = useCallback(() => {
    dispatch({ type: 'RESET' });
    setTimeout(() => dispatch({ type: 'START_PLAYING' }), 0);
  }, []);

  const handleContinueFromLevel = useCallback(() => {
    dispatch({ type: 'DISMISS_LEVEL_COMPLETE' });
  }, []);

  const handleDismissAchievement = useCallback((id: string) => {
    dispatch({ type: 'CLEAR_NEW_ACHIEVEMENTS' });
  }, []);

  const isPlaying = state.phase === 'PLAYING' || state.phase === 'PAUSED' || state.phase === 'LEVEL_COMPLETE';

  const theme = playerProgress.progress.equippedTheme;
  const bgGradient = konamiActive
    ? 'linear-gradient(180deg, #ff00ff 0%, #00ffff 50%, #ffff00 100%)'
    : THEME_GRADIENTS[theme] || THEME_GRADIENTS.sky;

  const difficulty = DIFFICULTY_LEVELS[Math.min(state.level - 1, DIFFICULTY_LEVELS.length - 1)];
  const weather = difficulty?.weather || 'sunny';

  const vitalioSkin = playerProgress.progress.equippedVitalioSkin;
  const caprichoSkin = playerProgress.progress.equippedCaprichoSkin;

  const handleSaveLeaderboard = useCallback((entry: { name: string; score: number; level: number; date: string }) => {
    const newEntries = [...leaderboardEntries, entry].sort((a, b) => b.score - a.score).slice(0, 10);
    setLeaderboardEntries(newEntries);
    saveLeaderboard(newEntries);
  }, [leaderboardEntries]);

  const gameContent = (
    <>
      {/* Background */}
      <div
        className="absolute inset-0"
        style={{ background: bgGradient, transition: 'background 1s ease' }}
      >
        <AssetImg
          assetPath={PICTURES.background}
          alt=""
          className="absolute inset-0 w-full h-full object-cover pixel-art opacity-40"
          draggable={false}
        />
      </div>

      <WeatherOverlay weather={weather} />

      <div className="crt-vignette" />
      <div className="crt-scanlines" />

      {state.levelFlash && (
        <div className="absolute inset-0 bg-white/30 pointer-events-none animate-level-flash" style={{ zIndex: 50 }} />
      )}

      <div
        ref={gameAreaRef}
        className="relative w-full h-full overflow-hidden"
        style={{ touchAction: 'none' }}
      >
        <ParticleSystem bursts={particles} width={gameDimensions.width} height={gameDimensions.height} />
        <FloatingText texts={state.floatingTexts} />

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
              coins={playerProgress.progress.coins}
              playerLevel={playerProgress.progress.playerLevel}
              isExpanded={isExpanded}
              onToggleExpand={() => setIsExpanded((v) => !v)}
              embeddedMode={embeddedMode}
            />

            <PowerUpIndicator activePowerUp={state.activePowerUp} />
            <FrenzyBar frenzyCount={state.frenzyCount} isFrenzyMode={state.isFrenzyMode} />

            {state.fallingItems.map((item) => {
              const def = ITEMS.find((d) => d.key === item.definitionKey);
              const displayDef = def || {
                key: item.definitionKey,
                category: item.revealedCategory || 'need',
                emoji: item.variant === 'unicorn' ? '🦄' : item.variant === 'bomb' ? '💣' : item.variant === 'mystery' ? '❓' : '❓',
                imageUrl: '',
                tier: 1,
              };
              return (
                <FallingItemComponent
                  key={item.id}
                  item={item}
                  definition={displayDef}
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
                <span className="pixel-font text-xs text-violet-400 combo-pop retro-glow">
                  {t('namVsYum.feedback.comboStart', { count: state.comboMultiplier })}
                </span>
              </div>
            )}

            <div
              className="absolute bottom-0 left-0 right-0 flex items-end justify-around px-4 pb-3 sm:pb-4"
              style={{ height: `${GAME_CONFIG.monsterZoneHeightPercent}%` }}
            >
              <Monster
                type="vitalio"
                isEating={eatingMonster === 'vitalio'}
                isRejecting={rejectingMonster === 'vitalio'}
                isHighlighted={highlightedMonster === 'vitalio'}
                skin={vitalioSkin}
                hasBombNearby={state.fallingItems.some((i) => i.variant === 'bomb' && !i.isConsumed)}
                isFrenzy={state.isFrenzyMode}
              />
              <Monster
                type="capricho"
                isEating={eatingMonster === 'capricho'}
                isRejecting={rejectingMonster === 'capricho'}
                isHighlighted={highlightedMonster === 'capricho'}
                skin={caprichoSkin}
                hasBombNearby={state.fallingItems.some((i) => i.variant === 'bomb' && !i.isConsumed)}
                isFrenzy={state.isFrenzyMode}
              />
            </div>

            <TrashZone isHighlighted={highlightedTrash} />

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
              <PauseOverlay onResume={handleResume} onRestart={handleRestart} onQuit={handleExit} />
            )}

            {state.phase === 'LEVEL_COMPLETE' && (
              <LevelCompleteScreen
                level={state.level}
                itemsSorted={state.itemsSortedThisLevel}
                correctItems={state.itemsCorrectThisLevel}
                isPerfect={state.itemsSortedThisLevel > 0 && state.itemsCorrectThisLevel === state.itemsSortedThisLevel}
                onContinue={handleContinueFromLevel}
              />
            )}

            {state.newAchievements.map((achId) => (
              <AchievementPopup key={achId} achievementId={achId} onDismiss={() => handleDismissAchievement(achId)} />
            ))}
          </>
        )}
      </div>

      {state.phase === 'START' && (
        <div className="absolute inset-0" style={{ zIndex: 70 }}>
          <GameStartScreen
            highScore={state.highScore}
            onPlay={handlePlay}
            onTutorial={handleTutorial}
            onAchievements={() => setShowAchievements(true)}
            onShop={() => setShowShop(true)}
            onStats={() => setShowStats(true)}
            onLeaderboard={() => setShowLeaderboard(true)}
            playerProgress={playerProgress.progress}
          />
        </div>
      )}

      {showAchievements && (
        <AchievementGallery progress={playerProgress.progress} onClose={() => setShowAchievements(false)} />
      )}

      {showShop && (
        <MonsterShop
          progress={playerProgress.progress}
          onClose={() => setShowShop(false)}
          onUnlockSkin={playerProgress.unlockSkin}
          onUnlockTheme={playerProgress.unlockTheme}
          onEquipSkin={playerProgress.equipSkin}
          onEquipTheme={playerProgress.equipTheme}
          onSpendCoins={playerProgress.spendCoins}
        />
      )}

      {showStats && (
        <StatsScreen progress={playerProgress.progress} accuracy={playerProgress.accuracy} onClose={() => setShowStats(false)} />
      )}

      {showLeaderboard && (
        <LeaderboardScreen
          entries={leaderboardEntries}
          currentHighScore={state.highScore}
          onClose={() => setShowLeaderboard(false)}
          onSaveEntry={handleSaveLeaderboard}
        />
      )}

      {state.phase === 'TUTORIAL' && (
        <div className="absolute inset-0" style={{ zIndex: 70 }}>
          <TutorialOverlay onComplete={handleTutorialComplete} onSkip={handlePlay} />
        </div>
      )}

      {state.phase === 'GAME_OVER' && (
        <div className="absolute inset-0" style={{ zIndex: 70 }}>
          <GameOverScreen
            state={state}
            onRetry={handleRetry}
            onExit={handleExit}
            newAchievements={state.newAchievements}
            onShowLeaderboard={() => setShowLeaderboard(true)}
          />
        </div>
      )}
    </>
  );

  return (
    <div
      className={cn(
        'relative',
        embeddedMode && isExpanded
          ? 'fixed left-0 right-0 bottom-0 top-14 md:top-16 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md p-2 md:p-4'
          : 'w-full h-full overflow-hidden',
        state.screenShake && 'animate-screen-shake',
        konamiActive && 'animate-konami-bg'
      )}
    >
      {/* Close button for expanded mode */}
      {embeddedMode && isExpanded && (
        <button
          onClick={() => setIsExpanded(false)}
          className="absolute top-2 right-2 md:top-3 md:right-3 z-[10000] p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          title={t('namVsYum.hud.collapse')}
          aria-label={t('namVsYum.hud.collapse')}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}

      {/* Game inner container */}
      <div
        className={cn(
          'relative',
          embeddedMode && isExpanded
            ? 'w-full h-full max-h-full md:max-w-2xl lg:max-w-4xl rounded-none md:rounded-2xl overflow-hidden shadow-2xl border-0 md:border md:border-white/10'
            : 'w-full h-full'
        )}
      >
        {gameContent}

        {/* Expand button — only one, located in the HUD */}
      </div>
    </div>
  );
}
