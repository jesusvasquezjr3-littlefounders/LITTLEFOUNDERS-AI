/*
 * Wire shapes for /api/v1/tasks — camelCase, mirroring backend/src/routes/tasks.ts's
 * toWire* mappers (never the raw snake_case DB row).
 */

export type TaskStatus = 'open' | 'done' | 'approved' | 'cancelled';
export type GoalStatus = 'active' | 'reached' | 'archived';
export type RedemptionStatus = 'requested' | 'approved' | 'denied' | 'fulfilled';
export type GoalIcon = 'star' | 'game' | 'toy' | 'book' | 'bike' | 'trip' | 'gift';

export interface WireTask {
  id: string;
  assignedBy: string;
  assignedTo: string;
  title: string;
  rewardCoins: number;
  recurrence: 'once' | 'weekly';
  dueAt: string | null;
  status: TaskStatus;
  allocated: boolean;
  createdAt: string;
  hasEvidence: boolean;
  requiresEvidence: boolean;
  cancelReason: string | null;
  /** S07.3 (D.10): an expected family contribution (0-2 coins) or a paid bonus task. */
  kind: 'contribution' | 'bonus';
  /** S07.3 (D.2): the child's local day of the completion. */
  completedOn: string | null;
}

export interface WireGoal {
  id: string;
  kidUserId: string;
  title: string;
  target: number;
  icon: GoalIcon;
  status: GoalStatus;
  createdAt: string;
  reachedAt: string | null;
  saved: number;
}

export interface WireCatalogItem {
  id: string;
  parentUserId: string;
  title: string;
  cost: number;
  active: boolean;
  createdAt: string;
}

export interface WireRedemption {
  id: string;
  catalogId: string;
  kidUserId: string;
  status: RedemptionStatus;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
}

export interface WalletBalances {
  save: number;
  spend: number;
  share: number;
}

export type LedgerReason = 'task_approved' | 'redemption' | 'manual_adjustment' | 'share_gift' | 'share_gift_returned';
export type LedgerBucket = 'save' | 'spend' | 'share';

export interface WireLedgerEntry {
  id: number;
  bucket: LedgerBucket;
  amount: number;
  reason: LedgerReason;
  taskId: string | null;
  goalId: string | null;
  redemptionId: string | null;
  createdAt: string;
}

export const GOAL_ICONS: GoalIcon[] = ['star', 'game', 'toy', 'book', 'bike', 'trip', 'gift'];

/** Material Symbols ligature for a goal icon — a closed, verified-real set (Icon.tsx's own fallback would swap in "help" for anything invented). */
export const GOAL_ICON_GLYPH: Record<GoalIcon, string> = {
  star: 'stars',
  game: 'sports_esports',
  toy: 'toys',
  book: 'menu_book',
  bike: 'pedal_bike',
  trip: 'flight',
  gift: 'card_giftcard',
};
