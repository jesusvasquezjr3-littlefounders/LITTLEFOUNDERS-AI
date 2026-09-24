import { z } from 'zod';
import { serviceRest } from './supabaseRest.js';
import type { AgeScreenState } from './ageScreen.js';

const Rows = z.array(z.object({ enabled: z.boolean(), disclosure_version: z.literal(1) }).strict()).max(1);
/** Absence is off until the teen sees and accepts the disclosure. Failure stays distinct. */
export async function readAnalyticsPreference(userId: string): Promise<{ enabled: boolean; disclosed: boolean } | null> {
  if (!z.uuid().safeParse(userId).success) return null;
  const rows = Rows.safeParse(await serviceRest<unknown>(`/teen_analytics_preferences?user_id=eq.${encodeURIComponent(userId)}&select=enabled,disclosure_version&limit=1`));
  return rows.success ? { enabled: rows.data[0]?.enabled ?? false, disclosed: rows.data.length === 1 } : null;
}
export async function setAnalyticsPreference(userId: string, enabled: boolean): Promise<boolean | null> {
  if (!z.uuid().safeParse(userId).success || typeof enabled !== 'boolean') return null;
  const result = await serviceRest<unknown>('/rpc/set_teen_analytics_preference', {
    method: 'POST', body: JSON.stringify({ p_user_id: userId, p_enabled: enabled }),
  });
  return typeof result === 'boolean' ? result : null;
}
/** Applied only after role/guardian checks; does not authorize safety-log changes. */
export async function allowsSelfManagedAnalytics(userId: string, state: AgeScreenState): Promise<boolean> {
  if (state.required || state.protectedOrigin) return false;
  if (state.ageBand === 'adult') return true;
  if (state.ageBand !== '13_to_17') return false;
  return (await readAnalyticsPreference(userId))?.enabled === true;
}
