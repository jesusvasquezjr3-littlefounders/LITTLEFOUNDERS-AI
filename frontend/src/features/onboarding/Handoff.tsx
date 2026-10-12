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
 * account: for an account that already has its own, they are simply erased, and the age is recorded
 * without asking only in the sitting in which it was given (`onboarding.isSameSitting`). Later than
 * that the sign-in window asks the age with an empty field, and erases these answers when the age
 * typed is another one (AuthWindow.tsx), so they never reach this code.
 *
 * It renders nothing. It lives above every page because the account can be created from any of
 * them (the last step, or "Sign in" weeks later).
 */
export function OnboardingHandoff() {
  const session = useSession();
  const answers = useOnboardingAnswers();
  const working = useRef(false);
  // one try for each page load: a refusal is not asked again in a loop, which would spend the allowance of everybody
  // behind the same network address
  const failed = useRef(false);

  useEffect(() => {
    const { account } = session;

    if (session.status !== 'signedIn' || !account || !answers?.finished || working.current || failed.current) return;

    if (account.mentor !== null || account.displayName !== '') return onboarding.clear();

    const { age } = answers;

    // The age is still owed and the sign-in window is asking for it (it needs the permission box, or
    // the answers were not given in this sitting). Wait for it.
    if (account.needsAge && (age === undefined || age < NO_PERMISSION_FROM || !onboarding.isSameSitting())) return;

    // Nothing says the person signed in is the one who answered (another day, and the account already
    // had its age): the answers stay where they are and are not written into this account.
    if (!onboarding.isOwnerPresent()) return;

    working.current = true;

    void (async () => {
      let isAgeSaid = false;

      try {
        if (account.needsAge && age !== undefined) await session.declareAge(age, false);

        isAgeSaid = true;

        const profile: Parameters<typeof session.saveProfile>[0] = {};

        if (answers.name !== undefined) profile.displayName = answers.name;

        if (answers.mentor !== undefined) profile.mentor = answers.mentor;

        // an account that had said its age before the onboarding was not asked again: its type says it is an adult's
        if (answers.path === 'parent' && (age === undefined ? account.type === 'universal' : age >= ADULT_AGE)) profile.parentIntent = true;

        await session.saveProfile(profile);
        onboarding.clear();
      } catch {
        // The age was refused or Core could not be reached. Forget the age so the window asks for it;
        // the rest stays in this browser and is tried again on the next page load.
        failed.current = true;

        if (!isAgeSaid) onboarding.forgetAge();
      } finally {
        working.current = false;
      }
    })();
  }, [session, answers]);

  return null;
}
