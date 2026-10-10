import { MorphIcon } from 'morphicons/react';
import { LogOut, User } from 'lucide';
import { sileo } from 'sileo';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuthDialog } from '@/features/auth/AuthDialog';
import { useSession } from '@/features/auth/session';
import { useCoreCopy } from '@/i18n/useCopy';

/*
 * What the shell shows about the account. Signed out: the "Sign in" button, in the topbar from
 * 768 px and in the bar fixed to the bottom of phones (`placement`); both open the same window
 * (AuthDialog). Signed in: a round account button in the topbar at every width, with a menu that
 * names the account and signs out. While the session is still being asked for, nothing is shown,
 * so the button does not flash for somebody who is signed in.
 */

/** Where the sign-in button sits: the topbar (from 768 px) or the fixed bar at the bottom of phones (MobileSignInBar). */
export type SignInPlacement = 'topbar' | 'bar';

export function SignInButton({ placement = 'topbar' }: { placement?: SignInPlacement }) {
  const copy = useCoreCopy();
  const { open, preload } = useAuthDialog();
  // The window's code is fetched when the pointer or the focus reaches the button, so it is there by the click.
  const early = { onPointerEnter: preload, onFocus: preload };

  return placement === 'bar'
    ? <Button type="button" size="lg" fullWidth data-cta="sign-in" data-origin="mobile-bar" onClick={() => open()} {...early}>{copy.siteShell.signIn}</Button>
    : <Button type="button" size="sm" className="max-md:!hidden" onClick={() => open()} {...early}>{copy.siteShell.signIn}</Button>;
}

function AccountMenu() {
  const copy = useCoreCopy().auth;
  const session = useSession();
  // The account's own name for itself: its username when it has one, otherwise its email.
  const name = session.account?.username ?? session.account?.email ?? copy.account;

  const signOut = async () => {
    await session.signOut();
    sileo.info({ title: copy.signedOut });
  };

  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button type="button" variant="outline" data-icon-only className="size-12 min-w-0 p-0" aria-label={copy.account} title={copy.account}>
        <MorphIcon icon={User} size={22} strokeWidth={2} reducedMotion="user" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" aria-label={copy.account} className="max-w-[min(320px,calc(100vw-32px))]">
      <DropdownMenuLabel className="!tracking-normal !normal-case !whitespace-normal [overflow-wrap:anywhere]">{name}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem adornment={false} onSelect={() => { void signOut(); }}>
        <MorphIcon icon={LogOut} size={18} strokeWidth={2} reducedMotion="user" />{copy.signOut}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}

/** The topbar's account control: the menu when signed in, the sign-in button when not. */
export function AccountControl() {
  const { status } = useSession();

  if (status === 'loading') return null;

  return status === 'signedIn' ? <AccountMenu /> : <SignInButton />;
}
