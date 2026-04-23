export type PlacementDimension = 'numeracy' | 'saving' | 'investing' | 'security';
export type AdventureLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface PlacementItem {
  id: string;
  adventure: AdventureLevel;
  saga: number;
  dimension: PlacementDimension;
  difficulty: 1 | 2 | 3 | 4 | 5;
  type: 'multiple_choice' | 'true_false';
  question_es: string;
  question_en: string;
  /** Required when type === 'multiple_choice' */
  options_es?: string[];
  options_en?: string[];
  /** Index of correct option — required for multiple_choice */
  correct_index?: number;
  /** Required when type === 'true_false' */
  correct_bool?: boolean;
  expected_time_sec: number;
  tags: string[];
}

export interface PlacementResponse {
  itemId: string;
  correct: boolean;
  timeSec: number;
}

export interface PlacementState {
  phase: 'intro' | 'quiz' | 'closing';
  baseAdventure: AdventureLevel;
  startedAt: number;
  servedIds: string[];
  responses: PlacementResponse[];
  currentItem: PlacementItem | null;
  skipped: boolean;
  result: import('@/lib/guestProfile').PlacementResult | null;
}
