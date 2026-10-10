import { SignInDialog } from '@/components/SignInDialog';

/*
 * The fixed call to action on phones: one full-width "Sign in" button pinned to the bottom edge,
 * because signing in is the quickest thing a visitor can do. From 768 px the topbar carries the
 * button and this bar is gone. It sits under the cookie banner (z-30 against its z-40) and the page
 * keeps room for it (SiteFooter pads its bottom), so it never covers content that cannot be scrolled
 * out from under it.
 */
export function MobileSignInBar() {
  return <div data-fab className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--v-border)] bg-[var(--v-paper)]/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
    <SignInDialog placement="bar" />
  </div>;
}
