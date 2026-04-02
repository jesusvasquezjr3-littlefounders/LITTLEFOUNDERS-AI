/* ──────────────────────────────────────────────────────────────
   Néctar de las Sombras – Constants & Configuration
   ────────────────────────────────────────────────────────────── */

import type { Upgrade, MentorTip } from './types';

const BASE = '1-the-small-entrepreneur';

/* ── Audio assets ─────────────────────────────────────────── */
export const AUDIO = {
  bgm: `${BASE}/audio/bgm-ambient.mp3`,
  coinCollect: `${BASE}/audio/coin-collect.mp3`,
  sell: `${BASE}/audio/sell.mp3`,
  customerHappy: `${BASE}/audio/customer-happy.mp3`,
  customerSad: `${BASE}/audio/customer-sad.mp3`,
  jump: `${BASE}/audio/jump.mp3`,
  hit: `${BASE}/audio/hit.mp3`,
  dayEnd: `${BASE}/audio/day-end.mp3`,
  upgrade: `${BASE}/audio/upgrade.mp3`,
  gameOver: `${BASE}/audio/game-over.mp3`,
  mentorPop: `${BASE}/audio/mentor-pop.mp3`,
};

/* ── Picture assets ───────────────────────────────────────── */
export const PICTURES = {
  // Characters
  liruf: `${BASE}/pictures/liruf.png`,
  lirufRun1: `${BASE}/pictures/liruf-run1.png`,
  lirufRun2: `${BASE}/pictures/liruf-run2.png`,
  lirufJump: `${BASE}/pictures/liruf-jump.png`,
  dina: `${BASE}/pictures/dina.png`,
  drRho: `${BASE}/pictures/dr-rho.png`,
  zara: `${BASE}/pictures/zara.png`,

  // Stand
  stand: `${BASE}/pictures/stand.png`,
  standWithAwning: `${BASE}/pictures/stand-awning.png`,
  standWithSign: `${BASE}/pictures/stand-sign.png`,

  // Ingredients
  lemon: `${BASE}/pictures/lemon.png`,
  sugar: `${BASE}/pictures/sugar.png`,

  // Customers
  customerHappy: `${BASE}/pictures/customer-happy.png`,
  customerSad: `${BASE}/pictures/customer-sad.png`,
  customerWalk: `${BASE}/pictures/customer-walk.png`,

  // Backgrounds
  bgRunner: `${BASE}/pictures/bg-runner.png`,
  bgStandHot: `${BASE}/pictures/bg-stand-hot.png`,
  bgStandCold: `${BASE}/pictures/bg-stand-cold.png`,

  // Obstacles
  rock: `${BASE}/pictures/rock.png`,
  mushroom: `${BASE}/pictures/mushroom.png`,

  // UI
  logo: `${BASE}/pictures/logo.png`,
  coin: `${BASE}/pictures/coin.png`,
  vault: `${BASE}/pictures/vault.png`,
};

/* ── Game configuration ───────────────────────────────────── */
export const GAME_CONFIG = {
  // Runner (physics constants are defined locally in RunnerPhase.tsx)
  runnerDurationMs: 54000,          // 54 s per day (tripled from 18 s)
  runnerSpeedBase: 3.5,
  runnerGroundY: 75,                // percent from top
  collectibleSpawnIntervalMs: 800,  // slightly more frequent spawns
  obstacleSpawnIntervalMs: 2500,    // Base obstacle spawn interval

  // Stand
  ingredientCostPerUnit: 2,
  pricePerCup: 5,

  // Market (speed constants are defined locally in MarketPhase.tsx)
  baseCustomerCount: 6,
  customerSpawnIntervalMs: 600,

  // Economy
  startingCoins: 20,

  // Upgrades base costs
  upgradeCosts: {
    squeezer: 30,
    awning: 50,
    sign: 40,
    vault: 25,
  } as Record<string, number>,

  // Difficulty scaling per day
  difficultyScaleSpeed: 0.15,
  difficultyScaleCustomers: 1,

  // Persistence
  highScoreKey: 'nectar_sombras_highscore',
  bestDayKey: 'nectar_sombras_bestday',
};

/* ── Initial upgrades ─────────────────────────────────────── */
export const INITIAL_UPGRADES: Upgrade[] = [
  { key: 'squeezer', cost: GAME_CONFIG.upgradeCosts.squeezer, purchased: false },
  { key: 'awning', cost: GAME_CONFIG.upgradeCosts.awning, purchased: false },
  { key: 'sign', cost: GAME_CONFIG.upgradeCosts.sign, purchased: false },
  { key: 'vault', cost: GAME_CONFIG.upgradeCosts.vault, purchased: false },
];

/* ── Weather logic helpers ────────────────────────────────── */
export function getIdealRecipe(weather: 'hot' | 'cold'): { lemons: number; sugar: number } {
  if (weather === 'hot') return { lemons: 8, sugar: 3 };
  return { lemons: 3, sugar: 8 };
}

export function calculateSatisfaction(
  recipe: { lemons: number; sugar: number },
  weather: 'hot' | 'cold'
): number {
  const ideal = getIdealRecipe(weather);
  const lemonDiff = Math.abs(recipe.lemons - ideal.lemons);
  const sugarDiff = Math.abs(recipe.sugar - ideal.sugar);
  const totalDiff = lemonDiff + sugarDiff;

  // 0 diff → 1.0 satisfaction, 14 diff → 0.0
  return Math.max(0, 1 - totalDiff / 14);
}

/* ── Mentor Tips ──────────────────────────────────────────── */
export const MENTOR_TIPS: MentorTip[] = [
  { character: 'drRho', tipKey: 'nectar.mentor.drRho.tip1', nameKey: 'nectar.mentor.drRho.name' },
  { character: 'drRho', tipKey: 'nectar.mentor.drRho.tip2', nameKey: 'nectar.mentor.drRho.name' },
  { character: 'drRho', tipKey: 'nectar.mentor.drRho.tip3', nameKey: 'nectar.mentor.drRho.name' },
  { character: 'zara', tipKey: 'nectar.mentor.zara.tip1', nameKey: 'nectar.mentor.zara.name' },
  { character: 'zara', tipKey: 'nectar.mentor.zara.tip2', nameKey: 'nectar.mentor.zara.name' },
  { character: 'zara', tipKey: 'nectar.mentor.zara.tip3', nameKey: 'nectar.mentor.zara.name' },
  { character: 'liruf', tipKey: 'nectar.mentor.liruf.tip1', nameKey: 'nectar.mentor.liruf.name' },
  { character: 'liruf', tipKey: 'nectar.mentor.liruf.tip2', nameKey: 'nectar.mentor.liruf.name' },
  { character: 'liruf', tipKey: 'nectar.mentor.liruf.tip3', nameKey: 'nectar.mentor.liruf.name' },
  { character: 'dina', tipKey: 'nectar.mentor.dina.tip1', nameKey: 'nectar.mentor.dina.name' },
  { character: 'dina', tipKey: 'nectar.mentor.dina.tip2', nameKey: 'nectar.mentor.dina.name' },
  { character: 'dina', tipKey: 'nectar.mentor.dina.tip3', nameKey: 'nectar.mentor.dina.name' },
];
