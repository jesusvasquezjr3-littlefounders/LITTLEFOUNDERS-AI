import type { GameState, GameAction } from './types';
import { COMBO_THRESHOLD, MAX_COMBO_MULTIPLIER, GAME_CONFIG } from './constants';

const loadHighScore = (): number => {
  try {
    return parseInt(localStorage.getItem(GAME_CONFIG.highScoreKey) || '0', 10);
  } catch {
    return 0;
  }
};

const saveHighScore = (score: number) => {
  try {
    localStorage.setItem(GAME_CONFIG.highScoreKey, String(score));
  } catch {
    // localStorage unavailable
  }
};

export const createInitialState = (): GameState => ({
  phase: 'START',
  score: 0,
  lives: GAME_CONFIG.maxLives,
  maxLives: GAME_CONFIG.maxLives,
  combo: 0,
  maxCombo: 0,
  comboMultiplier: 1,
  level: 1,
  itemsSorted: 0,
  fallingItems: [],
  activeMentorTip: null,
  highScore: loadHighScore(),
  lastFeedback: null,
  feedbackTimestamp: 0,
  draggingItemId: null,
});

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SHOW_TUTORIAL':
      return { ...state, phase: 'TUTORIAL' };

    case 'START_PLAYING':
      return {
        ...createInitialState(),
        highScore: state.highScore,
        phase: 'PLAYING',
      };

    case 'PAUSE':
      return { ...state, phase: 'PAUSED' };

    case 'RESUME':
      return { ...state, phase: 'PLAYING' };

    case 'SPAWN_ITEM':
      return {
        ...state,
        fallingItems: [...state.fallingItems, action.item],
      };

    case 'UPDATE_ITEMS':
      // Merge: use RAF-updated positions for non-dragging items,
      // but preserve the CURRENT state of any item being dragged
      // (so we don't overwrite positions set by MOVE_DRAG).
      return {
        ...state,
        fallingItems: action.items.map((incoming) => {
          const current = state.fallingItems.find((c) => c.id === incoming.id);
          // If the item is currently being dragged in state, keep its live position
          if (current && current.isDragging) return current;
          return incoming;
        }),
      };

    case 'REMOVE_ITEM':
      return {
        ...state,
        fallingItems: state.fallingItems.filter((i) => i.id !== action.id),
      };

    case 'START_DRAG':
      return {
        ...state,
        draggingItemId: action.id,
        fallingItems: state.fallingItems.map((i) =>
          i.id === action.id
            ? { ...i, isDragging: true, dragOffsetX: action.offsetX, dragOffsetY: action.offsetY }
            : i
        ),
      };

    case 'MOVE_DRAG':
      return {
        ...state,
        fallingItems: state.fallingItems.map((i) =>
          i.id === action.id && i.isDragging
            ? { ...i, x: action.x, y: action.y }
            : i
        ),
      };

    case 'END_DRAG':
      return {
        ...state,
        draggingItemId: null,
        fallingItems: state.fallingItems.map((i) =>
          i.id === action.id ? { ...i, isDragging: false } : i
        ),
      };

    case 'CORRECT_SORT': {
      const newCombo = state.combo + 1;
      const newMaxCombo = Math.max(state.maxCombo, newCombo);
      const newMultiplier = Math.min(
        MAX_COMBO_MULTIPLIER,
        1 + Math.floor(newCombo / COMBO_THRESHOLD)
      );
      const pointsEarned = action.points * newMultiplier;
      const newScore = state.score + pointsEarned;
      const newItemsSorted = state.itemsSorted + 1;
      const newHighScore = Math.max(state.highScore, newScore);

      if (newHighScore > state.highScore) {
        saveHighScore(newHighScore);
      }

      return {
        ...state,
        fallingItems: state.fallingItems.map((i) =>
          i.id === action.id ? { ...i, isConsumed: true } : i
        ),
        score: newScore,
        combo: newCombo,
        maxCombo: newMaxCombo,
        comboMultiplier: newMultiplier,
        itemsSorted: newItemsSorted,
        lastFeedback: 'correct',
        feedbackTimestamp: Date.now(),
        highScore: newHighScore,
        draggingItemId: null,
      };
    }

    case 'INCORRECT_SORT': {
      const newLives = state.lives - 1;
      const isGameOver = newLives <= 0;
      const newHighScore = Math.max(state.highScore, state.score);

      if (isGameOver) {
        saveHighScore(newHighScore);
      }

      return {
        ...state,
        fallingItems: state.fallingItems.map((i) =>
          i.id === action.id ? { ...i, isConsumed: true } : i
        ),
        lives: newLives,
        combo: 0,
        comboMultiplier: 1,
        lastFeedback: 'incorrect',
        feedbackTimestamp: Date.now(),
        phase: isGameOver ? 'GAME_OVER' : state.phase,
        highScore: newHighScore,
        draggingItemId: null,
      };
    }

    case 'ITEM_MISSED': {
      const newLives = state.lives - 1;
      const isGameOver = newLives <= 0;
      const newHighScore = Math.max(state.highScore, state.score);

      if (isGameOver) {
        saveHighScore(newHighScore);
      }

      return {
        ...state,
        fallingItems: state.fallingItems.filter((i) => i.id !== action.id),
        lives: newLives,
        combo: 0,
        comboMultiplier: 1,
        lastFeedback: 'incorrect',
        feedbackTimestamp: Date.now(),
        phase: isGameOver ? 'GAME_OVER' : state.phase,
        highScore: newHighScore,
      };
    }

    case 'LEVEL_UP':
      return { ...state, level: state.level + 1 };

    case 'SHOW_MENTOR_TIP':
      return { ...state, activeMentorTip: action.tip };

    case 'DISMISS_MENTOR_TIP':
      return { ...state, activeMentorTip: null };

    case 'CLEAR_FEEDBACK':
      return { ...state, lastFeedback: null };

    case 'GAME_OVER': {
      const finalHighScore = Math.max(state.highScore, state.score);
      saveHighScore(finalHighScore);
      return { ...state, phase: 'GAME_OVER', highScore: finalHighScore };
    }

    case 'RESET':
      return {
        ...createInitialState(),
        highScore: Math.max(state.highScore, state.score),
      };

    default:
      return state;
  }
}
