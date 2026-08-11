import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { authedUser, requireAuth } from '../middleware/auth.js';
import { nextStreak } from '../services/streak.js';
import {
  getLearningStatsForUpdate,
  getOnboardingResponse,
  insertOnboardingResponse,
  patchLearningStats,
  patchOwnProfile,
} from '../services/supabaseRest.js';

/*
 * POST /onboarding/complete — the one-time, guest-first flow: name
 * (required), an optional discovery-channel survey, optional age (reuses
 * profiles.birth_date, 0006 — never a second copy, /AGENTS.md §1.9), and the
 * create-account-now-or-later offer. On completion, day-1 streak activates
 * (Duolingo-style: the platform gives an early win before the first lesson).
 *
 * Write order is idempotency-load-bearing: profile, then learning_stats,
 * then the onboarding_responses row LAST. That row is the completion marker
 * (checked first, 409s a retry) — inserting it last means a mid-flight
 * failure after the profile/stats writes leaves the caller safely retryable
 * without double-counting the streak or re-patching the profile from stale
 * data (both writes are idempotent overwrites, not deltas).
 */

const DISCOVERY_CHANNELS = ['friend', 'social_media', 'search', 'app_store', 'school', 'ad', 'other'] as const;

function isValidPastDate(d: string): boolean {
  const t = Date.parse(d);
  return !Number.isNaN(t) && t <= Date.now() && Number(d.slice(0, 4)) >= 1900;
}

const OnboardingCompleteBody = z.object({
  displayName: z.string().trim().min(1).max(80),
  discoveryChannel: z.enum(DISCOVERY_CHANNELS).optional(),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'birthDate must be yyyy-mm-dd')
    .refine(isValidPastDate, 'Enter a valid birth date')
    .optional(),
  accountOfferChoice: z.enum(['created_now', 'later']),
  /** Learner's local calendar date (YYYY-MM-DD) — same convention as POST /learn/lessons/:id/complete. */
  localDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export function onboardingRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.post('/complete', async (req, res) => {
    const parsed = OnboardingCompleteBody.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input');
    }
    const user = authedUser(res);

    const existing = await getOnboardingResponse(user.id);
    if (existing === null) return fail(res, 502, 'INTERNAL', 'Could not check onboarding status');
    if (existing.length > 0) return fail(res, 409, 'ONBOARDING_ALREADY_COMPLETE', 'Onboarding was already completed');

    const profilePatch: Record<string, string> = { display_name: parsed.data.displayName };
    if (parsed.data.birthDate !== undefined) profilePatch.birth_date = parsed.data.birthDate;
    const profileOutcome = await patchOwnProfile(user.accessToken, user.id, profilePatch);
    if (profileOutcome !== 'ok') return fail(res, 502, 'INTERNAL', 'Could not save your profile');

    // Read-modify-write, service role: null means Vault did not answer, never
    // "this learner has zero stats" — the PATCH below is a blind overwrite
    // and must not compute from assumed zeros (backend/AGENTS.md).
    const stats = await getLearningStatsForUpdate(user.id);
    if (!stats) return fail(res, 502, 'INTERNAL', 'Profile saved, but learning stats could not be updated');
    const todayLocal = parsed.data.localDate ?? new Date().toISOString().slice(0, 10);
    const newStreak = nextStreak(stats.last_active_date, stats.streak_days, todayLocal);
    const newLongestStreak = Math.max(stats.longest_streak ?? 0, newStreak);
    const statsUpdated = await patchLearningStats(user.id, {
      xp_points: stats.xp_points,
      minutes_learned: stats.minutes_learned,
      lessons_completed: stats.lessons_completed,
      streak_days: newStreak,
      longest_streak: newLongestStreak,
      last_active_date: todayLocal,
    });
    if (!statsUpdated) return fail(res, 502, 'INTERNAL', 'Profile saved, but learning stats could not be updated');

    const recorded = await insertOnboardingResponse({
      user_id: user.id,
      discovery_channel: parsed.data.discoveryChannel ?? null,
      account_offer_choice: parsed.data.accountOfferChoice,
    });
    if (!recorded) return fail(res, 502, 'INTERNAL', 'Could not record onboarding completion');

    return ok(res, { streakDays: newStreak }, 201);
  });

  return router;
}
