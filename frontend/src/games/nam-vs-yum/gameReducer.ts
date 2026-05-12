import type { GameState, GameAction, AchievementId } from './types';
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
  itemsSortedThisLevel: 0,
  itemsCorrectThisLevel: 0,
  levelStartTime: 0,
  fallingItems: [],
  activeMentorTip: null,
  highScore: loadHighScore(),
  lastFeedback: null,
  feedbackTimestamp: 0,
  draggingItemId: null,
  activePowerUp: null,
  frenzyCount: 0,
  isFrenzyMode: false,
  floatingTexts: [],
  screenShake: false,
  levelFlash: false,
  newAchievements: [],
  perfectLevelStreak: 0,
});

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SHOW_TUTORIAL':
      return { ...state, phase: 'TUTORIAL' };

    case 'START_PLAYING': {
      const now = Date.now();
      return {
        ...createInitialState(),
        highScore: state.highScore,
        phase: 'PLAYING',
        levelStartTime: now,
      };
    }

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
      return {
        ...state,
        fallingItems: action.items.map((incoming) => {
          const current = state.fallingItems.find((c) => c.id === incoming.id);
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

      let pointsEarned = action.points * newMultiplier;
      if (action.wasGolden) pointsEarned *= 3;
      if (action.wasRainbow) pointsEarned *= 5;
      if (state.isFrenzyMode) pointsEarned *= 1.5;
      if (state.activePowerUp?.type === 'scoreBoost') pointsEarned *= 2;

      pointsEarned = Math.round(pointsEarned);

      const newScore = state.score + pointsEarned;
      const newItemsSorted = state.itemsSorted + 1;
      const newItemsCorrectThisLevel = state.itemsCorrectThisLevel + 1;
      const newHighScore = Math.max(state.highScore, newScore);
      const newFrenzyCount = state.frenzyCount + 1;
      const newIsFrenzy = newFrenzyCount >= GAME_CONFIG.frenzyThreshold;

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
        itemsCorrectThisLevel: newItemsCorrectThisLevel,
        lastFeedback: 'correct',
        feedbackTimestamp: Date.now(),
        highScore: newHighScore,
        draggingItemId: null,
        frenzyCount: newFrenzyCount,
        isFrenzyMode: newIsFrenzy,
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
        frenzyCount: 0,
        isFrenzyMode: false,
        screenShake: true,
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
        frenzyCount: 0,
        isFrenzyMode: false,
        screenShake: true,
      };
    }

    case 'LEVEL_UP': {
      const wasPerfect = state.itemsSortedThisLevel > 0 && state.itemsCorrectThisLevel === state.itemsSortedThisLevel;
      const perfectBonus = wasPerfect ? 50 : 0;
      const newScore = state.score + perfectBonus;
      const newHighScore = Math.max(state.highScore, newScore);
      if (newHighScore > state.highScore) saveHighScore(newHighScore);

      return {
        ...state,
        level: state.level + 1,
        itemsSortedThisLevel: 0,
        itemsCorrectThisLevel: 0,
        levelStartTime: Date.now(),
        score: newScore,
        highScore: newHighScore,
        levelFlash: true,
        perfectLevelStreak: wasPerfect ? state.perfectLevelStreak + 1 : 0,
      };
    }

    case 'SHOW_LEVEL_COMPLETE':
      return { ...state, phase: 'LEVEL_COMPLETE' };

    case 'DISMISS_LEVEL_COMPLETE':
      return { ...state, phase: 'PLAYING' };

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

    case 'ACTIVATE_POWER_UP': {
      let newLives = state.lives;
      if (action.powerUp === 'extraLife') {
        newLives = Math.min(state.maxLives, state.lives + 1);
      }
      return {
        ...state,
        activePowerUp: action.powerUp === 'extraLife'
          ? null
          : { type: action.powerUp, endsAt: Date.now() + action.durationMs },
        lives: newLives,
      };
    }

    case 'DEACTIVATE_POWER_UP':
      return { ...state, activePowerUp: null };

    case 'ADD_FLOATING_TEXT':
      return {
        ...state,
        floatingTexts: [...state.floatingTexts, action.text],
      };

    case 'REMOVE_FLOATING_TEXT':
      return {
        ...state,
        floatingTexts: state.floatingTexts.filter((ft) => ft.id !== action.id),
      };

    case 'TRIGGER_SCREEN_SHAKE':
      return { ...state, screenShake: true };

    case 'CLEAR_SCREEN_SHAKE':
      return { ...state, screenShake: false };

    case 'TRIGGER_LEVEL_FLASH':
      return { ...state, levelFlash: true };

    case 'CLEAR_LEVEL_FLASH':
      return { ...state, levelFlash: false };

    case 'ENTER_FRENZY':
      return { ...state, isFrenzyMode: true };

    case 'EXIT_FRENZY':
      return { ...state, isFrenzyMode: false, frenzyCount: 0 };

    case 'INCREMENT_FRENZY':
      return { ...state, frenzyCount: state.frenzyCount + 1 };

    case 'RESET_FRENZY':
      return { ...state, frenzyCount: 0, isFrenzyMode: false };

    case 'ADD_ACHIEVEMENT': {
      if (state.newAchievements.includes(action.id)) return state;
      return { ...state, newAchievements: [...state.newAchievements, action.id] };
    }

    case 'CLEAR_NEW_ACHIEVEMENTS':
      return { ...state, newAchievements: [] };

    case 'REVEAL_MYSTERY':
      return {
        ...state,
        fallingItems: state.fallingItems.map((i) =>
          i.id === action.id ? { ...i, revealedCategory: action.category } : i
        ),
      };

    case 'TICK_BOMB':
      return {
        ...state,
        fallingItems: state.fallingItems.map((i) =>
          i.id === action.id ? { ...i, bombTimer: action.newTimer } : i
        ),
      };

    default:
      return state;
  }
}
