// ─────────────────────────────────────────────
// Detective de Papel: Misión Alcancía — Types
// ─────────────────────────────────────────────

export type GamePhase = 'START' | 'TUTORIAL' | 'PLAYING' | 'PAUSED' | 'GAME_OVER' | 'WARDROBE';

export type MiniGameType = 'INSPECTION' | 'VAULT';

// ── Phase 1: Inspection ──────────────────────

/** A real coin denomination or a fake distractor shown as an option */
export interface CoinOption {
  id: string;
  value: number;   // 0 for fakes
  imageKey: string;
  isReal: boolean; // true = real coin, false = fake distractor
  labelKey: string; // i18n key for accessibility label
}

/** An item silhouette displayed as the purchase target */
export interface ItemSilhouette {
  id: string;
  nameKey: string;  // i18n key
  imageKey: string; // key into PICTURES
  price: number;    // must be one of [1, 2, 5, 10]
}

// ── Phase 2: Vault ──────────────────────────

/** A coin instance in the drawer or vault */
export interface DrawerCoin {
  instanceId: string; // unique e.g. "coin1-0"
  value: number;
  imageKey: string;
}

// ── Cosmetics ───────────────────────────────

export type CosmeticType = 'hat' | 'glasses' | 'mustache';

export interface Cosmetic {
  id: string;
  nameKey: string;  // i18n key
  imageKey: string;
  cost: number;
  type: CosmeticType;
}

// ── Game State ──────────────────────────────

export interface GameState {
  phase: GamePhase;
  miniGameType: MiniGameType;

  // Timer (energy fuse)
  timeLeft: number;   // ms
  maxTime: number;    // ms (decreases with day)

  // Score
  score: number;
  highScore: number;

  // Combo
  comboCount: number;      // consecutive correct answers
  comboMultiplier: number; // 1-5x

  // Progress
  dayNumber: number;
  miniGamesThisDay: number;  // 0-4; after 5 => new day
  totalMiniGames: number;

  // Feedback
  lastFeedback: 'correct' | 'incorrect' | null;
  feedbackTimer: number;         // ms remaining for feedback display
  feedbackTimestamp: number;     // for useEffect deps tracking

  // Phase 1 state
  p1Item: ItemSilhouette | null;
  p1Options: CoinOption[];
  p1SelectedId: string | null;

  // Phase 2 state
  p2Target: number;
  p2DrawerCoins: DrawerCoin[];
  p2VaultCoins: DrawerCoin[];
  p2EjectedId: string | null;   // coin being ejected (animation)
  p2EjectedTimer: number;        // ms remaining for eject anim

  // Cosmetics (persisted to localStorage)
  totalPoints: number;    // lifetime points
  sessionPoints: number;  // points this session
  unlockedCosmetics: string[];
  equippedCosmetic: string | null;
}

// ── Actions ─────────────────────────────────

export type GameAction =
  // Lifecycle
  | { type: 'START_GAME' }
  | { type: 'SHOW_TUTORIAL' }
  | { type: 'SKIP_TUTORIAL' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'RESTART' }
  | { type: 'OPEN_WARDROBE' }
  | { type: 'CLOSE_WARDROBE' }
  // Timer
  | { type: 'TICK'; deltaMs: number }
  // Phase 1
  | { type: 'P1_SELECT'; coinId: string }
  // Phase 2
  | { type: 'P2_ADD_COIN'; instanceId: string }
  | { type: 'P2_REMOVE_COIN'; instanceId: string }
  | { type: 'P2_CLEAR_VAULT' }
  // Cosmetics
  | { type: 'UNLOCK_COSMETIC'; cosmeticId: string; cost: number }
  | { type: 'EQUIP_COSMETIC'; cosmeticId: string }
  | { type: 'UNEQUIP_COSMETIC' };
