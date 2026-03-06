import type { GameState, GameAction, CoinOption, MiniGameType } from './types';
import {
  ITEMS, REAL_COINS, FAKE_ITEMS, buildDrawerCoins,
  getDayConfig, GAME_CONFIG, shuffle, randomFrom,
} from './constants';

// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────

function getComboMultiplier(comboCount: number): number {
  return Math.min(GAME_CONFIG.maxComboMultiplier, Math.floor(comboCount / GAME_CONFIG.comboThreshold) + 1);
}

function buildPhase1(dayNumber: number, state: GameState): Partial<GameState> {
  const config = getDayConfig(dayNumber);
  const prices = [1, 2, 5, 10] as const;
  const price = randomFrom([...prices]);
  const eligibleItems = ITEMS.filter(i => i.price === price);
  const item = randomFrom(eligibleItems);

  const correctCoin: CoinOption = {
    id: `opt-correct-${Date.now()}`,
    value: price,
    imageKey: REAL_COINS.find(c => c.value === price)!.imageKey,
    isReal: true,
    labelKey: REAL_COINS.find(c => c.value === price)!.labelKey,
  };

  const otherRealCoins = REAL_COINS.filter(c => c.value !== price);
  const fakePool = [...FAKE_ITEMS];

  // Shuffle pools
  const shuffledReal = shuffle(otherRealCoins);
  const shuffledFake = shuffle(fakePool);

  const totalDistractors = config.p1OptionsCount - 1;
  const fakeCount = Math.min(config.p1FakeCount, totalDistractors);
  const realCount = totalDistractors - fakeCount;

  const distractors: CoinOption[] = [];
  for (let i = 0; i < realCount && i < shuffledReal.length; i++) {
    distractors.push({ ...shuffledReal[i], id: `opt-real-${i}-${Date.now()}` });
  }
  for (let i = 0; i < fakeCount && i < shuffledFake.length; i++) {
    distractors.push({ ...shuffledFake[i], id: `opt-fake-${i}-${Date.now()}` });
  }

  const p1Options = shuffle([correctCoin, ...distractors]);

  return {
    miniGameType: 'INSPECTION',
    p1Item: item,
    p1Options,
    p1SelectedId: null,
  };
}

function buildPhase2(dayNumber: number): Partial<GameState> {
  const config = getDayConfig(dayNumber);
  const target = randomFrom(config.p2Targets);
  return {
    miniGameType: 'VAULT',
    p2Target: target,
    p2DrawerCoins: buildDrawerCoins(),
    p2VaultCoins: [],
    p2EjectedId: null,
    p2EjectedTimer: 0,
  };
}

function pickNextMiniGameType(current: MiniGameType): MiniGameType {
  // Alternate with slight randomness: 60% chance to switch
  if (Math.random() < 0.6) {
    return current === 'INSPECTION' ? 'VAULT' : 'INSPECTION';
  }
  return current;
}

function buildNextMiniGame(state: GameState): GameState {
  const newMiniGamesThisDay = state.miniGamesThisDay + 1;
  let newDay = state.dayNumber;
  let newMiniGamesThisDayReset = newMiniGamesThisDay;
  let newMaxTime = state.maxTime;

  if (newMiniGamesThisDay >= GAME_CONFIG.miniGamesPerDay) {
    newDay += 1;
    newMiniGamesThisDayReset = 0;
    const config = getDayConfig(newDay);
    newMaxTime = config.maxTimeMs;
  }

  const nextType = pickNextMiniGameType(state.miniGameType);
  const nextChallenge = nextType === 'INSPECTION'
    ? buildPhase1(newDay, state)
    : buildPhase2(newDay);

  return {
    ...state,
    ...nextChallenge,
    dayNumber: newDay,
    miniGamesThisDay: newMiniGamesThisDayReset,
    totalMiniGames: state.totalMiniGames + 1,
    maxTime: newMaxTime,
    lastFeedback: null,
    feedbackTimer: 0,
    feedbackTimestamp: Date.now(),
  };
}

function handleCorrect(state: GameState, pointsBase: number): GameState {
  const config = getDayConfig(state.dayNumber);
  const newComboCount = state.comboCount + 1;
  const newMultiplier = getComboMultiplier(newComboCount);
  const points = pointsBase * state.dayNumber * newMultiplier;
  const newTotalPoints = state.totalPoints + points;
  const newSessionPoints = state.sessionPoints + points;

  // Persist total points
  try {
    localStorage.setItem(GAME_CONFIG.totalPointsKey, String(newTotalPoints));
  } catch { /* ignore */ }

  return {
    ...state,
    score: state.score + points,
    timeLeft: Math.min(state.maxTime, state.timeLeft + config.timeBonusMs),
    comboCount: newComboCount,
    comboMultiplier: newMultiplier,
    totalPoints: newTotalPoints,
    sessionPoints: newSessionPoints,
    lastFeedback: 'correct',
    feedbackTimer: GAME_CONFIG.feedbackDurationMs,
    feedbackTimestamp: Date.now(),
  };
}

function handleIncorrect(state: GameState): GameState {
  const config = getDayConfig(state.dayNumber);
  return {
    ...state,
    timeLeft: Math.max(0, state.timeLeft - config.timePenaltyMs),
    comboCount: 0,
    comboMultiplier: 1,
    lastFeedback: 'incorrect',
    feedbackTimer: GAME_CONFIG.feedbackDurationMs,
    feedbackTimestamp: Date.now(),
  };
}

function buildGameOver(state: GameState): GameState {
  const newHighScore = Math.max(state.score, state.highScore);
  try {
    localStorage.setItem(GAME_CONFIG.highScoreKey, String(newHighScore));
  } catch { /* ignore */ }
  return {
    ...state,
    phase: 'GAME_OVER',
    timeLeft: 0,
    highScore: newHighScore,
    lastFeedback: null,
  };
}

// ─────────────────────────────────────────────────────
// Initial State
// ─────────────────────────────────────────────────────

export function createInitialState(): GameState {
  const highScore = parseInt(localStorage.getItem(GAME_CONFIG.highScoreKey) ?? '0', 10);
  const totalPoints = parseInt(localStorage.getItem(GAME_CONFIG.totalPointsKey) ?? '0', 10);
  const unlockedRaw = localStorage.getItem(GAME_CONFIG.unlockedCosmeticsKey);
  const unlockedCosmetics: string[] = unlockedRaw ? JSON.parse(unlockedRaw) : [];
  const equippedCosmetic = localStorage.getItem(GAME_CONFIG.equippedCosmeticKey) ?? null;

  const firstConfig = getDayConfig(1);

  return {
    phase: 'START',
    miniGameType: 'INSPECTION',

    timeLeft: firstConfig.maxTimeMs,
    maxTime: firstConfig.maxTimeMs,

    score: 0,
    highScore,

    comboCount: 0,
    comboMultiplier: 1,

    dayNumber: 1,
    miniGamesThisDay: 0,
    totalMiniGames: 0,

    lastFeedback: null,
    feedbackTimer: 0,
    feedbackTimestamp: 0,

    // Phase 1 (populated on game start)
    p1Item: null,
    p1Options: [],
    p1SelectedId: null,

    // Phase 2 (populated on game start)
    p2Target: 0,
    p2DrawerCoins: buildDrawerCoins(),
    p2VaultCoins: [],
    p2EjectedId: null,
    p2EjectedTimer: 0,

    totalPoints,
    sessionPoints: 0,
    unlockedCosmetics,
    equippedCosmetic,
  };
}

// ─────────────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────────────

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {

    // ── Lifecycle ──────────────────────────────────
    case 'SHOW_TUTORIAL':
      return { ...state, phase: 'TUTORIAL' };

    case 'SKIP_TUTORIAL':
    case 'START_GAME': {
      const config = getDayConfig(1);
      const firstChallenge = buildPhase1(1, state);
      return {
        ...state,
        phase: 'PLAYING',
        dayNumber: 1,
        miniGamesThisDay: 0,
        totalMiniGames: 0,
        score: 0,
        sessionPoints: 0,
        comboCount: 0,
        comboMultiplier: 1,
        timeLeft: config.maxTimeMs,
        maxTime: config.maxTimeMs,
        lastFeedback: null,
        feedbackTimer: 0,
        feedbackTimestamp: 0,
        ...firstChallenge,
      };
    }

    case 'PAUSE':
      return state.phase === 'PLAYING' ? { ...state, phase: 'PAUSED' } : state;

    case 'RESUME':
      return state.phase === 'PAUSED' ? { ...state, phase: 'PLAYING' } : state;

    case 'RESTART': {
      const initial = createInitialState();
      return { ...initial, phase: 'START' };
    }

    case 'OPEN_WARDROBE':
      return state.phase === 'GAME_OVER' ? { ...state, phase: 'WARDROBE' } : state;

    case 'CLOSE_WARDROBE':
      return { ...state, phase: 'GAME_OVER' };

    // ── Timer ──────────────────────────────────────
    case 'TICK': {
      if (state.phase !== 'PLAYING') return state;

      let s = { ...state };

      // Handle eject animation timer
      if (s.p2EjectedId !== null) {
        const newEjectTimer = s.p2EjectedTimer - action.deltaMs;
        if (newEjectTimer <= 0) {
          s = { ...s, p2EjectedId: null, p2EjectedTimer: 0 };
        } else {
          s = { ...s, p2EjectedTimer: newEjectTimer };
        }
      }

      // Handle feedback timer
      if (s.lastFeedback !== null) {
        const newFeedTimer = s.feedbackTimer - action.deltaMs;
        if (newFeedTimer <= 0) {
          return buildNextMiniGame(s);
        }
        return { ...s, feedbackTimer: newFeedTimer };
      }

      // Normal timer drain
      const newTime = s.timeLeft - action.deltaMs;
      if (newTime <= 0) {
        return buildGameOver(s);
      }

      return { ...s, timeLeft: newTime };
    }

    // ── Phase 1 ────────────────────────────────────
    case 'P1_SELECT': {
      if (state.phase !== 'PLAYING') return state;
      if (state.miniGameType !== 'INSPECTION') return state;
      if (state.lastFeedback !== null) return state; // already selected
      if (!state.p1Item) return state;

      const selected = state.p1Options.find(o => o.id === action.coinId);
      if (!selected) return state;

      const isCorrect = selected.isReal && selected.value === state.p1Item.price;
      const withSelection = { ...state, p1SelectedId: action.coinId };

      if (isCorrect) {
        const config = getDayConfig(state.dayNumber);
        return handleCorrect(withSelection, config.scoreBase);
      } else {
        return handleIncorrect(withSelection);
      }
    }

    // ── Phase 2 ────────────────────────────────────
    case 'P2_ADD_COIN': {
      if (state.phase !== 'PLAYING') return state;
      if (state.miniGameType !== 'VAULT') return state;
      if (state.lastFeedback !== null) return state; // completing, don't accept more

      const coin = state.p2DrawerCoins.find(c => c.instanceId === action.instanceId);
      if (!coin) return state;

      const currentSum = state.p2VaultCoins.reduce((s, c) => s + c.value, 0);
      const newSum = currentSum + coin.value;

      if (newSum > state.p2Target) {
        // Overshoot — eject with animation
        return {
          ...state,
          p2EjectedId: action.instanceId,
          p2EjectedTimer: GAME_CONFIG.ejectDurationMs,
        };
      }

      const newDrawer = state.p2DrawerCoins.filter(c => c.instanceId !== action.instanceId);
      const newVault = [...state.p2VaultCoins, coin];
      const stateWithMove = { ...state, p2DrawerCoins: newDrawer, p2VaultCoins: newVault };

      if (newSum === state.p2Target) {
        // Exact match — success!
        const config = getDayConfig(state.dayNumber);
        return handleCorrect(stateWithMove, config.scoreBase + 5); // +5 bonus for vault phase
      }

      return stateWithMove;
    }

    case 'P2_REMOVE_COIN': {
      if (state.phase !== 'PLAYING') return state;
      if (state.miniGameType !== 'VAULT') return state;
      if (state.lastFeedback !== null) return state;

      const coin = state.p2VaultCoins.find(c => c.instanceId === action.instanceId);
      if (!coin) return state;

      return {
        ...state,
        p2VaultCoins: state.p2VaultCoins.filter(c => c.instanceId !== action.instanceId),
        p2DrawerCoins: [...state.p2DrawerCoins, coin],
      };
    }

    case 'P2_CLEAR_VAULT': {
      if (state.phase !== 'PLAYING') return state;
      if (state.miniGameType !== 'VAULT') return state;
      if (state.lastFeedback !== null) return state;

      return {
        ...state,
        p2DrawerCoins: [...state.p2DrawerCoins, ...state.p2VaultCoins],
        p2VaultCoins: [],
        p2EjectedId: null,
        p2EjectedTimer: 0,
      };
    }

    // ── Cosmetics ──────────────────────────────────
    case 'UNLOCK_COSMETIC': {
      if (state.unlockedCosmetics.includes(action.cosmeticId)) return state;
      if (state.totalPoints < action.cost) return state; // guard: insufficient points
      const newUnlocked = [...state.unlockedCosmetics, action.cosmeticId];
      const pointsAfterPurchase = state.totalPoints - action.cost;
      try {
        localStorage.setItem(GAME_CONFIG.unlockedCosmeticsKey, JSON.stringify(newUnlocked));
        localStorage.setItem(GAME_CONFIG.totalPointsKey, String(pointsAfterPurchase));
      } catch { /* ignore */ }
      return { ...state, unlockedCosmetics: newUnlocked, totalPoints: pointsAfterPurchase };
    }

    case 'EQUIP_COSMETIC': {
      try {
        localStorage.setItem(GAME_CONFIG.equippedCosmeticKey, action.cosmeticId);
      } catch { /* ignore */ }
      return { ...state, equippedCosmetic: action.cosmeticId };
    }

    case 'UNEQUIP_COSMETIC': {
      try {
        localStorage.removeItem(GAME_CONFIG.equippedCosmeticKey);
      } catch { /* ignore */ }
      return { ...state, equippedCosmetic: null };
    }

    default:
      return state;
  }
}
