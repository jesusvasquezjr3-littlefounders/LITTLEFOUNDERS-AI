import type { ReactNode } from 'react';
import { Card } from '@/components/ui';

/*
 * THE ONE AUTH COMPOSITION. /DESIGN.md §Screen Recipes → Auth: focused single
 * centered column on `base` (max-w-md; verification forms max-w-2xl), soft
 * `primary/10` glow behind ONE resting card, `lf-display-lg` title + muted
 * subtitle above the card, one indigo submit CTA, cross-links in `primary`.
 *
 * There used to be TWO shells. `AuthSplit` - two columns over a full-bleed
 * stock photo - carried /login, /signup, /forgot-password and /reset-password,
 * while this one carried /verify-parent and /upgrade-account, so half the auth
 * system obeyed the recipe and half obeyed something else. The recipe text has
 * never changed since it was written; the pages moved off it on 2026-08-01 with
 * no sign-off recorded anywhere, which /DESIGN.md §0 calls a design bug in so
 * many words. AuthSplit is gone and every auth page composes from here.
 *
 * `character` is how the marketing surfaces' visual language reaches this one
 * without breaking the recipe: the same mentor renders the Landing and
 * /how-it-works use, one of them, above the title - the onboarding pattern
 * ("one character with one short line") rather than a photograph behind
 * everything. It is decorative and always `aria-hidden`; the page never depends
 * on it to be understood.
 */
export function AuthShell({
  title,
  subtitle,
  character,
  children,
  footer,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  /** Decorative mentor render, e.g. `/marketing/mentor-zara-bust.webp`. */
  character?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="relative flex justify-center px-5 py-12 sm:py-16 md:px-8">
      {/* The recipe's glow. `pointer-events-none` because it overlays the
          column and would otherwise eat clicks on the first field. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-primary/10 blur-3xl"
        aria-hidden="true"
      />
      <div className={`relative w-full ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <header className="mb-8 flex flex-col items-center text-center">
          {character && (
            <img
              src={character}
              alt=""
              aria-hidden="true"
              width={520}
              height={520}
              loading="eager"
              decoding="async"
              className="mb-1 h-24 w-24 object-contain sm:h-28 sm:w-28"
            />
          )}
          <h1 className="lf-display-lg text-content">{title}</h1>
          {subtitle && <p className="lf-body-lg mt-3 text-content-muted">{subtitle}</p>}
        </header>
        <Card className="p-6 sm:p-8">{children}</Card>
        {footer && <div className="lf-body mt-6 text-center text-content-muted">{footer}</div>}
      </div>
    </div>
  );
}

/*
 * The cross-link style every auth page shares. It was six copies of a raw hex
 * (`text-[#ff775c]` / `hover:text-[#e55f45]`) across four files: the recipe
 * says cross-links are `primary`, and frontend/AGENTS.md's token rule says a
 * component never names a colour. One export means the next change to it is one
 * edit rather than six, and it can never drift between pages again.
 */
export const AUTH_LINK_CLASS =
  'lf-label rounded-sm text-primary underline-offset-2 transition-colors duration-150 hover:text-primary-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';
