/*
 * Wire shapes for /api/v1/banca — camelCase, mirroring backend/src/routes/banca.ts's
 * toWire* mappers (never the raw snake_case DB row). See ../tasks/types.ts
 * for the sibling shapes this feature reads alongside (WireTask, WireGoal).
 */

export type CardDesign = 'indigo' | 'emerald' | 'violet' | 'amber' | 'sunrise' | 'ocean';
export type AllowanceFrequency = 'weekly' | 'biweekly' | 'monthly';
export type SpendLimitPeriod = 'weekly' | 'monthly';

export const CARD_DESIGNS: CardDesign[] = ['indigo', 'emerald', 'violet', 'amber', 'sunrise', 'ocean'];

export interface WireBancaAccount {
  nickname: string;
  cardDesign: CardDesign;
  displayNumber: string;
  frozen: boolean;
  frozenBy: string | null;
  frozenAt: string | null;
  openedAt: string;
}

export interface WireAllowanceRule {
  amount: number;
  frequency: AllowanceFrequency;
  anchorDay: number;
  active: boolean;
  nextRunAt: string;
}

export interface WireSavingsBonusRule {
  rateBp: number;
  active: boolean;
  nextRunAt: string;
}

export type WireSpendLimitStatus =
  | { configured: false }
  | { configured: true; period: SpendLimitPeriod; cap: number; used: number; remaining: number };

export interface WirePendingCredit {
  id: string;
  amount: number;
  source: 'allowance';
  createdAt: string;
}

export interface WireStatementEntry {
  id: number;
  bucket: 'save' | 'spend' | 'share';
  amount: number;
  reason: string;
  taskId: string | null;
  goalId: string | null;
  createdAt: string;
}

export interface WireStatement {
  month: string;
  earned: number;
  spent: number;
  saved: number;
  entries: WireStatementEntry[];
}

export const DAY_OF_WEEK_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
