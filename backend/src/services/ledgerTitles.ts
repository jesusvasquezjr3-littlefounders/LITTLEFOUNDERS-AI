import { z } from 'zod';
import { serviceRest } from './supabaseRest.js';

/*
 * What a movement was for, by name: the chore ("Wash the dishes"), the reward
 * ("Pick dinner"), the goal ("New bike"), the place a gift went to. A bank
 * statement that says only "Chore" or "Reward" makes a child decode their own
 * history, so each ledger row carries the title of the thing it points at.
 * Titles are what a family typed (user content), never system words.
 *
 * Reads only: one batched query per kind, never one per row. null = unreadable,
 * and the caller refuses rather than showing a nameless movement as if it were whole.
 */

const UUID = z.string().uuid();
const eu = (value: string) => encodeURIComponent(UUID.parse(value));
const Titled = z.array(z.object({ id: UUID, title: z.string() }));
const Redemptions = z.array(z.object({ id: UUID, catalog_id: UUID }));
const Gifts = z.array(z.object({ id: UUID, destination_id: UUID }));

export interface TitledRow {
  id: number;
  task_id: string | null;
  goal_id: string | null;
  redemption_id: string | null;
  share_gift_id?: string | null;
}

const unique = (ids: (string | null | undefined)[]) => [...new Set(ids.filter((id): id is string => typeof id === 'string'))];

async function titles(table: string, ids: string[]): Promise<Map<string, string> | null> {
  if (ids.length === 0) return new Map();
  const rows = Titled.safeParse(await serviceRest<unknown>(`/${table}?id=in.(${ids.map(eu).join(',')})&select=id,title`));
  return rows.success ? new Map(rows.data.map((r) => [r.id, r.title])) : null;
}

/** One title per ledger row that has a named thing behind it, keyed by the row's id. */
export async function getLedgerTitles(entries: TitledRow[]): Promise<Map<number, string> | null> {
  const redemptionIds = unique(entries.map((e) => e.redemption_id));
  const giftIds = unique(entries.map((e) => e.share_gift_id));
  const [tasks, goals] = await Promise.all([titles('tasks', unique(entries.map((e) => e.task_id))), titles('savings_goals', unique(entries.map((e) => e.goal_id)))]);
  if (tasks === null || goals === null) return null;

  const rewardOf = new Map<string, string>();
  if (redemptionIds.length > 0) {
    const redemptions = Redemptions.safeParse(await serviceRest<unknown>(`/redemptions?id=in.(${redemptionIds.map(eu).join(',')})&select=id,catalog_id`));
    if (!redemptions.success) return null;
    const catalog = await titles('redemption_catalog', unique(redemptions.data.map((r) => r.catalog_id)));
    if (catalog === null) return null;
    for (const r of redemptions.data) { const t = catalog.get(r.catalog_id); if (t) rewardOf.set(r.id, t); }
  }

  const placeOf = new Map<string, string>();
  if (giftIds.length > 0) {
    const gifts = Gifts.safeParse(await serviceRest<unknown>(`/share_gifts?id=in.(${giftIds.map(eu).join(',')})&select=id,destination_id`));
    if (!gifts.success) return null;
    const places = await titles('share_destinations', unique(gifts.data.map((g) => g.destination_id)));
    if (places === null) return null;
    for (const g of gifts.data) { const t = places.get(g.destination_id); if (t) placeOf.set(g.id, t); }
  }

  const out = new Map<number, string>();
  for (const e of entries) {
    const title = (e.redemption_id && rewardOf.get(e.redemption_id)) || (e.task_id && tasks.get(e.task_id)) || (e.share_gift_id && placeOf.get(e.share_gift_id))
      || (e.goal_id && goals.get(e.goal_id)) || null;
    if (title) out.set(e.id, title);
  }
  return out;
}
