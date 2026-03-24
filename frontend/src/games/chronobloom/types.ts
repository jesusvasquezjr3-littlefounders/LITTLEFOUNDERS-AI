// ─── Game Phases ────────────────────────────────────────────────────────────
export type GamePhase =
  | 'START'
  | 'TUTORIAL'
  | 'PLANNING'
  | 'PLAYING'
  | 'YEAR_RESULT'
  | 'LEVEL_COMPLETE'
  | 'VICTORY'
  | 'GAME_OVER'
  | 'PAUSED';

// ─── Plant Types ─────────────────────────────────────────────────────────────
export type PlantType =
  | 'savings_sprout'
  | 'stock_tree'
  | 'div_vine'
  | 'emergency_cactus';

// ─── Enemy Types ─────────────────────────────────────────────────────────────
export type EnemyType =
  | 'ant_expense'
  | 'impulsive_beast'
  | 'inflation_zeppelin'
  | 'deficit_king';

// ─── Plant ───────────────────────────────────────────────────────────────────
export interface Plant {
  id: string;
  type: PlantType;
  col: number;        // 0-8
  row: number;        // 0-4
  hp: number;
  maxHp: number;
  capitalValue: number;   // current value with accumulated interest
  baseCapital: number;    // original cost
  yearsAlive: number;
  isGolden: boolean;      // HODL 10 years easter egg

  damage: number;
  range: number;          // px
  attackCooldown: number;
  attackCooldownMax: number;

  interestRate: number;
  shieldHp: number;       // div_vine provides shield to adjacent plants
  frozenTicks: number;    // hypnotized by impulsive_beast
  hitFlash: number;
  levelUpFlash: number;   // golden glow after interest
}

// ─── Enemy ───────────────────────────────────────────────────────────────────
export interface Enemy {
  id: string;
  type: EnemyType;
  hp: number;
  maxHp: number;
  speed: number;          // px per tick (moves LEFT)
  x: number;
  y: number;
  row: number;

  reward: number;
  capitalSteal: number;

  targetPlantId: string | null;
  attackDamage: number;
  attackCooldown: number;
  attackCooldownMax: number;

  hitFlash: number;
  isAerial: boolean;
  frozenTicks: number;
  wobble: number;         // animation phase offset
}

// ─── Projectile ──────────────────────────────────────────────────────────────
export interface Projectile {
  id: string;
  plantId: string;
  targetId: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  damage: number;
  type: PlantType;
  speed: number;
  isAoe: boolean;
  aoeRadius: number;
}

// ─── Particle ────────────────────────────────────────────────────────────────
export interface Particle {
  id: string;
  x: number;
  y: number;
  emoji: string;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  scale: number;
  color?: string;
  spin?: number;
  spinSpeed?: number;
}

// ─── Capital Drop (collectible fruit/coin on the ground) ──────────────────────
export interface CapitalDrop {
  id: string;
  x: number;
  y: number;
  value: number;
  life: number;   // ticks before disappear
  spin: number;   // animation angle for "barrel roll" easter egg
}

// ─── Floating Number ─────────────────────────────────────────────────────────
export interface FloatingNumber {
  id: string;
  x: number;
  y: number;
  value: string;
  color: string;
  life: number;
  maxLife: number;
}

// ─── Year Stats ──────────────────────────────────────────────────────────────
export interface YearStats {
  year: number;
  level: number;
  capitalStart: number;
  capitalEnd: number;
  interestEarned: number;
  plantsLost: number;
  enemiesDefeated: number;
  capitalStolenByEnemies: number;
  bearMarketHit: boolean;
  ponziDeclined: boolean;
}

// ─── Year Result Data ─────────────────────────────────────────────────────────
export interface YearResultData {
  interestBreakdown: Array<{
    plantId: string;
    plantType: PlantType;
    oldValue: number;
    newValue: number;
    interestEarned: number;
    bearMarket: boolean;
    disappeared: boolean;
    isGolden: boolean;
  }>;
  totalInterestEarned: number;
  bearMarketOccurred: boolean;
  capitalAfter: number;
  capitalBefore: number;
}

// ─── Enemy Spawn ─────────────────────────────────────────────────────────────
export interface EnemySpawn {
  type: EnemyType;
  row: number;
  delayTicks: number;
}

// ─── Year Wave Definition ─────────────────────────────────────────────────────
export interface YearWave {
  spawns: EnemySpawn[];
  interYearDelayTicks: number;
}

// ─── Game State ──────────────────────────────────────────────────────────────
export interface GameState {
  phase: GamePhase;
  level: number;
  year: number;

  capital: number;
  greenhouseHp: number;
  maxGreenhouseHp: number;

  plants: Plant[];
  enemies: Enemy[];
  projectiles: Projectile[];
  particles: Particle[];
  capitalDrops: CapitalDrop[];
  floatingNumbers: FloatingNumber[];

  selectedPlantType: PlantType | null;
  selectedPlantId: string | null;

  inflationMultiplier: number;

  ponziVisible: boolean;
  ponziDeclined: boolean;

  waveActive: boolean;
  spawnQueue: EnemySpawn[];
  spawnTimer: number;

  score: number;
  highScore: number;

  yearStats: YearStats;
  allStats: YearStats[][];

  tutorialStep: number;
  tickCount: number;

  previousPhase: GamePhase | null;
  gameOverReason: 'greenhouse' | null;

  yearResultData: YearResultData | null;
  liquidatedEarly: number;   // count of plants liquidated before maturity
  plantsMatureHarvested: number; // plants held to 5+ years
}

// ─── Game Actions ─────────────────────────────────────────────────────────────
export type GameAction =
  | { type: 'START_GAME' }
  | { type: 'TUTORIAL_NEXT' }
  | { type: 'SKIP_TUTORIAL' }
  | { type: 'SELECT_PLANT_TYPE'; plantType: PlantType | null }
  | { type: 'PLACE_PLANT'; col: number; row: number }
  | { type: 'SELECT_PLANT'; plantId: string | null }
  | { type: 'LIQUIDATE_PLANT'; plantId: string }
  | { type: 'ADVANCE_YEAR' }
  | { type: 'COLLECT_DROP'; dropId: string }
  | { type: 'UNFREEZE_PLANT'; plantId: string }
  | { type: 'DECLINE_PONZI' }
  | { type: 'ACCEPT_PONZI' }
  | { type: 'ACKNOWLEDGE_YEAR_RESULT' }
  | { type: 'NEXT_LEVEL' }
  | { type: 'TICK' }
  | { type: 'RESTART' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' };
