import { CustomerDef, ItemDef, Transaction, GameUpgrades, ThemeType } from './types';

const ASSET_BASE =
  'https://xxpsyormxalqjcbomiwe.supabase.co/storage/v1/object/public/game-assets/7-paper-coin';

// ─── Audio ────────────────────────────────────────────────────────────────────
export const AUDIO = {
  bgm: `${ASSET_BASE}/audio/bgm.mp3`,
  bgmFast: `${ASSET_BASE}/audio/bgm-fast.mp3`,
  caching: `${ASSET_BASE}/audio/ca-ching.mp3`,
  error: `${ASSET_BASE}/audio/error.mp3`,
  paperCrumple: `${ASSET_BASE}/audio/paper-crumple.mp3`,
  levelUp: `${ASSET_BASE}/audio/level-up.mp3`,
  gameOver: `${ASSET_BASE}/audio/game-over.mp3`,
  tick: `${ASSET_BASE}/audio/tick.mp3`,
  speedBonus: `${ASSET_BASE}/audio/speed-bonus.mp3`,
  buttonPress: `${ASSET_BASE}/audio/button.mp3`,
  coinFlip: `${ASSET_BASE}/audio/coin-flip.mp3`,
  shopOpen: `${ASSET_BASE}/audio/shop-open.mp3`,
};

// ─── Item helpers ──────────────────────────────────────────────────────────────
const pic = (name: string) => `${ASSET_BASE}/pictures/${name}.png`;

// ─── Items ─────────────────────────────────────────────────────────────────────
// Tier 1: simple prices 3–15, customer pays 10 or 20
export const TIER1_ITEMS: ItemDef[] = [
  { key: 'bread',    emoji: '🍞', imageUrl: pic('items/bread'),    price: 3,  tier: 1 },
  { key: 'herb',     emoji: '🌿', imageUrl: pic('items/herb'),     price: 4,  tier: 1 },
  { key: 'torch',    emoji: '🕯️', imageUrl: pic('items/torch'),    price: 5,  tier: 1 },
  { key: 'water',    emoji: '💧', imageUrl: pic('items/water'),    price: 6,  tier: 1 },
  { key: 'rope',     emoji: '🪢', imageUrl: pic('items/rope'),     price: 7,  tier: 1 },
  { key: 'potion',   emoji: '🧪', imageUrl: pic('items/potion'),   price: 8,  tier: 1 },
  { key: 'apple',    emoji: '🍎', imageUrl: pic('items/apple'),    price: 9,  tier: 1 },
  { key: 'arrow',    emoji: '🏹', imageUrl: pic('items/arrow'),    price: 12, tier: 1 },
  { key: 'mushroom', emoji: '🍄', imageUrl: pic('items/mushroom'), price: 15, tier: 1 },
];

// Tier 2: prices 18–45, customer pays 50
export const TIER2_ITEMS: ItemDef[] = [
  { key: 'map',     emoji: '🗺️', imageUrl: pic('items/map'),     price: 18, tier: 2 },
  { key: 'lantern', emoji: '🪔', imageUrl: pic('items/lantern'), price: 22, tier: 2 },
  { key: 'boots',   emoji: '👢', imageUrl: pic('items/boots'),   price: 28, tier: 2 },
  { key: 'shield',  emoji: '🛡️', imageUrl: pic('items/shield'),  price: 35, tier: 2 },
  { key: 'scroll',  emoji: '📜', imageUrl: pic('items/scroll'),  price: 38, tier: 2 },
  { key: 'cloak',   emoji: '🧥', imageUrl: pic('items/cloak'),   price: 45, tier: 2 },
];

// Tier 4: prices 55–95, customer pays 100
export const TIER4_ITEMS: ItemDef[] = [
  { key: 'helmet', emoji: '⛑️', imageUrl: pic('items/helmet'), price: 55, tier: 4 },
  { key: 'armor',  emoji: '🦺', imageUrl: pic('items/armor'),  price: 67, tier: 4 },
  { key: 'sword',  emoji: '⚔️', imageUrl: pic('items/sword'),  price: 78, tier: 4 },
  { key: 'staff',  emoji: '🪄', imageUrl: pic('items/staff'),  price: 85, tier: 4 },
  { key: 'crown',  emoji: '👑', imageUrl: pic('items/crown'),  price: 92, tier: 4 },
];

// ─── Customers ─────────────────────────────────────────────────────────────────
export const CUSTOMERS: CustomerDef[] = [
  {
    key: 'knight',
    emoji: '⚔️',
    imageUrl: pic('customers/knight'),
    nameKey: 'paperCoin.customers.knight',
    bgColor: '#b91c1c',
    borderColor: '#7f1d1d',
    textColor: '#fff',
  },
  {
    key: 'wizard',
    emoji: '🧙',
    imageUrl: pic('customers/wizard'),
    nameKey: 'paperCoin.customers.wizard',
    bgColor: '#6d28d9',
    borderColor: '#3b0764',
    textColor: '#fff',
  },
  {
    key: 'rogue',
    emoji: '🥷',
    imageUrl: pic('customers/rogue'),
    nameKey: 'paperCoin.customers.rogue',
    bgColor: '#374151',
    borderColor: '#111827',
    textColor: '#fff',
  },
  {
    key: 'ranger',
    emoji: '🏹',
    imageUrl: pic('customers/ranger'),
    nameKey: 'paperCoin.customers.ranger',
    bgColor: '#047857',
    borderColor: '#064e3b',
    textColor: '#fff',
  },
  {
    key: 'healer',
    emoji: '💙',
    imageUrl: pic('customers/healer'),
    nameKey: 'paperCoin.customers.healer',
    bgColor: '#1d4ed8',
    borderColor: '#1e3a8a',
    textColor: '#fff',
  },
  {
    key: 'bard',
    emoji: '🎵',
    imageUrl: pic('customers/bard'),
    nameKey: 'paperCoin.customers.bard',
    bgColor: '#b45309',
    borderColor: '#78350f',
    textColor: '#fff',
  },
];

// ─── Payment logic ─────────────────────────────────────────────────────────────
export function getPaymentAmount(totalPrice: number): number {
  if (totalPrice < 10) return 10;
  if (totalPrice < 20) return 20;
  if (totalPrice < 50) return 50;
  return 100;
}

// ─── Transaction generator ─────────────────────────────────────────────────────
let _seqCounter = 0;

export function generateTransaction(
  day: number,
  prevCustomerKey?: string | null,
): Transaction {
  _seqCounter++;

  let items: ItemDef[];

  if (day >= 1 && day <= 5) {
    const pool = TIER1_ITEMS.filter((i) => i.price <= 12);
    items = [pool[Math.floor(Math.random() * pool.length)]];
  } else if (day >= 6 && day <= 10) {
    items = [TIER2_ITEMS[Math.floor(Math.random() * TIER2_ITEMS.length)]];
  } else if (day >= 11 && day <= 15) {
    // Two tier-1 items: customer pays with 50
    const shuffled = [...TIER1_ITEMS].sort(() => Math.random() - 0.5);
    items = [shuffled[0], shuffled[1]];
  } else {
    items = [TIER4_ITEMS[Math.floor(Math.random() * TIER4_ITEMS.length)]];
  }

  const totalPrice = items.reduce((s, i) => s + i.price, 0);
  const payment = day >= 11 && day <= 15 ? 50 : getPaymentAmount(totalPrice);
  const correctChange = payment - totalPrice;

  const availableCustomers = prevCustomerKey
    ? CUSTOMERS.filter((c) => c.key !== prevCustomerKey)
    : CUSTOMERS;

  const customer =
    availableCustomers[Math.floor(Math.random() * availableCustomers.length)];

  return { items, totalPrice, payment, correctChange, customer };
}

// ─── Timer ─────────────────────────────────────────────────────────────────────
export function getMaxTimeTicks(day: number, hourglassLevel: number): number {
  let base: number;
  if (day <= 5) base = 10;
  else if (day <= 10) base = 8;
  else if (day <= 15) base = 7;
  else if (day <= 20) base = 6;
  else base = 5;
  return (base + hourglassLevel * 2) * 10; // 1 tick = 100 ms
}

// ─── Upgrades ──────────────────────────────────────────────────────────────────
export const SHOP_UPGRADES = [
  {
    id: 'hourglass' as const,
    cost: 30,
    maxLevel: 3,
    emoji: '⏳',
    nameKey: 'paperCoin.shop.upgrades.hourglass.name',
    descKey: 'paperCoin.shop.upgrades.hourglass.desc',
  },
  {
    id: 'amulet' as const,
    cost: 50,
    maxLevel: 2,
    emoji: '❤️',
    nameKey: 'paperCoin.shop.upgrades.amulet.name',
    descKey: 'paperCoin.shop.upgrades.amulet.desc',
  },
  {
    id: 'forest' as const,
    cost: 40,
    maxLevel: 1,
    emoji: '🌲',
    nameKey: 'paperCoin.shop.upgrades.forest.name',
    descKey: 'paperCoin.shop.upgrades.forest.desc',
  },
  {
    id: 'castle' as const,
    cost: 40,
    maxLevel: 1,
    emoji: '🏰',
    nameKey: 'paperCoin.shop.upgrades.castle.name',
    descKey: 'paperCoin.shop.upgrades.castle.desc',
  },
  {
    id: 'ghost' as const,
    cost: 40,
    maxLevel: 1,
    emoji: '👻',
    nameKey: 'paperCoin.shop.upgrades.ghost.name',
    descKey: 'paperCoin.shop.upgrades.ghost.desc',
  },
];

// ─── Theme styles ──────────────────────────────────────────────────────────────
export const THEME_CONFIG: Record<
  ThemeType,
  {
    wallTop: string;
    wallBottom: string;
    floor: string;
    counter: string;
    accent: string;
    signBg: string;
    particleColor: string;
  }
> = {
  default: {
    wallTop: '#e8c87a',
    wallBottom: '#c8a96e',
    floor: '#8B4513',
    counter: '#6b4423',
    accent: '#f5d98b',
    signBg: '#a0522d',
    particleColor: '#fbbf24',
  },
  forest: {
    wallTop: '#40916c',
    wallBottom: '#2d6a4f',
    floor: '#1b4332',
    counter: '#1a3a1a',
    accent: '#95d5b2',
    signBg: '#2d4a22',
    particleColor: '#6ee7b7',
  },
  castle: {
    wallTop: '#6b7280',
    wallBottom: '#4b5563',
    floor: '#1f2937',
    counter: '#111827',
    accent: '#9ca3af',
    signBg: '#374151',
    particleColor: '#d1d5db',
  },
  ghost: {
    wallTop: '#7c3aed',
    wallBottom: '#4c1d95',
    floor: '#1e1b4b',
    counter: '#0d0019',
    accent: '#a78bfa',
    signBg: '#312e81',
    particleColor: '#c4b5fd',
  },
};

// ─── Game config ───────────────────────────────────────────────────────────────
export const GAME_CONFIG = {
  initialHearts: 3,
  customersPerDay: 8,
  speedBonusThresholdMs: 3000, // < 3 seconds = speed bonus
  correctXP: 10,
  speedBonusXP: 10,
  correctTips: 5,
  speedBonusTips: 5,
  highScoreKey: 'papercoin_highscore',
  maxInputDigits: 3,
  streakMilestones: [3, 5, 7, 10],
} as const;

// ─── Coin denominations (for display) ─────────────────────────────────────────
export const COIN_DENOMINATIONS = [10, 20, 50, 100];

export function getUpgradeLevel(
  upgrades: GameUpgrades,
  id: 'hourglass' | 'amulet',
): number {
  return upgrades[id];
}
