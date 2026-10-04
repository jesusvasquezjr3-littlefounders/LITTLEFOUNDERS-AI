/** The things a stall may sell: a closed vocabulary, so the payload carries no words and each locale names them in its own copy. */
export const STALL_IDS = ['apple', 'bread', 'juice', 'toy', 'book', 'pen', 'cap', 'kite', 'shell', 'stamp'] as const;
export type StallId = (typeof STALL_IDS)[number];
export const STALL_PIECE = 'item';
export const STALL_LIMITS = {
  items: { min: 2, max: 5 },
  price: { min: 1, max: 2000 },
  stock: { min: 1, max: 9 },
  total: { max: 10_000 },
} as const;

export const isStallId = (value: unknown): value is StallId => typeof value === 'string' && (STALL_IDS as readonly string[]).includes(value);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const whole = (value: unknown, minimum: number, maximum: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;

/** Prices are whole cents of a generic currency: no real currency is named. */
export interface StallItem { id: StallId; price: number; stock: number }
export type StallGoal =
  | { kind: 'exact'; total: number }
  | { kind: 'change'; paid: number; change: number }
  | { kind: 'most'; budget: number };
export interface StallPayload { items: StallItem[]; goal: StallGoal }
/** How many of each item the basket holds, keyed by item id. */
export type Basket = Readonly<Record<string, number>>;

function readGoal(value: unknown): StallGoal | null {
  if (!isRecord(value)) return null;
  const { total } = STALL_LIMITS;
  if (value.kind === 'exact' && exactKeys(value, ['kind', 'total']) && whole(value.total, 1, total.max)) return { kind: 'exact', total: value.total };
  if (value.kind === 'most' && exactKeys(value, ['kind', 'budget']) && whole(value.budget, 1, total.max)) return { kind: 'most', budget: value.budget };
  if (value.kind === 'change' && exactKeys(value, ['kind', 'paid', 'change']) && whole(value.paid, 2, total.max) && whole(value.change, 1, value.paid - 1)) {
    return { kind: 'change', paid: value.paid, change: value.change };
  }
  return null;
}

export function readStallPayload(value: unknown): StallPayload | null {
  if (!isRecord(value) || !exactKeys(value, ['items', 'goal'])) return null;
  const { items } = value;
  if (!Array.isArray(items) || items.length < STALL_LIMITS.items.min || items.length > STALL_LIMITS.items.max) return null;
  const read: StallItem[] = [];
  for (const entry of items) {
    if (!isRecord(entry) || !exactKeys(entry, ['id', 'price', 'stock']) || !isStallId(entry.id)) return null;
    if (!whole(entry.price, STALL_LIMITS.price.min, STALL_LIMITS.price.max) || !whole(entry.stock, STALL_LIMITS.stock.min, STALL_LIMITS.stock.max)) return null;
    read.push({ id: entry.id, price: entry.price, stock: entry.stock });
  }
  if (new Set(read.map((item) => item.id)).size !== read.length) return null;
  const goal = readGoal(value.goal);
  return goal ? { items: read, goal } : null;
}

/** What the basket must come to: the exact total, or the price paid less the change. `most` has no fixed total. */
export const goalTotal = (goal: StallGoal): number | null => (goal.kind === 'exact' ? goal.total : goal.kind === 'change' ? goal.paid - goal.change : null);

export const basketCount = (basket: Basket): number => Object.values(basket).reduce((sum, count) => sum + count, 0);
export const basketCost = (items: readonly StallItem[], basket: Basket): number => items.reduce((sum, item) => sum + item.price * (basket[item.id] ?? 0), 0);

/** The most things the budget buys: cheapest first is optimal when every purchase is one item. */
export function mostItems(items: readonly StallItem[], budget: number): number {
  let left = budget;
  let bought = 0;
  for (const item of [...items].sort((a, b) => a.price - b.price)) {
    const afford = Math.min(item.stock, Math.floor(left / item.price));
    bought += afford;
    left -= afford * item.price;
  }
  return bought;
}

/** The rule every right basket satisfies, so many baskets can be right: the sum hits the total, or it is the biggest bag the budget buys. */
export function basketMeets(payload: StallPayload, basket: Basket): boolean {
  const count = basketCount(basket);
  if (count === 0) return false;
  const cost = basketCost(payload.items, basket);
  const total = goalTotal(payload.goal);
  if (total !== null) return cost === total;
  const { budget } = payload.goal as { kind: 'most'; budget: number };
  return cost <= budget && count === mostItems(payload.items, budget);
}

/** The basket a slot map holds; null for an unknown slot, anything but an item, or more than the stall has. An empty map is an empty basket. */
export function slotsToBasket(slots: unknown, payload: StallPayload): Basket | null {
  if (!isRecord(slots)) return null;
  const stock = new Map(payload.items.map((item) => [item.id as string, item.stock]));
  const basket: Record<string, number> = {};
  for (const [slot, pieces] of Object.entries(slots)) {
    const limit = stock.get(slot);
    if (limit === undefined || !Array.isArray(pieces) || pieces.length > limit || pieces.some((piece) => piece !== STALL_PIECE)) return null;
    if (pieces.length > 0) basket[slot] = pieces.length;
  }
  return basket;
}

export function basketToSlots(basket: Basket): Record<string, string[]> {
  return Object.fromEntries(Object.entries(basket).filter(([, count]) => count > 0).map(([slot, count]) => [slot, Array.from({ length: count }, () => STALL_PIECE)]));
}

/** The arrangement context of the stall: one repeatable piece, a slot per item holding up to its stock. */
export function stallContext(payload: StallPayload): { pieceIds: string[]; slotIds: string[]; capacities: Record<string, number>; repeatable: true } {
  return {
    pieceIds: [STALL_PIECE],
    slotIds: payload.items.map((item) => item.id),
    capacities: Object.fromEntries(payload.items.map((item) => [item.id, item.stock])),
    repeatable: true,
  };
}

/** Every total some basket reaches, found by counting up one item at a time (at most 5 items, 9 each, 10,000 cents). */
export function reachableTotals(items: readonly StallItem[], limit: number): Set<number> {
  let sums = new Set<number>([0]);
  for (const item of items) {
    const next = new Set<number>();
    for (const sum of sums) {
      for (let count = 0; count <= item.stock && sum + count * item.price <= limit; count += 1) next.add(sum + count * item.price);
    }
    sums = next;
  }
  return sums;
}

/** One basket that reaches the total, or null when none does. */
export function basketFor(items: readonly StallItem[], total: number): Basket | null {
  const visit = (index: number, left: number, chosen: Record<string, number>): Record<string, number> | null => {
    if (left === 0) return chosen;
    if (index === items.length) return null;
    const item = items[index]!;
    for (let count = Math.min(item.stock, Math.floor(left / item.price)); count >= 0; count -= 1) {
      const found = visit(index + 1, left - count * item.price, count > 0 ? { ...chosen, [item.id]: count } : chosen);
      if (found) return found;
    }
    return null;
  };
  return total > 0 ? visit(0, total, {}) : null;
}

/** One basket of the biggest size the budget buys, cheapest first. */
export function biggestBasket(items: readonly StallItem[], budget: number): Basket {
  let left = budget;
  const basket: Record<string, number> = {};
  for (const item of [...items].sort((a, b) => a.price - b.price)) {
    const afford = Math.min(item.stock, Math.floor(left / item.price));
    if (afford > 0) basket[item.id] = afford;
    left -= afford * item.price;
  }
  return basket;
}

/** A correct basket for the goal, or null when the question has none. */
export function stallAnswer(payload: StallPayload): Basket | null {
  const total = goalTotal(payload.goal);
  if (total !== null) return basketFor(payload.items, total);
  const { budget } = payload.goal as { kind: 'most'; budget: number };
  const basket = biggestBasket(payload.items, budget);
  return basketCount(basket) > 0 ? basket : null;
}

export function stallProblem(payload: StallPayload): string | null {
  const sold = payload.items.reduce((sum, item) => sum + item.price * item.stock, 0);
  const total = goalTotal(payload.goal);
  if (total !== null) {
    if (total > sold) return 'The stall does not hold enough to reach the total';
    return reachableTotals(payload.items, total).has(total) ? null : 'No basket of these items adds up to the total';
  }
  const { budget } = payload.goal as { kind: 'most'; budget: number };
  if (budget < Math.min(...payload.items.map((item) => item.price))) return 'The budget does not buy even the cheapest item';
  if (budget >= sold) return 'The budget must not cover the whole stall, or there is nothing to choose';
  return null;
}
