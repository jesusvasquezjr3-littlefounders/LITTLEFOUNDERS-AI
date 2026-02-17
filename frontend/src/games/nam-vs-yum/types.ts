export type GamePhase = 'START' | 'TUTORIAL' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export type MonsterType = 'vitalio' | 'capricho';

export type ItemCategory = 'need' | 'want';

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
}

export interface GameItemDefinition {
  key: string;
  category: ItemCategory;
  emoji: string;
  imageUrl: string;
  tier: number;
}

export type MentorCharacter = 'drRho' | 'zara' | 'liruf' | 'dina';

export interface MentorTip {
  character: MentorCharacter;
  tipKey: string;
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
  fallingItems: FallingItem[];
  activeMentorTip: MentorTip | null;
  highScore: number;
  lastFeedback: 'correct' | 'incorrect' | null;
  feedbackTimestamp: number;
  draggingItemId: string | null;
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
  | { type: 'CORRECT_SORT'; id: string; points: number }
  | { type: 'INCORRECT_SORT'; id: string }
  | { type: 'ITEM_MISSED'; id: string }
  | { type: 'LEVEL_UP' }
  | { type: 'SHOW_MENTOR_TIP'; tip: MentorTip }
  | { type: 'DISMISS_MENTOR_TIP' }
  | { type: 'CLEAR_FEEDBACK' }
  | { type: 'GAME_OVER' }
  | { type: 'RESET' };
