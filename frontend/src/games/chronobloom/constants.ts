import type { PlantType, EnemyType, YearWave } from './types';

// ─── Asset Base URL ───────────────────────────────────────────────────────────
const ASSET_BASE = 'https://xxpsyormxalqjcbomiwe.supabase.co/storage/v1/object/public/game-assets/8-chronobloom';

export const AUDIO = {
  bgm:         `${ASSET_BASE}/audio/bgm.mp3`,
  bgmBoss:     `${ASSET_BASE}/audio/bgm-boss.mp3`,
  bgmVictory:  `${ASSET_BASE}/audio/bgm-victory.mp3`,
  plantPlace:  `${ASSET_BASE}/audio/plant-place.mp3`,
  plantLevelUp:`${ASSET_BASE}/audio/plant-level-up.mp3`,
  plantSell:   `${ASSET_BASE}/audio/plant-sell.mp3`,
  coinCollect: `${ASSET_BASE}/audio/coin-collect.mp3`,
  coinShoot:   `${ASSET_BASE}/audio/coin-shoot.mp3`,
  enemyKill:   `${ASSET_BASE}/audio/enemy-kill.mp3`,
  enemyHit:    `${ASSET_BASE}/audio/enemy-hit.mp3`,
  greenhouseHit:`${ASSET_BASE}/audio/greenhouse-hit.mp3`,
  yearAdvance: `${ASSET_BASE}/audio/year-advance.mp3`,
  interestEarn:`${ASSET_BASE}/audio/interest-earn.mp3`,
  bearMarket:  `${ASSET_BASE}/audio/bear-market.mp3`,
  gameOver:    `${ASSET_BASE}/audio/game-over.mp3`,
  victory:     `${ASSET_BASE}/audio/victory.mp3`,
};

export const PICTURES = {
  background: `${ASSET_BASE}/pictures/bg-garden.png`,
  greenhouse: `${ASSET_BASE}/pictures/greenhouse.png`,
};

// ─── Canvas Layout ────────────────────────────────────────────────────────────
export const CANVAS_W   = 900;
export const CANVAS_H   = 540;
export const HUD_H      = 65;
export const TOOLBAR_H  = 80;
export const MAP_Y      = HUD_H;
export const MAP_H      = CANVAS_H - HUD_H - TOOLBAR_H; // 395
export const GREENHOUSE_W = 90;
export const GRID_COLS  = 9;
export const GRID_ROWS  = 5;
export const CELL_W     = (CANVAS_W - GREENHOUSE_W) / GRID_COLS; // 90
export const CELL_H     = MAP_H / GRID_ROWS; // 79

export function getCellCenter(col: number, row: number): { cx: number; cy: number } {
  return {
    cx: GREENHOUSE_W + col * CELL_W + CELL_W / 2,
    cy: MAP_Y + row * CELL_H + CELL_H / 2,
  };
}

export function canvasToGrid(cx: number, cy: number): { col: number; row: number } | null {
  if (cy < MAP_Y || cy > MAP_Y + MAP_H) return null;
  if (cx < GREENHOUSE_W || cx > CANVAS_W) return null;
  const col = Math.floor((cx - GREENHOUSE_W) / CELL_W);
  const row = Math.floor((cy - MAP_Y) / CELL_H);
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null;
  return { col, row };
}

// ─── Plant Definitions ────────────────────────────────────────────────────────
export const PLANT_DEFS: Record<PlantType, {
  cost: number;
  hp: number;
  damage: number;
  range: number;
  attackCooldownMax: number;
  interestRate: number;
  emoji: string;
  color: string;
  glowColor: string;
  radius: number;
}> = {
  savings_sprout: {
    cost: 100,
    hp: 140,
    damage: 28,
    range: 230,
    attackCooldownMax: 18,
    interestRate: 0.03,
    emoji: '🌱',
    color: '#4ade80',
    glowColor: '#22c55e',
    radius: 28,
  },
  stock_tree: {
    cost: 150,
    hp: 45,
    damage: 0,
    range: 0,
    attackCooldownMax: 9999,
    interestRate: 0.12,
    emoji: '🌳',
    color: '#a78bfa',
    glowColor: '#7c3aed',
    radius: 34,
  },
  div_vine: {
    cost: 120,
    hp: 90,
    damage: 0,
    range: 0,
    attackCooldownMax: 9999,
    interestRate: 0.05,
    emoji: '🌿',
    color: '#34d399',
    glowColor: '#10b981',
    radius: 26,
  },
  emergency_cactus: {
    cost: 75,
    hp: 160,
    damage: 90,
    range: 140,  // AoE radius
    attackCooldownMax: 9999,
    interestRate: 0,
    emoji: '🌵',
    color: '#fb923c',
    glowColor: '#ea580c',
    radius: 30,
  },
};

// ─── Enemy Definitions ────────────────────────────────────────────────────────
export const ENEMY_DEFS: Record<EnemyType, {
  hp: number;
  speed: number;
  reward: number;
  capitalSteal: number;
  attackDamage: number;
  attackCooldownMax: number;
  emoji: string;
  color: string;
  size: number;
  isAerial: boolean;
  passThroughPlants: boolean;
}> = {
  ant_expense: {
    hp: 35,
    speed: 2.8,
    reward: 12,
    capitalSteal: 60,
    attackDamage: 0,
    attackCooldownMax: 999,
    emoji: '🐜',
    color: '#78350f',
    size: 24,
    isAerial: false,
    passThroughPlants: true,  // ants walk through plants
  },
  impulsive_beast: {
    hp: 130,
    speed: 1.6,
    reward: 38,
    capitalSteal: 180,
    attackDamage: 18,
    attackCooldownMax: 22,
    emoji: '👹',
    color: '#ef4444',
    size: 42,
    isAerial: false,
    passThroughPlants: false,
  },
  inflation_zeppelin: {
    hp: 320,
    speed: 0.9,
    reward: 90,
    capitalSteal: 320,
    attackDamage: 10,
    attackCooldownMax: 38,
    emoji: '🎈',
    color: '#f59e0b',
    size: 52,
    isAerial: true,
    passThroughPlants: false,
  },
  deficit_king: {
    hp: 900,
    speed: 0.55,
    reward: 220,
    capitalSteal: 550,
    attackDamage: 35,
    attackCooldownMax: 18,
    emoji: '👑',
    color: '#7c3aed',
    size: 60,
    isAerial: false,
    passThroughPlants: false,
  },
};

// ─── Year Waves (3 levels × 5 years) ──────────────────────────────────────────
export const LEVEL_WAVES: YearWave[][] = [
  // ── Level 1: El Huerto Inicial ─────────────────────────────────────────────
  [
    {
      interYearDelayTicks: 300,
      spawns: [
        { type: 'ant_expense', row: 1, delayTicks: 0 },
        { type: 'ant_expense', row: 3, delayTicks: 50 },
        { type: 'ant_expense', row: 2, delayTicks: 100 },
      ],
    },
    {
      interYearDelayTicks: 260,
      spawns: [
        { type: 'ant_expense', row: 0, delayTicks: 0 },
        { type: 'ant_expense', row: 2, delayTicks: 30 },
        { type: 'impulsive_beast', row: 1, delayTicks: 70 },
        { type: 'ant_expense', row: 4, delayTicks: 100 },
      ],
    },
    {
      interYearDelayTicks: 250,
      spawns: [
        { type: 'ant_expense', row: 0, delayTicks: 0 },
        { type: 'ant_expense', row: 4, delayTicks: 0 },
        { type: 'impulsive_beast', row: 1, delayTicks: 50 },
        { type: 'impulsive_beast', row: 3, delayTicks: 80 },
        { type: 'ant_expense', row: 2, delayTicks: 120 },
      ],
    },
    {
      interYearDelayTicks: 220,
      spawns: [
        { type: 'impulsive_beast', row: 0, delayTicks: 0 },
        { type: 'ant_expense', row: 1, delayTicks: 20 },
        { type: 'ant_expense', row: 3, delayTicks: 20 },
        { type: 'impulsive_beast', row: 2, delayTicks: 55 },
        { type: 'ant_expense', row: 4, delayTicks: 80 },
        { type: 'impulsive_beast', row: 4, delayTicks: 130 },
      ],
    },
    {
      interYearDelayTicks: 0,
      spawns: [
        { type: 'ant_expense', row: 0, delayTicks: 0 },
        { type: 'ant_expense', row: 4, delayTicks: 0 },
        { type: 'impulsive_beast', row: 1, delayTicks: 40 },
        { type: 'impulsive_beast', row: 3, delayTicks: 40 },
        { type: 'inflation_zeppelin', row: 2, delayTicks: 90 },
        { type: 'ant_expense', row: 0, delayTicks: 160 },
        { type: 'ant_expense', row: 4, delayTicks: 160 },
        { type: 'impulsive_beast', row: 2, delayTicks: 200 },
      ],
    },
  ],
  // ── Level 2: El Mercado en Crisis ──────────────────────────────────────────
  [
    {
      interYearDelayTicks: 270,
      spawns: [
        { type: 'ant_expense', row: 0, delayTicks: 0 },
        { type: 'ant_expense', row: 2, delayTicks: 25 },
        { type: 'impulsive_beast', row: 1, delayTicks: 45 },
        { type: 'inflation_zeppelin', row: 3, delayTicks: 90 },
        { type: 'ant_expense', row: 4, delayTicks: 130 },
      ],
    },
    {
      interYearDelayTicks: 250,
      spawns: [
        { type: 'inflation_zeppelin', row: 1, delayTicks: 0 },
        { type: 'ant_expense', row: 0, delayTicks: 30 },
        { type: 'ant_expense', row: 4, delayTicks: 30 },
        { type: 'impulsive_beast', row: 2, delayTicks: 70 },
        { type: 'impulsive_beast', row: 3, delayTicks: 100 },
        { type: 'ant_expense', row: 1, delayTicks: 140 },
      ],
    },
    {
      interYearDelayTicks: 240,
      spawns: [
        { type: 'impulsive_beast', row: 0, delayTicks: 0 },
        { type: 'inflation_zeppelin', row: 2, delayTicks: 25 },
        { type: 'impulsive_beast', row: 4, delayTicks: 45 },
        { type: 'ant_expense', row: 1, delayTicks: 70 },
        { type: 'ant_expense', row: 3, delayTicks: 70 },
        { type: 'impulsive_beast', row: 2, delayTicks: 120 },
        { type: 'ant_expense', row: 0, delayTicks: 160 },
        { type: 'ant_expense', row: 4, delayTicks: 160 },
      ],
    },
    {
      interYearDelayTicks: 220,
      spawns: [
        { type: 'inflation_zeppelin', row: 0, delayTicks: 0 },
        { type: 'inflation_zeppelin', row: 4, delayTicks: 0 },
        { type: 'impulsive_beast', row: 1, delayTicks: 60 },
        { type: 'impulsive_beast', row: 3, delayTicks: 60 },
        { type: 'ant_expense', row: 2, delayTicks: 100 },
        { type: 'ant_expense', row: 0, delayTicks: 130 },
        { type: 'ant_expense', row: 4, delayTicks: 130 },
        { type: 'impulsive_beast', row: 2, delayTicks: 170 },
      ],
    },
    {
      interYearDelayTicks: 0,
      spawns: [
        { type: 'ant_expense', row: 0, delayTicks: 0 },
        { type: 'ant_expense', row: 4, delayTicks: 0 },
        { type: 'impulsive_beast', row: 2, delayTicks: 35 },
        { type: 'inflation_zeppelin', row: 1, delayTicks: 70 },
        { type: 'inflation_zeppelin', row: 3, delayTicks: 70 },
        { type: 'deficit_king', row: 2, delayTicks: 180 },
        { type: 'ant_expense', row: 0, delayTicks: 210 },
        { type: 'ant_expense', row: 4, delayTicks: 210 },
      ],
    },
  ],
  // ── Level 3: El Gran Déficit ───────────────────────────────────────────────
  [
    {
      interYearDelayTicks: 260,
      spawns: [
        { type: 'impulsive_beast', row: 0, delayTicks: 0 },
        { type: 'impulsive_beast', row: 4, delayTicks: 0 },
        { type: 'inflation_zeppelin', row: 2, delayTicks: 40 },
        { type: 'ant_expense', row: 1, delayTicks: 70 },
        { type: 'ant_expense', row: 3, delayTicks: 70 },
        { type: 'deficit_king', row: 2, delayTicks: 140 },
      ],
    },
    {
      interYearDelayTicks: 240,
      spawns: [
        { type: 'deficit_king', row: 1, delayTicks: 0 },
        { type: 'inflation_zeppelin', row: 0, delayTicks: 30 },
        { type: 'inflation_zeppelin', row: 4, delayTicks: 30 },
        { type: 'impulsive_beast', row: 2, delayTicks: 70 },
        { type: 'ant_expense', row: 1, delayTicks: 110 },
        { type: 'ant_expense', row: 3, delayTicks: 110 },
        { type: 'deficit_king', row: 3, delayTicks: 200 },
      ],
    },
    {
      interYearDelayTicks: 220,
      spawns: [
        { type: 'inflation_zeppelin', row: 0, delayTicks: 0 },
        { type: 'inflation_zeppelin', row: 4, delayTicks: 0 },
        { type: 'deficit_king', row: 2, delayTicks: 45 },
        { type: 'impulsive_beast', row: 1, delayTicks: 80 },
        { type: 'impulsive_beast', row: 3, delayTicks: 80 },
        { type: 'ant_expense', row: 0, delayTicks: 130 },
        { type: 'ant_expense', row: 4, delayTicks: 130 },
        { type: 'deficit_king', row: 1, delayTicks: 210 },
        { type: 'deficit_king', row: 3, delayTicks: 210 },
      ],
    },
    {
      interYearDelayTicks: 200,
      spawns: [
        { type: 'deficit_king', row: 0, delayTicks: 0 },
        { type: 'deficit_king', row: 4, delayTicks: 0 },
        { type: 'inflation_zeppelin', row: 2, delayTicks: 50 },
        { type: 'impulsive_beast', row: 1, delayTicks: 90 },
        { type: 'impulsive_beast', row: 3, delayTicks: 90 },
        { type: 'ant_expense', row: 0, delayTicks: 130 },
        { type: 'ant_expense', row: 4, delayTicks: 130 },
        { type: 'deficit_king', row: 2, delayTicks: 210 },
      ],
    },
    {
      interYearDelayTicks: 0,
      spawns: [
        { type: 'deficit_king', row: 0, delayTicks: 0 },
        { type: 'deficit_king', row: 2, delayTicks: 0 },
        { type: 'deficit_king', row: 4, delayTicks: 0 },
        { type: 'inflation_zeppelin', row: 1, delayTicks: 70 },
        { type: 'inflation_zeppelin', row: 3, delayTicks: 70 },
        { type: 'impulsive_beast', row: 0, delayTicks: 150 },
        { type: 'impulsive_beast', row: 2, delayTicks: 150 },
        { type: 'impulsive_beast', row: 4, delayTicks: 150 },
        { type: 'deficit_king', row: 1, delayTicks: 260 },
        { type: 'deficit_king', row: 3, delayTicks: 260 },
      ],
    },
  ],
];

// ─── Game Config ──────────────────────────────────────────────────────────────
export const GAME_CONFIG = {
  initialCapital: 500,
  initialGreenhouseHp: 1500,
  tickMs: 50,
  maxLevel: 3,
  maxYear: 5,
  highScoreKey: 'chronobloom_highscore',

  capitalDropLife: 130,
  capitalDropValue: 25,
  capitalDropInterval: 220,    // ticks between natural drops from plants

  bearMarketChanceL1: 0,
  bearMarketChanceL2: 0.35,
  bearMarketChanceL3: 0.45,
  bearMarketLoss: 0.20,

  inflationPerZeppelin: 0.05,

  ponziCapitalCost: 200,
  unfreezeMinCost: 50,

  vineBonusInterest: 0.20,     // 20% boost to adjacent plants
  vineShieldHp: 35,

  levelBonusCapital: 100,      // bonus when moving to next level
  earthyBrownColor: '#3d2b1f',
};

// ─── Enemy HP scaling per level/year ─────────────────────────────────────────
export function getEnemyHpMultiplier(level: number, year: number): number {
  return 1 + (level - 1) * 0.35 + (year - 1) * 0.12;
}
