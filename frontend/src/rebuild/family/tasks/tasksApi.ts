/*
 * W2 Lane 4 (W2F.2): the client API layer of the rebuilt Tasks screens (F4-P,
 * the Tutor's board; F4-K, the child's board).
 *
 * Core is the only service called, through the transport the route adapter
 * injects (a fresh token per call; a failure while the browser is offline is
 * `NETWORK`), so this layer imports nothing outside the rebuild (Bible 02
 * rule 23). Every response is shape-checked: a screen never renders a state
 * the server did not return. Nothing here authorizes anything: Core admits a
 * Tutor by the verified guardian link and a child by `requireWalletAccess`
 * ('familyChild'), and the database re-checks every write (D.4).
 *
 * The decisions themselves (approve, send back, cancel, a reward's yes or
 * "not yet", each with its reason: D.17, D.18) are the wave-1 decision queue's
 * (familyAutonomyApi.ts); a chore is created by the wave-1 composer (D.10).
 * This layer reads the boards and runs the reward list (the catalog), the
 * child's pockets and the evidence photo through a port.
 *
 * Wire shapes are hand-mirrored from Core (`backend/src/routes/tasks.ts`,
 * `toWireTask`, `toWireCatalogItem`, `toWireRedemption`).
 */

import type { ConsoleTransport, Outcome } from '../console/consoleApi';
import { isMoneyRegister, type MoneyRegister } from '../moneyRegister';

export type { Outcome };

export type TaskStatus = 'open' | 'done' | 'approved' | 'cancelled';

export interface Task {
  id: string;
  assignedTo: string;
  title: string;
  rewardCoins: number;
  recurrence: 'once' | 'weekly';
  status: TaskStatus;
  /** An approved chore's coins are split (true) or still waiting to be split (false). */
  allocated: boolean;
  hasEvidence: boolean;
  requiresEvidence: boolean;
  cancelReason: string | null;
  /** D.10: an expected family contribution (0-2 coins) or a paid bonus task. */
  kind: 'contribution' | 'bonus';
  /** D.18: the child's own words when they marked it done. */
  childNote: string | null;
  createdAt: string;
}

export interface Reward { id: string; title: string; cost: number; active: boolean }
export type RequestStatus = 'requested' | 'approved' | 'denied' | 'fulfilled';
export interface RewardRequest { id: string; catalogId: string; kidUserId: string; status: RequestStatus }
export interface Pockets { save: number; spend: number; share: number }

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;
const isInstant = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const nullableString = (value: unknown): string | null | undefined => value === null || value === undefined ? null : isString(value) ? value : undefined;

async function call<T>(transport: ConsoleTransport, path: string, check: (data: unknown) => T | null,
  init: { method?: 'GET' | 'POST' | 'PATCH'; body?: unknown } = {}): Promise<Outcome<T>> {
  const result = await transport(path, init);
  if (result.error) return { ok: false, code: result.error.code };
  const data = check(result.data);
  return data === null ? { ok: false, code: 'INVALID_RESPONSE' } : { ok: true, data };
}

const listOf = <T>(value: unknown, key: string, item: (entry: unknown) => T | null): T[] | null => {
  if (!isObject(value) || !Array.isArray(value[key])) return null;
  const items = (value[key] as unknown[]).map(item);
  return items.every((entry): entry is T => entry !== null) ? items : null;
};

export function toTask(value: unknown): Task | null {
  if (!isObject(value)) return null;
  const cancelReason = nullableString(value.cancelReason);
  const childNote = nullableString(value.childNote);
  if (!isString(value.id) || !isString(value.assignedTo) || !isString(value.title) || !isCount(value.rewardCoins)
    || (value.recurrence !== 'once' && value.recurrence !== 'weekly') || !['open', 'done', 'approved', 'cancelled'].includes(value.status as string)
    || typeof value.allocated !== 'boolean' || typeof value.hasEvidence !== 'boolean' || typeof value.requiresEvidence !== 'boolean'
    || cancelReason === undefined || childNote === undefined || (value.kind !== 'contribution' && value.kind !== 'bonus') || !isInstant(value.createdAt)) return null;
  return {
    id: value.id, assignedTo: value.assignedTo, title: value.title, rewardCoins: value.rewardCoins, recurrence: value.recurrence, status: value.status as TaskStatus,
    allocated: value.allocated, hasEvidence: value.hasEvidence, requiresEvidence: value.requiresEvidence, cancelReason, kind: value.kind, childNote,
    createdAt: value.createdAt,
  };
}

function toReward(value: unknown): Reward | null {
  if (!isObject(value) || !isString(value.id) || !isString(value.title) || !isCount(value.cost) || value.cost < 1 || typeof value.active !== 'boolean') return null;
  return { id: value.id, title: value.title, cost: value.cost, active: value.active };
}

function toRequest(value: unknown): RewardRequest | null {
  if (!isObject(value) || !isString(value.id) || !isString(value.catalogId) || !isString(value.kidUserId)
    || !['requested', 'approved', 'denied', 'fulfilled'].includes(value.status as string)) return null;
  return { id: value.id, catalogId: value.catalogId, kidUserId: value.kidUserId, status: value.status as RequestStatus };
}

function toPockets(value: unknown): Pockets | null {
  const balances = isObject(value) ? value.balances : null;
  if (!isObject(balances) || !Number.isInteger(balances.save) || !Number.isInteger(balances.spend) || !Number.isInteger(balances.share)) return null;
  return { save: balances.save as number, spend: balances.spend as number, share: balances.share as number };
}

// ── F4-P: the Tutor's board ───────────────────────────────────────────────

export interface TutorBoard { tasks: Task[]; rewards: Reward[]; requests: RewardRequest[] }

/** Every chore this Tutor's children have, the Tutor's reward list and the reward requests (all four reads, or a failure with Core's code). */
export async function fetchTutorBoard(transport: ConsoleTransport): Promise<Outcome<TutorBoard>> {
  const [tasks, rewards, requests] = await Promise.all([
    call(transport, '/tasks', (data) => listOf(data, 'tasks', toTask)),
    call(transport, '/tasks/catalog', (data) => listOf(data, 'items', toReward)),
    call(transport, '/tasks/redemptions', (data) => listOf(data, 'redemptions', toRequest)),
  ]);
  if (!tasks.ok) return tasks;
  if (!rewards.ok) return rewards;
  if (!requests.ok) return requests;
  return { ok: true, data: { tasks: tasks.data, rewards: rewards.data, requests: requests.data } };
}

export const REWARD_COST_MAX = 500;
export const REWARD_TITLE_MAX = 120;

export function createReward(transport: ConsoleTransport, input: { title: string; cost: number }) {
  return call(transport, '/tasks/catalog', (data) => isObject(data) ? toReward(data.item) : null, { method: 'POST', body: input });
}

/** Offer a reward again or pause it; the answer is the item as Core holds it. */
export function setRewardOffered(transport: ConsoleTransport, id: string, active: boolean) {
  return call(transport, `/tasks/catalog/${encodeURIComponent(id)}`, (data) => {
    const item = isObject(data) ? toReward(data.item) : null;
    return item && item.id === id && item.active === active ? item : null;
  }, { method: 'PATCH', body: { active } });
}

/** The three glance numbers, computed from what Core returned (never stored). */
export function glance(board: TutorBoard): { toApprove: number; asked: number; coinsGiven: number } {
  return {
    toApprove: board.tasks.filter((task) => task.status === 'done').length,
    asked: board.requests.filter((request) => request.status === 'requested').length,
    coinsGiven: board.tasks.filter((task) => task.status === 'approved').reduce((sum, task) => sum + task.rewardCoins, 0),
  };
}

// ── F4-K: the child's board ───────────────────────────────────────────────

export interface ChildBoard { tasks: Task[]; pockets: Pockets; rewards: Reward[]; requests: RewardRequest[] }

export async function fetchChildBoard(transport: ConsoleTransport): Promise<Outcome<ChildBoard>> {
  const [tasks, pockets, rewards, requests] = await Promise.all([
    call(transport, '/tasks/mine', (data) => listOf(data, 'tasks', toTask)),
    call(transport, '/tasks/wallet', toPockets),
    call(transport, '/tasks/catalog/available', (data) => listOf(data, 'items', toReward)),
    call(transport, '/tasks/redemptions/mine', (data) => listOf(data, 'redemptions', toRequest)),
  ]);
  if (!tasks.ok) return tasks;
  if (!pockets.ok) return pockets;
  if (!rewards.ok) return rewards;
  if (!requests.ok) return requests;
  return { ok: true, data: { tasks: tasks.data, pockets: pockets.data, rewards: rewards.data, requests: requests.data } };
}

/**
 * D.12: the reader's age register, decided by the database from age evidence
 * and read from Core; a screen presents the young register until it is known
 * and whenever it cannot be read (the S07.6 conservative default).
 */
export function fetchRegister(transport: ConsoleTransport) {
  return call(transport, '/banking/register', (data): MoneyRegister | null => isObject(data) && isMoneyRegister(data.register) ? data.register : null);
}

/**
 * The evidence photo, through the route adapter: an upload is multipart, and
 * the picture is only ever fetched through Core's authenticated
 * `GET /tasks/:id/evidence` proxy and shown from a local object URL (never a
 * storage URL, §1.9). `release` frees an object URL the screen no longer shows.
 * `pick` opens the platform's own camera or file chooser (no control drawn in
 * the page) and answers the chosen picture, or null when nothing was chosen.
 */
export interface PhotoPort {
  pick: () => Promise<File | null>;
  upload: (taskId: string, file: File) => Promise<Outcome<true>>;
  load: (taskId: string) => Promise<Outcome<string>>;
  release: (url: string) => void;
}

/** What the child's board shows, in the order a child acts on it. */
export function childChores(tasks: Task[]) {
  return {
    // A family contribution with no coins has nothing to split (D.10).
    toSplit: tasks.filter((task) => task.status === 'approved' && !task.allocated && task.rewardCoins > 0),
    todo: [...tasks.filter((task) => task.status === 'open'), ...tasks.filter((task) => task.status === 'done')],
  };
}

/** What the Tutor's chore list shows: waiting first, then open, then the ten latest closed. */
export function tutorChores(tasks: Task[]) {
  return {
    waiting: tasks.filter((task) => task.status === 'done'),
    open: tasks.filter((task) => task.status === 'open'),
    recent: tasks.filter((task) => task.status === 'approved' || task.status === 'cancelled').slice(0, 10),
  };
}
