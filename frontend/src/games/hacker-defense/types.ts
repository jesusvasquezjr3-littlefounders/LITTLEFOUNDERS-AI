// ─── Game Phases ───────────────────────────────────────────────────────────
export type GamePhase =
  | 'START'
  | 'TUTORIAL'
  | 'INBOX'
  | 'WAVE_INCOMING'
  | 'PLAYING'
  | 'WAVE_CLEAR'
  | 'LEVEL_RESULT'
  | 'UPGRADE_MINIGAME'
  | 'VICTORY'
  | 'GAME_OVER'
  | 'PAUSED';

// ─── Enemy ────────────────────────────────────────────────────────────────
export type EnemyType = 'virus' | 'trojan' | 'phishing' | 'ddos' | 'boss';

export interface Enemy {
  id: string;
  type: EnemyType;
  hp: number;
  maxHp: number;
  speed: number; // px per tick (50ms)
  reward: number; // data points on kill
  stolen: number; // bank damage on reaching base
  distanceTraveled: number; // px along path
  x: number;
  y: number;
  disguised: boolean; // phishing: hidden from auto-targeting
  revealed: boolean; // phishing: revealed by antivirus or player
  slowed: boolean;
  slowTimer: number; // ticks remaining
  hitFlash: number; // ticks of visual hit flash
  shieldBreak: boolean; // boss: currently being stunned
  size: number; // visual radius px
  emoji: string; // fallback visual
}

// ─── Tower ────────────────────────────────────────────────────────────────
export type TowerType = 'password' | 'antivirus' | 'wall_2fa';

export interface Tower {
  id: string;
  type: TowerType;
  level: number; // 1-3
  slotId: number;
  x: number;
  y: number;
  range: number;
  damage: number;
  attackCooldownMax: number; // ticks between attacks
  attackCooldown: number; // current cooldown
  targetId: string | null;
  hp?: number; // wall_2fa only
  maxHp?: number;
  twoFATriggered?: boolean;
  shootFlash: number; // ticks of shoot animation
}

// ─── Tower Slot ──────────────────────────────────────────────────────────
export interface TowerSlot {
  id: number;
  x: number;
  y: number;
  occupied: boolean;
}

// ─── Projectile ──────────────────────────────────────────────────────────
export interface Projectile {
  id: string;
  towerId: string;
  targetId: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  damage: number;
  type: TowerType;
  speed: number;
  lifespan: number; // ticks
}

// ─── Particle / Effect ────────────────────────────────────────────────────
export interface Particle {
  id: string;
  x: number;
  y: number;
  emoji: string;
  vx: number;
  vy: number;
  life: number; // ticks remaining
  maxLife: number;
  scale: number;
}

// ─── Floating Damage Number ──────────────────────────────────────────────
export interface DamageNumber {
  id: string;
  x: number;
  y: number;
  value: number;
  isCrit: boolean;
  life: number;
}

// ─── Falling Data Packet ─────────────────────────────────────────────────
export interface DataPacket {
  id: string;
  x: number;
  y: number;
  value: number; // data points when collected
  life: number; // ticks before disappear
}

// ─── 2FA Overlay ─────────────────────────────────────────────────────────
export interface TwoFAState {
  towerId: string;
  code: string; // 4-digit code
  inputCode: string;
  timeLeft: number; // ticks (3 seconds = 60 ticks)
}

// ─── Boss Popup ───────────────────────────────────────────────────────────
export interface BossPopupState {
  id: string;
  closeX: number; // % of screen (0-100)
  closeY: number;
  life: number; // ticks to auto-dismiss
}

// ─── Inbox Email ──────────────────────────────────────────────────────────
export interface InboxEmail {
  id: string;
  senderKey: string;
  subjectKey: string;
  bodyKey: string;
  linkKey: string;
  isPhishing: boolean;
  explainKey: string;
}

// ─── Level Stats (for scorecard) ─────────────────────────────────────────
export interface LevelStats {
  phishingDetected: number;
  phishingMissed: number;
  inboxCorrect: boolean;
  twoFASuccess: number;
  twoFAFailed: number;
  bankBalanceStart: number;
  bankBalanceEnd: number;
  enemiesKilled: number;
  bossPopupsClosed: number;
}

// ─── Upgrade Minigame ────────────────────────────────────────────────────
export interface UpgradeMinigame {
  towerId: string;
  targetLevel: number;
  selected: {
    upper: string | null;
    lower: string | null;
    number: string | null;
    symbol: string | null;
  };
}

// ─── Wave Spawn ───────────────────────────────────────────────────────────
export interface EnemySpawn {
  type: EnemyType;
  delayTicks: number; // ticks after wave start
}

export interface WaveDef {
  spawns: EnemySpawn[];
  interWaveDelayTicks: number; // grace period after wave clear
}

// ─── Game State ──────────────────────────────────────────────────────────
export interface GameState {
  phase: GamePhase;
  level: number; // 1-3
  wave: number; // 1-5 per level
  bankBalance: number;
  maxBankBalance: number;
  dataPoints: number;
  score: number;
  highScore: number;

  enemies: Enemy[];
  towers: Tower[];
  slots: TowerSlot[];
  projectiles: Projectile[];
  particles: Particle[];
  damageNumbers: DamageNumber[];
  dataPackets: DataPacket[];

  waveActive: boolean;
  spawnQueue: EnemySpawn[];
  spawnTimer: number; // ticks since wave start
  nextPacketSpawn: number; // ticks until next data packet

  interWaveCountdown: number; // ticks before next wave
  waveIncomingCountdown: number; // ticks of WAVE_INCOMING screen

  selectedTowerType: TowerType | null;

  twoFA: TwoFAState | null;
  bossPopups: BossPopupState[];

  inboxEmail: InboxEmail | null;
  inboxDecision: 'phishing' | 'trust' | null;
  inboxBonus: number; // data points bonus from correct inbox decision
  inboxTimer: number; // ticks for inbox decision timeout

  upgradeMinigame: UpgradeMinigame | null;

  levelStats: LevelStats;
  previousPhase: GamePhase | null; // for pausing

  actionCommandWindow: number; // ticks of action command window (0 = closed)
  lastActionCommandTick: number; // last tick where action command was triggered

  tutorialStep: number;
  tickCount: number;
  waveKillCount: number;
  gameOverReason: 'balance' | 'wave' | null;
  unlockedPets: string[];
  allLevelStats: LevelStats[]; // per level
}

// ─── Game Actions ─────────────────────────────────────────────────────────
export type GameAction =
  | { type: 'START_GAME' }
  | { type: 'TUTORIAL_NEXT' }
  | { type: 'SKIP_TUTORIAL' }
  | { type: 'INBOX_PREVIEW_DECIDE'; decision: 'phishing' | 'trust' }
  | { type: 'INBOX_DECIDE' }
  | { type: 'TICK' }
  | { type: 'SELECT_TOWER_TYPE'; towerType: TowerType | null }
  | { type: 'PLACE_TOWER'; slotId: number }
  | { type: 'REQUEST_UPGRADE'; towerId: string }
  | { type: 'CONFIRM_UPGRADE'; password: { upper: string; lower: string; number: string; symbol: string } }
  | { type: 'CANCEL_UPGRADE' }
  | { type: 'COLLECT_PACKET'; packetId: string }
  | { type: 'ACTION_COMMAND' }
  | { type: 'TYPE_2FA'; char: string }
  | { type: 'SUBMIT_2FA' }
  | { type: 'CANCEL_2FA' }
  | { type: 'CLOSE_BOSS_POPUP'; popupId: string }
  | { type: 'MARK_PHISHING'; enemyId: string }
  | { type: 'NEXT_LEVEL' }
  | { type: 'RESTART' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' };
