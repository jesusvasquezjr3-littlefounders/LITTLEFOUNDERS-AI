import type { ItemSilhouette, CoinOption, DrawerCoin, Cosmetic } from './types';

// ─────────────────────────────────────────────────────
// Detective de Papel: Misión Alcancía — Constants
// ─────────────────────────────────────────────────────

const ASSET_BASE = 'https://xxpsyormxalqjcbomiwe.supabase.co/storage/v1/object/public/game-assets/3-paper-detective';

// ── Audio ────────────────────────────────────────────
export const AUDIO = {
  bgm:       `${ASSET_BASE}/audio/bgm-jazz.mp3`,
  correct:   `${ASSET_BASE}/audio/correct.mp3`,
  incorrect: `${ASSET_BASE}/audio/incorrect.mp3`,
  drag:      `${ASSET_BASE}/audio/drag.mp3`,
  coinIn:    `${ASSET_BASE}/audio/coin-in.mp3`,
  combo:     `${ASSET_BASE}/audio/combo.mp3`,
  gameOver:  `${ASSET_BASE}/audio/game-over.mp3`,
  levelUp:   `${ASSET_BASE}/audio/level-up.mp3`,
  highScore: `${ASSET_BASE}/audio/high-score.mp3`,
  eject:     `${ASSET_BASE}/audio/incorrect.mp3`, // reuse incorrect sfx for eject
};

// ── Pictures ─────────────────────────────────────────
export const PICTURES = {
  detective:        `${ASSET_BASE}/pictures/detective.png`,
  vendor:           `${ASSET_BASE}/pictures/vendor.png`,
  piggyBank:        `${ASSET_BASE}/pictures/piggy-bank.png`,
  piggyBankFull:    `${ASSET_BASE}/pictures/piggy-bank-full.png`,
  logo:             `${ASSET_BASE}/pictures/logo.png`,
  background:       `${ASSET_BASE}/pictures/background.png`,
  // Real coins
  coin1:            `${ASSET_BASE}/pictures/coins/coin-1.png`,
  coin2:            `${ASSET_BASE}/pictures/coins/coin-2.png`,
  coin5:            `${ASSET_BASE}/pictures/coins/coin-5.png`,
  coin10:           `${ASSET_BASE}/pictures/coins/coin-10.png`,
  // Fakes
  pokerChip:        `${ASSET_BASE}/pictures/fakes/poker-chip.png`,
  button:           `${ASSET_BASE}/pictures/fakes/button.png`,
  bottleCap:        `${ASSET_BASE}/pictures/fakes/bottle-cap.png`,
  pirateCoin:       `${ASSET_BASE}/pictures/fakes/pirate-coin.png`,
  carrot:           `${ASSET_BASE}/pictures/fakes/carrot.png`,
  // Items (used as silhouettes via CSS filter)
  itemCandy:        `${ASSET_BASE}/pictures/items/candy.png`,
  itemApple:        `${ASSET_BASE}/pictures/items/apple.png`,
  itemDonut:        `${ASSET_BASE}/pictures/items/donut.png`,
  itemMagnifier:    `${ASSET_BASE}/pictures/items/magnifier.png`,
  itemHat:          `${ASSET_BASE}/pictures/items/hat.png`,
  itemPencil:       `${ASSET_BASE}/pictures/items/pencil.png`,
  itemNotebook:     `${ASSET_BASE}/pictures/items/notebook.png`,
  itemLollipop:     `${ASSET_BASE}/pictures/items/lollipop.png`,
  itemIceCream:     `${ASSET_BASE}/pictures/items/ice-cream.png`,
  // Cosmetics
  cosmeticTopHat:       `${ASSET_BASE}/pictures/cosmetics/hat-top.png`,
  cosmeticDetectiveHat: `${ASSET_BASE}/pictures/cosmetics/detective-hat.png`,
  cosmeticSunglasses:   `${ASSET_BASE}/pictures/cosmetics/sunglasses.png`,
  cosmeticMustache:     `${ASSET_BASE}/pictures/cosmetics/mustache.png`,
};

// ── Coin emoji fallbacks (shown if image fails to load) ─────
export const COIN_EMOJI: Record<string, string> = {
  coin1: '🪙',
  coin2: '🪙',
  coin5: '🟡',
  coin10: '🟠',
  pokerChip: '🔴',
  button: '⚪',
  bottleCap: '🔵',
  pirateCoin: '☠️',
  carrot: '🥕',
};

export const ITEM_EMOJI: Record<string, string> = {
  itemCandy: '🍬',
  itemApple: '🍎',
  itemDonut: '🍩',
  itemMagnifier: '🔍',
  itemHat: '🎩',
  itemPencil: '✏️',
  itemNotebook: '📓',
  itemLollipop: '🍭',
  itemIceCream: '🍦',
};

// ── Real Coins (for options) ─────────────────────────
export const REAL_COINS: Omit<CoinOption, 'id'>[] = [
  { value: 1,  imageKey: 'coin1',  isReal: true, labelKey: 'paperDetective.coins.coin1' },
  { value: 2,  imageKey: 'coin2',  isReal: true, labelKey: 'paperDetective.coins.coin2' },
  { value: 5,  imageKey: 'coin5',  isReal: true, labelKey: 'paperDetective.coins.coin5' },
  { value: 10, imageKey: 'coin10', isReal: true, labelKey: 'paperDetective.coins.coin10' },
];

// ── Fake Distractors ─────────────────────────────────
export const FAKE_ITEMS: Omit<CoinOption, 'id'>[] = [
  { value: 0, imageKey: 'pokerChip',  isReal: false, labelKey: 'paperDetective.coins.pokerChip' },
  { value: 0, imageKey: 'button',     isReal: false, labelKey: 'paperDetective.coins.button' },
  { value: 0, imageKey: 'bottleCap',  isReal: false, labelKey: 'paperDetective.coins.bottleCap' },
  { value: 0, imageKey: 'pirateCoin', isReal: false, labelKey: 'paperDetective.coins.pirateCoin' },
  { value: 0, imageKey: 'carrot',     isReal: false, labelKey: 'paperDetective.coins.carrot' },
];

// ── Item Silhouettes ─────────────────────────────────
export const ITEMS: ItemSilhouette[] = [
  // $1 items
  { id: 'candy',    nameKey: 'paperDetective.items.candy',    imageKey: 'itemCandy',     price: 1 },
  { id: 'lollipop', nameKey: 'paperDetective.items.lollipop', imageKey: 'itemLollipop',  price: 1 },
  // $2 items
  { id: 'apple',    nameKey: 'paperDetective.items.apple',    imageKey: 'itemApple',     price: 2 },
  { id: 'pencil',   nameKey: 'paperDetective.items.pencil',   imageKey: 'itemPencil',    price: 2 },
  // $5 items
  { id: 'donut',    nameKey: 'paperDetective.items.donut',    imageKey: 'itemDonut',     price: 5 },
  { id: 'hat',      nameKey: 'paperDetective.items.hat',      imageKey: 'itemHat',       price: 5 },
  { id: 'iceCream', nameKey: 'paperDetective.items.iceCream', imageKey: 'itemIceCream',  price: 5 },
  // $10 items
  { id: 'magnifier', nameKey: 'paperDetective.items.magnifier', imageKey: 'itemMagnifier', price: 10 },
  { id: 'notebook',  nameKey: 'paperDetective.items.notebook',  imageKey: 'itemNotebook',  price: 10 },
];

// ── Cosmetics ────────────────────────────────────────
export const COSMETICS: Cosmetic[] = [
  { id: 'topHat',       nameKey: 'paperDetective.cosmetics.topHat',       imageKey: 'cosmeticTopHat',       cost: 100,  type: 'hat' },
  { id: 'detectiveHat', nameKey: 'paperDetective.cosmetics.detectiveHat', imageKey: 'cosmeticDetectiveHat', cost: 200,  type: 'hat' },
  { id: 'sunglasses',   nameKey: 'paperDetective.cosmetics.sunglasses',   imageKey: 'cosmeticSunglasses',   cost: 150,  type: 'glasses' },
  { id: 'mustache',     nameKey: 'paperDetective.cosmetics.mustache',     imageKey: 'cosmeticMustache',     cost: 125,  type: 'mustache' },
];

// ── Day Difficulty Configs ───────────────────────────
export interface DayConfig {
  maxTimeMs: number;
  timeBonusMs: number;
  timePenaltyMs: number;
  p1OptionsCount: number;
  p1FakeCount: number;
  p2Targets: number[];
  scoreBase: number;
}

export const DAY_CONFIGS: DayConfig[] = [
  { // Day 1
    maxTimeMs: 35000,
    timeBonusMs: 9000,
    timePenaltyMs: 4000,
    p1OptionsCount: 3,
    p1FakeCount: 1,
    p2Targets: [3, 5, 6, 7],
    scoreBase: 10,
  },
  { // Day 2
    maxTimeMs: 32000,
    timeBonusMs: 8000,
    timePenaltyMs: 5000,
    p1OptionsCount: 4,
    p1FakeCount: 1,
    p2Targets: [8, 11, 12, 13],
    scoreBase: 15,
  },
  { // Day 3+
    maxTimeMs: 28000,
    timeBonusMs: 7000,
    timePenaltyMs: 6000,
    p1OptionsCount: 5,
    p1FakeCount: 2,
    p2Targets: [14, 15, 16, 17, 18],
    scoreBase: 20,
  },
];

export function getDayConfig(dayNumber: number): DayConfig {
  const idx = Math.min(dayNumber - 1, DAY_CONFIGS.length - 1);
  return DAY_CONFIGS[idx];
}

// ── Drawer coins for Phase 2 ─────────────────────────
export function buildDrawerCoins(): DrawerCoin[] {
  const denominations = [
    { value: 1,  imageKey: 'coin1',  count: 4 },
    { value: 2,  imageKey: 'coin2',  count: 3 },
    { value: 5,  imageKey: 'coin5',  count: 2 },
    { value: 10, imageKey: 'coin10', count: 1 },
  ];
  const coins: DrawerCoin[] = [];
  denominations.forEach(({ value, imageKey, count }) => {
    for (let i = 0; i < count; i++) {
      coins.push({ instanceId: `${imageKey}-${i}`, value, imageKey });
    }
  });
  return coins;
}

// ── Game config ──────────────────────────────────────
export const GAME_CONFIG = {
  feedbackDurationMs: 800,
  ejectDurationMs: 600,
  dayTransitionMs: 1200,
  comboThreshold: 3,       // correct answers per multiplier step
  maxComboMultiplier: 5,
  miniGamesPerDay: 5,
  highScoreKey: 'paperdetective_highscore',
  totalPointsKey: 'paperdetective_totalpoints',
  unlockedCosmeticsKey: 'paperdetective_cosmetics',
  equippedCosmeticKey: 'paperdetective_equipped',
};

// ── Helpers ──────────────────────────────────────────
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
