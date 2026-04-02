import type { TowerSlot, WaveDef, InboxEmail } from './types';

// ─── Asset Base Path (relative to game-assets bucket) ────────────────────────
const BASE = '13-hacker-defense';

export const AUDIO = {
  bgm: `${BASE}/audio/bgm.mp3`,
  bgmBoss: `${BASE}/audio/bgm-boss.mp3`,
  bgmTense: `${BASE}/audio/bgm-tense.mp3`,
  place: `${BASE}/audio/place-tower.mp3`,
  shoot: `${BASE}/audio/shoot.mp3`,
  kill: `${BASE}/audio/kill.mp3`,
  clack: `${BASE}/audio/clack.mp3`,
  caching: `${BASE}/audio/ca-ching.mp3`,
  alert: `${BASE}/audio/alert.mp3`,
  twoFASuccess: `${BASE}/audio/2fa-success.mp3`,
  twoFAFail: `${BASE}/audio/2fa-fail.mp3`,
  levelUp: `${BASE}/audio/level-up.mp3`,
  gameOver: `${BASE}/audio/game-over.mp3`,
  victory: `${BASE}/audio/victory.mp3`,
  phishingAlert: `${BASE}/audio/phishing-alert.mp3`,
  critical: `${BASE}/audio/critical.mp3`,
};

export const PICTURES = {
  // Enemies
  virus: `${BASE}/pictures/enemy-virus.png`,
  trojan: `${BASE}/pictures/enemy-trojan.png`,
  phishingDisguised: `${BASE}/pictures/enemy-phishing-disguised.png`,
  phishingRevealed: `${BASE}/pictures/enemy-phishing-revealed.png`,
  ddos: `${BASE}/pictures/enemy-ddos.png`,
  boss: `${BASE}/pictures/enemy-boss.png`,
  // Towers
  towerPassword: `${BASE}/pictures/tower-password.png`,
  towerAntivirus: `${BASE}/pictures/tower-antivirus.png`,
  towerWall2fa: `${BASE}/pictures/tower-wall-2fa.png`,
  // Map elements
  base: `${BASE}/pictures/bank-vault.png`,
  map: `${BASE}/pictures/map-bg.png`,
  // UI
  dataPacket: `${BASE}/pictures/data-packet.png`,
  // Pets
  petDog: `${BASE}/pictures/pet-privacy-dog.png`,
  petLock: `${BASE}/pictures/pet-happy-lock.png`,
  petShield: `${BASE}/pictures/pet-shield.png`,
};

// ─── Canvas dimensions ────────────────────────────────────────────────────
export const CANVAS_W = 900;
export const CANVAS_H = 540;
export const HUD_H = 70;
export const TOOLBAR_H = 65;
export const MAP_Y = HUD_H;
export const MAP_H = CANVAS_H - HUD_H - TOOLBAR_H; // 405

// ─── Path waypoints (absolute canvas coordinates) ─────────────────────────
// Z-shaped path from left to right
export const PATH_WAYPOINTS = [
  { x: -50, y: 410 },   // Entry (off-screen left)
  { x: 165, y: 410 },   // Turn 1 → bottom-left bend
  { x: 165, y: 185 },   // Turn 2 → up
  { x: 400, y: 185 },   // Turn 3 → right (top)
  { x: 400, y: 410 },   // Turn 4 → down
  { x: 640, y: 410 },   // Turn 5 → right
  { x: 640, y: 260 },   // Turn 6 → up
  { x: 960, y: 260 },   // Exit → to bank vault (right)
];

// Pre-computed cumulative distances
function computeSegments() {
  const segs: Array<{ ax: number; ay: number; bx: number; by: number; len: number }> = [];
  let totalLen = 0;
  for (let i = 0; i < PATH_WAYPOINTS.length - 1; i++) {
    const a = PATH_WAYPOINTS[i];
    const b = PATH_WAYPOINTS[i + 1];
    const len = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    segs.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, len });
    totalLen += len;
  }
  return { segs, totalLen };
}

export const PATH_DATA = computeSegments();

export function getPositionOnPath(distance: number): { x: number; y: number } {
  let remaining = Math.max(0, distance);
  for (const seg of PATH_DATA.segs) {
    if (remaining <= seg.len) {
      const t = remaining / seg.len;
      return {
        x: seg.ax + (seg.bx - seg.ax) * t,
        y: seg.ay + (seg.by - seg.ay) * t,
      };
    }
    remaining -= seg.len;
  }
  const last = PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1];
  return { x: last.x, y: last.y };
}

// ─── Tower Slots (24 slots around the path) ───────────────────────────────
// Slots are placed at least 45px away from path center lines
export const INITIAL_TOWER_SLOTS: TowerSlot[] = [
  // Left column (above/below first horizontal segment)
  { id: 0, x: 72, y: 130, occupied: false },
  { id: 1, x: 72, y: 278, occupied: false },
  // Around turn 1 left vertical (x≈165)
  { id: 2, x: 105, y: 454, occupied: false },
  { id: 3, x: 225, y: 454, occupied: false },
  // Top horizontal (y≈185): above and below
  { id: 4, x: 260, y: 118, occupied: false },
  { id: 5, x: 260, y: 248, occupied: false },
  { id: 6, x: 330, y: 118, occupied: false },
  { id: 7, x: 330, y: 248, occupied: false },
  // Around center vertical (x≈400): left and right
  { id: 8, x: 338, y: 296, occupied: false },
  { id: 9, x: 462, y: 296, occupied: false },
  { id: 10, x: 338, y: 454, occupied: false },
  { id: 11, x: 462, y: 454, occupied: false },
  // Between center and right vertical
  { id: 12, x: 544, y: 118, occupied: false },
  { id: 13, x: 544, y: 296, occupied: false },
  { id: 14, x: 544, y: 454, occupied: false },
  // Around right vertical (x≈640)
  { id: 15, x: 582, y: 215, occupied: false },
  { id: 16, x: 698, y: 215, occupied: false },
  // Right horizontal (y≈260): above and below
  { id: 17, x: 716, y: 168, occupied: false },
  { id: 18, x: 716, y: 342, occupied: false },
  { id: 19, x: 796, y: 168, occupied: false },
  { id: 20, x: 796, y: 342, occupied: false },
  { id: 21, x: 858, y: 168, occupied: false },
  { id: 22, x: 858, y: 342, occupied: false },
  { id: 23, x: 224, y: 130, occupied: false },
];

// ─── Enemy Definitions ─────────────────────────────────────────────────────
export const ENEMY_DEFS = {
  virus: {
    hp: 50,
    speed: 3.2,
    reward: 12,
    stolen: 300,
    size: 38,
    emoji: '🦠',
  },
  trojan: {
    hp: 110,
    speed: 2.2,
    reward: 22,
    stolen: 600,
    size: 44,
    emoji: '🐴',
  },
  phishing: {
    hp: 75,
    speed: 2.8,
    reward: 30,
    stolen: 800,
    size: 42,
    emoji: '🎭',
  },
  ddos: {
    hp: 28,
    speed: 4.0,
    reward: 8,
    stolen: 150,
    size: 30,
    emoji: '⚡',
  },
  boss: {
    hp: 800,
    speed: 1.4,
    reward: 120,
    stolen: 2500,
    size: 62,
    emoji: '🤵',
  },
};

// ─── Tower Definitions ──────────────────────────────────────────────────────
export const TOWER_DEFS = {
  password: {
    cost: 100,
    levels: [
      { damage: 22, range: 145, cooldownTicks: 18, label: 'Lv1' },
      { damage: 40, range: 160, cooldownTicks: 14, label: 'Lv2' },
      { damage: 65, range: 180, cooldownTicks: 11, label: 'Lv3' },
    ],
    emoji: '🔐',
    projectileEmoji: '✳️',
  },
  antivirus: {
    cost: 150,
    levels: [
      { damage: 14, range: 165, cooldownTicks: 24, label: 'Lv1' },
      { damage: 26, range: 185, cooldownTicks: 19, label: 'Lv2' },
      { damage: 40, range: 210, cooldownTicks: 15, label: 'Lv3' },
    ],
    emoji: '🛡️',
    projectileEmoji: '🔎',
    slowFactor: 0.45,
    slowDuration: 30, // ticks
    revealsPhishing: true,
  },
  wall_2fa: {
    cost: 130,
    levels: [
      { hp: 350, range: 40, cooldownTicks: 999, damage: 0, label: 'Lv1' },
      { hp: 600, range: 50, cooldownTicks: 999, damage: 0, label: 'Lv2' },
      { hp: 900, range: 60, cooldownTicks: 999, damage: 0, label: 'Lv3' },
    ],
    emoji: '📱',
    projectileEmoji: '🔒',
  },
};

// ─── Upgrade costs ─────────────────────────────────────────────────────────
export const UPGRADE_COSTS = [0, 120, 200]; // cost to go to level 2, 3

// ─── Wave Definitions (3 levels × 5 waves) ────────────────────────────────
export const LEVEL_WAVES: WaveDef[][] = [
  // ── Level 1 ──────────────────────────────────────────────────────────────
  [
    {
      interWaveDelayTicks: 200,
      spawns: [
        { type: 'virus', delayTicks: 0 },
        { type: 'virus', delayTicks: 30 },
        { type: 'virus', delayTicks: 60 },
        { type: 'virus', delayTicks: 90 },
        { type: 'virus', delayTicks: 120 },
      ],
    },
    {
      interWaveDelayTicks: 200,
      spawns: [
        { type: 'virus', delayTicks: 0 },
        { type: 'virus', delayTicks: 25 },
        { type: 'virus', delayTicks: 50 },
        { type: 'virus', delayTicks: 75 },
        { type: 'virus', delayTicks: 100 },
        { type: 'trojan', delayTicks: 140 },
        { type: 'trojan', delayTicks: 180 },
      ],
    },
    {
      interWaveDelayTicks: 200,
      spawns: [
        { type: 'virus', delayTicks: 0 },
        { type: 'trojan', delayTicks: 30 },
        { type: 'virus', delayTicks: 60 },
        { type: 'trojan', delayTicks: 90 },
        { type: 'virus', delayTicks: 120 },
        { type: 'phishing', delayTicks: 160 },
      ],
    },
    {
      interWaveDelayTicks: 200,
      spawns: [
        { type: 'virus', delayTicks: 0 },
        { type: 'virus', delayTicks: 20 },
        { type: 'phishing', delayTicks: 50 },
        { type: 'trojan', delayTicks: 80 },
        { type: 'virus', delayTicks: 110 },
        { type: 'phishing', delayTicks: 150 },
        { type: 'trojan', delayTicks: 180 },
      ],
    },
    {
      interWaveDelayTicks: 0,
      spawns: [
        { type: 'virus', delayTicks: 0 },
        { type: 'virus', delayTicks: 20 },
        { type: 'trojan', delayTicks: 40 },
        { type: 'phishing', delayTicks: 70 },
        { type: 'trojan', delayTicks: 100 },
        { type: 'virus', delayTicks: 120 },
        { type: 'phishing', delayTicks: 150 },
        { type: 'boss', delayTicks: 220 },
      ],
    },
  ],

  // ── Level 2 ──────────────────────────────────────────────────────────────
  [
    {
      interWaveDelayTicks: 200,
      spawns: [
        { type: 'trojan', delayTicks: 0 },
        { type: 'virus', delayTicks: 20 },
        { type: 'virus', delayTicks: 40 },
        { type: 'trojan', delayTicks: 60 },
        { type: 'phishing', delayTicks: 90 },
        { type: 'virus', delayTicks: 110 },
        { type: 'trojan', delayTicks: 140 },
      ],
    },
    {
      interWaveDelayTicks: 200,
      spawns: [
        { type: 'phishing', delayTicks: 0 },
        { type: 'trojan', delayTicks: 30 },
        { type: 'phishing', delayTicks: 60 },
        { type: 'ddos', delayTicks: 80 },
        { type: 'ddos', delayTicks: 90 },
        { type: 'ddos', delayTicks: 100 },
        { type: 'phishing', delayTicks: 130 },
        { type: 'trojan', delayTicks: 160 },
      ],
    },
    {
      interWaveDelayTicks: 200,
      spawns: [
        // DDoS swarm
        ...Array.from({ length: 12 }, (_, i) => ({ type: 'ddos' as const, delayTicks: i * 12 })),
        { type: 'trojan', delayTicks: 170 },
        { type: 'trojan', delayTicks: 200 },
      ],
    },
    {
      interWaveDelayTicks: 200,
      spawns: [
        { type: 'virus', delayTicks: 0 },
        { type: 'phishing', delayTicks: 25 },
        { type: 'ddos', delayTicks: 40 },
        { type: 'ddos', delayTicks: 50 },
        { type: 'trojan', delayTicks: 70 },
        { type: 'phishing', delayTicks: 100 },
        { type: 'ddos', delayTicks: 120 },
        { type: 'boss', delayTicks: 180 },
      ],
    },
    {
      interWaveDelayTicks: 0,
      spawns: [
        { type: 'phishing', delayTicks: 0 },
        { type: 'ddos', delayTicks: 15 },
        { type: 'ddos', delayTicks: 25 },
        { type: 'trojan', delayTicks: 50 },
        { type: 'phishing', delayTicks: 75 },
        { type: 'virus', delayTicks: 90 },
        { type: 'boss', delayTicks: 140 },
        { type: 'boss', delayTicks: 260 },
      ],
    },
  ],

  // ── Level 3 ──────────────────────────────────────────────────────────────
  [
    {
      interWaveDelayTicks: 180,
      spawns: [
        { type: 'trojan', delayTicks: 0 },
        { type: 'phishing', delayTicks: 20 },
        { type: 'trojan', delayTicks: 40 },
        { type: 'phishing', delayTicks: 60 },
        { type: 'ddos', delayTicks: 70 },
        { type: 'ddos', delayTicks: 80 },
        { type: 'ddos', delayTicks: 90 },
        { type: 'boss', delayTicks: 150 },
      ],
    },
    {
      interWaveDelayTicks: 180,
      spawns: [
        ...Array.from({ length: 8 }, (_, i) => ({ type: 'ddos' as const, delayTicks: i * 10 })),
        { type: 'phishing', delayTicks: 90 },
        { type: 'phishing', delayTicks: 120 },
        { type: 'boss', delayTicks: 170 },
        { type: 'trojan', delayTicks: 200 },
      ],
    },
    {
      interWaveDelayTicks: 180,
      spawns: [
        { type: 'boss', delayTicks: 0 },
        { type: 'trojan', delayTicks: 40 },
        { type: 'trojan', delayTicks: 70 },
        { type: 'boss', delayTicks: 180 },
        { type: 'phishing', delayTicks: 200 },
        { type: 'phishing', delayTicks: 220 },
      ],
    },
    {
      interWaveDelayTicks: 180,
      spawns: [
        { type: 'phishing', delayTicks: 0 },
        { type: 'ddos', delayTicks: 10 },
        { type: 'ddos', delayTicks: 20 },
        { type: 'boss', delayTicks: 60 },
        { type: 'trojan', delayTicks: 90 },
        { type: 'phishing', delayTicks: 120 },
        { type: 'boss', delayTicks: 200 },
        { type: 'ddos', delayTicks: 220 },
        { type: 'ddos', delayTicks: 230 },
      ],
    },
    {
      interWaveDelayTicks: 0,
      spawns: [
        { type: 'boss', delayTicks: 0 },
        { type: 'phishing', delayTicks: 30 },
        { type: 'ddos', delayTicks: 40 },
        { type: 'ddos', delayTicks: 50 },
        { type: 'trojan', delayTicks: 80 },
        { type: 'boss', delayTicks: 140 },
        { type: 'phishing', delayTicks: 170 },
        { type: 'boss', delayTicks: 280 },
        { type: 'ddos', delayTicks: 290 },
        { type: 'ddos', delayTicks: 300 },
      ],
    },
  ],
];

// ─── Inbox Emails (one per level, cycling) ────────────────────────────────
export const INBOX_EMAILS: InboxEmail[] = [
  {
    id: 'email1',
    senderKey: 'hackerDefense:inbox.email1.sender',
    subjectKey: 'hackerDefense:inbox.email1.subject',
    bodyKey: 'hackerDefense:inbox.email1.body',
    linkKey: 'hackerDefense:inbox.email1.link',
    isPhishing: true,
    explainKey: 'hackerDefense:inbox.email1.explain',
  },
  {
    id: 'email2',
    senderKey: 'hackerDefense:inbox.email2.sender',
    subjectKey: 'hackerDefense:inbox.email2.subject',
    bodyKey: 'hackerDefense:inbox.email2.body',
    linkKey: 'hackerDefense:inbox.email2.link',
    isPhishing: false,
    explainKey: 'hackerDefense:inbox.email2.explain',
  },
  {
    id: 'email3',
    senderKey: 'hackerDefense:inbox.email3.sender',
    subjectKey: 'hackerDefense:inbox.email3.subject',
    bodyKey: 'hackerDefense:inbox.email3.body',
    linkKey: 'hackerDefense:inbox.email3.link',
    isPhishing: true,
    explainKey: 'hackerDefense:inbox.email3.explain',
  },
];

// ─── Password Builder Options ──────────────────────────────────────────────
export const PASSWORD_OPTIONS = {
  upper: ['A', 'B', 'C', 'D', 'E', 'F'],
  lower: ['a', 'b', 'c', 'd', 'e', 'f'],
  number: ['1', '2', '3', '4', '5', '6'],
  symbol: ['@', '#', '$', '!', '%', '&'],
};

// ─── Game Config ─────────────────────────────────────────────────────────
export const GAME_CONFIG = {
  initialBankBalance: 10000,
  initialDataPoints: 150,
  tickMs: 50, // ms per game tick
  highScoreKey: 'hackerdefense_highscore',
  dataPacketSpawnInterval: 120, // ticks between packet spawns
  dataPacketValue: 30,
  dataPacketLife: 100, // ticks before disappear
  actionCommandWindow: 8, // ticks the action command window is open
  actionCommandMultiplier: 2.2, // damage multiplier on crit
  twoFATimeoutTicks: 60, // 3 seconds
  waveIncomingTicks: 60, // 3 seconds showing "wave incoming"
  maxLevel: 3,
  maxWave: 5,
  bossPopupLife: 160, // ticks
  bossPopupChance: 0.008, // per tick when boss is on field
  inboxTimerTicks: 100, // 5 seconds to decide
  inboxBonus: 500,
};

// ─── Cyber Pets ────────────────────────────────────────────────────────────
export const CYBER_PETS = [
  { id: 'privacy-dog', emoji: '🐕', unlockCondition: 'level1Complete', nameKey: 'hackerDefense:pets.dog' },
  { id: 'happy-lock', emoji: '🔓', unlockCondition: 'phishingMaster', nameKey: 'hackerDefense:pets.lock' },
  { id: 'shield', emoji: '🛡️', unlockCondition: 'twoFAMaster', nameKey: 'hackerDefense:pets.shield' },
];

// ─── Scorecard Rank ────────────────────────────────────────────────────────
export function getRank(balancePercent: number, phishingAcc: number): 'S' | 'A' | 'B' | 'C' {
  const score = balancePercent * 0.6 + phishingAcc * 0.4;
  if (score >= 0.85) return 'S';
  if (score >= 0.65) return 'A';
  if (score >= 0.45) return 'B';
  return 'C';
}
