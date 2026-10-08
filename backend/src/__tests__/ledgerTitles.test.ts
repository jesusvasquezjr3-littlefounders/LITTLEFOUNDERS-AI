import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { getLedgerTitles } from '../services/ledgerTitles.js';
import { jsonResponse } from './helpers.js';

/*
 * What a movement was for, by name. A bank statement that says only "Chore" or "Reward" makes a child decode their
 * own history, so each ledger row carries the title of the thing it points at: one batched read per kind, never one
 * per row, and a nameless row (not a failure) when nothing named is behind it.
 */

const TASK = randomUUID();
const GOAL = randomUUID();
const REDEMPTION = randomUUID();
const CATALOG = randomUUID();
const GIFT = randomUUID();
const DESTINATION = randomUUID();

afterEach(() => vi.unstubAllGlobals());

function stub(overrides: Record<string, unknown> = {}) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const answer = (table: string, rows: unknown) => (url.includes(`/rest/v1/${table}?`) ? Promise.resolve(jsonResponse(200, overrides[table] ?? rows)) : null);
    return answer('tasks', [{ id: TASK, title: 'Wash the dishes' }])
      ?? answer('savings_goals', [{ id: GOAL, title: 'New bike' }])
      ?? answer('redemptions', [{ id: REDEMPTION, catalog_id: CATALOG }])
      ?? answer('redemption_catalog', [{ id: CATALOG, title: 'Pick dinner' }])
      ?? answer('share_gifts', [{ id: GIFT, destination_id: DESTINATION }])
      ?? answer('share_destinations', [{ id: DESTINATION, title: 'Animal shelter' }])
      ?? Promise.resolve(jsonResponse(404, {}));
  }));
  return calls;
}

const row = (id: number, over: Partial<Parameters<typeof getLedgerTitles>[0][number]> = {}) => ({ id, task_id: null, goal_id: null, redemption_id: null, share_gift_id: null, ...over });

describe('getLedgerTitles', () => {
  it('names a chore, a reward, a goal and the place a gift went to, each from one batched read', async () => {
    const calls = stub();
    const titles = await getLedgerTitles([
      row(1, { task_id: TASK }), row(2, { redemption_id: REDEMPTION }), row(3, { goal_id: GOAL }), row(4, { share_gift_id: GIFT }), row(5, { task_id: TASK }),
    ]);
    expect(titles).not.toBeNull();
    expect([...titles!.entries()]).toEqual([[1, 'Wash the dishes'], [2, 'Pick dinner'], [3, 'New bike'], [4, 'Animal shelter'], [5, 'Wash the dishes']]);
    // Two chores, one read of tasks; never a read per row.
    expect(calls.filter((url) => url.includes('/rest/v1/tasks?'))).toHaveLength(1);
  });

  it('prefers the thing it was for over the goal it was tied to, and leaves a plain row nameless', async () => {
    stub();
    const titles = await getLedgerTitles([row(1, { task_id: TASK, goal_id: GOAL }), row(2)]);
    expect(titles!.get(1)).toBe('Wash the dishes');
    expect(titles!.has(2)).toBe(false);
  });

  it('reads nothing when nothing is named, and says "unreadable" rather than inventing a name', async () => {
    const calls = stub();
    expect((await getLedgerTitles([row(1), row(2)]))!.size).toBe(0);
    expect(calls).toHaveLength(0);
    stub({ tasks: [{ id: TASK }] });
    expect(await getLedgerTitles([row(1, { task_id: TASK })])).toBeNull();
  });
});
