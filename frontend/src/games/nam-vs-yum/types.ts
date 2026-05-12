export type GamePhase = 'START' | 'TUTORIAL' | 'PLAYING' | 'PAUSED' | 'LEVEL_COMPLETE' | 'ACHIEVEMENT_UNLOCKED' | 'GAME_OVER';

export type MonsterType = 'vitalio' | 'capricho';

export type ItemCategory = 'need' | 'want';

export type ItemVariant = 'normal' | 'golden' | 'bomb' | 'mystery' | 'rainbow' | 'unicorn';

export type PowerUpType = 'freezeTime' | 'scoreBoost' | 'extraLife' | 'magnet' | 'clearScreen' | 'slowMotion';

export type WeatherType = 'sunny' | 'rainy' | 'storm' | 'night' | 'goldenHour';

export type AchievementId =
  | 'firstSteps'
  | 'sorterApprentice'
  | 'sorterExpert'
  | 'sorterMaster'
  | 'comboStarter'
  | 'comboWarrior'
  | 'comboLegend'
  | 'perfectLevel'
  | 'highScorer'
  | 'scoreChampion'
  | 'scoreLegend'
  | 'survivor'
  | 'speedDemon'
  | 'mentorStudent'
  | 'easterEggHunter'
  | 'powerUpUser'
  | 'bombDefuser'
  | 'goldenTouch'
  | 'konamiMaster';

export type SkinId = 'classic' | 'gold' | 'ninja' | 'astronaut' | 'pirate' | 'robot';

export type ThemeId = 'sky' | 'forest' | 'space' | 'city';

export interface FallingItem {
  id: string;
  definitionKey: string;
  x: number;
  y: number;
  speed: number;
  rotation: number;
  rotationSpeed: number;
  isDragging: boolean;
  isConsumed: boolean;
  dragOffsetX: number;
  dragOffsetY: number;
  variant: ItemVariant;
  powerUpType?: PowerUpType;
  bombTimer?: number; // seconds remaining for bomb
  revealedCategory?: ItemCategory; // for mystery boxes
  sideVelocity?: number; // for zigzag movement
}

export interface GameItemDefinition {
  key: string;
  category: ItemCategory;
  emoji: string;
  imageUrl: string;
  tier: number;
}

export interface MentorTip {
  character: string;
  tipKey: string;
  nameKey: string;
}

export interface MentorCharacter {
  id: string;
  emoji: string;
  colorClass: string;
  tipKeys: string[];
  nameKey: string;
}

export interface DifficultyLevel {
  level: number;
  spawnIntervalMs: number;
  baseSpeed: number;
  speedVariance: number;
  maxSimultaneous: number;
  includesTier: number[];
  mentorTipChance: number;
  pointsPerCorrect: number;
  weather: WeatherType;
  specialMechanic?: 'none' | 'mystery' | 'bomb' | 'zigzag' | 'boss';
}

export interface PowerUpDefinition {
  type: PowerUpType;
  emoji: string;
  durationMs: number;
  spawnChance: number; // chance to appear as falling item
}

export interface AchievementDefinition {
  id: AchievementId;
  icon: string; // lucide icon name
  target: number;
  reward: number; // coins
}

export interface AchievementState {
  unlocked: boolean;
  progress: number;
  unlockedAt?: string;
}

export interface PlayerProgress {
  playerLevel: number;
  totalXp: number;
  coins: number;
  totalGamesPlayed: number;
  totalItemsSorted: number;
  maxComboEver: number;
  highestLevelReached: number;
  totalTimePlayedMs: number;
  accuracyNumerator: number;
  accuracyDenominator: number;
  achievements: Record<AchievementId, AchievementState>;
  equippedVitalioSkin: SkinId;
  equippedCaprichoSkin: SkinId;
  equippedTheme: ThemeId;
  unlockedSkins: SkinId[];
  unlockedThemes: ThemeId[];
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  level: number;
  date: string;
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  createdAt: number;
}

export interface ParticleBurst {
  id: string;
  x: number;
  y: number;
  color: string;
  count: number;
  createdAt: number;
}

export interface GameState {
  phase: GamePhase;
  score: number;
  lives: number;
  maxLives: number;
  combo: number;
  maxCombo: number;
  comboMultiplier: number;
  level: number;
  itemsSorted: number;
  itemsSortedThisLevel: number;
  itemsCorrectThisLevel: number;
  levelStartTime: number;
  fallingItems: FallingItem[];
  activeMentorTip: { character: string; tipKey: string; nameKey: string } | null;
  highScore: number;
  lastFeedback: 'correct' | 'incorrect' | null;
  feedbackTimestamp: number;
  draggingItemId: string | null;
  activePowerUp: { type: PowerUpType; endsAt: number } | null;
  frenzyCount: number; // consecutive correct without losing life
  isFrenzyMode: boolean;
  floatingTexts: FloatingText[];
  screenShake: boolean;
  levelFlash: boolean;
  newAchievements: AchievementId[];
  perfectLevelStreak: number; // consecutive perfect levels
}

export type GameAction =
  | { type: 'SHOW_TUTORIAL' }
  | { type: 'START_PLAYING' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'SPAWN_ITEM'; item: FallingItem }
  | { type: 'UPDATE_ITEMS'; items: FallingItem[] }
  | { type: 'REMOVE_ITEM'; id: string }
  | { type: 'START_DRAG'; id: string; offsetX: number; offsetY: number }
  | { type: 'MOVE_DRAG'; id: string; x: number; y: number }
  | { type: 'END_DRAG'; id: string }
  | { type: 'CORRECT_SORT'; id: string; points: number; wasGolden?: boolean; wasRainbow?: boolean }
  | { type: 'INCORRECT_SORT'; id: string; wasBomb?: boolean }
  | { type: 'ITEM_MISSED'; id: string; wasBomb?: boolean }
  | { type: 'LEVEL_UP' }
  | { type: 'SHOW_MENTOR_TIP'; tip: { character: string; tipKey: string; nameKey: string } }
  | { type: 'DISMISS_MENTOR_TIP' }
  | { type: 'CLEAR_FEEDBACK' }
  | { type: 'GAME_OVER' }
  | { type: 'RESET' }
  | { type: 'ACTIVATE_POWER_UP'; powerUp: PowerUpType; durationMs: number }
  | { type: 'DEACTIVATE_POWER_UP' }
  | { type: 'ADD_FLOATING_TEXT'; text: FloatingText }
  | { type: 'REMOVE_FLOATING_TEXT'; id: string }
  | { type: 'TRIGGER_SCREEN_SHAKE' }
  | { type: 'CLEAR_SCREEN_SHAKE' }
  | { type: 'TRIGGER_LEVEL_FLASH' }
  | { type: 'CLEAR_LEVEL_FLASH' }
  | { type: 'ENTER_FRENZY' }
  | { type: 'EXIT_FRENZY' }
  | { type: 'INCREMENT_FRENZY' }
  | { type: 'RESET_FRENZY' }
  | { type: 'ADD_ACHIEVEMENT'; id: AchievementId }
  | { type: 'CLEAR_NEW_ACHIEVEMENTS' }
  | { type: 'REVEAL_MYSTERY'; id: string; category: ItemCategory }
  | { type: 'TICK_BOMB'; id: string; newTimer: number }
  | { type: 'SHOW_LEVEL_COMPLETE' }
  | { type: 'DISMISS_LEVEL_COMPLETE' };
