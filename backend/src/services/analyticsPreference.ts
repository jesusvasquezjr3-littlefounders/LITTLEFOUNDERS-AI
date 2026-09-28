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
  // S-04 (OD-28): a teen who reached the adult tier by birth month keeps an
  // explicit earlier "no" (the database gates 0090/0160 do the same, migration
  // 0182_effective_age_band). With no recorded preference, the adult rule.
  if (state.ageBand === 'adult' && state.adultByBirthMonth === true) {
    const preference = await readAnalyticsPreference(userId);
    if (preference === null) return false;
    return preference.disclosed ? preference.enabled : true;
  }
  if (state.ageBand === 'adult') return true;
  if (state.ageBand !== '13_to_17') return false;
  return (await readAnalyticsPreference(userId))?.enabled === true;
}

/*
 * A.2, Appendix M 1.1 (Unconsented Analytics Event Rate, flagged sessions:
 * target zero): the one predicate every self-reported acquisition answer uses
 * (signup attribution, the onboarding "how did you hear about us" survey, the
 * /auth/me flag the survey step reads). Never an under-13 origin (a guest from
 * the age-refusal path included), never a kid-role account, never an
 * unscreened or unconfirmed identity, and a teen only after their own opt-in.
 */
export async function admitsAcquisitionAnswer(
  userId: string,
  screening: AgeScreenState | null,
  roles: readonly string[] | null,
): Promise<boolean> {
  if (!screening || screening.required || screening.protectedOrigin) return false;
  if (!roles || roles.length === 0 || roles.includes('kid')) return false;
  return allowsSelfManagedAnalytics(userId, screening);
}
