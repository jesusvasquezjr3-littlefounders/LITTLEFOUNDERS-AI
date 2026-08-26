import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth/AuthContext";
import { trackMarketingGoal } from "@/lib/analytics";
import { APP_HOME } from "@/routes/app/navConfig";
import { Button, Icon } from "@/components/ui";

/*
 * THE ACQUISITION BUTTON, shared by every public marketing page.
 *
 * It lived inside Landing until /how-it-works grew a block promising "start
 * without an account": a `<Link to="/signup">` under that heading contradicts
 * the sentence above it, and a `<Link to="/onboarding">` would simply bounce
 * off `RequireAuth`. Starting without an account is not a destination, it is
 * `startGuestSession()` followed by a navigation, and that is a behaviour two
 * pages now need. Copying it would eventually leave one page reporting the
 * conversion and the other not.
 *
 * `guestLabel` overrides the wording for a VISITOR only. The signed-in branch
 * deliberately cannot be relabelled: /AGENTS.md §1.13 requires a marketing CTA
 * to be session-aware, and someone with a session gets "continue where you left
 * off" pointing at the dashboard no matter which button they found.
 */
export function PrimaryCta({
  dataCta,
  wrapperClassName,
  buttonClassName,
  guestLabel,
  errorClassName,
}: {
  dataCta: string;
  wrapperClassName?: string;
  buttonClassName?: string;
  guestLabel?: string;
  /** Where the failure notice sits relative to the button. */
  errorClassName?: string;
}) {
  const { t } = useTranslation();
  const { session, meLoaded, startGuestSession } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [startingGuest, setStartingGuest] = useState(false);
  const [guestError, setGuestError] = useState(false);

  const ctaLabel = session
    ? t("dashboard.continueCta")
    : t("marketing.hero.ctaPrimary");

  // Guest-first entry (Duolingo-style, no signup friction): the primary CTA
  // starts a guest session and drops the visitor straight into onboarding.
  // Signed-in visitors keep the plain declarative Link instead.
  async function startAsGuest() {
    /*
     * The acquisition conversion. Reported BEFORE the await, not after: the
     * call navigates away on success, and an event fired after a route change
     * would be attributed to the destination rather than to the marketing page
     * that actually earned it.
     *
     * trackMarketingGoal re-checks the same gate the pageview path uses, so
     * this is a no-op for a signed-in visitor, a non-consented one, or any
     * surface outside the public marketing set - this component never has to
     * reason about the boundary itself.
     */
    trackMarketingGoal("guest_start", { pathname, session, meLoaded });
    setStartingGuest(true);
    setGuestError(false);
    const { error } = await startGuestSession();
    setStartingGuest(false);
    if (error) {
      setGuestError(true);
      return;
    }
    navigate("/onboarding");
  }

  if (session) {
    return (
      <Link
        to={APP_HOME}
        data-cta={dataCta}
        className={wrapperClassName}
        onClick={() =>
          trackMarketingGoal("cta_signup_start", {
            pathname,
            session,
            meLoaded,
          })
        }
      >
        <Button className={`group ${buttonClassName ?? ""}`}>
          {ctaLabel}
          <Icon
            name="arrow_forward"
            className="transition-transform duration-200 motion-safe:group-hover:translate-x-0.5"
          />
        </Button>
      </Link>
    );
  }

  return (
    <>
      <Button
        data-cta={dataCta}
        className={`group ${buttonClassName ?? ""}`}
        disabled={startingGuest}
        onClick={() => void startAsGuest()}
      >
        {startingGuest
          ? t("marketing.hero.ctaStarting")
          : (guestLabel ?? ctaLabel)}
        <Icon
          name="arrow_forward"
          className="transition-transform duration-200 motion-safe:group-hover:translate-x-0.5"
        />
      </Button>
      {/* A failed guest start must SAY so. Silently leaving the visitor on the
          marketing page looks like a dead button, and this is the one click
          the whole page exists to earn. */}
      {/* `w-full` because the hero puts this button in a `flex-wrap` row next
          to "I already have an account": without a full basis the notice
          becomes a third item beside the buttons instead of a line under them.
          In a plain block context it is simply full width. */}
      {guestError && (
        <p
          role="alert"
          className={`lf-caption text-error-strong ${errorClassName ?? "mt-3 w-full"}`}
        >
          {t("marketing.hero.guestError")}
        </p>
      )}
    </>
  );
}
