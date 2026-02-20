import { useEffect, useRef, useCallback } from 'react';
import type { GameState, GameAction, FallingItem, MonsterType } from './types';
import {
  ITEMS,
  DIFFICULTY_LEVELS,
  MENTOR_TIPS,
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
    baseSpeed: base.baseSpeed + extraLevels * 20,
    spawnIntervalMs: Math.max(600, base.spawnIntervalMs - extraLevels * 80),
  };
}

function getAvailableItems(tiers: number[]) {
  return ITEMS.filter((item) => tiers.includes(item.tier));
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
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

  // Helper to get live dimensions from the ref
  const getDimensions = useCallback(() => {
    if (!gameAreaRef.current) return { width: 0, height: 0 };
    return {
      width: gameAreaRef.current.clientWidth,
      height: gameAreaRef.current.clientHeight,
    };
  }, [gameAreaRef]);

  // Spawn a new falling item
  const spawnItem = useCallback(() => {
    const st = stateRef.current;
    if (st.phase !== 'PLAYING') return;

    const { width: gameAreaWidth } = getDimensions();
    if (gameAreaWidth < 50) return; // Not ready yet

    const difficulty = getDifficulty(st.level);
    const activeItems = st.fallingItems.filter((i) => !i.isConsumed);
    if (activeItems.length >= difficulty.maxSimultaneous) return;

    const available = getAvailableItems(difficulty.includesTier);
    if (available.length === 0) return;

    const def = available[Math.floor(Math.random() * available.length)];
    const itemSize = GAME_CONFIG.itemSizePx;
    const margin = itemSize;
    const maxX = gameAreaWidth - margin;
    const x = randomBetween(margin, Math.max(margin + 1, maxX));
    const speed = difficulty.baseSpeed + randomBetween(-difficulty.speedVariance, difficulty.speedVariance);

    const item: FallingItem = {
      id: `item-${++itemIdCounter}`,
      definitionKey: def.key,
      x,
      y: -itemSize,
      speed: Math.max(30, speed),
      rotation: randomBetween(-15, 15),
      rotationSpeed: randomBetween(-60, 60),
      isDragging: false,
      isConsumed: false,
      dragOffsetX: 0,
      dragOffsetY: 0,
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

      // Read dimensions each frame from the DOM ref
      const { height: gameAreaHeight } = getDimensions();

      // Don't run physics until the game area has real dimensions
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

      // Spawn timer
      const difficulty = getDifficulty(st.level);
      spawnTimerRef.current += deltaMs;
      if (spawnTimerRef.current >= difficulty.spawnIntervalMs) {
        spawnTimerRef.current -= difficulty.spawnIntervalMs;
        spawnItem();
      }

      // Update falling items positions
      const bottomLimit = gameAreaHeight;
      let hasChanges = false;
      const missedIds: string[] = [];

      const updatedItems = st.fallingItems.map((item) => {
        if (item.isDragging || item.isConsumed) return item;

        const newY = item.y + item.speed * deltaSec;
        const newRotation = item.rotation + item.rotationSpeed * deltaSec;

        // Check if item fell past the game area bottom
        if (newY > bottomLimit + GAME_CONFIG.itemSizePx) {
          missedIds.push(item.id);
          return item;
        }

        hasChanges = true;
        return { ...item, y: newY, rotation: newRotation };
      });

      // Dispatch missed items (one at a time to avoid race conditions)
      if (missedIds.length > 0) {
        dispatch({ type: 'ITEM_MISSED', id: missedIds[0] });
      } else if (hasChanges) {
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

  // Handle drop: determine if item was placed on correct monster
  const handleDrop = useCallback(
    (itemId: string, targetMonster: MonsterType) => {
      const st = stateRef.current;
      const item = st.fallingItems.find((i) => i.id === itemId);
      if (!item || item.isConsumed) return false;

      const def = ITEMS.find((d) => d.key === item.definitionKey);
      if (!def) return false;

      const difficulty = getDifficulty(st.level);
      const isCorrect =
        (targetMonster === 'vitalio' && def.category === 'need') ||
        (targetMonster === 'capricho' && def.category === 'want');

      if (isCorrect) {
        dispatch({ type: 'CORRECT_SORT', id: itemId, points: difficulty.pointsPerCorrect });

        // Maybe show mentor tip
        if (Math.random() < difficulty.mentorTipChance && !st.activeMentorTip) {
          const tip = MENTOR_TIPS[Math.floor(Math.random() * MENTOR_TIPS.length)];
          setTimeout(() => {
            dispatch({ type: 'SHOW_MENTOR_TIP', tip });
          }, 300);
        }
      } else {
        dispatch({ type: 'INCORRECT_SORT', id: itemId });
      }

      return isCorrect;
    },
    [dispatch],
  );

  // Reset level-up counter on new game
  useEffect(() => {
    if (state.phase === 'PLAYING' && state.itemsSorted === 0) {
      lastLevelUpCountRef.current = 0;
      spawnTimerRef.current = 0;
      lastTimeRef.current = 0;
    }
  }, [state.phase, state.itemsSorted]);

  return { handleDrop };
}
