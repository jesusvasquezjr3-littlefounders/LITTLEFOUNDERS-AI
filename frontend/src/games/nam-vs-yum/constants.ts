import type { GameItemDefinition, DifficultyLevel, MentorTip } from './types';

const ASSET_BASE = 'https://xxpsyormxalqjcbomiwe.supabase.co/storage/v1/object/public/game-assets/2-nam-vs-yum-game';

export const AUDIO = {
  bgm: `${ASSET_BASE}/audio/bgm-retro-loop.mp3`,
  correct: `${ASSET_BASE}/audio/correct.mp3`,
  incorrect: `${ASSET_BASE}/audio/incorrect.mp3`,
  combo: `${ASSET_BASE}/audio/combo.mp3`,
  levelUp: `${ASSET_BASE}/audio/level-up.mp3`,
  gameOver: `${ASSET_BASE}/audio/game-over.mp3`,
  chomp: `${ASSET_BASE}/audio/chomp.mp3`,
  reject: `${ASSET_BASE}/audio/reject.mp3`,
  mentorPop: `${ASSET_BASE}/audio/mentor-pop.mp3`,
  highScore: `${ASSET_BASE}/audio/high-score.mp3`,
};

export const PICTURES = {
  vitalio: `${ASSET_BASE}/pictures/vitalio.png`,
  vitalioEat: `${ASSET_BASE}/pictures/vitalio-eat.png`,
  vitalioReject: `${ASSET_BASE}/pictures/vitalio-reject.png`,
  capricho: `${ASSET_BASE}/pictures/capricho.png`,
  caprichoEat: `${ASSET_BASE}/pictures/capricho-eat.png`,
  caprichoReject: `${ASSET_BASE}/pictures/capricho-reject.png`,
  background: `${ASSET_BASE}/pictures/background.png`,
  logo: `${ASSET_BASE}/pictures/logo.png`,
};

const itemPic = (name: string) => `${ASSET_BASE}/pictures/items/${name}.png`;

export const ITEMS: GameItemDefinition[] = [
  // NEEDS (Vitalio) - Tier 1
  { key: 'water', category: 'need', emoji: '💧', imageUrl: itemPic('water'), tier: 1 },
  { key: 'food', category: 'need', emoji: '🍎', imageUrl: itemPic('food'), tier: 1 },
  { key: 'medicine', category: 'need', emoji: '💊', imageUrl: itemPic('medicine'), tier: 1 },
  { key: 'house', category: 'need', emoji: '🏠', imageUrl: itemPic('house'), tier: 1 },
  // NEEDS - Tier 2
  { key: 'school', category: 'need', emoji: '📚', imageUrl: itemPic('school'), tier: 2 },
  { key: 'clothing', category: 'need', emoji: '👕', imageUrl: itemPic('clothing'), tier: 2 },
  { key: 'electricity', category: 'need', emoji: '⚡', imageUrl: itemPic('electricity'), tier: 2 },
  { key: 'toothbrush', category: 'need', emoji: '🪥', imageUrl: itemPic('toothbrush'), tier: 2 },
  // WANTS (Capricho) - Tier 1
  { key: 'toy', category: 'want', emoji: '🧸', imageUrl: itemPic('toy'), tier: 1 },
  { key: 'candy', category: 'want', emoji: '🍬', imageUrl: itemPic('candy'), tier: 1 },
  { key: 'videogame', category: 'want', emoji: '🎮', imageUrl: itemPic('videogame'), tier: 1 },
  { key: 'iceCream', category: 'want', emoji: '🍦', imageUrl: itemPic('ice-cream'), tier: 1 },
  // WANTS - Tier 2
  { key: 'skateboard', category: 'want', emoji: '🛹', imageUrl: itemPic('skateboard'), tier: 2 },
  { key: 'doll', category: 'want', emoji: '🪆', imageUrl: itemPic('doll'), tier: 2 },
  { key: 'stickers', category: 'want', emoji: '⭐', imageUrl: itemPic('stickers'), tier: 2 },
  { key: 'soda', category: 'want', emoji: '🥤', imageUrl: itemPic('soda'), tier: 2 },
  // Tier 3 (tricky)
  { key: 'sunglasses', category: 'want', emoji: '🕶️', imageUrl: itemPic('sunglasses'), tier: 3 },
  { key: 'perfume', category: 'want', emoji: '🧴', imageUrl: itemPic('perfume'), tier: 3 },
  { key: 'robot', category: 'want', emoji: '🤖', imageUrl: itemPic('robot'), tier: 3 },
  { key: 'balloon', category: 'want', emoji: '🎈', imageUrl: itemPic('balloon'), tier: 3 },
];

export const DIFFICULTY_LEVELS: DifficultyLevel[] = [
  { level: 1, spawnIntervalMs: 2500, baseSpeed: 55, speedVariance: 10, maxSimultaneous: 1, includesTier: [1], mentorTipChance: 0.3, pointsPerCorrect: 10 },
  { level: 2, spawnIntervalMs: 2200, baseSpeed: 70, speedVariance: 15, maxSimultaneous: 2, includesTier: [1], mentorTipChance: 0.25, pointsPerCorrect: 10 },
  { level: 3, spawnIntervalMs: 2000, baseSpeed: 85, speedVariance: 20, maxSimultaneous: 2, includesTier: [1, 2], mentorTipChance: 0.2, pointsPerCorrect: 15 },
  { level: 4, spawnIntervalMs: 1800, baseSpeed: 95, speedVariance: 25, maxSimultaneous: 3, includesTier: [1, 2], mentorTipChance: 0.15, pointsPerCorrect: 15 },
  { level: 5, spawnIntervalMs: 1600, baseSpeed: 110, speedVariance: 30, maxSimultaneous: 3, includesTier: [1, 2], mentorTipChance: 0.1, pointsPerCorrect: 20 },
  { level: 6, spawnIntervalMs: 1400, baseSpeed: 125, speedVariance: 35, maxSimultaneous: 4, includesTier: [1, 2, 3], mentorTipChance: 0.1, pointsPerCorrect: 20 },
  { level: 7, spawnIntervalMs: 1200, baseSpeed: 140, speedVariance: 40, maxSimultaneous: 5, includesTier: [1, 2, 3], mentorTipChance: 0.08, pointsPerCorrect: 25 },
];

export const COMBO_THRESHOLD = 5;
export const MAX_COMBO_MULTIPLIER = 5;

export const MENTOR_TIPS: MentorTip[] = [
  { character: 'drRho', tipKey: 'namVsYum.mentor.drRho.tip1', nameKey: 'namVsYum.mentor.drRho.name' },
  { character: 'drRho', tipKey: 'namVsYum.mentor.drRho.tip2', nameKey: 'namVsYum.mentor.drRho.name' },
  { character: 'drRho', tipKey: 'namVsYum.mentor.drRho.tip3', nameKey: 'namVsYum.mentor.drRho.name' },
  { character: 'zara', tipKey: 'namVsYum.mentor.zara.tip1', nameKey: 'namVsYum.mentor.zara.name' },
  { character: 'zara', tipKey: 'namVsYum.mentor.zara.tip2', nameKey: 'namVsYum.mentor.zara.name' },
  { character: 'zara', tipKey: 'namVsYum.mentor.zara.tip3', nameKey: 'namVsYum.mentor.zara.name' },
  { character: 'liruf', tipKey: 'namVsYum.mentor.liruf.tip1', nameKey: 'namVsYum.mentor.liruf.name' },
  { character: 'liruf', tipKey: 'namVsYum.mentor.liruf.tip2', nameKey: 'namVsYum.mentor.liruf.name' },
  { character: 'liruf', tipKey: 'namVsYum.mentor.liruf.tip3', nameKey: 'namVsYum.mentor.liruf.name' },
  { character: 'dina', tipKey: 'namVsYum.mentor.dina.tip1', nameKey: 'namVsYum.mentor.dina.name' },
  { character: 'dina', tipKey: 'namVsYum.mentor.dina.tip2', nameKey: 'namVsYum.mentor.dina.name' },
  { character: 'dina', tipKey: 'namVsYum.mentor.dina.tip3', nameKey: 'namVsYum.mentor.dina.name' },
];

export const GAME_CONFIG = {
  maxLives: 3,
  monsterZoneHeightPercent: 25,
  itemSizePx: 56,
  itemSizeMobilePx: 48,
  feedbackDurationMs: 800,
  mentorTipDurationMs: 4000,
  levelUpEveryNItems: 10,
  consumeAnimationMs: 400,
  highScoreKey: 'namvsyum_highscore',
};
