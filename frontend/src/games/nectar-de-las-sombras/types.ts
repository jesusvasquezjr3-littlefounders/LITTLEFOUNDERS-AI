/* ──────────────────────────────────────────────────────────────
   Néctar de las Sombras – Type definitions
   ────────────────────────────────────────────────────────────── */

export type GamePhase =
  | 'START'
  | 'TUTORIAL'
  | 'RUNNER'
  | 'STAND_PREP'
  | 'MARKET'
  | 'DAY_SUMMARY'
  | 'UPGRADE_SHOP'
  | 'PAUSED'
  | 'GAME_OVER';

export type WeatherType = 'hot' | 'cold';

export type MentorCharacter = 'drRho' | 'zara' | 'liruf' | 'dina';

/* ── Runner phase ─────────────────────────────────────────── */

export interface RunnerCollectible {
  id: string;
  type: 'lemon' | 'sugar';
  x: number;
  y: number;
  width: number;
  height: number;
  collected: boolean;
  // Visual randomness
  rotation: number;      // initial random rotation offset (degrees)
  scale: number;         // random scale factor (0.85-1.15)
  bobOffset: number;     // random phase offset for bobbing animation
  spinSpeed: number;     // rotation speed (higher on later days), 0 = no spin
}

export interface RunnerObstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  // Visual variety
  obstacleType: 'rock' | 'mushroom';
  scale: number;
  rotation: number;      // slight tilt for visual variety
}

/* ── Stand / Recipe ───────────────────────────────────────── */

export interface Recipe {
  lemons: number; // 0-10 slider
  sugar: number;  // 0-10 slider
}

/* ── Market phase ─────────────────────────────────────────── */

export interface Customer {
  id: string;
  x: number;
  satisfied: boolean | null; // null = not yet decided
  bought: boolean;
  animState: 'walking' | 'reacting' | 'leaving';
}

/* ── Upgrades ─────────────────────────────────────────────── */

export type UpgradeKey = 'squeezer' | 'awning' | 'sign' | 'vault';

export interface Upgrade {
  key: UpgradeKey;
  cost: number;
  purchased: boolean;
}

/* ── Mentor Tip ───────────────────────────────────────────── */

export interface MentorTip {
  character: MentorCharacter;
  tipKey: string;
  nameKey: string;
}

/* ── Day Result ───────────────────────────────────────────── */

export interface DayResult {
  totalSales: number;
  ingredientCost: number;
  netProfit: number;
  customersBought: number;
  customersTotal: number;
}

/* ── Main Game State ──────────────────────────────────────── */

export interface GameState {
  phase: GamePhase;
  day: number;
  coins: number;
  totalCoinsEarned: number;
  vaultSavings: number;

  // Runner
  lemonsCollected: number;
  sugarCollected: number;

  // Stand
  weather: WeatherType;
  recipe: Recipe;

  // Market
  customers: Customer[];
  marketDone: boolean;

  // Day summary
  dayResult: DayResult | null;

  // Upgrades
  upgrades: Upgrade[];

  // Mentor
  activeMentorTip: MentorTip | null;

  // Pause
  previousPhase: GamePhase | null;

  // Meta
  highScore: number;
  bestDay: number;
}

/* ── Actions ──────────────────────────────────────────────── */

export type GameAction =
  | { type: 'SHOW_TUTORIAL' }
  | { type: 'START_DAY' }
  | { type: 'FINISH_RUNNER'; lemons: number; sugar: number }
  | { type: 'SET_RECIPE'; recipe: Recipe }
  | { type: 'START_MARKET' }
  | { type: 'UPDATE_CUSTOMERS'; customers: Customer[] }
  | { type: 'FINISH_MARKET'; result: DayResult }
  | { type: 'GO_TO_SHOP' }
  | { type: 'PURCHASE_UPGRADE'; key: UpgradeKey }
  | { type: 'SAVE_TO_VAULT'; amount: number }
  | { type: 'NEXT_DAY' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'SHOW_MENTOR_TIP'; tip: MentorTip }
  | { type: 'DISMISS_MENTOR_TIP' }
  | { type: 'GAME_OVER' }
  | { type: 'RESET' };
