import { z } from 'zod';
import { serviceRest } from './supabaseRest.js';

const UserId = z.string().uuid();
const Origins = z.array(z.object({ under13_origin: z.literal(true) }).strict()).max(1);

/** Internal safety signal only. null is unavailable, never adult clearance. */
export async function readUnder13Origin(userId: string): Promise<boolean | null> {
  const id = UserId.safeParse(userId);
  if (!id.success) return null;
  const rows = await serviceRest<unknown>(
    `/account_safety_origins?user_id=eq.${encodeURIComponent(id.data)}&select=under13_origin&limit=1`,
  );
  const parsed = Origins.safeParse(rows);
  return parsed.success ? parsed.data.length === 1 : null;
}

/** A confirmed write is required before returning an age-refusal session. */
export async function markUnder13Origin(userId: string): Promise<boolean> {
  const id = UserId.safeParse(userId);
  if (!id.success) return false;
  return await serviceRest<unknown>('/rpc/mark_under13_origin', {
    method: 'POST', body: JSON.stringify({ p_user_id: id.data }),
  }) === true;
}
