import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useGuest } from '@/features/app/guest';
import { useAuthDialog } from '@/features/auth/AuthDialog';
import { useSession } from '@/features/auth/session';
import { useCoreCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/utils';

/*
 * What the site offers somebody who is already signed in: one green button, the same one in every
 * place the site calls a visitor to sign in, to sign up or to start the onboarding (the topbar, the
 * two buttons of the home page at its top and at its end, the bar at the bottom of phones). A
 * person with a session is never asked to begin again, and neither is a guest, who walked the
 * onboarding and came in without an account (guest.ts).
 *
 *   - the account is complete, or the person is a guest: "Keep learning", which goes to their home
 *     in the application;
 *   - the account has not said its age yet: "Finish your account", which opens that one step. When
 *     it is done the person is taken to their home (GoHome.tsx).
 *
 * Green is the color of going on (--lf-positive), apart from the orange of a first step.
 */

/** True once the session is known and the person has a way in: an account, complete or not, or a guest's answers. */
export function useHasSession(): boolean {
  const { status, account } = useSession();
  const guest = useGuest();

  return (status === 'signedIn' && account !== null) || guest !== null;
}

const GREEN = '!bg-[var(--lf-positive)] !text-[color:var(--lf-on-positive)] hover:!bg-[var(--lf-positive-hover)]';

export function KeepLearningButton({ size = 'lg', origin, className }: { size?: 'sm' | 'lg'; origin: string; className?: string }) {
  const copy = useCoreCopy().siteShell;
  const { account } = useSession();
  const authDialog = useAuthDialog();

  if (account?.needsAge) {
    return <Button type="button" size={size} className={cn(GREEN, className)} data-cta="finish-account" data-origin={origin}
      onPointerEnter={authDialog.preload} onFocus={authDialog.preload} onClick={() => authDialog.open('age')}>{copy.finishAccount}</Button>;
  }

  return <Button asChild size={size} className={cn(GREEN, className)}>
    <Link to="/home" data-cta="keep-learning" data-origin={origin}>{copy.keepLearning}</Link>
  </Button>;
}
