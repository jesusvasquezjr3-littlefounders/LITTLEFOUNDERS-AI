import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { authedUser, requireAuth } from '../middleware/auth.js';
import { requireAgeScreen } from '../middleware/ageScreen.js';
import { isCalendarDate } from '../services/streak.js';
import {
  getOnboardingResponse,
  insertOnboardingResponse,
  patchOwnProfile,
  recordLearningPracticeDay,
} from '../services/supabaseRest.js';

/*
 * POST /onboarding/complete — the one-time, guest-first flow: name
 * (required), an optional discovery-channel survey, and the
 * create-account-now-or-later offer. On completion, day-1 streak activates
 * (Duolingo-style: the platform gives an early win before the first lesson).
 * Since S05.3e (B.21) the day is recorded by record_learning_practice_day:
 * the habit streak model (rest days, never a reset over one missed day)
 * advanced atomically under the stats row lock, touching no other stat.
 *
 * Write order is idempotency-load-bearing: profile, then learning_stats,
 * then the onboarding_responses row LAST. That row is the completion marker
 * (checked first, 409s a retry) — inserting it last means a mid-flight
 * failure after the profile/stats writes leaves the caller safely retryable
 * without double-counting the streak or re-patching the profile from stale
 * data (a same-day practice day is idempotent in the streak model).
 */

const DISCOVERY_CHANNELS = ['friend', 'social_media', 'search', 'app_store', 'school', 'ad', 'other'] as const;

const OnboardingCompleteBody = z.object({
  displayName: z.string().trim().min(1).max(80),
  discoveryChannel: z.enum(DISCOVERY_CHANNELS).optional(),
  accountOfferChoice: z.enum(['created_now', 'later']),
  /** Learner's local calendar date (YYYY-MM-DD) — same convention as POST /learn/lessons/:id/complete. */
  localDate: z.string().refine(isCalendarDate, 'localDate must be YYYY-MM-DD').optional(),
}).strict();

export function onboardingRouter(): Router {
  const router = Router();
  // Appendix M 1.1 / Part 2.3(b): completing onboarding records a Learn
  // practice day, so an unscreened account is refused here as on /learn. A
  // refused child's guest carries the under-13 origin and reads as screened.
  router.use(requireAuth, requireAgeScreen);

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
    const profileOutcome = await patchOwnProfile(user.accessToken, user.id, profilePatch);
    if (profileOutcome !== 'ok') return fail(res, 502, 'INTERNAL', 'Could not save your profile');

    const todayLocal = parsed.data.localDate ?? new Date().toISOString().slice(0, 10);
    const streak = await recordLearningPracticeDay(user.id, todayLocal);
    if (!streak) return fail(res, 502, 'INTERNAL', 'Profile saved, but learning stats could not be updated');

    const recorded = await insertOnboardingResponse({
      user_id: user.id,
      discovery_channel: parsed.data.discoveryChannel ?? null,
      account_offer_choice: parsed.data.accountOfferChoice,
    });
    if (!recorded) return fail(res, 502, 'INTERNAL', 'Could not record onboarding completion');

    return ok(res, { streakDays: streak.current }, 201);
  });

  return router;
}
