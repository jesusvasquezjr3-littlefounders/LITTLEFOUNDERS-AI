import { useMemo } from 'react';
import { useSession } from '@/features/auth/session';
import { useOnboardingAnswers, type Mentor } from '@/features/onboarding/store';

/*
 * A guest: somebody who walked the onboarding to its end and has no account (D-021, D-056). Creating
 * one is never a requirement to come in: it is how what a person does is kept, and on any device.
 *
 * What makes a guest is in their own browser and nowhere else: the answers of the onboarding, kept
 * for 30 days (D-038), with a name and a mentor in them. Core knows nothing about a guest and gives
 * them nothing that belongs to a person (homeData.ts). Erasing the answers ends the visit.
 */
export type Guest = { name: string; mentor: Mentor };

export function useGuest(): Guest | null {
  const { status } = useSession();
  const answers = useOnboardingAnswers();
  const name = answers?.finished ? answers.name : undefined;
  const mentor = answers?.finished ? answers.mentor : undefined;

  return useMemo(() => (status === 'signedOut' && name !== undefined && mentor !== undefined ? { name, mentor } : null), [status, name, mentor]);
}
