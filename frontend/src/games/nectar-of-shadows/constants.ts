/* ──────────────────────────────────────────────────────────────
   Néctar de las Sombras – Constants & Configuration
   ────────────────────────────────────────────────────────────── */

import type { Upgrade, MentorTip } from './types';

const ASSET_BASE =
  'https://xxpsyormxalqjcbomiwe.supabase.co/storage/v1/object/public/game-assets/1-the-small-entrepreneur';

/* ── Audio assets ─────────────────────────────────────────── */
export const AUDIO = {
  bgm: `${ASSET_BASE}/audio/bgm-ambient.mp3`,
  coinCollect: `${ASSET_BASE}/audio/coin-collect.mp3`,
  sell: `${ASSET_BASE}/audio/sell.mp3`,
  customerHappy: `${ASSET_BASE}/audio/customer-happy.mp3`,
  customerSad: `${ASSET_BASE}/audio/customer-sad.mp3`,
  jump: `${ASSET_BASE}/audio/jump.mp3`,
  hit: `${ASSET_BASE}/audio/hit.mp3`,
  dayEnd: `${ASSET_BASE}/audio/day-end.mp3`,
  upgrade: `${ASSET_BASE}/audio/upgrade.mp3`,
  gameOver: `${ASSET_BASE}/audio/game-over.mp3`,
  mentorPop: `${ASSET_BASE}/audio/mentor-pop.mp3`,
};

/* ── Picture assets ───────────────────────────────────────── */
export const PICTURES = {
  // Characters
  liruf: `${ASSET_BASE}/pictures/liruf.png`,
  lirufRun1: `${ASSET_BASE}/pictures/liruf-run1.png`,
  lirufRun2: `${ASSET_BASE}/pictures/liruf-run2.png`,
  lirufJump: `${ASSET_BASE}/pictures/liruf-jump.png`,
  dina: `${ASSET_BASE}/pictures/dina.png`,
  drRho: `${ASSET_BASE}/pictures/dr-rho.png`,
  zara: `${ASSET_BASE}/pictures/zara.png`,

  // Stand
  stand: `${ASSET_BASE}/pictures/stand.png`,
  standWithAwning: `${ASSET_BASE}/pictures/stand-awning.png`,
  standWithSign: `${ASSET_BASE}/pictures/stand-sign.png`,

  // Ingredients
  lemon: `${ASSET_BASE}/pictures/lemon.png`,
  sugar: `${ASSET_BASE}/pictures/sugar.png`,

  // Customers
  customerHappy: `${ASSET_BASE}/pictures/customer-happy.png`,
  customerSad: `${ASSET_BASE}/pictures/customer-sad.png`,
  customerWalk: `${ASSET_BASE}/pictures/customer-walk.png`,

  // Backgrounds
  bgRunner: `${ASSET_BASE}/pictures/bg-runner.png`,
  bgStandHot: `${ASSET_BASE}/pictures/bg-stand-hot.png`,
  bgStandCold: `${ASSET_BASE}/pictures/bg-stand-cold.png`,

  // Obstacles
  rock: `${ASSET_BASE}/pictures/rock.png`,
  mushroom: `${ASSET_BASE}/pictures/mushroom.png`,

  // UI
  logo: `${ASSET_BASE}/pictures/logo.png`,
  coin: `${ASSET_BASE}/pictures/coin.png`,
  vault: `${ASSET_BASE}/pictures/vault.png`,
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
