import { GameState, GameAction, GamePhase } from './types';
import {
  GAME_CONFIG,
  generateTransaction,
  getMaxTimeTicks,
  SHOP_UPGRADES,
} from './constants';

export function createInitialState(): GameState {
  const highScore = parseInt(
    localStorage.getItem(GAME_CONFIG.highScoreKey) || '0',
    10,
  );
  return {
    phase: 'START',
    day: 1,
    hearts: GAME_CONFIG.initialHearts,
    maxHearts: GAME_CONFIG.initialHearts,
    score: 0,
    tipCoins: 0,
    highScore,
    currentTransaction: null,
    customersThisDay: 0,
    customersPerDay: GAME_CONFIG.customersPerDay,
    correctStreak: 0,
    maxStreak: 0,
    playerInput: '',
    timeLeft: 0,
    maxTime: 0,
    upgrades: { hourglass: 0, amulet: 0, theme: 'default' },
    tutorialStep: 0,
    lastWasCorrect: null,
    lastWasBonus: false,
    totalDayScore: 0,
    previousPhase: null,
  };
}

function nextCustomer(state: GameState, nextDay?: number): GameState {
  const day = nextDay ?? state.day;
  const transaction = generateTransaction(
    day,
    state.currentTransaction?.customer?.key,
  );
  const maxTime = getMaxTimeTicks(day, state.upgrades.hourglass);
  return {
    ...state,
    phase: 'CUSTOMER_ARRIVING',
    day,
    currentTransaction: transaction,
    maxTime,
    timeLeft: maxTime,
    playerInput: '',
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    // ── Tutorial ────────────────────────────────────────────────────────────
    case 'GO_TO_TUTORIAL':
      return { ...state, phase: 'TUTORIAL', tutorialStep: 0 };

    case 'TUTORIAL_NEXT': {
      if (state.tutorialStep >= 2) {
        return nextCustomer({ ...state, customersThisDay: 0, correctStreak: 0, totalDayScore: 0 });
      }
      return { ...state, tutorialStep: state.tutorialStep + 1 };
    }

    case 'TUTORIAL_SKIP':
      return nextCustomer({ ...state, customersThisDay: 0, correctStreak: 0, totalDayScore: 0 });

    // ── Start without tutorial ───────────────────────────────────────────────
    case 'START_PLAYING':
      return nextCustomer({ ...state, customersThisDay: 0, correctStreak: 0, totalDayScore: 0 });

    // ── Phase transitions (driven by component timers) ───────────────────────
    case 'BEGIN_PRESENTING':
      return { ...state, phase: 'PRESENTING', playerInput: '' };

    case 'BEGIN_WAITING': {
      const maxTime = getMaxTimeTicks(state.day, state.upgrades.hourglass);
      return {
        ...state,
        phase: 'WAITING_INPUT',
        maxTime,
        timeLeft: maxTime,
        playerInput: '',
      };
    }

    // ── Input ────────────────────────────────────────────────────────────────
    case 'KEY_PRESS': {
      if (state.phase !== 'WAITING_INPUT') return state;
      if (state.playerInput.length >= GAME_CONFIG.maxInputDigits) return state;
      return { ...state, playerInput: state.playerInput + action.key };
    }

    case 'KEY_BACKSPACE': {
      if (state.phase !== 'WAITING_INPUT') return state;
      return { ...state, playerInput: state.playerInput.slice(0, -1) };
    }

    // ── Answer submission ────────────────────────────────────────────────────
    case 'SUBMIT_ANSWER': {
      if (state.phase !== 'WAITING_INPUT' || !state.currentTransaction) return state;
      if (!state.playerInput) return state;

      const playerAnswer = parseInt(state.playerInput, 10);
      if (isNaN(playerAnswer)) return state;

      const isCorrect = playerAnswer === state.currentTransaction.correctChange;

      if (isCorrect) {
        const timeElapsedMs = (state.maxTime - state.timeLeft) * 100;
        const isBonus = timeElapsedMs <= GAME_CONFIG.speedBonusThresholdMs;
        const xp = GAME_CONFIG.correctXP + (isBonus ? GAME_CONFIG.speedBonusXP : 0);
        const tips = GAME_CONFIG.correctTips + (isBonus ? GAME_CONFIG.speedBonusTips : 0);
        const newScore = state.score + xp;
        const newStreak = state.correctStreak + 1;
        const newMaxStreak = Math.max(state.maxStreak, newStreak);
        const newHighScore = Math.max(state.highScore, newScore);

        if (newScore > state.highScore) {
          localStorage.setItem(GAME_CONFIG.highScoreKey, newScore.toString());
        }

        return {
          ...state,
          phase: 'FEEDBACK_CORRECT',
          score: newScore,
          tipCoins: state.tipCoins + tips,
          correctStreak: newStreak,
          maxStreak: newMaxStreak,
          highScore: newHighScore,
          lastWasCorrect: true,
          lastWasBonus: isBonus,
          totalDayScore: state.totalDayScore + xp,
        };
      } else {
        const newHearts = Math.max(0, state.hearts - 1);
        return {
          ...state,
          phase: 'FEEDBACK_WRONG',
          hearts: newHearts,
          correctStreak: 0,
          lastWasCorrect: false,
          lastWasBonus: false,
        };
      }
    }

    // ── Timer ────────────────────────────────────────────────────────────────
    case 'TIMER_TICK': {
      if (state.phase !== 'WAITING_INPUT') return state;
      const newTimeLeft = state.timeLeft - 1;
      if (newTimeLeft <= 0) {
        return {
          ...state,
          phase: 'FEEDBACK_TIMEOUT',
          timeLeft: 0,
          hearts: Math.max(0, state.hearts - 1),
          correctStreak: 0,
          lastWasCorrect: false,
          lastWasBonus: false,
        };
      }
      return { ...state, timeLeft: newTimeLeft };
    }

    // ── Phase auto-advance ───────────────────────────────────────────────────
    case 'ADVANCE_PHASE': {
      switch (state.phase) {
        case 'FEEDBACK_CORRECT':
        case 'FEEDBACK_WRONG':
        case 'FEEDBACK_TIMEOUT':
          return { ...state, phase: 'CUSTOMER_LEAVING' };

        case 'CUSTOMER_LEAVING': {
          const newCount = state.customersThisDay + 1;

          if (state.hearts <= 0) {
            return { ...state, phase: 'GAME_OVER', customersThisDay: newCount };
          }

          if (newCount >= state.customersPerDay) {
            return {
              ...state,
              phase: 'SHOP',
              customersThisDay: newCount,
              currentTransaction: null,
            };
          }

          return nextCustomer({ ...state, customersThisDay: newCount });
        }

        default:
          return state;
      }
    }

    // ── Shop ─────────────────────────────────────────────────────────────────
    case 'BUY_UPGRADE': {
      const upgrade = SHOP_UPGRADES.find((u) => u.id === action.id);
      if (!upgrade) return state;
      if (state.tipCoins < upgrade.cost) return state;

      const newUpgrades = { ...state.upgrades };
      let newMaxHearts = state.maxHearts;

      if (action.id === 'hourglass') {
        if (newUpgrades.hourglass >= upgrade.maxLevel) return state;
        newUpgrades.hourglass += 1;
      } else if (action.id === 'amulet') {
        if (newUpgrades.amulet >= upgrade.maxLevel) return state;
        newUpgrades.amulet += 1;
        newMaxHearts = state.maxHearts + 1;
      } else if (
        action.id === 'forest' ||
        action.id === 'castle' ||
        action.id === 'ghost'
      ) {
        if (newUpgrades.theme === action.id) return state;
        newUpgrades.theme = action.id;
      }

      return {
        ...state,
        tipCoins: state.tipCoins - upgrade.cost,
        upgrades: newUpgrades,
        maxHearts: newMaxHearts,
        hearts: Math.min(state.hearts, newMaxHearts),
      };
    }

    case 'NEXT_DAY': {
      const newDay = state.day + 1;
      return nextCustomer({
        ...state,
        hearts: state.maxHearts, // Restore hearts each new day
        customersThisDay: 0,
        totalDayScore: 0,
        lastWasCorrect: null,
        lastWasBonus: false,
        day: newDay,
      }, newDay);
    }

    // ── Meta ─────────────────────────────────────────────────────────────────
    case 'PAUSE': {
      const pausable: GamePhase[] = [
        'CUSTOMER_ARRIVING',
        'PRESENTING',
        'WAITING_INPUT',
      ];
      if (!pausable.includes(state.phase)) return state;
      return { ...state, phase: 'PAUSED', previousPhase: state.phase };
    }

    case 'RESUME':
      if (state.phase !== 'PAUSED') return state;
      return {
        ...state,
        phase: state.previousPhase || 'WAITING_INPUT',
        previousPhase: null,
        // Reset timer so player isn't punished for pausing
        timeLeft: state.maxTime,
      };

    case 'RESTART':
      return {
        ...createInitialState(),
        highScore: parseInt(
          localStorage.getItem(GAME_CONFIG.highScoreKey) || '0',
          10,
        ),
      };

    default:
      return state;
  }
}
