/* ──────────────────────────────────────────────────────────────
   Néctar de las Sombras – Game State Reducer
   ────────────────────────────────────────────────────────────── */

import type { GameState, GameAction, WeatherType } from './types';
import { GAME_CONFIG, INITIAL_UPGRADES } from './constants';

/* ── Persistence helpers ──────────────────────────────────── */

const loadNumber = (key: string): number => {
  try {
    return parseInt(localStorage.getItem(key) || '0', 10);
  } catch {
    return 0;
  }
};

const saveNumber = (key: string, value: number) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* localStorage unavailable */
  }
};

/* ── Weather generator ────────────────────────────────────── */

export function generateWeather(): WeatherType {
  return Math.random() > 0.5 ? 'hot' : 'cold';
}

/* ── Initial state ────────────────────────────────────────── */

export const createInitialState = (): GameState => ({
  phase: 'START',
  day: 0,
  coins: GAME_CONFIG.startingCoins,
  totalCoinsEarned: 0,
  vaultSavings: 0,

  lemonsCollected: 0,
  sugarCollected: 0,

  weather: generateWeather(),
  recipe: { lemons: 5, sugar: 5 },

  customers: [],
  marketDone: false,

  dayResult: null,

  upgrades: INITIAL_UPGRADES.map((u) => ({ ...u })),

  activeMentorTip: null,

  previousPhase: null,

  highScore: loadNumber(GAME_CONFIG.highScoreKey),
  bestDay: loadNumber(GAME_CONFIG.bestDayKey),
});

/* ── Reducer ──────────────────────────────────────────────── */

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SHOW_TUTORIAL':
      return { ...state, phase: 'TUTORIAL' };

    case 'START_DAY': {
      const newDay = state.day + 1;
      const newWeather = generateWeather();
      return {
        ...state,
        phase: 'RUNNER',
        day: newDay,
        weather: newWeather,
        lemonsCollected: 0,
        sugarCollected: 0,
        recipe: { lemons: 5, sugar: 5 },
        customers: [],
        marketDone: false,
        dayResult: null,
        activeMentorTip: null,
      };
    }

    case 'FINISH_RUNNER':
      return {
        ...state,
        phase: 'STAND_PREP',
        lemonsCollected: action.lemons,
        sugarCollected: action.sugar,
      };

    case 'SET_RECIPE':
      return {
        ...state,
        recipe: {
          lemons: Math.min(action.recipe.lemons, state.lemonsCollected),
          sugar: Math.min(action.recipe.sugar, state.sugarCollected),
        },
      };

    case 'START_MARKET':
      return {
        ...state,
        phase: 'MARKET',
        marketDone: false,
        customers: [],
      };

    case 'UPDATE_CUSTOMERS':
      return {
        ...state,
        customers: action.customers,
      };

    case 'FINISH_MARKET': {
      let newCoins = state.coins + action.result.netProfit;
      let newVault = state.vaultSavings;
      const newTotal = state.totalCoinsEarned + Math.max(0, action.result.netProfit);

      // If coins go negative and vault has savings, draw from vault to cover deficit
      if (newCoins < 0 && newVault > 0) {
        const deficit = Math.abs(newCoins);
        const withdrawal = Math.min(deficit, newVault);
        newCoins += withdrawal;
        newVault -= withdrawal;
      }

      const isGameOver = newCoins < 0;

      const newHighScore = Math.max(state.highScore, newTotal);
      const newBestDay = Math.max(state.bestDay, state.day);

      if (newHighScore > state.highScore) {
        saveNumber(GAME_CONFIG.highScoreKey, newHighScore);
      }
      if (newBestDay > state.bestDay) {
        saveNumber(GAME_CONFIG.bestDayKey, newBestDay);
      }

      return {
        ...state,
        phase: isGameOver ? 'GAME_OVER' : 'DAY_SUMMARY',
        coins: Math.max(0, newCoins),
        vaultSavings: newVault,
        totalCoinsEarned: newTotal,
        dayResult: action.result,
        marketDone: true,
        highScore: newHighScore,
        bestDay: newBestDay,
      };
    }

    case 'GO_TO_SHOP':
      return { ...state, phase: 'UPGRADE_SHOP' };

    case 'PURCHASE_UPGRADE': {
      const upgrade = state.upgrades.find((u) => u.key === action.key);
      if (!upgrade || upgrade.purchased || state.coins < upgrade.cost) return state;

      return {
        ...state,
        coins: state.coins - upgrade.cost,
        upgrades: state.upgrades.map((u) =>
          u.key === action.key ? { ...u, purchased: true } : u
        ),
      };
    }

    case 'SAVE_TO_VAULT': {
      const amount = Math.min(action.amount, state.coins);
      if (amount <= 0) return state;
      const hasVault = state.upgrades.find((u) => u.key === 'vault')?.purchased;
      if (!hasVault) return state;

      return {
        ...state,
        coins: state.coins - amount,
        vaultSavings: state.vaultSavings + amount,
      };
    }

    case 'NEXT_DAY':
      return {
        ...state,
        phase: 'RUNNER',
        day: state.day + 1,
        weather: generateWeather(),
        lemonsCollected: 0,
        sugarCollected: 0,
        recipe: { lemons: 5, sugar: 5 },
        customers: [],
        marketDone: false,
        dayResult: null,
        activeMentorTip: null,
      };

    case 'PAUSE':
      return { ...state, phase: 'PAUSED', previousPhase: state.phase };

    case 'RESUME':
      return { ...state, phase: state.previousPhase || 'STAND_PREP', previousPhase: null };

    case 'SHOW_MENTOR_TIP':
      return { ...state, activeMentorTip: action.tip };

    case 'DISMISS_MENTOR_TIP':
      return { ...state, activeMentorTip: null };

    case 'GAME_OVER': {
      const finalHighScore = Math.max(state.highScore, state.totalCoinsEarned);
      const finalBestDay = Math.max(state.bestDay, state.day);
      saveNumber(GAME_CONFIG.highScoreKey, finalHighScore);
      saveNumber(GAME_CONFIG.bestDayKey, finalBestDay);
      return {
        ...state,
        phase: 'GAME_OVER',
        highScore: finalHighScore,
        bestDay: finalBestDay,
      };
    }

    case 'RESET':
      return {
        ...createInitialState(),
        highScore: Math.max(state.highScore, state.totalCoinsEarned),
        bestDay: Math.max(state.bestDay, state.day),
      };

    default:
      return state;
  }
}
