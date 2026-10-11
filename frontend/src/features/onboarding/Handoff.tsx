import { useEffect, useRef } from 'react';
import { useSession } from '@/features/auth/session';
import { ADULT_AGE, onboarding, useOnboardingAnswers } from '@/features/onboarding/store';

/** From this age the sign-up needs no permission box, so the age given in the onboarding is enough. */
export const NO_PERMISSION_FROM = 13;

/*
 * Gives a new account what its owner already answered in the onboarding, so nothing is asked
 * twice: the age (unless a permission box is still owed, which the sign-in window asks for with the
 * age already filled in), then the name, the mentor and whether they came in as a parent. Then the
 * answers are erased from this browser: the account has them.
 *
 * It only acts once the person finished the onboarding, and only on an account that has neither a
 * name nor a mentor yet. Answers left on a shared computer are never written into somebody else's
 * account: for an account that already has its own, they are simply erased.
 *
 * It renders nothing. It lives above every page because the account can be created from any of
 * them (the last step, or "Sign in" weeks later).
 */
export function OnboardingHandoff() {
  const session = useSession();
  const answers = useOnboardingAnswers();
  const working = useRef(false);

  useEffect(() => {
    const { account } = session;

    if (session.status !== 'signedIn' || !account || !answers?.finished || working.current) return;

    if (account.mentor !== null || account.displayName !== '') return onboarding.clear();

    const { age } = answers;

    // The age is still owed and needs the permission box: the sign-in window is asking. Wait for it.
    if (account.needsAge && (age === undefined || age < NO_PERMISSION_FROM)) return;

    working.current = true;

    void (async () => {
      try {
        if (account.needsAge && age !== undefined) await session.declareAge(age, false);

        const profile: Parameters<typeof session.saveProfile>[0] = {};

        if (answers.name !== undefined) profile.displayName = answers.name;

        if (answers.mentor !== undefined) profile.mentor = answers.mentor;

        if (answers.path === 'parent' && age !== undefined && age >= ADULT_AGE) profile.parentIntent = true;

        await session.saveProfile(profile);
        onboarding.clear();
      } catch {
        // The age was refused or Core could not be reached. Forget the age so the window asks for it;
        // the rest stays in this browser and is tried again on the next page load.
        onboarding.forgetAge();
      } finally {
        working.current = false;
      }
    })();
  }, [session, answers]);

  return null;
}
