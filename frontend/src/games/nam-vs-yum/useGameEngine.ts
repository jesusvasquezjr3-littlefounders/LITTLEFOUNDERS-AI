import { useEffect, useRef, useCallback } from 'react';
import type { GameState, GameAction, FallingItem, MonsterType, ItemCategory, PowerUpType } from './types';
import {
  ITEMS,
  DIFFICULTY_LEVELS,
  MENTOR_CHARACTERS,
  POWER_UPS,
  GAME_CONFIG,
} from './constants';

let itemIdCounter = 0;

function getDifficulty(level: number) {
  const maxIdx = DIFFICULTY_LEVELS.length - 1;
  if (level <= DIFFICULTY_LEVELS.length) {
    return DIFFICULTY_LEVELS[level - 1];
  }
  const base = DIFFICULTY_LEVELS[maxIdx];
  const extraLevels = level - DIFFICULTY_LEVELS.length;
  return {
    ...base,
    baseSpeed: base.baseSpeed + extraLevels * 25,
    spawnIntervalMs: Math.max(400, base.spawnIntervalMs - extraLevels * 40),
    maxSimultaneous: Math.min(10, base.maxSimultaneous + Math.floor(extraLevels / 3)),
  };
}

function getAvailableItems(tiers: number[]) {
  return ITEMS.filter((item) => tiers.includes(item.tier));
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function pickRandomCategory(): ItemCategory {
  return Math.random() < 0.5 ? 'need' : 'want';
}

function pickPowerUpType(): PowerUpType | null {
  const roll = Math.random();
  let cumulative = 0;
  for (const pu of POWER_UPS) {
    cumulative += pu.spawnChance;
    if (roll < cumulative) return pu.type;
  }
  return null;
}

export function useGameEngine(
  state: GameState,
  dispatch: React.Dispatch<GameAction>,
  gameAreaRef: React.RefObject<HTMLDivElement | null>,
) {
  const stateRef = useRef(state);
  stateRef.current = state;

  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);
  const lastLevelUpCountRef = useRef<number>(0);
  const bombTickRef = useRef<number>(0);
  const powerUpEndRef = useRef<number>(0);

  const getDimensions = useCallback(() => {
    if (!gameAreaRef.current) return { width: 0, height: 0 };
    return {
      width: gameAreaRef.current.clientWidth,
      height: gameAreaRef.current.clientHeight,
    };
  }, [gameAreaRef]);

  const spawnItem = useCallback(() => {
    const st = stateRef.current;
    if (st.phase !== 'PLAYING') return;

    const { width: gameAreaWidth } = getDimensions();
    if (gameAreaWidth < 50) return;

    const difficulty = getDifficulty(st.level);
    const activeItems = st.fallingItems.filter((i) => !i.isConsumed);
    if (activeItems.length >= difficulty.maxSimultaneous) return;

    const available = getAvailableItems(difficulty.includesTier);
    if (available.length === 0) return;

    // Determine item variant
    let variant: FallingItem['variant'] = 'normal';
    let powerUpType: PowerUpType | undefined;
    let category: ItemCategory | undefined;

    const rand = Math.random();
    if (rand < GAME_CONFIG.unicornItemChance) {
      variant = 'unicorn';
    } else if (rand < GAME_CONFIG.rainbowItemChance) {
      variant = 'rainbow';
    } else if (rand < GAME_CONFIG.goldenItemChance) {
      variant = 'golden';
    } else if (difficulty.specialMechanic === 'bomb' && Math.random() < 0.08) {
      variant = 'bomb';
    } else if (difficulty.specialMechanic === 'mystery' && Math.random() < 0.1) {
      variant = 'mystery';
      category = pickRandomCategory();
    } else {
      // Power-up spawn
      const pu = pickPowerUpType();
      if (pu && Math.random() < 0.04) {
        variant = 'normal';
        powerUpType = pu;
      }
    }

    // For special variants that aren't in normal items, we still need a definition
    let def;
    if (variant === 'unicorn') {
      def = { key: 'unicorn', category: 'want' as ItemCategory, emoji: '🦄', imageUrl: '', tier: 4 };
    } else if (variant === 'rainbow') {
      def = available[Math.floor(Math.random() * available.length)];
    } else if (variant === 'bomb') {
      def = { key: 'bomb', category: 'want' as ItemCategory, emoji: '💣', imageUrl: '', tier: 1 };
    } else if (variant === 'mystery') {
      def = { key: 'mystery', category: category!, emoji: '❓', imageUrl: '', tier: 1 };
    } else {
      def = available[Math.floor(Math.random() * available.length)];
    }

    const itemSize = GAME_CONFIG.itemSizePx;
    const margin = itemSize;
    const maxX = gameAreaWidth - margin;
    const x = randomBetween(margin, Math.max(margin + 1, maxX));
    let speed = difficulty.baseSpeed + randomBetween(-difficulty.speedVariance, difficulty.speedVariance);

    // Apply slow motion
    if (st.activePowerUp?.type === 'slowMotion') {
      speed *= 0.3;
    }

    // Apply freeze time
    if (st.activePowerUp?.type === 'freezeTime') {
      speed = 0;
    }

    const item: FallingItem = {
      id: `item-${++itemIdCounter}`,
      definitionKey: def.key,
      x,
      y: -itemSize,
      speed: Math.max(10, speed),
      rotation: randomBetween(-15, 15),
      rotationSpeed: randomBetween(-60, 60),
      isDragging: false,
      isConsumed: false,
      dragOffsetX: 0,
      dragOffsetY: 0,
      variant,
      powerUpType,
      bombTimer: variant === 'bomb' ? GAME_CONFIG.bombTimerSeconds : undefined,
      revealedCategory: variant === 'mystery' ? category : undefined,
      sideVelocity: difficulty.specialMechanic === 'zigzag' ? randomBetween(-30, 30) : 0,
    };

    dispatch({ type: 'SPAWN_ITEM', item });
  }, [dispatch, getDimensions]);

  // Main game loop
  useEffect(() => {
    if (state.phase !== 'PLAYING') {
      lastTimeRef.current = 0;
      return;
    }

    const tick = (timestamp: number) => {
      const st = stateRef.current;
      if (st.phase !== 'PLAYING') return;

      const { height: gameAreaHeight, width: gameAreaWidth } = getDimensions();

      if (gameAreaHeight < 50) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const deltaMs = Math.min(timestamp - lastTimeRef.current, 100);
      const deltaSec = deltaMs / 1000;
      lastTimeRef.current = timestamp;

      // Check power-up expiration
      if (st.activePowerUp && Date.now() >= st.activePowerUp.endsAt) {
        dispatch({ type: 'DEACTIVATE_POWER_UP' });
      }

      // Check frenzy expiration (frenzy is not timed, it's based on consecutive corrects)
      if (st.isFrenzyMode && st.frenzyCount < GAME_CONFIG.frenzyThreshold) {
        dispatch({ type: 'EXIT_FRENZY' });
      }

      // Spawn timer
      const difficulty = getDifficulty(st.level);
      let spawnInterval = difficulty.spawnIntervalMs;
      if (st.isFrenzyMode) spawnInterval *= 0.7;
      if (st.activePowerUp?.type === 'slowMotion') spawnInterval *= 2;

      spawnTimerRef.current += deltaMs;
      if (spawnTimerRef.current >= spawnInterval) {
        spawnTimerRef.current -= spawnInterval;
        spawnItem();
      }

      // Update falling items positions
      const bottomLimit = gameAreaHeight;
      let hasChanges = false;
      const missedIds: string[] = [];
      const bombExplosions: string[] = [];

      const updatedItems = st.fallingItems.map((item) => {
        if (item.isDragging || item.isConsumed) return item;

        let newY = item.y;
        let newX = item.x;
        let newRotation = item.rotation;

        if (st.activePowerUp?.type !== 'freezeTime') {
          let speedMult = 1;
          if (st.activePowerUp?.type === 'slowMotion') speedMult = 0.3;
          if (st.isFrenzyMode) speedMult *= 1.1;

          newY = item.y + item.speed * deltaSec * speedMult;
          newRotation = item.rotation + item.rotationSpeed * deltaSec;

          // Zigzag movement
          if (item.sideVelocity) {
            newX = item.x + item.sideVelocity * deltaSec;
            if (newX < 20 || newX > gameAreaWidth - 20) {
              // Bounce off walls
              item.sideVelocity = -(item.sideVelocity || 0);
              newX = Math.max(20, Math.min(gameAreaWidth - 20, newX));
            }
          }
        }

        // Check bomb timer
        if (item.variant === 'bomb' && item.bombTimer !== undefined) {
          bombTickRef.current += deltaMs;
          if (bombTickRef.current >= 100) {
            bombTickRef.current = 0;
            const newTimer = item.bombTimer - 0.1;
            if (newTimer <= 0) {
              bombExplosions.push(item.id);
              return item;
            }
            dispatch({ type: 'TICK_BOMB', id: item.id, newTimer: Math.max(0, newTimer) });
          }
        }

        // Check if item fell past bottom
        if (newY > bottomLimit + GAME_CONFIG.itemSizePx) {
          missedIds.push(item.id);
          return item;
        }

        hasChanges = true;
        return { ...item, x: newX, y: newY, rotation: newRotation };
      });

      // Handle bomb explosions
      if (bombExplosions.length > 0) {
        dispatch({ type: 'ITEM_MISSED', id: bombExplosions[0], wasBomb: true });
      }

      // Dispatch missed items
      if (missedIds.length > 0 && bombExplosions.length === 0) {
        dispatch({ type: 'ITEM_MISSED', id: missedIds[0] });
      } else if (hasChanges && bombExplosions.length === 0) {
        dispatch({ type: 'UPDATE_ITEMS', items: updatedItems });
      }

      // Check for level up
      const levelUpThreshold = st.level * GAME_CONFIG.levelUpEveryNItems;
      if (st.itemsSorted >= levelUpThreshold && st.itemsSorted > lastLevelUpCountRef.current) {
        lastLevelUpCountRef.current = st.itemsSorted;
        dispatch({ type: 'LEVEL_UP' });
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [state.phase, dispatch, spawnItem, getDimensions]);

  // Clean up consumed items after animation
  useEffect(() => {
    const consumed = state.fallingItems.filter((i) => i.isConsumed);
    if (consumed.length === 0) return;

    const timers = consumed.map((item) => {
      return setTimeout(() => {
        dispatch({ type: 'REMOVE_ITEM', id: item.id });
      }, GAME_CONFIG.consumeAnimationMs);
    });

    return () => timers.forEach(clearTimeout);
  }, [state.fallingItems, dispatch]);

  // Clear feedback after duration
  useEffect(() => {
    if (!state.lastFeedback) return;
    const timer = setTimeout(() => {
      dispatch({ type: 'CLEAR_FEEDBACK' });
    }, GAME_CONFIG.feedbackDurationMs);
    return () => clearTimeout(timer);
  }, [state.feedbackTimestamp, state.lastFeedback, dispatch]);

  // Auto-dismiss mentor tip
  useEffect(() => {
    if (!state.activeMentorTip) return;
    const timer = setTimeout(() => {
      dispatch({ type: 'DISMISS_MENTOR_TIP' });
    }, GAME_CONFIG.mentorTipDurationMs);
    return () => clearTimeout(timer);
  }, [state.activeMentorTip, dispatch]);

  // Clear screen shake
  useEffect(() => {
    if (!state.screenShake) return;
    const timer = setTimeout(() => {
      dispatch({ type: 'CLEAR_SCREEN_SHAKE' });
    }, 500);
    return () => clearTimeout(timer);
  }, [state.screenShake, dispatch]);

  // Clear level flash
  useEffect(() => {
    if (!state.levelFlash) return;
    const timer = setTimeout(() => {
      dispatch({ type: 'CLEAR_LEVEL_FLASH' });
    }, 800);
    return () => clearTimeout(timer);
  }, [state.levelFlash, dispatch]);

  // Show level complete screen briefly
  useEffect(() => {
    if (state.phase === 'PLAYING' && state.levelFlash) {
      dispatch({ type: 'SHOW_LEVEL_COMPLETE' });
      const timer = setTimeout(() => {
        dispatch({ type: 'DISMISS_LEVEL_COMPLETE' });
      }, GAME_CONFIG.levelCompleteDurationMs);
      return () => clearTimeout(timer);
    }
  }, [state.levelFlash, dispatch]);

  // Handle drop
  const handleDrop = useCallback(
    (itemId: string, targetMonster: MonsterType) => {
      const st = stateRef.current;
      const item = st.fallingItems.find((i) => i.id === itemId);
      if (!item || item.isConsumed) return { correct: false, points: 0, wasSpecial: false };

      // Handle power-up items
      if (item.powerUpType) {
        const puDef = POWER_UPS.find((p) => p.type === item.powerUpType);
        if (puDef) {
          dispatch({ type: 'ACTIVATE_POWER_UP', powerUp: item.powerUpType, durationMs: puDef.durationMs });
          dispatch({ type: 'CORRECT_SORT', id: itemId, points: 5, wasGolden: false });
          return { correct: true, points: 5, wasSpecial: true, powerUp: item.powerUpType };
        }
      }

      // Handle unicorn
      if (item.variant === 'unicorn') {
        const isCorrect = targetMonster === 'capricho';
        if (isCorrect) {
          dispatch({ type: 'CORRECT_SORT', id: itemId, points: 100, wasRainbow: true });
        } else {
          dispatch({ type: 'INCORRECT_SORT', id: itemId });
        }
        return { correct: isCorrect, points: isCorrect ? 100 : 0, wasSpecial: true };
      }

      // Handle rainbow
      if (item.variant === 'rainbow') {
        dispatch({ type: 'CORRECT_SORT', id: itemId, points: 50, wasRainbow: true });
        return { correct: true, points: 50, wasSpecial: true };
      }

      // Handle bomb
      if (item.variant === 'bomb') {
        dispatch({ type: 'INCORRECT_SORT', id: itemId, wasBomb: true });
        return { correct: false, points: 0, wasSpecial: true, wasBomb: true };
      }

      // Handle mystery
      const def = ITEMS.find((d) => d.key === item.definitionKey) ||
        (item.variant === 'mystery' ? { key: 'mystery', category: item.revealedCategory || 'need' } as const : undefined);
      if (!def) return { correct: false, points: 0, wasSpecial: false };

      const category = item.variant === 'mystery'
        ? (item.revealedCategory || 'need')
        : def.category;

      const difficulty = getDifficulty(st.level);
      const isCorrect =
        (targetMonster === 'vitalio' && category === 'need') ||
        (targetMonster === 'capricho' && category === 'want');

      if (isCorrect) {
        dispatch({
          type: 'CORRECT_SORT',
          id: itemId,
          points: difficulty.pointsPerCorrect,
          wasGolden: item.variant === 'golden',
        });

        // Maybe show mentor tip
        if (Math.random() < difficulty.mentorTipChance && !st.activeMentorTip) {
          const char = MENTOR_CHARACTERS[Math.floor(Math.random() * MENTOR_CHARACTERS.length)];
          const tipKey = char.tipKeys[Math.floor(Math.random() * char.tipKeys.length)];
          const tip = { character: char.id, tipKey, nameKey: char.nameKey };
          setTimeout(() => {
            dispatch({ type: 'SHOW_MENTOR_TIP', tip });
          }, 300);
        }
      } else {
        dispatch({ type: 'INCORRECT_SORT', id: itemId });
      }

      return { correct: isCorrect, points: isCorrect ? difficulty.pointsPerCorrect : 0, wasSpecial: false };
    },
    [dispatch],
  );

  // Handle trash drop (for bombs)
  const handleTrashDrop = useCallback(
    (itemId: string) => {
      const st = stateRef.current;
      const item = st.fallingItems.find((i) => i.id === itemId);
      if (!item || item.isConsumed) return false;

      if (item.variant === 'bomb') {
        // Bomb defused! Give points
        dispatch({ type: 'CORRECT_SORT', id: itemId, points: 25 });
        return true;
      }

      // Non-bomb items reject from trash
      return false;
    },
    [dispatch],
  );

  // Reset level-up counter on new game
  useEffect(() => {
    if (state.phase === 'PLAYING' && state.itemsSorted === 0) {
      lastLevelUpCountRef.current = 0;
      spawnTimerRef.current = 0;
      lastTimeRef.current = 0;
      bombTickRef.current = 0;
      powerUpEndRef.current = 0;
    }
  }, [state.phase, state.itemsSorted]);

  return { handleDrop, handleTrashDrop };
}
