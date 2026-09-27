import type { TrayDemoStep } from './types';

/*
 * THE DEMONSTRATION DRIVER (Tutor v3; widened to 6 segment types
 * 2026-09-02/03, /TUTOR_INSTRUMENTS.md Sprint 2 — but see the LIVE VOCABULARY
 * note below before assuming all 6 actually fire).
 *
 * "Mira, si agrego esta moneda…" — the tutor MOVES the open activity's own
 * controlled draft while speaking. Every demonstrable renderer already owns a
 * draft it re-renders from (`onChange` is how a real tap changes it), so a
 * demonstration is nothing more exotic than a sequence of the SAME draft
 * updates on a timer: no new renderer, no ref plumbing into the lesson
 * engine, and the animation is exactly the state change a real tap produces —
 * which is what makes it honest.
 *
 * ONE ADAPTER PER FAMILY, not one driver that special-cases six `type`
 * strings inline. `coin_count`/`make_change` (the original two) apply
 * `add`/`remove` against a `picked` array; `order_steps` applies `place`
 * against an `order` array; `sort_buckets` applies `assign` against an
 * `assignments` map; `match_pairs` applies `pair` against a `pairs` list;
 * `number_line` applies `move` against a bare `value`. Each adapter is
 * FAIL-SAFE THE SAME WAY the original money adapter always was: a step
 * naming an id/denomination/value the segment's own payload does not offer is
 * dropped silently, never applied and never an error — the schema upstream
 * only bounds the SHAPE of a step, this bounds its CONTENT against the one
 * segment it is actually allowed to touch.
 *
 * LIVE VOCABULARY vs. DEFINED VOCABULARY — these are NOT the same set, on
 * purpose. `oracle/src/tutor/prompt.ts` only ever invites the model to emit
 * `add`/`remove`/`pause` (money) and `move` (number_line): `orchestrator.ts`
 * never builds the served segment's real item/bucket ids into the model's
 * context, so a `place`/`assign`/`pair` step can only ever name a GUESSED id.
 * For money and the number line, a guess that misses is harmless (dropped
 * below, no partial state is ever "wrong"). For `order_steps`/`sort_buckets`/
 * `match_pairs`, a placement IS the graded answer — a guess that happens to
 * land on a real id would move the child's own draft with no check behind it,
 * risking the tutor visibly asserting a WRONG placement while narrating as if
 * it were correct. So `orderStepsAdapter`/`sortBucketsAdapter`/
 * `matchPairsAdapter` below are real, tested, and CURRENTLY UNREACHABLE in
 * production: nothing in the prompt ever asks the model to emit the steps
 * they handle. Kept as forward-compatible infrastructure for when the ids gap
 * is closed (or product accepts a non-committal placement), not dead code —
 * see the matching comment on the `"demonstrate"` shape line in prompt.ts.
 */

/** One step applied to one family's draft. Returns the NEXT draft, or `null` to drop the step (fail-safe). */
type DemoAdapter = (payload: Record<string, unknown>, draft: unknown, step: TrayDemoStep) => unknown | null;

function idsOf(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  const ids = value
    .map((v) => (v && typeof v === 'object' && 'id' in v ? (v as { id: unknown }).id : undefined))
    .filter((id): id is string => typeof id === 'string');
  return new Set(ids);
}

const moneyAdapter: DemoAdapter = (payload, draft, step) => {
  const allowed = new Set((payload.denominations as unknown[] | undefined)?.filter((d) => typeof d === 'number'));
  if (step.kind !== 'add' && step.kind !== 'remove') return null;
  if (typeof step.denomination !== 'number' || !allowed.has(step.denomination)) return null;
  const picked = Array.isArray((draft as { picked?: unknown })?.picked) ? ((draft as { picked: number[] }).picked) : [];
  if (step.kind === 'add') return { picked: [...picked, step.denomination] };
  const index = picked.lastIndexOf(step.denomination);
  if (index === -1) return null;
  return { picked: picked.filter((_, i) => i !== index) };
};

/** `order_steps` — one item, tapped into the next open slot. Mirrors `useTapOrder.place` exactly. */
const orderStepsAdapter: DemoAdapter = (payload, draft, step) => {
  if (step.kind !== 'place' || typeof step.item !== 'string') return null;
  const validIds = idsOf(payload.items);
  if (!validIds.has(step.item)) return null;
  const order = Array.isArray((draft as { order?: unknown })?.order) ? ((draft as { order: string[] }).order) : [];
  if (order.includes(step.item)) return null; // already placed — nothing to demonstrate
  const slots = typeof payload.slots === 'number' ? payload.slots : validIds.size;
  if (order.length >= slots) return null;
  return { order: [...order, step.item] };
};

/** `sort_buckets` — one item, assigned to one bucket. Mirrors `SortingBoard.onAssign` exactly. */
const sortBucketsAdapter: DemoAdapter = (payload, draft, step) => {
  if (step.kind !== 'assign' || typeof step.item !== 'string' || typeof step.bucket !== 'string') return null;
  const validItems = idsOf(payload.items);
  const validBuckets = idsOf(payload.buckets);
  if (!validItems.has(step.item) || !validBuckets.has(step.bucket)) return null;
  const assignments = ((draft as { assignments?: unknown })?.assignments ?? {}) as Record<string, string>;
  return { selected: undefined, assignments: { ...assignments, [step.item]: step.bucket } };
};

/** `match_pairs` — one left id and one right id, committed as a pair. Mirrors the two-tap sequence in one legal move. */
const matchPairsAdapter: DemoAdapter = (payload, draft, step) => {
  if (step.kind !== 'pair' || typeof step.left !== 'string' || typeof step.right !== 'string') return null;
  const validLeft = idsOf(payload.left);
  const validRight = idsOf(payload.right);
  if (!validLeft.has(step.left) || !validRight.has(step.right)) return null;
  const pairs = Array.isArray((draft as { pairs?: unknown })?.pairs) ? ((draft as { pairs: [string, string][] }).pairs) : [];
  if (pairs.some(([l, r]) => l === step.left || r === step.right)) return null; // either side already paired
  return { selected_left: undefined, pairs: [...pairs, [step.left, step.right]] };
};

/** `number_line` — the marker, moved to one value. Mirrors the real `onTap` handler's own clamp. */
const numberLineAdapter: DemoAdapter = (payload, _draft, step) => {
  if (step.kind !== 'move' || typeof step.value !== 'number') return null;
  const min = typeof payload.min === 'number' ? payload.min : Number.NEGATIVE_INFINITY;
  const max = typeof payload.max === 'number' ? payload.max : Number.POSITIVE_INFINITY;
  if (min > max) return null;
  return { value: Math.max(min, Math.min(max, step.value)), touched: true };
};

/** Every segment type a demonstration may touch, and the adapter that knows its draft shape. */
const DEMO_ADAPTERS: Record<string, DemoAdapter> = {
  coin_count: moneyAdapter,
  make_change: moneyAdapter,
  order_steps: orderStepsAdapter,
  sort_buckets: sortBucketsAdapter,
  match_pairs: matchPairsAdapter,
  number_line: numberLineAdapter,
};

/** Kept for the one caller (`mayDemonstrate`'s own doc comment history) and the test file that names it directly. */
export const TRAY_TYPES = new Set(Object.keys(DEMO_ADAPTERS));

/**
 * WHETHER THE TUTOR MAY TOUCH THIS SEGMENT RIGHT NOW.
 *
 * Four guards, each protecting a child's unsubmitted answer, and they lived
 * inside a `useEffect` in a component with no test file — so the only thing
 * holding them was that nobody edited them. Pulled out here because a rule
 * about when it is safe to write into someone's answer should be checkable
 * without mounting a panel.
 *
 * - A demo already played must not replay: the same `seq` arriving twice is a
 *   re-render, not a second instruction.
 * - A demo aimed at a segment type with no adapter has nothing that knows how
 *   to move it.
 * - A demo for an activity the learner already got right would rewrite an
 *   answer that has been graded and paid.
 * - An empty payload (no denominations, no items, no min/max…) offers no
 *   legal move at all — checked once, generically, here, so every adapter
 *   above can assume it is never called against nothing to work with.
 */
export function mayDemonstrate(input: {
  demoSeq: number | null;
  lastPlayedSeq: number;
  segmentType: string;
  answeredCorrectly: boolean;
  payload: Record<string, unknown>;
}): boolean {
  if (input.demoSeq === null || input.demoSeq === input.lastPlayedSeq) return false;
  if (!(input.segmentType in DEMO_ADAPTERS)) return false;
  if (input.answeredCorrectly) return false;
  const p = input.payload;
  return (
    (Array.isArray(p.denominations) && p.denominations.length > 0) ||
    (Array.isArray(p.items) && p.items.length > 0) ||
    (Array.isArray(p.left) && p.left.length > 0 && Array.isArray(p.right) && p.right.length > 0) ||
    (typeof p.min === 'number' && typeof p.max === 'number')
  );
}

const DEFAULT_STEP_MS = 700;

export interface TrayDemoIo {
  getDraft: () => unknown;
  setDraft: (next: unknown) => void;
}

const wait = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(id);
        resolve();
      },
      { once: true },
    );
  });

/**
 * Runs the steps against the live segment's draft, through the adapter its
 * type owns. Resolves when done or aborted. `payload` is the segment's own —
 * the only values a demo may reference.
 */
export async function runTrayDemo(
  segmentType: string,
  payload: Record<string, unknown>,
  steps: TrayDemoStep[],
  io: TrayDemoIo,
  opts: { signal?: AbortSignal; stepMs?: number } = {},
): Promise<void> {
  const adapter = DEMO_ADAPTERS[segmentType];
  if (!adapter) return; // mayDemonstrate already guards this; defense in depth.
  const stepMs = opts.stepMs ?? DEFAULT_STEP_MS;

  for (const step of steps.slice(0, 8)) {
    if (opts.signal?.aborted) return;
    if (step.kind === 'pause') {
      await wait(Math.min(Math.max(step.ms ?? 500, 100), 2_000), opts.signal);
      continue;
    }
    const next = adapter(payload, io.getDraft(), step);
    if (next === null) continue; // dropped, fail-safe
    io.setDraft(next);
    await wait(stepMs, opts.signal);
  }
}
