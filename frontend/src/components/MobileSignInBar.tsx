import { SignInButton } from '@/features/auth/AccountControls';
import { useSession } from '@/features/auth/session';

/*
 * The fixed call to action on phones: one full-width "Sign in" button pinned to the bottom edge,
 * because signing in is the quickest thing a visitor can do. From 768 px the topbar carries the
 * button and this bar is gone. It sits under the cookie banner (z-30 against its z-40) and the page
 * keeps room for it (SiteFooter pads its bottom), so it never covers content that cannot be scrolled
 * out from under it. Somebody who is signed in has no use for it, so it is gone for them (the
 * account button in the topbar takes over), and it waits until the session is known so it does not
 * flash.
 */
export function MobileSignInBar() {
  const { status } = useSession();

  if (status !== 'signedOut') return null;

  return <div data-fab className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--v-border)] bg-[var(--v-paper)]/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
    <SignInButton placement="bar" />
  </div>;
}
