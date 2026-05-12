import type { GameItemDefinition, DifficultyLevel, MentorCharacter, PowerUpDefinition, AchievementDefinition } from './types';

const BASE = '2-nam-vs-yum-game';

export const AUDIO = {
  bgm: `${BASE}/audio/bgm-retro-loop.mp3`,
  correct: `${BASE}/audio/correct.mp3`,
  incorrect: `${BASE}/audio/incorrect.mp3`,
  combo: `${BASE}/audio/combo.mp3`,
  levelUp: `${BASE}/audio/level-up.mp3`,
  gameOver: `${BASE}/audio/game-over.mp3`,
  chomp: `${BASE}/audio/chomp.mp3`,
  reject: `${BASE}/audio/reject.mp3`,
  mentorPop: `${BASE}/audio/mentor-pop.mp3`,
  highScore: `${BASE}/audio/high-score.mp3`,
  // New sounds (will use existing sounds as fallback until new assets are added)
  powerUp: `${BASE}/audio/correct.mp3`,
  bombTick: `${BASE}/audio/incorrect.mp3`,
  bombExplode: `${BASE}/audio/game-over.mp3`,
  mysteryReveal: `${BASE}/audio/mentor-pop.mp3`,
  achievementUnlock: `${BASE}/audio/high-score.mp3`,
  levelComplete: `${BASE}/audio/level-up.mp3`,
  perfectStreak: `${BASE}/audio/combo.mp3`,
  goldenCollect: `${BASE}/audio/combo.mp3`,
  frenzyMode: `${BASE}/audio/bgm-retro-loop.mp3`,
};

export const PICTURES = {
  vitalio: `${BASE}/pictures/vitalio.png`,
  vitalioEat: `${BASE}/pictures/vitalio-eat.png`,
  vitalioReject: `${BASE}/pictures/vitalio-reject.png`,
  capricho: `${BASE}/pictures/capricho.png`,
  caprichoEat: `${BASE}/pictures/capricho-eat.png`,
  caprichoReject: `${BASE}/pictures/capricho-reject.png`,
  background: `${BASE}/pictures/background.png`,
  logo: `${BASE}/pictures/logo.png`,
};

const itemPic = (name: string) => `${BASE}/pictures/items/${name}.png`;

export const ITEMS: GameItemDefinition[] = [
  // NEEDS (Vitalio) - Tier 1
  { key: 'water', category: 'need', emoji: '💧', imageUrl: itemPic('water'), tier: 1 },
  { key: 'food', category: 'need', emoji: '🍎', imageUrl: itemPic('food'), tier: 1 },
  { key: 'medicine', category: 'need', emoji: '💊', imageUrl: itemPic('medicine'), tier: 1 },
  { key: 'house', category: 'need', emoji: '🏠', imageUrl: itemPic('house'), tier: 1 },
  { key: 'internet', category: 'need', emoji: '📶', imageUrl: itemPic('internet'), tier: 1 },
  { key: 'doctor', category: 'need', emoji: '🩺', imageUrl: itemPic('doctor'), tier: 1 },
  { key: 'bed', category: 'need', emoji: '🛏️', imageUrl: itemPic('bed'), tier: 1 },
  // NEEDS - Tier 2
  { key: 'school', category: 'need', emoji: '📚', imageUrl: itemPic('school'), tier: 2 },
  { key: 'clothing', category: 'need', emoji: '👕', imageUrl: itemPic('clothing'), tier: 2 },
  { key: 'electricity', category: 'need', emoji: '⚡', imageUrl: itemPic('electricity'), tier: 2 },
  { key: 'toothbrush', category: 'need', emoji: '🪥', imageUrl: itemPic('toothbrush'), tier: 2 },
  { key: 'transport', category: 'need', emoji: '🚌', imageUrl: itemPic('transport'), tier: 2 },
  { key: 'shower', category: 'need', emoji: '🚿', imageUrl: itemPic('shower'), tier: 2 },
  { key: 'fruits', category: 'need', emoji: '🍌', imageUrl: itemPic('fruits'), tier: 2 },
  // NEEDS - Tier 3 (tricky — look like luxuries but are needs)
  { key: 'glasses', category: 'need', emoji: '👓', imageUrl: itemPic('glasses'), tier: 3 },
  { key: 'wheelchair', category: 'need', emoji: '🦽', imageUrl: itemPic('wheelchair'), tier: 3 },
  { key: 'hearingAid', category: 'need', emoji: '🦻', imageUrl: itemPic('hearing-aid'), tier: 3 },
  // WANTS (Capricho) - Tier 1
  { key: 'toy', category: 'want', emoji: '🧸', imageUrl: itemPic('toy'), tier: 1 },
  { key: 'candy', category: 'want', emoji: '🍬', imageUrl: itemPic('candy'), tier: 1 },
  { key: 'videogame', category: 'want', emoji: '🎮', imageUrl: itemPic('videogame'), tier: 1 },
  { key: 'iceCream', category: 'want', emoji: '🍦', imageUrl: itemPic('ice-cream'), tier: 1 },
  { key: 'ball', category: 'want', emoji: '⚽', imageUrl: itemPic('ball'), tier: 1 },
  { key: 'chocolate', category: 'want', emoji: '🍫', imageUrl: itemPic('chocolate'), tier: 1 },
  { key: 'puzzle', category: 'want', emoji: '🧩', imageUrl: itemPic('puzzle'), tier: 1 },
  // WANTS - Tier 2
  { key: 'skateboard', category: 'want', emoji: '🛹', imageUrl: itemPic('skateboard'), tier: 2 },
  { key: 'doll', category: 'want', emoji: '🪆', imageUrl: itemPic('doll'), tier: 2 },
  { key: 'stickers', category: 'want', emoji: '⭐', imageUrl: itemPic('stickers'), tier: 2 },
  { key: 'soda', category: 'want', emoji: '🥤', imageUrl: itemPic('soda'), tier: 2 },
  { key: 'kite', category: 'want', emoji: '🪁', imageUrl: itemPic('kite'), tier: 2 },
  { key: 'paintSet', category: 'want', emoji: '🎨', imageUrl: itemPic('paint-set'), tier: 2 },
  { key: 'remoteCar', category: 'want', emoji: '🏎️', imageUrl: itemPic('remote-car'), tier: 2 },
  // WANTS - Tier 3
  { key: 'sunglasses', category: 'want', emoji: '🕶️', imageUrl: itemPic('sunglasses'), tier: 3 },
  { key: 'perfume', category: 'want', emoji: '🧴', imageUrl: itemPic('perfume'), tier: 3 },
  { key: 'robot', category: 'want', emoji: '🤖', imageUrl: itemPic('robot'), tier: 3 },
  { key: 'balloon', category: 'want', emoji: '🎈', imageUrl: itemPic('balloon'), tier: 3 },
  { key: 'jewelry', category: 'want', emoji: '💍', imageUrl: itemPic('jewelry'), tier: 3 },
  { key: 'designerBag', category: 'want', emoji: '👜', imageUrl: itemPic('designer-bag'), tier: 3 },
  { key: 'fancyWatch', category: 'want', emoji: '⌚', imageUrl: itemPic('fancy-watch'), tier: 3 },
  // WANTS - Tier 4 (super luxury)
  { key: 'yacht', category: 'want', emoji: '🛥️', imageUrl: itemPic('yacht'), tier: 4 },
  { key: 'spaceship', category: 'want', emoji: '🚀', imageUrl: itemPic('spaceship'), tier: 4 },
  { key: 'crown', category: 'want', emoji: '👑', imageUrl: itemPic('crown'), tier: 4 },
];

export const DIFFICULTY_LEVELS: DifficultyLevel[] = [
  { level: 1, spawnIntervalMs: 2800, baseSpeed: 60, speedVariance: 10, maxSimultaneous: 1, includesTier: [1], mentorTipChance: 0.3, pointsPerCorrect: 10, weather: 'sunny', specialMechanic: 'none' },
  { level: 2, spawnIntervalMs: 2400, baseSpeed: 85, speedVariance: 15, maxSimultaneous: 2, includesTier: [1], mentorTipChance: 0.25, pointsPerCorrect: 10, weather: 'sunny', specialMechanic: 'none' },
  { level: 3, spawnIntervalMs: 2000, baseSpeed: 115, speedVariance: 20, maxSimultaneous: 2, includesTier: [1, 2], mentorTipChance: 0.2, pointsPerCorrect: 15, weather: 'sunny', specialMechanic: 'none' },
  { level: 4, spawnIntervalMs: 1700, baseSpeed: 145, speedVariance: 25, maxSimultaneous: 3, includesTier: [1, 2], mentorTipChance: 0.15, pointsPerCorrect: 15, weather: 'goldenHour', specialMechanic: 'none' },
  { level: 5, spawnIntervalMs: 1400, baseSpeed: 180, speedVariance: 30, maxSimultaneous: 3, includesTier: [1, 2], mentorTipChance: 0.1, pointsPerCorrect: 20, weather: 'goldenHour', specialMechanic: 'none' },
  { level: 6, spawnIntervalMs: 1200, baseSpeed: 215, speedVariance: 35, maxSimultaneous: 4, includesTier: [1, 2, 3], mentorTipChance: 0.1, pointsPerCorrect: 20, weather: 'goldenHour', specialMechanic: 'none' },
  { level: 7, spawnIntervalMs: 1000, baseSpeed: 255, speedVariance: 40, maxSimultaneous: 5, includesTier: [1, 2, 3], mentorTipChance: 0.08, pointsPerCorrect: 25, weather: 'rainy', specialMechanic: 'none' },
  // NEW LEVELS 8-15
  { level: 8, spawnIntervalMs: 950, baseSpeed: 275, speedVariance: 45, maxSimultaneous: 5, includesTier: [1, 2, 3], mentorTipChance: 0.08, pointsPerCorrect: 25, weather: 'rainy', specialMechanic: 'mystery' },
  { level: 9, spawnIntervalMs: 900, baseSpeed: 295, speedVariance: 50, maxSimultaneous: 6, includesTier: [1, 2, 3], mentorTipChance: 0.07, pointsPerCorrect: 30, weather: 'rainy', specialMechanic: 'mystery' },
  { level: 10, spawnIntervalMs: 850, baseSpeed: 320, speedVariance: 55, maxSimultaneous: 6, includesTier: [1, 2, 3, 4], mentorTipChance: 0.07, pointsPerCorrect: 30, weather: 'storm', specialMechanic: 'bomb' },
  { level: 11, spawnIntervalMs: 800, baseSpeed: 345, speedVariance: 60, maxSimultaneous: 6, includesTier: [1, 2, 3, 4], mentorTipChance: 0.06, pointsPerCorrect: 35, weather: 'storm', specialMechanic: 'bomb' },
  { level: 12, spawnIntervalMs: 750, baseSpeed: 370, speedVariance: 65, maxSimultaneous: 7, includesTier: [1, 2, 3, 4], mentorTipChance: 0.06, pointsPerCorrect: 35, weather: 'night', specialMechanic: 'zigzag' },
  { level: 13, spawnIntervalMs: 700, baseSpeed: 400, speedVariance: 70, maxSimultaneous: 7, includesTier: [2, 3, 4], mentorTipChance: 0.05, pointsPerCorrect: 40, weather: 'night', specialMechanic: 'zigzag' },
  { level: 14, spawnIntervalMs: 650, baseSpeed: 430, speedVariance: 75, maxSimultaneous: 7, includesTier: [2, 3, 4], mentorTipChance: 0.05, pointsPerCorrect: 40, weather: 'night', specialMechanic: 'zigzag' },
  { level: 15, spawnIntervalMs: 600, baseSpeed: 460, speedVariance: 80, maxSimultaneous: 8, includesTier: [2, 3, 4], mentorTipChance: 0.04, pointsPerCorrect: 50, weather: 'storm', specialMechanic: 'boss' },
];

export const COMBO_THRESHOLD = 5;
export const MAX_COMBO_MULTIPLIER = 5;
export const FRENZY_THRESHOLD = 15;

export const MENTOR_CHARACTERS: MentorCharacter[] = [
  { id: 'drRho', emoji: '👨🏻‍💼', colorClass: 'border-blue-400 bg-blue-900/90', nameKey: 'namVsYum.mentor.drRho.name', tipKeys: ['namVsYum.mentor.drRho.tip1', 'namVsYum.mentor.drRho.tip2', 'namVsYum.mentor.drRho.tip3'] },
  { id: 'zara', emoji: '👩🏻‍💼', colorClass: 'border-amber-400 bg-amber-900/90', nameKey: 'namVsYum.mentor.zara.name', tipKeys: ['namVsYum.mentor.zara.tip1', 'namVsYum.mentor.zara.tip2', 'namVsYum.mentor.zara.tip3'] },
  { id: 'liruf', emoji: '🦖', colorClass: 'border-green-400 bg-green-900/90', nameKey: 'namVsYum.mentor.liruf.name', tipKeys: ['namVsYum.mentor.liruf.tip1', 'namVsYum.mentor.liruf.tip2', 'namVsYum.mentor.liruf.tip3'] },
  { id: 'dina', emoji: '🦕', colorClass: 'border-pink-400 bg-pink-900/90', nameKey: 'namVsYum.mentor.dina.name', tipKeys: ['namVsYum.mentor.dina.tip1', 'namVsYum.mentor.dina.tip2', 'namVsYum.mentor.dina.tip3'] },
];

export const POWER_UPS: PowerUpDefinition[] = [
  { type: 'freezeTime', emoji: '❄️', durationMs: 5000, spawnChance: 0.03 },
  { type: 'scoreBoost', emoji: '⭐', durationMs: 10000, spawnChance: 0.03 },
  { type: 'extraLife', emoji: '❤️', durationMs: 0, spawnChance: 0.02 },
  { type: 'magnet', emoji: '🧲', durationMs: 8000, spawnChance: 0.025 },
  { type: 'clearScreen', emoji: '💥', durationMs: 0, spawnChance: 0.02 },
  { type: 'slowMotion', emoji: '🐌', durationMs: 6000, spawnChance: 0.025 },
];

export const ACHIEVEMENTS: AchievementDefinition[] = [
  { id: 'firstSteps', icon: 'Footprints', target: 1, reward: 10 },
  { id: 'sorterApprentice', icon: 'Award', target: 50, reward: 25 },
  { id: 'sorterExpert', icon: 'Medal', target: 500, reward: 50 },
  { id: 'sorterMaster', icon: 'Crown', target: 2000, reward: 100 },
  { id: 'comboStarter', icon: 'Zap', target: 2, reward: 15 },
  { id: 'comboWarrior', icon: 'Flame', target: 5, reward: 30 },
  { id: 'comboLegend', icon: 'Star', target: 50, reward: 100 },
  { id: 'perfectLevel', icon: 'ShieldCheck', target: 1, reward: 50 },
  { id: 'highScorer', icon: 'Trophy', target: 1000, reward: 25 },
  { id: 'scoreChampion', icon: 'Trophy', target: 5000, reward: 75 },
  { id: 'scoreLegend', icon: 'Trophy', target: 10000, reward: 150 },
  { id: 'survivor', icon: 'Heart', target: 10, reward: 50 },
  { id: 'speedDemon', icon: 'Timer', target: 10, reward: 30 },
  { id: 'mentorStudent', icon: 'BookOpen', target: 20, reward: 25 },
  { id: 'easterEggHunter', icon: 'Search', target: 1, reward: 50 },
  { id: 'powerUpUser', icon: 'BatteryCharging', target: 10, reward: 20 },
  { id: 'bombDefuser', icon: 'Bomb', target: 5, reward: 40 },
  { id: 'goldenTouch', icon: 'Coins', target: 10, reward: 30 },
  { id: 'konamiMaster', icon: 'Gamepad2', target: 1, reward: 100 },
];

export const SKIN_PRICES: Record<string, number> = {
  gold: 500,
  ninja: 1000,
  astronaut: 1500,
  pirate: 1000,
  robot: 1500,
};

export const THEME_PRICES: Record<string, number> = {
  forest: 800,
  space: 1200,
  city: 1000,
};

export const SKIN_CONFIG: Record<string, { vitalio: { bg: string; emoji: string }; capricho: { bg: string; emoji: string } }> = {
  classic: { vitalio: { bg: 'from-green-600 to-green-800', emoji: '🦎' }, capricho: { bg: 'from-purple-600 to-purple-800', emoji: '👾' } },
  gold: { vitalio: { bg: 'from-yellow-500 to-amber-700', emoji: '🌟' }, capricho: { bg: 'from-yellow-500 to-amber-700', emoji: '✨' } },
  ninja: { vitalio: { bg: 'from-slate-700 to-black', emoji: '🥷' }, capricho: { bg: 'from-slate-700 to-black', emoji: '🗡️' } },
  astronaut: { vitalio: { bg: 'from-blue-500 to-indigo-800', emoji: '👨‍🚀' }, capricho: { bg: 'from-blue-500 to-indigo-800', emoji: '🚀' } },
  pirate: { vitalio: { bg: 'from-red-700 to-amber-900', emoji: '🏴‍☠️' }, capricho: { bg: 'from-red-700 to-amber-900', emoji: '⚓' } },
  robot: { vitalio: { bg: 'from-cyan-600 to-blue-800', emoji: '🤖' }, capricho: { bg: 'from-cyan-600 to-blue-800', emoji: '⚙️' } },
};

export const THEME_GRADIENTS: Record<string, string> = {
  sky: 'linear-gradient(180deg, #4a90d9 0%, #357abd 30%, #1a5276 70%, #0d2137 100%)',
  forest: 'linear-gradient(180deg, #2d5016 0%, #1a3a0f 30%, #0d2608 70%, #051403 100%)',
  space: 'linear-gradient(180deg, #1a1a3e 0%, #0d0d2b 30%, #050518 70%, #02020a 100%)',
  city: 'linear-gradient(180deg, #4a4a6a 0%, #2d2d4a 30%, #1a1a2e 70%, #0d0d1a 100%)',
};

export const GAME_CONFIG = {
  maxLives: 3,
  monsterZoneHeightPercent: 25,
  trashZoneWidthPercent: 12,
  itemSizePx: 56,
  itemSizeMobilePx: 48,
  feedbackDurationMs: 800,
  mentorTipDurationMs: 4000,
  levelUpEveryNItems: 10,
  consumeAnimationMs: 400,
  highScoreKey: 'namvsyum_highscore',
  goldenItemChance: 0.05,
  rainbowItemChance: 0.01,
  unicornItemChance: 0.005,
  bombTimerSeconds: 5,
  levelCompleteDurationMs: 2500,
  frenzyThreshold: 15,
};
