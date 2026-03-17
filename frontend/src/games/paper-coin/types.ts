export type GamePhase =
  | 'START'
  | 'TUTORIAL'
  | 'CUSTOMER_ARRIVING'
  | 'PRESENTING'
  | 'WAITING_INPUT'
  | 'FEEDBACK_CORRECT'
  | 'FEEDBACK_WRONG'
  | 'FEEDBACK_TIMEOUT'
  | 'CUSTOMER_LEAVING'
  | 'SHOP'
  | 'PAUSED'
  | 'GAME_OVER';

export type ThemeType = 'default' | 'forest' | 'castle' | 'ghost';

export interface ItemDef {
  key: string;
  emoji: string;
  imageUrl: string;
  price: number;
  tier: 1 | 2 | 4;
}

export interface CustomerDef {
  key: string;
  emoji: string;
  imageUrl: string;
  nameKey: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
}

export interface Transaction {
  items: ItemDef[];
  totalPrice: number;
  payment: number;
  correctChange: number;
  customer: CustomerDef;
}

export interface GameUpgrades {
  hourglass: number; // 0–3, each adds +2s
  amulet: number;    // 0–2, each adds +1 max heart
  theme: ThemeType;
}

export interface GameState {
  phase: GamePhase;
  day: number;
  hearts: number;
  maxHearts: number;
  score: number;
  tipCoins: number;
  highScore: number;

  currentTransaction: Transaction | null;

  customersThisDay: number;
  customersPerDay: number;
  correctStreak: number;
  maxStreak: number;

  playerInput: string;
  timeLeft: number; // ticks (1 tick = 100ms)
  maxTime: number;

  upgrades: GameUpgrades;
  tutorialStep: number;

  lastWasCorrect: boolean | null;
  lastWasBonus: boolean;
  totalDayScore: number;
  previousPhase: GamePhase | null;
}

export type UpgradeId = 'hourglass' | 'amulet' | 'forest' | 'castle' | 'ghost';

export type GameAction =
  | { type: 'GO_TO_TUTORIAL' }
  | { type: 'TUTORIAL_NEXT' }
  | { type: 'TUTORIAL_SKIP' }
  | { type: 'START_PLAYING' }
  | { type: 'BEGIN_PRESENTING' }
  | { type: 'BEGIN_WAITING' }
  | { type: 'KEY_PRESS'; key: string }
  | { type: 'KEY_BACKSPACE' }
  | { type: 'SUBMIT_ANSWER' }
  | { type: 'TIMER_TICK' }
  | { type: 'ADVANCE_PHASE' }
  | { type: 'BUY_UPGRADE'; id: UpgradeId }
  | { type: 'NEXT_DAY' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'RESTART' };
